# Design Contract — Institutional Research Terminal

**Status:** Active (visual overhaul 2026-07-27)  
**Scope:** Look & feel only. No product/domain feature changes.

## Mood

Institutional / research terminal. Dark-first. Quiet confidence: hierarchy and data do the work; decoration is sparse. Not consumer fintech candy, not neo-brutal, not glassmorphism.

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
| Section kickers | 10px, uppercase, tracking ~0.1em, tertiary |
| Panel titles | ~15px, semibold, slight negative tracking |
| Big KPIs | mono, tabular-nums, 16–22px (hero up to ~28px) |
| Numerics | `font-variant-numeric: tabular-nums` on dashboards |

## Shape & chrome

- Radius **2–4px** (almost rectangular)
- 1px hairlines; **no heavy drop shadows**
- Desks: surface fill + optional subtle diagonal accent wash (~5–6% opacity)
- Optional **3px left accent rail** on key desks (scenario / important panels)
- Alarm: rare whole-panel border + soft outer glow (amber/coral)

## Layout patterns

1. **Page header** — title, one-line subtitle, sticky mono status chips  
2. **Section kickers** — uppercase micro labels between major areas  
3. **Desk / panel** — titled block, body, optional KPI / mini-card strip  
4. **KPI / mini-card** — mono label · value · meta line  
5. **Content blocks** — tables, range bars, progress clocks with explicit labels  
6. **Grids** — 2-column pillars ≥900px; collapse cleanly below  

Spacing: section gaps ~28–36px, panel padding ~14–18px. Max width **~1360px**, centered.

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
| Status bar (sticky KPI) | done | **polished** | Equal flex cells, blur, M2 sub-row, inset rail |
| Page header + kickers | done | **polished** | Kicker eyebrow; section-block pairing |
| Pillar desks (4) | done | **polished** | Hero label; desk-block frames; denser KPIs |
| Range / FG / div bars | done | **polished** | Unified track geometry; class-based dots; band ticks |
| Trigger board | done | **polished** | Status cell; rare alarm glow from tally |
| Thesis collapsibles | done | **polished** | Quieter ring; title-aligned summaries |
| Footer | done | **polished** | Meta row demotion |
| app.js hardcodes | done | done | tone/fill classes throughout |
| PWA theme + SW cache | done | **v7** | Shell cache bump |
| Consistency | done | **pass 2** | Density + hierarchy craft |

## Files of record

- `src/styles.css` — sole token + component system  
- `src/index.html` — shell structure  
- `src/app.js` — generated markup (colors via CSS vars/classes)  
- `src/manifest.json`, `src/sw.js` — PWA chrome / cache version  
