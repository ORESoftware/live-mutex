

//const suman = require('/Users/amills001c/WebstormProjects/ORESoftware/suman');

const suman = require('suman');
const Test = suman.init(module);

Test.describe('test', function (assert) {

    const ijson = require('..');

    const json_str0 = {
        "baz": {
            1: 1,
            "2": true,
            "3": {}
        },
        "foo": function () {
            function horror() {
            }
        }
    };

    const json_str1 = '{"baz":{"1":1,"2":true,"3":{}}}';
    const json_str2 = '{"baz":{"1":1,"2":true,"3":{}},"foo":function(){function horror(){}}}';
    const json_str3 = '{\"baz\":{\"1\":1,\"2\":true,\"3\":{}},\"foo\":function(){function horror(){}}}';
    const res = '{"#stringified":{"baz":{"1":1,"2":true,"3":{}}}}';


    this.it('test 0', function () {

        return ijson.parse(json_str0).then(function (val) {
            assert.deepEqual(val, json_str0);
        }).catch(function (err) {
            console.log('test 0 error:', err);
        });

    });

    this.it('test 1', function () {

        return ijson.parse(ijson.parse(json_str0)).then(function (val) {
            assert.deepEqual(val, json_str0);
        }).catch(function (err) {
            console.log('test 1 error:', err);
        });

    });

    this.it('test 2', function () {

        return ijson.parse(json_str0).then(function (val) {
            return ijson.parse(ijson.parse(ijson.parse(val))).then(function (val) {
                return ijson.parse(ijson.parse(ijson.parse(val))).then(function (val) {
                    assert.deepEqual(val, json_str0);
                });
            });
        }).catch(function (err) {
            console.log('test 1 error:', err);
        });

    });


    this.it('test 3', function () {

        return ijson.parse(ijson.parse(json_str1)).then(function (val) {
            assert.deepEqual(val, json_str0);
        }).catch(function (err) {
            console.log('test 3 error:', err.stack);
        });

    });


    this.it('test 4', function () {

        return ijson.parse(json_str0).then(function (val) {
            return ijson.stringify(ijson.stringify(ijson.parse(val)));
        }).then(function (val) {
            console.log('vaaal:', val);
            assert.deepStrictEqual(val, res, 'not deep equal');
        });

    });

    this.it('test 5', function () {

        return ijson.parse(json_str2).then(function (val) {
            return ijson.stringify(ijson.stringify(ijson.parse(val)));
        }).then(function (val) {
            console.log('vaaal 5:', val);
            assert.deepStrictEqual(val, res, 'not deep equal');
        });

    });


    this.it('test 6', function () {

        return ijson.stringify(ijson.stringify(ijson.stringify(json_str0))).then(function (val) {
            return ijson.parse(val);
        }).then(function (val) {
            console.log('vaaal:', val);
            assert.deepStrictEqual(val, json_str0, 'not deep equal');
        });

    });


    this.it('test 7', function () {

        return ijson.stringify(new Promise(function (resolve) {
            resolve({a: 'A'});
        })).then(function (val) {
            return ijson.parse(val);
        }).then(function (val) {
            console.log('vaaal:', val);
            assert.deepStrictEqual(val, json_str0, 'not deep equal');
        });

    });


    this.it('test 8', function () {

        return Promise.all([
            ijson.stringify({foo: 'bar'}).then(function (val) {
                return ijson.parse(val);
            }).then(function (val) {
                console.log('vaaal:', val);
                assert.deepStrictEqual(val, json_str0, 'not deep equal');
            }),
            ijson.stringify(new Promise(function (resolve) {
                resolve({a: 'A'});
            })).then(function (val) {
                return ijson.parse(val);
            }).then(function (val) {
                console.log('vaaal:', val);
                assert.deepStrictEqual(val, json_str0, 'not deep equal');
            })
        ]);

    });

});
