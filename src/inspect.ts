'use strict';

//core
import * as util from 'util';
import * as assert from 'assert';
import * as net from 'net';
import readline = require('readline');

//npm
import chalk from 'chalk';
import {createParser} from "./json-parser";

//project
export const log = {
  info: console.log.bind(console, ' [live-mutex client]'),
  error: console.error.bind(console, ' [live-mutex client]')
};

const port = parseInt(process.argv[2] || process.env.live_mutex_port || '6970');
const host = process.argv[3] || process.env.live_mutex_host || 'localhost';

const s = net.createConnection({port, host});
s.setEncoding('utf8');

s.once('error', function (e) {
  log.error(chalk.magentaBright('socket experienced an error:'), '\n', util.inspect(e, {breakLength: Infinity}));
});

s.pipe(createParser()).on('data', function (d: any) {
  console.log('server response:', String(d.inspectResult));
  process.stdout.write(prompt);
});

const acceptableCommands = <{
  [index:string]: boolean,
  'lockcount': true,
  'clientcount': true,
  'clear': true,
  'help': true
}>{
  'lockcount': true,
  'clientcount': true,
  'clear': true,
  'help': true
};


const prompt = chalk.blueBright(`(${host}:${port})`) + chalk.blueBright.bold(` lmx > `);

s.once('connect', function () {
  
  console.log(chalk.green('client is connected to live-mutex broker at port:'), chalk.greenBright.bold(String(port)));
  process.stdout.write(prompt);
  
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
  
  let resetCurrentLine = function () {
    readline.clearLine(process.stdout, 0);  // clear current text
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(prompt);
  };
  
  let currentLine = '', previousCmd = '';
  let commands : Array<string> = [];
  process.stdin.setRawMode(true);
  
  process.stdin.on('data', (buf) => {
    
    const str = String(buf);
    const charAsAscii = String(buf.toString().charCodeAt(0));
    
    // const charAsAscii = buf.readInt16LE();
    
    switch (charAsAscii) {
      
      case '9':
        
        let matches = Object.keys(acceptableCommands).filter(v => String(v).startsWith(currentLine));
        
        if (matches.length !== 1) {
          process.stdout.write('\n');
          console.log(matches);
          process.stdout.write(prompt + currentLine);
          return;
        }
        
        resetCurrentLine();
        currentLine = matches[0];
        process.stdout.write(currentLine);
        break;
      
      case '3':
        console.log('\nYou pressed Ctrl-C. Sending SIGINT.');
        process.kill(process.pid, 'SIGINT');
        break;
      
      case '4':
        console.log('\nYou pressed Ctrl-D. Bye!');
        process.exit(0);
        break;
      
      case '12':
        process.stdout.write('\x1Bc');
        process.stdout.write(prompt);
        break;
      
      case '13':
        process.stdout.write('\n');
        currentLine && commands.push(currentLine);
        process.stdin.emit('linex', currentLine || '');
        currentLine = '';
        break;
      
      case '27':
        // process.stdout.write('\n');
        // process.stdout.write(prompt);
        previousCmd = commands.pop();
        currentLine = previousCmd;
        resetCurrentLine();
        process.stdout.write(previousCmd);
        break;
      
      case '127':
        // process.stdout.write('\n');
        // process.stdout.write(prompt);
        resetCurrentLine();
        currentLine = '';
        
        // readline.cursorTo(process.stdout, 21);   // move cursor to beginning of line
        // process.stdout.write(previousCmd);
        break;
      
      default:
        // console.log('here is is the char:', charAsAscii);
        process.stdout.write(str);
        currentLine += str || '';
        break;
    }
  });
  
  process.stdin.on('linex', function (d) {
    
    readline.clearLine(process.stdout, 0);  // clear current text
    readline.cursorTo(process.stdout, 0);   // move cursor to beginning of line
    
    const lc = String(d || '').trim().toLowerCase();
    
    if (!lc) {
      process.stdout.write(prompt);
      return;
    }
    
    if (lc === 'clear') {
      process.stdout.write('\x1Bc');
      process.stdout.write(prompt);
      return;
    }
    
    if (lc === 'help') {
      console.log(chalk.bold('Available commands:'));
      console.log(Object.keys(acceptableCommands));
      process.stdout.write(prompt);
      return;
    }
    
    if (acceptableCommands[lc]) {
      console.log('sending message to server:', String(d));
      s.write(JSON.stringify({inspectCommand: String(d)}) + '\n');
    }
    else {
      console.log('Command not recognized:', lc);
      console.log('Try using "help" to view available commands.');
      process.stdout.write(prompt);
    }
    
  });
  
  process.stdin.on('close', () => {
    
    console.log('\n Hope you enjoyed your time here!');
    process.exit(0);
  });
  
});