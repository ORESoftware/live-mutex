/**
 * Created by denman on 5/3/2016.
 */


const suman = require('suman');
const Test = suman.init(module);

Test.create('Catches exceptions', {}, function (fs, assert, it) {

	it.cb('a', t => {
		fs.exists('foo', function () {
			assert(false);
			t.pass();  // won't get reached, but here for clarity
		});

	});

	it('b', t => {
		return new Promise(function (resolve) {
			setTimeout(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			}, 100);
		});
	});

	it('c', t => {
		return new Promise(function (resolve) {
			setImmediate(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			});
		});
	});

	it('d', t => {
		return new Promise(function (resolve) {
			process.nextTick(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			});
		});
	});
});


Test.create('Catches exceptions part Deaux', {}, function (fs, assert, it) {

	it.cb('a', t => {
		fs.exists('foo', function () {
			assert(false);
			t.pass();  // won't get reached, but here for clarity
		});

	});

	it('b', t => {
		return new Promise(function (resolve) {
			setTimeout(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			}, 100);
		});
	});

	it('c', t => {
		return new Promise(function (resolve) {
			setImmediate(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			});
		});
	});

	it('d', t => {
		return new Promise(function (resolve) {
			process.nextTick(function () {
				assert(false);
				resolve(); // won't be reached, but here for clarity
			});
		});
	});
});
