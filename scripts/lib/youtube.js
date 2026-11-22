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

/**
 * A Short answers 200 at /shorts/<id>; a regular video redirects to /watch.
 * Anything else (consent/bot pages, network errors) is unknown: null, re-checked next run.
 */
export async function detectShort(id, fetchFn = fetch) {
  try {
    const res = await fetchFn(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual" });
    if (res.status === 200) return true;
    const location = res.headers?.get?.("location") ?? "";
    if (res.status >= 300 && res.status < 400 && /youtube\.com\/watch|^\/watch/.test(location)) return false;
    return null;
  } catch {
    return null;
  }
}

const byNewest = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

/** Add feed entries not yet in the store. Returns a new store, newest first. */
export async function addNewToStore(store, entries, detect = detectShort) {
  const known = new Set(store.map((v) => v.id));
  const rechecked = [];
  for (const v of store) {
    rechecked.push(v.isShort === null ? { ...v, isShort: await detect(v.id) } : v);
  }
  store = rechecked;
  const fresh = [];
  for (const e of entries) {
    if (known.has(e.id)) continue;
    known.add(e.id);
    fresh.push({ id: e.id, title: e.title, publishedAt: e.publishedAt, isShort: await detect(e.id) });
  }
  return { store: [...store, ...fresh].sort(byNewest), added: fresh.length };
}
