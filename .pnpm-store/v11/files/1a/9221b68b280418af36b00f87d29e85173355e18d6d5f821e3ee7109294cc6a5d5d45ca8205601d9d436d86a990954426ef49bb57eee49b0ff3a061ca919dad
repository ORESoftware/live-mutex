'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var path = require("path");
var poolio_1 = require("poolio");
var logging_1 = require("./logging");
var pool = new poolio_1.Pool({
    size: 3,
    filePath: path.resolve(__dirname + '/handle-require.js'),
    oneTimeOnly: true
});
pool.on('error', function (e) {
    logging_1.log.error(e.stack || e);
});
exports.workerPool = pool;
