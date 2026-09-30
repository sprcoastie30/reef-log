# Reef Log launch checklist

Steps to take Reef Log from Carl's own tank to a free beta, then Reef2Reef and the Facebook groups. Anything marked **Decide** is the owner's call.

## 1. Before anyone else uses it

- [ ] **Turn on sync.** Create the Supabase project, run `supabase/setup.sql`, set the Site URL and Redirect URLs to the workers.dev address, and put the Project URL and publishable key in `public/config.js` (see README, "Turning on sync"). Never put the secret / service_role key in the app.
- [ ] **Confirm the K7 Pro IV QR format** with the six-value channel test. Until then, the programmer is confirmed only for the K7 format documented by the open-source K7 LED Controller project.
- [ ] **Read the privacy note** (`PRIVACY.md` and the in-app **About, privacy & feedback** panel). It makes promises in the owner's name: no selling or sharing data, and no looking at it except to fix a reported problem. Edit anything you aren't willing to stand behind.
- [ ] **Decide: feedback channel.** The default link opens GitHub Issues, which needs a GitHub account; most reefers won't have one. A free Google Form (name, email optional, device, what happened) is easier. Put its link in `feedbackUrl` in `public/config.js`.
- [ ] **Decide: public or private code.** The GitHub repo is currently **public**, so anyone can read the source. The LICENSE (all rights reserved) keeps the legal rights with you, but it doesn't hide the code. If you plan to sell, consider making the repo private; Cloudflare can still build from a private repo it has access to. Check the build still deploys after the change.
- [ ] **Test on real phones:** iPhone Safari and Android Chrome. Add to Home Screen, log a test, add a photo, close and reopen, then sign in on a second device and confirm it syncs.
- [ ] **Test backup and restore:** download a full backup on one device and restore it on a fresh browser.
- [ ] **Account deletion process.** In the Supabase dashboard, first delete the user's folder (named with their user ID) in **Storage → photos**. Then **Authentication → Users → delete user**, which also removes their synced records because the `docs` table cascades. Photos first, because Supabase may refuse to delete a user who still owns stored files.

## 2. Free-plan limits to watch

These are from Supabase's pricing page as checked on 2026-09-30; they can change.

| Supabase Free plan | Limit | What it means here |
|---|---|---|
| Database | 500 MB | Text records are small; thousands of users' logs fit. |
| File storage | 1 GB | **Photos are the real limit.** Photos are now shrunk to 1600 px JPEG before upload (roughly 300–600 KB each), which works out to a few thousand photos across all users. |
| Egress | 5 GB / month | Each photo downloaded to a new device counts. |
| Monthly active users | 50,000 | Not a concern at launch. |
| Inactivity | Paused after 1 week with no activity | Your own daily use keeps it awake. If it pauses, restore it from the dashboard. |

The Pro plan starts at $25/month when you outgrow Free. Cloudflare's free Workers plan covers the hosting.

## 3. Beta (about 5–10 people)

- [ ] Invite a few people from the local reef Facebook group, ideally a mix of iPhone and Android users, two-part and all-in-one dosers, and at least one person on metric units.
- [ ] Ask them to use it for two weeks and report anything confusing, wrong numbers, or missing lights and products.
- [ ] Fix what comes up before the wide post.

## 4. Reef2Reef

I couldn't read Reef2Reef's Terms and Rules page directly (the site blocks automated reading), so this part is guidance, not a quote of their rules.

- Reef2Reef sells sponsorships for commercial promotion: Gold through Diamond tiers at $350–$1,500 a month, which come with a company forum and selling access (from their Advertising Information page). Posting a free, non-commercial tool as a member is common across reef forums, but whether it is allowed here is up to their rules and moderators.
- [ ] **Before posting, read the Terms and Rules** (reef2reef.com/help/terms) and **message a moderator** with a short description: free, no ads, built by a hobbyist, looking for feedback. Ask which forum fits best.
- [ ] In the post, say plainly that you built it, that it's free, and what data it stores. Link the privacy note.
- [ ] **Once you charge for it,** expect to need a sponsorship or the moderators' approval before promoting it there.

## 5. Facebook groups

- [ ] Check each group's rules on self-promotion, or ask the admin first. Many groups allow a one-time "I built this, free, looking for feedback" post.
- [ ] Post screenshots (charts, the dosing calculator, the K7 programmer). They show what it does faster than a feature list.

## 6. Later

- [ ] **Custom domain** (when ready to spend money): add it to the Worker in Cloudflare, then add the new address to Supabase's Site URL and Redirect URLs.
- [ ] **If you sell it:** that brings in terms of service, taking payments, and possibly a business entity and sales tax. Get proper advice at that point; this checklist isn't legal or tax advice.
