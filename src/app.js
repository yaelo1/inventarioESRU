const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const env = require('./config/env');
const apiRoutes = require('./routes');
const { attachUser, requireAuth } = require('./middleware/auth');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-origin' }
  }));
  app.use(compression());
  app.use(express.json({ limit: env.jsonLimit }));
  app.use(attachUser);
  app.use(env.publicUploadBase, requireAuth, express.static(env.uploadDir, {
    immutable: true,
    maxAge: `${env.mediaCacheDays}d`,
    setHeaders: (res) => res.setHeader('Cache-Control', `private, max-age=${env.mediaCacheDays * 86400}, immutable`)
  }));
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.path.startsWith(env.apiPrefix)) {
      const startedAt = process.hrtime.bigint();
      const requestPath = req.originalUrl.split('?')[0];
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: requestPath,
          status: res.statusCode,
          duration_ms: Number(durationMs.toFixed(1)),
          user_id: req.user?.id || null
        }));
      });
    }
    next();
  });
  app.get(`${env.frontendPublicPath}/js/config.js`, (_req, res) => {
    res.type('application/javascript').send(`window.INVENTORY_API_BASE = ${JSON.stringify(env.apiPrefix)};`);
  });
  app.use(env.frontendPublicPath, express.static(path.join(env.rootDir, 'frontend')));
  app.use(env.apiPrefix, apiRoutes);

  app.get('/', (_req, res) => {
    res.sendFile(path.join(env.staticDir, env.htmlFile));
  });

  app.use((error, _req, res, _next) => {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: status >= 500 ? 'Error interno del servidor' : error.message,
      errors: error.errors
    });
  });

  return app;
}

module.exports = createApp;
