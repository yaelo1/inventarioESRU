const db = require('../src/config/database');
const initDatabase = require('../src/database/init');
const userService = require('../src/services/userService');

initDatabase(db);

const [, , email, password, ...nameParts] = process.argv;
const name = nameParts.join(' ') || 'Administrador';

if (!email || !password) {
  console.error('Uso: npm run create-admin -- correo@dominio.com "contraseña" "Nombre"');
  process.exit(1);
}

try {
  const user = userService.createUser({
    name,
    email,
    password,
    role: 'admin',
  }, { mustChangePassword: false });
  console.log(`Admin creado: ${user.email} (${user.name})`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
