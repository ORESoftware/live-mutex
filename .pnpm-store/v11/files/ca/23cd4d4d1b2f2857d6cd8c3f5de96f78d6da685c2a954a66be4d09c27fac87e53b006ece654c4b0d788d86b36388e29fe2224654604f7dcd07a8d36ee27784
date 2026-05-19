'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const stream = require("stream");
const assert = require("assert");
exports.r2gSmokeTest = function () {
    return true;
};
exports.RawStringSymbol = Symbol('raw.json.str');
exports.RawJSONBytesSymbol = Symbol('raw.json.bytes');
exports.JSONBytesSymbol = Symbol('json.bytes');
class JSONParser extends stream.Transform {
    constructor(opts) {
        super({ objectMode: true, highWaterMark: 1 });
        this.emitNonJSON = false;
        this.lastLineData = '';
        this.debug = false;
        this.delimiter = '\n';
        this.cleanFront = true;
        this.jpBytesWritten = 0;
        this.stringifyNonJSON = false;
        this.jpBytesRead = 0;
        this.isTrackBytesRead = false;
        this.isTrackBytesWritten = false;
        this.isIncludeRawString = false;
        this.isIncludeByteCount = false;
        this.delayEvery = -1;
        this.delay = false;
        this.count = 1;
        this.wrapMetadata = false;
        if (opts && opts.emitNonJSON) {
            this.emitNonJSON = true;
        }
        if (opts && ('wrapMetadata' in opts)) {
            this.wrapMetadata = Boolean(opts.wrapMetadata);
        }
        if (opts && opts.includeRawString) {
            this.isIncludeRawString = true;
        }
        if (opts && ('delayEvery' in opts)) {
            assert(opts.delayEvery > 1 && Number.isInteger(opts.delayEvery), 'the "delayEvery" option needs to be a positive integer greater than 1');
            this.delay = true;
            this.delayEvery = opts.delayEvery;
        }
        if (opts && opts.includeByteCount) {
            this.isIncludeByteCount = true;
        }
        if (opts && opts.trackBytesWritten) {
            this.isTrackBytesWritten = true;
        }
        if (opts && opts.stringifyNonJSON) {
            this.stringifyNonJSON = true;
        }
        if (opts && opts.trackBytesRead) {
            this.isTrackBytesRead = true;
        }
        if (opts && 'debug' in opts) {
            assert.strictEqual(typeof opts.debug, 'boolean', '"debug" option should be a boolean value.');
            this.debug = opts.debug;
        }
        if (opts && 'delimiter' in opts) {
            assert(opts.delimiter && typeof opts.delimiter === 'string', '"delimiter" option should be a string value.');
            this.delimiter = opts.delimiter;
        }
    }
    getBytesRead() {
        return this.jpBytesRead;
    }
    getBytesWritten() {
        return this.jpBytesWritten;
    }
    sliceStr(o) {
        const z = o.indexOf('∆˚ø');
        if (z >= 0) {
            return o.slice(z);
        }
        const i = [
            o.indexOf('["'),
            o.indexOf('{"'),
            o.indexOf('[['),
            o.indexOf('[[[')
        ].reduce((a, b) => b > 0 && b < a ? b : a, 0);
        if (i <= 0) {
            return o;
        }
        return o.slice(i);
    }
    handleJSON(o) {
        if (this.cleanFront) {
            if (!((o[0] === '[' || o[0] === '{') && o[1] === '"')) {
                o = this.sliceStr(o);
            }
        }
        let json = null;
        try {
            json = JSON.parse(o);
        }
        catch (err) {
            if (this.debug) {
                console.error('json-parser:', 'error parsing line:', o.trim());
                console.error('json-parser:', err.message);
            }
            if (this.emitNonJSON) {
                this.emit('string', o);
            }
            if (this.stringifyNonJSON) {
                this.emit('data', JSON.stringify(o));
            }
            return;
        }
        if (this.isIncludeByteCount && json && typeof json === 'object') {
            json[exports.RawJSONBytesSymbol] = Buffer.byteLength(o);
        }
        if (this.isIncludeRawString && json && typeof json === 'object') {
            json[exports.RawStringSymbol] = o;
        }
        this.push(json);
        if (this.isTrackBytesWritten) {
            this.jpBytesWritten += Buffer.byteLength(o);
        }
    }
    _transform(chunk, encoding, cb) {
        if (this.isTrackBytesRead) {
            this.jpBytesRead += chunk.length;
        }
        let data = String(chunk || '');
        if (this.lastLineData) {
            data = this.lastLineData + data;
        }
        const lines = data.split(this.delimiter);
        this.lastLineData = lines.pop();
        for (let l of lines) {
            if (!l) {
                continue;
            }
            this.handleJSON(l);
        }
        if (this.delay) {
            if ((this.count++ % this.delayEvery) === 0) {
                this.count = 1;
                setImmediate(cb, null);
                return;
            }
        }
        cb();
    }
    _flush(cb) {
        if (this.lastLineData) {
            this.handleJSON(this.lastLineData);
            this.lastLineData = '';
        }
        cb();
    }
}
exports.JSONParser = JSONParser;
exports.default = JSONParser;
