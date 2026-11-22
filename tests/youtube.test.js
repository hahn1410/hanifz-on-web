import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, detectShort, addNewToStore } from "../scripts/lib/youtube.js";

const xml = readFileSync(new URL("./fixtures/feed.xml", import.meta.url), "utf8");

test("parseFeed reads every entry with id, title and publish time", () => {
  const entries = parseFeed(xml);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], {
    id: "vidAAAAAAA1",
    title: "Penang night market & more",
    publishedAt: "2026-11-20T13:00:05+00:00",
  });
});

test("parseFeed decodes XML entities in titles and ignores the channel title", () => {
  const titles = parseFeed(xml).map((e) => e.title);
  assert.equal(titles[1], 'Quick "short" clip');
  assert.ok(!titles.includes("Hanif Z."));
});

test("detectShort: 200 from /shorts/ means Short", async () => {
  const calls = [];
  const fake = async (url, opts) => { calls.push([url, opts]); return { status: 200 }; };
  assert.equal(await detectShort("abc", fake), true);
  assert.equal(calls[0][0], "https://www.youtube.com/shorts/abc");
  assert.equal(calls[0][1].redirect, "manual");
});

test("detectShort: redirect means regular video", async () => {
  assert.equal(await detectShort("abc", async () => ({ status: 303 })), false);
});

test("detectShort: network error falls back to regular video", async () => {
  assert.equal(await detectShort("abc", async () => { throw new Error("offline"); }), false);
});

test("addNewToStore adds only unseen ids, records isShort, newest first", async () => {
  const store = [{ id: "vidCCCCCCC3", title: "Desert day 3", publishedAt: "2026-11-18T17:30:00+00:00", isShort: false }];
  const detect = async (id) => id === "vidBBBBBBB2";
  const { store: out, added } = await addNewToStore(store, parseFeed(xml), detect);
  assert.equal(added, 2);
  assert.deepEqual(out.map((v) => v.id), ["vidAAAAAAA1", "vidBBBBBBB2", "vidCCCCCCC3"]);
  assert.equal(out[1].isShort, true);
  assert.equal(out[0].isShort, false);
  assert.equal(new Set(out.map((v) => v.id)).size, 3);
});
