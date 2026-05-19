'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = [
    {
        names: ['tsc-multi-watch'],
        type: 'bool',
        help: 'Suman will transpile any changes to .ts files in the project.'
    },
    {
        names: ['force-inception-level-zero'],
        type: 'bool',
        help: 'Force the soon-to-be-spawned suman process to have an inception level of 0.'
    },
    {
        names: ['dummy'],
        type: 'bool',
        help: 'A dummy option useful for various things.'
    },
    {
        names: ['always-exit-zero'],
        type: 'bool',
        hidden: true,
        help: 'With this flag, suman process always exits with code 0, this is useful when the place suman in a CI/CD pipeline ' +
            'but do not want failing to tests to unnecessarily break things.'
    },
    {
        names: ['color', 'force-color'],
        type: 'string',
        help: 'Tells the NPM colors module use control chars for color.',
        env: 'FORCE_COLOR'
    },
    {
        names: ['no-color', 'no-colors'],
        type: 'bool',
        help: 'Tells the NPM colors module to not use any control chars for color.'
    },
    {
        names: ['containerize', 'cntrz', 'ctrz'],
        type: 'bool',
        help: 'Tells Suman to containerize all tests into a Docker container.'
    },
    {
        names: ['debug-hooks', 'log-hooks'],
        type: 'bool',
        help: 'Tells Suman to log when hooks begin/end, for debugging purposes.'
    },
    {
        names: ['debug-tests-and-hooks', 'log-all'],
        type: 'bool',
        help: 'Tells Suman to log when hooks and tests begin/end, for debugging purposes.'
    },
    {
        names: ['stdout-only'],
        type: 'bool',
        help: 'Tells Suman to write everything to stdout, nothing to stderr.'
    },
    {
        names: ['allow-in-place'],
        type: 'bool',
        help: 'Tells Suman to allow files to be transpiled/execute in place (same directory).'
    },
    {
        names: ['version', 'vn'],
        type: 'bool',
        help: 'Print tool version and exit.'
    },
    {
        names: ['default'],
        type: 'bool',
        help: 'Run the files represented by the settings in suman.conf.js.'
    },
    {
        names: ['force-match'],
        type: 'bool',
        help: 'Any files passed at the command line will be run, even if they do not match any regex mentioned in config or command line.'
    },
    {
        names: ['verbosity', 'v'],
        type: 'integer',
        default: 5,
        help: 'Verbosity is an integer between 1 and 9, inclusive; the bigger the number the more verbose; default is 5.'
    },
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Print this help menu and exit.'
    },
    {
        names: ['inherit-stdio', 'log-child-stdio', 'child-stdio'],
        type: 'bool',
        help: 'The Suman runner (parent process) will log stdout/stderr from test child processes; useful' +
            'for simple and quick debugging.'
    },
    {
        names: ['inherit-stdio-match', 'log-child-stdio-match', 'child-stdio-match'],
        type: 'string',
        help: 'The Suman runner (parent process) will log stdout/stderr from child processes; useful for simple and quick debugging.'
    },
    {
        names: ['inherit-all-stdio', 'log-all-child-stdio'],
        type: 'bool',
        help: 'Like the "log-child-stdio" option, but will also log stdout/stderr from @transform processes.'
    },
    {
        names: ['inherit-transform-stdio'],
        type: 'bool',
        help: 'When using the runner, the runner (parent process) will inherit stdout/stderr from test child processes; useful' +
            'for simple and quick debugging.'
    },
    {
        names: ['force-inherit-stdio'],
        type: 'bool',
        help: 'Force inherit stdio, which will use inherit instead of pipe.'
    },
    {
        names: ['touch'],
        type: 'bool',
        help: 'Platform agnostic touch. On *nix systems, it is identical to "$ touch package.json"'
    },
    {
        names: ['init'],
        type: 'bool',
        help: 'Initialize Suman in your project; install it globally first (or use suman-clis.sh).'
    },
    {
        names: ['wait-for-all-transforms', 'wait-for-transforms'],
        type: 'bool',
        help: 'Use this option so that no test is executed until all test sources have fininished transforming/transpiling/compiling.'
    },
    {
        names: ['uninstall-suman'],
        type: 'bool',
        hidden: true,
        help: 'Uninstall Suman in your project. Will clean up various directories safely.'
    },
    {
        names: ['home'],
        type: 'bool',
        help: 'Use this option to cd to the project root.'
    },
    {
        names: ['allow-skip', 'allow-skipped'],
        type: 'bool',
        env: 'SUMAN_ALLOW_SKIP',
        help: 'Allow tests to be skipped.'
    },
    {
        names: ['allow-only'],
        type: 'bool',
        env: 'SUMAN_ALLOW_ONLY',
        help: 'Allow tests to be skipped using the only feature.'
    },
    {
        names: ['series'],
        type: 'bool',
        env: 'SUMAN_SERIES',
        help: 'Absolutely all test cases run in series.'
    },
    {
        names: ['parallel'],
        type: 'bool',
        env: 'SUMAN_PARALLEL',
        help: 'All sibling test cases run in parallel (with a "sane default" cap on parallelism).'
    },
    {
        names: ['parallel-max'],
        type: 'bool',
        env: 'SUMAN_PARALLEL_MAX',
        help: 'Absolutely all test cases run in parallel (with a "sane default cap" on parallelism).'
    },
    {
        names: ['completion'],
        type: 'bool',
        hidden: true,
        help: 'Use this print out the bash completion functions to include in suman-clis.sh.'
    },
    {
        names: ['interactive'],
        type: 'bool',
        help: 'Use this option to generate a well-formed Suman command interactively.'
    },
    {
        names: ['no-tables'],
        type: 'bool',
        help: 'No ascii tables will be outputted to terminal. Accomplished also by verbosity < 2.'
    },
    {
        names: ['reinstall'],
        type: 'arrayOfString',
        help: 'Suman will reinstall any (missing) dependencies. You can use it like so --reinstall=babel-core or --reinstall="babel-core, babel-runtime"'
    },
    {
        names: ['uninstall'],
        type: 'arrayOfString',
        help: 'Suman will *UN-install* the related dependencies.'
    },
    {
        names: ['use-server'],
        type: 'bool',
        hidden: true,
        help: 'Suman will download and install the "suman-server" dependencies necessary for file-watching to your local project.'
    },
    {
        names: ['log-stdio-to-files'],
        type: 'bool',
        help: 'This boolean switch tells Suman to log each test process stdout/stderr to a local file.'
    },
    {
        names: ['log-stdout-to-files'],
        type: 'bool',
        help: 'This boolean switch tells Suman to log each test process stdout (only stdout) to a local file.'
    },
    {
        names: ['log-stderr-to-files'],
        type: 'bool',
        help: 'This boolean switch tells Suman to log each test process stderr (only stderr) to a local file.'
    },
    {
        names: ['errors-only'],
        type: 'bool',
        help: 'Show only errors when logging test results. Also accomplished with verbosity level less than 2.',
        default: false
    },
    {
        names: ['max-depth'],
        type: 'integer',
        help: 'Specifiy the maximum depth to recurse through directories. If you are using this option, you\'re probably doing it wrong. ' +
            '(Organizing your test directory all weird.) But the option is there for you if you need it.',
        default: 8
    },
    {
        names: ['match-any', 'match'],
        type: 'arrayOfString',
        help: 'Use this to filter input to match the given JS regex',
    },
    {
        names: ['match-none', 'match-not', 'not-match', 'no-match'],
        type: 'arrayOfString',
        help: 'Use this to filter input to ignore matches of the given JS regex',
    },
    {
        names: ['match-all', 'match-every'],
        type: 'arrayOfString',
        help: 'Use this to filter input to ignore matches of the given JS regex',
    },
    {
        names: ['append-match-any'],
        type: 'arrayOfString',
        help: 'Use this to filter input to match the given JS regex; append to what is in <suman.conf.js>',
    },
    {
        names: ['append-match-none'],
        type: 'arrayOfString',
        help: 'Use this to filter input to ignore matches of the given JS regex; append to what is in <suman.conf.js>.',
    },
    {
        names: ['append-match-all'],
        type: 'arrayOfString',
        help: 'Use this to filter input to ignore matches of the given JS regex; append to what is in <suman.conf.js>.',
    },
    {
        names: ['use-ts-node-register', 'ts-node-register', 'ts-node', 'tsnode'],
        type: 'bool',
        help: 'Use "ts-node/register" to transpile sources on the fly.'
    },
    {
        names: ['install-babel'],
        type: 'bool',
        help: 'Install default babel dependencies.'
    },
    {
        names: ['use-babel-register', 'babel-register', 'babel'],
        type: 'bool',
        help: 'Use "babel-core/register" to transpile sources on the fly.'
    },
    {
        names: ['no-babel-register', 'no-babel'],
        type: 'bool',
        help: 'Prevent usage of babel-register, even useBabelRegister is set to true in your config.'
    },
    {
        names: ['sort-by-millis'],
        type: 'bool',
        help: 'Prints a duplicate Runner results table sorted by millis fastest to slowest.'
    },
    {
        names: ['create'],
        type: 'arrayOfString',
        help: 'Create suman test skeleton at the path(s) you specified.'
    },
    {
        names: ['coverage', 'cov'],
        type: 'bool',
        help: 'Run Suman tests and see coverage report.'
    },
    {
        names: ['no-coverage-report', 'no-report'],
        type: 'bool',
        help: 'Run Suman tests with coverage but do not output a report.'
    },
    {
        names: ['force-cwd-to-be-project-root', 'cwd-is-project-root', 'force-cwd-as-root'],
        type: 'bool',
        help: 'Run Suman tests and force cwd to be the project root.'
    },
    {
        names: ['force-cwd-to-test-file-dir', 'cwd-is-tfd'],
        type: 'bool',
        help: 'Will force the cwd for the runner child_processes to be the directory that contains the test file.'
    },
    {
        names: ['use-container'],
        type: 'bool',
        help: 'Use this option to force-specify to use a container with --groups and suman.groups.js.'
    },
    {
        names: ['no-use-container'],
        type: 'bool',
        help: 'Use this option to force-specify to not use a container with --groups and suman.groups.js.'
    },
    {
        names: ['allow-duplicate-tests'],
        type: 'bool',
        help: 'Use this option to allow running a test more than once in the same run (with the runner).'
    },
    {
        names: ['allow-reuse-image'],
        type: 'bool',
        help: 'Use this option to force-specify to reuse all container images.'
    },
    {
        names: ['no-allow-reuse-image'],
        type: 'bool',
        help: 'Use this option to force-specify to rebuild all container images.'
    },
    {
        names: ['no-stream-to-file'],
        type: 'bool',
        help: 'Use this option to force-specify that no child process data be streamed to any files.'
    },
    {
        names: ['no-stream-to-console'],
        type: 'bool',
        help: 'Use this option to force-specify that no child process data be streamed to console.'
    },
    {
        names: ['suman-helpers-dir', 'shd'],
        type: 'string',
        hidden: true,
        help: 'Use this option to force-specify the directory that houses the suman helpers files.'
    },
    {
        names: ['recursive', 'R'],
        type: 'bool',
        help: 'Use this option to recurse through sub-directories of tests.'
    },
    {
        names: ['safe'],
        type: 'bool',
        help: 'Reads files in with fs.createReadStream and makes sure it\'s a suman test before running'
    },
    {
        names: ['force', 'f'],
        type: 'bool',
        help: 'Force the command at hand.',
        env: 'SUMAN_FORCE'
    },
    {
        names: ['allow-symlinks'],
        type: 'bool',
        help: 'Allow symlinks to be followed.'
    },
    {
        names: ['fforce', 'ff'],
        type: 'bool',
        help: 'Force the command at hand, with super double force.',
        env: 'SUMAN_FFORCE'
    },
    {
        names: ['convert-from-mocha', 'convert'],
        type: 'bool',
        help: 'Convert Mocha test file or directory to Suman test(s).'
    },
    {
        names: ['bail'],
        type: 'bool',
        help: 'Bail upon the first test error.'
    },
    {
        names: ['use-tap-output', 'use-tap', 'tap'],
        type: 'bool',
        help: 'Use this option to tell the Suman process to output test results as TAP.',
        env: 'SUMAN_TAP'
    },
    {
        names: ['use-tap-json-output', 'use-tap-json', 'tap-json'],
        type: 'bool',
        help: 'Tells the Suman process to output test results as TAP-JSON.',
        env: 'SUMAN_TAP_JSON'
    },
    {
        names: ['suman-shell', 'shell'],
        type: 'bool',
        help: 'Run suman-shell.'
    },
    {
        names: ['ignore-run-config'],
        type: 'bool',
        help: 'Tells Suman runner to ignore @run.sh files.'
    },
    {
        names: ['use-default-config'],
        type: 'bool',
        help: 'Tells Suman to use the default Suman configuration (suman.conf.js file).'
    },
    {
        names: ['no-tap'],
        type: 'bool',
        help: 'Use this option to tell Suman runner to *not* interpret TAP output from child process(es) stdout.'
    },
    {
        names: ['dry-run'],
        type: 'bool',
        help: 'Use this option to tell Suman to log what it will do, without actually doing it.'
    },
    {
        names: ['find-only'],
        type: 'bool',
        help: 'Will use the "json-stdio" library to log runnable file paths to stdout and then exit.'
    },
    {
        names: ['inspect', 'inspect-brk'],
        type: 'bool',
        help: 'Use this option to debug main process.'
    },
    {
        names: ['inspect-child', 'inspect-children'],
        type: 'bool',
        help: 'Use this option debug child processes launched by the runner.'
    },
    {
        names: ['debug-child', 'debug-children'],
        type: 'bool',
        help: 'Use this option to debug child processes launched by the runner.'
    },
    {
        names: ['ignore-break'],
        type: 'bool',
        help: 'Use this option to debug of child processes launched by the runner.'
    },
    {
        names: ['ignore-uncaught-exceptions', 'iue'],
        type: 'bool',
        help: 'Use this option to aid in the debugging of child_processes.'
    },
    {
        names: ['ignore-unhandled-rejections', 'iur'],
        type: 'bool',
        help: 'Use this option to aid in the debugging of child_processes.'
    },
    {
        names: ['runner', 'force-runner'],
        type: 'bool',
        help: 'Sole purpose of this flag is to force the usage of the runner when executing only one test file.'
    },
    {
        names: ['watch', 'w'],
        type: 'bool',
        help: 'Flag to be used so that test files will be transpiled/run as soon as they are saved. Starts up the Suman server if it is not already live,' +
            'and begins watching the files desired.'
    },
    {
        names: ['per'],
        type: 'string',
        help: 'watch-per string must match a key in {suman.conf.js}.watch.per'
    },
    {
        names: ['watch-per', 'wp'],
        type: 'string',
        help: 'watch-per string must match a key in {suman.conf.js}.watch.per.'
    },
    {
        names: ['rand', 'random'],
        type: 'bool',
        help: 'Flag to randomize tests.'
    },
    {
        names: ['concurrency'],
        type: 'integer',
        help: 'Specifiy the maximum number of parallel child processes.'
    },
    {
        names: ['src'],
        type: 'string',
        help: 'Specify single path to directory of Mocha test source files for conversion to Suman from Mocha.'
    },
    {
        names: ['daemon', 'd'],
        type: 'bool',
        help: 'Allows certain Suman processes to run as a daemon.'
    },
    {
        names: ['single-process', 'single', 'sp'],
        type: 'bool',
        help: 'Run multiple test scripts in the same node.js process.'
    },
    {
        names: ['script'],
        type: 'string',
        help: 'Run scripts by key given by the "scripts" object in `suman.conf.js`.'
    },
    {
        names: ['dest'],
        type: 'string',
        help: 'Specify single path as dest directory for conversion to Suman from Mocha.'
    },
    {
        names: ['reporters', 'reporter'],
        type: 'arrayOfString',
        help: 'Specify name of reporters to be used deemed by your config file.'
    },
    {
        names: ['require'],
        type: 'arrayOfString',
        help: 'Specify files to pre-load with require().'
    },
    {
        names: ['test-paths-json'],
        type: 'string',
        help: 'Test paths as JSON array.'
    },
    {
        names: ['replace-ext-with', 'replace-extension-with'],
        type: 'string',
        help: 'Replace test path strings.'
    },
    {
        names: ['replace-match'],
        type: 'string',
        help: 'Replace test path strings.'
    },
    {
        names: ['replace-with'],
        type: 'string',
        help: 'Test paths as JSON array.'
    },
    {
        names: ['reporter-paths', 'reporter-path'],
        type: 'arrayOfString',
        help: 'Specify reporters, by specifying path(s) to reporter module(s) relative to root of project.'
    },
    {
        names: ['postinstall'],
        type: 'bool',
        help: 'Using this option will (re)run the suman postinstall routine. Normally as a Suman user ' +
            'you would want to run the "suman --repair" option instead of the the "suman --postinstall" option.'
    },
    {
        names: ['install-globals'],
        type: 'bool',
        help: 'Run diagnostics to see if something may be wrong with your suman.conf.js file and/or project structure.'
    },
    {
        names: ['diagnostics'],
        type: 'bool',
        help: 'Run diagnostics to see if something may be wrong with your suman.conf.js file and/or project structure.'
    },
    {
        names: ['repair'],
        type: 'bool',
        help: 'Run the "--repair" option to (1) re-install Suman deps that may be corrupted; ' +
            '(2) delete any stray lock files that may exist and should not exist; (3) ensure that certain files, such as ' +
            '@run.sh, @transform.sh, @target, @src, have the correct permissions.'
    },
    {
        names: ['browser'],
        type: 'bool',
        help: 'Tell Suman to run browser tests.'
    },
    {
        names: ['force-transpile'],
        type: 'bool',
        help: 'Force transpile using @transform.sh and @run.sh.'
    },
    {
        names: ['transpile', 't'],
        type: 'bool',
        help: 'Transpile tests to test-target.'
    },
    {
        names: ['no-transpile', 'nt'],
        type: 'bool',
        help: 'Useful when the default is set to transpile:true in your config. Prevents transpilation and runs test files directly.'
    },
    {
        names: ['no-run', 'nr'],
        type: 'bool',
        help: 'When --watch and --transpile are set to true, "--no-run" prevents Suman from executing the resulting tests, when a watched file changes on' +
            'the filesystem. In other words, the file will only be transpiled but not executed as part of the watch process.'
    },
    {
        names: ['full-stack-traces', 'fst'],
        type: 'bool',
        help: 'Full stack traces will be shown for all exceptions, including test failures.'
    },
    {
        names: ['processes', 'procs'],
        type: 'integer',
        help: 'Override config value for maximum number of parallel Node.js processes.'
    },
    {
        names: ['server'],
        type: 'bool',
        hidden: true,
        help: 'Start the suman server manually.'
    },
    {
        names: ['node-flag'],
        type: 'arrayOfString',
        help: 'Pass an argument through command line to the Node.js executable.'
    },
    {
        names: ['exec-arg'],
        type: 'arrayOfString',
        help: 'Pass an argument through command line to the executable.'
    },
    {
        names: ['user-arg', 'arg'],
        type: 'string',
        help: 'Pass child arguments through command line.'
    },
    {
        names: ['child-arg'],
        type: 'arrayOfString',
        help: 'Pass Suman library arguments to child processes through command line. ' +
            'Use --arg=foo --arg=bar to pass arguments to process.argv of child processes.'
    },
    {
        names: ['child-env'],
        type: 'arrayOfString',
        help: 'Pass user arguments through command line.',
        env: 'SUMAN_CHILD_ENV'
    },
    {
        names: ['groups'],
        type: 'bool',
        help: 'Tell Suman to use the groups feature. If no arguments are passed, ' +
            'all groups will be run. Otherwise, only the group ids/names passed will be run.'
    },
    {
        names: ['config', 'cfg'],
        type: 'string',
        help: 'Path to the suman.conf.js file you wish to use.'
    },
    {
        names: ['stdout-silent'],
        type: 'bool',
        help: 'Sends stdout for all test child processes to /dev/null'
    },
    {
        names: ['stderr-silent'],
        type: 'bool',
        help: 'Sends stderr for all test child processes to /dev/null'
    },
    {
        names: ['silent'],
        type: 'bool',
        help: 'Sends stdout/stderr for all test child processes to /dev/null'
    },
    {
        names: ['tail'],
        type: 'bool',
        help: 'Option to tail the suman log files.'
    }
];
