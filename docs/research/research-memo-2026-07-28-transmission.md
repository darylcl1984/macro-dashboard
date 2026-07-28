# Research / design memo — Transmission layer

**As-of:** 28 Jul 2026  
**Path A · Project 2** (after Projects 1 + 3 findings)  
**Constraint:** No fifth pillar; research terminal only.

---

## 1. Problem

The desk currently tells **two related but misaligned stories**:

| Surface | What it measures |
|---------|------------------|
| Thesis / `m2_note` | BTC vs **global M2**, ~10–12w lag historically; broke mid-2025 |
| Bitcoin strip chips | **US M2 MoM direction vs BTC monthly** (12 pairs) |
| Divergence clock | **Manual** `divergence.start` (2025-07) → 18 mo invalidation |
| Money pillar | US **net liquidity** (Fed − RRP − TGA) as short-horizon complement |
| ETF cell | Weekly **spot ETF** net (Farside) — true post-2024 short-run pipe |

Users can read “lag vs money growth” as global while chips are US-only.

---

## 2. Findings from stress-test (P1) + M2 audit (P3)

1. **M2 is still expanding** (headline +9.4%, fixed-FX +6.5%) while BTC is ~−50% from ATH → transmission problem is real.  
2. **ETF pipe** is re-accelerating in spots (mid-Jul multi-day inflows; weekly still small) — necessary but **not sufficient** for lag reset.  
3. **Absorption** (energy premium, real rates, hawkish Fed, firm broad $) is a valid *why the print doesn’t hit risk* story — not a reason to stop the 18‑month clock.  
4. **Global M2 history** is thin and flag-heavy → **do not auto-compute a Global lag series** until Project 3 vintage/scope gates exist.  
5. US M2 vs BTC monthly strip remains a **honest, available** diagnostic — if **labeled correctly**.

---

## 3. Recommended architecture (single story)

```
DESTINATION (multi-year)
  Global M2 (headline + fixed-FX)     ← thesis output / invalidation YoY<0

SHORT-RUN PIPES (path)
  1. Spot BTC ETF flows               ← dominant post-2024 institutional pipe
  2. US net liquidity + real rates/$  ← plumbing / policy headwind
  3. Energy / CPI absorption          ← optional footnote (why real balances lag)

BRIDGE DIAGNOSTIC (desk chip)
  US M2 MoM vs BTC MoM (12 mo)        ← label explicitly; not “global lag”

INVALIDATION CLOCK
  Manual divergence.start → 18 months ← keep manual until auto rule proven
  Reset only when: ETF + liquidity direction agree for N months (TBD rule)
```

### UI (minimal — if implement later)

| Location | Change |
|----------|--------|
| Bitcoin strip | Rename transmission label to **“US M2 vs BTC (monthly)”** |
| Lag cell meta | One line: “Global M2 destination · ETF = short-run pipe” |
| Money pillar | Keep net liq; optional cross-link text only |
| Thesis / m2_note | Align § to this diagram; drop implying chips = global lag |
| **No** new pillar |

### Reset rule (propose; do not code yet)

**Provisional:** Reset `divergence.start` only when **both**:

1. Rolling 3 months US M2 MoM and BTC MoM **same sign**, **and**  
2. Spot ETF **net positive** over the same 3 months (or 12 of last 16 weeks — pick one in implement phase).

Until then: clock runs.

---

## 4. Research answers (condensed)

| Question | Answer |
|----------|--------|
| Operational “out of sync”? | Desk today = MoM **direction** disagree count; keep as diagnostic. Invalidation stays **time since break**, not corr threshold. |
| Auto clock from data? | **Not yet** — history/Global lag weak; false resets worse than manual. |
| ETF source? | Farside is fine for manual weekly; ToS = public table scrape/careful agent. |
| Rates / $ role? | **Headwind layer** under B; blocks pipe even when M2↑. |
| Energy absorption? | **Footnote**, co-equal with rates — not a separate invalidation. |

---

## 5. File touch list (when implementing)

- `docs/thesis.md` — transmission subsection  
- `docs/m2_note.md` — §5 rewrite to match diagram  
- `src/app.js` — labels/meta only (first ship)  
- `data/manual.json` — optional `divergence.reset_rule` note string  
- **Not:** new JSON time series of Global lag until M2 audit code lands  

## 6. Will not do

- Fifth pillar “Transmission”  
- ML / correlation dashboard  
- Claiming global lag in UI while computing US chips  
- Resetting clock on a single green ETF week (P1)  

---

## 7. Approval needed before code

- [ ] Accept architecture diagram above  
- [ ] Accept “labels-only” first UI ship  
- [ ] Defer auto clock  
- [ ] Optional: draft exact 3-month reset rule text for `manual.divergence.note`
