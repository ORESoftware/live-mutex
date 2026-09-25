'use strict';

/**
 * End-to-end fencing-boundary test for Broker1.
 *
 * A lock grant is not sufficient protection once work crosses into an external
 * datastore/API. This test obtains real Broker1 fencing tokens, advances a
 * durable-style downstream watermark with the newer owner, and proves a
 * delayed write from the old owner is rejected.
 */

import * as assert from 'assert';
import {Broker1, setLogLevel} from '../dist/main';
import {v4 as uuidV4} from 'uuid';

setLogLevel('error');

interface FakeSocket {
    writable: boolean;
    sent: any[];
    cursor: number;
    write(chunk: any): boolean;
    end(): void;
    destroy(): void;
    on(): void;
}

function makeSocket(): FakeSocket {
    const sent: any[] = [];
    return {
        writable: true,
        sent,
        cursor: 0,
        write(chunk: any): boolean {
            const lines = chunk.toString().trim().split('\n').filter(Boolean);
            for (const line of lines) sent.push(JSON.parse(line));
            return true;
        },
        end() { /* noop */ },
        destroy() { /* noop */ },
        on() { /* noop */ },
    };
}

function newFrames(ws: FakeSocket): any[] {
    const frames = ws.sent.slice(ws.cursor);
    ws.cursor = ws.sent.length;
    return frames;
}

interface ExternalWrite {
    fencingToken: number;
    operationId: string;
    payloadSha256: string;
}

interface ExternalWatermark {
    fencingToken: number;
    operationId: string;
    payloadSha256: string;
}

type ExternalDecision = 'advanced' | 'replay' | 'stale' | 'token_reuse';

function applyExternalWrite(watermark: ExternalWatermark, write: ExternalWrite): ExternalDecision {
    assert.ok(Number.isSafeInteger(write.fencingToken) && write.fencingToken > 0, 'fencing token must be a positive safe integer');

    if (write.fencingToken < watermark.fencingToken) return 'stale';
    if (write.fencingToken === watermark.fencingToken) {
        return write.operationId === watermark.operationId && write.payloadSha256 === watermark.payloadSha256
            ? 'replay'
            : 'token_reuse';
    }

    watermark.fencingToken = write.fencingToken;
    watermark.operationId = write.operationId;
    watermark.payloadSha256 = write.payloadSha256;
    return 'advanced';
}

async function main() {
    const broker = new Broker1({port: 0, host: '127.0.0.1', noListen: true} as any);
    (broker as any).emitter.on('warning', () => { /* swallow noisy test warnings */ });
    await broker.ensure();

    const socket = makeSocket();
    const key = 'external-fence/orders/42';

    const requestA = uuidV4();
    broker.lock({uuid: requestA, key, ttl: 120_000, wait: false} as any, socket as any);
    const grantA = newFrames(socket).find(m => m.type === 'lock' && m.acquired);
    assert.ok(grantA, 'owner A must acquire');
    assert.ok(Number.isSafeInteger(grantA.fencingToken) && grantA.fencingToken > 0, 'owner A must receive a fencing token');

    broker.unlock({uuid: uuidV4(), key, _uuid: requestA} as any, socket as any);
    newFrames(socket);

    const requestB = uuidV4();
    broker.lock({uuid: requestB, key, ttl: 120_000, wait: false} as any, socket as any);
    const grantB = newFrames(socket).find(m => m.type === 'lock' && m.acquired);
    assert.ok(grantB, 'owner B must acquire');
    assert.ok(grantB.fencingToken > grantA.fencingToken, 'successor grant must have a strictly greater fencing token');

    const watermark: ExternalWatermark = {
        fencingToken: 0,
        operationId: '',
        payloadSha256: '',
    };

    const writeB: ExternalWrite = {
        fencingToken: grantB.fencingToken,
        operationId: 'charge-order-42-v2',
        payloadSha256: 'b'.repeat(64),
    };
    assert.strictEqual(applyExternalWrite(watermark, writeB), 'advanced');
    assert.strictEqual(applyExternalWrite(watermark, writeB), 'replay', 'same token + same operation is an idempotent retry');

    const delayedA: ExternalWrite = {
        fencingToken: grantA.fencingToken,
        operationId: 'charge-order-42-v1-zombie',
        payloadSha256: 'a'.repeat(64),
    };
    assert.strictEqual(applyExternalWrite(watermark, delayedA), 'stale', 'old owner must be fenced out after successor commits');

    assert.strictEqual(
        applyExternalWrite(watermark, {...writeB, operationId: 'different-work'}),
        'token_reuse',
        'equal token cannot authorize a different external mutation',
    );

    broker.unlock({uuid: uuidV4(), key, _uuid: requestB} as any, socket as any);
    console.log('✅ live-mutex external fencing contract passed');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ live-mutex external fencing contract failed:', (err && err.stack) || err);
    process.exit(1);
});
