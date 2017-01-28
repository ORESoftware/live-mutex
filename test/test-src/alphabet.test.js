const suman = require('suman');
const Test = suman.init(module, {});
const async = require('async');

Test.create(__filename, function (assert, before, describe, it, path, Client, Broker, lmUtils, fs, inject) {

    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const az = alphabet.split('');
    assert.equal(az.length, 26, ' => Western alphabet is messed up.');

    const num = 100;

    const conf = Object.freeze({port:7028});

    inject('yes', () => {
        return {
            broker: new Broker(conf).ensure()
        }
    });

    inject('yes', () => {
        return {
            client: new Client(conf).ensure()
        }
    });

    const p = path.resolve(process.env.HOME + '/alphabet.test');
    const file = fs.createWriteStream(p);

    console.log('client => ', 'zoom');

    describe('post', function (client, broker, before, it) {

        console.log('client => ', client);

        before.cb('yo', h => {

            async.each(az, function (val, cb) {

                client.lock('foo', function (err, unlock) {

                    const strm = fs.createWriteStream(p, {flags: 'a'});

                    for (var i = 0; i < num; i++) {
                        strm.write(val);
                    }

                    strm.end();

                    strm.on('finish', function () {
                        unlock(cb);
                    });
                });

            }, h.done);

        });

        it.cb('count characters => expect num*26', {timeout: 300}, t => {

            fs.readFile(p, function (err, data) {
                if (err) {
                    return t.done(err);
                }
                else {
                    assert.equal(String(data).trim().length, (26 * num));
                    t.done();
                }
            });
        });

        it.cb('10 chars of each, in order', {timeout: 300}, t => {

            const readable = fs.createReadStream(p);

            readable.on('error', t.fail);

            readable.on('readable', function () {

                var index = 0;
                var chunk;
                while (null != (chunk = readable.read(1))) {

                    // const mod1 = index % 10;
                    // const mod2 = index % 26;

                    // const  temp = Math.floor(index/10) % 26;
                    // const  temp = Math.floor(index/10);
                    const temp = (index - (index % num)) / num;
                    assert.equal(String(chunk), alphabet[temp]);
                    index++;
                }

                t.done();
            });
        });

    });

});