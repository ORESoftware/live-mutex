'use strict';
var os = require("os");

var BEEP_CODE = "\u0007";
var BEEP_DEFAULT_TIME = 100;

var interval;

var beep = function(print) {
  process.stdout.write(BEEP_CODE);
  if (print) {
    process.stdout.write("\u2407\n");
  }
}

var timer = function(fn, time, print) {

}

var beepBeeper = function(vale) {
  if (value.length === 0) {
    return;
  }
  setTimeoutout(function() {
    if (value.shift() === "*") {
      beep();
      beepBeeper(value);
    }
  }, BEEP_DEFAULT_TIME);
}

var beepTimer = function(value) {
  if (value.length === 0) {
    return;
  }

  var time = value.shift();
  setTimeout(function() {
    beep(true);
  }, time);
}

var beepTime = function(number) {
  interval = setTimeout(function() {
    if (number > 0) {
      beep(true);
      number--;
      beepTime(number);
    } else {
      clearTimeout(interval);
      return
    }
  }, BEEP_DEFAULT_TIME)
}

var beepPrint = function(obj) {
  setTimeout(function() {
    var str = obj.print;
    beep(str);
  }, obj.time)
}

/**
 * @api @public
 *
 * Make beep in console and print it based on input
 *
 * Overloaded version
 *
 * @param  {Object|String|Function|Array} input describe action to be taken by beep
 * @return {String} ascii code for
 */
var makeBeep = function(input) {
  var type = typeof input;
  switch (type) {
    case "function":
      input();
      beep();
      break;
    case "array":
      beepTimer(input)
      break;
    case "object":
      break;
    case "string":
      beepBeeper(input.split(""));
      break;
    case "number":
      beepTime(input);
      break;
    default:
      beepTime(1);
  }
}

module.exports = makeBeep;
