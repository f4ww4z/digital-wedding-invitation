import type { ApiError } from '@wedding/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.error ?? `Request failed (${status})`);
  }
}

let csrfToken = '';
export const setCsrfToken = (t: string) => {
  csrfToken = t;
};

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const method = (init.method ?? 'GET').toUpperCase();
  if (csrfToken && method !== 'GET' && path.startsWith('/api/admin')) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const res = await fetch(path, { ...init, method, headers, body, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  const data: unknown = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiRequestError(res.status, (typeof data === 'object' ? data : null) as ApiError | null);
  return data as T;
}

/** First validation issue or the error message, for toasts. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.body?.issues?.[0]?.message ?? e.message;
  return e instanceof Error ? e.message : String(e);
}
