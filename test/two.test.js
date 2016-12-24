const suman = require('suman');
const Test = suman.init(module, {});


const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');

const Client = require('../client');
const Broker = require('../broker');
const broker = new Broker({port: 7002});
const client = new Client({port: 7002});

const Promise = require('bluebird');


Test.create(__filename, {}, function (assert, describe) {

    const arrays = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 1, 2, 111, 2, 2, 21, 1, 11, 1, 111, 1, 111, 1, 2, 2, 2, 2, 1, 2, 21, 11, 11111, 111, 1, 11, 1, 1, 1, 1, 1, 1, 1],
        ['a', 'a', 'a1', 'a2', 'a2', 'a2', 'a1', 'a2'],
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    ];

    const l = _.flattenDeep(arrays).length;
    console.log(' => length => ', l);

    arrays.forEach(a => {

        describe.delay('resumes', function (resume, describe) {

            async.map(a, function (val, cb) {

                process.nextTick(function () {
                    cb(null, t => {
                        return client.lock(String(val)).then(function () {
                            return Promise.delay(100);
                        }).then(function () {
                            return client.unlock(String(val));
                        });
                    });
                });


            }, function (err, results) {
                if (err) {
                    throw err;
                }

                resume(results);
            });


            describe('handles results', {parallel: true}, function () {

                const fns = this.getResumeValue();

                fns.forEach(fn => {

                    this.it('locks/unlocks', fn);

                });


            });

        });


    });


});