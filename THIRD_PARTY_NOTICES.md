# Third-party notices

The app loads these libraries from the jsDelivr CDN at run time. They are not copied into this repository.

| Component | Version | License | Used for |
|---|---|---|---|
| qrcode-generator (Kazuhiko Arase) | 1.4.4 | MIT | Drawing QR codes for the Noopsyche app |
| jsQR (cozmo) | 1.4.0 | Apache-2.0 | Reading QR codes from images |
| supabase-js (Supabase) | 2.117.2 | MIT | Sign-in and device sync (loaded only when sync is turned on) |
| IBM Plex Sans, Sans Condensed, Mono (Google Fonts) | current | SIL Open Font License 1.1 | Typography |

## Formats and references

- The K7 Pro channel order (White, Royal Blue, Green, UV, Cyan, Red), the Noopsyche app QR payload layout, and the `k7_community_preset` file format follow the documentation and source of the open-source **K7 LED Controller** project by bitbarista (https://github.com/bitbarista/k7-led-controller), MIT License. No source code from that project is included here; the app reads and writes the same file and QR formats for compatibility.
- Dosing strengths are taken from Brightwell Aquatics product information as published by retailers; salt-mix values from Aquaforest Reef Salt product listings. See the app's Dosing & salt tab.

If code from the K7 LED Controller project is ever copied into this repository, its MIT license requires including this notice:

> MIT License. Copyright (c) bitbarista. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction... The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

(Reproduce the project's full LICENSE text at that time.)
