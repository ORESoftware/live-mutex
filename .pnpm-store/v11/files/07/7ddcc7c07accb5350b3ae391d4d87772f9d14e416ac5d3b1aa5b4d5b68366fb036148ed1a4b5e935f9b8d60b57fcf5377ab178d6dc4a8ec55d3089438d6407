'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const assert = require("assert");
const EE = require("events");
const chalk = require("chalk");
const uniq = require('lodash.uniq');
const _ = require("lodash");
const { events } = require('suman-events');
const fnArgs = require("function-arguments");
const suman_utils_1 = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const resultBroadcaster = _suman.resultBroadcaster = (_suman.resultBroadcaster || new EE());
const make_post_injector_1 = require("../injection/make-post-injector");
const acquire_post_deps_1 = require("../acquire-dependencies/acquire-post-deps");
const userData = { 'chuck': 'chuck robbins' };
exports.makeBeforeExit = function (runnerObj, oncePosts, allOncePostKeys) {
    return function beforeExitRunOncePost(cb) {
        if (!runnerObj.hasOncePostFile) {
            return process.nextTick(cb);
        }
        const flattenedAllOncePostKeys = _.flattenDeep(allOncePostKeys).filter(function (v, i, a) {
            return a.indexOf(v) === i;
        });
        const args = fnArgs(runnerObj.oncePostModule);
        const postInjector = make_post_injector_1.makePostInjector(userData, null, null);
        const oncePostModuleRet = runnerObj.oncePostModule.apply(null, postInjector(args));
        assert(suman_utils_1.default.isObject(oncePostModuleRet), 'suman.once.post.js must return an object from the exported function.');
        const dependencies = oncePostModuleRet.dependencies;
        assert(suman_utils_1.default.isObject(dependencies), 'the object returned from the exported function in suman.once.post.js must have a "dependencies" property.');
        flattenedAllOncePostKeys.forEach(function (k) {
            if (!(k in dependencies)) {
                console.error('\n');
                _suman.log.error(chalk.red('Suman usage error => your suman.once.post.js file ' +
                    'is missing desired key ="' + k + '"'));
                return;
            }
            if (!suman_utils_1.default.isArrayOrFunction(dependencies[k])) {
                console.error('\n');
                _suman.log.error(chalk.red('Suman usage error => your suman.once.post.js file ' +
                    'has keys whose values are not functions,\n\nthis applies to key ="' + k + '"'));
            }
        });
        const keys = Object.keys(oncePosts);
        if (keys.length) {
            console.log('\n');
            _suman.log.info(chalk.gray.bold('Suman is now running the desired hooks in suman.once.post.js, which include =>') +
                '\n\t', chalk.cyan(util.inspect(keys)));
        }
        acquire_post_deps_1.acquirePostDeps(keys, dependencies).then(function () {
            console.log('\n');
            _suman.log.info('all suman.once.post.js hooks completed successfully.\n\n');
            process.nextTick(cb);
        }, function (err) {
            _suman.log.error(err.stack || err);
            process.nextTick(cb, err);
        });
    };
};
