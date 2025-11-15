"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableLogCapture = enableLogCapture;
exports.disableLogCapture = disableLogCapture;
exports.getCapturedLogs = getCapturedLogs;
exports.clearCapturedLogs = clearCapturedLogs;
exports.printCapturedLogs = printCapturedLogs;
exports.attachToBroker = attachToBroker;
exports.attachToClient = attachToClient;
exports.attachToRWClient = attachToRWClient;
exports.captureBrokerLogs = captureBrokerLogs;
exports.captureClientLogs = captureClientLogs;
exports.captureLogs = captureLogs;
const logs = [];
let captureEnabled = process.env.LMX_CAPTURE_LOGS === 'true' || process.env.LMX_CAPTURE_LOGS === '1';
function enableLogCapture() {
    captureEnabled = true;
    logs.length = 0;
}
function disableLogCapture() {
    captureEnabled = false;
}
function getCapturedLogs() {
    return [...logs];
}
function clearCapturedLogs() {
    logs.length = 0;
}
function printCapturedLogs() {
    if (logs.length === 0) {
        return;
    }
    console.log('\n📋 Captured Broker/Client Logs:');
    console.log('='.repeat(80));
    logs.forEach(log => {
        const prefix = log.type === 'error' ? '❌' : log.type === 'warning' ? '⚠️' : 'ℹ️';
        const sourceLabel = log.source === 'broker' ? '[BROKER]' : log.source === 'client' ? '[CLIENT]' : '[RW-CLIENT]';
        console.log(`${prefix} ${sourceLabel} ${log.message}`);
    });
    console.log('='.repeat(80) + '\n');
}
function addLog(type, source, message) {
    if (!captureEnabled)
        return;
    logs.push({
        type,
        source,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        timestamp: Date.now(),
    });
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    const sourceLabel = source === 'broker' ? '[BROKER]' : source === 'client' ? '[CLIENT]' : '[RW-CLIENT]';
    process.stderr.write(`${prefix} ${sourceLabel} ${message}\n`);
}
function attachWarningListener(instance, type) {
    if (instance && typeof instance.onWarning === 'function') {
        instance.onWarning(function (...args) {
            const parts = args.map(arg => {
                if (arg instanceof Error) {
                    return arg.message + (arg.stack ? '\n' + arg.stack : '');
                }
                return String(arg);
            });
            const message = parts.join(' ');
            addLog('warning', type, message);
        });
    }
    else if (instance && instance.emitter) {
        instance.emitter.on('warning', (...args) => {
            const message = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))).join(' ');
            addLog('warning', type, message);
        });
        instance.emitter.on('error', (...args) => {
            const message = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))).join(' ');
            addLog('error', type, message);
        });
    }
}
function attachToBroker(broker) {
    attachWarningListener(broker, 'broker');
}
function attachToClient(client) {
    attachWarningListener(client, 'client');
}
function attachToRWClient(client) {
    attachWarningListener(client, 'rw-client');
}
function captureBrokerLogs(broker) {
    attachToBroker(broker);
}
function captureClientLogs(client) {
    attachToClient(client);
}
function captureLogs(broker, client) {
    if (broker)
        attachToBroker(broker);
    if (client)
        attachToClient(client);
}
