# TASK-01 — Purge Equities & Fix Broken Gold/WTI Prices

## Goal

The repo tracks no individual equities anywhere (no NVDA, TSLA, PLTR, TSM, GOOGL, META, GEV, MSTR — in scripts, data, workflows, or UI), Finnhub is fully removed, and XAUUSD/WTI show live prices again. The dashboard still renders and works after this task alone.

## Context

- `scripts/fetch_prices.py` fetches equities via Finnhub and gold/WTI via Stooq. **The Stooq fetch is currently failing** — `data/prices.json` has `XAUUSD` and `WTI` entries with 52-week ranges but **no `price` key** (see `main()`: when the quote fails, `fetch_all_52w` still inserts a bare `{week52_low, week52_high}` entry).
- The same Yahoo chart call already used for 52-week ranges (`fetch_yahoo_52w`) returns `meta.regularMarketPrice` and `meta.chartPreviousClose` — a price source we already have.
- The frontend (`src/app.js`) renders three watchlist groups: hard money, macro signals, and tech equities (`group-tech` in `src/index.html`).

## Requirements

1. **`scripts/fetch_prices.py`:**
   a. Delete all Finnhub code: `FINNHUB_API_KEY`, `finnhub_get`, `fetch_finnhub_quote`, `fetch_finnhub_prices`, rate-limit constant, and their call sites.
   b. Delete the 8 equity tickers from `YAHOO_52W_SYMBOLS` (keep `BTC`, `XAUUSD`, `WTI`, `VIX`).
   c. Rework gold/WTI pricing: primary source = Yahoo chart meta (`regularMarketPrice`, with `change_pct` computed from `chartPreviousClose`) for `XAUUSD` (symbol `GC=F`) and `WTI` (`CL=F`); keep the Stooq fetch as a fallback when Yahoo fails. Restructure so one Yahoo call per symbol supplies both the quote and the 52-week range (don't call the same endpoint twice).
   d. Keep `USDJPY` in the `fx` block (Stooq primary, as now). Do not add more FX here — that lands in TASK-02.
   e. The `fetch_all_52w` merge must never create a price-less entry: if a ticker has no price by the merge step, log `[WARN]` and include it with `"price": null` explicitly rather than a bare ranges dict.
2. **`.github/workflows/fetch-prices.yml`:** remove the `FINNHUB_API_KEY` env/secret reference.
3. **`data/alerts.json`:** replace contents with thesis-aligned thresholds only:
   - `BTC`: below 53000 (realized-price floor), above 83800 (ETF cost basis reclaim)
   - `XAUUSD`: below 4000, above null
   - `WTI`: below null, above 120
   - `VIX`: below null, above 30
   - Keep the `_note` key, updating it to describe the thesis meaning of each threshold.
4. **`src/index.html` + `src/app.js`:** remove the "AI & Tech Equities" group (table, heading, render call, and the equity ticker config/labels in app.js). The positions grid collapses to the remaining group(s) without layout breakage. Rename visible label "Watchlist" → "Market State". Do not attempt the pillar rebuild here — that is TASK-03.
5. Run `python scripts/fetch_prices.py` and commit the regenerated `data/prices.json` (it should now contain only BTC, XAUUSD, WTI, VIX + fx.USDJPY, all with real prices).

## Acceptance criteria

- [ ] `grep -ri "finnhub\|NVDA\|TSLA\|PLTR\|GOOGL\|META\|MSTR\|GEV\|TSM" scripts/ src/ data/ .github/` returns no hits (case-insensitive; docs/ excluded).
- [ ] `data/prices.json` has numeric `price` for BTC, XAUUSD, WTI, VIX after a fresh script run.
- [ ] Simulated Yahoo failure (e.g. temporarily wrong symbol) falls back to Stooq or emits `price: null` + `[WARN]` — never a KeyError, never a bare ranges dict.
- [ ] Dashboard renders locally with no console errors; no empty "tech" panel remnants at 375px and 1280px.
- [ ] Alert dots on the range bars reflect the new thresholds (BTC shows amber/red only per the new levels).
