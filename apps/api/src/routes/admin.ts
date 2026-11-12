import express, { Router } from 'express';
import multer from 'multer';
import { count, desc, eq, sql, sum } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import {
  changePasswordInput,
  contentSchema,
  giftStatusInput,
  guestImportInput,
  guestInput,
  loginInput,
  wishModerationInput,
  wishlistItemInput,
  type AdminGift,
  type AdminGuest,
  type AdminRsvp,
  type AdminStats,
  type AdminWish,
  type AdminWishlistItem,
} from '@wedding/shared';
import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import {
  giftConfirmations,
  guests,
  openEvents,
  rsvps,
  wishes,
  wishlistClaims,
  wishlistItems,
} from '../db/schema.js';
import { HttpError, idParam, parse, sendCsv } from '../http.js';
import { requireAdmin, SESSION_COOKIE, sessionCookieOptions } from '../middleware/auth.js';
import type { createLimiters } from '../middleware/rateLimit.js';
import type { AuthService } from '../services/auth.js';
import type { ContentService } from '../services/content.js';
import type { MediaService } from '../services/media.js';

interface Deps {
  db: Db;
  config: Config;
  auth: AuthService;
  content: ContentService;
  media: MediaService;
  limiters: ReturnType<typeof createLimiters>;
}

/** Unambiguous alphabet (no 0/O/1/l/I) for guest codes that may be read aloud. */
export const newGuestCode = customAlphabet('23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', 10);

