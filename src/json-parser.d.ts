/// <reference types="node" />
import * as stream from 'stream';
export interface IParsedObject {
    [index: string]: any;
}
export declare const createParser: () => stream.Transform;
export declare const createJSONParser: () => stream.Transform;
export default createParser;
