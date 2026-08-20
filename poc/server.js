const net = require('net');
const http = require('http');
const fs = require('fs');

const TCP_PORT = 9000;
const HTTP_PORT = 9001;
const LOG_FILE = 'poc_metrics.log';

// Utility for logging
function logMetric(source, eventId, detectedAt, sentAt, receivedAt, type) {
    const networkLatency = receivedAt - sentAt;
    const totalLatency = receivedAt - detectedAt;
    
    const logLine = JSON.stringify({
        source,
        eventId,
        type,
        detectedAt,
        sentAt,
        receivedAt,
        networkLatencyMs: networkLatency,
        totalLatencyMs: totalLatency
    }) + '\n';
    
    fs.appendFileSync(LOG_FILE, logLine);
    console.log(`[${source}] Event: ${eventId} | Net Latency: ${networkLatency}ms | Total: ${totalLatency}ms`);
}

// TCP Server
const tcpServer = net.createServer((socket) => {
    console.log('[TCP] Client connected');
    let buffer = '';
    
    socket.on('data', (data) => {
        const receivedAt = Date.now();
        buffer += data.toString();
        
        let splitIdx;
        while ((splitIdx = buffer.indexOf('\n')) !== -1) {
            const message = buffer.slice(0, splitIdx);
            buffer = buffer.slice(splitIdx + 1);
            
            try {
                const payload = JSON.parse(message);
                
                // Handle different test payloads
                if (payload.action === 'trade_event') {
                    logMetric('TCP', payload.eventId, payload.detectedAt, payload.sentAt, receivedAt, payload.type);
                    socket.write(JSON.stringify({ status: 'ack', eventId: payload.eventId }) + '\n');
                } else if (payload.action === 'reconciliation') {
                    console.log(`[TCP] Reconciliation Snapshot Received: ${payload.tradesCount} trades`);
                    socket.write(JSON.stringify({ status: 'reconciliation_ack' }) + '\n');
                }
            } catch (err) {
                console.error('[TCP] Error parsing message:', err.message, message);
            }
        }
    });
    
    socket.on('end', () => {
        console.log('[TCP] Client disconnected');
    });
    
    socket.on('error', (err) => {
        console.error('[TCP] Socket error:', err.message);
    });
});

tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP Server listening on port ${TCP_PORT}`);
});

// HTTP Server
const httpServer = http.createServer((req, res) => {
    const receivedAt = Date.now();
    
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                if (payload.action === 'trade_event') {
                    logMetric('HTTP', payload.eventId, payload.detectedAt, payload.sentAt, receivedAt, payload.type);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ack', eventId: payload.eventId }));
            } catch (err) {
                console.error('[HTTP] Error parsing message:', err.message);
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${HTTP_PORT}`);
});

console.log('POC Backend initialized.');
