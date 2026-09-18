import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Mirrors FOLLOW_UP_LIMITS in the backend.
const MAX_MESSAGES = 24;
const MAX_QUESTION_CHARS = 1000;

// The backend keeps no conversation; hold threads for this browser session so stepping
// away and back doesn't lose them. Callers key the thread per generated summary / digest,
// so "Regenerate" starts a fresh one.
const threadCache = new Map();

/**
 * Follow-up Q&A under an AI summary or digest: suggested questions, thread, and input.
 *
 * `onAsk(messages, signal)` must resolve to `{ answer, sources? }`, where `messages` is the
 * whole thread so far as [{role: 'user'|'model', text}] ending with the new question (the
 * backend is stateless). `sources` ([{id, title}]) are shown as article links under the
 * answer when `ticker` is given.
 */
export default function FollowUpChat({ cacheKey, suggestions: suggested = [], placeholder, ticker, onAsk }) {
  const [thread, setThread] = useState(() => threadCache.get(cacheKey) ?? []);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);
  const lastMessageRef = useRef(null);
  const onAskRef = useRef(onAsk);
  onAskRef.current = onAsk;

  useEffect(() => {
    setThread(threadCache.get(cacheKey) ?? []);
    setDraft('');
    setPending(false);
    setError(null);
    return () => requestRef.current?.abort();
  }, [cacheKey]);

  useEffect(() => {
    if (thread.length || pending) lastMessageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [thread.length, pending]);

  const full = thread.length >= MAX_MESSAGES;

  const ask = (question) => {
    const text = question.trim().slice(0, MAX_QUESTION_CHARS);
    if (!text || pending || full) return;
    const messages = [...thread, { role: 'user', text }];
    const ctrl = new AbortController();
    requestRef.current = ctrl;
    setThread(messages);
    setDraft('');
    setError(null);
    setPending(true);
    // Only role + text go back to the server; sources are display-only.
    onAskRef.current(messages.map(({ role, text: t }) => ({ role, text: t })), ctrl.signal)
      .then((res) => {
        const next = [...messages, { role: 'model', text: res.answer, sources: res.sources ?? [] }];
        threadCache.set(cacheKey, next);
        setThread(next);
        setPending(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Put the question back in the box so it can be resent as-is.
        setThread(thread);
        setDraft(text);
        setError(err.message);
        setPending(false);
      });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(draft);
    } else if (e.key === 'Escape') {
      e.currentTarget.blur(); // hand the keyboard back to j / k navigation
    }
  };

  const asked = new Set(thread.filter((m) => m.role === 'user').map((m) => m.text));
  const suggestions = suggested.filter((q) => !asked.has(q));

  return (
    <div className="chat">
      <h2>Ask a follow-up</h2>

      {thread.length > 0 && (
        <ol className="chat-thread" aria-live="polite">
          {thread.map((m, i) => (
            <li
              key={i}
              className={`chat-msg chat-${m.role}`}
              ref={i === thread.length - 1 && !pending ? lastMessageRef : null}
            >
              <span className="chat-who">{m.role === 'user' ? 'You' : 'AI'}</span>
              <p>{m.text}</p>
              {ticker && m.sources?.length > 0 && (
                <ul className="chips chat-sources" aria-label="Articles this answer relies on">
                  {m.sources.map((a) => (
                    <li key={a.id}>
                      <Link className="chip chip-link chip-source" to={`/t/${ticker}/${a.id}`} title={a.title}>
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {pending && (
            <li className="chat-msg chat-model chat-pending" ref={lastMessageRef}>
              <span className="chat-who">AI</span>
              <p className="muted">Thinking…</p>
            </li>
          )}
        </ol>
      )}

      {suggestions.length > 0 && !pending && !full && (
        <ul className="chat-suggestions" aria-label="Suggested questions">
          {suggestions.map((q) => (
            <li key={q}>
              <button type="button" className="chip chip-ask" onClick={() => ask(q)}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}

      {full ? (
        <p className="muted small">This conversation has reached its limit — use Regenerate below to start a fresh one.</p>
      ) : (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <textarea
            className="input chat-input"
            rows={2}
            maxLength={MAX_QUESTION_CHARS}
            placeholder={placeholder}
            aria-label="Ask a follow-up question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending}
          />
          <button type="submit" className="button button-primary" disabled={pending || !draft.trim()}>
            {pending ? 'Asking…' : 'Ask'}
          </button>
        </form>
      )}
    </div>
  );
}
