const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Publish timestamp (any ISO form) -> calendar date in Malaysia time, "YYYY-MM-DD". */
export function toMalaysiaDate(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Bad timestamp: ${iso}`);
  return new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10);
}
