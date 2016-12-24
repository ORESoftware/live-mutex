const suman = require('suman');
const Test = suman.init(module);


Test.describe('basic tests', {}, function (pragmatik, assert, util) {

    const r = pragmatik.signature({

        mode: 'strict', // does not allow two adjacent non-required types to be the same
        allowMoreArgs: false,
        parseToObject: false,
        allowExtraneousTrailingVars: false,
        args: [
            {
                type: 'string',
                required: false,
                checks: [
                    function (val) {  //check to see if the object has a certain constructor or what not
                        return true;
                    }
                ]
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
                required: true,
                checks: [
                    function(val){
                        assert('z' in val, 'fff property not present.');
                    }
                ]
            },
            {
                type: 'object',
                required: true,
                checks: [
                    function(val){
                        assert('m' in val, 'property not present.');
                    },
                ]
            },

        ]
    });


    function foo() {
        return pragmatik.parse(arguments, r);
    }


    this.it('basic #1', t => {

        const [a,b,c,d,e,f,g,h,i] = foo({a: 'b'}, 'yolo', 'mogo', {z: 'e'}, {m: 'k'});

        assert.equal(a, undefined);
        assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify({a: 'b'})));
        assert.equal(c, undefined);
        assert.equal(d, 'yolo');
        assert.equal(e, 'mogo');
        assert.deepEqual(f, {z: 'e'});
        assert.deepEqual(g, {m: 'k'});
        assert.equal(h, undefined);
        assert.equal(i, undefined);

    });


});

