var http = require('http');
module.exports = function (data) {
    return {
        dependencies: {
            'example': function () {
                return { 'just': 'an example' };
            },
            'Broker': function () {
                return require('../../broker').Broker;
            },
            'Client': function () {
                return require('../../client').Client;
            },
            'lmUtils': function () {
                return require('../../utils');
            }
        }
    };
};
