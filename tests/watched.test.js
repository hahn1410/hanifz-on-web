import { test } from "node:test";
import assert from "node:assert/strict";
import { createWatched } from "../site/js/watched.js";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, val) => m.set(k, String(val)) };
}

test("marked videos are remembered across page loads", () => {
  const storage = memoryStorage();
  createWatched(storage).mark("a");
  assert.equal(createWatched(storage).has("a"), true);
  assert.equal(createWatched(storage).has("b"), false);
});

test("toggle flips the state and returns it", () => {
  const w = createWatched(memoryStorage());
  assert.equal(w.toggle("a"), true);
  assert.equal(w.has("a"), true);
  assert.equal(w.toggle("a"), false);
  assert.equal(w.has("a"), false);
});

test("blocked storage (private mode) never throws; ticks work for the visit", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const w = createWatched(broken);
  assert.equal(w.toggle("a"), true);
  assert.equal(w.has("a"), true);
});

test("no storage at all works too", () => {
  const w = createWatched(undefined);
  w.mark("x");
  assert.equal(w.has("x"), true);
});

test("corrupt saved data is ignored", () => {
  const s = memoryStorage();
  s.setItem("hz-watched", "{not json");
  assert.equal(createWatched(s).has("a"), false);
});

test("a browser that throws just for touching localStorage still works", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  try {
    const w = createWatched();
    assert.equal(w.toggle("a"), true);
  } finally {
    delete globalThis.localStorage;
  }
});
