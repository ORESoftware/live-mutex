"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
exports.plugins = {};
var modules = path.resolve(__dirname + '/modules');
fs.readdirSync(modules).forEach(function (item) {
    var file = path.resolve(modules + '/' + item);
    var mod = require(file);
    exports.plugins[mod.exportName] = mod;
});
