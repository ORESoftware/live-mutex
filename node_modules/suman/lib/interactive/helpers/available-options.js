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
const rejectionHandler = require('../interactive-rejection-handler');

/////////////////////////////////////////////////////////////////////

module.exports = function getAvailableOptions (opts, backspaceCB) {

  _interactiveDebug('opts in OPTIONS TO USE => ', opts);
  const optionsToUse = opts.optionsToUse;

  return inquirer.prompt([
    {
      type: 'checkbox',
      message: 'Select any command line options (use spacebar)',
      name: 'command-line-options',
      choices: optionsToUse,
      when: function () {
        console.log('\n\n ---------------------------------------- \n\n');
        global.backspacing = false;
        return true;
      },
      onLeftKey: function () {
        global.onBackspace(backspaceCB);
      },

      filter: function (vals) {
        return vals;
      },

      // validate: function (answer) {
      //   console.log('\n\n aaaaa => ', answer,'\n\n\n\n');
      //   if (answer.length < 1) {
      //     return 'You must choose at least one topping.';
      //   }
      //   return true;
      // }
    }
  ]).then(function (answers) {
    return Object.assign(opts, answers);
  })
};