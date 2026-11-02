# Real Estate Marketing in 2027 · Live Workshop (prototype)

The first milestone for High Point Perspective's interactive workshop platform: five sample slides with live
sync across a presenter's iPhone, a main screen, and agents' phones.

**What's in it**

| Piece | Route | What it does |
|---|---|---|
| Workshop creation | `/` | Creates a session code and private presenter key. Shows QR codes for the presenter and the audience. |
| Presenter dashboard (iPhone) | `/present/CODE` | Big Prev/Next, slide number and title, 45-min timer, speaker notes (hidden by default), poll controls, video controls, before/after control, join-QR toggle, live head count (live vs exploring). |
| Main screen (TV/projector) | `/screen/CODE` | Full-screen slides, join QR on the title slide, live poll results, presenter-driven video and before/after. Keyboard backup remote. |
| Audience (phones) | `/join/CODE` | First name only. Starts in **Live Follow**. Swiping or tapping ‹ › switches to **Explore Mode**. **Catch Up Live** jumps back and resumes following. Poll notifications show as a small banner that doesn't move them. |

Five slides (`src/content/slides.ts`): title, key points, a poll, a before/after slider, and a demo video.

---

## 1 · Run it in Bolt.new (no setup, Demo Mode)

1. Import the project into Bolt.new (see "Getting the code into Bolt" below). Bolt runs `npm install` and `npm run dev`.
2. With no Supabase keys, the app runs in **Demo Mode**: everything syncs between **tabs of the same browser**
   (BroadcastChannel and localStorage). This is the fastest way to test sync logic.
3. In the Bolt preview, click **Open in new tab** (↗) so the app runs at its own URL, then:
   - Click **Create workshop**.
   - Click **Open dashboard here**. Optionally press F12 and turn on the iPhone device toolbar.
   - Click **Open main screen**.
   - Click **Open as an agent** 2 or 3 times. Each tab is a separate agent, so use a different first name in each.

> Demo Mode can't reach real phones. A Bolt preview URL only works inside your own browser. For phones, go to step 2.

### Sync test checklist

| # | Do this | Expect |
|---|---|---|
| 1 | Tap **Next** on the dashboard | Screen and every agent tab move together. The dashboard shows "3 · 3 live". |
| 2 | In agent tab B, tap **‹** | Agent B shows **Exploring** and a green **Catch Up Live** button. |
| 3 | Tap **Next** twice on the dashboard | Other agents follow. Agent B **doesn't move**. The button reads "slide 3". The dashboard shows "1 exploring". |
| 4 | On the poll slide, tap **Open poll** | Agent B gets a small "A poll is open · Answer" banner. Answer opens a sheet, and voting there leaves B's slide alone. |
| 5 | Vote from every agent, then tap **Show results** | Bars update live on the screen, the dashboard, and the phones. |
| 6 | Tap **Catch Up Live** on agent B | B jumps to the presenter's slide and follows again. |
| 7 | On the before/after slide, drag the slider on the dashboard | The main screen sweeps to match. Agents can still drag their own copy. |
| 8 | Click the main screen and press **→** | Everyone advances. The keyboard is the backup remote. |
| 9 | On the video slide, tap **▶ Play** | The video plays on the main screen. Click the screen once if the browser asks for sound. |

Main-screen keys: `← →` / PageUp/PageDown / Space = slides · `P` open/close poll · `R` show/hide results ·
`Q` join QR · `F` full screen. Keys only work in a browser that holds the presenter key, meaning the one that
created the workshop or opened the presenter link.

---

## 2 · Connect Supabase (real phones, many devices)

Supabase gives you Postgres plus Realtime, and its free tier is enough for this.

1. **Create a project** at supabase.com, or click **Supabase → Connect** in Bolt to create and link one.
2. **Create the tables.** Open the Supabase dashboard → **SQL Editor**, paste all of
   `supabase/migrations/20261102000000_live_workshop.sql`, and click **Run**. It's safe to run again.
   If Bolt offers to apply the migration for you, that works too.
3. **Set env vars.** Bolt's Supabase connection fills these in for you. Otherwise, copy `.env.example` to `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   Both values are under Project Settings → API. Restart the dev server after changing `.env`.
4. The yellow "Demo Mode" notice disappears from the start page. You're now on Supabase.

### Test with real phones

1. In Bolt, click **Deploy** (Netlify). `public/_redirects` is included so links like `/join/ABC123` work.
2. Open the deployed URL on a laptop, create a workshop, and open the main screen.
3. Scan the **presenter QR** with your iPhone. Your key travels in the link, then the app saves it and removes it from the address bar.
4. Scan the **audience QR** with two or three other phones, or use private windows on the laptop. Run the checklist above.

