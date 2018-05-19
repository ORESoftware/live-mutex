'use strict';
exports.__esModule = true;
var stream = require("stream");
exports.createParser = function () {
    var lastLineData = '';
    return new stream.Transform({
        objectMode: true,
        transform: function (chunk, encoding, cb) {
            var _this = this;
            var data = String(chunk);
            if (lastLineData) {
                data = lastLineData + data;
            }
            var lines = data.split('\n');
            lastLineData = lines.splice(lines.length - 1, 1)[0];
            lines.forEach(function (l) {
                try {
                    // l might be an empty string; ignore if so
                    l && _this.push(JSON.parse(l));
                }
                catch (err) {
                    // noop
                }
            });
            cb();
        },
        flush: function (cb) {
            if (lastLineData) {
                try {
                    this.push(JSON.parse(lastLineData));
                }
                catch (err) {
                    // noop
                }
            }
            lastLineData = '';
            cb();
        }
    });
};
exports.createJSONParser = exports.createParser;
exports["default"] = exports.createParser;
