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
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthNo = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

function parseDate(s) {
  s = (s ?? "").trim();
  let y, m, d, mt;
  if ((mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = mt.map(Number);
  else if ((mt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, m, y] = mt.map(Number);
  else if ((mt = s.match(/^(\d{1,2})[\s-]+([a-z]+)[\s,-]+(\d{4})$/i))) { d = +mt[1]; m = monthNo(mt[2]); y = +mt[3]; }
  else if ((mt = s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i))) { m = monthNo(mt[1]); d = +mt[2]; y = +mt[3]; }
  else return null;
  if (!m) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function identify(link) {
  let m;
  if (!/^https?:\/\//i.test(link)) return null;
  if ((m = link.match(/^https?:\/\/youtu\.be\/([\w-]{6,})/i))) return { kind: "youtube", videoId: m[1] };
  if ((m = link.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts|live|embed)\/([\w-]{6,})/i))) return { kind: "youtube", videoId: m[1] };
  if (/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch/i.test(link) && (m = link.match(/[?&]v=([\w-]{6,})/))) return { kind: "youtube", videoId: m[1] };
  if ((m = link.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/.*\/video\/(\d+)/i))) return { kind: "tiktok", videoId: m[1] };
  if ((m = link.match(/^https?:\/\/(vm|vt)\.tiktok\.com\/([\w-]+)/i))) return { kind: "tiktok", videoId: `${m[1].toLowerCase()}-${m[2]}` };
  return null;
}

const HIDE_WORDS = new Set(["yes", "y", "true", "1", "x"]);

/** One sheet row -> { row: SheetRow | null, problem: string | null }. */
function analyzeRow(cells, header) {
  const get = (name) => {
    const i = header.indexOf(name);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };
  const link = get("link");
  if (!link) return { row: null, problem: "no link" };
  const id = identify(link);
  if (!id) return { row: null, problem: `link not recognised as YouTube or TikTok (${link})` };
  const rawDate = get("date");
  const date = parseDate(rawDate);
  if (id.kind === "tiktok" && !date) {
    return { row: null, problem: `TikTok skipped — date "${rawDate}" couldn't be read (use YYYY-MM-DD)` };
  }
  const problem = rawDate && !date ? `date "${rawDate}" couldn't be read (use YYYY-MM-DD) — ignored` : null;
  return {
    row: { date, link, title: get("title") || null, hide: HIDE_WORDS.has(get("hide").toLowerCase()), ...id },
    problem,
  };
}

/** One sheet row -> SheetRow, or null when the row can't be used. */
export function normalizeRow(cells, header) {
  return analyzeRow(cells, header).row;
}

/** Whole published CSV -> { rows: SheetRow[], problems: string[] } (header matched case-insensitively). */
export function parseSheet(csv) {
  const [head, ...data] = parseCsv(csv);
  if (!head) return { rows: [], problems: [] };
  const header = head.map((h) => h.trim().toLowerCase());
  const rows = [], problems = [];
  data.forEach((cells, i) => {
    // Unused rows still carry the tick box's FALSE: treat them as blank.
    if (cells.every((c) => c.trim() === "" || c.trim().toUpperCase() === "FALSE")) return;
    const { row, problem } = analyzeRow(cells, header);
    if (row) rows.push(row);
    if (problem) problems.push(`Sheet row ${i + 2}: ${problem}`);
  });
  return { rows, problems };
}
