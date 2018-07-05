const http = require('http');
module.exports = data => {
    return {
        dependencies: {
            'Broker': function () {
                return Promise.resolve().then(() => require('../../dist/broker-1')).then(v => v.default || v);
            },
            'LvMtxClient': function () {
                return Promise.resolve().then(() => require('../../dist/client')).then(v => v.default || v);
            },
            'Client': function () {
                return Promise.resolve().then(() => require('../../dist/client')).then(v => v.default || v);
            },
            'lmUtils': function () {
                return Promise.resolve().then(() => require('../../dist/utils'));
            },
            'Promise': function () {
                return require('bluebird');
            }
        }
    };
};
