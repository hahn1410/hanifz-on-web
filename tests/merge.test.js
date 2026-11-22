import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeVideos } from "../scripts/lib/merge.js";

const store = [
  { id: "abcdefghijk", title: "Old title", publishedAt: "2024-01-01T17:00:00Z", isShort: false },
  { id: "shortshort1", title: "A short", publishedAt: "2024-01-03T02:00:00Z", isShort: true },
];
const yt = (videoId, extra = {}) => ({ date: null, link: `https://youtu.be/${videoId}`, title: null, hide: false, kind: "youtube", videoId, ...extra });
const tt = (videoId, date, extra = {}) => ({ date, link: `https://www.tiktok.com/@h/video/${videoId}`, title: null, hide: false, kind: "tiktok", videoId, ...extra });

test("YouTube store becomes videos with Malaysia dates, urls and thumbs", () => {
  const [short, vid] = mergeVideos(store, [], {});
  assert.deepEqual(vid, {
    id: "abcdefghijk", platform: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "Old title", date: "2024-01-02", publishedAt: "2024-01-01T17:00:00Z",
    thumb: "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg",
  });
  assert.equal(short.platform, "short");
  assert.equal(short.url, "https://www.youtube.com/shorts/shortshort1");
});

test("a YouTube video in both store and sheet appears once with sheet overrides", () => {
  const out = mergeVideos(store, [yt("abcdefghijk", { date: "2024-01-05", title: "New" })], {});
  const hits = out.filter((v) => v.id === "abcdefghijk");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].date, "2024-01-05");
  assert.equal(hits[0].title, "New");
});

test("hide in the sheet removes a YouTube video", () => {
  const out = mergeVideos(store, [yt("abcdefghijk", { hide: true })], {});
  assert.ok(!out.some((v) => v.id === "abcdefghijk"));
});

test("a sheet-only YouTube link is added as a regular video", () => {
  const out = mergeVideos([], [yt("zzzzzzzzzzz", { date: "2025-02-02" })], {});
  assert.equal(out.length, 1);
  assert.equal(out[0].platform, "youtube");
  assert.equal(out[0].date, "2025-02-02");
});

test("a sheet-only YouTube link without a date is skipped", () => {
  assert.equal(mergeVideos([], [yt("zzzzzzzzzzz")], {}).length, 0);
});

test("TikTok rows with cached details become tiktok videos; uncached or hidden are dropped", () => {
  const cache = { "111": { title: "Ferry", thumbPath: "thumbs/tiktok/111.jpg" }, "222": { title: "x", thumbPath: "thumbs/tiktok/222.jpg" } };
  const out = mergeVideos([], [tt("111", "2026-11-20"), tt("222", "2026-11-21", { hide: true }), tt("333", "2026-11-22")], cache);
  assert.deepEqual(out, [{
    id: "tt-111", platform: "tiktok", url: "https://www.tiktok.com/@h/video/111", title: "Ferry",
    date: "2026-11-20", publishedAt: "2026-11-20T12:00:00+08:00", thumb: "thumbs/tiktok/111.jpg",
  }]);
});

test("output is newest first", () => {
  const out = mergeVideos(store, [tt("111", "2023-06-01")], { "111": { title: "t", thumbPath: "p" } });
  assert.deepEqual(out.map((v) => v.id), ["shortshort1", "abcdefghijk", "tt-111"]);
});

test("a sheet date equal to YouTube's own date keeps the exact upload time", () => {
  const [, vid] = mergeVideos(store, [yt("abcdefghijk", { date: "2024-01-02" })], {});
  assert.equal(vid.publishedAt, "2024-01-01T17:00:00Z");
});

test("videos before the archive start date are left out", () => {
  const out = mergeVideos(store, [tt("111", "2023-12-31")], { "111": { title: "t", thumbPath: "p" } }, { since: "2024-01-02" });
  assert.deepEqual(out.map((v) => v.id), ["shortshort1", "abcdefghijk"]);
  assert.equal(mergeVideos(store, [], {}, { since: "2024-01-03" }).length, 1);
});
