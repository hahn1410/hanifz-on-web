import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDay, monthsToShow, buildMonth } from "../site/js/calendar.js";

const v = (id, platform, date, publishedAt = `${date}T12:00:00+08:00`) => ({ id, platform, date, publishedAt, url: "", title: "", thumb: "" });

test("a day's videos are ordered YouTube, then Short, then TikTok", () => {
  const day = groupByDay([v("t", "tiktok", "2024-11-04"), v("s", "short", "2024-11-04"), v("y", "youtube", "2024-11-04")]).get("2024-11-04");
  assert.deepEqual(day.map((x) => x.id), ["y", "s", "t"]);
});

test("two videos of the same kind on a day: newest first", () => {
  const day = groupByDay([
    v("old", "youtube", "2024-11-04", "2024-11-04T01:00:00Z"),
    v("new", "youtube", "2024-11-04", "2024-11-04T09:00:00Z"),
  ]).get("2024-11-04");
  assert.deepEqual(day.map((x) => x.id), ["new", "old"]);
});

test("monthsToShow: current month plus months with uploads, newest first, empty months skipped", () => {
  const months = monthsToShow([v("a", "youtube", "2024-11-04"), v("b", "youtube", "2024-11-20"), v("c", "tiktok", "2022-06-01")], "2026-11-22");
  assert.deepEqual(months, [{ year: 2026, month: 10 }, { year: 2024, month: 10 }, { year: 2022, month: 5 }]);
});

test("monthsToShow does not repeat the current month when it has uploads", () => {
  assert.deepEqual(monthsToShow([v("a", "youtube", "2026-11-02")], "2026-11-22"), [{ year: 2026, month: 10 }]);
});

test("buildMonth: November 2024 starts on Friday and has 30 days", () => {
  const m = buildMonth(2024, 10, new Map(), "2026-01-01", "2022-06-01");
  assert.equal(m.leading, 5);
  assert.equal(m.days.length, 30);
  assert.equal(m.days[0].date, "2024-11-01");
});

test("buildMonth: video, ✕ (none), future and before-first-video states", () => {
  const byDay = groupByDay([v("a", "youtube", "2024-11-05")]);
  const m = buildMonth(2024, 10, byDay, "2024-11-10", "2024-11-03");
  const state = (n) => m.days[n - 1].state;
  assert.equal(state(2), "before");
  assert.equal(state(4), "none");
  assert.equal(state(5), "video");
  assert.equal(m.days[4].videos[0].id, "a");
  assert.equal(state(9), "none");
  assert.equal(state(11), "future");
});

test("buildMonth: February in a leap year has 29 days", () => {
  assert.equal(buildMonth(2024, 1, new Map(), "2026-01-01", "2022-06-01").days.length, 29);
});

test("buildMonth: today without an upload is not ✕ yet (day isn't over)", () => {
  const m = buildMonth(2024, 10, new Map(), "2024-11-10", "2022-06-01");
  assert.equal(m.days[9].state, "future");
  assert.equal(m.days[8].state, "none");
});
