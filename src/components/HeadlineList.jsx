import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { dayKey, formatDayHeading, formatTime, sourceHost } from '../format.js';
import { toAnchor } from '../period.js';
import { SentimentDot } from './Sentiment.jsx';

function groupByDay(items) {
  const groups = [];
  for (const item of items) {
    const key = dayKey(item.date);
    if (groups.at(-1)?.key !== key) groups.push({ key, date: item.date, items: [] });
    groups.at(-1).items.push(item);
  }
  return groups;
}

function DayHeading({ ticker, date, activeDay }) {
  const anchor = toAnchor(new Date(date));
  const active = anchor === activeDay;
  return (
    <h2 className="day-heading">
      <span>{formatDayHeading(date)}</span>
      {/* autoGenerate: clicking this is the explicit request for a (billable) digest */}
      <Link
        to={`/t/${ticker}/day/${anchor}`}
        state={{ autoGenerate: true }}
        className={`day-digest-link${active ? ' is-active' : ''}`}
        aria-current={active ? 'true' : undefined}
        title="Summarize all of this day's articles with AI"
      >
        ✦ Day digest
      </Link>
    </h2>
  );
}

export default function HeadlineList({ ticker, items, selectedId, activeDay, readIds, hasMore, loadingMore, onLoadMore, footer }) {
  const groups = useMemo(() => groupByDay(items), [items]);
  const sentinelRef = useRef(null);
  const selectedRef = useRef(null);

  // Infinite scroll: fetch the next page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && onLoadMore(),
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, items.length]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="headline-list">
      {groups.map((group) => (
        <section key={group.key}>
          <DayHeading ticker={ticker} date={group.date} activeDay={activeDay} />
          <ul>
            {group.items.map((item) => {
              const selected = item.id === selectedId;
              const others = item.symbols.length - 1;
              return (
                <li key={item.id}>
                  <Link
                    to={`/t/${ticker}/${item.id}`}
                    ref={selected ? selectedRef : null}
                    className={`headline${selected ? ' is-selected' : ''}${readIds.has(item.id) ? ' is-read' : ''}`}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <span className="headline-title">{item.title}</span>
                    <span className="headline-meta">
                      <SentimentDot sentiment={item.sentiment} />
                      <span>{formatTime(item.date)}</span>
                      {sourceHost(item.link) && <span>{sourceHost(item.link)}</span>}
                      {others > 0 && <span title={item.symbols.join(', ')}>+{others} symbols</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="list-footer">
          <button type="button" className="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older articles'}
          </button>
        </div>
      )}
      {!hasMore && footer && <p className="list-footer muted small">{footer}</p>}
    </div>
  );
}
