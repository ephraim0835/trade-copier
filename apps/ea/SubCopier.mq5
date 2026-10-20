//+------------------------------------------------------------------+
//|                                                   SubCopier.mq5  |
//|                                Phase 7 Ultra-Low-Latency Sub EA  |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property version   "2.00"
#property description "DEMO ONLY Ultra-Low-Latency Execution Sub EA"

#include <Trade\Trade.mqh>
#include "MqlJson.mqh"
#include "WinInet.mqh"


string API_URL = "https://plaiz-markets-api.onrender.com/execution";
string SUB_ACCOUNT_ID = "";
string EA_TOKEN = "";
int TIMER_INTERVAL_MS = 50;           // Polling interval (benchmark: 25, 50, 100)
int WEBREQUEST_TIMEOUT_MS = 2000;     // Failure timeout deadline (2000ms safety deadline for local hot path)

void LogToFile(string msg)
{
    int handle = FileOpen("sub_debug.log", FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(handle == INVALID_HANDLE)
    {
        handle = FileOpen("sub_debug.log", FILE_WRITE|FILE_TXT|FILE_ANSI);
    }
    if(handle != INVALID_HANDLE)
    {
        FileSeek(handle, 0, SEEK_END);
        FileWriteString(handle, TimeToString(TimeLocal(), TIME_DATE|TIME_SECONDS) + " " + msg + "\r\n");
        FileFlush(handle);
        FileClose(handle);
    }
}

void LoadConfig()
{
    int handle = FileOpen("ea_config.txt", FILE_READ|FILE_TXT|FILE_ANSI);
    if(handle != INVALID_HANDLE)
    {
        while(!FileIsEnding(handle))
        {
            string line = FileReadString(handle);
            StringTrimLeft(line);
            StringTrimRight(line);
            string result[];
            if(StringSplit(line, StringGetCharacter("=",0), result) >= 2)
            {
                StringTrimLeft(result[0]);
                StringTrimRight(result[0]);
                StringTrimLeft(result[1]);
                StringTrimRight(result[1]);
                if(result[0] == "API_URL") API_URL = result[1];
                if(result[0] == "EA_TOKEN") EA_TOKEN = result[1];
                if(result[0] == "SUB_ACCOUNT_ID") SUB_ACCOUNT_ID = result[1];
            }
        }
        FileClose(handle);
    }
}

CTrade trade;
string ProcessedCommands[];
const int MAX_PROCESSED = 50;
const string HISTORY_FILE = "SubCopier_History.csv";
static bool pollInFlight = false;   // In-flight guard to prevent WebRequest overlap & Error 1003

ulong lastTelemetryAt = 0;
double lastSentFloatingPl = 9999999.0;
const ulong TELEMETRY_ACTIVE_INTERVAL_US = 2000000;   // 2s when open positions exist
const ulong TELEMETRY_IDLE_INTERVAL_US   = 10000000;  // 10s heartbeat when 0 open positions

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   LoadConfig();
   
   // Load idempotency history
   if(FileIsExist(HISTORY_FILE))
     {
      int handle = FileOpen(HISTORY_FILE, FILE_READ|FILE_CSV|FILE_ANSI);
      if(handle != INVALID_HANDLE)
        {
         while(!FileIsEnding(handle))
           {
            string cmdId = FileReadString(handle);
            if(cmdId != "")
              {
               int size = ArraySize(ProcessedCommands);
               if(size >= MAX_PROCESSED)
                 {
                  for(int i = 0; i < size - 1; i++) ProcessedCommands[i] = ProcessedCommands[i+1];
                  ProcessedCommands[size - 1] = cmdId;
                 }
               else
                 {
                  ArrayResize(ProcessedCommands, size + 1);
                  ProcessedCommands[size] = cmdId;
                 }
              }
           }
         FileClose(handle);
        }
     }
     
   EventSetMillisecondTimer(TIMER_INTERVAL_MS);
   LogToFile("SubCopier OnInit() started. SubAccount: " + SUB_ACCOUNT_ID);
   PrintFormat("SubCopier v2.0 initialized. SubAccount: %s, Polling: %d ms, History: %d items", SUB_ACCOUNT_ID, TIMER_INTERVAL_MS, ArraySize(ProcessedCommands));
   LogToFile("SubCopier OnInit() completed");
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
   ulong nowUs = GetMicrosecondCount();
   
   // --- Adaptive Telemetry (Snappy PnL push without resource waste) ---
   int openCount = PositionsTotal();
   ulong telInterval = (openCount > 0) ? TELEMETRY_ACTIVE_INTERVAL_US : TELEMETRY_IDLE_INTERVAL_US;
   double currentPl = AccountInfoDouble(ACCOUNT_PROFIT);
   bool plChanged = (openCount > 0 && MathAbs(currentPl - lastSentFloatingPl) >= 0.05 && (nowUs - lastTelemetryAt > 1000000));

   if(nowUs - lastTelemetryAt > telInterval || plChanged)
     {
      lastTelemetryAt = nowUs;
      lastSentFloatingPl = currentPl;
      SendTelemetry();
     }

   // Only execute trades if algo trading active
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
     {
      static ulong lastWarnUs = 0;
      if(nowUs - lastWarnUs > 10000000) // Log once every 10 seconds
        {
         lastWarnUs = nowUs;
         Print("WARNING: Algorithmic trading (TERMINAL_TRADE_ALLOWED) is DISABLED in MT5! SubCopier cannot poll or copy trades.");
         LogToFile("WARNING: Algorithmic trading is DISABLED in MT5! Trade polling and execution blocked.");
        }
      return;
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

   char result[];
   string headers = "Authorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   ResetLastError();
   int res = CWinInet::Get(API_URL + "/poll", headers, result);
   
   // Resilient fallback: If WinInet fails, immediately fall back to MT5 native WebRequest
   if(res != 200 && res != 201 && res != 204)
     {
      string webHeaders = "Authorization: Bearer " + EA_TOKEN + "\r\n";
      string respHeaders = "";
      uchar dummyPost[];
      char respData[];
      res = WebRequest("GET", API_URL + "/poll", webHeaders, 3000, dummyPost, respData, respHeaders);
      if(res == 200 || res == 201 || res == 204)
        {
         ArrayCopy(result, respData);
        }
     }
   
   if(res == 200 || res == 201)
     {
      // Reset backoff on success
      if (TIMER_INTERVAL_MS != 50) {
         TIMER_INTERVAL_MS = 50;
         EventSetMillisecondTimer(TIMER_INTERVAL_MS);
      }
      
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
   else if(res == 204)
     {
      // 204 No Content - success but empty
      if (TIMER_INTERVAL_MS != 50) {
         TIMER_INTERVAL_MS = 50;
         EventSetMillisecondTimer(TIMER_INTERVAL_MS);
      }
     }
   else
     {
      int err = GetLastError();
      PrintFormat("Poll GET /poll failed! HTTP: %d, Err: %d", res, err);
      
      // Exponential backoff
      TIMER_INTERVAL_MS = TIMER_INTERVAL_MS * 2;
      if (TIMER_INTERVAL_MS > 5000) TIMER_INTERVAL_MS = 5000;
      EventSetMillisecondTimer(TIMER_INTERVAL_MS);
     }

   pollInFlight = false; // Always release guard regardless of outcome
  }

//+------------------------------------------------------------------+
//| Resolve Symbol for Current Broker                                |
//+------------------------------------------------------------------+
string ResolveSymbol(string symbol)
{
   if(SymbolSelect(symbol, true)) return symbol;

   string baseSym = symbol;
   int dotPos = StringFind(baseSym, ".");
   if(dotPos > 0) baseSym = StringSubstr(baseSym, 0, dotPos);
   else if(StringLen(baseSym) > 6 && StringSubstr(baseSym, StringLen(baseSym)-1, 1) == "m")
      baseSym = StringSubstr(baseSym, 0, StringLen(baseSym)-1);

   // Cross-broker alias lists
   string aliases[];
   ArrayResize(aliases, 0);

   if(StringFind(baseSym, "BTC") >= 0)
     {
      ArrayResize(aliases, 4);
      aliases[0] = "BTC"; aliases[1] = "BTCUSD"; aliases[2] = "BTCUSD.m"; aliases[3] = "BTCUSDm";
     }
   else if(StringFind(baseSym, "ETH") >= 0)
     {
      ArrayResize(aliases, 4);
      aliases[0] = "ETH"; aliases[1] = "ETHUSD"; aliases[2] = "ETHUSD.m"; aliases[3] = "ETHUSDm";
     }
   else if(StringFind(baseSym, "NAS") >= 0 || StringFind(baseSym, "USTEC") >= 0 || StringFind(baseSym, "100") >= 0)
     {
      ArrayResize(aliases, 5);
      aliases[0] = "NASDAQ-100"; aliases[1] = "NAS100"; aliases[2] = "USTEC"; aliases[3] = "US100"; aliases[4] = "NAS100.m";
     }
   else if(StringFind(baseSym, "US30") >= 0 || StringFind(baseSym, "DJ") >= 0 || StringFind(baseSym, "WS30") >= 0)
     {
      ArrayResize(aliases, 4);
      aliases[0] = "DJ30"; aliases[1] = "US30"; aliases[2] = "WALLSTREET30"; aliases[3] = "US30.m";
     }
   else if(StringFind(baseSym, "XAU") >= 0 || StringFind(baseSym, "GOLD") >= 0)
     {
      ArrayResize(aliases, 4);
      aliases[0] = "XAUUSD"; aliases[1] = "GOLD"; aliases[2] = "XAUUSD.m"; aliases[3] = "XAUUSDm";
     }

   for(int i = 0; i < ArraySize(aliases); i++)
     {
      if(SymbolSelect(aliases[i], true))
        {
         PrintFormat("Mapped symbol '%s' -> alias '%s'", symbol, aliases[i]);
         return aliases[i];
        }
     }

   // Standard prefix/suffix candidates
   string candidates[8];
   candidates[0] = baseSym;
   candidates[1] = baseSym + ".m";
   candidates[2] = baseSym + "m";
   candidates[3] = baseSym + ".s";
   candidates[4] = baseSym + "_i";
   candidates[5] = symbol + ".m";
   candidates[6] = symbol + "m";
   candidates[7] = baseSym + ".";

   for(int c = 0; c < 8; c++)
     {
      if(SymbolSelect(candidates[c], true))
        {
         PrintFormat("Mapped symbol '%s' -> candidate '%s'", symbol, candidates[c]);
         return candidates[c];
        }
     }

   // Dynamic search in broker market watch
   int total = SymbolsTotal(false);
   for(int s = 0; s < total; s++)
     {
      string sName = SymbolName(s, false);
      if(StringFind(sName, baseSym) == 0 || StringFind(sName, symbol) == 0)
        {
         if(SymbolSelect(sName, true))
           {
            PrintFormat("Mapped symbol '%s' -> searched '%s'", symbol, sName);
            return sName;
           }
        }
     }

   return "";
}

//+------------------------------------------------------------------+
//| Clamp SL and TP to satisfy broker SYMBOL_TRADE_STOPS_LEVEL       |
//+------------------------------------------------------------------+
void ClampStopsToBrokerLimits(string sym, string ordType, double openPrice, double &stopLoss, double &takeProfit)
{
   if(stopLoss <= 0 && takeProfit <= 0) return;

   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(point <= 0) point = 0.00001;

   long stopLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   long freezeLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_FREEZE_LEVEL);
   long minPoints = MathMax(stopLevel, freezeLevel);
   
   // Add 2 points buffer to prevent race condition rejects during volatility
   double minDistance = (minPoints > 0 ? (minPoints + 2) : 2) * point;

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);

   bool isBuy = (ordType == "BUY" || ordType == "BUY_LIMIT" || ordType == "BUY_STOP");
   bool isSell = (ordType == "SELL" || ordType == "SELL_LIMIT" || ordType == "SELL_STOP");

   if(ordType == "BUY")
     {
      double basePrice = (bid > 0) ? bid : openPrice;
      if(stopLoss > 0 && stopLoss > (basePrice - minDistance))
        {
         double oldSl = stopLoss;
         stopLoss = NormalizeDouble(basePrice - minDistance, digits);
         PrintFormat("STOPS_LEVEL CLAMP: BUY SL %.5f too close to Bid %.5f (min %d pts). Clamped to %.5f", 
                     oldSl, basePrice, (int)minPoints, stopLoss);
        }
      double tpBase = (ask > 0) ? ask : openPrice;
      if(takeProfit > 0 && takeProfit < (tpBase + minDistance))
        {
         double oldTp = takeProfit;
         takeProfit = NormalizeDouble(tpBase + minDistance, digits);
         PrintFormat("STOPS_LEVEL CLAMP: BUY TP %.5f too close to Ask %.5f (min %d pts). Clamped to %.5f", 
                     oldTp, tpBase, (int)minPoints, takeProfit);
        }
     }
   else if(ordType == "SELL")
     {
      double basePrice = (ask > 0) ? ask : openPrice;
      if(stopLoss > 0 && stopLoss < (basePrice + minDistance))
        {
         double oldSl = stopLoss;
         stopLoss = NormalizeDouble(basePrice + minDistance, digits);
         PrintFormat("STOPS_LEVEL CLAMP: SELL SL %.5f too close to Ask %.5f (min %d pts). Clamped to %.5f", 
                     oldSl, basePrice, (int)minPoints, stopLoss);
        }
      double tpBase = (bid > 0) ? bid : openPrice;
      if(takeProfit > 0 && takeProfit > (tpBase - minDistance))
        {
         double oldTp = takeProfit;
         takeProfit = NormalizeDouble(tpBase - minDistance, digits);
         PrintFormat("STOPS_LEVEL CLAMP: SELL TP %.5f too close to Bid %.5f (min %d pts). Clamped to %.5f", 
                     oldTp, tpBase, (int)minPoints, takeProfit);
        }
     }
   else if(isBuy) // BUY_LIMIT or BUY_STOP
     {
      double basePrice = (openPrice > 0) ? openPrice : ask;
      if(stopLoss > 0 && stopLoss > (basePrice - minDistance))
        {
         stopLoss = NormalizeDouble(basePrice - minDistance, digits);
        }
      if(takeProfit > 0 && takeProfit < (basePrice + minDistance))
        {
         takeProfit = NormalizeDouble(basePrice + minDistance, digits);
        }
     }
   else if(isSell) // SELL_LIMIT or SELL_STOP
     {
      double basePrice = (openPrice > 0) ? openPrice : bid;
      if(stopLoss > 0 && stopLoss < (basePrice + minDistance))
        {
         stopLoss = NormalizeDouble(basePrice + minDistance, digits);
        }
      if(takeProfit > 0 && takeProfit > (basePrice - minDistance))
        {
         takeProfit = NormalizeDouble(basePrice - minDistance, digits);
        }
     }

   if(stopLoss > 0) stopLoss = NormalizeDouble(stopLoss, digits);
   if(takeProfit > 0) takeProfit = NormalizeDouble(takeProfit, digits);
}

