'use striiiict';

//core

//npm
const inquirer = require('suman-inquirer');


//////////////////////////////////////////////////////


module.exports = function makePromise(){

  return inquirer.prompt([

    {
      type: 'confirm',
      name: 'suman',
      message: 'ppppppppppp',
      when: function () {
        return true;
      }
    },

  ]).then(function(answers){

    console.log(' answers in Istanbul test => ', answers);

  });




};