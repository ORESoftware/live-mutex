# Installation
> `npm install --save @types/tcp-ping`

# Summary
This package contains type definitions for tcp-ping (https://github.com/wesolyromek/tcp-ping).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/tcp-ping.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/tcp-ping/index.d.ts)
````ts
export interface Options {
    address?: string | undefined;
    port?: number | undefined;
    attempts?: number | undefined;
    timeout?: number | undefined;
}

export interface Results {
    seq: number;
    time: number | undefined;
    err?: Error | undefined;
}

export interface Result {
    address: string;
    port: number;
    attempts: number;
    avg: number;
    max: number;
    min: number;
    results: Results[];
}

export function ping(options: Options, callback: (error: Error, result: Result) => void): void;
export function probe(address: string, port: number, callback: (error: Error, result: boolean) => void): void;

````

### Additional Details
 * Last updated: Fri, 05 Jul 2024 20:08:00 GMT
 * Dependencies: none

# Credits
These definitions were written by [JUNG YONG WOO](https://github.com/stegano).
