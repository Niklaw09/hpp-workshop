import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatClock, usePresence, usePresenterWorkshop, useTimer, useVotes } from '../hooks/useWorkshop';
import { sectionFor, slides, workshopMinutes } from '../content/slides';
import { closePoll, goToSlide, openPoll, pauseTimer, resetTimer, startTimer, toggleResults } from '../lib/controls';
import { throttle } from '../lib/throttle';
import { screenUrl } from '../lib/ids';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { PollResults } from '../components/PollResults';
import { Brand } from '../components/Brand';
import type { LiveState, PollDef, Slide } from '../types';

/** iPhone-first presenter remote. Only works on a device holding the presenter key. */
export function PresenterDashboard() {
  const { code = '' } = useParams();
  const { workshop, status, notFound, authorized, update, sendError, hasKey } = usePresenterWorkshop(code);
  const people = usePresence(code);
  const live = workshop?.state;
  const elapsed = useTimer(live);
  const [showNotes, setShowNotes] = useState(false);
  const [showList, setShowList] = useState(false);

  if (notFound) return <Message title="Workshop not found" body={`No workshop with code ${code}.`} />;
  if (!hasKey || authorized === false) {
    return <Message title="Presenter access needed"
      body="This device doesn't have the presenter key for this workshop. Scan the presenter QR code from the workshop creation screen." />;
  }
  if (!workshop || !live || authorized === null) return <Message title="Connecting…" />;

  const index = Math.min(slides.length - 1, Math.max(0, live.slideIndex));
  const slide = slides[index];
  const next = slides[index + 1];
  const section = sectionFor(slide);
  const remaining = workshopMinutes * 60_000 - elapsed;
  const following = people.filter((p) => p.mode === 'follow').length;
  const send = (patch: Partial<LiveState> | null) => { if (patch) update(patch); };

  return (
    <div className="dash">
      <header className="dash__top">
        <div className="dash__meta">
          <span className="code-pill code-pill--sm">{code}</span>
          <span className={`dot dot--${status}`} title={status} />
          <span className="dash__people">👥 {people.length} <small>· {following} live · {people.length - following} exploring</small></span>
        </div>
        <div className={`timer ${remaining < 0 ? 'timer--over' : remaining < 10 * 60_000 ? 'timer--warn' : ''}`}>
          <span className="timer__clock">{formatClock(remaining)}</span>
          <span className="timer__label">{live.timerStartedAt ? 'remaining' : elapsed ? 'paused' : `${workshopMinutes} min`}</span>
          {live.timerStartedAt
            ? <button className="chip" onClick={() => send(pauseTimer(live))}>Pause</button>
            : <button className="chip chip--go" onClick={() => send(startTimer(live))}>{elapsed ? 'Resume' : 'Start'}</button>}
          {elapsed > 0 && !live.timerStartedAt && <button className="chip" onClick={() => send(resetTimer())}>Reset</button>}
        </div>
      </header>

      {sendError && <div className="dash__error">⚠︎ {sendError}. Changes show locally and will resend when you reconnect.</div>}

      <section className="dash__now">
        <p className="dash__count">Slide {index + 1} of {slides.length}{section ? ` · Part ${section.number}` : ''}</p>
        <h1 className="dash__title">{slide.title}</h1>
        {slide.kind !== 'beforeAfter' && <Thumb slide={slide} />}
        {next && <p className="dash__next">Next: <strong>{next.title}</strong></p>}
      </section>

      <SlideControls code={code} slide={slide} live={live} send={send} />

      <section className="dash__card">
        <button className="dash__toggle" onClick={() => setShowNotes((s) => !s)} aria-expanded={showNotes}>
          {showNotes ? '▾ Hide speaker notes' : '▸ Show speaker notes'}
        </button>
        {showNotes && <p className="dash__notes">{slide.notes || 'No notes for this slide.'}</p>}
      </section>

      <section className="dash__card dash__utils">
        <label className="switch">
          <input type="checkbox" checked={live.showJoinQr} onChange={(e) => send({ showJoinQr: e.target.checked })} />
          <span>Show join QR on main screen</span>
        </label>
        <a className="btn btn--ghost btn--sm" href={screenUrl(code)} target="_blank" rel="noreferrer">Open main screen</a>
        <button className="btn btn--ghost btn--sm" onClick={() => setShowList((s) => !s)}>{showList ? 'Hide' : 'Jump to'} slide…</button>
        {showList && (
          <ol className="dash__list">
            {slides.map((s, i) => (
              <li key={s.id}><button className={i === index ? 'is-current' : ''} onClick={() => send(goToSlide(live, i))}>{i + 1}. {s.title}</button></li>
            ))}
          </ol>
        )}
      </section>

      <nav className="dash__nav">
        <button className="btn btn--prev" disabled={index === 0} onClick={() => send(goToSlide(live, index - 1))}>‹ Prev</button>
        <button className="btn btn--next" disabled={index === slides.length - 1} onClick={() => send(goToSlide(live, index + 1))}>Next ›</button>
      </nav>
    </div>
  );
}

