import { decodeEntities } from "./xml.js";

export const feedUrl = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1].trim()) : null;
}

/** YouTube channel Atom feed -> [{id, title, publishedAt}] in feed order. */
export function parseFeed(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries
    .map((block) => ({
      id: tag(block, "yt:videoId"),
      title: tag(block, "title") ?? "",
      publishedAt: tag(block, "published"),
    }))
    .filter((e) => e.id && e.publishedAt);
}

/** A Short answers 200 at /shorts/<id>; a regular video redirects to /watch. */
export async function detectShort(id, fetchFn = fetch) {
  try {
    const res = await fetchFn(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual" });
    return res.status === 200;
  } catch {
    return false;
  }
}

const byNewest = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

/** Add feed entries not yet in the store. Returns a new store, newest first. */
export async function addNewToStore(store, entries, detect = detectShort) {
  const known = new Set(store.map((v) => v.id));
  const fresh = [];
  for (const e of entries) {
    if (known.has(e.id)) continue;
    known.add(e.id);
    fresh.push({ id: e.id, title: e.title, publishedAt: e.publishedAt, isShort: await detect(e.id) });
  }
  return { store: [...store, ...fresh].sort(byNewest), added: fresh.length };
}
