"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
function getTestPort(testFilePath) {
    const basePort = 7000;
    const maxPort = 9999;
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    if (process.env.SUMAN_CHILD_ID) {
        const childId = parseInt(process.env.SUMAN_CHILD_ID);
        return basePort + childId;
    }
    if (testFilePath) {
        return getPortFromPath(testFilePath, basePort, maxPort);
    }
    try {
        const stack = new Error().stack;
        if (stack) {
            const lines = stack.split('\n');
            for (const line of lines) {
                const match = line.match(/\((.+\.test\.(ts|js)):\d+:\d+\)/);
                if (match && match[1]) {
                    return getPortFromPath(match[1], basePort, maxPort);
                }
            }
        }
    }
    catch {
    }
    return basePort + (process.pid % 1000) + (Date.now() % 1000);
}
function getPortFromPath(filePath, basePort, maxPort) {
    const pathParts = filePath.split('/');
    const filename = pathParts[pathParts.length - 1].replace(/\.(ts|js)$/, '');
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
        const char = filename.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const portRange = maxPort - basePort;
    const port = basePort + (Math.abs(hash) % portRange);
    return port;
}
