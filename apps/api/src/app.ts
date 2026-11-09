import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { trustProxyValue, type Config } from './config.js';
import type { Db } from './db/index.js';
import { errorHandler } from './http.js';
import { createLimiters } from './middleware/rateLimit.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';
import { AuthService } from './services/auth.js';
import { ContentService } from './services/content.js';
import { EXT_MIME, MEDIA_FILENAME_RE, MediaService } from './services/media.js';

export interface AppDeps {
  config: Config;
  db: Db;
  log: Logger;
}

export interface App {
  app: Express;
  auth: AuthService;
  content: ContentService;
  media: MediaService;
}

export function createApp({ config, db, log }: AppDeps): App {
  const auth = new AuthService(db, config, log);
  const content = new ContentService(db, log);
  const media = new MediaService(db, config.UPLOAD_DIR);
  const limiters = createLimiters(config);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyValue(config.TRUST_PROXY));
  app.set('etag', 'strong');

  app.use(
    pinoHttp({
      logger: log,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'],
      autoLogging: { ignore: (req) => req.url === '/api/health' || req.url?.startsWith('/media/') === true },
      // Guest codes and browser tokens are capabilities; keep them out of logs.
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url
            .replace(/([?&](?:token|g)=)[^&]+/g, '$1[redacted]')
            .replace(/^\/api\/guest\/[^/?]+/, '/api/guest/[redacted]'),
        }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], sandbox: [] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      // HSTS is the TLS terminator's job; avoid pinning HTTPS on plain-HTTP installs.
      strictTransportSecurity: false,
    }),
  );
  app.use(cookieParser(config.SESSION_SECRET));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/admin', adminRouter({ db, config, auth, content, media, limiters }));
  app.use('/api', publicRouter({ db, publicUrl: config.PUBLIC_URL, content, limiters }));

  // Uploaded media. Filenames are random and validated; never derived from user input.
  app.get('/media/:file', (req, res, next) => {
    const file = req.params.file;
    if (!MEDIA_FILENAME_RE.test(file)) {
      res.status(404).end();
      return;
    }
    const ext = file.slice(file.lastIndexOf('.') + 1);
    res.sendFile(
      join(media.dir, file),
      {
        maxAge: '365d',
        immutable: true,
        dotfiles: 'deny',
        headers: {
          'Content-Type': EXT_MIME[ext]!,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      },
      (err) => {
        if (err && !res.headersSent) {
          res.status(404).end();
        } else if (err) next(err);
      },
    );
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return { app, auth, content, media };
}
