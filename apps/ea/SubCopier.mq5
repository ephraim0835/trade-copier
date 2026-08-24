//+------------------------------------------------------------------+
//|                                                   SubCopier.mq5  |
//|                                Phase 7 Ultra-Low-Latency Sub EA  |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property version   "2.00"
#property description "DEMO ONLY Ultra-Low-Latency Execution Sub EA"

#include <Trade\Trade.mqh>
#include "MqlJson.mqh"

input string API_URL = "https://plaiz-markets-api.onrender.com/execution";
input string SUB_ACCOUNT_ID = "DEMO-SUB-1";
input string EA_TOKEN = "sub-token-id.secret123";
input int TIMER_INTERVAL_MS = 50;           // Polling interval (benchmark: 25, 50, 100)
input int WEBREQUEST_TIMEOUT_MS = 2000;     // Failure timeout deadline (2000ms safety deadline for local hot path)

CTrade trade;
string lastProcessedCommandId = ""; // Local Idempotency cache
static bool pollInFlight = false;   // In-flight guard to prevent WebRequest overlap & Error 1003

ulong lastTelemetryAt = 0;
const ulong TELEMETRY_INTERVAL_US = 5000000; // 5 seconds in microseconds

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // DEMO ONLY Safety Check
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO)
     {
      Print("SECURITY ERROR: This EA is locked to DEMO mode only. Real execution is blocked.");
      return(INIT_FAILED);
     }

   PrintFormat("SubCopier v2.0 initialized in DEMO safe mode. Timer: %d ms, Timeout: %d ms", TIMER_INTERVAL_MS, WEBREQUEST_TIMEOUT_MS);
   EventSetMillisecondTimer(TIMER_INTERVAL_MS);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   pollInFlight = false;
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
   // Only execute on demo accounts with algo trading active
   if(AccountInfoInteger(ACCOUNT_TRADE_MODE) != ACCOUNT_TRADE_MODE_DEMO) return;
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return;
   
   ulong nowUs = GetMicrosecondCount();
   if(nowUs - lastTelemetryAt > TELEMETRY_INTERVAL_US)
     {
      lastTelemetryAt = nowUs;
      SendTelemetry();
     }
     
   PollCommands();
  }

//+------------------------------------------------------------------+
//| Poll Commands (with strict in-flight overlap guard)               |
//+------------------------------------------------------------------+
void PollCommands()
  {
   if(pollInFlight) return; // Strict guard: prevent overlapping WebRequests
   pollInFlight = true;

   char post[], result[];
   string resultHeaders;
   string headers = "Authorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   ResetLastError();
   int res = WebRequest("GET", API_URL + "/poll", headers, WEBREQUEST_TIMEOUT_MS, post, result, resultHeaders);
   
   if(res == 200 || res == 201)
     {
      string response = CharArrayToString(result);
      // Extract and process all command objects from the commands array in FIFO order
      int commandsPos = StringFind(response, "\"commands\"");
      if (commandsPos >= 0) {
         int curIdx = StringFind(response, "{", commandsPos);
         while (curIdx >= 0) {
            int endIdx = StringFind(response, "}", curIdx);
            if (endIdx > curIdx) {
               ulong subReceivedAt = GetMicrosecondCount(); // T7
               string commandObj = StringSubstr(response, curIdx, endIdx - curIdx + 1);
               ProcessCommand(commandObj, subReceivedAt);
               curIdx = StringFind(response, "{", endIdx);
            } else {
               break;
            }
         }
      }
     }
   else
     {
      int err = GetLastError();
      if (err != 0 || res != 200) {
         PrintFormat("Poll GET /poll failed! HTTP: %d, Err: %d", res, err);
      }
     }

   pollInFlight = false; // Always release guard regardless of outcome
  }

