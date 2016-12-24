const inquirer = require('suman-inquirer');
const util = require('util');

inquirer.prompt([
  {
    type: 'checkbox',
    message: 'Select any command line options (use spacebar)',
    name: 'command-line-options',

    choices: [
      {
        name: '--verbose, [type = arrayOfBool], (Verbose output. Use multiple times for more verbose.)',
        checked: true
      },
      {
        name: '--sparse, [type = bool], (Sparse output. Less verbose than standard.)',
        checked: true
      },
      {
        name: '--match-any, [type = arrayOfString], (Use this to filter input to match the given JS regex)',
        checked: true
      },
      {
        name: '--match-none, [type = arrayOfString], (Use this to filter input to ignore matches of the given JS regex)',
        checked: true
      },
      {
        name: '--match-all, [type = arrayOfString], (Use this to filter input to ignore matches of the given JS regex)',
        checked: true
      }
    ],

    filter: function (val) {                              // <<<< add this function
      return String(val).split(',')[ 0 ];
    },

  }

]).then(function (answers) {

  console.log('\n\n\nanswers => ' + util.inspect(answers));

});