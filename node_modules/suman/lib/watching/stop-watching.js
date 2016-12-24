'use striiict';

//core
const http = require('http');
const path = require('path');
const cp = require('child_process');

//npm
const colors = require('colors/safe');

//project
const sumanServer = require('../create-suman-server');

function stopWatching(paths, cb) {

	const opts = global.sumanOpts;

	var finished = false;

	function finish(err) {
		if (!finished) {
			finished = true;
			cb(err);
		}
	}

	sumanServer({

		//TODO: force localhost here!

	}).on('connect', function () {

		if (opts.verbose) {
			console.log('\n', 'Web-socket connection to Suman server successful.', '\n');
		}

		console.log(' => Suman about to send "stop-watching" message to Suman server');

		this.emit('stop-watching', JSON.stringify({
			paths: paths || []
		}));

		finish();

	}).on('connect_timeout', function (err) {

		console.log(' => Suman server connection timeout :(');
		setTimeout(function () {
			finish(new Error('connect_timeout' + (err.stack || err || '')));
		}, 2000);

	}).on('connect_error', function (err) {

		if (!String(err.stack || err).match(/xhr poll error/i)) {
			console.log(' => Suman server connection error: ' + err.stack);
		}

		setTimeout(function () {
			finish(err);
		}, 4000);

	}).on('error', function (err) {

		console.log('\n => Suman server connection error: ' + err.stack);
		console.log('\n\n => Please check your logs/server.log file for more info.');

		if (String(err.stack || err).match(/xhr poll error/i)) {
			setTimeout(function () {
				finish(err);
			}, 4000);
		}
		else {
			console.log(' => Suman server connection error: ' + err.stack);
			setTimeout(function () {
				finish(err);
			}, 3000);
		}

	});

}

module.exports = stopWatching;