import * as suman from 'suman';


function decoratorExpression(target) {
    // Add a property on target
    target.annotated = true;
}


const Test = suman.init(module, {});


const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');


import {Client, Broker, lmUtils}  from 'live-mutex';


Test.create(__filename, {}, function (assert, fs, path, inject) {

    const conf = Object.freeze({port: 7027});

    inject('yes', () => {
        return {
            broker: new Broker(conf).ensure()
        }
    });

    inject('yes', () => {
        return {
            c: new Client(conf).ensure()
        }
    });


    const f = require.resolve('../fixtures/corruptible.txt');

    this.before.cb('remove file', function (t) {
        fs.writeFile(f, '', t);
    });

    this.describe('inject', function(c){

        function lockWriteRelease(val, cb) {

            c.lock('a', function (err, unlock) {
                if (err) {
                    cb(err);
                }
                else {
                    fs.appendFile(f, '\n' + String(val), function (err) {
                        if (err) {
                            cb(err);
                        }
                        else {
                            unlock(cb);
                        }

                    });
                }
            });
        }

        this.before.cb('write like crazy', {timeout: 30000}, t => {

            const a = Array.apply(null, {length: 20}).map((item, index) => index);
            async.each(a, lockWriteRelease, t.done);

        });


        this.it.cb('ensure that file still has the same stuff in it!', {timeout: 30000}, t => {

            fs.readFile(f, function (err, data) {
                if (err) {
                    return t.fail(err);
                }

                const arr = String(data).split('\n').filter(function (line) {
                    return String(line).trim().length > 0;
                });

                arr.forEach(function (item, index) {
                    assert.equal(String(item), String(index), 'item and index are not equal');
                });

                t.done(null);

            });


        });

    });

});