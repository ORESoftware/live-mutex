// const suman = require('suman');
//
//
// var Test = suman.init(module, {
//     interface: 'TDD'
// });


const fs = require('fs');
const stream = require('stream');


const writable = new stream.Writable({

    write: function (chunk, encoding, cb) {

        console.log('data =>', String(chunk));
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


var index = 0;
var dataSource = ['1', '2', '3'];

var readable = new stream.Readable({

    read: function (size) {
        var data;
        if (data = dataSource[index++]) {
            this.push(data);
        }
        else {
            this.push(null);
        }
    }

});

readable.setEncoding('utf8');

readable.on('data', (chunk) => {
    console.log('got %d bytes of data', chunk.length, String(chunk));
});

readable.pause();

require('./test6').on('test',function(test){
    test({
        strm: readable,
        expected: ['1', '2', '3']
    });
});

readable.pipe(writable);



