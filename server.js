const assert = require('assert');

const eris = require('eris');
const safe_regex = require('safe-regex');
const sift = require('sift');

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

function jsonEquals(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

class Relay {
    constructor(alias) {
        this.alias = alias;

        this.token = null;
        this.intents = null;
        this.criteria = null;
        this.dst = null;

        this.enabled = false;
        this.lastDisableReason = 'never initialized';
        this.connectRunning = false;

        this.match = null;

        this.queuedEvents = [];
        this.ws = null;

        this.preparedShards = new WeakSet();
        this.bot = new eris.Client();
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
            console.log('bot shard connect', this.alias, id);
            const shard = this.bot.shards.get(id);
            if (this.preparedShards.has(shard)) return;
            this.preparedShards.add(shard);
            console.log('dcc preparing shard', this.alias, id);
            // detect if a later version of Eris binds this method
            assert.strictEqual(shard.wsEvent, eris.Shard.prototype.wsEvent);
            shard.wsEvent = (packet) => this.interceptEvent(shard, packet);
        });
        this.bot.on('shardDisconnect', (err, id) => { // %%%
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
        // todo: websocket
        const dst = this.dst;
        fetch(dst, {
            method: 'POST',
            body: packet,
        }).catch((e) => {
            console.error('sendPacket failed', this.alias, dst, e);
        });
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

    applySettings(token, intents, criteria, dst) {
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

        // todo: remove ws
        this.dst = dst;

        // the current model is if you try to change your settings, you **always** get a chance to
        // connect. if this turns out to be abused, we should add some prevalidation
        this.enable();
    }
}

// %%%
const config = require('./config');
const relay = new Relay(config.alias);
relay.applySettings(config.token, config.intents, config.criteria, config.dst);
const rs = require('repl').start();
rs.context.relay = relay;
