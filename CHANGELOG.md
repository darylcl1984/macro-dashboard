# Changelog

All notable changes to the Macro Dashboard are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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