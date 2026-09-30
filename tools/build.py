#!/usr/bin/env python3
"""Build public/index.html (the standalone app) from src/reef-log.html (the shared page source).

The shared source is written for a page viewer that supplies the document skeleton and the
storage interface. This script adds the full HTML skeleton, the installable-app metadata,
the on-device store (public/store.js) and the offline service worker registration.

Usage: python3 tools/build.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "reef-log.html"
OUT = ROOT / "public" / "index.html"

RESET = (
    ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
    "body{margin:0;font:14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;background:#fafafa}"
    "img{max-width:100%}[hidden]{display:none!important}"
)

SW_REGISTER = """<script>
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
</script>"""


def main() -> int:
    src = SRC.read_text(encoding="utf-8")

    # Pull <title> and the font <link> tags up into <head>.
    title_m = re.search(r"<title>.*?</title>\s*", src, re.S)
    if not title_m:
        print("No <title> in source", file=sys.stderr)
        return 1
    title = "<title>Reef Log</title>"  # the app sets the full name from the tank profile at run time
    src = src[: title_m.start()] + src[title_m.end():]
    links = re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>\s*', src)
    for l in links:
        src = src.replace(l, "", 1)

    # The on-device store must load before the app script so window.claude exists.
    marker = '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator'
    if marker not in src:
        print("Library script marker not found", file=sys.stderr)
        return 1
    src = src.replace(marker, '<script src="config.js"></script>\n<script src="store.js"></script>\n' + marker, 1)

    # sync.js runs after the app script so the Data & backup panel exists.
    last = src.rfind("</script>")
    src = src[: last + len("</script>")] + '\n<script src="sync.js"></script>' + src[last + len("</script>"):]

    head = "\n".join([
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        title,
        '<meta name="description" content="Reef aquarium log: water tests with charts, equipment, photos, dosing and salt calculator, and LED light programs.">',
        '<meta name="theme-color" content="#0b7480">',
        '<link rel="manifest" href="manifest.webmanifest">',
        '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">',
        '<link rel="apple-touch-icon" href="icons/icon-180.png">',
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="mobile-web-app-capable" content="yes">',
        '<meta name="apple-mobile-web-app-title" content="Reef Log">',
        *[l.strip() for l in links],
        f"<style>{RESET}</style>",
        "</head>",
        "<body>",
    ])
    OUT.write_text(head + "\n" + src.strip() + "\n" + SW_REGISTER + "\n</body>\n</html>\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
