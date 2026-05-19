'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const _suman = global.__suman = (global.__suman || {});
exports.findPathOfRunDotSh = function (p) {
    if (String(p).match(/\/@target\//)) {
        return null;
    }
    const root = _suman.projectRoot;
    const ln = root.length;
    while (p.length >= ln) {
        let dirname = path.dirname(p);
        let map = _suman.markersMap[dirname];
        if (map && map['@run.sh']) {
            return path.resolve(dirname, '@run.sh');
        }
        if (map && map['@config.json']) {
            try {
                let config = require(path.resolve(dirname, '@config.json'));
                let v;
                if (v = config['@run']) {
                    if (v.prevent) {
                        return null;
                    }
                    if (v.plugin && v.plugin.value) {
                        let plugin = require(v.plugin.value);
                        return plugin.getRunPath();
                    }
                    else if (v.plugin) {
                        throw new Error('"plugin" should be an object with a "value" property.');
                    }
                }
            }
            catch (err) {
                _suman.log.warning('Your @config.json file may be malformed at path: ', dirname);
                _suman.log.error(err.message || err);
            }
        }
        p = path.resolve(p + '/../');
    }
    return null;
};
exports.findPathAndConfigOfRunDotSh = function (p) {
    const ret = {
        'config': null,
        'runPath': null
    };
    const root = _suman.projectRoot;
    const ln = root.length;
    while (p.length >= ln) {
        let dirname = path.dirname(p);
        let map = _suman.markersMap[dirname];
        if (map && map['@config.json']) {
            try {
                let v, config = require(path.resolve(dirname, '@config.json'));
                if (v = config['@run']) {
                    if (v.prevent) {
                        _suman.log.warning('File with the following path was prevented from running with a setting in @config.json.');
                        _suman.log.warning(p);
                    }
                    if (v.plugin && v.plugin.value) {
                        let plugin = require(v.plugin.value);
                        ret.runPath = plugin.getRunPath();
                    }
                    else if (v.plugin) {
                        throw new Error('"plugin" should be an object with a "value" property.');
                    }
                }
            }
            catch (err) {
                _suman.log.warning('Your @config.json file may be malformed at path: ', dirname);
                _suman.log.error(err.message || err);
            }
        }
        p = path.resolve(p + '/../');
    }
    return ret;
};
exports.findPathOfTransformDotSh = function (p) {
    if (String(p).match(/\/@target\//)) {
        return null;
    }
    const root = _suman.projectRoot;
    const ln = root.length;
    while (p.length >= ln) {
        let dirname = path.dirname(p);
        let map = _suman.markersMap[dirname];
        if (map && map['@transform.sh']) {
            return path.resolve(dirname, '@transform.sh');
        }
        if (map && map['@config.json']) {
            try {
                let v, config = require(path.resolve(dirname, '@config.json'));
                if (v = config['@transform']) {
                    if (v.prevent) {
                        return null;
                    }
                    if (v.plugin && v.plugin.value) {
                        let plugin = require(v.plugin.value);
                        return plugin.getTransformPath();
                    }
                    else if (v.plugin) {
                        throw new Error('"plugin" should be an object with a "value" property.');
                    }
                }
            }
            catch (err) {
                _suman.log.warning('Your @config.json file may be malformed at path: ', dirname);
                _suman.log.error(err.message || err);
            }
        }
        p = path.resolve(p + '/../');
    }
    return null;
};
