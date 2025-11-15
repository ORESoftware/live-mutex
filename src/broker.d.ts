import * as net from 'net';
import { LinkedQueue } from '@oresoftware/linked-queue';
export declare const log: {
    info: any;
    error: any;
    warn: any;
    debug(...args: any[]): void;
};
import { EventEmitter } from 'events';
import Timer = NodeJS.Timer;
export interface ValidConstructorOpts {
    [key: string]: string;
}
export declare const validConstructorOptions: ValidConstructorOpts;
export interface IBrokerOpts {
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    noDelay: boolean;
    udsPath: string;
    noListen: boolean;
}
export type IBrokerOptsPartial = Partial<IBrokerOpts>;
export type IErrorFirstCB = (err: Error | null, val?: unknown) => void;
export interface BrokerSend {
    (ws: net.Socket, data: any, cb?: IErrorFirstCB): void;
}
export interface IUuidWSHash {
    [key: string]: net.Socket;
}
export interface IUuidTimer {
    [key: string]: NodeJS.Timer;
}
export type TBrokerCB = (err: Error | null, val: Broker) => void;
export type TEnsure = (cb?: TBrokerCB) => Promise<Broker>;
export interface IBookkeepingHash {
    [key: string]: IBookkeeping;
}
export interface IUuidBooleanHash {
    [key: string]: boolean;
}
export interface LMXSocket extends net.Socket {
    lmxClosed: boolean;
    destroyTimeout: Timer;
}
export interface IBookkeeping {
    rawLockCount: number;
    rawUnlockCount: number;
    lockCount: number;
    unlockCount: number;
}
export interface UuidHash {
    [key: string]: boolean;
}
export type LockholdersType = Map<string, {
    pid: number;
    ws: net.Socket;
    uuid: string;
    timer?: NodeJS.Timer;
}>;
export interface LockObj {
    readers?: number;
    max: number;
    lockholderTimeouts: UuidHash;
    lockholdersAllReleased: UuidHash;
    lockholders: LockholdersType;
    notify: LinkedQueue<NotifyObj>;
    key: string;
    keepLocksAfterDeath: boolean;
    writerFlag: boolean;
    timestampEmptied: number;
    isViaShell?: boolean;
}
export interface NotifyObj {
    ws: LMXSocket;
    uuid: string;
    pid: number;
    ttl: number;
    keepLocksAfterDeath: boolean;
}
export interface KeyToBool {
    [key: string]: boolean;
}
export interface UUIDToBool {
    [key: string]: boolean;
}
export interface RegisteredListener {
    ws: net.Socket;
    uuid: string;
    key: string;
    fn: Function;
}
export declare class Broker {
    opts: IBrokerOptsPartial;
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    noListen: boolean;
    send: BrokerSend;
    rejected: IUuidBooleanHash;
    timeouts: IUuidTimer;
    locks: Map<string, LockObj>;
    ensure: TEnsure;
    start: TEnsure;
    wsToUUIDs: Map<LMXSocket, UUIDToBool>;
    wsToKeys: Map<LMXSocket, KeyToBool>;
    isOpen: boolean;
    wss: net.Server;
    emitter: EventEmitter;
    noDelay: boolean;
    socketFile: string;
    lockCounts: number;
    connectedClients: Set<LMXSocket>;
    registeredListeners: {
        [key: string]: Array<RegisteredListener>;
    };
    constructor(o?: IBrokerOptsPartial, cb?: IErrorFirstCB);
    static create(opts: IBrokerOptsPartial): Broker;
    private emit;
    private on;
    private once;
    onWarning(callback: (...args: any[]) => void): void;
    ping(data: any, ws: net.Socket): void;
    getSystemStats(data: any, ws: net.Socket): void;
    close(cb: (err: any) => void): void;
    getListeningInterface(): string | number;
    getVersion(): any;
    getPort(): number;
    getHost(): string;
    abruptlyDestroyConnection(ws: LMXSocket): void;
    abruptlyEndConnection(ws: LMXSocket): void;
    onVersion(data: any, ws: LMXSocket): void;
    cleanupConnection(ws: LMXSocket): void;
    ls(data: any, ws: LMXSocket): void;
    broadcast(data: any, ws: LMXSocket): void;
    incrementReaders(data: any, ws: net.Socket): void;
    setWriteFlagToFalseAndBroadcast(data: any, ws: net.Socket): void;
    decrementReaders(data: any, ws: net.Socket): void;
    registerWriteFlagAndReadersCheck(data: any, ws: net.Socket): number;
    getDefaultLockObject(key: string, keepLocksAfterDeath?: boolean, max?: number): LockObj;
    registerWriteFlagCheck(data: any, ws: net.Socket): void;
    inspect(data: any, ws: net.Socket): void;
    ensureNewLockHolder(lck: LockObj, data: any): void;
    retrieveLockInfo(data: any, ws: net.Socket): void;
    cleanUpLocks(): void;
    lock(data: any, ws: LMXSocket): void;
    unlock(data: any, ws?: net.Socket): void;
}
export declare const LvMtxBroker: typeof Broker;
export declare const LMXBroker: typeof Broker;
export default Broker;
