'use strict';

/**
 * LMX wire-protocol enum + discriminated union types.
 *
 * Why this file exists
 * --------------------
 *
 * The TCP / in-process bridge protocol is a stream of newline-
 * terminated JSON objects, each carrying a `type` field that
 * tells the broker (or client) which handler should run. Until
 * now both sides matched on bare string literals — `data.type ===
 * 'lock'`, `data.type === 'unlock'`, … — sprinkled across
 * `broker-1.ts`, `client.ts`, `in-process-bridge.ts`, etc.
 *
 * That's the property the cross-runtime ports of this protocol
 * (Rust, Go, Dart, Gleam) explicitly _don't_ have: in those
 * languages adding a new request variant is a compile error in
 * every consumer until the consumer adds the matching match arm /
 * case / handler. The Node implementation typed `data` as `any`,
 * so a typo silently routed to the "unknown request" warning at
 * the bottom of the dispatcher.
 *
 * What this module gives us
 * -------------------------
 *
 *   * `LMXRequestType` — string enum whose members map 1:1 to the
 *     wire-format `type` strings the dispatcher already accepts.
 *     The string values match the existing wire format byte-for-
 *     byte; this is purely a typing addition and existing clients
 *     keep working.
 *   * `LMXResponseType` — the broker-emitted reply variants. Some
 *     overlap with `LMXRequestType` (a `lock` request gets a
 *     `type:'lock'` reply); they're aliased explicitly below.
 *   * `LMXKnownRequestTypes` — a runtime `ReadonlySet<string>` for
 *     fast membership check at the parser entry point.
 *   * `LMXRequest` — discriminated union over every request
 *     variant. The dispatcher narrows on `data.type` and the TS
 *     compiler refuses to compile a `switch` that doesn't handle
 *     every member when paired with `assertExhaustive`.
 *   * `assertExhaustive(x: never)` — the standard "compile-time
 *     panic" helper. If you add a new variant to `LMXRequest`
 *     without handling it in the broker dispatcher, the `default:`
 *     arm widens `x` to a non-`never` type and fails type-check.
 *     This is the property the Rust port has via
 *     `match req { … }` exhaustiveness; this is the Node analogue.
 *
 * Wire-format invariant
 * ---------------------
 *
 * The string values below MUST match the legacy literals in
 * `broker.ts` / `broker-old.ts` / `client.ts` byte-for-byte. Mixed
 * `Broker1` / older-broker deployments need to interop, and any
 * external consumer that raw-JSON-encodes its requests (e.g. a
 * shell script piping into `nc`, a non-LMX language client) has
 * been writing those exact strings for years.
 */

/// Every `data.type` value the broker dispatch path knows. Values
/// match the wire-format strings byte-for-byte. ORDER MATTERS for
/// readability only — the runtime is a `Set`-backed membership
/// check, so reordering is safe.
export enum LMXRequestType {
    /// Acquire (or queue for) a lock on a single key. Payload:
    /// `{ uuid, key, ttl, max?, force?, pid, keepLocksAfterDeath?,
    ///    retryCount? }`.
    Lock = 'lock',

    /// Release a previously-granted hold. Payload:
    /// `{ uuid, key, _uuid?, force?, keepLocksAfterDeath? }`.
    Unlock = 'unlock',

    /// All-or-nothing acquire across N keys ("composite lock").
    /// Payload: `{ uuid, keys, ttl, pid, keepLocksAfterDeath? }`.
    AcquireMany = 'acquire-many',

    /// Release every member of a composite lock by composite uuid.
    /// Payload: `{ uuid, lockUuid }`.
    ReleaseMany = 'release-many',

    /// List currently-tracked lock keys. Operator / debug use.
    Ls = 'ls',

    /// Client → broker version handshake. Payload: `{ value: string }`.
    Version = 'version',

    /// Client confirms a broker-emitted `version-mismatch` notice;
    /// the broker uses this to know it's safe to drop the socket.
    VersionMismatchConfirmed = 'version-mismatch-confirmed',

    /// Test-only: ask the broker to pretend the next handshake was
    /// a version mismatch.
    SimulateVersionMismatch = 'simulate-version-mismatch',

    /// Test-only: ask the broker to call `socket.end()` on us.
    EndConnectionFromBrokerForTesting = 'end-connection-from-broker-for-testing-purposes',

