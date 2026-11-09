import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { admin, loginThrottle, sessions } from '../db/schema.js';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(sha256(a));
  const bb = Buffer.from(sha256(b));
  return timingSafeEqual(ab, bb);
}

/** Dummy hash so failed-username logins take as long as failed-password ones. */
let dummyHash: Promise<string> | null = null;

export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly log: Logger,
  ) {}

  /**
   * Create or reset the admin credential from env:
   * - No admin row yet → create from ADMIN_PASSWORD_HASH / ADMIN_PASSWORD, or a random
   *   password that is logged once.
   * - Admin row exists and the env credential changed since last applied → reset to it.
   * - Otherwise keep the (possibly dashboard-changed) password.
   */
  async bootstrapAdmin(): Promise<void> {
    const envSecret = this.config.ADMIN_PASSWORD_HASH || this.config.ADMIN_PASSWORD;
    const row = this.db.select().from(admin).where(eq(admin.id, 1)).get();

    // The fingerprint of the env credential is itself an argon2 hash, so a leaked DB
    // never exposes a fast-to-crack digest of the .env password.
    if (row && !envSecret) return;
    if (row && row.envFingerprint && (await argon2.verify(row.envFingerprint, envSecret).catch(() => false))) return;
    const fingerprint = envSecret ? await argon2.hash(envSecret, { type: argon2.argon2id }) : '';

    let hash: string;
    if (this.config.ADMIN_PASSWORD_HASH) {
      if (!this.config.ADMIN_PASSWORD_HASH.startsWith('$argon2')) {
        throw new Error('ADMIN_PASSWORD_HASH must be an argon2 hash (did you forget single quotes in .env?)');
      }
      hash = this.config.ADMIN_PASSWORD_HASH;
    } else if (this.config.ADMIN_PASSWORD) {
      if (this.config.ADMIN_PASSWORD.length < 10) {
        throw new Error('ADMIN_PASSWORD must be at least 10 characters');
      }
      hash = await argon2.hash(this.config.ADMIN_PASSWORD, { type: argon2.argon2id });
    } else {
      const generated = randomBytes(12).toString('base64url');
      hash = await argon2.hash(generated, { type: argon2.argon2id });
      this.log.warn(
        `No ADMIN_PASSWORD set. Generated admin password (shown once): ${generated}`,
      );
    }

    this.db
      .insert(admin)
      .values({ id: 1, passwordHash: hash, envFingerprint: fingerprint })
      .onConflictDoUpdate({
        target: admin.id,
        set: { passwordHash: hash, envFingerprint: fingerprint, updatedAt: new Date().toISOString() },
      })
      .run();
    this.log.info(row ? 'Admin password reset from environment' : 'Admin account initialised');
  }

  /* ---------- Persistent account lockout (survives restarts, independent of IP) ---------- */

  static readonly MAX_FAILURES = 10;
  static readonly LOCK_MINUTES = 15;

  /** Returns the lock expiry if the admin account is currently locked. */
  lockedUntil(): Date | null {
    const row = this.db.select().from(loginThrottle).where(eq(loginThrottle.id, 1)).get();
    if (!row?.lockedUntil) return null;
    const until = new Date(row.lockedUntil);
    return until.getTime() > Date.now() ? until : null;
  }

  recordFailure(): void {
    const row = this.db.select().from(loginThrottle).where(eq(loginThrottle.id, 1)).get();
    const failures = (row?.failures ?? 0) + 1;
    const lockedUntil =
      failures >= AuthService.MAX_FAILURES ? new Date(Date.now() + AuthService.LOCK_MINUTES * 60_000).toISOString() : (row?.lockedUntil ?? null);
    this.db
      .insert(loginThrottle)
      .values({ id: 1, failures, lockedUntil })
      .onConflictDoUpdate({ target: loginThrottle.id, set: { failures, lockedUntil } })
      .run();
    if (failures >= AuthService.MAX_FAILURES) this.log.warn({ failures }, 'Admin login locked after repeated failures');
  }

  recordSuccess(): void {
    this.db.delete(loginThrottle).run();
  }

  async verifyLogin(username: string, password: string): Promise<boolean> {
    const row = this.db.select().from(admin).where(eq(admin.id, 1)).get();
    const userOk = safeEqual(username, this.config.ADMIN_USERNAME);
    if (!row || !userOk) {
      dummyHash ??= argon2.hash('dummy-password-for-timing', { type: argon2.argon2id });
      await argon2.verify(await dummyHash, password).catch(() => false);
      return false;
    }
    return argon2.verify(row.passwordHash, password).catch(() => false);
  }

  async changePassword(current: string, next: string): Promise<boolean> {
    const row = this.db.select().from(admin).where(eq(admin.id, 1)).get();
    if (!row || !(await argon2.verify(row.passwordHash, current).catch(() => false))) return false;
    const hash = await argon2.hash(next, { type: argon2.argon2id });
    this.db
      .update(admin)
      .set({ passwordHash: hash, updatedAt: new Date().toISOString() })
      .where(eq(admin.id, 1))
      .run();
    // Invalidate all sessions; caller re-creates the current one.
    this.db.delete(sessions).run();
    return true;
  }

  createSession(): { token: string; csrfToken: string; expiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_HOURS * 3600_000);
    this.db
      .insert(sessions)
      .values({ idHash: sha256(token), csrfToken, expiresAt: expiresAt.toISOString() })
      .run();
    return { token, csrfToken, expiresAt };
  }

  getSession(token: string): { csrfToken: string } | null {
    const row = this.db.select().from(sessions).where(eq(sessions.idHash, sha256(token))).get();
    if (!row) return null;
    if (Date.parse(row.expiresAt) < Date.now()) {
      this.destroySession(token);
      return null;
    }
    return { csrfToken: row.csrfToken };
  }

  destroySession(token: string): void {
    this.db.delete(sessions).where(eq(sessions.idHash, sha256(token))).run();
  }

  pruneExpired(): void {
    this.db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
  }
}
