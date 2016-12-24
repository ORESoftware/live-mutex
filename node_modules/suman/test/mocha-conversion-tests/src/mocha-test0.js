const assert = require('assert');
const fs = require('fs');

describe('a', function () {

	it('a', function (done) {
		
		process.nextTick(function () {
			throw new Error('whoops');
		});

		done();

	});

	it('b', function (done) {

		setTimeout(function () {
			done();
		}, 2000);

	});

});
