'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var su = require("suman-utils");
var logging_1 = require("../../lib/logging");
var util_1 = require("../../lib/util");
exports.exportName = String(path.basename(__dirname)).toLowerCase().replace(/[^a-zA-Z]/, '');
exports.isSumanWatchPluginModule = true;
var values = Object.freeze({
    '6.24.1': {
        version: '6.24.1',
        isSumanWatchPluginValue: true,
        pluginName: exports.exportName + '-watch-plugin',
        pluginCwd: process.cwd(),
        pluginEnv: process.env,
        pluginExec: 'set -e; rm -rf @target; babel -w @src --out-dir=@target',
        stdoutStartTranspileRegex: /currently unknown matching string (sad face)/i,
        stdoutEndTranspileRegex: /\s{1,3}->\s{1,3}/i,
    },
});
exports.getValue = function (version, input) {
    if (su.isObject(version)) {
        logging_1.log.warning("suman-watch-plugin with name '" + exports.exportName + "'," +
            " is using the latest version of the plugin because no desired version was passed as the first argument to getValue().");
        input = version;
        version = 'latest';
    }
    return util_1.utils.getValue(version, input, exports.exportName, values);
};
util_1.utils.validatePluginValues(values);
exports[exports.exportName + 'Plugin'] = module.exports;
