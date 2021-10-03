const EventEmitter = require('events');
const https = require('https');

const WebSocket = require('ws');

const metadata = require('./package.json');

function register({alias, token, intents, criteria, dst, clientSecret, requestModule, endpoint}) {
	if (!alias) throw new Error('missing alias');
	if (!token) throw new Error('missing token');
	if (!intents) intents = 4608;
	if (!criteria) criteria = {t: 'MESSAGE_CREATE', $not: {'d.author.bot': true}};
	if (!dst) throw new Error('missing dst');
	if (!clientSecret) throw new Error('missing clientSecret');
	// todo: move public deployment elsewhere
	if (!requestModule) requestModule = https;
	if (!endpoint) endpoint = 'https://shardsnap.glitch.me';

	// todo: add a way to rotate clientSecret
	const body = Buffer.from(JSON.stringify({token, intents, criteria, dst, clientSecret}));
	return new Promise((resolve, reject) => {
		const req = requestModule.request(endpoint + '/relays/' + alias, {
			method: 'PUT',
			auth: clientSecret,
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': body.byteLength,
				'User-Agent': metadata.name + '/' + metadata.version,
			},
		});
		req.on('response', (res) => {
			res.resume();
			if (res.statusCode < 400) {
				resolve();
			} else {
				reject(new Error('response ' + res.statusCode + ' ' + res.statusMessage));
			}
		});
		req.on('error', (err) => {
			reject(err);
		});
		req.end(body);
	});
}

class Client extends EventEmitter {
	constructor(alias, clientSecret, wsOpts) {
		super();
		if (!alias) throw new Error('missing alias');
		if (!clientSecret) throw new Error('missing clientSecret');
		this.authLine = 'Basic ' + Buffer.from(clientSecret).toString('base64');
		this.wss = new WebSocket.Server(wsOpts);
		this.wss.on('connection', (socket, req) => {
			if (req.headers.authorization !== this.authLine) {
				socket.close(4001);
				return;
			}
			socket.on('message', (data) => {
				this.emit('dispatch', JSON.parse(data));
			});
		});
	}
}

module.exports = {register, Client};
