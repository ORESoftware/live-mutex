const suman = require('suman');
const Test = suman.init(module);


Test.describe('basic tests', {}, function (pragmatik, assert) {

    const r = pragmatik.signature({

        mode: 'strict', // does not allow two adjacent non-required types to be the same
        allowMoreArgs: false,
        parseToObject: true,
        allowExtraneousTrailingVars: false,
        args: [
            {
                type: 'string',
                required: false,
                checks: [
                    function(val){
                        return String(val).match(/.*/);
                    }
                ]
            },
            {
                type: 'object',
                required: false,
            },
            {
                type: 'function',
                required: true,
            }
        ]
    });


    function foo(a = 'tree', b, c, d) {
        return pragmatik.parse(arguments, r);
    }


    this.it('basic #1', t => {

        assert.throws(function () {
            const {a, b, c, d} = foo('oh yes', {a: 'b'});
        });

    });

    this.it('basic #1', t => {

        assert.throws(function () {
            const {a, b, c, d} = foo({a: 'b'});
        });

    });

    this.it('basic #1', t => {

        const {a, b, c, d} = foo(null, function () {
        });


    });

    this.it('basic #1', t => {

        const {a, b, c, d} = foo('cheese', function () {
        });


    });

    this.it('basic #2', t => {

        //TODO: this should prob fail if allowExtraneousTrailingVars === false
        assert.throws(function () {
            const {a, b, c, d} = foo(function noop() {
            }, function noop() {
            });
        });

    });


    this.it('basic #2', t => {

        const {a, b, c, d} = foo('bar', function noop() {
        });

        assert.equal(a, 'bar');
        assert.equal(b, undefined);
        assert.equal(typeof c, 'function');

    });


});

