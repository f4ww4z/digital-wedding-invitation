import { rateLimit } from 'express-rate-limit';
import type { Config } from '../config.js';

const json = (msg: string) => ({ error: msg });

export function createLimiters(config: Config) {
  const disabled = config.NODE_ENV === 'test';
  return {
    /** Public writes: RSVP, wishes, gift confirmations, claims, open tracking. */
    publicWrite: rateLimit({
      windowMs: 60_000,
      limit: config.RATE_LIMIT_PUBLIC_PER_MIN,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => disabled,
      message: json('Too many requests, please slow down.'),
    }),
    /** Public reads. Generous; just prevents scraping floods. */
    publicRead: rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => disabled,
      message: json('Too many requests.'),
    }),
    login: rateLimit({
      windowMs: 15 * 60_000,
      limit: config.RATE_LIMIT_LOGIN_PER_15MIN,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      skip: () => disabled,
      message: json('Too many login attempts. Try again later.'),
    }),
  };
}
