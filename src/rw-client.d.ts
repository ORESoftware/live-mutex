import { Client, ClientOpts, EndReadCallback, LMClientCallBack } from "./client";
export declare const log: {
    info: any;
    warn: any;
    error: any;
    debug: (...args: any[]) => void;
};
import { EVCb } from "./shared-internal";
export declare class RWLockClient extends Client {
    readerCounts: {
        [key: string]: number;
    };
    writeKeys: {
        [key: string]: true;
    };
    constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack);
    beginReadp(key: string, opts: any): Promise<any>;
    endReadp(key: string, opts: any): Promise<any>;
    beginWritep(key: string, opts?: any): Promise<any>;
    endWritep(key: string, opts?: any): Promise<any>;
    acquireWriteLock(key: string, opts: any, cb?: any): any;
    acquireReadLock(key: string, opts: any, cb?: any): any;
    releaseWriteLock(key: string, opts: any, cb?: any): any;
    releaseReadLock(key: string, opts: any, cb?: any): any;
    acquireWriteLockp(key: string, opts?: any): Promise<any>;
    acquireReadLockp(key: string, opts?: any): Promise<any>;
    releaseWriteLockp(key: string, opts?: any): Promise<any>;
    releaseReadLockp(key: string, opts?: any): Promise<any>;
    beginWrite(key: string, opts: any, cb?: EVCb<any>): void;
    endWrite(key: string, opts: any, cb?: EVCb<any>): void;
    beginRead(key: string, opts: any, cb: EVCb<any>): void;
    endRead(key: string, opts: any, cb: EndReadCallback): void;
}
export declare const RWLockReadPrefClient: typeof RWLockClient;
