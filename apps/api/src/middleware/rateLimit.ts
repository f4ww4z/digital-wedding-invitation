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
    /**
     * Record creation (RSVPs, wishes, gift confirmations, registry picks). Hourly cap per IP
     * so rotating browser tokens can't flood rows or claim the whole registry.
     */
    create: rateLimit({
      windowMs: 60 * 60_000,
      limit: config.RATE_LIMIT_CREATE_PER_HOUR,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => disabled,
      message: json('Too many submissions from this network. Please try again later.'),
    }),
    /** Open tracking fires on every cover tap; keep it off the write budget (CGNAT, venue Wi-Fi). */
    open: rateLimit({
      windowMs: 60_000,
      limit: 240,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: () => disabled,
      message: json('Too many requests.'),
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
