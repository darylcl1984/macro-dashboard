# Notes on Global M2

July 2026 · desk-aligned cut 28 Jul 2026

Global M2 is **stage 4** of the thesis spine (the output), not the claim. The claim is two forces → fiscal hinge → gold/BTC. Methodology below.

### 1. What the Composite Measures

The dashboard’s Global M2 figure is a **five-bloc composite**: US + China + Eurozone + Japan + UK money supply, each converted to USD. As of the **May 2026 data vintage** it stands at **~$106.8T**.

You will see other “global M2” figures in circulation — commonly ~$135T. Those are broader baskets (top-20 economies, GDP-weighted variants). Neither is wrong; they are different measures. The five-bloc composite is used here because it covers most *active* global liquidity with five reliable statistical sources, and because its history is kept internally consistent. When comparing against external charts (e.g. BTC-vs-M2 overlays), always check which basket the chart uses.

### 2. Current Levels

**Live desk (Sep 2026):** five-bloc stock **~$108.0T** (data vintage **July 2026**, all five locals). Headline and fixed-FX YoY are **withheld**: July 2025 history is 4-bloc (`UK_unpublished`), so July-vs-July would mix baskets. The last complete 5-bloc pair on file is **May 2025 → May 2026** (~**+10.2%** headline / ~**+6.7%** fixed-FX). Invalidation remains headline YoY **&lt; 0%** when a matching-scope pair exists.

**May 2026 vintage** (the July 2026 write-up; kept for the leakage table below):

| Bloc | Level (local) | YoY (local) | Data as of | USD equiv. |
|---|---|---|---|---|
| US | $23.05T | +5.6% | May 2026 | $23.05T |
| China | ¥353.67T | +8.6% | May 2026 | $52.01T |
| Eurozone | €16.38T | ~+2.5% (est.) | May 2026 | $19.14T |
| Japan | ¥1,296.44T | ~+1.5% (est.) | May 2026 vintage in composite | $8.21T |
| UK (M4) | £3,278.5B | +4.5% | May 2026 | $4.38T |
| **Composite** | | | | **~$106.78T** |

**Calendar dual YoY (May 2025 → May 2026):**

| Metric | Rate | Meaning |
|---|---|---|
| **Headline** | **~+9.4%** | USD composite growth (money + FX translation) |
| **Fixed-FX** | **~+6.5%** | Prior-year local stocks revalued at *current* FX (money creation only) |

**Invalidation (watchpoint):** headline Global M2 YoY **&lt; 0%**. Always read fixed-FX beside headline when FX is doing heavy lifting.

**History notes:** `data/m2_history.json` holds monthly snapshots. There is a documented gap at **2025-06**. Some months carry quality flags (e.g. UK derived, 4-bloc ex-UK, EZ interpolated). The pipeline keys history by **data vintage** (component print months), not the wall-clock day of the fetch, and refuses headline YoY when base and as-of **scope** differ (5-bloc vs 4-bloc).

**Release lags (typical):** US FRED monthly (lagged); China PBoC ~mid-month; ECB/BOJ/BoE with their own calendars. China remains **manual** in `data/manual.json`.

### 3. FX Effects vs Money Creation

The USD composite conflates two things: actual money creation and currency translation. Both matter — but they mean different things for the thesis.

Example pattern: yuan *appreciation* inflates China’s USD-converted M2 without new yuan creation; yen *depreciation* shrinks Japan’s USD leg while local aggregates can still grow.

- **Headline** = dollar-denominated size of the global money pool (relevant for USD-priced assets).  
- **Fixed-FX** = monetary expansion holding FX constant (tests the “printing” claim).  

A composite rising purely on FX is a weaker thesis confirmation than one rising on local-currency aggregates — flag which is driving.

### 4. Not All M2 Is Globally Active

Capital-account openness, reserve status, and the eurodollar system determine how much of each bloc’s money supply actually circulates in global markets:

| Bloc | Nominal M2 (May ’26) | Est. globally active | Leakage | Key mechanism |
|---|---|---|---|---|
| US | ~$23.1T | ~$19–20T | ~85% | Reserve currency; large offshore USD credit |
| Eurozone | ~$19.1T | ~$8–9T | ~45% | Second reserve currency; open capital account |
| China | ~$52.0T | ~$4–5T | ~8% | Largest nominal M2, mostly captive |
| Japan | ~$8.2T | ~$2.5–3T | ~35% | Carry channel; domestically held psychology |
| UK | ~$4.4T | ~$2.5–3T | ~65% | London FX hub |
| **Total** | **~$106.8T** | **~$37–40T** | **~35%** | |

Leakage estimates are order-of-magnitude (BIS-era qualitative); re-verify annually. Implications:

- **US M2 is disproportionately powerful** in global risk transmission.  
- **De-dollarisation / capital-account opening** can unlock captive pools without new printing.  
- **Stablecoins** are a sixth *rails* channel (T-bill-backed dollar liquidity) — re-dollarising private rails even as official reserves diversify. Track desk stablecoin mcap separately from the five-bloc sum.

### 5. Transmission to BTC — layered model (2026)

**Do not confuse layers:**

| Layer | Role | Desk surface |
|---|---|---|
| **Destination** | Global M2 (headline + fixed-FX) over years | Money growth pillar; invalidation YoY &lt; 0% |
| **Short-run pipes** | Spot BTC **ETF flows**; US **net liquidity** + real rates / broad $ | Bitcoin ETF cell; money net-liq card |
| **Bridge diagnostic** | **US M2 MoM vs BTC monthly** direction (12 mo) | Bitcoin strip — *labeled US, not global lag* |
| **Invalidation clock** | Manual months since mid-2025 break → **18 mo** | Lag cell; resets only with sustained ETF + liquidity agreement |

Historical relationship (global M2 lag ~10–12 weeks, high directional agreement) **broke around mid-2025**. Since Jan 2024 spot ETFs, **primary-market ETF flows** dominate the short run. Expanding M2 can coexist with soft BTC when rates, the dollar, energy premiums, and ETF outflows **absorb or redirect** the print.

Practical rules:

- Divergence clock is **manual** until a proven auto-reset rule exists.  
- One green ETF week does **not** reset the clock.  
- US M2 vs BTC chips are a **diagnostic**, not a substitute for global M2.

---

*For educational and analytical reference only. Not financial advice.*
