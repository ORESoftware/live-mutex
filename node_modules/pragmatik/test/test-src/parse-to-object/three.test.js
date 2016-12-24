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
                required: true,
            },
            {
                type: 'object',
                required: true,
            },
            {
                type: 'function',
                required: false,
            }
        ]
    });


    function foo(a, b, c, d) {
        return pragmatik.parse(arguments, r);
    }


    this.it('basic #1', t => {

        const {a, b, c, d} = foo('oh yes', {a: 'b'});

        assert.equal(a, 'oh yes');
        assert.equal(typeof b, 'object');
        assert.equal(c, undefined);

    });


    this.it('basic #2', t => {

        assert.throws(function(){
            const {a, b, c, d} = foo('oh yes');
        });

    });

});

