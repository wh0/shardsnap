const http = require('http');

const dcc = require('dcc-client');
const express = require('express');

const config = {
	alias: 'sample_cookout',
	token: process.env.DISCORD_TOKEN,
	// GUILD_MESSAGES | DIRECT_MESSAGES
	intents: 4608,
	criteria: {
		// corresponds to what we declared in the gateway, but further filters out messages like
		// READY, CHANNEL_CREATE, and MESSAGE_UPDATE
		t: 'MESSAGE_CREATE',
		$or: [
			// DMs
			{'d.guild_id': {$exists: false}},
			// mentions
			{'d.mentions': {$elemMatch: {id: process.env.BOT_USER_ID}}},
			// prefix
			{'d.content': {$regex: '^cookout\\b'}},
		],
	},
	dst: 'wss://' + process.env.PROJECT_DOMAIN + '.glitch.me/dcc/v1/sample_cookout',
	clientSecret: process.env.DCC_SECRET,
};

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
		console.error('register failed', e.statusCode, e.statusMessage);
	});
});
