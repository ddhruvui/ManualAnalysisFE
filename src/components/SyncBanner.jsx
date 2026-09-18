import { formatBytes, formatNumber } from '../format.js';

/** Explains how much of a ticker's history is available while the backend is indexing it. */
export default function SyncBanner({ sync, onRetry }) {
  if (!sync || sync.state === 'ready') return null;

  if (sync.state === 'error') {
    return (
      <div className="notice notice-error" role="status">
        Indexing failed: {sync.error}{' '}
        <button type="button" className="link-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (sync.state === 'offline') {
    return (
      <div className="notice" role="status">
        Volume unreachable — showing the {formatNumber(sync.indexedCount)} articles already indexed.
      </div>
    );
  }

  const { progress } = sync;
  const fraction = progress?.totalBytes ? progress.bytesRead / progress.totalBytes : null;
  return (
    <div className="notice" role="status">
      <div>
        The newest articles are ready.{' '}
        {sync.state === 'queued' ? 'Full history is queued for indexing…' : 'Indexing full history…'}{' '}
        {formatNumber(sync.indexedCount)} articles so far.
        {progress && (
          <span className="muted">
            {' '}
            {formatBytes(progress.bytesRead)} of {formatBytes(progress.totalBytes)}
          </span>
        )}
      </div>
      <progress className="sync-progress" value={fraction ?? undefined} max={1} />
    </div>
  );
}
