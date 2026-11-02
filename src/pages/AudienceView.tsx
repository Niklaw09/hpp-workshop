import { useEffect, useRef, useState } from 'react';
import { useVotes, useWorkshop } from '../hooks/useWorkshop';
import { backend } from '../sync';
import { findPoll, slides } from '../content/slides';
import { SlideView } from '../components/SlideView';
import { PollVote } from '../components/PollVote';
import { PollResults } from '../components/PollResults';
import { Brand } from '../components/Brand';
import type { AudienceMode, Participant, PollDef } from '../types';

const clamp = (i: number) => Math.min(slides.length - 1, Math.max(0, i));

type Toast = { kind: 'poll' | 'results'; pollId: string } | null;

/**
 * The agent's phone.
 *  • Live Follow: shows the presenter's slide.
 *  • Explore: the agent's own position. Presenter changes never touch it.
 *  • Catch Up Live: back to the presenter's slide and following again.
 */
export function AudienceView({ code, me }: { code: string; me: Participant }) {
  const { workshop, status, notFound } = useWorkshop(code);
  const live = workshop?.state;
  const liveIndex = clamp(live?.slideIndex ?? 0);

  const [mode, setMode] = useState<AudienceMode>('follow');
  const [exploreIndex, setExploreIndex] = useState(0);
  const index = mode === 'follow' ? liveIndex : exploreIndex; // derived: following never writes exploreIndex
  const slide = slides[index];

  const [toast, setToast] = useState<Toast>(null);
  const [sheetPoll, setSheetPoll] = useState<string | null>(null);

  // ── Navigation ──
  const go = (delta: number) => {
    const next = clamp(index + delta);
    if (next === index) return;
    setExploreIndex(next);
    setMode('explore');
  };
  const catchUp = () => { setMode('follow'); setToast(null); };

  // ── Presence: tell the presenter who's here and whether they're live or exploring ──
  const presence = useRef<ReturnType<typeof backend.trackPresence> | null>(null);
  useEffect(() => {
    presence.current = backend.trackPresence(code, { id: me.id, name: me.firstName, mode: 'follow', slideIndex: 0 });
    return () => presence.current?.leave();
  }, [code, me.id, me.firstName]);
  useEffect(() => { presence.current?.update({ mode, slideIndex: index }); }, [mode, index]);

  // ── Unobtrusive notifications when a poll opens or results go up ──
  const prev = useRef<{ poll: string | null; results: boolean } | null>(null);
  useEffect(() => {
    if (!live) return;
    const was = prev.current;
    prev.current = { poll: live.activePollId, results: live.showResults };
    if (!was) return; // don't notify for whatever was already open when we joined
    const viewing = slide.kind === 'poll' ? slide.poll.id : null;
    if (live.activePollId && live.activePollId !== was.poll && live.activePollId !== viewing) {
      setToast({ kind: 'poll', pollId: live.activePollId });
      navigator.vibrate?.(30);
    } else if (live.showResults && !was.results && live.resultsPollId && live.resultsPollId !== viewing) {
      setToast({ kind: 'results', pollId: live.resultsPollId });
    }
    if (!live.activePollId && toast?.kind === 'poll') setToast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.activePollId, live?.showResults, live?.resultsPollId]);
  useEffect(() => { if (toast && slide.kind === 'poll' && slide.poll.id === toast.pollId) setToast(null); }, [slide, toast]);

  // ── Swipe left/right (ignored on sliders, videos and buttons) ──
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.ba, video, button, input')) { touch.current = null; return; }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  if (notFound) {
    return <main className="page join"><Brand /><div className="card join__card"><h1>Workshop ended</h1><p className="muted">This workshop is no longer available.</p></div></main>;
  }
  if (!workshop || !live) {
    return <main className="page join"><Brand /><p className="muted center">Connecting…</p></main>;
  }

  const pollFor = (p: PollDef) => <PhonePoll code={code} poll={p} me={me} open={live.activePollId === p.id}
    showResults={live.showResults && live.resultsPollId === p.id} />;

  return (
    <div className="aud">
      <header className="aud__bar">
        <Brand compact />
        <span className="aud__hello">Hi, {me.firstName}</span>
        {mode === 'follow'
          ? <span className="pill pill--live"><i /> Live</span>
          : <span className="pill pill--explore">Exploring</span>}
      </header>
      {status === 'offline' && <div className="aud__offline">Reconnecting… you can keep browsing.</div>}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.kind === 'poll' ? '📊 A poll is open' : '📈 Poll results are in'}</span>
          <button className="toast__go" onClick={() => { setSheetPoll(toast.pollId); setToast(null); }}>
            {toast.kind === 'poll' ? 'Answer' : 'View'}
          </button>
          <button className="toast__x" aria-label="Dismiss" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <main className="aud__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={slide.id} className="fade-in">
          <SlideView slide={slide} variant="phone" live={live} pollArea={slide.kind === 'poll' ? pollFor(slide.poll) : undefined} />
        </div>
      </main>

      <footer className="aud__nav">
        {mode === 'explore' && (
          <button className="btn btn--live" onClick={catchUp}>
            <i /> Catch Up Live <span>· slide {liveIndex + 1}</span>
          </button>
        )}
        <div className="aud__nav-row">
          <button className="btn btn--nav" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide">‹</button>
          <span className="aud__count">{index + 1} / {slides.length}</span>
          <button className="btn btn--nav" onClick={() => go(1)} disabled={index === slides.length - 1} aria-label="Next slide">›</button>
        </div>
      </footer>

      {sheetPoll && findPoll(sheetPoll) && (
        <div className="sheet" onClick={(e) => { if (e.target === e.currentTarget) setSheetPoll(null); }}>
          <div className="sheet__panel">
            <button className="sheet__close" onClick={() => setSheetPoll(null)} aria-label="Close">✕</button>
            {pollFor(findPoll(sheetPoll)!)}
            <p className="tiny muted center">Your place in the slides hasn't changed.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PhonePoll({ code, poll, me, open, showResults }: { code: string; poll: PollDef; me: Participant; open: boolean; showResults: boolean }) {
  const counts = useVotes(code, showResults ? poll : undefined);
  return (
    <div className="phone-poll">
      <PollVote code={code} poll={poll} participantId={me.id} open={open} />
      {showResults && <PollResults poll={poll} counts={counts} />}
    </div>
  );
}
