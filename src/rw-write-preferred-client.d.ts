import { Client, ClientOpts, LMClientCallBack } from "./client";
import { EVCb } from "./shared-internal";
export declare const log: {
    info: any;
    warn: any;
    error: any;
    debug: (...args: any[]) => void;
};
export declare class RWLockWritePrefClient extends Client {
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
    acquireWriteLockp(key: string, opts?: any): Promise<any>;
    acquireReadLockp(key: string, opts?: any): Promise<any>;
    releaseWriteLockp(key: string, opts?: any): Promise<any>;
    releaseReadLockp(key: string, opts?: any): Promise<any>;
    acquireWriteLock(key: string, opts: any, cb?: EVCb<any>): void;
    releaseWriteLock(key: string, opts: any, cb: EVCb<any>): void;
    acquireReadLock(key: string, opts: any, cb: EVCb<any>): void;
    releaseReadLock(key: string, opts: any, cb: EVCb<any>): any;
    registerWriteFlagCheck(key: string, opts: any, cb: EVCb<any>): void;
    registerWriteFlagAndReadersCheck(key: string, opts: any, cb: EVCb<any>): void;
    incrementReaders(key: any, cb: any): void;
    decrementReaders(key: string, cb: EVCb<any>): void;
    setWriteFlagToFalse(key: string, cb: EVCb<any>): void;
}
