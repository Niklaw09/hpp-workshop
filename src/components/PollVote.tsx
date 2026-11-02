import { useEffect, useState } from 'react';
import { backend } from '../sync';
import type { PollDef } from '../types';

interface Props { code: string; poll: PollDef; participantId: string; open: boolean }

/** Multiple-choice voting for one agent. They can change their answer while the poll is open. */
export function PollVote({ code, poll, participantId, open }: Props) {
  const [mine, setMine] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    backend.getMyVote(code, poll.id, participantId).then((v) => alive && setMine(v)).catch(() => {});
    return () => { alive = false; };
  }, [code, poll.id, participantId]);

  const vote = async (i: number) => {
    if (!open) return;
    setSending(i); setError(null);
    try { await backend.castVote(code, poll.id, participantId, i); setMine(i); }
    catch (e) { setError(e instanceof Error ? e.message : 'Vote not sent. Try again.'); }
    finally { setSending(null); }
  };

  return (
    <div className="vote">
      <p className="vote__q">{poll.question}</p>
      <div className="vote__options">
        {poll.options.map((opt, i) => (
          <button
            key={i}
            className={`vote__opt ${mine === i ? 'vote__opt--mine' : ''}`}
            disabled={!open || sending !== null}
            onClick={() => vote(i)}
          >
            <span className="vote__letter">{String.fromCharCode(65 + i)}</span>
            <span>{opt}</span>
            {mine === i && <span className="vote__check" aria-label="Your answer">✓</span>}
          </button>
        ))}
      </div>
      <p className="vote__status" aria-live="polite">
        {error ?? (!open ? (mine !== null ? 'Voting closed. Thanks!' : 'Voting opens when the presenter starts the poll.')
          : mine !== null ? 'Got it! Tap another answer to change it.' : 'Tap an answer to vote.')}
      </p>
    </div>
  );
}
