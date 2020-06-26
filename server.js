const assert = require('assert');

const eris = require('eris');
const safe_regex = require('safe-regex');
const sift = require('sift');

const config = require('./config'); // %%%

const MATCH_OPTIONS = {
    operations: {
        $regex: (pattern, ownerQuery, options) => {
            if (!safe_regex(pattern)) throw new Error('"$regex" pattern too complex (dcc)');
            return sift.createEqualsOperation(new RegExp(pattern, ownerQuery.$options), ownerQuery, options);
        },
        $where: (params, ownerQuery, options) => {
            throw new Error('"$where" condition not supported (dcc)');
        },
    },
};

class Relay {
    constructor(alias, token, intents, criteria, dst) {
        this.alias = alias;
        this.token = token;
        this.intents = intents;
        this.match = this.makeMatch(criteria);
        this.dst = dst;

        this.preparedShards = new WeakSet();
        this.bot = new eris.Client(this.token, {intents: this.intents});
        this.bot.on('debug', (message, id) => {
            console.log('bot debug', this.alias, message, id);
        });
        this.bot.on('warn', (message, id) => {
            console.warn('bot warn', this.alias, message, id);
        });
        this.bot.on('error', (err, id) => {
            console.warn('bot error', this.alias, err, id);
        });
        this.bot.on('connect', (id) => {
            console.log('bot connect', this.alias, id); // %%%
            const shard = this.bot.shards.get(id);
            if (this.preparedShards.has(shard)) return;
            this.preparedShards.add(shard);
            console.log('dcc preparing shard', this.alias, id);
            // detect if a later version of Eris binds this method
            assert.strictEqual(shard.wsEvent, eris.Shard.prototype.wsEvent);
            shard.wsEvent = (packet) => this.interceptEvent(shard, packet);
        });
        this.bot.on('ready', () => {
            console.log('bot ready', this.alias);
        });

        this.connecting = false;
        this.connect();
    }

    makeMatch(criteria) {
        return sift(criteria, MATCH_OPTIONS);
    }

    interceptEvent(shard, packet) {
        console.log('dcc interceptEvent', this.alias, packet);
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

    connect() {
        console.log('bot connect', this.alias);
        this.connecting = true;
        this.bot.connect().then(() => {
            this.connecting = false;
            console.log('bot connect ok', this.alias);
        }).catch((e) => {
            this.connecting = false;
            console.error('bot connect error', this.alias, e);
        });
    }

    updateSettings(match, dst) {
        this.match = this.makeMatch(criteria);
        this.dst = dst;
    }

    updateSettingsReconnect(token, intents) {
        if (token === this.token && intents === this.intents) return;
        if (this.connecting) throw new Error('bot is connecting, we can\'t disconnect');
        // tell Eris to wipe the session ID and the shards' copies of the token. we actually will
        // reconnect though
        this.bot.disconnect({reconnect: false});
        this.token = token;
        this.bot.token = this.token;
        this.intents = intents;
        this.bot.options.intents = this.intents;
        this.connect();
    }

    offerPacket(packet) {
        if (!this.match(packet)) return;
        this.sendPacket(packet);
    }

    sendPacket(packet) {
        // todo: ws...
        fetch(this.dst, {
            method: 'POST',
        });
    }
}
