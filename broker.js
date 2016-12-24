'use strict';

//core
const util = require('util');

//npm
const WebSocketServer = require('ws').Server;
const ijson = require('siamese');
const async = require('async');
const colors = require('colors/safe');

//project


///////////////////////////////////////////////////////////////////

function Server(){

    const wss = this.wss = new WebSocketServer({port: 6970});
    const locks = this.locks  = {
        /*

         key: { key: key, pid: pid, notify: []}

         */
    };

    const self = this;

    wss.on('connection', function connection(ws) {

        console.log(' client is connected!');

        ws.on('message', function (msg) {

            ijson.parse(msg).then(function (data) {

                console.log('\n', colors.blue(' => broker received this data => '), '\n', data, '\n');

                if (data.type === 'unlock') {
                    console.log(colors.blue(' => broker is attempting to run unlock...'));
                    self.unlock(data, ws);
                }
                else if (data.type === 'lock') {
                    console.log(colors.blue(' => broker attempting to get lock...'));
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

    var obj;
    if (obj = notifyList.shift()) {
        console.log(colors.cyan.bold(' => Sending ws client the acquired message.'));
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
        delete locks[data.key];
        console.log(colors.red.bold(' => No other connections waiting for lock, so we deleted the lock.'));
    }

};


Server.prototype.unlock = function _unlock(data, ws) {

    const locks = this.locks;
    const key = data.key;
    const uuid = data.uuid;
    const lck = locks[key];

    if (lck) {

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            unlocked: true
        }));

        this.ensureNewLockHolder(lck, data, function () {
            console.log(' => All done notifying.')
        });
    }
    else {

        console.error(colors.red.bold(' => no lock with key => '), key);
        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            unlocked: true,
            error: 'no lock with key = > ' + key
        }));

    }

};

Server.prototype.lock = function _lock(data, ws) {

    const locks = this.locks;
    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;
    const pid = data.pid;

    if (lck) {

        console.log(' => Lock exists, adding ws to list of to be notified.');

        lck.notify.push({
            ws: ws,
            uuid: uuid
        });

        ws.send(JSON.stringify({
            key: key,
            uuid: uuid,
            acquired: false
        }));

    }
    else {

        console.log(' => Lock does not exist, creating new lock.');

        locks[key] = {
            pid: pid,
            uuid: uuid,
            notify: [],
            key: key,
        };

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            acquired: true
        }));
    }

};


module.exports = Server;

