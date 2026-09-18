import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { getHealth } from './api.js';
import TickersPage from './pages/TickersPage.jsx';
import ReaderPage from './pages/ReaderPage.jsx';

function HealthDot() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      getHealth()
        .then((h) => !cancelled && setHealth(h))
        .catch((err) => !cancelled && setHealth({ ok: false, backendDown: true, error: err.message }));
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  let tone = 'pending';
  let label = 'Checking connection…';
  if (health) {
    if (health.ok) {
      tone = 'ok';
      label = 'Volume reachable';
    } else {
      tone = 'down';
      label = health.backendDown ? 'Backend offline' : 'Volume unreachable — showing indexed articles only';
    }
  }
  return (
    <span className="health" title={health?.error ?? health?.volume?.error ?? label}>
      <span className={`health-dot health-${tone}`} aria-hidden="true" />
      <span className="health-label">{label}</span>
    </span>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          News Reader
        </Link>
        <HealthDot />
      </header>
      <Routes>
        <Route path="/" element={<TickersPage />} />
        {/* One splat route so the reader (and its loaded headlines) stays mounted between
            /t/T, /t/T/<articleId> and /t/T/day/<YYYY-MM-DD>. */}
        <Route path="/t/:ticker/*" element={<ReaderPage />} />
        <Route
          path="*"
          element={
            <main className="page">
              <p className="empty">
                Page not found. <Link to="/">Back to tickers</Link>
              </p>
            </main>
          }
        />
      </Routes>
    </div>
  );
}
