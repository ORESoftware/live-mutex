'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParser = void 0;
const json_stream_parser_1 = require("@oresoftware/json-stream-parser");
const createParser = function (v) {
    return new json_stream_parser_1.JSONParser(v);
};
exports.createParser = createParser;
