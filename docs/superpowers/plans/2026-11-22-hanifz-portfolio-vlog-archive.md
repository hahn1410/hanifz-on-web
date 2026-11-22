# hanifzulkifli.com Portfolio & Vlog Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free, static site at hanifzulkifli.com: full-screen hero photo landing, then a month-by-month vlog calendar that fills itself from YouTube (automatic) and a Google Sheet (TikTok + overrides), with per-visitor "watched" ticks.

**Architecture:** A daily GitHub Action runs a Node script that reads the YouTube channel RSS feed and the published Google Sheet CSV, keeps a permanent store of every YouTube video seen, downloads TikTok thumbnails, and writes one merged `site/data/videos.json`. The front end is plain HTML/CSS/JS that renders the calendars from that JSON in the browser. GitHub Pages serves `site/` at the custom domain.

**Tech Stack:** Node 20 (built-in `fetch`, `node:test`, no npm dependencies), plain HTML/CSS/ES-module JS, GitHub Actions, GitHub Pages, Google Fonts (Bodoni Moda + Inter).

**Spec:** `docs/superpowers/specs/2026-11-22-hanifz-portfolio-vlog-archive-design.md`

## Global Constraints

- No npm dependencies; Node 20 built-ins only. Tests: `node --test tests/`.
- Every date is the publish date in Malaysia time (UTC+8), format `YYYY-MM-DD`.
- Day priority: `youtube` → `short` → `tiktok`; same kind → newest `publishedAt` first.
- ✕ = no content uploaded that day.
- The automation never writes to the Google Sheet (published CSV, read-only).
- A failed fetch never empties the live site: keep last good data.
- Hanif never needs code/terminal to add a vlog (TikTok = one sheet row).
- No paid services. No credit line in the footer. No photo gallery.
- Fonts: Bodoni Moda (headings, italic 800 logo) + Inter (body). Look follows `mockup/mockup-v1.html`.
- Older TikToks are not imported.

## Review Focus

1. A video published late evening UTC (e.g. `2024-11-03T17:30:00Z`) must land on the Malaysia date `2024-11-04`. → Task 1 test.
2. Messy sheet rows (blank lines, missing link, bad date, unknown link type, quoted commas in titles) are skipped or parsed, never crash the run. → Task 3 tests.
3. YouTube RSS, sheet or TikTok fetch down → run exits 0 with a warning, `videos.json` unchanged or still complete. → Task 5 test.
4. Browser blocks `localStorage` (private mode) → calendar still renders, ticks just don't persist. → Task 8 test.
5. A YouTube video also listed in the sheet appears once, with the sheet's date/title/hide applied. → Task 5 test.

## Shared types

```js
// Video — one entry in site/data/videos.json (array, newest first)
{ id: string,            // YouTube video id, or "tt-<tiktokVideoId>"
  platform: "youtube" | "short" | "tiktok",
  url: string, title: string,
  date: "YYYY-MM-DD",    // Malaysia date
  publishedAt: string,   // ISO timestamp (for ordering)
  thumb: string }        // absolute URL (YouTube) or site-relative path (TikTok)

// StoredYouTube — one entry in data/youtube.json (permanent store)
{ id, title, publishedAt, isShort: boolean }

// SheetRow — normalized row from the sheet
{ date: "YYYY-MM-DD" | null, link: string, title: string | null, hide: boolean,
  kind: "youtube" | "tiktok", videoId: string }
```

## File map

```
config.json                      channelId, sheetCsvUrl, siteDomain
data/youtube.json                permanent YouTube store (committed by the Action)
data/tiktok.json                 cache of TikTok oEmbed results {videoId: {title, thumbPath}}
scripts/lib/dates.js             toMalaysiaDate
scripts/lib/youtube.js           parseFeed, detectShort, addNewToStore
scripts/lib/sheet.js             parseCsv, normalizeRow
scripts/lib/tiktok.js            fetchTikTok
scripts/lib/merge.js             mergeVideos
scripts/update.js                daily orchestrator
scripts/backfill-youtube.js      one-off full history import
site/index.html, site/styles.css
site/js/calendar.js              pure calendar logic (tested in Node)
site/js/watched.js               localStorage ticks
site/js/main.js                  DOM rendering
site/data/videos.json, site/thumbs/tiktok/*.jpg, site/CNAME
.github/workflows/update.yml
tests/*.test.js
```

