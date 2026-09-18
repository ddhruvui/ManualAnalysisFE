import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getNews, getPins, getSyncStatus, getTickers, pinTicker, unpinTicker } from './api.js';

export function useDebounced(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

let tickerSetPromise = null;

/** Tickers that have a news file, so symbol chips only link where there is something to open. */
export function useTickerSet() {
  const [tickers, setTickers] = useState(null);
  useEffect(() => {
    let cancelled = false;
    tickerSetPromise ??= getTickers().then((res) => new Set(res.tickers.map((t) => t.ticker)));
    tickerSetPromise.then(
      (set) => !cancelled && setTickers(set),
      () => {
        tickerSetPromise = null; // let a later mount retry
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return tickers;
}

// Pinned tickers live in MongoDB (via the backend) so they follow the user across browsers
// and devices — unlike read-state below, which is per-device by nature. One module-level
// store keeps every mounted component in step and fetches once per session.
const LEGACY_PINNED_KEY = 'news-reader:pinned'; // where pins lived before MongoDB

const pinsStore = {
  snapshot: { status: 'loading', tickers: new Set(), error: null },
  listeners: new Set(),
  loading: null,
};

function setPins(next) {
  pinsStore.snapshot = next;
  for (const listener of pinsStore.listeners) listener();
}

function subscribePins(listener) {
  pinsStore.listeners.add(listener);
  return () => pinsStore.listeners.delete(listener);
}

const getPinsSnapshot = () => pinsStore.snapshot;

/** Move pins saved by an older build of this app to the server, once, then forget them. */
async function migrateLegacyPins(serverTickers) {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_PINNED_KEY));
  } catch {
    return serverTickers; // storage unavailable or corrupt — nothing to migrate
  }
  if (!Array.isArray(legacy) || !legacy.length) return serverTickers;

  let tickers = serverTickers;
  for (const ticker of legacy) {
    if (typeof ticker === 'string' && !tickers.includes(ticker)) tickers = (await pinTicker(ticker)).tickers;
  }
  try {
    localStorage.removeItem(LEGACY_PINNED_KEY);
  } catch {
    // migrated anyway; the stale key is harmless
  }
  return tickers;
}

/**
 * Load the pin list from the server. Single-flight: concurrent callers (React StrictMode
 * mounts twice, and several components use this hook) share one request.
 */
function loadPins({ force = false } = {}) {
  if (pinsStore.loading) return pinsStore.loading;
  if (!force && pinsStore.snapshot.status === 'ready') return Promise.resolve();

  pinsStore.loading = getPins()
    .then((res) => migrateLegacyPins(res.tickers))
    .then((tickers) => setPins({ status: 'ready', tickers: new Set(tickers), error: null }))
    .catch((err) => setPins({ status: 'error', tickers: new Set(), error: err.message }))
    .finally(() => {
      pinsStore.loading = null;
    });
  return pinsStore.loading;
}

/**
 * Re-read the list from the server, which is the source of truth: pins can change in
 * another browser or device, and it also heals any local drift. Quiet — a failed refresh
 * keeps whatever is on screen rather than replacing it with an error.
 */
function refreshPins() {
  if (pinsStore.loading || pinsStore.snapshot.status === 'loading') return;
  getPins()
    .then(({ tickers }) => {
      const next = new Set(tickers);
      const current = pinsStore.snapshot.tickers;
      const same = next.size === current.size && [...next].every((t) => current.has(t));
      if (!same || pinsStore.snapshot.status !== 'ready') {
        setPins({ status: 'ready', tickers: next, error: null });
      }
    })
    .catch(() => {});
}

/** Optimistic so the pin reacts instantly; reverts and reports if the server refuses. */
async function togglePin(ticker) {
  const before = pinsStore.snapshot;
  if (before.status !== 'ready') return;

  const pinned = before.tickers.has(ticker);
  const optimistic = new Set(before.tickers);
  if (pinned) optimistic.delete(ticker);
  else optimistic.add(ticker);
  setPins({ status: 'ready', tickers: optimistic, error: null });

  try {
    const { tickers } = await (pinned ? unpinTicker(ticker) : pinTicker(ticker));
    setPins({ status: 'ready', tickers: new Set(tickers), error: null });
  } catch (err) {
    setPins({ ...before, error: `Couldn’t ${pinned ? 'unpin' : 'pin'} ${ticker}: ${err.message}` });
  }
}

export function usePinnedTickers() {
  const { status, tickers, error } = useSyncExternalStore(subscribePins, getPinsSnapshot);

  useEffect(() => {
    loadPins();
    // Pins are shared state: pick up changes made elsewhere, and recover from any drift.
    const onFocus = () => refreshPins();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return { pinned: tickers, status, error, available: status === 'ready', togglePin };
}

const READ_KEY = 'news-reader:read';
const READ_LIMIT = 5000;

function loadReadIds() {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY)) ?? [];
  } catch {
    return [];
  }
}

/** Remembers which articles were opened (this browser only) so headlines can be dimmed. */
export function useReadArticles() {
  const [ids, setIds] = useState(() => new Set(loadReadIds()));
  const markRead = useCallback((id) => {
    setIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-READ_LIMIT)));
      } catch {
        // storage unavailable — read state just won't persist
      }
      return next;
    });
  }, []);
  return { readIds: ids, markRead };
}

