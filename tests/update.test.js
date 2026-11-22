import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpdate } from "../scripts/update.js";

const config = { channelId: "UCxxxxxxxxxxxxxxxxxxxxxx", sheetCsvUrl: "https://docs.google.com/x/pub?output=csv" };
const feed = readFileSync(new URL("./fixtures/feed.xml", import.meta.url), "utf8");

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "site-"));
  mkdirSync(join(root, "site/data"), { recursive: true });
  return root;
}

test("when every source is down, the live videos.json is left untouched", async () => {
  const root = makeRoot();
  const existing = '[{"id":"keep"}]\n';
  writeFileSync(join(root, "site/data/videos.json"), existing);
  const { warnings } = await runUpdate({ config, root, fetchFn: async () => { throw new Error("offline"); }, detect: async () => false });
  assert.equal(readFileSync(join(root, "site/data/videos.json"), "utf8"), existing);
  assert.equal(warnings.length, 3);
});

test("happy path: feed + sheet + TikTok produce a merged videos.json and stores", async () => {
  const root = makeRoot();
  const csv = "date,link,title,hide\n20/11/2026,https://www.tiktok.com/@h/video/999,,\n,https://youtu.be/vidCCCCCCC3,,yes\n";
  const fetchFn = async (url) => {
    if (url.includes("feeds/videos.xml")) return { ok: true, status: 200, text: async () => feed };
    if (url === config.sheetCsvUrl) return { ok: true, status: 200, text: async () => csv };
    if (url.includes("tiktok.com/oembed")) return { ok: true, status: 200, json: async () => ({ title: "TT", thumbnail_url: "https://cdn/x.jpg" }) };
    if (url === "https://cdn/x.jpg") return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1]).buffer };
    throw new Error("unexpected " + url);
  };
  const { warnings } = await runUpdate({ config, root, fetchFn, detect: async (id) => id === "vidBBBBBBB2" });
  assert.deepEqual(warnings, []);
  const videos = JSON.parse(readFileSync(join(root, "site/data/videos.json"), "utf8"));
  assert.deepEqual(videos.map((v) => [v.id, v.platform]), [["vidAAAAAAA1", "youtube"], ["tt-999", "tiktok"], ["vidBBBBBBB2", "short"]]);
  assert.equal(JSON.parse(readFileSync(join(root, "data/youtube.json"), "utf8")).length, 3);
  assert.ok(existsSync(join(root, "site/thumbs/tiktok/999.jpg")));
  assert.ok(existsSync(join(root, "data/sheet-cache.json")));
});

test("sheet down: falls back to the cached sheet rows", async () => {
  const root = makeRoot();
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(join(root, "data/youtube.json"), JSON.stringify([{ id: "abcdefghijk", title: "t", publishedAt: "2024-01-01T00:00:00Z", isShort: false }]));
  writeFileSync(join(root, "data/sheet-cache.json"), JSON.stringify([{ date: null, link: "https://youtu.be/abcdefghijk", title: null, hide: true, kind: "youtube", videoId: "abcdefghijk" }]));
  writeFileSync(join(root, "site/data/videos.json"), '[{"id":"old"}]');
  const fetchFn = async (url) => {
    if (url.includes("feeds/videos.xml")) return { ok: true, status: 200, text: async () => feed };
    throw new Error("sheet offline");
  };
  const { warnings } = await runUpdate({ config, root, fetchFn, detect: async () => false });
  assert.equal(warnings.length, 1);
  const ids = JSON.parse(readFileSync(join(root, "site/data/videos.json"), "utf8")).map((v) => v.id);
  assert.ok(!ids.includes("abcdefghijk"), "hidden via cached sheet");
  assert.ok(ids.includes("vidAAAAAAA1"));
});
