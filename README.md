# Holdfast: Reef Log & Dosing

A reef aquarium log that runs in any browser and installs to a phone's home screen:

- **Chemistry**: log water tests and chart alkalinity, calcium, magnesium, nitrate, phosphate, salinity, temperature and pH against target ranges, with maintenance-event markers and per-day change.
- **Dosing products**: presets for Brightwell Reef Code A/B and Magnesion, Red Sea Reef Foundation A/B/C, Seachem Reef Fusion 1/2, BRS Pharma Soda Ash (DIY), Tropic Marin All-For-Reef and Carbocalcium (liquid, or powder mixed to solution), ESV B-Ionic, Aquaforest Component 1+2+3+, Seachem Reef Builder (powder, dosed in grams) and saturated kalkwasser (dosed with top-off, with an evaporation check), each marked as label strength or calculated from the maker's stated concentration or mix, with the maker's daily limit where one is stated; any other product by label strength. Dosing by hand or by auto doser (doses per day, doser minimum, container days, doser heads) with matching schedule tasks.
- **Themes and units**: Auto (follows the device), Light, Dark and Blue themes; US units (gal, in, lb, °F) or metric (L, cm, kg, °C), set in the tank profile. Data is always stored in US units, so switching never changes saved records.
- **Daily consumption**: alkalinity, calcium and magnesium use per day from a trend line through recent tests, adding back doses (with a dated dose log) and water-change effects; the dose that holds levels steady; consumption over time; a calcium-to-alkalinity ratio check; a guided 14-day consumption check that sets the test schedule; and testing-time guidance.
- **Water change log**: log each change with date, time and amount; shows the share of the system, weekly totals (16-week chart), 30-day volume and old water replaced, weekly average and how often you change. Logged changes feed the consumption and dosing math (the plan is used when nothing was logged in the last 45 days, and an auto water change plan is added on top), can mark the water change task done and add a chart marker.
- **Salinity** is recorded in ppt by default (SG is an option in the tank profile); older SG records convert automatically.
- **Water changes vs. dosing**: compares each parameter's measured use with what the water change plan and salt mix put back. It flags when water changes no longer keep up and dosing is needed (on the Chemistry tab, the Dosing tab and as a Maintenance item), when water changes are near their limit, when a target sits above the salt mix, and when someone is dosing although water changes alone would hold the level. It needs 4+ tests over 7+ days and ignores trends smaller than test-kit resolution. Optional new-reefer tips (on by default, set in the tank profile with the tank's setup month) advise holding off on dosing until water changes stop keeping up.
- **RO/DI**: filter stages with install dates and replacement intervals (Bulk Reef Supply guidance), a TDS, chlorine and pressure log with membrane rejection rate and chart, and replacement alerts when DI output reads above 0, rejection falls below the membrane's rating, or waste water shows more than 0.5 ppm chlorine; all feed the maintenance schedule and calendar.
- **Maintenance**: recurring water tests and upkeep with due and overdue status; tests complete automatically when you log them; test gear (kits, Hanna Checkers, refractometers, salinity meters, pH probes, auto-testers, ICP services) with reagent expiry, calibration and reference-check log; the whole schedule exports to a phone calendar (.ics) for alerts.
- **Livestock**: fish, corals (by group) and invertebrates with photo, date added, source, placement, status (in tank, lost, rehomed) and days in the tank.
- **Equipment**: list of everything on the system, by category and status.
- **Photos**: dated tank photos, grouped by month.
- **Dosing & salt**: system water volume, correction and daily maintenance doses, salt-mix values (Aquaforest Reef Salt presets), and a water change plan: 10% weekly, 35% monthly, 1.5% daily auto water change or custom, with gallons, salt, old water replaced per month, parameter step per change, the plan's effect on daily alkalinity dosing, a side-by-side comparison, and one click to put the plan into the maintenance schedule.
- **Lighting**: 24-hour, 6-channel program planner for Noopsyche K7 Pro lights, QR code export/import for the Noopsyche app (format and channel order confirmed against a Noopsyche app export from a K7 Pro IV), preset export/import for the open-source K7 LED Controller, a light settings log for any fixture (K7 Pro IV/III, AI Hydra and Prime HD, EcoTech Radion, Kessil, Red Sea ReefLED, NICREW, T5 or custom channels) that shows per-channel changes between entries and can mark each change on the chemistry charts, and a PAR log.
- **Tank profile**: each user sets their tank, sump, salt, dosing products and lights on first run (and any time with the **Tank profile** button). It drives the header, the water-volume math, dosing strengths, the default salt, units and the lighting panel.
- **About, privacy & feedback**: a plain-language privacy note, a note on how the calculator numbers are built, and a feedback link (GitHub Issues by default, or any form set as `feedbackUrl` in `public/config.js`). The full note is in [PRIVACY.md](PRIVACY.md); launch steps are in [LAUNCH.md](LAUNCH.md).

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
