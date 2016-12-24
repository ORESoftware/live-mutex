const suman = require('suman');
const Test = suman.init(module);

Test.describe('SimpleTest', {parallel: false}, function (assert, fs, http, os) {

    this.it('tests-arrays', function () {
        assert.equal(typeof [], 'object');
    });

    this.it('tests-t', t => {
        assert.notEqual(typeof t, 'function');
    });

    this.it.cb('tests-t', t => {
        t.apply(null);
    });

    this.it.cb('tests-t', t => {
        t.bind(null);
        t.apply(null);
    });

    this.it.cb('tests-t', t => {
        // throw new Error('barf'); ///
        t();
    });

    ['describe', 'it', 'before', 'after', 'afterEach'].forEach(item => {

        this.it('tests-suman suite block for: ' + item, function () {
            assert(this.hasOwnProperty(item));
        });

    });

    this.it.cb('Check that Test.file is equiv. to module.filename', {timeout: 45}, t => {
        setTimeout(function () {
            assert(module.filename === Test.file);
            t.done();
        }, 19);
    });


    this.it.cb('reads this file, pipes to /dev/null', function (t) {

        const destFile = os.hostname === 'win32' ? process.env.USERPROFILE + '/temp' : '/dev/null';

        fs.createReadStream(Test.file).pipe(fs.createWriteStream(destFile))
            .on('error', t.fail).on('finish', t.pass);

    });


    this.it.cb('Check that Test.file is equiv. to module.filename', {timeout: 25}, t => {
        setTimeout(function () {
            assert(module.filename === Test.file);
            t.done();
        }, 19);
    });

    this.it('uses promises to handle http', {timeout: 4000}, function () {

        return new Promise(function (resolve, reject) {

            const req = http.request({

                method: 'GET',
                hostname: 'example.com'

            }, res => {

                var data = '';

                res.on('data', function (d) {
                    data += d;
                });

                res.on('end', function () {

                    assert(typeof data === 'string');
                    resolve();

                });

            });

            req.end();
            req.on('error', reject);
        });

    });

});




