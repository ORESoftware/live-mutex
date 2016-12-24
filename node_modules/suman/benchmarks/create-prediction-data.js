/**
 * Created by Olegzandr on 5/15/16.
 */

//core
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

//npm
const async = require('async');

//////////////////////////////////////////////////////////////

const cwd = process.cwd();

const sumanUtils = require('suman-utils/utils');
const root = sumanUtils.findProjectRoot(cwd);

if (!root) {
	console.log(' => Warning => A Node.js project root could not be found given your current working directory.');
	console.log(colors.bgRed.white(' => cwd:', cwd));
	return;
}
else if (cwd !== root) {
	console.log(' => CWD:', cwd);
	console.log(' => Project root:', root);
}

const destDir = path.resolve(root + '/benchmark-tests');
const dataFile = path.resolve(root + '/benchmarks/data.csv');

fs.writeFileSync(dataFile, 'new run on ' + new Date() + '\n\n');

//
// try {
// 	fs.mkdirSync(path.resolve(destDir));
// }
// catch (err) {
//
// }

function randomSort() {
	return Math.random();
}

//////////////////////////////////////////////////////////////////////////////////////////

const fileToCopy = '/Users/Olegzandr/WebstormProjects/suman/test/benchmark-tests/one.js';

const numOfTestFiles = [1, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160].sort(randomSort);
const numOfSerialNetworkCalls = [1, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160].sort(randomSort);
const concurrency = [5, 10, 15, 20, 25, 30, 35, 40].sort(randomSort);
const numOfCPUs = [8].sort(randomSort);



var networkCallsIndex = 0;
var concurrencyIndex = 0;

async.mapSeries(concurrency, function (c, cb) {
	async.mapSeries(numOfTestFiles, function removeCurrentDirAndMakeNewDir(fileCount, cb) {

		cp.exec('cd ' + root + ' && rm -rf benchmark-tests', function (err) {
			if (err) {
				throw err;
			}

			fs.mkdir(path.resolve(destDir), function (err) {
				if (err && !String(err).match(/EEXIST/)) {
					return cb(err)
				}
				networkCalls();
			});

		});

		function networkCalls() {

			const strm = fs.createReadStream(fileToCopy);
			strm.setMaxListeners(165);

			const array = Array.from(Array(fileCount), (x, i)=>i); //create an array with values [1,2,3...,X]

			async.each(array, function (item, cb) {

				const p = path.resolve(destDir + '/test-' + item + '.js');
				strm.pipe(fs.createWriteStream(p)).on('error', cb).on('finish', cb);

			}, function (err) {

				if (err) {
					throw err;
				}

				// const num = numOfSerialNetworkCalls[Math.floor(Math.random() * numOfSerialNetworkCalls.length)];
				// const c = concurrency[Math.floor(Math.random() * concurrency.length)];

				async.mapSeries(numOfSerialNetworkCalls, function (num, cb) {

					const starttime = Date.now();

					console.log('\n');
					console.log('concurrency:', c);
					console.log('number of network calls:', num);
					console.log('number of files:', fileCount);

					cp.exec('NUM_OF_NETWORK_CALLS=' + num + ' cd ' + root + ' && suman benchmark-tests --concurrency=' + c, function (err, stdout, stderr) {

						if (err) {
							throw new Error('err defined in cp.exec callback, error code = ' + err.code + '\n\n' + err.stack);
						}
						else if (String(stdout).match(/error/i)) {
							throw new Error('stdout error defined in cp.exec callback' + stdout);
						}
						else if (String(stderr).match(/error/i)) {
							throw new Error('stdout error defined in cp.exec callback' + stdout);
						}

						const totalTime = Date.now() - starttime;
						console.log('total time:', totalTime);
						console.log('\n');

						fs.appendFileSync(dataFile, [fileCount, num, c, totalTime].join(',') + ',\n');

						cb();
					});

				}, cb);

			});
		}

	}, cb);

}, function (err, results) {

	console.log('all done!!');
});

