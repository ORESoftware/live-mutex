'use striiict';

module.exports = [
  {
    names: ['all', 'a'],
    type: 'bool',
    help: 'Used in conjunction with the --transpile option, to transpile the whole test directory to test-target.'
  },
  {
    names: ['fast'],
    type: 'bool',
    help: 'Used in conjunction with the --interactive option.'
  },
  {
    name: 'no-color',
    type: 'bool',
    help: 'Tells the NPM colors module to not use any control chars for color.'
  },
  {
    name: 'version',
    type: 'bool',
    help: 'Print tool version and exit.'
  },
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['touch'],
    type: 'bool',
    help: 'Platform agnostic touch. On *nix systems, it is identical to "$ touch package.json"'
  },
  {
    names: ['verbose', 'v'],
    type: 'arrayOfBool',
    help: 'Verbose output. Use multiple times for more verbose.'
  },
  {
    names: ['vverbose', 'vv'],
    type: 'bool',
    help: 'Very verbose output. There is either verbose or very verbose (vverbose).'
  },
  {
    names: ['sparse'],
    type: 'bool',
    help: 'Sparse output. Less verbose than standard.'
  },
  {
    names: ['vsparse'],
    type: 'bool',
    help: 'Very sparse output. Even less verbose than sparse option.'
  },
  {
    names: ['init'],
    type: 'bool',
    help: 'Initialize Suman in your project; install it globally first.'
  },
  {
    names: ['uninstall'],
    type: 'bool',
    help: 'Uninstall Suman in your project.'
  },
  {
    names: ['no-runner-lock'],
    type: 'bool',
    help: 'Don\'t user runner lock'
  },
  {
    names: ['runner-lock'],
    type: 'bool',
    help: 'Use a global runner lock'
  },
  {
    names: ['interactive'],
    type: 'bool',
    help: 'Use this option to generate a well-formed Suman command interactively.'
  },
  {
    names: ['no-tables'],
    type: 'bool',
    help: 'No ascii tables will be outputted to terminal. Accomplished also by "--vsparse" boolean option'
  },
  {
    names: ['use-babel'],
    type: 'bool',
    help: 'Suman will download and install the necessary "babel" dependencies necessary to transpile to your local project. You could do this' +
    'yourself manually or Suman will do it intelligently for you.'
  },
  {
    names: ['uninstall-babel'],
    type: 'bool',
    help: 'Suman will * uninstall * the "babel" related dependencies that were necessary to transpile to your local project.'
  },
  {
    names: ['remove-babel', 'rm-babel'],  // this flag is only used when uninstalling suman as well
    type: 'bool',
    help: 'Suman will * uninstall * the "babel" related dependencies necessary to transpile to your local project.'
  },
  {
    names: ['use-server'],
    type: 'bool',
    help: 'Suman will download and install the "suman-server" dependencies necessary for file-watching to your local project.'
  },
  {
    names: ['use-istanbul'],
    type: 'bool',
    help: 'Suman will download and install the Istanbul dependencies necessary to run test coverage on your local project. You could do this' +
    'yourself manually or you can tell Suman to do it for you intelligently.'
  },
  {
    names: ['errors-only'],
    type: 'bool',
    help: 'Show only errors when logging test results. Also accomplished with the vsparse option.',
    default: false
  },
  {
    names: ['max-depth'],
    type: 'integer',
    help: 'Specifiy the maximum depth to recurse through directories. If you are using this option, you\'re probably doing it wrong. ' +
    '(Organizing your test directory all weird.) But the option is there for you if you need it.',
    default: 69+1
  },
  {
    names: ['match-any'],
    type: 'arrayOfString',
    help: 'Use this to filter input to match the given JS regex',
  },
  {
    names: ['match-none'],
    type: 'arrayOfString',
    help: 'Use this to filter input to ignore matches of the given JS regex',
  },
  {
    names: ['match-all'],
    type: 'arrayOfString',
    help: 'Use this to filter input to ignore matches of the given JS regex',
  },
  {
    names: ['append-match-any'],
    type: 'arrayOfString',
    help: 'Use this to filter input to match the given JS regex',
  },
  {
    names: ['append-match-none'],
    type: 'arrayOfString',
    help: 'Use this to filter input to ignore matches of the given JS regex',
  },
  {
    names: ['append-match-all'],
    type: 'arrayOfString',
    help: 'Use this to filter input to ignore matches of the given JS regex',
  },
  {
    names: ['babel-register', 'use-babel-register'],
    type: 'bool',
    help: 'Use babel-core register to transpile sources on the fly, even in child processes.'
  },
  {
    names: ['no-babel-register', 'no-use-babel-register'],
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
    names: ['coverage'],
    type: 'bool',
    help: 'Run Suman tests and see coverage report.'
  },
  {
    names: ['library-coverage'],
    type: 'bool',
    help: 'Internal flag to run coverage on the suman library itself.'
  },
  {
    names: ['force-cwd-to-be-project-root', 'cwd-is-root'],
    type: 'bool',
    help: 'Run Suman tests and force cwd to be the project root.'
  },
  {
    names: ['force-cwd-to-test-file-dir', 'cwd-is-tfd'],
    type: 'bool',
    help: 'Will force the cwd for the runner child_processes to be the directory that contains the test file.'
  },
  {
    names: ['test-file-mask', 'tfm'],
    type: 'string',
    help: 'Use this option to specify which of files.'
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
    internal: true,  //only visible to lib authors?
    help: 'Use this option to force-specify the directory that houses the suman helpers files.'
  },
  {
    names: ['recursive', 'r'],
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
    help: 'Force the command at hand.'
  },
  {
    names: ['fforce', 'ff'],
    type: 'bool',
    help: 'Force the command at hand, with super double force.'
  },
  {
    names: ['pipe', 'p'],
    type: 'bool',
    help: 'Pipe data to Suman using stdout to stdin.'
  },
  {
    names: ['convert', 'cnvt'],
    type: 'bool',
    help: 'Convert Mocha test file or directory to Suman test(s).'
  },
  {
    names: ['bail', 'b'],
    type: 'bool',
    help: 'Bail upon the first test error.'
  },
  {
    names: ['ignore-break'],
    type: 'bool',
    help: 'Use this option to aid in the debugging of child_processes.'
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
    names: ['runner', 'rnr'],
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
    names: ['stop-watching-all', 'swa'],
    type: 'bool',
    help: 'Flag so that Suman server stops watching all files for any changes.'
  },
  {
    names: ['rand', 'random'],
    type: 'bool',
    help: 'Flag to randomize tests.'
  },
  {
    names: ['testing'],
    type: 'bool',
    help: 'Internal flag for development purposes.'
  },
  {
    names: ['stop-watching', 'sw'],
    type: 'bool',
    help: 'Option to tell Suman server to stop watching the files/directories passed as arguments.'
  },
  {
    names: ['concurrency', 'mpp'],
    type: 'integer',
    help: 'Specifiy the maximum number of parallel child processes.'
  },
  {
    names: ['src'],
    type: 'string',
    help: 'Specify single path to directory of Mocha test source files for conversion to Suman from Mocha.'
  },
  {
    names: ['daemon','d'],
    type: 'bool',
    help: 'Allows certain Suman processes to run as a daemon.'
  },
  {
    names: ['dest'],
    type: 'string',
    help: 'Specify single path as dest directory for conversion to Suman from Mocha.'
  },
  {
    names: ['reporters'],
    type: 'arrayOfString',
    help: 'Specify name of reporters to be used deemed by your config file.'
  },
  {
    names: ['reporter-paths'],
    type: 'arrayOfString',
    help: 'Specify reporters by specifying path(s) to reporter module(s).'
  },
  {
    names: ['diagnostics'],
    type: 'bool',
    help: 'Run diagnostics to see if something may be wrong with your suman.conf.js file and/or project structure.'
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
    names: ['no-run'],
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
    names: ['server', 's'],
    type: 'bool',
    help: 'Start the suman server manually.'
  },
  {
    names: ['group'],
    type: 'arrayOfString',
    help: 'Tell Suman to use the group with the given name.'
  },
  {
    names: ['groups'],
    type: 'bool',
    help: 'Tell Suman to use the groups feature. If no arguments are passed, all groups will be run. Otherwise, only the group ids/names passed will be run.'
  },
  {
    names: ['config', 'cfg'],
    type: 'string',
    help: 'Path to the suman.conf.js file you wish to use.'
  },
  {
    names: ['no-silent'],
    type: 'bool',
    help: 'When running a single test file, stdout will be shown.'
  },
  {
    names: ['grep-suite', 'gs'],
    type: 'string',
    help: 'Path to the suman.conf.js file you wish to use.'
  },
  {
    names: ['server-name', 'sn'],
    type: 'string',
    help: 'Path to the suman.conf.js file you wish to use.'
  },
  {
    names: ['tail'],
    type: 'bool',
    help: 'Option to tail the suman log files.'
  }
];
