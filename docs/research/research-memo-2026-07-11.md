# Research Memo — Phase 1 of the Great Transition Overhaul

Compiled 11 Jul 2026. Feeds thesis.md v6 and m2_note.md v2. All values as-of dates noted; volatile by default.

---

## 1. Trigger adjudication

| Trigger (v5) | Verdict | Evidence |
|---|---|---|
| Gold monthly close < $4,000 | **NOT FIRED — by $15. Status AMBER** | June 2026 monthly close $4,015.51 (goldprice.org). Intraday low $3,959 on 24 Jun. Threshold survives; moving it now would be goalpost-moving. |
| BTC weekly close < $52,000 | **NOT FIRED, but the line was mislabeled** | Cycle low ~$57.7k (30 Jun). The v5 label "ETF aggregate cost basis $52k" is wrong: actual ETF aggregate cost basis ≈ **$83,800** (holders already deeply underwater — trigger logic as stated already failed silently). $52–53k corresponds to the **network-wide aggregate realized price** (~$53k). v6 re-derivation: keep a structural-demand line at ~$53k but relabel honestly as realized price; refresh quarterly. |
| Oil > $120 sustained | GREEN | WTI ~$70, Brent ~$73. Post-MoU normalization. |
| Global M2 YoY < 0% | GREEN | Composite running ~+6–10% (see §2). |
| All equity triggers (GOOGL/META/NVDA/TSLA) | REMOVED per scope decision | Taiwan + AI-credit transplanted (see §6). |

## 2. Global M2 (5-bloc composite refresh, ~Jul 2026)

| Bloc | Latest level | As-of | FX (10 Jul) | USD |
|---|---|---|---|---|
| US | $23.05T (M2SL, FRED — local pipeline) | May 2026 | — | $23.1T |
| China | ¥353.67T, +8.6% YoY (PBoC) | May 2026 | 6.782 | **$52.2T** |
| Eurozone | ~€15.7T M2 (M3 +3.2% YoY, accelerating) | May 2026 | 1.1415 | ~$17.9T |
| Japan | ¥1,296.44T (BOJ — local pipeline) | Jun 2026 | 161.70 | $8.0T |
| UK | £3,272B M4, +4.5% YoY | Apr 2026 | 1.3396 | $4.4T |
| **Composite** | | | | **~$105.5T** |

- vs $103.97T (26 Mar manual entry). US M2 YoY accelerated to **+5.6%** in May (from 4.7%).
- **CNY appreciation (≈7.25 → 6.78) is doing heavy lifting in the USD composite** — FX effects vs money creation must be separated in m2_note v2.
- Broader-basket measures (top-20 economies) print ~**$135T** — the 5-bloc composite is a different measure; v2 must pin the definition.
- **China June M2 releases 14 Jul** (same day as US June CPI). Time the manual refresh then.
- manual.json data-quality bugs: `china_m2` holds a USD value in a CNY-labeled field; `uk_m2` holds USD trillions in a "billions_gbp" field. Fix in overhaul.

## 3. BTC–M2 correlation: formally decoupled

- G4/global liquidity +12% YoY at record highs while BTC −22% YoY; divergence began mid-2025, pronounced through H1 2026 — now ~12 months old, i.e. the thesis's own 6–12-month tolerance window is fully consumed.
- Mechanism (consensus of coverage): the ETF flow channel (post-Jan-2024) can overwhelm the slower broad-money signal for months; Treasury/net-liquidity measures fit better than raw M2 in this regime.
- v6 options: (a) formalize a divergence clock (rolling 12-mo direction agreement; invalidation at ~18 months sustained divergence), (b) supplement M2 with a net-liquidity proxy. Recommend both.

## 4. De-dollarisation: two-sided update

