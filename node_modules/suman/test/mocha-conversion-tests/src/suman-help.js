const suman = require('suman');
const Test = suman.init(module);

Test.describe('a', {}, function () {

	this.it.cb('a', t => {

		process.nextTick(function () {
			throw new Error('whoops');
		});

		t.done();

	});

	this.it.cb('b', t => {

		setTimeout(function () {
			t.done();
		}, 2000);

	});

});
