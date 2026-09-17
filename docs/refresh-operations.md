# Dashboard refresh operations

The unified workflow in `.github/workflows/refresh-dashboard.yml` replaces the former macro and price workflows. It covers the current app's automated inputs and runs from the repository's default branch.

## Schedule and ownership

| Run | Data |
|---|---|
| Daily, 08:05 / 12:05 / 17:05 / 21:05 UTC | Gold and Bitcoin history, USD stablecoins and Fear & Greed |
| Daily, 08:05 UTC | Regional macro indicators, US money/debt/yields, complete global-money baskets and ETF synchronization |
| Monday, 08:05 UTC | Epoch ECI, followed by METR recalibration, and the original-publisher work benchmarks |
| Actions → Refresh dashboard data → Run workflow | Full refresh of all automated inputs |

Requirements: Actions enabled, repository contents-write permission, and `FRED_API_KEY` in Actions secrets. ETF synchronization additionally needs one of these macro-dashboard Actions secrets:

- `LIQUIDITY_MONITOR_READ_SSH_KEY`: the private half of a dedicated, read-only deploy key registered on liquidity-monitor. It grants access only to that repository. Do not enable write access. This is preferred when both repositories are managed together; it does not expire automatically, so revoke or rotate it when no longer needed.
- `LIQUIDITY_MONITOR_READ_TOKEN`: a fine-grained token restricted to liquidity-monitor with Contents read-only permission. The token remains supported as an alternative.

The SSH key takes precedence when both are configured. Store credentials only in Actions secrets, never in source files or chat. The default `GITHUB_TOKEN` cannot read another private repository. If neither secret exists, the job fails with a specific ETF-access error and retains existing ETF data while other updates proceed. See [GitHub's deploy-key documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

The job runs only on the default branch. One concurrency group serializes scheduled data writers. Existing snapshots allow the website to work without credentials or a running backend.

ETF synchronization reads the `master` branch of `darylcl1984/liquidity-monitor` into an ignored checkout without persisting credentials. Its repository and raw ETF URL returned HTTP 404 anonymously on 10 September 2026, so a cross-repository read credential is required. Its ongoing weeks take precedence over the closed archive here. There is no second Farside scraper and no write to liquidity-monitor. If its branch or repository visibility changes, update that checkout configuration.

The failures on 15 and 16 September 2026 were caused by the missing ETF credential, not by market-data fetching or validation. Their full-refresh runs skipped ETF checkout and synchronization, then correctly failed the final report. Intraday runs do not attempt ETF synchronization, explaining why those runs succeeded.

On 17 September 2026, the dedicated read-only deploy key `macro-dashboard ETF sync (read-only)` was registered on liquidity-monitor and its private half encrypted into macro-dashboard's `LIQUIDITY_MONITOR_READ_SSH_KEY` Actions secret. To revoke access, remove that deploy key from liquidity-monitor and delete the matching Actions secret. Other deploy keys are unrelated and must be preserved.

## Failure handling

Source steps run independently so a single unavailable provider does not prevent other fetch attempts. History updates retain each failed series, record its failure, and return a failed step status. Epoch, METR and benchmark imports replace their files only after parsing and validation succeed. METR runs after Epoch so changed ECI fits can be recalibrated in the same run.

Python and JavaScript checks run before publication. Snapshot checks include every active price/macro history, benchmark scores, ETF week ordering and METR-to-ECI calibration. Validation failure prevents publication of the entire batch. Otherwise successful updates can be published even when another provider failed. The final report names failed steps in the error annotation and job summary, using their original outcome even when `continue-on-error` makes their conclusion appear successful. It never prints step outputs or credentials. GitHub notification delivery depends on the account's notification settings.

Only seven automated snapshots are staged: `dashboard_history`, `macro`, `m2_history`, `etf_flows`, `technology`, `metr_context` and `work_benchmarks`. Reviewed inputs, source archives and local files are excluded. Push conflicts use a normal rebase and fail visibly if unresolved; the workflow never force-pushes.

## Reviewed inputs

- **China M2:** update the reviewed monthly input before expecting a new complete five-bloc money basket. A refresh does not fabricate missing months.
- **Central-bank gold buying:** refresh the attributed WGC quarterly extract, including revisions. This is not an automated workbook redistribution.
- **ETF source weeks:** liquidity-monitor remains responsible for maintaining the canonical ongoing series. This workflow imports what has actually been published there.
- **Benchmark changes:** importers check versions and publication terms. A source redesign or major benchmark revision may require a reviewed importer update.

The retired files were the unused `prices.json` and `alerts.json` snapshots, their price writer and isolated test, and the two superseded workflows. Historical references in archived research are retained as provenance. Paused thesis documents and substantive research are preserved.
