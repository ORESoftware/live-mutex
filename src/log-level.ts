'use strict';

/**
 * Runtime-mutable log level for the broker.
 *
 * The broker has no real logger abstraction yet; this module is the
 * minimum viable shim so the HTTP admin endpoint `/admin/log-level`
 * can dampen the noisy `routineEnter` stdout stream at runtime without
 * a restart.
 *
 * Hierarchy (low -> high verbosity):
 *
 *     silent < error < warn < info < debug < trace
 *
 * A line emitted at level `info` is shown if and only if
 * `getLogLevel() >= info` — i.e. when the configured level is `info`,
 * `debug`, or `trace`.
 *
 * Default value comes from `process.env.LMX_LOG_LEVEL` if it parses
 * to a valid level, otherwise `'info'`.
 */

export type LMXLogLevel =
    | 'silent'
    | 'error'
    | 'warn'
    | 'info'
    | 'debug'
    | 'trace';

const LEVELS: ReadonlyArray<LMXLogLevel> = [
    'silent',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
];

const LEVEL_RANK: Readonly<Record<LMXLogLevel, number>> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
};

function parseLevel(raw: string | undefined): LMXLogLevel | null {
    if (!raw) return null;
    const norm = raw.trim().toLowerCase();
    if ((LEVELS as ReadonlyArray<string>).includes(norm)) {
        return norm as LMXLogLevel;
    }
    return null;
}

let currentLevel: LMXLogLevel = parseLevel(process.env.LMX_LOG_LEVEL) || 'info';

/** Read-only accessor for the current runtime log level. */
export function getLogLevel(): LMXLogLevel {
    return currentLevel;
}

/**
 * Update the runtime log level. Returns the previous value so the
 * caller (e.g. the HTTP admin endpoint) can include it in an audit
 * log.
 *
 * Throws `Error` on invalid input; the HTTP handler converts the
 * throw into a 400 response.
 */
export function setLogLevel(level: LMXLogLevel): LMXLogLevel {
    const parsed = parseLevel(level as string);
    if (!parsed) {
        throw new Error(
            `invalid log level "${level}"; expected one of: ${LEVELS.join(', ')}.`,
        );
    }
    const previous = currentLevel;
    currentLevel = parsed;
    return previous;
}

/**
 * Returns true if a message at `messageLevel` should be emitted given
 * the current runtime level. Internal helper consumed by callers that
 * want to gate `console.*` or `process.stdout.write` invocations.
 *
 * `silent` always returns false; messages emitted at `silent` would
 * be invisible anyway, so we treat the call as a no-op gate.
 */
export function isLogLevelEnabled(messageLevel: LMXLogLevel): boolean {
    if (messageLevel === 'silent') return false;
    return LEVEL_RANK[currentLevel] >= LEVEL_RANK[messageLevel];
}

/** List of all valid log levels (for validation / documentation). */
export const LMX_LOG_LEVELS: ReadonlyArray<LMXLogLevel> = LEVELS;
