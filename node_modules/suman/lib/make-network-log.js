/**
 * Created by denman on 1/25/16.
 */


//#core
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

//#npm
const request = require('request');
const tcpp = require('tcp-ping');
const socketio = require('socket.io-client');
const _ = require('underscore');
const async = require('async');

//#project
const sumanUtils = require('suman-utils/utils');

///////////////////////////////////////////////////////////////////////////////////////

module.exports = function makeSendTestData(timestamp) {
	
	var socket;
	var shouldExit = false;
	const cwd = process.cwd();
	const hostname = os.hostname();
	
	return {
		
		sendTestData: function sendTestData(data) {
			
			//if(socket){
			socket.emit('TEST_DATA', data);
			//}
			
		},
		
		createNewTestRun: function createNewTestRun(server, cb) {
			
			const homeDir = sumanUtils.getHomeDir();
			const testResults = path.resolve(homeDir + '/suman/test_results/');
			const outputPath = path.resolve(testResults + '/' + timestamp);
			
			async.parallel([
				function (cb) {
					async.series([
						function (cb) {
							fs.mkdir(path.resolve(homeDir + '/suman'), function (err) {
								if (err) {
									if (!String(err).match(/EEXIST/)) {
										console.error(' => Suman warning => Could not make directory in your user home directory.');
										return cb(err);
									}
								}
								cb(null);
							});
						},
						function (cb) {
							const opts = global.sumanOpts;
							if ((opts.runner_lock || (global.sumanConfig.runnerLock && !opts.no_runner_lock)) && !opts.fforce) {
								fs.writeFile(path.resolve(homeDir + '/suman/lockfile'), {
									flag: 'wx+',
									flags: 'wx+'
								}, cb);
							}
							else {
								process.nextTick(cb);
							}
						},
						function (cb) {
							fs.mkdir(testResults, function (err) {
								if (err && !String(err).match(/EEXIST/i)) {
									console.error(' => Suman warning => Could not make directory in your user home directory.');
									cb(err);
								}
								else {
									cb(null);
								}

							});
						},
						function (cb) {
							fs.mkdir(outputPath, function (err) {
								if (err && !String(err).match(/EEXIST/)) {
									console.error(' => Suman warning => Could not make directory in your user home directory.');
									cb(err);
								}
								else {
									cb(null);
								}
							});
						}
					
					], cb);
					
				},
				function (cb) {
					
					if (!server) {
						if (process.env.SUMAN_DEBUG == 'yes') {
							console.log(' => Suman debug message => no Suman server to use.');
						}

						process.nextTick(cb);
					}
					else {
						
						var called = false;
						
						function execCallback(err) {
							if (!called) {
								called = true;
								process.nextTick(function(){
									cb(err);
								});
							}
						}
						
						const to = setTimeout(function () {
							execCallback(new Error('timedout'));
						}, 4000);
						
						const timeStart = Date.now();
						
						tcpp.probe(server.host, server.port, function (err, avail) {
							
							if (process.env.SUMAN_DEBUG == 'yes') {
								console.log(' => Suman debug message => time needed to find / (or not find) server:', Date.now() - timeStart);
							}
							
							clearTimeout(to);
							
							if (err) {
								execCallback(err);
							}
							else if (avail) {
								
								global.usingLiveSumanServer = true;
								socket = socketio('http://' + server.host + ':' + server.port);
								
								async.parallel([
									function (cb) {
										var first = true;
										function fireCB(){
											if(first){
												first = false;
											}
											cb(null);
										}
										socket.on('connect', fireCB);
										socket.on('error', fireCB);
										socket.on('connect_error', fireCB);
									},
									function (cb) {
										request.post({
											url: 'http://' + server.host + ':' + server.port + '/results/make/new',
											json: {
												timestamp: timestamp,
												config: global.sumanConfig
											}
										}, function (err, resp, body) {
											cb(err);
										});
									}
								], function complete(err, results) {
									execCallback(err, true);
								});
								
							}
							else {
								//TODO: should be able to use *default server if it's there
								global.usingLiveSumanServer = false;
								execCallback(null);
							}
							
						});
					}
				}
			
			], cb);
			
		}
		
	};
	
};
