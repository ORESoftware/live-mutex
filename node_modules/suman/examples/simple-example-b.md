


```js
const suman = require('suman');
const Test = suman.init(module);


Test.describe('@Test1', function (assert) {

    var config = null;

    this.beforeEach(function () {
        if (config) {
            throw new Error('config should be null before each test :)');
        }
    });

    this.afterEach(function () {
        config = null;
    });

    this.it('does not throw', function () {

        assert.doesNotThrow(function () {  //prob unnecessary, but for clarity

            config = require('adore')(module, '*', 'test/test-config');

        });

    });


    this.it('does throw part 1', function () {

        assert.throws(function () {

            config = require('adore')(module, 'some string without an asterisk', 'test/test-config');

        }, 'Whoops');

    });

    this.it('does throw part 2', function () {

        assert.throws(function () {

            config = require('adore')(module, '***', 'test/test-config/bad-path');

        }, 'Whoops');

    });


    this.it('does throw part 3', function () {

        assert.throws(function () {

            config = require('adore')(module, '***', 'test/test-config/bad-path');

        }, 'Whoops');

    });


    this.it('verify config values', function () {

        config = require('adore')(module, '***', 'test/test-config');

        assert.equal(config.prop1, 1);
        assert.deepEqual(config.prop2, {foo: 'bar'}, 'prop2 has unexpected value');
        assert(typeof config.prop3.jungle === 'function', 'prop3 is not a function');

    });


});
```