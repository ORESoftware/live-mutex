import * as net from 'net';
declare const PromiseSymbol: unique symbol;
import Timer = NodeJS.Timer;
import { EventEmitter } from 'events';
import { LMXClientLockException, LMXClientUnlockException } from "./exceptions";
import { EVCb } from "./shared-internal";
import { LMXClientException } from "./exceptions";
export interface ValidConstructorOpts {
    [key: string]: string;
}
export declare const validConstructorOptions: ValidConstructorOpts;
export declare const validLockOptions: {
    force: string;
    maxRetries: string;
    maxRetry: string;
    ttl: string;
    lockRequestTimeout: string;
    keepLocksAfterDeath: string;
    keepLocksOnExit: string;
};
export declare const validUnlockOptions: {
    force: string;
    unlockRequestTimeout: string;
    keepLocksAfterDeath: string;
};
export interface ClientOpts {
    key: string;
    listener: Function;
    host: string;
    port: number;
    unlockRequestTimeout: number;
    lockRequestTimeout: number;
    lockRetryMax: number;
    retryMax: number;
    maxRetries: number;
    ttl: number;
    keepLocksAfterDeath: boolean;
    keepLocksOnExit: boolean;
    noDelay: boolean;
    udsPath: string;
    connectTimeout?: number;
}
export type EndReadCallback = (err?: any, val?: any) => void;
export interface IUuidTimeoutBool {
    [key: string]: boolean;
}
export interface IClientResolution {
    [key: string]: EVCb<any>;
}
export type LMClientCallBack = (err: any, c?: Client) => void;
export type Ensure = (cb?: LMClientCallBack) => Promise<Client>;
export interface UuidBooleanHash {
    [key: string]: boolean;
}
export interface LMXClientLockOpts {
    ttl?: number;
    lockRequestTimeout?: number;
    [PromiseSymbol]?: boolean;
    maxRetries?: number;
    force?: boolean;
    semaphore?: number;
    max?: number;
    retry?: boolean;
    maxRetry?: number;
    retryMax?: number;
    _uuid?: string;
    __maxRetries?: number;
    __retryCount?: number;
}
export interface LMXClientUnlockOpts {
    [PromiseSymbol]?: boolean;
    force?: boolean;
    _uuid?: string;
    __retryCount?: number;
    id?: string;
    rwStatus?: string;
    unlockRequestTimeout?: number;
}
export interface LMLockSuccessData {
    (fn?: LMClientUnlockCallBack): void;
    acquired: true;
    key: string;
    unlock: LMLockSuccessData;
    lockUuid: string;
    readersCount: number;
    id: string;
}
export interface LMUnlockSuccessData {
    unlocked: true;
    key: string;
    id: string;
}
export interface LMClientLockCallBack {
    (err: LMXClientLockException, v: LMLockSuccessData): void;
}
export interface LMClientUnlockCallBack {
    (err: null | LMXClientUnlockException, v: LMUnlockSuccessData): void;
    acquired?: boolean;
    unlock?: LMClientUnlockCallBack;
    release?: LMClientUnlockCallBack;
    key?: string;
    readersCount?: number | null;
}
export declare class Client {
    port: number;
    host: string;
    listeners: Object;
    connectTimeout: number;
    opts: Partial<ClientOpts>;
    ttl: number;
    noRecover: boolean;
    unlockRequestTimeout: number;
    lockRequestTimeout: number;
    lockRetryMax: number;
    ws: net.Socket | null;
    cannotContinue: boolean;
    timeouts: IUuidTimeoutBool;
    resolutions: IClientResolution;
    ensure: Ensure;
    connect: Ensure;
    giveups: UuidBooleanHash;
    timers: {
        [key: string]: Timer;
    };
    write: (data: any, cb?: EVCb<any>) => void;
    isOpen: boolean;
    close: () => void;
    keepLocksAfterDeath: boolean;
    keepLocksOnExit: boolean;
    createNewConnection: () => void;
    endCurrentConnection: () => void;
    emitter: EventEmitter;
    noDelay: boolean;
    socketFile: string;
    recovering: boolean;
    constructor(o?: Partial<ClientOpts>, cb?: LMClientCallBack);
    private onSocketDestroy;
    static create(opts?: Partial<ClientOpts>): Client;
    getConnectionInterface(): string | number;
    getConnectionInterfaceStr(): string;
    private _fireCallbacksPrematurely;
    setNoRecover(): void;
    requestLockInfo(key: string, cb: EVCb<any>): void;
    requestLockInfo(key: string, opts: any, cb: EVCb<any>): void;
    acquire(key: string, opts?: Partial<LMXClientLockOpts>): Promise<LMLockSuccessData>;
    release(key: string, opts: Partial<LMXClientUnlockOpts>): Promise<LMUnlockSuccessData>;
    lockp(key: string, opts?: Partial<LMXClientLockOpts>): Promise<LMLockSuccessData>;
    unlockp(key: string, opts: Partial<LMXClientUnlockOpts>): Promise<LMUnlockSuccessData>;
    acquireLock(key: string, opts?: boolean | number | Partial<LMXClientLockOpts>): Promise<LMLockSuccessData>;
    releaseLock(key: string, opts: Partial<LMXClientUnlockOpts>): Promise<LMUnlockSuccessData>;
    run(fn: LMLockSuccessData): Promise<unknown>;
    runUnlock(fn: LMLockSuccessData): Promise<any>;
    execUnlock(fn: LMLockSuccessData): Promise<any>;
    protected cleanUp(uuid: string): void;
    protected fireUnlockCallbackWithError(cb: LMClientUnlockCallBack, isNextTick: boolean, err: LMXClientUnlockException): void;
    protected fireLockCallbackWithError(cb: LMClientLockCallBack, isNextTick: boolean, err: LMXClientLockException): void;
    protected fireCallbackWithError(cb: EVCb<any>, isNextTick: boolean, err: LMXClientException): void;
    ls(cb: EVCb<any>): void;
    ls(opts: any, cb?: EVCb<any>): void;
    protected preParseLockOptsForPromises(key: string, opts: LMXClientLockOpts): [string, LMXClientLockOpts];
    protected parseLockOpts(key: string, opts: LMXClientLockOpts | LMClientLockCallBack, cb?: LMClientLockCallBack): [string, LMXClientLockOpts, LMClientLockCallBack];
    _simulateVersionMismatch(): void;
    _invokeBrokerSideEndCall(): void;
    _invokeBrokerSideDestroyCall(): void;
    _makeClientSideError(): void;
    lock(key: string, cb: LMClientLockCallBack): void;
    lock(key: string, opts: Partial<LMXClientLockOpts>, cb: LMClientLockCallBack): void;
    on(): any;
    once(): any;
    private lockInternal;
    noop(err?: any): void;
    getPort(): number;
    getHost(): string;
    onWarning(callback: (...args: any[]) => void): void;
    protected preParseUnlockOptsForPromise(key: string, opts?: string | boolean | LMXClientUnlockOpts): [string, LMXClientUnlockOpts];
    protected parseUnlockOpts(key: string, opts?: LMXClientUnlockOpts | LMClientUnlockCallBack, cb?: LMClientUnlockCallBack): [string, LMXClientUnlockOpts, LMClientUnlockCallBack];
    unlock(key: string): void;
    unlock(key: string, opts: LMXClientUnlockOpts): void;
    unlock(key: string, opts: LMXClientUnlockOpts, cb: LMClientUnlockCallBack): void;
    ping(cb?: EVCb<any>): Promise<any>;
    getSystemStats(cb?: EVCb<any>): Promise<any>;
}
export default Client;
export declare const LMXClient: typeof Client;
export declare const LvMtxClient: typeof Client;
