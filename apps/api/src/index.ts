import { pino } from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';

async function main() {
  const config = loadConfig();
  const log = pino({ level: config.LOG_LEVEL, base: undefined });

  const db = openDb(config.DATA_DIR);
  const { app, auth, content } = createApp({ config, db, log });
  content.ensureSeeded();
  await auth.bootstrapAdmin();

  const prune = setInterval(() => auth.pruneExpired(), 60 * 60 * 1000);
  prune.unref();

  const server = app.listen(config.API_PORT, config.API_HOST, () => {
    log.info(`API listening on ${config.API_HOST}:${config.API_PORT}`);
  });
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;

  const shutdown = (signal: string) => {
    log.info(`${signal} received, shutting down`);
    server.close(() => {
      db.$client.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
