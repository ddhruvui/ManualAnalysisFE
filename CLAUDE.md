# frontend/ — React news reader

Own git repo. Project-wide context lives one level up: **read `../CLAUDE.md` first**, then
`../docs/architecture.md` for the API contract and how indexing status works.

## Role

UI for browsing and reading news: pick a ticker → scan headlines (newest first) → read the
full article. All data comes from the Express API in `../backend/`.

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
src/hooks.js                 useHeadlines (paging + sync polling), useReadArticles, useTickerSet, useDebounced
src/format.js                dates, numbers, bytes, safeLink, sentiment tone
src/pages/TickersPage.jsx    "/"  filterable/sortable ticker grid
src/pages/ReaderPage.jsx     "/t/:ticker/:articleId?"  two-pane reader, j/k navigation
src/components/              HeadlineList, ArticleView (+ Summarize button, `s` shortcut), SummaryPanel, SyncBanner, Sentiment
src/styles.css               all styles, CSS variables for theming
```

## Rules specific to this repo

- **Only talk to the backend API** (`/api/...`, via `src/api.js`). Never call RunPod/S3 from
  the browser and never put RunPod keys, volume IDs, or endpoints in frontend code or env.
- Article fields: `id, cursor, date, title, link, symbols[], tags[], sentiment|null`, plus
  `snippet` in lists and `content` on the article endpoint. `content` is plain text —
  render as text nodes, **never** `dangerouslySetInnerHTML`. Links go through `safeLink()`.
- Summaries come from `POST /api/news/:id/summary?ticker=` (Gemini, ~10 s, billable). Only
  trigger it from an explicit user action; keep the in-memory session cache in
  `ArticleView.jsx` so revisiting an article doesn't call again. Render summary fields as
  text, keep the "can be wrong / not investment advice" line.
- Lists can be huge (NVDA > 110k articles): keep cursor paging; if rows ever get heavier,
  virtualize rather than rendering everything.
- A ticker may be only partially indexed: respect `sync.state` from the API (banner,
  "older articles will appear…" footer) instead of assuming the list is complete.
- Below 820 px the reader shows one pane at a time — check both widths after UI changes.
- Mock data and fixtures must be synthetic — no real article bodies in the repo.
