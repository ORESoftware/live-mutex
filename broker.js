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


function addWsLockKey(broker, ws, key) {
    var temp;
    if (!( temp = broker.wsLock[ws.wsClientId])) {
        temp = broker.wsLock[ws.wsClientId] = [];
    }
    if (temp.indexOf(key) < 0) {
        temp.push(key);
    }

}

function removeWsLockKey(broker, ws, key) {
    var temp;
    if (temp = broker.wsLock[ws.wsClientId]) {
        const i = temp.indexOf(key);
        if (i >= 0) {
            temp.splice(i, 1);
            return true;
        }
    }
}


function Broker($opts) {

    const opts = this.opts = $opts || {};
    assert(typeof opts === 'object', ' => Bad arguments to live-mutex server constructor.');

    if ('lockExpiresAfter' in opts) {
        assert(Number.isInteger(opts.lockExpiresAfter),
            ' => "expiresAfter" option needs to be an integer (milliseconds)');
        assert(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000,
            ' => "expiresAfter" is not in range (20 to 4000000 ms).');
    }

    if ('timeoutToFindNewLockholder' in opts) {
        assert(Number.isInteger(opts.timeoutToFindNewLockholder),
            ' => "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
        assert(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000,
            ' => "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
    }

    if ('host' in opts) {
        assert(typeof opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if ('port' in opts) {
        assert(Number.isInteger(opts.port),
            ' => "port" option needs to be an integer => ' + opts.port);
        assert(opts.port > 1024 && opts.port < 49152,
            ' => "port" integer needs to be in range (1025-49151).');
    }

    this.lockExpiresAfter = weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
    this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || '6970';


    const send = this.send = function (ws, data, cb) {
        ws.send(JSON.stringify(data), err => {
            if (err) {
                console.error(err.stack || err);
                const key = data.key;
                if (key) {
                    const isOwnsKey = removeWsLockKey(this, ws, key);
                    if (isOwnsKey) {
                        this.unlock({
                            key: key,
                            force: true
                        }, ws);
                    }
                }

            }
        });
    };


    const wss = this.wss = new WebSocketServer({
        port: this.port,
        host: this.host
    });

    this.bookkeeping = {
        keys: {}
    };

    this.rejected = {};
    this.timeouts = {};
    this.locks = {};

    this.wsLock = {
        // keys are wsClientIds, values are lock keys
    };

    var wsIdCounter = 1;

    wss.on('connection', (ws) => {

        debug(' client is connected!');

        if (!ws.wsClientId) {
            ws.wsClientId = String(wsIdCounter++);
        }

        ws.on('close', () => {

            //TODO: unlock any locks that this ws owns

            console.log('CLOSED.');
            console.log('CLOSED.');
            console.log('CLOSED.');
            console.log('CLOSED.');
            console.log('CLOSED.');

            var keys;
            if (keys = this.wsLock[ws.wsClientId]) {
                keys.forEach(k => {
                    removeWsLockKey(this, ws, k);
                    var lck;
                    if (lck = this.locks[k]) {
                        this.unlock({
                            force: true,
                            key: k
                        }, ws);
                    }

                });
            }


        });

        ws.on('message', (msg) => {

            ijson.parse(msg).then((data) => {

                debug('\n', colors.blue(' => broker received this data => '), '\n', data, '\n');

                const key = data.key;

                if (data.type === 'unlock') {
                    debug(colors.blue(' => broker is attempting to run unlock...'));
                    this.unlock(data, ws);
                }
                else if (data.type === 'lock') {
                    debug(colors.blue(' => broker attempting to get lock...'));
                    this.lock(data, ws);
                }
                else if (data.type === 'lock-received') {
                    this.bookkeeping.keys[data.key].lockCount++;
                    clearTimeout(this.timeouts[data.key]);
                    delete this.timeouts[data.key];
                }
                else if (data.type === 'unlock-received') {
                    const key = data.key;
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                    this.bookkeeping.keys[key].unlockCount++;
                    debug('\n', ' => Lock/unlock count (broker), key => ', '"' + key + '"', '\n',
                        util.inspect(this.bookkeeping.keys[key]), '\n');
                }
                else if (data.type === 'lock-client-timeout') {

                    // if the client times out, we don't want to send them any more messages
                    const lck = this.locks[key];
                    const uuid = data.uuid;
                    if (!lck) {
                        console.error(' => Lock must have expired.');
                        return;
                    }

                    for (var i = 0; i < lck.notify.length; i++) {
                        if (lck.notify[i].uuid === uuid) {
                            console.log('\n\n', colors.blue(' => Removing item from notify array at index => '), i, '\n');
                            lck.notify.splice(i, 1);
                            break;
                        }
                    }

                }
                else if (data.type === 'lock-received-rejected') {
                    const lck = this.locks[key];
                    if (!lck) {
                        console.error(' => Lock must have expired.');
                        return;
                    }
                    this.rejected[data.uuid] = true;
                    this.ensureNewLockHolder(lck, data, function (err) {
                        console.log(' => new lock-holder ensured.');
                    });
                }
                else {
                    console.error(colors.red.bold(' bad data sent to broker.'));

                    this.send(ws,{
                        key: data.key,
                        uuid: data.uuid,
                        error: new Error(' => Bad data sent to web socket server =>').stack
                    });
                }

            },  (err) => {
                console.error(colors.red.bold(err.stack || err));

                this.send(ws,{
                    error: err.stack
                });
            });

        });

    });

}

Broker.prototype.ensureNewLockHolder = function _ensureNewLockHolder(lck, data, cb) {

    const locks = this.locks;
    const notifyList = lck.notify;

    // currently there is no lock-holder;
    // before we delete the lock object, let's try to find a new lock-holder
    lck.uuid = null;
    lck.pid = null;

    const key = data.key;

    debug('\n', colors.blue.bold(' => Notify list length => '), colors.blue(notifyList.length), '\n');

    clearTimeout(lck.to);
    delete lck.to;


    var obj;
    if (obj = notifyList.shift()) {

        debug(colors.cyan.bold(' => Sending ws client the acquired message.'));

        // set the timeout for the next ws to acquire lock, if not within alloted time, we simple call unlock

        var ws = obj.ws;

        addWsLockKey(this, ws, key);

        lck.uuid = obj.uuid;
        lck.pid = obj.pid;

        lck.to = setTimeout(() => {

            console.error(colors.red.bold(' => Warning, lock timed out for key => '), colors.red('"' + key + '"'));
            this.unlock({
                key: key,
                force: true
            });

        }, this.lockExpiresAfter);

        clearTimeout(this.timeouts[key]);
        delete this.timeouts[key];

        this.timeouts[key] = setTimeout(() => {

            removeWsLockKey(this, ws, key);

            delete this.timeouts[key];

            // if this timeout occurs, that is because the first item in the notify list did not receive the
            // acquire lock message, so we push the object back onto the notify list and send a retry message to all
            // if a client receives a retry message, they will all retry to acquire the lock on this key

            var _lck;
            var count;
            // if this timeout happens, then we can no longer cross-verify uuid's
            if (_lck = locks[key]) {
                _lck.uuid = undefined;
                _lck.pid = undefined;
                count = lck.notify.length;
            }
            else {
                count = 0;
            }

            if (!this.rejected[obj.uuid]) {
                notifyList.push(obj);
            }

            notifyList.forEach( (obj) => {
                this.send(obj.ws,{
                    key: data.key,
                    uuid: obj.uuid,
                    type: 'lock',
                    lockRequestCount: count,
                    retry: true
                });
            });

        }, this.timeoutToFindNewLockholder);

        var count = lck.notify.length;

        this.send(obj.ws, {
            key: data.key,
            uuid: obj.uuid,
            type: 'lock',
            lockRequestCount: count,
            acquired: true
        });
    }
    else {
        // => only delete lock if no client is remaining to claim it
        delete locks[key];
        debug(colors.red.bold(' => No other connections waiting for lock, so we deleted the lock.'));
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

        const count = lck.notify.length;

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

            this.send(ws,{
                key: key,
                uuid: uuid,
                lockRequestCount: count,
                type: 'lock',
                acquired: false
            });
        }
        else {

            lck.pid = pid;
            lck.uuid = uuid;


            addWsLockKey(this, ws, key);

            this.send(ws,{
                uuid: uuid,
                key: key,
                lockRequestCount: count,
                type: 'lock',
                acquired: true
            });
        }

    }
    else {

        const count = 1;

        addWsLockKey(this, ws, key);

        debug(' => Lock does not exist, creating new lock.');

        locks[key] = {
            pid: pid,
            uuid: uuid,
            notify: [],
            key: key,
            to: setTimeout(() => {
                console.error(colors.red.bold(' => Warning, lock timed out for key => '), colors.red('"' + key + '"'));
                this.unlock({
                    key: key,
                    force: true
                });
            }, this.lockExpiresAfter)
        };


        this.send(ws,{
            uuid: uuid,
            lockRequestCount: count,
            key: key,
            type: 'lock',
            acquired: true
        });
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
    debug('\n', ' => Raw counts in broker => key => ', key, util.inspect(this.bookkeeping.keys[key]), '\n');


    // if the user passed _uuid, then we check it, other true
    // _uuid is the uuid of the original lockholder call
    // the unlock caller can be given right to unlock only if it holds
    // the uuid from the original lock call, as a safeguard
    // this prevents a function from being called at the wrong time, or more than once, etc.

    var same = true;

    if (_uuid && lck && lck.uuid !== undefined) {
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

            this.send(ws,{
                uuid: uuid,
                key: key,
                type: 'unlock',
                unlocked: true
            });
        }

        Object.keys(this.wsLock).forEach((k) => {
            const keys = this.wsLock[k];
            if (keys) {
                const i = keys.indexOf[key];
                if (i >= 0) {
                    keys.splice(i, 1);
                }
            }
        });


        this.ensureNewLockHolder(lck, data, function () {
            debug(' => All done notifying.')
        });

    }
    else if (lck) {

        if (uuid && ws) {
            // if no uuid is defined, then unlock was called by something other than the client
            // aka this library called unlock when there was a timeout

            this.send(ws,{
                uuid: uuid,
                key: key,
                type: 'unlock',
                error: ' => You need to pass the correct uuid, or use force.',
                unlocked: false,
                retry: true
            });
        }

    }
    else {

        console.error(colors.red.bold(' => Usage / implementation error => this should not happen => no lock with key => '),
            colors.red('"' + key + '"'));

        // since the lock no longer exists for this key, remove ownership of this key
        //
        Object.keys(this.wsLock).forEach((k) => {
            const keys = this.wsLock[k];
            if (keys) {
                const i = keys.indexOf[key];
                if (i >= 0) {
                    keys.splice(i, 1);
                }
            }
        });

        if (ws) {
            this.send(ws,{
                uuid: uuid,
                key: key,
                type: 'unlock',
                unlocked: true,
                error: 'no lock with key = > ' + key
            });
        }
    }

};


module.exports = Broker;

