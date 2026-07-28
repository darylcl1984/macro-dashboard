# Desk refresh pack — agent runbook

**Path A · Project 4 (skeleton)**  
Staging packs are **gitignored** (`data/agent_manual_pack_*.json`). Humans merge into `data/manual.json`. Never write secrets. Never overwrite computed `macro.json` indicators.

---

## 1. Cadence

| Series | Cadence | Primary source | Write target in `manual.json` |
|--------|---------|----------------|-------------------------------|
| China M2 | Monthly ~14th | PBoC | `china_m2` |
| CB gold | Quarterly | [WGC Gold Demand Trends](https://www.gold.org/goldhub/research/gold-demand-trends) | `cb_gold` |
| COFER USD share | Quarterly | [IMF COFER data briefs](https://data.imf.org/) | `cofer_usd_share` |
| Hyperscaler OCF/capex | Quarterly | [Epoch CSV](https://epoch.ai/data/charts/hyperscaler-capex-vs-cash-flow/ocf_vs_capex_log_data.csv) | `ai_transition.hyperscaler_cash` (+ short `crossover_status`) |
| Spot BTC ETF flows | Weekly | [Farside](https://farside.co.uk/btc/) | `etf_flows` |
| Scenario book | When judgment changes | Human + stress memo | `scenario.*` |
| Trigger notes | As needed | Human | `triggers_manual.*` |
| Divergence start | Rare | Human (see transmission memo) | `divergence` |
| US M2 / Global M2 / OAS / prices | Pipeline | FRED/etc. | **Do not manual** — `scripts/fetch_*.py` |

Detail for AI cash: `docs/ai-hyperscaler-cash.md`.

---

## 2. Pack file contract (staging only)

**Path:** `data/agent_manual_pack_YYYY-MM-DD.json` (gitignored)  
**Or:** `temp/agent_manual_pack_YYYY-MM-DD.json` (gitignored via `temp/`)

```json
{
  "generated": "2026-07-28",
  "as_of": "2026-07-28",
  "agent": "name-or-model",
  "sources_checked": ["epoch", "farside", "wgc", "cofer", "pboc"],
  "patches": {
    "china_m2": null,
    "cb_gold": null,
    "cofer_usd_share": null,
    "etf_flows": null,
    "ai_transition": null,
    "scenario": null,
    "triggers_manual": null,
    "divergence": null
  },
  "integrity": [
    "Describe checks run, e.g. Epoch Q1 capex still 148.4 if unchanged"
  ],
  "do_not_merge": [
    "Anything uncertain"
  ]
}
```

Only non-null `patches` keys are candidates for merge. **Human** copies fields into `manual.json` and commits.

---

## 3. Integrity checks (minimum)

| Series | Check |
|--------|--------|
| Epoch | Latest actual quarter; capex/OCF finite; `gap = ocf − capex`; `crossed` consistent; cite CSV URL + source_updated |
| ETF | Period dates; net m and bn consistent (bn ≈ m/1000); cum since launch not wildly off ~$50B+ era |
| COFER | Share in plausible 50–65%; consecutive_rising_quarters logic vs prior |
| CB gold | Prefer WGC primary tonnes; flag if secondary estimate differs |
| China M2 | Units trillions CNY; period YYYY-MM; clear stale “due date” text |
| Scenario | Probabilities sum ~100; active_id matches current; no silent weight edits without stress memo |

---

## 4. Agent prompt (one-shot)

```text
Produce a desk refresh pack for macro-dashboard.

Read: docs/desk-refresh-pack.md, docs/ai-hyperscaler-cash.md, data/manual.json

Rules:
- Research terminal only; no portfolio.
- Output ONLY gitignored pack JSON (schema in desk-refresh-pack.md).
- Prefer official/primary sources; quote URLs and as-of dates.
- Do not invent GLOBAL_M2 or FRED series — leave those to pipeline.
- Do not change scenario probabilities unless a stress-test memo says so;
  you may propose scenario.notes / next_check text.
- List integrity checks and do_not_merge uncertainties.
- Cash capex = Epoch cash definition (no finance leases).
```

---

## 5. Human merge checklist

1. Open pack; reject if integrity empty or sources missing.  
2. Diff each patch against current `manual.json`.  
3. Update `updated` dates.  
4. Commit `manual.json` only (not the pack).  
5. Optional: one line in `docs/research/` if judgment moved.  
6. UI: hard-refresh if SW cache; no SW bump for data-only.

---

## 6. Out of scope (v1)

- Auto PR / auto commit  
- SEC EDGAR scrape  
- Overwriting `data/macro.json` computed blocks  
- Interactive scenario scoring  
- Treating pack as production SoT  

---

## 7. Link to Path A research

| Memo | Use when packing |
|------|------------------|
| `research-memo-2026-07-28-stress.md` | Scenario / next_check / rescore wording |
| `research-memo-2026-07-28-m2-audit.md` | Do not “fix” M2 in pack — pipeline issue |
| `research-memo-2026-07-28-transmission.md` | Divergence reset discipline |
