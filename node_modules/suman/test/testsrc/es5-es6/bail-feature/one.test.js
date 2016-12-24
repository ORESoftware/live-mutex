
const suman = require('suman');  //using npm link

var Test = suman.init(module, {
    interface: 'TDD'
});

//

console.log('developer debugging output');

function promiseTimeout(val) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, val * 3), 100);
    });
}



Test.suite('@Test1-EMpty', {parallel: false, bail: true}, function (assert, william) {

    console.log('william:', william);

    this.test('passes right away', function *() {
        // var val = yield promiseTimeout(yield promiseTimeout(4));
        // console.log('val:',val);
        assert.equal(36, yield promiseTimeout(yield promiseTimeout(4)));
    });

    this.test('fails right away', function () {
        throw new Error('chuck');
    });


    this.test('should never run if bail is set to true', function () {
        assert(true);
    });
});