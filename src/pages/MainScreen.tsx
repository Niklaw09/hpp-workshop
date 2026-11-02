import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePresenterWorkshop, useVotes } from '../hooks/useWorkshop';
import { allMediaUrls, findPoll, slides } from '../content/slides';
import { SlideView } from '../components/SlideView';
import { PollResults } from '../components/PollResults';
import { JoinCard } from '../components/JoinCard';
import { Brand } from '../components/Brand';
import { closePoll, goToSlide, openPoll, toggleResults } from '../lib/controls';
import { throttle } from '../lib/throttle';
import type { PollDef } from '../types';

/** Full-screen display for a TV, projector or smart board. */
export function MainScreen() {
  const { code = '' } = useParams();
  const { workshop, status, notFound, authorized, update } = usePresenterWorkshop(code);
  const live = workshop?.state;
  const [hint, setHint] = useState(true);

  // Warm the cache with every image/video so the deck keeps working if Wi-Fi drops.
  useEffect(() => {
    for (const url of allMediaUrls()) {
      if (/\.(mp4|webm|mov)$/i.test(url)) fetch(url).catch(() => {});
      else { const img = new Image(); img.src = url; }
    }
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => window.clearTimeout(t);
  }, []);

  const canControl = authorized === true;

  // Keyboard backup remote
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (!live || !canControl) return;
      const slide = slides[live.slideIndex];
      const poll = slide?.kind === 'poll' ? slide.poll : undefined;
      let patch = null;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) patch = goToSlide(live, live.slideIndex + 1);
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) patch = goToSlide(live, live.slideIndex - 1);
      else if (e.key === 'Home') patch = goToSlide(live, 0);
      else if (e.key === 'End') patch = goToSlide(live, slides.length - 1);
      else if (e.key === 'q' || e.key === 'Q') patch = { showJoinQr: !live.showJoinQr };
      else if ((e.key === 'p' || e.key === 'P') && poll) patch = live.activePollId === poll.id ? closePoll() : openPoll(poll.id);
      else if ((e.key === 'r' || e.key === 'R') && (poll || live.resultsPollId)) patch = toggleResults(live, poll?.id ?? live.resultsPollId!);
      else return;
      e.preventDefault();
      if (patch) update(patch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, canControl, update]);

  const sendDemo = useMemo(() => throttle((slideId: string, position: number) => update({ demo: { slideId, position } }), 120), [update]);
  const onDemo = useCallback((slideId: string, p: number) => sendDemo(slideId, p), [sendDemo]);

  if (notFound) return <div className="screen screen--empty"><h1>Workshop not found</h1></div>;
  if (!workshop || !live) return <div className="screen screen--empty"><Brand /><p>Connecting…</p></div>;

  const index = Math.min(slides.length - 1, Math.max(0, live.slideIndex));
  const slide = slides[index];
  const resultsPoll = live.showResults ? findPoll(live.resultsPollId) : undefined;
  const resultsOnSlide = slide.kind === 'poll' && resultsPoll?.id === slide.poll.id;

  return (
    <div className="screen">
      <div key={slide.id} className="screen__slide fade-in">
        <SlideView
          slide={slide}
          variant="screen"
          live={live}
          titleExtra={<JoinCard code={code} />}
          onDemoChange={canControl ? onDemo : undefined}
          pollArea={slide.kind === 'poll' ? <ScreenPoll code={code} poll={slide.poll} open={live.activePollId === slide.poll.id} showResults={resultsOnSlide} /> : undefined}
        />
      </div>

      {resultsPoll && !resultsOnSlide && (
        <div className="overlay"><div className="overlay__card"><h2>{resultsPoll.question}</h2><LiveResults code={code} poll={resultsPoll} /></div></div>
      )}
      {live.showJoinQr && (
        <div className="overlay"><div className="overlay__card overlay__card--join"><JoinCard code={code} size="lg" /></div></div>
      )}

      <footer className="screen__foot">
        <Brand compact />
        <span>Join at <strong>/join</strong> · code <strong>{code}</strong></span>
        <span>{index + 1} / {slides.length}</span>
        {status === 'offline' && <span className="screen__offline">Offline · running locally</span>}
      </footer>
      {hint && (
        <div className="screen__hint">
          {canControl ? 'Keyboard: ← → slides · P poll · R results · Q join code · F full screen' : 'Display only · press F for full screen'}
        </div>
      )}
    </div>
  );
}

function ScreenPoll({ code, poll, open, showResults }: { code: string; poll: PollDef; open: boolean; showResults: boolean }) {
  const counts = useVotes(code, poll);
  const total = counts.reduce((a, b) => a + b, 0);
  if (showResults) return <PollResults poll={poll} counts={counts} size="lg" />;
  return (
    <div className="screen-poll">
      <ol className="screen-poll__options">
        {poll.options.map((o, i) => <li key={i}><span>{String.fromCharCode(65 + i)}</span>{o}</li>)}
      </ol>
      <p className={`screen-poll__status ${open ? 'is-open' : ''}`}>
        {open ? <><i /> Vote now on your phone · <strong>{total}</strong> {total === 1 ? 'vote' : 'votes'}</> : 'Poll opens in a moment'}
      </p>
    </div>
  );
}

function LiveResults({ code, poll }: { code: string; poll: PollDef }) {
  const counts = useVotes(code, poll);
  return <PollResults poll={poll} counts={counts} size="lg" />;
}
