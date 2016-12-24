/**
 * Created by denmanm1 on 4/9/16.
 */



const fs = require('fs');
const Stream = require('stream');
const assert = require('assert');

module.exports = function (expected) {

    var index = 0;

    const writable = new Stream.Writable({

        write: function (chunk, encoding, cb) {

            var data = chunk.toString();
            if (this._lastLineData) {
                data = this._lastLineData + data;
            }

            var lines = data.split('\n');
            this._lastLineData = lines.splice(lines.length - 1, 1)[0];

            lines.forEach(line => {
                console.log('line:', line);
                const val = expected[index++];
                console.log('expected:',val);
                assert.equal(line, val);
            });

            cb();
        },

        end: function (data) {
            console.log('end was called with data=', data);
        }

    });

    writable.on('finish', function () {
        console.log('finished');
    });

    writable.on('end', function () {
        console.log('end');
    });


    return writable;


};