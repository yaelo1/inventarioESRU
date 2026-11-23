# Actualización de la instalación existente

Esta guía corresponde al servidor que ya tiene una versión anterior del Inventario ESRU / FAMMA funcionando con su propia base de datos y fotografías.

## Qué se actualiza

El repositorio contiene los cambios de aplicación y las migraciones necesarias para incorporar:

- peso de las piezas;
- reportes de daños y restauración;
- exportación CSV y PDF con fotografías;
- rol restringido de curadora;
- mejoras de interfaz y seguimiento.

La aplicación adapta automáticamente la estructura de la SQLite existente durante el primer arranque. No es necesario editar tablas ni ejecutar SQL manualmente.

## Datos que deben conservarse

La actualización debe trabajar sobre los datos que ya existen en el servidor:

```text
inventario.sqlite
frontend/uploads/
```

No se debe reemplazar `inventario.sqlite` por otra copia si la base del servidor ya contiene la información validada por Fátima.

## Antes de comenzar

Confirmar que:

1. Los usuarios dejaron de capturar información durante la actualización.
2. Se tiene acceso al repositorio y al servidor.
3. Existe espacio suficiente para respaldar la SQLite y las fotografías.
4. Se conoce si la instalación utiliza Docker Compose o Node.js directamente.

## Actualización con Docker Compose

Desde el directorio del proyecto en el servidor:

### 1. Detener la aplicación

```bash
docker compose down
```

Detenerla antes del respaldo evita que SQLite conserve operaciones pendientes en archivos WAL.

### 2. Respaldar los datos

```bash
mkdir -p backups
cp inventario.sqlite backups/inventario-antes-actualizacion.sqlite
tar -czf backups/uploads-antes-actualizacion.tar.gz frontend/uploads/
```

Comprobar que ambos archivos existen y tienen un tamaño razonable:

```bash
ls -lh backups/
```

### 3. Descargar el código nuevo

```bash
git pull origin main
```

### 4. Reconstruir y probar

```bash
docker compose build
docker compose run --rm inventario npm test
```

Las pruebas utilizan bases temporales y no modifican `inventario.sqlite`.

### 5. Iniciar la versión nueva

```bash
docker compose up -d
docker compose ps
```

Durante este primer arranque se aplican automáticamente las migraciones sobre la base existente.

### 6. Verificar salud y logs

```bash
curl http://127.0.0.1:3000/api/health
docker compose logs --tail=100 inventario
```

La comprobación de salud debe responder con `"ok": true` y `"database": "ready"`.

## Actualización con Node.js y systemd

El nombre real del servicio puede variar. Sustituir `inventario` cuando corresponda.

```bash
sudo systemctl stop inventario

mkdir -p backups
cp inventario.sqlite backups/inventario-antes-actualizacion.sqlite
tar -czf backups/uploads-antes-actualizacion.tar.gz frontend/uploads/

git pull origin main
npm ci --omit=dev
npm test

sudo systemctl start inventario
sudo systemctl status inventario
curl http://127.0.0.1:3000/api/health
```

El servicio debe arrancar `server.js` con las variables de producción configuradas.

## Comprobación funcional

Después de iniciar:

1. Iniciar sesión con una cuenta administradora existente.
2. Confirmar que aparecen Inventario, Vitrinas, Montaje, Préstamos, Movimientos, Alertas y Reportes de daños.
3. Abrir una pieza y comprobar el campo Peso con unidades `g` y `kg`.
4. Abrir Reportes de daños y descargar una prueba en CSV y PDF.
5. Crear una cuenta de prueba con rol Curadora y confirmar que puede dar seguimiento a reportes sin editar el inventario general.
6. Verificar que las fotografías existentes continúan visibles.

## Comandos que no deben ejecutarse

En esta actualización no ejecutar:

```bash
npm run seed
npm run adopt-client-db
npm run import-showcases
```

Tampoco se deben copiar a producción archivos `inventario.sqlite-wal` o `inventario.sqlite-shm`.

## Regresar a la versión anterior

Si la validación falla:

1. Detener la aplicación.
2. Conservar la base fallida para diagnóstico con otro nombre.
3. Restaurar la SQLite y uploads respaldados.
4. Volver al commit anterior del repositorio.
5. Reconstruir e iniciar nuevamente.

Ejemplo para restaurar los datos:

```bash
cp backups/inventario-antes-actualizacion.sqlite inventario.sqlite
rm -rf frontend/uploads
tar -xzf backups/uploads-antes-actualizacion.tar.gz
```

La eliminación de `frontend/uploads` sólo debe realizarse durante una restauración confirmada y contando con el archivo de respaldo validado.

## Resultado esperado

La actualización conserva piezas, pasajes, movimientos, préstamos, usuarios, vitrinas, imágenes y contraseñas. Únicamente amplía la estructura existente y habilita las nuevas funciones.

