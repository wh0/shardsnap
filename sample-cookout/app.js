const assert = require('assert');
const fs = require('fs');
const http = require('http');

const dcc = require('dcc-client');
const eris = require('eris');
const express = require('express');

const config = {
	alias: 'sample_cookout',
	token: process.env.DISCORD_TOKEN,
	intents: eris.Constants.Intents.guildMessages | eris.Constants.Intents.directMessages,
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
const webUrl = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/';
const sourceUrl = 'https://glitch.com/edit/#!/' + process.env.PROJECT_DOMAIN +
	'?path=' + encodeURIComponent(__filename.replace(/^\/app\//, ''));

//
// model
//

const assignments = new Map();

function saveItem(name) {
	const volunteer = assignments.get(name);
	if (!volunteer) {
		try {
			fs.unlinkSync('.data/' + name);
		} catch (e) {
			if (e.code === 'ENOENT') {
				// no one was bringing it. leave it that way
			} else {
				throw e;
			}
		}
	} else {
		fs.writeFileSync('.data/' + name, volunteer);
	}
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
	message += `
View bot source: ${sourceUrl}
`;
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
cookout I'll bring <item>
cookout I can't bring <item>
cookout who's bringing <item>

**Items tracked:**
`;
			for (const [item, volunteer] of assignments) {
				message += `${item}
`
			}
			message += `
Go to our website ${webUrl} to see what's already covered.`
			logReject(bot.createMessage(packet.d.channel_id, message));
			return;
		}
	}
	{
		const m = /\bI(?:')?ll bring ([\w\s]+)\b/i.exec(packet.d.content);
		if (m) {
			const [, item] = m;
			const key = item.toLowerCase();
			if (!assignments.has(key)) {
				logReject(bot.createMessage(packet.d.channel_id, `We're not tracking ${item}. I think it sounds tasty though.`));
				return;
			}

			const prevVolunteer = assignments.get(key);
			if (prevVolunteer === packet.d.author.id) {
				logReject(bot.createMessage(packet.d.channel_id, `We already have you signed up to bring ${key}. :smile:`));
				return;
			}

			let message = `Yay, thanks! :smile:`;
			if (prevVolunteer) {
				message += ` <@${prevVolunteer}>, <@${packet.d.author.id}> will bring ${key} so you don't have to.`;
			}

			assignments.set(key, packet.d.author.id);
			saveItem(key);
			logReject(bot.createMessage(packet.d.channel_id, message));
			return;
		}
	}
	{
		const m = /\bI can(?:')?t bring ([\w\s]+)\b/i.exec(packet.d.content);
		if (m) {
			const [, item] = m;
			const key = item.toLowerCase();
			if (!assignments.has(key)) {
				logReject(bot.createMessage(packet.d.channel_id, `That's okay, I think we'll be fine without ${item}.`));
				return;
			}

			const prevVolunteer = assignments.get(key);
			if (prevVolunteer !== packet.d.author.id) {
				logReject(bot.createMessage(packet.d.channel_id, `No worries, we have <@${prevVolunteer}> bringing ${key}. :smile:`));
				return;
			}

			assignments.set(key, null);
			saveItem(key);
			logReject(bot.createMessage(packet.d.channel_id, `Got it. Can someone else bring ${key}?`));

			return;
		}
	}
	{
		const m = /\bwho(?:')?s bringing ([\w\s]+)\b/i.exec(packet.d.content);
		if (m) {
			const [, item] = m;
			const key = item.toLowerCase();
			if (!assignments.has(key)) {
				logReject(bot.createMessage(packet.d.channel_id, `Maybe nobody? I don't really understand ${item}. :thinking:`));
				return;
			}

			let message;
			const prevVolunteer = assignments.get(key);
			if (!prevVolunteer) {
				message = `Nobody is bringing ${key}! :scream:`;
			} else if (prevVolunteer === packet.d.author.id) {
				message = `_You're_ bringing ${key}, silly pants! :laughing:`;
			} else {
				message = `<@${prevVolunteer}> is bringing ${key}.`;
			}
			logReject(bot.createMessage(packet.d.channel_id, message));

			return;
		}
	}
	console.log('unmatched command');
	logReject(bot.createMessage(packet.d.channel_id, `You know, I only understand a few phrases. Say "cookout help" for commands.`));
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
