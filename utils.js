/**
 * Created by oleg on 12/24/16.
 */


const util = require('util');
const ping = require('tcp-ping');
const Broker = require('./broker');
const strangeloop = require('strangeloop');


exports.conditionallyLaunchSocketServer = function (obj, cb) {

    if(typeof obj === 'function'){
        cb = obj;
        obj = {};
    }

    obj = obj || {};

    const host = obj.host || 'localhost';
    const port = obj.port || 6970;


    function fn(cb) {
        ping.probe(host, port, function (err, available) {

            if (err) {
                return cb(err)
            }
            else if (available) {
                return cb(null);
            }
            else {
                process.nextTick(cb);
                new Broker({
                    host:host,
                    port:port
                });
            }

        });
    }


    return strangeloop.conditionalReturn(fn, cb);
};

