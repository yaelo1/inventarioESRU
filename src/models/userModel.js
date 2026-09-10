const db = require('../config/database');

function publicFields(user) {
  if (!user) return user;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function create(data) {
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, must_change_password)
    VALUES (@name, @email, @password_hash, @role, @must_change_password)
  `).run(data);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return publicFields(db.prepare(`
    SELECT id, name, email, password_hash, role, active, must_change_password, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(id));
}

function findByIdWithPassword(id) {
  return db.prepare(`
    SELECT id, name, email, password_hash, role, active, must_change_password, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(id);
}

function findByEmailWithPassword(email) {
  return db.prepare(`
    SELECT id, name, email, password_hash, role, active, must_change_password, created_at, updated_at
    FROM users
    WHERE email = ?
  `).get(email);
}

function list() {
  return db.prepare(`
    SELECT id, name, email, role, active, must_change_password, created_at, updated_at
    FROM users
    ORDER BY active DESC, name COLLATE NOCASE
  `).all();
}

function update(id, data) {
  db.prepare(`
    UPDATE users
    SET name = COALESCE(@name, name),
        email = COALESCE(@email, email),
        role = COALESCE(@role, role),
        active = COALESCE(@active, active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({
    id,
    name: null,
    email: null,
    role: null,
    active: null,
    ...data
  });
  return findById(id);
}

function updatePassword(id, passwordHash, mustChangePassword = 0) {
  db.prepare(`
    UPDATE users
    SET password_hash = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(passwordHash, mustChangePassword, id);
  return findById(id);
}

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1").get().total;
}

function remove(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes;
}

module.exports = {
  countAdmins,
  create,
  findByEmailWithPassword,
  findById,
  findByIdWithPassword,
  list,
  remove,
  update,
  updatePassword
};
