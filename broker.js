'use strict';

//core
const assert = require('assert');
const util = require('util');

//npm
const WebSocketServer = require('ws').Server;
const ijson = require('siamese');
const async = require('async');
const colors = require('colors/safe');

//project
const debug = require('debug')('live-mutex');

///////////////////////////////////////////////////////////////////

const weAreDebugging = require('./lib/we-are-debugging');

///////////////////////////////////////////////////////////////////

function Broker(opts) {

    this.opts = opts || {};
    assert(typeof this.opts === 'object', ' => Bad arguments to live-mutex server constructor.');

    if (this.opts.lockExpiresAfter) {
        assert(Number.isInteger(this.opts.lockExpiresAfter),
            ' => "expiresAfter" option needs to be an integer (milliseconds)');
        assert(this.opts.lockExpiresAfter > 20 && this.opts.lockExpiresAfter < 4000000,
            ' => "expiresAfter" is not in range (20 to 4000000 ms).');
    }

    if (this.opts.timeoutToFindNewLockholder) {
        assert(Number.isInteger(this.opts.timeoutToFindNewLockholder),
            ' => "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
        assert(this.opts.timeoutToFindNewLockholder > 20 && this.opts.timeoutToFindNewLockholder < 4000000,
            ' => "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
    }

    if (this.opts.host) {
        assert(typeof this.opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if (this.opts.port) {
        assert(Number.isInteger(this.opts.port),
            ' => "port" option needs to be an integer => ' + this.opts.port);
        assert(this.opts.port > 1024 && this.opts.port < 49152,
            ' => "port" integer needs to be in range (1025-49151).');
    }

    this.lockExpiresAfter = weAreDebugging ? 5000000 : (this.opts.lockExpiresAfter || 25000);
    this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (this.opts.timeoutToFindNewLockholder || 4500);
    this.host = this.opts.host || '127.0.0.1';
    this.port = this.opts.port || '6970';


    const wss = this.wss = new WebSocketServer({
        port: this.port,
        host: this.host
    });

    this.bookkeeping = {
        keys: {}
    };
    this.timeouts = {};
    this.locks = {};

    const self = this;

    wss.on('connection', function connection(ws) {

        debug(' client is connected!');

        ws.on('message', function (msg) {

            ijson.parse(msg).then(function (data) {

                debug('\n', colors.blue(' => broker received this data => '), '\n', data, '\n');

                if (data.type === 'unlock') {
                    debug(colors.blue(' => broker is attempting to run unlock...'));
                    self.unlock(data, ws);
                }
                else if (data.type === 'lock') {
                    debug(colors.blue(' => broker attempting to get lock...'));
                    self.lock(data, ws);
                }
                else if (data.type === 'lock-received') {
                    self.bookkeeping.keys[data.key].lockCount++;
                    clearTimeout(self.timeouts[data.key]);
                    delete self.timeouts[data.key];
                }
                else if (data.type === 'unlock-received') {
                    const key = data.key;
                    clearTimeout(self.timeouts[key]);
                    delete self.timeouts[key];
                    self.bookkeeping.keys[key].unlockCount++;
                    debug('\n', ' => Lock/unlock count (broker), key => ', '"' + key + '"','\n',
                        util.inspect(self.bookkeeping.keys[key]), '\n');
                }
                else {
                    console.error(colors.red.bold(' bad data sent to broker.'));
                    ws.send(JSON.stringify({
                        key: data.key,
                        uuid: data.uuid,
                        error: new Error(' => Bad data sent to web socket server =>').stack
                    }));
                }

            }, function (err) {
                console.error(colors.red.bold(err.stack || err));
                ws.send(JSON.stringify({
                    error: err.stack
                }));
            });

        });

    });

}

Broker.prototype.ensureNewLockHolder = function _ensureNewLockHolder(lck, data, cb) {

    const locks = this.locks;
    const notifyList = lck.notify;

    //currently there is no lock-holder;
    // before we delete the lock object, let's try to find a new lock-holder
    lck.uuid = null;
    lck.pid = null;

    const key = data.key;

    debug('\n', colors.blue.bold(' => Notify list length => '), colors.blue(notifyList.length), '\n');

    var obj;
    if (obj = notifyList.shift()) {

        debug(colors.cyan.bold(' => Sending ws client the acquired message.'));

        // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock
        lck.to = setTimeout(() => {

            console.error(colors.red.bold(' => Warning, lock timed out for key => '), colors.red('"' + key + '"'));
            this.unlock({
                key: key
            });

        }, this.lockExpiresAfter);


        lck.uuid = obj.uuid;
        lck.pid = obj.pid;


        clearTimeout(this.timeouts[key]);
        delete this.timeouts[key];

        this.timeouts[key] = setTimeout(() => {

            delete this.timeouts[key];

            // if this timeout occurs, that is because the first item in the notify list did not receive the
            // acquire lock message, so we push the object back onto the notify list and send a retry message to all
            // if a client receives a retry message, they will all retry to acquire the lock on this key

            var _lck;
            // if this timeout happens, then we can no longer cross-verify uuid's
            if(_lck = locks[key]){
                _lck.uuid = undefined;
                _lck.pid = undefined;
            }

            notifyList.push(obj);
            notifyList.forEach(function (obj) {
                obj.ws.send(JSON.stringify({
                    key: data.key,
                    uuid: obj.uuid,
                    retry: true
                }));
            });

        }, this.timeoutToFindNewLockholder);


        obj.ws.send(
            JSON.stringify({
                key: data.key,
                uuid: obj.uuid,
                acquired: true,
                ready: true
            }),
            cb);
    }
    else {
        // => only delete lock if no client is remaining to claim it
        delete locks[key];
        debug(colors.red.bold(' => No other connections waiting for lock, so we deleted the lock.'));
        process.nextTick(cb);
    }

};

Broker.prototype.lock = function _lock(data, ws) {


    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;

    this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
            rawLockCount: 0,
            rawUnlockCount: 0,
            lockCount: 0,
            unlockCount: 0
        };

    this.bookkeeping.keys[key].rawLockCount++;

    if (lck) {

        if (lck.uuid) {
            debug(' => Lock exists, and already has a lockholder, adding ws to list of to be notified.');

            // if we retrying, we may attempt to call lock() more than once
            // we don't want to push the same ws object / same uuid combo to array
            const alreadyAdded = lck.notify.some(function (item) {
                return String(item.uuid) === String(uuid);
            });

            if (!alreadyAdded) {
                lck.notify.push({
                    ws: ws,
                    uuid: uuid,
                    pid: pid
                });
            }

            ws.send(JSON.stringify({
                key: key,
                uuid: uuid,
                acquired: false
            }));
        }
        else {

            lck.pid = pid;
            lck.uuid = uuid;

            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                acquired: true
            }));
        }

    }
    else {

        debug(' => Lock does not exist, creating new lock.');

        locks[key] = {
            pid: pid,
            uuid: uuid,
            notify: [],
            key: key,
            to: setTimeout(() => {
                console.error(colors.red.bold(' => Warning, lock timed out for key => '), colors.red('"' + key + '"'));
                this.unlock({
                    key: key
                });
            }, this.lockExpiresAfter)
        };

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            acquired: true
        }));
    }

};

