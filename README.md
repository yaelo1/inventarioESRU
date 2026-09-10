# Inventario FAMMA

Sistema interno de custodia de piezas organizado por pasajes. Las piezas se resguardan, se seleccionan para montaje, se prestan entre pasajes y se devuelven con revisión de conservación.

## Desarrollo

```bash
npm install
cp .env.example .env
npm start
```

La aplicación queda disponible en el puerto configurado con `PORT`.

Antes del primer uso crea un administrador:

```bash
npm run create-admin -- tu-correo@dominio.com "tu contraseña segura" "Tu nombre"
```

La contraseña debe tener al menos 8 caracteres. Después entra con ese correo desde la pantalla de login. Un admin puede crear más usuarios desde la sección `Usuarios`.

Las cuentas creadas desde `Usuarios` reciben una contraseña temporal y deben reemplazarla al primer acceso. El administrador también puede restablecer una contraseña; eso cierra las sesiones abiertas de esa cuenta y vuelve a exigir el cambio. Cada usuario puede cambiar posteriormente su propia contraseña desde `Mi cuenta`.

Para cargar el inventario inicial en una base completamente vacía:

```bash
npm run seed
```

El arranque normal no ejecuta el seed ni reemplaza información existente.

## Verificación

```bash
npm test
```

Las pruebas usan una base temporal y cubren preparación de salida, préstamo entre pasajes, montaje secuencial, cierre, devolución y restauración.

Antes de desplegar o actualizar producción consulta [DEPLOYMENT.md](DEPLOYMENT.md).

## Persistencia

Para respaldar el sistema deben conservarse juntos el archivo definido en `DB_PATH` y el directorio `UPLOAD_DIR`. En producción ambos deben vivir en almacenamiento persistente. La aplicación debe publicarse detrás de HTTPS y un mecanismo de acceso para personal autorizado.
