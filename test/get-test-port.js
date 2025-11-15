"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
exports.getPort = getPort;
const fs = require('fs');
const path = require('path');
const portCache = new Map();
let basePort = 7000;
function getTestPort(testFilePath) {
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    if (process.env.SUMAN_CHILD_ID) {
        return basePort + parseInt(process.env.SUMAN_CHILD_ID);
    }
    if (testFilePath) {
        if (portCache.has(testFilePath)) {
            return portCache.get(testFilePath);
        }
        const filename = path.basename(testFilePath, path.extname(testFilePath));
        let hash = 0;
        for (let i = 0; i < filename.length; i++) {
            const char = filename.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const port = basePort + (Math.abs(hash) % 3000);
        portCache.set(testFilePath, port);
        return port;
    }
    const fallbackPort = basePort + (process.pid % 1000) + (Date.now() % 1000);
    return fallbackPort;
}
function getPort() {
    const stack = new Error().stack;
    if (stack) {
        const match = stack.match(/at .* \((.+):\d+:\d+\)/);
        if (match && match[1]) {
            return getTestPort(match[1]);
        }
    }
    return getTestPort();
}
