# Despliegue

## Entrega mínima

El servidor necesita el código del proyecto, `inventario.sqlite`, `frontend/uploads/` y un archivo `.env.production` creado a partir de `.env.production.example`. No se requiere `inventario_nacimiento_FAMMA_2_10_7_3.html` para ejecutar la aplicación ni debe ejecutarse el seed sobre la base en uso.

La base y las imágenes forman una sola unidad de respaldo. Restaurar solo una de las dos puede dejar fichas sin fotografía o fotografías sin referencia.

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

## Comprobación posterior

1. Abre `/api/health`; debe responder `ok: true` y `database: ready`.
2. Inicia sesión y confirma Inventario, Montaje, Préstamos, Movimientos, Alertas y Usuarios.
3. Sube una imagen de prueba y verifica miniatura y ampliación.
4. Registra y devuelve un préstamo de prueba, validando fechas, pasajes y conservación.
5. Revisa espacio en disco, memoria y logs del proceso.

## Respaldo

`npm run backup` crea una copia consistente de SQLite en `BACKUP_DIR` o `backups/`. Respalda también `frontend/uploads/` por separado y con la misma fecha. Define retención automática y guarda ambas copias fuera del servidor.
