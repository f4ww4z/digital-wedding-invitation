import express, { Router } from 'express';
import { and, count, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  clientToken,
  giftConfirmInput,
  guestCodeSchema,
  rsvpInput,
  wishInput,
  wishlistClaimInput,
  type PublicGuest,
  type PublicWish,
  type PublicWishlistItem,
  type WishesPage,
} from '@sakinah/shared';
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
import { HttpError, idParam, parse } from '../http.js';
import type { ContentService } from '../services/content.js';
import type { createLimiters } from '../middleware/rateLimit.js';

interface Deps {
  db: Db;
  publicUrl: string;
  content: ContentService;
  limiters: ReturnType<typeof createLimiters>;
}

export function publicRouter({ db, publicUrl, content, limiters }: Deps): Router {
  const r = Router();
  const body = express.json({ limit: '16kb' });

  const findGuest = (code: string | undefined) =>
    code ? (db.select().from(guests).where(eq(guests.code, code)).get() ?? null) : null;

  const feature = (on: boolean) => {
    if (!on) throw new HttpError(403, 'This feature is disabled');
  };

  r.get('/content', limiters.publicRead, (_req, res) => {
    const { content: c, updatedAt } = content.get();
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ content: c, updatedAt });
  });

  /**
   * HTML <head> tags for link previews (WhatsApp, Telegram, Facebook don't run JS).
   * nginx splices this into index.html with an SSI include.
   */
  r.get('/meta', (_req, res) => {
    const c = content.get().content;
    const base = publicUrl.replace(/\/$/, '');
    const abs = (u: string) => (u.startsWith('/') ? `${base}${u}` : u);
    const esc = (v: string) =>
      v.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
    const tags = [
      `<title>${esc(c.meta.title)}</title>`,
      `<meta name="description" content="${esc(c.meta.description)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${esc(c.meta.title)}" />`,
      `<meta property="og:description" content="${esc(c.meta.description)}" />`,
      `<meta property="og:url" content="${esc(base)}/" />`,
      ...(c.meta.ogImage ? [`<meta property="og:image" content="${esc(abs(c.meta.ogImage))}" />`] : []),
      `<meta name="twitter:card" content="summary_large_image" />`,
      // Guest names live in URLs; keep invitations out of search results unless allowed.
      ...(c.meta.allowIndexing ? [] : [`<meta name="robots" content="noindex, nofollow" />`]),
      `<meta name="theme-color" content="${esc(c.theme.background)}" />`,
    ];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(tags.join('\n    '));
  });

  r.get('/robots.txt', (_req, res) => {
    const allow = content.get().content.meta.allowIndexing;
    res.type('text/plain').setHeader('Cache-Control', 'no-cache');
    res.send(`User-agent: *\n${allow ? 'Allow: /\nDisallow: /admin\nDisallow: /api/' : 'Disallow: /'}\n`);
  });

  r.get('/guest/:code', limiters.publicRead, (req, res) => {
    const code = parse(guestCodeSchema, req.params.code);
    const g = findGuest(code);
    if (!g) throw new HttpError(404, 'Guest not found');
    const rsvp = db.select().from(rsvps).where(eq(rsvps.guestId, g.id)).get();
    const out: PublicGuest = {
      name: g.name,
      maxPax: g.maxPax,
      rsvp: rsvp ? { attendance: rsvp.attendance, pax: rsvp.pax, message: rsvp.message } : null,
    };
    res.setHeader('Cache-Control', 'no-store');
    res.json(out);
  });

  /** Called when the cover is opened. Tracks opens for stats. */
  r.post('/open', limiters.open, body, (req, res) => {
    const { guestCode } = parse(z.object({ guestCode: guestCodeSchema.optional() }), req.body ?? {});
    const g = findGuest(guestCode);
    const nowIso = new Date().toISOString();
    db.transaction((tx) => {
      tx.insert(openEvents).values({ guestId: g?.id ?? null }).run();
      if (g) {
        tx.update(guests)
          .set({
            openCount: sql`${guests.openCount} + 1`,
            firstOpenedAt: g.firstOpenedAt ?? nowIso,
            lastOpenedAt: nowIso,
          })
          .where(eq(guests.id, g.id))
          .run();
      }
    });
    res.status(204).end();
  });

  /* ---------------- RSVP ---------------- */

  r.get('/rsvp/me', limiters.publicRead, (req, res) => {
    const token = parse(clientToken, req.query.token);
    const row = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.clientToken, token), isNull(rsvps.guestId)))
      .get();
    res.setHeader('Cache-Control', 'no-store');
    res.json(row ? { attendance: row.attendance, pax: row.pax, message: row.message, name: row.name } : null);
  });

  r.post('/rsvp', limiters.publicWrite, limiters.create, body, (req, res) => {
    const c = content.get().content;
    feature(c.rsvp.enabled);
    if (c.rsvp.deadline && Date.now() > Date.parse(c.rsvp.deadline)) {
      throw new HttpError(403, 'RSVP is closed');
    }
    const input = parse(rsvpInput, req.body);
    const g = findGuest(input.guestCode);
    if (input.guestCode && !g) throw new HttpError(404, 'Guest not found');
    const maxPax = g?.maxPax ?? c.rsvp.maxPaxDefault;
    const pax = input.attendance === 'no' ? 0 : Math.max(1, Math.min(input.pax, maxPax));
    const nowIso = new Date().toISOString();
    const values = {
      guestId: g?.id ?? null,
      name: input.name,
      attendance: input.attendance,
      pax,
      message: input.message,
      clientToken: input.clientToken,
      updatedAt: nowIso,
    };

    const saved = db.transaction((tx) => {
      // Coded guests have exactly one RSVP; anonymous ones are keyed by their browser token.
      const existing = g
        ? tx.select().from(rsvps).where(eq(rsvps.guestId, g.id)).get()
        : tx
            .select()
            .from(rsvps)
            .where(and(eq(rsvps.clientToken, input.clientToken), isNull(rsvps.guestId)))
            .get();
      if (existing) {
        // Keep the original token if another browser of the same guest updates it.
        const { clientToken: _t, ...rest } = values;
        tx.update(rsvps).set(rest).where(eq(rsvps.id, existing.id)).run();
        return { id: existing.id, updated: true };
      }
      const row = tx.insert(rsvps).values(values).returning({ id: rsvps.id }).get();
      return { id: row.id, updated: false };
    });
    res.status(saved.updated ? 200 : 201).json({ ok: true, pax, updated: saved.updated });
  });

  /* ---------------- Wishes ---------------- */

  r.get('/wishes', limiters.publicRead, (req, res) => {
    feature(content.get().content.wishes.enabled);
    const q = parse(
      z.object({
        cursor: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(10),
      }),
      req.query,
    );
    const where = q.cursor
      ? and(eq(wishes.status, 'visible'), lt(wishes.id, q.cursor))
      : eq(wishes.status, 'visible');
    const rows = db
      .select()
      .from(wishes)
      .where(where)
      .orderBy(desc(wishes.id))
      .limit(q.limit + 1)
      .all();
    const items: PublicWish[] = rows.slice(0, q.limit).map((w) => ({
      id: w.id,
      name: w.name,
      message: w.message,
      attendance: w.attendance,
      createdAt: w.createdAt,
    }));
    const total = db.select({ n: count() }).from(wishes).where(eq(wishes.status, 'visible')).get()!.n;
    const page: WishesPage = {
      items,
      nextCursor: rows.length > q.limit ? items[items.length - 1]!.id : null,
      total,
    };
    res.setHeader('Cache-Control', 'no-cache');
    res.json(page);
  });

  r.post('/wishes', limiters.publicWrite, limiters.create, body, (req, res) => {
    const c = content.get().content;
    feature(c.wishes.enabled);
    const input = parse(wishInput, req.body);
    const g = findGuest(input.guestCode);
    const status = c.wishes.requireApproval ? 'pending' : 'visible';
    // Attendance badge comes from the sender's real RSVP, not from the request.
    const rsvp = g
      ? db.select({ a: rsvps.attendance }).from(rsvps).where(eq(rsvps.guestId, g.id)).get()
      : input.clientToken
        ? db
            .select({ a: rsvps.attendance })
            .from(rsvps)
            .where(and(eq(rsvps.clientToken, input.clientToken), isNull(rsvps.guestId)))
            .get()
        : undefined;
    const row = db
      .insert(wishes)
      .values({
        guestId: g?.id ?? null,
        name: input.name,
        message: input.message,
        attendance: rsvp?.a ?? null,
        status,
      })
      .returning()
      .get();
    const wish: PublicWish = {
      id: row.id,
      name: row.name,
      message: row.message,
      attendance: row.attendance,
      createdAt: row.createdAt,
    };
    res.status(201).json({ wish, status });
  });

  /* ---------------- Gifts ---------------- */

  r.post('/gifts/confirm', limiters.publicWrite, limiters.create, body, (req, res) => {
    const c = content.get().content;
    feature(c.gift.enabled && c.gift.confirmationEnabled);
    const input = parse(giftConfirmInput, req.body);
    const g = findGuest(input.guestCode);
    db.insert(giftConfirmations)
      .values({
        guestId: g?.id ?? null,
        name: input.name,
        method: input.method,
        amount: input.amount ?? null,
        target: input.target,
        note: input.note,
      })
      .run();
    res.status(201).json({ ok: true });
  });

  r.get('/wishlist', limiters.publicRead, (req, res) => {
    const c = content.get().content;
    feature(c.gift.enabled && c.gift.wishlistEnabled);
    const token = typeof req.query.token === 'string' ? clientToken.safeParse(req.query.token) : null;
    const myToken = token?.success ? token.data : null;
    const items = db.select().from(wishlistItems).orderBy(wishlistItems.sort, wishlistItems.id).all();
    const claims = db
      .select({ itemId: wishlistClaims.itemId, clientToken: wishlistClaims.clientToken })
      .from(wishlistClaims)
      .all();
    const out: PublicWishlistItem[] = items.map((it) => {
      const mine = claims.filter((cl) => cl.itemId === it.id);
      return {
        id: it.id,
        name: it.name,
        description: it.description,
        imageUrl: it.imageUrl,
        link: it.link,
        qty: it.qty,
        claimed: mine.length,
        mine: !!myToken && mine.some((cl) => cl.clientToken === myToken),
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(out);
  });

  r.post('/wishlist/:id/claim', limiters.publicWrite, limiters.create, body, (req, res) => {
    const c = content.get().content;
    feature(c.gift.enabled && c.gift.wishlistEnabled);
    const id = idParam(req);
    const input = parse(wishlistClaimInput, req.body);
    const g = findGuest(input.guestCode);
    db.transaction((tx) => {
      const item = tx.select().from(wishlistItems).where(eq(wishlistItems.id, id)).get();
      if (!item) throw new HttpError(404, 'Item not found');
      const already = tx
        .select({ id: wishlistClaims.id })
        .from(wishlistClaims)
        .where(and(eq(wishlistClaims.itemId, id), eq(wishlistClaims.clientToken, input.clientToken)))
        .get();
      if (already) throw new HttpError(409, 'You already claimed this item');
      const n = tx.select({ n: count() }).from(wishlistClaims).where(eq(wishlistClaims.itemId, id)).get()!.n;
      if (n >= item.qty) throw new HttpError(409, 'This item has already been fully claimed');
      tx.insert(wishlistClaims)
        .values({ itemId: id, guestId: g?.id ?? null, name: input.name, clientToken: input.clientToken })
        .run();
    });
    res.status(201).json({ ok: true });
  });

  r.post('/wishlist/:id/unclaim', limiters.publicWrite, body, (req, res) => {
    const id = idParam(req);
    const { clientToken: token } = parse(z.object({ clientToken }), req.body);
    const result = db
      .delete(wishlistClaims)
      .where(and(eq(wishlistClaims.itemId, id), eq(wishlistClaims.clientToken, token)))
      .run();
    if (result.changes === 0) throw new HttpError(404, 'No claim found');
    res.json({ ok: true });
  });

  return r;
}
