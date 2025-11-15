#!/usr/bin/env node

/**
 * Status CLI tool - check broker status and connection info
 */

'use strict';

import * as net from 'net';
import {Client} from '../../src/main';

const port = parseInt(process.env.lmx_port || process.env.LMX_PORT || '6970');
const host = process.env.lmx_host || process.env.LMX_HOST || 'localhost';

function checkPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;
    
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

async function getBrokerInfo() {
  const client = new Client({port, host});
  
  try {
    await client.ensure();
    
    // Try to inspect the broker
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.close();
        reject(new Error('Timeout waiting for broker response'));
      }, 5000);
      
      // Use inspect if available, otherwise just return basic info
      resolve({
        connected: true,
        port,
        host
      });
    });
  } catch (err: any) {
    return {
      connected: false,
      error: err.message,
      port,
      host
    };
  }
}

async function main() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║           Live-Mutex Broker Status                              ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  console.log(`Checking broker at ${host}:${port}...\n`);
  
  const portOpen = await checkPort(port, host);
  
  if (!portOpen) {
    console.log(`❌ Broker Status: NOT RUNNING`);
    console.log(`   Port ${port} on ${host} is not accessible\n`);
    console.log(`To start a broker:`);
    console.log(`  $ lmx-quick-start start`);
    console.log(`  $ lmx start`);
    console.log(`  $ docker run -d -p ${port}:${port} oresoftware/live-mutex-broker:latest\n`);
    process.exit(1);
  }
  
  console.log(`✅ Port ${port} is open`);
  
  try {
    const info = await getBrokerInfo();
    if (info.connected) {
      console.log(`✅ Successfully connected to broker`);
      console.log(`\nBroker Information:`);
      console.log(`  Host: ${info.host}`);
      console.log(`  Port: ${info.port}`);
      console.log(`  Status: RUNNING\n`);
      
      // Try a quick lock test
      const client = new Client({port, host});
      await client.ensure();
      const testKey = `status-check-${Date.now()}`;
      const {key, id} = await client.acquire(testKey, {lockRequestTimeout: 2000});
      await client.release(key, {id});
      client.close();
      
      console.log(`✅ Lock test: PASSED`);
      console.log(`\nBroker is fully operational! 🎉\n`);
      process.exit(0);
    } else {
      console.log(`⚠️  Port is open but broker may not be responding correctly`);
      console.log(`   Error: ${info.error}\n`);
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`⚠️  Port is open but connection test failed`);
    console.log(`   Error: ${err.message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

