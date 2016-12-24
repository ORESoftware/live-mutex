
// Distilled Suman BDD interface API


/**
 *  CommonJS require syntax
 */
const suman = require('suman');

/**
 *  equivalent ES6 module syntax
 */
import * as suman from 'suman';

/**
 * Create an array of all the right files in the source dir
 * @param      {Object}   module local CommonJS module
 * @param      {Object}   options Available options are [integrants {Array}, interface {String}, export {Boolean}]
 * @return     {Object}   Test singleton containing describe factory fn
 */
suman.init = function init(module, options) {
	
	return {
		describe: function (description, options, callback) {
			// this is the skeleton of the way suman is structured, this describe function is different
			// than the describe function on the TestSuite prototype. Both describe functions
			// have the same signature and return type (undefined). The primary difference is that this
			// describe is the top-level describe and defines the entire Suite and
			// the available injected values in the callback differ.
		}
	}
};

// Usage Example

const Test = suman.init(module, {}); // We initialize suman in a test suite file
// (Test is a singleton on which describe is a factory function, as you can see above)

/**
 * Creates our test suite, should be called once per file
 * @param      {String}   description Description of Suite
 * @param      {Object}   options
 * @param      {Function}   callback
 */
Test.describe = function describe(description, options, callback) {
	
	//Test.describe fits the factory pattern and creates test suites
	//bound context of callback is a new TestSuite instance
	//whichever params are included in callback signature will be injected via your suman.ioc.js file
	//additionally, all core modules are available as well as Suman internal values "delay" and "suite"
	//context of callback is a new TestSuite instance
	//one important thing to note is that the callback must be a traditional JavaScript function,
	//it cannot be an arrow function, generator function, async function etc.
	
};

// Usage example:

//we initialize Test
const Test = suman.init(module, {});

//now we call describe, which is our top level describe, which represents entire Suite
//the timeout option let's us fail the suite if all test cases and hooks have not completed before timeout
Test.describe('Our Suite', {parallel: true, timeout: 25000}, function (assert, fs, http) {
	
	//unlike the describe function on the TestSuite prototype,
	//this callback can request core modules as well as any value listed in your suman.ioc.js file
	
});

/**
 * Creates an instance of TestSuite. Constructor not exposed to user.
 *
 * @constructor
 * @this {TestSuite}
 * @param {Object} opts Options.
 */
function TestSuite(options) {
	// this constructor is internal to Suman and you don't need to call it, but it's here for context
}

/**
 * Creates a new instance of TestSuite as a child and binds new TestSuite to callback.
 * @this {TestSuite}
 * @param {String} description The desired diameter of the circle.
 * @param {Object} options The desired diameter of the circle.
 * @param {Function} callback The desired diameter of the circle.
 */
TestSuite.prototype.describe = function describe(description, options, callback) {
	
	//context of callback is a new TestSuite instance
	//one important thing to note is that the callback must be a traditional JavaScript function,
	//it cannot be an arrow function, generator function, async function etc.
	
};

// Usage example

// 'this' context is the TestSuite in scope
this.describe('test all network calls to smartconnect', {parallel: false}, function () {
	
});

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before = function before(description, callback) {

// This is a description of the before function inside
	
};

//Usage example

this.before(t => {
	assert.equal(typeof {}, 'object');
});

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before.cb = function (description, callback) {

// This is a description of the before function inside
	
};

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before.skip = function (description, callback) {

// This is a description of the before function inside
	
};

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before.only = function (description, callback) {

// This is a description of the before function inside
	
};

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before.skip.cb = function (description, callback) {

// This is a description of the before function inside
	
};

/**
 * Creates a before hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.before.only.cb = function (description, callback) {

// This is a description of the before function inside
	
};

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after = function after(description, callback) {
	
};

//Usage example

this.after(t => {
	assert.equal(t.foo, undefined);
});

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after.cb = function after(description, callback) {
	
};

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after.skip = function after(description, callback) {
	
};

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after.only = function after(description, callback) {
	
};

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after.skip.cb = function after(description, callback) {
	
};

/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.after.only.cb = function after(description, callback) {
	
};

/**
 * Creates a beforeEach hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.beforeEach = function beforeEach(description, callback) {
	
};

//usage example

this.beforeEach('hook title', t => {
	assert.equal(t.value.foo, 'bar');
});

/**
 * Creates a beforeEach hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.beforeEach.skip = function beforeEach(description, callback) {
	
};

/**
 * Creates a beforeEach hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.beforeEach.only = function beforeEach([description, options], callback) {
	
};

/**
 * Creates a beforeEach hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.beforeEach.skip.cb = function beforeEach([description, options], callback) {
	
};

/**
 * Creates a beforeEach hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.beforeEach.only.cb = function beforeEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach = function afterEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach.skip = function afterEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach.only = function afterEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach.cb = function afterEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach.skip.cb = function afterEach([description, options], callback) {
	
};

/**
 * Creates an afterEach hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.afterEach.only.cb = function afterEach([description, options], callback) {
	
};

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it = function it(description, [options], callback) {
	
};

//usage example

this.it('test case title', t => {
	assert.equal(t.value.foo, 'bar');
});

this.it('test case title', {mode: 'series'}, t => {
	assert.equal(t.value.foo, 'bar');
});

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it.cb = function it(description, [options], callback) {
	
};

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it.skip = function it(description, [options], callback) {
	
};

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it.only = function it(description, [options], callback) {
	
};

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it.skip.cb = function it(description, [options], callback) {
	
};

/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.it.only.cb = function it(description, [options], callback) {
	
};




