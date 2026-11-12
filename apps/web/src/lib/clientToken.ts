/** A random per-browser id so guests can edit their own RSVP / undo their own wishlist claim. */
const KEY = 'invitation.clientToken';

function random(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let memo: string | null = null;
export function clientToken(): string {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY);
    if (!memo || !/^[A-Za-z0-9_-]{16,64}$/.test(memo)) {
      memo = random();
      localStorage.setItem(KEY, memo);
    }
  } catch {
    memo ??= random();
  }
  return memo;
}

export function rememberName(name?: string): string {
  try {
    if (name !== undefined) localStorage.setItem('invitation.name', name);
    return localStorage.getItem('invitation.name') ?? '';
  } catch {
    return name ?? '';
  }
}
