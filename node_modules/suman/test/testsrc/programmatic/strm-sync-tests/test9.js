/*
 * */

//http://blog.yld.io/2016/01/13/using-streams/#.VwyjZZMrKXk

const suman = require('suman');
const Test = suman.init(module, {
    export: true,
    interface: 'TDD',
    writable: suman.Transform()
});


Test.suite('@Test1', {parallel: false, bail: true}, function (assert, fs, path, stream, extra, writable) {


    const strm = new stream.Writable({

        write: (chunk, encoding, cb)=> {
            console.log('whoooa:', String(chunk));

            this.test('yolo', function () {

                assert(true === true);

            });

            cb();
        }
    });

    writable.pipe(strm);

    // writable.uncork();

    // strm.on('finish', delay);
    // strm.on('end', delay);

});
