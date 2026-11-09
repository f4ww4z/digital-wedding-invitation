import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pino } from 'pino';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultContent, type InvitationContent } from '@sakinah/shared';
import { createApp, type App } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { csvCell } from './http.js';

const PASSWORD = 'correct-horse-battery';
const uploadDir = mkdtempSync(join(tmpdir(), 'sakinah-test-'));

let ctx: App;
let agent: ReturnType<typeof request.agent>;
let csrf = '';

const config = loadConfig({
  NODE_ENV: 'test',
  SESSION_SECRET: 'x'.repeat(40),
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: PASSWORD,
  COOKIE_SECURE: 'false',
  DATA_DIR: ':memory:',
  UPLOAD_DIR: uploadDir,
  LOG_LEVEL: 'silent',
});

const token = (n: number) => `tok_${String(n).padStart(16, '0')}`;

beforeAll(async () => {
  const db = openDb(':memory:');
  ctx = createApp({ config, db, log: pino({ level: 'silent' }) });
  ctx.content.ensureSeeded();
  await ctx.auth.bootstrapAdmin();
  agent = request.agent(ctx.app);
});

afterAll(() => rmSync(uploadDir, { recursive: true, force: true }));

describe('health & content', () => {
  it('serves health and seeded content', async () => {
    await request(ctx.app).get('/api/health').expect(200, { ok: true });
    const res = await request(ctx.app).get('/api/content').expect(200);
    expect(res.body.content.couple.bride.nickname).toBe(defaultContent.couple.bride.nickname);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('404s unknown API routes as JSON', async () => {
    const res = await request(ctx.app).get('/api/nope').expect(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('admin auth', () => {
  it('rejects unauthenticated admin access', async () => {
    await request(ctx.app).get('/api/admin/stats').expect(401);
  });

  it('rejects wrong credentials', async () => {
    await request(ctx.app).post('/api/admin/auth/login').send({ username: 'admin', password: 'nope' }).expect(401);
    await request(ctx.app).post('/api/admin/auth/login').send({ username: 'root', password: PASSWORD }).expect(401);
  });

  it('logs in and sets an httpOnly SameSite=Strict cookie', async () => {
    const res = await agent.post('/api/admin/auth/login').send({ username: 'admin', password: PASSWORD }).expect(200);
    csrf = res.body.csrfToken;
    expect(csrf).toBeTruthy();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    await agent.get('/api/admin/auth/me').expect(200);
  });

  it('requires CSRF token on admin writes', async () => {
    await agent.post('/api/admin/guests').send({ name: 'X' }).expect(403);
    await agent.post('/api/admin/guests').set('x-csrf-token', 'wrong').send({ name: 'X' }).expect(403);
  });

  it('rejects tampered session cookies', async () => {
    await request(ctx.app).get('/api/admin/stats').set('Cookie', 'sakinah_session=s%3Afake.sig').expect(401);
  });
});

describe('content editing', () => {
  it('validates, saves, and detects conflicts', async () => {
    const { body } = await agent.get('/api/admin/content').expect(200);
    const next: InvitationContent = structuredClone(body.content);
    next.couple.bride.nickname = 'Siti';

    const bad = structuredClone(next) as unknown as { music: { src: string } };
    bad.music.src = 'javascript:alert(1)';
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: bad }).expect(400);

    const saved = await agent
      .put('/api/admin/content')
      .set('x-csrf-token', csrf)
      .send({ content: next, updatedAt: body.updatedAt })
      .expect(200);
    expect(saved.body.updatedAt).not.toBe(body.updatedAt);

    // stale updatedAt → conflict
    await agent
      .put('/api/admin/content')
      .set('x-csrf-token', csrf)
      .send({ content: next, updatedAt: body.updatedAt })
      .expect(409);

    const pub = await request(ctx.app).get('/api/content').expect(200);
    expect(pub.body.content.couple.bride.nickname).toBe('Siti');
  });
});

describe('guests & RSVP', () => {
  let code = '';
  let guestId = 0;

  it('creates a guest with an unguessable code', async () => {
    const res = await agent
      .post('/api/admin/guests')
      .set('x-csrf-token', csrf)
      .send({ name: 'Budi & Family', group: 'Friends', maxPax: 3 })
      .expect(201);
    code = res.body.code;
    guestId = res.body.id;
    expect(code).toMatch(/^[A-Za-z0-9]{10}$/);
  });

  it('resolves guest by code and tracks opens', async () => {
    const g = await request(ctx.app).get(`/api/guest/${code}`).expect(200);
    expect(g.body).toMatchObject({ name: 'Budi & Family', maxPax: 3, rsvp: null });
    await request(ctx.app).get('/api/guest/doesnotexist').expect(404);
    await request(ctx.app).post('/api/open').send({ guestCode: code }).expect(204);
    await request(ctx.app).post('/api/open').send({}).expect(204);
    const stats = await agent.get('/api/admin/stats').expect(200);
    expect(stats.body.guests).toEqual({ total: 1, opened: 1 });
    expect(stats.body.opensByDay[0].count).toBe(2);
  });

  it('caps pax at the guest limit and updates on resubmit', async () => {
    const r1 = await request(ctx.app)
      .post('/api/rsvp')
      .send({ guestCode: code, name: 'Budi', attendance: 'yes', pax: 9, clientToken: token(1) })
      .expect(201);
    expect(r1.body.pax).toBe(3);
    const r2 = await request(ctx.app)
      .post('/api/rsvp')
      .send({ guestCode: code, name: 'Budi', attendance: 'no', pax: 2, clientToken: token(2) })
      .expect(200);
    expect(r2.body).toMatchObject({ pax: 0, updated: true });
    const g = await request(ctx.app).get(`/api/guest/${code}`).expect(200);
    expect(g.body.rsvp.attendance).toBe('no');
  });

  it('keys anonymous RSVPs by browser token', async () => {
    await request(ctx.app)
      .post('/api/rsvp')
      .send({ name: 'Ani', attendance: 'yes', pax: 1, clientToken: token(1) })
      .expect(201);
    await request(ctx.app)
      .post('/api/rsvp')
      .send({ name: 'Ani', attendance: 'maybe', pax: 2, clientToken: token(1) })
      .expect(200);
    const me = await request(ctx.app).get(`/api/rsvp/me?token=${token(1)}`).expect(200);
    expect(me.body).toMatchObject({ name: 'Ani', attendance: 'maybe', pax: 2 });
    const list = await agent.get('/api/admin/rsvps').expect(200);
    expect(list.body).toHaveLength(2);
  });

  it('rejects unknown guest codes and invalid input', async () => {
    await request(ctx.app)
      .post('/api/rsvp')
      .send({ guestCode: 'unknown123', name: 'X', attendance: 'yes', pax: 1, clientToken: token(3) })
      .expect(404);
    const bad = await request(ctx.app)
      .post('/api/rsvp')
      .send({ name: '', attendance: 'sure', pax: -1, clientToken: 'short' })
      .expect(400);
    expect(bad.body.issues.length).toBeGreaterThan(1);
  });

  it('closes RSVP after the deadline', async () => {
    const { body } = await agent.get('/api/admin/content');
    const c: InvitationContent = structuredClone(body.content);
    c.rsvp.deadline = '2020-01-01T00:00:00.000Z';
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: c }).expect(200);
    await request(ctx.app)
      .post('/api/rsvp')
      .send({ name: 'Late', attendance: 'yes', pax: 1, clientToken: token(4) })
      .expect(403);
    c.rsvp.deadline = '';
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: c }).expect(200);
  });

  it('exports guests CSV with links and deletes guest cascading RSVP', async () => {
    const csv = await agent.get('/api/admin/guests/export.csv').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`/?g=${code}`);
    await agent.delete(`/api/admin/guests/${guestId}`).set('x-csrf-token', csrf).expect(200);
    const list = await agent.get('/api/admin/rsvps').expect(200);
    expect(list.body).toHaveLength(1);
  });
});

