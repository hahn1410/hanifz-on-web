// One-off: import every past upload from the channel.
// Usage: YT_API_KEY=... node scripts/backfill-youtube.js   (key is never saved)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addNewToStore } from "./lib/youtube.js";
import { toMalaysiaDate } from "./lib/dates.js";

export async function fetchUploads(channelId, key, fetchFn = fetch) {
  const playlistId = channelId.replace(/^UC/, "UU");
  const out = [];
  let pageToken = "";
  do {
    const u = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    u.search = new URLSearchParams({ part: "snippet,contentDetails", maxResults: "50", playlistId, key, ...(pageToken && { pageToken }) });
    const res = await fetchFn(u.toString());
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const page = await res.json();
    for (const it of page.items ?? []) {
      const publishedAt = it.contentDetails?.videoPublishedAt;
      if (!publishedAt) continue; // private or deleted
      out.push({ id: it.contentDetails.videoId, title: it.snippet?.title ?? "", publishedAt });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toSheetCsv(store) {
  return "date,link,title,hide\n" +
    store.map((v) => `${toMalaysiaDate(v.publishedAt)},https://youtu.be/${v.id},${q(v.title)},\n`).join("");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const key = process.env.YT_API_KEY;
  if (!key) throw new Error("Set YT_API_KEY");
  const { channelId } = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
  let store = [];
  try { store = JSON.parse(await readFile(join(root, "data/youtube.json"), "utf8")); } catch {}
  const uploads = await fetchUploads(channelId, key);
  const res = await addNewToStore(store, uploads);
  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(join(root, "data/youtube.json"), JSON.stringify(res.store, null, 2) + "\n");
  await writeFile(join(root, "data/backfill-for-sheet.csv"), toSheetCsv(res.store));
  console.log(`Found ${uploads.length} uploads, added ${res.added}. Paste data/backfill-for-sheet.csv into the sheet.`);
}
