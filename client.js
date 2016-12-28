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

//project
const debug = require('debug')('live-mutex');

/////////////////////////////////////////////////////////////////////////

const weAreDebugging = require('./lib/we-are-debugging');

/////////////////////////////////////////////////////////////////////////


process.on('warning', function(w){
   console.error('\n',' => Live-Mutex warning => ', w.stack || w,'\n');
});

const validOptions = [

    'host',
    'port',
    'unlockTimeout',
    'lockTimeout',
    'unlockRetryMax',
    'lockRetryMax'

];

function Client($opts) {

    const opts = this.opts = $opts || {};
    assert(typeof opts === 'object', ' => Bad arguments to live-mutex client constructor.');

    Object.keys(opts).forEach(function (key) {
        if (validOptions.indexOf(key) < 0) {
            throw new Error(' => Option passed to Live-Mutex#Client constructor is not a recognized option => "' + key + '"');
        }
    });

    if ('host' in opts) {
        assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if ('port' in opts) {
        assert(Number.isInteger(opts.port), ' => "port" option needs to be an integer.');
        assert(opts.port > 1024 && opts.port < 49152,
            ' => "port" integer needs to be in range (1025-49151).');
    }

    if ('unlockRetryMax' in opts) {
        assert(Number.isInteger(opts.unlockRetryMax),
            ' => "unlockRetryMax" option needs to be an integer.');
        assert(this.opts.unlockRetryMax >= 0 && opts.unlockRetryMax <= 100,
            ' => "unlockRetryMax" integer needs to be in range (0-100).');
    }

    if ('lockRetryMax' in opts) {
        assert(Number.isInteger(opts.lockRetryMax),
            ' => "lockRetryMax" option needs to be an integer.');
        assert(opts.lockRetryMax >= 0 && opts.lockRetryMax <= 100,
            ' => "lockRetryMax" integer needs to be in range (0-100).');
    }

    if ('unlockTimeout' in opts) {
        assert(Number.isInteger(opts.unlockTimeout),
            ' => "unlockTimeout" option needs to be an integer (representing milliseconds).');
        assert(opts.unlockTimeout >= 30 && opts.unlockTimeout <= 800000,
            ' => "unlockTimeout" needs to be integer between 20 and 800000 millis.');
    }

    if ('lockTimeout' in opts) {
        assert(Number.isInteger(opts.lockTimeout),
            ' => "unlockTimeout" option needs to be an integer (representing milliseconds).');
        assert(opts.lockTimeout >= 30 && opts.lockTimeout <= 800000,
            ' => "unlockTimeout" needs to be integer between 20 and 800000 millis.');
    }

    this.host = opts.host || 'localhost';
    this.port = opts.port || '6970';
    this.unlockTimeout = weAreDebugging ? 5000000 : (opts.unlockTimeout || 1000);
    this.lockTimeout = weAreDebugging ? 5000000 : (opts.lockTimeout || 6000);
    this.lockRetryMax = opts.lockRetryMax || 3;
    this.unlockRetryMax = opts.unlockRetryMax || 3;

    const ws = this.ws = new WebSocket(['ws://', this.host, ':', this.port].join(''));
    ws.setMaxListeners(350);

    this.bookkeeping = {
        keys: {}
    };

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
                console.error(colors.yellow(' => Live-Mutex internal issue => message did not contain uuid =>'), '\n', msg);
            }

        }, function (err) {
            console.error(colors.red.bold(' => Message could not be JSON.parsed => '), msg, '\n', err.stack || err);
        });

    });

    ws.on('error', err => {
        console.error('\n', ' => Websocket client error => ', err.stack || err, '\n');
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

    this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
            rawLockCount: 0,
            rawUnlockCount: 0,
            lockCount: 0,
            unlockCount: 0
        };

    this.bookkeeping.keys[key].rawLockCount++;


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

    if (opts._retryCount > this.lockRetryMax) {
        return cb(new Error(' => Maximum retries breached.'));
    }

    opts._retryCount = opts._retryCount || 0;

    const ws = this.ws;
    const uuid = opts._uuid || uuidV4();

    const to = setTimeout(() => {
        delete  this.resolutions[uuid];
        cb(new Error(' => Acquiring lock operation timed out. (Client-side timeout fired).'));
    }, this.lockTimeout);


    this.resolutions[uuid] = (err, data) => {

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
            clearTimeout(to);
            delete this.resolutions[uuid];
            this.bookkeeping.keys[key].lockCount++;

            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'lock-received'
            }));

            if (data.uuid !== uuid) {
                console.error(' => Something went very wrong.');
                cb(new Error(' => Something went wrong.'));
            }
            else {
                cb(null, this.unlock.bind(this, key, {_uuid: uuid}), data.uuid);
            }
        }
        else if (data.retry === true) {
            clearTimeout(to);
            ++opts._retryCount;
            opts._uuid = opts._uuid || uuid;
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

    this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
            rawLockCount: 0,
            rawUnlockCount: 0,
            lockCount: 0,
            unlockCount: 0
        };

    this.bookkeeping.keys[key].rawUnlockCount++;

    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    else if (typeof opts === 'boolean') {
        opts = {
            force: opts
        };
    }
    else if (typeof opts === 'string') {
        opts = {
            _uuid: opts
        };
    }

    opts = opts || {};
    opts._retryCount = opts._retryCount || 0;

    if (opts._retryCount > this.unlockRetryMax) {
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

            this.bookkeeping.keys[key].unlockCount++;

            debug('\n', ' => Lock unlock count (client), key => ', '"' + key + '"', '\n',
                util.inspect(this.bookkeeping.keys[key]), '\n');

            delete this.resolutions[uuid];

            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                pid: process.pid,
                type: 'unlock-received'
            }));

            cb(null, data.uuid);
        }
        else if (data.retry === true) {

            debug(' => Retrying the unlock call.');
            clearTimeout(to);
            return; //TODO
            ++opts._retryCount;
            opts._uuid = opts._uuid || uuid;
            this.unlock(key, opts, cb);
        }

    };


    function send() {
        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            _uuid: opts._uuid,
            // we only use force if we have to retry
            force: (opts._retryCount > 0) ? opts.force : false,
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
