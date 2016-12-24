/**
 * Created by denmanm1 on 3/20/16.
 */


//TODO: replace this.timeout with //t.timeout and tell user that they need to use the new feature for timeouts {timeout:4000}
//TODO: all forEach loops need to have arrow function callbacks
//TODO: this.title needs to be defined in a describe
//http://stackoverflow.com/questions/844001/javascript-regular-expressions-and-sub-matches/844049#844049
//https://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/

const fs = require('fs');
const path = require('path');
const stream = require('stream');

//#npm
const builtinModules = require('builtin-modules');
const chmodr = require('chmodr');

//#project
const sumanUtils = require('suman-utils/utils');
const nfsa = require('./nfsa');

//////////////////////////////////////////////////////////

const coreModuleMatches = new RegExp(`("|')(${ builtinModules.join('|') })\\1`);

const preserveFunctionNames = true;

const regexes = {

    matchesStdFnWith0Args: /function\s*(\S*)\(\s*\)\s*\{/,        // function foo ( ) {
    matchesStdFnWith1Arg: /function\s*(\S*)\s*\(\s*(\S+)\s*\)\s*\{/, ///function\s*\(\s*\S+\s*\)\s*\{/,      // function foo ( ) {
    matchesStdFnWithAnyNumberOfArgs: /function\s*(\S*)\s*\(.*\)\s*\{/, ///function\s*\(\s*\S+\s*\)\s*\{/,      // function foo ( ) {
    matchesArrowFnWith0Args: /\(\s*\)\s*=>\s*\{/,
    matchesArrowFnWith1Arg: /\(\s*\(?\s*(\S+)\s*\)?\s*=>\s*\{/,   // () are optional for one arg
    matchesDescribe: /^\s*describe\s*\(/,
    matchesContext: /^\s*context\s*\(/,
    matchesDescribeSkip: /^\s*describe.skip\s*\(/,
    matchesContextSkip: /^\s*context.skip\s*\(/,
    matchesIt: /^\s*it\s*\(/,
    matchesItSkip: /^\s*it.skip\s*\(/,
    matchesBefore: /^\s*before\s*\(/,
    matchesAfter: /^\s*after\s*\(/,
    matchesBeforeEach: /^\s*beforeEach\s*\(/,
    matchesAfterEach: /^\s*afterEach\s*\(/,
    matchesForEach: /forEach\s*\(\s*function\s*\((.*)\)\s*\{/

};

///////////////////////////////////////////////////////////

const root = sumanUtils.findProjectRoot(process.cwd());
const sumanOpts = global.sumanOpts;
const match = (global.sumanOpts.match || []).map(item => (item instanceof RegExp) ? item : new RegExp(item));
const notMatch = (global.sumanOpts.not_match || []).map(item => (item instanceof RegExp) ? item : new RegExp(item));

console.log('match:', match);
console.log('not match:', notMatch);

////////////////////////////////////////////////////////////

function matchesInput(filename) {
    return match.every(function (regex) {
        return String(filename).match(regex);
    });
}

function doesNotMatchNegativeMatchInput(filename) {
    return notMatch.every(function (regex) {
        return !String(filename).match(regex);
    });
}

function chooseToConvertFile(source) {
    if (path.extname(source) === '.js' && matchesInput(source) && doesNotMatchNegativeMatchInput(source)) {
        return actuallyConvertFile();
    }
    return convertFileDummyThroughStream();
}

module.exports = function convertSrcToDest(opts) {

    var src = opts.src;
    var dest = opts.dest;

    process.on('exit', function () {

        const to = setTimeout(function () {
            process.exit(1);
        }, 20000);

        const folder = path.resolve(path.isAbsolute(dest) ? dest : (root + '/' + dest));
        chmodr(folder, 0o777, function (err) {
            clearTimeout(to);
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
            else {
                process.exit(0);
            }

        });

    });

    if (!path.isAbsolute(src)) {
        src = path.resolve(root + '/' + src);
    }

    if (!path.isAbsolute(dest)) {
        dest = path.resolve(root + '/' + dest);
    }

    //////// delete contents of dest dir //////////////////////

    //var rmDir = function (dirPath) {
    //    try {
    //        var files = fs.readdirSync(dirPath);
    //    }
    //    catch (e) {
    //        return;
    //    }
    //    if (files.length > 0) {
    //        for (var i = 0; i < files.length; i++) {
    //            var filePath = dirPath + '/' + files[i];
    //            if (fs.statSync(filePath).isFile()) {
    //                fs.unlinkSync(filePath);
    //            }
    //            else {
    //                rmDir(filePath);
    //            }
    //        }
    //    }
    //    fs.rmdirSync(dirPath);
    //};
    //
    //try {
    //    rmDir(dest);
    //}
    //catch (err) {
    //    if (!String(err).match(/ENOTDIR/g)) {
    //        throw err;
    //    }
    //}

    /////////////////////////////////////////////////////////////

    try {
        fs.mkdirSync(dest);
    }
    catch (err) {
        if (!global.sumanOpts.force) {
            console.error(err.stack);
            console.log('To overwrite the current directory, use --force');
            return;
        }
        else {
            //TODO: unlink directory
            console.log('\n\nDeleting existing directory has not been implemented yet.');
            console.log('Just delete the destination dir manually, then re-run the command.\n\n');
            return;
        }
    }

    /////////////////////////////////////////////////////////////

    (function recurse(source, dest) {

        fs.readdir(source, function (err, items) {
            if (err) {
                if (!String(err).match(/ENOTDIR/)) {
                    throw err;
                }
                else {
                    try {

                        if (path.extname(dest) === '.js') {
                            try {
                                fs.mkdirSync(path.resolve(dest + '/../'));
                            }
                            catch (err) {
                                if (!String(err).match(/EEXIST/)) {
                                    throw err;
                                }
                            }
                        }
                        else {
                            var statsDest = fs.statSync(dest);
                            if (statsDest.isDirectory()) {
                                dest = path.resolve(dest + '/' + path.basename(source));
                            }
                        }

                        const statsSrc = fs.statSync(source);

                        if (statsSrc.isFile()) {

                            fs.createReadStream(source, {
                                flags: 'r',
                                encoding: 'utf-8',
                                fd: null,
                                bufferSize: 1
                            }).pipe(chooseToConvertFile(source)).pipe(fs.createWriteStream(dest).on('error', function (err) {
                                console.log(' => Suman conversion error => ' + err);
                            })).on('error', function (err) {
                                console.log(' => Suman conversion error => ' + err);
                            });

                        }
                        else {
                            throw new Error('Looks like you passed in a command line argument to convert a file at path="' + source + '"\n' +
                                'but it was not a valid file.');
                        }
                    }
                    catch (err) {
                        throw err; // TODO: better thing to do with this?
                    }
                }
            }
            else {

                items.forEach(function (item) {

                    const srcPath = path.resolve(source + '/' + item);
                    const destPath = path.resolve(dest + '/' + item);

                    fs.stat(srcPath, function (err, stats) {

                        if (err) {
                            throw err;
                        }
                        else {

                            if (stats.isDirectory()) {
                                try {
                                    fs.mkdirSync(destPath);
                                }
                                catch (err) {

                                }
                                recurse(srcPath, destPath);
                            }
                            else if (stats.isFile()) {

                                fs.createReadStream(srcPath, {
                                    flags: 'r',
                                    encoding: 'utf-8',
                                    fd: null,
                                    bufferSize: 1
                                }).pipe(chooseToConvertFile(srcPath))
                                    .pipe(fs.createWriteStream(destPath).on('error', function (err) {
                                            console.log(' => Suman conversion error => ' + err);
                                        })
                                    ).on('error', function (err) {
                                    console.log(' => Suman conversion error => ' + err);
                                });

                            }
                        }
                    });
                });
            }

        });

    })(src, dest);

};

const currentBlockType = {

    'topDescribe': {
        'this.parent': '{formerly:"this.parent"}'
    },

    'describe/context': {
        //no rules needed, original is ok
    },

    'it': {
        'this.test.parent': 'this',
        'this.test': 't'
    },

    'before/after': {
        'this.currentTest': '{formerly:"this.currentTest"}',
        'this.test.parent': 'this',
        'this.test': '{formerly:"this.test"}'
    },

    'beforeEach/AfterEach': {
        'this.currentTest.parent': 'this',
        'this.currentTest': 't',
        'this.test.parent': 'this',
        'this.test': '{formerly:"this.test"}'
    }

};

function convertFileDummyThroughStream() {

    const strm = new stream.Transform({
        objectMode: true
    });

    strm._transform = function (chunk, encoding, done) {

        var data = chunk.toString();
        if (this._lastLineData) {
            data = this._lastLineData + data;
        }

        var lines = data.split('\n');
        this._lastLineData = lines.splice(lines.length - 1, 1)[0];

        lines.forEach(line => {
            this.push(line + '\n');
        });

        done()
    };

    strm._flush = function (done) {
        if (this._lastLineData) {
            this.push(this._lastLineData + '\n');
        }
        this._lastLineData = null;
        done();
    };

    return strm;

}

function actuallyConvertFile() {

    var currentBlock = null;
    const coreModules = [];

    var firstDescribeMatch = false;
    const indexes = {
        'index_of_top_level_describe': null
    };

    function convertLine(strm, index, line) {

        if (line.length < 5) {
            return line;
        }

        const matchesDescribe = line.match(regexes.matchesDescribe);
        const matchesDescribeSkip = line.match(regexes.matchesDescribeSkip);
        const matchesIt = line.match(regexes.matchesIt);
        const matchesItSkip = line.match(regexes.matchesItSkip);
        const matchesContext = line.match(regexes.matchesContext);
        const matchesContextSkip = line.match(regexes.matchesContextSkip);
        const matchesBefore = line.match(regexes.matchesBefore);
        const matchesAfter = line.match(regexes.matchesAfter);
        const matchesBeforeEach = line.match(regexes.matchesBeforeEach);
        const matchesAfterEach = line.match(regexes.matchesAfterEach);
        const matchesStdFnWith0Args = line.match(regexes.matchesStdFnWith0Args);
        const matchesStdFnWith1Arg = line.match(regexes.matchesStdFnWith1Arg);
        const matchesArrowFnWith0Args = line.match(regexes.matchesArrowFnWith0Args);
        const matchesArrowFnWith1Arg = line.match(regexes.matchesArrowFnWith1Arg);
        const coreModuleMatch = line.match(coreModuleMatches);

        if (coreModuleMatch) {
            coreModuleMatch.forEach(function (m) {
                console.log('core module match:', m);
                coreModules.push(m);
            });
        }

        //TODO: need to add context check for top level describe? Probably not

        if (matchesDescribe && !firstDescribeMatch) {
            currentBlock = currentBlockType.topDescribe;
            firstDescribeMatch = true;
            indexes.index_of_top_level_describe = index;
            return line.replace(regexes.matchesDescribe, '_Test.describe(').replace(regexes.matchesStdFnWithAnyNumberOfArgs, ' {}, function(){');
        }

        if (matchesDescribeSkip && !firstDescribeMatch) {
            currentBlock = currentBlockType.topDescribe;
            firstDescribeMatch = true;
            indexes.index_of_top_level_describe = index;
            return line.replace(regexes.matchesDescribeSkip, '_Test.describe.skip(')
                .replace(regexes.matchesStdFnWith0Args, 'function(){')
                .replace(regexes.matchesStdFnWith0Args, 'function(){');
        }

        if (matchesDescribe) {
            currentBlock = currentBlockType['describe/context'];
            return line.replace(regexes.matchesDescribe, '\tthis.describe(').replace(regexes.matchesStdFnWithAnyNumberOfArgs, 'function(){');
        }

        if (matchesDescribeSkip) {
            currentBlock = currentBlockType['describe/context'];
            return line.replace(regexes.matchesDescribeSkip, '\tthis.describe.skip(').replace(regexes.matchesStdFnWithAnyNumberOfArgs, 'function(){');
        }

        if (matchesContext) {
            currentBlock = currentBlockType['describe/context'];
            return line.replace(regexes.matchesContext, '\tthis.context(').replace(regexes.matchesStdFnWithAnyNumberOfArgs, 'function(){');
        }

        if (matchesContextSkip) {
            currentBlock = currentBlockType['describe/context'];
            return line.replace(regexes.matchesContextSkip, '\tthis.context.skip(').replace(regexes.matchesStdFnWithAnyNumberOfArgs, 'function(){');
        }

        var l = null;

        if (matchesBefore) {
            currentBlock = currentBlockType['before/after'];
            //TODO: may need to save the name of functions instead of overwriting them with anon arrow functions
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                l = line.replace(regexes.matchesBefore, '\tthis.before(');
                if (preserveFunctionNames && matchesStdFnWith0Args[1].length > 0) {
                    return l.replace(regexes.matchesStdFnWith0Args, 'function ' + matchesStdFnWith0Args[1] + '(){');
                }
                return l.replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                l = line.replace(regexes.matchesBefore, '\tthis.before.cb(');
                if (preserveFunctionNames && matchesStdFnWith1Arg[1].length > 0) {
                    return l.replace(regexes.matchesStdFnWith1Arg, 'function '
                        + matchesStdFnWith1Arg[1] + '(t){\n ' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
                }
                return l.replace(regexes.matchesStdFnWith1Arg,
                    't => {\n ' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else if (matchesArrowFnWith0Args && matchesArrowFnWith0Args.length === 1) {
                return line.replace(regexes.matchesBefore, '\tthis.before(').replace(regexes.matchesArrowFnWith0Args, '' +
                    't => {');
            }
            else if (matchesArrowFnWith1Arg && matchesArrowFnWith1Arg.length === 1) {
                return line.replace(regexes.matchesBefore, '\tthis.before.cb(').replace(regexes.matchesArrowFnWith1Arg,
                    '(t => {\n ' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                console.error('Warning: File may not be converted correctly => the following line is problematic => \n' + line);
                return line.replace(regexes.matchesBefore, '\tthis.before.cb(');
            }
        }

        if (matchesAfter) {
            currentBlock = currentBlockType['before/after'];
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                l = line.replace(regexes.matchesAfter, '\tthis.after(');
                if (preserveFunctionNames && matchesStdFnWith0Args[1].length > 0) {
                    return l.replace(regexes.matchesStdFnWith0Args, 'function ' + matchesStdFnWith0Args[1] + '(){');
                }
                return l.replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                l = line.replace(regexes.matchesAfter, '\tthis.after.cb(');
                if (preserveFunctionNames && matchesStdFnWith1Arg[1].length > 0) {
                    return l.replace(regexes.matchesStdFnWith1Arg,
                        'function ' + matchesStdFnWith1Arg[1] + '(t){\n ' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
                }
                return l.replace(regexes.matchesStdFnWith1Arg,
                    't => {\n\t' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else if (matchesArrowFnWith0Args && matchesArrowFnWith0Args.length === 1) {
                return line.replace(regexes.matchesAfter, '\tthis.after(').replace(regexes.matchesArrowFnWith0Args,
                    't => {');
            }
            else if (matchesArrowFnWith1Arg && matchesArrowFnWith1Arg.length === 1) {
                return line.replace(regexes.matchesAfter, '\tthis.after.cb(').replace(regexes.matchesArrowFnWith1Arg,
                    '(t => {\n\t' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                console.error('\n => Warning: File may not be converted correctly => the following line is problematic => \n' + line,'\n');
                return line.replace(regexes.matchesAfter, '\tthis.after.cb(');

            }

        }

        if (matchesBeforeEach) {
            currentBlock = currentBlockType['beforeEach/AfterEach'];
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                return line.replace(regexes.matchesBeforeEach, '\tthis.beforeEach(').replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                return line.replace(regexes.matchesBeforeEach, '\tthis.beforeEach.cb(').replace(regexes.matchesStdFnWith1Arg,
                    't => {\n\t' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                console.error('\nWarning: File may not be converted correctly => the following line is problematic => \n' + line,'\n');
                return line.replace(regexes.matchesBeforeEach, '\tthis.beforeEach.cb(');
            }
        }

        if (matchesAfterEach) {
            currentBlock = currentBlockType['beforeEach/AfterEach'];
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                return line.replace(regexes.matchesAfterEach, '\tthis.afterEach(').replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                return line.replace(regexes.matchesAfterEach, '\tthis.afterEach.cb(').replace(regexes.matchesStdFnWith1Arg,
                    't => {\n\t' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                console.error('\n','Warning: File may not be converted correctly => the following line is problematic => \n' + line,'\n');
                return line.replace(regexes.matchesAfterEach, '\tthis.afterEach.cb(');
            }
        }

        if (matchesIt && matchesIt.length > 0) {
            currentBlock = currentBlockType['it'];
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                return line.replace(regexes.matchesIt, '\tthis.it(').replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                return line.replace(regexes.matchesIt, '\tthis.it.cb(').replace(regexes.matchesStdFnWith1Arg,
                    't => {\n\t' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                // throw new Error('File cannot be converted => the following line is problematic => \n' + line);
                console.log(' => Suman warning => Suman assumes stubbed test @line = "', line, '"');
                return line.replace(regexes.matchesIt, '\tthis.it.cb(');
            }
        }

        if (matchesItSkip && matchesItSkip.length > 0) {
            currentBlock = currentBlockType['it'];
            if (matchesStdFnWith0Args && matchesStdFnWith0Args.length > 1) {
                return line.replace(regexes.matchesItSkip, '\tthis.it.skip(').replace(regexes.matchesStdFnWith0Args, 't => {');
            }
            else if (matchesStdFnWith1Arg && matchesStdFnWith1Arg.length > 1) {
                return line.replace(regexes.matchesItSkip, '\tthis.it.skip(').replace(regexes.matchesStdFnWith1Arg,
                    't => {\n ' + 'var ' + matchesStdFnWith1Arg[2] + ' = t.done;');
            }
            else {
                // throw new Error('File cannot be converted => the following line is problematic => \n' + line);
                return line.replace(regexes.matchesItSkip, '\tthis.it.skip(');
            }
        }

        if (currentBlock) {
            const regexz = Object.keys(currentBlock);
            regexz.forEach(function (regexStr) {
                line = line.replace(new RegExp(regexStr, 'g'), currentBlock[regexStr]);
            });
        }

        if (currentBlock /*&& (currentBlock === currentBlockType['describe/context']) || currentBlock === currentBlockType.topDescribe*/) {

            const matchForEach = line.match(regexes.matchesForEach);
            if (matchForEach && matchForEach.length > 1) {
                line = line.replace(regexes.matchesForEach, 'forEach((' + matchForEach[1] + ') => {')
            }

        }

        return line;

    }

    const strm = new stream.Transform({
        objectMode: true
    });

    strm.$currentIndex = 0;
    strm.$indexes = [];

    var firstPass = true;

    strm._transform = function (chunk, encoding, done) {

        if (firstPass) {
            firstPass = false;
            this.push('\n');
            this.push('/*\n');
            nfsa.forEach(msg => {
                this.push(msg + '\n');
            });
            this.push('*/\n\n');
            this.push('const suman = require(\'suman\');' + '\n');
            this.push('const _Test = suman.init(module);' + '\n');
            this.push('\n');
        }

        var data = chunk.toString();
        if (this._lastLineData) {
            data = this._lastLineData + data;
        }

        var lines = data.split('\n');
        this._lastLineData = lines.splice(lines.length - 1, 1)[0];

        lines.forEach(line => {
            line = convertLine(this, this.$currentIndex++, line);
            this.push(line + '\n');
        });

        done()
    };

    strm._flush = function (done) {
        if (this._lastLineData) {
            this.push(this._lastLineData + '\n');
        }
        this._lastLineData = null;
        done();
    };

    function finishConversion(strm) {

        var data = strm[indexes.index_of_top_level_describe];
        data = data.replace('function(){', 'function(' + coreModules.filter(function (item) {
                return !String(item).match(/('|")/g);
            }).join(',') + '){');

        result.splice(indexes.index_of_top_level_describe, 1, data);
    }

    return strm;

}

