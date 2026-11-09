import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as schema from './schema.js';
import { migrations } from './migrations.js';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Open (or create) the SQLite database and apply pending migrations. Use ':memory:' in tests. */
export function openDb(dataDir: string): Db {
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    mkdirSync(dataDir, { recursive: true });
    file = join(resolve(dataDir), 'sakinah.db');
  }
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');
  migrate(sqlite);
  return drizzle(sqlite, { schema }) as Db;
}

function migrate(sqlite: Database.Database): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < migrations.length; v++) {
    sqlite.transaction(() => {
      sqlite.exec(migrations[v]!);
      sqlite.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export { schema };
