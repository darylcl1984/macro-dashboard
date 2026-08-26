# Hyperscaler cash (OCF vs cash capex)

Quarterly desk series for the **AI capability** desk (near-term path, not the ladder itself): aggregate operating cash flow vs cash capital expenditure for the five large hyperscalers.

## Canonical source

| Item | URL |
|---|---|
| Insight | https://epoch.ai/data-insights/hyperscaler-capex-vs-cash-flow |
| CSV | https://epoch.ai/data/charts/hyperscaler-capex-vs-cash-flow/ocf_vs_capex_log_data.csv |
| License | CC-BY (credit Epoch AI / Isabel Juniewicz) |

## Definitions (do not mix metrics)

- **Universe:** Microsoft, Amazon, Alphabet, Meta, Oracle
- **OCF:** `us-gaap:NetCashProvidedByUsedInOperatingActivities`
- **Cash capex:** `PaymentsToAcquirePropertyPlantAndEquipment` (Amazon: `PaymentsToAcquireProductiveAssets`)
- **Cash only** — finance leases excluded (by Epoch design for this chart)
- Oracle fiscal quarters mapped to nearest calendar quarter
- Trend fit (Epoch): ~+23%/yr OCF, ~+70%/yr capex from Q2 2023; aggregate cross ~**Q3 2026**

Related Epoch chart with *broader* capex (cash + new finance leases) is **not** the same series:
https://epoch.ai/data-insights/hyperscaler-capex-trend

## Write target

`data/manual.json` → `ai_transition.hyperscaler_cash`:

```json
{
  "as_of_quarter": "2026-Q1",
  "universe": "MSFT+AMZN+GOOGL+META+ORCL",
  "ocf_usd_b": 157.9,
  "cash_capex_usd_b": 148.4,
  "gap_usd_b": 9.5,
  "crossed": false,
  "epoch_crossover_quarter": "2026-Q3",
  "ocf_trend_yoy_pct": 23,
  "capex_trend_yoy_pct": 70,
  "source": "Epoch AI",
  "source_url": "https://epoch.ai/data-insights/hyperscaler-capex-vs-cash-flow",
  "csv_url": "https://epoch.ai/data/charts/hyperscaler-capex-vs-cash-flow/ocf_vs_capex_log_data.csv",
  "source_updated": "2026-06-16",
  "note": "…"
}
```

Also refresh:

- `ai_transition.crossover_status` — short company/financing color
- `ai_transition.updated`
- `triggers_manual.ai_financing.notes` if the cash gap story changed

## Cadence

After hyperscaler earnings (esp. early each quarter) or when Epoch updates the CSV. Same manual/agent rhythm as CB gold / COFER.

## Fallback

If the Epoch CSV is missing or more than one earnings season behind, sum the five names from SEC EDGAR XBRL using the tags above. Prefer Epoch when available so the crossover stays comparable.
