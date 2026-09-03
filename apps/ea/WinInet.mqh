//+------------------------------------------------------------------+
//|                                                      WinInet.mqh |
//|                                      Trade Copier WinInet Bypass |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property strict

class CWinInet {
public:
    static int Request(string method, string url, string headers, uchar &postData[], char &result[]) {
        string result_headers;
        int res = WebRequest(method, url, headers, 5000, postData, result, result_headers);
        return res;
    }
    
    static int Get(string url, string headers, char &result[]) {
        uchar emptyData[];
        return Request("GET", url, headers, emptyData, result);
    }
    
    static int Post(string url, string headers, char &postData[], char &result[]) {
        uchar data[];
        ArrayResize(data, ArraySize(postData));
        for(int i=0; i<ArraySize(postData); i++) data[i] = (uchar)postData[i];
        
        return Request("POST", url, headers, data, result);
    }
};
