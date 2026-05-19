"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const suman_shell_1 = require("suman-shell");
exports.run = function (projectRoot, sumanLibRoot, opts) {
    const fn = suman_shell_1.startSumanShell(projectRoot, sumanLibRoot, opts || {});
    process.once('exit', fn);
};
