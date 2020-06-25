import assert from 'assert';

import eris from 'eris';

import config from './config';

function interceptEvent(packet) {
	console.log('dcc interceptEvent', packet);
	switch (packet.t) {
	case 'RESUMED':
		eris.Shard.prototype.wsEvent.call(this, packet);
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
		eris.Shard.prototype.wsEvent.call(this, redactedPacket);
    }

    
}

const bot = new eris.Client(config.token);

bot.on('debug', (message, id) => {
	console.log('bot debug', message, id);
});
bot.on('warn', (message, id) => {
	console.warn('bot warn', message, id);
});
bot.on('error', (err, id) => {
	console.warn('bot error', err, id);
});

const preparedShards = new WeakSet();
bot.on('connect', (id) => {
	console.log('bot connect', id);
	const shard = bot.shards.get(id);
	if (preparedShards.has(shard)) return;
	preparedShards.add(shard);
	console.log('dcc preparing', id);
	// detect if a later version of Eris binds this method
	assert.strictEqual(shard.wsEvent, eris.Shard.prototype.wsEvent);
	shard.wsEvent = interceptEvent;
});

bot.on('ready', () => {
	console.log('bot ready');
})

bot.connect().then(() => {
	console.log('bot connect ok');
}).catch((e) => {
	console.error(e);
});
