#!/usr/bin/env node
'use strict';


import {routineEnter} from './routine';
import {Client} from "./client";
import chalk from "chalk";

const port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const host = process.argv[3] || process.env.live_mutex_host || 'localhost';
const testKey = process.argv[4] || '__health_check__';

async function main() {
  const routineId = 'ddl-routine-iqJYcKJK81h35DCU8A';
  routineEnter(routineId, "main");
  const client = new Client({port, host, lockRequestTimeout: 3000, maxRetries: 2});
  
  try {
    await client.ensure();
    
    // Try to acquire and release a lock
    const {id} = await client.acquire(testKey, {ttl: 5000});
    await client.release(testKey, {id});
    
    console.log(chalk.green('✓ Health check passed'));
    console.log(chalk.gray(`  Broker: ${host}:${port}`));
    console.log(chalk.gray(`  Lock acquisition/release: OK`));
    
    client.close();
    process.exit(0);
  } catch (err: any) {
    console.log(chalk.red('✗ Health check failed'));
    console.log(chalk.red(`  Error: ${err?.message || err}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});

