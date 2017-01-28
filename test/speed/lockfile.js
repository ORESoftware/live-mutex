const path = require('path');
const async = require('async');
const lf = require('lockfile');


const a = Array.apply(null, {length: 1000});
const file = path.resolve(process.env.HOME + '/speed-test.lock');

const start = Date.now();

let i = 0;

async.each(a, function (val, cb) {

    const w = Math.ceil(Math.random() * 3);

    lf.lock(file, {wait: w, retries: 5000, stale: 500}, function (err) {
        if (err) {
            cb(err);
        }
        else {
            console.log('unlocking...' + i++);
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
