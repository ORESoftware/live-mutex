'use strict';

let _global, inBrowser;

try {
  inBrowser = !!window;
}
catch (err) {
  inBrowser = false;
  _global = global;
}

if (inBrowser) {

  window.setImmediate = window.setImmediate || function(fn){
       setTimeout(fn,5);
    };

  _global = window;
  _global.process = require('./process');

}

module.exports = _global;

