//+------------------------------------------------------------------+
//|                                                      MqlJson.mqh |
//|                                      Minimal JSON parser for EA |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property link      ""

// Extremely minimal JSON parser for demonstration
// In production, we would use a robust parser like CJAson
class CMqlJson {
public:
   // Extract string value
   static string GetString(string json, string key) {
      string search = "\"" + key + "\":\"";
      int start = StringFind(json, search);
      if (start < 0) return "";
      start += StringLen(search);
      int end = StringFind(json, "\"", start);
      if (end < 0) return "";
      return StringSubstr(json, start, end - start);
   }

   // Extract number value
   static double GetDouble(string json, string key) {
      string search = "\"" + key + "\":";
      int start = StringFind(json, search);
      if (start < 0) return 0;
      start += StringLen(search);
      int end1 = StringFind(json, ",", start);
      int end2 = StringFind(json, "}", start);
      int end = (end1 >= 0 && (end1 < end2 || end2 < 0)) ? end1 : end2;
      if (end < 0) return 0;
      return StringToDouble(StringSubstr(json, start, end - start));
   }
};
