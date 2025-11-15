"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestPort = getTestPort;
exports.releasePort = releasePort;
exports.getPort = getPort;
let portCounter = 7000;
const usedPorts = new Set();
function getTestPort(testFilePath) {
    const basePort = 7000;
    const pid = process.pid % 1000;
    const testHash = testFilePath
        ? testFilePath.split('/').pop()?.split('.').shift()?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0
        : 0;
    let port = basePort + pid + (testHash % 100) + (portCounter % 50);
    portCounter++;
    while (port < 7000 || port > 9999 || usedPorts.has(port)) {
        port = basePort + pid + (portCounter % 500);
        portCounter++;
    }
    usedPorts.add(port);
    return port;
}
function releasePort(port) {
    usedPorts.delete(port);
}
function getPort(testFilePath) {
    if (process.env.lmx_port) {
        return parseInt(process.env.lmx_port);
    }
    if (process.env.SUMAN_CHILD_ID) {
        return 7000 + parseInt(process.env.SUMAN_CHILD_ID);
    }
    return getTestPort(testFilePath);
}
