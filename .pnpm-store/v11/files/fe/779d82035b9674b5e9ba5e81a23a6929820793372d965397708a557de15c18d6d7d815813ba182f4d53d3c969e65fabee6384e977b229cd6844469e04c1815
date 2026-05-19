/// <reference types="node" />
import * as stream from 'stream';
export declare const r2gSmokeTest: () => boolean;
declare type EVCb<T = any> = (err?: any, v?: T) => void;
export interface JSONParserOpts {
    wrapMetadata?: boolean;
    debug?: boolean;
    delimiter?: string;
    trackBytesWritten?: boolean;
    trackBytesRead?: boolean;
    includeByteCount?: boolean;
    emitNonJSON?: boolean;
    includeRawString?: boolean;
    stringifyNonJSON?: boolean;
    delayEvery?: number;
}
export declare const RawStringSymbol: unique symbol;
export declare const RawJSONBytesSymbol: unique symbol;
export declare const JSONBytesSymbol: unique symbol;
export declare class JSONParser<T = any> extends stream.Transform {
    emitNonJSON: boolean;
    lastLineData: string;
    debug: boolean;
    delimiter: string;
    cleanFront: boolean;
    jpBytesWritten: number;
    stringifyNonJSON: boolean;
    jpBytesRead: number;
    isTrackBytesRead: boolean;
    isTrackBytesWritten: boolean;
    isIncludeRawString: boolean;
    isIncludeByteCount: boolean;
    delayEvery: number;
    delay: boolean;
    count: number;
    wrapMetadata: boolean;
    constructor(opts?: JSONParserOpts);
    getBytesRead(): number;
    getBytesWritten(): number;
    sliceStr(o: string): string;
    handleJSON(o: string): void;
    _transform(chunk: any, encoding: string, cb: EVCb<void>): void;
    _flush(cb: Function): void;
}
export default JSONParser;