    /// Test-only: ask the broker to call `socket.destroy()` on us.
    DestroyConnectionFromBrokerForTesting = 'destroy-connection-from-broker-for-testing-purposes',

    /// Reader/writer-lock support — bumps `lck.readers`.
    IncrementReaders = 'increment-readers',

    /// Reader/writer-lock support — decrements `lck.readers`,
    /// floored at 0.
    DecrementReaders = 'decrement-readers',

    /// RW-lock writer-preference probe: "is the writer flag clear,
    /// or do I need to wait?".
    RegisterWriteFlagCheck = 'register-write-flag-check',

    /// RW-lock writer-preference probe variant emitted when the
    /// previous probe was queued. Broker-1 only — `broker.ts`
    /// (legacy) does not handle this case.
    RegisterWriteFlagCheckQueued = 'register-write-flag-check-queued',

    /// RW-lock writer-handoff: "writer flag clear AND readers ==
    /// 0?".
    RegisterWriteFlagAndReadersCheck = 'register-write-flag-and-readers-check',

    /// RW-lock writer-side broadcast: clear the writer flag, wake
    /// any reader waiting on it.
    SetWriteFlagFalseAndBroadcast = 'set-write-flag-false-and-broadcast',

    /// Client acknowledges receipt of a granted lock. Lets the
    /// broker stop the re-election timer it armed at grant time.
    LockReceived = 'lock-received',

    /// Client signals it gave up on its lock attempt because of a
    /// local timeout. Removes its entry from the broker's notify
    /// queue.
    LockClientTimeout = 'lock-client-timeout',

    /// Client signals it gave up on its lock attempt because of a
    /// local error (e.g. socket close mid-attempt). Removes its
    /// entry from the broker's notify queue.
    LockClientError = 'lock-client-error',

    /// Client rejects a granted lock (e.g. its local timer already
    /// fired by the time the grant arrived). Re-grants to the
    /// next waiter.
    LockReceivedRejected = 'lock-received-rejected',

    /// Operator / introspection: "tell me the holder uuids and
    /// queue depth for this key".
    LockInfoRequest = 'lock-info-request',

    /// Liveness probe. Replied with `{type: 'pong'}`.
    Ping = 'ping',

    /// Operator / debugging: dump broker-side runtime stats.
    SystemStatsRequest = 'system-stats-request',
}

/// Broker → client reply variants. Values overlap with the request
/// enum where the request and reply share the same `type` field
/// (the legacy convention). New consumers should prefer matching
/// on these for clarity.
export enum LMXResponseType {
    Lock = 'lock',
    Unlock = 'unlock',
    LockInfoResponse = 'lock-info-response',
    Pong = 'pong',
    SystemStatsResponse = 'system-stats-response',
    VersionMismatch = 'version-mismatch',
    BrokerVersion = 'broker-version',
}

/// Runtime membership check used at the parser entry point. Built
/// from the enum so adding a new `LMXRequestType` automatically
/// extends this set.
export const LMXKnownRequestTypes: ReadonlySet<string> =
    new Set<string>(Object.values(LMXRequestType));

/// True iff `t` is a recognized request `type` literal.
export function isLMXRequestType(t: unknown): t is LMXRequestType {
    return typeof t === 'string' && LMXKnownRequestTypes.has(t);
}

// =====================================================================
// Per-variant request payload shapes. These are the minimal shape the
// dispatcher needs to know about; individual handlers may consume
// additional optional fields (e.g. `data.rwStatus`, `data.lockExpiresAfter`)
// — the broker keeps `data: any` semantics inside the handler bodies.
// The discriminated union below is the COMPILE-TIME contract for the
// dispatcher itself.
// =====================================================================

export interface LockReq {
    type: LMXRequestType.Lock;
    uuid: string;
    key: string;
    ttl: number | null;
    max?: number;
    force?: boolean;
    pid?: number;
    keepLocksAfterDeath?: boolean;
    retryCount?: number;
    rwStatus?: string;
    [extra: string]: any;
}

export interface UnlockReq {
    type: LMXRequestType.Unlock;
    uuid: string;
    key: string;
    _uuid?: string;
    force?: boolean;
    keepLocksAfterDeath?: boolean;
    [extra: string]: any;
}

export interface AcquireManyReq {
    type: LMXRequestType.AcquireMany;
    uuid: string;
    keys: string[];
    ttl: number | null;
    pid?: number;
    keepLocksAfterDeath?: boolean;
    [extra: string]: any;
}

