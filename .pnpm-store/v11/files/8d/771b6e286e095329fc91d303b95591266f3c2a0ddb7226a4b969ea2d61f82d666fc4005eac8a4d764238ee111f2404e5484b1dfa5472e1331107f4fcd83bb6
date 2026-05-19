'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const Client = require("socket.io-client");
let client = null;
const _suman = global.__suman = (global.__suman || {});
exports.getClient = function () {
    if (!client) {
        let port = process.env.SUMAN_SOCKETIO_SERVER_PORT;
        try {
            if (window && !port) {
                console.log('window.__suman', util.inspect(window.__suman));
                port = Number(window.__suman.SUMAN_SOCKETIO_SERVER_PORT);
            }
        }
        catch (err) {
        }
        if (!port) {
            throw new Error('Suman implementation error, no port specified by "SUMAN_SOCKETIO_SERVER_PORT" env var.');
        }
        client = Client(`http://localhost:${port}`);
        client.on('connect', function () {
            _suman.log.warning('client connected.');
        });
        client.on('event', function (data) {
            _suman.log.info('event data => ', data);
        });
        client.on('disconnect', function () {
            _suman.log.error('client disconnected.');
        });
    }
    return client;
};
