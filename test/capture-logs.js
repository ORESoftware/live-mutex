#!/usr/bin/env node

/**
 * Utility to capture broker and client logs for testing
 * Uses the new onWarning() method for clean log capture
 * Usage: const { attachToBroker, attachToClient, attachToRWClient } = require('./capture-logs');
 */

'use strict';

const logs = [];
let captureEnabled = process.env.LMX_CAPTURE_LOGS === 'true' || process.env.LMX_CAPTURE_LOGS === '1';

function enableLogCapture() {
  captureEnabled = true;
  logs.length = 0; // Clear existing logs
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
  if (!captureEnabled) return;
  
  logs.push({
    type,
    source,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    timestamp: Date.now(),
  });
  
  // Always write to stderr to ensure inactivity timeout can detect activity
  // This ensures the test runner knows the process is still alive
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  const sourceLabel = source === 'broker' ? '[BROKER]' : source === 'client' ? '[CLIENT]' : '[RW-CLIENT]';
  process.stderr.write(`${prefix} ${sourceLabel} ${message}\n`);
}

/**
 * Helper to attach warning listener using the clean onWarning() method
 */
function attachWarningListener(instance, type) {
  if (instance && typeof instance.onWarning === 'function') {
    instance.onWarning(function(...args) {
      const parts = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? '\n' + arg.stack : '');
        }
        return String(arg);
      });
      const message = parts.join(' ');
      
      // Add to logs
      addLog('warning', type.toLowerCase(), message);
    });
  } else if (instance && instance.emitter) {
    // Fallback to emitter if onWarning not available
    instance.emitter.on('warning', (...args) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
      ).join(' ');
      addLog('warning', type.toLowerCase(), message);
    });
    
    instance.emitter.on('error', (...args) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
      ).join(' ');
      addLog('error', type.toLowerCase(), message);
    });
  }
}

/**
 * Attach log capture to a broker instance using onWarning()
 */
function attachToBroker(broker) {
  attachWarningListener(broker, 'broker');
}

/**
 * Attach log capture to a client instance using onWarning()
 */
function attachToClient(client) {
  attachWarningListener(client, 'client');
}

/**
 * Attach log capture to an RW client instance using onWarning()
 */
function attachToRWClient(client) {
  attachWarningListener(client, 'rw-client');
}

// Legacy function names for backward compatibility
function captureBrokerLogs(broker) {
  attachToBroker(broker);
}

function captureClientLogs(client) {
  attachToClient(client);
}

function captureLogs(broker, client) {
  if (broker) attachToBroker(broker);
  if (client) attachToClient(client);
}

module.exports = {
  // New API using onWarning()
  attachToBroker,
  attachToClient,
  attachToRWClient,
  // Legacy API for backward compatibility
  captureBrokerLogs,
  captureClientLogs,
  captureLogs,
  // Utility functions
  enableLogCapture,
  disableLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  printCapturedLogs,
};