Supporting: central banks bought the dip — Q1 2026 net purchases 244t (+3% YoY); May +41t; June: PBoC +14.93t (largest since 2023, 20th straight month), Uzbekistan +9t, Poland leads YTD (64t). WGC FY26 forecast ~850t (vs 863t 2025; pre-2022 norm 400–500t).
Contradicting: **IMF COFER Q1 2026: dollar reserve share ROSE** (headline and valuation-adjusted) — first reversal of the decline trend; euro and yen lost share. Dollar strong (broad index ~120.7). Stablecoins (GENIUS Act) are synthetic *re*-dollarisation + T-bill demand.
Synthesis for v6: CB gold bid is the floor, not the driver — gold −22% off ATH proves the marginal price-setter is financial flows. Reserve-share decline is secular but not monotonic; the leg needs a cyclical/structural split like the AI leg.

## 5. Fed / macro since FACTS.md compile (2 Jul)

- June NFP (2 Jul): **+57k** vs ~115k consensus; Apr+May revised −74k; U-3 4.2% via participation slump to 61.5% (lowest since Mar 2021). World Cup boost unwound (leisure −61k). Labor reacceleration narrative dead.
- July FOMC (28–29 Jul): hold priced ~70–80%; ~19% hike odds; hikes still priced for Sep+ (9 of 18 dots ≥1 hike in 2026). June CPI lands **14 Jul**.
- US M2 accelerating despite hawkish Fed — fiscal deficit + credit doing the work. Consistent with thesis's "printing arrives through the back door."

## 6. Claim verification (for the v5 purge list)

| v5 claim | Verdict | Replacement |
|---|---|---|
| Terafab "1TW/yr, 50× global chip output, Tesla/SpaceX/xAI" | Overstated | Real project: Tesla/SpaceX/**Intel** JV announced 21 Mar; prototype fab at GigaTexas; $55B initial / $119B all-phases (SpaceX filing, May); first leadership hire ex-Intel 18A (30 Jun). Cite soberly as capex/vertical-integration signal, not 50×. |
| "Kimi matched GPT-5 on two MacBooks" | Unverifiable hype | Epoch slopes: inference cost at fixed capability halves ~2 mo; pre-training efficiency ~3×/yr. |
| "$2.4T global military spend (2023)" | Stale | SIPRI 2025: **$2.887T record**, 11th straight rise; Europe +14% to $864B; burden 2.5% of GDP (highest since 2009). |
| Dollar reserve share "~57% declining" | Needs nuance | ~57% but Q1 2026 share rose (see §4). |
| "Global M2 ~$100T growing >10%" | Stale | ~$105.5T (5-bloc); growth ~6–10% depending on FX treatment; US +5.6%. |

## 7. Data pipeline implications (feeds outsourcing spec)

- **Bug:** XAUUSD and WTI are `null` in prices.json — Stooq fetch broken. Fix required.
- USD_INDEX is DTWEXBGS (Fed broad, ~120.7), not DXY — relabel in UI.
- Automatable additions (free, keyless or existing FRED key): HY OAS (BAMLH0A0HYM2), ECB M2 (ECB Data Portal API), BoE M4 (IADB CSV), FX rates for the composite (Stooq), M2 history file for computed YoY. China M2 stays manual (monthly, ~11th–14th).
- Key calendar: 14 Jul (China M2 + US CPI) · 28–29 Jul (FOMC) · early Aug (hyperscaler earnings — financing-crossover test) · 15–16 Sep (FOMC + SEP).

## Sources (primary ones)

- goldprice.org/gold-price-today/2026-06-30 · kitco.com (PBoC June purchase) · gold.org mid-year outlook & goldhub CB statistics · IMF COFER dashboard · ECB monetary developments May 2026 · tradingeconomics (CN/UK/US M2) · moomoo/PBoC Q1 release · BLS Employment Situation June 2026 · CNBC jobs report 2 Jul · Polymarket/rateprobability FOMC odds · SIPRI press release Apr 2026 · Wikipedia/CNBC/Electrek (Terafab) · bitcoinist/beincrypto/cfbenchmarks (BTC–M2 decoupling) · spotedcrypto (ETF cost basis ~$83.8k)
