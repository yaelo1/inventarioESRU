const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-auth-'));
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');

const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const createApp = require('../src/app');
const authService = require('../src/services/authService');
const userService = require('../src/services/userService');

let server;
let baseUrl;
let admin;
let temporaryUser;

before(async () => {
  initDatabase(db);
  admin = userService.createUser({
    name: 'Administradora',
    email: 'admin@example.test',
    password: 'AdminInicial123',
    role: 'admin'
  }, { mustChangePassword: false });
  temporaryUser = userService.createUser({
    name: 'Operadora temporal',
    email: 'operador@example.test',
    password: 'Temporal123',
    role: 'operador'
  });

  server = http.createServer(createApp());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('unitaria: las contraseñas se almacenan con hash y se verifican', () => {
  const hash = authService.hashPassword('ClaveSegura123');
  assert.notEqual(hash, 'ClaveSegura123');
  assert.equal(authService.verifyPassword('ClaveSegura123', hash), true);
  assert.equal(authService.verifyPassword('ClaveIncorrecta', hash), false);
  assert.throws(
    () => authService.validatePassword('corta'),
    (error) => error.status === 400 && error.message.includes('8 caracteres')
  );
});

test('unitaria: una cuenta nueva queda marcada con contraseña temporal', () => {
  assert.equal(temporaryUser.must_change_password, 1);
  assert.equal(admin.must_change_password, 0);
  assert.throws(
    () => authService.login({ email: admin.email, password: 'incorrecta' }),
    (error) => error.status === 401
  );
});

test('integración: el acceso protegido exige sesión y cambio de contraseña temporal', async () => {
  const anonymous = await fetch(`${baseUrl}/pieces`);
  assert.equal(anonymous.status, 401);

  const loginResponse = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'Temporal123' }
  });
  assert.equal(loginResponse.response.status, 200);
  assert.equal(loginResponse.body.user.must_change_password, 1);

  const blocked = await api('/pieces', { cookie: loginResponse.cookie });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const wrongCurrent = await api('/auth/password', {
    method: 'PATCH',
    cookie: loginResponse.cookie,
    body: {
      current_password: 'equivocada',
      password: 'PersonalNueva123',
      password_confirmation: 'PersonalNueva123'
    }
  });
  assert.equal(wrongCurrent.response.status, 400);

  const changed = await api('/auth/password', {
    method: 'PATCH',
    cookie: loginResponse.cookie,
    body: {
      current_password: 'Temporal123',
      password: 'PersonalNueva123',
      password_confirmation: 'PersonalNueva123'
    }
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.user.must_change_password, 0);

  const expiredSession = await api('/auth/me', { cookie: loginResponse.cookie });
  assert.equal(expiredSession.response.status, 401);

  const oldPassword = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'Temporal123' }
  });
  assert.equal(oldPassword.response.status, 401);

  const newLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'PersonalNueva123' }
  });
  assert.equal(newLogin.response.status, 200);
  assert.equal(newLogin.body.user.must_change_password, 0);
  const protectedRequest = await api('/pieces', { cookie: newLogin.cookie });
  assert.equal(protectedRequest.response.status, 200);
});

test('sistema: el admin restablece una clave y vuelve a exigir el primer acceso', async () => {
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'AdminInicial123' }
  });
  assert.equal(adminLogin.response.status, 200);

  const reset = await api(`/users/${temporaryUser.id}/password`, {
    method: 'PATCH',
    cookie: adminLogin.cookie,
    body: { password: 'TemporalReset123' }
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.must_change_password, 1);

  const resetLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'TemporalReset123' }
  });
  assert.equal(resetLogin.response.status, 200);
  assert.equal(resetLogin.body.user.must_change_password, 1);
});

test('integración: desactivar un usuario revoca su sesión y bloquea su acceso', async () => {
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'AdminInicial123' }
  });
  const userLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'TemporalReset123' }
  });

  const deactivated = await api(`/users/${temporaryUser.id}`, {
    method: 'DELETE',
    cookie: adminLogin.cookie
  });
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.body.active, 0);

  const revokedSession = await api('/auth/me', { cookie: userLogin.cookie });
  assert.equal(revokedSession.response.status, 401);
  const rejectedLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'TemporalReset123' }
  });
  assert.equal(rejectedLogin.response.status, 401);
});

test('integración: un usuario puede reactivarse o eliminarse sólo después de desactivarlo', async () => {
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: admin.email, password: 'AdminInicial123' }
  });

  const reactivated = await api(`/users/${temporaryUser.id}/reactivate`, {
    method: 'PATCH',
    cookie: adminLogin.cookie
  });
  assert.equal(reactivated.response.status, 200);
  assert.equal(reactivated.body.active, 1);

  const restoredLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: temporaryUser.email, password: 'TemporalReset123' }
  });
  assert.equal(restoredLogin.response.status, 200);

  const activeDeletion = await api(`/users/${temporaryUser.id}/permanent`, {
    method: 'DELETE',
    cookie: adminLogin.cookie
  });
  assert.equal(activeDeletion.response.status, 409);

  const deactivated = await api(`/users/${temporaryUser.id}`, {
    method: 'DELETE',
    cookie: adminLogin.cookie
  });
  assert.equal(deactivated.response.status, 200);

  const deleted = await api(`/users/${temporaryUser.id}/permanent`, {
    method: 'DELETE',
    cookie: adminLogin.cookie
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.ok, true);

  const users = await api('/users', { cookie: adminLogin.cookie });
  assert.equal(users.body.some((user) => user.id === temporaryUser.id), false);
});

test('regresión de permisos: consulta puede leer pero no modificar inventario', async () => {
  const viewer = userService.createUser({
    name: 'Sólo consulta',
    email: 'consulta@example.test',
    password: 'ConsultaSegura123',
    role: 'consulta'
  }, { mustChangePassword: false });
  const viewerLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: viewer.email, password: 'ConsultaSegura123' }
  });
  const read = await api('/pieces', { cookie: viewerLogin.cookie });
  assert.equal(read.response.status, 200);
  const write = await api('/passages', {
    method: 'POST',
    cookie: viewerLogin.cookie,
    body: { testament: 'AT', number: 99, name: 'No permitido' }
  });
  assert.equal(write.response.status, 403);
});

async function api(route, options = {}) {
  const headers = {};
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie');
  return {
    response,
    body,
    cookie: setCookie ? setCookie.split(';')[0] : null
  };
}
