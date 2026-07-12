# Outsourced Coding Tasks — The Great Transition Overhaul

Read this file completely before starting any task. These tasks convert the dashboard from a portfolio-watchlist layout to a thesis-pillar layout. The knowledge work (thesis v6, M2 note v2, README, trigger definitions) is already done — your job is implementation only.

## Order and independence

Execute in order. Each task must leave the dashboard **fully working on its own** — commit per task, verify before moving on.

1. `TASK-01` — Purge equities, fix broken gold/WTI prices. (Removal + bugfix; ships alone safely.)
2. `TASK-02` — Macro data pipeline: new sources, computed M2 composite, new manual.json.
3. `TASK-03` — Frontend rebuild: four pillar panels + auto-computed trigger board.
4. `TASK-04` — Polish, CHANGELOG, service-worker bump, final QA.

## Hard guardrails

- **No new dependencies.** Python side: `requests` only. Frontend: vanilla JS, no frameworks, no bundler, no build step. The PWA must keep working as static files.
- **Do not edit** `docs/thesis.md`, `docs/m2_note.md`, `docs/research/*`, or `README.md` — these are owned by the knowledge layer. (Exception: TASK-04 touches `CHANGELOG.md` only.)
- **Do not change** the two-file data contract (`data/prices.json`, `data/macro.json` written by scripts; `data/manual.json` hand-edited; frontend reads all three plus `data/alerts.json`) beyond what the tasks specify.
- **Preserve the failure-isolation pattern** in both fetch scripts: a failed source must never wipe previously good values (see the seed-from-existing logic in `fetch_macro.py:main`) and must never crash the whole run (per-source try/except with `[WARN]` prints).
- Keep the existing visual language: dark theme, the existing CSS variable palette in `src/styles.css`, panel/table conventions. Polish is welcome; a redesign of the aesthetic is not.
- Match existing code style (module-level functions, section-divider comments, no classes).

## Environment & verification

- Python 3.13, Windows or POSIX. `pip install requests`.
- `FRED_API_KEY` env var needed for FRED calls (scripts must degrade gracefully without it — warn and skip, as now).
- Verify scripts: `python scripts/fetch_prices.py` and `python scripts/fetch_macro.py` run clean, then inspect the JSON they write.
- Verify frontend: `cd src && python -m http.server 8080`, open http://localhost:8080, check the browser console for errors, test at 375px and 1280px widths.
- The markdown renderer in `app.js` (`mdToHtml`) is a minimal regex converter — if you touch it, it must keep supporting: `#`/`##`/`###` headings, `**bold**`, `*em*`, `>` blockquotes, `- ` lists, and pipe tables. `docs/thesis.md` v6 is the test document; render it and eyeball every section.

## Each task file contains

**Goal** (what exists after) · **Context** (what you need to know) · **Requirements** (numbered, testable) · **Acceptance criteria** (checklist — all boxes must pass before commit).

If something in a task contradicts reality (an API shape changed, a series key is wrong), fix the implementation to meet the *goal* and note the deviation in your commit message — do not silently skip requirements.
