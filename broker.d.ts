/// <reference types="node" />
import Timer = NodeJS.Timer;
import Socket = NodeJS.Socket;
export interface IBrokerOpts {
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
}
export declare type IBrokerOptsPartial = Partial<IBrokerOpts>;
export declare type IErrorFirstCB = (err: Error | null | undefined | string, val?: any) => void;
export interface IBrokerSend {
    (ws: Socket, data: any, cb?: IErrorFirstCB): void;
}
export interface IUuidWSHash {
    [key: string]: Socket;
}
export interface IUuidTimer {
    [key: string]: Timer;
}
export declare type TBrokerCB = (err: Error | null | undefined | string, val: Broker) => void;
export declare type TEnsureCB = (cb: TBrokerCB) => void;
export declare type TEnsurePromise = () => Promise<Broker>;
export declare type TEnsure = TEnsurePromise | TEnsureCB;
export interface IBookkeepingHash {
    [key: string]: IBookkeeping;
}
export interface IUuidBooleanHash {
    [key: string]: boolean;
}
export interface IBookkeeping {
    rawLockCount: number;
    rawUnlockCount: number;
    lockCount: number;
    unlockCount: number;
}
export interface ILookObj {
    pid: number;
    uuid: string;
    notify: Array<INotifyObj>;
    key: string;
    to: Timer;
}
export interface ILockHash {
    [key: string]: ILookObj;
}
export interface INotifyObj {
    ws: Socket;
    uuid: string;
    pid: number;
    ttl: number;
}
export declare class Broker {
    opts: IBrokerOptsPartial;
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    send: IBrokerSend;
    rejected: IUuidBooleanHash;
    timeouts: IUuidTimer;
    locks: ILockHash;
    ensure: TEnsure;
    wsLock: Map<Socket, Array<string>>;
    wsToKeys: Map<Socket, Array<string>>;
    bookkeeping: IBookkeepingHash;
    isOpen: boolean;
    constructor($opts: IBrokerOptsPartial, cb?: IErrorFirstCB);
    static create(opts: IBrokerOptsPartial, cb?: TBrokerCB): Promise<Broker> | void;
    sendStatsMessageToAllClients(): void;
    ensureNewLockHolder(lck: any, data: any, cb: any): void;
    retrieveLockInfo(data: any, ws: any): void;
    lock(data: any, ws: any): void;
    unlock(data: Object, ws?: Socket): void;
}
declare const $exports: any;
export default $exports;
