const suman = require('suman');
const Test = suman.init(module, {});


Test.create(__filename, {mode: 'parallel'}, function (assert, before, it, Client, lmUtils) {


    before('promise', function () {

        return lmUtils.conditionallyLaunchSocketServer({})
            .then(function (data) {
                console.log('data from conditionallyLaunchSocketServer => ', data);
            }, function (err) {
                if (err) {
                    console.error(err.stack);
                }
                else {
                    throw new Error('no error passed to reject handler');
                }

            });

    });


    it.cb('yes', {timeout: 30000}, t => {

        const client = new Client();
        client.lock('z', function (err) {
            if (err) return t(err);
            t(); // client.unlock('z', t);
        });
    });


    it.cb('yes', {timeout: 30000}, t => {

        const client = new Client();
        client.lock('z', function (err) {
            if (err) return t(err);
            client.unlock('z', t.done);
        });
    });

    it.cb('yes', {timeout: 30000}, t => {

        const client = new Client();
        client.lock('z', function (err) {
            if (err) return t(err);
            client.unlock('z', t);
        });
    });

    it.cb('yes', {timeout: 30000}, t => {

        const client = new Client();
        client.lock('z', function (err) {
            if (err) return t(err);
            client.unlock('z', t.done);
        });
    });

});