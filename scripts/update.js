import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feedUrl, parseFeed, addNewToStore, detectShort } from "./lib/youtube.js";
import { parseSheet } from "./lib/sheet.js";
import { fetchTikTok } from "./lib/tiktok.js";
import { mergeVideos } from "./lib/merge.js";

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}
async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}
async function getText(fetchFn, url) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Daily update. Every step is isolated: a failure adds a warning and the
 * previous data is kept, so the live site is never emptied.
 */
export async function runUpdate({ config, root, fetchFn = fetch, detect = detectShort }) {
  const warnings = [];
  const p = (rel) => join(root, rel);

  // 1. YouTube feed -> permanent store (a corrupt store is never overwritten)
  let store = [];
  let storeOk = true;
  try {
    store = JSON.parse(await readFile(p("data/youtube.json"), "utf8"));
    if (!Array.isArray(store)) throw new Error("not a list");
  } catch (e) {
    if (e.code !== "ENOENT") {
      storeOk = false;
      store = [];
      warnings.push(`data/youtube.json is unreadable (${e.message}) — left untouched; restore it from git history`);
    }
  }
  if (storeOk) try {
    if (!config.channelId) throw new Error("channelId not set in config.json");
    const xml = await getText(fetchFn, feedUrl(config.channelId));
    const res = await addNewToStore(store, parseFeed(xml), (id) => detect(id, fetchFn));
    store = res.store;
    await writeJson(p("data/youtube.json"), store);
    console.log(`YouTube: ${res.added} new`);
  } catch (e) {
    warnings.push(`YouTube feed: ${e.message}`);
  }

  // 2. Google Sheet (read-only) with cache fallback
  let rows = await readJson(p("data/sheet-cache.json"), []);
  try {
    if (!config.sheetCsvUrl) throw new Error("sheetCsvUrl not set in config.json");
    const sheet = parseSheet(await getText(fetchFn, config.sheetCsvUrl));
    rows = sheet.rows;
    warnings.push(...sheet.problems);
    await writeJson(p("data/sheet-cache.json"), rows);
    console.log(`Sheet: ${rows.length} usable rows`);
  } catch (e) {
    warnings.push(`Google Sheet: ${e.message} (using last saved copy: ${rows.length} rows)`);
  }

  // 3. TikTok details for rows we haven't seen yet
  const tiktok = await readJson(p("data/tiktok.json"), {});
  let tiktokChanged = false;
  for (const row of rows) {
    if (row.kind !== "tiktok" || row.hide || tiktok[row.videoId]) continue;
    try {
      tiktok[row.videoId] = await fetchTikTok(row.link, row.videoId, p("site/thumbs/tiktok"), fetchFn);
      tiktokChanged = true;
    } catch (e) {
      warnings.push(`TikTok ${row.link}: ${e.message}`);
    }
  }
  if (tiktokChanged) await writeJson(p("data/tiktok.json"), tiktok);

  // 4. Merge and publish — never replace the live list with an empty or partial one
  if (!storeOk) {
    warnings.push("Skipped publishing because the YouTube store is unreadable");
    return { warnings };
  }
  const videos = mergeVideos(store, rows, tiktok, { since: config.archiveStart });
  if (videos.length > 0) {
    await writeJson(p("site/data/videos.json"), videos);
    console.log(`Site: ${videos.length} videos`);
  } else {
    warnings.push("Merged list is empty — kept the existing site/data/videos.json");
  }
  return { warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
  const { warnings } = await runUpdate({ config, root });
  for (const w of warnings) console.warn(`WARNING: ${w}`);
  process.exitCode = 0;
}
