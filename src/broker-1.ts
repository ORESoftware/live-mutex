'use strict';

//core
import * as assert from 'assert';
import * as net from 'net';
import * as util from 'util';
import * as fs from 'fs';

//npm
import chalk from "chalk";
import {createParser} from "./json-parser";
import {LinkedQueue, LinkedQueueValue, IsVoid} from '@oresoftware/linked-queue';


//project
const isLocalDev = process.env.oresoftware_local_dev === 'yes';
import {forDebugging} from './shared-internal';

const debugLog = process.argv.indexOf('--lmx-debug') > 0 || process.env.lmx_debug === 'yes';

export const log = {
    info: console.log.bind(console, chalk.gray.bold('lmx broker info:')),
    error: console.error.bind(console, chalk.red.bold('lmx broker error:')),
    warn: console.error.bind(console, chalk.yellow.bold('lmx broker warning:')),
    debug(...args: any[]) {
        if (debugLog) {
            let newTime = Date.now();
            let elapsed = newTime - forDebugging.previousTime;
            forDebugging.previousTime = newTime;
            console.log(chalk.yellow.bold('lmx broker debugging:'), 'elapsed millis:', `(${elapsed})`, ...args);
        }
    }
};


import {weAreDebugging} from './we-are-debugging';
import {EventEmitter} from 'events';
import * as path from "path";
import Timer = NodeJS.Timer;
import {RWStatus, inspectError} from "./shared-internal";
import {compareVersions} from "./compare-versions";
import {joinToStr} from "./shared-internal";

if (weAreDebugging) {
    log.error('Broker is in debug mode. Timeouts are turned off.');
}

const brokerPackage = require('../package.json');

if (!(brokerPackage.version && typeof brokerPackage.version === 'string')) {
    throw new Error('Broker NPM package did not have a top-level field that is a string.');
}

process.on('uncaughtException', (e: Error) => {
    if (process.env.lmx_log_errors !== 'nope') {
        log.error('Uncaught Exception event occurred in Broker process:', inspectError(e));
    }
});

process.on('warning', (e: Error) => {
    if (process.env.lmx_log_errors !== 'nope') {
        log.debug('warning:', inspectError(e));
    }
});


export interface ValidConstructorOpts {
    [key: string]: string
}

export const validConstructorOptions = <ValidConstructorOpts>{
    lockExpiresAfter: 'integer in millis',
    timeoutToFindNewLockholder: 'integer in millis',
    host: 'string',
    port: 'integer',
    noDelay: 'boolean',
    udsPath: 'string',
    noListen: 'boolean'
};

export interface IBrokerOpts {
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    noDelay: boolean;
    udsPath: string;
    noListen: boolean;
}

export type IBrokerOptsPartial = Partial<IBrokerOpts>
export type IErrorFirstCB = (err: any, val?: any) => void;

export interface BrokerSend {
    (ws: net.Socket, data: any, cb?: IErrorFirstCB): void;
}

export interface IUuidWSHash {
    [key: string]: net.Socket
}

export interface IUuidTimer {
    [key: string]: NodeJS.Timer
}

export type TBrokerCB = (err: any, val: Broker1) => void;
export type TEnsure = (cb?: TBrokerCB) => Promise<Broker1>;

export interface IBookkeepingHash {
    [key: string]: IBookkeeping;
}

export interface IUuidBooleanHash {
    [key: string]: boolean;
}

export interface LMXSocket extends net.Socket {
    lmxClosed: boolean,
    destroyTimeout: Timer
}

export interface IBookkeeping {
    rawLockCount: number,
    rawUnlockCount: number;
    lockCount: number;
    unlockCount: number;
}

export interface UuidHash {
    [key: string]: boolean
}

export type LockholdersType = Map<string, {
    pid: number,
    ws: net.Socket,
    uuid: string,
    timer?: NodeJS.Timer // Add the timer property
}>

export interface LockObj {
    // current number of lockholders for this lock/key is Object.keys(lockholders).length
    readers?: number;
    max: number, // max number of lockholders
    lockholderTimeouts: UuidHash,
    lockholdersAllReleased: UuidHash,
    lockholders: LockholdersType,  // uuid(s) that hold the lock
    notify: LinkedQueue<NotifyObj>, //Array<NotifyObj>,
    key: string,
    keepLocksAfterDeath: boolean
    writerFlag: boolean,
    timestampEmptied: number,
    isViaShell?: boolean
}

export interface NotifyObj {
    ws: LMXSocket,
    uuid: string,
    pid: number,
    ttl: number,
    keepLocksAfterDeath: boolean
}


export interface KeyToBool {
    [key: string]: boolean
}

export interface UUIDToBool {
    [key: string]: boolean
}

export interface RegisteredListener {
    ws: net.Socket,
    uuid: string,
    key: string,
    fn: Function
}


export class Broker1 {