function SlideControls({ code, slide, live, send }: { code: string; slide: Slide; live: LiveState; send: (p: Partial<LiveState> | null) => void }) {
  const sendDemo = useMemo(() => throttle((slideId: string, position: number) => send({ demo: { slideId, position } }), 120), [send]);

  if (slide.kind === 'poll') return <PollControls code={code} poll={slide.poll} live={live} send={send} />;

  if (slide.kind === 'video') {
    const cmd = (action: 'play' | 'pause' | 'restart') => send({ media: { slideId: slide.id, action, nonce: Date.now() } });
    const playing = live.media?.slideId === slide.id && live.media.action !== 'pause';
    return (
      <section className="dash__card">
        <h2 className="dash__h2">Video on main screen</h2>
        <div className="row row--fill">
          {playing
            ? <button className="btn btn--big" onClick={() => cmd('pause')}>❚❚ Pause</button>
            : <button className="btn btn--big" onClick={() => cmd('play')}>▶ Play</button>}
          <button className="btn btn--ghost btn--big" onClick={() => cmd('restart')}>↺ Restart</button>
        </div>
      </section>
    );
  }

  if (slide.kind === 'beforeAfter') {
    const pos = live.demo?.slideId === slide.id ? live.demo.position : 50;
    return (
      <section className="dash__card">
        <h2 className="dash__h2">Drag to sweep the main screen</h2>
        <BeforeAfterSlider before={slide.before} after={slide.after} position={pos} onChange={(p) => sendDemo(slide.id, p)} className="ba--dash" />
        <div className="row row--fill">
          <button className="btn btn--ghost btn--sm" onClick={() => send({ demo: { slideId: slide.id, position: 100 } })}>Before</button>
          <button className="btn btn--ghost btn--sm" onClick={() => send({ demo: { slideId: slide.id, position: 50 } })}>Split</button>
          <button className="btn btn--ghost btn--sm" onClick={() => send({ demo: { slideId: slide.id, position: 0 } })}>After</button>
        </div>
      </section>
    );
  }
  return null;
}

function PollControls({ code, poll, live, send }: { code: string; poll: PollDef; live: LiveState; send: (p: Partial<LiveState> | null) => void }) {
  const counts = useVotes(code, poll);
  const open = live.activePollId === poll.id;
  const showing = live.showResults && live.resultsPollId === poll.id;
  return (
    <section className="dash__card">
      <h2 className="dash__h2">Poll · {open ? 'voting open' : 'closed'}</h2>
      <div className="row row--fill">
        {open
          ? <button className="btn btn--big btn--warn" onClick={() => send(closePoll())}>Close voting</button>
          : <button className="btn btn--big" onClick={() => send(openPoll(poll.id))}>Open poll</button>}
        <button className={`btn btn--big ${showing ? '' : 'btn--ghost'}`} onClick={() => send(toggleResults(live, poll.id))}>
          {showing ? 'Hide results' : 'Show results'}
        </button>
      </div>
      <PollResults poll={poll} counts={counts} />
    </section>
  );
}

function Thumb({ slide }: { slide: Slide }) {
  const src = slide.kind === 'beforeAfter' ? slide.after.src
    : slide.kind === 'video' ? slide.video.poster
    : 'image' in slide ? slide.image?.src : undefined;
  return (
    <div className="thumb">
      {src ? <img src={src} alt="" /> : <div className="thumb__blank">📊</div>}
      <span className="thumb__kind">{{ title: 'Title', bullets: 'Key points', poll: 'Poll', beforeAfter: 'Before / after', video: 'Video' }[slide.kind]}</span>
    </div>
  );
}

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <main className="page join">
      <Brand />
      <div className="card join__card"><h1>{title}</h1>{body && <p className="muted">{body}</p>}<Link to="/">Back to start</Link></div>
    </main>
  );
}
