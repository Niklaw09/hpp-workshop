// Load test: simulates N agents against your Supabase project.
//
//   npm run loadtest            (40 agents, default)
//   npm run loadtest -- 60      (60 agents)
//
// Each simulated agent opens its own Realtime connection, joins the workshop,
// follows 10 slide changes and votes once. Reports how long slide changes take
// to reach phones and whether every vote was counted.
// Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or the environment).
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first (see README).'); process.exit(1); }

const N = Number(process.argv[2] ?? 40);
const STEPS = 10;
const STEP_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = () => createClient(URL, KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } });
const pct = (arr, p) => arr.length ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : NaN;

const presenter = client();
const presenterKey = randomBytes(24).toString('base64url');
const { data: code, error } = await presenter.rpc('create_workshop', { p_title: `Load test ${new Date().toISOString()}`, p_key: presenterKey });
if (error) { console.error('Could not create workshop:', error.message); process.exit(1); }
console.log(`Workshop ${code} · connecting ${N} simulated agents…`);

const sentAt = new Map(); // slideIndex -> ms
const agents = await Promise.all(Array.from({ length: N }, async (_, i) => {
  const sb = client();
  const { data: id, error: e } = await sb.rpc('join_workshop', { p_code: code, p_first_name: `Agent${i + 1}` });
  if (e) throw new Error(`join failed: ${e.message}`);
  const agent = { sb, id, latencies: [], seen: new Set() };
  await new Promise((resolve, reject) => {
    sb.channel(`lt-${code}-${i}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshops', filter: `code=eq.${code}` }, (p) => {
        const idx = p.new.state?.slideIndex;
        if (sentAt.has(idx) && !agent.seen.has(idx)) { agent.seen.add(idx); agent.latencies.push(Date.now() - sentAt.get(idx)); }
      })
      .subscribe((s) => { if (s === 'SUBSCRIBED') resolve(); if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') reject(new Error(s)); });
  });
  return agent;
}));
console.log(`${agents.length} agents connected. Advancing ${STEPS} slides…`);
await sleep(1000);

for (let s = 1; s <= STEPS; s++) {
  sentAt.set(s, Date.now());
  const { error: e } = await presenter.rpc('presenter_update', { p_code: code, p_key: presenterKey, p_patch: { slideIndex: s } });
  if (e) console.error('update failed', e.message);
  await sleep(STEP_MS);
}

// Poll: everyone votes at once.
await presenter.rpc('presenter_update', { p_code: code, p_key: presenterKey, p_patch: { activePollId: 'load-test' } });
const t0 = Date.now();
const results = await Promise.allSettled(agents.map((a, i) =>
  a.sb.rpc('cast_vote', { p_code: code, p_poll_id: 'load-test', p_participant_id: a.id, p_option: i % 4 })
    .then(({ error: e }) => { if (e) throw new Error(e.message); })));
const voteMs = Date.now() - t0;
const { data: tally } = await presenter.from('poll_tallies').select('total').eq('workshop_code', code).eq('poll_id', 'load-test').maybeSingle();

const all = agents.flatMap((a) => a.latencies);
const missed = agents.reduce((n, a) => n + (STEPS - a.seen.size), 0);
console.log('\n── Results ─────────────────────────');
console.log(`Agents:                ${N}`);
console.log(`Slide changes:         ${STEPS} × ${N} = ${STEPS * N} deliveries, ${missed} missed`);
console.log(`Delivery latency (ms): median ${pct(all, 0.5)} · p95 ${pct(all, 0.95)} · max ${Math.max(...all)}`);
console.log(`Votes:                 ${results.filter((r) => r.status === 'fulfilled').length}/${N} accepted in ${voteMs} ms, tally total ${tally?.total}`);
const ok = missed === 0 && tally?.total === N;
console.log(ok ? '\nPASS' : '\nCHECK: some deliveries or votes were missed (see above)');
process.exit(ok ? 0 : 1);
