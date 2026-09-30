# Reef Log privacy note

_Draft for the owner to review before public launch. It describes how the app is built today; if anything below stops being true (for example, analytics are added), update this note and the matching text in the app's **About, privacy & feedback** panel._

**On your device.** Your log, photos and settings are saved in your browser's storage (IndexedDB) on the device you're using. Nothing leaves the device unless you sign in to sync.

**If you sign in to sync.** Your records and photos are copied to the Reef Log database, hosted by Supabase, so your other devices can load them. Database rules (row-level security) let each account read and change only its own records, and photos are kept in a private storage bucket with one folder per account. The app's owner administers that database and can technically reach it. It is used only to run sync, is never sold or shared, and isn't looked at except to fix a problem you report.

**What the app does not do.** No ads, no analytics, and no tracking cookies.

**Services your browser contacts.** Like any website, loading the app contacts a few services that see your connection (IP address and browser details):

- Cloudflare, which hosts the app
- jsDelivr, which serves the QR code and sync code libraries
- Google Fonts, which serves the typefaces
- Supabase, for sign-in and sync, only if you use them

**Your data stays yours.** You can download a full backup (photos included) at any time under **Data & backup**. To have your synced account and everything in it deleted, ask through the feedback link in the app.

**About the numbers.** Dosing, consumption and water change figures are estimates built from product labels (or strengths worked out from a maker's stated concentration) and your own test results. Check them against the product label, change doses gradually, and retest before and after any big change.

Questions: use the feedback link in the app.
