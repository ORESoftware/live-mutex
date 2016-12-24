

const suman = require('suman');

const Test = suman.init(module, {
    export: false,
    interface: 'TDD'
});


Test.suite('@Test1', {parallel: false, bail: true}, function (assert, fs, path, stream, suite, extraArgs) {


    const expected = extraArgs[0].expected;
    const strm = extraArgs[0].strm;

    // strm.on('finish', function () {
    //     delay();
    // });

    
    strm.on('data', d => {

        this.test('test', function () {
            assert('a' === 'a');
        });

    });

    strm.on('end', function () {
        suite.resume();
    });

    strm.resume();

    

});
