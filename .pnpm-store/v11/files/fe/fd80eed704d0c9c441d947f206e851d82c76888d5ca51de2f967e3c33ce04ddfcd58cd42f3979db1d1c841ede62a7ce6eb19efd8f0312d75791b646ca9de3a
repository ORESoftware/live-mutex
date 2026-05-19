'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var residence = require("residence");
var dashdash = require("dashdash");
var index = require(".");
var log = require("./lib/logging");
var projectRoot = residence.findProjectRoot(process.cwd());
if (!projectRoot) {
    log.error('your project root could not be found.');
    process.exit(1);
}
var sumanConf;
try {
    sumanConf = require(projectRoot + '/suman.conf.js');
}
catch (err) {
    log.error('cannot find suman.conf.js in your project root.');
    log.error("your project root was presumed to be: " + projectRoot + ".");
    process.exit(1);
}
var testDir = process.env.TEST_DIR = sumanConf.testDir;
if (!testDir) {
    testDir = process.env.TEST_DIR = path.resolve(projectRoot + '/test');
}
log.info('testDir => ', testDir);
var options = require('./lib/cmd-opts');
var opts, parser = dashdash.createParser({ options: options });
try {
    opts = parser.parse(process.argv);
}
catch (e) {
    console.error('There was an error parsing a Suman-Watch CLI option:\n%s', e.message);
    process.exit(1);
}
log.info("# opts:", opts);
log.info("# args:", opts._args);
if (opts.help) {
    var help = parser.help({ includeEnv: true }).trimRight();
    console.log('usage: node foo.js [OPTIONS]\n'
        + 'options:\n'
        + help);
    process.exit(0);
}
index.run(opts, function (err) {
    if (err)
        throw err;
    log.good('watch process ready.');
});
