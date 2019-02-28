

const {Broker} = require('live-mutex');
new Broker({udsPath: process.env.HOME+ '/uds.temp.sock'}).ensure();