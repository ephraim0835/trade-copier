//+------------------------------------------------------------------+
//|                                                  MasterCopier.mq5|
//|                                     Phase 6 Demo Master Copier   |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property version   "1.00"
#property description "DEMO ONLY Master Copier EA (Non-Blocking Queue)"

#include <Trade\Trade.mqh>
#include "WinInet.mqh"

input string API_URL = "https://plaiz-markets-api.onrender.com/master/signal";
input string EA_TOKEN = "master-token-id.secret123";
input int DISPATCH_INTERVAL_MS = 25; // 25ms high-speed dispatch loop

ulong lastProcessedDeal = 0;
ulong lastProcessedOrder = 0;
int sequenceNum = 1;

// --- Queue System ---
string QueueEndpoints[];
string QueuePayloads[];
ulong QueueDetectedAt[];
ulong QueueQueuedAt[];
int EventCount = 0;

ulong lastTelemetryAt = 0;
const ulong TELEMETRY_INTERVAL_US = 5000000; // 5 seconds in microseconds

// --- State Cache ---
struct StateCache {
   ulong  ticket;
   double lastSL;
   double lastTP;
   double lastPrice;
};
StateCache CachedStates[];
int CacheCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   InitCache();
   EventSetMillisecondTimer(DISPATCH_INTERVAL_MS);

   PrintFormat("MasterCopier v2.0 initialized in DEMO safe mode. Dispatch: %d ms", DISPATCH_INTERVAL_MS);
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| Cache Management                                                 |
//+------------------------------------------------------------------+
void InitCache()
  {
   ArrayResize(CachedStates, 0);
   CacheCount = 0;
   
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
        {
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         AddCache(ticket, sl, tp, 0);
        }
     }
     
   for(int i = 0; i < OrdersTotal(); i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0)
        {
         double sl = OrderGetDouble(ORDER_SL);
         double tp = OrderGetDouble(ORDER_TP);
         double price = OrderGetDouble(ORDER_PRICE_OPEN);
         AddCache(ticket, sl, tp, price);
        }
     }
  }

int FindInCache(ulong ticket)
  {
   for(int i = 0; i < CacheCount; i++)
     {
      if(CachedStates[i].ticket == ticket) return i;
     }
   return -1;
  }

void AddCache(ulong ticket, double sl, double tp, double price)
  {
   if(FindInCache(ticket) != -1) return;
   ArrayResize(CachedStates, CacheCount + 1);
   CachedStates[CacheCount].ticket = ticket;
   CachedStates[CacheCount].lastSL = sl;
   CachedStates[CacheCount].lastTP = tp;
   CachedStates[CacheCount].lastPrice = price;
   CacheCount++;
  }

void RemoveFromCache(ulong ticket)
  {
   int idx = FindInCache(ticket);
   if(idx >= 0)
     {
      for(int i = idx; i < CacheCount - 1; i++)
        {
         CachedStates[i] = CachedStates[i + 1];
        }
      CacheCount--;
      ArrayResize(CachedStates, CacheCount);
     }
  }

//+------------------------------------------------------------------+
//| Enqueue Logic (Non-blocking)                                     |
//+------------------------------------------------------------------+
void EnqueueEvent(string endpoint, string payload, ulong detectedAt)
  {
   ulong queuedAt = GetMicrosecondCount();
   ArrayResize(QueueEndpoints, EventCount + 1);
   ArrayResize(QueuePayloads, EventCount + 1);
   ArrayResize(QueueDetectedAt, EventCount + 1);
   ArrayResize(QueueQueuedAt, EventCount + 1);
   QueueEndpoints[EventCount] = endpoint;
   QueuePayloads[EventCount] = payload;
   QueueDetectedAt[EventCount] = detectedAt;
   QueueQueuedAt[EventCount] = queuedAt;
   EventCount++;
  }

//+------------------------------------------------------------------+
//| Event Generators                                                 |
//+------------------------------------------------------------------+
void SendOpenSignal(ulong ticket, string symbol, string type, double volume, double priceOpen, double sl, double tp, ulong detectedAt)
  {
   string json = "{";
   json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"type\":\"" + type + "\",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"priceOpen\":" + DoubleToString(priceOpen, 5) + ",";
   json += "\"sl\":" + DoubleToString(sl, 5) + ",";
   json += "\"tp\":" + DoubleToString(tp, 5) + ",";
   json += "\"sequenceNumber\":" + IntegerToString(sequenceNum++) + "";
   json += "}";
   EnqueueEvent("/open", json, detectedAt);
  }

void SendModifySignal(ulong ticket, double priceOpen, double sl, double tp, ulong detectedAt)
  {
   string json = "{";
   json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
   if(priceOpen > 0) json += "\"priceOpen\":" + DoubleToString(priceOpen, 5) + ",";
   json += "\"sl\":" + DoubleToString(sl, 5) + ",";
   json += "\"tp\":" + DoubleToString(tp, 5) + ",";
   json += "\"sequenceNumber\":" + IntegerToString(sequenceNum++) + "";
   json += "}";
   EnqueueEvent("/modify", json, detectedAt);
  }

