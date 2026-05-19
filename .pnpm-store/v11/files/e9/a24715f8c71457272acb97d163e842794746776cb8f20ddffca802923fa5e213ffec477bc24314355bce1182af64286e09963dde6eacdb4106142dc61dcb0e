'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var utils_1 = require("./lib/utils");
var logging_1 = require("./lib/logging");
exports.runWatch = function (projectRoot, paths, sumanConfig, sumanOpts, cb) {
    var callable = true;
    var once = function () {
        if (callable) {
            callable = false;
            cb.apply(this, arguments);
        }
    };
    var makeRun;
    if (sumanOpts.watch_per) {
        var watchObj = utils_1.default.getWatchObj(projectRoot, sumanOpts, sumanConfig).watchObj;
        if (watchObj.plugin) {
            logging_1.log.info('running "watch-per" * using suman-watch plugin *.');
            makeRun = require('./lib/watch-per-with-plugin').makeRun;
        }
        else {
            logging_1.log.info('running "watch-per".');
            makeRun = require('./lib/watch-per').makeRun;
        }
    }
    else {
        logging_1.log.info('Running standard test script watcher.');
        logging_1.log.info('When changes are saved to a test script, that test script will be executed.');
        makeRun = require('./lib/start-watching').makeRun;
    }
    assert(typeof makeRun === 'function', 'Suman implementation error - the desired suman-watch module does not export the expected interface.');
    process.stdin.setEncoding('utf8').resume();
    var run = makeRun(projectRoot, paths, sumanOpts);
    run(sumanConfig, false, once);
};
exports.plugins = require('suman-watch-plugins');
