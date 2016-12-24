'use striiiict';

//core
const assert = require('assert');
const util = require('util');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

//npm
const async = require('async');
const debug = require('debug')('suman:interactive');
const colors = require('colors/safe');

//project
const rejectionHandler = require('./interactive-rejection-handler');
const choices = require('./helpers/choices');

//////////////////////////////////////////////////////

process.on('warning', function (w) {
  console.log(' => Suman interactive warning => ', w.stack || w);
});

//////////////////////////////////////////////////////

process.stdin.setMaxListeners(20);

///////////////////////////////////////////////////////

const interactiveDebugPath = path.resolve(__dirname + '/helpers/debug-interactive.log');

fs.writeFileSync(interactiveDebugPath, '\n new run \n', {flag: 'w'});

global._interactiveDebug = function () {
  fs.writeFileSync(interactiveDebugPath, '\n\n', {flag: 'a'});
  const args = Array.prototype.slice.call(arguments);
  const data = args.map(function (a) {
    return (typeof a === 'string' ? a : util.inspect(a));
  }).join('\n');

  fs.writeFileSync(interactiveDebugPath, data, {flag: 'a'})

};

global.onBackspace = function (cb) {

  process.stdin.listeners('readable').forEach(function (fn) {
    if (process.stdin.listenerCount('readable') > 4)
      process.stdin.removeListener('readable', fn);
  });

  process.stdin.listeners('close').forEach(function (fn) {
    if (process.stdin.listenerCount('close') > 4)
      process.stdin.removeListener('close', fn);
  });

  process.stdin.listeners('keypress').forEach(function (fn) {
    if (process.stdin.listenerCount('keypress') > 4)
      process.stdin.removeListener('keypress', fn);
  });

  process.stdin.listeners('exit').forEach(function (fn) {
    if (process.stdin.listenerCount('exit') > 4)
      process.stdin.removeListener('exit', fn);
  });

  process.stdin.listeners('end').forEach(function (fn) {
    if (process.stdin.listenerCount('end') > 4)
      process.stdin.removeListener('end', fn);
  });

  process.nextTick(cb);
};

global._implementationError = function (msg) {
  msg = msg || '';
  msg = typeof msg === 'string' ? msg : util.inspect(msg);
  throw new Error(colors.red(' => Suman interactive internal implementation problem ' + (msg || '.')));
};

_interactiveDebug(' => beginning of interactive session => ');

//////////////////////////////////////////////////////

const testDir = global.sumanConfig.testDir;

var rootDir;

try {
  rootDir = path.resolve(global.projectRoot + '/' + testDir);
  if (!(fs.statSync(rootDir).isDirectory())) {
    throw new Error('Path given by => "' + rootDir + '" is not a directory');
  }
}
catch (err) {
  rootDir = global.projectRoot;
}

//TODO: we can validate that all the choices are actually files in a directory

const loadingMessage = colors.bgYellow.blue(' => Loading suman interactive mode...');
console.log(loadingMessage);

const _cwd = path.resolve(process.env.HOME + '/.suman');

