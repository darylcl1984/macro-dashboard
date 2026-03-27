# Changelog

All notable changes to the Macro Dashboard are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### 2026-03-27 (session 8)

#### Changed
- [frontend] `--text-muted` lightened `#444` → `#666`; `--text-dim` lightened `#888` → `#999` — improves legibility of panel titles, table headers, trigger thresholds, macro card labels, and all secondary text
- [frontend] Row hover highlight restricted to `@media (hover: hover)` — no persistent grey shade on touch devices
- [frontend] Mobile price table last-row border removed — Gold, VIX, GEV separator lines cleaned up
- [frontend] Regime bar top spacing aligned to match gap below — `margin-top` override removed; `main` padding-top (12px) and flex gap (12px) now equal on both sides

### 2026-03-27 (session 7)

#### Added
- [frontend] `fmtMacroDate()` — normalises all macro card dates to "MMM YYYY" format; handles BOJ "202602" (YYYYMM) and FRED "2026-02-01" (ISO) inputs
- [frontend] Thesis/M2 tables transform to cards on mobile — each row becomes a bordered card; column headers hidden and re-rendered as muted uppercase `::before` labels via `data-label` attributes; generalises to any future `.md` file rendered through `renderMarkdownDoc()`

#### Changed
- [frontend] `:focus { outline: none; }` — browser focus rings removed
- [frontend] Regime bar `margin-top: 4px` on mobile — spacing restored above bar
- [frontend] Macro card date prefix "Period: " removed — dates now standalone "MMM YYYY" label, consistent across all cards including 10Y and DXY
- [frontend] Gold label: "Gold (USD)" → "Gold"
- [frontend] Mobile price table last-row rule removed — Gold and VIX bottom separator lines restored
- [frontend] `fmtPct` null → `n/a` in muted text; covers Gold and WTI Crude missing 24h change data

### 2026-03-27 (session 6)

#### Added
- [frontend] Regime bar scenario dot — coloured 6px circle before regime text matching scenario colour (green/blue/amber/red)

#### Changed
- [frontend] Range bar low/high labels removed — 9px mono labels were unreadable; dot position and descriptor text communicate range location
- [frontend] Range bar descriptor text colour-coded — bottom 25% amber, top 25% green; reversed for WTI and VIX (low = green, high = amber)
- [frontend] Table row padding reduced 7px → 5px — tighter rows throughout all tables
- [frontend] Stale badge changed from solid fill to outline style — less visual weight competing with data
- [frontend] `fmtPct` null case changed from `—` to `n/a` — Gold (USD) and WTI Crude now show `n/a` in muted text for missing 24h change data

### 2026-03-27 (session 5)

#### Added
- [frontend] Custom styled tooltip on alert tick marks — amber background, rounded corners, monospace text; replaces native `title` attribute with CSS `::before` + `data-tooltip`

#### Changed
- [frontend] Macro grid `align-items: start` — cards no longer stretch to tallest row height
- [frontend] Fear & Greed gauge bar repositioned between value and subtitle text; track background changed from `var(--surface-2)` to `var(--border)` so full scale is visible; height 4px → 3px; `margin-bottom: 4px` added
- [frontend] Fear & Greed classification and date moved inline with the value number (`10  Extreme Fear · 2026-03-26`); macro grid `align-items: start` removed so all cards in a row stretch to equal height
- [frontend] Position group `align-content: start` — left column (Hard Money + Macro Signals) no longer pads to match right column height
- [frontend] Alert tick hit area widened from 1px to 9px using gradient — visual tick unchanged, hover reliable

### 2026-03-27 (session 4)

#### Added
- [frontend] Alert tick mark tooltips — hovering a tick shows `Alert: <$X` or `Alert: >$X` via `title` attribute

#### Changed
- [frontend] Range bar dot colour now reflects alert status (red = breached below, green = breached above, amber = within 5% of threshold, grey = clear); range-position colour logic and reversed logic for WTI/VIX/NOW/GEV removed
- [frontend] Macro grid changed to `repeat(4, 1fr)` — hero card full-width on top, 8 remaining cards in 2 rows of 4; eliminates dead space from previous `auto-fill` layout
- [frontend] Trigger table column widths: Detail widened to 68%, Status narrowed to 7%
- [frontend] Alert tick marks changed from grey/0.5 to amber/0.7 for visibility on dark background

### 2026-03-27 (session 3)

#### Added
- [frontend] Range bar alert tick marks — per-ticker `below`/`above` thresholds from `alerts.json` rendered as subtle 1px vertical ticks on the range track; ticks outside the 52w range are clamped and not rendered