//+------------------------------------------------------------------+
//| Process Command                                                  |
//+------------------------------------------------------------------+
void ProcessCommand(string json, ulong subReceivedAt)
  {
   string commandId = CMqlJson::GetString(json, "commandId");
   if(commandId == "" || commandId == lastProcessedCommandId) 
     {
      return; // Idempotency
     }
   
   lastProcessedCommandId = commandId;

   // 1. ACK the command (T8)
   char post[], result[];
   string resultHeaders;
   ulong subAcknowledgedAt = GetMicrosecondCount(); // T8
   string ackJson = "{\"commandId\":\"" + commandId + "\",\"subReceivedAt\": " + IntegerToString(subReceivedAt) + ",\"subAcknowledgedAt\": " + IntegerToString(subAcknowledgedAt) + "}";
   StringToCharArray(ackJson, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, StringLen(ackJson)); // Remove null terminator
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   int res = WebRequest("POST", API_URL + "/ack", headers, WEBREQUEST_TIMEOUT_MS, post, result, resultHeaders);
   if(res != 200 && res != 201) 
     {
      PrintFormat("POST /ack failed! HTTP: %d, Err: %d", res, GetLastError());
      return;
     }

   // 2. Validate Command
   string symbol = CMqlJson::GetString(json, "symbol");
   if(!SymbolSelect(symbol, true))
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Symbol not found or disabled", 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
      return;
     }
     
   // Extract parameters early to calculate volume if needed
   string commandType = CMqlJson::GetString(json, "type");
   string orderType = CMqlJson::GetString(json, "orderType");
   double sl = CMqlJson::GetDouble(json, "sl");
   double tp = CMqlJson::GetDouble(json, "tp");
   double price = CMqlJson::GetDouble(json, "price");
   
   if(price == 0 && (orderType == "BUY" || orderType == "BUY_LIMIT" || orderType == "BUY_STOP")) price = SymbolInfoDouble(symbol, SYMBOL_ASK);
   if(price == 0 && (orderType == "SELL" || orderType == "SELL_LIMIT" || orderType == "SELL_STOP")) price = SymbolInfoDouble(symbol, SYMBOL_BID);

   double volume = CMqlJson::GetDouble(json, "volume");
   double intendedRisk = CMqlJson::GetDouble(json, "intendedRisk");
   
   if(intendedRisk > 0 && sl > 0 && price > 0)
     {
      double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(tickSize > 0 && tickValue > 0)
        {
         double slDistance = MathAbs(price - sl);
         double riskPerLot = (slDistance / tickSize) * tickValue;
         if(riskPerLot > 0)
           {
            volume = intendedRisk / riskPerLot;
           }
        }
     }

   double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   
   if(volume < minVol || volume > maxVol)
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Volume invalid for symbol limits", 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
      return;
     }

   // 3. Execute based on command type
   
   ulong subPositionTicket = 0;
   string subTicketStr = CMqlJson::GetString(json, "subPositionTicket");
   if(subTicketStr != "") subPositionTicket = (ulong)StringToInteger(subTicketStr);

   ulong subOrderTicket = 0;
   string subOrderStr = CMqlJson::GetString(json, "subOrderTicket");
   if(subOrderStr != "") subOrderTicket = (ulong)StringToInteger(subOrderStr);
   
   bool success = false;
   uint retcode = 0;
   ulong resultTicket = 0;
   
   ulong subExecutionStartedAt = GetMicrosecondCount(); // T9
   
   // Normalize prices and volume
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   if(tp > 0) tp = NormalizeDouble(tp, digits);
   if(price > 0) price = NormalizeDouble(price, digits);

   double stepVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   if(stepVol > 0 && volume > 0) volume = MathFloor(volume / stepVol) * stepVol;
   if(volume > 0 && volume < minVol) volume = minVol;
   if(volume > maxVol) volume = maxVol;
   
   if(commandType == "OPEN_ORDER" || commandType == "")
     {
      if(orderType == "BUY")
        {
         if(price == 0) price = SymbolInfoDouble(symbol, SYMBOL_ASK);
         success = trade.Buy(volume, symbol, price, sl, tp, "SubCopier");
        }
      else if(orderType == "SELL")
        {
         if(price == 0) price = SymbolInfoDouble(symbol, SYMBOL_BID);
         success = trade.Sell(volume, symbol, price, sl, tp, "SubCopier");
        }
      else if(orderType == "BUY_LIMIT")
        {
         success = trade.BuyLimit(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "SubCopier");
        }
      else if(orderType == "SELL_LIMIT")
        {
         success = trade.SellLimit(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "SubCopier");
        }
      else if(orderType == "BUY_STOP")
        {
         success = trade.BuyStop(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "SubCopier");
        }
      else if(orderType == "SELL_STOP")
        {
         success = trade.SellStop(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "SubCopier");
        }
      else 
        {
         ulong now = GetMicrosecondCount();
         ReportResult(commandId, false, 0, "Unsupported order type: " + orderType, 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
         return;
        }
     }
    else if (commandType == "MODIFY_ORDER")
      {
       ulong targetTicket = subPositionTicket;
       bool found = false;
       
       if(targetTicket > 0 && PositionSelectByTicket(targetTicket))
         {
          found = true;
         }
       else
         {
          // Fallback search across open positions matching ticket, identifier, or symbol
          int matchingPositions = 0;
          ulong matchedTicket = 0;
          for(int p = PositionsTotal() - 1; p >= 0; p--)
            {
             ulong posTicket = PositionGetTicket(p);
             if(posTicket > 0)
               {
                long posId = PositionGetInteger(POSITION_IDENTIFIER);
                string posSym = PositionGetString(POSITION_SYMBOL);
                if((targetTicket > 0 && (posTicket == targetTicket || (ulong)posId == targetTicket)))
                  {
                   matchedTicket = posTicket;
                   matchingPositions = 1;
                   break;
                  }
                else if(targetTicket == 0 && posSym == symbol)
                  {
                   matchedTicket = posTicket;
                   matchingPositions++;
                  }
               }
            }
          if(targetTicket == 0 && matchingPositions > 1)
            {
             Print("CRITICAL: Multiple positions match symbol, but targetTicket is 0. Aborting modification to prevent modifying the wrong trade.");
             found = false;
            }
          else if(matchingPositions == 1)
            {
             targetTicket = matchedTicket;
             found = true;
            }
         }

       if(found)
         {
          PrintFormat("=== MODIFY START ===\ncommandId=%s\nsymbol=%s\npositionTicket=%I64u\nrequestedSL=%.5f\nrequestedTP=%.5f",
                      commandId, symbol, targetTicket, sl, tp);
          success = trade.PositionModify(targetTicket, sl, tp);
          PrintFormat("=== MODIFY END ===\nPositionModify returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s\nResultOrder=%I64u\nResultDeal=%I64u",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription(), trade.ResultOrder(), trade.ResultDeal());
         }
       else if(subOrderTicket > 0 && OrderSelect(subOrderTicket))
         {
          PrintFormat("=== ORDER MODIFY START ===\ncommandId=%s\nsubOrderTicket=%I64u\nprice=%.5f\nrequestedSL=%.5f\nrequestedTP=%.5f",
                      commandId, subOrderTicket, price, sl, tp);
          success = trade.OrderModify(subOrderTicket, price, sl, tp, ORDER_TIME_GTC, 0, 0);
          PrintFormat("=== ORDER MODIFY END ===\nOrderModify returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription());
         }
       else
         {
          ulong now = GetMicrosecondCount();
          ReportResult(commandId, false, 0, "Position not found for modification. TargetTicket: " + IntegerToString(targetTicket) + ", Symbol: " + symbol, 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
          return;
         }
      }
    else if (commandType == "CLOSE_ORDER" || commandType == "CLOSE_PARTIAL")
      {
       ulong targetTicket = subPositionTicket;
       bool found = false;
       
       if(targetTicket > 0 && PositionSelectByTicket(targetTicket))
         {
          found = true;
         }
       else
         {
          // Fallback search across open positions matching ticket, identifier, or symbol
          int matchingPositions = 0;
          ulong matchedTicket = 0;
          for(int p = PositionsTotal() - 1; p >= 0; p--)
            {
             ulong posTicket = PositionGetTicket(p);
             if(posTicket > 0)
               {
                long posId = PositionGetInteger(POSITION_IDENTIFIER);
                string posSym = PositionGetString(POSITION_SYMBOL);
                if((targetTicket > 0 && (posTicket == targetTicket || (ulong)posId == targetTicket)))
                  {
                   matchedTicket = posTicket;
                   matchingPositions = 1;
                   break;
                  }
                else if(targetTicket == 0 && posSym == symbol)
                  {
                   matchedTicket = posTicket;
                   matchingPositions++;
                  }
               }
            }
          if(targetTicket == 0 && matchingPositions > 1)
            {
             Print("CRITICAL: Multiple positions match symbol, but targetTicket is 0. Aborting close to prevent closing the wrong trade.");
             found = false;
            }
          else if(matchingPositions == 1)
            {
             targetTicket = matchedTicket;
             found = true;
            }
         }
         
       if(found)
         {
          PrintFormat("=== CLOSE START ===\ncommandType=%s\ncommandId=%s\nsymbol=%s\npositionTicket=%I64u\nrequestedVol=%.2f",
                      commandType, commandId, symbol, targetTicket, volume);
          if(commandType == "CLOSE_PARTIAL")
             success = trade.PositionClosePartial(targetTicket, volume, -1);
          else
             success = trade.PositionClose(targetTicket, -1);
          PrintFormat("=== CLOSE END ===\nPositionClose returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s\nResultOrder=%I64u\nResultDeal=%I64u",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription(), trade.ResultOrder(), trade.ResultDeal());
         }
       else if(subOrderTicket > 0 && OrderSelect(subOrderTicket))
         {
          success = trade.OrderDelete(subOrderTicket);
         }
       else
         {
          ulong now = GetMicrosecondCount();
          ReportResult(commandId, false, 0, "Position not found for closure. TargetTicket: " + IntegerToString(targetTicket) + ", Symbol: " + symbol, 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
          return;
         }
      }
   else
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Unsupported command type: " + commandType, 0, 0, subReceivedAt, subAcknowledgedAt, subExecutionStartedAt, now);
      return;
     }

   ulong subExecutionCompletedAt = GetMicrosecondCount(); // T10
   retcode = trade.ResultRetcode();
   resultTicket = trade.ResultOrder();
   
   double execVol = trade.ResultVolume();
   if (execVol == 0 && success && (commandType == "CLOSE_PARTIAL" || commandType == "CLOSE_ORDER")) {
      execVol = volume; 
   } else if (execVol == 0 && success && commandType == "OPEN_ORDER") {
      execVol = volume;
   }
   
   ReportResult(commandId, success, retcode, trade.ResultComment(), resultTicket, execVol, subReceivedAt, subAcknowledgedAt, subExecutionStartedAt, subExecutionCompletedAt);
  }

//+------------------------------------------------------------------+
//| Report Result (T11 dispatch)                                      |
//+------------------------------------------------------------------+
void ReportResult(string commandId, bool success, uint retcode, string errorStr, ulong ticket = 0, double executedVolume = 0, ulong subReceivedAt = 0, ulong subAcknowledgedAt = 0, ulong subExecutionStartedAt = 0, ulong subExecutionCompletedAt = 0)
  {
   string json = "{";
   json += "\"commandId\":\"" + commandId + "\",";
   json += "\"success\":" + (success ? "true" : "false") + ",";
   json += "\"retcode\":" + IntegerToString(retcode) + ",";
   json += "\"retcodeDescription\":\"" + errorStr + "\",";
   json += "\"orderTicket\":\"" + IntegerToString(ticket) + "\",";
   json += "\"executedVolume\":" + DoubleToString(executedVolume, 2) + ",";
   json += "\"subReceivedAt\":" + IntegerToString(subReceivedAt) + ",";
   json += "\"subAcknowledgedAt\":" + IntegerToString(subAcknowledgedAt) + ",";
   json += "\"subExecutionStartedAt\":" + IntegerToString(subExecutionStartedAt) + ",";
   json += "\"subExecutionCompletedAt\":" + IntegerToString(subExecutionCompletedAt) + ",";
   json += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
   json += "}";
   
   char post[], result[];
   string resultHeaders;
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, StringLen(json)); // Remove null terminator
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   int res = WebRequest("POST", API_URL + "/result", headers, WEBREQUEST_TIMEOUT_MS, post, result, resultHeaders);
   if(res != 200 && res != 201)
     {
      PrintFormat("POST /result failed! HTTP: %d, Err: %d, Msg: %s", res, GetLastError(), CharArrayToString(result));
     }
  }

//+------------------------------------------------------------------+
//| Send Telemetry                                                   |
//+------------------------------------------------------------------+
void SendTelemetry()
  {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double floatingPl = AccountInfoDouble(ACCOUNT_PROFIT);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   
   string json = "{";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"margin\":" + DoubleToString(margin, 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ",";
   json += "\"floatingPl\":" + DoubleToString(floatingPl, 2) + ",";
   json += "\"currency\":\"" + currency + "\"";
   json += "}";
   
   char post[], result[];
   string resultHeaders;
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, StringLen(json)); // Remove null terminator
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   string baseUrl = API_URL;
   // API_URL is something like "http://127.0.0.1:9001/execution"
   int pos = StringFind(baseUrl, "/execution");
   if (pos > 0) baseUrl = StringSubstr(baseUrl, 0, pos);
   
   int res = WebRequest("POST", baseUrl + "/accounts/telemetry", headers, 2000, post, result, resultHeaders);
   if(res != 200 && res != 201)
     {
      PrintFormat("Telemetry failed! HTTP: %d", res);
     }
  }
