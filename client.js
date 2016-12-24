'use strict';

//core
const assert = require('assert');
const util = require('util');

//npm
const WebSocket = require('ws');
const ijson = require('siamese');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');
const strangeloop = require('strangeloop');
const debug = require('debug')('live-mutex');

/////////////////////////////////////////////////////////////////////////


function Client(opts) {

    this.opts = opts || {};
    assert(typeof this.opts === 'object', ' => Bad arguments to live-mutex client constructor.');

    if (this.opts.host) {
        assert(typeof this.opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if (this.opts.port) {
        assert(Number.isInteger(this.opts.port), ' => "port" option needs to be an integer.');
        assert(this.opts.port < 64000, ' => "port" integer needs to be in range.');
    }

    this.host = this.opts.host || 'localhost';
    this.port = this.opts.port || '6970';

    const ws = this.ws = new WebSocket(['ws://', this.host, ':', this.port].join(''));

    ws.setMaxListeners(100);

    ws.on('open', () => {
        ws.isOpen = true;
    });

    ws.on('close', () => {
        ws.isOpen = false;
    });

}

Client.prototype.lock = function _lock(key, opts, cb) {

    assert(typeof key,'string',' => Key passed to live-mutex#lock needs to be a string.');

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }

    opts = opts || {};


    const fn = (cb) => {

        const ws = this.ws;

        const uuid = uuidV4();

        ws.on('message', function onMessage(msg, flags) {
            // flags.binary will be set if a binary data is received.
            // flags.masked will be set if the data was masked.

            ijson.parse(msg).then(function (data) {

                debug('\n', ' => onMessage in lock => ', '\n', colors.blue(util.inspect(data)), '\n');

                if (String(data.uuid) === String(uuid)) {

                    if (String(key) !== String(data.key)) {
                        ws.removeListener('message', onMessage);
                        console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
                        return cb(new Error(' => Implementation error.'))
                    }

                    if (data.acquired === true) {
                        ws.removeListener('message', onMessage);
                        cb(null, data);
                    }
                    else if (data.acquired === false) {
                        debug(colors.magenta(' => Lock could not be immediately acquired for uuid => '), uuid);
                    }

                }
                else {
                    debug(colors.yellow('uuid did not match (lock) , expected => ', colors.gray(uuid), 'actual => ',
                        colors.gray(data.uuid)));
                }

            }, cb);

        });


        function send() {
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                type: 'lock'
            }));
        }

        if (ws.isOpen) {
            send();
        }
        else {
            ws.once('open', send);
        }


    };


    return strangeloop.conditionalReturn(fn, cb);


};


Client.prototype.unlock = function _unlock(key, opts, cb) {

    assert(typeof key,'string',' => Key passed to live-mutex#unlock needs to be a string.');

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }

    opts = opts || {};

   const fn = (cb) => {

        const uuid = uuidV4();
        const ws = this.ws;

        const to = setTimeout(function () {
            ws.removeListener('message', onMessage);
            cb(new Error(' => Unlocking timed out.'))
        }, 2000);

        function onMessage(msg, flags) {

            // flags.binary will be set if a binary data is received.
            // flags.masked will be set if the data was masked.

            ijson.parse(msg).then(function (data) {

                debug('\n', ' onMessage in unlock =>', '\n', colors.blue(util.inspect(data)), '\n');

                if (String(data.uuid) === String(uuid)) {

                    if (String(key) !== String(data.key)) {
                        ws.removeListener('message', onMessage);
                        console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
                        return cb(new Error(' => Implementation error.'))
                    }

                    clearTimeout(to);

                    if (data.unlocked === true) {
                        ws.removeListener('message', onMessage);
                        cb(null, data);
                    }
                }
                else {
                    debug(colors.yellow('uuid did not match (unlock) , expected => ', uuid, 'actual => ', data.uuid));
                }

            }, cb);
        }

        ws.on('message', onMessage);


        function send() {
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                type: 'unlock'
            }));
        }

        if (ws.isOpen) {
            send();
        }
        else {
            ws.once('open', send);
        }

    };

    return strangeloop.conditionalReturn(fn,cb);

};


module.exports = Client;
