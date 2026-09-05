# Design Contract — Institutional Research Terminal

**Status:** Active (visual overhaul 2026-07-27; sibling-chrome pass 2026-08-26)  
**Scope:** Look & feel only. No product/domain feature changes.

## Mood

Institutional / research terminal. Dark-first. Quiet confidence: hierarchy and data do the work; decoration is sparse. Not consumer fintech candy, not neo-brutal, not glassmorphism.

## Sibling chrome (liquidity-monitor)

Same terminal family as liquidity-monitor: canvas `#141922`, IBM Plex, 2–4px radius, 1px hairlines, sage/amber/coral on **values**, kickers, flattened desks, KPI strips, unboxed status. Rails = command (path book) or alarm (watchpoints when broken) — not a rainbow on every theme. Nested title-strips and card-in-card wells are out.

This is **not** a product merge. Macro-dashboard keeps its IA: sticky path clock, A–D path book, four themes, watchpoints. Do not import LM causal 01–05, ticker cards, MSTR, or kill rows.

Hex values already match. Optional aliases in `:root` map LM names onto MD tokens (no rename of `--bg` / `--green` / `--red`):

| MD token | LM alias | Value |
|----------|----------|--------|
| `--bg` | `--canvas` | `#141922` |
| `--bg-elevated` | `--canvas-elev` | `#1a2030` |
| `--border` | `--line` | `rgba(210, 220, 240, 0.12)` |
| `--border-2` | `--line-strong` | `rgba(210, 220, 240, 0.18)` |
| `--text-dim` | `--text-2` | `#b0bac9` |
| `--text-muted` | `--text-3` | `#7d8999` |
| `--green` | `--sage` | `#6fbf9a` |
| `--red` | `--coral` | `#e07070` |

## Tokens (`src/styles.css` `:root`)

| Role | Token | Value |
|------|--------|--------|
| Canvas | `--bg` | `#141922` |
| Elevated | `--bg-elevated` | `#1a2030` |
| Surface | `--surface` | `#1e2533` |
| Surface-2 | `--surface-2` | `#262e3e` |
| Hairline | `--border` | `rgba(210, 220, 240, 0.12)` |
| Stronger line | `--border-2` | `rgba(210, 220, 240, 0.18)` |
| Text primary | `--text` | `#f2f5fa` |
| Text secondary | `--text-dim` | `#b0bac9` |
| Text tertiary | `--text-muted` | `#7d8999` |
| Accent | `--blue` / `--accent` | `#6b9fd4` |
| Accent wash | `--accent-wash` | `rgba(107, 159, 212, 0.12)` |
| OK / sage | `--green` | `#6fbf9a` |
| Watch / amber | `--amber` | `#d4a354` |
| Stress / coral | `--red` | `#e07070` |
| Soft washes | `--green-wash`, `--amber-wash`, `--red-wash` | ~12% alpha |

Legacy aliases (`--green-dim`, etc.) map to wash/border companions so existing class names keep working.

### Semantic usage

- **Sage** = healthy / clear / OK  
- **Amber** = watch / approaching / elevated  
- **Coral** = break / kill / hot stress  
- **Accent blue** = chrome, links, focus rings, neutral series — **not** success  

## Typography

| Role | Spec |
|------|------|
| UI | IBM Plex Sans |
| Numbers / meta / badges | IBM Plex Mono |
| Base | 13px, line-height 1.5 |
| Section kickers | 10px / 600, uppercase, tracking ~0.1em, tertiary |
| Panel titles | ~15px, semibold, slight negative tracking |
| Big KPIs | mono, tabular-nums, 16–22px (hero up to ~28px) |
| Numerics | `font-variant-numeric: tabular-nums` on dashboards |

## Shape & chrome

- Radius **2–4px** (almost rectangular)
- 1px hairlines; **no heavy drop shadows**; no glass/blur on the status lid
- Desks: surface fill, in-flow titles (no title-strip bars); inner blocks are hairlines, not nested wells
- **3px left rail** = command (path book, follows active scenario tone) or alarm (watchpoints when broken) — not a rainbow on every theme
- Alarm: thin mix border + 3px semantic rail (not a 20px glow)

## Layout patterns

1. **Sticky status strip** — four command KPIs (scenario, M2 YoY, floors, named hot watchpoint), opaque, column-aligned with `main`. Fear & Greed lives on Hard money Private.  
2. **Page header** — title, horizon, one-line subtitle (not a second LM-style nav/status grid)  
3. **Section kickers** — 10px / 600 / ~0.1em uppercase between major areas  
4. **Desk / panel** — titled slab, body, optional KPI strip  
5. **KPI strip** — mono label · value · meta in a shared elevated well with vertical hairlines  
6. **Content blocks** — tables, range bars, progress clocks with explicit labels  
7. **Grids** — top row 2-column (AI | Credit) ≥900px; Money and Hard money span full width; Hard money splits Official | Private; collapse to 1-col below 900px  

Spacing: section gaps ~28–36px, panel padding ~14–18px. Max width **~1360px**, centered. Page gutters ~18px (not LM’s 32px print margin — MD has a sticky bar).

## Interaction

- `:focus-visible` — 1px accent outline, offset ~3px  
- Links — accent; hover → primary text  
- Disclosures — chevron + show/hide labels  
- Badges/chips — mono, tiny, uppercase; tone via color  

## Do / Don’t

| Do | Don’t |
|----|--------|
| Prefer CSS variables | Invent a second brand / light mode (unless requested) |
| Elevate existing structure | New product features or IA overhauls |
| Keep G/A/R meaning consistent | Use accent blue for “success” |
| Bump SW cache on shell changes | Add MUI/Chakra/Tailwind |
| Soft effects only when meaningful | Heavy shadows, loud pills, glass spam |

## Scoreboard

| Surface | Pass 1 | Pass 2 (craft) | Notes |
|---------|--------|----------------|--------|
| Design tokens + fonts | done | done | Spacing rhythm tokens + bar chrome |
| Base body / focus / links | done | done | Selection color; reduced-motion |
| Status bar (sticky KPI) | done | **sibling** | Opaque lid, 1360 column, no glass; safe-area |
| Page header + kickers | done | **sibling** | 10px/600 kickers; in-flow titles |
| Pillar desks (4) | done | **sibling** | No rainbow rails; flattened inners; KPI strip on money lead |
| Range / FG / div bars | done | **polished** | Unified track geometry; class-based dots; band ticks |
| Watchpoints board | done | **sibling** | Alarm = thin edge + rail; status words clear/watching/broken |
| Thesis collapsibles | done | **polished** | Quieter ring; title-aligned summaries |
| Footer | done | **sibling** | Caption in the 1360 column, not an elevated band |
| app.js hardcodes | done | done | tone/fill classes throughout |
| PWA theme + SW cache | done | **v50** | Shell cache bump; viewport-fit + safe-area |
| Consistency | done | **sibling chrome** | Match LM family, not LM page |

## Files of record

- `src/styles.css` — sole token + component system  
- `src/index.html` — shell structure  
- `src/app.js` — generated markup (colors via CSS vars/classes)  
- `src/manifest.json`, `src/sw.js` — PWA chrome / cache version  
