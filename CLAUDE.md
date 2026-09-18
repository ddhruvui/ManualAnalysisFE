# frontend/ — React news reader

Own git repo. Project-wide context lives one level up: **read `../CLAUDE.md` first**, then
`../docs/architecture.md` for the planned pages and API shape.

**Status (2026-09-18): empty — no package.json, no code yet.** Don't scaffold until asked.

## Role

UI for browsing and reading news: pick a ticker → scan headlines (newest first) → read the
full article. All data comes from the Node API in `../backend/`.

## Rules specific to this repo

- **Only talk to the backend API** (`/api/...`). Never call RunPod/S3 from the browser and
  never put RunPod keys, volume IDs, or endpoints in frontend code or env files.
- Article fields available from the data: `date, title, content, link, symbols[], tags[],
  sentiment{polarity,neg,neu,pos}` — `tags`/`sentiment` can be missing. `content` is plain
  text with `\n\n` paragraph breaks (render as text, never as HTML).
- Lists can be huge (NVDA > 110k articles): paginate / virtualize, never render all rows.
- Mock data and fixtures must be synthetic — no real article bodies in the repo.

## Commands

None yet. When a package.json exists, record dev/build/test/lint commands here.