    opts: IBrokerOptsPartial;
    lockExpiresAfter: number;
    timeoutToFindNewLockholder: number;
    host: string;
    port: number;
    noListen: boolean;
    send: BrokerSend;
    rejected: IUuidBooleanHash;
    timeouts: IUuidTimer;
    locks = new Map<string, LockObj>();
    ensure: TEnsure;
    start: TEnsure;
    wsToUUIDs: Map<LMXSocket, UUIDToBool>;  // {uuid: true}
    wsToKeys: Map<LMXSocket, KeyToBool>; // {key: true}
    isOpen: boolean;
    wss: net.Server;
    emitter = new EventEmitter();
    noDelay = true;
    socketFile = '';
    lockCounts = 0;
    connectedClients = new Set<LMXSocket>();
    registeredListeners = <{ [key: string]: Array<RegisteredListener> }>{};

    constructor(o?: IBrokerOptsPartial, cb?: IErrorFirstCB) {

        this.isOpen = false;
        const opts = this.opts = o || {};
        assert.strict(typeof opts === 'object', 'Options argument must be an object.');

        for (const k of Object.keys(opts)) {
            if (!validConstructorOptions[k]) {
                throw new Error(joinToStr(
                    'An option passed to lmx broker constructor',
                    `is not a recognized option => "${k}", valid options are: ${util.inspect(validConstructorOptions)}.`
                ));
            }
        }

        if (opts['lockExpiresAfter']) {
            assert.strict(Number.isInteger(opts.lockExpiresAfter),
                'lmx broker: "expiresAfter" option needs to be an integer (milliseconds)');
            assert.strict(opts.lockExpiresAfter > 20 && opts.lockExpiresAfter < 4000000,
                'lmx broker: "expiresAfter" is not in range (20 to 4000000 ms).');
        }

        if (opts['timeoutToFindNewLockholder']) {
            assert.strict(Number.isInteger(opts.timeoutToFindNewLockholder),
                'lmx broker: "timeoutToFindNewLockholder" option needs to be an integer (milliseconds)');
            assert.strict(opts.timeoutToFindNewLockholder > 20 && opts.timeoutToFindNewLockholder < 4000000,
                'lmx broker: "timeoutToFindNewLockholder" is not in range (20 to 4000000 ms).');
        }

        if (opts['host']) {
            assert.strict(typeof opts.host === 'string', ' => "host" option needs to be a string.');
        }

        if (opts['port']) {
            assert.strict(Number.isInteger(opts.port),
                'lmx broker: "port" option needs to be an integer => ' + opts.port);
            assert.strict(opts.port > 1024 && opts.port < 49152,
                'lmx broker: "port" integer needs to be in range (1025-49151).');
        }

        if ('noDelay' in opts && opts['noDelay'] !== undefined) {
            assert.strict(typeof opts.noDelay === 'boolean',
                'lmx broker: "noDelay" option needs to be an integer => ' + opts.noDelay);
            this.noDelay = opts.noDelay;
        }

        this.lockExpiresAfter = weAreDebugging ? 5000000 : (opts.lockExpiresAfter || 5000);
        this.timeoutToFindNewLockholder = weAreDebugging ? 5000000 : (opts.timeoutToFindNewLockholder || 4500);
        this.host = opts.host || '127.0.0.1';
        this.port = opts.port || 6970;
        this.noListen = opts.noListen === true;

        if ('udsPath' in opts && opts['udsPath'] !== undefined) {
            assert.strict(typeof opts.udsPath === 'string', 'lmx broker "udsPath" option must be a string.');
            assert.strict(path.isAbsolute(path.resolve(opts.udsPath)), 'lmx broker "udsPath" option must be an absolute path.');
            this.socketFile = path.resolve(opts.udsPath);
        }

        const self = this;

        this.emitter.on('warning', function () {
            if (self.emitter.listenerCount('warning') < 2) {
                log.warn('No "warning" event handlers attached by end-user to the broker emitter, therefore logging these errors from library:');
                log.warn(...arguments);
                log.warn('Add a "warning" event listener to the lmx broker emitter to get rid of this message.');
            }
        });

        this.send = (ws, data, cb) => {

            if (!ws.writable) {
                this.emitter.emit('warning', 'socket is not writable [1].');
                // cleanUp();
                return cb && process.nextTick(cb);
            }

            ws.write(JSON.stringify(data) + '\n', 'utf8', (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    this.emitter.emit('warning', 'socket is not writable [2].');
                    this.emitter.emit('warning', err);
                    // cleanUp();
                }
                cb && process.nextTick(cb);
            });
        };

