/**
 * Created by oleg on 1/27/17.
 */


const {Broker} = require('../broker');
const ijson = require('siamese');

process.once('message', function (conf) {

  ijson.parse(conf).then(function (data) {

    console.log('data => ', data);

    new Broker(data).ensure().then(function () {

      process.send({success: true});

    }, function (err) {

      process.send({
        error: err.stack || err
      })
    });
  });

});
