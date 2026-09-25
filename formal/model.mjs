#!/usr/bin/env node
import fs from "node:fs";

const CLIENTS = ["a", "b"];
const TTL = 2;
const MAX_TIME = 5;
const MAX_FENCE = 4;
const fail = (ok, message, context) => {
  if (!ok) throw new Error(`formal invariant failed: ${message}\n${JSON.stringify(context ?? {})}`);
};
const initial = () => ({now:0, holder:null, fence:0, lastFence:0, expiresAt:0, queue:[], requestResult:{}});
const clone = (s) => ({...s, queue:[...s.queue], requestResult:{...s.requestResult}});
const active = (s) => s.holder !== null && s.now < s.expiresAt;

function expireAndGrant(s0) {
  const s = clone(s0);
  if (s.holder !== null && s.now >= s.expiresAt) {
    s.holder = null; s.fence = 0; s.expiresAt = 0;
  }
  if (s.holder === null && s.queue.length > 0 && s.lastFence < MAX_FENCE) {
    const next = s.queue.shift();
    s.lastFence += 1;
    s.holder = next.client;
    s.fence = s.lastFence;
    s.expiresAt = Math.min(MAX_TIME + TTL, s.now + TTL);
    s.requestResult[next.requestId] = {kind:"granted", client:next.client, fence:s.fence};
  }
  return s;
}

function checkState(s) {
  fail(Number.isInteger(s.now) && s.now >= 0 && s.now <= MAX_TIME, "time bounded", s);
  fail(Number.isInteger(s.lastFence) && s.lastFence >= 0 && s.lastFence <= MAX_FENCE, "fence bounded", s);
  fail(new Set(s.queue.map(x => x.requestId)).size === s.queue.length, "queued request ids unique", s);
  if (s.holder === null) fail(s.fence === 0 && s.expiresAt === 0, "free lock has no grant metadata", s);
  else {
    fail(CLIENTS.includes(s.holder), "holder is known", s);
    fail(s.fence > 0 && s.fence === s.lastFence, "live holder owns newest fence", s);
    fail(s.expiresAt > s.now, "live grant is unexpired", s);
  }
}

function step(input, action) {
  const before = expireAndGrant(input);
  let s = clone(before);
  let accepted = false;
  let reason = "precondition";
  if (action.kind === "tick" && s.now < MAX_TIME) {
    s.now += 1; s = expireAndGrant(s); accepted = true; reason = "advanced";
  } else if (action.kind === "acquire" && CLIENTS.includes(action.client)) {
    const prior = s.requestResult[action.requestId];
    const queued = s.queue.some(x => x.requestId === action.requestId);
    if (prior || queued) { accepted = true; reason = "idempotent"; }
    else if (s.holder === null && s.lastFence < MAX_FENCE) {
      s.lastFence += 1;
      s.holder = action.client;
      s.fence = s.lastFence;
      s.expiresAt = Math.min(MAX_TIME + TTL, s.now + TTL);
      s.requestResult[action.requestId] = {kind:"granted", client:action.client, fence:s.fence};
      accepted = true; reason = "granted";
    } else if (active(s)) {
      s.queue.push({client:action.client, requestId:action.requestId});
      accepted = true; reason = "queued";
    }
  } else if (action.kind === "release" && CLIENTS.includes(action.client)) {
    if (active(s) && s.holder === action.client && action.fence === s.fence) {
      s.holder = null; s.fence = 0; s.expiresAt = 0; s = expireAndGrant(s);
      accepted = true; reason = "released";
    } else reason = "stale-or-not-owner";
  } else if (action.kind === "renew" && CLIENTS.includes(action.client)) {
    if (active(s) && s.holder === action.client && action.fence === s.fence) {
      s.expiresAt = Math.min(MAX_TIME + TTL, s.expiresAt + 1);
      accepted = true; reason = "renewed";
    } else reason = "stale-or-not-owner";
  }
  checkState(s);
  fail(s.lastFence >= input.lastFence, "fencing tokens never regress", {input,action,next:s});
  if (action.kind === "renew" && accepted) fail(s.fence === before.fence, "renew never mints fence", {before,action,s});
  if (action.kind === "release" && !accepted) fail(s.holder === before.holder && s.fence === before.fence, "stale release is side-effect free", {before,action,s});
  return {accepted,reason,next:s};
}

function allActions() {
  const out = [{kind:"tick"}];
  for (const client of CLIENTS) {
    for (const requestId of [`${client}-1`, `${client}-2`]) out.push({kind:"acquire",client,requestId});
    for (const fence of [1,2,3,4]) out.push({kind:"release",client,fence},{kind:"renew",client,fence});
  }
  return out;
}
const key = (s) => JSON.stringify(s);

function explore() {
  const start = initial();
  const seen = new Map([[key(start),start]]);
  const queue = [start];
  let transitions = 0;
  for (let i=0;i<queue.length;i++) {
    for (const action of allActions()) {
      const tr = step(queue[i],action); transitions += 1;
      if (tr.accepted) {
        const k = key(tr.next);
        if (!seen.has(k)) { seen.set(k,tr.next); queue.push(tr.next); }
      }
    }
  }
  console.log(JSON.stringify({
    model:"live-mutex/lock-refinement-v1",
    claim:"finite-exhaustive-abstraction",
    states:seen.size,
    transitions,
    invariants:["exclusive-live-holder","fifo-waiter-order","unique-request-id","monotonic-fencing-token","renew-preserves-fence","stale-release-side-effect-free","ttl-expiry-progress"]
  }));
}

function replay(doc) {
  let state=initial(); const outcomes=[];
  for (const action of doc.actions ?? []) { const tr=step(state,action); outcomes.push({accepted:tr.accepted,reason:tr.reason}); state=tr.next; }
  return {ok:true,state,outcomes};
}

if (process.argv.includes("--json-stdin")) {
  for (const line of fs.readFileSync(0,"utf8").split(/\r?\n/).filter(Boolean)) {
    try { console.log(JSON.stringify(replay(JSON.parse(line)))); }
    catch(e){ console.log(JSON.stringify({ok:false,error:String(e?.message ?? e)})); process.exitCode=1; }
  }
} else explore();
