import express from 'express';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.listen(config.API_PORT, config.API_HOST, () => {
  console.log(`api listening on ${config.API_HOST}:${config.API_PORT}`);
});
