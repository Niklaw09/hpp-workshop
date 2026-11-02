// The one interface the UI talks to. Two implementations:
//  • supabaseBackend — real devices over Supabase Realtime (production)
//  • localBackend    — Demo Mode: tabs of one browser via BroadcastChannel (no setup)
import type { LiveState, Participant, PresenceInfo, VoteCounts, Workshop } from '../types';

export type Unsubscribe = () => void;
export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface PresenceHandle {
  update(info: Omit<PresenceInfo, 'id' | 'name'>): void;
  leave(): void;
}

export interface Backend {
  readonly kind: 'supabase' | 'local';

  /** Creates a workshop and returns its public code. `presenterKey` is kept secret by the presenter. */
  createWorkshop(title: string, presenterKey: string): Promise<string>;
  getWorkshop(code: string): Promise<Workshop | null>;
  /** Calls `onChange` with the latest workshop whenever the presenter changes anything. */
  subscribeWorkshop(code: string, onChange: (w: Workshop) => void, onStatus?: (s: ConnectionStatus) => void): Unsubscribe;
  verifyPresenter(code: string, presenterKey: string): Promise<boolean>;
  /** Merges `patch` into the live state. Rejected unless the presenter key matches. */
  updateState(code: string, presenterKey: string, patch: Partial<LiveState>): Promise<Workshop>;

  joinWorkshop(code: string, firstName: string): Promise<Participant>;
  trackPresence(code: string, me: PresenceInfo): PresenceHandle;
  subscribePresence(code: string, onChange: (people: PresenceInfo[]) => void): Unsubscribe;

  castVote(code: string, pollId: string, participantId: string, optionIndex: number): Promise<void>;
  getMyVote(code: string, pollId: string, participantId: string): Promise<number | null>;
  /** Live counts per option for one poll. */
  subscribeVotes(code: string, pollId: string, optionCount: number, onChange: (counts: VoteCounts) => void): Unsubscribe;
}
