import { test } from "node:test";
import assert from "node:assert/strict";
import { toMalaysiaDate } from "../scripts/lib/dates.js";

test("late-evening UTC rolls over to the next Malaysia day", () => {
  assert.equal(toMalaysiaDate("2024-11-03T17:30:00Z"), "2024-11-04");
});
test("just before Malaysia midnight stays on the same day", () => {
  assert.equal(toMalaysiaDate("2024-11-03T15:59:59Z"), "2024-11-03");
});
test("Malaysia midnight exactly is the next day, offset form accepted", () => {
  assert.equal(toMalaysiaDate("2024-11-03T16:00:00+00:00"), "2024-11-04");
});
