'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const _suman = global.__suman = (global.__suman || {});
const helpers_1 = require("./helpers");
exports.makePostInjector = function ($data, $preData, $ioc) {
    return function (names) {
        return names.map(function (n) {
            if (n === '$core') {
                return helpers_1.getCoreAndDeps().$core;
            }
            if (n === '$deps') {
                return helpers_1.getCoreAndDeps().$deps;
            }
            if (n === '$args') {
                return _suman.sumanOpts.user_arg || [];
            }
            if (n === '$data') {
                return $data;
            }
            if (n === '$root' || n === '$projectRoot') {
                return _suman.projectRoot;
            }
            if (n === '$index' || n === '$project') {
                return helpers_1.getProjectModule();
            }
            if (n === '$pre') {
                return $preData || _suman['$pre'] || _suman.integrantHashKeyVals;
            }
            if (n === '$ioc') {
                return $ioc || _suman.$staticIoc;
            }
            return helpers_1.lastDitchRequire(n, '<suman.once.post.js>');
        });
    };
};
