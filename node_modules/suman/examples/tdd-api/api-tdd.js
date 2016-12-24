
// Distilled Suman TDD interface API


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
 * @return     {Object}   Test singleton containing suite factory fn
 */
suman.init = function init(module, options) {

    return {
        suite: function(description, options, callback){
            // this is the skeleton of the way suman is structured, this suite function is technically different
            // than the suite function on the TestSuiteBase prototype. Both suite functions
            // have the same signature and return type (undefined). The primary difference is that this
            // suite is the top-level suite and defines the entire Suite and
            // the available injected values in the callback differ.
        }
    }
};


// Usage Example


const Test = suman.init(module, {}); // We initialize suman in a test suite file
// (Test is a singleton on which suite is a factory function, as you can see above)


/**
 * Creates our test suite, should be called once per file
 * @param      {String}   description Description of Suite
 * @param      {Object}   options
 * @param      {Function}   callback
 */
Test.suite = function suite(description, options, callback){

    //Test.suite fits the factory pattern and creates test suites
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

//now we call suite, which is our top level suite, which represents entire Suite
//the timeout option let's us fail the suite if all test cases and hooks have not completed before timeout
Test.suite('Our Suite', {parallel:true, timeout:25000}, function(assert, fs, http){

    //unlike the suite function on the TestSuite prototype,
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
TestSuite.prototype.suite = function suite(description, options, callback) {

    //context of callback is a new TestSuite instance
    //one important thing to note is that the callback must be a traditional JavaScript function,
    //it cannot be an arrow function, generator function, async function etc.

};


// Usage example

// 'this' context is the TestSuite in scope
this.suite('test all network calls to smartconnect', {parallel:false}, function(){


});


/**
 * Creates a setup hook which runs once before any test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.setup = function setup(description, callback) {

// This is a description of the setup function inside


};


/**
 * Creates an after hook which runs once after all test cases beneath it are run.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.teardown = function teardown(description, callback) {


};


/**
 * Creates a setupTest hook which runs immediately before each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.setupTest = function setupTest(description, callback) {


};


/**
 * Creates an teardownTest hook which runs immediately after each test case that exists beneath the call.
 * @this {TestSuite}
 * @param {String} description Optional description of hook (for debugging).
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.teardownTest = function teardownTest(description, callback) {


};


/**
 * Creates a test case.
 * @this {TestSuite}
 * @param {String} description Required description of test case
 * @param {Object} opts Optional options object.
 * @param {Function} callback The function which acts as the hook.
 */
TestSuite.prototype.test = function test(description, options, callback) {


};





