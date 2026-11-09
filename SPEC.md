# Sakinah Digital Invitation — Spec

Open-source, self-hosted, mobile-first, animated semi-3D digital wedding invitation
with RSVP, wishes, gift tracking and an admin dashboard. **One wedding per deployment.**

Reference sites studied (2026-11-09): story.leafitation.com, aadigital.my.id, halbaik.my.id.

## 1. Decisions

| Topic | Decision |
|---|---|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4, Motion (framer-motion), Lenis smooth scroll, React Three Fiber + drei (lazy-loaded), react-i18next |
| Backend | Express 5 + TypeScript, zod, Drizzle ORM + better-sqlite3, argon2, helmet, express-rate-limit, pino |
| Database | SQLite (WAL mode) in a Docker volume |
| Repo layout | pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Semi-3D | Hybrid: R3F 3D envelope cover + 2.5D layered parallax sections + GPU petals |
| Default theme | Floral pastel garden (blush / sage / dusty-blue, watercolor florals, arches) |
| Languages | Indonesian (default) + English, guest-toggleable |
| Exposure | One plain HTTP port (nginx serves web and proxies `/api`); user brings own TLS/proxy |
| Tenancy | Single wedding per deploy; all content editable from the admin dashboard |

## 2. Repository layout

```
sakinah-digital-invitation/
├─ apps/
│  ├─ web/                 # React app: "/" invitation, "/admin" dashboard
│  │  ├─ src/sections/     # Cover, Opening, Couple, Countdown, Events, Story, Gallery, Gift, Rsvp, Wishes, Closing
│  │  ├─ src/three/        # R3F scenes (EnvelopeScene, Petals) — code-split
│  │  ├─ src/admin/
│  │  └─ nginx.conf
│  └─ api/                 # Express API
│     ├─ src/routes/       # public.ts, admin.ts
│     ├─ src/db/           # drizzle schema + migrations
│     └─ src/middleware/
├─ packages/shared/        # zod schemas (content + API DTOs) and types
├─ compose.yml
├─ .env.example
└─ README.md
```

## 3. Configuration split

- **`.env`** — infra and secrets only: `PUBLIC_PORT`, `PUBLIC_URL`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD` (hashed with argon2 on first boot, never stored in plaintext) or
  `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `TRUST_PROXY`, `MAX_UPLOAD_MB`, `RATE_LIMIT_*`,
  `TZ`, `LOG_LEVEL`.
- **All invitation content is editable in the admin dashboard** (decided 2026-11-09):
  couple, parents, Instagram, events, love story, gallery, gift accounts / QRIS / address,
  wishlist, music, theme colors, section toggles, texts in ID + EN, RSVP deadline,
  wish moderation, WhatsApp share template. Stored as one zod-validated JSON document
  in SQLite (`settings` table, versioned with `updated_at` for optimistic concurrency).
- **Media library** — admin uploads images (JPEG/PNG/WebP/AVIF, re-encoded to WebP with
  sharp, EXIF stripped, size-capped) and audio (MP3/OGG/M4A, magic-byte checked) into a
  `uploads` volume; served by the API under `/media/*` with `nosniff`, immutable cache and
  random filenames. Content references media by URL.
- **First boot** seeds demo content from `packages/shared/src/defaults.ts` so the site
  is presentable immediately.

## 4. Guest experience (`/`)

1. **Cover gate (3D)** — R3F envelope with wax seal, floating petals, gyro/pointer tilt
   (iOS motion-permission requested on tap). Shows couple names, date, "Kepada Yth. {guest}".
   "Buka Undangan" → seal breaks, card flies to camera, music starts, scroll unlocks.
   Fallback to 2.5D cover when WebGL unavailable / low-end / `prefers-reduced-motion`.
2. **Floating controls** — music play/pause, language toggle, section nav dots.
3. **Opening** — greeting + optional Quran verse (QS Ar-Rum 21).
4. **Bride & Groom** — arched photo frames with depth parallax, full name w/ titles, parents, Instagram.
5. **Countdown** — live days/hours/minutes/seconds; "Save the date" → `.ics` download + Google Calendar link.
6. **Events** — cards per event (Akad, Resepsi, …): date, time, venue, address;
   "Open Maps" (Google Maps URL), optional Waze, lazy embedded map iframe; per-event calendar.
7. **Love story** — scroll-driven vertical timeline with photos.
8. **Gallery** — masonry + swipeable lightbox.
9. **Livestream** (optional) — link/embed.
10. **Etiquette** (optional) — icon grid.
11. **Gift**
    - Bank / e-wallet cards with copy-to-clipboard, QRIS image (tap to enlarge).
    - Physical gift address with copy.
    - "Saya sudah mengirim hadiah" form: name, method (transfer/e-wallet/physical/other),
      optional amount, optional note → admin confirms received.
    - Wishlist registry: items (name, image, link, qty); guest claims → item marks as taken
      (name optional/public-hidden); claim is cancelable by the same browser token.
12. **RSVP** — attendance (hadir / tidak / ragu), party size (capped per guest), message.
    Pre-filled for coded guests; editable until a configurable deadline.
13. **Wishes wall** — name, message, attendance badge, relative time, paginated/infinite,
    new wishes appear live (polling or SSE). Optional moderation queue.
14. **Closing** — thanks, couple names, footer credit.

