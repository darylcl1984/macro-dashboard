# TASK-02 — Macro Pipeline: New Sources, Computed M2 Composite, New manual.json

## Goal

`fetch_macro.py` automates everything automatable for the four thesis pillars: Eurozone M2 (ECB), UK M4 (BoE), HY credit spreads + US net liquidity (FRED), FX rates, and a **computed** five-bloc Global M2 composite in USD with both headline and FX-adjusted YoY (once history accumulates). Only China M2 and quarterly/qualitative items stay manual. `data/manual.json` is replaced with the new schema below.

## Context

- Read `docs/m2_note.md` §1–§3 first — it defines the composite and the FX-vs-money-creation split you are implementing.
- Current pipeline: FRED (US_M2, US_10Y, USD_INDEX) + BOJ (JP_M2) + Fear & Greed + manual passthrough. Keep all of it, including the seed-from-existing failure isolation.
- FRED calls use the existing `fred_latest()`; the API key is already wired.

## Requirements

### 1. New FRED series (existing key, existing helper)

| Label | Series | Notes |
|---|---|---|
| `HY_OAS` | `BAMLH0A0HYM2` | High-yield option-adjusted spread, %. Daily. |
| `FED_BS` | `WALCL` | Fed total assets, $M weekly. |
| `RRP` | `RRPONTSYD` | Overnight reverse repo, $B daily. |
| `TGA` | `WTREGEN` | Treasury General Account, **$M** weekly — normalize to $B at ingest. |

