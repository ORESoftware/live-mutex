// note redis must be running locally for this test to work
const path = require('path');
const async = require('async');
const Warlock = require('node-redis-warlock');
const redis = require('redis');

// Establish a redis client and pass it to warlock
const client = redis.createClient();
const warlock = Warlock(client);


function firstEnsureKeyIsUnlocked(key, cb) {
    warlock.unlock(key, true, cb);
}

// Set a lock
const key = 'test-lock';

firstEnsureKeyIsUnlocked(key, function (err) {

    if(err){
        throw err;
    }

    const a = Array.apply(null, {length: 100});
    const start = Date.now();

    let i = 0;


    const ttl = 3; // Lifetime of the lock
    const maxAttempts = 40; // Max number of times to try setting the lock before erroring
    const wait = 1000; // Time to wait before another attempt if lock already in place

    async.each(a, function (val, cb) {

        warlock.optimistic(key, ttl, maxAttempts, wait, function (err, unlock) {
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


