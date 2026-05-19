'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var su = require("suman-utils");
var util = require("util");
var chalk_1 = require("chalk");
var semver = require('semver');
var logging_1 = require("./logging");
var sortBySemverVersion = function (a, b) {
    if (semver.gt(a, b)) {
        return 1;
    }
    else if (semver.lt(a, b)) {
        return -1;
    }
    return 0;
};
var getLastValue = function (values, type) {
    type = type || 'semver';
    var keys = Object.keys(values);
    switch (type) {
        case 'semver':
            keys.sort(sortBySemverVersion);
    }
    var finalKey = keys[keys.length - 1];
    return values[finalKey];
};
exports.utils = {
    getValue: function (version, input, exportName, values, versioningType) {
        versioningType = versioningType || 'semver';
        var env = input.pluginEnv;
        delete input.pluginEnv;
        env && assert(su.isObject(env), 'if "pluginEnv" property exists, it must be a plain object.');
        var overrideObject = {
            isSumanWatchPluginValue: true,
        };
        var keys = Object.keys(values);
        var value;
        if (version === 'latest') {
            value = getLastValue(values, versioningType);
        }
        else {
            value = exports.utils.getValueViaSemverVersion(version, exportName, values);
        }
        if (env) {
            overrideObject.pluginEnv = Object.assign({}, process.env, value.pluginEnv, env);
        }
        return exports.utils.validatePlugin(Object.assign({}, value, input, overrideObject), value.version);
    },
    validatePlugin: function (v, k) {
        try {
            assert(v, 'plugin value is not defined.');
            assert.equal(v.version, k, 'key version must match object version.');
            assert(v.pluginName && typeof v.pluginName === 'string', '"pluginName" property needs to be defined.');
            assert.equal(v.isSumanWatchPluginValue, true, '"isSumanWatchPluginValue" property needs to be set to true.');
            assert(v.pluginCwd && typeof v.pluginCwd === 'string', '"pluginCwd" property needs to be defined.');
            assert(v.pluginEnv && su.isObject(v.pluginEnv), '"pluginEnv" property needs to be a plain object.');
        }
        catch (err) {
            logging_1.log.error('The following suman-watch-plugin is malformed =>\n', chalk_1.default.magenta.bold(util.inspect(v)));
            throw err;
        }
        return v;
    },
    validatePluginValues: function (values) {
        Object.keys(values).forEach(function (k) {
            exports.utils.validatePlugin(values[k], k);
        });
    },
    getValueViaSemverVersion: function (version, pluginName, values) {
        try {
            assert(semver.valid(version));
        }
        catch (err) {
            logging_1.log.error("the semver version passed is not valid => '" + version + "', while looking a version of plugin with name '" + pluginName + "'.");
        }
        var prev;
        var keys = Object.keys(values).sort(sortBySemverVersion);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (semver.gt(key, version)) {
                return prev || values[key];
            }
            else if (semver.lt(key, version)) {
                prev = values[key];
            }
            else {
                return values[key];
            }
        }
    }
};
