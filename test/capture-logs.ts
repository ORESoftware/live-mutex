/**
 * Utility to capture broker and client logs for testing
 * Uses the new onWarning() method for clean log capture
 * Usage: import { attachToBroker, attachToClient, attachToRWClient } from './capture-logs';
 */

export interface LogEntry {
  type: 'warning' | 'error' | 'info';
  source: 'broker' | 'client' | 'rw-client';
  message: string;
  timestamp: number;
}

const logs: LogEntry[] = [];
let captureEnabled = process.env.LMX_CAPTURE_LOGS === 'true' || process.env.LMX_CAPTURE_LOGS === '1';

export function enableLogCapture() {
  captureEnabled = true;
  logs.length = 0; // Clear existing logs
}

export function disableLogCapture() {
  captureEnabled = false;
}

export function getCapturedLogs(): LogEntry[] {
  return [...logs];
}

export function clearCapturedLogs() {
  logs.length = 0;
}

export function printCapturedLogs() {
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

function addLog(type: LogEntry['type'], source: LogEntry['source'], message: string) {
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
function attachWarningListener(instance: any, type: 'broker' | 'client' | 'rw-client') {
  if (instance && typeof instance.onWarning === 'function') {
    instance.onWarning(function(...args: any[]) {
      const parts = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? '\n' + arg.stack : '');
        }
        return String(arg);
      });
      const message = parts.join(' ');
      
      // Add to logs
      addLog('warning', type, message);
    });
  } else if (instance && instance.emitter) {
    // Fallback to emitter if onWarning not available
    instance.emitter.on('warning', (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
      ).join(' ');
      addLog('warning', type, message);
    });
    
    instance.emitter.on('error', (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
      ).join(' ');
      addLog('error', type, message);
    });
  }
}

/**
 * Attach log capture to a broker instance using onWarning()
 */
export function attachToBroker(broker: any) {
  attachWarningListener(broker, 'broker');
}

/**
 * Attach log capture to a client instance using onWarning()
 */
export function attachToClient(client: any) {
  attachWarningListener(client, 'client');
}

/**
 * Attach log capture to an RW client instance using onWarning()
 */
export function attachToRWClient(client: any) {
  attachWarningListener(client, 'rw-client');
}

// Legacy function names for backward compatibility
export function captureBrokerLogs(broker: any) {
  attachToBroker(broker);
}

export function captureClientLogs(client: any) {
  attachToClient(client);
}

export function captureLogs(broker?: any, client?: any) {
  if (broker) attachToBroker(broker);
  if (client) attachToClient(client);
}
