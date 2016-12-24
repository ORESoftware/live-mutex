'use striiict';

const sumanOptions = require('../../parse-cmd-line-opts/suman-options');

module.exports = function (optsList) {

  return sumanOptions.filter(function (item) {

    const n = item.name || item.names[ 0 ];
    return optsList.indexOf(n) > -1;

  }).map(function (item) {

    const n = item.name || item.names[ 0 ];
    return {
      name: '--' + n + ', [type = ' + item.type + '], (' + item.help + ')',
      value: '--' + n,
      checked: false
    }

  });
};