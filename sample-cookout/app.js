const http = require('http');

const express = require('express');

const dcc = require('../client');

const app = express();
app.get('/zero', (req, res) => {
	res.json(0);
});

const server = http.createServer(app);

const config = require('../config.json');
const dccc = new dcc.Client(config.alias, config.clientSecret, {server});
dccc.on('dispatch', (packet) => {
	console.log('received packet', JSON.stringify(packet));
});

server.listen(process.env.PORT, () => {
	console.log('listening');
});
