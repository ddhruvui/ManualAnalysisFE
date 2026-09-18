import { sentimentTone } from '../format.js';

const pct = (v) => `${Math.round((v ?? 0) * 100)}%`;

/** Compact vendor-sentiment marker for headline rows. */
export function SentimentDot({ sentiment }) {
  const tone = sentimentTone(sentiment);
  if (!tone) return null;
  return (
    <span
      className={`sentiment-dot tone-${tone}`}
      title={`Vendor sentiment: ${tone} (polarity ${sentiment.polarity.toFixed(2)})`}
      aria-label={`Sentiment ${tone}`}
    />
  );
}

/** Polarity plus the neg / neu / pos split, for the article view. */
export function SentimentDetail({ sentiment }) {
  const tone = sentimentTone(sentiment);
  if (!tone) return null;
  return (
    <div className="sentiment-detail" title="Sentiment scores supplied by the data vendor">
      <span className={`pill tone-bg-${tone}`}>
        {tone} {sentiment.polarity > 0 ? '+' : ''}
        {sentiment.polarity.toFixed(2)}
      </span>
      <span className="sentiment-bar" aria-hidden="true">
        <span className="seg tone-negative" style={{ width: pct(sentiment.neg) }} />
        <span className="seg tone-neutral" style={{ width: pct(sentiment.neu) }} />
        <span className="seg tone-positive" style={{ width: pct(sentiment.pos) }} />
      </span>
      <span className="muted small">
        neg {pct(sentiment.neg)} · neu {pct(sentiment.neu)} · pos {pct(sentiment.pos)}
      </span>
    </div>
  );
}
