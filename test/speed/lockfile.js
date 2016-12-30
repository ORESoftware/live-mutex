const path = require('path');
const async = require('async');
const lf = require('lockfile');


const a = Array.apply(null, {length: 100});
const file = path.resolve(process.env.HOME + '/speed-test.lock');

const start = Date.now();

async.each(a, function (val, cb) {

    lf.lock(file, {wait: 3000, retries: 5, stale: 50}, function (err) {
        if (err) {
            cb(err);
        }
        else {
            console.log('unlocking...');
            lf.unlock(file, cb);
        }
    });

}, function complete(err) {

    if (err) {
        throw err;
    }

    console.log(' => Time required for lockfile => ', Date.now() - start);
    process.exit(0);

});
