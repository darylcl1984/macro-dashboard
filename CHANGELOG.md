# Changelog

All notable changes to the Macro Dashboard are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### 2026-08-29 — Pages redirect, fetch guards, one ETF writer

#### Added
- Root `index.html` + `.nojekyll` so GitHub Pages `/` opens the desk at `src/`
- `scripts/sync_etf_flows.py` maps `liquidity-monitor/data/etf_flows.json` (canonical Farside weeks) onto this desk
- Three `compute_global_m2` pipeline tests (happy path, missing component, out-of-range skip)

#### Changed
- Empty `FRED_API_KEY` fails `fetch_macro.py` (no fresh timestamp on stale FRED)
- All-null core prices refuse to write `prices.json`
- Spot ETF cell reads `data/etf_flows.json`; weeks are no longer typed in `manual.json`

### 2026-08-26 — Flow desks layout

#### Changed
- [frontend] Flow desks: AI | Credit on the top row; Money and Hard money span full width
- [frontend] Hard money splits Official bid | Private run
- [frontend] HY OAS lives only on Credit; inferred fiscal mini-card removed (US M2 remains the proxy)
- [frontend] Spine Force B jumps to Credit (where the missing long-end bid hits)

### 2026-07-11 — v6 — The Great Transition overhaul

#### Added
- [pipeline] ECB Eurozone M2 and BoE UK M4 fetches; FX rates (Stooq primary, Yahoo fallback) for the five-bloc composite
- [pipeline] FRED series for HY OAS (`BAMLH0A0HYM2`) and US net liquidity components (WALCL / RRPONTSYD / WTREGEN)
- [pipeline] Computed `GLOBAL_M2` composite + `data/m2_history.json` monthly snapshots with headline / FX-adjusted YoY scaffolding
- [frontend] Four thesis pillar panels — Monetary Expansion, De-Dollarisation, AI Transition, Hard Money Market State
- [frontend] Eight-row auto-computed invalidation trigger board; status-bar tally chips scroll to the board
- [data] New `manual.json` schema — china_m2, CB gold, COFER, AI transition, divergence clock, manual trigger overrides only

#### Changed
- [pipeline] Gold/WTI pricing via Yahoo chart meta (quote + 52-week in one call); Stooq retained as quote fallback
- [frontend] Status bar: Scenario · Global M2 YoY · Fear & Greed · Trigger tally (regime bar removed)
- [frontend] USD index label corrected to "USD Broad Index (Fed)" (DTWEXBGS)
- [data] Thesis-aligned alert thresholds — BTC $53k / $83.8k, gold $4k, WTI $120, VIX 30

#### Removed
- [pipeline] Finnhub integration and all equity tickers (NVDA, TSLA, PLTR, TSM, GOOGL, META, GEV, MSTR)
- [frontend] Watchlist / AI & Tech Equities group and equity-specific invalidation triggers

#### Notes
- Knowledge layer (thesis v6, M2 note v2) owned separately — not edited in this overhaul commit series
- Screenshots (`docs/macro-dashboard-screenshot01.png` / `02.png`) need owner refresh — cannot capture from this environment

### 2026-03-30

#### Added
- [frontend] Transition Thesis ring — perimeter-travelling SVG arc animates clockwise around the closed summary box; disappears when the section is expanded
- [frontend] Alert direction zone fill — faint amber overlay on range track shows which side of a threshold tick is the alert zone
- [frontend] Alert tag inline with asset name — `(⚠ < $164)` or `(⚠ > $77,000)` appears next to the ticker on breach; wraps within the name cell on narrow screens; both desktop and mobile
- [frontend] META ad revenue invalidation trigger added to trigger table
- [frontend] Footer note: "Data updates Mon–Fri only. Stale badges on weekends are expected."
- [docs] README.md — architecture diagram, data sources table, dashboard section descriptions, alert system, local development, license

#### Changed
- [frontend] Alert dot simplified to binary grey/amber — grey when clear, amber on actual threshold breach only; approach-zone buffer removed
- [frontend] Section order: Watchlist → Macro Indicators → Thesis Invalidation Triggers
- [content] BTC–M2 divergence removed from invalidation triggers — predictable 4-year post-halving cycle artefact; replaced with correlation caveat in thesis narrative
- [content] thesis.md §2 portfolio table restructured; §4 BTC trigger action wording updated

### 2026-03-27

#### Added
- [frontend] 52-week range bars — thin track with dot positioned at `(price − low) / (high − low)`; alert threshold tick marks in amber with hover tooltips (`Alert: <$X` / `Alert: >$X`); faint amber zone fill showing alert direction
- [frontend] `fmtMacroDate()` — normalises BOJ (YYYYMM) and FRED (ISO) date formats to consistent "MMM YYYY" display across all macro cards
- [frontend] Mobile thesis and M2 tables transform to cards — column headers hidden, re-rendered as `::before` labels via `data-label` attributes; applies to any `.md` file rendered through `renderMarkdownDoc()`
- [backend] 52-week high/low fetch via Yahoo Finance `v8/finance/chart` — `week52_low` and `week52_high` merged into each ticker entry in `prices.json`

