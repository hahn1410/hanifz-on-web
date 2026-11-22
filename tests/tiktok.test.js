import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchTikTok } from "../scripts/lib/tiktok.js";

const URL_ = "https://www.tiktok.com/@hanif/video/7301234567890";
const img = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);

function fakeFetch({ oembedStatus = 200 } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url.startsWith("https://www.tiktok.com/oembed")) {
      return { ok: oembedStatus < 300, status: oembedStatus,
        json: async () => ({ title: "Ferry to Langkawi", thumbnail_url: "https://cdn.example/t.jpg" }) };
    }
    return { ok: true, status: 200, arrayBuffer: async () => img.buffer };
  };
  return { fn, calls };
}

test("fetchTikTok saves the thumbnail and returns title + site path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tt-"));
  const { fn, calls } = fakeFetch();
  const out = await fetchTikTok(URL_, "7301234567890", dir, fn);
  assert.deepEqual(out, { title: "Ferry to Langkawi", thumbPath: "thumbs/tiktok/7301234567890.jpg" });
  assert.deepEqual([...readFileSync(join(dir, "7301234567890.jpg"))], [...img]);
  assert.equal(calls[0], `https://www.tiktok.com/oembed?url=${encodeURIComponent(URL_)}`);
});

test("fetchTikTok rejects when oEmbed fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tt-"));
  await assert.rejects(fetchTikTok(URL_, "1", dir, fakeFetch({ oembedStatus: 404 }).fn));
});
