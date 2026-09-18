/** Thumbtack toggle. Filled when the ticker is pinned to the top of the ticker list. */
export default function PinButton({ ticker, pinned, onToggle, className = '' }) {
  const label = pinned ? `Unpin ${ticker}` : `Pin ${ticker} to the top`;
  return (
    <button
      type="button"
      className={`pin-button${pinned ? ' is-pinned' : ''} ${className}`}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      onClick={() => onToggle(ticker)}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 3h5v5.5l3 4.5h-11l3-4.5z" fill={pinned ? 'currentColor' : 'none'} />
        <path d="M8 3h8M12 13v8" />
      </svg>
    </button>
  );
}
