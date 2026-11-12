import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { Config } from '../config.js';
import type { AuthService } from '../services/auth.js';
import { safeEqual } from '../services/auth.js';

export const SESSION_COOKIE = 'wedding_session';

export function sessionCookieOptions(config: Config, expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api',
    signed: true,
    ...(expires ? { expires } : {}),
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augmentation convention
  namespace Express {
    interface Request {
      session?: { token: string; csrfToken: string };
    }
  }
}

/** Require a valid admin session; on unsafe methods also require a matching CSRF header. */
export function requireAdmin(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.signedCookies?.[SESSION_COOKIE];
    const session = typeof token === 'string' && token ? auth.getSession(token) : null;
    if (!session || typeof token !== 'string') {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const header = req.get('x-csrf-token') ?? '';
      if (!header || !safeEqual(header, session.csrfToken)) {
        res.status(403).json({ error: 'Invalid CSRF token' });
        return;
      }
    }
    req.session = { token, csrfToken: session.csrfToken };
    next();
  };
}
