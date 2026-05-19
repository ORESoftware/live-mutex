'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const _suman = global.__suman = (global.__suman || {});
const helpers_1 = require("./helpers");
exports.makeCreateInjector = function (suman, container) {
    return function createInjector(suite, names) {
        const sumanOpts = suman.opts;
        return names.map(key => {
            const lowerCaseKey = String(key).toLowerCase();
            switch (lowerCaseKey) {
                case '$args':
                    return sumanOpts.user_arg || [];
                case '$iocStatic':
                    return _suman.$staticIoc;
                case 'b':
                    return suite;
                case '$pre':
                    return _suman['$pre'];
                case '$deps':
                    return helpers_1.getCoreAndDeps().$deps;
                case '$core':
                    return helpers_1.getCoreAndDeps().$core;
                case '$root':
                case '$projectroot':
                    return _suman.projectRoot;
                case '$index':
                case '$project':
                case '$proj':
                    return helpers_1.getProjectModule();
                case 'resume':
                case 'getresumevalue':
                case 'getresumeval':
                case 'writable':
                    return suite[key];
                case 'describe':
                case 'context':
                case 'suite':
                case 'afterallparenthooks':
                case 'before':
                case 'after':
                case 'inject':
                case 'beforeall':
                case 'afterall':
                case 'beforeeachblock':
                case 'aftereachblock':
                case 'beforeeach':
                case 'aftereach':
                case 'it':
                case 'test':
                case 'setup':
                case 'teardown':
                case 'setuptest':
                case 'teardowntest':
                    return container[lowerCaseKey];
                case 'userdata':
                    return _suman.userData;
            }
            return helpers_1.lastDitchRequire(key, '<block-injector>');
        });
    };
};
