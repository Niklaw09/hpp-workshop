import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { backend } from '../sync';
import { normalizeCode, participantStore } from '../lib/ids';
import { Brand } from '../components/Brand';
import { AudienceView } from './AudienceView';
import type { Participant } from '../types';

/** /join (enter a code) and /join/:code (first name → live view). */
export function Join() {
  const { code: raw } = useParams();
  const code = raw ? normalizeCode(raw) : '';
  const [me, setMe] = useState<Participant | null>(() => (code ? participantStore.get(code) : null));

  useEffect(() => { setMe(code ? participantStore.get(code) : null); }, [code]);

  if (!code) return <EnterCode />;
  if (!me) return <EnterName code={code} onJoined={setMe} />;
  return <AudienceView code={code} me={me} />;
}

function EnterCode() {
  const [value, setValue] = useState('');
  const nav = useNavigate();
  return (
    <main className="page join">
      <Brand />
      <form className="card join__card" onSubmit={(e) => { e.preventDefault(); if (value) nav(`/join/${normalizeCode(value)}`); }}>
        <h1>Join the workshop</h1>
        <label htmlFor="code">Session code</label>
        <input id="code" className="input--code" value={value} autoFocus autoComplete="off" autoCapitalize="characters"
          placeholder="ABC123" onChange={(e) => setValue(normalizeCode(e.target.value))} />
        <button className="btn btn--lg" disabled={value.length < 4}>Continue</button>
      </form>
    </main>
  );
}

function EnterName({ code, onJoined }: { code: string; onJoined: (p: Participant) => void }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend.getWorkshop(code).then((w) => (w ? setTitle(w.title) : setMissing(true))).catch(() => {});
  }, [code]);

  const join = async () => {
    const first = name.trim().split(/\s+/)[0]?.slice(0, 40);
    if (!first) return;
    setBusy(true); setError(null);
    try {
      const p = await backend.joinWorkshop(code, first);
      participantStore.set(code, p);
      onJoined(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join. Check your connection.');
    } finally { setBusy(false); }
  };

  return (
    <main className="page join">
      <Brand />
      <form className="card join__card" onSubmit={(e) => { e.preventDefault(); join(); }}>
        {missing ? (
          <>
            <h1>Workshop not found</h1>
            <p className="muted">Code <strong>{code}</strong> doesn't match a live workshop. Check the code on the screen.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">You're joining</p>
            <h1>{title ?? 'Live workshop'}</h1>
            <label htmlFor="name">Your first name</label>
            <input id="name" value={name} autoFocus autoComplete="given-name" maxLength={40}
              placeholder="e.g. Jordan" onChange={(e) => setName(e.target.value)} />
            <button className="btn btn--lg" disabled={!name.trim() || busy}>{busy ? 'Joining…' : 'Join'}</button>
            <p className="tiny muted">No account needed. Your screen will follow the presenter.</p>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