export interface ReleaseManyReq {
    type: LMXRequestType.ReleaseMany;
    uuid: string;
    lockUuid: string;
    [extra: string]: any;
}

export interface LsReq {
    type: LMXRequestType.Ls;
    uuid: string;
    [extra: string]: any;
}

export interface VersionReq {
    type: LMXRequestType.Version;
    value: string;
    [extra: string]: any;
}

export interface VersionMismatchConfirmedReq {
    type: LMXRequestType.VersionMismatchConfirmed;
    [extra: string]: any;
}

export interface SimulateVersionMismatchReq {
    type: LMXRequestType.SimulateVersionMismatch;
    [extra: string]: any;
}

export interface EndConnectionFromBrokerForTestingReq {
    type: LMXRequestType.EndConnectionFromBrokerForTesting;
    [extra: string]: any;
}

export interface DestroyConnectionFromBrokerForTestingReq {
    type: LMXRequestType.DestroyConnectionFromBrokerForTesting;
    [extra: string]: any;
}

export interface IncrementReadersReq {
    type: LMXRequestType.IncrementReaders;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface DecrementReadersReq {
    type: LMXRequestType.DecrementReaders;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface RegisterWriteFlagCheckReq {
    type: LMXRequestType.RegisterWriteFlagCheck;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface RegisterWriteFlagCheckQueuedReq {
    type: LMXRequestType.RegisterWriteFlagCheckQueued;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface RegisterWriteFlagAndReadersCheckReq {
    type: LMXRequestType.RegisterWriteFlagAndReadersCheck;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface SetWriteFlagFalseAndBroadcastReq {
    type: LMXRequestType.SetWriteFlagFalseAndBroadcast;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface LockReceivedReq {
    type: LMXRequestType.LockReceived;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface LockClientTimeoutReq {
    type: LMXRequestType.LockClientTimeout;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface LockClientErrorReq {
    type: LMXRequestType.LockClientError;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface LockReceivedRejectedReq {
    type: LMXRequestType.LockReceivedRejected;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface LockInfoRequestReq {
    type: LMXRequestType.LockInfoRequest;
    uuid: string;
    key: string;
    [extra: string]: any;
}

export interface PingReq {
    type: LMXRequestType.Ping;
    uuid: string;
    [extra: string]: any;
}

export interface SystemStatsRequestReq {
    type: LMXRequestType.SystemStatsRequest;
    uuid: string;
    [extra: string]: any;
}

/// Discriminated union over every request variant. Use this as the
/// parameter type for any code that needs compile-time exhaustiveness
/// over the request space — e.g. the broker dispatcher.
export type LMXRequest =
    | LockReq
    | UnlockReq
    | AcquireManyReq
    | ReleaseManyReq
    | LsReq
    | VersionReq
    | VersionMismatchConfirmedReq
    | SimulateVersionMismatchReq
    | EndConnectionFromBrokerForTestingReq
    | DestroyConnectionFromBrokerForTestingReq
    | IncrementReadersReq
    | DecrementReadersReq
    | RegisterWriteFlagCheckReq
    | RegisterWriteFlagCheckQueuedReq
    | RegisterWriteFlagAndReadersCheckReq
    | SetWriteFlagFalseAndBroadcastReq
    | LockReceivedReq
    | LockClientTimeoutReq
    | LockClientErrorReq
    | LockReceivedRejectedReq
    | LockInfoRequestReq
    | PingReq
    | SystemStatsRequestReq;

/**
 * Compile-time exhaustiveness check. Place at the `default:` arm of
 * a `switch (req.type)` to force the TS compiler to fail any time a
 * new `LMXRequestType` member is added without a matching case.
 *
 * The runtime path (someone hand-crafts a JSON frame with an unknown
 * `type` and pushes it through TCP) is not a compile-time situation,
 * so this also returns the original value as a `never`-cast and the
 * caller can decide how to surface the unrecognized request — see
 * `Broker1.dispatch` for the production behavior (warn + reply with
 * a structured error).
 */
export function assertExhaustive(value: never): never {
    throw new Error(
        `LMX protocol: non-exhaustive switch reached for value=${
            JSON.stringify(value)
        }. Every member of LMXRequestType must have a case arm.`,
    );
}
