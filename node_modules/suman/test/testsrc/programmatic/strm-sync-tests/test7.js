/*
 * */

const suman = require('suman');
const stream = require('stream');

var tests = [];

const writable = new stream.Writable({

    write: function (chunk, encoding, cb) {

        console.log('data =>', String(chunk));

        tests.push(function (assert) {
            assert('a' === 'a');
            console.log('whoa');
        });

        cb();
    },

    end: function (data) {
        console.log('end was called with data=', data);
    }

});

writable.on('finish', function () {
    writable.finished = true;
});


const Test = suman.init(module, {
    export: true,
    interface: 'TDD',
    writable: writable
});


Test.suite('@Test1', {parallel: false, bail: true}, function (assert, fs, path, stream, extra) {


    tests.forEach(test=> {

        this.test('tests data', function () {

            test(assert);

        });

    });


});
