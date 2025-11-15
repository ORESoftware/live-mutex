/**
 * Utility to capture broker and client logs for testing
 * Usage: import { captureBrokerLogs, captureClientLogs } from './capture-logs';
 */

export interface LogEntry {
  type: 'warning' | 'error' | 'info';
  source: 'broker' | 'client';
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
    const sourceLabel = log.source === 'broker' ? '[BROKER]' : '[CLIENT]';
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
  
  // Also print to console if enabled
  if (process.env.LMX_CAPTURE_LOGS_PRINT === 'true' || process.env.LMX_CAPTURE_LOGS_PRINT === '1') {
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    const sourceLabel = source === 'broker' ? '[BROKER]' : '[CLIENT]';
    console.log(`${prefix} ${sourceLabel} ${message}`);
  }
}

/**
 * Attach log capture listeners to a broker instance
 * Note: Broker already has a default warning listener, so we add ours without removing it
 */
export function captureBrokerLogs(broker: any) {
  if (!broker || !broker.emitter) {
    return;
  }
  
  // Add our capture listeners (don't remove existing ones - broker has its own default listener)
  broker.emitter.on('warning', (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
    ).join(' ');
    addLog('warning', 'broker', message);
  });
  
  broker.emitter.on('error', (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
    ).join(' ');
    addLog('error', 'broker', message);
  });
}

/**
 * Attach log capture listeners to a client instance
 * Note: Client already has a default warning listener, so we add ours without removing it
 */
export function captureClientLogs(client: any) {
  if (!client || !client.emitter) {
    return;
  }
  
  // Add our capture listeners (don't remove existing ones - client has its own default listener)
  client.emitter.on('warning', (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
    ).join(' ');
    addLog('warning', 'client', message);
  });
  
  client.emitter.on('error', (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))
    ).join(' ');
    addLog('error', 'client', message);
  });
}

/**
 * Attach log capture to both broker and client
 */
export function captureLogs(broker?: any, client?: any) {
  if (broker) captureBrokerLogs(broker);
  if (client) captureClientLogs(client);
}

