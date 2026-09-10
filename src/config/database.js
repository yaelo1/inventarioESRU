const Database = require('better-sqlite3');
const env = require('./env');

const db = new Database(env.dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

module.exports = db;
