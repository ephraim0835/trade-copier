//+------------------------------------------------------------------+
//|                                                POC_MasterEA.mq5  |
//|                                  Copyright 2026, Trade Copier    |
//|                                                                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Trade Copier"
#property link      ""
#property version   "1.00"

input int    DispatchIntervalMs = 50;    // Dispatch Interval (ms): test 10, 25, 50, 100
input bool   UseTCP             = false; // Use TCP Sockets (false = WebRequest/HTTP)
input string ServerIP           = "127.0.0.1";
input int    TCPPort            = 9000;
input string HTTPUrl            = "http://127.0.0.1:9001/";
input bool   AutoRunTests       = true;  // Automatically run test sequence

// Simple JSON Event Queue
string EventQueue[];
int    EventCount = 0;
ulong  EventIdCounter = 1;

// Socket Handle
int SocketHandle = INVALID_HANDLE;
bool IsConnected = false;

// Auto test sequence state
int  testStage = 0;
ulong testNextTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   Print("Initializing POC Master EA...");
   
   if(UseTCP)
     {
      ConnectSocket();
     }
     
   EventSetMillisecondTimer(DispatchIntervalMs);
   
   if(AutoRunTests)
     {
      testStage = 1;
      testNextTime = GetTickCount64() + 2000; // Start sequence in 2 seconds
     }
   
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(SocketHandle != INVALID_HANDLE)
     {
      SocketClose(SocketHandle);
     }
  }

//+------------------------------------------------------------------+
//| Connect TCP Socket                                               |
//+------------------------------------------------------------------+
void ConnectSocket()
  {
   if(SocketHandle != INVALID_HANDLE) SocketClose(SocketHandle);
   SocketHandle = SocketCreate();
   if(SocketHandle != INVALID_HANDLE)
     {
      if(SocketConnect(SocketHandle, ServerIP, TCPPort, 1000))
        {
         IsConnected = true;
         Print("TCP Socket Connected.");
         SendReconciliation();
        }
      else
        {
         IsConnected = false;
         Print("TCP Connection Failed. Error: ", GetLastError());
        }
     }
  }

//+------------------------------------------------------------------+
//| Internal Queue logic                                             |
//+------------------------------------------------------------------+
void EnqueueEvent(string type, string ticket)
  {
   ulong detectedAt = GetTickCount64();
   string payload = StringFormat(
      "{\"action\":\"trade_event\",\"eventId\":%I64u,\"type\":\"%s\",\"ticket\":\"%s\",\"detectedAt\":%I64u}",
      EventIdCounter++, type, ticket, detectedAt
   );
   
   ArrayResize(EventQueue, EventCount + 1);
   EventQueue[EventCount] = payload;
   EventCount++;
  }

//+------------------------------------------------------------------+
//| OnTradeTransaction - Non-blocking detection                      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   // Push to queue immediately. No blocking calls.
   if(trans.type == TRADE_TRANSACTION_ORDER_ADD || trans.type == TRADE_TRANSACTION_DEAL_ADD)
     {
      string typeStr = (trans.type == TRADE_TRANSACTION_ORDER_ADD) ? "ORDER_ADD" : "DEAL_ADD";
      EnqueueEvent(typeStr, IntegerToString(trans.order));
     }
  }

//+------------------------------------------------------------------+
//| Send Reconciliation Payload                                      |
//+------------------------------------------------------------------+
void SendReconciliation()
  {
   int positionsCount = PositionsTotal();
   string payload = StringFormat("{\"action\":\"reconciliation\",\"tradesCount\":%d}\n", positionsCount);
   uchar data[];
   StringToCharArray(payload, data);
   SocketSend(SocketHandle, data, ArraySize(data) - 1);
  }

//+------------------------------------------------------------------+
//| OnTimer - Dispatch Loop & Test Sequence                          |
//+------------------------------------------------------------------+
void OnTimer()
  {
   // ---- AUTO TEST SEQUENCE ----
   if(AutoRunTests && testStage > 0 && GetTickCount64() > testNextTime)
     {
      ulong now = GetTickCount64();
      if(testStage == 1)
        {
         Print("--- TEST 1: Burst 100 Events ---");
         for(int i=0; i<100; i++) EnqueueEvent("BURST_TEST_NORMAL", IntegerToString(i));
         testStage = 2;
         testNextTime = now + 2000;
        }
      else if(testStage == 2)
        {
         Print("--- TEST 2: Simulate Disconnect ---");
         if(SocketHandle != INVALID_HANDLE) SocketClose(SocketHandle);
         IsConnected = false;
         
         Print("--- TEST 3: Burst 50 Events while disconnected (Queuing) ---");
         for(int i=0; i<50; i++) EnqueueEvent("BURST_TEST_OFFLINE", IntegerToString(i+100));
         
         testStage = 3;
         testNextTime = now + 2000;
        }
      else if(testStage == 3)
        {
         Print("--- TEST 4: Simulate Reconnect ---");
         if(UseTCP) ConnectSocket();
         
         testStage = 4;
         testNextTime = now + 2000;
        }
      else if(testStage == 4)
        {
         Print("--- TEST SEQUENCE COMPLETE ---");
         testStage = 0;
        }
     }

   // ---- DISPATCH LOGIC ----
   if(EventCount == 0) return;
   
   if(UseTCP)
     {
      if(!IsConnected || !SocketIsConnected(SocketHandle))
        {
         IsConnected = false;
         return; // Buffer and wait for reconnection
        }
        
      string bulkPayload = "";
      ulong sentAt = GetTickCount64();
      for(int i = 0; i < EventCount; i++)
        {
         string msg = EventQueue[i];
         StringReplace(msg, "}", StringFormat(",\"sentAt\":%I64u}", sentAt));
         bulkPayload += msg + "\n";
        }
      
      uchar data[];
      StringToCharArray(bulkPayload, data);
      
      int bytesSent = SocketSend(SocketHandle, data, ArraySize(data) - 1);
      if(bytesSent > 0)
        {
         ArrayResize(EventQueue, 0);
         EventCount = 0;
        }
      else
        {
         IsConnected = false;
        }
     }
   else
     {
      ulong sentAt = GetTickCount64();
      for(int i = 0; i < EventCount; i++)
        {
         string msg = EventQueue[i];
         StringReplace(msg, "}", StringFormat(",\"sentAt\":%I64u}", sentAt));
         
         char data[];
         char res[];
         string resHeaders;
         StringToCharArray(msg, data, 0, StringLen(msg));
         
         int code = WebRequest("POST", HTTPUrl, NULL, NULL, 1000, data, ArraySize(data), res, resHeaders);
         if(code != 200) Print("WebRequest failed. Code: ", code);
        }
      ArrayResize(EventQueue, 0);
      EventCount = 0;
     }
  }
//+------------------------------------------------------------------+
