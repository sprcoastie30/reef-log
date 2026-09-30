# Reef Log

A reef aquarium log that runs in any browser and installs to a phone's home screen:

- **Chemistry**: log water tests and chart alkalinity, calcium, magnesium, nitrate, phosphate, salinity, temperature and pH against target ranges, with maintenance-event markers and per-day change.
- **Equipment**: list of everything on the system, by category and status.
- **Photos**: dated tank photos, grouped by month.
- **Dosing & salt**: system water volume, correction and daily maintenance doses, and a water-change planner using salt-mix values (Aquaforest Reef Salt presets).
- **Lighting**: 24-hour, 6-channel program planner for Noopsyche K7 Pro lights, QR code export/import for the Noopsyche app, preset export/import for the open-source K7 LED Controller, and a PAR log.
- **Tank profile**: each user sets their tank, sump, salt, dosing products and lights on first run (and any time with the **Tank profile** button). It drives the header, the water-volume math, dosing strengths, the default salt and the lighting panel.

Live site: https://reef-log.sprcoastie30.workers.dev

## How data is stored

- **On the device first.** Everything is saved in the browser's own storage (IndexedDB), so the app works with no connection.
- **Sync (optional).** When sync is turned on and the user signs in (**Data & backup → Sync across devices**), changes go to the cloud and come down to the user's other devices. The newest edit wins for each record; photos sync as files. Signing out keeps the device's copy.
- **Backup file.** **Data & backup → Download full backup** saves everything, photos included, as one file; **Restore from backup** loads it on any device.

## Project layout

```
public/              The deployed site
  index.html         Built app. Don't edit by hand: edit src/reef-log.html and rebuild.
  config.js          Deployment settings (Supabase URL and publishable key for sync)
  store.js           On-device storage and change tracking
  sync.js            Sign-in and device sync (Supabase)
  sw.js              Service worker for offline use
  manifest.webmanifest, icons/   Install-to-home-screen metadata
  _headers           Response headers
src/reef-log.html    Shared page source (also runs as the Claude-hosted version)
supabase/setup.sql   One-time database, security and photo-storage setup for sync
tools/build.py       Builds public/index.html from src/reef-log.html
```

After editing the source:

```
python3 tools/build.py
```

When deploying a change, also bump `VERSION` in `public/sw.js` so installed copies pick up the new files.

## Hosting (Cloudflare, free)

The site is deployed from this repository on Cloudflare's free plan as a **Worker with static assets** (address ending in `workers.dev`), using Cloudflare's Git integration. Every push to `main` redeploys automatically. The site is served from the `public` folder; nothing outside it is published.

To recreate the deployment: Cloudflare dashboard → **Workers & Pages** → **Create application** → import this GitHub repository, with no build command and `public` as the output/assets directory.

## Turning on sync (Supabase free plan)

1. Sign in at **supabase.com** (GitHub sign-in works) and create a **New project** on the Free plan. Save the database password somewhere safe; the app doesn't need it.
2. Open **SQL Editor → New query**, paste the whole of `supabase/setup.sql`, and click **Run**. It creates the records table, locks each account to its own data, and creates the private `photos` storage bucket.
3. Open **Authentication → URL Configuration**. Set **Site URL** to `https://reef-log.sprcoastie30.workers.dev` and add the same address under **Redirect URLs**. Confirmation and password-reset emails link back here.
4. Copy the **Project URL** and the **Publishable key** (Project Settings → API Keys; the key starts with `sb_publishable_`).
5. Put both into `public/config.js`, rebuild if needed, bump `VERSION` in `public/sw.js`, and push.

Notes:
- The publishable key is meant to be public; the Row Level Security rules in `setup.sql` are what keep each account's data private. Never put the **secret** key in this app.
- Free Supabase projects pause after about a week with no activity. Regular use keeps it awake; a paused project can be restored from the Supabase dashboard.
- Supabase's built-in email sender allows only a few emails an hour, which is fine for a handful of users. A real product should use its own email service.

## Moving data from the Claude version

In the Claude-hosted log, open **Data & backup** at the bottom of any tab and choose **Download full backup**. In this app, open **Data & backup** → **Restore from backup** and pick that file. If sync is on, sign in on that device afterwards and the restored log uploads to your account.

## Notices

Not affiliated with or endorsed by Noopsyche, Brightwell Aquatics, Aquaforest, Eshopps or any other brand named in the app. Product names are used only to describe compatibility. Dosing figures come from manufacturer-published strengths; always confirm with your own tests before and after dosing.

Copyright (c) 2026 Carl Peterson. All rights reserved. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
