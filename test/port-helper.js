"use strict";
/**
 * Port allocation helper for tests
 * Ensures each test file gets a unique, consistent port
 * This allows tests to run serially with independent brokers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
/**
 * Get a unique port for the current test file
 *
 * Priority:
 * 1. lmx_port environment variable (for manual override)
 * 2. SUMAN_CHILD_ID (for parallel runs with suman)
 * 3. Hash of test file path (for serial runs - ensures consistency)
 *
 * @param testFilePath - Optional path to test file. If not provided, attempts to detect from call stack
 */
function getTestPort(testFilePath) {
    const basePort = 7000;
    const maxPort = 9999;
    // 1. Manual override via environment variable
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    // 2. Use SUMAN_CHILD_ID if available (for parallel runs)
    if (process.env.SUMAN_CHILD_ID) {
        const childId = parseInt(process.env.SUMAN_CHILD_ID);
        return basePort + childId;
    }
    // 3. Generate port from test file path (for serial runs)
    if (testFilePath) {
        return getPortFromPath(testFilePath, basePort, maxPort);
    }
    // 4. Try to detect from call stack
    try {
        const stack = new Error().stack;
        if (stack) {
            // Look for test file in stack trace
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
        // Fall through to default
    }
    // 5. Fallback: use process ID and timestamp
    return basePort + (process.pid % 1000) + (Date.now() % 1000);
}
/**
 * Generate a port from a file path using a hash function
 */
function getPortFromPath(filePath, basePort, maxPort) {
    // Use filename (without extension) for more consistent hashing
    const pathParts = filePath.split('/');
    const filename = pathParts[pathParts.length - 1].replace(/\.(ts|js)$/, '');
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
        const char = filename.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Ensure port is in valid range
    const portRange = maxPort - basePort;
    const port = basePort + (Math.abs(hash) % portRange);
    return port;
}