#### Changed
- [frontend] Alert and St columns removed from all position tables — alert thresholds now embedded in the range bar as tick marks; tables reduced from 6 to 4 columns (Asset | Price | Day Δ | 52W Range)
- [frontend] Range bar column widths updated to 18/20/14/48% per prompt spec
- [frontend] Qualitative invalidation trigger rows — status and threshold now on a single line (`[notes] — Trigger: [threshold]`); muted threshold sub-line removed
- [frontend] Descriptor text neutralised — all assets use the same seven-band labels regardless of category; "Approaching entry" special case removed
- [frontend] Global M2 YoY in hero card now coloured green (positive) / red (negative), consistent with status bar convention

### 2026-03-27 (session 2)

#### Added
- [backend] 52-week high/low fetch via Yahoo Finance `v8/finance/chart` — `fetch_yahoo_52w()` and `fetch_all_52w()` in `fetch_prices.py`; `week52_low` and `week52_high` merged into each ticker entry in `prices.json`
- [frontend] 52-week range bar column — replaces "Note" column in Hard Money, Macro Signals, and AI & Tech tables; thin track with coloured dot positioned at `(price − low) / (high − low)` percent
- [frontend] Reversed dot colour logic for WTI, VIX, NOW, GEV (low in range = green, high = red) vs standard logic for BTC, XAUUSD, equities
- [frontend] `rangeBarHtml()` and `fmtRangeVal()` helpers; `RANGE_REVERSED` and `WATCHLIST_REVERSED` sets for colour logic dispatch
- [frontend] Range bar descriptor text — seven bands from "Near 52w low" to "Near 52w high"; watchlist assets (NOW, GEV) in bottom 25% show "Approaching entry" in green
- [frontend] Range bar hidden on mobile (below 700px) — compact 3-col layout (name | price | change) preserved

#### Fixed
- [backend] `fetch_macro.py` NameError — removed orphaned `fetch_ecb()` call left over from when EUR M2 was moved to `manual.json`

### 2026-03-27 (session 1)

#### Added
- [frontend] Global M2 hero card — full-width across macro grid, 36px value, YoY sitting inline at baseline; separate `macro-card-hero` class distinct from `macro-card-primary`
- [frontend] `hoursAgo()` helper — sub-hour/hour/day relative time formatting with green/amber/red colouring thresholds

#### Changed
- [frontend] Status bar "Last Assessed" → "Last Updated" — primary value now shows older of prices/macro timestamps as relative time (green <12h, amber 12–24h, red >24h); sub-text shows `Scenario: [date]`
- [frontend] Trigger table restructured from 4 to 3 columns (Trigger 25% / Detail 65% / Status 10%) — quantitative rows show `current → threshold` inline; qualitative rows show notes with threshold as a muted sub-line
- [frontend] Accordion collapsible sections — chevron `▸` rotates on open, `surface-2` background, hover lifts to `border-2`; "Transition Thesis" rename
- [frontend] Footer — add "Thesis last assessed: [date]" line below timestamps
- [frontend] DXY and US 10Y staleness thresholds widened to amber 5d / red 10d (daily FRED series; previous 2d/5d triggered false alerts on weekends)

### 2026-03-26 (session 6)

#### Fixed
- [frontend] mobile status bar clipping — `height: auto` on mobile; `--status-bar-h` bumped to 116px
- [frontend] trigger row text overlap — current and threshold split into separate grid rows (row 2 / row 3)
- [infra] bump service worker to v3 to force cache invalidation on existing installs

### 2026-03-26 (session 5)

#### Added
- [frontend] mobile table-to-card transform — trigger rows become 2-line cards (name + status dot / current · threshold); price tables collapse to 3-col (name | price | change)
- [frontend] regime summary bar — one-line monospace strip showing scenario · M2 YoY · sentiment, populates from live data
- [frontend] primary macro card tier — Global M2 and Fear & Greed elevated to 26px value, `surface-2` background, full-width on mobile at 30px

#### Changed
- [frontend] mobile section order — Macro Indicators moved above Triggers; story reads regime → signals → threats → positions → thesis
- [frontend] mobile status bar — Scenario cell promoted to full-width hero (22px); Last Assessed hidden on mobile
- [frontend] mobile base font lifted from 14px to 15px; increased padding throughout
- [frontend] accordion summary — padding increased, title colour promoted to `var(--text)`, cleaner hover
- [frontend] border contrast lifted — `--border` #1e1e1e → #242424, `--border-2` #2a2a2a → #323232

### 2026-03-26 (session 4)

#### Added
- [docs] add `docs/m2_note.md` — Notes on Global M2, covering global liquidity weighting by bloc with estimated globally active M2 and leakage rates
- [frontend] add second collapsible section in thesis panel — "Notes on Global M2" renders m2_note.md
- [frontend] refactor `renderThesis()` into shared `renderMarkdownDoc()` helper to support multiple markdown docs

