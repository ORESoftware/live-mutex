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

    if (this.opts.host in opts) {
        assert(typeof this.opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if (this.opts.port in opts) {
        assert(Number.isInteger(this.opts.port), ' => "port" option needs to be an integer.');
        assert(this.opts.port < 64000, ' => "port" integer needs to be in range.');
    }

    if (this.opts.unlockTimeout in opts) {
        assert(Number.isInteger(this.opts.unlockTimeout), ' => "unlockTimeout" option needs to be an integer (representing milliseconds).');
        assert(this.opts.unlockTimeout >= 20 && this.opts.unlockTimeout <= 800000, ' => "unlockTimeout" needs to be integer between 20 and 800000 millis.');
    }

    if (this.opts.lockTimeout in opts) {
        assert(Number.isInteger(this.opts.lockTimeout), ' => "unlockTimeout" option needs to be an integer (representing milliseconds).');
        assert(this.opts.lockTimeout >= 30 && this.opts.lockTimeout <= 800000, ' => "unlockTimeout" needs to be integer between 20 and 800000 millis.');
    }

    this.host = this.opts.host || 'localhost';
    this.port = this.opts.port || '6970';
    this.unlockTimeout = this.opts.unlockTimeout || 1000;
    this.lockTimeout = this.opts.lockTimeout || 15000;

    const ws = this.ws = new WebSocket(['ws://', this.host, ':', this.port].join(''));
    ws.setMaxListeners(50);

    this.resolutions = {};

    ws.on('message', (msg, flags) => {

        // flags.binary will be set if a binary data is received.
        // flags.masked will be set if the data was masked.

        ijson.parse(msg).then(data => {

            debug('\n', ' => onMessage in lock => ', '\n', colors.blue(util.inspect(data)), '\n');

            const uuid = data.uuid;
            if (uuid) {
                const fn = this.resolutions[uuid];

                if (fn) {
                    fn.apply(this, [null, data]);
                }
                else {
                    throw new Error(' => No fn with that uuid in the resolutions hash => \n' + util.inspect(data));
                }
            }
            else {
                console.error(colors.yellow(' => message did not contain uuid =>'), msg);
            }

        }, function (err) {
            console.error(' => Message could not be JSON.parsed => ', msg, '\n', err.stack || err);
        });

    });

    ws.on('error', err => {
        console.error('\n', err.stack || err, '\n');
    });

    ws.on('open', () => {
        ws.isOpen = true;
    });

    ws.on('close', () => {
        ws.isOpen = false;
    });

}

Client.prototype.lock = function _lock(key, opts, cb) {

    assert(typeof key, 'string', ' => Key passed to live-mutex#lock needs to be a string.');

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    else if (typeof opts === 'boolean') {
        opts = {
            force: opts
        };
    }

    opts = opts || {};
    opts._retryCount = opts._retryCount || 0;

    const ws = this.ws;
    const uuid = opts._uuid || uuidV4();

    const to = setTimeout(() => {
        delete  this.resolutions[uuid];
        cb(new Error(' => Acquiring lock timed out.'));
    }, this.lockTimeout);


    this.resolutions[uuid] = (err, data) => {

        // => always clear timeout
        clearTimeout(to);

        if (String(key) !== String(data.key)) {
            delete this.resolutions[uuid];
            console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
            return cb(new Error(' => Implementation error.'))
        }

        if (data.error) {
            console.error('\n', colors.bgRed(data.error), '\n');
        }

        if ([data.acquired, data.retry].filter(i => i).length > 1) {
            throw new Error(' => Live-Mutex implementation error.');
        }

        if (data.acquired === true) {

            delete this.resolutions[uuid];

            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'lock-received'
            }));

            cb(null, this.unlock.bind(this, key, {_uuid: uuid}), data.uuid);
        }
        else if (data.retry === true) {
            ++opts._retryCount;
            opts._uuid = uuid;
            this.lock(key, opts, cb);
        }

    };


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


Client.prototype.unlock = function _unlock(key, opts, cb) {

    assert(typeof key, 'string', ' => Key passed to live-mutex#unlock needs to be a string.');

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    else if (typeof opts === 'boolean') {
        opts = {
            force: opts
        };
    }

    opts = opts || {};
    opts._retryCount = opts._retryCount || 0;

    if (opts._retryCount > 3) {
        return cb(new Error(' => Maximum retries breached.'));
    }

    const uuid = uuidV4();
    const ws = this.ws;

    const to = setTimeout(() => {

        delete this.resolutions[uuid];
        cb(new Error(' => Unlocking timed out.'));

    }, this.unlockTimeout);


    this.resolutions[uuid] = (err, data) => {

        debug('\n', ' onMessage in unlock =>', '\n', colors.blue(util.inspect(data)), '\n');

        clearTimeout(to);

        if (String(key) !== String(data.key)) {
            console.error(colors.bgRed(new Error(' !!! bad key !!!').stack));
            return cb(new Error(' => Implementation error.'))
        }

        if ([data.unlocked].filter(i => i).length > 1) {
            throw new Error(' => Live-Mutex implementation error.');
        }

        if (data.error) {
            console.error('\n', colors.bgRed(data.error), '\n');
        }

        if (data.unlocked === true) {

            delete this.resolutions[uuid];

            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'unlock-received'
            }));

            cb(null, data.uuid);
        }

    };


    function send() {
        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            _uuid: opts._uuid,
            force: opts.force,
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


module.exports = Client;
