# Research Memo — Thesis stress-test & re-score

**As-of cut:** 28 Jul 2026 (desk data through ~27 Jul)  
**Path A · Project 1**  
**Not financial advice.** Judgment for the research terminal only.

---

## 1. Scope

Test whether the **B 40% base case** and book **A 30 / B 40 / C 20 / D 10** still hold under late-July conditions, and whether amber watchpoints remain correctly graded.

**Sources of truth compared:** `docs/thesis.md`, `data/manual.json`, live `data/macro.json` + `data/prices.json`, public prints (Fed path, COFER Q1 brief, WGC Q1, Farside ETF, Epoch AI cash).

---

## 2. Desk snapshot (cut)

| Series | Value |
|--------|--------|
| Global M2 | **$106.78T** (May-2026 vintage composite) |
| Headline / fixed-FX YoY | **+9.41%** / **+6.45%** (May-25 → May-26) |
| US M2 YoY | **+5.6%** (from +4.7%) |
| US 10Y / broad $ | **4.67%** / **120.53** |
| HY OAS | **2.68%** |
| F&G | **28 Fear** (24 Jul) — not Extreme Fear |
| BTC | ~**$64.1k** live · week **$65.2k** · 52w low **~$57.7k** |
| Gold | Live **~$4,056** · June close **$4,015.51** |
| WTI (desk JSON) | **~$90.5** (market prints mid/late Jul also ~**$82–86** — use range; still **≪ $120**) |
| Net liq | **~$5.92T** (23 Jul) |
| ETF | Week 20–24 Jul **+$33.9M**; mid-Jul multi-day inflow streak reported; cum **~$51.4B** since launch |
| AI cash (Epoch) | Q1 gap **+$9.5B**; trend cross **~Q3 2026** |
| COFER | **57.13%** USD, **1** rising quarter (Q1 2026) — **no Q2 brief yet** (Jul 1 brief is Q1) |
| CB gold | WGC Q1 **244t** (+3% YoY); floor **>200t/q** intact |

---

## 3. Watchpoint adjudication

| # | Watchpoint | Desk status | Verdict | Notes |
|---|------------|-------------|---------|--------|
| 1 | Global M2 YoY &lt; 0% | Green | **Hold green** | Headline +9.4%; fixed-FX +6.5%. Invalidation uses **headline**. |
| 2 | COFER 4 rising Qs | Amber | **Hold amber** | Still **one** counter-trend Q. Half of rise FX valuation (IMF brief). |
| 3 | Gold monthly &lt; $4k | Amber | **Hold amber** | June close $15 above line; live still near floor. |
| 4 | BTC weekly &lt; $53k | Amber | **Hold amber** | Week ~$65k; cycle low ~$58k; structural floor not broken. |
| 5 | BTC–M2 ≥ 18 mo | Amber | **Hold amber** | ~**12 mo** since `2025-07`. ETF inflows returning ≠ lag reset. |
| 6 | AI OAS&gt;5% + cuts | Green | **Hold green** | OAS 2.7%; `capex_cuts: false`; cash gap thin not crossed. |
| 7 | Oil &gt;$120 × 4w | Green | **Hold green** | ~$82–90 region; **not** shock line. Energy is **path headwind**, not D-fire. |

**Tally:** still **4 amber / 0 red** — maximum documented stress without invalidation. Matches thesis honesty clause.

---

## 4. Scenario book re-score

| ID | Name | Prior p | Proposal | Rationale |
|----|------|--------:|----------|-----------|
| **A** | Liquidity relink | 30 | **Hold 30** (soft: watch) | Mid-Jul ETF inflow streak + F&G off historic lows help A *path*, but Warsh hike risk (~⅓ July meeting chatter) + lag clock not reset → not enough to lift weight. |
| **B** | Hawkish grind | 40 | **Hold 40 base** | Funds 3.50–3.75%; dots still hike-skewed; markets price hold as base but path stays tight; M2 expands under hawkish talk — core B story intact. |
| **C** | Credit scare | 20 | **Hold 20** | OAS calm; no capex cuts; Epoch cross still ahead (Aug earnings). Do **not** pre-load C. |
| **D** | Geo shock | 10 | **Hold 10** | Oil off war peaks / MoU era; not &gt;$100 sustained. Keep as tail. |

### Book decision

**No probability change recommended at this cut.**

**Soft text updates recommended (manual/thesis notes only):**

1. **next_check:** FOMC (Jul 28–29 outcome) · hyperscaler earnings early Aug · weekly BTC vs $53k · oil if re-spikes toward $100.  
2. **rescore_if A:** “ETF multi-week inflows *and* lag cools” (inflows alone insufficient).  
3. **regime bullets:** Optional note that **energy premium + real rates** can absorb M2 away from risk (colour, not new trigger).  
4. **china_m2 source line:** still says “June due ~14 Jul” — **stale**; refresh when PBoC print ingested.

---

## 5. Open research flags (not blockers)

- **WTI desk vs market:** prices.json ~$90 vs some Jul 27 futures prints ~$82 — refresh pipeline before oil narrative hardens.  
- **COFER Q2:** not published as of this memo; consecutive_rising stays 1.  
- **Divergence start `2025-07`:** keep until a formal reset rule exists (Project 2).  
- **Historic F&G ~5 near $60k (Feb):** supports “washout already printed”; does **not** by itself upgrade A.

---

## 6. Downstream for Path A

| Feeds | How |
|-------|-----|
| **Project 2** | Transmission: ETF short-run pipe re-accelerating in spots; absorption (energy/rates) explains M2↑ without BTC↑; US strip ≠ Global lag. |
| **Project 3** | Stress-test **depends** on headline/FX dual YoY being trustworthy — audit next. |
| **Project 4** | Pack must pull Farside weekly, COFER/WGC quarterly, Epoch quarterly, China monthly, FOMC calendar for next_check. |

---

## 7. Explicit non-actions

- No change to $53k / $4k / 18-month / $120 lines.  
- No interactive scoring.  
- No portfolio language.  
- Do not mark lag “reset” on one green ETF week.