Broker.prototype.unlock = function _unlock(data, ws) {

    const locks = this.locks;
    const key = data.key;
    const uuid = data.uuid;
    const _uuid = data._uuid;
    const force = data.force;
    const lck = locks[key];

    this.bookkeeping.keys[key] = this.bookkeeping.keys[key] || {
            rawLockCount: 0,
            rawUnlockCount: 0,
            lockCount: 0,
            unlockCount: 0
        };

    this.bookkeeping.keys[key].rawUnlockCount++;
    debug('\n',' => Raw counts in broker => key => ', key, util.inspect(this.bookkeeping.keys[key]),'\n');


    // if the user passed _uuid, then we check it, other true
    // _uuid is the uuid of the original lockholder call
    // the unlock caller can be given right to unlock only if it holds
    // the uuid from the original lock call, as a safeguard
    // this prevents a function from being called at the wrong time, or more than once, etc.

    var same = true;

    if (_uuid && lck !== undefined) {
        same = (String(lck.uuid) === String(_uuid));
        if (!same) {
            console.error('! => same is => ', same);
            console.error('! => lck.uuid is => ', lck.uuid);
            console.error('! => unlock._uuid is => ', _uuid);
        }
    }

    if (lck && (same || force)) {

        clearTimeout(lck.to);

        if (uuid && ws) {
            // if no uuid is defined, then unlock was called by something other than the client
            // aka this library called unlock when there was a timeout
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                unlocked: true
            }));
        }


        this.ensureNewLockHolder(lck, data, function () {
            debug(' => All done notifying.')
        });
    }
    else if (lck) {

        if (uuid && ws) {
            // if no uuid is defined, then unlock was called by something other than the client
            // aka this library called unlock when there was a timeout
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                error: ' => You need to pass the correct uuid, or use force.',
                unlocked: false,
                retry: true
            }));
        }

    }
    else {

        console.error(colors.red.bold(' => Usage / implementation error => this should not happen => no lock with key => '),
            colors.red('"' + key + '"'));

        if (ws) {
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                unlocked: true,
                error: 'no lock with key = > ' + key
            }));
        }
    }

};


module.exports = Broker;

