import { useCallback, useEffect, useRef, useState } from 'react';
import { backend, type ConnectionStatus } from '../sync';
import { presenterKeyStore } from '../lib/ids';
import type { LiveState, PollDef, PresenceInfo, VoteCounts, Workshop } from '../types';

/** Live, read-only view of a workshop. Every audience phone, screen and dashboard uses this. */
export function useWorkshop(code: string) {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setWorkshop(null); setNotFound(false);
    backend.getWorkshop(code).then((w) => { if (alive && !w) setNotFound(true); }).catch(() => {});
    const off = backend.subscribeWorkshop(
      code,
      (w) => { if (alive) { setNotFound(false); setWorkshop((prev) => (prev && prev.version > w.version ? prev : w)); } },
      (s) => alive && setStatus(s),
    );
    return () => { alive = false; off(); };
  }, [code]);

  return { workshop, setWorkshop, status, notFound };
}

/** Reads the presenter key from the URL (#k=...) or this device's storage, then strips it from the URL. */
function takePresenterKey(code: string): string | null {
  const m = window.location.hash.match(/k=([A-Za-z0-9_-]+)/);
  if (m) {
    presenterKeyStore.set(code, m[1]);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return m[1];
  }
  return presenterKeyStore.get(code);
}

/**
 * Presenter view of a workshop: same live data, plus `update()`.
 * Changes show instantly (an optimistic overlay), then go to the backend, which merges
 * them and broadcasts to everyone. If the network drops, the overlay keeps the main
 * screen working locally; it's cleared once the server has caught up.
 */
export function usePresenterWorkshop(code: string) {
  const live = useWorkshop(code);
  const [key] = useState(() => takePresenterKey(code));
  const [authorized, setAuthorized] = useState<boolean | null>(key ? null : false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Partial<LiveState> | null>(null);
  const pending = useRef(0);

  useEffect(() => {
    if (!key) return;
    backend.verifyPresenter(code, key).then(setAuthorized).catch(() => setAuthorized(null));
  }, [code, key]);

  const { setWorkshop } = live;
  const update = useCallback(async (patch: Partial<LiveState>) => {
    if (!key) return;
    setOverlay((o) => ({ ...(o ?? {}), ...patch }));
    pending.current++;
    try {
      const w = await backend.updateState(code, key, patch);
      setSendError(null);
      setWorkshop((prev) => (prev && prev.version > w.version ? prev : w));
      if (--pending.current === 0) setOverlay(null);
    } catch (e) {
      pending.current--;
      setSendError(e instanceof Error ? e.message : 'Could not reach the server');
    }
  }, [code, key, setWorkshop]);

  // Back online after a dropped connection: push whatever the presenter did offline.
  useEffect(() => {
    if (live.status === 'online' && overlay && pending.current === 0 && sendError) update(overlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.status]);

  const workshop = live.workshop && overlay ? { ...live.workshop, state: { ...live.workshop.state, ...overlay } } : live.workshop;
  return { ...live, workshop, authorized, update, sendError, hasKey: !!key };
}

export function useVotes(code: string, poll: PollDef | undefined): VoteCounts {
  const [counts, setCounts] = useState<VoteCounts>([]);
  useEffect(() => {
    if (!poll) { setCounts([]); return; }
    return backend.subscribeVotes(code, poll.id, poll.options.length, setCounts);
  }, [code, poll]);
  return counts;
}

export function usePresence(code: string): PresenceInfo[] {
  const [people, setPeople] = useState<PresenceInfo[]>([]);
  useEffect(() => backend.subscribePresence(code, setPeople), [code]);
  return people;
}

/** Elapsed milliseconds of the 45-minute timer, ticking once a second. */
export function useTimer(state: LiveState | undefined): number {
  const [now, setNow] = useState(Date.now());
  const running = !!state?.timerStartedAt;
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  if (!state) return 0;
  const base = state.timerElapsedMs ?? 0;
  return state.timerStartedAt ? base + Math.max(0, now - Date.parse(state.timerStartedAt)) : base;
}

export function formatClock(ms: number): string {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const str = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return neg ? `-${str}` : str;
}
