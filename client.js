/**
 * Created by oleg on 12/23/16.
 */


const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:6970');
const ijson = require('siamese');
const uuidV4 = require('uuid/v4');
const colors = require('colors/safe');
const util = require('util');


ws.on('open', function open() {
    ws.isOpen = true;
});


exports.lock = function _lock(key, opts) {

    return new Promise(function (resolve, reject) {

        const uuid = uuidV4();

        ws.on('message', function onMessage(msg, flags) {
            // flags.binary will be set if a binary data is received.
            // flags.masked will be set if the data was masked.

            ijson.parse(msg).then(function (data) {

                console.log('\n', ' => onMessage in lock => \n', data, '\n');

                if (String(data.uuid) === String(uuid)) {

                    if (String(key) !== String(data.key)) {
                        ws.removeListener('message', onMessage);
                        return reject(new Error(' => Implementation error.'))
                    }

                    if (data.acquired === true) {
                        ws.removeListener('message', onMessage);
                        resolve(data);
                    }

                }
                else {
                    console.log(colors.yellow('uuid did not match (lock) , expected => ', uuid, 'actual => ', data.uuid));

                    if (String(key) === String(data.key)) {
                        if (data.acquired === true) {
                            ws.removeListener('message', onMessage);
                            resolve(data);
                        }
                    }
                }
            });

        });


        function send() {
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                lock: true
            }));
        }

        if (ws.isOpen) {
            send();
        }
        else {
            ws.on('open', send);
        }

    });

};


exports.unlock = function _unlock(key, opts) {

    return new Promise(function (resolve, reject) {

        const uuid = uuidV4();

        const to = setTimeout(function () {
            ws.removeListener('message', onMessage);
            reject(new Error(' => Unlocking timed out.'))
        }, 2000);

        ws.on('message', function onMessage(msg, flags) {

            // flags.binary will be set if a binary data is received.
            // flags.masked will be set if the data was masked.

            ijson.parse(msg).then(function (data) {

                console.log('\n', ' onMessage in unlock =>', data, '\n');

                if (String(data.uuid) === String(uuid)) {

                    if (String(key) !== String(data.key)) {
                        ws.removeListener('message', onMessage);
                        console.error(' bad key !!!');
                        return reject(new Error(' => Implementation error.'))
                    }

                    clearTimeout(to);
                    console.log('\n',' =====> unlock data ===> \n', colors.magenta(util.inspect(data)), '\n');

                    if (data.unlocked === true) {
                        ws.removeListener('message', onMessage);
                        resolve(data);
                    }
                }
                else {
                    console.log(colors.yellow('uuid did not match (unlock) , expected => ', uuid, 'actual => ', data.uuid));
                }
            });
        });


        function send() {
            ws.send(JSON.stringify({
                uuid: uuid,
                key: key,
                unlock: true
            }));
        }

        if (ws.isOpen) {
            send();
        }
        else {
            ws.on('open', send);
        }

    });

};

