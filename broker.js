'use strict';

//core
const assert = require('assert');
const util = require('util');

//npm
const WebSocketServer = require('ws').Server;
const ijson = require('siamese');
const async = require('async');
const colors = require('colors/safe');
const debug = require('debug')('live-mutex');

//project


///////////////////////////////////////////////////////////////////

function Server(opts) {

    this.opts = opts || {};
    assert(typeof this.opts === 'object', ' => Bad arguments to live-mutex server constructor.');

    if (this.opts.expiresAfter) {
        assert(Number.isInteger(this.opts.expiresAfter), ' => "expiresAfter" option needs to be an integer (milliseconds)');
        assert(this.opts.expiresAfter > 20, ' => "expiresAfter" should be an integer greater than 20 milliseconds.');
    }

    if (this.opts.host) {
        assert(typeof this.opts.host === 'string', ' => "host" option needs to be a string.');
    }

    if (this.opts.port) {
        assert(Number.isInteger(this.opts.port), ' => "port" option needs to be an integer => ' + this.opts.port);
        assert(this.opts.port < 64000, ' => "port" integer needs to be in range.');
    }

    this.expiresAfter = this.opts.expiresAfter || 5000;
    this.host = this.opts.host || 'localhost';
    this.port = this.opts.port || '6970';


    const wss = this.wss = new WebSocketServer({
        port: this.port
    });

    const locks = this.locks = {
        /*

         key: { key: key, pid: pid, notify: []}

         */
    };

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

Server.prototype.ensureNewLockHolder = function _ensureNewLockHolder(lck, data, cb) {

    const locks = this.locks;
    const notifyList = lck.notify;

    const key = data.key;

    debug('\n', colors.blue.bold(' => Notify list length => '), colors.blue(notifyList.length), '\n');

    var obj;
    if (obj = notifyList.shift()) {

        debug(colors.cyan.bold(' => Sending ws client the acquired message.'));

        lck.to = setTimeout(() => {
            console.error(colors.red.bold(' => Warning, lock timed out for key => '), colors.red('"' + key + '"'));
            this.unlock({
                key: key
            });
        }, this.expiresAfter);

        obj.ws.send(JSON.stringify({
                key: data.key,
                uuid: obj.uuid,
                acquired: true,
                ready: true
            }),
            cb);
    }
    else {
        //only delete lock if no client is remaining to claim it
        delete locks[key];
        debug(colors.red.bold(' => No other connections waiting for lock, so we deleted the lock.'));
    }

};


Server.prototype.unlock = function _unlock(data, ws) {

    const locks = this.locks;
    const key = data.key;
    const uuid = data.uuid;
    const lck = locks[key];

    if (lck) {

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
    else {

        console.error(colors.red.bold(' => Usage error => this should not happen => no lock with key => '),
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

Server.prototype.lock = function _lock(data, ws) {

    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;

    if (lck) {

        debug(' => Lock exists, adding ws to list of to be notified.');

        lck.notify.push({
            ws: ws,
            uuid: uuid
        });

        // ws.send(JSON.stringify({
        //     key: key,
        //     uuid: uuid,
        //     acquired: false
        // }));

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
            }, this.expiresAfter)
        };

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            acquired: true
        }));
    }

};


module.exports = Server;

