

const {Broker} = require('live-mutex/broker');
new Broker({port: 7987}).ensure();