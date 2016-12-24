/**
 * Created by denmanm1 on 3/20/16.
 */


module.exports = [

    '<suman-message>',
    'Please read all of this at least once :)',
    'This file has been converted from a Mocha test to a Suman test using the "$ suman --convert" command.',
    'To get rid of this comment block, you can run can re-run "$ suman --convert" with the "--omit-comments" option.',
    'For the default conversion, we have used the standard ES5 Common.js require syntax; if you wish to use ES6 import syntax, you can',
    'run the original command with with the --es6 flag, like so: $ suman --convert --es6',
    '',
    'You may see that the core module assert is an argument to the top-level describe callback.',
    'Suman allows you to reference any core module in the top-level describe callback, which saves you some ink',
    'by avoiding the need to have several require/import statements for each core module at the top of your file.',
    'Furthermore, you can reference any dependency listed in your suman.ioc.js file, as you would a core module',
    'in the top-level describe callback, this allows for code-reuse across test files and also helps with the annoying problem of relative paths for' +
    'modules in your project. This basic dependency injection via suman.conf.js is a quite useful feature,',
    'because you can load dependencies asynchronously via this method, which means you can load values acquired via network I/O.',
    '',
    'Because Mocha has some bugs and inconsistencies, converting from Mocha is not 100% straightforward, here are a couple bugs to look out for:',
    'https://github.com/mochajs/mocha/issues/2165#event-599798863',
    '',
    'What this means is that using Mocha you should *not* reference this.currentTest in a before/after hook, only beforeEach/afterEach/it',
    '</suman-message>'

];