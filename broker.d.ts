/// <reference types="node" />
import { Server } from '@types/uws';
import { CWebSocket } from './dts/uws';
import Timer = NodeJS.Timer;
export interface IBrokerOpts {
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
}
export declare type IBrokerOptsPartial = Partial<IBrokerOpts>;
export declare type IErrorFirstCB = (err: Error | null | undefined | string, val?: any) => void;
export interface IBrokerSend {
    (ws: CWebSocket, data: any, cb?: IErrorFirstCB): void;
}
export interface IUuidWSHash {
    [key: string]: CWebSocket;
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
    ws: CWebSocket;
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
    wss: Server;
    rejected: IUuidBooleanHash;
    timeouts: IUuidTimer;
    locks: ILockHash;
    ensure: TEnsure;
    wsLock: Map<CWebSocket, Array<string>>;
    wsToKeys: Map<CWebSocket, Array<string>>;
    bookkeeping: IBookkeepingHash;
    constructor($opts: IBrokerOptsPartial, cb?: IErrorFirstCB);
    static create(opts: IBrokerOptsPartial, cb?: TBrokerCB): Promise<Broker>;
    sendStatsMessageToAllClients(): void;
    ensureNewLockHolder(lck: any, data: any, cb: any): void;
    retrieveLockInfo(data: any, ws: any): void;
    lock(data: any, ws: any): void;
    unlock(data: Object, ws?: CWebSocket): void;
}
declare const $exports: any;
export default $exports;
