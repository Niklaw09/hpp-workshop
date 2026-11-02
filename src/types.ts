// Shared types for slides and live workshop state.

export interface MediaImage {
  src: string;
  alt: string;
  label?: string;
}

interface SlideBase {
  id: string;
  /** Section id from `sections` in content/slides.ts */
  section: string;
  title: string;
  /** Presenter-only. Hidden by default on the dashboard. */
  notes?: string;
}

export interface TitleSlide extends SlideBase {
  kind: 'title';
  subtitle?: string;
  image: MediaImage;
}

export interface BulletsSlide extends SlideBase {
  kind: 'bullets';
  bullets: string[];
  image: MediaImage;
}

export interface PollDef {
  /** Stable id. Votes are stored against it, so don't change it mid-workshop. */
  id: string;
  question: string;
  options: string[];
}

export interface PollSlide extends SlideBase {
  kind: 'poll';
  poll: PollDef;
  image?: MediaImage;
}

export interface BeforeAfterSlide extends SlideBase {
  kind: 'beforeAfter';
  caption?: string;
  before: MediaImage;
  after: MediaImage;
}

export interface VideoSlide extends SlideBase {
  kind: 'video';
  caption?: string;
  video: { src: string; poster?: string };
}

export type Slide = TitleSlide | BulletsSlide | PollSlide | BeforeAfterSlide | VideoSlide;

export interface Section {
  id: string;
  number: number;
  title: string;
}

/** Presenter-driven video command. `nonce` changes on every press so repeats are noticed. */
export interface MediaCommand {
  slideId: string;
  action: 'play' | 'pause' | 'restart';
  nonce: number;
}

/** Everything the presenter controls. Stored as one JSON object on the backend. */
export interface LiveState {
  slideIndex: number;
  /** Poll currently open for voting, or null. */
  activePollId: string | null;
  /** Show the active/most recent poll's results on the main screen and audience phones. */
  showResults: boolean;
  /** Poll whose results are being shown (stays set after voting closes). */
  resultsPollId: string | null;
  media: MediaCommand | null;
  /** Before/after slider position (0–100) set by the presenter, per slide. */
  demo: { slideId: string; position: number } | null;
  showJoinQr: boolean;
  /** ISO time the 45-minute timer started, or null when not running. */
  timerStartedAt: string | null;
  /** Milliseconds already elapsed before the current run (supports pause). */
  timerElapsedMs: number;
}

export interface Workshop {
  code: string;
  title: string;
  state: LiveState;
  /** Increments on every presenter change; used to ignore stale/out-of-order updates. */
  version: number;
}

export interface Participant {
  id: string;
  firstName: string;
}

export type AudienceMode = 'follow' | 'explore';

export interface PresenceInfo {
  id: string;
  name: string;
  mode: AudienceMode;
  slideIndex: number;
}

export type VoteCounts = number[];

export const DEFAULT_STATE: LiveState = {
  slideIndex: 0,
  activePollId: null,
  showResults: false,
  resultsPollId: null,
  media: null,
  demo: null,
  showJoinQr: false,
  timerStartedAt: null,
  timerElapsedMs: 0,
};
