/**
 * Node.js Bridge for Python Monitor - BATCH MODE (RAM-based)
 * 
 * Stores logs in memory and flushes to disk periodically.
 * Much lower disk I/O compared to immediate writing.
 * 
 * Usage: Add to TOP of bot.js:
 *   const monitor = require('./monitor-bridge-batch.js');
 *   monitor.init('na_bot');
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    botName: 'unknown_bot',
    dbPath: './monitor.db',
    flushIntervalMs: 10000,      // Flush to disk every 10 seconds
    maxBufferSize: 1000,         // Force flush if buffer reaches 1000 entries
    shutdownFlushTimeoutMs: 5000 // Max wait time for final flush on shutdown
};

// In-memory buffer
let logBuffer = [];
let flushTimer = null;
let isShuttingDown = false;

/**
 * Initialize monitoring
 * @param {string} name - Bot name (e.g., 'na_bot')
 * @param {string} db - Path to SQLite database (optional)
 * @param {Object} options - Optional config overrides
 */
function init(name, db = './monitor.db', options = {}) {
    CONFIG.botName = name;
    CONFIG.dbPath = db;
    
    // Apply custom options
    if (options.flushIntervalMs) CONFIG.flushIntervalMs = options.flushIntervalMs;
    if (options.maxBufferSize) CONFIG.maxBufferSize = options.maxBufferSize;
    
    // Create Python reporter script if not exists
    createReporterScript();
    
    // Patch HTTP/HTTPS to count outbound requests
    patchHttpModule(http, 'http');
    patchHttpModule(https, 'https');
    
    // Start periodic flush timer
    startFlushTimer();
    
    // Handle graceful shutdown
    setupShutdownHandlers();
    
    console.log(`📊 Monitor bridge (BATCH MODE) initialized for "${name}"`);
    console.log(`   Buffer: ${CONFIG.maxBufferSize} entries | Flush: ${CONFIG.flushIntervalMs}ms`);
}

/**
 * Record an outbound request (stores in memory)
 */
function recordOutbound(url, method = 'GET') {
    if (isShuttingDown) return;
    
    const endpoint = url.includes('telegram') ? 'telegram_api' : 'external';
    const timestamp = new Date().toISOString();
    
    // Add to memory buffer (very fast)
    logBuffer.push({
        timestamp,
        direction: 'outbound',
        botName: CONFIG.botName,
        endpoint,
        method
    });
    
    // Force flush if buffer is full
    if (logBuffer.length >= CONFIG.maxBufferSize) {
        flushToDisk();
    }
}

/**
 * Record an inbound message/poll (stores in memory)
 */
function recordInbound() {
    if (isShuttingDown) return;
    
    logBuffer.push({
        timestamp: new Date().toISOString(),
        direction: 'inbound',
        botName: CONFIG.botName,
        endpoint: 'webhook',
        method: 'RECEIVE'
    });
    
    if (logBuffer.length >= CONFIG.maxBufferSize) {
        flushToDisk();
    }
}

/**
 * Start the periodic flush timer
 */
function startFlushTimer() {
    if (flushTimer) clearInterval(flushTimer);
    
    flushTimer = setInterval(() => {
        if (logBuffer.length > 0) {
            flushToDisk();
        }
    }, CONFIG.flushIntervalMs);
    
    // Don't let timer keep process alive
    flushTimer.unref();
}

/**
 * Flush buffer to disk (batch write)
 */
function flushToDisk() {
    if (logBuffer.length === 0) return;
    
    // Swap buffer (new writes go to fresh array)
    const batch = logBuffer;
    logBuffer = [];
    
    // Build log string (batch format)
    const logLines = batch.map(entry => 
        `${entry.timestamp}|${entry.direction}|${entry.botName}|${entry.endpoint}|${entry.method}`
    ).join('\n') + '\n';
    
    // Single disk write for entire batch
    fs.appendFile(CONFIG.dbPath + '.node-log', logLines, (err) => {
        if (err) {
            console.error('[Monitor] Flush error:', err.message);
            // On error, try to recover entries (optional)
            // logBuffer = batch.concat(logBuffer);
        }
    });
}

/**
 * Synchronous flush (for shutdown)
 */
