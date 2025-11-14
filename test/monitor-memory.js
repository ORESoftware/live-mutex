#!/usr/bin/env node
'use strict';

/**
 * Memory monitoring utility
 * Monitors a running process or the current process memory usage
 */

const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
        timestamp: Date.now()
    };
}

// Monitor current process
function monitorCurrentProcess(interval = 5000) {
    console.log('Monitoring current process memory...');
    console.log('Press Ctrl+C to stop\n');

    const snapshots = [];
    const startTime = Date.now();

    const monitor = setInterval(() => {
        const mem = getMemoryUsage();
        snapshots.push(mem);
        const elapsed = (Date.now() - startTime) / 1000;

        console.log(`[${new Date().toISOString()}] After ${elapsed.toFixed(1)}s:`);
        console.log(`  Heap Used: ${formatBytes(mem.heapUsed)}`);
        console.log(`  Heap Total: ${formatBytes(mem.heapTotal)}`);
        console.log(`  RSS: ${formatBytes(mem.rss)}`);
        console.log(`  External: ${formatBytes(mem.external)}`);

        if (snapshots.length > 1) {
            const first = snapshots[0];
            const growth = mem.heapUsed - first.heapUsed;
            const growthPercent = (growth / first.heapUsed) * 100;
            console.log(`  Growth since start: ${formatBytes(growth)} (${growthPercent.toFixed(2)}%)`);
        }
        console.log('');
    }, interval);

    process.on('SIGINT', () => {
        clearInterval(monitor);
        console.log('\nMonitoring stopped');
        if (snapshots.length > 1) {
            const first = snapshots[0];
            const last = snapshots[snapshots.length - 1];
            const totalGrowth = last.heapUsed - first.heapUsed;
            const totalGrowthPercent = (totalGrowth / first.heapUsed) * 100;
            console.log(`\nTotal memory growth: ${formatBytes(totalGrowth)} (${totalGrowthPercent.toFixed(2)}%)`);
        }
        process.exit(0);
    });
}

// Check log file
function checkLogFile() {
    const logPath = path.join(__dirname, 'memory-test-results.log');
    if (!fs.existsSync(logPath)) {
        console.log('Log file not found:', logPath);
        return;
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');

    // Extract memory snapshots
    const snapshots = [];
    let currentSnapshot = null;

    for (const line of lines) {
        if (line.includes('Memory Check') || line.includes('Memory State')) {
            if (currentSnapshot) {
                snapshots.push(currentSnapshot);
            }
            currentSnapshot = { label: line.trim() };
        } else if (line.includes('Heap Used:')) {
            const match = line.match(/Heap Used: ([\d.]+) MB/);
            if (match && currentSnapshot) {
                currentSnapshot.heapUsed = parseFloat(match[1]) * 1024 * 1024;
            }
        } else if (line.includes('RSS:')) {
            const match = line.match(/RSS: ([\d.]+) MB/);
            if (match && currentSnapshot) {
                currentSnapshot.rss = parseFloat(match[1]) * 1024 * 1024;
            }
        }
    }

    if (currentSnapshot) {
        snapshots.push(currentSnapshot);
    }

    if (snapshots.length > 0) {
        console.log('Memory snapshots from log:');
        console.log('');
        snapshots.forEach((snap, i) => {
            console.log(`${i + 1}. ${snap.label}`);
            if (snap.heapUsed) {
                console.log(`   Heap: ${formatBytes(snap.heapUsed)}`);
            }
            if (snap.rss) {
                console.log(`   RSS: ${formatBytes(snap.rss)}`);
            }
        });

        if (snapshots.length >= 2) {
            const first = snapshots[0];
            const last = snapshots[snapshots.length - 1];
            if (first.heapUsed && last.heapUsed) {
                const growth = last.heapUsed - first.heapUsed;
                const growthPercent = (growth / first.heapUsed) * 100;
                console.log(`\nTotal growth: ${formatBytes(growth)} (${growthPercent.toFixed(2)}%)`);
            }
        }
    } else {
        console.log('No memory snapshots found in log');
    }
}

// Main
const command = process.argv[2];

if (command === 'log') {
    checkLogFile();
} else {
    monitorCurrentProcess(5000);
}

