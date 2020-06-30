const assert = require('assert');
const fs = require('fs');
const http = require('http');

const dcc = require('dcc-client');
const eris = require('eris');
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
		// ignore messages from self and other bots
		$not: {'d.author.bot': true},
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

//
// model
//

const assignments = new Map();

function saveItem(name) {
	const volunteer = assignments.get(name);
	fs.writeFileSync('.data/' + name, volunteer);
}

function loadItem(name) {
	let volunteer = null;
	try {
		volunteer = fs.readFileSync('.data/' + name, {encoding: 'utf8'});
	} catch (e) {
		if (e.code === 'ENOENT') {
			// no one's bringing it. this is a valid state
		} else {
			throw e;
		}
	}
	assignments.set(name, volunteer);
}

loadItem('plates');
loadItem('hamburgers');
loadItem('hot dogs');
loadItem('buns');
loadItem('drinks');

//
// web service
//

const app = express();
app.get('/', (req, res) => {
	let message = `We have the following covered:
`;
	for (const [item, volunteer] of assignments) {
		const check = volunteer ? 'x' : ' ';
		message += `[${check}] ${item}
`;
	}
	res.end(message);
});
const server = http.createServer(app);

//
// bot
//

function logReject(p) {
	p.catch((e) => {
		console.error(e);
	});
}

// we're using Eris in this example. configure it not to connect to the gateway. we'll be receiving
// events from dc-chartreuse in this setup. we won't have the gateway to tell us that this token is
// a bot, so we need to add that `Bot ` prefix explicitly
const bot = new eris.Client('Bot ' + config.token, {restMode: true});
bot.on('debug', (message, id) => {
	console.log('bot debug', message, id);
});
bot.on('warn', (message, id) => {
	console.warn('bot warn', message, id);
});
bot.on('error', (err, id) => {
	console.error('bot error', err, id);
});

const client = new dcc.Client(config.alias, config.clientSecret, {
	path: '/dcc/v1/sample_cookout',
	server,
});
client.on('dispatch', (packet) => {
	console.log('received packet', JSON.stringify(packet));
	assert.strictEqual(packet.t, 'MESSAGE_CREATE');
	assert.ok(!packet.d.author.bot);
	{
		const m = /\bhelp\b/i.exec(packet.d.content);
		if (m) {
			let message = `If we ever get through the you-know-what, let's have a cookout.

**Commands:**
cookout help
cookout I'm bringing <item>
cookout I can't bring <item>
cookout who's bringing <item>

**Items tracked:**`;
			for (const [item, volunteer] of assignments) {
				message += `
${item}`
			}
			logReject(bot.createMessage(packet.d.channel_id, message));
			return;
		}
	}
	console.log('unmatched command');
	logReject(bot.createMessage(packet.d.channel_id, 'Didn\'t understand that. Say "cookout help" for commands.'));
});

//
// start
//

server.listen(process.env.PORT, () => {
	console.log('listening', process.env.PORT);
	dcc.register(config).then(() => {
		console.log('register ok');
	}).catch((e) => {
		console.error('register failed', e);
	});
});
