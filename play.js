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

const CRITERIA = {
	// corresponds to what we declared in the gateway, but further filters out messages like
	// READY, CHANNEL_CREATE, and MESSAGE_UPDATE
	t: 'MESSAGE_CREATE',
	// ignore messages from self and other bots
	$not: {'d.author.bot': true},
	$or: [
		// DMs
		{'d.guild_id': {$exists: false}},
		// mentions
		{'d.mentions': {$elemMatch: {id: '725161345627979808'}}},
		// prefix
		{'d.content': {$regex: '^cookout\\b'}},
	],
};

const match = sift(CRITERIA, MATCH_OPTIONS);

const pReady = {"t":"READY","s":1,"op":0,"d":{"v":6,"user_settings":{},"user":{"verified":true,"username":"DC Chartreuse","mfa_enabled":false,"id":"725161345627979808","flags":0,"email":null,"discriminator":"0636","bot":true,"avatar":null},"session_id":"38cf57c2aafdf5222a3940d0ebb3ab95","relationships":[],"private_channels":[],"presences":[],"guilds":[{"unavailable":true,"id":"725220905646555146"}],"application":{"id":"725161345627979808","flags":0},"_trace":["[\"gateway-prd-main-j239\",{\"micros\":184406,\"calls\":[\"discord-sessions-prd-1-36\",{\"micros\":176777,\"calls\":[\"start_session\",{\"micros\":173912,\"calls\":[\"api-prd-main-pzv1\",{\"micros\":153749,\"calls\":[\"get_user\",{\"micros\":12109},\"add_authorized_ip\",{\"micros\":4349},\"get_guilds\",{\"micros\":14691},\"coros_wait\",{\"micros\":3}]}]},\"guilds_connect\",{\"micros\":2,\"calls\":[]},\"presence_connect\",{\"micros\":2155,\"calls\":[]}]}]}]"]}};
const pIrrelevant = {"t":"MESSAGE_CREATE","s":2,"op":0,"d":{"type":0,"tts":false,"timestamp":"2020-06-28T01:31:47.224000+00:00","pinned":false,"nonce":"726610768992141312","mentions":[],"mention_roles":[],"mention_everyone":false,"member":{"roles":[],"mute":false,"joined_at":"2020-06-24T05:28:57.874000+00:00","hoisted_role":null,"deaf":false},"id":"726610769499783251","flags":0,"embeds":[],"edited_timestamp":null,"content":"d","channel_id":"725220905646555149","author":{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null},"attachments":[],"guild_id":"725220905646555146"}};
const pMention = {"t":"MESSAGE_CREATE","s":3,"op":0,"d":{"type":0,"tts":false,"timestamp":"2020-06-28T01:32:11.421000+00:00","pinned":false,"nonce":"726610870569795584","mentions":[{"username":"DC Chartreuse","public_flags":0,"member":{"roles":[],"mute":false,"joined_at":"2020-06-24T05:36:11.843000+00:00","hoisted_role":null,"deaf":false},"id":"725161345627979808","discriminator":"0636","bot":true,"avatar":null}],"mention_roles":[],"mention_everyone":false,"member":{"roles":[],"mute":false,"joined_at":"2020-06-24T05:28:57.874000+00:00","hoisted_role":null,"deaf":false},"id":"726610870989488188","flags":0,"embeds":[],"edited_timestamp":null,"content":"<@!725161345627979808> e","channel_id":"725220905646555149","author":{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null},"attachments":[],"guild_id":"725220905646555146"}};
const pNewDM = {"t":"CHANNEL_CREATE","s":4,"op":0,"d":{"type":1,"recipients":[{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null}],"last_message_id":"726610959228993628","id":"725222856266481664"}};
const pDM = {"t":"MESSAGE_CREATE","s":5,"op":0,"d":{"type":0,"tts":false,"timestamp":"2020-06-28T01:32:32.459000+00:00","pinned":false,"nonce":"726610958851506176","mentions":[],"mention_roles":[],"mention_everyone":false,"id":"726610959228993628","flags":0,"embeds":[],"edited_timestamp":null,"content":"f","channel_id":"725222856266481664","author":{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null},"attachments":[]}};
const pPrefix = {"t":"MESSAGE_CREATE","s":6,"op":0,"d":{"type":0,"tts":false,"timestamp":"2020-06-28T01:37:36.375000+00:00","pinned":false,"nonce":"726612233513074688","mentions":[],"mention_roles":[],"mention_everyone":false,"member":{"roles":[],"mute":false,"joined_at":"2020-06-24T05:28:57.874000+00:00","hoisted_role":null,"deaf":false},"id":"726612233945350224","flags":0,"embeds":[],"edited_timestamp":null,"content":"cookout who","channel_id":"725220905646555149","author":{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null},"attachments":[],"guild_id":"725220905646555146"}};
const pEdit = {"t":"MESSAGE_UPDATE","s":7,"op":0,"d":{"type":0,"tts":false,"timestamp":"2020-06-28T01:37:36.375000+00:00","pinned":false,"mentions":[],"mention_roles":[],"mention_everyone":false,"member":{"roles":[],"mute":false,"joined_at":"2020-06-24T05:28:57.874000+00:00","hoisted_role":null,"deaf":false},"id":"726612233945350224","flags":0,"embeds":[],"edited_timestamp":"2020-06-28T01:39:35.759181+00:00","content":"!cookout who","channel_id":"725220905646555149","author":{"username":"wh","public_flags":0,"id":"466443389873815553","discriminator":"9692","avatar":null},"attachments":[],"guild_id":"725220905646555146"}};

console.log('pReady:', match(pReady));
console.log('pIrrelevant:', match(pIrrelevant));
console.log('pMention:', match(pMention));
console.log('pNewDM:', match(pNewDM));
console.log('pDM:', match(pDM));
console.log('pPrefix:', match(pPrefix));
console.log('pEdit:', match(pEdit));
