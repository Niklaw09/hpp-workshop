import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { backend, isDemoMode } from '../sync';
import { joinUrl, presenterKeyStore, presenterUrl, randomPresenterKey, screenUrl } from '../lib/ids';
import { presentationTitle, presenterBrand, slides } from '../content/slides';
import { Brand } from '../components/Brand';

interface Created { code: string; key: string; title: string }

function recent(): Created[] {
  try { return JSON.parse(localStorage.getItem('hpp:recent') ?? '[]'); } catch { return []; }
}
function remember(c: Created) {
  try { localStorage.setItem('hpp:recent', JSON.stringify([c, ...recent().filter((r) => r.code !== c.code)].slice(0, 5))); } catch { /* ignore */ }
}

export function CreateWorkshop() {
  const [title, setTitle] = useState(presentationTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const past = recent();

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const key = randomPresenterKey();
      const code = await backend.createWorkshop(title.trim() || presentationTitle, key);
      presenterKeyStore.set(code, key);
      const c = { code, key, title: title.trim() || presentationTitle };
      remember(c);
      setCreated(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the workshop.');
    } finally { setBusy(false); }
  };

  if (created) {
    const { code, key } = created;
    return (
      <main className="page create">
        <Brand />
        <header className="create__head">
          <p className="eyebrow">Workshop ready</p>
          <h1>Session code <span className="code-pill">{code}</span></h1>
          <p className="muted">{created.title}</p>
        </header>

        <section className="create__grid">
          <div className="card">
            <p className="card__step">1 · Your iPhone</p>
            <h2>Presenter controls</h2>
            <p className="muted">Scan with your phone's camera. This link carries your private presenter key, so don't share it.</p>
            <div className="qr-box"><QRCodeSVG value={presenterUrl(code, key)} size={168} marginSize={2} /></div>
            <Link className="btn btn--ghost" to={`/present/${code}`} target="_blank">Open dashboard here</Link>
          </div>

          <div className="card">
            <p className="card__step">2 · TV or projector</p>
            <h2>Main screen</h2>
            <p className="muted">Open on the computer connected to the display, then press <kbd>F</kbd> for full screen. Arrow keys work as a backup remote.</p>
            <a className="btn" href={screenUrl(code)} target="_blank" rel="noreferrer">Open main screen</a>
            {isDemoMode ? null : (
              <p className="tiny muted">On a different computer? Open the presenter link there once so arrow keys work.</p>
            )}
          </div>

          <div className="card">
            <p className="card__step">3 · Agents</p>
            <h2>Audience join link</h2>
            <p className="muted">Shown on the title slide. Agents scan, type their first name, and they're in.</p>
            <div className="qr-box"><QRCodeSVG value={joinUrl(code)} size={168} marginSize={2} /></div>
            <div className="row">
              <a className="btn btn--ghost" href={joinUrl(code)} target="_blank" rel="noreferrer">Open as an agent</a>
              <button className="btn btn--ghost" onClick={() => { navigator.clipboard?.writeText(joinUrl(code)); setCopied(true); }}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </section>

        {isDemoMode && <DemoNotice />}
        <button className="link-btn" onClick={() => { setCreated(null); setCopied(false); }}>Create another workshop</button>
      </main>
    );
  }

  return (
    <main className="page create">
      <Brand />
      <header className="create__hero">
        <img src="/media/hero-exterior.jpg" alt="" />
        <div>
          <p className="eyebrow">{presenterBrand} · Live workshop</p>
          <h1>Start a workshop</h1>
          <p className="muted">{slides.length} slides · agents follow along on their phones</p>
        </div>
      </header>

      <form className="card create__form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <label htmlFor="title">Workshop name</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <button className="btn btn--lg" disabled={busy}>{busy ? 'Creating…' : 'Create workshop'}</button>
        {error && <p className="error">{error}</p>}
      </form>

      {past.length > 0 && (
        <section className="card recent">
          <h2>Recent on this device</h2>
          <ul>
            {past.map((r) => (
              <li key={r.code}>
                <span><strong>{r.code}</strong> · {r.title}</span>
                <span className="row">
                  <Link to={`/present/${r.code}`}>Present</Link>
                  <a href={screenUrl(r.code)} target="_blank" rel="noreferrer">Screen</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted center">Joining as an agent? <Link to="/join">Enter a code</Link></p>
      {isDemoMode && <DemoNotice />}
    </main>
  );
}

function DemoNotice() {
  return (
    <aside className="notice">
      <strong>Demo Mode.</strong> No backend is connected, so sync works between tabs of this one browser only.
      Connect Supabase (see README) to use real phones.
    </aside>
  );
}
