const http = require('http');

const dcc = require('../client');
const express = require('express');

const config = require('./config.json');

const app = express();
app.get('/zero', (req, res) => {
	res.json(0);
});

const server = http.createServer(app);

const client = new dcc.Client(config.alias, config.clientSecret, {
	path: '/dcc/v1/sample_cookout',
	server,
});
client.on('dispatch', (packet) => {
	console.log('received packet', JSON.stringify(packet));
});

server.listen(process.env.PORT, () => {
	console.log('listening', process.env.PORT);
	dcc.register(config).then(() => {
		console.log('register ok');
	}).catch((e) => {
		console.error('register failed', e);
	});
});