void SendCloseSignal(ulong ticket, double volume, ulong detectedAt)
  {
   string json = "{";
   json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"sequenceNumber\":" + IntegerToString(sequenceNum++) + "";
   json += "}";
   EnqueueEvent("/close", json, detectedAt);
  }

void SendTriggerSignal(ulong orderTicket, ulong positionTicket, ulong detectedAt)
  {
   string json = "{";
   json += "\"orderTicket\":\"" + IntegerToString(orderTicket) + "\",";
   json += "\"positionTicket\":\"" + IntegerToString(positionTicket) + "\",";
   json += "\"sequenceNumber\":" + IntegerToString(sequenceNum++) + "";
   json += "}";
   EnqueueEvent("/trigger", json, detectedAt);
  }

//+------------------------------------------------------------------+
//| OnTradeTransaction function                                      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   ulong detectedAt = GetMicrosecondCount();
   
   // 1. Handle Pending Order Add
   if(trans.type == TRADE_TRANSACTION_ORDER_ADD)
     {
      if(trans.order != lastProcessedOrder)
        {
         lastProcessedOrder = trans.order;
         if(OrderSelect(trans.order))
           {
            ENUM_ORDER_TYPE type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(type == ORDER_TYPE_BUY_LIMIT || type == ORDER_TYPE_SELL_LIMIT || type == ORDER_TYPE_BUY_STOP || type == ORDER_TYPE_SELL_STOP)
              {
               string symbol = OrderGetString(ORDER_SYMBOL);
               double volume = OrderGetDouble(ORDER_VOLUME_INITIAL);
               double price = OrderGetDouble(ORDER_PRICE_OPEN);
               double sl = OrderGetDouble(ORDER_SL);
               double tp = OrderGetDouble(ORDER_TP);
               
               string orderTypeStr = "";
               if(type == ORDER_TYPE_BUY_LIMIT) orderTypeStr = "BUY_LIMIT";
               if(type == ORDER_TYPE_SELL_LIMIT) orderTypeStr = "SELL_LIMIT";
               if(type == ORDER_TYPE_BUY_STOP) orderTypeStr = "BUY_STOP";
               if(type == ORDER_TYPE_SELL_STOP) orderTypeStr = "SELL_STOP";

               SendOpenSignal(trans.order, symbol, orderTypeStr, volume, price, sl, tp, detectedAt);
               AddCache(trans.order, sl, tp, price);
              }
           }
        }
     }
     
   // 2. Handle Pending Order Delete (Cancel)
   if(trans.type == TRADE_TRANSACTION_ORDER_DELETE)
     {
        // If an order is deleted and it is cancelled (not executed)
        if(HistoryOrderSelect(trans.order))
          {
             long state = HistoryOrderGetInteger(trans.order, ORDER_STATE);
             if(state == ORDER_STATE_CANCELED || state == ORDER_STATE_REJECTED || state == ORDER_STATE_EXPIRED)
               {
                  int idx = FindInCache(trans.order);
                  if(idx >= 0)
                    {
                       SendCloseSignal(trans.order, HistoryOrderGetDouble(trans.order, ORDER_VOLUME_INITIAL), detectedAt);
                       RemoveFromCache(trans.order);
                    }
               }
          }
     }

   // 3. Handle Deal Add (Market Open, Close, TP/SL Hit, Pending Trigger)
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
     {
      if(trans.deal != lastProcessedDeal)
        {
         lastProcessedDeal = trans.deal;
         
         if(HistoryDealSelect(trans.deal))
           {
            long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
            long positionId = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
            long orderId = HistoryDealGetInteger(trans.deal, DEAL_ORDER);
            string symbol = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
            double volume = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);
            double price = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
            long type = HistoryDealGetInteger(trans.deal, DEAL_TYPE);
            
            if(entry == DEAL_ENTRY_IN)
              {
               // Check if it came from a pending order
               bool isTrigger = false;
               if(orderId > 0 && HistoryOrderSelect(orderId))
                 {
                  long originOrderType = HistoryOrderGetInteger(orderId, ORDER_TYPE);
                  if(originOrderType == ORDER_TYPE_BUY_LIMIT || originOrderType == ORDER_TYPE_SELL_LIMIT || 
                     originOrderType == ORDER_TYPE_BUY_STOP || originOrderType == ORDER_TYPE_SELL_STOP)
                    {
                     isTrigger = true;
                    }
                 }
                 
               if(isTrigger)
                 {
                  SendTriggerSignal(orderId, positionId, detectedAt);
                  RemoveFromCache(orderId);
                  
                  double sl = 0, tp = 0;
                  if(PositionSelectByTicket(positionId))
                    {
                     sl = PositionGetDouble(POSITION_SL);
                     tp = PositionGetDouble(POSITION_TP);
                    }
                  AddCache(positionId, sl, tp, 0);
                 }
               else
                 {
                  // Normal market execution
                  string orderType = (type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
                  double sl = 0, tp = 0;
                  if(PositionSelectByTicket(positionId))
                    {
                     sl = PositionGetDouble(POSITION_SL);
                     tp = PositionGetDouble(POSITION_TP);
                    }
                  SendOpenSignal(positionId, symbol, orderType, volume, price, sl, tp, detectedAt);
                  AddCache(positionId, sl, tp, 0);
                 }
              }
            else if(entry == DEAL_ENTRY_OUT)
              {
               SendCloseSignal(positionId, volume, detectedAt);
               RemoveFromCache(positionId);
              }
           }
        }
     }

   // 4. Detect Position SL/TP Modifications
   for(int i = 0; i < PositionsTotal(); i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
        {
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         
         int idx = FindInCache(ticket);
         if(idx >= 0)
           {
            if(CachedStates[idx].lastSL != sl || CachedStates[idx].lastTP != tp)
              {
               SendModifySignal(ticket, 0, sl, tp, detectedAt);
               CachedStates[idx].lastSL = sl;
               CachedStates[idx].lastTP = tp;
              }
           }
         else
           {
            AddCache(ticket, sl, tp, 0);
           }
        }
     }
     
   // 5. Detect Pending Order Modifications
   for(int i = 0; i < OrdersTotal(); i++)
     {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0)
        {
         double sl = OrderGetDouble(ORDER_SL);
         double tp = OrderGetDouble(ORDER_TP);
         double price = OrderGetDouble(ORDER_PRICE_OPEN);
         
         int idx = FindInCache(ticket);
         if(idx >= 0)
           {
            if(CachedStates[idx].lastSL != sl || CachedStates[idx].lastTP != tp || CachedStates[idx].lastPrice != price)
              {
               SendModifySignal(ticket, price, sl, tp, detectedAt);
               CachedStates[idx].lastSL = sl;
               CachedStates[idx].lastTP = tp;
               CachedStates[idx].lastPrice = price;
              }
           }
         else
           {
            AddCache(ticket, sl, tp, price);
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| OnTimer - Dispatch Loop                                          |
//+------------------------------------------------------------------+
void OnTimer()
  {
   ulong nowUs = GetMicrosecondCount();
   
   // --- Telemetry Heartbeat (Every 5 Seconds) ---
   if(nowUs - lastTelemetryAt > TELEMETRY_INTERVAL_US)
     {
      lastTelemetryAt = nowUs;
      SendTelemetry();
     }
     
   if(EventCount == 0) return;
   
   for(int i = 0; i < EventCount; i++)
     {
      ulong sentAt = GetMicrosecondCount();
      string endpoint = QueueEndpoints[i];
      string payload = QueuePayloads[i];
      
      // Inject telemetry fields safely
      string append = StringFormat(",\"masterEventDetectedAt\":%I64u,\"masterEventQueuedAt\":%I64u,\"masterEventSentAt\":%I64u}", QueueDetectedAt[i], QueueQueuedAt[i], sentAt);
      if(StringSubstr(payload, StringLen(payload) - 1, 1) == "}") {
         payload = StringSubstr(payload, 0, StringLen(payload) - 1) + append;
      } else {
         payload += append;
      }
      
      char post[], result[];
      string resultHeaders;
      StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8);
      ArrayResize(post, StringLen(payload)); // Remove null terminator
      
      string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\n";
      
      int res = CWinInet::Post(API_URL + endpoint, headers, post, result);
      if(res != 200 && res != 201)
        {
         Print("Failed to dispatch event. HTTP: ", res, ". Endpoint: ", endpoint);
        }
      else
        {
         Print("Dispatched event successfully to ", endpoint, ": ", payload);
        }
     }
     
   ArrayResize(QueueEndpoints, 0);
   ArrayResize(QueuePayloads, 0);
   ArrayResize(QueueDetectedAt, 0);
   ArrayResize(QueueQueuedAt, 0);
   EventCount = 0;
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
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + EA_TOKEN + "\r\n";
   
   string baseUrl = API_URL;
   // API_URL is something like "http://127.0.0.1:9001/master/signal"
   // We need to route to "/accounts/telemetry". Let's parse base URL.
   int pos = StringFind(baseUrl, "/master");
   if (pos > 0) baseUrl = StringSubstr(baseUrl, 0, pos);
   
   int res = CWinInet::Post(baseUrl + "/accounts/telemetry", headers, post, result);
   if (res == -1) {
      Print("Telemetry failed! HTTP: -1, Error code: ", GetLastError());
   } else if(res != 200 && res != 201)
     {
      PrintFormat("Telemetry failed! HTTP: %d", res);
     }
  }
