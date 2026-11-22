import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, normalizeRow, parseSheet } from "../scripts/lib/sheet.js";

const H = ["date", "link", "title", "hide"];

test("parseCsv keeps quoted commas, escaped quotes and CRLF", () => {
  const rows = parseCsv('date,link,title,hide\r\n2024-11-04,https://youtu.be/a,"Penang, day 2",\r\n,x,"He said ""hi""",yes\r\n');
  assert.deepEqual(rows[1], ["2024-11-04", "https://youtu.be/a", "Penang, day 2", ""]);
  assert.equal(rows[2][2], 'He said "hi"');
});

test("parseCsv keeps newlines inside quotes and drops blank lines", () => {
  const rows = parseCsv('a,b\n\n"line1\nline2",c\n\n');
  assert.deepEqual(rows, [["a", "b"], ["line1\nline2", "c"]]);
});

test("normalizeRow: youtu.be link -> youtube row", () => {
  const r = normalizeRow(["", "https://youtu.be/abc123XYZ_-", "", ""], H);
  assert.equal(r.kind, "youtube");
  assert.equal(r.videoId, "abc123XYZ_-");
  assert.equal(r.date, null);
  assert.equal(r.title, null);
  assert.equal(r.hide, false);
});

test("normalizeRow: watch?v= and /shorts/ links", () => {
  assert.equal(normalizeRow(["", "https://www.youtube.com/watch?v=QWERTY12345&t=4s", "", ""], H).videoId, "QWERTY12345");
  assert.equal(normalizeRow(["", "https://youtube.com/shorts/SHORTid_123?feature=share", "", ""], H).videoId, "SHORTid_123");
});

test("normalizeRow: TikTok with Malaysian D/M/YYYY date", () => {
  const r = normalizeRow(["4/11/2024", "https://www.tiktok.com/@hanif/video/7301234567890?lang=en", "Ferry", ""], H);
  assert.deepEqual(r, {
    date: "2024-11-04", link: "https://www.tiktok.com/@hanif/video/7301234567890?lang=en",
    title: "Ferry", hide: false, kind: "tiktok", videoId: "7301234567890",
  });
});

test("normalizeRow: TikTok without a valid date is rejected", () => {
  assert.equal(normalizeRow(["soon", "https://www.tiktok.com/@hanif/video/7301234567890", "", ""], H), null);
});

test("normalizeRow: unsupported or missing link is rejected", () => {
  assert.equal(normalizeRow(["2024-01-01", "https://instagram.com/p/x", "", ""], H), null);
  assert.equal(normalizeRow(["2024-01-01", "", "", ""], H), null);
});

test("normalizeRow: hide accepts yes/y/true/1/x in any case", () => {
  for (const v of ["YES", "y", "True", "1", "X"]) {
    assert.equal(normalizeRow(["", "https://youtu.be/abcdefghijk", "", v], H).hide, true, v);
  }
  assert.equal(normalizeRow(["", "https://youtu.be/abcdefghijk", "", "no"], H).hide, false);
});

test("normalizeRow: impossible date is treated as no date", () => {
  assert.equal(normalizeRow(["31/2/2024", "https://youtu.be/abcdefghijk", "", ""], H).date, null);
});

test("parseSheet uses the header row, tolerates column order and junk rows", () => {
  const csv = "Link,Date,Hide,Title\nhttps://youtu.be/abcdefghijk,2024-01-02,,New\nnot a link,,,\n";
  const { rows } = parseSheet(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2024-01-02");
  assert.equal(rows[0].title, "New");
});

test("normalizeRow: TikTok app share links (vm./vt.tiktok.com) are accepted", () => {
  const r = normalizeRow(["2026-11-20", "https://vm.tiktok.com/ZMabc123/", "", ""], H);
  assert.equal(r.kind, "tiktok");
  assert.equal(r.videoId, "vm-ZMabc123");
  assert.equal(normalizeRow(["2026-11-20", "https://vt.tiktok.com/ZSxyz789", "", ""], H).videoId, "vt-ZSxyz789");
});

test("normalizeRow: links must really be https TikTok/YouTube", () => {
  assert.equal(normalizeRow(["2026-11-20", "javascript:alert(1)//tiktok.com/a/video/1", "", ""], H), null);
});

test("normalizeRow: written-out dates like '3 Nov 2024' and 'Nov 3, 2024' are read", () => {
  assert.equal(normalizeRow(["3 Nov 2024", "https://youtu.be/abcdefghijk", "", ""], H).date, "2024-11-03");
  assert.equal(normalizeRow(["November 3, 2024", "https://youtu.be/abcdefghijk", "", ""], H).date, "2024-11-03");
});

test("parseSheet reports rows it had to skip or whose date it couldn't read", () => {
  const csv = "date,link,title,hide\n2026-01-01,https://instagram.com/p/x,,\n13/13/2026,https://youtu.be/abcdefghijk,,\nsoon,https://www.tiktok.com/@h/video/123,,\n";
  const { rows, problems } = parseSheet(csv);
  assert.equal(rows.length, 1);
  assert.equal(problems.length, 3);
  assert.match(problems[0], /row 2/);
  assert.match(problems[1], /date/);
});

test("empty rows that only hold an unticked hide box are ignored silently", () => {
  const csv = "date,link,title,hide\n2026-01-01,https://youtu.be/abcdefghijk,,TRUE\n,,,FALSE\n,,,FALSE\n";
  const { rows, problems } = parseSheet(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hide, true);
  assert.deepEqual(problems, []);
});
