# Despliegue

## Entrega mínima

El servidor necesita el código del proyecto, `inventario.sqlite`, `frontend/uploads/` y un archivo `.env.production` creado a partir de `.env.production.example`. No se requiere `inventario_nacimiento_FAMMA_2_10_7_3.html` para ejecutar la aplicación ni debe ejecutarse el seed sobre la base en uso.

La base y las imágenes forman una sola unidad de respaldo. Restaurar solo una de las dos puede dejar fichas sin fotografía o fotografías sin referencia. La aplicación puede arrancar sin las imágenes nuevas, pero mostrará `Sin imagen` en las fichas cuyos archivos no estén disponibles.

## Preparación

1. Instala Node.js 22 LTS o Docker con Compose.
2. Genera `SESSION_SECRET` con `openssl rand -hex 32` y no lo compartas en el repositorio.
3. Configura `PORT`, `DB_PATH`, los directorios de imágenes y `TRUST_PROXY` en `.env.production`.
4. Conserva `TRUST_PROXY=1` únicamente cuando Nginx u otro proxy confiable esté delante de Node.
5. Antes de cada actualización ejecuta `npm run backup` y respalda también `frontend/uploads/`.

## Instalación directa

```bash
npm ci --omit=dev
cp .env.production.example .env.production
node --env-file=.env.production server.js
```

El gestor de procesos del servidor, por ejemplo systemd, debe arrancar `node server.js` con las variables de `.env.production`, reiniciarlo si falla y enviar `SIGTERM` al detenerlo.

## Docker Compose

```bash
cp .env.production.example .env.production
docker compose build
docker compose up -d
docker compose ps
```

`compose.yaml` publica Node solamente en `127.0.0.1` y monta `inventario.sqlite` y `frontend/uploads/` como datos persistentes. El usuario del contenedor debe tener permiso de escritura sobre ambos. Ajusta `APP_PORT` cuando el puerto 3000 ya esté ocupado.

## Proxy y HTTPS

`deploy/nginx.conf` es una plantilla. Sustituye `inventario.ejemplo.org`, instala el certificado TLS y redirige HTTP a HTTPS antes de abrir el sistema a usuarios. El tamaño máximo de Nginx debe ser igual o mayor que `UPLOAD_MAX_BYTES`.

## Migración de imágenes existentes

La migración conserva los originales y crea copias WebP para pantalla y miniaturas:

```bash
npm run backup
npm run optimize-images
npm test
```

Puede ejecutarse otra vez: reutiliza las variantes ya generadas. No borres originales hasta validar el inventario y contar con un respaldo externo.

## Adopción de una base modificada

Con la aplicación detenida, coloca la SQLite recibida fuera de la ruta activa y ejecuta:

```bash
npm test
npm run adopt-client-db -- ruta/a/base-recibida.sqlite
```

El proceso realiza estas acciones:

1. Valida la integridad del archivo recibido sin modificarlo.
2. Crea una copia operativa y aplica las migraciones del esquema.
3. Conserva piezas, movimientos, préstamos, montajes, vitrinas y usuarios de la base recibida.
4. Reutiliza imágenes anteriores únicamente cuando la nueva ruta apunta a un archivo ausente.
5. Respalda la base anterior en `backups/` y genera `client-upload-manifest-*.json`.

Si la carpeta `uploads` modificada todavía no está disponible, conserva ese manifiesto. Cada entrada contiene la ruta solicitada por la base recibida y la ruta temporal usada, si existe. Las fichas sin alternativa quedan operativas pero sin fotografía hasta completar la entrega.

Después de la adopción ejecuta:

```bash
npm start
curl http://127.0.0.1:3000/api/health
```

Comprueba también el acceso de un administrador y de una curadora, el campo Peso en una pieza y la pestaña Reportes de daños con sus descargas CSV y PDF.

### Adopción con Docker Compose

La SQLite recibida no debe reemplazar directamente la base activa ni agregarse a la imagen Docker. Con el servicio detenido, monta el archivo recibido como solo lectura y ejecuta:

```bash
docker compose down
docker compose build
docker compose run --rm \
  -v /ruta/absoluta/inventario-recibido.sqlite:/incoming.sqlite:ro \
  inventario npm run adopt-client-db -- /incoming.sqlite
docker compose up -d
docker compose ps
```

El comando usa `/data/inventario.sqlite` como destino, `/data/uploads` para recuperar fotografías anteriores y `/data/backups` para conservar el respaldo y el manifiesto. Antes de ejecutarlo deben existir `inventario.sqlite`, `frontend/uploads/` y `backups/`, todos con permisos de escritura para el usuario del contenedor.

## Catálogo de vitrinas

La primera actualización que incluya el módulo `Vitrinas` debe importar el catálogo normalizado:

```bash
npm run backup
npm run import-showcases
```

Con Docker Compose:

```bash
docker compose run --rm inventario npm run import-showcases
```

El proceso crea o actualiza las fichas físicas y asigna únicamente pasajes que todavía no tengan vitrina. El archivo Excel original no es necesario en el servidor; la fuente versionada está en `data/showcases.json`.

## Comprobación posterior

1. Abre `/api/health`; debe responder `ok: true` y `database: ready`.
2. Inicia sesión y confirma Inventario, Vitrinas, Montaje, Préstamos, Movimientos, Alertas, Reportes de daños y Usuarios.
3. Sube una imagen de prueba y verifica miniatura y ampliación.
4. Registra y devuelve un préstamo de prueba, validando fechas, pasajes y conservación.
5. Revisa espacio en disco, memoria y logs del proceso.

## Respaldo

`npm run backup` crea una copia consistente de SQLite en `BACKUP_DIR` o `backups/`. Respalda también `frontend/uploads/` por separado y con la misma fecha. Define retención automática y guarda ambas copias fuera del servidor.
