import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  /** Public base URL of the invitation, used for share links. */
  PUBLIC_URL: z.url().default('http://localhost:8080'),
  DATA_DIR: z.string().default('./data'),
  UPLOAD_DIR: z.string().default('./uploads'),
  ADMIN_USERNAME: z.string().min(1).max(80).default('admin'),
  /** Plaintext password, hashed on first boot only (never stored). */
  ADMIN_PASSWORD: z.string().max(256).optional().default(''),
  /** Pre-hashed argon2 password (takes precedence over ADMIN_PASSWORD). */
  ADMIN_PASSWORD_HASH: z.string().max(512).optional().default(''),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  /** Express "trust proxy" setting: number of hops, or false. */
  TRUST_PROXY: z.string().default('1'),
  /** Set to false only when serving over plain HTTP without TLS (local testing). */
  COOKIE_SECURE: bool.default(true),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(15),
  RATE_LIMIT_PUBLIC_PER_MIN: z.coerce.number().int().min(1).max(10_000).default(30),
  /** Max new RSVPs / wishes / gift confirmations / registry picks per IP per hour. */
  RATE_LIMIT_CREATE_PER_HOUR: z.coerce.number().int().min(1).max(100_000).default(40),
  RATE_LIMIT_LOGIN_PER_15MIN: z.coerce.number().int().min(1).max(1000).default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

/** Values shipped in .env.example. Running with them would mean a publicly known secret. */
export const PLACEHOLDERS = {
  SESSION_SECRET: 'replace-with-a-long-random-string-of-at-least-32-chars',
  ADMIN_PASSWORD: 'change-me-please-123',
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    if (c.SESSION_SECRET === PLACEHOLDERS.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is still the example value. Generate one with: openssl rand -base64 48');
    }
    if (c.ADMIN_PASSWORD === PLACEHOLDERS.ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD is still the example value. Choose your own (or leave it empty to get a generated one).');
    }
  }
  return c;
}

export function trustProxyValue(v: string): boolean | number | string {
  if (v === 'true') return true;
  if (v === 'false' || v === '') return false;
  const n = Number(v);
  return Number.isInteger(n) ? n : v;
}
