"use strict";
/**
 * Simple port allocator for tests
 * Each test file gets a unique port based on its filename hash
 * This ensures independent brokers even when running serially
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
exports.getPort = getPort;
const fs = require('fs');
const path = require('path');
// Cache of allocated ports per test file
const portCache = new Map();
let basePort = 7000;
/**
 * Get a unique port for a test file
 * Uses the test file path to generate a consistent port
 */
function getTestPort(testFilePath) {
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    // Use SUMAN_CHILD_ID if available (for parallel runs with suman)
    if (process.env.SUMAN_CHILD_ID) {
        return basePort + parseInt(process.env.SUMAN_CHILD_ID);
    }
    // For serial runs, use test file path to generate consistent port
    if (testFilePath) {
        if (portCache.has(testFilePath)) {
            return portCache.get(testFilePath);
        }
        // Generate port from filename hash
        const filename = path.basename(testFilePath, path.extname(testFilePath));
        let hash = 0;
        for (let i = 0; i < filename.length; i++) {
            const char = filename.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Ensure positive port in range 7000-9999
        const port = basePort + (Math.abs(hash) % 3000);
        portCache.set(testFilePath, port);
        return port;
    }
    // Fallback: use process ID and timestamp
    const fallbackPort = basePort + (process.pid % 1000) + (Date.now() % 1000);
    return fallbackPort;
}
/**
 * Get port using current module's file path
 */
function getPort() {
    // Try to get caller's file path from stack trace
    const stack = new Error().stack;
    if (stack) {
        const match = stack.match(/at .* \((.+):\d+:\d+\)/);
        if (match && match[1]) {
            return getTestPort(match[1]);
        }
    }
    // Fallback
    return getTestPort();
}
