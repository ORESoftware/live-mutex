/*!
 * function-arguments <https://github.com/tunnckoCore/function-arguments>
 *
 * Copyright (c) 2016 Charlike Mike Reagent <@tunnckoCore> (http://www.tunnckocore.tk)
 * Released under the MIT license.
 */

'use strict'

/**
 * > Get function arguments names.
 *
 * **Example**
 *
 * ```js
 * var fnArgs = require('function-arguments')
 *
 * console.log(fnArgs(function (a, b, c) {})) // => [ 'a', 'b', 'c' ]
 * console.log(fnArgs(function named (a , b, c) {})) // => [ 'a', 'b', 'c' ]
 *
 * console.log(fnArgs(a => {})) // => [ 'a' ]
 * console.log(fnArgs((a, b) => {})) // => [ 'a', 'b' ]
 *
 * console.log(fnArgs(function * (a ,b, c) {})) // => [ 'a', 'b', 'c' ]
 * console.log(fnArgs(function * named (a ,b, c) {})) // => [ 'a', 'b', 'c' ]
 * ```
 *
 * @param  {Function} `fn` Function from which to get arguments names.
 * @return {Array}
 * @api public
 */

module.exports = function functionArguments (fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('function-arguments expect a function')
  }
  if (fn.length === 0) {
    return []
  }

  // from https://github.com/jrburke/requirejs
  var reComments = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg
  var fnToStr = Function.prototype.toString
  var fnStr = fnToStr.call(fn)
  fnStr = fnStr.replace(reComments, '') || fnStr
  fnStr = fnStr.slice(0, fnStr.indexOf('{'))

  var open = fnStr.indexOf('(')
  var close = fnStr.indexOf(')')

  open = open >= 0 ? open + 1 : 0
  close = close > 0 ? close : fnStr.indexOf('=')

  fnStr = fnStr.slice(open, close)
  fnStr = '(' + fnStr + ')'

  var match = fnStr.match(/\(([\s\S]*)\)/)
  return match ? match[1].split(',').map(function (param) {
    return param.trim()
  }) : []
}
