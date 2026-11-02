// Demo Mode backend: no server. State lives in localStorage and changes are broadcast
// to every tab of the same browser with BroadcastChannel. Great for testing sync in
// Bolt.new's preview (open several tabs), but phones on other devices can't connect.
import type { Backend, PresenceHandle } from './backend';
import { DEFAULT_STATE, type LiveState, type PresenceInfo, type Workshop } from '../types';
import { randomCode, randomId, sha256Hex } from '../lib/ids';

interface StoredWorkshop extends Workshop { keyHash: string }
type Votes = Record<string, Record<string, number>>; // pollId -> participantId -> option

type Msg =
  | { t: 'workshop'; w: Workshop }
  | { t: 'votes'; pollId: string }
  | { t: 'presence'; info: PresenceInfo; at: number }
  | { t: 'presence-leave'; id: string }
  | { t: 'presence-hello' };

const wsKey = (c: string) => `hpp-local:ws:${c}`;
const votesKey = (c: string) => `hpp-local:votes:${c}`;

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown) { localStorage.setItem(key, JSON.stringify(v)); }
function publicView(w: StoredWorkshop): Workshop {
  return { code: w.code, title: w.title, state: w.state, version: w.version };
}

// One BroadcastChannel per workshop per tab, plus in-tab listeners (a channel never
// delivers to its own sender).
const channels = new Map<string, BroadcastChannel>();
const listeners = new Map<string, Set<(m: Msg) => void>>();

function channel(code: string) {
  let ch = channels.get(code);
  if (!ch) {
    ch = new BroadcastChannel(`hpp-local-${code}`);
    ch.onmessage = (e) => listeners.get(code)?.forEach((fn) => fn(e.data as Msg));
    channels.set(code, ch);
  }
  return ch;
}
function listen(code: string, fn: (m: Msg) => void) {
  channel(code);
  if (!listeners.has(code)) listeners.set(code, new Set());
  listeners.get(code)!.add(fn);
  return () => { listeners.get(code)?.delete(fn); };
}
function emit(code: string, m: Msg) {
  channel(code).postMessage(m);
  listeners.get(code)?.forEach((fn) => fn(m));
}

const PRESENCE_BEAT_MS = 4000;
const PRESENCE_TTL_MS = 11000;

export const localBackend: Backend = {
  kind: 'local',

  async createWorkshop(title, presenterKey) {
    let code = randomCode();
    while (read(wsKey(code))) code = randomCode();
    const w: StoredWorkshop = { code, title, state: { ...DEFAULT_STATE }, version: 1, keyHash: await sha256Hex(presenterKey) };
    write(wsKey(code), w);
    return code;
  },

  async getWorkshop(code) {
    const w = read<StoredWorkshop>(wsKey(code));
    return w ? publicView(w) : null;
  },

  subscribeWorkshop(code, onChange, onStatus) {
    onStatus?.('online');
    const w = read<StoredWorkshop>(wsKey(code));
    if (w) onChange(publicView(w));
    return listen(code, (m) => { if (m.t === 'workshop') onChange(m.w); });
  },

  async verifyPresenter(code, key) {
    const w = read<StoredWorkshop>(wsKey(code));
    return !!w && w.keyHash === (await sha256Hex(key));
  },

  async updateState(code, key, patch) {
    const w = read<StoredWorkshop>(wsKey(code));
    if (!w) throw new Error('Workshop not found');
    if (w.keyHash !== (await sha256Hex(key))) throw new Error('Not authorized');
    const next: StoredWorkshop = { ...w, state: { ...w.state, ...patch } as LiveState, version: w.version + 1 };
    write(wsKey(code), next);
    const pub = publicView(next);
    emit(code, { t: 'workshop', w: pub });
    return pub;
  },

  async joinWorkshop(code, firstName) {
    if (!read(wsKey(code))) throw new Error('Workshop not found. Check the code and try again.');
    return { id: randomId(), firstName };
  },

  trackPresence(code, me): PresenceHandle {
    let info = me;
    const beat = () => emit(code, { t: 'presence', info, at: Date.now() });
    beat();
    const timer = window.setInterval(beat, PRESENCE_BEAT_MS);
    const off = listen(code, (m) => { if (m.t === 'presence-hello') beat(); });
    const leave = () => { window.clearInterval(timer); off(); emit(code, { t: 'presence-leave', id: info.id }); };
    window.addEventListener('pagehide', leave, { once: true });
    return {
      update(partial) { info = { ...info, ...partial }; beat(); },
      leave,
    };
  },

  subscribePresence(code, onChange) {
    const seen = new Map<string, { info: PresenceInfo; at: number }>();
    const publish = () => onChange([...seen.values()].map((v) => v.info));
    const off = listen(code, (m) => {
      if (m.t === 'presence') { seen.set(m.info.id, { info: m.info, at: m.at }); publish(); }
      if (m.t === 'presence-leave') { seen.delete(m.id); publish(); }
    });
    const sweep = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, v] of seen) if (now - v.at > PRESENCE_TTL_MS) { seen.delete(id); changed = true; }
      if (changed) publish();
    }, 2000);
    emit(code, { t: 'presence-hello' });
    publish();
    return () => { off(); window.clearInterval(sweep); };
  },

  async castVote(code, pollId, participantId, optionIndex) {
    const w = read<StoredWorkshop>(wsKey(code));
    if (!w || w.state.activePollId !== pollId) throw new Error('This poll is closed.');
    const votes = read<Votes>(votesKey(code)) ?? {};
    votes[pollId] = { ...(votes[pollId] ?? {}), [participantId]: optionIndex };
    write(votesKey(code), votes);
    emit(code, { t: 'votes', pollId });
  },

  async getMyVote(code, pollId, participantId) {
    return read<Votes>(votesKey(code))?.[pollId]?.[participantId] ?? null;
  },

  subscribeVotes(code, pollId, optionCount, onChange) {
    const publish = () => {
      const counts = new Array(optionCount).fill(0);
      const v = read<Votes>(votesKey(code))?.[pollId] ?? {};
      for (const idx of Object.values(v)) if (idx >= 0 && idx < optionCount) counts[idx]++;
      onChange(counts);
    };
    publish();
    return listen(code, (m) => { if (m.t === 'votes' && m.pollId === pollId) publish(); });
  },
};
