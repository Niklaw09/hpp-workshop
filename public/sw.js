// Minimal offline cache for the presentation.
//  • /media/* and built assets: cache-first (fast, works offline once loaded).
//  • Pages: network-first, falling back to the cached app shell.
//  • Supabase/API traffic is never cached.
const CACHE = 'hpp-workshop-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('/index.html', res.clone())); return res; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(url.pathname);
      if (hit) return req.headers.has('range') ? rangeResponse(hit, req.headers.get('range')) : hit;
      const res = await fetch(url.pathname);
      if (res.ok && res.status === 200) c.put(url.pathname, res.clone());
      return res;
    }).catch(() => fetch(req)));
  }
});

// Video players (Safari especially) ask for byte ranges. Slice them out of the cached file.
async function rangeResponse(res, header) {
  const blob = await res.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(header || '');
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
