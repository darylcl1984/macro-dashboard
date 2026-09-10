# How global money is measured

Updated 10 September 2026. This note describes the current three-section dashboard. The [earlier note](research/m2-note-pre-redesign-2026-09-10.md) preserves the original thesis discussion, estimates and historical desk diagnostics.

## The five-bloc basket

The chart combines US, China, euro-area and Japan M2 with UK M4, converted to USD. It is a five-bloc broad-money composite, not every country's money supply. Cross-country definitions differ; this is a consistent basket rather than a globally harmonized monetary aggregate.

| Component | Published series | Local units stored |
|---|---|---|
| US M2 | FRED M2SL, seasonally adjusted | USD billions |
| China M2 | Reviewed PBoC monthly releases | CNY trillions |
| Euro-area M2 | ECB BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E | EUR trillions |
| Japan M2 | BOJ MD02.MAM1NAM2M2MO, monthly average | JPY trillions |
| UK M4 | BoE LPMAUYN, seasonally adjusted | GBP billions |

UK M4 is retained throughout; M4ex is not substituted. Latest observations and local-currency YoY appear in the regional table.

## Conversion and comparability

In USD trillions:

```text
US / 1000
+ China / USDCNY
+ euro area × EURUSD
+ Japan / USDJPY
+ UK / 1000 × GBPUSD
```

Exchange rates are FRED monthly averages: EXCHUS, EXUSEU, EXJPUS and EXUSUK. Every plotted basket requires all five stocks from the same month and all four valid exchange rates.

The headline line uses each month's FX. The fixed-FX line revalues every month's local stocks using the latest complete month's exchange rates. Both YoY measures compare the same calendar month one year apart, using complete five-bloc baskets. Fixed-FX growth removes exchange-rate translation; it does not identify the policy or credit mechanism that created the money.

No missing stocks are carried into another month, interpolated or replaced with zero. Missing months remain chart gaps. A mixed-month or daily-FX refresh cannot replace a completed monthly-average basket.

## Current coverage

There are 15 consecutive complete observations, May 2025–July 2026. The previously missing UK observations and June 2025 basket have been reconstructed from published sources.

July 2026: **$106.86T**, with **7.64% headline YoY** and **6.07% fixed-FX YoY**. These are computed directly from the chart's matching monthly observations. See [reconstruction and source provenance](history-and-benchmark-sources.md#global-money).

US M2 has a separate ten-year chart. Its reference growth rate is calculated over the 30 years ending at the latest M2 observation, then anchored to the start of the displayed ten-year window. At July 2026 that reference is **6.28% CAGR**, using July 1996 and July 2026. Observed ten-year CAGR and latest YoY are separate readings.

## Monetary stock is not freely mobile capital

Capital controls, reserve-currency use, domestic banking structures and offshore credit affect how each aggregate reaches global asset markets. A dollar-equivalent yuan deposit is not interchangeable with a dollar deposit in its international use. The basket measures monetary stock; it does not apply speculative weights for each region's ability to transmit liquidity abroad.

The earlier note's numerical “globally active” estimates remain archived as thesis assumptions, not measured series or inputs to this dashboard.

USD stablecoins are shown separately as dollar rails. Adding their gross supply to bank-money aggregates would risk counting related backing assets or deposits twice. Token supply alone also does not establish foreign adoption, payments activity or incremental Treasury demand.

## Maintenance

`scripts/fetch_macro.py` collects the existing regional snapshots. `scripts/backfill_global_money.py` then rebuilds complete monthly baskets from published regional histories, reviewed China observations and FRED FX. China remains a reviewed monthly input. Source revision dates can differ even when observation months match.

The historical thesis's BTC lag diagnostics and scenario thresholds are not rendered in the current interface. Monetary expansion and hard-asset flows are displayed separately; the dashboard does not impose a fixed price-transmission lag.
