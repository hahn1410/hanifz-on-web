# hanifzulkifli.com — Portfolio & Vlog Archive — Design

Date: 2026-11-22
Status: draft for approval

## Intent and why

Hanif is a documentary filmmaker and vlogger from Penang, Malaysia. His domain
hanifzulkifli.com currently points at a Canva site: a hand-made "Vlog Archive"
of month calendars (one thumbnail per day he posted, a ✕ on days he did not),
with an About and Get-in-touch section at the bottom. Keeping it up to date by
hand in Canva is tedious, and he wants the site to open with his photography
first.

The new site keeps the calendar idea he likes (it shows at a glance how
consistently he makes work) but fills itself from his videos, and opens with
his best photo.

Inspiration: casey.cs.gt, a fan-built archive of Casey Neistat's vlogs, and its
open-source code rodrigopolo/YouTubeCalendar (MIT). We borrow the calendar
idea, not the PHP + MySQL setup. Our code is written fresh (no code copied),
so no credit or licence notice is required; Hanif asked for no credit line.

Hanif has no coding background. Claude builds and maintains it; Hanif's only
routine task is pasting TikTok links.

## Goals

- Landing page opens on one full-screen hero photo (his best), with his name,
  a one-line description, and a clear button into the vlog archive.
- Vlog archive: one calendar per month, newest month first, 7-column grid
  (Sunday first) with weekday headers. Day with a vlog → its thumbnail, linking
  to the video. Day without → a ✕ (✕ means "no content uploaded that day").
- Videos come from YouTube and TikTok, shown side by side, each with a small
  platform tag (YouTube red / TikTok black). Hovering (or tapping on phones)
  shows the title.
- New YouTube uploads appear automatically, within a day, with no action from
  Hanif. YouTube Shorts are included, tagged as "Short".
- "Watched" ticks: visitors can see which vlogs they've already watched
  (see Decided by Hanif).
- TikTok vlogs are added by pasting the link into a Google Sheet.
- Hanif can hide a video or fix its date from the same sheet.
- About + contact (email, Instagram, X/Twitter, YouTube, TikTok) carried over
  from the current Canva site.
- Works well on phones as well as desktop.
- Runs on free hosting; the only cost is the yearly domain renewal.
- Served at hanifzulkifli.com before the domain's current registration expires
  (~43 days from 2026-11-22, i.e. around 2027-01-04).

## Non-goals

- No comments, accounts or likes.
- No blog/CMS, no shop.
- No automatic TikTok import (TikTok gives small personal sites no feed
  without app approval).
- No video hosting — thumbnails link out to YouTube/TikTok.
- No photo gallery for now — photography appears as the single hero photo.
  A gallery page can be a later addition.

## Anti-goals (failure even if it "works")

- Anything that needs Hanif to touch code, a terminal, or a server to add a vlog.
- A site that breaks or goes blank when an automatic step fails — the archive
  must keep showing what it already has.
- Losing or letting the domain lapse during the move.
- Thumbnails so small on phones that the calendar is unreadable.
- Paid monthly services.

## Constraints

- Domain registered via Canva (partner registrar). Must be renewed / set to
  auto-renew, or transferred, before ~2027-01-04, and its DNS pointed at the
  new host.
- TikTok thumbnail URLs from TikTok's public oEmbed endpoint are signed and
  expire, so TikTok thumbnails must be downloaded and stored with the site,
  not hot-linked.
- YouTube's public channel feed (RSS) lists only the latest ~15 uploads, so the
  full back-catalogue (from June 2022) needs a one-off import, and every video
  seen must be stored permanently by the site, not re-read from the feed.

## Approaches considered

1. **Google Sheet as the list + static site (chosen, with automatic YouTube).**
   A sheet holds TikTok rows and per-video overrides; YouTube uploads are
   picked up automatically from YouTube's public feed. A scheduled job merges
   both, downloads thumbnails, builds a static site and publishes it.
   Free, hard to break, Hanif only pastes TikTok links.
2. **Run Rodrigo Polo's YouTubeCalendar as-is.** Needs PHP, MySQL and a cron on
   paid hosting, YouTube-only, no way to hide/fix videos. Rejected: cost,
   upkeep, no TikTok.
