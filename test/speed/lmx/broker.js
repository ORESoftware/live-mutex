

const {Broker} = require('live-mutex');

// const conf = {udsPath: process.env.HOME+ '/uds.temp.sock'};
const conf = Object.freeze({port: 6970});

new Broker(conf).ensure();