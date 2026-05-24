'use strict';


import {routineEnter} from './routine';
//core
import * as assert from 'assert';
import * as net from 'net';
import * as util from 'util';
import * as fs from 'fs';
import * as UUID from 'uuid';

const uuidV4 = (): string => UUID.v4();

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
export type IErrorFirstCB = (err: Error | null, val?: unknown) => void;

export interface BrokerSend {
    (ws: net.Socket, data: any, cb?: IErrorFirstCB): void;
}

export interface IUuidWSHash {
    [key: string]: net.Socket
}

export interface IUuidTimer {
    [key: string]: NodeJS.Timer
}

export type TBrokerCB = (err: Error | null, val: Broker1) => void;
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
    /// Per-holder fencing token. Strictly monotonic per key — a
    /// caller seeing a smaller token than they previously held
    /// knows their grant is stale (e.g. they were TTL-evicted and a
    /// successor grabbed the lock). Always >= 1.
    fencingToken: number,
    /// Composite-lock bookkeeping: the public lock UUID issued for an
    /// `acquire-many` grant. `null` for ordinary single-key holds.
    /// All members of the same composite share the same value.
    compositeLockUuid?: string | null,
    /// Wall-clock millisecond deadline for this hold. `Infinity` means
    /// "never expire". Used by the centralised sweeper —
    /// see `Broker1.startTtlSweeper`.
    expiresAt: number
}>

export interface LockObj {
    // current number of lockholders for this lock/key is Object.keys(lockholders).length
    readers?: number;
    max: number, // max number of lockholders (legacy, kept for backward compatibility)
    maxRead?: number, // max number of concurrent readers (default: 10)
    maxWrite?: number, // max number of concurrent writers (default: 1)
    /// Counter used to mint per-key fencing tokens. Increments on every
    /// successful grant (single-key or via `acquire-many`). Never resets
    /// while the `LockObj` is alive, so each holder gets a strictly
    /// greater token than any previous holder of the same key.
    nextFencingToken: number,
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
    keepLocksAfterDeath: boolean,
    /// Optional `acquire-many` membership. When set, this waiter is part
    /// of an `acquireMany` request that wants ALL `allKeys` granted
    /// atomically (union semantics, not a composite intersection lock).
    /// The waiter is queued on the FIRST key it finds contended; on each
    /// progress event for that key, `ensureNewLockHolder` dequeues the
    /// waiter and re-attempts the WHOLE composite. If any other member
    /// key is still taken, the attempt rolls back its provisional grants
    /// and re-queues the waiter on the new contended key. The
    /// pre-allocated `compositeLockUuid` is reused across attempts so
    /// the client sees a stable identifier.
    acquireMany?: {
        allKeys: string[],
        compositeLockUuid: string
    }
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

    // -- Fencing-token + sweeper bookkeeping ---------------------------------
    // `holderDeadlines` is the single source of truth for "when does this
    // hold expire?". Indexed by the holder's `_uuid` (== the same uuid the
    // client passes back to `unlock`). Replaces the prior per-holder
    // `setTimeout`, which scaled poorly (one timer per outstanding lock,
    // O(N) clears on unlock). One `setInterval` (`ttlSweeperHandle`) walks
    // this map every `ttlSweepIntervalMs` and evicts expired holders via
    // the existing `ensureNewLockHolder` path.
    holderDeadlines = new Map<string, { key: string, expiresAt: number, holderUuid: string }>();
    ttlSweeperHandle: NodeJS.Timeout | null = null;
    ttlSweepIntervalMs = 25;
    /// Cumulative number of TTL-driven evictions. Exposed via
    /// `getSystemStats` and the HTTP `/metrics` endpoint.
    ttlEvictionsTotal = 0;
    /// Effective ceiling on per-key `max`. Mirrors the rust port's
    /// `LMX_MAX_CONCURRENCY_CAP`. Set very high by default — primary
    /// purpose is bounding the per-key holder map, not policy.
    maxConcurrencyCap = 1000;
    /// Cumulative count of `lock` requests whose `max` was clamped to
    /// `maxConcurrencyCap`. Non-zero means a caller asked for more
    /// parallelism than the broker is willing to grant.
    concurrencyCapClampsTotal = 0;
    /// Composite locks (`acquire-many`) registry. Keyed by the broker-
    /// minted `compositeLockUuid` so an `unlock-many` request can
    /// quickly find every member key + its per-key holder uuid.
    compositeLocks = new Map<string, { keys: string[], holderUuids: Map<string, string>, fencingTokens: Map<string, number> }>();
    /// Wall-clock at startup. Exposed in `/metrics`.
    startedAt = Date.now();

