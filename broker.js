const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({port: 6970});

const ijson = require('siamese');
const async = require('async');
const colors = require('colors/safe');

// const lock = {
//     key: null,
//     pid: null,
//     dateAcquired: null
// };


const locks = {};


function ensureNewLockHolder(lck, data, cb) {

    const notifyList = lck.notify;
    var ws;
    if (ws = notifyList.shift()) {
        console.log(colors.cyan.bold(' => Sending ws the unlocked message.'));
        ws.send(JSON.stringify({
                key: data.key,
                uuid: data.uuid,
                unlocked: true,
                ready: true
            }),
            cb);
    }
    else {
        console.log(colors.red.bold(' => No other connections waiting for lock.'));
    }

}


function unlock(data, ws) {

    const key = data.key;
    const uuid = data.uuid;
    const lck = locks[key];
    delete locks[key];

    if (lck) {

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            unlocked: true
        }));

        ensureNewLockHolder(lck, data, function () {
            console.log(' => All done notifying.')
        });
    }
    else {
        console.error(colors.red.bold(' => no lock with key => '), key);
        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            error: 'no lock with key = > ' + key
        }));
    }

}

function lock(data, ws) {

    const key = data.key;
    const lck = locks[key];
    const uuid = data.uuid;

    if (lck) {

        console.log(' => Lock exists, adding ws to list of to be notified.');
        lck.notify.push(ws);
        ws.send(JSON.stringify({
            key: key,
            uuid: uuid,
            acquired: false
        }));

    }
    else {

        console.log(' => Lock does not exist, creating new lock.');

        locks[key] = {
            pid: data.pid,
            uuid: data.uuid,
            notify: [],
            key: key,
        };

        ws.send(JSON.stringify({
            uuid: uuid,
            key: key,
            acquired: true
        }));
    }

}


wss.on('connection', function connection(ws) {

    console.log(' client is connected!');

    ws.on('message', function (msg) {


        ijson.parse(msg).then(function (data) {

            // const pid = data.pid;
            // const uuid = data.uuid;

            console.log(' broked received this data => \n', data, '\n');

            if (data.unlock) {
                console.log('attempting to run unlocking...');
                unlock(data, ws);
            }
            else if (data.lock) {
                console.log('attempting to run locking...');
                lock(data, ws);
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


