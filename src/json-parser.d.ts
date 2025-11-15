import { JSONParser, JSONParserOpts } from "@oresoftware/json-stream-parser";
export interface IParsedObject {
    [index: string]: any;
}
export declare const createParser: (v?: JSONParserOpts) => JSONParser<any>;