export function adminRouter({ db, config, auth, content, media, limiters }: Deps): Router {
  const r = Router();
  const json = express.json({ limit: '64kb' });
  const bigJson = express.json({ limit: '512kb' });

  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  /* ---------------- Auth (unauthenticated) ---------------- */

  r.post('/auth/login', limiters.login, json, async (req, res) => {
    const { username, password } = parse(loginInput, req.body);
    const locked = auth.lockedUntil();
    if (locked) {
      const mins = Math.max(1, Math.ceil((locked.getTime() - Date.now()) / 60_000));
      throw new HttpError(429, `Too many failed sign-ins. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
    }
    if (!(await auth.verifyLogin(username, password))) {
      auth.recordFailure();
      req.log.warn({ ip: req.ip }, 'Failed admin login');
      throw new HttpError(401, 'Invalid username or password');
    }
    auth.recordSuccess();
    const s = auth.createSession();
    res.cookie(SESSION_COOKIE, s.token, sessionCookieOptions(config, s.expiresAt));
    req.log.info({ ip: req.ip }, 'Admin logged in');
    res.json({ username: config.ADMIN_USERNAME, csrfToken: s.csrfToken });
  });

  /* Everything below requires a session (+ CSRF on writes). */
  r.use(requireAdmin(auth));

  r.get('/auth/me', (req, res) => {
    res.json({ username: config.ADMIN_USERNAME, csrfToken: req.session!.csrfToken, publicUrl: config.PUBLIC_URL });
  });

  r.post('/auth/logout', (req, res) => {
    auth.destroySession(req.session!.token);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
    res.json({ ok: true });
  });

  r.post('/auth/password', limiters.login, json, async (req, res) => {
    const input = parse(changePasswordInput, req.body);
    if (!(await auth.changePassword(input.currentPassword, input.newPassword))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    const s = auth.createSession();
    res.cookie(SESSION_COOKIE, s.token, sessionCookieOptions(config, s.expiresAt));
    res.json({ ok: true, csrfToken: s.csrfToken });
  });

  /* ---------------- Stats ---------------- */

  r.get('/stats', (_req, res) => {
    const g = db
      .select({
        total: count(),
        opened: sql<number>`sum(case when ${guests.openCount} > 0 then 1 else 0 end)`,
      })
      .from(guests)
      .get()!;
    const rs = db
      .select({ attendance: rsvps.attendance, n: count(), pax: sum(rsvps.pax) })
      .from(rsvps)
      .groupBy(rsvps.attendance)
      .all();
    const by = (a: string) => rs.find((x) => x.attendance === a);
    const w = db
      .select({
        total: count(),
        pending: sql<number>`sum(case when ${wishes.status} = 'pending' then 1 else 0 end)`,
      })
      .from(wishes)
      .get()!;
    const gf = db
      .select({
        total: count(),
        received: sql<number>`sum(case when ${giftConfirmations.status} = 'received' then 1 else 0 end)`,
        amount: sql<number>`coalesce(sum(${giftConfirmations.amount}), 0)`,
      })
      .from(giftConfirmations)
      .get()!;
    const wl = db
      .select({ items: count(), qty: sql<number>`coalesce(sum(${wishlistItems.qty}), 0)` })
      .from(wishlistItems)
      .get()!;
    const claimed = db.select({ n: count() }).from(wishlistClaims).get()!.n;
    const opensByDay = db
      .select({ day: sql<string>`substr(${openEvents.createdAt}, 1, 10)`, count: count() })
      .from(openEvents)
      .where(sql`${openEvents.createdAt} >= strftime('%Y-%m-%dT00:00:00Z', 'now', '-29 days')`)
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .all();

    const stats: AdminStats = {
      guests: { total: g.total, opened: Number(g.opened ?? 0) },
      rsvp: {
        yes: by('yes')?.n ?? 0,
        no: by('no')?.n ?? 0,
        maybe: by('maybe')?.n ?? 0,
        paxYes: Number(by('yes')?.pax ?? 0),
        total: rs.reduce((a, x) => a + x.n, 0),
      },
      wishes: { total: w.total, pending: Number(w.pending ?? 0) },
      gifts: { total: gf.total, received: Number(gf.received ?? 0), amountTotal: Number(gf.amount) },
      wishlist: { items: wl.items, claimed, totalQty: Number(wl.qty) },
      opensByDay,
    };
    res.json(stats);
  });

  /* ---------------- Guests ---------------- */

  const guestRows = (): AdminGuest[] =>
    db
      .select({
        g: guests,
        rsvpAttendance: rsvps.attendance,
        rsvpPax: rsvps.pax,
      })
      .from(guests)
      .leftJoin(rsvps, eq(rsvps.guestId, guests.id))
      .orderBy(desc(guests.id))
      .all()
      .map(({ g, rsvpAttendance, rsvpPax }) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        group: g.group,
        phone: g.phone,
        maxPax: g.maxPax,
        notes: g.notes,
        openCount: g.openCount,
        firstOpenedAt: g.firstOpenedAt,
        lastOpenedAt: g.lastOpenedAt,
        rsvpAttendance: rsvpAttendance ?? null,
        rsvpPax: rsvpPax ?? null,
        createdAt: g.createdAt,
      }));

  r.get('/guests', (_req, res) => {
    res.json(guestRows());
  });

  r.post('/guests', json, (req, res) => {
    const input = parse(guestInput, req.body);
    const row = db
      .insert(guests)
      .values({
        ...input,
        maxPax: input.maxPax ?? content.get().content.rsvp.maxPaxDefault,
        code: newGuestCode(),
      })
      .returning()
      .get();
    res.status(201).json(row);
  });

  r.post('/guests/import', bigJson, (req, res) => {
    const { guests: list } = parse(guestImportInput, req.body);
    const def = content.get().content.rsvp.maxPaxDefault;
    const created = db.transaction((tx) =>
      list.map(
        (g) =>
          tx
            .insert(guests)
            .values({ ...g, maxPax: g.maxPax ?? def, code: newGuestCode() })
            .returning({ id: guests.id })
            .get().id,
      ),
    );
    res.status(201).json({ created: created.length });
  });

  r.put('/guests/:id', json, (req, res) => {
    const id = idParam(req);
    const input = parse(guestInput, req.body);
    const row = db
      .update(guests)
      .set({ ...input, ...(input.maxPax ? { maxPax: input.maxPax } : {}) })
      .where(eq(guests.id, id))
      .returning()
      .get();
    if (!row) throw new HttpError(404, 'Guest not found');
    res.json(row);
  });

  r.post('/guests/:id/regenerate-code', (req, res) => {
    const id = idParam(req);
    const row = db.update(guests).set({ code: newGuestCode() }).where(eq(guests.id, id)).returning().get();
    if (!row) throw new HttpError(404, 'Guest not found');
    res.json(row);
  });

  r.delete('/guests/:id', (req, res) => {
    const id = idParam(req);
    const result = db.delete(guests).where(eq(guests.id, id)).run();
    if (result.changes === 0) throw new HttpError(404, 'Guest not found');
    res.json({ ok: true });
  });

  r.get('/guests/export.csv', (_req, res) => {
    const base = config.PUBLIC_URL.replace(/\/$/, '');
    sendCsv(
      res,
      'guests.csv',
      ['name', 'group', 'phone', 'max_pax', 'link', 'opens', 'last_opened', 'rsvp', 'rsvp_pax', 'notes'],
      guestRows().map((g) => [
        g.name,
        g.group,
        g.phone,
        g.maxPax,
        `${base}/?g=${g.code}`,
        g.openCount,
        g.lastOpenedAt ?? '',
        g.rsvpAttendance ?? '',
        g.rsvpPax ?? '',
        g.notes,
      ]),
    );
  });

  /* ---------------- RSVPs ---------------- */

  const rsvpRows = (): AdminRsvp[] =>
    db
      .select({ r: rsvps, guestName: guests.name })
      .from(rsvps)
      .leftJoin(guests, eq(guests.id, rsvps.guestId))
      .orderBy(desc(rsvps.updatedAt))
      .all()
      .map(({ r: x, guestName }) => ({
        id: x.id,
        guestId: x.guestId,
        guestName: guestName ?? null,
        name: x.name,
        attendance: x.attendance,
        pax: x.pax,
        message: x.message,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      }));

  r.get('/rsvps', (_req, res) => {
    res.json(rsvpRows());
  });

  r.delete('/rsvps/:id', (req, res) => {
    const result = db.delete(rsvps).where(eq(rsvps.id, idParam(req))).run();
    if (result.changes === 0) throw new HttpError(404, 'RSVP not found');
    res.json({ ok: true });
  });

  r.get('/rsvps/export.csv', (_req, res) => {
    sendCsv(
      res,
      'rsvps.csv',
      ['name', 'guest', 'attendance', 'pax', 'message', 'updated_at'],
      rsvpRows().map((x) => [x.name, x.guestName ?? '', x.attendance, x.pax, x.message, x.updatedAt]),
    );
  });

  /* ---------------- Wishes ---------------- */

  r.get('/wishes', (_req, res) => {
    const rows: AdminWish[] = db
      .select()
      .from(wishes)
      .orderBy(desc(wishes.id))
      .all()
      .map((w) => ({
        id: w.id,
        name: w.name,
        message: w.message,
        attendance: w.attendance,
        createdAt: w.createdAt,
        status: w.status,
        guestId: w.guestId,
      }));
    res.json(rows);
  });

  r.patch('/wishes/:id', json, (req, res) => {
    const { status } = parse(wishModerationInput, req.body);
    const row = db.update(wishes).set({ status }).where(eq(wishes.id, idParam(req))).returning().get();
    if (!row) throw new HttpError(404, 'Wish not found');
    res.json({ ok: true });
  });

  r.delete('/wishes/:id', (req, res) => {
    const result = db.delete(wishes).where(eq(wishes.id, idParam(req))).run();
    if (result.changes === 0) throw new HttpError(404, 'Wish not found');
    res.json({ ok: true });
  });

  r.get('/wishes/export.csv', (_req, res) => {
    const rows = db.select().from(wishes).orderBy(desc(wishes.id)).all();
    sendCsv(
      res,
      'wishes.csv',
      ['name', 'message', 'attendance', 'status', 'created_at'],
      rows.map((w) => [w.name, w.message, w.attendance ?? '', w.status, w.createdAt]),
    );
  });

  /* ---------------- Gifts ---------------- */

  const giftRows = (): AdminGift[] =>
    db
      .select()
      .from(giftConfirmations)
      .orderBy(desc(giftConfirmations.id))
      .all()
      .map((x) => ({ ...x }));

  r.get('/gifts', (_req, res) => {
    res.json(giftRows());
  });

  r.patch('/gifts/:id', json, (req, res) => {
    const input = parse(giftStatusInput, req.body);
    const row = db
      .update(giftConfirmations)
      .set({ status: input.status, ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}) })
      .where(eq(giftConfirmations.id, idParam(req)))
      .returning()
      .get();
    if (!row) throw new HttpError(404, 'Gift not found');
    res.json(row);
  });

  r.delete('/gifts/:id', (req, res) => {
    const result = db.delete(giftConfirmations).where(eq(giftConfirmations.id, idParam(req))).run();
    if (result.changes === 0) throw new HttpError(404, 'Gift not found');
    res.json({ ok: true });
  });

  r.get('/gifts/export.csv', (_req, res) => {
    sendCsv(
      res,
      'gifts.csv',
      ['name', 'method', 'amount', 'target', 'note', 'status', 'admin_note', 'created_at'],
      giftRows().map((x) => [x.name, x.method, x.amount ?? '', x.target, x.note, x.status, x.adminNote, x.createdAt]),
    );
  });

  /* ---------------- Wishlist ---------------- */

  r.get('/wishlist', (_req, res) => {
    const items = db.select().from(wishlistItems).orderBy(wishlistItems.sort, wishlistItems.id).all();
    const claims = db.select().from(wishlistClaims).orderBy(wishlistClaims.id).all();
    const out: AdminWishlistItem[] = items.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      imageUrl: it.imageUrl,
      link: it.link,
      qty: it.qty,
      sort: it.sort,
      claims: claims
        .filter((c) => c.itemId === it.id)
        .map((c) => ({ id: c.id, name: c.name, guestId: c.guestId, createdAt: c.createdAt })),
    }));
    res.json(out);
  });

  r.post('/wishlist', json, (req, res) => {
    const input = parse(wishlistItemInput, req.body);
    res.status(201).json(db.insert(wishlistItems).values(input).returning().get());
  });

  r.put('/wishlist/:id', json, (req, res) => {
    const input = parse(wishlistItemInput, req.body);
    const row = db.update(wishlistItems).set(input).where(eq(wishlistItems.id, idParam(req))).returning().get();
    if (!row) throw new HttpError(404, 'Item not found');
    res.json(row);
  });

  r.delete('/wishlist/:id', (req, res) => {
    const result = db.delete(wishlistItems).where(eq(wishlistItems.id, idParam(req))).run();
    if (result.changes === 0) throw new HttpError(404, 'Item not found');
    res.json({ ok: true });
  });

  r.delete('/wishlist/claims/:id', (req, res) => {
    const result = db.delete(wishlistClaims).where(eq(wishlistClaims.id, idParam(req))).run();
    if (result.changes === 0) throw new HttpError(404, 'Claim not found');
    res.json({ ok: true });
  });

  /* ---------------- Content ---------------- */

  r.get('/content', (_req, res) => {
    const { content: c, updatedAt, repaired } = content.get();
    res.json({ content: c, updatedAt, repaired });
  });

  r.put('/content', bigJson, (req, res) => {
    const body = parse(z.object({ content: z.unknown(), updatedAt: z.string().min(1, 'updatedAt is required (reload the editor)') }), req.body);
    const next = parse(contentSchema, body.content);
    const result = content.put(next, body.updatedAt);
    if (!result.ok) {
      res.status(409).json({ error: 'Content was changed elsewhere. Reload to get the latest version.', updatedAt: result.updatedAt });
      return;
    }
    req.log.info('Invitation content updated');
    res.json({ content: next, updatedAt: result.updatedAt });
  });

  /* ---------------- Media ---------------- */

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 2, parts: 3 },
  });

  r.get('/media', (_req, res) => {
    res.json(media.list());
  });

  r.post('/media', upload.single('file'), async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name "file")');
    const item = await media.save(req.file.buffer, req.file.originalname);
    req.log.info({ id: item.id, kind: item.kind, size: item.size }, 'Media uploaded');
    res.status(201).json(item);
  });

  r.delete('/media/:id', async (req, res) => {
    if (!(await media.remove(idParam(req)))) throw new HttpError(404, 'Media not found');
    res.json({ ok: true });
  });

  return r;
}
