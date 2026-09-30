# Third-party notices

The app loads these libraries from the jsDelivr CDN at run time. They are not copied into this repository.

| Component | Version | License | Used for |
|---|---|---|---|
| qrcode-generator (Kazuhiko Arase) | 1.4.4 | MIT | Drawing QR codes for the Noopsyche app |
| jsQR (cozmo) | 1.4.0 | Apache-2.0 | Reading QR codes from images |
| supabase-js (Supabase) | 2.117.2 | MIT | Sign-in and device sync (loaded only when sync is turned on) |
| IBM Plex Sans, Sans Condensed, Mono (Google Fonts) | current | SIL Open Font License 1.1 | Typography |

Because these are loaded from the CDN rather than bundled, no license files need to ship with the app. If they are ever bundled into the repository, include each project's license file (Apache-2.0 for jsQR also requires keeping its NOTICE, if any).

## Formats and references

- The K7 Pro channel order (White, Royal Blue, Green, UV, Cyan, Red), the Noopsyche app QR payload layout, and the `k7_community_preset` file format follow the documentation and source of the open-source **K7 LED Controller** project by bitbarista (https://github.com/bitbarista/k7-led-controller), MIT License. No source code from that project is included here; the app reads and writes the same file and QR formats for compatibility.
- **Product data is factual and cited, not copied.** Dosing strengths, daily limits and salt-mix values are facts taken from each maker's published label or product information (directly or via retailer listings), restated in the app's own words with the source type marked "label" or "calc": Brightwell Aquatics, Red Sea, Seachem, Bulk Reef Supply, Tropic Marin, ESV, Aquaforest. Saturated kalkwasser figures come from Randy Holmes-Farley's published numbers. RO/DI replacement guidance is paraphrased from Bulk Reef Supply and credited in the app. Light-fixture channel names are taken from maker and retailer listings.
- **Icons** were drawn for this project (an original line-chart mark) and contain no third-party artwork.

## Trademarks

Product, brand and fixture names (including Noopsyche, K7, Brightwell, Reef Code, Magnesion, Red Sea, Reef Foundation, ReefLED, Tropic Marin, All-For-Reef, Carbocalcium, Seachem, Reef Fusion, Reef Builder, ESV, B-Ionic, Aquaforest, Bulk Reef Supply, AI, Hydra, Prime, EcoTech, Radion, Kessil, NICREW, Hanna, Neptune, Trident, AquaticLife) are trademarks of their respective owners. They are used only to identify the products Reef Log works with. Reef Log is not affiliated with, sponsored by or endorsed by any of these companies, and it uses no logos or brand artwork.

If code from the K7 LED Controller project is ever copied into this repository, its MIT license requires including this notice:

> MIT License. Copyright (c) bitbarista. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction... The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

(Reproduce the project's full LICENSE text at that time.)