---

### Task 0: Domain and accounts (with Hanif, do first — domain expires ~2027-01-04)

No code. Done when each box is ticked and noted in `docs/launch-notes.md` (no passwords in the file).

- [ ] Domain renewal / transfer / DNS: **handled by Hanif himself** (decided 2026-11-22). Claude only supplies the DNS records in Task 11.
- [ ] Hanif creates the GitHub repo `hanifzulkifli-site` (public, needed for free Pages) on his account and grants push access for this session's git.
- [ ] Hanif creates a Google Sheet "Vlog list" with header row `date,link,title,hide`, then File → Share → Publish to web → CSV; the CSV URL goes in `config.json`.
- [ ] Collect: YouTube channel URL (→ channel id `UC…`), TikTok profile URL, hero photo (full res) + caption, About text, email, social links.

### Task 1: Project setup + Malaysia dates

**Files:** Create `config.json`, `package.json` (`"type":"module"`, `"test":"node --test tests/"`), `.gitignore`, `scripts/lib/dates.js`, `tests/dates.test.js`

**Interfaces:** Produces `toMalaysiaDate(iso: string) -> "YYYY-MM-DD"`.

- [ ] **Step 1: Failing test** — `toMalaysiaDate("2024-11-03T17:30:00Z") === "2024-11-04"`; `toMalaysiaDate("2024-11-03T15:59:59Z") === "2024-11-03"`; `toMalaysiaDate("2024-11-03T16:00:00+00:00") === "2024-11-04"`.
- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement: add 8 h to the epoch ms, format with `toISOString().slice(0,10)`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git init`, commit `chore: project setup and Malaysia date helper`.

### Task 2: YouTube feed and permanent store

**Files:** Create `scripts/lib/youtube.js`, `tests/youtube.test.js`, `tests/fixtures/feed.xml` (real-shaped Atom feed, 3 entries)

**Interfaces:**
- `parseFeed(xml: string) -> {id, title, publishedAt}[]` — from `<yt:videoId>`, `<title>` (inside `<entry>`), `<published>`; decode `&amp; &lt; &gt; &quot; &#39;`.
- `detectShort(id: string, fetchFn = fetch) -> Promise<boolean>` — `HEAD https://www.youtube.com/shorts/{id}` with `redirect:"manual"`: status 200 → true, 3xx → false; on network error → false.
- `addNewToStore(store: StoredYouTube[], entries, detect = detectShort) -> Promise<{store, added: number}>` — only ids not already in store; result sorted by `publishedAt` desc.
- Feed URL: `https://www.youtube.com/feeds/videos.xml?channel_id={channelId}`.

- [ ] **Step 1: Failing tests** — `parseFeed(fixture)` returns 3 items, first id equals fixture's first id, a title containing `&amp;` decodes to `&`; `detectShort` with a fake fetch returning `{status:200}` → true, `{status:303}` → false, throwing → false; `addNewToStore` with one existing id + 3 entries → `added === 2`, no duplicate ids.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement the three functions (regex over `<entry>` blocks is fine for this fixed format).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: YouTube feed parsing and store`.

### Task 3: Google Sheet CSV

**Files:** Create `scripts/lib/sheet.js`, `tests/sheet.test.js`

