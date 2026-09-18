// All data comes from the Node API (proxied at /api in dev). Never call RunPod from here.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { signal, method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      signal,
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the backend. Is it running on port 4000?', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export const getHealth = (signal) => request('/health', { signal });

export const getTickers = (signal) => request('/tickers', { signal });

export function getNews(ticker, { before, q, limit = 50 } = {}, signal) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  if (q) params.set('q', q);
  return request(`/tickers/${encodeURIComponent(ticker)}/news?${params}`, { signal });
}

export const getSyncStatus = (ticker, signal) =>
  request(`/tickers/${encodeURIComponent(ticker)}/sync`, { signal });

export const forceResync = (ticker) =>
  request(`/tickers/${encodeURIComponent(ticker)}/sync`, { method: 'POST' });

export const getArticle = (id, signal) => request(`/news/${encodeURIComponent(id)}`, { signal });

/** Asks the backend to summarize an article for a focus ticker (Gemini; not stored server-side). */
export const summarizeArticle = (id, ticker, signal) =>
  request(`/news/${encodeURIComponent(id)}/summary?ticker=${encodeURIComponent(ticker)}`, { method: 'POST', signal });

/**
 * Follow-up question about a summarized article. The backend is stateless, so send the
 * summary that was shown plus the whole thread ([{role: 'user'|'model', text}], ending
 * with the new question).
 */
export const askFollowUp = (id, ticker, { summary, messages }, signal) =>
  request(`/news/${encodeURIComponent(id)}/ask?ticker=${encodeURIComponent(ticker)}`, {
    method: 'POST',
    body: { summary, messages },
    signal,
  });
