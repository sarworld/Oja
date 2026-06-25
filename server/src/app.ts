import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Config } from './config.js';
import type { AppContext } from './context.js';
import { buildRouter } from './routes/index.js';

/**
 * Build the Express app from an app context. Kept separate from boot
 * (index.ts) so tests can drive it via supertest without a listening socket.
 */
export function createApp(
  cfg: Config,
  ctx: AppContext,
  opts: { serveStatic?: boolean; staticDir?: string } = {},
): Express {
  const app = express();
  app.set('trust proxy', 1);

  // Nudge (don't enforce — plain-HTTP LAN installs are a supported setup).
  if (process.env.NODE_ENV === 'production' && !cfg.COOKIE_SECURE) {
    // eslint-disable-next-line no-console
    console.warn(
      '[oja] WARNING: COOKIE_SECURE is off — set COOKIE_SECURE=true when serving ' +
        'Oja over HTTPS so the login cookie gets the Secure flag.',
    );
  }

  // Security headers. helmet's default CSP suits the first-party SPA (external
  // bundle, same-origin API, same-origin proxied photos); we only relax two
  // things: keep `upgrade-insecure-requests` OFF so plain-HTTP LAN installs work,
  // and allow data:/blob: images (proxied thumbnails + object URLs).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': null,
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(
    cookieSession({
      name: 'oja',
      secret: cfg.SESSION_SECRET,
      httpOnly: true,
      sameSite: 'lax',
      secure: cfg.COOKIE_SECURE,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    }),
  );

  // API routes take precedence over static.
  app.use('/api', buildRouter(ctx));

  // Static serving of the built frontend (single-image deploy).
  const webDist = opts.staticDir ?? resolve(process.cwd(), 'dist', '..', '..', 'web', 'dist');
  if (opts.serveStatic !== false && existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET') return next();
      res.sendFile(join(webDist, 'index.html'));
    });
    // eslint-disable-next-line no-console
    console.log(`[oja] serving static frontend from ${webDist}`);
  }

  // Central error handler.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[oja] error:', err.message);
    if (res.headersSent) return;
    // Don't leak internal error detail (incl. upstream responses) to clients in
    // production; the detail is logged above for the operator.
    const body =
      process.env.NODE_ENV === 'production'
        ? { error: 'internal' }
        : { error: 'internal', message: err.message };
    res.status(500).json(body);
  });

  return app;
}
