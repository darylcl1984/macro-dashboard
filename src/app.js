'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const DATA = {
  prices: '../data/prices.json',
  macro:  '../data/macro.json',
  manual: '../data/manual.json',
  alerts: '../data/alerts.json',
  thesis: '../docs/thesis.md',
  m2note: '../docs/m2_note.md',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2, prefix = '', suffix = '') {
  if (n == null || isNaN(n)) return '—';
  const s = Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return prefix + s + suffix;
}

function fmtPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '<span class="neu">—</span>';
  const sign = n >= 0 ? '+' : '';
  const cls  = n >= 0 ? 'pos' : 'neg';
  return `<span class="${cls}">${sign}${n.toFixed(decimals)}%</span>`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMacroDate(str) {
  if (!str) return '—';
  // BOJ format: "202602" → parse as YYYY-MM
  const s = /^\d{6}$/.test(str) ? `${str.slice(0, 4)}-${str.slice(4, 6)}-01` : str;
  const d = new Date(s);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function fmtTs(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function daysAgo(ms) {
  const d = Math.floor(ms / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

function staleness(dateStr, amberDays, redDays) {
  if (!dateStr) return { level: 'red', label: 'No date' };
  // Normalize YYYY-MM / YYYYMM to mid-month for age calc
  let s = String(dateStr);
  if (/^\d{6}$/.test(s)) s = `${s.slice(0, 4)}-${s.slice(4, 6)}-15`;
  else if (/^\d{4}-\d{2}$/.test(s)) s = `${s}-15`;
  else if (/^\d{4}-Q[1-4]$/i.test(s)) {
    const q = Number(s.slice(-1));
    s = `${s.slice(0, 4)}-${String(q * 3 - 1).padStart(2, '0')}-15`;
  }
  const age = Date.now() - new Date(s).getTime();
  if (isNaN(age)) return { level: 'red', label: 'No date' };
  const d = age / 86400000;
  if (d > redDays)   return { level: 'red',   label: daysAgo(age) };
  if (d > amberDays) return { level: 'amber', label: daysAgo(age) };
  return { level: 'fresh', label: '' };
}

function staleBadge(level, label) {
  if (level === 'fresh' || !label) return '';
  return `<span class="stale-badge stale-${level}">${label}</span>`;
}

function priceOf(prices, key) {
  return prices?.[key]?.price ?? null;
}

function changePctOf(prices, key) {
  return prices?.[key]?.change_pct ?? null;
}

function monthsSince(period) {
  if (!period) return null;
  const m = String(period).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const now = new Date();
  return (now.getFullYear() - Number(m[1])) * 12 + ((now.getMonth() + 1) - Number(m[2]));
}

function m2BandClass(yoy) {
  if (yoy == null || isNaN(yoy)) return 'neu';
  if (yoy >= 8) return 'pos';
  if (yoy >= 3) return 'tone-green';
  if (yoy >= 0) return 'tone-amber';
  return 'neg';
}

/** Cycle-high / 52w-low chips for inside the range cell (not a bolted-on footer). */
function assetContextBits(entry, price) {
  if (price == null && entry?.price == null) return [];
  const px = price != null ? price : entry.price;
  const ath = entry?.ath_proxy ?? entry?.week52_high;
  const low = entry?.week52_low;
  const bits = [];
  if (ath != null && ath > 0) {
    const dd = ((px / ath) - 1) * 100;
    bits.push({
      cls: dd <= -30 ? 'is-deep' : dd <= -15 ? 'is-soft' : '',
      text: `${dd.toFixed(0)}% cycle high`,
    });
  }
  if (low != null && low > 0) {
    const up = ((px / low) - 1) * 100;
    bits.push({
      cls: up <= 10 ? 'is-soft' : '',
      text: `${up.toFixed(0)}% off low`,
    });
  }
  return bits;
}

function assetContextInlineHtml(entry, price) {
  const bits = assetContextBits(entry, price);
  if (!bits.length) return '';
  return `<div class="range-context">${bits.map(b =>
    `<span class="range-context-chip${b.cls ? ` ${b.cls}` : ''}">${b.text}</span>`
  ).join('')}</div>`;
}

function meterHtml(pct, tone, leftLabel, rightLabel) {
  const p = Math.min(100, Math.max(0, pct));
  const toneCls = tone ? ` is-${tone}` : '';
  return `<div class="meter-block"><div class="meter">
    <div class="meter-track"><div class="meter-fill${toneCls}" style="width:${p.toFixed(1)}%"></div></div>
    <div class="meter-meta"><span>${leftLabel}</span><span>${rightLabel}</span></div>
  </div></div>`;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "2026-07" → "Jul" (or "Jul 26" when year context helps). */
function periodMonthLabel(period, withYear = false) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return period || '—';
  const mon = MONTH_SHORT[Number(m[2]) - 1] || m[2];
  return withYear ? `${mon} ${m[1].slice(2)}` : mon;
}

/** Month-by-month US M2 vs BTC direction (US M2 history + BTC monthly closes). */
function buildTransmission(macro, prices) {
  const m2h = macro?.indicators?.US_M2?.history || [];
  const btcSeries = prices?.prices?.BTC?.monthly_series || [];
  if (m2h.length < 3 || btcSeries.length < 3) {
    return { months: [], agree: 0, disagree: 0, note: 'Need more history to compare US M2 with Bitcoin.' };
  }
  const m2Map = Object.fromEntries(m2h.map(e => [e.period, e.value]));
  const btcMap = Object.fromEntries(btcSeries.map(e => [e.period, e.close]));
  const periods = btcSeries.map(e => e.period).filter(p => m2Map[p] != null);
  const months = [];
  for (let i = 1; i < periods.length; i++) {
    const p = periods[i];
    const prev = periods[i - 1];
    const m2Chg = m2Map[p] - m2Map[prev];
    const btcChg = btcMap[p] - btcMap[prev];
    if (m2Chg === 0 || btcChg === 0) {
      months.push({
        period: p,
        state: 'na',
        label: periodMonthLabel(p),
        title: `${periodMonthLabel(p, true)}: flat month (skipped)`,
      });
      continue;
    }
    const same = (m2Chg > 0) === (btcChg > 0);
    months.push({
      period: p,
      state: same ? 'agree' : 'disagree',
      label: periodMonthLabel(p),
      title: `${periodMonthLabel(p, true)}: US M2 ${m2Chg > 0 ? '↑' : '↓'} · BTC ${btcChg > 0 ? '↑' : '↓'}`,
    });
  }
  // Rolling last 12 comparable month-pairs (MoM direction US M2 vs BTC)
  const recent = months.slice(-12);
  const a = recent.filter(m => m.state === 'agree').length;
  const d = recent.filter(m => m.state === 'disagree').length;
  let note = `${a} agree · ${d} disagree (rolling ${recent.length} mo)`;
  if (d > a) note += ' — still mostly out of sync';
  else if (a > d) note += ' — leaning back into agreement';
  return { months: recent, agree: a, disagree: d, note };
}

function transmissionHtml(tx) {
  if (!tx.months.length) {
    return `<div class="tx-strip">
      <div class="tx-strip-head">
        <span class="tx-strip-title">US M2 vs Bitcoin (monthly)</span>
        <span class="tx-strip-summary">${tx.note}</span>
      </div>
    </div>`;
  }
  const n = tx.months.length;
  const cells = tx.months.map(m =>
    `<span class="tx-month ${m.state}" title="${m.title || m.period}">${m.label}</span>`
  ).join('');
  return `<div class="tx-strip">
    <div class="tx-strip-head">
      <span class="tx-strip-title">US M2 vs Bitcoin (monthly)</span>
      <span class="tx-strip-summary">${tx.note}</span>
    </div>
    <div class="tx-months" style="--tx-n:${n}" aria-label="Rolling last ${n} months, month-by-month direction">${cells}</div>
    <div class="tx-legend">Same direction = green · opposite = amber · US M2 vs BTC (MoM)</div>
  </div>`;
}

function worstStatus(...statuses) {
  const rank = { red: 3, amber: 2, green: 1, null: 0, undefined: 0 };
  let best = 'green';
  for (const s of statuses) {
    if ((rank[s] || 0) > (rank[best] || 0)) best = s;
  }
  return best;
}

function statusChip(status) {
  const s = status || 'green';
  const labels = { green: 'clear', amber: 'watching', red: 'broken' };
  return `<span class="status-chip chip-${s}">${labels[s] || s}</span>`;
}

function fgColorClass(val) {
  if (val == null) return '';
  if (val <= 25) return 'fg-extreme-fear';
  if (val <= 45) return 'fg-fear';
  if (val <= 55) return 'fg-neutral';
  if (val <= 75) return 'fg-greed';
  return 'fg-extreme-greed';
}

function resolveM2Yoy(ind, manual) {
  const gy = ind?.GLOBAL_M2_YOY;
  const computed = gy?.headline_pct;
  if (computed != null && !isNaN(computed)) {
    return {
      value: computed,
      estimated: !!(gy.provisional || gy.estimated),
      sourceDate: gy.as_of_period,
      fxAdjusted: gy.fx_adjusted_pct,
      provisional: !!gy.provisional,
    };
  }
  const est = manual?.global_m2_yoy_estimate?.value;
  if (est != null && !isNaN(est)) {
    return { value: est, estimated: true, sourceDate: manual.global_m2_yoy_estimate.updated, fxAdjusted: null, provisional: false };
  }
  return { value: null, estimated: false, sourceDate: null, fxAdjusted: null, provisional: false };
}

function scenarioClass(current) {
  if (!current) return 'base';
  const c = String(current).toLowerCase();
  if (c.startsWith('a') || c.includes('relink') || c.includes('reconnection') || c.includes('bull')) return 'bull';
  if (c.startsWith('c') || c.includes('credit') || c.includes('bear')) return 'bear';
  if (c.startsWith('d') || c.includes('tail') || c.includes('geo') || c.includes('shock')) return 'tail';
  return 'base'; // B / Hawkish grind
}

// ─── Range bars with threshold markers ────────────────────────────────────────

const RANGE_REVERSED = new Set(['WTI', 'VIX']);

function fmtRangeVal(v) {
  if (v == null) return '—';
  if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 10)   return '$' + Math.round(v);
  return '$' + Number(v).toFixed(2);
}

/**
 * Quote-page 52-week range: last print as the hero, full-width low—marker—high.
 * markers: [{ value, label, kind?: 'below'|'above'|'mark' }]
 */
function rangePosition(price, low, high) {
  if (price == null || low == null || high == null || high <= low) return null;
  return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

function rangeDesc(sym, pct) {
  if (pct == null) return { text: '', cls: '' };
  const reversed = RANGE_REVERSED.has(sym);
  const text = pct <= 0.10 ? 'Near 52w low'  : pct <= 0.25 ? 'Lower quarter'
             : pct <= 0.40 ? 'Lower third'   : pct <= 0.60 ? 'Mid-range'
             : pct <= 0.75 ? 'Upper third'   : pct <= 0.90 ? 'Upper quarter'
             : 'Near 52w high';
  const cls = reversed
    ? (pct <= 0.25 ? 'pos' : pct >= 0.75 ? 'highlight-warn' : '')
    : (pct <= 0.25 ? 'highlight-warn' : pct >= 0.75 ? 'pos' : '');
  return { text, cls };
}

function rangeTrackHtml(sym, price, low, high, markers = []) {
  const pct = rangePosition(price, low, high);
  if (pct == null) return '';
  const span = high - low;
  let alerted = false;
  for (const mk of markers) {
    // Floor breaks only. `above` marks are path bands, not alerts.
    if (mk.kind === 'below' && price < mk.value) alerted = true;
  }

  let ticks = '', zones = '', labels = '';
  for (const mk of markers) {
    if (mk.value == null) continue;
    const tp = (mk.value - low) / span;
    if (tp <= 0 || tp >= 1) continue;
    const left = (tp * 100).toFixed(1);
    if (mk.kind === 'below') {
      zones += `<div class="range-zone" style="left:0;width:${left}%"></div>`;
    } else if (mk.kind === 'above') {
      zones += `<div class="range-zone" style="left:${left}%;right:0"></div>`;
    }
    const tip = mk.label || fmtRangeVal(mk.value);
    const isThreshold = mk.kind === 'below' || mk.kind === 'above';
    const tickCls = isThreshold ? 'range-tick' : 'range-tick is-mark';
    const labCls = isThreshold ? 'range-mark-label is-threshold' : 'range-mark-label';
    ticks += `<div class="${tickCls}" style="left:${left}%" data-tooltip="${tip}"></div>`;
    labels += `<span class="${labCls}" style="left:${left}%">${tip}</span>`;
  }

  const leftPct = (pct * 100).toFixed(1);
  const aria = `${sym} 52-week range ${fmtRangeVal(low)} to ${fmtRangeVal(high)}, now ${fmtRangeVal(price)}`;
  const markCls = alerted ? 'range-marker is-alert' : 'range-marker';
  return `<div class="range-wrap">
    <div class="range-track" role="img" aria-label="${aria}">${zones}${ticks}<div class="${markCls}" style="left:${leftPct}%"></div></div>
    ${labels ? `<div class="range-mark-row">${labels}</div>` : ''}
  </div>`;
}

function assetQuoteHtml(sym, label, price, chg, entry, markers = [], decimals = 0, prefix = '$') {
  const low = entry?.week52_low ?? null;
  const high = entry?.week52_high ?? null;
  const pct = rangePosition(price, low, high);
  const desc = rangeDesc(sym, pct);
  const bits = assetContextBits(entry, price);
  const alerted = (markers || []).some(mk => mk.kind === 'below' && price < mk.value);
  const meta = [
    desc.text
      ? (desc.cls ? `<span class="${desc.cls}">${desc.text}</span>` : desc.text)
      : null,
    alerted ? '<span class="range-alert-icon">⚠</span>' : null,
    ...bits.map(b => `<span class="range-context-chip${b.cls ? ` ${b.cls}` : ''}">${b.text}</span>`),
  ].filter(Boolean).join(' · ');

  const hasRange = pct != null;
  return `<div class="asset-quote">
    <div class="asset-quote-head">
      <span class="asset-quote-name">${label}</span>
      <span class="asset-quote-chg">${fmtPct(chg, 2)}</span>
    </div>
    <div class="asset-quote-px">${fmt(price, decimals, prefix)}</div>
    ${hasRange ? `<div class="asset-quote-range">
      <div class="asset-quote-ends">
        <span>${fmtRangeVal(low)}</span>
        <span class="asset-quote-range-k">52-week</span>
        <span>${fmtRangeVal(high)}</span>
      </div>
      ${rangeTrackHtml(sym, price, low, high, markers)}
    </div>` : ''}
    ${meta ? `<div class="asset-quote-meta">${meta}</div>` : ''}
  </div>`;
}

// ─── Trigger board (single source of truth) ───────────────────────────────────

function buildTriggers(prices, macro, manual) {
  const ind = macro?.indicators || {};
  const p = prices?.prices || {};
  const tm = manual?.triggers_manual || {};
  const btc = p.BTC;
  const gold = p.XAUUSD;
  const wti = p.WTI;
  const oas = ind.HY_OAS?.value;
  const m2yoy = resolveM2Yoy(ind, manual);
  const divMonths = monthsSince(manual?.divergence?.start);
  const coferQ = manual?.cofer_usd_share?.consecutive_rising_quarters;

  function manualStatus(key) {
    return tm[key]?.status || null;
  }
  function manualNotes(key) {
    return tm[key]?.notes || '';
  }

  const btcWeekly = btc?.weekly_close ?? null;
  const goldMonthly = gold?.monthly_close ?? null;

  // Order: AI funding → money → COFER → gold → BTC cluster → oil last
  const rows = [
    {
      id: 'global_m2',
      group: 'money',
      label: 'Global M2',
      threshold: 'Headline YoY < 0%',
      current() {
        if (m2yoy.value == null) return '—';
        const sign = m2yoy.value >= 0 ? '+' : '';
        const pureEst = m2yoy.estimated && !m2yoy.provisional;
        return `${sign}${m2yoy.value.toFixed(1)}% headline${pureEst ? ' est.' : ''}`;
      },
      status() {
        const y = m2yoy.value;
        if (y == null) return 'green';
        if (y < 0) return 'red';
        if (y < 3) return 'amber';
        return 'green';
      },
      note() {
        if (m2yoy.fxAdjusted != null && !isNaN(m2yoy.fxAdjusted)) {
          const s = m2yoy.fxAdjusted >= 0 ? '+' : '';
          return `Fixed-FX ${s}${Number(m2yoy.fxAdjusted).toFixed(1)}%`;
        }
        return m2yoy.estimated ? (manual?.global_m2_yoy_estimate?.note || '') : '';
      },
    },
    {
      id: 'cofer',
      group: 'money',
      label: 'Dollar reserve share',
      threshold: 'Up 4 quarters straight',
      current() {
        if (coferQ == null) return '—';
        const share = manual?.cofer_usd_share?.usd_share_pct;
        const q = coferQ === 1 ? '1 rising' : `${coferQ} rising`;
        const bits = [q];
        if (share != null) bits.push(`${fmt(share, 2)}%`);
        if (manual?.cofer_usd_share?.period) bits.push(manual.cofer_usd_share.period);
        return bits.join(' · ');
      },
      status() {
        if (coferQ == null) return 'green';
        if (coferQ >= 4) return 'red';
        if (coferQ >= 1) return 'amber';
        return 'green';
      },
      note() {
        return manualNotes('cofer_reversal')
          || (coferQ != null && coferQ > 0 && coferQ < 4
            ? 'Noise until four rising quarters.'
            : '');
      },
    },
    {
      id: 'gold_hedge',
      group: 'gold',
      label: 'Gold $4k floor',
      threshold: 'Monthly close < $4,000',
      current() {
        const live = gold?.price;
        const bits = [];
        if (goldMonthly != null) bits.push(`Month ${fmt(goldMonthly, 0, '$')}`);
        if (live != null) bits.push(`Live ${fmt(live, 0, '$')}`);
        return bits.length ? bits.join(' · ') : '—';
      },
      status() {
        const man = manualStatus('gold_monthly_close');
        const month = goldMonthly;
        const live = gold?.price;
        if (man === 'red' || (month != null && month < 4000 && man === 'red')) return 'red';
        if (month != null && month < 4000) return man === 'red' ? 'red' : 'amber';
        if (live != null && live < 4000) return 'amber';
        if (man === 'amber') return 'amber';
        return 'green';
      },
      note() { return manualNotes('gold_monthly_close'); },
    },
    {
      id: 'btc_demand',
      group: 'btc',
      label: 'BTC $53k floor',
      threshold: 'Weekly close < $53,000',
      current() {
        const live = btc?.price;
        const bits = [];
        if (btcWeekly != null) bits.push(`Week ${fmt(btcWeekly, 0, '$')}`);
        if (live != null) bits.push(`Live ${fmt(live, 0, '$')}`);
        return bits.length ? bits.join(' · ') : '—';
      },
      status() {
        // Official rule uses weekly close; live price only softens toward amber
        const close = btcWeekly ?? btc?.price;
        if (close == null) return 'green';
        if (close < 53000) return 'red';
        if (close < 60950 || (btc.week52_low != null && btc.week52_low < 58300)) return 'amber';
        if (btc?.price != null && btc.price < 60950) return 'amber';
        return 'green';
      },
      note() {
        if (btcWeekly != null && btc?.weekly_close_as_of)
          return `Judged on weekly close (${btc.weekly_close_as_of}).`;
        return 'Weekly close not loaded — live as stand-in.';
      },
    },
    {
      id: 'divergence',
      group: 'btc',
      label: 'BTC–M2 lag',
      threshold: '≥ 18 months out of sync',
      current() {
        if (manual?.divergence?.start == null) return 'Back in sync';
        if (divMonths == null) return '—';
        const since = periodMonthLabel(manual.divergence.start, true);
        return `${divMonths} mo · since ${since}`;
      },
      status() {
        if (manual?.divergence?.start == null) return 'green';
        if (divMonths == null) return 'green';
        if (divMonths >= 18) return 'red';
        if (divMonths >= 12) return 'amber';
        return 'green';
      },
      note() {
        // Short board line; full transmission essay lives in docs / Hard money desk.
        return 'Manual clock · don’t reset on one green ETF week.';
      },
    },
    {
      id: 'ai_financing',
      group: 'ai',
      label: 'AI funding stress',
      threshold: 'OAS >5% and capex cuts',
      current() {
        const bits = [];
        if (oas != null) bits.push(`OAS ${oas.toFixed(2)}%`);
        const cuts = manual?.ai_transition?.capex_cuts;
        bits.push(cuts ? 'Cuts yes' : 'Cuts no');
        const hs = manual?.ai_transition?.hyperscaler_cash;
        if (hs?.crossed) bits.push('Cash crossed');
        else if (hs?.gap_usd_b != null) bits.push(`Gap $${fmt(hs.gap_usd_b, 1)}B`);
        return bits.join(' · ') || '—';
      },
      status() {
        const man = manualStatus('ai_financing');
        const cuts = !!manual?.ai_transition?.capex_cuts;
        const hs = manual?.ai_transition?.hyperscaler_cash;
        const cashTight = !!(hs && (hs.crossed || (hs.gap_usd_b != null && hs.gap_usd_b < 0)));
        const oasRed = oas != null && oas > 5;
        const oasAmber = oas != null && oas > 4;
        let computed = 'green';
        // Red only when market stress + management cuts (thesis invalidation path).
        // Epoch cash cross alone is amber watch — external financing is expected.
        if (oasRed && cuts) computed = 'red';
        else if (oasRed || oasAmber || cuts || cashTight) computed = 'amber';
        return worstStatus(computed, man || 'green');
      },
      note() { return manualNotes('ai_financing'); },
    },
    {
      id: 'oil',
      group: 'tail',
      label: 'Oil spike',
      threshold: 'WTI >$120 for 4+ weeks',
      current() {
        const price = wti?.price;
        if (price == null) return '—';
        if (price > 120) return `WTI ${fmt(price, 2, '$')} · confirm 4 weeks`;
        return `WTI ${fmt(price, 2, '$')}`;
      },
      status() {
        const price = wti?.price;
        if (price == null) return 'green';
        if (price > 120) return 'red';
        if (price > 100) return 'amber';
        return 'green';
      },
      note() { return ''; },
    },
  ];
  const order = ['ai_financing', 'global_m2', 'cofer', 'gold_hedge', 'btc_demand', 'divergence', 'oil'];
  return order.map(id => rows.find(r => r.id === id)).filter(Boolean);
}

function tallyTriggers(triggers) {
  const counts = { green: 0, amber: 0, red: 0 };
  for (const t of triggers) {
    const s = t.status();
    if (counts[s] != null) counts[s]++;
  }
  return counts;
}

function renderTriggers(prices, macro, manual) {
  const triggers = buildTriggers(prices, macro, manual);
  const tbody = document.getElementById('trigger-rows');
  let prevGroup = null;
  const rows = triggers.map(t => {
    const status = t.status();
    const note = t.note();
    const current = t.current();
    const noteEsc = note ? String(note).replace(/"/g, '&quot;') : '';
    const noteHtml = note
      ? `<div class="trigger-note" title="${noteEsc}">${note}</div>`
      : '';
    const group = t.group || '';
    const groupStart = group && group !== prevGroup ? ' trigger-group-start' : '';
    prevGroup = group;
    return `<tr class="trigger-row trigger-group-${group}${groupStart}" data-group="${group}">
      <td data-label="Watchpoint">
        <span class="trigger-label">${t.label}</span>
        <span class="trigger-threshold-mobile">${t.threshold}</span>
      </td>
      <td data-label="Breaks if"><span class="trigger-threshold-inline">${t.threshold}</span></td>
      <td data-label="Now" class="trigger-now-cell">
        <div class="trigger-now">
          <span class="trigger-current">${current}</span>
          ${noteHtml}
        </div>
      </td>
      <td class="trigger-status-cell" data-label="Status">${statusChip(status)}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');

  const tally = tallyTriggers(triggers);
  const board = document.getElementById('panel-triggers');
  if (board) {
    board.classList.remove('panel-alarm-red');
    if (tally.red > 0) board.classList.add('panel-alarm-red');
  }
  const sumEl = document.getElementById('trigger-summary');
  if (sumEl) {
    const total = tally.green + tally.amber + tally.red;
    const chips = [
      `<span class="trigger-sum-chip chip-green">${tally.green} clear</span>`,
      `<span class="trigger-sum-chip chip-amber">${tally.amber} watching</span>`,
      `<span class="trigger-sum-chip chip-red">${tally.red} broken</span>`,
    ].join('<span class="tally-sep">·</span>');
    const lead = tally.red > 0
      ? `<strong>${tally.red} broken</strong>`
      : tally.amber > 0
        ? `<strong>${tally.amber} of ${total} watching</strong>`
        : `<strong>All clear</strong>`;
    sumEl.innerHTML = `<span class="trigger-sum-k">Board</span><span class="trigger-sum-v">${lead}<span class="tally-sep">·</span>${chips}</span><span class="trigger-sum-n">of ${total}</span>`;
  }
  return tally;
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function renderStatusBar(manual, macro, tally) {
  const scenario = manual?.scenario;
  const current  = scenario?.current || '—';
  const prob     = scenario?.probability || '';
  const scenarioEl = document.getElementById('scenario-value');
  const scenarioCell = document.getElementById('s-scenario');
  const cls = scenarioClass(current);
  scenarioEl.textContent = current;
  scenarioEl.className = `status-value scenario-${cls}`;
  scenarioCell.classList.remove('bull', 'base', 'bear', 'tail');
  scenarioCell.classList.add(cls);
  document.getElementById('scenario-prob').textContent = prob;

  const ind = macro?.indicators || {};
  const m2yoy = resolveM2Yoy(ind, manual);
  const m2yoyEl = document.getElementById('m2-yoy');
  // Status bar: clean number + as-of period. Monthly M2 is always ~1–2 months lagged —
  // do not show "N days ago" (noise) or interim chips (detail lives on the Money pillar).
  if (m2yoy.value != null) {
    const sign = m2yoy.value >= 0 ? '+' : '';
    const cls2 = m2yoy.value > 0 ? 'pos' : 'neg';
    // Only tag pure manual fallback (no computed headline), not provisional/mixed-vintage.
    const pureEst = m2yoy.estimated && !m2yoy.provisional && ind?.GLOBAL_M2_YOY?.headline_pct == null;
    const est = pureEst
      ? ' <span class="est-tag" title="Manual estimate — computed YoY not available">est.</span>'
      : '';
    m2yoyEl.innerHTML = `<span class="${cls2}">${sign}${m2yoy.value.toFixed(1)}%</span>${est}`;
  } else {
    m2yoyEl.textContent = '—';
  }
  {
    const bits = [];
    const asOf = m2yoy.sourceDate
      ? (periodMonthLabel(m2yoy.sourceDate, true) || m2yoy.sourceDate)
      : '';
    if (asOf) bits.push(asOf);
    if (m2yoy.fxAdjusted != null && !isNaN(m2yoy.fxAdjusted)) {
      const s = m2yoy.fxAdjusted >= 0 ? '+' : '';
      bits.push(`fx ${s}${Number(m2yoy.fxAdjusted).toFixed(1)}%`);
    }
    // Only warn if data vintage is seriously behind (normal 1–2 month lag stays quiet).
    const lagMo = monthsSince(m2yoy.sourceDate);
    if (lagMo != null && lagMo > 3) {
      bits.push(`<span class="stale-badge stale-amber">${lagMo} mo lag</span>`);
    }
    document.getElementById('m2-sub').innerHTML = bits.join(' · ');
  }

  const fg = ind.FEAR_GREED;
  const fgEl = document.getElementById('fg-value');
  fgEl.textContent = fg?.value != null ? fg.value : '—';
  fgEl.className = `status-value ${fgColorClass(fg?.value)}`;
  document.getElementById('fg-class').textContent = fg?.classification || '';

  const tallyEl = document.getElementById('trigger-tally');
  tallyEl.innerHTML = [
    `<span class="tally-chip chip-green">${tally.green}</span>`,
    `<span class="tally-sep">·</span>`,
    `<span class="tally-chip chip-amber">${tally.amber}</span>`,
    `<span class="tally-sep">·</span>`,
    `<span class="tally-chip chip-red">${tally.red}</span>`,
  ].join('');
}

function setupTriggerScroll() {
  const cell = document.getElementById('s-triggers');
  const board = document.getElementById('panel-triggers');
  if (!cell || !board) return;
  const go = () => board.scrollIntoView({ behavior: 'smooth', block: 'start' });
  cell.addEventListener('click', go);
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  });
}

// ─── Pillar panels ────────────────────────────────────────────────────────────

function heroStat(label, valueHtml, subHtml) {
  return `<div class="hero-stat">
    ${label ? `<div class="hero-stat-label">${label}</div>` : ''}
    <div class="hero-stat-value">${valueHtml}</div>
    ${subHtml ? `<div class="hero-stat-sub">${subHtml}</div>` : ''}
  </div>`;
}

function kpiStrip(cells, cols) {
  const n = cols || cells.length;
  return `<div class="kpi-strip cols-${n}" role="group">${cells.map(c => `
    <div class="kpi">
      <span class="kpi-label">${c.label}</span>
      <span class="kpi-value">${c.value}</span>
      ${c.meta ? `<span class="kpi-meta">${c.meta}</span>` : ''}
    </div>`).join('')}</div>`;
}

/**
 * @param {'metric'|'text'} [variant]
 * @param {string} [meterSlot] optional HTML for a progress meter (sibling of value, not in sub)
 */
function miniCard(label, valueHtml, subHtml = '', variant = 'metric', meterSlot = '') {
  const valueCls = variant === 'text' ? 'mini-card-value mini-card-value--text' : 'mini-card-value';
  return `<div class="mini-card${variant === 'text' ? ' mini-card--text' : ''}">
    <div class="mini-card-label">${label}</div>
    <div class="${valueCls}">${valueHtml}</div>
    ${meterSlot || ''}
    ${subHtml ? `<div class="mini-card-sub">${subHtml}</div>` : ''}
  </div>`;
}

function fieldBlock(label, bodyHtml, metaHtml = '', isProse = false) {
  return `<div class="field">
    <div class="field-label">${label}</div>
    <div class="${isProse ? 'field-prose' : 'field-value'}">${bodyHtml}</div>
    ${metaHtml ? `<div class="field-meta">${metaHtml}</div>` : ''}
  </div>`;
}

function fgBarHtml(val) {
  if (val == null) return '';
  const pct = Math.min(100, Math.max(0, val));
  const fillCls = val <= 25 ? 'fill-red' : val <= 45 ? 'fill-amber'
                : val <= 55 ? 'fill-dim' : val <= 75 ? 'fill-greed' : 'fill-green';
  return `<div class="fg-bar-track">
    <div class="fg-bar-bands" aria-hidden="true">
      <span class="fg-bar-band" style="left:25%"></span>
      <span class="fg-bar-band" style="left:50%"></span>
      <span class="fg-bar-band" style="left:75%"></span>
    </div>
    <div class="fg-bar-fill ${fillCls}" style="width:${pct}%"></div>
    <div class="fg-bar-marker" style="left:${pct}%"></div>
  </div>`;
}

function divergenceClockHtml(months, start) {
  const ticks = `<div class="div-clock-ticks" aria-hidden="true">
    <span class="div-clock-tick" style="left:66.67%" title="12 months"></span>
    <span class="div-clock-tick" style="left:100%" title="18 months"></span>
  </div>`;
  if (start == null) {
    return `<div class="div-clock">
      <div class="div-clock-label pos">Back in sync</div>
      <div class="div-clock-track">${ticks}<div class="div-clock-fill fill-green" style="width:2%"></div></div>
    </div>`;
  }
  if (months == null) return '<span class="neu">—</span>';
  const pct = Math.min(100, (months / 18) * 100);
  const tone = months >= 18 ? 'red' : months >= 12 ? 'amber' : 'green';
  return `<div class="div-clock">
    <div class="div-clock-label tone-${tone}">${months} mo <span class="neu">/ 18</span></div>
    <div class="div-clock-track">${ticks}<div class="div-clock-fill fill-${tone}" style="width:${pct.toFixed(1)}%"></div></div>
  </div>`;
}

/** Local-currency M2 YoY for a bloc from manual.bloc_m2_yoy (est. where flagged). */
function blocM2YoyHtml(manual, bloc) {
  const entry = manual?.bloc_m2_yoy?.[bloc];
  if (entry == null) return '<span class="neu">—</span>';
  const raw = typeof entry === 'number' ? entry : entry?.value;
  if (raw == null || isNaN(raw)) return '<span class="neu">—</span>';
  const isEst = typeof entry === 'object' ? !!entry.estimated : true;
  const sign = raw >= 0 ? '+' : '';
  const cls = raw >= 0 ? 'pos' : 'neg';
  const est = isEst ? ' <span class="est-tag">est.</span>' : '';
  return `<span class="${cls}">${sign}${Number(raw).toFixed(1)}%</span>${est}`;
}

function renderPillarMonetary(ind, manual) {
  const gm2 = ind.GLOBAL_M2;
  const m2yoy = resolveM2Yoy(ind, manual);
  const gy = ind.GLOBAL_M2_YOY || {};
  const fxAdj = gy.fx_adjusted_pct != null ? gy.fx_adjusted_pct : m2yoy.fxAdjusted;
  const comps = gm2?.components || {};
  const dates = gm2?.component_dates || {};
  const cn = manual?.china_m2;
  const estTag = (m2yoy.estimated || gy.provisional)
    ? ' <span class="est-tag" title="Interim figure — not a full calendar year-over-year yet">interim</span>'
    : '';

  const localVals = {
    US: ind.US_M2?.value != null ? `$${fmt(ind.US_M2.value, 0)}B` : '—',
    CN: cn?.value != null ? `¥${fmt(cn.value, 2)}T` : '—',
    EZ: ind.EZ_M2?.value != null ? `€${fmt(ind.EZ_M2.value, 2)}T` : '—',
    JP: ind.JP_M2?.value != null ? `¥${fmt(ind.JP_M2.value, 2)}T` : '—',
    UK: ind.UK_M4?.value != null ? `£${fmt(ind.UK_M4.value, 1)}B` : '—',
  };

  const yoyHtml = m2yoy.value != null
    ? `<span class="${m2BandClass(m2yoy.value)}">${m2yoy.value >= 0 ? '+' : ''}${m2yoy.value.toFixed(1)}%</span>${estTag}`
    : '—';
  // Fixed-FX = money creation only (revalue base-period locals at latest FX)
  const fxCell = fxAdj != null && !isNaN(fxAdj)
    ? `<span class="${m2BandClass(fxAdj)}">${fxAdj >= 0 ? '+' : ''}${Number(fxAdj).toFixed(1)}%</span>${estTag}`
    : `<span class="neu" title="Compares money stocks using constant exchange rates">Pending</span>`;
  const defaultHist = gy.history_ready
    ? 'Calendar YoY · fixed-FX holds FX constant (money creation only).'
    : 'Fixed-FX pending until enough monthly M2 history is on file.';
  const rawHist = gy.history_note || defaultHist;
  const flagIdx = rawHist.search(/Quality flags:\s*/i);
  const histNote = flagIdx >= 0 ? rawHist.slice(0, flagIdx).trim() : rawHist;
  const histFlags = flagIdx >= 0 ? rawHist.slice(flagIdx).replace(/^Quality flags:\s*/i, '').trim() : '';

  const m2KpiHtml = kpiStrip([
    {
      label: 'Global money supply (M2)',
      value: gm2?.value != null ? `$${fmt(gm2.value, 2)}T` : '—',
    },
    {
      label: 'USD total growth',
      value: yoyHtml,
      meta: 'Money + FX translation',
    },
    {
      label: 'Fixed-FX growth',
      value: fxCell,
      meta: 'Money creation only',
    },
  ], 3);

  const blocNames = { US: 'US', CN: 'China', EZ: 'Eurozone', JP: 'Japan', UK: 'UK' };
  const blocRows = ['US', 'CN', 'EZ', 'JP', 'UK'].map(bloc => {
    const usd = comps[bloc];
    const date = dates[bloc];
    const stale = bloc === 'CN'
      ? staleness(cn?.updated || cn?.period, 45, 90)
      : bloc === 'EZ' ? staleness(ind.EZ_M2?.date, 45, 90)
      : bloc === 'UK' ? staleness(ind.UK_M4?.date, 45, 90)
      : bloc === 'JP' ? staleness(ind.JP_M2?.date, 45, 90)
      : staleness(ind.US_M2?.date, 45, 90);
    const src = bloc === 'CN' ? ' <span class="est-tag">manual</span>' : '';
    return `<tr>
      <td data-label="Region">${blocNames[bloc]}${src}</td>
      <td class="num" data-label="Local"><span class="bloc-soft-label">Local </span>${localVals[bloc]}</td>
      <td class="num" data-label="USD"><span class="bloc-soft-label">USD </span>${usd != null ? `$${fmt(usd, 2)}T` : '—'}</td>
      <td class="num" data-label="YoY">${blocM2YoyHtml(manual, bloc)}</td>
      <td data-label="As of"><span class="bloc-soft-label">As of </span>${fmtMacroDate(date)} ${staleBadge(stale.level, stale.label)}</td>
    </tr>`;
  }).join('');

  const usM2 = ind.US_M2;
  const staleUsM2 = staleness(usM2?.date, 45, 90);
  const blocYoyNote = manual?.bloc_m2_yoy?.note
    || 'Year-over-year money growth in each region’s own currency.';

  let usYoySub = 'Live proxy for the inferred fiscal gap';
  if (usM2?.yoy_pct != null) {
    const acc = usM2.yoy_delta_pp;
    const accTxt = acc != null
      ? (acc > 0 ? ` · accelerating (+${acc.toFixed(1)} pp)` : acc < 0 ? ` · cooling (${acc.toFixed(1)} pp)` : ' · steady')
      : '';
    usYoySub = `<span class="${m2BandClass(usM2.yoy_pct)}">${usM2.yoy_pct >= 0 ? '+' : ''}${usM2.yoy_pct.toFixed(1)}% YoY</span>${accTxt} · live proxy for the inferred fiscal gap · ${fmtMacroDate(usM2.date)}`;
  } else if (usM2?.date) {
    usYoySub = `Live proxy for the inferred fiscal gap · ${fmtMacroDate(usM2.date)}`;
  }
  usYoySub += staleBadge(staleUsM2.level, staleUsM2.label);

  document.getElementById('pillar-monetary-body').innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      Stage 4 — the thesis <strong>output</strong>, not the claim. Read headline and fixed-FX first.
    </p>
    ${m2KpiHtml}
    <p class="desk-footnote">${histNote}</p>
    ${histFlags ? `<p class="desk-footnote desk-footnote--flags">Quality flags: ${histFlags}</p>` : ''}
    <div class="desk-block">
      <table class="bloc-table">
        <thead><tr>
          <th>Region</th>
          <th class="num">Local</th>
          <th class="num">USD</th>
          <th class="num">YoY</th>
          <th>As of</th>
        </tr></thead>
        <tbody>${blocRows}</tbody>
      </table>
    </div>
    <p class="desk-footnote">${blocYoyNote}</p>
    ${miniCard('US money supply', usM2?.value != null ? `$${fmt(usM2.value, 0)}B` : '—', usYoySub)}
  `;
}

function pathHeadwindCards(ind) {
  const netLiq = ind.US_NET_LIQ;
  const us10y = ind.US_10Y;
  const usdIdx = ind.USD_INDEX;
  const staleNet = staleness(netLiq?.date, 10, 20);
  const stale10y = staleness(us10y?.date, 5, 10);
  const staleUsd = staleness(usdIdx?.date, 5, 10);

  const nl = netLiq?.components || {};
  let netLiqSub = 'Fed − RRP − TGA · short-horizon liquidity (not M2)';
  if (nl.FED_BS_bn != null) {
    netLiqSub = [
      `Fed $${fmt(nl.FED_BS_bn, 0)}B − RRP $${fmt(nl.RRP_bn, 1)}B − TGA $${fmt(nl.TGA_bn, 0)}B`,
      'Short-horizon liquidity (not M2)',
      fmtMacroDate(netLiq?.date),
      staleBadge(staleNet.level, staleNet.label),
    ].filter(Boolean).join(' · ');
  } else if (netLiq?.date) {
    netLiqSub = `Short-horizon liquidity · ${fmtMacroDate(netLiq.date)}${staleBadge(staleNet.level, staleNet.label)}`;
  }

  let us10yValue = '—';
  let us10ySub = 'Path headwind · <4% easy · 4–5% grind · >5% tight';
  if (us10y?.value != null) {
    const y = us10y.value;
    let bandCls = 'neu';
    let bandTxt = '';
    if (y < 4) {
      bandCls = 'tone-green';
      bandTxt = 'Easy (<4%)';
    } else if (y <= 5) {
      bandCls = 'tone-amber';
      bandTxt = 'Grind (4–5%)';
    } else {
      bandCls = 'tone-red';
      bandTxt = 'Tight (>5%)';
    }
    us10yValue = `<span class="${bandCls}">${fmt(y, 2)}%</span>`;
    us10ySub = [
      bandTxt,
      'Path headwind · not an invalidation line',
      fmtMacroDate(us10y.date),
      staleBadge(stale10y.level, stale10y.label),
    ].filter(Boolean).join(' · ');
  }

  const usdSub = [
    'Fed broad · not DXY',
    'Path headwind with the 10Y',
    fmtMacroDate(usdIdx?.date),
    staleBadge(staleUsd.level, staleUsd.label),
  ].filter(Boolean).join(' · ');

  return { netLiq, us10yValue, us10ySub, usdIdx, usdSub, netLiqSub };
}

function renderPillarDedollar(prices, manual, macro) {
  const ind = macro?.indicators || {};
  const oas = ind.HY_OAS;
  const { netLiq, us10yValue, us10ySub, usdIdx, usdSub, netLiqSub } = pathHeadwindCards(ind);

  let oasTone = 'neu';
  let oasChip = 'green';
  let oasWord = 'Calm';
  if (oas?.value != null) {
    if (oas.value > 5) {
      oasTone = 'tone-red';
      oasChip = 'red';
      oasWord = 'Stress';
    } else if (oas.value > 4) {
      oasTone = 'tone-amber';
      oasChip = 'amber';
      oasWord = 'Watch';
    } else {
      oasTone = 'tone-green';
    }
  } else {
    oasWord = '—';
  }

  document.getElementById('pillar-dedollar-body').innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      Stage 2 — corporates compete for duration; the official bid for the long end is impaired.
      HY is the live credit tell. 10Y, the dollar, and net liquidity are <strong>path headwinds</strong>, not floor tests.
    </p>
    <div class="ai-status-bar">
      <div class="ai-status-item">
        <span class="ai-status-k">HY OAS</span>
        <span class="ai-status-v ${oasTone}">${oas?.value != null ? `${fmt(oas.value, 2)}%` : '—'}</span>
        <span class="status-chip chip-${oasChip}">${oasWord}</span>
      </div>
    </div>
    ${oasGaugeHtml(oas?.value)}
    <div class="mini-grid">
      ${miniCard('US net liquidity', netLiq?.value != null ? `$${fmt(netLiq.value, 0)}B` : '—', netLiqSub)}
      ${miniCard('US 10-year yield', us10yValue, us10ySub)}
      ${miniCard('US dollar (Fed broad)', usdIdx?.value != null ? fmt(usdIdx.value, 2) : '—', usdSub)}
    </div>
  `;
}

function goldAndMixHtml(prices, manual, macro) {
  const gold = prices?.prices?.XAUUSD;
  const price = gold?.price;
  const cb = manual?.cb_gold;
  const cofer = manual?.cofer_usd_share;
  const staleCb = staleness(cb?.updated || cb?.period, 120, 180);
  const staleCofer = staleness(cofer?.updated || cofer?.period, 120, 180);
  const sc = macro?.indicators?.STABLECOIN_MCAP;
  const rails = manual?.stablecoin_rails || {};
  const railsTarget = rails.target_bn ?? 500;

  const markers = [{ value: 4000, label: '$4,000', kind: 'below' }];
  const floor = cb?.floor_tonnes ?? 200;
  const q = cb?.quarterly_tonnes;
  const floorOk = q != null && q >= floor;
  const floorTone = floorOk ? 'green' : (q != null && q >= floor * 0.5 ? 'amber' : 'red');
  const floorPct = q != null ? Math.min(100, (q / (floor * 1.5)) * 100) : 0;
  const floorHtml = q != null
    ? meterHtml(floorPct, floorTone, `Floor ~${floor}t/qtr`, floorOk ? 'Bid intact' : 'Below floor')
    : '';

  const coferQ = cofer?.consecutive_rising_quarters;
  const coferPct = coferQ != null ? (coferQ / 4) * 100 : 0;
  const coferTone = coferQ == null ? '' : coferQ >= 4 ? 'red' : coferQ >= 1 ? 'amber' : 'green';
  const coferMeter = coferQ != null
    ? meterHtml(coferPct, coferTone, 'To reverse', coferQ >= 4 ? 'Trend break' : 'Noise until 4')
    : '';

  // Stablecoin rails path: live mcap vs mid-path $500B (thesis structural case is larger)
  let railsMeter = '';
  let railsSub = '';
  const clarityNote = rails.policy_note
    || 'Clarity Act (pending) would firm US rules for dollar rails.';
  if (sc?.value != null && railsTarget > 0) {
    const pctOfTarget = (sc.value / railsTarget) * 100;
    const tone = pctOfTarget >= 100 ? 'green' : pctOfTarget >= 50 ? 'amber' : '';
    const left = `$${fmt(sc.value, 0)}B now`;
    const right = `$${fmt(railsTarget, 0)}B ${rails.target_label || 'target'}`;
    railsMeter = meterHtml(Math.min(100, pctOfTarget), tone, left, right);
    const remain = Math.max(0, railsTarget - sc.value);
    railsSub = [
      remain > 0
        ? `$${fmt(remain, 0)}B to $${fmt(railsTarget, 0)}B mid-path (${pctOfTarget.toFixed(0)}%)`
        : 'Mid-path target reached',
      clarityNote,
      sc.date ? fmtMacroDate(sc.date) : null,
    ].filter(Boolean).join(' · ');
  } else {
    railsSub = [
      clarityNote,
      sc?.date ? fmtMacroDate(sc.date) : null,
    ].filter(Boolean).join(' · ');
  }

  return `
    ${assetQuoteHtml('XAUUSD', 'Gold', price, changePctOf(prices?.prices, 'XAUUSD'), gold, markers, 0, '$')}
    ${miniCard(
      'Central bank gold buying',
      q != null ? `${fmt(q, 0)} tonnes / qtr` : '—',
      [
        cb?.yoy_pct != null ? `${fmtPct(cb.yoy_pct, 0)} vs last year` : null,
        cb?.latest_monthly ? `Latest ${cb.latest_monthly.tonnes} t (${cb.latest_monthly.period})` : null,
        fmtMacroDate(cb?.period),
        staleBadge(staleCb.level, staleCb.label),
      ].filter(Boolean).join(' · '),
      'metric',
      floorHtml,
    )}
    ${miniCard(
      'Dollar rails (stablecoins)',
      sc?.value != null ? `$${fmt(sc.value, 1)}B` : '—',
      railsSub,
      'metric',
      railsMeter,
    )}
    <div class="cofer-strip">
      <div class="cofer-kv">
        <span class="cofer-k">USD share</span>
        <span class="cofer-v">${cofer?.usd_share_pct != null ? `${Number(cofer.usd_share_pct).toFixed(2)}%` : '—'}</span>
      </div>
      <div class="cofer-kv">
        <span class="cofer-k">Rising quarters</span>
        <span class="cofer-v">${coferQ != null ? `${coferQ} of 4` : '—'}</span>
      </div>
      <div class="cofer-strip-meter">${coferMeter}</div>
      <div class="cofer-strip-meta">
        4 in a row = reverse
        ${cofer?.period ? ` · ${cofer.period}` : ''}
        ${staleBadge(staleCofer.level, staleCofer.label)}
      </div>
    </div>
  `;
}

/**
 * Hyperscaler aggregate OCF vs cash capex (Epoch AI quarterly series).
 * Cash-only capex; finance leases excluded by design.
 * Layout: headline gap → dual compare bars → one meta line.
 */
function hyperscalerCashHtml(hs, staleMeta = '') {
  if (!hs || (hs.ocf_usd_b == null && hs.cash_capex_usd_b == null)) {
    return `<div class="hs-cash hs-cash--empty">
      <div class="field-label">Group cash buildout</div>
      <div class="field-value">—</div>
      <div class="field-meta">MSFT · AMZN · GOOGL · META · ORCL · Epoch / SEC</div>
    </div>`;
  }

  const ocf = hs.ocf_usd_b;
  const capex = hs.cash_capex_usd_b;
  const gap = hs.gap_usd_b != null
    ? hs.gap_usd_b
    : (ocf != null && capex != null ? ocf - capex : null);
  const crossed = hs.crossed != null
    ? !!hs.crossed
    : (gap != null ? gap < 0 : false);

  let gapTone = 'neu';
  if (gap != null) {
    if (gap < 0 || crossed) gapTone = 'tone-red';
    else if (gap < 20) gapTone = 'tone-amber';
    else gapTone = 'tone-green';
  }

  const chipStatus = crossed ? 'amber' : (gap != null && gap < 20 ? 'amber' : 'green');
  const chipLabel = crossed ? 'Cash crossed' : 'Cash covers capex';

  const gapStr = gap == null
    ? '—'
    : (gap >= 0 ? `+$${fmt(gap, 1)}B` : `−$${fmt(Math.abs(gap), 1)}B`);
  const gapHeadline = crossed
    ? `Capex exceeds OCF by ${gapStr.replace(/^−/, '')}`
    : `OCF still covers capex by ${gapStr}`;

  // Dual bars: both scaled to the larger of the two so you see which is bigger.
  let dual = '';
  if (ocf != null && capex != null) {
    const max = Math.max(ocf, capex, 1);
    const ocfW = Math.max(2, (ocf / max) * 100);
    const capW = Math.max(2, (capex / max) * 100);
    const capCls = crossed || capex >= ocf * 0.9 ? 'is-amber' : 'is-dim';
    dual = `<div class="hs-dual" role="img" aria-label="Operating cash flow $${fmt(ocf, 1)}B versus cash capex $${fmt(capex, 1)}B">
      <div class="hs-dual-row">
        <span class="hs-dual-k">Cash from ops</span>
        <div class="hs-dual-track"><div class="hs-dual-fill is-green" style="width:${ocfW.toFixed(1)}%"></div></div>
        <span class="hs-dual-v">$${fmt(ocf, 1)}B</span>
      </div>
      <div class="hs-dual-row">
        <span class="hs-dual-k">Cash capex</span>
        <div class="hs-dual-track"><div class="hs-dual-fill ${capCls}" style="width:${capW.toFixed(1)}%"></div></div>
        <span class="hs-dual-v">$${fmt(capex, 1)}B</span>
      </div>
    </div>`;
  }

  const q = hs.as_of_quarter || '—';
  const crossWhen = hs.epoch_crossover_quarter
    ? (crossed ? `Epoch marked cross ${hs.epoch_crossover_quarter}` : `Trend cross ~${hs.epoch_crossover_quarter}`)
    : '';
  const metaParts = [q, 'cash only · 5 names', crossWhen, staleMeta].filter(Boolean);

  return `<div class="hs-cash">
    <div class="hs-cash-head">
      <div class="field-label">Group cash buildout</div>
      <span class="status-chip chip-${chipStatus}">${chipLabel}</span>
    </div>
    <div class="hs-cash-headline ${gapTone}">${gapHeadline}</div>
    ${dual}
    <div class="field-meta">${metaParts.join(' · ')}</div>
  </div>`;
}

/** HY OAS 0–8% zone gauge for at-a-glance credit stress. */
function oasGaugeHtml(val) {
  // Scale is 0–8%. Zone edges: 4% = 50%, 5% = 62.5% of track width.
  const max = 8;
  const ticks = [
    { pct: 0, label: '0', cls: '' },
    { pct: (4 / max) * 100, label: '4%', cls: 'tone-green' },
    { pct: (5 / max) * 100, label: '5%', cls: 'tone-amber' },
    { pct: 100, label: '8%+', cls: 'tone-red' },
  ];
  const tickHtml = ticks.map(t =>
    `<span class="oas-tick-label ${t.cls}" style="left:${t.pct}%">${t.label}</span>`
  ).join('');

  if (val == null || isNaN(val)) {
    return `<div class="oas-gauge">
      <div class="oas-gauge-track oas-gauge-track--empty">
        <div class="oas-zone oas-zone-calm" style="width:50%"></div>
        <div class="oas-zone oas-zone-watch" style="width:12.5%"></div>
        <div class="oas-zone oas-zone-stress" style="width:37.5%"></div>
      </div>
      <div class="oas-gauge-labels">${tickHtml}</div>
    </div>`;
  }
  const pct = Math.min(100, Math.max(0, (val / max) * 100));
  const zone = val > 5 ? 'stress' : val > 4 ? 'watch' : 'calm';
  const zoneWord = zone === 'stress' ? 'stress' : zone === 'watch' ? 'watch' : 'calm';
  const tip = `HY OAS ${val.toFixed(2)}% · ${zoneWord}`;
  return `<div class="oas-gauge">
    <div class="oas-gauge-track">
      <div class="oas-zone oas-zone-calm" style="width:50%"></div>
      <div class="oas-zone oas-zone-watch" style="width:12.5%"></div>
      <div class="oas-zone oas-zone-stress" style="width:37.5%"></div>
      <div class="oas-marker oas-marker--${zone}" style="left:${pct.toFixed(1)}%" data-tooltip="${tip}" role="img" aria-label="${tip}"></div>
    </div>
    <div class="oas-gauge-labels">${tickHtml}</div>
  </div>`;
}

function renderPillarAi(ind, manual) {
  const ai = manual?.ai_transition || {};
  const hs = ai.hyperscaler_cash || {};
  const oas = ind.HY_OAS;
  // Prefer Epoch source date for cash series; fall back to block updated.
  const staleAi = staleness(hs.source_updated || ai.updated, 45, 90);

  const cuts = !!ai.capex_cuts;
  const gap = hs.gap_usd_b;
  // Top bar reflects market funding + cuts only. Thin cash gap lives on the card.
  // HY OAS itself lives on the Credit desk; this chip is the derived funding read.
  const cashCrossed = !!(hs.crossed || (gap != null && gap < 0));
  let financeStatus = 'green';
  let financeLabel = 'Funding calm';
  if (oas?.value != null && oas.value > 5 && cuts) {
    financeStatus = 'red';
    financeLabel = 'Funding break risk';
  } else if ((oas?.value != null && oas.value > 4) || cuts || cashCrossed) {
    financeStatus = 'amber';
    if (cuts) financeLabel = 'Watch — capex cuts';
    else if (oas?.value != null && oas.value > 4) financeLabel = 'Watch — spreads';
    else financeLabel = 'Watch — cash cross';
  }

  const nextMeta = [staleBadge(staleAi.level, staleAi.label)].filter(Boolean).join(' · ');

  document.getElementById('pillar-ai-body').innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      Force A — a <strong>capability ladder</strong>: intelligence per dollar compounds, then knowledge work, then labour.
      Cost slopes are evidence the ladder is still compounding. Cash-cross is near-term path, not a floor test.
    </p>
    <div class="ai-status-bar">
      <div class="ai-status-item">
        <span class="ai-status-k">Financing</span>
        <span class="status-chip chip-${financeStatus}">${financeLabel}</span>
      </div>
      <div class="ai-status-item">
        <span class="ai-status-k">Capex cuts</span>
        <span class="status-chip chip-${cuts ? 'amber' : 'green'}">${cuts ? 'Yes' : 'No'}</span>
      </div>
    </div>
    <div class="ai-split">
      <div class="ai-col" role="region" aria-labelledby="ai-struct-title">
        <h3 class="ai-col-title" id="ai-struct-title">Structural — the ladder</h3>
        <div class="field-stack">
          ${fieldBlock('Cost trends', ai.structural_slopes || '—', 'Epoch slopes · not a 2026 print', true)}
        </div>
      </div>
      <div class="ai-col" role="region" aria-labelledby="ai-path-title">
        <h3 class="ai-col-title" id="ai-path-title">Near term — buildout (path)</h3>
        <div class="field-stack">
          ${hyperscalerCashHtml(hs, staleBadge(staleAi.level, staleAi.label))}
        </div>
      </div>
    </div>
    <div class="ai-foot">
      ${ai.crossover_status
        ? fieldBlock('Company notes', ai.crossover_status, nextMeta, true)
        : ''}
      ${fieldBlock('Next test', ai.next_test || '—', '', true)}
    </div>
  `;
}

/** Format ETF flow dollars for display (M or B). */
function fmtFlowUsd(m) {
  if (m == null || isNaN(m)) return '—';
  if (Math.abs(m) >= 1000) {
    const b = m / 1000;
    return `${b >= 0 ? '+' : ''}${b.toFixed(2)}B`;
  }
  return `${m >= 0 ? '+' : ''}${m.toFixed(1)}M`;
}

/** Dual horizontal bars: this week vs prior week (USD millions). */
function etfFlowChartHtml(etf) {
  if (!etf || (etf.net_usd_m == null && etf.net_usd_bn == null)) {
    return '<div class="btc-cell-empty">No flow data</div>';
  }
  const thisM = etf.net_usd_m != null ? etf.net_usd_m : etf.net_usd_bn * 1000;
  const priorM = etf.prior_week_usd_m != null ? etf.prior_week_usd_m : null;
  const scale = Math.max(50, Math.abs(thisM), priorM != null ? Math.abs(priorM) : 0) * 1.15;

  function row(label, m) {
    if (m == null || isNaN(m)) return '';
    const pct = Math.min(100, (Math.abs(m) / scale) * 100);
    return `<div class="flow-row">
      <span class="flow-row-label">${label}</span>
      <div class="flow-track" title="${fmtFlowUsd(m)}">
        <div class="flow-half flow-half-out">
          ${m < 0 ? `<div class="flow-bar flow-bar-out" style="width:${pct}%"></div>` : ''}
        </div>
        <div class="flow-zero"></div>
        <div class="flow-half flow-half-in">
          ${m >= 0 ? `<div class="flow-bar flow-bar-in" style="width:${pct}%"></div>` : ''}
        </div>
      </div>
      <span class="flow-row-val ${m >= 0 ? 'pos' : 'neg'}">${fmtFlowUsd(m)}</span>
    </div>`;
  }

  const read = thisM >= 0 ? 'With liquidity' : 'Against liquidity';
  return `<div class="flow-chart">
    ${row('Week', thisM)}
    ${priorM != null ? row('Prior', priorM) : ''}
    <div class="flow-axis"><span>Out</span><span>0</span><span>In</span></div>
    <div class="btc-cell-meta">${read}${etf.period ? ` · ${etf.period}` : ''}</div>
  </div>`;
}

function renderPillarHardMoney(prices, macro, manual) {
  const p = prices?.prices || {};
  const fg = macro?.indicators?.FEAR_GREED;
  const divStart = manual?.divergence?.start;
  const months = monthsSince(divStart);
  const etf = manual?.etf_flows;
  const tx = buildTransmission(macro, prices);

  const btcMarkers = [
    { value: 53000, label: '$53k', kind: 'below' },
    { value: 70000, label: '$70k', kind: 'above' },
  ];

  // Divergence cell — multi-year global M2 destination; short-run pipe is ETF
  let divValueHtml;
  const divMeta = 'Global M2 is stage 4 · ETF = short-run channel · 18 mo = invalidation';
  if (divStart == null) {
    divValueHtml = '<span class="pos">Back in sync</span>';
  } else if (months == null) {
    divValueHtml = '<span class="neu">—</span>';
  } else {
    const tone = months >= 18 ? 'tone-red' : months >= 12 ? 'tone-amber' : 'tone-green';
    divValueHtml = `<span class="${tone}">${months} mo</span> <span class="neu">/ 18</span>`;
  }
  const divTrackOnly = (() => {
    if (divStart == null) {
      return `<div class="div-clock-track"><div class="div-clock-ticks" aria-hidden="true">
        <span class="div-clock-tick" style="left:66.67%"></span>
        <span class="div-clock-tick" style="left:100%"></span>
      </div><div class="div-clock-fill fill-green" style="width:2%"></div></div>`;
    }
    if (months == null) return '';
    const pct = Math.min(100, (months / 18) * 100);
    const tone = months >= 18 ? 'red' : months >= 12 ? 'amber' : 'green';
    return `<div class="div-clock-track"><div class="div-clock-ticks" aria-hidden="true">
      <span class="div-clock-tick" style="left:66.67%" title="12 months"></span>
      <span class="div-clock-tick" style="left:100%" title="18 months"></span>
    </div><div class="div-clock-fill fill-${tone}" style="width:${pct.toFixed(1)}%"></div></div>`;
  })();

  // Fear & Greed cell
  const fgVal = fg?.value;
  const fgCls = fgColorClass(fgVal);
  const fgValueHtml = fgVal != null
    ? `<span class="${fgCls}">${fgVal}</span> <span class="fg-inline-sub">${fg?.classification || ''}</span>`
    : '<span class="neu">—</span>';

  const wti = p.WTI;
  const vix = p.VIX;
  const wtiAlert = wti?.price != null && wti.price > 95;
  const vixAlert = vix?.price != null && vix.price > 30;
  const wtiVal = wti?.price != null
    ? `<span class="${wtiAlert ? 'tone-amber' : ''}">${fmt(wti.price, 2, '$')}</span>`
    : '—';
  const vixVal = vix?.price != null
    ? `<span class="${vixAlert ? 'tone-amber' : ''}">${fmt(vix.price, 1)}</span>`
    : '—';
  const wtiMeta = [
    fmtPct(changePctOf(p, 'WTI'), 2),
    'oil / inflation',
    'alert &gt;$95',
    'shock &gt;$120',
  ].join(' · ');
  const vixMeta = [
    fmtPct(changePctOf(p, 'VIX'), 2),
    'equity vol',
    'alert &gt;30',
  ].join(' · ');
  const riskFoot = `
    <div class="hm-foot">
      <div class="desk-foot-kicker">Macro risk · not the sink</div>
      ${fieldBlock('WTI', wtiVal, wtiMeta)}
      ${fieldBlock('VIX', vixVal, vixMeta)}
    </div>`;

  document.getElementById('pillar-hardmoney-body').innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      Stage 5 — the <strong>sink</strong>. Official bid (CB gold, COFER, rails) and private run (BTC floors, ETF, lag).
      Oil and vol are footnotes.
    </p>
    <div class="ai-split hm-split">
      <div class="ai-col" role="region" aria-labelledby="hm-official-title">
        <h3 class="ai-col-title" id="hm-official-title">Official bid</h3>
        <div class="hm-stack">
          ${goldAndMixHtml(prices, manual, macro)}
        </div>
      </div>
      <div class="ai-col" role="region" aria-labelledby="hm-private-title">
        <h3 class="ai-col-title" id="hm-private-title">Private run</h3>
        <div class="hm-stack">
          ${assetQuoteHtml('BTC', 'Bitcoin', p.BTC?.price, changePctOf(p, 'BTC'), p.BTC, btcMarkers, 0, '$')}
          <div>
            <div class="btc-cell-label">Spot ETF flows</div>
            <div class="btc-cell-visual btc-cell-visual--flow">${etfFlowChartHtml(etf)}</div>
          </div>
          <div class="hm-pair">
            <div>
              <div class="btc-cell-label">Fear &amp; Greed Index</div>
              <div class="btc-cell-value">${fgValueHtml}</div>
              <div class="btc-cell-visual">${fgBarHtml(fgVal)}</div>
            </div>
            <div>
              <div class="btc-cell-label">Lag clock (global M2)</div>
              <div class="btc-cell-value">${divValueHtml}</div>
              <div class="btc-cell-visual">${divTrackOnly}</div>
              <div class="btc-cell-meta">${divMeta}</div>
            </div>
          </div>
          ${transmissionHtml(tx)}
        </div>
      </div>
    </div>
    ${riskFoot}
  `;
}

function renderPillars(prices, macro, manual) {
  const ind = macro?.indicators || {};
  renderPillarAi(ind, manual);
  renderPillarDedollar(prices, manual, macro);
  renderPillarMonetary(ind, manual);
  renderPillarHardMoney(prices, macro, manual);
}

function spineTone(st) {
  if (st === 'red') return 'tone-red';
  if (st === 'amber') return 'tone-amber';
  return 'tone-green';
}

function spineStatusWord(st) {
  if (st === 'red') return 'broken';
  if (st === 'amber') return 'watching';
  return 'clear';
}

function spineCell(kind, kicker, title, sub, status, target) {
  const word = spineStatusWord(status);
  const tone = spineTone(status);
  return `<button type="button" class="spine-cell spine-${kind}" data-target="${target}">
    <span class="spine-cell-id">${kicker}</span>
    <span class="spine-cell-title">${title}</span>
    <span class="spine-cell-sub">${sub}</span>
    <span class="spine-cell-st ${tone}">${word}</span>
  </button>`;
}

function renderSpine(prices, macro, manual) {
  const el = document.getElementById('spine-body');
  if (!el) return;
  const triggers = buildTriggers(prices, macro, manual);
  const stOf = (id) => {
    const row = triggers.find(t => t.id === id);
    return row ? row.status() : 'green';
  };
  const cuts = !!manual?.ai_transition?.capex_cuts;
  const forceA = cuts ? 'amber' : 'green';
  const mix = worstStatus(stOf('gold_hedge'), worstStatus(stOf('btc_demand'), stOf('cofer')));

  el.innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      AI cheapens knowledge work, then labour, and that makes existing public debt harder to service in real terms.
      At the same time, surplus countries no longer warehouse other people’s long government bonds the way they used to.
      Either pressure ends in more money, or in official gold — and both show up in gold and bitcoin.
    </p>
    <div class="spine-inflows">
      ${spineCell('inflow', 'A', 'AI capability ladder', 'Knowledge work → robotics / OTA labour', forceA, 'pillar-ai')}
      ${spineCell('inflow', 'B', 'No duration left', 'Demographics → seizure risk → no bid for long bonds', stOf('cofer'), 'pillar-dedollar')}
    </div>
    <p class="spine-hinge">both hit the hinge</p>
    <div class="spine-stages">
      ${spineCell('stage', '2', 'Credit &amp; long end', 'HY · 10Y · $ · net liq', stOf('ai_financing'), 'pillar-dedollar')}
      ${spineCell('stage', '3', 'Fiscal gap', 'Inferred — receipts vs interest', 'amber', 'pillar-monetary')}
      ${spineCell('stage', '4', 'Money', 'Global M2 output', stOf('global_m2'), 'pillar-monetary')}
      ${spineCell('stage', '5', 'Gold + BTC', 'Official bid and private run', mix, 'pillar-hardmoney')}
    </div>
  `;
}

function setupSpineJump() {
  const root = document.getElementById('spine-body');
  if (!root) return;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-target]');
    if (!btn) return;
    const dest = document.getElementById(btn.getAttribute('data-target'));
    if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Default A–D book if manual.scenario.book is missing. */
function defaultScenarioBook() {
  return [
    { id: 'A', name: 'Liquidity relink', p: 30 },
    { id: 'B', name: 'Hawkish grind', p: 40 },
    { id: 'C', name: 'Credit scare', p: 20 },
    { id: 'D', name: 'Geo shock', p: 10 },
  ];
}

function resolveActiveScenarioId(scenario) {
  if (scenario?.active_id) return String(scenario.active_id).toUpperCase();
  const c = String(scenario?.current || '');
  const m = c.match(/^\s*([A-Da-d])\b/);
  if (m) return m[1].toUpperCase();
  return 'B';
}

/**
 * Auto waypoint status from live desk data.
 * Manual override: set waypoint.status and waypoint.lock = true.
 */
function resolveWaypointStatus(wp, prices, macro, manual) {
  if (wp?.lock && wp.status) return String(wp.status).toLowerCase();

  const p = prices?.prices || {};
  const btc = p.BTC;
  const gold = p.XAUUSD;
  const btcPx = btc?.weekly_close ?? btc?.price;
  const goldMonth = gold?.monthly_close;
  const goldLive = gold?.price;
  const goldRef = goldMonth ?? goldLive;
  const divMonths = monthsSince(manual?.divergence?.start);
  const id = wp?.id;

  if (id === 'btc_band') {
    if (btcPx == null) return wp.status || 'approaching';
    if (btcPx >= 50000 && btcPx <= 70000) return 'hit';
    if (btcPx >= 45000 && btcPx <= 80000) return 'approaching';
    return 'miss';
  }
  if (id === 'gold_line') {
    if (goldRef == null) return wp.status || 'approaching';
    if (goldRef < 4000) return 'miss';
    // Inside the grind test zone around the line
    if (goldRef <= 4300) return 'approaching';
    return 'hit';
  }
  if (id === 'divergence') {
    if (manual?.divergence?.start == null) return 'hit'; // clock reset = path healed
    if (divMonths == null) return wp.status || 'approaching';
    if (divMonths >= 18) return 'miss';
    if (divMonths >= 15) return 'hit'; // reached the 15–18 adjudication zone
    if (divMonths >= 12) return 'approaching';
    return 'approaching';
  }
  if (id === 'floors') {
    const btcOk = btcPx == null ? null : btcPx >= 53000;
    const goldOk = goldRef == null ? null : goldRef >= 4000;
    if (btcOk === false || goldOk === false) return 'miss';
    if (btcOk === true && goldOk === true) {
      // Soft stress if close to either line
      const btcNear = btcPx < 60950;
      const goldNear = goldRef < 4200;
      return (btcNear || goldNear) ? 'approaching' : 'hit';
    }
    return wp.status || 'approaching';
  }

  const st = (wp?.status || 'approaching').toLowerCase();
  if (st === 'hit' || st === 'miss' || st === 'approaching' || st === 'near') {
    return st === 'near' ? 'approaching' : st;
  }
  return 'approaching';
}

function waypointStatusLabel(st) {
  if (st === 'hit') return 'on path';
  if (st === 'miss') return 'off';
  return 'watch';
}

function scenarioBookHtml(scenario) {
  const book = Array.isArray(scenario?.book) && scenario.book.length
    ? scenario.book
    : defaultScenarioBook();
  const active = resolveActiveScenarioId(scenario);
  return `<div class="scenario-strip" role="list" aria-label="Scenario probabilities">
    ${book.map(s => {
      const id = String(s.id || '').toUpperCase();
      const isActive = id === active;
      const tone = scenarioClass(id);
      const p = s.p != null ? s.p : null;
      return `<div class="scenario-chip${isActive ? ' is-active' : ''} scenario-tone-${tone}" role="listitem"${isActive ? ' aria-current="true"' : ''}>
        <div class="scenario-chip-top">
          <span class="scenario-chip-id">${id}</span>
          ${isActive ? `<span class="scenario-chip-badge">${id === 'B' ? 'book base' : 'active'}</span>` : ''}
        </div>
        <span class="scenario-chip-name">${s.name || id}</span>
        <span class="scenario-chip-p">${p != null ? `${p}%` : '—'}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderScenarioContext(manual, prices, macro, tally) {
  const shell = document.getElementById('context-block');
  const body = document.getElementById('context-body');
  const title = document.getElementById('context-title');
  if (!shell || !body) return;

  const scenario = manual?.scenario || {};
  const hasBook = Array.isArray(scenario.book) && scenario.book.length;
  const hasNotes = !!scenario.notes;
  const hasBullets = Array.isArray(manual?.regime_bullets) && manual.regime_bullets.length;
  const hasWps = Array.isArray(scenario.waypoints) && scenario.waypoints.length;
  const hasRescore = Array.isArray(scenario.rescore_if) && scenario.rescore_if.length;
  const hasNext = !!scenario.next_check;
  const hasTally = tally && (tally.green + tally.amber + tally.red) > 0;

  const show = hasBook || hasNotes || hasBullets || hasWps || hasRescore || hasNext || hasTally;
  shell.hidden = !show;
  if (!show) {
    body.innerHTML = '';
    return;
  }

  const activeId = resolveActiveScenarioId(scenario);
  const contextPanel = document.getElementById('panel-context');
  if (contextPanel) {
    const tone = scenarioClass(activeId);
    contextPanel.classList.remove('bull', 'base', 'bear', 'tail');
    contextPanel.classList.add(tone);
  }
  const activeEntry = (scenario.book || defaultScenarioBook())
    .find(s => String(s.id).toUpperCase() === activeId);
  const titleText = scenario.current
    || (activeEntry ? `${activeId} — ${activeEntry.name}` : 'Scenario context');
  if (title) {
    const stale = staleness(scenario.updated, 21, 45);
    const badge = staleBadge(stale.level, stale.label);
    title.innerHTML = `${titleText}${badge ? ` ${badge}` : ''}`;
  }

  const parts = [];

  // 1. Lead judgment (same visual language as pillar leads)
  if (hasNotes) {
    parts.push(`<p class="desk-footnote desk-footnote--lead">${scenario.notes}</p>`);
  }

  // 2. Probability strip in a desk inset
  parts.push(`<div class="desk-block context-desk">
    <div class="context-desk-head">
      <span class="context-desk-title">Book</span>
      <span class="context-desk-meta">H2 2026 – 2027</span>
    </div>
    ${scenarioBookHtml(scenario)}
  </div>`);

  // 3. Two-column: path waypoints | re-score + next check
  const midCols = [];

  if (hasWps) {
    const rows = scenario.waypoints.map(w => {
      const st = resolveWaypointStatus(w, prices, macro, manual);
      const cls = st === 'hit' ? 'is-hit' : st === 'miss' ? 'is-miss' : 'is-approaching';
      return `<div class="waypoint-row">
        <span class="waypoint-status ${cls}">${waypointStatusLabel(st)}</span>
        <span class="waypoint-label">${w.label || w.id || '—'}</span>
      </div>`;
    }).join('');
    midCols.push(`<div class="context-col">
      <div class="context-col-title">Path · ${activeId}</div>
      <div class="waypoints-list">${rows}</div>
    </div>`);
  }

  if (hasRescore || hasNext) {
    let inner = '';
    if (hasRescore) {
      inner += `<ul class="rescore-list">${scenario.rescore_if.map(r => {
        // Split "A — reason" for denser scan when present
        const m = String(r).match(/^([A-D])\s*[—–-]\s*(.+)$/i);
        if (m) {
          return `<li><span class="rescore-id">${m[1].toUpperCase()}</span><span class="rescore-txt">${m[2]}</span></li>`;
        }
        return `<li><span class="rescore-txt">${r}</span></li>`;
      }).join('')}</ul>`;
    }
    if (hasNext) {
      inner += `<div class="context-next">
        <span class="context-next-k">Next</span>
        <span class="context-next-v">${scenario.next_check}</span>
      </div>`;
    }
    midCols.push(`<div class="context-col">
      <div class="context-col-title">Re-score if</div>
      ${inner}
    </div>`);
  }

  if (midCols.length) {
    parts.push(`<div class="context-split">${midCols.join('')}</div>`);
  }

  // 4. Compact footer: regime bullets + live tally
  const bullets = [];
  if (hasBullets) {
    for (const b of manual.regime_bullets) {
      if (/watchpoint/i.test(b)) continue;
      bullets.push(b);
    }
  }
  let tallyHtml = '';
  if (hasTally) {
    const total = tally.green + tally.amber + tally.red;
    const bits = [];
    if (tally.red > 0) bits.push(`<span class="tone-red">${tally.red} broken</span>`);
    if (tally.amber > 0) bits.push(`<span class="tone-amber">${tally.amber} watching</span>`);
    bits.push(`<span class="tone-green">${tally.green} clear</span>`);
    tallyHtml = `<div class="context-tally">
      <span class="context-tally-k">Watchpoints</span>
      <span class="context-tally-v">${bits.join('<span class="tally-sep">·</span>')}</span>
      <span class="context-tally-n">of ${total}</span>
    </div>`;
  }
  if (bullets.length || tallyHtml) {
    const list = bullets.length
      ? `<ul class="regime-bullets">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
      : '';
    parts.push(`<div class="context-footer">
      ${list}
      ${tallyHtml}
    </div>`);
  }

  body.innerHTML = parts.join('');
}

// ─── Thesis markdown ──────────────────────────────────────────────────────────

async function renderMarkdownDoc(url, elId, fallback) {
  const el = document.getElementById(elId);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status}`);
    el.innerHTML = mdToHtml(await resp.text());
  } catch {
    el.innerHTML = `<p class="neu">${fallback}</p>`;
  }
}

async function renderThesis() {
  renderMarkdownDoc(DATA.thesis, 'thesis-content', 'Thesis document not yet written. Check back soon.');
  renderMarkdownDoc(DATA.m2note, 'm2-note-content', 'Notes not yet written. Check back soon.');
}

function mdToHtml(md) {
  md = md.replace(/^(\|.+\|)\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm, (_, header, body) => {
    const headers = header.trim().replace(/^\||\|$/g, '').split('|').map(h => h.trim());
    const parseHeaderRow = (row) =>
      '<tr>' + row.trim().replace(/^\||\|$/g, '').split('|')
        .map(cell => `<th>${cell.trim()}</th>`).join('') + '</tr>';
    const parseBodyRow = (row) =>
      '<tr>' + row.trim().replace(/^\||\|$/g, '').split('|')
        .map((cell, i) => `<td data-label="${headers[i] || ''}">${cell.trim()}</td>`).join('') + '</tr>';
    const headerHtml = parseHeaderRow(header);
    const bodyHtml = body.trim().split('\n').map(r => parseBodyRow(r)).join('');
    return `<table class="thesis-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
  });

  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/^> (.+)$/gm,   '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hbuol])(.+)/, '<p>$1')
    .replace(/(.+)(?!>)$/, '$1</p>');
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function renderFooter(prices, macro, manual) {
  document.getElementById('footer-prices-ts').textContent   = fmtTs(prices?.updated_at);
  document.getElementById('footer-macro-ts').textContent    = fmtTs(macro?.updated_at);
  document.getElementById('footer-assessed-ts').textContent = fmtDate(manual?.scenario?.updated);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/** Keep body clear of the fixed status bar (especially when it wraps on mobile). */
function setupStatusBarOffset() {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  const apply = () => {
    const h = Math.ceil(bar.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty('--status-bar-h', `${h}px`);
    }
  };
  apply();
  requestAnimationFrame(apply);
  window.addEventListener('resize', apply, { passive: true });
  window.addEventListener('orientationchange', apply, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(apply).observe(bar);
  }
}

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.json();
}

async function init() {
  let prices = {}, macro = {}, manual = {}, alerts = {};

  const [pricesResult, macroResult, manualResult, alertsResult] = await Promise.allSettled([
    fetchJson(DATA.prices),
    fetchJson(DATA.macro),
    fetchJson(DATA.manual),
    fetchJson(DATA.alerts),
  ]);

  if (pricesResult.status === 'fulfilled') prices = pricesResult.value;
  else console.warn('prices.json failed:', pricesResult.reason);

  if (macroResult.status === 'fulfilled') macro = macroResult.value;
  else console.warn('macro.json failed:', macroResult.reason);

  // Prefer live manual.json; fall back to macro passthrough
  if (manualResult.status === 'fulfilled') manual = manualResult.value;
  else if (macro?.indicators?.MANUAL) manual = macro.indicators.MANUAL;
  else console.warn('manual.json failed:', manualResult.reason);

  if (alertsResult.status === 'fulfilled') alerts = alertsResult.value;
  else console.warn('alerts.json failed:', alertsResult.reason);

  void alerts; // reserved for future alert overlays

  const tally = renderTriggers(prices, macro, manual);
  renderStatusBar(manual, macro, tally);
  renderSpine(prices, macro, manual);
  renderScenarioContext(manual, prices, macro, tally);
  renderPillars(prices, macro, manual);
  renderFooter(prices, macro, manual);
  renderThesis();
  setupTriggerScroll();
  setupSpineJump();
  setupStatusBarOffset();

  // Console fixture check for July 2026 expected tally
  console.info(`Trigger tally: ${tally.green} green · ${tally.amber} amber · ${tally.red} red`);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
}

document.addEventListener('DOMContentLoaded', init);
