'use strict';
var WebSocket = require('uws');
var WebSocketServer = WebSocket.Server;
var host = 'localhost';
var port = '7802';
var wss = this.wss = new WebSocketServer({
    port: port,
    host: host
}, function (err) {
    console.log('wss callback fired.');
    err && console.error(err);
});
setTimeout(function () {
    var ws = this.ws = new WebSocket(['ws://', host, ':', port].join(''));
    ws.on('error', function (err) {
        console.error('\n', ' => Websocket client error => ', err.stack || err, '\n');
    });
    ws.on('open', function () {
        ws.isOpen = true;
        console.log('ws client is open.');
    });
    setTimeout(function () {
        process.exit(0);
    }, 1000);
}, 2000);
