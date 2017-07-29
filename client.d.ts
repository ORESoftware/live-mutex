import { CWebSocket } from "./dts/uws";
export interface IClientOptions {
    key: string;
    listener: Function;
    host: string;
    port: number;
    unlockRequestTimeout: number;
    lockRequestTimeout: number;
    unlockRetryMax: number;
    lockRetryMax: number;
    ttl: number;
}
export declare type TClientOptions = Partial<IClientOptions>;
export interface IUuidTimeoutBool {
    [key: string]: boolean;
}
export declare type IErrorFirstDataCB = (err: Error | null | undefined | string, val?: any) => void;
export interface IClientResolution {
    [key: string]: IErrorFirstDataCB;
}
export interface IBookkeepingHash {
    [key: string]: IBookkeeping;
}
export interface IBookkeeping {
    rawLockCount: number;
    rawUnlockCount: number;
    lockCount: number;
    unlockCount: number;
}
export declare type TClientCB = (err: Error | string | null | undefined, c?: Client) => void;
export declare type TEnsure = (cb?: TClientCB) => Promise<Client>;
export interface IUuidBooleanHash {
    [key: string]: boolean;
}
export interface IClientLockOpts {
}
export interface IClientUnlockOpts {
}
export interface ILockHolderCount {
    [key: string]: number;
}
export declare type TClientLockCB = (err: Error | string | null | undefined, unlock: Function | false, id?: string) => void;
export declare type TClientUnlockCB = (err: Error | string | null | undefined, uuid?: string) => void;
export declare class Client {
    port: number;
    host: string;
    listeners: Object;
    opts: TClientOptions;
    ttl: number;
    unlockTimeout: number;
    lockTimeout: number;
    lockRetryMax: number;
    unlockRetryMax: number;
    ws: CWebSocket;
    timeouts: IUuidTimeoutBool;
    resolutions: IClientResolution;
    bookkeeping: IBookkeepingHash;
    ensure: TEnsure;
    connect: TEnsure;
    giveups: IUuidBooleanHash;
    write: Function;
    isOpen: boolean;
    lockholderCount: ILockHolderCount;
    close: Function;
    constructor($opts: TClientOptions, cb?: TClientCB);
    static create(opts: TClientOptions, cb?: TClientCB): Promise<Client>;
    addListener(key: any, fn: any): void;
    setLockRequestorCount(key: any, val: any): void;
    getLockholderCount(key: any): number;
    requestLockInfo(key: any, opts: any, cb: any): void;
    lockp(key: string, opts: Partial<IClientLockOpts>): Promise<{}>;
    unlockp(key: string, opts: Partial<IClientUnlockOpts>): Promise<{}>;
    lock(key: string, opts: Partial<IClientLockOpts>, cb: TClientLockCB): void;
    unlock(key: string, opts: Partial<IClientUnlockOpts>, cb?: TClientUnlockCB): void;
}
export declare const LMClient: typeof Client;
export declare const LvMtxClient: typeof Client;
export default Client;