#### Fixed
- [frontend] add border separator between collapsible sections in thesis panel

### 2026-03-26 (session 3)

#### Changed
- [docs] thesis.md: full content — thesis narrative, portfolio table, indicators guide, invalidation triggers, scenario analysis
- [docs] thesis.md: multiple review passes — sourced M2/BTC correlation claims, added lag risk caveat, grounded gold price target, genericised conflict references, fixed scenario probabilities to fixed points (35/40/20/5), added 2030 horizon statement, moved Bear trigger note to separate italic line

### 2026-03-26 (session 2)

#### Added
- [data] add `alerts.json` — per-ticker above/below price thresholds for all 13 watchlist assets
- [frontend] add alerts system — Alert and St columns across Hard Money, Macro Signals, and AI & Tech tables
- [frontend] add `alertRow()` rendering function with red/green/grey status dots
- [docs] add `thesis.md` — full thesis narrative rendered in collapsible dashboard section

#### Fixed
- [frontend] fix trigger status dot vertical alignment — move colour class to `td`, remove `span` wrapper
- [frontend] fix STATUS column header alignment — `text-align: center` on trigger table 4th header
- [frontend] fix alert/St column spacing — tightened padding between columns

### 2026-03-26

#### Fixed
- [pipeline] fix BOJ M2 response parsing — use `RESULTSET[0].VALUES` structure
- [pipeline] fix EUR M2 — revert to ECB Data Portal (FRED series stale since 2017)
- [pipeline] replace Finnhub VIX (paid tier only) with Yahoo Finance `%5EVIX`
- [pipeline] remove Finnhub `/forex/rates` (403 on free tier); drop Gold AUD derived price

#### Changed
- [frontend] remove Gold (AUD) row from Hard Money section
- [frontend] GEV labelled as "Power infrastructure play"
- [frontend] move Macro Signals (WTI, VIX) under Hard Money section
- [frontend] bump service worker to v2 (network-first for all assets)
- [data] seed `manual.json` global M2 — 103.97T USD as of 2026-03

### 2026-03-25

#### Added
- [pipeline] add `fetch_prices.py` — BTC (CoinGecko), WTI + XAUUSD (Stooq), equities (Finnhub), VIX (Yahoo Finance)
- [pipeline] add `fetch_macro.py` — US M2/10Y/DXY (FRED), EUR M2 (ECB), JP M2 (BOJ), Fear & Greed (Alternative.me)
- [pipeline] add `utils.py` — shared HTTP session, JSON write, timestamp helpers
- [pipeline] add GitHub Actions workflows — prices (3×/day weekdays), macro (1×/day weekdays)
- [frontend] add PWA dashboard — status bar, invalidation triggers, positions, macro panel, thesis section
- [frontend] add service worker with offline cache fallback
- [data] add `manual.json` schema — scenario, global M2, CN/UK M2, invalidation triggers

#### Fixed
- [pipeline] fix Stooq malformed JSON (`"volume":}`) — regex patch before `json.loads()`
- [pipeline] fix workflow push race condition — `git pull --rebase --autostash origin main` after commit
- [infra] offset fetch-macro cron 5 min to avoid simultaneous push collisions with fetch-prices

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
- **Security** — anything related to API key handling, data leakage, anonymisation

### Entry format
- One line per change
- Start with lowercase verb: "add", "fix", "update", "remove", "refactor"
- Reference the component in brackets: [pipeline], [frontend], [data], [infra], [docs]
- Keep it short — what changed and why, not how

### Examples

```
### Added
- [pipeline] add ECB M2 fetch to macro pipeline
- [frontend] add staleness badges to macro indicators section
- [data] add manual.json seed with initial global M2 and scenario assessment

### Changed
- [frontend] increase amber threshold for monthly macro data from 45 to 60 days
- [pipeline] switch WTI source from Stooq to Alpha Vantage fallback

### Fixed
- [pipeline] fix race condition in workflow push step with git pull --rebase --autostash
- [frontend] fix Gold (AUD) showing dash when GLD price is available
- [data] correct VIX ticker symbol in fetch_prices.py

### Removed
- [pipeline] remove yfinance dependency, replaced by Finnhub + Stooq + CoinGecko

### Security
- [infra] move FINNHUB_API_KEY from .env to GitHub Secrets only
- [docs] remove portfolio weighting references from thesis.md
```

### What NOT to put in the changelog
- Git commit messages (those go in git log, not here)
- "chore: update prices" type entries — automated data updates are not changelog-worthy
- Work-in-progress items — only log when something ships

-->