    constructor(o?: IBrokerOptsPartial, cb?: IErrorFirstCB) {
        const routineId = 'ddl-routine-JjE0VDkv3k9z8KVVwf';
        routineEnter(routineId, "Broker1.constructor");

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

            ws.write(JSON.stringify(data) + '\n', 'utf8', (err: Error | undefined) => {
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

            if (data.type === 'acquire-many') {
                return self.acquireMany(data, ws);
            }

            if (data.type === 'release-many') {
                return self.releaseMany(data, ws);
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

        const handleShutdown = (event: string) => {
            if (!sigEventCallable) {
                return;
            }

            sigEventCallable = false;
            this.emitter.emit('warning', `"${event}" event has occurred.`);

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

        process.once('exit', () => handleShutdown('exit'));
        process.once('SIGINT', () => handleShutdown('SIGINT'));
        process.once('SIGTERM', () => handleShutdown('SIGTERM'));

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

            const onRejected = (err: Error) => {
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

                const listenCallback = () => {
                    if (self.socketFile) {
                        try {
                            fs.chmodSync(self.socketFile, '777');
                        }
                        catch (e) {
                            log.error(e);
                        }
                    }

                    self.isOpen = true;
                    // Start the centralised TTL sweeper as soon as we're
                    // listening — see `tickTtl` / `startTtlSweeper` for
                    // why this replaces the legacy per-holder timers.
                    self.startTtlSweeper();
                    clearTimeout(to);
                    wss.removeListener('error', reject);
                    resolve(self);
                };

                if (self.socketFile) {
                    wss.listen(self.socketFile, listenCallback);
                } else {
                    wss.listen(self.port, self.host, listenCallback);
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

        // Start the TTL sweeper unconditionally — `noListen` brokers
        // (used by integration tests injecting state directly) still
        // need wall-clock eviction. The interval is `unref()`'d so it
        // never blocks process exit.
        this.startTtlSweeper();

        // if the user passes a callback then we call
        // ensure() on behalf of the user
        cb && this.ensure(cb);

    }

    static create(opts: IBrokerOptsPartial): Broker1 {
        const routineId = 'ddl-routine-V4vGtuyEzod37V8S_9';
        routineEnter(routineId, "Broker1.create");
        return new Broker1(opts);
    }

    private emit(...args: Parameters<EventEmitter['emit']>) {
        const routineId = 'ddl-routine-anbNfZxePuQyDEA7OA';
        routineEnter(routineId, "Broker1.emit");
        log.warn('warning:', 'use b.emitter.emit() instead of b.emit()');
        return this.emitter.emit.apply(this.emitter, args);
    }

    private on(...args: Parameters<EventEmitter['on']>) {
        const routineId = 'ddl-routine-8DUeVl-qYaIUQS1iv-';
        routineEnter(routineId, "Broker1.on");
        log.warn('warning:', 'use c.emitter.on() instead of c.on()');
        return this.emitter.on.apply(this.emitter, args);
    }

    private once(...args: Parameters<EventEmitter['once']>) {
        const routineId = 'ddl-routine-h0QjvSllH7xViimF8i';
        routineEnter(routineId, "Broker1.once");
        log.warn('warning:', 'use c.emitter.once() instead of c.once()');
        return this.emitter.once.apply(this.emitter, args);
    }

    ping(data: any, ws: net.Socket) {
        const routineId = 'ddl-routine-hAQet_Z6mcmMv9Xz3b';
        routineEnter(routineId, "Broker1.ping");
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
        const routineId = 'ddl-routine-sz3xB9rrFZrd1U9Eq9';
        routineEnter(routineId, "Broker1.getSystemStats");
        const uuid = data.uuid;
        this.send(ws, {
            uuid: uuid,
            type: 'system-stats-response',
            stats: this.buildStatsSnapshot()
        });
    }

    /// Build a structured snapshot of broker state. Used by both the
    /// TCP `system-stats-request` reply and the HTTP `/metrics` /
    /// `/status` endpoints. Pure (no side effects), so it's safe to
    /// call from any code path.
    buildStatsSnapshot() {
        const routineId = 'ddl-routine-xZVFyRS1nx8EDAoY3K';
        routineEnter(routineId, "Broker1.buildStatsSnapshot");
        let pendingRequests = 0;
        let totalHolders = 0;
        let totalReaders = 0;
        const topKeys: Array<{ key: string, holders: number, waiters: number, max: number, fencingToken: number }> = [];
        for (const [k, lck] of this.locks) {
            const holders = lck.lockholders.size;
            const waiters = lck.notify.length || 0;
            pendingRequests += waiters;
            totalHolders += holders;
            totalReaders += lck.readers || 0;
            if (holders > 0 || waiters > 0) {
                topKeys.push({
                    key: k, holders, waiters,
                    max: lck.max,
                    fencingToken: lck.nextFencingToken
                });
            }
        }
        // Sort by contention (holders + waiters) desc so the status page
        // shows the hottest keys first.
        topKeys.sort((a, b) => (b.holders + b.waiters) - (a.holders + a.waiters));

        return {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            startedAt: this.startedAt,
            connectedClients: this.connectedClients.size,
            totalLocks: this.locks.size,
            totalHolders,
            totalReaders,
            pendingRequests,
            activeTimeouts: Object.keys(this.timeouts).length,
            // New (sweeper / fencing / cap) counters — see field docs above.
            pendingDeadlines: this.holderDeadlines.size,
            ttlEvictionsTotal: this.ttlEvictionsTotal,
            maxConcurrencyCap: this.maxConcurrencyCap,
            concurrencyCapClampsTotal: this.concurrencyCapClampsTotal,
            compositeLocksHeld: this.compositeLocks.size,
            ttlSweepIntervalMs: this.ttlSweepIntervalMs,
            topKeys: topKeys.slice(0, 10),
            pid: process.pid
        };
    }

    /// Render the current broker state as Prometheus text exposition.
    /// Mirrors the metric names used by `dd-rust-network-mutex` so
    /// dashboards work across both implementations (only the prefix
    /// differs: `lmx_*` here vs. `dd_rust_network_mutex_*` there).
    renderPrometheus(): string {
        const routineId = 'ddl-routine-z160UVsijGGwKH3Cz3';
        routineEnter(routineId, "Broker1.renderPrometheus");
        const s = this.buildStatsSnapshot();
        const lines: string[] = [];
        const metric = (name: string, help: string, type: 'counter' | 'gauge', value: number) => {
            lines.push(`# HELP lmx_${name} ${help}`);
            lines.push(`# TYPE lmx_${name} ${type}`);
            lines.push(`lmx_${name} ${value}`);
        };
        metric('keys', 'Total number of distinct keys with live state.', 'gauge', s.totalLocks);
        metric('holders', 'Number of currently-held locks across all keys.', 'gauge', s.totalHolders);
        metric('readers', 'Number of currently-held RW read holds across all keys.', 'gauge', s.totalReaders);
        metric('waiters', 'Number of pending lock requests waiting in queues.', 'gauge', s.pendingRequests);
        metric('clients', 'Number of currently-connected TCP/UDS clients.', 'gauge', s.connectedClients);
        metric('pending_deadlines', 'Number of holders currently registered in the TTL sweeper deadline index.', 'gauge', s.pendingDeadlines);
        metric('ttl_evictions_total', 'Cumulative TTL-driven evictions since broker start.', 'counter', s.ttlEvictionsTotal);
        metric('max_concurrency_cap', 'Effective per-key concurrency ceiling enforced by the broker.', 'gauge', s.maxConcurrencyCap);
        metric('concurrency_cap_clamps_total', 'Cumulative `lock` requests whose `max` was clamped to the cap.', 'counter', s.concurrencyCapClampsTotal);
        metric('composite_locks_held', 'Number of currently-held `acquire-many` composite holds.', 'gauge', s.compositeLocksHeld);
        metric('uptime_seconds', 'Process uptime in seconds.', 'gauge', s.uptime);
        return lines.join('\n') + '\n';
    }

    close(cb: (err: any) => void): void {
        const routineId = 'ddl-routine-TifUrwblfO8bNJWS8U';
        routineEnter(routineId, "Broker1.close");
        // Clean up all timers to prevent memory leaks
        for (const key of Object.keys(this.timeouts)) {
            clearTimeout(this.timeouts[key]);
            delete this.timeouts[key];
        }

        // Stop the centralised TTL sweeper. There are no per-holder
        // timers to clear any more — all eviction state lives in
        // `holderDeadlines`, which is dropped wholesale below.
        this.stopTtlSweeper();
        this.holderDeadlines.clear();

        // Close all client connections
        for (const client of this.connectedClients) {
            try {
                client.destroy();
            } catch (err) {
                // ignore errors during cleanup
            }
        }
        this.connectedClients.clear();
        
        // Clean up Unix domain socket file if it exists
        if (this.socketFile) {
            try {
                if (fs.existsSync(this.socketFile)) {
                    fs.unlinkSync(this.socketFile);
                    log.info('socket file unlinked:', this.socketFile);
                }
            } catch (err) {
                // ignore errors during cleanup
            }
        }
        
        // Close the server (works for both TCP and Unix domain sockets)
        if (this.wss) {
            this.wss.close((err: any) => {
                if (cb) cb(err);
            });
        } else {
            if (cb) cb(null);
        }
    }

    getListeningInterface() {
        const routineId = 'ddl-routine-XmT4a7M_0CcbIdgtQf';
        routineEnter(routineId, "Broker1.getListeningInterface");
        return this.socketFile || this.port;
    }

    getVersion() {
        const routineId = 'ddl-routine-zX08q5PMXrIcL-yTOy';
        routineEnter(routineId, "Broker1.getVersion");
        return brokerPackage.version;
    }

    getPort() {
        const routineId = 'ddl-routine-LwxZ3aM6EiQJXxwPPs';
        routineEnter(routineId, "Broker1.getPort");
        return this.port;
    }

    getHost() {
        const routineId = 'ddl-routine-sWQxRve4pWKnWtcvpB';
        routineEnter(routineId, "Broker1.getHost");
        return this.host;
    }

    /**
     * Attach a callback to listen for warning events and output them
     * @param callback Function that receives warning messages/errors
     */
    onWarning(callback: (...args: any[]) => void): void {
        const routineId = 'ddl-routine-7WQ5lw6mVlfZXsevbx';
        routineEnter(routineId, "Broker1.onWarning");
        this.emitter.on('warning', callback);
    }

    /**
     * Attach a callback to listen for error events and output them
     * @param callback Function that receives error messages
     */
    onError(callback: (...args: any[]) => void): void {
        const routineId = 'ddl-routine-01bktUZwktcl7Lj18h';
        routineEnter(routineId, "Broker1.onError");
        this.emitter.on('error', callback);
    }

    abruptlyDestroyConnection(ws: LMXSocket) {
        const routineId = 'ddl-routine-biO1KkjGbwAQXaA8RP';
        routineEnter(routineId, "Broker1.abruptlyDestroyConnection");
        log.error('Connection will be destroyed.');
        ws.destroy();
        ws.removeAllListeners();
    }

    abruptlyEndConnection(ws: LMXSocket) {
        const routineId = 'ddl-routine-BjGwi4zoAi83TFbo1Q';
        routineEnter(routineId, "Broker1.abruptlyEndConnection");
        log.error('Connection will be ended.');
        ws.end();
        ws.removeAllListeners();
    }

    onVersion(data: any, ws: LMXSocket) {
        const routineId = 'ddl-routine-jC0Gf8pH0Q73_FMJGY';
        routineEnter(routineId, "Broker1.onVersion");

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
        const routineId = 'ddl-routine-PMPIak5cirOZJKKg8S';
        routineEnter(routineId, "Broker1.cleanupConnection");

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

            // Drop the centralised deadline rows for this client's
            // holders so the sweeper doesn't bother visiting them.
            // The actual `unlock(force:true)` call below will also
            // prune any stragglers, but it's cheap to do it here too.
            for (const lockholder of lockObj.lockholders.values()) {
                if (lockholder.ws === ws) {
                    this.holderDeadlines.delete(lockholder.uuid);
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
        const routineId = 'ddl-routine-sGf9wy-_JLqs5wt6Px';
        routineEnter(routineId, "Broker1.ls");
        return this.send(ws, {ls_result: Object.keys(this.locks), uuid: data.uuid});
    }

    broadcast(data: any, ws: LMXSocket) {
        const routineId = 'ddl-routine-aQyDpH6dG1bZK7ema3';
        routineEnter(routineId, "Broker1.broadcast");

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        log.debug('broadcast: key:', key, 'queued listeners:', v.length);

        let processed = 0;
        while (v.length > 0) {

            let p = v.pop();

            if (p && p.fn) {
                log.debug('broadcast: executing queued function for key:', key, 'listener', processed + 1, 'of', v.length + processed + 1);
                p.fn();
                processed++;
            }

            if (p && p.ws) {
                this.send(p.ws, {
                    key: data.key,
                    uuid: p.uuid,
                    type: 'broadcast-result'
                });
            }

        }

        log.debug('broadcast: processed', processed, 'listeners for key:', key);

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
        const routineId = 'ddl-routine-p5ZeAkpg1bEnlfYJ_i';
        routineEnter(routineId, "Broker1.incrementReaders");

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        log.debug('incrementReaders: key:', key, 'current readers:', lck.readers);
        lck.readers++;
        log.debug('incrementReaders: key:', key, 'new readers count:', lck.readers);

        this.send(ws, {
            key,
            uuid,
            type: 'increment-readers-success'
        });

    }

    setWriteFlagToFalseAndBroadcast(data: any, ws: net.Socket) {
        const routineId = 'ddl-routine-RA8AmZ4MKcIgJxueJq';
        routineEnter(routineId, "Broker1.setWriteFlagToFalseAndBroadcast");

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        log.debug('setWriteFlagToFalseAndBroadcast: key:', key, 'uuid:', uuid, 'current writerFlag:', lck.writerFlag, 'readers:', lck.readers, 'queued listeners:', this.registeredListeners[key]?.length || 0);
        lck.writerFlag = false;
        log.debug('setWriteFlagToFalseAndBroadcast: writer flag set to false, broadcasting to', this.registeredListeners[key]?.length || 0, 'queued listeners');
        this.broadcast({key}, null);

        log.debug('setWriteFlagToFalseAndBroadcast: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, {uuid, key, type: 'write-flag-false-and-broadcast-success'});
        log.debug('setWriteFlagToFalseAndBroadcast: success response sent for key:', key, 'uuid:', uuid);

    }

    decrementReaders(data: any, ws: net.Socket) {
        const routineId = 'ddl-routine-EI8D9e4ABqh76TF3Uu';
        routineEnter(routineId, "Broker1.decrementReaders");

        const key = data.key;
        const uuid = data.uuid;

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);
        log.debug('decrementReaders: key:', key, 'current readers:', lck.readers);
        const r = lck.readers = Math.max(0, --lck.readers);
        log.debug('decrementReaders: key:', key, 'new readers count:', r);

        if (r < 1) {
            log.debug('decrementReaders: readers are zero, broadcasting to', this.registeredListeners[key]?.length || 0, 'queued listeners');
            this.broadcast({key}, null);
        }

        log.debug('decrementReaders: sending success response for key:', key, 'uuid:', uuid);
        this.send(ws, {
            key,
            uuid,
            type: 'decrement-readers-success'
        });
        log.debug('decrementReaders: success response sent for key:', key, 'uuid:', uuid);

    }

    registerWriteFlagAndReadersCheck(data: any, ws: net.Socket) {
        const routineId = 'ddl-routine-IECie_TqsOzSf9VqSK';
        routineEnter(routineId, "Broker1.registerWriteFlagAndReadersCheck");

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        let lck = this.locks.get(key);

        const readersCount = lck && lck.readers || 0;
        const writerFlag = lck.writerFlag || false;

        log.debug('registerWriteFlagAndReadersCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount);

        if (writerFlag || readersCount > 1) {
            log.debug('registerWriteFlagAndReadersCheck: queuing write request, current queue length:', v.length);
            return v.push({
                ws, key, uuid, fn: () => {
                    log.debug('registerWriteFlagAndReadersCheck: delayed setting writer flag to true for key:', key);
                    lck.writerFlag = true;
                }
            });
        }

        log.debug('registerWriteFlagAndReadersCheck: setting writer flag to true immediately for key:', key);
        lck.writerFlag = true;

        this.send(ws, {
            readersCount,
            writerFlag,
            key,
            uuid,
            type: 'register-write-flag-and-readers-check-success'
        });

    }

    getDefaultLockObject(key: string, keepLocksAfterDeath?: boolean, max?: number, maxRead?: number, maxWrite?: number): LockObj {
        const routineId = 'ddl-routine-qlPRsjjWl7JCmxi0M-';
        routineEnter(routineId, "Broker1.getDefaultLockObject");

        return {
            readers: 0,
            // Legacy `max` field. Note `max == 0` is rejected up-front
            // in `lock()` (see `validateMaxField`), so the defensive
            // `|| 1` here only fires when callers omit the field
            // entirely (`undefined` / null).
            max: max || 1,
            maxRead: maxRead !== undefined ? maxRead : (maxRead === null ? 10 : undefined), // Default: 10 for read locks
            maxWrite: maxWrite !== undefined ? maxWrite : (maxWrite === null ? 1 : undefined), // Default: 1 for write locks
            // Seed the per-key fencing-token counter from wall-clock
            // millis. Subsequent grants increment by 1 (`++`), so:
            //   * monotonicity is still strictly counter-driven (no
            //     dependence on the clock between grants),
            //   * tokens are wall-clock-aligned so operators can spot
            //     "this lock was issued ~now" by reading the number,
            //   * after a broker restart the same key's tokens jump to
            //     a fresh `Date.now()` — strictly greater than any
            //     prior incarnation's tokens (assuming the wall clock
            //     didn't rewind further than the broker's uptime),
            //   * stays well inside `Number.MAX_SAFE_INTEGER` (a key
            //     would need ~9e15 grants in its lifetime to overflow).
            nextFencingToken: Date.now(),
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
        const routineId = 'ddl-routine-hMv0PM_6oirTM6mApV';
        routineEnter(routineId, "Broker1.registerWriteFlagCheck");

        const key = data.key;
        const uuid = data.uuid;
        const v = this.registeredListeners[key] = this.registeredListeners[key] || [];

        if (!this.locks.has(key)) {
            this.locks.set(key, this.getDefaultLockObject(key, false, 1));
        }

        const lck = this.locks.get(key);
        const readersCount = lck.readers || 0;
        const writerFlag = lck.writerFlag || false;

        log.debug('registerWriteFlagCheck: key:', key, 'writerFlag:', writerFlag, 'readersCount:', readersCount, 'current queue length:', v.length);

        if (writerFlag) {
            // Writer flag is set, queue this read request to wait for writer to finish
            log.debug('registerWriteFlagCheck: writer flag is set, queuing read request for key:', key);
            v.push({
                ws, key, uuid, fn: () => {
                    log.debug('registerWriteFlagCheck: delayed incrementing readers for key:', key, 'current readers:', lck.readers);
                    lck.readers++;
                    log.debug('registerWriteFlagCheck: readers incremented to:', lck.readers, 'sending success response');
                    // Send response after incrementing
                    this.send(ws, {
                        writerFlag: false,
                        readersCount: lck.readers,
                        key,
                        uuid,
                        type: 'register-write-flag-success'
                    });
                }
            });
            // Send initial response indicating we're queued
            log.debug('registerWriteFlagCheck: sending queued response for key:', key);
            this.send(ws, {
                writerFlag: true,
                readersCount: readersCount,
                key,
                uuid,
                type: 'register-write-flag-check-queued'
            });
            return;
        }

        log.debug('registerWriteFlagCheck: no writer flag, allowing read to proceed for key:', key, 'current readers:', lck.readers);
        // NOTE: Do NOT increment readers here - incrementReaders will be called separately after lock acquisition
        // This prevents double-counting readers

        this.send(ws, {
            writerFlag,
            readersCount,
            key,
            uuid,
            type: 'register-write-flag-success'
        });

    }

    inspect(data: any, ws: net.Socket) {
        const routineId = 'ddl-routine-3DUhpmN2OmyvuEuz6Y';
        routineEnter(routineId, "Broker1.inspect");

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

    /// Grant `key` to `ws`. Mints a fresh fencing token (strictly
    /// monotonic per key) and records a deadline in
    /// `holderDeadlines` instead of arming a per-holder `setTimeout`.
    /// The single broker-wide TTL sweeper (`startTtlSweeper` →
    /// `tickTtl`) is the only thing that fires evictions now —
    /// historically there was one timer per outstanding lock, which
    /// scaled poorly under heavy semaphore use and made unlock
    /// quadratic in the number of holders we had to clear.
    ///
    /// Returns the fencing token so callers (`lock`, `acquireMany`)
    /// can include it in the grant response.
    private grantLock(lck: LockObj, ws: LMXSocket, uuid: string, pid: number, ttl: number, key: string): number {
        const routineId = 'ddl-routine-letgqptk20OjPFKcDO';
        routineEnter(routineId, "Broker1.grantLock");

        if (ttl !== Infinity) {
            ttl = weAreDebugging ? 50000000 : (ttl || this.lockExpiresAfter);
        }

        if (!this.wsToKeys.get(ws)) {
            this.wsToKeys.set(ws, {});
        }

        this.wsToKeys.get(ws)[key] = true;

        // Strictly monotonic per-key fencing token. Strict monotonicity
        // — never resets while the LockObj is alive — means a holder
        // who reads its token can detect stale-handoff bugs (e.g. a
        // resource being modified by an ex-holder whose TTL fired).
        lck.nextFencingToken++;
        const token = lck.nextFencingToken;
        const expiresAt = this.scheduleDeadline(key, uuid, ttl);

        lck.lockholders.set(uuid, {
            pid,
            uuid,
            ws,
            fencingToken: token,
            compositeLockUuid: null,
            expiresAt
        });
        return token;
    }

    ensureNewLockHolder(lck: LockObj, data: any) {
        const routineId = 'ddl-routine-joG1ztmn2R_wxdRWtb';
        routineEnter(routineId, "Broker1.ensureNewLockHolder");

        const locks = this.locks;
        const notifyList = lck.notify;

        // Remove previous lock holder if _uuid is provided. The
        // sweeper's centralised deadline index is the only thing
        // tracking TTL now — drop the row so the next sweep doesn't
        // bother inspecting an already-released holder.
        if (data._uuid) {
            this.holderDeadlines.delete(data._uuid);
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

            let lqValue: [string, NotifyObj] | [typeof IsVoid] | undefined;
            let n: NotifyObj = <any>null;

            // Find the next valid waiter
            while (lqValue = notifyList.dequeue() as [string, NotifyObj] | [typeof IsVoid] | undefined) {
                if (IsVoid.check(lqValue[0])) {
                    break;
                }
                n = (lqValue as [string, NotifyObj])[1];
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

            // Multi-key (`acquire-many`) waiter: re-attempt the WHOLE
            // composite atomically. Either grants all member keys (and
            // emits `acquired:true`), or rolls back this attempt and
            // re-queues the waiter on the new contended key. Either way
            // it's terminal for this iteration of the drain loop, so we
            // `continue` to consider the next waiter.
            if (n.acquireMany) {
                this.tryGrantAcquireManyFromQueue(n);
                continue;
            }

            // Found a valid client - grant them the lock
            const ws = n.ws;
            const ttl = n.ttl;
            const uuid = n.uuid;

            const fencingToken = this.grantLock(lck, ws, uuid, n.pid, ttl, key);
            lck.keepLocksAfterDeath = n.keepLocksAfterDeath || false;

            const ln = lck.notify.length;

            this.send(n.ws, {
                readersCount: lck.readers,
                key: data.key,
                uuid: n.uuid,
                type: 'lock',
                lockRequestCount: ln,
                acquired: true,
                fencingToken
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
                            notifyList.deq(5).forEach((lqv: [string, NotifyObj] | [typeof IsVoid] | { value: NotifyObj }) => {
                                // deq returns [K, V] tuples from dequeue() (despite type definition saying LinkedQueueValue)
                                let obj: NotifyObj;
                                if (Array.isArray(lqv) && !IsVoid.check(lqv[0])) {
                                    // It's a [K, V] tuple
                                    obj = (lqv as [string, NotifyObj])[1];
                                } else if (lqv && typeof lqv === 'object' && 'value' in lqv) {
                                    // Fallback: might be LinkedQueueValue (though unlikely)
                                    obj = (lqv as { value: NotifyObj }).value;
                                } else {
                                    return; // Skip invalid entries
                                }
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
                    notifyList.deq(5).forEach((lqv: [string, NotifyObj] | [typeof IsVoid] | { value: NotifyObj }) => {
                        // deq returns [K, V] tuples from dequeue() (despite type definition saying LinkedQueueValue)
                        let obj: NotifyObj;
                        if (Array.isArray(lqv) && !IsVoid.check(lqv[0])) {
                            // It's a [K, V] tuple
                            obj = (lqv as [string, NotifyObj])[1];
                        } else if (lqv && typeof lqv === 'object' && 'value' in lqv) {
                            // Fallback: might be LinkedQueueValue (though unlikely)
                            obj = (lqv as { value: NotifyObj }).value;
                        } else {
                            return; // Skip invalid entries
                        }
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
        const routineId = 'ddl-routine-sCi0yybxG5_0AB7Rvz';
        routineEnter(routineId, "Broker1.retrieveLockInfo");

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
        const routineId = 'ddl-routine-K_e9-m-vRMzy-mjeDk';
        routineEnter(routineId, "Broker1.cleanUpLocks");

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

    /// Validate the `max`/`maxRead`/`maxWrite` fields of an incoming
    /// `lock` request. Sends a `{type:'lock', acquired:false, error:...}`
    /// reply and returns `false` if any field is malformed; the caller
    /// should `return` immediately in that case.
    ///
    /// Previously these fields were validated only client-side and the
    /// broker silently degenerated `max=0` / negative values into either
    /// `1` (`max || 1` in `getDefaultLockObject`) or "always queue"
    /// (`count >= 0` always true). That was a foot-gun: a misconfigured
    /// caller would either get the wrong concurrency level or hang
    /// forever, with no diagnostic. The Rust port (`rust-network-mutex-rs`)
    /// rejects these eagerly; we do the same here so cross-runtime
    /// behaviour matches.
    private validateMaxField(data: any, ws: LMXSocket): boolean {
        const routineId = 'ddl-routine-f9W536K79v1JDngSl9';
        routineEnter(routineId, "Broker1.validateMaxField");
        const errMsg = (field: string) =>
            `\`${field}\` must be a positive integer (>= 1) when provided; omit the field to keep the default.`;

        for (const field of ['max', 'maxRead', 'maxWrite'] as const) {
            const v = data[field];
            if (v === undefined || v === null) continue;
            if (!Number.isInteger(v) || v < 1) {
                this.send(ws, {
                    type: 'lock',
                    uuid: data.uuid,
                    key: data.key,
                    acquired: false,
                    lockRequestCount: 0,
                    readersCount: 0,
                    error: errMsg(field)
                });
                return false;
            }
        }
        return true;
    }

    /// Clamp a requested `max` against `maxConcurrencyCap`. Increments
    /// `concurrencyCapClampsTotal` on a clamp. Returns the effective
    /// `max` to use.
    private clampMax(requested: number): number {
        const routineId = 'ddl-routine-etU2Hw8-oMVUrdhIWE';
        routineEnter(routineId, "Broker1.clampMax");
        if (!Number.isInteger(requested) || requested < 1) {
            // Defensive: we expect callers to have passed `validateMaxField`
            // first. Treat as "use default" rather than throwing.
            return 1;
        }
        if (requested > this.maxConcurrencyCap) {
            this.concurrencyCapClampsTotal++;
            return this.maxConcurrencyCap;
        }
        return requested;
    }

    /// Register a TTL deadline for a freshly granted hold. Called from
    /// `grantLock` after the holder is inserted into `lck.lockholders`.
    /// `Infinity` ttl is treated as "no eviction" — we simply skip
    /// registering, so the sweeper has nothing to scan.
    private scheduleDeadline(key: string, holderUuid: string, ttl: number): number {
        const routineId = 'ddl-routine-8aNlR3egRuRPfrR4eU';
        routineEnter(routineId, "Broker1.scheduleDeadline");
        const expiresAt = ttl === Infinity ? Infinity : Date.now() + ttl;
        if (expiresAt !== Infinity) {
            this.holderDeadlines.set(holderUuid, { key, expiresAt, holderUuid });
        }
        return expiresAt;
    }

    /// One periodic sweep over `holderDeadlines`. Evicts every entry whose
    /// `expiresAt <= now` by:
    ///   1. checking the holder is still present in the live `LockObj` (the
    ///      sweeper does *not* eagerly remove deadlines on `unlock`, so we
    ///      may see stale rows — that's fine, we just skip them),
    ///   2. removing the holder from `lck.lockholders`,
    ///   3. recording the eviction in `lockholderTimeouts` so a later
    ///      `unlock` from the racy ex-holder gets a sane "your hold was
    ///      already released" reply,
    ///   4. calling `ensureNewLockHolder` to wake the next waiter.
    ///
    /// Public so tests can drive eviction synchronously without waiting on
    /// `setInterval`.
    tickTtl(now: number = Date.now()): number {
        const routineId = 'ddl-routine-M6yenWsAn7Nrl9QQrG';
        routineEnter(routineId, "Broker1.tickTtl");
        let evicted = 0;
        // Snapshot the keys we plan to inspect — `ensureNewLockHolder`
        // mutates `holderDeadlines` indirectly when it grants new
        // holders, so iterating in-place is unsafe.
        const expired: Array<{ key: string, holderUuid: string }> = [];
        for (const [uuid, entry] of this.holderDeadlines) {
            if (entry.expiresAt <= now) {
                expired.push({ key: entry.key, holderUuid: uuid });
            }
        }

        for (const { key, holderUuid } of expired) {
            this.holderDeadlines.delete(holderUuid);
            const lck = this.locks.get(key);
            if (!lck) continue;
            const holder = lck.lockholders.get(holderUuid);
            if (!holder) continue;
            // Mark as "expired by sweeper" so a late `unlock` from this
            // holder's owner returns `unlocked:true` instead of an error.
            lck.lockholderTimeouts[holderUuid] = true;
            lck.lockholders.delete(holderUuid);
            this.ttlEvictionsTotal++;
            this.emitter.emit('warning',
                `lmx broker: TTL sweeper evicted holder uuid=${holderUuid} on key="${key}" after wall-clock deadline.`);
            // Re-grant: same code path the legacy per-holder timer called.
            this.ensureNewLockHolder(lck, { key, _uuid: holderUuid });
        }
        return evicted = expired.length;
    }

    /// Start the periodic sweeper. Idempotent — calling twice is a no-op.
    /// `lm-start-server` calls this in the constructor's `ensure()` flow.
    startTtlSweeper(intervalMs?: number): void {
        const routineId = 'ddl-routine-vNGTlfT8Mwb2YIWKk3';
        routineEnter(routineId, "Broker1.startTtlSweeper");
        if (this.ttlSweeperHandle) return;
        if (intervalMs && Number.isInteger(intervalMs) && intervalMs > 0) {
            this.ttlSweepIntervalMs = intervalMs;
        }
        const handle = setInterval(() => {
            try {
                this.tickTtl();
            } catch (err) {
                this.emitter.emit('warning', `lmx broker: TTL sweeper threw: ${inspectError(err as Error)}`);
            }
        }, this.ttlSweepIntervalMs);
        // Don't keep the event loop alive just for the sweeper.
        if (typeof handle.unref === 'function') handle.unref();
        this.ttlSweeperHandle = handle;
    }

    /// Stop the sweeper. Used by tests and by `Broker1.close` (if added).
    stopTtlSweeper(): void {
        const routineId = 'ddl-routine-wGrYhuom4cyuG6t_sz';
        routineEnter(routineId, "Broker1.stopTtlSweeper");
        if (this.ttlSweeperHandle) {
            clearInterval(this.ttlSweeperHandle);
            this.ttlSweeperHandle = null;
        }
    }

    /// Atomically grant a queued `acquire-many` waiter ALL of its member
    /// keys, or roll back and re-queue on the new contended key.
    ///
    /// Called from `ensureNewLockHolder` after dequeueing a waiter whose
    /// `n.acquireMany` is set. Walks the waiter's `allKeys` in their
    /// canonical (sorted) order. If every key has a free slot, grants
    /// all of them under a single `compositeLockUuid` and emits
    /// `acquired:true`. If any key is still contended, rolls back the
    /// provisional grants made inside this attempt and re-queues the
    /// waiter on the new contended key — `ensureNewLockHolder` will
    /// re-enter here when that key frees up.
    ///
    /// The pre-allocated `compositeLockUuid` is reused across attempts
    /// so the client sees a stable identifier across `acquired:false`
    /// → `acquired:true` transitions.
    private tryGrantAcquireManyFromQueue(n: NotifyObj): void {
        const routineId = 'ddl-routine-tryGrantAcquireMany-Yp4';
        routineEnter(routineId, "Broker1.tryGrantAcquireManyFromQueue");

        if (!n.acquireMany) {
            // Defensive: caller checked `n.acquireMany` already, but be
            // explicit so a refactor can't silently lose this contract.
            return;
        }
        const allKeys = n.acquireMany.allKeys;
        const compositeLockUuid = n.acquireMany.compositeLockUuid;
        const ws = n.ws;
        const uuid = n.uuid;
        const pid = n.pid;
        const ttl = n.ttl;
        const keepLocksAfterDeath = n.keepLocksAfterDeath || false;

        const grantedKeys: string[] = [];
        const fencingTokens: Record<string, number> = {};
        const holderUuids: Record<string, string> = {};
        let contendedKey: string | null = null;

        for (const k of allKeys) {
            let lckK = this.locks.get(k);
            if (!lckK) {
                lckK = this.getDefaultLockObject(k, keepLocksAfterDeath, 1);
                this.locks.set(k, lckK);
            }
            const count = lckK.lockholders.size;
            const max = lckK.max;
            if (count >= max) {
                contendedKey = k;
                break;
            }
            const holderUuid = uuidV4();
            lckK.timestampEmptied = null;
            lckK.nextFencingToken++;
            const token = lckK.nextFencingToken;
            const expiresAt = ttl === Infinity ? Infinity : Date.now() + ttl;
            lckK.lockholders.set(holderUuid, {
                pid,
                ws,
                uuid: holderUuid,
                fencingToken: token,
                compositeLockUuid,
                expiresAt
            });
            if (expiresAt !== Infinity) {
                this.holderDeadlines.set(holderUuid, { key: k, expiresAt, holderUuid });
            }
            if (!this.wsToKeys.has(ws)) {
                this.wsToKeys.set(ws, {});
            }
            this.wsToKeys.get(ws)[k] = true;
            grantedKeys.push(k);
            fencingTokens[k] = token;
            holderUuids[k] = holderUuid;
        }

        if (contendedKey) {
            // Roll back provisional grants — they belong to no caller
            // now. We're about to re-queue the waiter on the new
            // contended key.
            for (const gk of grantedKeys) {
                const lckG = this.locks.get(gk);
                const holderId = holderUuids[gk];
                if (lckG && holderId) {
                    this.holderDeadlines.delete(holderId);
                    lckG.lockholders.delete(holderId);
                }
            }
            let lckC = this.locks.get(contendedKey);
            if (!lckC) {
                lckC = this.getDefaultLockObject(contendedKey, keepLocksAfterDeath, 1);
                this.locks.set(contendedKey, lckC);
            }
            const alreadyQueuedResult = lckC.notify.get(uuid) as [string, NotifyObj] | [typeof IsVoid] | undefined;
            const alreadyQueued = alreadyQueuedResult && !IsVoid.check(alreadyQueuedResult[0]);
            if (!alreadyQueued) {
                lckC.notify.enqueue(uuid, n);
            }
            return;
        }

        // All keys granted — register the composite + emit
        // `acquired:true`. Mirrors the immediate-grant path in
        // `acquireMany` so cross-runtime clients see the same shape
        // regardless of whether they were queued.
        this.compositeLocks.set(compositeLockUuid, {
            keys: allKeys,
            holderUuids: new Map(Object.entries(holderUuids)),
            fencingTokens: new Map(Object.entries(fencingTokens))
        });
        this.send(ws, {
            type: 'acquire-many',
            uuid,
            keys: allKeys,
            acquired: true,
            lockUuid: compositeLockUuid,
            fencingTokens
        });
    }

    /// `acquire-many` — atomic acquisition of N keys (union semantics:
    /// the caller wants ALL keys held simultaneously, but unlike a
    /// composite intersection-lock it's modelled as N independent
    /// holds tracked under one client-visible `lockUuid`).
    ///
    /// Implementation acquires keys in **sorted order** to prevent
    /// deadlock between concurrent multi-key requests. If any key
    /// can't be granted immediately, the request is **queued on the
    /// first contended key** (rolling back keys we already grabbed
    /// inside this attempt). When that key eventually frees up,
    /// `ensureNewLockHolder` re-enters `tryGrantAcquireManyFromQueue`
    /// to re-attempt the whole composite; if a *different* key is
    /// now contended, the waiter is re-queued there. The pre-
    /// allocated `compositeLockUuid` is reused across attempts so the
    /// client sees a stable identifier from the initial
    /// `acquired:false` frame to the final `acquired:true`.
    acquireMany(data: any, ws: LMXSocket) {
        const routineId = 'ddl-routine-MWp8lto7T7ST6_IQF-';
        routineEnter(routineId, "Broker1.acquireMany");
        const uuid = data.uuid;
        const rawKeys: unknown = data.keys;
        const ttl = data.ttl === null ? Infinity
            : (Number.isInteger(data.ttl) && data.ttl > 0 ? data.ttl : this.lockExpiresAfter);
        const pid = data.pid;
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);

        // Validate input shape early — every error path returns the
        // canonical `acquire-many` failure response so cross-runtime
        // clients can switch on `type` without case analysis on
        // `error`.
        const fail = (msg: string) => this.send(ws, {
            type: 'acquire-many',
            uuid,
            keys: Array.isArray(rawKeys) ? rawKeys : [],
            acquired: false,
            error: msg
        });

        if (!Array.isArray(rawKeys)) {
            return fail('`keys` must be a non-empty array of strings.');
        }
        if (rawKeys.length === 0) {
            return fail('`keys` must be a non-empty array of strings.');
        }
        if (rawKeys.length > 64) {
            // Hard cap; primary purpose is to bound the rollback path
            // and the per-request fencing-token map size. Operators can
            // bump this later if a real workload demands it.
            return fail(`\`keys\` cannot have more than 64 entries (got ${rawKeys.length}).`);
        }
        for (const k of rawKeys) {
            if (typeof k !== 'string' || k.length === 0) {
                return fail('Every entry in `keys` must be a non-empty string.');
            }
        }
        // De-dup and sort. Acquiring in a stable order across all callers
        // is what prevents pairwise deadlock.
        const keys: string[] = Array.from(new Set(rawKeys as string[])).sort();

        // Optimistic fast path: all keys are currently grantable.
        // Walk them in order, grabbing each. If any one is contended,
        // roll back what we grabbed inside this attempt and queue on
        // the contended key.
        const grantedKeys: string[] = [];
        const fencingTokens: Record<string, number> = {};
        const holderUuids: Record<string, string> = {};
        const compositeLockUuid = uuidV4();

        for (const k of keys) {
            const existing = this.locks.get(k);
            const count = existing ? existing.lockholders.size : 0;
            const max = existing ? existing.max : 1;
            if (count >= max) {
                // Roll back any grants we made earlier in this attempt
                // — they belong to no caller now.
                for (const gk of grantedKeys) {
                    const lckG = this.locks.get(gk);
                    const holderId = holderUuids[gk];
                    if (lckG && holderId) {
                        const holder = lckG.lockholders.get(holderId);
                        if (holder) {
                            this.holderDeadlines.delete(holderId);
                            lckG.lockholders.delete(holderId);
                        }
                    }
                }
                // Queue the waiter on the contended key so a future
                // release on `k` triggers a re-attempt. This is what
                // turns `acquired:false` into a *queued* response: the
                // client library waits for a follow-up `acquired:true`
                // frame, and `ensureNewLockHolder` is responsible for
                // emitting it. Pre-allocate the lock object if missing
                // so we don't drop the waiter on the floor.
                let contendedLock = this.locks.get(k);
                if (!contendedLock) {
                    contendedLock = this.getDefaultLockObject(k, keepLocksAfterDeath, 1);
                    this.locks.set(k, contendedLock);
                }
                const ttlForNotify: number = ttl === Infinity ? Infinity : (ttl || this.lockExpiresAfter);
                const alreadyQueuedResult = contendedLock.notify.get(uuid) as [string, NotifyObj] | [typeof IsVoid] | undefined;
                const alreadyQueued = alreadyQueuedResult && !IsVoid.check(alreadyQueuedResult[0]);
                if (!alreadyQueued) {
                    contendedLock.notify.enqueue(uuid, {
                        ws,
                        uuid,
                        pid,
                        ttl: ttlForNotify,
                        keepLocksAfterDeath,
                        acquireMany: {
                            allKeys: keys,
                            compositeLockUuid
                        }
                    });
                }
                return this.send(ws, {
                    type: 'acquire-many',
                    uuid,
                    keys,
                    acquired: false,
                    contendedKey: k,
                    lockRequestCount: contendedLock.notify.length
                });
            }
            // Grant `k` immediately. Mint a per-key holder uuid so each
            // member has independent unlock semantics, and a per-key
            // fencing token.
            const holderUuid = uuidV4();
            let lck = existing;
            if (!lck) {
                lck = this.getDefaultLockObject(k, keepLocksAfterDeath, 1);
                this.locks.set(k, lck);
            }
            lck.timestampEmptied = null;
            lck.nextFencingToken++;
            const token = lck.nextFencingToken;
            const expiresAt = ttl === Infinity ? Infinity : Date.now() + ttl;
            lck.lockholders.set(holderUuid, {
                pid, ws, uuid: holderUuid, fencingToken: token,
                compositeLockUuid, expiresAt
            });
            if (expiresAt !== Infinity) {
                this.holderDeadlines.set(holderUuid, { key: k, expiresAt, holderUuid });
            }
            if (!this.wsToKeys.has(ws)) this.wsToKeys.set(ws, {});
            this.wsToKeys.get(ws)[k] = true;
            grantedKeys.push(k);
            fencingTokens[k] = token;
            holderUuids[k] = holderUuid;
        }

        this.compositeLocks.set(compositeLockUuid, {
            keys,
            holderUuids: new Map(Object.entries(holderUuids)),
            fencingTokens: new Map(Object.entries(fencingTokens))
        });

        this.send(ws, {
            type: 'acquire-many',
            uuid,
            keys,
            acquired: true,
            lockUuid: compositeLockUuid,
            fencingTokens
        });
    }

    /// `release-many` — release every member of an `acquire-many` grant.
    /// Looks up the composite by `lockUuid`, releases each per-key
    /// holder, and re-grants any waiters that the freed slots admit.
    releaseMany(data: any, ws: LMXSocket) {
        const routineId = 'ddl-routine-19v7y5wptl2E-jPQuE';
        routineEnter(routineId, "Broker1.releaseMany");
        const uuid = data.uuid;
        const lockUuid = data.lockUuid;
        const composite = lockUuid ? this.compositeLocks.get(lockUuid) : null;

        if (!composite) {
            return this.send(ws, {
                type: 'release-many',
                uuid,
                released: false,
                error: lockUuid
                    ? `Unknown composite lockUuid="${lockUuid}" (already released or never granted).`
                    : '`lockUuid` is required for `release-many`.'
            });
        }

        for (const k of composite.keys) {
            const holderId = composite.holderUuids.get(k);
            if (!holderId) continue;
            const lck = this.locks.get(k);
            if (!lck) continue;
            this.holderDeadlines.delete(holderId);
            const removed = lck.lockholders.delete(holderId);
            if (removed) lck.lockholdersAllReleased[holderId] = true;
            // Wake the next waiter on this key. The signature mirrors
            // what `unlock()` passes — `_uuid` is the freed holder's
            // identifier so `ensureNewLockHolder` has the context it
            // expects.
            this.ensureNewLockHolder(lck, { key: k, _uuid: holderId });
        }

        this.compositeLocks.delete(lockUuid);
        this.send(ws, {
            type: 'release-many',
            uuid,
            lockUuid,
            keys: composite.keys,
            released: true
        });
    }

    lock(data: any, ws: LMXSocket) {
        const routineId = 'ddl-routine-uqAdO-ZiaFbzajJj5r';
        routineEnter(routineId, "Broker1.lock");

        if (!this.validateMaxField(data, ws)) {
            return;
        }

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
        const max = data.max;  // max lockholders (legacy)
        const maxRead = data.maxRead;  // max concurrent readers
        const maxWrite = data.maxWrite;  // max concurrent writers
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

            // Update max fields BEFORE checking count
            // For RW locks: use maxRead/maxWrite if provided
            // For regular locks: use max
            // Note: beginRead is undefined for regular locks, defined for RW locks
            const isRWLockOperation = beginRead !== undefined; // RW locks have beginRead/endRead status
            
            if (isRWLockOperation && beginRead) {
                // RW read lock: use maxRead if provided, otherwise keep existing or default to 10
                if (Number.isInteger(maxRead)) {
                    lck.maxRead = maxRead;
                } else if (lck.maxRead === undefined) {
                    lck.maxRead = 10; // Default for read locks
                }
                // Update legacy max for backward compatibility (only if not already set by regular lock)
                if (Number.isInteger(max)) {
                    lck.max = max;
                }
            } else if (isRWLockOperation && !beginRead) {
                // RW write lock: use maxWrite if provided, otherwise keep existing or default to 1
                if (Number.isInteger(maxWrite)) {
                    lck.maxWrite = maxWrite;
                } else if (lck.maxWrite === undefined) {
                    lck.maxWrite = 1; // Default for write locks
                }
                // Update legacy max for backward compatibility
                if (Number.isInteger(max)) {
                    lck.max = max;
                }
            } else {
                // Regular lock (not RW): use max only
                if (Number.isInteger(max)) {
                    lck.max = max;
                }
            }

            const ln = lck.notify.length;
            const count = lck.lockholders.size;

            // For RW read locks, check readers count (accounting for the increment that will happen)
            // because readers are tracked separately and we need to check before incrementing
            // For non-read operations, use lockholders.size
            // IMPORTANT: For read locks, we check readers count, not lockholders.size,
            // because read locks share the same lockholders map but have separate reader tracking
            const effectiveCount = beginRead ? (lck.readers + 1) : count;
            
            // Use the appropriate max based on lock type
            // RW read locks: use maxRead, fall back to max
            // RW write locks: use maxWrite, fall back to max
            // Regular locks: use max only
            const effectiveMax = isRWLockOperation && beginRead
                ? (lck.maxRead !== undefined ? lck.maxRead : lck.max)
                : isRWLockOperation && !beginRead
                ? (lck.maxWrite !== undefined ? lck.maxWrite : lck.max)
                : lck.max; // Regular lock

            // Strictly enforce max lock holders - prevent race conditions
            // For read operations, check if adding this reader would exceed max
            // For non-read operations, check current lockholders count
            if (effectiveCount >= effectiveMax) {

                // Only warn if we actually exceed the limit due to a race condition
                // Don't warn for write locks queuing behind readers (expected behavior)
                // Don't warn for read locks at the limit (expected when max is reached)
                // With separate maxRead/maxWrite fields, we no longer need the upgrade workaround
                const isWriteLockQueuing = !beginRead && lck.readers > 0 && effectiveMax === 1;
                
                // Only warn if:
                // 1. Count exceeds effectiveMax, AND
                // 2. Not a write lock queuing behind readers (expected behavior)
                if (effectiveCount > effectiveMax && !isWriteLockQueuing) {
                    log.warn(`Semaphore limit exceeded: ${effectiveCount} ${beginRead ? 'readers (after increment)' : 'lock holders'} exceeds max of ${effectiveMax} for key "${key}"`);
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

                    const alreadyAddedResult = lck.notify.get(uuid) as [string, NotifyObj] | [typeof IsVoid] | undefined;
                    const alreadyAdded = alreadyAddedResult && !IsVoid.check(alreadyAddedResult[0]);

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

            const fencingToken = this.grantLock(lck, ws, uuid, pid, ttl, key);

            this.send(ws, {
                readersCount: lck.readers,
                uuid: uuid,
                key: key,
                lockRequestCount: ln,
                type: 'lock',
                acquired: true,
                fencingToken
            });

            return;
        }


        // this path: there is no existing lck, so we create a new lck object

        log.debug(data.rwStatus, 'has acquired lock on key:', key);

        if (!this.wsToKeys.has(ws)) {
            this.wsToKeys.set(ws, {});
        }

        this.wsToKeys.get(ws)[key] = true;

        // Determine maxRead and maxWrite based on operation type
        const maxReadForNewLock = beginRead ? (Number.isInteger(maxRead) ? maxRead : (Number.isInteger(max) ? max : 10)) : undefined;
        const maxWriteForNewLock = !beginRead ? (Number.isInteger(maxWrite) ? maxWrite : (Number.isInteger(max) ? max : 1)) : undefined;
        const lckTemp = this.getDefaultLockObject(key, keepLocksAfterDeath, max, maxReadForNewLock, maxWriteForNewLock);
        this.locks.set(key, lckTemp);

        if (beginRead) {
            // lck.readers = Math.max(20, lck.readers++);
            lckTemp.readers++
        }

        if (endRead) {
            // in case something weird happens, never let it go below 0.
            lckTemp.readers = Math.max(0, --lckTemp.readers);
        }

        const fencingToken = this.grantLock(lckTemp, ws, uuid, pid, ttl, key);

        this.send(ws, {
            readersCount: lckTemp.readers,
            uuid: uuid,
            lockRequestCount: 0,
            key: key,
            type: 'lock',
            acquired: true,
            fencingToken
        });

    }

    unlock(data: any, ws?: net.Socket) {
        const routineId = 'ddl-routine-8SVOFkIeN1L4uIj8VK';
        routineEnter(routineId, "Broker1.unlock");

        const key = data.key;
        const uuid = data.uuid;
        const _uuid = data._uuid;
        const force = data.force;
        const lck = this.locks.get(key);
        const keepLocksAfterDeath = Boolean(data.keepLocksAfterDeath);
        
        log.debug('unlock: received unlock request for key:', key, 'uuid:', uuid, '_uuid:', _uuid, 'force:', force, 'has lock:', !!lck);

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

            // Drop the deadline row first — the centralised sweeper
            // (`tickTtl`) is the only thing that fires evictions now,
            // so removing the entry here keeps the sweep cheap and
            // avoids a phantom eviction message racing this unlock.
            if (_uuid) this.holderDeadlines.delete(_uuid);

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
                        this.holderDeadlines.delete(k);
                    }
                    lck.lockholders = new Map();
                }
            }

            if (uuid && ws) {

                // if no uuid is defined, then unlock was called by something other than the client
                // aka this library called unlock when there was a timeout

                log.debug('unlock: sending unlock success response for key:', key, 'uuid:', uuid, '_uuid:', _uuid);
                this.send(ws, {
                    uuid: uuid,
                    key: key,
                    lockRequestCount: ln,
                    type: 'unlock',
                    unlocked: true
                });
                log.debug('unlock: unlock success response sent for key:', key, 'uuid:', uuid);
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
