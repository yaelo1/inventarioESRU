# Inventario ESRU / FAMMA

Sistema web interno para la custodia y operación del inventario de piezas de la Colección Nacimiento. Organiza las piezas por pasaje y permite controlar su resguardo, exhibición, préstamo entre pasajes, devolución y estado de conservación.

## Funcionalidades

- Inventario visual agrupado por pasajes.
- Búsqueda por pieza, código, registro y pasaje.
- Estados de presencia: en caja, en vitrina, prestada y en restauración.
- Conservación y alertas de restauración.
- Preparación, salida, montaje y desmontaje de exhibiciones.
- Préstamos exclusivamente entre pasajes, con fechas previstas y reales de devolución.
- Historial de movimientos y responsables.
- Fotografías de piezas y pasajes con miniaturas optimizadas.
- Catálogo independiente de vitrinas, medidas y ubicación física.
- Asignación de uno o varios pasajes por vitrina, con un máximo de una vitrina por pasaje.
- Usuarios con roles, contraseña temporal y cambio obligatorio en el primer acceso.
- Administración, desactivación, reactivación y eliminación de cuentas.

## Tecnologías

- Node.js 22 y Express 5.
- SQLite mediante `better-sqlite3`.
- HTML, CSS y JavaScript sin framework en el frontend.
- Sharp para validación y optimización de imágenes.
- Docker Compose y Nginx para despliegue.

## Estructura principal

```text
inventarioESRU/
├── deploy/                 # Plantilla de Nginx
├── frontend/               # CSS, JavaScript, componentes y uploads
├── scripts/                # Seed, administrador, respaldos y optimización
├── src/
│   ├── config/             # Entorno, SQLite y subida de archivos
│   ├── database/           # Inicialización y migraciones
│   ├── middleware/         # Autenticación y autorización
│   ├── models/             # Acceso a datos
│   ├── routes/             # Endpoints REST
│   └── services/           # Reglas de negocio
├── tests/                  # Pruebas unitarias, integración y regresión
├── index.html              # Entrada de la aplicación
├── schema.sql              # Esquema de referencia
├── server.js               # Arranque del servidor
├── compose.yaml
└── Dockerfile
```

## Requisitos

- Git.
- Node.js 22 LTS con npm, o Docker con el complemento Compose.
- Aproximadamente 5 GB libres si se va a instalar el inventario actual con todos sus originales.
- Un dominio y certificado HTTPS para producción.

## Descargar e instalar

```bash
git clone https://github.com/yaelo1/inventarioESRU.git
cd inventarioESRU
npm ci
cp .env.example .env
npm test
npm start
```

La aplicación estará en `http://localhost:3000`, salvo que se cambie `PORT` en `.env`.

Genera un secreto local y colócalo como `SESSION_SECRET` en `.env`:

```bash
openssl rand -hex 32
```

## Base de datos e imágenes

El repositorio **no incluye** `inventario.sqlite` ni `frontend/uploads/`. Esto evita publicar información operativa, cuentas y varios gigabytes de fotografías en GitHub.

Para desplegar el inventario actual, la persona responsable debe recibir por un canal privado:

```text
inventario.sqlite
frontend/uploads/
```

Ambos deben copiarse en la raíz y ruta indicadas antes de iniciar la aplicación. Deben respaldarse y restaurarse siempre juntos. No ejecutes `npm run seed` sobre esta base porque contiene el inventario existente.

Para una instalación completamente nueva y vacía, el servidor crea el esquema al arrancar. Después se crea el primer administrador:

```bash
npm run create-admin -- correo@dominio.com "contraseña segura" "Nombre del administrador"
```

`npm run seed` se reserva para cargar `data/seed-inventory.json` en una base nueva cuando realmente se requieran esos datos iniciales.

El catálogo inicial de vitrinas fue normalizado desde la hoja museográfica y está en `data/showcases.json`. Después de cargar los pasajes en una base nueva, impórtalo con:

```bash
npm run import-showcases
```

El comando puede repetirse sin duplicar vitrinas y no reemplaza asignaciones que ya hayan sido modificadas desde la aplicación.

## Variables de entorno

- `.env.example`: configuración de desarrollo local.
- `.env.production.example`: plantilla para producción.
- `.env` y `.env.production`: contienen secretos y no deben subirse a GitHub.

En producción es obligatorio reemplazar `SESSION_SECRET` por un valor aleatorio de al menos 32 caracteres. `TRUST_PROXY=1` solo debe utilizarse cuando Nginx u otro proxy confiable esté frente a Node.

## Pruebas

```bash
npm test
```

La suite cubre autenticación, permisos, contraseñas temporales, préstamos, montaje, devolución, restauración y procesamiento de imágenes. Las pruebas usan bases temporales y no modifican `inventario.sqlite`.

## Despliegue con Docker

1. Copia los datos privados, si se utilizará el inventario actual.
2. Crea la configuración de producción:

```bash
cp .env.production.example .env.production
openssl rand -hex 32
```

3. Coloca el valor generado en `SESSION_SECRET` y revisa las demás variables.
4. Si será una base nueva, crea primero el archivo persistente:

```bash
touch inventario.sqlite
mkdir -p frontend/uploads
```

5. Construye y levanta el servicio:

```bash
docker compose build
docker compose run --rm inventario npm run import-showcases
docker compose up -d
docker compose ps
```

Compose publica Node únicamente en `127.0.0.1:3000`. Debe colocarse Nginx o un proxy equivalente delante de la aplicación. La plantilla está en `deploy/nginx.conf`; hay que sustituir el dominio de ejemplo y configurar HTTPS.

## Verificación del servidor

```bash
curl http://127.0.0.1:3000/api/health
docker compose logs --tail=100 inventario
```

La respuesta de salud debe contener `"ok":true` y `"database":"ready"`. Después se debe comprobar manualmente el login, inventario, montaje, préstamos, movimientos, alertas, usuarios y subida/ampliación de imágenes.

## Respaldos y actualizaciones

Antes de actualizar:

```bash
npm run backup
```

Ese comando crea una copia consistente de SQLite en `backups/`. El directorio `frontend/uploads/` debe respaldarse por separado, con la misma fecha, y conservarse junto con la copia de la base.

Para actualizar el código:

```bash
git pull
npm ci --omit=dev
npm test
npm run import-showcases
docker compose build
docker compose up -d
```

La guía operativa completa está en [DEPLOYMENT.md](DEPLOYMENT.md).

## Seguridad

- No publiques `.env`, `.env.production`, SQLite, respaldos ni fotografías.
- Expón la aplicación únicamente mediante HTTPS.
- Limita el acceso al servidor y conserva respaldos fuera de él.
- Revisa periódicamente `npm audit` y los logs del servicio.
- No uses datos simulados como información real sin validarlos primero.

## Autoría

Proyecto desarrollado y mantenido por [yaelo1](https://github.com/yaelo1). Esta documentación no atribuye coautoría a terceros.
