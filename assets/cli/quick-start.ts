#!/usr/bin/env node

/**
 * Quick start CLI tool - helps users get started with live-mutex
 */

'use strict';

import * as net from 'net';
import {Broker1} from '../../src/main';

const port = parseInt(process.env.lmx_port || process.env.LMX_PORT || '6970');
const host = process.env.lmx_host || process.env.LMX_HOST || 'localhost';

function checkPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;
    
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.once('error', () => {
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Live-Mutex Quick Start Guide                         ║
╚════════════════════════════════════════════════════════════════╝

Usage: lmx-quick-start <command>

Commands:
  check          Check if broker is running on default port (${port})
  start          Start a broker on default port (${port})
  test           Test acquiring and releasing a lock
  docker         Show Docker commands to get started
  examples       Show code examples

Examples:
  $ lmx-quick-start check
  $ lmx-quick-start start
  $ lmx-quick-start test
  $ lmx-quick-start docker
  $ lmx-quick-start examples

Environment Variables:
  LMX_PORT       Broker port (default: ${port})
  LMX_HOST       Broker host (default: ${host})
`);
    process.exit(0);
  }

  if (command === 'check') {
    console.log(`Checking if broker is running on ${host}:${port}...`);
    const isRunning = await checkPort(port, host);
    if (isRunning) {
      console.log(`✅ Broker is running on ${host}:${port}`);
      process.exit(0);
    } else {
      console.error(`❌ No broker found on ${host}:${port}`);
      console.error(`\nStart a broker with: lmx-quick-start start`);
      console.error(`Or use Docker: lmx-quick-start docker`);
      process.exit(1);
    }
  }

  if (command === 'start') {
    console.log(`Starting broker on ${host}:${port}...`);
    console.log(`Press Ctrl+C to stop\n`);
    
    const broker = new Broker1({port, host});
    broker.ensure().then(() => {
      console.log(`✅ Broker started successfully on ${host}:${port}`);
      console.log(`\nYou can now use clients to connect to this broker.`);
      console.log(`Test it with: lmx-quick-start test\n`);
    }).catch((err: any) => {
      console.error(`❌ Failed to start broker:`, err.message);
      process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\nShutting down broker...');
      broker.close(() => {
        console.log('✅ Broker stopped');
        process.exit(0);
      });
    });
  }

  if (command === 'test') {
    console.log(`Testing connection to broker at ${host}:${port}...`);
    const isRunning = await checkPort(port, host);
    
    if (!isRunning) {
      console.error(`❌ Broker is not running on ${host}:${port}`);
      console.error(`\nStart a broker first with: lmx-quick-start start`);
      process.exit(1);
    }

    console.log(`✅ Broker is running, testing lock acquisition...`);
    
    const {Client} = await import('../../src/main');
    const client = new Client({port, host});
    
    try {
      await client.ensure();
      console.log(`✅ Connected to broker`);
      
      const testKey = 'quick-start-test';
      console.log(`Acquiring lock on key "${testKey}"...`);
      
      const {key, id} = await client.acquire(testKey);
      console.log(`✅ Lock acquired: key="${key}", id="${id}"`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await client.release(key, {id});
      console.log(`✅ Lock released successfully`);
      
      client.close();
      console.log(`\n✅ All tests passed! Live-Mutex is working correctly.`);
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Test failed:`, err.message || err);
      if (client) client.close();
      process.exit(1);
    }
  }

  if (command === 'docker') {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Docker Quick Start Commands                          ║
╚════════════════════════════════════════════════════════════════╝

1. Pull the Docker image:
   $ docker pull oresoftware/live-mutex-broker:latest

2. Run the broker container:
   $ docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest

3. View broker logs:
   $ docker logs -f lmx-broker

4. Stop the broker:
   $ docker stop lmx-broker

5. Remove the container:
   $ docker rm lmx-broker

6. Run interactively (for testing):
   $ docker run -it -p 6970:6970 oresoftware/live-mutex-broker:latest

After starting the broker, test it with:
   $ lmx-quick-start test
`);
    process.exit(0);
  }

  if (command === 'examples') {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Code Examples                                        ║
╚════════════════════════════════════════════════════════════════╝

TypeScript/JavaScript Example:
─────────────────────────────────────────────────────────────────
import {Client} from 'live-mutex';

const client = new Client({port: 6970, host: 'localhost'});

async function example() {
  await client.ensure();
  
  const {key, id} = await client.acquire('my-lock-key');
  try {
    // Your critical section code here
    console.log('Lock acquired, doing work...');
  } finally {
    await client.release(key, {id});
  }
}

example().catch(console.error);

─────────────────────────────────────────────────────────────────

Callback Style Example:
─────────────────────────────────────────────────────────────────
import {Client} from 'live-mutex';

const client = new Client({port: 6970, host: 'localhost'});

client.ensure((err, c) => {
  if (err) return console.error(err);
  
  c.acquire('my-lock-key', (err, {key, id}) => {
    if (err) return console.error(err);
    
    // Your critical section code here
    console.log('Lock acquired, doing work...');
    
    c.release(key, {id}, (err) => {
      if (err) return console.error(err);
      console.log('Lock released');
    });
  });
});

─────────────────────────────────────────────────────────────────

Read-Write Lock Example:
─────────────────────────────────────────────────────────────────
import {RWLockWritePrefClient} from 'live-mutex';

const client = new RWLockWritePrefClient({port: 6970, host: 'localhost'});

async function example() {
  await client.ensure();
  
  // Acquire read lock (multiple readers can coexist)
  const releaseRead = await client.acquireReadLock('my-key');
  try {
    // Read operations
  } finally {
    await releaseRead();
  }
  
  // Acquire write lock (exclusive)
  const releaseWrite = await client.acquireWriteLock('my-key');
  try {
    // Write operations
  } finally {
    await releaseWrite();
  }
}

example().catch(console.error);
`);
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  console.error(`Run 'lmx-quick-start help' for usage information`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

