#!/usr/bin/env node
'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as net from 'net';
import readline = require('readline');

//npm
import chalk from 'chalk';
import uuidV4 = require('uuid/v4');
import {createParser} from "./json-parser";

//project
export const log = {
  info: console.log.bind(console, ' [live-mutex client]'),
  error: console.error.bind(console, ' [live-mutex client]')
};

const port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');

const s = net.createConnection({port});
s.setEncoding('utf8');

s.once('error', function (e) {
  log.error('socket experienced an error:', e);
});

s.pipe(createParser()).on('data', function (d: any) {
  console.log('server response:', String(d.inspectResult));
  process.stdout.write(chalk.blueBright('live mutex > '));
});

const acceptableCommands = {
  'lockcount': true,
  'lock-count': true,
  'clientcount': true,
  'fff': true
};

// readline.emitKeypressEvents(process.stdin);
// if (process.stdin.isTTY) {
//   process.stdin.setRawMode(true);
// }

s.once('connect', function () {
  
  console.log(chalk.green('client is connected to live-mutex broker at port:'), chalk.greenBright.bold(String(port)));
  process.stdout.write(chalk.blueBright('live mutex > '));
  
  const rl = readline.createInterface({
    input: process.stdin,
  });
  
  // process.on('SIGINT', function(){
  //   process.stdout.write('\x1Bc');
  //   process.stdout.write(chalk.blueBright('live mutex > '));
  // });
  
  // process.stdin.resume().setEncoding('utf8').on('data', function(d){
  //   console.log('stdin got data:', String(d));
  // });
  
  // rl.on('data', function (d) {
  //   console.log('readline got data:', String(d));
  // });
  
  rl.on('line', function (d) {
    
    readline.clearLine(process.stdout, 0);  // clear current text
    readline.cursorTo(process.stdout, 0);   // move cursor to beginning of line
    
    const lc = String(d || '').trim().toLowerCase();
    
    if (!lc) {
      process.stdout.write(chalk.blueBright('live mutex > '));
      return;
    }
    
    if (lc === 'clear') {
      process.stdout.write('\x1Bc');
      process.stdout.write(chalk.blueBright('live mutex > '));
      return;
    }
    
    if (acceptableCommands[lc]) {
      console.log('sending message to server:', String(d));
      s.write(JSON.stringify({inspectCommand: String(d)}) + '\n');
    }
    else {
      console.log('Command not recognized:', lc);
      console.log('Try using "help" to view available commands.');
      process.stdout.write(chalk.blueBright('live mutex > '));
    }
    
  });
  
  rl.on('close', () => {
    
    console.log('\n Hope you enjoyed your time here!');
    process.exit(0);
  });
  
});