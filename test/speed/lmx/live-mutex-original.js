'use strict';

const async = require('async');
const {Client} = require('live-mutex');
const conf = Object.freeze({port: 6970});

process.on('unhandledRejection', function (e) {
    console.error('unhandled rejection => ', e.stack || e);
});

///////////////////////////////////////////////////////////////////

const client = new Client(conf);

client.ensure().then(function () {

    const a = Array.apply(null, {length: 10000});
    const start = Date.now();

    let count = 0;
    let lockholders = 0;
    let max = 1;

    async.eachLimit(a, 300, function (val, cb) {

        client.lock('foo', {max}, function (err, unlock) {

            if (err) {
                return cb(err);
            }

            lockholders++;

            if (lockholders > max) {
                return cb(new Error('Should never have more than 1 lockholder.'));
            }

            lockholders--;

            // console.log('unlocking...' + count++);
            unlock(cb);

        });

    }, function complete(err) {

        if (err) {
            throw err;
        }

        const diff = Date.now() - start;
        console.log(' => Time required for live-mutex => ', diff);
        console.log(' => Lock/unlock cycles per millisecond => ', Number(a.length / diff).toFixed(3));
        process.exit(0);
    });

});






