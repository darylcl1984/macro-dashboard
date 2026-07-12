# TASK-04 — Polish, Changelog, Final QA

## Goal

The overhaul is release-clean: caches bust correctly, repo hygiene issues are fixed, the changelog documents the transition, and a full QA pass confirms every acceptance criterion from tasks 01–03 still holds together.

## Requirements

1. **Service worker:** bump the cache version/name in `src/sw.js` so returning PWA clients fetch the new app.js/styles.css/index.html. Verify the SW pre-cache list matches the actual file set (no removed assets referenced).
2. **Repo hygiene:** delete `scripts/__pycache__/` from the repo and add `__pycache__/` to a `.gitignore` (create if absent).
3. **`CHANGELOG.md`:** add an entry at the top, dated, titled "v6 — The Great Transition overhaul". Summarize: thesis v6 + M2 note v2 (knowledge layer, already committed); equities/Finnhub purged; gold/WTI price fix; new sources (ECB, BoE, HY OAS, net liquidity, FX); computed M2 composite + history; new manual.json schema; pillar-based frontend; 8-trigger auto-computed board. Follow the file's existing entry format.
4. **Workflows sanity:** both Actions workflows lint (`actionlint` if available, otherwise careful read): no dangling secrets (FINNHUB gone), cron cadences unchanged, commit-message conventions (`[skip ci]`) preserved.
5. **Screenshots:** regenerate `docs/macro-dashboard-screenshot01.png` / `02.png` from the rebuilt dashboard at desktop width (01: status bar + pillar panels; 02: trigger board + expanded thesis). If you cannot capture screenshots in your environment, flag it in the commit message so the owner does it — do not leave stale screenshots silently.
6. **Full QA pass (record results in the commit message):**
   - [ ] `python scripts/fetch_prices.py && python scripts/fetch_macro.py` both green with and without `FRED_API_KEY`.
   - [ ] Fresh clone → local serve → no console errors, all panels populated or gracefully degraded.
   - [ ] Trigger tally = expected fixture (4 green · 4 amber · 0 red as of July 2026 data, or explainably different if data moved).
   - [ ] Mobile (375px), desktop (1280px), and one mid width (768px) all clean.
   - [ ] Offline reload works (service worker serves cached shell).
   - [ ] `grep -ri "finnhub\|NVDA\|TSLA\|PLTR\|GOOGL\|META\|MSTR\|GEV\|TSM" scripts/ src/ data/ .github/` → no hits.
   - [ ] All four data JSON files valid (`python -m json.tool` each).

## Acceptance criteria

- [ ] All QA boxes above checked and recorded.
- [ ] CHANGELOG entry present and accurate.
- [ ] SW cache bumped; stale-cache reload test performed (load old version, deploy, reload twice, new UI appears).
- [ ] No `__pycache__` in git.