Animation rules: scroll reveals via Motion `whileInView` (fade/slide/zoom variants),
parallax via scroll-linked transforms, layered florals at different depths, all
disabled/simplified under `prefers-reduced-motion`. Target: Lighthouse mobile perf ≥ 85,
3D bundle loaded only on cover, images responsive (AVIF/WebP), audio streamed.

Desktop: invitation renders in a centered phone-width column with a blurred themed backdrop.

## 5. Guest identity

- Admin-created guests get an unguessable code (nanoid, 10 chars): `/?g=CODE`.
  Name resolved server-side; tracks first/last open + open count; RSVP linked to guest.
- Fallback `/?to=Name` (display only, sanitized, length-capped) for casual sharing.
- No code → generic "Tamu Undangan".

## 6. Admin dashboard (`/admin`)

- Login: username + argon2 password hash from `.env`; server session in SQLite,
  httpOnly + Secure + SameSite=Strict cookie, CSRF token on mutations, login rate-limit + lockout.
- **Overview**: invites opened, RSVP breakdown, expected headcount, wishes count,
  gift confirmations, wishlist progress, opens-over-time chart.
- **Guests**: CRUD, groups/tags, max pax, CSV import/export, copy link,
  "Share via WhatsApp" with editable message template, opened/RSVP status columns, search/filter.
- **RSVPs**: table + filter + CSV export.
- **Wishes**: approve/hide/delete.
- **Gifts**: confirmations list, mark received/notes; wishlist items CRUD + view claims, release claim.
- **Content editor**: every section of the invitation (texts in ID/EN, couple, events,
  story, gallery, gifts, music, theme colors, section toggles) with live preview link.
- **Media library**: upload / browse / delete images and audio.
- **Settings**: RSVP deadline, wish moderation on/off, WhatsApp template, change password.
- Mobile-friendly layout.

## 7. API (all JSON, all inputs zod-validated)

Public (`/api`):
- `GET  /content` — sanitized invitation content
- `GET  /guest/:code` — guest name/pax; records open
- `POST /rsvp` · `GET /wishes?cursor=` · `POST /wishes`
- `POST /gifts/confirm` · `GET /wishlist` · `POST /wishlist/:id/claim` · `DELETE /wishlist/:id/claim`
- `GET  /health`

Admin (`/api/admin`, session + CSRF): `auth/login|logout|me`, `stats`,
`guests` (CRUD, import, export), `rsvps`, `wishes/:id`, `gifts`, `wishlist`,
`content` (GET/PUT), `media` (list/upload/delete), `password`.
Media: `GET /media/:file` (public, served by API).

Public write protection: per-IP rate limits, honeypot field, body size limit (16 KB),
optional Turnstile, message length caps, HTML stripped on input and escaped on output.

## 8. Data model (SQLite / Drizzle)

`guests(id, code, name, group, max_pax, phone, notes, opened_at, last_opened_at, open_count, created_at)`
`rsvps(id, guest_id?, name, attendance, pax, message, client_token, created_at, updated_at)`
`wishes(id, guest_id?, name, message, attendance?, status[visible|pending|hidden], created_at)`
`gift_confirmations(id, guest_id?, name, method, amount?, note, status[pending|received], created_at)`
`wishlist_items(id, name, image_url, link, qty, sort, created_at)`
`wishlist_claims(id, item_id, guest_id?, name, client_token, created_at)`
`settings(key, value_json, updated_at)` · `media(id, filename, mime, size, width?, height?, created_at)`
`sessions(id, expires_at, csrf_token)` · `login_attempts(ip, count, locked_until)`

## 9. Docker & hardening

Services: `web` (nginx-unprivileged serving built SPA, proxies `/api` → `api`),
`api` (node:22-alpine runtime, multi-stage, prod deps only). Only `web` publishes
`${PUBLIC_PORT}`; `api` lives on an `internal: true` network.

Per service: non-root user, `read_only: true` + `tmpfs` for /tmp & nginx cache,
`cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `pids_limit`, `mem_limit`,
`cpus`, healthchecks, `restart: unless-stopped`, log rotation, `init: true`,
pinned image versions. SQLite data and uploads in named volumes.
nginx: strict CSP, HSTS (when behind TLS), `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, gzip/brotli, long-cache hashed assets, server_tokens off.
API: helmet, `trust proxy` configurable, no stack traces in prod.

## 10. Quality

- Vitest (api routes + shared schemas), Playwright e2e (open cover → RSVP → wish → admin sees it) at 390×844.
- ESLint + Prettier + `tsc --noEmit`; GitHub Actions CI (lint, typecheck, test, docker build).
- README: quick start, content editing guide, password hash helper, backup (`sqlite3 .backup`), screenshots. MIT license.

## 11. Milestones

1. Scaffold monorepo, shared schemas, example content, Docker + compose, CI.
2. API: DB schema/migrations, public routes, admin auth, admin routes, tests.
3. Invitation sections (2.5D, i18n, animations, music, maps, calendar, gifts, RSVP, wishes).
4. 3D cover (R3F envelope, petals, gyro) with fallbacks + perf tuning.
5. Admin dashboard.
6. Hardening pass, e2e, Lighthouse/a11y, README, screenshots.

## 12. Assets / licensing note

Shipped florals, illustrations and music must be self-made or permissively licensed
(no assets copied from the reference sites). Default music: a CC0 track or none, with
`content.music.src` user-supplied.
