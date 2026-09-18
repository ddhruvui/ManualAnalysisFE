import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { forceResync } from '../api.js';
import { formatNumber } from '../format.js';
import { useDebounced, useHeadlines, usePinnedTickers, useReadArticles, useTickerSet } from '../hooks.js';
import ArticleView from '../components/ArticleView.jsx';
import DigestView from '../components/DigestView.jsx';
import HeadlineList from '../components/HeadlineList.jsx';
import PinButton from '../components/PinButton.jsx';
import SyncBanner from '../components/SyncBanner.jsx';

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export default function ReaderPage() {
  const params = useParams();
  const ticker = params.ticker.toUpperCase();
  // The rest of the path picks the right-hand pane: "" | "<articleId>" | "day/<YYYY-MM-DD>".
  const [first, second] = (params['*'] ?? '').split('/');
  const digestDay = first === 'day' ? (second ?? '') : null;
  const articleId = digestDay === null && first ? first : null;
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const headlines = useHeadlines(ticker, q);
  const { readIds, markRead } = useReadArticles();
  const knownTickers = useTickerSet();
  const { pinned, togglePin } = usePinnedTickers();
  const articlePaneRef = useRef(null);

  // A new ticker starts with a clean search box.
  useEffect(() => setSearch(''), [ticker]);

  useEffect(() => {
    articlePaneRef.current?.scrollTo({ top: 0 });
  }, [articleId, digestDay]);

  // j / k (or arrow keys) step through headlines without leaving the keyboard. The ref
  // tracks the target synchronously so rapid key presses don't act on a stale article id.
  const { items, nextCursor, loadMore } = headlines;
  const currentIdRef = useRef(articleId);
  currentIdRef.current = articleId;
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.key === 'j' || e.key === 'ArrowRight' ? 1 : e.key === 'k' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!step || !items.length) return;
      e.preventDefault();
      const index = items.findIndex((it) => it.id === currentIdRef.current);
      const next = index === -1 ? 0 : Math.min(Math.max(index + step, 0), items.length - 1);
      if (next >= items.length - 5 && nextCursor) loadMore();
      if (items[next].id === currentIdRef.current) return;
      currentIdRef.current = items[next].id;
      navigate(`/t/${ticker}/${items[next].id}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, nextCursor, loadMore, ticker, navigate]);

  const retrySync = () => forceResync(ticker).then(headlines.reload, headlines.reload);

  const { sync } = headlines;
  const indexing = sync && (sync.state === 'queued' || sync.state === 'syncing');
  let footer = null;
  if (headlines.status === 'ready' && items.length) {
    if (indexing) footer = 'Older articles will appear here once indexing finishes.';
    else footer = q ? 'No more matches.' : 'That’s the beginning of this ticker’s history.';
  }

  return (
    <main className={`reader${articleId || digestDay !== null ? ' has-article' : ''}`}>
      <aside className="reader-list" aria-label={`${ticker} headlines`}>
        <div className="reader-list-head">
          <div className="reader-title">
            <Link to="/" className="back-link" aria-label="Back to all tickers">
              ← Tickers
            </Link>
            <h1>{ticker}</h1>
            <PinButton ticker={ticker} pinned={pinned.has(ticker)} onToggle={togglePin} />
            {sync && <span className="muted small">{formatNumber(sync.indexedCount)} indexed</span>}
          </div>
          <input
            className="input"
            type="search"
            placeholder="Search headlines…"
            aria-label="Search headlines"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SyncBanner sync={sync} onRetry={retrySync} />
        </div>

        <div className="reader-list-scroll">
          {headlines.status === 'loading' && <p className="empty">Fetching the latest {ticker} news…</p>}
          {headlines.status === 'error' && (
            <p className="notice notice-error">
              {headlines.error}{' '}
              <button type="button" className="link-button" onClick={headlines.reload}>
                Retry
              </button>
            </p>
          )}
          {headlines.status === 'ready' && !items.length && (
            <p className="empty">{q ? `No indexed headline matches “${q}”.` : 'No articles for this ticker.'}</p>
          )}
          <HeadlineList
            ticker={ticker}
            items={items}
            selectedId={articleId}
            activeDay={digestDay}
            readIds={readIds}
            hasMore={Boolean(nextCursor)}
            loadingMore={headlines.loadingMore}
            onLoadMore={loadMore}
            footer={footer}
          />
        </div>
      </aside>

      <section className="reader-article" ref={articlePaneRef}>
        {digestDay !== null ? (
          <>
            <Link to={`/t/${ticker}`} className="back-link only-narrow">
              ← {ticker} headlines
            </Link>
            <DigestView ticker={ticker} anchor={digestDay} />
          </>
        ) : articleId ? (
          <>
            <Link to={`/t/${ticker}`} className="back-link only-narrow">
              ← {ticker} headlines
            </Link>
            <ArticleView articleId={articleId} currentTicker={ticker} knownTickers={knownTickers} onRead={markRead} />
          </>
        ) : (
          <div className="empty reader-placeholder">
            <p>Select a headline to read it here.</p>
            <p className="muted small">
              Tip: <kbd>j</kbd> / <kbd>k</kbd> move to the next / previous article, <kbd>s</kbd> summarizes the open one,
              and “✦ Day digest” on a date summarizes that whole day.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
