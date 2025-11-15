#!/usr/bin/env node
'use strict';

import {Client} from "./client";
import chalk from "chalk";
import * as net from 'net';

const port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const host = process.argv[3] || process.env.live_mutex_host || 'localhost';

function checkPort(host: string, port: number): Promise<boolean> {
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

async function main() {
  console.log(chalk.blue.bold('Live-Mutex Broker Status Check'));
  console.log(chalk.gray(`Checking ${host}:${port}...\n`));

  const portOpen = await checkPort(host, port);
  
  if (!portOpen) {
    console.log(chalk.red('✗ Broker is not running or not accessible'));
    console.log(chalk.yellow('\nTo start a broker:'));
    console.log(chalk.cyan('  $ lmx start'));
    console.log(chalk.cyan('  $ lmx_start_server'));
    console.log(chalk.cyan('  $ docker run -d -p 6970:6970 oresoftware/live-mutex-broker:latest'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Port is open'));

  try {
    const client = new Client({port, host, lockRequestTimeout: 2000, maxRetries: 1});
    
    await client.ensure();
    console.log(chalk.green('✓ Successfully connected to broker'));

    client.close();
    console.log(chalk.green.bold('\n✓ Broker is healthy and ready to use'));
    process.exit(0);
  } catch (err: any) {
    console.log(chalk.yellow('⚠ Port is open but broker connection failed'));
    console.log(chalk.gray(`  Error: ${err?.message || err}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});

