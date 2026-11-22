// Writes demo data to site/data/videos.json so the page can be previewed before the real run.
import { writeFileSync } from "node:fs";
const out = [];
const add = (id, platform, date, title) => out.push({
  id, platform, title, date, publishedAt: `${date}T12:00:00+08:00`,
  url: platform === "tiktok" ? "https://www.tiktok.com/" : `https://www.youtube.com/watch?v=${id}`,
  thumb: `https://picsum.photos/seed/${id}/320/200`,
});
const titles = ["Night market run", "Ferry to Langkawi", "Rainy day edit", "Climbing Bukit Bendera", "Street food 101", "Old town walk", "Behind the shoot", "Road trip day 3", "Desert camp", "Studio day"];
let n = 0;
for (const [y, m, every] of [[2026, 11, 2], [2026, 10, 3], [2025, 2, 1], [2024, 11, 4], [2022, 6, 5]]) {
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) {
    if (y === 2026 && m === 11 && d > 21) break;
    if (d % every !== 0) continue;
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    add(`demo${n++}`, d % 7 === 0 ? "short" : "youtube", date, titles[n % titles.length]);
  }
}
add("demo-tt-a", "tiktok", "2026-11-04", "TikTok on a YouTube day");
add("demo-sh-a", "short", "2026-11-04", "Short on a YouTube day");
add("demo-tt-b", "tiktok", "2026-11-05", "TikTok only day");
add("demo-sh-b", "short", "2026-11-07", "Short only day");
add("demo-yt-2", "youtube", "2026-11-08", "Second YouTube same day");
out.sort((a, b) => b.date.localeCompare(a.date));
writeFileSync(new URL("../site/data/videos.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} demo videos`);
