'use strict';


const os = require('os');
const path = require('path');
const numOfCPUs = os.cpus().length || 1;
const pckgDotJson = require('./package.json');

//////////////////////////////////////////////////////////

module.exports = Object.freeze({

    matchAny: [/.js$/, /.sh$/],              //recommended =>  match: ['.test.js'],
    matchNone: [/fixture/, /correct-exit-codes/],
    matchAll: [],
    testDir: 'test',
    testSrcDir: 'test/testsrc',
    testTargetDir: 'test/test-target',
    sumanHelpersDir: 'test/_suman',
    defaultTestSuiteTimeout: 150000,
    transpile: false,
    maxParallelProcesses: Math.max(6, numOfCPUs),
    safe: false, //reads files in with fs.createReadStream and makes sure it's a suman test before running
    verbose: true, //handles and logs warnings (using warning level?)
    checkMemoryUsage: false,
    fullStackTraces: false,
    uniqueAppName: pckgDotJson.name || 'sumanX',
    DEFAULT_NODE_ENV: 'development',
    browser: 'Firefox',
    disableAutoOpen: false,
    expireResultsAfter: '10000000',
    resultsCapCount: 100,
    suppressRunnerOutput: true,
    resultsCapSize: 7000, // 3 gb's,

    ////////////

    useBabelRegister: true,

    watch: {
        '//tests': {
            script: function (p) {
                return `./node_modules/.bin/suman ${p}`
            },
            include: [],
            exclude: ['^test.*']
        },

        '//project': {
            script: 'suman --no-color test/testsrc/es5-es6/integration-tests',
            include: [__dirname],
            exclude: []
        },
    },

    reporters: {
        'suman-example-reporter': require('suman-example-reporter'),
        'tap': 'suman/reporters/tap',
        'std': '',
        'progress': './lib/reporters/progress-reporter'
    },

    servers: {
        'xps': {
            host: '127.0.0.1',
            port: 6969,
        },
        'cse-1s-dhcp--98-213.eng.vmware.com': {
            host: '127.0.0.1',
            port: 6969,
        },
        'CACSVML-16845': {
            host: '127.0.0.1',
            port: 6969,
        },
        'denman-lenovo': {
            host: '127.0.0.1', //10.172.47.79
            port: 6969,
        },
        'CACSVML-13295.local': {
            host: '127.0.0.1',
            port: 6969,
        },
        'smartconnect.sjc.i.sv.comcast.com': {
            host: '69.252.255.134',
            port: 6969,
        },
        'dev85.plaxo.com': {
            host: '172.20.3.31',
            port: 6969,
        },
        // 'Alexanders-MacBook-Pro.local': {
        //     host: 'localhost',
        //     port: 6969
        // }
    }

});
