'use strict';

//core
const util = require('util');

//npm
const ping = require('tcp-ping');
const strangeloop = require('strangeloop');

//project
const Broker = require('./broker');

//////////////////////////////////////////////////////////////////////////////////////////////////

exports.conditionallyLaunchSocketServer = function (obj, cb) {

    if (typeof obj === 'function') {
        cb = obj;
        obj = {};
    }

    obj = obj || {};

    const host = obj.host || 'localhost';
    const port = obj.port || 6970;

    function fn(cb) {
        ping.probe(host, port, function (err, available) {

            if (err) {
                cb(err)
            }
            else if (available) {
                cb(null);
            }
            else {

                new Broker({
                    host: host,
                    port: port
                })
                .ensure(cb);
            }

        });
    }

    return strangeloop.conditionalReturn(fn, cb);
};

