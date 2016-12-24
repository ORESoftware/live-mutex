/**
 * Created by denmanm1 on 3/20/16.
 */


const fs = require('fs');
const path = require('path');

//#npm
const builtinModules = require('builtin-modules');


module.exports = function convertSrcToDest(source,dest){

};

const file = fs.readFileSync(path.resolve(__dirname + '/../../test/mocha-conversion-tests/mocha-test0.js'), 'utf8');

const lines = String(file).split('\n');  //replace all lines but new line chars

console.log(lines);

const result = [];

//const coreModuleMatches = /'^(var|const|,)[a-z\$\_]{1,}=require\((\'|")(assert|fs|path)(\'|")\)[;|,]{0,1}$/;

//const coreModuleMatches = '^\s*(?:var|const|,)\s*([a-z$_]+\s*=\s*require\((\'|")(?:(' + builtinModules.join('|') + '))\2\),?[\n\r\t\s]*)*;$';

//const coreModuleMatches = `^\s*(var|const|,)\s*[a-zA-Z\_\$]+\s*=\s*require\(('|")(${builtinModules.join('|')})('|")\)`;

//const coreModuleMatches = new RegExp(`require\(('|")(${builtinModules.join('|')})('|")\)`);

const coreModuleMatches  = new RegExp(`("|')(${ builtinModules.join('|') })\\1`);
//var rgxStr = 'require\(("|\')' + builtinModules.join('|') + '("|\')\)\\1';

console.log('rgxStr:', coreModuleMatches);

//var coreModuleMatches = new RegExp(rgxStr);

const coreModules = [];

var firstDescribeMatch = false;

const indexes = {
    'index_of_top_level_describe': null
};

lines.forEach(function (line, index) {

    const matchesDescribe = line.match(/^\s*describe\(/);
    const matchesIt = line.match(/^\s*it\(/);
    const matchesFn = line.match(/function\(\){/);
    const matchesFnWithDone = line.match(/function\([a-z\$\_]{1,}\){/);
    const coreModuleMatch = line.match(coreModuleMatches);

    if (coreModuleMatch) {
        coreModuleMatch.forEach(function (m) {
            console.log('core module match:', m);
            coreModules.push(m);
        });
    }

    if (matchesDescribe && !firstDescribeMatch) {
        firstDescribeMatch = true;
        indexes.index_of_top_level_describe = index;
        result.push(line.replace(/^\s*describe\(/, 'Test.describe(').replace('function(){', 'function(){'));
        return;
    }

    if (matchesDescribe) {
        firstDescribeMatch = true;
        result.push(line.replace(/^\s*describe\(/, 'this.describe(').replace('function(){', 'function(){'));
        return;
    }

    if (matchesIt && matchesIt.length > 0) {
        if (matchesFn && matchesFn.length === 1) {
            result.push(line.replace('it(', 'this.it(').replace('function(){', 'function(t){'));
            return;
        }
        else if (matchesFnWithDone && matchesFnWithDone.length === 1) {
            result.push(line.replace('it(', 'this.it(').replace(/function\([a-z]{1,}\){/, 'function(t,done){'));
            return;
        }
        else if (matchesFn && matchesFn.length > 1) {
            throw new Error('File cannot be converted.');
        }
    }

    result.push(line);

});


var data = result[indexes.index_of_top_level_describe];
data = data.replace('function(){', 'function(' + coreModules.filter(function(item){
        return !String(item).match(/('|")/g);
    }).join(',') + '){');
result.splice(indexes.index_of_top_level_describe, 1, data);


result.splice(indexes.index_of_top_level_describe, 0, '');
result.splice(indexes.index_of_top_level_describe, 0, 'const Test = suman.init(module);');
result.splice(indexes.index_of_top_level_describe, 0, 'const suman = require(\'suman\');');
result.splice(indexes.index_of_top_level_describe, 0, '');

fs.writeFileSync(path.resolve(__dirname + '/../../test/mocha-conversion-tests/write-to.js'), result.join('\n'));

process.exit();