**Interfaces:**
- `parseCsv(text: string) -> string[][]` — RFC 4180: quoted fields, `""` escapes, commas/newlines inside quotes, `\r\n`.
- `normalizeRow(cells: string[], header: string[]) -> SheetRow | null` — `link` required; YouTube id from `watch?v=`, `youtu.be/`, `/shorts/`; TikTok id from `/video/<digits>`; else `null`. `date` accepts `YYYY-MM-DD` or `D/M/YYYY` (Malaysian order), anything else → `null` date (row still valid for YouTube overrides; TikTok row with no date → `null` row). `hide` true for `yes`, `y`, `true`, `1`, `x` (case-insensitive).

- [ ] **Step 1: Failing tests** — quoted title `"Penang, day 2"` parses as one cell; blank line ignored; `normalizeRow` for `https://youtu.be/abc123XYZ_-` → `{kind:"youtube", videoId:"abc123XYZ_-"}`; `https://www.tiktok.com/@hanif/video/7301234567890` with date `4/11/2024` → `{kind:"tiktok", videoId:"7301234567890", date:"2024-11-04"}`; TikTok row with date `soon` → `null`; link `https://instagram.com/p/x` → `null`; `hide: "YES"` → `true`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: sheet CSV parsing`.

### Task 4: TikTok details and thumbnails

**Files:** Create `scripts/lib/tiktok.js`, `tests/tiktok.test.js`

**Interfaces:** `fetchTikTok(url: string, videoId: string, outDir: string, fetchFn = fetch) -> Promise<{title: string, thumbPath: string}>` — GET `https://www.tiktok.com/oembed?url={encoded url}`, read `title` and `thumbnail_url`, download the image to `{outDir}/{videoId}.jpg`, return `thumbPath: "thumbs/tiktok/{videoId}.jpg"`. Throws on non-2xx.

- [ ] **Step 1: Failing tests** (fake fetch, temp dir) — writes the file bytes returned by the fake image response; returns the title; non-2xx oEmbed → rejects.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: TikTok oEmbed thumbnails`.

### Task 5: Merge + daily update script

**Files:** Create `scripts/lib/merge.js`, `scripts/update.js`, `tests/merge.test.js`, `tests/update.test.js`

**Interfaces:**
- `mergeVideos(store: StoredYouTube[], rows: SheetRow[], tiktokCache: {[videoId]: {title, thumbPath}}) -> Video[]` — YouTube store → `platform` `short`/`youtube`, `url` `https://www.youtube.com/watch?v={id}`, `thumb` `https://i.ytimg.com/vi/{id}/mqdefault.jpg`, `date` from `toMalaysiaDate`. Sheet YouTube row overrides `date`/`title` when set and removes the video when `hide`. A sheet YouTube row for an id not in the store adds it as `youtube` (title from row or `""`). TikTok rows with cache entries → `platform "tiktok"`, `id "tt-"+videoId`; `publishedAt` = `{date}T12:00:00+08:00`; hidden TikTok rows dropped. Output sorted `publishedAt` desc.
- `runUpdate({config, fetchFn, paths}) -> Promise<{warnings: string[]}>` — steps in order, each in its own try/catch adding to `warnings`: (1) feed → `addNewToStore` → write `data/youtube.json`; (2) sheet CSV → rows (on failure use rows from `data/sheet-cache.json`, else write that cache); (3) for TikTok rows missing from `data/tiktok.json`, `fetchTikTok` and add; (4) `mergeVideos` → write `site/data/videos.json` **only if** result length > 0. `scripts/update.js` CLI calls it, prints warnings, always exits 0.

- [ ] **Step 1: Failing merge tests** — Review Focus 5: store has `abc`, sheet row for `abc` with date `2024-01-02` and title `New` → one video, date `2024-01-02`, title `New`; with `hide` → absent; TikTok row with cache → `platform:"tiktok"`, `thumb:"thumbs/tiktok/<id>.jpg"`; isShort store entry → `platform:"short"`.
- [ ] **Step 2: Failing update test** — Review Focus 3: fake fetch that rejects everything, existing `site/data/videos.json` in a temp dir → after `runUpdate` the file is byte-identical and `warnings.length === 3`.
- [ ] **Step 3:** run → FAIL.
- [ ] **Step 4:** implement.
- [ ] **Step 5:** run → PASS.
- [ ] **Step 6:** commit `feat: merge sources and daily update`.

