const db = require('../config/database');

function create(data) {
  db.prepare(`
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES (@user_id, @token_hash, @expires_at)
  `).run(data);
}

function findValid(tokenHash) {
  return db.prepare(`
    SELECT s.id, s.expires_at,
      u.id AS user_id, u.name, u.email, u.role, u.active, u.must_change_password
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.active = 1
  `).get(tokenHash);
}

function remove(tokenHash) {
  db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash);
}

function removeForUser(userId) {
  db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
}

function removeExpired() {
  db.prepare('DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
}

module.exports = { create, findValid, remove, removeForUser, removeExpired };
