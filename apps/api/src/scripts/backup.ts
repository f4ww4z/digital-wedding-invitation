/**
 * Consistent online backup of the SQLite database (safe while the app is running).
 *   docker compose exec api node dist/scripts/backup.js
 * Writes /data/backups/invitation-<timestamp>.db and prints the path.
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DB_FILE } from '../db/index.js';

const dataDir = resolve(process.env.DATA_DIR ?? './data');
const outDir = join(dataDir, 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(outDir, `invitation-${stamp}.db`);

const db = new Database(join(dataDir, DB_FILE), { readonly: true, fileMustExist: true });
db.backup(out)
  .then(() => {
    db.close();
    process.stdout.write(`${out}\n`);
  })
  .catch((err: unknown) => {
    db.close();
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