describe('wishes', () => {
  it('posts and paginates visible wishes', async () => {
    for (let i = 0; i < 12; i++) {
      await request(ctx.app).post('/api/wishes').send({ name: `G${i}`, message: `Selamat ${i}` }).expect(201);
    }
    const p1 = await request(ctx.app).get('/api/wishes?limit=5').expect(200);
    expect(p1.body.items).toHaveLength(5);
    expect(p1.body.total).toBe(12);
    expect(p1.body.items[0].name).toBe('G11');
    const p2 = await request(ctx.app).get(`/api/wishes?limit=5&cursor=${p1.body.nextCursor}`).expect(200);
    expect(p2.body.items[0].name).toBe('G6');
  });

  it('stores markup as plain text (escaped by the client)', async () => {
    const res = await request(ctx.app)
      .post('/api/wishes')
      .send({ name: '<b>x</b>', message: '<img src=x onerror=alert(1)>' })
      .expect(201);
    expect(res.body.wish.message).toBe('<img src=x onerror=alert(1)>');
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('drops honeypot submissions', async () => {
    await request(ctx.app).post('/api/wishes').send({ name: 'bot', message: 'buy', website: 'x' }).expect(400);
  });

  it('supports moderation queue', async () => {
    const { body } = await agent.get('/api/admin/content');
    const c: InvitationContent = structuredClone(body.content);
    c.wishes.requireApproval = true;
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: c }).expect(200);
    const res = await request(ctx.app).post('/api/wishes').send({ name: 'Mod', message: 'pending one' }).expect(201);
    expect(res.body.status).toBe('pending');
    const pub = await request(ctx.app).get('/api/wishes?limit=50').expect(200);
    expect(pub.body.items.find((w: { name: string }) => w.name === 'Mod')).toBeUndefined();
    await agent.patch(`/api/admin/wishes/${res.body.wish.id}`).set('x-csrf-token', csrf).send({ status: 'visible' }).expect(200);
    const pub2 = await request(ctx.app).get('/api/wishes?limit=1').expect(200);
    expect(pub2.body.items[0].name).toBe('Mod');
  });
});

