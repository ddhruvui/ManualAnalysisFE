import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTickers } from '../api.js';
import { formatBytes, formatNumber, formatRelative } from '../format.js';
import { usePinnedTickers } from '../hooks.js';
import PinButton from '../components/PinButton.jsx';

const SORTS = {
  alpha: { label: 'A–Z', compare: (a, b) => a.ticker.localeCompare(b.ticker) },
  articles: { label: 'Most articles', compare: (a, b) => (b.articleCount ?? 0) - (a.articleCount ?? 0) },
  indexed: {
    label: 'Indexed first',
    compare: (a, b) => b.indexedCount - a.indexedCount || a.ticker.localeCompare(b.ticker),
  },
};

function TickerCard({ t, pinned, onTogglePin, pinDisabled }) {
  return (
    <li className="ticker-card">
      <Link to={`/t/${t.ticker}`} className="ticker-link">
        <span className="ticker-symbol">{t.ticker}</span>
        <span className="ticker-count">{formatNumber(t.articleCount)} articles</span>
        <span className="ticker-meta">
          {formatBytes(t.fileSize)}
          {t.fullyIndexed ? (
            <span className="pill pill-ok">indexed</span>
          ) : t.indexedCount > 0 ? (
            <span className="pill">partial</span>
          ) : null}
        </span>
      </Link>
      <PinButton ticker={t.ticker} pinned={pinned} onToggle={onTogglePin} disabled={pinDisabled} />
    </li>
  );
}

export default function TickersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('alpha');
  const pins = usePinnedTickers();
  const { pinned, togglePin } = pins;

  useEffect(() => {
    const ctrl = new AbortController();
    getTickers(ctrl.signal)
      .then(setData)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  const needle = filter.trim().toUpperCase();

  // Pinned tickers always come first; both groups follow the chosen sort (A–Z by default).
  const { pinnedRows, otherRows } = useMemo(() => {
    if (!data) return { pinnedRows: [], otherRows: [] };
    const rows = needle ? data.tickers.filter((t) => t.ticker.includes(needle)) : data.tickers;
    const sorted = [...rows].sort((a, b) => {
      // An exact / prefix match should surface first while typing.
      if (needle) {
        const rank = (t) => (t.ticker === needle ? 0 : t.ticker.startsWith(needle) ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
      }
      return SORTS[sort].compare(a, b);
    });
    return {
      pinnedRows: sorted.filter((t) => pinned.has(t.ticker)),
      otherRows: sorted.filter((t) => !pinned.has(t.ticker)),
    };
  }, [data, needle, sort, pinned]);

  const totalArticles = useMemo(
    () => data?.tickers.reduce((sum, t) => sum + (t.articleCount ?? 0), 0) ?? 0,
    [data],
  );

  const visibleCount = pinnedRows.length + otherRows.length;
  const ready = Boolean(data) && pins.status !== 'loading';

  const openBestMatch = (e) => {
    e.preventDefault();
    const all = [...pinnedRows, ...otherRows];
    const best = all.find((t) => t.ticker === needle) ?? all[0]; // typing "A" opens A, not a pinned AAPL
    if (best) navigate(`/t/${best.ticker}`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Tickers</h1>
          {data && (
            <p className="muted">
              {formatNumber(data.tickers.length)} tickers · {formatNumber(totalArticles)} articles
              {data.source?.vendor ? ` · ${data.source.vendor}` : ''}
              {data.source?.endedAt ? ` · data updated ${formatRelative(data.source.endedAt)}` : ''}
            </p>
          )}
        </div>
        <form className="controls" onSubmit={openBestMatch} role="search">
          <input
            className="input"
            type="search"
            placeholder="Filter tickers… (Enter opens the best match)"
            aria-label="Filter tickers"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <select className="input" aria-label="Sort tickers" value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </form>
      </div>

      {error && <p className="notice notice-error">Couldn’t load tickers: {error}</p>}
      {pins.error && <p className="notice notice-error">{pins.error}</p>}
      {!ready && !error && <p className="empty">Loading tickers…</p>}
      {ready && !visibleCount && <p className="empty">No ticker matches “{filter}”.</p>}

      {ready && pinnedRows.length > 0 && (
        <section aria-labelledby="pinned-heading" className="ticker-section">
          <h2 id="pinned-heading" className="section-heading">
            Pinned <span className="muted">· {pinnedRows.length}</span>
          </h2>
          <ul className="ticker-grid">
            {pinnedRows.map((t) => (
              <TickerCard key={t.ticker} t={t} pinned onTogglePin={togglePin} pinDisabled={!pins.available} />
            ))}
          </ul>
        </section>
      )}

      {ready && otherRows.length > 0 && (
        <section aria-labelledby="all-heading" className="ticker-section">
          <h2 id="all-heading" className="section-heading">
            {pinnedRows.length > 0 ? 'All other tickers' : 'All tickers'}{' '}
            {pins.available && pinned.size === 0 && !needle && (
              <span className="muted section-hint">· use the pin on a card to keep tickers you follow at the top</span>
            )}
          </h2>
          <ul className="ticker-grid">
            {otherRows.map((t) => (
              <TickerCard key={t.ticker} t={t} pinned={false} onTogglePin={togglePin} pinDisabled={!pins.available} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
