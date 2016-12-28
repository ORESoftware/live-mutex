/**
 * Created by oleg on 12/28/16.
 */


const path = require('path');
const async = require('async');

const lmUtils = require('live-mutex/utils');
const Client = require('live-mutex/client');

return lmUtils.conditionallyLaunchSocketServer({})
    .then(function (data) {

        const a = Array.apply(null, {length: 300});
        const start = Date.now();

        const client = new Client();

        async.eachSeries(a, function (val, cb) {

            client.lock('foo', function (err, unlock) {
                if (err) {
                    cb(err);
                }
                else {
                    unlock(cb);
                }
            });

        }, function complete(err) {

            if (err) {
                throw err;
            }

            console.log(' => Time required for live-mutex => ', Date.now() - start);
            process.exit(0);
        });


    });


