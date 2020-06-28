const EventEmitter = require('events');
const http = require('http');

const WebSocket = require('ws');

function register({alias, token, intents, criteria, dst, clientSecret, requestModule, endpoint}) {
	if (!alias) throw new Error('missing alias');
	if (!token) throw new Error('missing token');
	if (!intents) intents = 4608;
	if (!criteria) criteria = {t: 'MESSAGE_CREATE'};
	if (!dst) throw new Error('missing dst');
	if (!clientSecret) throw new Error('missing clientSecret');
	// todo: switch in public deployment
	if (!requestModule) requestModule = http;
	if (!endpoint) endpoint = 'http://localhost:3000';

	// todo: add a way to rotate clientSecret
	const body = Buffer.from(JSON.stringify({token, intents, criteria, dst, clientSecret}));
	return new Promise((resolve, reject) => {
		const req = requestModule.request(endpoint + '/relays/' + alias, {
			auth: clientSecret,
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': body.byteLength,
			},
		}, (res) => {
			if (res.statusCode < 400) {
				resolve(res);
			} else {
				reject(res);
			}
		});
		req.end(body);
	});
}

class Client extends EventEmitter {
	constructor(alias, clientSecret, wsOpts) {
		super();
		this.authLine = 'Basic ' + Buffer.from(clientSecret).toString('base64');
		this.wss = new WebSocket.Server({path: '/dcc/v1/' + alias, ...wsOpts});
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
