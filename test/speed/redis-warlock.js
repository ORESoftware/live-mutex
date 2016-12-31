

// note redis must be running locally for this test to work
const path = require('path');
const async = require('async');
const Warlock = require('node-redis-warlock');
const redis = require('redis');

// Establish a redis client and pass it to warlock
const client = redis.createClient();
const warlock = Warlock(client);

// Set a lock
const key = 'test-lock';
const ttl = 200; // Lifetime of the lock


function firstEnsureKeyIsUnlocked() {

    return new Promise(function (resolve, reject) {
        warlock.unlock('foo', true, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        })
    });

}


firstEnsureKeyIsUnlocked()
    .then(function () {

        console.log('start');

        const a = Array.apply(null, {length: 100});
        const start = Date.now();

        var i = 0;

        async.eachSeries(a, function (val, cb) {

            warlock.lock('foo', ttl, function (err, unlock) {
                if (err) {
                    cb(err);
                }
                else {

                    if (typeof unlock === 'function') {
                        console.log('unlocking...' + i++);
                        unlock(cb);
                    }
                    else {
                        console.error('error => Could not acquire lock.');
                        process.nextTick(cb);
                    }
                }
            });

        }, function complete(err) {

            if (err) {
                throw err;
            }

            console.log(' => Time required for warlock => ', Date.now() - start);
            process.exit(0);
        });


    });


