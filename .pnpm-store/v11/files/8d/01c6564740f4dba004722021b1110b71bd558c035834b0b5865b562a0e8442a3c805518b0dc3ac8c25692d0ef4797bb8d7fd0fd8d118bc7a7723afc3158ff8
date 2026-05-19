'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const _suman = global.__suman = (global.__suman || {});
const helpers_1 = require("./helpers");
function default_1(names, $ioc) {
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
        if (n === '$root' || n === '$projectRoot') {
            return _suman.projectRoot;
        }
        if (n === '$index' || n === '$project') {
            return helpers_1.getProjectModule();
        }
        if (n === '$ioc') {
            return _suman.$staticIoc || $ioc;
        }
        return helpers_1.lastDitchRequire(n, '<suman.once.pre.js>');
    });
}
exports.default = default_1;
;
