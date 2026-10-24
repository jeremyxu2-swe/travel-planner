# Travel Planner

A mobile-friendly trip itinerary app (React + Vite + Supabase). People sign up with an email and password, and their trips sync across their devices.

Without Supabase settings (no `.env.local`) it runs in a local-only mode with no login, saving to the browser — handy for trying things out.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). To try it on your phone, run
`npm run dev -- --host` and open the "Network" URL on a phone on the same Wi‑Fi.

`npm run build` creates the finished site in `dist/`.

---

## Turn on sync across devices (Supabase, free tier)

About 10 minutes, one time.

### 1. Create a Supabase project
1. Sign up at **supabase.com** and click **New project**. Pick any name and region, and save the database password somewhere (you won't need it for this app).
2. Wait a minute or two for it to finish setting up.

### 2. Create the tables
1. In your project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it in, and click **Run**.
   You should see "Success. No rows returned". This creates the `trips`, `activities` and `todos` tables, with rules so each person can only see their own data.

### 3. Email confirmation (on by default — leave it on)
New accounts get one email with a confirmation link. After clicking it once, signing in is just email and password.
You can check the setting under **Authentication** → **Sign In / Providers** → **Email** → **Confirm email**.

The link in that email goes to your **Site URL** (next step), so set that correctly or the link will point to the wrong place.

### 4. Set your site address (used by confirmation and password-reset emails)
1. Go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to where the app lives, e.g. `https://your-site.netlify.app` (use `http://localhost:5173` until you deploy).
3. Under **Redirect URLs**, add both:
   - `http://localhost:5173/**`
   - `https://your-site.netlify.app/**` (your real address, once you have it)

### 5. Connect the app
1. In Supabase, click **Connect** (top of the project page), or go to **Project Settings → API**. Copy the **Project URL** and the **anon / publishable key**. This key is meant to be public; the database rules from step 2 keep your data private.
2. In this folder, copy `.env.example` to a new file named `.env.local` and paste the two values in:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   (or sb_publishable_...)
   ```
3. Stop `npm run dev` (Ctrl+C) and start it again.

### 6. Create your account
Open the app — you'll see the login page. Choose **Create account**, enter your email and a password (8+ characters), then click the confirmation link in the email. Open it in the same browser and you're signed in; otherwise just sign in. If the email doesn't arrive, the app has a **Resend confirmation email** button.

- **Your first account on a device that already has trips** (e.g. the Chicago trip you've been editing): those trips are copied into the account. So create your account first in the browser where your trips are.
- **Each new device:** sign in and your trips load from your account.
- **Forgot password?** on the login page emails a reset link; opening it lets you choose a new password.
- **Other people** can sign up too — each account only sees its own trips. Data left on a device by one account is never copied into another.
- Changes save to the cloud within a second. The status next to the filters (desktop) or on the Trips page shows **Synced**, **Saving…** or **Offline**. If you're offline, changes stay on the device and are sent when you're back online (or when you tap **Retry**).
- Edits made on another device show up when you switch back to the tab.
- **Sign out** (trip menu at top left on desktop, or Trips page) clears the copy on that device; your trips stay in your account.

> Supabase's built-in email sender only allows a few emails per hour (used for password resets, and confirmations if that's on). If you hit the limit, wait a bit or connect your own email service under Authentication → Emails → SMTP.

### Deploying with sync on
The two `VITE_SUPABASE_…` values are built into the site when you run `npm run build`:

- **Netlify Drop (drag and drop):** make sure `.env.local` exists, run `npm run build`, then drag `dist` onto app.netlify.com/drop.
- **Netlify or Vercel connected to GitHub:** `.env.local` is not uploaded to GitHub (on purpose), so add the same two variables in the site's settings (Netlify: Site configuration → Environment variables; Vercel: Settings → Environment Variables), then redeploy.

Then add your live address to the Supabase **Site URL / Redirect URLs** (step 4).

---

## Updating the database after an app update

Some updates add new tables or columns (v0.5 added **stays** and map positions for activities; v0.6 added **cities per day**; v0.11 added **your own activity types**; v0.15 added **sharing trips**; v0.17 added **deleting your account**). When that happens, open `supabase/schema.sql`, paste the whole file into Supabase → **SQL Editor**, and click **Run** again. It's safe to run any number of times and keeps your data.
If you forget, the app shows **Database update needed**; your changes stay on the device until you run it.

## What's in the app

- **Week view (desktop):** one column per day; drag a card onto another day to move it. Overlapping times are flagged in red.
- **Day view:** a timeline with start/end times, free-time gaps you can fill, and the day's stops in order with an "Open route" link to Google Maps.
- **Map view:** each day's stops with Google Maps links.
- **Phone layout (under 760px wide):** day chips, a vertical timeline, a bottom tab bar (Itinerary · Map · To-do · Trips), and a + button that opens the add form from the bottom of the screen.
- **Stays (hotels):** a "Stay" row under the day headers. Drag across the days you're staying somewhere to add a hotel (check-in on the first day, check-out on the last). Drag a bar to move it, drag its ends to change dates, click it for details. Check-in and check-out times (default 3 PM / 11 AM) show as purple markers in the calendar.
- **Cities & countries:** each date shows the city you're in (travel days show "Tokyo → Kyoto"), with a colored band above grouping the days by country. Click a city (or "+ City") to set it: search a city, set the first and last day, and optionally a short label like "TYO". On phones, each day chip shows the short label and a banner above the day says e.g. "Kyoto, Japan · Day 2 of 3 in Kyoto · Seoul tomorrow".
- **Type guessing:** as you type a name, the app guesses the type from words like "dinner", "museum" or "hotel", and suggests matching places from OpenStreetMap (searched near the trip's destination). Picking a suggestion fills in the address and the type ("Louvre" → museum → Sight). Choosing a type yourself always wins. No API key needed.
- **Ideas:** activities with no day yet (or trips with no dates) are kept as ideas.
- **To-do list** for each trip, and a **Trips** page grouped into upcoming, planning and past.
- **Backup:** Trips page → Export / Import backup (JSON).

## Project layout

```
src/
  App.jsx               layout + app state (desktop vs phone)
  state.js              reducer, localStorage persistence, export/import
  sync.js               Supabase sync: sends only what changed, pulls on focus, retries
  lib/supabase.js       Supabase client (reads .env.local)
  seed.js               starting data
  categories.js         activity types (color + icon)
  lib/time.js           time & date helpers
  lib/schedule.js       sorting, overlap detection, free gaps, Google Maps links
  components/           UI pieces (AuthPage, WeekView, DayAgenda, ActivitySheet, Cloud, ...)
  styles.css            all styling (CSS variables at the top)
supabase/schema.sql     database tables + row-level security
```

## Known limits

- If the same item is edited on two devices at once, the last save wins.
- Trips can't be shared with other people yet (each account only sees its own).