3. **Drag-and-drop builder (Framer/Squarespace).** Easy visual editing but
   ~$10–20/month and an auto-filling calendar is impractical — back to placing
   thumbnails by hand. Rejected.

Hanif picked 1, then asked for automatic YouTube updates on top.

## Decided by Hanif

- Landing = best photo first, then route into the archive; About/contact below.
- Calendar look as in his Canva site and the v1 mockup (`mockup/mockup-v1.html`):
  big serif month name with year above, thin grid lines, thumbnail fills the
  day cell, bold ✕ on empty days. He approved the mockup look and page order.
- ✕ = no content uploaded that day.
- **Two or more videos on one day — priority YouTube → YouTube Short → TikTok.**
  The cell shows the highest-priority video's thumbnail and clicking it goes
  straight to that video. Lower-priority videos that day get a small corner
  badge (e.g. "+ Short", "+ TikTok") linking to them. (Badge styling, and 2+
  videos of the same kind — newest first — are Claude's calls.)
- **"Watched" ticks (like casey.cs.gt).** Opening a video marks it watched
  with a tick on its day; a small tick button on each day lets a visitor mark
  or unmark it by hand. Remembered in each visitor's own browser
  (localStorage) — it's per person and per device, not shared, and clearing
  browser data resets it. No account needed.
- **Older TikToks are not needed.** TikTok rows start from launch; no bulk
  TikTok import.
- YouTube updates automatically; TikTok pasted into a Google Sheet.

## Claude's calls (correctable)

- **Stack:** plain HTML/CSS/JS static site, no framework, kept in a GitHub
  repository; built and published by a scheduled GitHub Action (daily, plus a
  manual "run now" button), hosted on GitHub Pages (or Netlify — builder's
  choice, both free, both support the custom domain and HTTPS).
- **Data flow per run:**
  1. Read YouTube channel RSS; for each new video not already stored, detect
     whether it is a Short, record id/title/is-Short/publish date (in Malaysia time, UTC+8) into a
     stored data file committed to the repo.
  2. Read the Google Sheet (published as CSV, read-only, no Google credentials
     needed). Columns: `date`, `link`, `title` (optional), `hide` (optional).
     A row whose link is a YouTube video overrides that video (date/title/hide);
     a TikTok row adds a video.
  3. For new TikTok rows, fetch title + thumbnail via TikTok oEmbed and save
     the thumbnail image into the repo.
  4. Generate the site with the merged list and publish.
  If any step fails, the run keeps the last good data and still publishes (or
  skips publishing); the live site is never emptied.
- **Back-catalogue:** one-off import of every YouTube upload since June 2022
  (via YouTube Data API key used once, or a no-key channel listing tool —
  builder's choice). Claude pastes the imported list into the sheet once (one
  row per video), so Hanif can review it there and mark non-vlog uploads
  `hide`. The sheet stays read-only to the automation (no Google credentials).
- **Hiding a later automatic upload:** Hanif pastes its link into the sheet
  with `hide` = yes. Rare, so acceptable.
- **Domain first:** the first build step is checking, in Canva, whether the
  domain's DNS can point at outside hosting. If yes: set auto-renew and point
  DNS. If not: transfer the domain to a registrar (e.g. Cloudflare/Namecheap)
  straight away, since transfers take days. The current Canva site stays up
  until the new one is live.
- **YouTube thumbnails** hot-linked from YouTube's image CDN (stable).
- **Dates** use the date the video was published, in Malaysia time.
- **Fonts:** Bodoni Moda (headings, italic logo) + Inter (body), from Google Fonts.

## Left to the builder

- Exact Shorts detection method.
- Exact CSS / responsive breakpoints, within the mockup's look; on phones the
  calendar stays a 7-column grid, tags hidden, tap reveals title.
- Image sizes/lazy-loading, SEO/meta tags, favicon, social preview image.
- Repo layout, file naming, Action schedule time.

## Inputs needed from Hanif before/during build

- YouTube channel link; TikTok profile link.
- The hero photo (full resolution) and optional caption.
- About text, email, social links (can be copied from the Canva site).
- A Google account to own the sheet; his existing GitHub account to own the repo
  and hosting.
- Access to wherever the domain is managed (Canva) to renew it and change DNS.
