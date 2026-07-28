# Research Memo — Global M2 methodology audit

**As-of:** 28 Jul 2026  
**Path A · Project 3**  
**Code SoT:** `scripts/fetch_macro.py` · `data/m2_history.json` · `data/macro.json`  
**Doc SoT (stale in places):** `docs/m2_note.md`

---

## 1. What the pipeline actually does

### Composite (five blocs → USD T)

| Bloc | Conversion |
|------|------------|
| US | M2 $B / 1000 |
| CN | `manual.china_m2` ¥T / USDCNY |
| EZ | EZ M2 €T × EURUSD |
| JP | JP M2 ¥T / USDJPY |
| UK | UK M4 £B × GBPUSD / 1000 |

Hard reject if any missing or total ∉ **[90, 125]** $T.

### Dual YoY

| Metric | Formula |
|--------|---------|
| **Headline** | `(composite_now / composite_now−12m − 1) × 100` |
| **Fixed-FX** | Revalue **year-ago local stocks** at **current** FX; then `(composite_now / revalued − 1) × 100` |

Fixed-FX answers “money creation only.” Headline answers “USD paper pool size.”

### Live pair (seeded, verified)

- Base **2025-05** → as-of **2026-05**  
- Headline **+9.41%** · fixed-FX **+6.45%**  
- Math checks under frozen history row.

---

## 2. History coverage & quality

| Item | Finding |
|------|---------|
| Rows | **12** months: 2025-05, then 2025-07…2026-05 |
| Gap | **`2025-06` missing** |
| Pre-history | None before May 2025 |
| UK quality | Heavy flags: unpublished (4‑bloc months), MoM-derived, TE-reported, 2nd-order base |
| EZ | At least one interpolated month |
| Live upsert | Does **not** currently re-write rich `flags` the way seed history does |

**Implication:** May YoY pair is usable. **Unguarded future runs** that key history by **wall-clock month** and mix **4‑bloc vs 5‑bloc** or **spot vs monthly FX** can produce non-comparable YoY.

---

## 3. Doc vs live discrepancies

| Topic | `m2_note.md` | Live desk |
|-------|--------------|-----------|
| Composite | ~**$105.5T** | **$106.78T** |
| EZ USD | ~**$17.9T** | **$19.14T** (largest drift) |
| Dual YoY numbers | Qualitative | **9.41 / 6.45** printed |
| FX table | 10 Jul spots | History uses monthly avgs / mixed |

**Priority doc fix:** refresh §2 levels + state dual YoY numbers + vintage.

---

## 4. Ranked methodology risks

1. **Period = pipeline run month**, not data vintage → wrong prior for YoY.  
2. **4‑bloc vs 5‑bloc** composites used in same headline YoY path.  
3. **Spot FX at fetch** vs **monthly-average FX** in history.  
4. **Derived UK/EZ** not surfaced on `GLOBAL_M2_YOY` as provisional.  
5. **Mixed bloc lags** (China manual, JP print lag) under a “complete month” label.  
6. **`history_ready` / “13 months”** messaging vs pair-based reality.  
7. **Stale m2_note** undermines trust.  
8. Nested **`macro.json` MANUAL** can lag `manual.json`.

---

## 5. Recommended fix program (implement later — not this memo)

### Doc-only (safe, high value)
- [ ] Rewrite `m2_note.md` §2 from May-2026 history row + dual YoY.  
- [ ] Document: invalidation = **headline YoY &lt; 0%**; always show fixed-FX beside it.  
- [ ] Document history flags and the Jun-2025 gap.  
- [ ] Publish release-lag table (US/CN/EZ/JP/UK).

### Code (after explicit approval)
- [ ] History key = **data vintage**, not `utcnow()` month.  
- [ ] YoY **scope gate** (5‑bloc vs 5‑bloc only; or explicit 4‑bloc pair).  
- [ ] Propagate `flags` / `provisional` into `GLOBAL_M2_YOY`.  
- [ ] Complete-month gate before advancing `as_of`.  
- [ ] Stop embedding stale MANUAL into macro (or always overwrite from `manual.json`).

### Data
- [ ] Optional backfill **2025-06** with method note — or permanently document gap.  
- [ ] No giant seed dumps committed if gitignore policy forbids seeds.

---

## 6. Acceptance criteria (“audit pass”)

See plan checklist; minimum for ship:

1. `m2_note` totals within rounding of live `GLOBAL_M2`.  
2. Dual YoY formulas written in doc matching code.  
3. Known regression: May-25→May-26 ≈ **+9.41 / +6.45**.  
4. Next `fetch_macro` cannot silently replace May seed with a mixed-vintage July row that breaks scope.  
5. UI continues to prefer computed headline over manual estimate when set.

---

## 7. Verdict

| Layer | Status |
|-------|--------|
| **Current displayed YoY (May pair)** | **Coherent** — safe for desk/thesis stress-test |
| **Pipeline robustness** | **At risk** on next unguarded runs |
| **Public methodology note** | **Stale** — refresh before external readers |

**Do not block Project 1 re-score on code fixes.**  
**Do block confidence in automated YoY after future fetches until vintage/scope gates land.**
