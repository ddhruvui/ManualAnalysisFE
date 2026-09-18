import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTickers } from '../api.js';
import { formatBytes, formatNumber, formatRelative } from '../format.js';

const SORTS = {
  alpha: { label: 'A–Z', compare: (a, b) => a.ticker.localeCompare(b.ticker) },
  articles: { label: 'Most articles', compare: (a, b) => (b.articleCount ?? 0) - (a.articleCount ?? 0) },
  indexed: {
    label: 'Indexed first',
    compare: (a, b) => b.indexedCount - a.indexedCount || a.ticker.localeCompare(b.ticker),
  },
};

export default function TickersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('alpha');

  useEffect(() => {
    const ctrl = new AbortController();
    getTickers(ctrl.signal)
      .then(setData)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = filter.trim().toUpperCase();
    const rows = needle ? data.tickers.filter((t) => t.ticker.includes(needle)) : data.tickers;
    return [...rows].sort((a, b) => {
      // An exact / prefix match should surface first while typing.
      if (needle) {
        const rank = (t) => (t.ticker === needle ? 0 : t.ticker.startsWith(needle) ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
      }
      return SORTS[sort].compare(a, b);
    });
  }, [data, filter, sort]);

  const totalArticles = useMemo(
    () => data?.tickers.reduce((sum, t) => sum + (t.articleCount ?? 0), 0) ?? 0,
    [data],
  );

  const openFirstMatch = (e) => {
    e.preventDefault();
    if (visible.length) navigate(`/t/${visible[0].ticker}`);
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
        <form className="controls" onSubmit={openFirstMatch} role="search">
          <input
            className="input"
            type="search"
            placeholder="Filter tickers… (Enter opens the first match)"
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
      {!data && !error && <p className="empty">Loading tickers from the volume…</p>}
      {data && !visible.length && <p className="empty">No ticker matches “{filter}”.</p>}

      <ul className="ticker-grid">
        {visible.map((t) => (
          <li key={t.ticker}>
            <Link to={`/t/${t.ticker}`} className="ticker-card">
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
          </li>
        ))}
      </ul>
    </main>
  );
}