describe('gifts & wishlist', () => {
  it('records gift confirmations and admin marks received', async () => {
    await request(ctx.app)
      .post('/api/gifts/confirm')
      .send({ name: 'Rina', method: 'transfer', amount: 500000, target: 'BCA' })
      .expect(201);
    const list = await agent.get('/api/admin/gifts').expect(200);
    expect(list.body[0]).toMatchObject({ name: 'Rina', amount: 500000, status: 'pending' });
    await agent
      .patch(`/api/admin/gifts/${list.body[0].id}`)
      .set('x-csrf-token', csrf)
      .send({ status: 'received', adminNote: 'thanks sent' })
      .expect(200);
    const stats = await agent.get('/api/admin/stats').expect(200);
    expect(stats.body.gifts).toEqual({ total: 1, received: 1, amountTotal: 500000 });
  });

  it('enforces wishlist quantity and per-browser claims', async () => {
    const item = await agent
      .post('/api/admin/wishlist')
      .set('x-csrf-token', csrf)
      .send({ name: 'Rice cooker', qty: 1, link: 'https://example.com/rc' })
      .expect(201);
    await agent
      .post('/api/admin/wishlist')
      .set('x-csrf-token', csrf)
      .send({ name: 'Bad link', qty: 1, link: 'javascript:alert(1)' })
      .expect(400);
    const id = item.body.id;
    await request(ctx.app).post(`/api/wishlist/${id}/claim`).send({ name: 'A', clientToken: token(10) }).expect(201);
    await request(ctx.app).post(`/api/wishlist/${id}/claim`).send({ name: 'A', clientToken: token(10) }).expect(409);
    await request(ctx.app).post(`/api/wishlist/${id}/claim`).send({ name: 'B', clientToken: token(11) }).expect(409);
    const pub = await request(ctx.app).get(`/api/wishlist?token=${token(10)}`).expect(200);
    expect(pub.body[0]).toMatchObject({ claimed: 1, mine: true });
    expect(pub.body[0]).not.toHaveProperty('claims');
    await request(ctx.app).post(`/api/wishlist/${id}/unclaim`).send({ clientToken: token(11) }).expect(404);
    await request(ctx.app).post(`/api/wishlist/${id}/unclaim`).send({ clientToken: token(10) }).expect(200);
    await request(ctx.app).post(`/api/wishlist/${id}/claim`).send({ name: 'B', clientToken: token(11) }).expect(201);
  });

  it('blocks disabled features', async () => {
    const { body } = await agent.get('/api/admin/content');
    const c: InvitationContent = structuredClone(body.content);
    c.gift.wishlistEnabled = false;
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: c }).expect(200);
    await request(ctx.app).get('/api/wishlist').expect(403);
    c.gift.wishlistEnabled = true;
    await agent.put('/api/admin/content').set('x-csrf-token', csrf).send({ content: c }).expect(200);
  });
});

