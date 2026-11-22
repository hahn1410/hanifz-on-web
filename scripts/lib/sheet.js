/** RFC 4180 CSV -> rows of cells. Blank lines are dropped. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  const endRow = () => {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = []; cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") endRow();
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

const pad = (n) => String(n).padStart(2, "0");

function parseDate(s) {
  s = (s ?? "").trim();
  let y, m, d, mt;
  if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = mt.map(Number);
  else if ((mt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, m, y] = mt.map(Number);
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function identify(link) {
  let m;
  if ((m = link.match(/youtu\.be\/([\w-]{6,})/))) return { kind: "youtube", videoId: m[1] };
  if ((m = link.match(/youtube\.com\/(?:shorts|live|embed)\/([\w-]{6,})/))) return { kind: "youtube", videoId: m[1] };
  if (/youtube\.com\/watch/.test(link) && (m = link.match(/[?&]v=([\w-]{6,})/))) return { kind: "youtube", videoId: m[1] };
  if ((m = link.match(/tiktok\.com\/.*\/video\/(\d+)/))) return { kind: "tiktok", videoId: m[1] };
  return null;
}

const HIDE_WORDS = new Set(["yes", "y", "true", "1", "x"]);

/** One sheet row -> SheetRow, or null when the row can't be used. */
export function normalizeRow(cells, header) {
  const get = (name) => {
    const i = header.indexOf(name);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };
  const link = get("link");
  const id = link && identify(link);
  if (!id) return null;
  const date = parseDate(get("date"));
  if (id.kind === "tiktok" && !date) return null;
  return {
    date, link, title: get("title") || null,
    hide: HIDE_WORDS.has(get("hide").toLowerCase()),
    ...id,
  };
}

/** Whole published CSV -> SheetRow[] (header row matched case-insensitively). */
export function parseSheet(csv) {
  const [head, ...rows] = parseCsv(csv);
  if (!head) return [];
  const header = head.map((h) => h.trim().toLowerCase());
  return rows.map((r) => normalizeRow(r, header)).filter(Boolean);
}
