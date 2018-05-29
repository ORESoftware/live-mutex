import {Client} from 'live-mutex';

const Bluebird = require('bluebird');

const mc1 = new Client({
  port: 9394,
});

mc1.ensure().then(b => {
  return b.lockp('a', {ttl: 800000}).then(async res => {
    console.log(`mc1 locked`);
    await Bluebird.delay(10000);
    return b.unlockp('a').then(_ => {
      console.log('mc1 unlocked');
      process.exit(0);
    });
  });
})
.catch(e => {
  console.error('Caught the error: ', e);
});