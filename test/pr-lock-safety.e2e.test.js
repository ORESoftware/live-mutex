'use strict';

const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');
const {v4: uuidV4} = require('uuid');

const {Broker1, setLogLevel} = require('../dist/main');

setLogLevel('error');

class FakeSocket extends EventEmitter {
  constructor(label) {
    super();
    this.label = label;
    this.writable = true;
    this.readable = true;
    this.destroyed = false;
    this.lmxClosed = false;
    this.framesIn = [];
    this.bytesWritten = 0;
    this.bytesRead = 0;
    this.allowHalfOpen = false;
    this.localAddress = 'fake';
    this.localPort = 0;
    this.remoteAddress = 'fake';
    this.remoteFamily = 'IPv4';
    this.remotePort = 0;
    this.timeout = 0;
    this.setMaxListeners(64);
  }

  write(data, _encoding, callback) {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    this.bytesWritten += Buffer.byteLength(text);
    for (const line of text.split('\n')) {
      if (!line) {
        continue;
      }
      this.framesIn.push(JSON.parse(line));
    }
    if (typeof callback === 'function') {
      process.nextTick(callback, null);
    }
    return true;
  }

  end() {
    this.writable = false;
    this.readable = false;
    this.destroyed = true;
    this.lmxClosed = true;
    return this;
  }

  destroy() {
    return this.end();
  }

  address() {
    return {address: this.localAddress, family: this.remoteFamily, port: this.localPort};
  }

  pipe(target) {
    return target;
  }

  unpipe() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
    return this;
  }

  setEncoding() {
    return this;
  }

  unref() {
    return this;
  }

  ref() {
    return this;
  }

  pause() {
    return this;
  }

  resume() {
    return this;
  }

  cork() {}

  uncork() {}

  get readyState() {
    return this.destroyed ? 'closed' : 'open';
  }
}

function newBroker() {
  const broker = new Broker1({noListen: true, port: 0, host: '127.0.0.1'});
  broker.emitter?.on('warning', () => {});
  broker.emitter?.on('error', () => {});
  return broker;
}

function register(broker, socket) {
  broker.connectedClients.add(socket);
  broker.wsToKeys.set(socket, {});
  broker.wsToUUIDs.set(socket, {});
}

function lockSync(broker, socket, payload) {
  const before = socket.framesIn.length;
  broker.lock(payload, socket);
  return socket.framesIn.slice(before).at(-1) || null;
}

function unlockSync(broker, socket, payload) {
  const before = socket.framesIn.length;
  broker.unlock(payload, socket);
  return socket.framesIn.slice(before).at(-1) || null;
}

async function closeBroker(broker) {
  await new Promise(resolve => broker.close(resolve));
}

test('wrong-uuid force unlock cannot evict or report success against a legitimate holder', {timeout: 5000}, async () => {
  const broker = newBroker();
  try {
    const key = 'pr-exclusive-safety';
    const holder = new FakeSocket('holder');
    const attacker = new FakeSocket('attacker');
    register(broker, holder);
    register(broker, attacker);

    const holderUuid = uuidV4();
    const grant = lockSync(broker, holder, {
      type: 'lock',
      uuid: holderUuid,
      key,
      ttl: 30_000,
      max: 1,
      force: false,
      pid: 1,
      retryCount: 0,
    });
    assert.equal(grant?.acquired, true);

    const reply = unlockSync(broker, attacker, {
      type: 'unlock',
      uuid: uuidV4(),
      key,
      _uuid: 'wrong-holder-uuid',
      force: true,
    });

    const lock = broker.locks.get(key);
    assert.equal(lock.lockholders.size, 1);
    assert.equal(lock.lockholders.has(holderUuid), true);
    assert.notEqual(reply?.unlocked, true);
  }
  finally {
    await closeBroker(broker);
  }
});

test('disconnect cleanup removes only the closing semaphore holder', {timeout: 5000}, async () => {
  const broker = newBroker();
  try {
    const key = 'pr-semaphore-cleanup';
    const first = new FakeSocket('first');
    const second = new FakeSocket('second');
    register(broker, first);
    register(broker, second);

    const firstUuid = uuidV4();
    const secondUuid = uuidV4();
    assert.equal(lockSync(broker, first, {
      type: 'lock', uuid: firstUuid, key, ttl: 30_000, max: 2,
      force: false, pid: 1, retryCount: 0,
    })?.acquired, true);
    assert.equal(lockSync(broker, second, {
      type: 'lock', uuid: secondUuid, key, ttl: 30_000, max: 2,
      force: false, pid: 2, retryCount: 0,
    })?.acquired, true);
    assert.equal(broker.locks.get(key).lockholders.size, 2);

    broker.cleanupConnection(first);

    const lock = broker.locks.get(key);
    assert.equal(lock.lockholders.size, 1);
    assert.equal(lock.lockholders.has(firstUuid), false);
    assert.equal(lock.lockholders.has(secondUuid), true);
  }
  finally {
    await closeBroker(broker);
  }
});

test('disconnect cleanup scrubs a queued waiter before the next grant cycle', {timeout: 5000}, async () => {
  const broker = newBroker();
  try {
    const key = 'pr-waiter-cleanup';
    const holder = new FakeSocket('holder');
    const waiter = new FakeSocket('waiter');
    register(broker, holder);
    register(broker, waiter);

    const holderUuid = uuidV4();
    const waiterUuid = uuidV4();
    assert.equal(lockSync(broker, holder, {
      type: 'lock', uuid: holderUuid, key, ttl: 30_000, max: 1,
      force: false, pid: 1, retryCount: 0,
    })?.acquired, true);

    const queued = lockSync(broker, waiter, {
      type: 'lock', uuid: waiterUuid, key, ttl: 30_000, max: 1,
      force: false, pid: 2, retryCount: 0,
    });
    assert.equal(queued?.acquired, false);
    broker.wsToUUIDs.get(waiter)[waiterUuid] = true;
    assert.equal(broker.locks.get(key).notify.length, 1);

    broker.cleanupConnection(waiter);

    assert.equal(broker.locks.get(key).notify.length, 0);
    assert.equal(broker.connectedClients.has(waiter), false);
  }
  finally {
    await closeBroker(broker);
  }
});
