const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dayHeading = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const timeOnly = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const number = new Intl.NumberFormat();
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const valid = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (iso) => (valid(iso) ? dateTime.format(valid(iso)) : '—');
export const formatDate = (iso) => (valid(iso) ? dateOnly.format(valid(iso)) : '—');
export const formatTime = (iso) => (valid(iso) ? timeOnly.format(valid(iso)) : '');
export const formatDayHeading = (iso) => (valid(iso) ? dayHeading.format(valid(iso)) : 'Unknown date');
export const formatNumber = (n) => (n == null ? '—' : number.format(n));

/** Local calendar day, used to group headlines. */
export function dayKey(iso) {
  const d = valid(iso);
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : 'unknown';
}

export function formatRelative(iso) {
  const d = valid(iso);
  if (!d) return '';
  const seconds = (d.getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function sourceHost(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Only http(s) links from the data are ever rendered as anchors. */
export function safeLink(link) {
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** "AAPL.US" -> "AAPL"; null for non-US listings, which have no news file here. */
export function usTicker(symbol) {
  return typeof symbol === 'string' && symbol.endsWith('.US') ? symbol.slice(0, -3) : null;
}

export function sentimentTone(sentiment) {
  if (!sentiment || sentiment.polarity == null) return null;
  if (sentiment.polarity >= 0.2) return 'positive';
  if (sentiment.polarity <= -0.2) return 'negative';
  return 'neutral';
}
