'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const util = require("util");
const path = require("path");
const su = require("suman-utils");
const chalk_1 = require("chalk");
const _suman = global.__suman = (global.__suman || {});
const suman_events_1 = require("suman-events");
const utils_1 = require("../../lib/utils");
const reporterName = path.basename(__dirname);
const log = utils_1.getLogger(reporterName);
const noColors = process.argv.indexOf('--no-color') > 0;
const noop = function () { };
exports.loadReporter = utils_1.wrapReporter(reporterName, (retContainer, results, s, sumanOpts) => {
    const testCaseFailures = [];
    const settings = {
        first: true
    };
    let onAnyEvent = function () {
        const args = Array.from(arguments).map(function (data) {
            return typeof data === 'string' ? data : util.inspect(data);
        });
        console.log.apply(console, args);
    };
    let onTestCaseEvent = function () {
        if (settings.first) {
            settings.first = false;
            if (!('val' in _suman.currentPaddingCount) && sumanOpts.series) {
                log.warning(`'${reporterName}' reporter may be unable to properly indent output.\n`);
            }
        }
        const args = Array.from(arguments).map(function (data) {
            return chalk_1.default.bold(typeof data === 'string' ? data : util.inspect(data));
        })
            .join(' ');
        let amount = _suman.processIsRunner || !_suman.currentPaddingCount ? 0 : (_suman.currentPaddingCount.val || 0);
        printTestCaseEvent(args, amount);
    };
    let printTestCaseEvent = function (str, paddingCount) {
        if (settings.first) {
            settings.first = false;
        }
        if (!_suman.isTestMostRecentLog) {
            _suman.isTestMostRecentLog = true;
            console.log();
        }
        paddingCount = paddingCount || 0;
        const padding = _suman.processIsRunner ? su.padWithXSpaces(0) : su.padWithXSpaces(paddingCount + 4);
        console.log.call(console, padding, str);
    };
    let onVerboseEvent = function (data) {
        if (su.vgt(6)) {
            log.info(typeof data === 'string' ? data : util.inspect(data));
        }
    };
    let getTestCaseFailedStr = function (test) {
        let str;
        if (_suman.processIsRunner) {
            let testPath = ` ${test.filePath || test.filepath || '(unknown test path)'} `;
            str = ` ${chalk_1.default.bgYellow.black.bold(` [${results.n}] \u2718 test case fail => `)}${chalk_1.default.bgBlack.white.bold(` "${test.desc}" `)} \n` +
                `  ${chalk_1.default.gray.bold.underline(' Originating entry test path => ')}` +
                `${chalk_1.default.gray.bold(testPath)}\n` +
                `${chalk_1.default.yellow.bold(String(test.errorDisplay || test.error || ''))}`;
        }
        else {
            str = ` ${chalk_1.default.bgWhite.black.bold(` [${results.n}]  \u2718  => test case fail `)}` +
                ` "${test.desc}"\n  ${chalk_1.default.yellow.bold(String(test.errorDisplay || test.error || ''))}`;
        }
        return str;
    };
    let getTestCaseFailedSummaryStr = function (test, count) {
        let testPath = ` ${test.filePath || test.filepath || '(unknown test path)'} `;
        return ` ${chalk_1.default.bgRed.white.bold(` \u2718 Failure number: ${count} => `)}${chalk_1.default.bgBlack.white.bold(` "${test.desc}" `)} \n` +
            `  ${chalk_1.default.gray.bold.underline(' Originating entry test path => ')}` +
            `${chalk_1.default.black.bold(testPath)}\n` +
            `${chalk_1.default.yellow.bold(String(test.errorDisplay || test.error || ''))}`;
    };
    s.on(String(suman_events_1.events.SUMAN_CONTEXT_BLOCK), function (b) {
        console.log('\n', su.padWithXSpaces(_suman.currentPaddingCount.val), chalk_1.default.gray.bold.italic(` ▶ group: '${b.desc}' ▶ `));
    });
    s.on(String(suman_events_1.events.SUMAN_CONTEXT_BLOCK_TAP_JSON), function (b) {
        console.log('\n', su.padWithXSpaces(b.padding), chalk_1.default.gray.bold.italic(b.message));
    });
    s.on(String(suman_events_1.events.RUNNER_EXIT_CODE_GREATER_THAN_ZERO), noop);
    s.on(String(suman_events_1.events.FILE_IS_NOT_DOT_JS), function (dir) {
        onAnyEvent('\n => Warning -> Suman will attempt to execute the following file:\n "' +
            chalk_1.default.cyan(dir) + '",\n (which is not a .js file).\n');
    });
    s.on(String(suman_events_1.events.RUNNER_INITIAL_SET), function (forkedCPs, processes, suites) {
        onAnyEvent('\n\n\t', chalk_1.default.bgBlue.yellow(' => [Suman runner] =>  initial set => ' +
            forkedCPs.length + ' ' + processes + ' running ' + forkedCPs.length + ' ' + suites + ' '), '\n');
    });
    s.on(String(suman_events_1.events.RUNNER_OVERALL_SET), function (totalCount, processes, suites, addendum) {
        onAnyEvent('\t ' + chalk_1.default.bgBlue.yellow(' => [Suman runner] =>  overall set => '
            + totalCount + ' ' + processes + ' will run ' + totalCount + ' ' + (suites + addendum) + ' ') + '\n\n\n');
    });
    s.on(String(suman_events_1.events.RUNNER_ASCII_LOGO), function (logo) {
        onAnyEvent(logo, '\n');
    });
    s.on(String(suman_events_1.events.FATAL_TEST_ERROR), onAnyEvent);
    let onTestCaseFailed = function (test) {
        results.failures++;
        let str;
        if (_suman.processIsRunner) {
            let testPath = ` ${test.filePath || test.filepath || '(uknown test path)'} `;
            str = ` ${chalk_1.default.bgYellow.black.bold(` [${results.n}] \u2718 test case fail => `)}${chalk_1.default.bgBlack.white(` "${test.desc}" `)} \n` +
                `  ${chalk_1.default.gray.bold.underline(' Originating entry test path => ')}` +
                `${chalk_1.default.black.bold(testPath)}\n` +
                `${chalk_1.default.yellow.bold(String(test.errorDisplay || test.error || ''))}`;
        }
        else {
            str = ` ${chalk_1.default.bgWhite.black.bold(` [${results.n}]  \u2718  => test fail `)}` +
                ` "${test.desc}"\n  ${chalk_1.default.yellow.bold(String(test.errorDisplay || test.error || ''))}`;
        }
        return str;
    };
    let onTestCasePass = function (test) {
        results.passes++;
        let timeDiffStr = (test.dateComplete ? '(' + ((test.dateComplete - test.dateStarted) || '< 1') + 'ms)' : '');
        return `${chalk_1.default.green(` [${results.n}] ${chalk_1.default.bold('✔')}`)} '${test.desc}' ${timeDiffStr}`;
    };
    let onTestCaseSkipped = function (test) {
        results.skipped++;
        return `${chalk_1.default.yellow(` [${results.n}] \u21AA`)} '${test.desc}' ${chalk_1.default.italic.grey('(skipped)')}`;
    };
    let onTestCaseStubbed = function (test) {
        results.stubbed++;
        return `${chalk_1.default.yellow(` [${results.n}] \u2026`)} '${test.desc}' ${chalk_1.default.italic.grey('(stubbed)')}`;
    };
    let onTestCaseEnd = function () {
        results.n++;
    };
    s.on(String(suman_events_1.events.TEST_CASE_END), function () {
        onTestCaseEnd();
    });
    s.on(String(suman_events_1.events.TEST_CASE_FAIL), function (test) {
        test = test.testCase || test;
        results.failures++;
        testCaseFailures.push(test);
        console.log();
        onTestCaseEvent(getTestCaseFailedStr(test));
        console.log();
    });
    s.on(String(suman_events_1.events.TEST_CASE_PASS), function (test) {
        test = test.testCase || test;
        onTestCaseEvent(onTestCasePass(test));
    });
    s.on(String(suman_events_1.events.TEST_CASE_SKIPPED), function (test) {
        test = test.testCase || test;
        onTestCaseEvent(onTestCaseSkipped(test));
    });
    s.on(String(suman_events_1.events.TEST_CASE_STUBBED), function (test) {
        test = test.testCase || test;
        onTestCaseEvent(onTestCaseStubbed(test));
    });
    s.on(String(suman_events_1.events.TEST_CASE_END_TAP_JSON), function () {
        onTestCaseEnd();
    });
    s.on(String(suman_events_1.events.TEST_CASE_FAIL_TAP_JSON), function (d) {
        results.failures++;
        testCaseFailures.push(d.testCase);
        const str = getTestCaseFailedStr(d.testCase);
        console.log();
        printTestCaseEvent(str, d.padding);
        console.log();
    });
    s.on(String(suman_events_1.events.TEST_CASE_PASS_TAP_JSON), function (d) {
        const str = onTestCasePass(d.testCase);
        printTestCaseEvent(str, d.padding);
    });
    s.on(String(suman_events_1.events.TEST_CASE_SKIPPED_TAP_JSON), function (d) {
        const str = onTestCaseSkipped(d.testCase);
        printTestCaseEvent(str, d.padding);
    });
    s.on(String(suman_events_1.events.TEST_CASE_STUBBED_TAP_JSON), function (d) {
        const str = onTestCaseStubbed(d.testCase);
        printTestCaseEvent(str, d.padding);
    });
    s.on(String(suman_events_1.events.RUNNER_EXIT_SIGNAL), function (signal) {
        onAnyEvent(['<::::::::::::::::::::: Runner Exit Signal => ' + signal + ' ::::::::::::::::::::::::>'].join('\n'));
    });
    s.on(String(suman_events_1.events.RUNNER_EXIT_CODE), function (code) {
        onAnyEvent(['\n  ',
            ' <::::::::::::::::::::::::::::::::: Suman runner exiting with exit code: ' + code +
                ' :::::::::::::::::::::::::::::::::>', '\n'].join('\n'));
    });
    s.on(String(suman_events_1.events.ERRORS_ONLY_OPTION), function () {
        onVerboseEvent(chalk_1.default.white.green.bold(` => ${chalk_1.default.white.bold('"--errors-only"')}  option used, hopefully you don't see much output until the end :) `));
    });
    s.on(String(suman_events_1.events.USING_SERVER_MARKED_BY_HOSTNAME), onVerboseEvent);
    s.on(String(suman_events_1.events.USING_FALLBACK_SERVER), onVerboseEvent);
    s.on(String(suman_events_1.events.USING_DEFAULT_SERVER), onVerboseEvent);
    s.on(String(suman_events_1.events.FILENAME_DOES_NOT_MATCH_ANY), function (dir) {
        onVerboseEvent(` => You may have wanted to run file/folder with this name: '${chalk_1.default.bold(dir)}',\n\t` +
            `but it didnt match the regex(es) you passed in as input for "matchAny".`);
    });
    s.on(String(suman_events_1.events.FILENAME_DOES_NOT_MATCH_NONE), function (dir) {
        onVerboseEvent(` => You may have wanted to run file/folder with this name: '${chalk_1.default.bold(dir)}',\n\t` +
            `but it didnt match the regex(es) you passed in as input for "matchNone".`);
    });
    s.on(String(suman_events_1.events.FILENAME_DOES_NOT_MATCH_ALL), function (dir) {
        onVerboseEvent(` => You may have wanted to run file/folder with this name: '${chalk_1.default.bold(dir)}',\n\t` +
            `but it didnt match the regex(es) you passed in as input for "matchAll"`);
    });
    s.on(String(suman_events_1.events.RUNNER_SAYS_FILE_HAS_JUST_STARTED_RUNNING), function (file) {
        !settings.first && console.log();
        log.info(chalk_1.default.bold('File has just started running =>'), chalk_1.default.grey.bold(`'${file}'`));
        !settings.first && console.log();
    });
    s.on(String(suman_events_1.events.RUNNER_HIT_DIRECTORY_BUT_NOT_RECURSIVE), onVerboseEvent);
    s.on(String(suman_events_1.events.RUNNER_STARTED), noop);
    s.on(String(suman_events_1.events.RUNNER_ENDED), function (date) {
        if (testCaseFailures.length) {
            log.info(chalk_1.default.red.bold.underline('You have at least one test case failure. Complete list of test case failures:'));
        }
        testCaseFailures.forEach(function (d, i) {
            const str = getTestCaseFailedSummaryStr(d, i + 1);
            console.log();
            printTestCaseEvent(str, 0);
            console.log();
        });
    });
    s.on(String(suman_events_1.events.SUITE_SKIPPED), noop);
    s.on(String(suman_events_1.events.SUITE_END), noop);
    s.on(String(suman_events_1.events.TEST_END), noop);
    s.on(String(suman_events_1.events.RUNNER_EXIT_CODE_IS_ZERO), noop);
    s.on(String(suman_events_1.events.RUNNER_TEST_PATHS_CONFIRMATION), function (files) {
        if (sumanOpts.verbosity > 5) {
            onAnyEvent(['\n ' + chalk_1.default.bgBlack.white.bold(' Suman will attempt to execute test files with/within the following paths: '),
                '\n',
                files.map((p, i) => '\t ' + (i + 1) + ' => ' + chalk_1.default.bold('"' + p + '"')).join('\n') + '\n\n'].join(''));
        }
    });
    if (!sumanOpts.no_tables) {
        s.on(String(suman_events_1.events.RUNNER_RESULTS_TABLE), function (allResultsTableString) {
            onAnyEvent('\n\n' + allResultsTableString.replace(/\n/g, '\n\t') + '\n\n');
        });
        s.on(String(suman_events_1.events.RUNNER_RESULTS_TABLE_SORTED_BY_MILLIS), function (strSorted) {
            onAnyEvent('\n\n' + strSorted.replace(/\n/g, '\n\t') + '\n\n');
        });
        s.on(String(suman_events_1.events.RUNNER_OVERALL_RESULTS_TABLE), function (overallResultsTableString) {
            onAnyEvent(overallResultsTableString.replace(/\n/g, '\n\t') + '\n\n');
        });
        s.on(String(suman_events_1.events.STANDARD_TABLE), function (table, code) {
            console.log('\n\n');
            let str = table.toString();
            str = code > 0 ? chalk_1.default.yellow.bold(str) : chalk_1.default.gray(str);
            str = '\t' + str;
            console.log(str.replace(/\n/g, '\n\t'));
            console.log('\n');
        });
    }
    return retContainer.ret = {
        results,
        reporterName
    };
});
exports.default = exports.loadReporter;
