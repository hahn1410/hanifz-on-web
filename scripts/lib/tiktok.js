import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Look up a TikTok via oEmbed and store its thumbnail locally (TikTok's URLs expire). */
export async function fetchTikTok(url, videoId, outDir, fetchFn = fetch) {
  const res = await fetchFn(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`TikTok oEmbed ${res.status} for ${url}`);
  const meta = await res.json();
  if (!meta.thumbnail_url) throw new Error(`TikTok oEmbed gave no thumbnail for ${url}`);
  const img = await fetchFn(meta.thumbnail_url);
  if (!img.ok) throw new Error(`TikTok thumbnail ${img.status} for ${url}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${videoId}.jpg`), Buffer.from(await img.arrayBuffer()));
  return { title: meta.title ?? "", thumbPath: `thumbs/tiktok/${videoId}.jpg` };
}
