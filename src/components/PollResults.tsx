import type { PollDef, VoteCounts } from '../types';

/** Live horizontal bar chart. Used on the main screen, the dashboard and phones. */
export function PollResults({ poll, counts, size = 'md' }: { poll: PollDef; counts: VoteCounts; size?: 'md' | 'lg' }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  return (
    <div className={`results results--${size}`}>
      {poll.options.map((opt, i) => {
        const n = counts[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const lead = n > 0 && n === max;
        return (
          <div key={i} className={`results__row ${lead ? 'results__row--lead' : ''}`}>
            <div className="results__label"><span>{opt}</span><strong>{pct}%</strong></div>
            <div className="results__track"><div className="results__bar" style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div>
          </div>
        );
      })}
      <p className="results__total">{total} {total === 1 ? 'vote' : 'votes'}</p>
    </div>
  );
}
