// Workshop codes, presenter keys and small browser-storage helpers.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

export function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/** 192-bit random secret, URL-safe. Only the presenter ever sees it. */
export function randomPresenterKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: ignore */ }
}

export const presenterKeyStore = {
  get: (code: string) => safeGet(`hpp:presenter:${code}`),
  set: (code: string, key: string) => safeSet(`hpp:presenter:${code}`, key),
};

// Per-tab (sessionStorage) so each browser tab can be a separate agent while testing.
// A refresh keeps the agent signed in; a brand-new tab asks for a first name again.
export const participantStore = {
  get(code: string): { id: string; firstName: string } | null {
    try {
      const raw = sessionStorage.getItem(`hpp:participant:${code}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(code: string, p: { id: string; firstName: string }) {
    try { sessionStorage.setItem(`hpp:participant:${code}`, JSON.stringify(p)); } catch { /* ignore */ }
  },
};

/** Base URL for links/QR codes. Set VITE_PUBLIC_URL to your deployed site so phones can reach it. */
export function publicBaseUrl(): string {
  const env = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  return (env || window.location.origin).replace(/\/$/, '');
}

export function joinUrl(code: string) { return `${publicBaseUrl()}/join/${code}`; }
export function presenterUrl(code: string, key: string) { return `${publicBaseUrl()}/present/${code}#k=${key}`; }
export function screenUrl(code: string) { return `${publicBaseUrl()}/screen/${code}`; }
