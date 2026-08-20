//+------------------------------------------------------------------+
//|                                                 RunBenchmark.mq5 |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property version   "1.00"
#property description "Automatically opens 20 trades for latency benchmarking"

#include <Trade\Trade.mqh>

void OnStart()
  {
   CTrade trade;
   string symbol = _Symbol;
   
   // Get minimum allowed volume for the current symbol
   double volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   if (volume <= 0) volume = 0.01;
   
   Print("Starting automated benchmark: Opening 20 trades on ", symbol);
   
   for(int i = 0; i < 20; i++)
     {
      double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      // Set a generic 100-point SL and TP so the risk engine approves it immediately
      double sl = ask - (100 * _Point);
      double tp = ask + (300 * _Point);
      
      bool res = trade.Buy(volume, symbol, ask, sl, tp, "Benchmark");
      
      if(res)
         Print("Benchmark Trade ", i+1, " opened successfully.");
      else
         Print("Failed to open trade ", i+1, ", error: ", GetLastError());
         
      // Sleep for a tiny bit so we don't accidentally get blocked by the broker for spamming
      Sleep(300); 
     }
     
   Print("Benchmark complete! All 20 trades dispatched.");
  }
//+------------------------------------------------------------------+
