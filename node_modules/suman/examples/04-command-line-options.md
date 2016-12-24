



usage: suman [file/dir] [OPTIONS]

options:
    -a, --all                           Used in conjunction with the --transpile
                                        option, to transpile the whole test
                                        directory to test-target.
                                        
    --version                           Print tool version and exit.
    
    -h, --help                          Print this help and exit.
    
    -v, --verbose                       Verbose output. Use multiple times for
                                        more verbose.
                                        
    --vv, --vverbose                    Very verbose output. There is either
                                        verbose or very verbose (vverbose).
                                        
    --sparse                            Sparse output. Less verbose than
                                        standard.
                                        
    --vsparse                           Very sparse output. Even less verbose
                                        than sparse option.
                                        
    --init                              Initialize Suman in your project;
                                        install it globally first.
                                        
    --uninstall                         Uninstall Suman in your project.
    
    --no-runner-lock                    Don't user runner lock.
    
    --runner-lock                       Use a global runner lock.
    
    --no-tables                         No ascii tables will be outputted to
                                        terminal. Accomplished also by
                                        "--vsparse" boolean option.
                                        
    --use-babel                         Suman will download and install the
                                        "babel" related dependencies necessary
                                        to transpile to your local project.
                                        
    --rm-babel, --remove-babel          Suman will * uninstall * the "babel"
                                        related dependencies necessary to
                                        transpile to your local project.
                                        
    --use-server                        Suman will download and install the
                                        "suman-server" dependencies necessary
                                        for file-watching to your local project.
                                        
    --use-istanbul                      Suman will download and install the
                                        Istanbul dependencies necessary to run
                                        test coverage on your local project.
                                        
    --errors-only                       Show only errors when logging test
                                        results.
                                        
    --match=ARG                         Use this to filter input to match the
                                        given JS regex.
                                        
    --not-match=ARG                     Use this to filter input to ignore
                                        matches of the given JS regex.
                                        
    --register                          Use babel-core register to transpile
                                        sources on the fly, even in child
                                        processes.
                                        
    --no-register                       Prevent usage of babel-register.
    
    --sort-by-millis                    Prints a duplicate Runner results table
                                        sorted by millis fastest to slowest.
                                        
    --create=ARG                        Create suman test skeleton at path.
    
    --coverage                          Run Suman tests and see coverage report.
    
    --cwd-is-root, --force-cwd-to-be-project-root
                                        Run Suman tests and force cwd to be the
                                        project root.
                                        
    --cwd-is-tfd, --force-cwd-to-test-file-dir
                                        Will force the cwd for the runner
                                        child_processes to be the directory that
                                        contains the test file.
                                        
    --tfm=ARG, --test-file-mask=ARG     Use this option to specify which of
                                        files.
                                        
    -r, --recursive                     Use this option to recurse through
                                        sub-directories of tests.
                                        
    --safe                              Reads files in with fs.createReadStream
                                        and makes sure it's a suman test before
                                        running.
                                        
    -f, --force                         Force the command at hand.
    
    --ff, --fforce                      Force the command at hand, with super
                                        double force.
                                        
    -p, --pipe                          Pipe data to Suman using stdout to
                                        stdin.
                                        
    --cnvt, --convert                   Convert Mocha test file or directory to
                                        Suman test(s).
                                        
    -b, --bail                          Bail upon the first test error.
    
    --ignore-break                      Use this option to aid in the debugging
                                        of child_processes.
                                        
    --rnr, --runner                     Sole purpose of this flag is to force
                                        the usage of the runner when executing
                                        only one test file.
                                        
    -w, --watch                         Flag to be used so that test files will
                                        be transpiled/run as soon as they are
                                        saved. Starts up the Suman server if it
                                        is not already live,and begins watching
                                        the files desired.
                                        
    --wp, --watch-project               Watch all project files and upon changes
                                        run the script/command given by the
                                        properties of "watchProject" in your
                                        suman.conf.js file.
                                        
    --swa, --stop-watching-all          Flag so that Suman server stops watching
                                        all files for any changes.
                                        
    --rand, --random                    Flag to randomize tests.
    
    --testing                           Internal flag for development purposes.
    
    --sw, --stop-watching               Option to tell Suman server to stop
                                        watching the files/directories passed as
                                        arguments.
                                        
    --mpp=INT, --concurrency=INT        Specifiy the maximum number of parallel
                                        child processes.
                                        
    --src=ARG                           Specify single path to directory of
                                        Mocha test source files for conversion
                                        to Suman from Mocha.
                                        
    --dest=ARG                          Specify single path as dest directory
                                        for conversion to Suman from Mocha.
                                        
    --reporters=ARG                     Specify name of reporters to be used
                                        deemed by your config file.
                                        
    --reporter-paths=ARG                Specify reporters by specifying path(s)
                                        to reporter module(s).
                                        
    --diagnostics                       Run diagnostics to see if something may
                                        be wrong with your suman.conf.js file
                                        and/or project structure.
                                        
    -t, --transpile                     Transpile tests to test-target.
    
    --nt, --no-transpile                Useful when the default is set to
                                        transpile:true in your config. Prevents
                                        transpilation and runs test files
                                        directly.
                                        
    --no-run                            When --watch and --transpile are set to
                                        true, "--no-run" prevents Suman from
                                        executing the resulting tests, when a
                                        watched file changes onthe filesystem.
                                        In other words, the file will only be
                                        transpiled but not executed as part of
                                        the watch process.
                                        
    --fst, --full-stack-traces          Full stack traces will be shown for all
                                        exceptions, including test failures.
                                        
    --procs=INT, --processes=INT        Override config value for maximum number
                                        of parallel Node.js processes.
                                        
    -s, --server                        Start the suman server manually.
    
    --cfg=ARG, --config=ARG             Path to the suman.conf.js file you wish
                                        to use.
    --gfbn=ARG, --grep-file-base-name=ARG
                                        Regex string used to match file names;
                                        only the basename of the file path.
    --no-silent                         When running a single test file, stdout
                                        will be shown.
                                        
    --gf=ARG, --grep-file=ARG           Regex string used to match file names.
    
    --gs=ARG, --grep-suite=ARG          Path to the suman.conf.js file you wish
                                        to use.
                                        
    --sn=ARG, --server-name=ARG         Path to the suman.conf.js file you wish
                                        to use.
                                        
    --tail                              Option to tail the suman log files.