describe('media', () => {
  it('re-encodes images to WebP and strips metadata', async () => {
    const jpeg = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#c99' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-gps-like-data' } } })
      .toBuffer();
    const res = await agent
      .post('/api/admin/media')
      .set('x-csrf-token', csrf)
      .attach('file', jpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body).toMatchObject({ kind: 'image', mime: 'image/webp', width: 64, height: 32 });
    const file = await request(ctx.app).get(res.body.url).buffer(true).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['cache-control']).toContain('immutable');
    expect(Buffer.from(file.body).includes('secret-gps-like-data')).toBe(false);
  });

  it('rejects HTML/SVG disguised as images', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await agent
      .post('/api/admin/media')
      .set('x-csrf-token', csrf)
      .attach('file', svg, { filename: 'x.png', contentType: 'image/png' })
      .expect(415);
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');
    await agent
      .post('/api/admin/media')
      .set('x-csrf-token', csrf)
      .attach('file', html, { filename: 'x.jpg', contentType: 'image/jpeg' })
      .expect(415);
  });

  it('refuses path traversal and unknown files', async () => {
    await request(ctx.app).get('/media/..%2F..%2Fetc%2Fpasswd').expect(404);
    await request(ctx.app).get('/media/aaaaaaaaaaaaaaaaaaaaaaaa.webp').expect(404);
  });

  it('requires auth to upload and deletes files on removal', async () => {
    await request(ctx.app).post('/api/admin/media').attach('file', Buffer.from('x'), 'x.png').expect(401);
    const list = await agent.get('/api/admin/media').expect(200);
    const before = readdirSync(uploadDir).length;
    await agent.delete(`/api/admin/media/${list.body[0].id}`).set('x-csrf-token', csrf).expect(200);
    expect(readdirSync(uploadDir).length).toBe(before - 1);
  });
});

describe('password change & logout', () => {
  it('changes password, invalidates old sessions, and logs out', async () => {
    const other = request.agent(ctx.app);
    await other.post('/api/admin/auth/login').send({ username: 'admin', password: PASSWORD }).expect(200);

    await agent
      .post('/api/admin/auth/password')
      .set('x-csrf-token', csrf)
      .send({ currentPassword: 'wrong', newPassword: 'another-long-password' })
      .expect(400);
    const res = await agent
      .post('/api/admin/auth/password')
      .set('x-csrf-token', csrf)
      .send({ currentPassword: PASSWORD, newPassword: 'another-long-password' })
      .expect(200);
    csrf = res.body.csrfToken;

    await other.get('/api/admin/stats').expect(401); // old session invalidated
    await agent.get('/api/admin/stats').expect(200); // fresh session works
    await agent.post('/api/admin/auth/logout').set('x-csrf-token', csrf).expect(200);
    await agent.get('/api/admin/stats').expect(401);
  });

  it('keeps a dashboard-changed password across restarts unless .env changes', async () => {
    await ctx.auth.bootstrapAdmin();
    expect(await ctx.auth.verifyLogin('admin', 'another-long-password')).toBe(true);
  });
});

describe('csv', () => {
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('normal')).toBe('normal');
  });
});
