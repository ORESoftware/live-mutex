const path = require('path');
const async = require('async');
const lf = require('lockfile');


const a = Array.apply(null, {length: 300});
const file = path.resolve(process.env.HOME + '/speed-test.lock');

const start = Date.now();

async.eachSeries(a, function (val, cb) {

    lf.lock(file, function (err) {
        if (err) {
            cb(err);
        }
        else {
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
