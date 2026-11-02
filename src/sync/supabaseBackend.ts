// Production backend: Supabase Postgres + Realtime.
//  • Live state: one row per workshop in `workshops`; phones subscribe to its changes.
//  • Presenter writes: `presenter_update` RPC, checked against a hashed presenter key.
//  • Who's here: Realtime Presence (also reports each agent's Live/Explore mode).
//  • Polls: `cast_vote` RPC; everyone subscribes to aggregated `poll_tallies`.
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend, PresenceHandle } from './backend';
import { DEFAULT_STATE, type PresenceInfo, type Workshop } from '../types';
import { randomId } from '../lib/ids';

interface WorkshopRow { code: string; title: string; state: Record<string, unknown>; version: number }

function toWorkshop(row: WorkshopRow): Workshop {
  return { code: row.code, title: row.title, version: Number(row.version), state: { ...DEFAULT_STATE, ...(row.state ?? {}) } };
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

function countsFrom(raw: Record<string, number> | null | undefined, n: number) {
  const counts = new Array(n).fill(0);
  for (const [k, v] of Object.entries(raw ?? {})) { const i = Number(k); if (i >= 0 && i < n) counts[i] = Number(v); }
  return counts;
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  async function fetchWorkshop(code: string): Promise<Workshop | null> {
    const { data, error } = await sb.from('workshops').select('code,title,state,version').eq('code', code).maybeSingle();
    fail(error);
    return data ? toWorkshop(data as WorkshopRow) : null;
  }

  return {
    kind: 'supabase',

    async createWorkshop(title, presenterKey) {
      const { data, error } = await sb.rpc('create_workshop', { p_title: title, p_key: presenterKey });
      fail(error);
      return data as string;
    },

    getWorkshop: fetchWorkshop,

    subscribeWorkshop(code, onChange, onStatus) {
      let latest = 0;
      const deliver = (w: Workshop | null) => {
        if (w && w.version >= latest) { latest = w.version; onChange(w); }
      };
      const refetch = () => fetchWorkshop(code).then(deliver).catch(() => onStatus?.('offline'));

      onStatus?.('connecting');
      const ch: RealtimeChannel = sb
        .channel(`ws-${code}-${randomId()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workshops', filter: `code=eq.${code}` },
          (payload) => deliver(toWorkshop(payload.new as WorkshopRow)))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') { onStatus?.('online'); refetch(); } // refetch fills any gap while disconnected
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus?.('offline');
        });

      // Phones sleep and drop sockets. Re-sync whenever the page comes back.
      const onVisible = () => { if (document.visibilityState === 'visible') refetch(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', refetch);
      refetch();

      return () => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('online', refetch);
        sb.removeChannel(ch);
      };
    },

    async verifyPresenter(code, presenterKey) {
      const { data, error } = await sb.rpc('verify_presenter', { p_code: code, p_key: presenterKey });
      fail(error);
      return data === true;
    },

    async updateState(code, presenterKey, patch) {
      const { data, error } = await sb.rpc('presenter_update', { p_code: code, p_key: presenterKey, p_patch: patch });
      fail(error);
      return toWorkshop(data as WorkshopRow);
    },

    async joinWorkshop(code, firstName) {
      const { data, error } = await sb.rpc('join_workshop', { p_code: code, p_first_name: firstName });
      fail(error);
      return { id: data as string, firstName };
    },

    trackPresence(code, me): PresenceHandle {
      let info = me;
      let ready = false;
      const ch = sb.channel(`presence-${code}`, { config: { presence: { key: me.id } } });
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { ready = true; ch.track(info); }
      });
      return {
        update(partial) { info = { ...info, ...partial }; if (ready) ch.track(info); },
        leave() { ch.untrack().finally(() => sb.removeChannel(ch)); },
      };
    },

    subscribePresence(code, onChange) {
      const ch = sb.channel(`presence-${code}`);
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<PresenceInfo>();
        const people = Object.values(state).map((metas) => metas[metas.length - 1]).filter(Boolean) as PresenceInfo[];
        onChange(people);
      }).subscribe();
      return () => { sb.removeChannel(ch); };
    },

    async castVote(code, pollId, participantId, optionIndex) {
      const { error } = await sb.rpc('cast_vote', { p_code: code, p_poll_id: pollId, p_participant_id: participantId, p_option: optionIndex });
      fail(error);
    },

    async getMyVote(code, pollId, participantId) {
      const { data, error } = await sb.rpc('get_my_vote', { p_code: code, p_poll_id: pollId, p_participant_id: participantId });
      fail(error);
      return typeof data === 'number' ? data : null;
    },

    subscribeVotes(code, pollId, optionCount, onChange) {
      const load = async () => {
        const { data } = await sb.from('poll_tallies').select('counts').eq('workshop_code', code).eq('poll_id', pollId).maybeSingle();
        onChange(countsFrom((data?.counts as Record<string, number>) ?? null, optionCount));
      };
      const ch = sb
        .channel(`tally-${code}-${pollId}-${randomId()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_tallies', filter: `workshop_code=eq.${code}` },
          (payload) => {
            const row = payload.new as { poll_id?: string; counts?: Record<string, number> };
            if (row?.poll_id === pollId) onChange(countsFrom(row.counts, optionCount));
          })
        .subscribe((status) => { if (status === 'SUBSCRIBED') load(); });
      load();
      return () => { sb.removeChannel(ch); };
    },
  };
}
