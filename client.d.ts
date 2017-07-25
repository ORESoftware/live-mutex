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
export declare type TEnsureCB = (cb: TClientCB) => void;
export declare type TEnsurePromise = () => Promise<Client>;
export declare type TEnsure = TEnsurePromise | TEnsureCB;
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
    giveups: IUuidBooleanHash;
    write: Function;
    isOpen: boolean;
    lockholderCount: ILockHolderCount;
    close: Function;
    constructor($opts: TClientOptions, cb?: TClientCB);
    static create(opts: TClientOptions, cb: TClientCB): Promise<Client>;
    addListener(key: any, fn: any): void;
    setLockRequestorCount(key: any, val: any): void;
    getLockholderCount(key: any): number;
    requestLockInfo(key: any, opts: any, cb: any): void;
    lock(key: string, opts: Partial<IClientLockOpts>, cb: TClientLockCB): any;
    unlock(key: string, opts: Partial<IClientUnlockOpts>, cb: TClientUnlockCB): void;
}
