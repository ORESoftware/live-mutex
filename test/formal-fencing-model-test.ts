import assert = require('assert');

type Client = 0 | 1;
type Work = 0 | 1;
type Decision = 'advanced' | 'replay' | 'stale' | 'token_reuse' | 'no_token';

type State = {
  holder: Client | null;
  highestGrant: number;
  lastToken: [number | null, number | null];
  downstreamWatermark: number;
  downstreamIdentity: string | null;
};

const MAX_GRANTS = 4;
const CLIENTS: Client[] = [0, 1];
const WORK: Work[] = [0, 1];

const initial = (): State => ({
  holder: null,
  highestGrant: 0,
  lastToken: [null, null],
  downstreamWatermark: 0,
  downstreamIdentity: null,
});

const clone = (s: State): State => ({
  holder: s.holder,
  highestGrant: s.highestGrant,
  lastToken: [s.lastToken[0], s.lastToken[1]],
  downstreamWatermark: s.downstreamWatermark,
  downstreamIdentity: s.downstreamIdentity,
});

const identity = (client: Client, work: Work): string => `${client}:${work}`;

const stateKey = (s: State): string => JSON.stringify([
  s.holder,
  s.highestGrant,
  s.lastToken,
  s.downstreamWatermark,
  s.downstreamIdentity,
]);

const verifyState = (s: State): void => {
  assert.ok(
    s.downstreamWatermark <= s.highestGrant,
    `downstream authority was never granted: ${JSON.stringify(s)}`,
  );
  if (s.highestGrant === 0) {
    assert.deepStrictEqual(s.lastToken, [null, null]);
    assert.strictEqual(s.downstreamWatermark, 0);
    assert.strictEqual(s.downstreamIdentity, null);
  }
  if (s.holder !== null) {
    assert.strictEqual(
      s.lastToken[s.holder],
      s.highestGrant,
      `current exclusive owner must hold newest grant: ${JSON.stringify(s)}`,
    );
  }
  if (s.downstreamWatermark === 0) {
    assert.strictEqual(s.downstreamIdentity, null);
  } else {
    assert.notStrictEqual(s.downstreamIdentity, null);
  }
};

const acquire = (s: State, client: Client): State | null => {
  if (s.holder !== null || s.highestGrant >= MAX_GRANTS) {
    return null;
  }
  const next = clone(s);
  const token = s.highestGrant + 1;
  assert.ok(token > s.highestGrant, 'successor token must strictly increase');
  next.highestGrant = token;
  next.holder = client;
  next.lastToken[client] = token;
  return next;
};

const release = (s: State, client: Client): State | null => {
  if (s.holder !== client) {
    return null;
  }
  const next = clone(s);
  next.holder = null;
  return next;
};

const write = (s: State, client: Client, work: Work): [State, Decision] => {
  const token = s.lastToken[client];
  if (token === null) {
    return [s, 'no_token'];
  }
  if (token < s.downstreamWatermark) {
    return [s, 'stale'];
  }
  if (token === s.downstreamWatermark) {
    return s.downstreamIdentity === identity(client, work)
      ? [s, 'replay']
      : [s, 'token_reuse'];
  }
  const next = clone(s);
  next.downstreamWatermark = token;
  next.downstreamIdentity = identity(client, work);
  return [next, 'advanced'];
};

const verifyWrite = (
  before: State,
  after: State,
  client: Client,
  work: Work,
  decision: Decision,
): void => {
  const token = before.lastToken[client];
  switch (decision) {
    case 'no_token':
      assert.strictEqual(token, null);
      break;
    case 'advanced':
      assert.notStrictEqual(token, null);
      assert.ok((token as number) > before.downstreamWatermark);
      assert.strictEqual(after.downstreamWatermark, token);
      assert.strictEqual(after.downstreamIdentity, identity(client, work));
      break;
    case 'replay':
      assert.strictEqual(token, before.downstreamWatermark);
      assert.strictEqual(before.downstreamIdentity, identity(client, work));
      assert.deepStrictEqual(after, before, 'exact replay must not mutate state');
      break;
    case 'stale':
      assert.notStrictEqual(token, null);
      assert.ok((token as number) < before.downstreamWatermark);
      assert.deepStrictEqual(after, before, 'stale writer must not mutate state');
      break;
    case 'token_reuse':
      assert.strictEqual(token, before.downstreamWatermark);
      assert.notStrictEqual(before.downstreamIdentity, identity(client, work));
      assert.deepStrictEqual(after, before, 'same-token different work must be rejected');
      break;
  }
};

const start = initial();
const seen = new Map<string, State>([[stateKey(start), start]]);
const queue: State[] = [start];

while (queue.length > 0) {
  const state = queue.shift() as State;
  verifyState(state);

  for (const client of CLIENTS) {
    const acquired = acquire(state, client);
    if (acquired) {
      verifyState(acquired);
      const key = stateKey(acquired);
      if (!seen.has(key)) {
        seen.set(key, acquired);
        queue.push(acquired);
      }
    }

    const released = release(state, client);
    if (released) {
      assert.strictEqual(
        released.highestGrant,
        state.highestGrant,
        'release must not roll fencing authority backward',
      );
      verifyState(released);
      const key = stateKey(released);
      if (!seen.has(key)) {
        seen.set(key, released);
        queue.push(released);
      }
    }

    for (const work of WORK) {
      const [next, decision] = write(state, client, work);
      verifyWrite(state, next, client, work, decision);
      verifyState(next);
      const key = stateKey(next);
      if (!seen.has(key)) {
        seen.set(key, next);
        queue.push(next);
      }
    }
  }
}

assert.ok(seen.size > 100, `expected non-trivial state space, visited ${seen.size}`);

// Explicit zombie-writer witness: A's old token cannot advance state after B commits.
const a = acquire(start, 0) as State;
const aToken = a.lastToken[0] as number;
const releasedA = release(a, 0) as State;
const b = acquire(releasedA, 1) as State;
const bToken = b.lastToken[1] as number;
assert.ok(bToken > aToken);
const [committed, bDecision] = write(b, 1, 0);
assert.strictEqual(bDecision, 'advanced');
const [, staleDecision] = write(committed, 0, 0);
assert.strictEqual(staleDecision, 'stale');

console.log(`formal fencing model OK: ${seen.size} reachable states exhaustively checked`);
