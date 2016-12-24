/**
 * Created by t_millal on 10/11/16.
 */



//core
const assert = require('assert');
const path = require('path');
const util = require('util');

//npm
const async = require('async');
const colors = require('colors/safe');

//project
const callbackOrPromise = require('./callback-or-promise');


///////////////////////////////////////////////////////////////


module.exports = function (oncePostKeys, userDataObj, cb) {

    try{
        assert(Array.isArray(oncePostKeys),'Perhaps we exited before <oncePostKeys> was captured.');
    }
    catch(err){
        console.error(err.stack || err, '\n\n');
        oncePostKeys = [];
    }


    try{
        assert(typeof userDataObj === 'object' && !Array.isArray(userDataObj),'Perhaps we exited before <userDataObj> was captured.');
    }
    catch(err){
        console.log('\n => Suman internal message => ',err.stack || err, '\n\n');
        userDataObj = {};
    }

    var called = false;

    //TODO: this should become sumanUtils.onceAsync?
    function first() {
        if (!called) {
            called = true;
            const args = arguments;
            process.nextTick(function () {
                cb.apply(null, args);
            });
        }
        else {
            console.log.apply(console, arguments);
            console.log(' => Suman warning first() called more than once in ' + __filename);
        }
    }


    var oncePostModule,
        oncePostModuleRet,
        oncePosts = {},
        hasonlyPostKeys = oncePostKeys.length > 0;


    if (!hasonlyPostKeys) {
        return first(null, []);
    }


    try {
        oncePostModule = require(path.resolve(global.sumanHelperDirRoot + '/suman.once.post.js'));
    }
    catch (err) {
        console.error('\n',' => Suman usage warning => you have suman.once.post defined, but no suman.once.post.js file.');
        console.error(err.stack || err);
        return first(err, []);
    }

    try {
        assert(typeof  oncePostModule === 'function', 'suman.once.post.js module does not export a function.');
        oncePostModuleRet = oncePostModule.apply(null, [userDataObj]);
    }
    catch (err) {
        console.log(' => Your suman.once.post.js file must export a function that returns an object.');
        console.error(err.stack);
        return first(err, []);
    }

    if (typeof oncePostModuleRet === 'object') {

        oncePostKeys.forEach(function (k) {
            //we store an integer for analysis/program verification, but only really need to store a boolean
            //for existing keys we increment by one, otherwise assign to 1
            oncePosts[k] = oncePosts[k] || oncePostModuleRet[k];


            if (typeof oncePosts[k] !== 'function') {

                console.log(' => Suman is about to conk out =>\n\n' +
                    ' => here is the contents return by the exported function in suman.once.post.js =>\n\n', oncePosts);

                throw new Error('\n' + colors.red(' => Suman usage warning => your suman.once.post.js ' +
                    'has keys whose values are not functions,\n\nthis applies to key ="' + k + '"'));

            }
        });

    }
    else {
        console.log(' => Your suman.once.post.js file must export a function that returns an object.');
        return first(null, []);
    }

    const keys = Object.keys(oncePosts);
    if (keys.length) {
        console.log('\n', ' => Suman message => Suman is now running the desired hooks in suman.once.post.js, which include => \n\t', colors.cyan(util.inspect(keys)));
    }
    else {
        return first(new Error('Your suman.once.post.js file is missing some keys present in your test file(s).'), []);
    }

    async.mapSeries(keys, function (k, cb) {

        callbackOrPromise(k, oncePosts, function (err) {
            cb(null, err);
        });

    }, function (err, results) {
        if (err) {
            console.error(err.stack || err);
            first(err, results);
        }
        else {
            console.log('\n\n', ' => Suman message => all suman.once.post.js hooks completed...exiting...');
            if(results.filter(i => i).length){
                console.log('\n\n', ' => Suman message => it appears you have some errors experienced in the shutdown hooks and are logged below =>','\n\n');
            }
            first(null, results);
        }

    });


};