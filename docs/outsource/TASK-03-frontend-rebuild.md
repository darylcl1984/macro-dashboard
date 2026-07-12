# TASK-03 — Frontend Rebuild: Pillar Layout + Auto-Computed Trigger Board

## Goal

The dashboard is reorganized around the four thesis pillars defined in `docs/thesis.md` §3, with an eight-row invalidation trigger board whose statuses are computed from live data where possible. Polished, responsive, same dark visual language, no frameworks.

## Context

- Requires TASK-01 and TASK-02 merged (new macro.json fields, new manual.json schema).
- Read `docs/thesis.md` §3 (indicator meanings) and §4 (trigger table) — the UI must express exactly those semantics.
- Existing structure: `src/index.html` (status bar → regime bar → watchlist → macro grid → triggers → thesis collapsibles), `src/app.js` (~670 lines, render functions per section), `src/styles.css` (CSS variables at top).
- Data available after TASK-02 (all under `data/macro.json → indicators` unless noted): `GLOBAL_M2 {value, components{US,CN,EZ,JP,UK}}`, `GLOBAL_M2_YOY {headline_pct, fx_adjusted_pct}` (may be null), `US_M2`, `US_NET_LIQ`, `US_10Y`, `USD_INDEX`, `HY_OAS`, `EZ_M2`, `UK_M4`, `fx`, `FEAR_GREED`, `MANUAL` (scenario, china_m2, global_m2_yoy_estimate, divergence, cb_gold, cofer_usd_share, ai_transition, triggers_manual). Prices: `BTC`, `XAUUSD`, `WTI`, `VIX` with 52-week ranges; alerts in `data/alerts.json`.

## Layout (top to bottom)

1. **Status bar** (keep the sticky header pattern): Scenario (`MANUAL.scenario.current` + probability) · Global M2 YoY (computed `headline_pct`, else `global_m2_yoy_estimate` with an `est.` tag) · Fear & Greed · **Trigger tally** — e.g. `4 · 4 · 0` as green/amber/red dot-count chips, clicking scrolls to the trigger board. Remove the separate `#regime-bar`.
2. **Pillar panels** — 2×2 grid on desktop (≥900px), single column mobile. Titles exactly: "Monetary Expansion", "De-Dollarisation", "AI Transition", "Hard Money Market State".
   - **Monetary Expansion:** Global M2 composite as the hero stat (value + YoY + FX-adjusted YoY when present) with a per-bloc breakdown table (bloc, local value, USD value, as-of date — China row flags its manual source/date); below: US M2, US Net Liquidity, US 10Y, and the dollar index **relabeled "USD Broad Index (Fed)"** (it is DTWEXBGS, not DXY — the current UI label is wrong).
   - **De-Dollarisation:** Gold price row with 52-week range bar and a **marked $4,000 threshold line** on the bar; CB gold purchases card (`cb_gold`: quarterly tonnes, YoY, latest monthly); COFER card (`cofer_usd_share`: consecutive rising quarters, note).
   - **AI Transition:** three cards from `MANUAL.ai_transition` (crossover status, structural slopes, next test) + HY OAS live value with color bands (green <4%, amber 4–5%, red >5%).
   - **Hard Money Market State:** BTC row with 52-week bar showing **two marked lines: $53,000 (realized-price floor) and $83,800 (ETF cost basis)**; the **divergence clock** — months elapsed since `MANUAL.divergence.start` rendered as `N mo` with a progress track toward 18 (green <12, amber 12–17, red ≥18; if `start` is null show "Reconnected" in green); WTI, VIX rows; Fear & Greed gauge.
3. **Invalidation Trigger Board** — 8 rows, columns: Trigger · Threshold · Current · Status chip. Computation rules below.
4. **Thesis narrative** — keep the existing collapsible `docs/thesis.md` + `docs/m2_note.md` rendering untouched (verify v6 tables render).
5. **Footer** — sources line becomes: `FRED · ECB · BoE · BOJ · CoinGecko · Stooq · Yahoo · Alternative.me · WGC/IMF (manual)`.

## Trigger computation rules (implement as a config array of `{id, label, threshold, current(), status()}`)

| # | Trigger | Red | Amber | Green | Inputs |
|---|---|---|---|---|---|
| 1 | BTC structural demand (< $53,000 weekly close) | price < 53000 | price < 60950 (within 15%) OR week52_low < 58300 (within 10%) | else | prices.BTC |
| 2 | Gold monetary-hedge bid (monthly close < $4,000) | manual red, or live < 4000 AND manual red | live < 4000 (pending close) OR manual amber | else | prices.XAUUSD + `triggers_manual.gold_monthly_close` |
| 3 | BTC–M2 divergence (≥ 18 months) | months ≥ 18 | months ≥ 12 | else / reconnected | `MANUAL.divergence.start` vs today |
| 4 | COFER reversal (4 consecutive rising quarters) | quarters ≥ 4 | 1–3 | 0 | `cofer_usd_share.consecutive_rising_quarters` |
| 5 | Global M2 (YoY < 0%) | yoy < 0 | yoy < 3 | else | GLOBAL_M2_YOY else estimate |
| 6 | Oil shock (> $120 sustained 4+ weeks) | price > 120 (label "pending 4-wk confirmation") | price > 100 | else | prices.WTI |
| 7 | AI financing break (HY OAS > 5% + capex cuts) | OAS > 5 OR manual red | OAS > 4 OR manual amber | else | HY_OAS + `triggers_manual.ai_financing` |
| 8 | Taiwan escalation | manual red | manual amber | manual green | `triggers_manual.taiwan` |

Where a manual note exists, show it as the row's secondary text. Status precedence: worst of (computed, manual override). The tally in the status bar derives from this same computation — single source of truth.

**Expected state with July 2026 data (use as a test fixture):** BTC amber (52-wk low $57.7k), Gold amber, Divergence amber (~12 mo), COFER amber (1), M2 green, Oil green, AI green, Taiwan green → tally **4 green · 4 amber · 0 red**. If your implementation disagrees, check the rules before checking the data.

## Styling requirements

- Keep the existing CSS variable palette and dark theme; extend variables rather than hardcoding colors. Green/amber/red must be the same three variables everywhere (chips, dots, bands, clock).
- Pillar panels share one card component style; hero stats visually dominant; threshold markers on range bars are thin vertical ticks with tiny labels, legible at mobile widths.
- Keep the mobile table pattern (`data-label` attributes) working; test 375px and 1280px.
- Stale badges: extend existing staleness logic to EZ_M2/UK_M4 (monthly cadence — stale after 45 days), HY_OAS (daily — stale after 4 days), china_m2 (stale after 45 days), cb_gold/cofer (quarterly — stale after 120 days).

## Acceptance criteria

- [ ] All four pillar panels render with live data; missing/null fields degrade to "—" with a stale/pending badge, never `undefined`/`NaN`.
- [ ] Trigger board shows exactly 8 rows and the July-2026 fixture tally (4/4/0); tally chip in the status bar matches the board; clicking it scrolls to the board.
- [ ] BTC bar shows both threshold ticks; gold bar shows the $4,000 tick; divergence clock shows ~12 mo amber.
- [ ] `docs/thesis.md` v6 renders fully in the collapsible (headings, the §4 table, bold) — no raw markdown artifacts.
- [ ] No console errors; layout intact at 375px and 1280px; PWA still installs (manifest untouched).
- [ ] No remaining references to removed concepts: watchlist groups, "Positions", old manual.json keys, DXY label.
