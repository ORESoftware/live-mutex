'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const assert = require("assert");
const chalk = require("chalk");
const su = require("suman-utils");
const includes = require('lodash.includes');
const fnArgs = require('function-arguments');
const _suman = global.__suman = (global.__suman || {});
const ioc_injector_1 = require("../injection/ioc-injector");
const general_1 = require("../helpers/general");
const IS_SUMAN_DEBUG = process.env.SUMAN_DEBUG === 'yes';
const noKeyExistsPlaceholder = '[suman reserved - no ioc match]';
const thisVal = { 'message': `Suman users: don't use "this" here, instead => http://sumanjs.org/patterns.` };
exports.acquireIocDeps = function (suman, iocDepNames, suite, obj, cb) {
    const iocPromiseContainer = suman.iocPromiseContainer;
    let dependencies = null;
    try {
        let sumanPaths = general_1.resolveSharedDirs(_suman.sumanConfig, _suman.projectRoot, _suman.sumanOpts);
        let { iocFn } = general_1.loadSharedObjects(sumanPaths, _suman.projectRoot, _suman.sumanOpts);
        let iocFnArgs = fnArgs(iocFn);
        let getiocFnDeps = ioc_injector_1.makeIocInjector(suman.iocData, null, null);
        let iocFnDeps = getiocFnDeps(iocFnArgs);
        let iocRet = iocFn.apply(null, iocFnDeps);
        assert(su.isObject(iocRet.dependencies), ' => suman.ioc.js must export a function which returns an object with a dependencies property.');
        dependencies = iocRet.dependencies;
    }
    catch (err) {
        _suman.log.error(err.stack || err);
        _suman.log.error('despite the error, suman will continue optimistically.');
        dependencies = {};
    }
    iocDepNames.forEach(dep => {
        if (dep in dependencies) {
            let d = obj[dep] = dependencies[dep];
            if (!d) {
                let deps = Object.keys(dependencies || {}).map(function (item) {
                    return ' "' + item + '" ';
                });
                _suman.writeTestError(`Warning: the following desired dependency is not in your suman.ioc.js file => '${dep}'`);
                _suman.writeTestError(' => ...your available dependencies are: [' + deps + ']');
                obj[dep] = noKeyExistsPlaceholder;
            }
        }
        else {
            _suman.log.warning(`warning: the following dep is not in your suman.ioc.js configuration '${dep}'`);
            obj[dep] = noKeyExistsPlaceholder;
        }
    });
    const promises = Object.keys(obj).map(function (key) {
        if (iocPromiseContainer[key]) {
            return iocPromiseContainer[key];
        }
        return iocPromiseContainer[key] = new Promise(function (resolve, reject) {
            const fn = obj[key];
            if (fn === '[suman reserved - no ioc match]') {
                resolve();
            }
            else if (typeof fn !== 'function') {
                reject(new Error('Value in IOC object was not a function for corresponding key => ' +
                    '"' + key + '", value => "' + util.inspect(fn) + '"'));
            }
            else if (fn.length > 1) {
                reject(new Error(chalk.red(' => Suman usage error => suman.ioc.js functions take 0 or 1 arguments, ' +
                    'with the single argument being a callback function.')));
            }
            else if (fn.length > 0) {
                let args = fnArgs(fn);
                let str = fn.toString();
                let matches = str.match(new RegExp(args[1], 'g')) || [];
                if (matches.length < 2) {
                    throw new Error('Callback in your function was not present => ' + str);
                }
                fn.call(thisVal, function (err, val) {
                    err ? reject(err) : resolve(val);
                });
            }
            else {
                Promise.resolve(fn.call(thisVal)).then(resolve, reject);
            }
        });
    });
    Promise.all(promises).then(function (deps) {
        Object.keys(obj).forEach(function (key, index) {
            obj[key] = deps[index];
        });
        try {
            process.domain && process.domain.exit();
        }
        finally {
            process.nextTick(cb, null, obj);
        }
    }, function (err) {
        _suman.log.error('Error acquiring ioc dependency:', err.stack || err);
        try {
            process.domain && process.domain.exit();
        }
        finally {
            process.nextTick(cb, err, {});
        }
    });
};
