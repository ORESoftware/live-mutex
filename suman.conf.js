// => The Suman config file, should always remain at the root of your project
// => For more info, see =>  oresoftware.github.io/suman/conf.html
// => If transpile is true, Suman will put your babel deps in ~/.suman/node_modules


const os = require('os');
const path = require('path');
const numOfCPUs = os.cpus().length || 1;
// const pckgDotJson = require(path.resolve(__dirname, 'package.json'));


module.exports = Object.freeze({

  //regex
  matchAny: [/\.ts$/],                              //recommended regex for "matchAny" => [/\.test\.js$/],
  matchNone: [/fixture/, /.*target/],        //recommended regex for "matchNone" => [/fixture/],
  matchAll: [],                 //recommended regex for "matchAll" => [],

  //string
  testDir: 'test',
  sumanHelpersDir: 'test/.suman',
  uniqueAppName: '<your-app-name-here>',
  browser: 'Firefox',                 // browser to open test results with

  //boolean
  errorsOnly: false,
  replayErrorsAtRunnerEnd: true,
  allowArrowFunctionsForTestSuites: false,
  alwaysUseRunner: false,                     //always run your individual tests in child process
  enforceGlobalInstallationOnly: false,
  enforceLocalInstallationOnly: false,
  sourceTopLevelDepsInPackageDotJSON: false,
  enforceTestCaseNames: true,
  enforceBlockNames: true,
  enforceHookNames: false,
  bail: true,                     // when running one file, bail will bail test at first test failure
  bailRunner: true,               // when using the runner, bail will bail runner at first test failure in any file
  transpile: false,                      // transpile is false by default, can be overridden with command line also
  executeRunnerCWDAtTestFile: true,   // if false, CWD for runner will be project root dir
  sendStderrToSumanErrLogOnly: true,
  useSuiteNameInTestCaseOutput: false,
  ultraSafe: false,                   //if true, Suman reads files before executing any supposed test file and makes sure it's a suman test before running
  verbose: true,                      //handles and logs warnings (using warning level?)
  checkMemoryUsage: false,            //limits stack traces to just relevant test case or test line
  fullStackTraces: false,             //allows you to view more than 3 lines for errors in test cases and hooks
  disableAutoOpen: false,             // use true if you never want suman to automatically open the browser to the latest test results
  suppressRunnerOutput: true,         // this defaults to true, use no-silent or silent to switch value
  allowCollectUsageStats: true,       // allow Suman to collect usage information (no performance penalty)

  //integers
  verbosity: 5,
  maxParallelProcesses: Math.max(6, numOfCPUs),           //maximum parallel processes running at one time, synonymous with --concurrency cmd line option
  resultsCapCount: 100,               // test results will be deleted if they are 101st oldest run
  resultsCapSize: 7000, // 3 gb's     // oldest test results will be deleted if the results dir expands beyond this size

  //integers in millis
  defaultHookTimeout: 5000,
  defaultTestCaseTimeout: 5000,
  timeoutToSearchForAvailServer: 2000,
  defaultDelayFunctionTimeout: 8000,
  defaultChildProcessTimeout: 8000000,    //used with Suman runner, to kill child process if it has not exited beforehand
  defaultTestSuiteTimeout: 15000,
  expireResultsAfter: 10000000,     // test results will be deleted after this amount of time


  coverage: {
    nyc: {
      use: false,

    },
    istanbul: {}
  },

  watch: {

    '//tests': {
      'default': {  // (re) execute the test file that changed
        script: function (p) {
          return `./node_modules/.bin/suman ${p}`
        },
        include: [],
        exclude: ['^test.*']
      }
    },

    '//project': {
      'default': {  //run all tests when a file changes in project
        script: './node_modules/.bin/suman',
        include: [],
        exclude: ['^test.*']
      }

    },
  },

  reporters: {
    'tap': 'suman/reporters/tap'
  },

  servers: {                           // list of servers to output test result data to, with the os.hostname() as the key

    '*default': {
      host: '127.0.0.1',
      port: 6969
    },

    '###': {   /// replace this with user's local machines os.hostname()
      host: '127.0.0.1',
      port: 6969
    },

  },

  useBabelRegister: false,
  babelRegisterOpts: {

    // Optional ignore regex - if any filenames match this regex then they
    // aren't compiled.
    ignore: /fixture/,

    // Ignore can also be specified as a function.
    // ignore: function(filename) {
    // 	if (filename === '/path/to/es6-file.js') {
    // 		return false;
    // 	} else {
    // 		return true;
    // 	}
    // },

    // Optional only regex - if any filenames *don't* match this regex then they
    // aren't compiled
    // only: /my_es6_folder/,

    // Setting this will remove the currently hooked extensions of .es6, `.es`, `.jsx`
    // and .js so you'll have to add them back if you want them to be used again.
    extensions: ['.es6', '.es', '.jsx', '.js']
  }

});
