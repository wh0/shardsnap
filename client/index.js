const EventEmitter = require('events');

const WebSocket = require('ws');

function register(alias, token, intents, criteria, dst, clientSecret) {
	// todo
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
