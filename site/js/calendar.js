const PRIORITY = { youtube: 0, short: 1, tiktok: 2 };
const pad = (n) => String(n).padStart(2, "0");

/** Map "YYYY-MM-DD" -> videos that day, YouTube > Short > TikTok, then newest first. */
export function groupByDay(videos) {
  const map = new Map();
  for (const v of videos) {
    if (!map.has(v.date)) map.set(v.date, []);
    map.get(v.date).push(v);
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      (PRIORITY[a.platform] ?? 9) - (PRIORITY[b.platform] ?? 9) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }
  return map;
}

/** The current month plus every month with an upload, newest first (month is 0-based). */
export function monthsToShow(videos, today) {
  const keys = new Set([today.slice(0, 7), ...videos.map((v) => v.date.slice(0, 7))]);
  return [...keys].sort().reverse().map((k) => ({ year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)) - 1 }));
}

/** Cells for one month. state: video | none (✕) | future | before (prior to first ever upload). */
export function buildMonth(year, month, byDay, today, firstVideoDate) {
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = [];
  for (let n = 1; n <= count; n++) {
    const date = `${year}-${pad(month + 1)}-${pad(n)}`;
    const videos = byDay.get(date) ?? [];
    let state;
    if (videos.length) state = "video";
    else if (date > today) state = "future";
    else if (firstVideoDate && date < firstVideoDate) state = "before";
    else state = "none";
    days.push({ n, date, state, videos });
  }
  return { leading, days };
}