function flushSync() {
    if (logBuffer.length === 0) return;
    
    const batch = logBuffer;
    logBuffer = [];
    
    const logLines = batch.map(entry => 
        `${entry.timestamp}|${entry.direction}|${entry.botName}|${entry.endpoint}|${entry.method}`
    ).join('\n') + '\n';
    
    try {
        fs.appendFileSync(CONFIG.dbPath + '.node-log', logLines);
        console.log(`[Monitor] Sync flushed ${batch.length} entries`);
    } catch (err) {
        console.error('[Monitor] Sync flush failed:', err.message);
    }
}

/**
 * Setup shutdown handlers for graceful exit
 */
function setupShutdownHandlers() {
    const shutdown = (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        console.log(`[Monitor] ${signal} received, flushing ${logBuffer.length} entries...`);
        
        // Clear timer
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
        
        // Final sync flush
        flushSync();
        
        // Allow process to exit naturally
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught errors - still try to flush
    process.on('uncaughtException', (err) => {
        console.error('[Monitor] Uncaught exception:', err.message);
        flushSync();
    });
}

/**
 * Patch HTTP module to intercept requests
 */
function patchHttpModule(module, protocol) {
    const originalRequest = module.request;
    
    module.request = function(...args) {
        try {
            const url = args[0];
            const options = typeof url === 'object' ? url : {};
            const urlString = typeof url === 'string' ? url : 
                `${protocol}://${options.hostname || options.host}${options.path || '/'}`;
            
            // Count this request (fast memory operation)
            recordOutbound(urlString, options.method || 'GET');
        } catch (e) {
            // Never break the actual request
        }
        
        return originalRequest.apply(this, args);
    };
}

/**
 * Create the Python reporter script
 */
function createReporterScript() {
    const scriptPath = path.join(__dirname, 'log-to-db.py');
    
    if (fs.existsSync(scriptPath)) return;
    
    const script = `#!/usr/bin/env python3
"""Reads node-log file and writes to SQLite database."""
import sqlite3
import os
import sys
from datetime import datetime

def process_log(db_path):
    log_path = db_path + '.node-log'
    if not os.path.exists(log_path):
        return 0
    
    # Read and clear log
    with open(log_path, 'r') as f:
        lines = f.readlines()
    
    os.remove(log_path)
    
    if not lines:
        return 0
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS outbound_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hour_timestamp TEXT NOT NULL,
            bot_name TEXT NOT NULL,
            request_count INTEGER DEFAULT 0,
            endpoint TEXT,
            UNIQUE(hour_timestamp, bot_name, endpoint)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inbound_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hour_timestamp TEXT NOT NULL,
            bot_name TEXT NOT NULL,
            request_count INTEGER DEFAULT 0,
            status_codes TEXT,
            UNIQUE(hour_timestamp, bot_name)
        )
    """)
    
    processed = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split('|')
        if len(parts) < 4:
            continue
        try:
            timestamp_str, direction, bot_name, endpoint = parts[:4]
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00').replace('+00:00', ''))
            hour = dt.replace(minute=0, second=0, microsecond=0).isoformat()
            
            if direction == 'outbound':
                cursor.execute("""
                    INSERT INTO outbound_metrics (hour_timestamp, bot_name, request_count, endpoint)
                    VALUES (?, ?, 1, ?)
                    ON CONFLICT(hour_timestamp, bot_name, endpoint) 
                    DO UPDATE SET request_count = request_count + 1
                """, (hour, bot_name, endpoint))
            else:
                cursor.execute("""
                    INSERT INTO inbound_metrics (hour_timestamp, bot_name, request_count, status_codes)
                    VALUES (?, ?, 1, '{"200": 1}')
                    ON CONFLICT(hour_timestamp, bot_name) 
                    DO UPDATE SET request_count = request_count + 1
                """, (hour, bot_name))
            processed += 1
        except Exception:
            continue
    
    conn.commit()
    conn.close()
    return processed

if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else './monitor.db'
    count = process_log(db_path)
    if count > 0:
        print(f"Processed {count} log entries")
`;
    
    fs.writeFileSync(scriptPath, script);
}

/**
 * Get current stats (for debugging)
 */
function getStats() {
    return {
        buffered: logBuffer.length,
        botName: CONFIG.botName,
        flushInterval: CONFIG.flushIntervalMs,
        maxBuffer: CONFIG.maxBufferSize
    };
}

/**
 * Force immediate flush (for manual use)
 */
function forceFlush() {
    flushSync();
}

module.exports = {
    init,
    recordOutbound,
    recordInbound,
    getStats,
    forceFlush
};
