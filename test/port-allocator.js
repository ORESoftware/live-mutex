"use strict";
/**
 * Port allocator for tests to ensure each test gets a unique port
 * This prevents conflicts when running tests serially or in parallel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
exports.releasePort = releasePort;
exports.getPort = getPort;
let portCounter = 7000;
const usedPorts = new Set();
/**
 * Get a unique port for a test
 * Uses test file name and process ID to ensure uniqueness
 */
function getTestPort(testFilePath) {
    // Use a combination of base port, process ID, and a counter
    const basePort = 7000;
    const pid = process.pid % 1000; // Use last 3 digits of PID
    const testHash = testFilePath
        ? testFilePath.split('/').pop()?.split('.').shift()?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0
        : 0;
    // Generate a unique port
    let port = basePort + pid + (testHash % 100) + (portCounter % 50);
    portCounter++;
    // Ensure port is in valid range and not already used
    while (port < 7000 || port > 9999 || usedPorts.has(port)) {
        port = basePort + pid + (portCounter % 500);
        portCounter++;
    }
    usedPorts.add(port);
    return port;
}
/**
 * Release a port (for cleanup if needed)
 */
function releasePort(port) {
    usedPorts.delete(port);
}
/**
 * Get port from environment or generate a unique one
 */
function getPort(testFilePath) {
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    // Use SUMAN_CHILD_ID if available (for parallel runs)
    if (process.env.SUMAN_CHILD_ID) {
        return 7000 + parseInt(process.env.SUMAN_CHILD_ID);
    }
    // Otherwise generate a unique port
    return getTestPort(testFilePath);
}
