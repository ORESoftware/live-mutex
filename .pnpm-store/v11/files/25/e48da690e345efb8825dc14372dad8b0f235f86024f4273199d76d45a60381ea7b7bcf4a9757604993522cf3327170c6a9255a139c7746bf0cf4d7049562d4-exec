'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const path = require("path");
const ProgressBar = require('progress');
const { events } = require('suman-events');
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
const onAnyEvent = function (data) {
    process.stdout.write(String(data));
};
exports.loadreporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts, expectations) => {
    let progressBar;
    s.on(events.RUNNER_STARTED, function onRunnerStart(totalNumTests) {
        log.info('runner has started.');
        progressBar = new ProgressBar(' => progress [:bar] :percent :current :token1 :token2', {
            total: totalNumTests,
            width: 120
        });
    });
    s.on(String(events.TEST_FILE_CHILD_PROCESS_EXITED), function onTestEnd(d) {
        if (!progressBar) {
            log.error('progress bar was not yet initialized.');
            return;
        }
        progressBar.tick({
            'token1': "",
            'token2': ""
        });
    });
    s.on(String(events.RUNNER_EXIT_CODE), onAnyEvent);
    s.on(events.RUNNER_ENDED, function onRunnerEnd() {
        log.good('Runner has ended.');
    });
    return retContainer.ret = {
        reporterName
    };
});
exports.default = exports.loadreporter;
