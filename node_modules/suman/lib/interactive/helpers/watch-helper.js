'use striiiict';

//core
const assert = require('assert');
const util = require('util');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

//npm
const colors = require('colors/safe');
const inquirer = require('suman-inquirer');

//project
const rejectionHandler = require('../interactive-rejection-handler');
const choices = require('./choices');

//////////////////////////////////////////////////////////////////

module.exports = function chooseWatchProperty (obj, backspaceCB) {

  const keys = Object.keys(global.sumanConfig.watch || {});
  _interactiveDebug(' WATCH HELPER obj => ', obj);

  global.backspacing = false;

  const prompt1 = [

    {
      type: 'confirm',
      name: 'confirmNoWatchPropsInConfig',
      onLeftKey: function () {
        global.onBackspace(backspaceCB);
      },
      message: 'Please acknowledge that you have no properties in the watch object in your suman.conf.js config.',
      when: function () {
        global.backspacing = false;
        console.log('\n\n --------------------------------------------- \n\n');
        return true;
      },
      validate: function (item) {
        return true;
      }
    }

  ];

  const prompt2 = [

    {
      type: 'list',
      name: 'useConfigWatchPresets',
      message: 'Want to use the preset values on the watch object in your config?\n' +
      '  => These defaults look like => \n' + util.inspect(global.sumanConfig.watch, {
        colors: true,
        breakLength: 5
      }) + '\n',
      default: 0,
      choices: [
        'yes',
        'no'
      ],
      onLeftKey: function () {
        global.onBackspace(backspaceCB);
      },
      when: function () {
        global.backspacing = false;
        console.log('\n\n ------------------------------------------ \n\n');
        return true;
      },
      validate: function (item) {

      }
    },

    {
      type: 'list',
      name: 'watchPresetProperty',
      message: 'Which watch preset property do you wish to use?',
      default: 0,
      choices: keys,
      onLeftKey: function () {
        global.onBackspace(backspaceCB);
      },
      when: function (answers) {
        if (answers.useConfigWatchPresets === 'yes') {
          global.backspacing = false;
          console.log('\n\n --------------------------------- \n\n');
          return true;
        }
      },
      validate: function (item) {

      }
    }

  ];

  try {
    require.resolve('suman-server');
  }
  catch (err) {

    const p = {
      type: 'confirm',
      name: 'confirmNoSumanServerInstalled',
      message: 'Please acknowledge that you will need to' +
      ' install the suman-server package if you wish to use the watch features,\n' +
      ' you can do that with ' + colors.magenta('"$ suman --use-server"') + ',  (we will auto-generate this command for you later, this is just FYI).',
      when: function () {
        console.log('\n\n -------------------------------------- \n\n');
        global.backspacing = false;
        return true;
      },
      onLeftKey: function () {
        global.onBackspace(backspaceCB);
      },
      validate: function (item) {
        return true;
      }
    };
    prompt1.unshift(p);
    prompt2.unshift(p);
  }

  const z = keys.length < 1 ? prompt1 : prompt2;

  return inquirer.prompt(z).then(function (answers) {
    answers.mustInstallSumanServer = 'confirmNoSumanServerInstalled' in answers;
    answers.allowChoose = answers.useConfigWatchPresets !== 'yes';
    answers.watchProperty = answers.useConfigWatchPresets === 'yes' ? answers.watchPresetProperty : '';
    return Object.assign(obj, answers);
  });

};