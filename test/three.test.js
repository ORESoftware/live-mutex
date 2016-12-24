const suman = require('suman');
const Test = suman.init(module, {});


const colors = require('colors/safe');
const async = require('async');
const _ = require('lodash');

const Client = require('../client');
const Broker = require('../broker');
const broker = new Broker({port: 7004});
const client = new Client({port: 7004});



Test.create(__filename, {}, function (assert, fs, path) {

    const f = require.resolve('./fixtures/corruptible.txt');

    this.before.cb('remove file', function(t){
         fs.unlink(f, t);
    });

    function lockWriteRelease(val, cb) {

        client.lock('a').then(function () {
            setTimeout(function(){
                fs.appendFile(f, '\n' + String(val), function (err) {
                    client.unlock('a').then(function () {
                        cb(err);
                    }, cb);
                });
            },20);
        });
    }

    this.before.cb('write like crazy', {timeout: 30000},t => {

        const a = Array.apply(null, {length: 20}).map((item,index) => index);

        var delay = 10;

        async.each(a, function(val,cb){

            setTimeout(function(){
                lockWriteRelease(val,cb);
            }, delay+=5);

        }, t.done);

    });


    this.it.cb('ensure that file still has the same stuff in it!', {timeout: 30000},t => {

        fs.readFile(f, function (err, data) {
            if (err) {
                return t.fail(err);
            }

            const arr = String(data).split('\n').filter(function(line){
                 return String(line).trim().length > 0;
            });

            arr.forEach(function (item, index) {
                assert.equal(String(item),String(index), 'item and index are not equal');
            });

            t.done(null);

        });


    });


});