// Presenter actions shared by the iPhone dashboard and the main screen's keyboard backup.
import { slides } from '../content/slides';
import type { LiveState } from '../types';

export function goToSlide(state: LiveState, index: number): Partial<LiveState> | null {
  const i = Math.min(slides.length - 1, Math.max(0, index));
  if (i === state.slideIndex) return null;
  // Clear video commands (so they don't replay later) and any overlays from the previous slide.
  return { slideIndex: i, media: null, showResults: false, showJoinQr: false };
}

export function openPoll(pollId: string): Partial<LiveState> {
  return { activePollId: pollId, resultsPollId: pollId, showResults: false };
}

export function closePoll(): Partial<LiveState> {
  return { activePollId: null };
}

export function toggleResults(state: LiveState, pollId: string): Partial<LiveState> {
  const showing = state.showResults && state.resultsPollId === pollId;
  return { showResults: !showing, resultsPollId: pollId };
}

export function startTimer(state: LiveState): Partial<LiveState> {
  return state.timerStartedAt ? {} : { timerStartedAt: new Date().toISOString() };
}
export function pauseTimer(state: LiveState): Partial<LiveState> {
  if (!state.timerStartedAt) return {};
  return { timerStartedAt: null, timerElapsedMs: state.timerElapsedMs + (Date.now() - Date.parse(state.timerStartedAt)) };
}
export function resetTimer(): Partial<LiveState> {
  return { timerStartedAt: null, timerElapsedMs: 0 };
}
