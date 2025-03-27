#!/usr/bin/env ts-node
/**
 * Live-Mutex Server Monitor
 *
 * This script pings a Live-Mutex broker server and retrieves system statistics.
 *
 * Usage:
 *   ts-node mutex-monitor.ts [--host hostname] [--port number]
 *
 * Default:
 *   Host: live-mutex.fly.dev
 *   Port: 6970
 */

import { Client } from '../../dist/client';
import chalk from 'chalk';

// Parse command line arguments
const args = process.argv.slice(2);
let host = 'live-mutex.fly.dev';
let port = 6970;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && i + 1 < args.length) {
        host = args[i + 1];
        i++;
    } else if (args[i] === '--port' && i + 1 < args.length) {
        port = parseInt(args[i + 1], 10);
        if (isNaN(port)) {
            console.error('Port must be a number');
            process.exit(1);
        }
        i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
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

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to format time duration
function formatDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

async function main() {
    console.log(chalk.blue.bold(`Connecting to Live-Mutex server at ${host}:${port}...`));

    const client = new Client({ host, port });

    try {
        // Ensure connection is established
        await client.ensure();
        console.log(chalk.green('✓ Connected successfully'));

        // Ping the server
        console.log(chalk.yellow('\nSending ping...'));
        const pingResult = await client.ping();

        console.log(chalk.green('✓ Ping successful'));
        console.log(`  Round-trip time: ${chalk.cyan(pingResult.roundTripTime + 'ms')}`);
        console.log(`  Server time: ${chalk.cyan(new Date(pingResult.serverTime).toISOString())}`);
        console.log(`  Local time: ${chalk.cyan(new Date().toISOString())}`);
        console.log(`  Time diff: ${chalk.cyan(Math.abs(Date.now() - pingResult.serverTime) + 'ms')}`);

        // Get system stats
        console.log(chalk.yellow('\nFetching system statistics...'));
        const stats = await client.getSystemStats();

        console.log(chalk.green('✓ Statistics retrieved'));

        // Display broker stats
        console.log(chalk.bold('\n=== BROKER STATISTICS ==='));
        console.log(`  Process ID: ${chalk.cyan(stats.broker.pid)}`);
        console.log(`  Uptime: ${chalk.cyan(formatDuration(stats.broker.uptime))}`);
        console.log(`  Connected clients: ${chalk.cyan(stats.broker.connectedClients)}`);
        console.log(`  Active locks: ${chalk.cyan(stats.broker.totalLocks)}`);
        console.log(`  Pending requests: ${chalk.cyan(stats.broker.pendingRequests)}`);
        console.log(`  Active timeouts: ${chalk.cyan(stats.broker.activeTimeouts)}`);

        // Memory usage (broker)
        console.log(chalk.cyan('\n  Memory Usage (Broker):'));
        const brokerMem = stats.broker.memoryUsage;
        console.log(`    RSS: ${chalk.yellow(formatBytes(brokerMem.rss))} (Resident Set Size)`);
        console.log(`    Heap Total: ${chalk.yellow(formatBytes(brokerMem.heapTotal))}`);
        console.log(`    Heap Used: ${chalk.yellow(formatBytes(brokerMem.heapUsed))}`);
        console.log(`    External: ${chalk.yellow(formatBytes(brokerMem.external))}`);
        if (brokerMem.arrayBuffers) {
            console.log(`    Array Buffers: ${chalk.yellow(formatBytes(brokerMem.arrayBuffers))}`);
        }

        // Display client stats
        console.log(chalk.bold('\n=== CLIENT STATISTICS ==='));
        console.log(`  Process ID: ${chalk.cyan(stats.client.clientPid)}`);
        console.log(`  Uptime: ${chalk.cyan(formatDuration(stats.client.clientUptime))}`);

        // Memory usage (client)
        console.log(chalk.cyan('\n  Memory Usage (Client):'));
        const clientMem = stats.client.clientMemoryUsage;
        console.log(`    RSS: ${chalk.yellow(formatBytes(clientMem.rss))} (Resident Set Size)`);
        console.log(`    Heap Total: ${chalk.yellow(formatBytes(clientMem.heapTotal))}`);
        console.log(`    Heap Used: ${chalk.yellow(formatBytes(clientMem.heapUsed))}`);
        console.log(`    External: ${chalk.yellow(formatBytes(clientMem.external))}`);
        if (clientMem.arrayBuffers) {
            console.log(`    Array Buffers: ${chalk.yellow(formatBytes(clientMem.arrayBuffers))}`);
        }

        console.log(chalk.gray(`\nStatistics captured at: ${new Date(stats.receivedAt).toISOString()}`));

    } catch (error) {
        console.error(chalk.red('Error:'), error.message || error);
        process.exit(1);
    } finally {
        // Close the client connection
        client.close();
    }
}

main().catch(err => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
});
