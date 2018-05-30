


const {Broker} = require('../broker');

new Broker({}).close(function(err){
  console.error(err);
});