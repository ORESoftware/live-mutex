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
                checks: [function (arg) {  //check to see if the object has a certain constructor or what not
                    return true;
                }]
            },
            {
                type: 'object',
                required: true,
            },
            {
                type: 'function',
                required: false
            },
            {
                type: 'string',
                required: true
            },
            {
                type: 'string',
                required: false
            },
            {
                type: 'object',
                required: true
            },
            {
                type: 'object',
                required: true,
            },

        ]
    });


    function foo(a, b, c, d, e, f, g) {
        return pragmatik.parse(arguments, r);
    }


    this.it('basic #1', t => {

        const {a, b, c, d, e, f, g, h} = foo({a: 'b'}, 'yolo', 'mogo', {z: 'e'}, {m: 'k'});

        assert.equal(a, undefined);
        // assert.equal(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify({a: 'b'})));
        assert.equal(c, undefined);
        assert.equal(d, 'yolo');
        assert.equal(e, 'mogo');
        // assert.equal(f, {z: 'e'});
        // assert.equal(g, {m: 'k'});
        assert.equal(h, undefined);


    });


// foo('first', function(err){
//
//     console.log('a is done');
//
// });

//
// foo('first', {}, function(err){
//
//     console.log('a is done');
//
// });


});

