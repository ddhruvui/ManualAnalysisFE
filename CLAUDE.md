# frontend/ — React news reader

Own git repo. Project-wide context lives one level up: **read `../CLAUDE.md` first**, then
`../docs/architecture.md` for the API contract and how indexing status works.

## Role

UI for browsing and reading news: pick a ticker → scan headlines (newest first) → read the
full article. All data comes from the Express API in `../backend/`.

## Deployment

Render static site (`render.yaml`). Two things bite if missed: `VITE_API_BASE` is consumed
at **build** time, so changing it needs a rebuild; and without the `/* → /index.html`
rewrite Render 404s every deep link, so refreshing on a ticker page breaks. The backend
must also list this origin in its `ALLOWED_ORIGINS`.

## Commands

```bash
npm run dev       # Vite on http://localhost:5173, proxies /api → http://127.0.0.1:4000
npm run build     # production build into dist/ (git-ignored)
npm run preview   # serve the build
```

React 19 + React Router 7 + Vite 8. Plain JavaScript/JSX, hand-written CSS (no UI library),
light/dark via `prefers-color-scheme`. No test setup yet.

## Layout

```
src/main.jsx, App.jsx        router + top bar with backend/volume health dot
src/api.js                   the only place that calls fetch()
src/hooks.js                 useHeadlines (paging + sync polling), usePinnedTickers, useReadArticles, useTickerSet, useDebounced
src/format.js                dates, numbers, bytes, safeLink, sentiment tone
src/period.js                local-calendar day helpers for digests (anchor <-> [from,to) ms)
src/pages/TickersPage.jsx    "/"  filterable/sortable ticker grid, "Pinned" section first
src/pages/ReaderPage.jsx     "/t/:ticker/*"  two-pane reader; right pane = article | day digest; j/k navigation
src/components/              HeadlineList, ArticleView (+ Summarize button, `s` shortcut), SummaryPanel, FollowUpChat (shared follow-up Q&A), DigestView (AI day digest), PinButton, SyncBanner, Sentiment
src/styles.css               all styles, CSS variables for theming
```

## Rules specific to this repo

- **Only talk to the backend API** (`/api/...`, via `src/api.js`). Never call RunPod/S3 from
  the browser and never put RunPod keys, volume IDs, or endpoints in frontend code or env.
- The backend's location comes from `VITE_API_BASE` (`API_BASE` in `src/api.js`, same
  convention as the sibling ResearchGateFE project): empty in dev so the Vite proxy handles
  `/api`, the deployed origin in a build. `VITE_*` is inlined into the bundle and therefore
  public — URLs only, never secrets. A cross-origin setup also needs `ALLOWED_ORIGINS` on
  the backend.
- Article fields: `id, cursor, date, title, link, symbols[], tags[], sentiment|null`, plus
  `snippet` in lists and `content` on the article endpoint. `content` is plain text —
  render as text nodes, **never** `dangerouslySetInnerHTML`. Links go through `safeLink()`.
- Summaries come from `POST /api/news/:id/summary?ticker=` (Gemini, ~10 s, billable). Only
  trigger it from an explicit user action; keep the in-memory session cache in
  `ArticleView.jsx` so revisiting an article doesn't call again. Render summary fields as
  text, keep the "can be wrong / not investment advice" line.
- Digests (`GET`/`POST /api/tickers/:t/digest`) are the most expensive call in the app:
  only generate on an explicit click (the day-heading link or the Generate button), never
  on plain navigation, and keep the session cache in `DigestView.jsx`.
- Follow-ups use `POST /api/news/:id/ask` and must send the shown summary + the entire
  thread each time (the backend is stateless); digests use `…/digest/ask` the same way.
  `FollowUpChat.jsx` is generic — give it a `cacheKey` that changes on Regenerate and an
  `onAsk`. Keep its `MAX_MESSAGES` / `MAX_QUESTION_CHARS` in step with `FOLLOW_UP_LIMITS` in `backend/src/gemini.js`. Answers
  are plain text rendered with `white-space: pre-wrap` — no Markdown/HTML rendering.
- Pinned tickers come from the API (MongoDB Atlas), not `localStorage` — use
  `usePinnedTickers()`, which shares one store across components, updates optimistically
  and re-syncs on focus. Read-state still lives in `localStorage` (`news-reader:read`);
  wrap that access in try/catch and keep the app working without it.
- When pins are unavailable (Mongo unreachable) the pin buttons are disabled and the
  ticker page shows the reason — reading news must keep working regardless.
  Don't nest the pin `<button>` inside the card `<a>` — they are siblings in `.ticker-card`.
- Lists can be huge (NVDA > 110k articles): keep cursor paging; if rows ever get heavier,
  virtualize rather than rendering everything.
- A ticker may be only partially indexed: respect `sync.state` from the API (banner,
  "older articles will appear…" footer) instead of assuming the list is complete.
- Below 820 px the reader shows one pane at a time — check both widths after UI changes.
- Mock data and fixtures must be synthetic — no real article bodies in the repo.
