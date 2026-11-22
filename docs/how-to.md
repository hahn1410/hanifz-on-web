# Running your vlog archive

## The Google Sheet ("Vlog list")

Row 1 must be exactly: `date | link | title | hide`

| Column | What to put |
|---|---|
| date | The day the video went up, as **YYYY-MM-DD** (e.g. 2026-11-22). Tip: select the column → Format → Number → Custom date → `yyyy-mm-dd`. |
| link | The YouTube or TikTok link. TikTok "Copy link" links (vm.tiktok.com/…) work. |
| title | Optional. Leave empty to use the video's own title. |
| hide | Type `yes` to keep a video off the calendar. |

## Everyday tasks

- **New YouTube video:** nothing to do. It appears after the nightly update (midnight Malaysia time).
- **New TikTok:** add a row with the date and the link.
- **Hide a video:** add (or find) its row and type `yes` under hide.
- **Fix a date or title:** add (or find) its row and fill in date / title.
- **Want it to show now?** GitHub → your repo → Actions → "Update archive and deploy" → Run workflow.
- **Something didn't appear?** Open the latest run in Actions and look for lines starting with `WARNING:` — they say which sheet row was skipped and why.

## One-time setup notes (for Claude / whoever helps)

- GitHub → Settings → Pages: Source = **GitHub Actions**, Custom domain = `hanifzulkifli.com`, tick Enforce HTTPS (the CNAME file alone is not enough for Action deploys).
- Domain DNS (Hanif's registrar): apex `A` records → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153; `www` `CNAME` → `<github-username>.github.io`.
- Fill `config.json`: `channelId` (starts with UC…) and `sheetCsvUrl` (Sheet → File → Share → Publish to web → CSV).
- One-off history import: `YT_API_KEY=… node scripts/backfill-youtube.js`, then paste `data/backfill-for-sheet.csv` into the sheet. Delete the API key afterwards.
- Replace `site/img/hero.svg` with the real photo (and update `index.html`), the About text, contact links, and remove the demo `site/data/videos.json` before the first real run.
