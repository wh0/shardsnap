const assert = require('assert');

const bodyParser = require('body-parser');
const eris = require('eris');
const express = require('express');
const safeRegex = require('safe-regex');
const sift = require('sift');
const WebSocket = require('ws');

const MATCH_OPTIONS = {
	operations: {
		$regex: (pattern, ownerQuery, options) => {
			if (!safeRegex(pattern)) throw new Error('"$regex" pattern too complex (dcc)');
			return sift.createEqualsOperation(new RegExp(pattern, ownerQuery.$options), ownerQuery, options);
		},
		$where: (params, ownerQuery, options) => {
			throw new Error('"$where" condition not supported (dcc)');
		},
	},
};
const SLEEP_MS = 60 * 1000;
const MAX_QUEUE = 1000;

function jsonEquals(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

class Relay {
	constructor(alias) {
		this.alias = alias;
		console.log('relay construct', this.alias);

		this.token = null;
		this.intents = null;
		this.criteria = null;
		this.dst = null;
		this.clientSecret = null;

		this.enabled = false;
		this.lastDisableReason = '(not collected)';
		this.connectRunning = false;

		this.match = null;

		this.queuedEvents = [];
		this.lastWSError = '(not collected)';
		this.ws = null;
		this.sleepTimeout = setTimeout(() => {
			console.log('ws sleeping', this.alias);
			if (!this.ws) return;
			this.ws.close(1000);
		}, SLEEP_MS).unref();

		this.preparedShards = new WeakSet();
		this.lastBotError = '(not collected)';
		this.bot = new eris.Client();
		this.bot.on('debug', (message, id) => {
			console.log('bot debug', this.alias, message, id);
		});
		this.bot.on('warn', (message, id) => {
			console.warn('bot warn', this.alias, message, id);
		});
		this.bot.on('error', (err, id) => {
			console.error('bot error', this.alias, err, id);
			this.lastBotError = 'error event: ' + err;
		});
		this.bot.on('connect', (id) => {
			console.log('bot shard connect', this.alias, id);
			const shard = this.bot.shards.get(id);
			if (this.preparedShards.has(shard)) return;
			this.preparedShards.add(shard);
			console.log('dcc preparing shard', this.alias, id);
			// detect if a later version of Eris binds this method
			assert.strictEqual(shard.wsEvent, eris.Shard.prototype.wsEvent);
			shard.wsEvent = (packet) => this.interceptEvent(shard, packet);
		});
		this.bot.on('shardDisconnect', (err, id) => {
			console.log('bot shard disconnect', this.alias, err, id);
		});
		this.bot.on('ready', () => {
			console.log('bot ready', this.alias);
		});
	}

	interceptEvent(shard, packet) {
		switch (packet.t) {
		case 'RESUMED':
			eris.Shard.prototype.wsEvent.call(shard, packet);
		case 'READY':
			// create a mostly redacted packet so that Eris doesn't trouble itself with caching
			// everything
			const redactedPacket = {
				op: packet.op,
				d: {
					// apparently there are a bunch of undocumented fields. well we're not passing
					// them
					v: packet.d.v,
					user: packet.d.user,
					private_channels: [],
					guilds: [],
					session_id: packet.d.session_id,
				},
				s: packet.s,
				t: packet.t,
			};
			if ('shard' in packet) redactedPacket.shard = packet.shard;
			eris.Shard.prototype.wsEvent.call(shard, redactedPacket);
		}

		this.offerPacket(packet);
	}

	offerPacket(packet) {
		if (!this.match) {
			try {
				this.match = sift(this.criteria, MATCH_OPTIONS);
			} catch (e) {
				this.lastDisableReason = 'unacceptable criteria: ' + e;
				this.disable();
				return;
			}
		}

		if (!this.match(packet)) return;
		this.sendPacket(packet);
	}

	sendPacket(packet) {
		// wipe out existing web socket if it's no longer viable
		if (this.ws) {
			if (this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED) {
				this.ws = null;
			}
		}
		// open a new web socket if we don't have one
		if (!this.ws) {
			const dst = this.dst;
			const ws = new WebSocket(dst, {auth: this.clientSecret});
			ws.on('open', () => {
				console.log('ws open', this.alias, dst);
				assert.strictEqual(this.ws, ws);
				const queuedEvents = this.queuedEvents;
				this.queuedEvents = [];
				for (const p of queuedEvents) {
					this.ws.send(JSON.stringify(p));
				}
				this.sleepTimeout.refresh();
			});
			ws.on('close', (code, reason) => {
				console.log('ws close', this.alias, dst, code, reason);
			});
			ws.on('error', (err) => {
				console.error('ws error', this.alias, dst, err);
				this.lastWSError = 'error event: ' + err;
			});
			this.ws = ws;
			this.sleepTimeout.refresh();
		}

		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(packet));
			this.sleepTimeout.refresh();
		} else {
			assert.strictEqual(this.ws.readyState, WebSocket.CONNECTING);
			if (this.queuedEvents.length >= MAX_QUEUE) {
				this.queuedEvents = [];
			}
			this.queuedEvents.push(packet);
		}
	}

	enable() {
		if (this.enabled) return;
		this.enabled = true;
		if (this.connectRunning) return;
		console.log('bot connect', this.alias);
		this.connectRunning = true;
		this.bot.connect().then(
			() => {
				console.log('bot connect ok', this.alias);
				this.connectRunning = false;
				if (!this.enabled) {
					this.disable();
				}
			},
			(e) => {
				console.error('bot connect error', this.alias, e);
				this.lastBotError = 'connect: ' + e;
				this.connectRunning = false;
				if (this.enabled) {
					// Eris has already retried as appropriate, but failed. this isn't the
					// client's fault. but telling them about this is the best we can do
					this.enabled = false;
					this.lastDisableReason = 'connect failed: ' + e;
				}
			}
		);
	}

	disable() {
		if (!this.enabled) return;
		this.enabled = false;
		if (this.connectRunning) return;
		console.log('bot disconnect', this.alias);
		this.bot.disconnect();
	}

	applySettings(token, intents, criteria, dst, clientSecret) {
		if (token !== this.token || intents !== this.intents) {
			// disconnect to open a new session with new intents and to purge Eris's snapshot of
			// the token
			this.lastDisableReason = 'token and/or intents changed';
			this.disable();
			// even if we're stuck with `connectRunning`, we _shoooould_ be fine, because Eris
			// snapshots the token in the same task as the connect promise would resolve, and
			// `applySettings` _should_ be called from a separate task. the intents should be
			// accessed even later, after the shards connect
		}
		this.token = token;
		this.bot.token = token;
		this.intents = intents;
		this.bot.options.intents = intents;

		if (!jsonEquals(criteria, this.criteria)) {
			this.match = null;
		}
		this.criteria = criteria;

		if (dst !== this.dst || clientSecret !== this.clientSecret) {
			if (this.ws) {
				this.ws.close();
			}
		}
		this.dst = dst;
		this.clientSecret = clientSecret;

		// the current model is if you try to change your settings, you **always** get a chance to
		// connect. if this turns out to be abused, we should add some prevalidation
		this.enable();
	}

	cleanup() {
		console.log('relay cleanup', this.alias);
		this.lastDisableReason = 'cleaning up';
		this.disable();
		clearTimeout(this.sleepTimeout);
		if (this.ws) {
			this.ws.close();
		}
	}
}

