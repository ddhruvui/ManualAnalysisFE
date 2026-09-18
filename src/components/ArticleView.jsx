import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getArticle } from '../api.js';
import { formatDateTime, formatRelative, safeLink, sourceHost, usTicker } from '../format.js';
import { SentimentDetail } from './Sentiment.jsx';

export default function ArticleView({ articleId, currentTicker, knownTickers, onRead }) {
  const [state, setState] = useState({ article: null, error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ article: null, error: null });
    getArticle(articleId, ctrl.signal)
      .then((article) => {
        setState({ article, error: null });
        onRead(article.id);
      })
      .catch((err) => err.name !== 'AbortError' && setState({ article: null, error: err.message }));
    return () => ctrl.abort();
  }, [articleId, onRead]);

  if (state.error) return <p className="notice notice-error">Couldn’t load the article: {state.error}</p>;
  if (!state.article) return <p className="empty">Loading article…</p>;

  const { article } = state;
  const href = safeLink(article.link);
  // Vendor text is plain text: render paragraphs as text nodes, never as HTML.
  const paragraphs = article.content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  // Vendors tag every exchange listing of a company; only US tickers have news files here.
  const usSymbols = [...new Set(article.symbols.map(usTicker).filter(Boolean))];
  const otherSymbols = article.symbols.filter((symbol) => !usTicker(symbol));

  return (
    <article className="article">
      <header>
        <p className="article-date">
          <time dateTime={article.date}>{formatDateTime(article.date)}</time>
          <span className="muted"> · {formatRelative(article.date)}</span>
        </p>
        <h1>{article.title}</h1>
        <div className="article-meta">
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer">
              Open original on {sourceHost(href)} ↗
            </a>
          )}
          <SentimentDetail sentiment={article.sentiment} />
        </div>
        {article.symbols.length > 0 && (
          <ul className="chips" aria-label="Symbols tagged on this article">
            {usSymbols.map((ticker) => (
              <li key={ticker}>
                {ticker !== currentTicker && knownTickers?.has(ticker) ? (
                  <Link className="chip chip-link" to={`/t/${ticker}`} title={`Open ${ticker} news`}>
                    {ticker}
                  </Link>
                ) : (
                  <span className={`chip${ticker === currentTicker ? ' chip-current' : ''}`}>{ticker}</span>
                )}
              </li>
            ))}
            {otherSymbols.length > 0 && (
              <li>
                <span className="chip chip-tag" title={otherSymbols.join(', ')}>
                  +{otherSymbols.length} non-US listing{otherSymbols.length === 1 ? '' : 's'}
                </span>
              </li>
            )}
          </ul>
        )}
      </header>

      <div className="article-body">
        {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No article text in the data.</p>}
      </div>

      {article.tags.length > 0 && (
        <footer>
          <ul className="chips" aria-label="Tags">
            {article.tags.map((tag) => (
              <li key={tag}>
                <span className="chip chip-tag">{tag.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
