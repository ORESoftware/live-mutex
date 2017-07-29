var http = require('http');
module.exports = function (data) {
    return {
        dependencies: {
            'Broker': function () {
                return require('../../broker').default;
            },
            'Client': function () {
                return require('../../client').default;
            },
            'lmUtils': function () {
                return require('../../utils').default;
            },
            'Promise': function () {
                return require('bluebird');
            }
        }
    };
};