const relays = new Map();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.get('/relays', (req, res) => {
	const result = {};
	for (const [alias, relay] of relays) {
		const shard = relay.bot.shards.get(0);
		result[alias] = {
			enabled: relay.enabled,
			lastDisableReason: relay.lastDisableReason,
			connectRunning: relay.connectRunning,
			numQueuedEvents: relay.queuedEvents.length,
			lastWSError: relay.lastWSError,
			wsReadyState: relay.ws.readyState,
			botShardStatus: shard ? shard.status : '(no shard)',
		};
	}
	res.json(result);
});
app.put('/relays/:alias', (req, res) => {
	const alias = '' + req.params.alias;
	const token = '' + req.body.token;
	const intents = +req.body.intents;
	const criteria = req.body.criteria;
	const dst = '' + req.body.dst;
	const newClientSecret = '' + req.body.clientSecret;

	let relay = relays.get(alias);
	if (relay) {
		const authLine = '' + req.headers.authorization;
		const clientSecret = Buffer.from(authLine.replace('Basic ', ''), 'base64').toString('utf8');
		// todo: constant-time compare this
		if (clientSecret !== relay.clientSecret) {
			res.status(401).end();
			return;
		}
	} else {
		relay = new Relay(alias);
		relays.set(alias, relay);
	}

	relay.applySettings(token, intents, criteria, dst, newClientSecret);

	res.end();
});
app.post('/relays/disable', (req, res) => {
	const alias = '' + req.params.alias;
	const authLine = '' + req.headers.authorization;
	const clientSecret = Buffer.from(authLine.replace('Basic ', ''), 'base64').toString('utf8');

	let relay = relays.get(alias);
	if (!relay) {
		res.status(404).end();
		return;
	}
	// todo: constant-time compare this
	if (clientSecret !== relay.clientSecret) {
		res.status(401).end();
		return;
	}

	relay.disable();

	res.end();
});
app.delete('/relays/:alias', (req, res) => {
	const alias = '' + req.params.alias;
	const authLine = '' + req.headers.authorization;
	const clientSecret = Buffer.from(authLine.replace('Basic ', ''), 'base64').toString('utf8');

	let relay = relays.get(alias);
	if (!relay) {
		res.status(404).end();
		return;
	}
	// todo: constant-time compare this
	if (clientSecret !== relay.clientSecret) {
		res.status(401).end();
		return;
	}

	relay.cleanup();
	relays.delete(alias);

	res.end();
});
app.listen(process.env.PORT, () => {
	console.log('listening');
});

// %%%
// const config = require('../config');
// const relay = new Relay(config.alias);
// relay.applySettings(config.token, config.intents, config.criteria, config.dst, config.clientSecret);

// const rs = require('repl').start();
// rs.context.relay = relay;
// rs.on('exit', () => {
// 	relay.cleanup();
// });
