/**
 * Print an argon2id hash for ADMIN_PASSWORD_HASH.
 * Usage: pnpm --filter @wedding/api hash-password  (reads password from stdin)
 *    or: docker compose run --rm api node dist/scripts/hash-password.js
 */
import argon2 from 'argon2';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
process.stderr.write('Password: ');
rl.once('line', async (pw) => {
  rl.close();
  if (pw.length < 10) {
    process.stderr.write('\nPassword must be at least 10 characters.\n');
    process.exit(1);
  }
  const hash = await argon2.hash(pw, { type: argon2.argon2id });
  process.stdout.write(`${hash}\n`);
});
