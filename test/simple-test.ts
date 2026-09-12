import {Client, Broker} from '../dist/main';
import * as assert from "assert";
import * as domain from "domain";

// Prefer the serial runner's assigned port, with a random fallback for manual runs.
const port = process.env.LMX_TEST_PORT
  ? parseInt(process.env.LMX_TEST_PORT, 10)
  : 8000 + Math.floor(Math.random() * 1000);

function release(unlock: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof unlock !== 'function') {
      return reject(new Error('Client lock did not return an unlock function.'));
    }
    unlock((err: any) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

async function lockAndRelease(client: Client): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.lock('z', (err: any, unlock: any) => {
      if (err) {
        return reject(err);
      }
      if (!unlock || unlock.acquired !== true) {
        return reject(new Error('Client lock did not report acquired=true.'));
      }
      release(unlock).then(resolve, reject);
    });
  });
}

async function closeBroker(broker: Broker): Promise<void> {
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      resolve();
    };
    const timeout = setTimeout(finish, 2000);
    broker.close((err: any) => {
      clearTimeout(timeout);
      if (err) {
        console.error('Broker close error:', err);
      }
      finish();
    });
  });
}

async function runSimpleTests(broker: Broker, initialClient: Client): Promise<void> {
  const clients: Client[] = [initialClient];
  const registerClient = (client: Client): Client => {
    clients.push(client);
    return client;
  };

  try {
    // Callback API through Client.create().
    const c1 = registerClient(Client.create({port}));
    const ready1 = await c1.ensure();
    assert.ok(ready1, 'Client.ensure() must return a connected client.');
    await lockAndRelease(ready1);

    // Promise-based ensure followed by the callback lock API.
    const c2 = registerClient(new Client({port}));
    const ready2 = await c2.ensure();
    assert.ok(ready2, 'Client.ensure() must return a connected client.');
    await lockAndRelease(ready2);

    // Static factory plus promise-based ensure.
    const c3 = registerClient(Client.create({port}));
    const ready3 = await c3.ensure();
    assert.ok(ready3, 'Client.ensure() must return a connected client.');
    await lockAndRelease(ready3);

    // Deprecated lockp() remains compatible with the promise API while
    // callers migrate to acquire()/release().
    const c4 = registerClient(Client.create({port}));
    const ready4 = await c4.ensure();
    assert.ok(ready4, 'Client.ensure() must return a connected client.');
    const result: any = await ready4.lockp('z');
    const unlock = result?.unlock ?? result;
    assert.strictEqual(unlock?.acquired, true);
    await release(unlock);
  } finally {
    for (const client of clients) {
      try {
        client.close();
      } catch (err) {
        // Cleanup is best effort; the original test error remains authoritative.
      }
    }
    await closeBroker(broker);
  }
}

Promise.all([
  new Broker({port}).ensure(),
  new Client({port}).connect(),
]).then(([broker, client]) => {
  broker.emitter.on('warning', function (value) {
    if (!String(value).match(/no lock with key/)) {
      console.error('broker warning:', ...arguments);
    }
  });

  client.emitter.on('warning', function (value) {
    if (!String(value).match(/no lock with key/)) {
      console.error('client warning:', ...arguments);
    }
  });

  broker.emitter.on('error', function (value) {
    if (!String(value).match(/no lock with key/)) {
      console.error('broker error:', ...arguments);
    }
  });

  client.emitter.on('error', function (value) {
    if (!String(value).match(/no lock with key/)) {
      console.error('client error:', ...arguments);
    }
  });

  const testDomain = domain.create();
  testDomain.once('error', (err) => {
    console.error('domain caught error:', err);
    process.exit(1);
  });

  testDomain.run(() => {
    runSimpleTests(broker, client)
      .then(() => {
        console.log('all done.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('final error:', err);
        process.exit(1);
      });
  });
}).catch((err) => {
  console.error('setup error:', err);
  process.exit(1);
});