#### Changed
- [frontend] Macro indicators grid: `repeat(4, 1fr)` layout; Fear & Greed gauge repositioned inline with value number
- [frontend] Range bar descriptor text colour-coded by position — bottom 25% amber, top 25% green; reversed for WTI and VIX
- [frontend] Regime bar coloured scenario dot — 6px circle before regime text matching scenario colour
- [frontend] Stale badges changed from solid fill to outline style
- [frontend] `--text-muted` lightened `#444` → `#666`; `--text-dim` lightened `#888` → `#999`
- [frontend] `fmtPct` null renders as `n/a` in muted text — covers Gold and WTI Crude missing 24h change data
- [frontend] Gold label: "Gold (USD)" → "Gold"
- [frontend] Mobile: focus rings removed; regime bar spacing restored; last-row table borders cleaned up; hover highlight restricted to pointer devices
- [frontend] Alert and St columns removed from position tables — threshold information now embedded in range bar ticks; tables reduced from 6 to 4 columns
- [frontend] Trigger table column widths: Trigger 25% / Detail 68% / Status 7%

### 2026-03-26

#### Added
- [data] `alerts.json` — per-ticker `above`/`below` price thresholds for all watchlist assets
- [frontend] Alerts system — status dots with red/green/grey logic across all position tables
- [frontend] Mobile layout — table-to-card transforms for trigger rows; regime summary bar; primary macro card tier; mobile section order
- [frontend] Notes on Global M2 collapsible section — renders `docs/m2_note.md`; `renderMarkdownDoc()` helper replaces one-off `renderThesis()`
- [docs] `thesis.md` — full thesis narrative, portfolio table, indicator guide, invalidation triggers, scenario analysis
- [docs] `docs/m2_note.md` — global liquidity weighting by bloc with leakage rate estimates

#### Fixed
- [pipeline] BOJ M2 response parsing — use `RESULTSET[0].VALUES` structure
- [pipeline] VIX source — replaced Finnhub (paid tier only) with Yahoo Finance `%5EVIX`
- [pipeline] EUR M2 — reverted to ECB Data Portal; FRED series stale since 2017
- [frontend] Mobile status bar clipping; trigger row text overlap; service worker bumped to v3

#### Changed
- [pipeline] Gold (AUD) removed — Finnhub `/forex/rates` returns 403 on free tier
- [frontend] Macro Signals (WTI, VIX) moved under Hard Money section; GEV labelled as power infrastructure

### 2026-03-25

#### Added
- [pipeline] `fetch_prices.py` — BTC (CoinGecko), WTI + XAUUSD (Stooq), equities (Finnhub), VIX (Yahoo Finance)
- [pipeline] `fetch_macro.py` — US M2/10Y/DXY (FRED), JP M2 (BOJ), Fear & Greed (Alternative.me)
- [pipeline] `utils.py` — shared HTTP session, JSON write, timestamp helpers
- [pipeline] GitHub Actions workflows — prices 3×/day weekdays, macro 1×/day weekdays
- [frontend] PWA dashboard — status bar, invalidation triggers, positions, macro panel, thesis section, service worker with offline cache fallback
- [data] `manual.json` — scenario, global M2, CN/UK M2, invalidation trigger statuses

#### Fixed
- [pipeline] Stooq malformed JSON (`"volume":}`) — regex patch before `json.loads()`
- [pipeline] Workflow push race condition — `git pull --rebase --autostash origin main` after commit
- [infra] fetch-macro cron offset 5 min to avoid simultaneous push collisions

---

<!--

## Entry Conventions

### Version headers
- Use `## [Unreleased]` for work not yet tagged
- Use `## [0.1.0] — 2026-03-25` when tagging releases
- Versions follow semver: MAJOR.MINOR.PATCH
  - MAJOR: breaking changes to data schema or architecture
  - MINOR: new features, new data sources, new dashboard sections
  - PATCH: bug fixes, pipeline fixes, styling tweaks

### Change categories (use only these, in this order)
- **Added** — new features, new data sources, new UI sections
- **Changed** — modifications to existing behaviour or layout
- **Fixed** — bug fixes, pipeline fixes, data corrections
- **Removed** — removed features or deprecated data sources

### Entry format
- One entry per calendar day — consolidate all work into a single dated block
- One line per shipped outcome — drop intermediate fixes caused by earlier mistakes the same day
- Start with lowercase verb: "add", "fix", "update", "remove", "refactor"
- Reference the component in brackets: [pipeline], [frontend], [data], [infra], [docs]
- Keep it short — what changed and why, not how

-->
