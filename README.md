# The Great Transition — Macro Dashboard

A structural macro research dashboard with a horizon into the 2030s. The current redesign organizes the thesis into three distinct sections. It is a local preview until explicitly published.

| Section | What it tracks |
|---|---|
| Technological deflation | Epoch ECI frontier and estimated expert-task duration; APEX-Agents 1.1 and Terminal-Bench 4.0 with professional-work context |
| Fiscal dominance | Federal debt/GDP; ten-year US M2 against its calculated 30-year CAGR; five-bloc broad money and regional growth; 2Y/30Y Treasury yields; USD stablecoin supply |
| Hard-money monetization | Four-year gold and Bitcoin prices; four-year central-bank gold demand with a four-quarter moving average; over one year of weekly US spot Bitcoin ETF flows; Fear & Greed |

This desk studies structural forces. [Liquidity-monitor](https://github.com/darylcl1984/liquidity-monitor) owns the shorter-term liquidity window. No positions, portfolio tables or trade alerts.

Thesis writing is paused. The saved thesis documents are not linked from the dashboard; its structural-thesis strip only navigates between sections. Historical implementation material and screenshots are grouped under [docs/archive](docs/archive/README.md).

## Run locally

Serve from the **repository root**, because the app reads `../data/*.json`:

```sh
python -m http.server 8081 --bind 127.0.0.1
```

Open [the local dashboard](http://127.0.0.1:8081/src/). Port 8000 is reserved for liquidity-monitor. No build step or API key is needed to view the checked-in snapshots.

The [GitHub Pages address](https://darylcl1984.github.io/macro-dashboard/) remains the publication target. Local changes are not automatically deployed.

## Data and refreshes

| File | Source / update method |
|---|---|
| `data/dashboard_history.json` | `scripts/fetch_dashboard_history.py`: FRED, Coinbase, Stooq/Yahoo, DefiLlama and Alternative.me |
| `data/m2_history.json` | `scripts/backfill_global_money.py`: same-month central-bank stocks and monthly-average FX; China remains reviewed input |
| `data/gold_buying.json` | Reviewed four-year WGC quarterly extract; one publication vintage, including revisions |
| `data/etf_flows.json` | `scripts/sync_etf_flows.py`: closed historical archive plus liquidity-monitor's canonical ongoing weeks |
| `data/work_benchmarks.json` | `scripts/import_work_benchmarks.py`: original Mercor and Terminal-Bench leaderboards, with version and frontier-coverage checks |
| `data/technology.json` | `scripts/import_epoch.py`: Epoch's public ECI CSV archive |
| `data/metr_context.json` | `scripts/import_metr_context.py`: reviewed METR measurements and matching ECI calibration; refresh after an Epoch import |
| `data/macro.json`, `data/manual.json` | Regional indicators and reviewed inputs used by the dashboard and refresh scripts |

The unified [refresh workflow](.github/workflows/refresh-dashboard.yml) replaces the retired macro and legacy price jobs:

| Cadence (UTC) | Coverage |
|---|---|
| Daily at 08:05, 12:05, 17:05 and 21:05 | Gold, Bitcoin, stablecoin supply and Fear & Greed |
| Daily at 08:05 | Regional macro indicators, US M2/debt/yields, same-month global money, and ETF weeks from liquidity-monitor |
| Mondays at 08:05 | Epoch ECI, then METR recalibration, plus original-publisher work benchmarks |
| Manual run | All of the above |

Successful updates are validated before publication; failed sources retain usable snapshots and produce a failed Actions run. Only the automated snapshot files are staged. The old price writer, its isolated test, unused prices/alerts snapshots and two superseded workflows have been removed. Gold and Bitcoin charts use `data/dashboard_history.json`.

These changes remain local. Scheduled refreshes begin after publication to the default branch, with Actions enabled and `FRED_API_KEY` configured. ETF synchronization also requires `LIQUIDITY_MONITOR_READ_TOKEN`, with read-only Contents access to the private liquidity-monitor repository. Its `master` branch is read without modification. See [refresh operations](docs/refresh-operations.md).
For refreshes, install `requirements.txt` and supply `FRED_API_KEY` in the environment or GitHub Actions secrets. The history and global-money scripts also accept `--env-file` for a local key file. Never put a key in frontend code, source control or published JSON.

ETF weeks are maintained in liquidity-monitor; this repo adds only a closed historical archive. Do not create a second ongoing writer here. Central-bank demand and China M2 remain reviewed updates.

## Reading the measures

- **M2:** the reference is calculated over the latest 360-month interval and anchored at the beginning of the displayed ten-year window. Current reference: approximately 6.28% CAGR, July 1996–July 2026.
- **Global money:** five blocs, including UK M4. Only complete, same-month baskets are drawn. Headline YoY includes currency translation; fixed-FX YoY holds exchange rates constant.
- **Gold:** the current price series is a clearly labelled continuous futures proxy. Central-bank purchases are a separate WGC series; the moving average requires four consecutive quarters.
- **AI benchmarks:** task success against professional acceptance criteria. The original APEX human timing study is context, not a matched v1.1 human pass rate.
- **ECI:** a linear latent capability scale. The summary shows the three-year frontier gain divided by three, in points per year. Expert-time tooltips distinguish METR measurements, approximate conversions and unvalidated extrapolations. A separate time line uses the logarithmic right axis; extended dashes identify estimates beyond the checked calibration range.

See [data provenance and publication terms](docs/history-and-benchmark-sources.md), [M2 methodology](docs/m2_note.md), and the [design contract](docs/design-contract.md).

## Repository layout

| Directory | Purpose |
|---|---|
| `src/` | Dashboard, charts, offline support and the formatted methodology page |
| `data/` | Current snapshots, reviewed inputs and the closed ETF archive |
| `scripts/` | Active data refresh, import and validation tools |
| `tests/` | Data, calculation and service-worker checks |
| `docs/` | Current methodology, design, provenance and paused thesis work |
| `docs/research/` | Source evidence and research history |
| `docs/archive/` | Superseded instructions, completed redesign notes and old screenshots |

Generated scratch downloads and old preview captures were cleared on 10 September 2026. Ignored `temp/` retains the supplied source input and locally installed test dependencies; neither is product data.

## Validation

```sh
python -m unittest discover -s tests -v
node --test tests/*.mjs
node --check src/app.js
node --check src/charts.js
```

The app is a vanilla HTML/CSS/JavaScript PWA with no bundler. Chart calculations are tested separately from rendering. Source requests time out, section failures remain local, and data writers preserve usable snapshots on failure. The service worker uses only its own project cache; bump its version after shell changes. It is disabled on localhost.

## Licence

Repository code: [MIT](LICENSE). Third-party datasets retain their own terms: Epoch and the APEX leaderboard use CC BY 4.0; Terminal-Bench leaderboard data uses Apache 2.0 with the [licence and notices retained](docs/licenses/README.md). WGC material is a limited attributed extract for review/commentary, not an unrestricted workbook redistribution. Other source data is not relicensed by this repository's MIT licence.
