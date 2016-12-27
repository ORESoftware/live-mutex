/**
 * Created by oleg on 12/24/16.
 */


const util = require('util');
const ping = require('tcp-ping');
const Broker = require('./broker');
const strangeloop = require('strangeloop');




//////////////////////////////////////////////////////////////////////////////////////////////////

exports.conditionalReturn = function (fn, cb) {

    if (typeof cb === 'function') {
        fn(function (err, val) {
            if (err) {
                console.error(err.stack);
            }
            if(arguments.length > 2){
                console.error(' => Warning => Argument(s) lost in translation => ', util.inspect(arguments));
            }
            cb(err, val);
        });
    }
    else {
        return new Promise(function (resolve, reject) {
            fn(function () {

                if(arguments.length > 2){
                    console.error(' => Warning => Argument(s) lost in translation => ', util.inspect(arguments));
                }
                const args = Array.from(arguments);
                const err = args.shift();

                if (err) {
                    reject(err);
                }
                else {
                    //TODO: need to provide data about whether the server is live in this process or another process
                    resolve.apply(null, args);
                }
            });
        });
    }

};



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

