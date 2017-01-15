const net = require('net');

const server = net.createServer((c) => {
    // 'connection' listener
    console.log('client connected');
    c.on('end', () => {
        console.log('client disconnected');
    });
    c.write('hello\r\n');
    c.pipe(c);
});

server.on('error', (err) => {
    throw err;
});

server.listen((data) => {
    console.log('server bound => ', data);
});

server.on('listening', function (data) {

    console.log('server address => ', server.address());
    console.log('data => ', data);
});