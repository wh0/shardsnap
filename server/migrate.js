const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('.data/omni.db');

db.serialize(() => {
	db.run(`
		CREATE TABLE relays (
			alias TEXT PRIMARY KEY,
			token TEXT,
			intents INTEGER,
			criteria TEXT,
			dst TEXT,
			client_secret TEXT
		)
	`);
});
db.close();
