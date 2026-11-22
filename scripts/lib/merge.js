import { toMalaysiaDate } from "./dates.js";

const noon = (date) => `${date}T12:00:00+08:00`;
const byNewest = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

function youtubeVideo(id, title, publishedAt, isShort) {
  return {
    id,
    platform: isShort ? "short" : "youtube",
    url: isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    title,
    date: toMalaysiaDate(publishedAt),
    publishedAt,
    thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

/**
 * Combine the YouTube store, sheet rows and TikTok cache into the site's video list.
 * `since` ("YYYY-MM-DD", optional) leaves out anything dated before the archive start.
 */
export function mergeVideos(store, rows, tiktokCache, { since } = {}) {
  const ytRows = new Map(rows.filter((r) => r.kind === "youtube").map((r) => [r.videoId, r]));
  const out = [];
  const seen = new Set();

  for (const s of store) {
    seen.add(s.id);
    const row = ytRows.get(s.id);
    if (row?.hide) continue;
    const v = youtubeVideo(s.id, s.title, s.publishedAt, s.isShort);
    if (row?.date && row.date !== v.date) { v.date = row.date; v.publishedAt = noon(row.date); }
    if (row?.title) v.title = row.title;
    out.push(v);
  }

  for (const row of ytRows.values()) {
    if (seen.has(row.videoId) || row.hide || !row.date) continue;
    out.push(youtubeVideo(row.videoId, row.title ?? "", noon(row.date), /\/shorts\//.test(row.link)));
  }

  for (const row of rows) {
    if (row.kind !== "tiktok" || row.hide) continue;
    const meta = tiktokCache[row.videoId];
    if (!meta) continue;
    out.push({
      id: `tt-${row.videoId}`, platform: "tiktok", url: row.link,
      title: row.title ?? meta.title, date: row.date, publishedAt: noon(row.date), thumb: meta.thumbPath,
    });
  }

  return out.filter((v) => !since || v.date >= since).sort(byNewest);
}
