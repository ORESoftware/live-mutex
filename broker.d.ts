import { Server } from '@types/uws';
import { CWebSocket } from './uws';
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
export declare type TBrokerCB = (err: Error | null | undefined | string, val: Broker) => void;
export declare type TEnsureCB = (cb: TBrokerCB) => void;
export declare type TEnsurePromise = () => Promise<Broker>;
export declare type TEnsure = TEnsurePromise | TEnsureCB;
export declare class Broker {
    opts: IBrokerOptsPartial;
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    send: IBrokerSend;
    wss: Server;
    uuids: IUuidWSHash;
    rejected: IUuidWSHash;
    timeouts: IUuidWSHash;
    locks: IUuidWSHash;
    ensure: TEnsure;
    wsLock: Map<CWebSocket, Array<string>>;
    clientIdsToKeys: Map<CWebSocket, Array<string>>;
    constructor($opts: IBrokerOptsPartial, cb?: IErrorFirstCB);
    static create(opts: IBrokerOptsPartial, cb?: TBrokerCB): Promise<Broker>;
    sendStatsMessageToAllClients(): void;
    ensureNewLockHolder(lck: any, data: any, cb: any): void;
    retrieveLockInfo(data: any, ws: any): void;
    lock(data: any, ws: any): void;
    unlock(data: Object, ws?: CWebSocket): void;
}