Optional: set `VITE_PUBLIC_URL` to the deployed address if you create workshops from a different URL and still want QR codes to point at the live site.

### Load test (40+ agents)

From Bolt's terminal, or any terminal with the `.env` filled in:

```
npm run loadtest          # 40 simulated agents
npm run loadtest -- 60    # 60
```

It creates a throwaway workshop, connects N separate Realtime clients, advances 10 slides, has everyone vote at
once, and prints delivery latency (median/p95/max), missed updates, and whether every vote was counted.

---

## Getting the code into Bolt

- **GitHub (recommended):** push this folder to a GitHub repo, then open
  `https://bolt.new/~/github.com/OWNER/REPO` or use Bolt's GitHub import.
- Or start a blank Vite + React + TypeScript project in Bolt and upload these files into it, keeping the same folder layout.

Everything is plain npm and JavaScript (Vite 5, React 18, TypeScript, react-router, supabase-js, qrcode.react,
@fontsource). There are no native binaries, so it runs in Bolt's WebContainers.

---

## Editing content

All slides live in **`src/content/slides.ts`**. Each slide is a plain object:

```ts
{ id: 'my-slide', kind: 'bullets', section: 'social', title: '…', bullets: ['…'], image: { src: '/media/x.jpg', alt: '…' }, notes: '…' }
```

- Kinds: `title`, `bullets`, `poll`, `beforeAfter`, `video`. Adding a new kind means adding a type in `src/types.ts` and a case in `src/components/SlideView.tsx`.
- **Media:** drop files into `public/media/` and point `src` at `/media/…`. The current images and video are generated placeholders.
- Poll `id`s must be unique, because votes are stored against them.
- The six workshop sections are already defined in the same file.

Reusable components: `BeforeAfterSlider` (use it for day-to-twilight and virtual staging too, just swap images and labels),
`PollVote`, `PollResults`, `VideoDemo`, `JoinCard`.

---

## How sync works

```
 Presenter iPhone ──presenter_update(code, key, patch)──▶  Supabase Postgres  (workshops.state JSON)
 Main screen (keys) ─┘                                        │ Realtime (postgres_changes)
                                                             ▼
                            Main screen · Dashboard · every agent phone
 Agents ──join_workshop / cast_vote──▶ poll_tallies ──Realtime──▶ results bars
 Agents ──Realtime Presence (live / exploring)──▶ dashboard head count
```

- **One live state object per workshop:** slide index, open poll, results on/off, video command, before/after position, timer.
  The presenter sends small *patches* that the server merges, so two presenter devices don't overwrite each other's fields.
  A version number drops stale or out-of-order updates.
- **Agent navigation never touches the server.** In Live Follow the phone *displays* the presenter's slide. In Explore Mode
  it shows the agent's own index, which only the agent changes. Presenter updates can't overwrite Explore Mode.
- **Reconnects:** when a phone wakes up, comes back online, or the socket resubscribes, it refetches the latest state.
- **Security:** the presenter key is a 192-bit random secret, and only its SHA-256 hash is stored, in a table clients can't read.
  Every write goes through `SECURITY DEFINER` functions that check it. Clients can read only workshop state and vote *totals*.
  First names and individual votes stay private.
- **Offline:** the deployed site registers `public/sw.js`, which caches the app and everything in `/media/`. The main screen
  preloads every slide's media. If Wi-Fi drops, the screen keeps working and arrow keys still change slides locally. Changes
  resend when the connection returns. Audience sync needs connectivity. The service worker is off in dev and Bolt preview.

### Project layout

```
src/
  content/slides.ts        ← all presentation content
  types.ts                 ← slide + live-state types
  sync/backend.ts          ← the one interface the UI uses
  sync/supabaseBackend.ts  ← production (Supabase Realtime)
  sync/localBackend.ts     ← Demo Mode (tabs of one browser)
  hooks/useWorkshop.ts     ← live state, presenter updates, votes, presence, timer
  lib/controls.ts          ← presenter actions (shared by dashboard + keyboard)
  components/              ← SlideView, BeforeAfterSlider, PollVote, PollResults, VideoDemo, JoinCard
  pages/                   ← CreateWorkshop, Join, AudienceView, PresenterDashboard, MainScreen
supabase/migrations/       ← database schema + functions
scripts/load-test.mjs      ← 40-agent load test
public/media/              ← placeholder photos + video (replace freely)
```

## Known limits (prototype)

- Each browser *tab* counts as one agent, which makes testing easy. Reopening the QR link in a new tab asks for the first name again.
- Anyone with the anon key can list workshop titles and codes. They can't control anything or see names. Fine for a prototype, but worth tightening before public launch.
- No workshop end/cleanup yet. Old rows stay in Supabase.
