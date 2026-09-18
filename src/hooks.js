import { useCallback, useEffect, useRef, useState } from 'react';
import { getNews, getSyncStatus, getTickers } from './api.js';

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

const PINNED_KEY = 'news-reader:pinned';

function loadPinned() {
  try {
    const value = JSON.parse(localStorage.getItem(PINNED_KEY));
    return Array.isArray(value) ? value.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Tickers the user pinned to the top of the ticker list (this browser only). */
export function usePinnedTickers() {
  const [pinned, setPinned] = useState(() => new Set(loadPinned()));

  // Keep other open tabs in step.
  useEffect(() => {
    const onStorage = (e) => e.key === PINNED_KEY && setPinned(new Set(loadPinned()));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const togglePin = useCallback((ticker) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (!next.delete(ticker)) next.add(ticker);
      try {
        localStorage.setItem(PINNED_KEY, JSON.stringify([...next]));
      } catch {
        // storage unavailable — pins just won't persist
      }
      return next;
    });
  }, []);

  return { pinned, togglePin };
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
