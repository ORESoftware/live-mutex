const path = require('path');
const webpack = require('webpack');

module.exports = {

  entry: ['babel-polyfill', './lib/index.ts'],

  output: {
    path: path.resolve(__dirname + '/browser'),
    filename: 'suman.js'
  },

  plugins: [
    new webpack.WatchIgnorePlugin([
      /\.js$/,
      /\.d\.ts$/
    ])
  ],

  module: {

    rules: [
      // all files with a `.ts` extension will be handled by `ts-loader`
      {
        test: /\.ts$/,
        loader: 'ts-loader'
      },
      {
        test: /^\.d.ts$/,
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
    ],

  },

  resolve: {
    alias: {
      fs: require.resolve('suman-browser-polyfills/modules/fs'),
      process: require.resolve('suman-browser-polyfills/modules/process'),
    },
    // extensions: ['.ts']
    extensions: ['.ts', '.js']
  },

  node: {
    assert: true,
    buffer: false,
    child_process: 'empty',
    cluster: 'empty',
    console: false,
    constants: true,
    crypto: 'empty',
    dgram: 'empty',
    dns: 'mock',
    domain: true,
    events: true,
    // fs: 'empty',
    http: true,
    https: true,
    module: 'empty',
    net: 'mock',
    os: true,
    path: true,
    process: false,
    punycode: true,
    querystring: true,
    readline: 'empty',
    repl: 'empty',
    stream: true,
    string_decoder: true,
    timers: true,
    tls: 'mock',
    tty: true,
    url: true,
    util: true,
    v8: 'mock',
    vm: true,
    zlib: 'empty',
  }
};
