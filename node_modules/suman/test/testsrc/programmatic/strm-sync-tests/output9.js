// const suman = require('suman');
//
//
// var Test = suman.init(module, {
//     interface: 'TDD'
// });


const fs = require('fs');
const stream = require('stream');


var index = 0;
var dataSource = ['1', '2', '3'];


var timeout = 1500;

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

// readable.pause();

var test = require('./test9');

readable.pipe(test);



