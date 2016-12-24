'use striiict';

//core
const assert = require('assert');
const util = require('util');
const path = require('path');
const fs = require('fs');

//npm
const colors = require('colors/safe');
const inquirer = require('suman-inquirer');

//project
const sumanUtils = require('suman-utils/utils');
const rejectionHandler = require('../interactive-rejection-handler');

///////////////////////////////////////////////////////////

module.exports = function chooseDirs (opts, backspaceCB) {

  if (opts.allowChoose === false) {
    if(global.backspacing){
      backspaceCB();
      return 'backspacing';
    }
    else{
      return Promise.resolve(Object.assign(opts, {
        pathsToRun: []
      }));
    }
  }

  const onlyOneFile = opts.onlyOneFile;
  const rootDir = opts.rootDir;
  const output = [];

  return (function ask (rootDir) {

    const p = inquirer.prompt([
      {
        type: 'directory',
        name: 'filePath',
        message: 'Please select a test file that you would like to run.',
        includeFiles: true,
        basePath: rootDir,
        onlyOneFile: onlyOneFile,
        onLeftKey: function () {
          _interactiveDebug('promise???',p);
          // p.ui.close();
          global.onBackspace(backspaceCB);
        },
        mapValue: function (p) {
          return sumanUtils.removePath(p, global.projectRoot)
        },
        filterItems: function () {
          return true;
        },
        validate: function (p) {
          if (fs.statSync(p).isFile()) {
            return true;
          }
          return 'Please select a file not a directory.';
        },
        when: function () {
          if (onlyOneFile === true) {
            console.log('\n\n ----------------------------------------------- \n\n');
            global.backspacing = false;
            return true;
          }

        }
      },
      {
        type: 'directory',
        name: 'dirOrFilePath',
        message: 'Please select a test file or directory that you would like to run.\n',
        includeFiles: true,
        basePath: rootDir,
        onLeftKey: function () {
          // p.ui.close();
          _interactiveDebug('backspaceCB in choose dirs', String(backspaceCB));
          global.onBackspace(backspaceCB);
        },
        mapValue: function (p) {
          return sumanUtils.removePath(p, global.projectRoot)
        },
        when: function () {
          if (onlyOneFile !== true) {
            console.log('\n\n ----------------------------------------------- \n\n');
            global.backspacing = false;
            return true;
          }
        },
        validate: function (p) {
          if (fs.statSync(p).isFile()) {
            return true;
          }
          return 'Please select a file not a directory.';
        },
        filterItems: function () {
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'askAgain',
        onLeftKey: function () {
          // p.ui.close();
          global.onBackspace(backspaceCB);
        },
        message: 'Would you like to choose another file or directory (enter = yes) ?\n',
        when: function () {
          if (onlyOneFile !== true) {
            console.log('\n\n ----------------------------------------------- \n\n');
            global.backspacing = false;
            return true;
          }
        },
        default: true
      }
    ]).then(function (answers) {

      if (answers.dirOrFilePath) {
        output.push(answers.dirOrFilePath);
      }
      else if (answers.filePath) {
        output.push(answers.filePath);
      }
      else {
        throw new Error(' No option selected.');
      }

      if (answers.askAgain) {

        return ask(rootDir);

      } else {

        const $output = output.map(function (item) {
          return path.isAbsolute(item) ? item : path.resolve(rootDir + '/' + item);
        }).map((i, index) => ( (index + 1) + '  =>  "' + i + '"')).join(',\n');

        return inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmOutput',
            onLeftKey: function () {
              global.onBackspace(backspaceCB);
            },
            message: 'Are these the files/directories you wish to use? (To skip use the --fast option)\n\n' +
            colors.magenta($output) + '\n',
            when: function () {
              console.log('\n\n ----------------------------------------------- \n\n');
              global.backspacing = false;
              return true;
            },
            default: true
          }
        ]).then(function (respuestas) {

          if (respuestas.confirmOutput) {
            return Object.assign(opts, {
              pathsToRun: output,
            });
          }
          else {
            output.pop();
            return ask(rootDir);
          }

        });

      }

    }).catch(rejectionHandler);

    return p;

  })(rootDir);

};
