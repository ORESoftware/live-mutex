'use strict';

const WebSocket = require('uws');
const WebSocketServer = WebSocket.Server;

const host = 'localhost';
const port = '7802';

const wss = this.wss = new WebSocketServer({
    port,
    host
  },
  (err) => {
    console.log('wss callback fired.');
    err && console.error(err);
  });


setTimeout(function(){

  const ws = this.ws = new WebSocket(['ws://', host, ':', port].join(''));

  ws.on('error', err => {
    console.error('\n', ' => Websocket client error => ', err.stack || err, '\n');
  });


  ws.on('open', () => {
    ws.isOpen = true;
     console.log('ws client is open.');
  });


}, 2000);