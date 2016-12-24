

const test = require('ava');
const fs = require('fs');
const assert = require('assert');

test.cb('a', t => {
	fs.exists('foo', function () {
		assert(false);
		t.pass();  // won't get reached, but here for clarity
	});
});

test('b', t => {
	return new Promise(function (resolve) {
		setTimeout(function () {
			assert(false);
			resolve(); // won't be reached, but here for clarity
		}, 100);
	});
});

test('c', t => {
	return new Promise(function (resolve) {
		setImmediate(function () {
			assert(false);
			resolve(); // won't be reached, but here for clarity
		});
	});
});

test('d', t => {
	return new Promise(function (resolve) {
		process.nextTick(function () {
			assert(false);
			resolve(); // won't be reached, but here for clarity
		});
	});
});
