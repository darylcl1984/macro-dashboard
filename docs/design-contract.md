# Design contract — three research desks

Updated 10 September 2026 for the user-authorized redesign. This supersedes the previous path-book and watchpoint layout.

## Structure

1. Technological deflation — capability trajectory followed by professional-task benchmarks.
2. Fiscal dominance — debt, money and dollar rails.
3. Hard-money monetization — prices and capital flows.

Each section is a visible enclosure: a surface, a numbered heading, a thin accent border and breathing room around it. Charts sit in darker wells inside that enclosure. Do not return to an undifferentiated grid of cards.

The September 10 aesthetics pass places the masthead above the sticky research index. Use the mint title accent and three-bar research mark to connect visually with liquidity-monitor. The framework strip contains three matching, fully bordered node boxes with darker surfaces and directional arrows between them. Keep diagonal link arrows out of the nodes; subject colour appears in role labels and hover/focus borders. Section numbers are unboxed, with fine dividers; reserve stronger colour for data series and small subject accents.

A compact Structural thesis strip precedes the charts. Its clickable nodes follow the proposed mechanism: technological deflation → fiscal dominance → hard-money monetization. Connections name pressure to sustain nominal incomes, followed by monetary expansion and reserve diversification. Technology is labelled as an accelerant. The strip, section order and numbered navigation all follow this same sequence. It carries no inferred live status or causal scoring.

The approved subtitle beneath The Great Transition is: “Technology accelerates a monetary transition already shaped by debt, fiscal commitments and reserve diversification.”

Fiscal layout: full-width US M2, global broad money, and Treasury yields, followed by equal-width debt/GDP and dollar-rails cards. Hard money uses two full-width asset sections: Gold first, with price and central-bank demand side by side; Bitcoin second, with price and ETF flows side by side. Each pair shares a full-width asset heading, with spacing and a fine divider between asset sections. Below 760px, each pair stacks price first, then demand or flows, beneath its asset heading. Keep asset groups free of extra enclosing borders and tinted backgrounds: neutral asset titles and small symbol tiles provide identification. Fear & Greed is a compact, read-only neutral segmented meter with a coloured position marker.

Chart values appear in floating tooltips on pointer, touch or keyboard inspection, with explicit units. Keep the headline observation above the chart. Quarterly observations use quarter labels, and publication/retrieval dates remain distinct from reporting periods. The public methodology link opens `src/methodology.html`, a styled reading page.

Full-width M2, Treasury and ECI charts use calendar-aligned year ticks, four-digit labels, explicit start/end months and responsive label spacing. Vertical scales use rounded increments with currency/percentage units where applicable. ECI remains a linear points scale, and its bounds include the published confidence intervals.

## Visual family

Use liquidity-monitor's current palette and IBM Plex typography as the family reference. The products keep separate scopes.

| Role | Dark | Light |
|---|---|---|
| Canvas | `#0c151b` | `#edf0eb` |
| Section surface | `#15232d` | `#fcfdf9` |
| Chart well | `#101c24` | `#f5f7f2` |
| Primary text | `#eef3f1` | `#1b3338` |
| Fiscal accent | `#9bd8ca` | `#276e60` |
| Hard-money accent | `#dfc578` | `#866510` |
| Technology accent | `#beb1e6` | `#7055a0` |

Colours identify subject matter; they do not signal a trade or a favourable outcome. Negative flows use the negative-series token.

- IBM Plex Sans for language, IBM Plex Mono with tabular numerals for measurements.
- Maximum page width 1440px; 48px desktop gutters, reduced on smaller screens.
- Section radius 16px, chart-well radius 10px; restrained shadows on the outer surfaces.
- Section titles 23–29px, primary values about 32px, chart titles 16px. Hard-money readings use quieter 24px secondary-text values, with equal sizing for quarterly purchases and the four-quarter average. Key readings sit on softly inset measurement strips; labels and source notes are generally 12px, with 14px explanatory text. Debt/GDP and central-bank purchase reporting quarters belong in the source/date notes, rather than adding a caption beneath only one paired reading.
- Use translucent neutral borders, stronger dividers sparingly, and separate quiet grid-line tokens in both themes.
- Sticky section navigation with numbered links and an accessible current-location state.
- Two-column charts collapse at 760px; yearly ECI cells stack on narrow screens.
- Retain a usable light theme, visible keyboard focus and reduced-motion support.

## Data hierarchy

Lead with the observation and its unit. Follow with context, the chart, its date/source, and a compact method disclosure where needed.

Benchmark task-success bars are on a 0–100% task scale. A professional reference must distinguish measured human results from task acceptance criteria. Never invent a human ECI score or treat a benchmark percentage as the fraction of a whole job automated.

Yearly ECI cards distinguish completed calendar years from year-to-date gains and annualization. Frontier lines are steps: new capability appears at a release date. Moving averages require complete windows; they must not extend into dates without enough history.

Keep missing data, old observations, instrument proxies and source revisions visible. Method details belong near their chart, not in a separate warning-heavy product flow.

## Implementation

Vanilla HTML/CSS/JS; CSS variables; no bundler or added UI framework. Isolate service-worker storage from sibling dashboards. Serve from the repository root. For frontend releases, bump the shell cache and the matching `?v=` references in both HTML pages and the app/chart module imports together. The worker precaches those exact versioned URLs, bypasses the HTTP cache at installation and revalidates network requests. The shell tests enforce version consistency and offline coverage. No commit or publication without the user's instruction.
