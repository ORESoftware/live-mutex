const path = require('path');
const glob = require('glob');
const _ = require('lodash');
process.env.IS_SUMAN_BROWSER_TEST='yes';

const all = _.flattenDeep([process.env.SUMAN_BROWSER_TEST_PATHS || glob.sync('./test/src/dev/browser/**/*.ts')]);
const entries = all.filter(f => f);

if(!entries.length){
  throw new Error('no test files could be found given your webpack configuration.');
}


module.exports = {

  entry: entries,

  output: {
    path: path.resolve(__dirname + '/test/.suman/browser/builds'),
    filename: 'browser-tests.js'
  },

  module: {

    rules: [
      {
        test: /babel-polyfill/,
        loader: 'ignore-loader'
      },
      {
        // ignore both .ts and .d.ts files
        test: /\.ts$/,
        loader: 'ts-loader'
      },
      {
        // ignore both .ts and .d.ts files
        test: /\.d\.ts$/,
        loader: 'ignore-loader'
      },
      {
        test: new RegExp('^' + path.resolve(__dirname + '/lib/cli-commands/') + '.*'),
        loader: 'ignore-loader'
      },
      {
        test: new RegExp('^' + path.resolve(__dirname + '/suman.conf.js')),
        loader: 'ignore-loader'
      }
    ]
  }

};
