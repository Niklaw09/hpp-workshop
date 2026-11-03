# Get a live link that works on phones

A one-time setup of about 15 minutes. After it, every change pushed to GitHub (by Bolt or by Claude) updates the
live site automatically.

## Part A · Supabase (live sync between phones), about 8 minutes

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. Click **New project**. Name it `hpp-workshop`, set a database password (save it somewhere), and pick the region
   closest to where you'll present. Click **Create new project** and wait about 2 minutes.
3. In the left sidebar, click **SQL Editor** → **New query**.
4. Open `supabase/migrations/20261102000000_live_workshop.sql` from the GitHub repo, copy all of it, paste it in, and
   click **Run**. You should see "Success. No rows returned."
5. In the left sidebar, click **Project Settings** (gear) → **API**. Keep this tab open. You need two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string starting with `eyJ…`)

## Part B · Netlify (the live link), about 5 minutes

1. Go to **app.netlify.com** → sign in with GitHub.
2. Click **Add new site** → **Import an existing project** → **GitHub** → pick **Niklaw09/hpp-workshop**.
3. Netlify fills in the build settings from `netlify.toml`. Don't change them.
4. Before deploying, click **Add environment variables** and add two:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
5. Click **Deploy**. After about a minute you get a link like `https://something.netlify.app`.
   To pick a nicer name, go to **Site configuration** → **Change site name**.

## Part C · Test with real phones

1. Open your Netlify link on your laptop. The yellow "Demo Mode" box should be **gone**, which means Supabase is connected.
2. Click **Create workshop** → **Open main screen**.
3. Scan the **presenter QR** with your iPhone.
4. Scan the **audience QR** with one or two other phones, or a friend's.
5. Run the 9-step checklist in `README.md`.

## Using Bolt alongside this

Bolt and Netlify both use the same GitHub repo. When you make changes in Bolt, push them to GitHub (the GitHub icon at
the top right of Bolt), and Netlify updates the live link. Before you ask Claude for changes, push from Bolt first so you
don't both edit the same version.

If you also want Bolt's preview to use Supabase, add the same two values to a `.env` file in Bolt
(see `.env.example`).