const SYNC_ACTIVE = new Set(['queued', 'syncing']);
const EMPTY = { items: [], nextCursor: null, sync: null, status: 'loading', error: null, loadingMore: false };

/**
 * Newest-first headlines for a ticker with cursor paging. While the backend is still
 * indexing the ticker's full history, polls its progress and unlocks older pages once done.
 */
export function useHeadlines(ticker, q) {
  const [state, setState] = useState(EMPTY);
  const [reloadKey, setReloadKey] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    const ctrl = new AbortController();
    setState(EMPTY);
    getNews(ticker, { q }, ctrl.signal)
      .then((res) => {
        if (gen !== generation.current) return;
        setState({ ...EMPTY, items: res.items, nextCursor: res.nextCursor, sync: res.sync, status: 'ready' });
      })
      .catch((err) => {
        if (err.name === 'AbortError' || gen !== generation.current) return;
        setState({ ...EMPTY, status: 'error', error: err.message });
      });
    return () => ctrl.abort();
  }, [ticker, q, reloadKey]);

  const loadMore = useCallback(() => {
    const { nextCursor, loadingMore, status } = stateRef.current;
    if (!nextCursor || loadingMore || status !== 'ready') return;
    const gen = generation.current;
    setState((s) => ({ ...s, loadingMore: true }));
    getNews(ticker, { q, before: nextCursor })
      .then((res) => {
        if (gen !== generation.current) return;
        setState((s) => ({ ...s, items: [...s.items, ...res.items], nextCursor: res.nextCursor, loadingMore: false }));
      })
      .catch((err) => {
        if (gen !== generation.current) return;
        setState((s) => ({ ...s, loadingMore: false, error: err.message }));
      });
  }, [ticker, q]);

  const syncState = state.sync?.state;
  useEffect(() => {
    if (!SYNC_ACTIVE.has(syncState)) return undefined;
    const gen = generation.current;
    const timer = setInterval(async () => {
      try {
        const sync = await getSyncStatus(ticker);
        if (gen !== generation.current) return;
        setState((s) => {
          const finished = !SYNC_ACTIVE.has(sync.state);
          // The list may have run out while only the newest articles were indexed;
          // once history is in, continue paging from the last headline shown.
          const nextCursor = finished && !s.nextCursor && s.items.length ? s.items.at(-1).cursor : s.nextCursor;
          return { ...s, sync, nextCursor };
        });
      } catch {
        // transient — keep polling
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [ticker, syncState]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, loadMore, reload };
}
