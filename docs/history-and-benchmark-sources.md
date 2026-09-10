# History completion and work benchmarks

Checked 10 September 2026. Local preview only; no deployment or commit.

## Work benchmarks

Artificial Analysis has been removed from the rendered benchmarks. No AA scores or scrape derivatives are published.

| Benchmark | Original source | Publication basis |
|---|---|---|
| APEX-Agents 1.1 | [Mercor leaderboard](https://www.mercor.com/apex/apex-agents-leaderboard/) | The page's `application/ld+json` Dataset record identifies this exact leaderboard URL and declares `https://creativecommons.org/licenses/by/4.0/`. Source, licence and reformatting notices are displayed. |
| Terminal-Bench 4.0 | [Original leaderboard](https://www.tbench.ai/) | [Epoch's licensing page](https://epoch.ai/benchmarks/use-this-data) explicitly identifies Terminal-Bench leaderboard data as Apache 2.0. The [original repository licence](https://github.com/harbor-framework/terminal-bench/blob/main/LICENSE) is preserved in `docs/licenses/terminal-bench-Apache-2.0.txt`. |

The APEX permission was checked on the leaderboard, not inferred from an evaluation-code licence. No tasks, world files or answers are copied. Version 1.1 is matched to [Mercor's 8 September revision](https://www.mercor.com/blog/introducing-apex-agents-1-1/) and its 240-task description. Its old Epoch archive scores differ materially and are not used. Mercor supplies model release dates but no evaluation dates; the UI does not substitute one for the other.

APEX's three highest distinct labs are Anthropic/Fable 5.1 (68.6), Google/Gemini 3.7 Flash (67.8), and xAI/Grok 4.6 (65.3). GPT-6 Astra (64.7) appears separately as a frontier comparison. Terminal-Bench's selection is GPT-6 Astra/Codex (58.18), Fable 5.1/Claude Code (57.88), and GLM-5.3/Claude Code (41.82). Reported uncertainty and agent/reasoning setup are retained. These measure specific systems on tasks, not whole-job automation.

[OSWorld 2.0's official results](https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json), updated 3 September, have neither Fable 5.1 nor GPT-6 Astra. OSWorld is omitted under the user's coverage condition. Reassess coverage and the specific results licence before adding it.

`scripts/import_work_benchmarks.py` imports original publisher pages. Missing APEX licence declarations, changed task counts, missing Terminal-Bench 4.0 data, absent required frontier models or invalid scores stop the import before replacing the previous file. The workflow refreshes on Mondays/manual runs. Future benchmark revisions require review.

## Global money

**15 consecutive complete months, May 2025–July 2026.** All stocks refer to the same month:

- US: FRED M2SL, seasonally adjusted USD billions.
- Euro area: ECB `BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E`, EUR millions converted to trillions.
- Japan: BOJ `MD02.MAM1NAM2M2MO`, monthly average M2, JPY 100 millions converted to trillions.
- UK: BoE `LPMAUYN`, seasonally adjusted M4, GBP millions converted to billions. Published observations replace missing/derived values; no M4ex substitution.
- China: reviewed PBoC monthly stocks. Missing June 2025, RMB330.29T, comes from the [Chinese government's PBoC statistics release](https://english.www.gov.cn/archive/statistics/202507/14/content_WS6874b9d2c6d0868f4e8f4228.html).
- FX: FRED monthly averages `EXUSEU`, `EXUSUK`, `EXCHUS`, `EXJPUS`. Fixed FX uses the latest complete month's rates.

Latest total: USD106.864427T; July-on-July growth: 7.643104% headline and 6.065693% fixed FX. The UI computes both directly from matching chart observations rather than stale `macro.json` calculations. Complete aligned rows are protected against mixed-month refreshes and daily-FX snapshot overwrites. `scripts/backfill_global_money.py` reconstitutes complete months after the existing macro/history jobs without interpolation. China remains reviewed input.

## Central-bank gold demand

**16 consecutive quarters, Q3 2022–Q2 2026**, from the public data behind [WGC's Q2 2026 central-bank chart](https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026/central-banks), [chart data](https://fsapi.gold.org/api/v12/charts/js/gdt-q2-2026-pmiac/3430). One publication vintage includes historical revisions. Future Q3/Q4 2026 zero placeholders are excluded.

Q1 2026 is 56.52t; Q2 is 288.86t; trailing four quarters total 779.82t. This includes reported and estimated unreported demand by central banks and other institutions, not simply changes in reported reserves.

Only the requested four-year, single-sector extract is reproduced for research commentary with credit to World Gold Council, Metals Focus and Refinitiv GFMS. WGC's disclaimer permits limited statistical extracts for review/commentary with attribution; it does not permit unrestricted workbook redistribution. Quarterly updates remain reviewed.

## Spot Bitcoin ETF flows

**56 consecutive weeks, 8 August 2025–28 August 2026.** The 43 earlier weeks through 29 May 2026 are in `data/etf_flows_archive.json`; the subsequent 13 weeks come unchanged from liquidity-monitor. No sibling files were edited.

Historical totals sum the daily Total column in [Farside's all-data table](https://farside.co.uk/bitcoin-etf-flow-all-data/), retrieved 10 September. Fund-column sums were checked against daily totals allowing rounding. Every trading day is required. Absent full-market holidays are marked `market_closed` using the [NYSE calendar](https://www.nyse.com/trade/hours-calendars), not invented zero-flow observations. Daily inputs remain in the historical archive. Available overlapping weeks agree with the canonical totals.

The sync mapper joins only archive dates before its closed cutoff and the first canonical week. The archive cannot overwrite or append ongoing weeks. Liquidity-monitor remains the sole ongoing writer. Latest observation remains 28 August; its age is visible.

## Validation

The numerical and data-import regression suites cover the backfills, complete-window calculations and source protections. Service-worker tests check sibling-cache isolation, request scope, offline misses and storage failures. The current shell cache is v83. The local preview uses port 8081. Browser interaction and screenshot QA have not been performed.

Debt/GDP was refreshed directly from FRED on 10 September: its latest returned observation remains Q1 2026 at 122.59387%. FRED encodes the quarter as January 1. The dashboard labels it Q1 2026 and shows the retrieval date separately; age checks for quarterly series use the end of the reporting quarter rather than its first day.

## Professional-work context and ECI pace

The primary benchmark explanation is **success on benchmark tasks**, with successful attempts normalized to 100 and completion requirements explained before model rankings. The proposed human-time comparison was withdrawn after user review: pairing an AI success percentage with a human duration does not establish relative performance. APEX's original 82-minute average and Terminal-Bench's selected author estimates remain research context here, but are removed from the benchmark cards. Those cards make no human-performance, speed or hours-saved claim.

Further inspection of Terminal-Bench v4.0 metadata found author-supplied `expert_time_estimate_hours`: [medical claims processing](https://github.com/harbor-framework/terminal-bench/blob/v4.0.0/tasks/medical-claims-processing/task.toml) = 2 hours; [payments pipeline repair](https://github.com/harbor-framework/terminal-bench/blob/v4.0.0/tasks/payments-pipeline-fix/task.toml) = 2 hours; [production planning](https://github.com/harbor-framework/terminal-bench/blob/v4.0.0/tasks/production-planning/task.toml) = 4 hours. These are selected author estimates, not a measured human average, a representative difficulty distribution or evidence that the displayed models solved these particular tasks. Task prompts, solutions and environment files are not copied into the repository.

**Duration-weighted coverage remains uncomputed.** It requires each current-version task's AI success probability joined to its expert-duration estimate, then `sum(success_probability × expert_hours) / sum(expert_hours)`. The aggregate leaderboard alone cannot supply that join. Terminal-Bench's metadata establishes that useful timing inputs exist, but a complete matched outcomes/timing dataset has not been established in this investigation. The [APEX dataset card](https://huggingface.co/datasets/mercor/apex-agents) describes duration metadata but still lists 480 tasks, while the current leaderboard is v1.1 with 240 tasks. Its files are gated and its card restricts automated dataset processing; no gated files were accessed or downloaded. A current matched, permitted extract would be needed before adding a weighted APEX measure. No estimated hours-saved statistic is published.

The benchmark section expresses each model's score as task success, with the leader also shown as rounded successes per 100 attempts. These are normalized rates, not an additional 100-task experiment. No measured human 100% line is invented.

The [original APEX paper, section 3.5](https://arxiv.org/html/2601.14242v1#S3.SS5) reports independent experts completing 96 tasks with a mean time of 1.37 hours (about 82 minutes). This is a January 2026 study, preceding APEX-Agents 1.1; it is contextual evidence about professional work, not a directly matched current-version human score or a labour-hours conversion. [Mercor's v1.1 revision](https://www.mercor.com/blog/introducing-apex-agents-1-1/) describes the revised 240-task set and rubric evaluation.

[Terminal-Bench's original task format](https://www.tbench.ai/news/announcement) includes human-verified solutions. [Its v4.0 release](https://www.tbench.ai/news/terminal-bench-4-0) supplies an eight-hour agent allowance, not measured human completion time. Neither current benchmark has a published matched professional pass rate in the sources reviewed.

ECI uses a linear latent capability scale, not a logarithmic score or an IQ scale. [Epoch's FAQ](https://epoch.ai/data/eci-documentation/faq) notes that at launch, roughly five ECI points corresponded to a doubling of METR human-expert task duration. This empirical relationship is historical and task-specific. [The methodology](https://epoch.ai/data/eci-documentation/methodology) uses a logistic response with a benchmark-specific slope; it does not establish a universal intelligence multiplier.

The app computes the best score available at each release date and uses steps for the frontier. Same-day releases collapse to their highest result. The main explanatory block now uses one three-year annualized point gain, alongside its human-task interpretation. Its window is 3 September 2023–3 September 2026: starting frontier 125.88 (GPT-4's 14 March 2023 release, still the best available at the window start), ending frontier 166.57, gain 40.69 points, divided by three = **13.5633 ECI points/year**. This is an absolute gain, not percentage CAGR. The calculation requires an observation at or before the start date; it returns missing if the full window is unavailable.

Prior calendar-year calculations are retained here as research context; their individual UI cards and the separate historical-model cards have been removed. Calendar changes use December 31 boundaries in the current export's fit:

| Period | Observed frontier gain | Pace |
|---|---:|---:|
| 2024 | 15.99 points | 15.99 points/year |
| 2025 | 13.47 points | 13.47 points/year |
| 2026 through September 3 | 11.23 points | 16.66 points/year annualized |

The trailing 12-month gain is 16.57 points. Year-to-date annualization uses elapsed days in the calendar year through the latest exported release; it is not a forecast. Scores can be revised by future Epoch fits. Current model-score whiskers are Epoch's 90% intervals, not uncertainty bands on our calculated annual gains.

The gold buying overlay is a trailing four-quarter simple moving average in tonnes per quarter. It needs four consecutive observations, so the four-year extract's average starts in Q2 2023. Latest average: 194.955 tonnes/quarter, distinct from the trailing-year total of 779.82 tonnes. No early partial-window values or forward extrapolation are drawn.

## Human-duration scale on ECI

Checked 10 September 2026. ECI now leads the technology section, followed by Benchmarks; EBR is removed from the interface. The chart uses a linear left ECI axis and an independently scaled logarithmic right axis in expert-minutes. A separate estimated expert-time frontier is calculated from ECI; it is not independent evidence of performance. ECI points retain their real coordinates and 90% uncertainty intervals. The derived time line has no borrowed ECI uncertainty bars.

Source: [METR's current TH1.1 export](https://metr.org/assets/benchmark_results_1_1.yaml), benchmark `METR-Horizon-v1.1`, task version `799cc9c4b4483a93fc3445623a49ea1bd74fdeb2`. The retrieved-file SHA-256, agent scaffolds, release dates and exact figures are retained in `data/metr_context.json`. The [live chart](https://metr.org/time-horizons/) labels its intervals as 95% CI in its published chart configuration. These current results supersede figures in the January release article.

Seventeen matches require the same model name and release date in the local Epoch export. This does not equate the two providers' evaluation scaffolds. Selected examples:

| Model release | ECI | METR 50% horizon, expert-minutes | Published 95% interval, minutes |
|---|---:|---:|---:|
| Claude 3.5 Sonnet · June 2024 | 130.00 | 11.40 | 5.49–22.38 |
| Claude 3.7 Sonnet · February 2025 | 141.17 | 60.39 | 33.01–104.23 |
| GPT-5 · August 2025 | 150.00 | 203.01 | 112.64–405.55 |
| Claude Opus 4.6 · February 2026 | 155.34 | 718.81 | 316.69–3633.79 |

Our conversion is `minutes = 60.388937 × 2^((ECI − 141.17) / 5)`, using [Epoch's historical five-point interpretation](https://epoch.ai/data/eci-documentation/faq) and the Sonnet 3.7 anchor. It is not a fitted METR model or a universal conversion. Across the 17 checked releases, measured/illustrated duration ratios run from 0.43 to 1.67. Short dashes identify the time curve within the matched ECI range, 125.88–156.86; longer dashes distinguish the **unvalidated extrapolation** beyond it. Early ECI values below the checked range receive no time estimate. Current right-axis ticks span 5 minutes to 64 hours and expand if needed. The outputs are 34.0438 hours for Astra at ECI 166.57 and 24.6467 hours for Fable 5.1 at ECI 164.24. Both exceed METR's stated 16-hour reliability ceiling for its current suite.

ECI frontier-line tooltips resolve the underlying model and release date using the same lookup as individual dots, retaining published METR measurements and their separate 95% intervals. The estimated-time series always shows the rule's calculation, never substituting a published measurement into that curve. Each series has its own units and vertical coordinates in drawing, pointer selection and tooltips. The summary shows the latest estimated task length and the three-year 13.5633 ECI-points/year pace. Applying five points per doubling to that historical rate gives about 4.4 months per task-time doubling; this is an illustration, not a forecast.

Refresh with `python scripts/import_metr_context.py` after importing Epoch; `--source` accepts a saved METR YAML. Import fails before replacing data if model matching, source structure or intervals are invalid. If an Epoch refit changes a checked score before recalibration, the UI hides the estimated time curve and its axis while retaining the independent METR facts.

The comparison expresses task difficulty for software, ML and cybersecurity, not AI runtime or whole-job equivalence. Reuse is limited to attributed numerical facts and original calculations; no METR chart, code, task content or blanket data licence is reproduced or inferred.
