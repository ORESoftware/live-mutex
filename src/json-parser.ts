'use strict';

import {StringDecoder} from 'string_decoder';
import {routineEnter} from './routine';
import {JSONParser, JSONParserOpts} from "@oresoftware/json-stream-parser";

//////////////////////////////////////////////////

type EVCb<T = any> = (err?: any, v?: T) => void;

export interface IParsedObject {
  [index: string]: any
}

export const defaultJSONParseDelayEvery = 1024;

export const getJSONParseDelayEvery = function () {
  const raw = process.env.LMX_JSON_PARSE_DELAY_EVERY || process.env.lmx_json_parse_delay_every;
  const parsed = Number(raw);

  if (raw && Number.isInteger(parsed) && parsed > 1) {
    return parsed;
  }

  return defaultJSONParseDelayEvery;
};

export class LiveMutexJSONParser<T = any> extends JSONParser<T> {

  private lmxDecoder = new StringDecoder('utf8');

  getChunkByteLength(chunk: any, encoding: string) {
    if (chunk == null) {
      return 0;
    }

    if (typeof chunk === 'string') {
      return Buffer.byteLength(chunk, encoding as BufferEncoding);
    }

    if (typeof chunk.length === 'number') {
      return chunk.length;
    }

    return Buffer.byteLength(String(chunk));
  }

  decodeChunk(chunk: any) {
    if (chunk == null) {
      return '';
    }

    if (Buffer.isBuffer(chunk)) {
      return this.lmxDecoder.write(chunk);
    }

    if (chunk instanceof Uint8Array) {
      return this.lmxDecoder.write(Buffer.from(chunk));
    }

    return String(chunk);
  }

  processLines(lines: Array<string>, cb: EVCb<void>, index = 0) {
    while (index < lines.length) {
      const l = lines[index++];

      if (!l) {
        continue;
      }

      this.handleJSON(l);

      if (this.delay && (this.count++ % this.delayEvery) === 0) {
        this.count = 1;
        setImmediate(() => this.processLines(lines, cb, index));
        return;
      }
    }

    cb();
  }

  _transform(chunk: any, encoding: string, cb: EVCb<void>) {
    if (this.isTrackBytesRead) {
      this.jpBytesRead += this.getChunkByteLength(chunk, encoding);
    }

    let data = this.decodeChunk(chunk);

    if (this.lastLineData) {
      data = this.lastLineData + data;
    }

    const lines = data.split(this.delimiter);
    this.lastLineData = lines.pop() || '';

    this.processLines(lines, cb);
  }

  _flush(cb: Function) {
    const tail = this.lmxDecoder.end();

    if (tail) {
      this.lastLineData += tail;
    }

    if (this.lastLineData) {
      const lines = this.lastLineData.split(this.delimiter);
      this.lastLineData = '';
      this.processLines(lines, cb as EVCb<void>);
      return;
    }

    cb();
  }
}

export const createParser = function (v?: JSONParserOpts) {
  const routineId = 'ddl-routine-h_gbxCB0EhzFEXy8Oi';
  routineEnter(routineId, "createParser");

  const opts = Object.assign({}, v || {});

  if (!('delayEvery' in opts) || opts.delayEvery === undefined) {
    opts.delayEvery = getJSONParseDelayEvery();
  }

  return new LiveMutexJSONParser(opts)
};