async.parallel({

  installSumanInquirer: function (cb) {
    try {
      require.resolve('suman-inquirer');
      return process.nextTick(cb);
    }
    catch (err) {
      cp.exec('npm install suman-inquirer@latest', {
        cwd: _cwd
      }, cb);
    }
  },

  installSumanInquirerDirectory: function (cb) {
    try {
      require.resolve('suman-inquirer-directory');
      return process.nextTick(cb);
    }
    catch (err) {
      cp.exec('npm install suman-inquirer-directory@latest', {
        cwd: _cwd
      }, cb);
    }
  }

}, function (err) {

  if (err) {
    throw err;
  }

  const inquirer = require('suman-inquirer');
  const inqDir = require('suman-inquirer-directory');
  inquirer.registerPrompt('directory', inqDir);

  var firstQuestionSeen = false;

  const firstSetOfQuestions = [
    {

      type: 'confirm',
      name: 'suman',
      message: colors.yellow.underline(' => Welcome to Suman land!') + '\n' +
      colors.blue('  This interactive utility allows you to familiarize yourself with Suman, as well as keep up to date with the API.\n' +
        '  You can generate a terminal command with this tool which you can then go run yourself.\n' +
        '  This tool can also help you troubleshoot or debug tests.') + '\n' +
      ' \n  To skip this messsage the future, just use ' + colors.magenta('"suman --interactive --fast"') + '.\n\n' +
      '  To ' + colors.green('continue') + ', hit enter, or type "y" or "yes".\n\n ',
      when: function () {
        if (!firstQuestionSeen) {
          firstQuestionSeen = true;
          if (process.argv.indexOf('--fast') < 0) {
            console.log('\n\n ---------------------------------------------------- \n\n');
            return true;
          }
        }

      }
    },

    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      default: 0,
      onLeftKey: function () {
        _interactiveDebug('left key fired in top level!');
        global.onBackspace(start);
      },
      choices: Object.values(choices.topLevelOpts), //add empty option for formatting purposes
      when: function (d) {
        if (d.suman === false) {
          console.log('\n\n');
          console.log('\n => Confirmation was false...ok, we will exit then!');
          process.exit(1);
        }
        else {
          console.log('\n\n ---------------------------------------------------- \n\n');
          return true;
        }
      }
    }
  ];

  const secondSetOfQuestions = [
    {
      type: 'list',
      name: 'firstAction',
      message: 'What would you like to do?',
      onLeftKey: function () {
        _interactiveDebug('left key fired in generate list!');
        global.onBackspace(start);
      },
      default: 0,
      choices: fs.readdirSync(path.resolve(__dirname + '/generate-command')),
      when: function () {
        console.log('\n\n ----------------------------------------------------- \n\n');
        return true;
      }
    }
  ];

  function generateList(obj, onBackspace) {

    const dir = obj.firstAction;
    const root = path.resolve(__dirname + '/generate-command');
    const items = fs.readdirSync(root + '/' + dir);

    _interactiveDebug('ITEMS => ', items);

    return inquirer.prompt([
      {
        type: 'list',
        name: 'secondAction',
        message: 'What would you like to do?',
        onLeftKey: function () {
          _interactiveDebug('left key fired in generate list!');
          global.onBackspace(onBackspace);

        },
        default: 0,
        choices: items.map(function (item) {
          return String(item).slice(0, -3);  // get rid of ".js"
        }),
        when: function () {
          console.log('\n\n ----------------------------------------------------- \n\n');
          return true;
        },
        filter: function (items) {
          return items;
          // return items.map(function (item) {
          //   return path.resolve(root + '/' + item);
          // });
        }
      }
    ]).then(function (answers) {
      return Object.assign(obj, answers);
    });
  }

  function secondSet() {

    return inquirer.prompt(secondSetOfQuestions).then(function (obj) {
      return thirdSet(obj, secondSet);
    });

  }

  function thirdSet(obj, cb) {

    _interactiveDebug('in THIRD SET => ', obj);

    const _thirdSet = thirdSet.bind(null, obj, cb);

    return generateList(obj, cb).then(function (obj) {

      _interactiveDebug('obj in SECOND => ', obj);
      const pth = path.resolve(__dirname + '/generate-command/' + obj.firstAction + '/' + obj.secondAction + '.js');
      _interactiveDebug('RESOLVED PATH => ', pth);

      return require(pth)({
        rootDir: rootDir
      }, _thirdSet);
    });

  }

  function start() {


    // process.stdin.removeAllListeners('keypress');
    // process.stdin.removeAllListeners('end');
    _interactiveDebug('readable count:', process.stdin.listenerCount('readable'));
    _interactiveDebug('keypress count:', process.stdin.listenerCount('keypress'));
    _interactiveDebug('keypress count:', process.stdin.listenerCount('keypress'));

    inquirer.restoreDefaultPrompts();

    inquirer.prompt(firstSetOfQuestions).then(function (respuestas) {
      if (respuestas.action === choices.topLevelOpts.GenerateCommand) {
        return secondSet(start);
      }
      else if (respuestas.action === choices.topLevelOpts.Learn) {
        throw new Error('Learn the Suman API is not implemented yet.');
      }
      else if (respuestas.action === choices.topLevelOpts.Troubleshoot) {
        throw new Error('Troubleshoot is not implemented yet.');
      }
      else {
        throw new Error('Action not recognized.');
      }

    }).catch(rejectionHandler);

  }

  start();


});