        const onData = (ws: LMXSocket, data: any) => {

            if (data.type === 'version-mismatch-confirmed') {
                clearTimeout(ws.destroyTimeout);
                ws.destroy();
                return;
            }

            if (ws.lmxClosed) {
                return;
            }

            if (data.type === 'simulate-version-mismatch') {
                return self.onVersion({value: '0.0.1'}, ws);
            }

            if (data.type === 'end-connection-from-broker-for-testing-purposes') {
                return self.abruptlyEndConnection(ws);
            }

            if (data.type === 'destroy-connection-from-broker-for-testing-purposes') {
                return self.abruptlyDestroyConnection(ws);
            }

            const key = data.key;

            if (data.ttl === null) {
                data.ttl = Infinity;
            }

            if (data.inspectCommand) {
                return self.inspect(data, ws);
            }

            if (data.type === 'version') {
                return self.onVersion(data, ws);
            }

            if (data.type === 'ls') {
                return self.ls(data, ws);
            }

            if (data.type === 'unlock') {
                return self.unlock(data, ws);
            }

            if (data.type === 'lock') {
                return self.lock(data, ws);
            }

            if (data.type === 'increment-readers') {
                return self.incrementReaders(data, ws);
            }

            if (data.type === 'decrement-readers') {
                return self.decrementReaders(data, ws);
            }

            if (data.type === 'register-write-flag-check') {
                return self.registerWriteFlagCheck(data, ws);
            }

            if (data.type === 'register-write-flag-and-readers-check') {
                return self.registerWriteFlagAndReadersCheck(data, ws);
            }

            if (data.type === 'set-write-flag-false-and-broadcast') {
                return self.setWriteFlagToFalseAndBroadcast(data, ws);
            }

            if (data.type === 'lock-received') {
                clearTimeout(self.timeouts[data.key]);
                return delete self.timeouts[data.key];
            }

            if (data.type === 'lock-client-timeout' || data.type === 'lock-client-error') {

                // if the client times out, we don't want to send them any more messages
                const lck = self.locks.get(key);
                const uuid = data.uuid;

                if (!lck) {
                    this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
                    return;
                }

                return lck.notify.remove(uuid);
            }

            if (data.type === 'lock-received-rejected') {

                const lck = self.locks.get(key);

                if (!lck) {
                    this.emitter.emit('warning', `Lock for key "${key}" has probably expired.`);
                    return;
                }

                self.rejected[data.uuid] = true;
                return self.ensureNewLockHolder(lck, data);
            }

            if (data.type === 'lock-info-request') {
                return self.retrieveLockInfo(data, ws);
            }

            if (data.type === 'ping') {
                return self.ping(data, ws);
            }

            if (data.type === 'system-stats-request') {
                return self.getSystemStats(data, ws);
            }

            this.emitter.emit('warning', `implementation error, bad data sent to broker => ${util.inspect(data)}`);

            self.send(ws, {
                key: data.key,
                uuid: data.uuid,
                error: 'Malformed data sent to Live-Mutex broker.'
            });

        };

        const wss = this.wss = net.createServer({}, (ws: LMXSocket) => {

            this.connectedClients.add(ws);

            if (self.noDelay) {
                ws.setNoDelay(true);
            }

            if (!self.wsToKeys.get(ws)) {
                self.wsToKeys.set(ws, {});
            }

            let endWS = function () {
                try {
                    ws.destroy();
                }
                finally {
                    // noop
                }
            };

            ws.once('disconnect', () => {
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });

            ws.once('end', () => {
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });

            ws.once('error', (err) => {
                this.emitter.emit('warning', 'lmx client error: ' + inspectError(err));
                this.cleanupConnection(ws);
                ws.destroy();
                ws.removeAllListeners();
            });

            ws.pipe(createParser())
                .on('data', (v: any) => {
                    onData(ws, v);
                })
                .once('error', (e: Error) => {
                    self.send(ws, {
                            error: inspectError(e)
                        },
                        () => {
                            ws.end();
                        });
                });
        });

        let sigEventCallable = true;

        const cleanup = () => {
            if (!sigEventCallable) {
                return;
            }

            sigEventCallable = false;

            try {
                if (this.socketFile) {
                    fs.unlinkSync(this.socketFile);
                    log.info('socket file unlinked:', this.socketFile);
                }

            }
            catch (err) {
                //ignore
            }

            for (const c of this.connectedClients) {
                c.destroy();
            }
            wss.close(function () {
                process.exit(1);
            });
        };

        let sigEvent = (event: string) => (signal: NodeJS.Signals) => {
            this.emitter.emit('warning', signal);
            this.emitter.emit('warning', `"${event}" event has occurred.`);
            cleanup();
        };

        process.once('exit', (code: number) => {
            this.emitter.emit('warning', `Process exiting with code: ${code}`);
            cleanup();
        });
        process.once('SIGINT', sigEvent('SIGINT'));
        process.once('SIGTERM', sigEvent('SIGTERM'));

        wss.on('error', (err: Error) => {
            this.emitter.emit('warning', 'lmx broker error' + inspectError(err));
        });

        let brokerPromise: Promise<Broker1>;

