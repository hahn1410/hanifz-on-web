import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchUploads, toSheetCsv } from "../scripts/backfill-youtube.js";

test("fetchUploads walks every page of the uploads playlist (UC -> UU)", async () => {
  const urls = [];
  const pages = {
    "": { nextPageToken: "P2", items: [{ snippet: { title: "A" }, contentDetails: { videoId: "aaaaaaaaaaa", videoPublishedAt: "2024-01-01T00:00:00Z" } }] },
    P2: { items: [
      { snippet: { title: "B" }, contentDetails: { videoId: "bbbbbbbbbbb", videoPublishedAt: "2022-06-01T00:00:00Z" } },
      { snippet: { title: "Private video" }, contentDetails: { videoId: "ccccccccccc" } },
    ] },
  };
  const fetchFn = async (url) => {
    urls.push(url);
    const token = new URL(url).searchParams.get("pageToken") ?? "";
    return { ok: true, status: 200, json: async () => pages[token] };
  };
  const out = await fetchUploads("UCabc123", "KEY", fetchFn);
  assert.deepEqual(out, [
    { id: "aaaaaaaaaaa", title: "A", publishedAt: "2024-01-01T00:00:00Z" },
    { id: "bbbbbbbbbbb", title: "B", publishedAt: "2022-06-01T00:00:00Z" },
  ]);
  assert.equal(new URL(urls[0]).searchParams.get("playlistId"), "UUabc123");
  assert.equal(urls.length, 2);
});

test("toSheetCsv writes Malaysia dates, links and quoted titles", () => {
  const csv = toSheetCsv([{ id: "aaaaaaaaaaa", title: 'Penang, "day 2"', publishedAt: "2024-01-01T17:00:00Z", isShort: false }]);
  assert.equal(csv, 'date,link,title,hide\n2024-01-02,https://youtu.be/aaaaaaaaaaa,"Penang, ""day 2""",\n');
});
