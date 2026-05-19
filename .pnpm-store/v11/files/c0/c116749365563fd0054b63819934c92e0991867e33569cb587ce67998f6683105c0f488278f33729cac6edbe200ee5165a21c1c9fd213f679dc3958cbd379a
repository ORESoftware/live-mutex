'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const http = require("http");
const fs = require("fs");
const url = require("url");
const path = require("path");
const SocketServer = require("socket.io");
const replaceStream = require("replacestream");
const su = require("suman-utils");
const _suman = global.__suman = (global.__suman || {});
const io = {
    server: null
};
const getEmbeddedScript = function (port, id) {
    const sumanOptsStr = su.customStringify(_suman.sumanOpts);
    const sumanConfigStr = su.customStringify(_suman.sumanConfig);
    const timestamp = Date.now();
    return [
        '<script>',
        `window.__suman = window.__suman || {};`,
        `window.__suman.SUMAN_SOCKETIO_SERVER_PORT=${port};`,
        `window.__suman.SUMAN_CHILD_ID=${id};`,
        `window.__suman.usingRunner=true;`,
        `window.__suman.timestamp=${timestamp};`,
        `window.__suman.sumanConfig=${sumanConfigStr};`,
        `window.__suman.sumanOpts=${sumanOptsStr};`,
        '</script>'
    ]
        .join('\n');
};
exports.initializeSocketServer = function (cb) {
    if (_suman.inceptionLevel > 0) {
        io.server = {
            on: function () {
                _suman.log.warning('sumanception inacted.');
            }
        };
        return process.nextTick(cb, null, -1);
    }
    let sb, getBrowserStream;
    try {
        sb = require('suman-browser');
        getBrowserStream = sb.makeGetBrowserStream(_suman.sumanHelperDirRoot, _suman.sumanConfig, _suman.sumanOpts);
    }
    catch (err) {
        if (_suman.sumanOpts.browser) {
            throw new Error('Please install "suman-browser" using "npm install -D suman-browser".');
        }
        else {
            _suman.log.warning('warning: cannot find browser dependency => ', err.message);
        }
    }
    const regex = /<suman-test-content>.*<\/suman-test-content>/;
    let httpServer = http.createServer(function (req, res) {
        const { query } = url.parse(req.url, true);
        let data;
        try {
            data = JSON.parse(query.data);
        }
        catch (err) {
            const file = path.resolve(_suman.projectRoot + '/' + req.url);
            const strm = fs.createReadStream(file);
            let onError = function (e) {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.stack || e }));
                }
            };
            strm.once('error', onError);
            return strm.pipe(res).once('error', onError);
        }
        if (data.path && data.childId) {
            let port = httpServer.address().port;
            fs.createReadStream(data.path)
                .pipe(replaceStream(regex, getEmbeddedScript(port, data.childId)))
                .pipe(res);
        }
        else if (data.childId) {
            let port = httpServer.address().port;
            let id = data.childId;
            getBrowserStream(port, id, function (err, results) {
                if (err) {
                    return res.end(JSON.stringify({ error: err.stack || err }));
                }
                results.forEach(res.write.bind(res));
                res.end();
            });
        }
        else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'missing path or childId.' }));
        }
    });
    httpServer.once('listening', function () {
        cb(null, this.address().port);
    });
    httpServer.listen(0);
    io.server = SocketServer(httpServer);
};
exports.getSocketServer = function () {
    if (!io.server)
        throw new Error('Suman implementation error - socket.io server was not initialized yet.');
    return io.server;
};
