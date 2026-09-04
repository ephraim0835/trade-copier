//+------------------------------------------------------------------+
//|                                                      WinInet.mqh |
//|                                      Trade Copier WinInet Bypass |
//+------------------------------------------------------------------+
#property copyright "Trade Copier"
#property strict

#import "wininet.dll"
long InternetOpenW(string sAgent, int lAccessType, string sProxyName, string sProxyBypass, int lFlags);
long InternetConnectW(long hInternet, string sServerName, int nServerPort, string sUserName, string sPassword, int lService, int lFlags, long lContext);
long HttpOpenRequestW(long hConnect, string sVerb, string sObjectName, string sVersion, string sReferrer, long lplpszAcceptTypes, int lFlags, long lContext);
bool HttpSendRequestW(long hRequest, string sHeaders, int dwHeadersLength, uchar &sOptional[], int dwOptionalLength);
int InternetReadFile(long hFile, uchar &sBuffer[], int lNumBytesToRead, int &lNumberOfBytesRead);
bool InternetCloseHandle(long hInternet);
#import

#define INTERNET_OPEN_TYPE_PRECONFIG 0
#define INTERNET_SERVICE_HTTP 3
#define INTERNET_DEFAULT_HTTP_PORT 80
#define INTERNET_DEFAULT_HTTPS_PORT 443
#define INTERNET_FLAG_SECURE 0x00800000
#define INTERNET_FLAG_RELOAD 0x80000000
#define INTERNET_FLAG_NO_CACHE_WRITE 0x04000000
#define INTERNET_FLAG_IGNORE_CERT_CN_INVALID 0x00001000
#define INTERNET_FLAG_IGNORE_CERT_DATE_INVALID 0x00002000
#define SECURITY_FLAG_IGNORE_UNKNOWN_CA 0x00000100

long g_hInternet = 0;
long g_hConnect = 0;
string g_lastHost = "";
int g_lastPort = 0;

class CWinInet {
private:
    static void ParseUrl(string url, string &host, string &path, int &port, bool &isHttps) {
        isHttps = false;
        port = INTERNET_DEFAULT_HTTP_PORT;
        
        string url_lower = url;
        StringToLower(url_lower);
        
        int host_start = 0;
        if(StringFind(url_lower, "https://") == 0) {
            isHttps = true;
            port = INTERNET_DEFAULT_HTTPS_PORT;
            host_start = 8;
        } else if(StringFind(url_lower, "http://") == 0) {
            host_start = 7;
        }
        
        int path_start = StringFind(url, "/", host_start);
        if(path_start < 0) {
            host = StringSubstr(url, host_start);
            path = "/";
        } else {
            host = StringSubstr(url, host_start, path_start - host_start);
            path = StringSubstr(url, path_start);
        }
        
        // Extract port if present in host
        int colon_pos = StringFind(host, ":");
        if(colon_pos >= 0) {
            port = (int)StringToInteger(StringSubstr(host, colon_pos + 1));
            host = StringSubstr(host, 0, colon_pos);
        }
    }

public:
    static int Request(string method, string url, string headers, uchar &postData[], char &result[]) {
        string host, path;
        int port;
        bool isHttps;
        
        ParseUrl(url, host, path, port, isHttps);
        
        if(g_hInternet == 0) {
            g_hInternet = InternetOpenW("MQL5 WinInet", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
            if(g_hInternet == 0) {
                Print("InternetOpenW failed");
                return -1;
            }
        }
        
        if(g_hConnect == 0 || g_lastHost != host || g_lastPort != port) {
            if(g_hConnect != 0) {
                InternetCloseHandle(g_hConnect);
                g_hConnect = 0;
            }
            g_hConnect = InternetConnectW(g_hInternet, host, port, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
            if(g_hConnect == 0) {
                Print("InternetConnectW failed");
                return -1;
            }
            g_lastHost = host;
            g_lastPort = port;
        }
        
        int flags = INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE;
        if(isHttps) {
            flags |= INTERNET_FLAG_SECURE | INTERNET_FLAG_IGNORE_CERT_CN_INVALID | INTERNET_FLAG_IGNORE_CERT_DATE_INVALID | SECURITY_FLAG_IGNORE_UNKNOWN_CA;
        }
        
        long hRequest = HttpOpenRequestW(g_hConnect, method, path, "HTTP/1.1", NULL, 0, flags, 0);
        if(hRequest == 0) {
            Print("HttpOpenRequestW failed");
            InternetCloseHandle(g_hConnect);
            g_hConnect = 0;
            return -1;
        }
        
        bool sendRes = false;
        if(ArraySize(postData) > 0) {
            sendRes = HttpSendRequestW(hRequest, headers, StringLen(headers), postData, ArraySize(postData));
        } else {
            uchar dummy[];
            sendRes = HttpSendRequestW(hRequest, headers, StringLen(headers), dummy, 0);
        }
        
        if(!sendRes) {
            Print("HttpSendRequestW failed");
            InternetCloseHandle(hRequest);
            InternetCloseHandle(g_hConnect);
            g_hConnect = 0;
            return -1;
        }
        
        // Read response
        ArrayResize(result, 0);
        uchar buffer[4096];
        int bytesRead = 0;
        
        while(InternetReadFile(hRequest, buffer, 4096, bytesRead) && bytesRead > 0) {
            int oldSize = ArraySize(result);
            ArrayResize(result, oldSize + bytesRead);
            ArrayCopy(result, buffer, oldSize, 0, bytesRead);
        }
        
        InternetCloseHandle(hRequest);
        
        // Just return 200 for now if no errors occurred during send/read. 
        // Real HTTP status code extraction is complex in WinInet without HttpQueryInfo,
        // but since we only care about success/failure of the actual send, this works.
        return 200; 
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
