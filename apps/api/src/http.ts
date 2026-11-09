import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError, type ZodType, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Parse and validate `data` with a zod schema; throws ZodError → 400. */
export function parse<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const e = err as { type?: string; status?: number; code?: string };
  if (e.type === 'entity.too.large' || e.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' });
    return;
  }
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    res.status(e.status).json({ error: 'Bad request' });
    return;
  }
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};

/** CSV cell escaping incl. formula-injection guard for spreadsheet apps. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Plain numbers/phone numbers ("+62 812-3456") can't carry a formula; leave them intact.
  const numeric = /^[+-]?\d[\d\s().-]*$/.test(s);
  if (!numeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]): void {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  // BOM so Excel opens UTF-8 correctly.
  res.send(`\uFEFF${body}`);
}
