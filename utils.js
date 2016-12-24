/**
 * Created by oleg on 12/24/16.
 */


const util = require('util');
const ping = require('tcp-ping');
const Broker = require('./broker');
const strangeloop = require('strangeloop');


exports.conditionallyLaunchSocketServer = function (obj, cb) {

    const host = obj.host || 'localhost';
    const port = obj.host || 'port';


    function fn(cb) {
        ping.probe('localhost', 6970, function (err, available) {

            if (err) {
                return cb(err)
            }
            else if (available) {
                return cb(null);
            }
            else {
                new Broker(obj);
                return process.nextTick(cb);
            }

        });
    }


    return strangeloop.conditionalReturn(fn, cb);
};

