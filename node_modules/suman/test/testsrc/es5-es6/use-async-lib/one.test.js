const suman = require('suman');
const Test = suman.init(module, {});
const async = require('async');

Test.describe.delay(__filename, {}, function (assert, resume) {

    console.log('assert => ', assert);

    this.before(t => {
        console.log('before');
    });

    // const suite = this;
    async.map([1, 2, 3, 4], function (item, cb) {

        process.nextTick(function () {
            cb(null, item * 3);
        })

    }, function (err, results) {

        console.log('results => ', results);
        resume(results);

    });

    this.describe('uses async library', function () {

        const vals = this.getResumeValue();
        console.log(' => vals => ', vals);

        console.log(' => ');

        this.it('fn', function () {


        });

    });


});
