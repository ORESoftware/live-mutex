

const {Broker} = require('live-mutex');
new Broker({port: 7987}).ensure();