//+------------------------------------------------------------------+
//| Process Command                                                  |
//+------------------------------------------------------------------+
void ProcessCommand(string json, ulong subReceivedAt)
  {
   string commandId = CMqlJson::GetString(json, "commandId");
   if(commandId == "") return;

   // Idempotency: Check if already processed
   for(int i = 0; i < ArraySize(ProcessedCommands); i++)
     {
      if(ProcessedCommands[i] == commandId) return; // Already processed
     }

   ulong subAcknowledgedAt = GetMicrosecondCount(); // T8

   // 2. Validate Command & Symbol
   PrintFormat("DEBUG RECEIVED JSON: %s", json);
   string rawSymbol = CMqlJson::GetString(json, "symbol");
   string symbol = ResolveSymbol(rawSymbol);
   if(symbol == "")
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Symbol not found or disabled on broker: " + rawSymbol, 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
      return;
     }
     
   // Extract parameters early to calculate volume
   string commandType = CMqlJson::GetString(json, "type");
   string orderType = CMqlJson::GetString(json, "orderType");
   double sl = CMqlJson::GetDouble(json, "sl");
   double tp = CMqlJson::GetDouble(json, "tp");
   double price = CMqlJson::GetDouble(json, "price");
   
   // Live market prices on Sub broker
   double currentAsk = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double currentBid = SymbolInfoDouble(symbol, SYMBOL_BID);

   // For market orders, fallback to current ASK/BID if price is 0
   if(price == 0 && orderType == "BUY") price = currentAsk;
   if(price == 0 && orderType == "SELL") price = currentBid;

   // Pending orders require valid non-zero limit/stop price
   bool isPending = (orderType == "BUY_LIMIT" || orderType == "SELL_LIMIT" || orderType == "BUY_STOP" || orderType == "SELL_STOP");
   if(isPending && price <= 0)
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Pending order requires a valid non-zero price", 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
      return;
     }

   // Exact execution reference price
   double refPrice = (orderType == "BUY") ? currentAsk : ((orderType == "SELL") ? currentBid : price);
   if(refPrice <= 0) refPrice = price;

   // Automatically clamp SL/TP against broker SYMBOL_TRADE_STOPS_LEVEL (prevents Error 10016)
   ClampStopsToBrokerLimits(symbol, orderType, refPrice, sl, tp);

   double passedVolume = CMqlJson::GetDouble(json, "volume");
   double volume = passedVolume;
   double intendedRisk = CMqlJson::GetDouble(json, "intendedRisk");
   double maxLotCap = CMqlJson::GetDouble(json, "maxLotCap");
   
   if(intendedRisk > 0 && sl > 0 && refPrice > 0)
     {
      double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(tickValue <= 0) tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
      if(tickValue <= 0) tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
      if(tickSize > 0 && tickValue > 0)
        {
         double slDistance = MathAbs(refPrice - sl);
         double riskPerLot = (slDistance / tickSize) * tickValue;
         if(riskPerLot > 0)
           {
            volume = intendedRisk / riskPerLot;
            PrintFormat("DEBUG VOLUME CALC: intendedRisk=%f, refPrice=%f, sl=%f, slDistance=%f, tickSize=%f, tickValue=%f, riskPerLot=%f, volume=%f", 
                        intendedRisk, refPrice, sl, slDistance, tickSize, tickValue, riskPerLot, volume);
           }
        }
     }

   double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double stepVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   // Apply user Max Lot Hard Cap
   if(maxLotCap > 0 && (maxVol <= 0 || maxLotCap < maxVol))
     {
      maxVol = maxLotCap;
     }

   // Fallback: If volume is 0 or below minimum, preserve passed scaled volume or minVol
   if(volume <= 0)
     {
      volume = (passedVolume > 0) ? passedVolume : minVol;
     }

   // Determine volume step precision
   int volDigits = 2;
   if(stepVol >= 1.0) volDigits = 0;
   else if(stepVol >= 0.1) volDigits = 1;
   else if(stepVol >= 0.01) volDigits = 2;
   else if(stepVol >= 0.001) volDigits = 3;
   else volDigits = 4;

   // Step and clamp volume with IEEE 754 precision epsilon
   if(stepVol > 0 && volume > 0)
     {
      volume = MathFloor((volume + 1e-7) / stepVol) * stepVol;
      volume = NormalizeDouble(volume, volDigits);
     }
   if(minVol > 0 && volume < minVol) volume = minVol;
   if(maxVol > 0 && volume > maxVol)
     {
      volume = maxVol;
      if(stepVol > 0)
        {
         volume = MathFloor((volume + 1e-7) / stepVol) * stepVol;
         volume = NormalizeDouble(volume, volDigits);
        }
     }
   
   if(volume < minVol || (maxVol > 0 && volume > maxVol))
     {
      ulong now = GetMicrosecondCount();
      ReportResult(commandId, false, 0, "Volume invalid for symbol limits or max lot cap", 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
      return;
     }

   // 3. Ultra-Low-Latency Order Execution (T9-T10)
   // Direct execution BEFORE any blocking network roundtrips!
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
   
   // Normalize prices
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(sl > 0) sl = NormalizeDouble(sl, digits);
   if(tp > 0) tp = NormalizeDouble(tp, digits);
   if(price > 0) price = NormalizeDouble(price, digits);

   if(commandType == "OPEN_ORDER" || commandType == "")
     {
      ENUM_ORDER_TYPE ot = ORDER_TYPE_BUY;
      if(orderType == "SELL") ot = ORDER_TYPE_SELL;
      else if(orderType == "BUY_LIMIT") ot = ORDER_TYPE_BUY_LIMIT;
      else if(orderType == "SELL_LIMIT") ot = ORDER_TYPE_SELL_LIMIT;
      else if(orderType == "BUY_STOP") ot = ORDER_TYPE_BUY_STOP;
      else if(orderType == "SELL_STOP") ot = ORDER_TYPE_SELL_STOP;

      // Pre-flight Margin Safety Guard: Check required margin before submitting to broker
      double marginRequired = 0;
      double checkPrice = (price > 0) ? price : (ot == ORDER_TYPE_BUY ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID));
      if(checkPrice > 0 && OrderCalcMargin(ot, symbol, volume, checkPrice, marginRequired))
        {
         double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
         if(freeMargin > 0 && marginRequired > (freeMargin * 0.90))
           {
            // Margin exceeds 90% of free margin - prevent 10019 RET_NO_MONEY by scaling down safely
            double safeRatio = (freeMargin * 0.85) / marginRequired;
            double safeVol = volume * safeRatio;
            if(stepVol > 0)
              {
               safeVol = MathFloor((safeVol + 1e-7) / stepVol) * stepVol;
               safeVol = NormalizeDouble(safeVol, volDigits);
              }
            if(safeVol >= minVol)
              {
               PrintFormat("PRE-FLIGHT MARGIN GUARD: Required margin %.2f exceeds 90%% of free margin %.2f. Reduced volume from %.2f to %.2f",
                           marginRequired, freeMargin, volume, safeVol);
               volume = safeVol;
              }
            else
              {
               ulong now = GetMicrosecondCount();
               PrintFormat("PRE-FLIGHT MARGIN REJECT: Required margin %.2f exceeds free margin %.2f even at minVol %.2f",
                           marginRequired, freeMargin, minVol);
               ReportResult(commandId, false, 10019, "Pre-flight rejected: Insufficient free margin for order (RET_NO_MONEY)", 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
               return;
              }
           }
        }

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
       bool isPos = false;
       
       if(targetTicket > 0 && PositionSelectByTicket(targetTicket))
         {
          isPos = true;
         }
       else
         {
          // Fallback search across open positions
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
          if(matchingPositions == 1)
            {
             targetTicket = matchedTicket;
             isPos = true;
            }
         }

       // Check if it's a pending order to modify
       ulong orderTicketToModify = 0;
       if(!isPos)
         {
          if(subOrderTicket > 0 && OrderSelect(subOrderTicket)) orderTicketToModify = subOrderTicket;
          else if(targetTicket > 0 && OrderSelect(targetTicket)) orderTicketToModify = targetTicket;
         }

       if(isPos)
         {
          ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
          string modifyOrdType = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
          double posOpenPrice = PositionGetDouble(POSITION_PRICE_OPEN);
          ClampStopsToBrokerLimits(symbol, modifyOrdType, posOpenPrice, sl, tp);

          PrintFormat("=== MODIFY POSITION START ===\ncommandId=%s\nsymbol=%s\npositionTicket=%I64u\nrequestedSL=%.5f\nrequestedTP=%.5f",
                      commandId, symbol, targetTicket, sl, tp);
          success = trade.PositionModify(targetTicket, sl, tp);
          PrintFormat("=== MODIFY POSITION END ===\nPositionModify returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription());
         }
       else if(orderTicketToModify > 0)
         {
          ENUM_ORDER_TYPE pendingType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
          string pendingOrdStr = "BUY";
          if(pendingType == ORDER_TYPE_SELL_LIMIT || pendingType == ORDER_TYPE_SELL_STOP) pendingOrdStr = "SELL";
          ClampStopsToBrokerLimits(symbol, pendingOrdStr, price, sl, tp);

          PrintFormat("=== MODIFY ORDER START ===\ncommandId=%s\norderTicket=%I64u\nprice=%.5f\nrequestedSL=%.5f\nrequestedTP=%.5f",
                      commandId, orderTicketToModify, price, sl, tp);
          success = trade.OrderModify(orderTicketToModify, price, sl, tp, ORDER_TIME_GTC, 0, 0);
          PrintFormat("=== MODIFY ORDER END ===\nOrderModify returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription());
         }
       else
         {
          ulong now = GetMicrosecondCount();
          ReportResult(commandId, false, 0, "Position/Order not found for modification. Target: " + IntegerToString(targetTicket) + ", SubOrder: " + IntegerToString(subOrderTicket), 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
          return;
         }
      }
    else if (commandType == "CLOSE_ORDER" || commandType == "CLOSE_PARTIAL")
      {
       ulong targetTicket = subPositionTicket;
       bool isPos = false;
       
       if(targetTicket > 0 && PositionSelectByTicket(targetTicket))
         {
          isPos = true;
         }
       else
         {
          // Fallback search across open positions
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
          if(matchingPositions == 1)
            {
             targetTicket = matchedTicket;
             isPos = true;
            }
         }

       // Check if it's a pending order to cancel
       ulong orderTicketToDelete = 0;
       if(!isPos)
         {
          if(subOrderTicket > 0 && OrderSelect(subOrderTicket)) orderTicketToDelete = subOrderTicket;
          else if(targetTicket > 0 && OrderSelect(targetTicket)) orderTicketToDelete = targetTicket;
         }
         
       if(isPos)
         {
          PrintFormat("=== CLOSE START ===\ncommandType=%s\ncommandId=%s\nsymbol=%s\npositionTicket=%I64u\nrequestedVol=%.2f",
                      commandType, commandId, symbol, targetTicket, volume);
          if(commandType == "CLOSE_PARTIAL")
            {
             double currentPosVol = PositionGetDouble(POSITION_VOLUME);
             if(currentPosVol > 0 && volume >= currentPosVol)
                success = trade.PositionClose(targetTicket, -1);
             else
                success = trade.PositionClosePartial(targetTicket, volume, -1);
            }
          else
             success = trade.PositionClose(targetTicket, -1);
          PrintFormat("=== CLOSE END ===\nPositionClose returned=%s\nResultRetcode=%u\nResultRetcodeDescription=%s\nResultOrder=%I64u\nResultDeal=%I64u",
                      (success ? "true" : "false"), trade.ResultRetcode(), trade.ResultRetcodeDescription(), trade.ResultOrder(), trade.ResultDeal());
         }
       else if(orderTicketToDelete > 0)
         {
          PrintFormat("=== CANCEL PENDING ORDER ===\nticket=%I64u", orderTicketToDelete);
          success = trade.OrderDelete(orderTicketToDelete);
         }
       else
         {
          ulong now = GetMicrosecondCount();
          ReportResult(commandId, false, 0, "Position/Order not found for closure. Target: " + IntegerToString(targetTicket) + ", SubOrder: " + IntegerToString(subOrderTicket), 0, 0, subReceivedAt, subAcknowledgedAt, now, now);
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
   resultTicket = (isPending || commandType == "OPEN_ORDER") ? trade.ResultOrder() : trade.ResultDeal();
   if(resultTicket == 0) resultTicket = trade.ResultOrder();
   
   double execVol = trade.ResultVolume();
   if (execVol == 0 && success && (commandType == "CLOSE_PARTIAL" || commandType == "CLOSE_ORDER")) {
      execVol = volume; 
   } else if (execVol == 0 && success && (commandType == "OPEN_ORDER" || commandType == "")) {
      execVol = volume;
   }
   
   if(success)
     {
      int size = ArraySize(ProcessedCommands);
      if(size >= MAX_PROCESSED)
        {
         for(int i = 0; i < size - 1; i++) ProcessedCommands[i] = ProcessedCommands[i+1];
         ProcessedCommands[size - 1] = commandId;
        }
      else
        {
         ArrayResize(ProcessedCommands, size + 1);
         ProcessedCommands[size] = commandId;
        }
        
      int handle = FileOpen(HISTORY_FILE, FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI);
      if(handle != INVALID_HANDLE)
        {
         FileSeek(handle, 0, SEEK_END);
         FileWrite(handle, commandId);
         FileFlush(handle);
         FileClose(handle);
        }
        
      // Instant telemetry push on trade change
      SendTelemetry();
     }
   
   // Send ACK and ReportResult
   ReportResult(commandId, success, retcode, trade.ResultComment(), resultTicket, execVol, subReceivedAt, subAcknowledgedAt, subExecutionStartedAt, subExecutionCompletedAt);
  }

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
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, StringLen(json)); // Remove null terminator
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\n";
   
   int res = CWinInet::Post(API_URL + "/result", headers, post, result);
   if(res != 200 && res != 201)
     {
      // Fallback to native WebRequest
      string webHeaders = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\n";
      string respHeaders = "";
      char respData[];
      res = WebRequest("POST", API_URL + "/result", webHeaders, 5000, post, respData, respHeaders);
     }
   if(res != 200 && res != 201)
     {
      PrintFormat("POST /result failed! HTTP: %d, Err: %d", res, GetLastError());
     }
  }

//+------------------------------------------------------------------+
//| Send Telemetry                                                   |
//+------------------------------------------------------------------+
void SendTelemetry()
  {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   if(StringLen(currency) == 0) return;
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double floatingPl = AccountInfoDouble(ACCOUNT_PROFIT);
   
   string json = "{";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"margin\":" + DoubleToString(margin, 2) + ",";
   json += "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ",";
   json += "\"floatingPl\":" + DoubleToString(floatingPl, 2) + ",";
   json += "\"currency\":\"" + currency + "\"";
   json += "}";
   
   char post[], result[];
   StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, StringLen(json)); // Remove null terminator
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\nConnection: close\r\n";
   
   string baseUrl = API_URL;
   // API_URL is something like "http://127.0.0.1:9001/execution"
   int pos = StringFind(baseUrl, "/execution");
   if (pos > 0) baseUrl = StringSubstr(baseUrl, 0, pos);
   
   int res = CWinInet::Post(baseUrl + "/accounts/telemetry", headers, post, result);
   if(res != 200 && res != 201)
     {
      LogToFile(StringFormat("Telemetry via WinInet failed (%d), falling back to WebRequest...", res));
      string webHeaders = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\n";
      string respHeaders = "";
      char respData[];
      res = WebRequest("POST", baseUrl + "/accounts/telemetry", webHeaders, 5000, post, respData, respHeaders);
      if(res == 200 || res == 201)
        {
         LogToFile("Telemetry sent successfully via WebRequest");
        }
      else
        {
         LogToFile(StringFormat("Telemetry WebRequest failed! HTTP: %d, Err: %d", res, GetLastError()));
         PrintFormat("Telemetry WebRequest failed! HTTP: %d, Err: %d", res, GetLastError());
        }
     }
   else
     {
      LogToFile("Telemetry sent successfully via WinInet");
     }
  }
