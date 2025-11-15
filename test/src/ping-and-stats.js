#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../../dist/client");
const chalk_1 = require("chalk");
const args = process.argv.slice(2);
let host = 'live-mutex.fly.dev';
let port = 6970;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && i + 1 < args.length) {
        host = args[i + 1];
        i++;
    }
    else if (args[i] === '--port' && i + 1 < args.length) {
        port = parseInt(args[i + 1], 10);
        if (isNaN(port)) {
            console.error('Port must be a number');
            process.exit(1);
        }
        i++;
    }
    else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
Live-Mutex Server Monitor

Usage:
  ts-node mutex-monitor.ts [--host hostname] [--port number]

Options:
  --host    Hostname or IP address of the Live-Mutex server (default: live-mutex.fly.dev)
  --port    Port number of the Live-Mutex server (default: 6970)
  --help    Show this help message
`);
        process.exit(0);
    }
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0)
        parts.push(`${secs}s`);
    return parts.join(' ');
}
async function main() {
    console.log(chalk_1.default.blue.bold(`Connecting to Live-Mutex server at ${host}:${port}...`));
    const client = new client_1.Client({ host, port });
    try {
        await client.ensure();
        console.log(chalk_1.default.green('✓ Connected successfully'));
        console.log(chalk_1.default.yellow('\nSending ping...'));
        const pingResult = await client.ping();
        console.log(chalk_1.default.green('✓ Ping successful'));
        console.log(`  Round-trip time: ${chalk_1.default.cyan(pingResult.roundTripTime + 'ms')}`);
        console.log(`  Server time: ${chalk_1.default.cyan(new Date(pingResult.serverTime).toISOString())}`);
        console.log(`  Local time: ${chalk_1.default.cyan(new Date().toISOString())}`);
        console.log(`  Time diff: ${chalk_1.default.cyan(Math.abs(Date.now() - pingResult.serverTime) + 'ms')}`);
        console.log(chalk_1.default.yellow('\nFetching system statistics...'));
        const stats = await client.getSystemStats();
        console.log(chalk_1.default.green('✓ Statistics retrieved'));
        console.log(chalk_1.default.bold('\n=== BROKER STATISTICS ==='));
        console.log(`  Process ID: ${chalk_1.default.cyan(stats.broker.pid)}`);
        console.log(`  Uptime: ${chalk_1.default.cyan(formatDuration(stats.broker.uptime))}`);
        console.log(`  Connected clients: ${chalk_1.default.cyan(stats.broker.connectedClients)}`);
        console.log(`  Active locks: ${chalk_1.default.cyan(stats.broker.totalLocks)}`);
        console.log(`  Pending requests: ${chalk_1.default.cyan(stats.broker.pendingRequests)}`);
        console.log(`  Active timeouts: ${chalk_1.default.cyan(stats.broker.activeTimeouts)}`);
        console.log(chalk_1.default.cyan('\n  Memory Usage (Broker):'));
        const brokerMem = stats.broker.memoryUsage;
        console.log(`    RSS: ${chalk_1.default.yellow(formatBytes(brokerMem.rss))} (Resident Set Size)`);
        console.log(`    Heap Total: ${chalk_1.default.yellow(formatBytes(brokerMem.heapTotal))}`);
        console.log(`    Heap Used: ${chalk_1.default.yellow(formatBytes(brokerMem.heapUsed))}`);
        console.log(`    External: ${chalk_1.default.yellow(formatBytes(brokerMem.external))}`);
        if (brokerMem.arrayBuffers) {
            console.log(`    Array Buffers: ${chalk_1.default.yellow(formatBytes(brokerMem.arrayBuffers))}`);
        }
        console.log(chalk_1.default.bold('\n=== CLIENT STATISTICS ==='));
        console.log(`  Process ID: ${chalk_1.default.cyan(stats.client.clientPid)}`);
        console.log(`  Uptime: ${chalk_1.default.cyan(formatDuration(stats.client.clientUptime))}`);
        console.log(chalk_1.default.cyan('\n  Memory Usage (Client):'));
        const clientMem = stats.client.clientMemoryUsage;
        console.log(`    RSS: ${chalk_1.default.yellow(formatBytes(clientMem.rss))} (Resident Set Size)`);
        console.log(`    Heap Total: ${chalk_1.default.yellow(formatBytes(clientMem.heapTotal))}`);
        console.log(`    Heap Used: ${chalk_1.default.yellow(formatBytes(clientMem.heapUsed))}`);
        console.log(`    External: ${chalk_1.default.yellow(formatBytes(clientMem.external))}`);
        if (clientMem.arrayBuffers) {
            console.log(`    Array Buffers: ${chalk_1.default.yellow(formatBytes(clientMem.arrayBuffers))}`);
        }
        console.log(chalk_1.default.gray(`\nStatistics captured at: ${new Date(stats.receivedAt).toISOString()}`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error.message || error);
        process.exit(1);
    }
    finally {
        client.close();
    }
}
main().catch(err => {
    console.error(chalk_1.default.red('Fatal error:'), err);
    process.exit(1);
});