Compute `US_NET_LIQ` = WALCL/1000 − RRPONTSYD − WTREGEN (all normalized to $B; verify units at runtime — WALCL is in $M, the others in $B) and store `{value, date, unit: "billions_usd"}` alongside the raw three. If any component is missing, skip the computation with a `[WARN]` (don't write a wrong number).

### 2. Eurozone M2 — ECB Data Portal (no key)

`GET https://data-api.ecb.europa.eu/service/data/BSI/M.U2.Y.V.M20.X.1.U2.2300.Z01.E?lastNObservations=1&format=jsondata`

The series key targets M2 outstanding amounts, euro area, all MFIs. **Validate**: the latest observation should be ~15,000,000–17,000,000 (EUR millions, i.e. ~€15–17T). If the key 404s or the magnitude is wrong, consult the ECB Data Portal series browser for the M2 outstanding-amounts key under dataset BSI and correct it — note the final key in your commit message. Store as `EZ_M2 {value: <trillions EUR, 2dp>, date, unit: "trillions EUR"}`.

### 3. UK M4 — Bank of England IADB CSV (no key)

`GET https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&SeriesCodes=LPMAUYN&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`

Parse the CSV, take the latest row. **Validate**: ~3,200,000–3,400,000 (£ millions ≈ £3.3T). Store as `UK_M4 {value: <billions GBP, 1dp>, date, unit: "billions GBP"}`. Send a browser-like User-Agent header (the BoE endpoint rejects default python UAs).

### 4. FX rates for the composite

Fetch `EURUSD`, `GBPUSD`, `USDCNY`, `USDJPY` — Stooq primary (`eurusd`, `gbpusd`, `usdcny`, `usdjpy`, reuse/adapt the Stooq helper from `fetch_prices.py` via `utils.py` so it isn't duplicated), Yahoo chart-meta fallback (`EURUSD=X`, `GBPUSD=X`, `CNY=X`, `JPY=X`). Store under `macro.json → fx` with a per-rate date.

### 5. Computed Global M2 composite

```
US   = US_M2 (FRED, $B) / 1000
CN   = manual.china_m2.value (¥T) / fx.USDCNY
EZ   = EZ_M2 (€T) × fx.EURUSD
JP   = JP_M2 (¥T) / fx.USDJPY
UK   = UK_M4 (£B) × fx.GBPUSD / 1000
GLOBAL_M2 = sum, trillions USD, 2dp
```

Write `GLOBAL_M2 {value, unit: "trillions_usd", components: {US, CN, EZ, JP, UK}, component_dates: {...}, computed_at}`. **Validate**: result must be 90–125; outside that range, `[WARN]` and skip the write (keep prior value via seed pattern). If any component is unavailable, skip composite computation entirely — never write a partial sum.

### 6. History + YoY — `data/m2_history.json`

- On each run, upsert a snapshot keyed by `YYYY-MM` (current month): `{period, components_local: {US_usd_bn, CN_cny_tn, EZ_eur_tn, JP_jpy_tn, UK_gbp_bn}, fx: {...}, composite_usd}`. One entry per month (overwrite within the month).
- **Seed the file** with: `{"period": "2026-03", "composite_usd": 103.97}` (manual-era value, components null) so continuity exists.
- When a `YYYY-MM` entry from 12 months prior exists with a composite, compute `GLOBAL_M2_YOY {headline_pct}`; additionally compute `fx_adjusted_pct` (revalue year-ago local components at *current* FX) when year-ago local components exist. Until then write `null` — the frontend falls back to `manual.global_m2_yoy_estimate`.

### 7. Replace `data/manual.json` with exactly this content

```json
{
  "_note": "Hand-edited. Commit after each update. China M2: monthly, PBoC release ~14th. cb_gold/cofer/ai_capex: quarterly. Trigger statuses here cover only manually-adjudicated triggers; the rest are computed by the frontend.",
  "scenario": {
    "current": "B — Hawkish Grind",
    "probability": "40%",
    "updated": "2026-07-11",
    "notes": "v6 scenario tree — see thesis §5. A Reconnection 30% / B Hawkish Grind 40% / C Credit-Forced Easing 20% / D Geopolitical Tail 10%."
  },
  "china_m2": {
    "value": 353.67,
    "unit": "trillions_cny",
    "period": "2026-05",
    "updated": "2026-07-11",
    "source": "PBoC monthly release; June figure due ~14 Jul 2026"
  },
  "global_m2_yoy_estimate": {
    "value": 7.0,
    "unit": "pct",
    "note": "Interim manual estimate; superseded automatically once m2_history.json spans 13 months",
    "updated": "2026-07-11"
  },
  "divergence": {
    "start": "2025-07",
    "note": "Month the BTC-M2 rolling-12m directional agreement broke. Reset to null when reconnected."
  },
  "cb_gold": {
    "quarterly_tonnes": 244,
    "period": "2026-Q1",
    "yoy_pct": 3,
    "latest_monthly": { "tonnes": 41, "period": "2026-05" },
    "note": "WGC net purchases. Floor intact; PBoC 20th consecutive month.",
    "updated": "2026-07-11"
  },
  "cofer_usd_share": {
    "consecutive_rising_quarters": 1,
    "period": "2026-Q1",
    "note": "Q1 2026: first counter-trend rise (headline and valuation-adjusted).",
    "updated": "2026-07-11"
  },
  "ai_transition": {
    "crossover_status": "Oracle crossed; Amazon crossing; aggregate hyperscaler capex > OCF expected ~Q3 2026",
    "structural_slopes": "Inference cost halves ~2mo; pre-training efficiency ~3x/yr (Epoch, Feb 2026)",
    "next_test": "Hyperscaler earnings, early Aug 2026",
    "updated": "2026-07-11"
  },
  "triggers_manual": {
    "gold_monthly_close": { "status": "amber", "notes": "June 2026 close $4,015.51 — $15 above the $4,000 line" },
    "cofer_reversal": { "status": "amber", "notes": "1 of 4 counter-trend quarters" },
    "taiwan": { "status": "green", "notes": "No escalation" },
    "ai_financing": { "status": "green", "notes": "HY OAS ~2.7%; watch Q3 crossover + hyperscaler bond issuance" }
  }
}
```

### 8. Wire-up

- `fetch_macro.py` continues to pass `manual.json` through into `macro.json → indicators.MANUAL` (as now), so the frontend keeps a single macro fetch.
- Update `.github/workflows/fetch-macro.yml` only if new env/permissions are needed (none expected).
- Keep every fetch in its own try/except with `[WARN]`; a total ECB+BoE outage must still produce a valid macro.json.

## Acceptance criteria

- [ ] Fresh run with FRED key: macro.json contains US_M2, US_10Y, USD_INDEX, JP_M2, FEAR_GREED, HY_OAS, US_NET_LIQ (+components), EZ_M2, UK_M4, fx (4 rates), GLOBAL_M2 (with components), GLOBAL_M2_YOY (null fields OK), MANUAL.
- [ ] EZ_M2 within €14–18T; UK_M4 within £3.0–3.6T; GLOBAL_M2 within $95–120T; each validated in-code, out-of-range values rejected with `[WARN]`.
- [ ] `m2_history.json` exists, contains the 2026-03 seed and the current month; running the script twice in one day does not duplicate entries.
- [ ] Run without FRED key: script completes, warns, composite skipped, macro.json still valid.
- [ ] `manual.json` replaced verbatim with the schema above; script passthrough works; no code anywhere still reads the old keys (`eur_m2`, `uk_m2`, `global_m2`, `invalidation_triggers`).