### Task 6: One-off YouTube back-catalogue import

**Files:** Create `scripts/backfill-youtube.js`

**Interfaces:** CLI `YT_API_KEY=… node scripts/backfill-youtube.js` — uploads playlist id = channel id with `UC`→`UU`; page `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=…&key=…` until no `nextPageToken`; for each item use `contentDetails.videoId`, `snippet.title`, `contentDetails.videoPublishedAt`; `detectShort` each; merge into `data/youtube.json` via `addNewToStore`; also write `data/backfill-for-sheet.csv` (`date,link,title,hide` with Malaysia dates, `hide` blank) for pasting into the sheet. Key comes from env only, never committed.

- [ ] **Step 1:** Run against Hanif's channel (key created by Hanif in Google Cloud, used once, then deleted).
- [ ] **Step 2:** Check: count matches the channel's video count on YouTube (±private/deleted); oldest date ≈ June 2022.
- [ ] **Step 3:** Paste `backfill-for-sheet.csv` into the sheet; Hanif marks non-vlogs `hide`.
- [ ] **Step 4:** commit `feat: YouTube back-catalogue import` (script + `data/youtube.json`, not the key).

### Task 7: Calendar logic

**Files:** Create `site/js/calendar.js`, `tests/calendar.test.js`

**Interfaces:**
- `groupByDay(videos: Video[]) -> Map<"YYYY-MM-DD", Video[]>` — each list sorted by priority `youtube` < `short` < `tiktok`, then `publishedAt` desc.
- `monthsToShow(videos: Video[], today: "YYYY-MM-DD") -> {year, month}[]` — month is 0-based; the current month plus every month that has at least one video; newest first. (Empty months are skipped, as in the Canva version.)
- `buildMonth(year, month, byDay, today, firstVideoDate) -> {leading: number, days: Day[]}` — `leading` = weekday of the 1st (Sunday = 0). `Day = {n, date, state: "video" | "none" | "future" | "before", videos: Video[]}`: `future` if after `today`, `before` if before `firstVideoDate`, else `video`/`none` (`none` renders ✕).

- [ ] **Step 1: Failing tests** — a day with tiktok + short + youtube → order `[youtube, short, tiktok]`; two youtube same day → newer first; `monthsToShow` with videos in 2024-11 and 2022-06 and today `2026-11-22` → `[{year:2026,month:10},{year:2024,month:10},{year:2022,month:5}]`; `buildMonth(2024, 10, …)` → `leading === 5` (1 Nov 2024 is a Friday), 30 days; today `2024-11-10` makes day 11 `future`; empty day → `none`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement (use `Date.UTC` to avoid local-timezone drift).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: calendar logic`.

### Task 8: Watched ticks

**Files:** Create `site/js/watched.js`, `tests/watched.test.js`

**Interfaces:** `createWatched(storage = globalThis.localStorage) -> { has(id): boolean, toggle(id): boolean, mark(id): void }` — key `hz-watched`, JSON array of ids; every storage access in try/catch, falling back to in-memory set.

- [ ] **Step 1: Failing tests** — with a fake storage: `mark("a")` then a new `createWatched(sameStorage).has("a") === true`; `toggle` flips and returns new state; Review Focus 4: storage whose `getItem`/`setItem` throw → no exception, `toggle` still works in memory; `createWatched(undefined)` works.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat: watched ticks`.

### Task 9: The page

**Files:** Create `site/index.html`, `site/styles.css`, `site/js/main.js`, `site/img/hero.jpg`; sample `site/data/videos.json` for local viewing

**Interfaces:** Consumes Tasks 7–8. `main.js` fetches `data/videos.json`, then renders into `#months`.

