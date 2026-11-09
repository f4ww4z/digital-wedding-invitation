import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(now),
});

export const admin = sqliteTable('admin', {
  id: integer('id').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  /** sha256 of the env-provided credential last applied; lets .env changes reset the password. */
  envFingerprint: text('env_fingerprint').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(now),
});

export const sessions = sqliteTable('sessions', {
  /** sha256 of the opaque session token; the raw token only lives in the cookie. */
  idHash: text('id_hash').primaryKey(),
  csrfToken: text('csrf_token').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(now),
});

export const guests = sqliteTable(
  'guests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    group: text('group_name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    maxPax: integer('max_pax').notNull().default(2),
    notes: text('notes').notNull().default(''),
    openCount: integer('open_count').notNull().default(0),
    firstOpenedAt: text('first_opened_at'),
    lastOpenedAt: text('last_opened_at'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [uniqueIndex('guests_code_uq').on(t.code)],
);

export const openEvents = sqliteTable(
  'open_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guestId: integer('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('open_events_created_idx').on(t.createdAt)],
);

export const rsvps = sqliteTable(
  'rsvps',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guestId: integer('guest_id').references(() => guests.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    attendance: text('attendance', { enum: ['yes', 'no', 'maybe'] }).notNull(),
    pax: integer('pax').notNull().default(0),
    message: text('message').notNull().default(''),
    clientToken: text('client_token').notNull(),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('rsvps_guest_uq').on(t.guestId),
    uniqueIndex('rsvps_token_uq').on(t.clientToken).where(sql`guest_id IS NULL`),
  ],
);

export const wishes = sqliteTable(
  'wishes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    guestId: integer('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    message: text('message').notNull(),
    attendance: text('attendance', { enum: ['yes', 'no', 'maybe'] }),
    status: text('status', { enum: ['visible', 'pending', 'hidden'] })
      .notNull()
      .default('visible'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('wishes_status_idx').on(t.status, t.id)],
);

export const giftConfirmations = sqliteTable('gift_confirmations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').references(() => guests.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  method: text('method', { enum: ['transfer', 'ewallet', 'physical', 'other'] }).notNull(),
  amount: integer('amount'),
  target: text('target').notNull().default(''),
  note: text('note').notNull().default(''),
  status: text('status', { enum: ['pending', 'received'] }).notNull().default('pending'),
  adminNote: text('admin_note').notNull().default(''),
  createdAt: text('created_at').notNull().default(now),
});

export const wishlistItems = sqliteTable('wishlist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  link: text('link').notNull().default(''),
  qty: integer('qty').notNull().default(1),
  sort: integer('sort').notNull().default(0),
  createdAt: text('created_at').notNull().default(now),
});

export const wishlistClaims = sqliteTable(
  'wishlist_claims',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    itemId: integer('item_id')
      .notNull()
      .references(() => wishlistItems.id, { onDelete: 'cascade' }),
    guestId: integer('guest_id').references(() => guests.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    clientToken: text('client_token').notNull(),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [uniqueIndex('wishlist_claims_item_token_uq').on(t.itemId, t.clientToken)],
);

export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull().unique(),
  kind: text('kind', { enum: ['image', 'audio'] }).notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  originalName: text('original_name').notNull().default(''),
  createdAt: text('created_at').notNull().default(now),
});

export const loginThrottle = sqliteTable('login_throttle', {
  id: integer('id').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: text('locked_until'),
});
