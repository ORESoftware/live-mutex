#!/usr/bin/env node
'use strict';


import {routineEnter} from './routine';
import chalk from "chalk";
import * as net from 'net';

function checkPort(host: string, port: number): Promise<boolean> {
  const routineId = 'ddl-routine-dSmZTQyYXglcEZZRti';
  routineEnter(routineId, "checkPort");
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
  const routineId = 'ddl-routine-N2L7MM6bo8D30HUSmx';
  routineEnter(routineId, "main");
  console.log(chalk.bold.blue('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║         Live-Mutex Quick Start Guide                      ║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n'));

  const port = 6970;
  const host = 'localhost';
  const isRunning = await checkPort(host, port);

  if (!isRunning) {
    console.log(chalk.yellow('Broker is not running. Choose a method to start it:\n'));
    
    console.log(chalk.bold('Option 1: Using NPM (Recommended for development)'));
    console.log(chalk.cyan('  $ npm install -g live-mutex'));
    console.log(chalk.cyan('  $ lmx start\n'));
    
    console.log(chalk.bold('Option 2: Using Docker (Recommended for production)'));
    console.log(chalk.cyan('  $ docker pull oresoftware/live-mutex-broker:latest'));
    console.log(chalk.cyan('  $ docker run -d -p 6970:6970 --name lmx-broker oresoftware/live-mutex-broker:latest\n'));
    
    console.log(chalk.bold('Option 3: Programmatically in your Node.js app'));
    console.log(chalk.cyan('  import {Broker1} from \'live-mutex\';'));
    console.log(chalk.cyan('  const broker = new Broker1({port: 6970});'));
    console.log(chalk.cyan('  await broker.ensure();\n'));
  } else {
    console.log(chalk.green('✓ Broker is already running on port 6970\n'));
  }

  console.log(chalk.bold('Next Steps:\n'));
  console.log(chalk.white('1. Install the library:'));
  console.log(chalk.cyan('   $ npm install live-mutex\n'));
  
  console.log(chalk.white('2. Use in your code:'));
  console.log(chalk.gray('   import {Client} from \'live-mutex\';'));
  console.log(chalk.gray('   const client = new Client({port: 6970, host: \'localhost\'});'));
  console.log(chalk.gray('   await client.ensure();'));
  console.log(chalk.gray('   const {id} = await client.acquire(\'my-key\');'));
  console.log(chalk.gray('   // ... do your work ...'));
  console.log(chalk.gray('   await client.release(\'my-key\', id);\n'));
  
  console.log(chalk.white('3. Test the connection:'));
  console.log(chalk.cyan('   $ lmx status'));
  console.log(chalk.cyan('   $ lmx health-check\n'));
  
  console.log(chalk.bold('Useful Commands:'));
  console.log(chalk.cyan('  lmx start          - Start a broker'));
  console.log(chalk.cyan('  lmx status         - Check broker status'));
  console.log(chalk.cyan('  lmx health-check   - Run health check'));
  console.log(chalk.cyan('  lmx acquire <key>  - Acquire a lock'));
  console.log(chalk.cyan('  lmx release <key>  - Release a lock'));
  console.log(chalk.cyan('  lmx ls             - List active locks'));
  console.log(chalk.cyan('  lmx inspect        - Interactive broker inspection\n'));
  
  console.log(chalk.gray('For more information, see README.md or README-2.md\n'));
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});