        this.ensure = this.start = (cb?: TBrokerCB) => {

            if (cb && typeof cb !== 'function') {
                throw new Error('optional argument to ensure/connect must be a function.');
            }

            if (cb && process.domain) {
                cb = process.domain.bind(cb);
            }

            if (brokerPromise) {
                return brokerPromise.then(val => {
                        cb && cb.call(self, null, val);
                        return val;
                    },
                    (err) => {
                        cb && cb.call(self, err, <Broker1>{});
                        return Promise.reject(err);
                    });
            }

            const onResolve = (val: Broker1) => {
                cb && cb.call(self, null, val);
                return val;
            };

            const onRejected = (err: Error | string) => {
                cb && cb.call(self, err, <Broker1>{});
                return Promise.reject(err);
            };

            if (this.noListen) {
                return brokerPromise =
                    Promise.resolve(this)
                        .then(onResolve)
                        .catch(onRejected)
            }

            return brokerPromise = new Promise((resolve, reject) => {

                let to = setTimeout(function () {
                    reject('lmx broker error: listening action timed out.')
                }, 3000);

                wss.once('error', reject);

                if (self.socketFile) {
                    wss.listen(self.socketFile, () => {
                        try {
                            fs.chmodSync(self.socketFile, '777');
                        }
                        catch (e) {
                            log.error(e);
                        }

                        self.isOpen = true;
                        clearTimeout(to);
                        wss.removeListener('error', reject);
                        resolve(self);
                    });
                } else {
                    wss.listen(self.port, self.host, () => {
                        self.isOpen = true;
                        clearTimeout(to);
                        wss.removeListener('error', reject);
                        resolve(self);
                    });
                }

            })
                .then(
                    onResolve,
                    onRejected
                );

        };

        this.rejected = {};
        this.timeouts = {};
        this.wsToUUIDs = new Map(); // keys are ws objects, values are lock key maps {uuid: true}
        this.wsToKeys = new Map(); // keys are ws objects, values are key maps {key: true}

