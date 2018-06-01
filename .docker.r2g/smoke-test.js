

const {Client} = require('live-mutex');
const c = new Client({});

c.emitter.on('warning', function () {
   console.log(...arguments);
});