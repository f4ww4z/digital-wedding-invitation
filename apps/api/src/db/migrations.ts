/**
 * Forward-only SQL migrations, tracked with `PRAGMA user_version`.
 * Append new entries; never edit an existing one after release.
 * Must stay in sync with ./schema.ts.
 */
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const migrations: string[] = [
  /* 1: initial schema */ `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE TABLE admin (
    id INTEGER PRIMARY KEY,
    password_hash TEXT NOT NULL,
    env_fingerprint TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE TABLE guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    max_pax INTEGER NOT NULL DEFAULT 2,
    notes TEXT NOT NULL DEFAULT '',
    open_count INTEGER NOT NULL DEFAULT 0,
    first_opened_at TEXT,
    last_opened_at TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE UNIQUE INDEX guests_code_uq ON guests(code);
  CREATE TABLE open_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX open_events_created_idx ON open_events(created_at);
  CREATE TABLE rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER REFERENCES guests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    attendance TEXT NOT NULL CHECK (attendance IN ('yes','no','maybe')),
    pax INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT '',
    client_token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    updated_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE UNIQUE INDEX rsvps_guest_uq ON rsvps(guest_id);
  CREATE UNIQUE INDEX rsvps_token_uq ON rsvps(client_token) WHERE guest_id IS NULL;
  CREATE TABLE wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    attendance TEXT CHECK (attendance IN ('yes','no','maybe')),
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','pending','hidden')),
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX wishes_status_idx ON wishes(status, id);
  CREATE TABLE gift_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('transfer','ewallet','physical','other')),
    amount INTEGER,
    target TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received')),
    admin_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE TABLE wishlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE TABLE wishlist_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
    guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    client_token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE UNIQUE INDEX wishlist_claims_item_token_uq ON wishlist_claims(item_id, client_token);
  CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('image','audio')),
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    original_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  `,
];
