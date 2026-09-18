import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { askDigest, createDigest, getDigestPlan } from '../api.js';
import { formatDate, formatDayHeading, formatNumber } from '../format.js';
import { dayRange, parseAnchor, shiftDay, toAnchor } from '../period.js';
import FollowUpChat from './FollowUpChat.jsx';

// Digests are not stored by the backend; keep them for this browser session so moving
// between days and articles doesn't trigger (and bill) the same Gemini call twice.
const digestCache = new Map();
const IDLE = { status: 'idle', data: null, error: null };
const TONE_CLASS = { positive: 'positive', negative: 'negative', mixed: 'mixed' };

function Sources({ ticker, ids, sources }) {
  const known = ids.map((id) => sources[id]).filter(Boolean);
  if (!known.length) return null;
  return (
    <ul className="chips digest-sources" aria-label="Source articles">
      {known.map((a) => (
        <li key={a.id}>
          <Link className="chip chip-link chip-source" to={`/t/${ticker}/${a.id}`} title={a.title}>
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function planSentence(plan, ticker) {
  if (!plan.articleCount) return 'No articles on this day.';
  const total = `${formatNumber(plan.articleCount)} article${plan.articleCount === 1 ? '' : 's'}`;
  if (plan.sampled) {
    return `${total} — the digest reads the ${formatNumber(plan.usedCount)} most ${ticker}-focused ones (first ~${formatNumber(plan.charsPerArticle)} characters each).`;
  }
  const dupes = plan.articleCount - plan.usedCount;
  return `${total}${dupes > 0 ? ` (${dupes} duplicate${dupes === 1 ? '' : 's'} skipped)` : ''} — the digest reads all of them.`;
}

/** AI digest of one local calendar day of a ticker's news. */
export default function DigestView({ ticker, anchor }) {
  const location = useLocation();
  const navigate = useNavigate();
  const start = parseAnchor(anchor);
  const cacheKey = `${ticker}:day:${anchor}`;

  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState(null);
  const [digest, setDigest] = useState(IDLE);
  const requestRef = useRef(null);

  const generate = useCallback(() => {
    const day = parseAnchor(anchor);
    if (!day) return;
    requestRef.current?.abort();
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setDigest({ status: 'loading', data: null, error: null });
    createDigest(ticker, 'day', dayRange(day), ctrl.signal)
      .then((data) => {
        digestCache.set(cacheKey, data);
        setDigest({ status: 'ready', data, error: null });
      })
      .catch((err) => err.name !== 'AbortError' && setDigest({ status: 'error', data: null, error: err.message }));
  }, [ticker, anchor, cacheKey]);

  // New day: show a cached digest if there is one and find out how many articles it has.
  useEffect(() => {
    const cached = digestCache.get(cacheKey);
    setDigest(cached ? { status: 'ready', data: cached, error: null } : IDLE);
    setPlan(null);
    setPlanError(null);
    const day = parseAnchor(anchor);
    if (!day) return undefined;

    const ctrl = new AbortController();
    getDigestPlan(ticker, dayRange(day), ctrl.signal)
      .then(setPlan)
      .catch((err) => err.name !== 'AbortError' && setPlanError(err.message));
    return () => {
      ctrl.abort();
      requestRef.current?.abort();
    };
  }, [ticker, anchor, cacheKey]);

  // Arriving from a "Day digest" button is an explicit request, so generate right away.
  // Stepping to the previous / next day is just navigation and waits for a click, since
  // every digest is a paid call. The flag is cleared so a page reload doesn't re-bill.
  const autoGenerate = Boolean(location.state?.autoGenerate);
  useEffect(() => {
    if (!autoGenerate || !plan) return;
    navigate(location.pathname, { replace: true, state: null });
    if (plan.articleCount > 0 && !digestCache.has(cacheKey)) generate();
  }, [autoGenerate, plan, cacheKey, generate, navigate, location.pathname]);

  if (!start) return <p className="notice notice-error">“{anchor}” is not a valid day.</p>;

  const next = shiftDay(start, 1);
  const hasNext = next.getTime() <= Date.now();
  const d = digest.data;

  return (
    <article className="article digest">
      <header>
        <div className="article-top">
          <p className="article-date">AI day digest · {ticker}</p>
          <nav className="digest-nav" aria-label="Change day">
            <Link className="button" to={`/t/${ticker}/day/${toAnchor(shiftDay(start, -1))}`}>
              ← Previous day
            </Link>
            {hasNext ? (
              <Link className="button" to={`/t/${ticker}/day/${toAnchor(next)}`}>
                Next day →
              </Link>
            ) : (
              <span className="button is-disabled" aria-disabled="true">
                Next day →
              </span>
            )}
          </nav>
        </div>
        <h1>{formatDayHeading(start.toISOString())}</h1>
        {planError && <p className="notice notice-error">Couldn’t check this day: {planError}</p>}
        {plan && <p className="muted">{planSentence(plan, ticker)}</p>}
        {plan && plan.sync?.state !== 'ready' && plan.sync?.state !== 'offline' && (
          <p className="notice">
            {ticker} is still being indexed, so this day may be incomplete — generate again once indexing finishes.
          </p>
        )}
      </header>

      {digest.status === 'idle' && plan?.articleCount > 0 && (
        <p className="digest-cta">
          <button type="button" className="button button-primary" onClick={generate}>
            ✦ Generate digest for this day
          </button>
        </p>
      )}

      {digest.status === 'loading' && (
        <section className="summary" aria-live="polite" aria-busy="true">
          <p className="muted">
            Gemini is reading {plan ? formatNumber(plan.usedCount) : 'the'} articles… this usually takes 15–40 seconds.
          </p>
          <div className="summary-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      )}

      {digest.status === 'error' && (
        <section className="summary summary-error" role="alert">
          <p>
            {digest.error}{' '}
            <button type="button" className="link-button" onClick={generate}>
              Try again
            </button>
          </p>
        </section>
      )}

      {digest.status === 'ready' && d.empty && <p className="empty">No articles on this day.</p>}

      {digest.status === 'ready' && !d.empty && (
        <div className="digest-body">
          <section className="summary">
            <p className="summary-head">
              <span>Takeaway</span>
              {d.tone && <span className={`pill tone-bg-${TONE_CLASS[d.tone] ?? 'neutral'}`}>tone: {d.tone}</span>}
            </p>
            {d.headline && <p className="digest-headline">{d.headline}</p>}
            {d.overview && <p>{d.overview}</p>}
          </section>

          {d.themes.length > 0 && (
            <section>
              <h2 className="section-heading">Themes</h2>
              <ol className="digest-themes">
                {d.themes.map((theme, i) => (
                  <li key={i}>
                    <h3>
                      {theme.title}
                      {theme.direction && <span className={`pill tone-bg-${TONE_CLASS[theme.direction] ?? 'neutral'}`}>{theme.direction}</span>}
                    </h3>
                    <p>{theme.summary}</p>
                    <Sources ticker={ticker} ids={theme.articleIds} sources={d.sources} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {d.keyEvents.length > 0 && (
            <section>
              <h2 className="section-heading">Key events</h2>
              <ul className="digest-events">
                {d.keyEvents.map((event, i) => (
                  <li key={i}>
                    <span className="digest-event-date">{event.date ? formatDate(`${event.date}T12:00:00`) : '—'}</span>
                    <div>
                      <p>{event.event}</p>
                      <Sources ticker={ticker} ids={event.articleIds} sources={d.sources} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.marketContext && (
            <section>
              <h2 className="section-heading">Market context</h2>
              <p>{d.marketContext}</p>
            </section>
          )}

          {d.watchNext.length > 0 && (
            <section>
              <h2 className="section-heading">What to watch next</h2>
              <ul className="summary-points">
                {d.watchNext.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="summary digest-chat">
            <FollowUpChat
              cacheKey={`digest:${cacheKey}:${d.generatedAt}`}
              suggestions={d.followUps ?? []}
              placeholder={`Ask about ${ticker}’s news on this day…  (Enter to send)`}
              ticker={ticker}
              onAsk={(messages, signal) => askDigest(ticker, 'day', dayRange(start), { digest: d, messages }, signal)}
            />
          </section>

          <p className="muted small">
            Generated by {d.model} from {formatNumber(d.usedCount)} of {formatNumber(d.articleCount)} articles — it can be wrong or miss
            things; open the linked articles to verify. Not investment advice.{' '}
            <button type="button" className="link-button" onClick={generate}>
              Regenerate
            </button>
          </p>
        </div>
      )}
    </article>
  );
}
