'use strict';


import {routineEnter} from './routine';
import * as stream from 'stream';
import {JSONParser, JSONParserOpts} from "@oresoftware/json-stream-parser";

//////////////////////////////////////////////////

export interface IParsedObject {
  [index: string]: any
}

export const createParser = function (v?: JSONParserOpts) {
  const routineId = 'ddl-routine-h_gbxCB0EhzFEXy8Oi';
  routineEnter(routineId, "createParser");
  return new JSONParser(v)
};