Requirements (look = `mockup/mockup-v1.html`):
- Landing: full-viewport hero photo with caption, "Hanif Z." logo, pills Vlog archive / About me / Get in touch, kicker line, heading, white "Open the vlog archive →" button scrolling to `#archive`. Hero `<img>` with `fetchpriority="high"`, other images `loading="lazy"`.
- Archive header: "Vlog Archive", legend (YouTube red, Short, TikTok black, ✕ = no vlog that day), count "N vlogs · June 2022 – today" computed from data.
- Month: year label, big serif month name, weekday header row, 7-col grid.
- Day `video`: primary video's thumbnail fills the cell, whole cell links to it (`target="_blank" rel="noopener"`) and calls `watched.mark(id)` on click; platform tag; extra videos that day as small corner badges ("+ Short", "+ TikTok", "+1") each linking to their video; tick button (✓) top-right toggles watched, watched cells show a visible tick and slightly dimmed thumb; title overlay on hover. `none` → ✕. `future`/`before` → empty white cell.
- Phones (`max-width:640px`): grid stays 7 columns; tags hidden; badges shrink to a dot; on `(hover:none)` the first tap on a cell shows its title overlay, second tap opens.
- If `videos.json` fails to load: show "Archive couldn't load — please refresh." instead of empty calendars.
- Footer: Get in touch, About text, email, Instagram, X, YouTube, TikTok links. No credit line.
- Fonts via Google Fonts `Bodoni Moda` + `Inter`; colours as mockup `:root` tokens.

- [ ] **Step 1:** Build with sample data containing a youtube+short+tiktok day, a short-only day and a tiktok-only day.
- [ ] **Step 2:** Serve `site/` locally (`python3 -m http.server -d site`) and check in the browser pane at desktop and 375 px width: hero fills screen, ✕ on empty days, priority order correct, badges link correctly, tick toggles and survives reload, tap-to-reveal works on mobile emulation, no horizontal scroll.
- [ ] **Step 3:** Hanif reviews the local page; apply his tweaks.
- [ ] **Step 4:** commit `feat: landing page and vlog archive`.

### Task 10: Daily Action + GitHub Pages

**Files:** Create `.github/workflows/update.yml`, `site/CNAME` (`hanifzulkifli.com`)

Workflow:
- Triggers: `schedule: cron "0 16 * * *"` (00:00 Malaysia) and `workflow_dispatch` (the "run now" button).
- Permissions: `contents: write`, `pages: write`, `id-token: write`.
- Job: checkout → setup-node 20 → `npm test` → `node scripts/update.js` → commit `data/` and `site/data/`, `site/thumbs/` if changed (`git diff --quiet ||` commit as `github-actions[bot]`, message `chore: daily update`) → push → `actions/upload-pages-artifact` with `path: site` → `actions/deploy-pages`.
- Also trigger on `push` to `main` touching `site/**` so design edits deploy.

- [ ] **Step 1:** Push repo; in GitHub → Settings → Pages, source = GitHub Actions.
- [ ] **Step 2:** Run the workflow manually; expect green and the site live at `<user>.github.io/hanifzulkifli-site`.
- [ ] **Step 3:** Check the Action log: update step printed no warnings, and the deployed page shows the real calendar.
- [ ] **Step 4:** commit `ci: daily update and Pages deploy`.

### Task 11: Launch

- [ ] Point DNS (in Canva or the new registrar): apex `A` records to GitHub Pages `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `www` `CNAME` → `<user>.github.io`. Set custom domain in Pages settings, wait for the certificate, tick "Enforce HTTPS".
- [ ] Verify `https://hanifzulkifli.com` and `https://www.hanifzulkifli.com` load the new site on desktop and phone.
- [ ] Verify end-to-end: Hanif adds one TikTok row → "run now" → TikTok appears on the right day; next YouTube upload appears after the nightly run.
- [ ] Write `docs/how-to.md` for Hanif (plain language): add a TikTok, hide a video, fix a date, press "run now", change the hero photo (ask Claude).
- [ ] Confirm domain auto-renew is on and the new expiry date is recorded in `docs/launch-notes.md`.
