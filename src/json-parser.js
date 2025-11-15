'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParser = void 0;
var json_stream_parser_1 = require("@oresoftware/json-stream-parser");
var createParser = function (v) {
    return new json_stream_parser_1.JSONParser(v);
};
exports.createParser = createParser;
