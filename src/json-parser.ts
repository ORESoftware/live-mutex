'use strict';

import * as stream from 'stream';
import {JSONParser, JSONParserOpts} from "@oresoftware/json-stream-parser";

//////////////////////////////////////////////////

export interface IParsedObject {
  [index: string]: any
}


export const createParser = function (v?: JSONParserOpts) {
  return new JSONParser(v)
};

export const createJSONParser = createParser;
export default createParser;