        // if the user passes a callback then we call
        // ensure() on behalf of the user
        cb && this.ensure(cb);

    }

    static create(opts: IBrokerOptsPartial): Broker1 {
        return new Broker1(opts);
    }

    private emit() {
        log.warn('warning:', 'use b.emitter.emit() instead of b.emit()');
        return this.emitter.emit.apply(this.emitter, <any>arguments);
    }

    private on() {
        log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, arguments);
    }

    private once() {
        log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, arguments);
    }

    ping(data: any, ws: net.Socket) {
        const uuid = data.uuid;
        const timestamp = data.timestamp || Date.now();

        this.send(ws, {
            uuid: uuid,
            type: 'pong',
            timestamp: timestamp,
            serverTimestamp: Date.now(),
            ping: true
        });
    }

    getSystemStats(data: any, ws: net.Socket) {
        const uuid = data.uuid;

        // Count all pending lock requests across all locks
        let pendingRequests = 0;
        this.locks.forEach(lock => {
            pendingRequests += lock.notify.length || 0;
        });

        const stats = {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            connectedClients: this.connectedClients.size,
            totalLocks: this.locks.size,
            pendingRequests: pendingRequests,
            activeTimeouts: Object.keys(this.timeouts).length,
            pid: process.pid
        };

        this.send(ws, {
            uuid: uuid,
            type: 'system-stats-response',
            stats: stats
        });
    }

    close(cb: (err: any) => void): void {
        // Clean up all timers to prevent memory leaks
        for (const key of Object.keys(this.timeouts)) {
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
        }
        
        // Clean up all lockholder timers
        for (const [key, lockObj] of this.locks) {
            for (const lockholder of lockObj.lockholders.values()) {
                if (lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }
        }
        
        // Close all client connections
        for (const client of this.connectedClients) {
            try {
                client.destroy();
            } catch (err) {
                // ignore errors during cleanup
            }
        }
        this.connectedClients.clear();
        
        // Close the server
        this.wss.close(cb);
    }

    getListeningInterface() {
        return this.socketFile || this.port;
    }

    getVersion() {
        return brokerPackage.version;
    }

    getPort() {
        return this.port;
    }

    getHost() {
        return this.host;
    }

    abruptlyDestroyConnection(ws: LMXSocket) {
        log.error('Connection will be destroyed.');
        ws.destroy();
        ws.removeAllListeners();
    }

    abruptlyEndConnection(ws: LMXSocket) {
        log.error('Connection will be ended.');
        ws.end();
        ws.removeAllListeners();
    }

    onVersion(data: any, ws: LMXSocket) {

        const clientVersion = data.value;
        const brokerVersion = brokerPackage.version;

        try {
            compareVersions(clientVersion, brokerVersion);
        }
        catch (err) {
            this.cleanupConnection(ws);
            const errMessage = `Client version is not compatable with broker,` +
                ` client version: '${clientVersion}', broker version: '${brokerVersion}'.`;
            log.error(err);
            log.error(errMessage);
            this.emitter.emit('error', errMessage);
            this.send(ws, {type: 'version-mismatch', versions: {clientVersion, brokerVersion}});
            ws.destroyTimeout = setTimeout(() => {
                // we delay destroy the connection, so that we can tell the client about a version mismatch
                try {
                    ws.destroy();
                }
                finally {
                    ws.removeAllListeners();
                }

            }, 2000);
        }
        // return this.send(ws, {type:'broker-version', brokerVersion: brokerPackage.version});
    }

    cleanupConnection(ws: LMXSocket) {

        if (ws.lmxClosed === true) {
            return;
        }

        ws.lmxClosed = true;

        this.connectedClients.delete(ws);

        const wsKeys = this.wsToKeys.get(ws);
        this.wsToKeys.delete(ws);

        const uuids = Object.keys(this.wsToUUIDs.get(ws) || {});
        this.wsToUUIDs.delete(ws);

        // Clean up any timeouts for keys associated with this websocket
        if (wsKeys) {
            for (const key of Object.keys(wsKeys)) {
                if (this.timeouts[key]) {
                    clearTimeout(this.timeouts[key]);
                    delete this.timeouts[key];
                }
            }
        }

        for (let [k, lockObj] of this.locks) {

            const notify = lockObj.notify;

            for (const uuid of Object.keys(uuids)) {
                notify.remove(uuid);
            }

            // Clear any timers associated with this websocket, before unlocking
            for (const lockholder of lockObj.lockholders.values()) {
                if (lockholder.ws === ws && lockholder.timer) {
                    clearTimeout(lockholder.timer);
                    lockholder.timer = null;
                }
            }

            if (lockObj.isViaShell !== true) {
                // delete lockObj[k];
                this.unlock({force: true, key: k, from: 'client socket closed/ended/errored'}, ws);
            }
            else if (!lockObj.keepLocksAfterDeath) {
                this.unlock({force: true, key: k, from: 'client socket closed/ended/errored'}, ws);
            }

        }

    }

    ls(data: any, ws: LMXSocket) {
        return this.send(ws, {ls_result: Object.keys(this.locks), uuid: data.uuid});
    }

    broadcast(data: any, ws: LMXSocket) {

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        log.debug('broadcasting for key:', key);

        while (v.length > 0) {

            let p = v.pop();

            p && p.fn && p.fn();

            if (p && p.ws) {
                this.send(p.ws, {
                    key: data.key,
                    uuid: p.uuid,
                    type: 'broadcast-result'
                });
            }

        }

        if (ws) {
            // if we call broadcast via broker, ws is null, so check if it exists
            this.send(ws, {
                key: data.key,
                uuid: uuid,
                type: 'broadcast-success'
            });
        }

    }

    incrementReaders(data: any, ws: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        lck.readers++;

        this.send(ws, {
            key,
            uuid,
            type: 'increment-readers-success'
        });

    }

    setWriteFlagToFalseAndBroadcast(data: any, ws: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        log.debug('setting writer flag to false.');
        lck.writerFlag = false;
        log.debug('broadcasting after setting writer flag to false.');
        this.broadcast({key}, null);

        this.send(ws, {uuid, key, type: 'write-flag-false-and-broadcast-success'});

    }

    decrementReaders(data: any, ws: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);
        log.debug('decrementing readers.');
        const r = lck.readers = Math.max(0, --lck.readers);

        if (r < 1) {
            log.debug('broadcasting because readers are zero.');
            this.broadcast({key}, null);
        }

        this.send(ws, {
            key,
            uuid,
            type: 'decrement-readers-success'
        });

    }

    registerWriteFlagAndReadersCheck(data: any, ws: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        const readersCount = lck && lck.readers || 0;
        const writerFlag = lck.writerFlag || false;

        if (writerFlag || readersCount > 1) {
            return v.push({
                ws, key, uuid, fn: () => {
                    log.debug('delayed setting writer flag to true.');
                    lck.writerFlag = true;
                }
            });
        }

        log.debug('setting writer flag to true.');
        lck.writerFlag = true;

        this.send(ws, {
            readersCount,
            writerFlag,
            key,
            uuid,
            type: 'register-write-flag-and-readers-check-success'
        });

    }

    getDefaultLockObject(key: string, keepLocksAfterDeath?: boolean, max?: number): LockObj {

        return {
            readers: 0,
            max: max || 1,
            lockholders: new Map(),
            lockholdersAllReleased: {},
            keepLocksAfterDeath,
            lockholderTimeouts: {},
            key,
            notify: new LinkedQueue(),
            writerFlag: false,
            timestampEmptied: null
        };

    }

    registerWriteFlagCheck(data: any, ws: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        const lck = this.locks.get(key);
        const readersCount = lck.readers || 0;
        const writerFlag = lck.writerFlag || false;

        if (writerFlag) {
            return v.push({
                ws, key, uuid, fn: () => {
                    console.log('incrementing readers in delayed fashion.');
                    lck.readers++;
                }
            });
        }

        log.debug('incrementing readers right after write flag check.');

        lck.readers++;

        this.send(ws, {
            writerFlag,
            readersCount,
            key,
            uuid,
            type: 'register-write-flag-success'
        });

    }

    inspect(data: any, ws: net.Socket) {

        if (typeof data.inspectCommand !== 'string') {
            return this.send(ws, {error: 'inspectCommand was not a string'});
        }

        switch (data.inspectCommand) {

            case 'lockcount':
            case 'lock-count':
            case 'lock_count':
                return this.send(ws, {inspectResult: 5});

            case 'clientcount':
            case 'client-count':
            case 'client_count':
                return this.send(ws, {inspectResult: 17});

            default:
                return this.send(ws, {inspectResult: 25});
        }

    }

    private grantLock(lck: LockObj, ws: LMXSocket, uuid: string, pid: number, ttl: number, key: string) {

        if (ttl !== Infinity) {
            ttl = weAreDebugging ? 50000000 : (ttl || this.lockExpiresAfter);
        }

        if (!this.wsToKeys.get(ws)) {
            this.wsToKeys.set(ws, {});
        }

        this.wsToKeys.get(ws)[key] = true;

        let timer: NodeJS.Timer = null;

        if (ttl !== Infinity) {
            // Set TTL for this specific lock holder

            timer = setTimeout(() => {
                this.emitter.emit('warning',
                    `lmx broker warning, lock holder timed out after ${ttl}ms for key => "${key}", uuid => "${uuid}"`);

                if (this.locks.has(key)) {
                    const lock = this.locks.get(key);

                    // Mark that this specific holder timed out (for potential unlock requests)
                    lock.lockholderTimeouts[uuid] = true;

                    // Remove only this specific lock holder
                    const hadHolder = lock.lockholders.delete(uuid);

                    if (hadHolder) {

                        this.ensureNewLockHolder(lock, {key, _uuid: uuid});

                    }
                }
            }, ttl);
        }

        lck.lockholders.set(uuid, {pid: pid, uuid, ws, timer});
    }

    ensureNewLockHolder(lck: LockObj, data: any) {

        const locks = this.locks;
        const notifyList = lck.notify;

        // Remove previous lock holder if _uuid is provided
        if (data._uuid) {
            const lockholder = lck.lockholders.get(data._uuid);
            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }
            lck.lockholders.delete(data._uuid);
        }

        lck.keepLocksAfterDeath = null;

        const key = data.key;
        const self = this;

        // Get the current number of lock holders
        const count = lck.lockholders.size;

        // If no lock holders and no clients are waiting, mark the lock as emptied
        if (count < 1 && notifyList.length < 1) {
            lck.timestampEmptied = Date.now();
            return;
        }

        // While there are available slots in the semaphore and clients waiting,
        // continue granting locks
        // Use a more defensive check to prevent race conditions
        while (notifyList.length > 0) {
            // Double-check capacity before granting to prevent exceeding max
            if (lck.lockholders.size >= lck.max) {
                break;
            }

            let lqValue: [string | typeof IsVoid, NotifyObj] | null = null;
            let n: NotifyObj | null = null;

            // Find the next valid waiter
            while ((lqValue = notifyList.dequeue() as [string | typeof IsVoid, NotifyObj] | null)) {
                if (IsVoid.check(lqValue[0])) {
                    break;
                }
                n = lqValue[1];
                if (n && n.ws && n.ws.writable) {
                    break;
                }
            }

            if (!n) {
                // No more valid waiters in the queue
                break;
            }

            // Triple-check capacity immediately before granting to prevent race conditions
            if (lck.lockholders.size >= lck.max) {
                // Put this client back in the notify queue
                notifyList.enqueue(n.uuid, n);
                break;
            }

            // Found a valid client - grant them the lock
            const ws = n.ws;
            const ttl = n.ttl;
            const uuid = n.uuid;

            this.grantLock(lck, ws, uuid, n.pid, ttl, key);
            lck.keepLocksAfterDeath = n.keepLocksAfterDeath || false;

            const ln = lck.notify.length;

            this.send(n.ws, {
                readersCount: lck.readers,
                key: data.key,
                uuid: n.uuid,
                type: 'lock',
                lockRequestCount: ln,
                acquired: true
            });

            // Clear any existing timeout for this key
            if (this.timeouts[key]) {
                clearTimeout(this.timeouts[key]);
                delete this.timeouts[key];
            }

            // Set timeout for re-election if lock holder doesn't confirm
            this.timeouts[key] = setTimeout(() => {

                try {
                    // @ts-ignore
                    delete this.wsToKeys.get(ws)[key];
                }
                catch (err) {
                    // ignore
                }

                delete self.timeouts[key];
                this.emitter.emit('warning', `Re-election occurring for key: "${key}"`);

                if (locks.has(key)) {

                    const lckTemp: LockObj = locks.get(key);
                    const hadHolder = lckTemp.lockholders.delete(uuid);
                    const ln = lckTemp.notify.length;
                    const notifyList = lckTemp.notify;

                    if (hadHolder && !self.rejected[uuid]) {
                        // Re-queue this request if it was removed
                        const lockholder = lckTemp.lockholders.get(uuid);
                        if (!lockholder && !notifyList.contains(uuid)) {
                            // Reconstruct the notify object from the lockholder data if available
                            // Otherwise, just trigger re-election for waiting clients
                            notifyList.deq(5).forEach(lqv => {
                                const obj = lqv.value;
                                self.send(obj.ws, {
                                    key: data.key,
                                    uuid: obj.uuid,
                                    type: 'lock',
                                    lockRequestCount: ln,
                                    reelection: true
                                });
                            });
                        }
                    }

                    // Trigger re-election for waiting clients
                    notifyList.deq(5).forEach(lqv => {
                        const obj = lqv.value;
                        self.send(obj.ws, {
                            key: data.key,
                            uuid: obj.uuid,
                            type: 'lock',
                            lockRequestCount: ln,
                            reelection: true
                        });
                    });
                }

            }, self.timeoutToFindNewLockholder);
        }
    }

    retrieveLockInfo(data: any, ws: net.Socket) {

        const key = data.key;
        const lck = this.locks.get(key);
        const uuid = data.uuid;

        const lockholderUUIDs = Object.keys(lck || {});
        const isLocked = lockholderUUIDs.length > 0;
        const lockRequestCount = lck ? lck.notify.length : null;

        if (isLocked && lockRequestCount > 0) {
            this.emitter.emit('warning', 'lmx implementation warning, lock is unlocked but ' +
                'notify array has at least one item, for key => ' + key);
        }

        this.send(ws, {
            key, uuid, lockholderUUIDs,
            lockRequestCount,
            isLocked: Boolean(isLocked),
            lockInfo: true,
            type: 'lock-info-response'
        });

    }

    cleanUpLocks(): void {

        this.lockCounts = 0;
        const now = Date.now();
        this.locks.forEach((v, k) => {

            if (!v.timestampEmptied) {
                // timestampEmptied is probably null
                return;
            }

            if (now - v.timestampEmptied < 2000) {   // 21600000
                // 6 hours has not transpired since last emptied
                return;
            }

            const notify = v.notify.getLength();
            const count = v.lockholders.size;

            if (count < 1 && notify < 1) {
                // we delete the lock object because it hasn't been used in a while
                log.info(chalk.yellow('deleted lock object with key:'), k);
                this.locks.delete(k);
            }

        });
    }

    lock(data: any, ws: LMXSocket) {

        const key = data.key;
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        const lck = this.locks.get(key);

        if (lck) {
            lck.timestampEmptied = null;
        }

        if (++this.lockCounts > 3) {
            // we look into cleaning up old locks every 30,000 lock requests
            this.cleanUpLocks();
        }

        const uuid = data.uuid;
        const pid = data.pid;
        const max = data.max;  // max lockholders
        const beginRead = data.rwStatus === RWStatus.BeginRead;
        const endRead = data.rwStatus === RWStatus.EndRead;

        const force = data.force;
        const retryCount = data.retryCount;

        if (lck) {
            const count = lck.lockholders.size;
            log.debug(data.rwStatus, 'is contending for lock on key:', key, 'there is/are', count, 'lockholders.');
        }

        let ttl = data.ttl;

        if (ttl !== Infinity) {
            ttl = weAreDebugging ? 500000000 : (data.ttl || this.lockExpiresAfter);
        }

        if (uuid) {
            if (!this.wsToUUIDs.has(ws)) {
                this.wsToUUIDs.set(ws, {});
            }
            this.wsToUUIDs.get(ws)[uuid] = true;
        }

        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }

        if (lck) {

            // lock object with given key exists

            if (Number.isInteger(max)) {
                lck.max = max;
            }

            const ln = lck.notify.length;
            const count = lck.lockholders.size;

            // Strictly enforce max lock holders - prevent race conditions
            if (count >= lck.max) {

                if (count > lck.max) {
                    log.warn(`Semaphore limit exceeded: ${count} lock holders exceeds max of ${lck.max} for key "${key}"`);
                }

                // Lock exists *and* already has a lockholder; adding ws to list of to be notified
                // if we are retrying, we may attempt to call lock() more than once
                // we don't want to push the same ws object / same uuid combo to array

                if (force) {

                    // because of the force option, we put it to the front of the line
                    lck.notify.remove(uuid);
                    lck.notify.addToFront(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});

                }
                else {

                    const alreadyAdded = lck.notify.get(uuid);

                    if (!alreadyAdded) {

                        if (retryCount > 0) {
                            lck.notify.addToFront(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});
                        }
                        else {
                            lck.notify.enqueue(uuid, {ws, uuid, pid, ttl, keepLocksAfterDeath});
                        }
                    }
                }

                this.send(ws, {
                    readersCount: lck.readers,
                    key: key,
                    uuid: uuid,
                    lockRequestCount: ln,
                    type: 'lock',
                    acquired: false
                });

                return;
            }

            // lck exists and we are below the max amount of lockholders
            // so we can acquire the lock
            log.debug(data.rwStatus, 'has acquired lock on key:', key);

            if (beginRead) {
                // lck.readers = Math.max(20, lck.readers++);
                lck.readers++
            }

            if (endRead) {
                // in case something weird happens, never let it go below 0.
                lck.readers = Math.max(0, --lck.readers);
            }

            this.grantLock(lck, ws, uuid, pid, ttl, key);

            this.send(ws, {
                readersCount: lck.readers,
                uuid: uuid,
                key: key,
                lockRequestCount: ln,
                type: 'lock',
                acquired: true
            });

            return;
        }


        // this path: there is no existing lck, so we create a new lck object

        log.debug(data.rwStatus, 'has acquired lock on key:', key);

        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }

        this.wsToKeys.get(ws)[key] = true;

        const lckTemp = this.getDefaultLockObject(key, keepLocksAfterDeath, max);
        this.locks.set(key, lckTemp);

        if (beginRead) {
            // lck.readers = Math.max(20, lck.readers++);
            lckTemp.readers++
        }

        if (endRead) {
            // in case something weird happens, never let it go below 0.
            lckTemp.readers = Math.max(0, --lckTemp.readers);
        }

        this.grantLock(lckTemp, ws, uuid, pid, ttl, key);

        this.send(ws, {
            readersCount: lckTemp.readers,
            uuid: uuid,
            lockRequestCount: 0,
            key: key,
            type: 'lock',
            acquired: true
        });

    }

    unlock(data: any, ws?: net.Socket) {

        const key = data.key;
        const uuid = data.uuid;
        const _uuid = data._uuid;
        const force = data.force;
        const lck = this.locks.get(key);
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);

        if (ws && keepLocksAfterDeath !== true) {
            // we know for a fact that
            // this websocket connection no longer owns this key
            try {
                // @ts-ignore
                delete this.wsToKeys.get(ws)[key];
            }
            catch (err) {
                // ignore err
            }
        }

        try {
            // @ts-ignore
            delete this.wsToUUIDs.get(ws)[_uuid];
        }
        catch (err) {
            // ignore err
        }

        // if the user passed _uuid, then we check it, other true
        // _uuid is the uuid of the original lockholder call
        // the unlock caller can be given right to unlock only if it holds
        // the uuid from the original lock call, as a safeguard
        // this prevents a function from being called at the wrong time, or more than once, etc.

        let same = null;
        if (_uuid && lck) {
            same = lck.lockholders.has(_uuid);
            log.debug('same is:', same);
        }
        else if (lck) {
            // Changed to debug to avoid excessive error logs on force unlocks
            log.debug('no _uuid was passed to unlock');
        }

        if (lck && (same || force)) {

            const ln = lck.notify.length;

            // Get the lockholder's information
            const lockholder = lck.lockholders.get(_uuid);

            if (lockholder && lockholder.timer) {
                clearTimeout(lockholder.timer);
            }

            // remove the lockholder, as the above if stmt checked it,
            //so we don't need to check before deleting it again.
            lck.lockholders.delete(_uuid);

            // delete lck.lockholderTimeouts[_uuid];

            if (force) {
                // If this is a semaphore lock and we're just targeting one lock holder,
                // only remove that specific holder
                if (_uuid && lck.max > 1) {
                    // Just remove this specific lock holder
                    const removed = lck.lockholders.delete(_uuid);
                    if (removed) {
                        lck.lockholdersAllReleased[_uuid] = true;
                    }
                } else {
                    // Traditional force behavior - remove all lock holders
                    for (const k of lck.lockholders.keys()) {
                        lck.lockholdersAllReleased[k] = true;
                    }
                    lck.lockholders = new Map();
                }
            }

            if (uuid && ws) {

                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout

                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    unlocked: true
                });
            }

            this.ensureNewLockHolder(lck, data);
            return;
        }

        if (lck) {

            // we have a lock, but not the same key and force option was not used
            const ln = lck.notify.length;

            if (lck.lockholderTimeouts[_uuid] || lck.lockholdersAllReleased[_uuid]) {

                delete lck.lockholderTimeouts[_uuid];
                delete lck.lockholdersAllReleased[_uuid];

                if (uuid && ws) {

                    // if no uuid is defined, then unlock was called by something other than the client
                    // aka this library called unlock when there was a timeout

                    this.send(ws, {
                        uuid: uuid,
                        key: key,
                        lockRequestCount: ln,
                        type: 'unlock',
                        unlocked: true
                    });

                }

                this.ensureNewLockHolder(lck, data);
                return;
            }


            if (uuid && ws) {

                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout

                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    error: 'You need to pass the correct uuid, or use force.',
                    unlocked: false
                });

            }
            else if (uuid) {
                this.emitter.emit('warning', 'lmx implementation warning - Missing ws (we have a uuid but no ws connection).');
            }
            else if (ws) {
                this.emitter.emit('warning', 'lmx implementation warning - Missing uuid (we have socket connection but no uuid).');
            }
            else {
                this.emitter.emit('warning', 'lmx implementation warning: missing uuid and socket connection.');
            }

            return;
        }


        // lck is not defined
        log.debug('lock was not defined / no longer existed.');
        log.debug(data.rwStatus, 'has released lock on key:', key);

        this.emitter.emit('warning', 'lmx broker implementation warning: no lock with key => "' + key + '"');

        // since the lock no longer exists for this key, remove ownership of this key
        if (ws && uuid) {

            this.emitter.emit('warning', `lmx broker warning: no lock with key => '${key}'.`);

            this.send(ws, {
                uuid: uuid,
                key: key,
                lockRequestCount: 0,
                type: 'unlock',
                unlocked: true,
                warning: `no lock with key => "${key}".`
            });
        }
        else if (ws) {
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid (we have a socket connection but no uuid).');
        }
        else {
            this.emitter.emit('warning', 'lmx implementation warning: missing uuid and socket connection.');
        }
    }

}

// aliases
export const LvMtxBroker = Broker1;
export const LMXBroker = Broker1;
export default Broker1;
