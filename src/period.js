// Calendar-day helpers for digests. Days follow the user's LOCAL calendar — the same one
// the headline list groups by — and are sent to the backend as epoch-millisecond ranges.

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day of a Date as "YYYY-MM-DD" (used in URLs). */
export const toAnchor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "YYYY-MM-DD" -> Date at local midnight, or null if it isn't a real date. */
export function parseAnchor(anchor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor ?? '');
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toAnchor(date) === anchor ? date : null;
}

/** [from, to) in epoch ms for the local day starting at `start`. DST-safe (no fixed 24h). */
export function dayRange(start) {
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { from: start.getTime(), to: next.getTime() };
}

export const shiftDay = (start, days) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
