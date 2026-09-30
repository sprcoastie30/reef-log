# Reef Log

A reef aquarium log that runs in any browser and installs to a phone's home screen:

- **Chemistry**: log water tests and chart alkalinity, calcium, magnesium, nitrate, phosphate, salinity, temperature and pH against target ranges, with maintenance-event markers and per-day change.
- **Equipment**: list of everything on the system, by category and status.
- **Photos**: dated tank photos, grouped by month.
- **Dosing & salt**: system water volume, correction and daily maintenance doses (Brightwell Reef Code A/B, Magnesion), and a water-change planner using salt-mix values (Aquaforest Reef Salt presets).
- **Lighting**: 24-hour, 6-channel program planner for Noopsyche K7 Pro lights, QR code export/import for the Noopsyche app, preset export/import for the open-source K7 LED Controller, and a PAR log.

## How data is stored

Everything is stored **on the device**, in the browser's own storage (IndexedDB). There is no server and no account. That means:

- Data on your phone and data on your computer are separate.
- Clearing the browser's site data deletes the log. Use **Data & backup → Download full backup** regularly, and **Restore from backup** to move to a new device.

## Project layout

```
public/           The deployable site (point the host here)
  index.html      Built app. Do not edit by hand; edit src/reef-log.html and rebuild.
  store.js        On-device storage (IndexedDB) used by the app
  sw.js           Service worker for offline use
  manifest.webmanifest, icons/   Install-to-home-screen metadata
  _headers        Cloudflare Pages response headers
src/reef-log.html Shared page source
tools/build.py    Builds public/index.html from src/reef-log.html
```

To rebuild after editing the source:

```
python3 tools/build.py
```

When you deploy a change, also bump `VERSION` in `public/sw.js` so installed copies pick it up.

## Deploying on Cloudflare Pages (free)

1. Sign in at dash.cloudflare.com and open **Workers & Pages**.
2. **Create** → **Pages** → **Connect to Git**, authorize GitHub, and pick this repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **public**
4. **Save and Deploy.** The site will be at `https://<project-name>.pages.dev`. Every push to `main` redeploys automatically.
5. Optional: add your own domain under the project's **Custom domains** tab.

## Moving data from the Claude version

In the Claude-hosted log, open **Data & backup** at the bottom of any tab and choose **Download full backup**. In this app, open **Data & backup** → **Restore from backup** and pick that file.

## Notices

Not affiliated with or endorsed by Noopsyche, Brightwell Aquatics, Aquaforest, Eshopps or any other brand named in the app. Product names are used only to describe compatibility. Dosing figures come from manufacturer-published strengths; always confirm with your own tests before and after dosing.

Copyright (c) 2026 Carl Peterson. All rights reserved. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
