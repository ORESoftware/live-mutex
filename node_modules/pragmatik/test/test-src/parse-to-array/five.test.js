const suman = require('suman');
const _Test = suman.init(module);


_Test.describe('basic tests', {}, function (pragmatik, assert) {

    const r = pragmatik.signature({

        mode: 'strict', // does not allow two adjacent non-required types to be the same
        parseToObject: false,
        allowExtraneousTrailingVars: false,
        extraneousVarsErrorMessage: 'Too many args. Signature is Test.describe(String s, [opts o], Function f)',
        args: [
            {
                type: 'string',
                required: false,
                errorMessage: 'test error message 1',
                checks: [
                    function (val) {
                        return String(val).match(/.*/);
                    }
                ]
            },
            {
                type: 'object',
                required: false,
                errorMessage: 'test error message 2'
            },
            {
                type: 'function',
                required: true,
                errorMessage: 'test error message 3'
            }
        ]
    });


    function foo() {
        return pragmatik.parse(arguments, r);
    }



    this.describe('bs', function () {

        this.it('basic #1', t => {

            assert.throws(function () {
                const [a, b, c, d] = foo('oh yes', {a: 'b'});
            }, /Argument is required at argument index.*but type was wrong/);

        });

        this.it('basic #1', t => {

            assert.throws(function () {
                const [a, b, c, d] = foo({a: 'b'});
            }, /Argument is required at argument index.*but type was wrong/);

        });

        this.it('basic #1', t => {

            const [a, b, c, d]= foo(null, function z() {
            });

            assert.equal(a, undefined);
            assert.equal(b, null);
            assert.equal(c.name, 'z');


        });

        this.it('basic #1', t => {

            const [a, b, c, d] = foo('cheese', function xyz() {
            });

            assert.equal(a, 'cheese');
            assert.equal(b, undefined);
            assert.equal(c.name, 'xyz');
            assert.equal(d, undefined);

        });


        this.it('basic #2', t => {

            const [a, b, c, d] = foo('bar', function noop() {
            });

            assert.equal(a, 'bar');
            assert.equal(b, undefined);
            assert.equal(typeof c, 'function');
            assert.equal(d, undefined);

        });
    });


    this.it('basic #2', t => {

        //TODO: this should prob fail if allowExtraneousTrailingVars === false

        const [a, b, c, d, e, f] = foo(function zzz() {

        }, function ppp() {

        });

        assert.equal(a, undefined);
        assert.equal(b, undefined);
        assert.equal(c.name, 'noop');
        assert.equal(d.name, 'zzz');
        assert.equal(e.name, 'ppp');

    });

    this.it('basic #2', {}, t => {

        // throw new Error('test error message 3');

        //TODO: this should prob fail if allowExtraneousTrailingVars === false

        // const [a, b, c, d, e, f] = foo(false,function noop() {
        // }, function zzz() {
        //
        // }, function ppp() {
        //
        // });
        //
        // assert.equal(a, undefined);
        // assert.equal(b, undefined);
        // assert.equal(c.name, 'noop');
        // assert.equal(d.name, 'zzz');
        // assert.equal(e.name, 'ppp');

    });


});

