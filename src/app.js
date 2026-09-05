'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const DATA = {
  prices: '../data/prices.json',
  macro:  '../data/macro.json',
  manual: '../data/manual.json',
  alerts: '../data/alerts.json',
  etf_flows: '../data/etf_flows.json',
  thesis: '../docs/thesis.md',
  m2note: '../docs/m2_note.md',
};

/** Floor lines. `alerts.json` + optional `manual.btc_realized_floor` overlay at init. */
let FLOORS = {
  btcBelow: 53000,
  goldBelow: 4000,
  wtiAbove: 120,
  wtiWatch: 100,
  lagAmber: 12,
  lagRed: 18,
  oasWatch: 4,
  oasBreak: 5,
};

/** Path-book marks (thesis §10). Used for range ticks and unlocked waypoints. */
const PATH_MARKS = {
  A: { btc: [75000, 95000], gold: 4400 },
  B: { btc: [50000, 70000], gold: 4000, goldFire: 4300 },
  C: { btc: [50000, 70000], gold: 4000, goldFire: 4300 },
  D: { btc: [50000, 70000], gold: 4000, goldFire: 4300 },
};

function applyFloors(alerts, manual) {
  if (alerts?.BTC?.below != null && !isNaN(Number(alerts.BTC.below))) {
    FLOORS.btcBelow = Number(alerts.BTC.below);
  }
  if (alerts?.XAUUSD?.below != null && !isNaN(Number(alerts.XAUUSD.below))) {
    FLOORS.goldBelow = Number(alerts.XAUUSD.below);
  }
  if (alerts?.WTI?.above != null && !isNaN(Number(alerts.WTI.above))) {
    FLOORS.wtiAbove = Number(alerts.WTI.above);
  }
  const realized = manual?.btc_realized_floor?.value;
  if (realized != null && !isNaN(Number(realized))) {
    FLOORS.btcBelow = Number(realized);
  }
}

function btcAmberLine() {
  return FLOORS.btcBelow * 1.15;
}

function currentYearMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

/** Last finished monthly close — ignore the open Yahoo month bar. */
function completedMonthly(entry) {
  const asOf = entry?.monthly_close_as_of || null;
  const close = entry?.monthly_close ?? null;
  const open = !!(asOf && asOf === currentYearMonth());
  return { value: open ? null : close, asOf, mtd: open ? close : null, open };
}

function oilWeekStreak(wti) {
  const series = Array.isArray(wti?.weekly_series) ? wti.weekly_series : [];
  let n = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].close > FLOORS.wtiAbove) n += 1;
    else break;
  }
  return n;
}

function quartersBehind(asOf) {
  const m = String(asOf || '').match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const now = new Date();
  const nowQ = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
  const thenQ = Number(m[1]) * 4 + (Number(m[2]) - 1);
  return nowQ - thenQ;
}

function etfWeekEnd(etf) {
  if (!etf) return null;
  if (etf.week_ending) return etf.week_ending;
  const p = String(etf.period || '');
  const m = p.match(/^(\d{4}-\d{2}-)(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}${m[3]}`;
  return etf.updated || null;
}

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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sibling-chrome tooltip (liquidity-monitor desk-tip): title, body, extra lines. */
function deskTip(title, body, extra) {
  const extras = Array.isArray(extra) ? extra.filter(Boolean) : (extra ? [extra] : []);
  const extraHtml = extras.map(line => `<span class="desk-tip-extra">${escapeHtml(line)}</span>`).join('');
  const bodyHtml = body ? `<span class="desk-tip-body">${escapeHtml(body)}</span>` : '';
  return `<span class="desk-tip" role="tooltip"><span class="desk-tip-title">${escapeHtml(title)}</span>${bodyHtml}${extraHtml}</span>`;
}

function tipEdge(pct) {
  if (pct <= 18) return ' tip-start';
  if (pct >= 82) return ' tip-end';
  return '';
}

function meterHtml(pct, tone, leftLabel, rightLabel, tip) {
  const p = Math.min(100, Math.max(0, pct));
  const toneCls = tone ? ` is-${tone}` : '';
  const inner = `<div class="meter-track"><div class="meter-fill${toneCls}" style="width:${p.toFixed(1)}%"></div></div>
    <div class="meter-meta"><span>${leftLabel}</span><span>${rightLabel}</span></div>`;
  if (!tip || !tip.title) {
    return `<div class="meter-block"><div class="meter">${inner}</div></div>`;
  }
  const aria = [tip.title, tip.body].filter(Boolean).join('. ');
  return `<div class="meter-block">
    <button type="button" class="has-tip meter-hit" aria-label="${escapeHtml(aria)}">
      <div class="meter">${inner}</div>
      ${deskTip(tip.title, tip.body, tip.extra)}
    </button>
  </div>`;
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
  const curYm = currentYearMonth();
  const seen = new Set();
  const periods = [];
  for (const e of btcSeries) {
    const p = e.period;
    if (!p || p === curYm || m2Map[p] == null || seen.has(p)) continue;
    seen.add(p);
    periods.push(p);
  }
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
  const cells = tx.months.map((m, i) => {
    const edge = i === 0 ? ' tip-start' : (i >= n - 2 ? ' tip-end' : '');
    const body = m.state === 'agree' ? 'Same direction' : m.state === 'disagree' ? 'Opposite direction' : 'Flat month skipped';
    return `<button type="button" class="has-tip tx-month ${m.state}${edge}" aria-label="${escapeHtml(m.title || m.period)}">
      ${m.label}${deskTip(m.label, body, m.title)}
    </button>`;
  }).join('');
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
  const rank = { red: 3, amber: 2, green: 1, unknown: 0, null: -1, undefined: -1 };
  let best = 'unknown';
  let bestRank = -1;
  for (const s of statuses) {
    const r = Object.prototype.hasOwnProperty.call(rank, s) ? rank[s] : -1;
    if (r > bestRank) {
      bestRank = r;
      best = s;
    }
  }
  return best;
}

function statusChip(status) {
  const s = status || 'unknown';
  const labels = { green: 'clear', amber: 'watching', red: 'broken', unknown: 'no data' };
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
  const lastGood = manual?.global_m2_yoy_estimate || null;
  if (gy && Object.prototype.hasOwnProperty.call(gy, 'headline_pct')) {
    const computed = gy.headline_pct;
    if (computed != null && !isNaN(computed)) {
      return {
        value: computed,
        estimated: !!(gy.provisional || gy.estimated),
        sourceDate: gy.as_of_period,
        fxAdjusted: gy.fx_adjusted_pct,
        provisional: !!gy.provisional,
        withheld: false,
        scopeNote: gy.scope_note || '',
        lastGood,
      };
    }
    // Pipeline withheld (e.g. 4bloc vs 5bloc) — do not serve a different vintage as live.
    return {
      value: null,
      estimated: false,
      sourceDate: gy.as_of_period,
      fxAdjusted: null,
      provisional: true,
      withheld: true,
      scopeNote: gy.scope_note || gy.history_note || 'Headline YoY withheld',
      lastGood,
    };
  }
  const est = lastGood?.value;
  if (est != null && !isNaN(est)) {
    return {
      value: est,
      estimated: true,
      sourceDate: lastGood.updated,
      fxAdjusted: null,
      provisional: false,
      withheld: false,
      scopeNote: '',
      lastGood,
    };
  }
  return {
    value: null, estimated: false, sourceDate: null, fxAdjusted: null,
    provisional: false, withheld: false, scopeNote: '', lastGood,
  };
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
    const label = mk.label || fmtRangeVal(mk.value);
    const isThreshold = mk.kind === 'below' || mk.kind === 'above';
    const tickCls = `has-tip range-tick${isThreshold ? '' : ' is-mark'}${tipEdge(tp * 100)}`;
    const labCls = isThreshold ? 'range-mark-label is-threshold' : 'range-mark-label';
    const tipTitle = mk.tipTitle || label;
    const tipBody = mk.tipBody || (mk.kind === 'below' ? 'Invalidation floor' : 'Path mark');
    const aria = mk.tipBody ? `${tipTitle}. ${mk.tipBody}` : tipTitle;
    ticks += `<button type="button" class="${tickCls}" style="left:${left}%" aria-label="${escapeHtml(aria)}">
      <i></i>${deskTip(tipTitle, tipBody, mk.tipExtra)}
    </button>`;
    labels += `<span class="${labCls}" style="left:${left}%">${label}</span>`;
  }

  const leftPct = (pct * 100).toFixed(1);
  const aria = `${sym} 52-week range ${fmtRangeVal(low)} to ${fmtRangeVal(high)}, now ${fmtRangeVal(price)}`;
  const markCls = `has-tip range-marker${alerted ? ' is-alert' : ''}${tipEdge(pct * 100)}`;
  const nowTitle = `Now ${fmtRangeVal(price)}`;
  const nowBody = `52-week ${fmtRangeVal(low)} – ${fmtRangeVal(high)}`;
  const nowExtra = alerted ? 'Below the floor line' : '';
  return `<div class="range-wrap">
    <div class="range-track" role="img" aria-label="${aria}">${zones}${ticks}
      <button type="button" class="${markCls}" style="left:${leftPct}%" aria-label="${escapeHtml(nowTitle + '. ' + nowBody)}">
        ${deskTip(nowTitle, nowBody, nowExtra)}
      </button>
    </div>
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
  const floorBits = (markers || [])
    .filter(mk => mk.kind === 'below' && mk.label)
    .map(mk => `Floor ${mk.label}`);
  const meta = [
    desc.text
      ? (desc.cls ? `<span class="${desc.cls}">${desc.text}</span>` : desc.text)
      : null,
    ...floorBits,
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
  const goldMonth = completedMonthly(gold);
  const goldFloor = FLOORS.goldBelow;
  const btcFloor = FLOORS.btcBelow;
  const btcNear = btcAmberLine();
  const realizedNote = manual?.btc_realized_floor?.as_of
    ? `Realized-price floor as of ${manual.btc_realized_floor.as_of}.`
    : '';

  // Order: AI funding → money → COFER → gold → BTC cluster → oil last
  const rows = [
    {
      id: 'global_m2',
      group: 'money',
      label: 'Global M2',
      threshold: 'Headline YoY < 0%',
      current() {
        if (m2yoy.withheld) {
          const asOf = m2yoy.sourceDate ? periodMonthLabel(m2yoy.sourceDate, true) : '';
          return asOf ? `Withheld · ${asOf}` : 'Withheld';
        }
        if (m2yoy.value == null) return '—';
        const sign = m2yoy.value >= 0 ? '+' : '';
        const pureEst = m2yoy.estimated && !m2yoy.provisional;
        return `${sign}${m2yoy.value.toFixed(1)}% headline${pureEst ? ' est.' : ''}`;
      },
      status() {
        if (m2yoy.withheld) return 'withheld';
        const y = m2yoy.value;
        if (y == null) return 'unknown';
        if (y < 0) return 'red';
        if (y < 3) return 'amber';
        return 'green';
      },
      note() {
        if (m2yoy.withheld) {
          const g = m2yoy.lastGood;
          const last = g?.value != null
            ? `Last good pair ${g.period ? periodMonthLabel(g.period, true) + ' ' : ''}${g.value >= 0 ? '+' : ''}${Number(g.value).toFixed(1)}% (not this vintage).`
            : '';
          return [m2yoy.scopeNote, last].filter(Boolean).join(' ');
        }
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
        if (coferQ == null) return 'unknown';
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
      label: `Gold $${fmt(goldFloor, 0)} floor`,
      threshold: `Monthly close < $${fmt(goldFloor, 0)}`,
      current() {
        const live = gold?.price;
        const bits = [];
        if (goldMonth.open && goldMonth.mtd != null) {
          bits.push(`MTD ${fmt(goldMonth.mtd, 0, '$')}`);
        } else if (goldMonth.value != null) {
          const when = goldMonth.asOf ? periodMonthLabel(goldMonth.asOf, true) : 'Month';
          bits.push(`${when} close ${fmt(goldMonth.value, 0, '$')}`);
        }
        if (live != null) bits.push(`Live ${fmt(live, 0, '$')}`);
        return bits.length ? bits.join(' · ') : '—';
      },
      status() {
        const man = manualStatus('gold_monthly_close');
        const month = goldMonth.value;
        const live = gold?.price;
        if (month == null && live == null && !man) return 'unknown';
        if (man === 'red' || (month != null && month < goldFloor)) return 'red';
        if (live != null && live < goldFloor) return 'amber';
        if (man === 'amber') return 'amber';
        return 'green';
      },
      note() { return manualNotes('gold_monthly_close'); },
    },
    {
      id: 'btc_demand',
      group: 'btc',
      label: `BTC $${fmt(btcFloor / 1000, 0)}k floor`,
      threshold: `Weekly close < $${fmt(btcFloor, 0)}`,
      current() {
        const live = btc?.price;
        const bits = [];
        if (btcWeekly != null) bits.push(`Week ${fmt(btcWeekly, 0, '$')}`);
        if (live != null) bits.push(`Live ${fmt(live, 0, '$')}`);
        return bits.length ? bits.join(' · ') : '—';
      },
      status() {
        const close = btcWeekly ?? btc?.price;
        if (close == null) return 'unknown';
        if (close < btcFloor) return 'red';
        if (close < btcNear) return 'amber';
        if (btc?.price != null && btc.price < btcNear) return 'amber';
        return 'green';
      },
      note() {
        const bits = [];
        if (btcWeekly != null && btc?.weekly_close_as_of) {
          bits.push(`Judged on weekly close (${btc.weekly_close_as_of}).`);
        } else {
          bits.push('Weekly close not loaded — live as stand-in.');
        }
        if (realizedNote) bits.push(realizedNote);
        return bits.join(' ');
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
        if (divMonths == null) return 'unknown';
        if (divMonths >= FLOORS.lagRed) return 'red';
        if (divMonths >= FLOORS.lagAmber) return 'amber';
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
        if (oas == null && !man && !cuts && !cashTight) return 'unknown';
        const oasRed = oas != null && oas > FLOORS.oasBreak;
        const oasAmber = oas != null && oas > FLOORS.oasWatch;
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
      threshold: `WTI >$${FLOORS.wtiAbove} for 4+ weeks`,
      current() {
        const price = wti?.price;
        if (price == null) return '—';
        const streak = oilWeekStreak(wti);
        if (price > FLOORS.wtiAbove || streak > 0) {
          return `WTI ${fmt(price, 2, '$')} · ${streak}/4 weeks`;
        }
        return `WTI ${fmt(price, 2, '$')}`;
      },
      status() {
        const man = manualStatus('oil');
        if (man === 'red') return 'red';
        const price = wti?.price;
        const streak = oilWeekStreak(wti);
        if (streak >= 4) return 'red';
        if (price == null && !streak) return 'unknown';
        if (price > FLOORS.wtiAbove || streak >= 1) return 'amber';
        if (price > FLOORS.wtiWatch) return 'amber';
        if (man === 'amber') return 'amber';
        return 'green';
      },
      note() {
        const streak = oilWeekStreak(wti);
        if (wti?.price != null && wti.price > FLOORS.wtiAbove && streak < 4) {
          return 'First print through $120 — confirm four weekly closes.';
        }
        return '';
      },
    },
  ];
  const order = ['ai_financing', 'global_m2', 'cofer', 'gold_hedge', 'btc_demand', 'divergence', 'oil'];
  return order.map(id => rows.find(r => r.id === id)).filter(Boolean);
}

function tallyTriggers(triggers) {
  const counts = { green: 0, amber: 0, red: 0, unknown: 0 };
  for (const t of triggers) {
    const s = t.status();
    const key = s === 'withheld' ? 'unknown' : s;
    if (counts[key] != null) counts[key]++;
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
    return `<tr class="trigger-row trigger-${status} trigger-group-${group}${groupStart}" data-group="${group}">
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
    board.classList.remove('panel-alarm-red', 'panel-alarm-amber');
    if (tally.red > 0) board.classList.add('panel-alarm-red');
    else if (tally.amber > 0) board.classList.add('panel-alarm-amber');
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
  return { tally, triggers };
}

// ─── Status bar ───────────────────────────────────────────────────────────────

function hottestWatchpoint(triggers) {
  const rows = triggers.map(t => ({ id: t.id, label: t.label, status: t.status() }));
  const red = rows.find(r => r.status === 'red');
  if (red) return red;
  const ambers = rows.filter(r => r.status === 'amber');
  if (!ambers.length) return null;
  return ambers.find(r => r.id === 'divergence') || ambers[0];
}

function renderStatusBar(manual, macro, tally, triggers) {
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
  if (m2yoy.withheld) {
    m2yoyEl.innerHTML = '<span class="neu">—</span>';
  } else if (m2yoy.value != null) {
    const sign = m2yoy.value >= 0 ? '+' : '';
    const cls2 = m2yoy.value > 0 ? 'pos' : 'neg';
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
    if (m2yoy.withheld) {
      bits.push('withheld');
      const asOf = m2yoy.sourceDate
        ? (periodMonthLabel(m2yoy.sourceDate, true) || m2yoy.sourceDate)
        : '';
      if (asOf) bits.push(asOf);
      const g = m2yoy.lastGood;
      if (g?.value != null) {
        const when = g.period ? periodMonthLabel(g.period, true) : 'May';
        bits.push(`May +${Number(g.value).toFixed(1)}%`);
      }
    } else {
      const asOf = m2yoy.sourceDate
        ? (periodMonthLabel(m2yoy.sourceDate, true) || m2yoy.sourceDate)
        : '';
      if (asOf) bits.push(asOf);
      if (m2yoy.fxAdjusted != null && !isNaN(m2yoy.fxAdjusted)) {
        const s = m2yoy.fxAdjusted >= 0 ? '+' : '';
        bits.push(`fx ${s}${Number(m2yoy.fxAdjusted).toFixed(1)}%`);
      }
      const lagMo = monthsSince(m2yoy.sourceDate);
      if (lagMo != null && lagMo > 3) {
        bits.push(`<span class="stale-badge stale-amber">${lagMo} mo lag</span>`);
      }
    }
    document.getElementById('m2-sub').innerHTML = bits.join(' · ');
  }

  const floorEl = document.getElementById('floor-value');
  const floorSub = document.getElementById('floor-sub');
  const goldRow = triggers && triggers.find(t => t.id === 'gold_hedge');
  const btcRow = triggers && triggers.find(t => t.id === 'btc_demand');
  const floorSt = worstStatus(goldRow ? goldRow.status() : 'unknown', btcRow ? btcRow.status() : 'unknown');
  const floorWord = floorSt === 'red' ? 'broken' : floorSt === 'amber' ? 'near' : floorSt === 'unknown' ? 'no data' : 'intact';
  const floorTone = floorSt === 'red' ? 'tone-red' : floorSt === 'amber' ? 'tone-amber' : floorSt === 'unknown' ? 'neu' : 'tone-green';
  if (floorEl) {
    floorEl.innerHTML = `<span class="${floorTone}">${floorWord}</span>`;
  }
  if (floorSub) {
    floorSub.textContent = `BTC $${Math.round(FLOORS.btcBelow / 1000)}k · gold $${Math.round(FLOORS.goldBelow / 1000)}k`;
  }

  const tallyEl = document.getElementById('trigger-tally');
  const hot = triggers ? hottestWatchpoint(triggers) : null;
  const hotWord = hot
    ? (hot.status === 'red' ? 'broken' : 'watching')
    : (tally.red + tally.amber === 0 ? 'all clear' : '');
  if (hot) {
    tallyEl.innerHTML = `<span class="${hot.status === 'red' ? 'tone-red' : 'tone-amber'}">${hot.label}</span>`;
  } else {
    tallyEl.innerHTML = [
      `<span class="tally-chip chip-green">${tally.green}</span>`,
      `<span class="tally-sep">·</span>`,
      `<span class="tally-chip chip-amber">${tally.amber}</span>`,
      `<span class="tally-sep">·</span>`,
      `<span class="tally-chip chip-red">${tally.red}</span>`,
    ].join('');
  }
  const trigCell = document.getElementById('s-triggers');
  if (trigCell) {
    const name = hot ? `${hot.label} ${hotWord}` : `Watchpoints ${tally.green} clear`;
    trigCell.setAttribute('aria-label', name);
    trigCell.title = hot ? `${hot.label} — ${hotWord}. Jump to board.` : 'Jump to watchpoint board';
  }
  const trigSub = document.getElementById('trigger-sub');
  if (trigSub) {
    trigSub.textContent = hot
      ? `${hotWord} · ${tally.amber} watching · ${tally.red} broken`
      : '';
  }
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

function fgBarHtml(val, classification) {
  if (val == null) return '';
  const pct = Math.min(100, Math.max(0, val));
  const fillCls = val <= 25 ? 'fill-red' : val <= 45 ? 'fill-amber'
                : val <= 55 ? 'fill-dim' : val <= 75 ? 'fill-greed' : 'fill-green';
  const word = classification || (val <= 25 ? 'Extreme Fear' : val <= 45 ? 'Fear'
    : val <= 55 ? 'Neutral' : val <= 75 ? 'Greed' : 'Extreme Greed');
  return `<div class="fg-bar-track">
    <div class="fg-bar-bands" aria-hidden="true">
      <span class="fg-bar-band" style="left:25%"></span>
      <span class="fg-bar-band" style="left:50%"></span>
      <span class="fg-bar-band" style="left:75%"></span>
    </div>
    <div class="fg-bar-fill ${fillCls}" style="width:${pct}%"></div>
    <button type="button" class="has-tip fg-bar-marker${tipEdge(pct)}" style="left:${pct}%" aria-label="Fear and Greed ${val}, ${word}">
      ${deskTip(`${val} · ${word}`, 'Sentiment, not a floor', 'Matters most when floors still hold')}
    </button>
  </div>`;
}

function lagClockTicksHtml() {
  return `<div class="div-clock-ticks">
    <button type="button" class="has-tip div-clock-tick" style="left:66.67%" aria-label="12 months, watching zone">
      <i></i>${deskTip('12 months', 'Watching zone', 'Clock still running')}
    </button>
    <button type="button" class="has-tip div-clock-tick tip-end" style="left:100%" aria-label="18 months, transmission invalidation">
      <i></i>${deskTip('18 months', 'Transmission assumption dead', 'Manual reset only · not one green ETF week')}
    </button>
  </div>`;
}

function divergenceClockHtml(months, start) {
  const ticks = lagClockTicksHtml();
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
function blocM2YoyHtml(manual, bloc, ind) {
  const pipe = {
    US: ind?.US_M2?.yoy_pct,
    EZ: ind?.EZ_M2?.yoy_pct,
    JP: ind?.JP_M2?.yoy_pct,
    UK: ind?.UK_M4?.yoy_pct,
  };
  if (bloc !== 'CN' && pipe[bloc] != null && !isNaN(Number(pipe[bloc]))) {
    const raw = Number(pipe[bloc]);
    const sign = raw >= 0 ? '+' : '';
    const cls = raw >= 0 ? 'pos' : 'neg';
    return `<span class="${cls}">${sign}${raw.toFixed(1)}%</span>`;
  }
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
  const estTag = m2yoy.withheld
    ? ''
    : ((m2yoy.estimated || gy.provisional)
      ? ' <span class="est-tag" title="Interim figure — not a full calendar year-over-year yet">interim</span>'
      : '');

  const localVals = {
    US: ind.US_M2?.value != null ? `$${fmt(ind.US_M2.value, 0)}B` : '—',
    CN: cn?.value != null ? `¥${fmt(cn.value, 2)}T` : '—',
    EZ: ind.EZ_M2?.value != null ? `€${fmt(ind.EZ_M2.value, 2)}T` : '—',
    JP: ind.JP_M2?.value != null ? `¥${fmt(ind.JP_M2.value, 2)}T` : '—',
    UK: ind.UK_M4?.value != null ? `£${fmt(ind.UK_M4.value, 1)}B` : '—',
  };

  const yoyHtml = m2yoy.withheld
    ? `<span class="neu" title="${(m2yoy.scopeNote || 'Headline YoY withheld').replace(/"/g, '&quot;')}">Withheld</span>`
    : (m2yoy.value != null
      ? `<span class="${m2BandClass(m2yoy.value)}">${m2yoy.value >= 0 ? '+' : ''}${m2yoy.value.toFixed(1)}%</span>${estTag}`
      : '—');
  // Fixed-FX = money creation only (revalue base-period locals at latest FX)
  const fxCell = fxAdj != null && !isNaN(fxAdj)
    ? `<span class="${m2BandClass(fxAdj)}">${fxAdj >= 0 ? '+' : ''}${Number(fxAdj).toFixed(1)}%</span>${estTag}`
    : `<span class="neu" title="Compares money stocks using constant exchange rates">Pending</span>`;
  const lastGoodFoot = (() => {
    const g = m2yoy.lastGood;
    if (!m2yoy.withheld || g?.value == null) return '';
    return ` Last good 5-bloc pair ${g.value >= 0 ? '+' : ''}${Number(g.value).toFixed(1)}% — not this vintage.`;
  })();
  const defaultHist = m2yoy.withheld
    ? (m2yoy.scopeNote || 'Headline YoY withheld until baskets match.')
    : gy.history_ready
      ? 'Calendar YoY · fixed-FX holds FX constant (money creation only).'
      : 'Fixed-FX pending until enough monthly M2 history is on file.';
  const rawHist = (gy.history_note || defaultHist) + lastGoodFoot;
  const flagIdx = rawHist.search(/Quality flags:\s*/i);
  const histNote = flagIdx >= 0 ? rawHist.slice(0, flagIdx).trim() : rawHist;
  const histFlags = flagIdx >= 0 ? rawHist.slice(flagIdx).replace(/^Quality flags:\s*/i, '').trim() : '';
  const histTitle = histFlags
    ? ` title="Quality flags: ${histFlags.replace(/"/g, '&quot;')}"`
    : '';

  const usM2 = ind.US_M2;
  let usM2Meta = 'Fiscal-gap proxy';
  if (usM2?.yoy_pct != null) {
    const acc = usM2.yoy_delta_pp;
    const accTxt = acc != null
      ? (acc > 0 ? ` · +${acc.toFixed(1)} pp` : acc < 0 ? ` · ${acc.toFixed(1)} pp` : '')
      : '';
    usM2Meta = `${usM2.yoy_pct >= 0 ? '+' : ''}${usM2.yoy_pct.toFixed(1)}% YoY${accTxt} · fiscal proxy`;
  }

  const m2KpiHtml = kpiStrip([
    {
      label: 'Global money supply (M2)',
      value: gm2?.value != null ? `$${fmt(gm2.value, 2)}T` : '—',
    },
    {
      label: 'US money supply',
      value: usM2?.value != null ? `$${fmt(usM2.value, 0)}B` : '—',
      meta: usM2Meta,
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
  ], 4);

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
      <td class="num" data-label="YoY">${blocM2YoyHtml(manual, bloc, ind)}</td>
      <td data-label="As of"><span class="bloc-soft-label">As of </span>${fmtMacroDate(date)} ${staleBadge(stale.level, stale.label)}</td>
    </tr>`;
  }).join('');

  const blocYoyNote = 'Year-over-year money growth in each region’s own currency.';
  const blocYoyTitle = manual?.bloc_m2_yoy?.note
    ? ` title="${String(manual.bloc_m2_yoy.note).replace(/"/g, '&quot;')}"`
    : '';

  document.getElementById('pillar-monetary-body').innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      Stage 4 — the thesis <strong>output</strong>, not the claim. Read headline and fixed-FX first.
    </p>
    ${m2KpiHtml}
    <p class="desk-footnote"${histTitle}>${histNote}</p>
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
    <p class="desk-footnote"${blocYoyTitle}>${blocYoyNote}</p>
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
  let oasChip = 'unknown';
  let oasWord = 'No print';
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
      oasChip = 'green';
      oasWord = 'Calm';
    }
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

  const markers = [{
    value: FLOORS.goldBelow,
    label: `$${fmt(FLOORS.goldBelow, 0)}`,
    kind: 'below',
    tipTitle: `$${fmt(FLOORS.goldBelow, 0)} floor`,
    tipBody: 'Monthly close invalidation',
    tipExtra: 'Breaks if the finished month closes below this line',
  }];
  const activeId = resolveActiveScenarioId(manual?.scenario);
  const pmarks = PATH_MARKS[activeId] || PATH_MARKS.B;
  if (pmarks.gold && pmarks.gold !== FLOORS.goldBelow) {
    markers.push({
      value: pmarks.gold,
      label: `$${fmt(pmarks.gold, 0)}`,
      kind: 'band',
      tipTitle: `$${fmt(pmarks.gold, 0)} path mark`,
      tipBody: `Path ${activeId} gold line`,
      tipExtra: 'Not a floor — book waypoint',
    });
  }
  const floor = cb?.floor_tonnes ?? 200;
  const q = cb?.quarterly_tonnes;
  const floorOk = q != null && q >= floor;
  const floorTone = floorOk ? 'green' : (q != null && q >= floor * 0.5 ? 'amber' : 'red');
  const floorPct = q != null ? Math.min(100, (q / (floor * 1.5)) * 100) : 0;
  const floorHtml = q != null
    ? meterHtml(floorPct, floorTone, `Floor ~${floor}t/qtr`, floorOk ? 'Bid intact' : 'Below floor', {
        title: `${fmt(q, 0)} t / qtr`,
        body: `Official bid vs ~${floor} t/q floor`,
        extra: [
          floorOk ? 'Bid intact' : 'Below the ~200 t/q floor',
          cb?.period ? String(cb.period) : '',
          'WGC quarterly net · structural series',
        ],
      })
    : '';

  const coferQ = cofer?.consecutive_rising_quarters;
  const coferPct = coferQ != null ? (coferQ / 4) * 100 : 0;
  const coferTone = coferQ == null ? '' : coferQ >= 4 ? 'red' : coferQ >= 1 ? 'amber' : 'green';
  const coferMeter = coferQ != null
    ? meterHtml(coferPct, coferTone, `${coferQ} of 4 rising`, coferQ >= 4 ? 'Trend break' : 'Need 4 to reverse', {
        title: `${coferQ} of 4 rising`,
        body: 'Dollar share of official reserves',
        extra: [
          cofer?.usd_share_pct != null ? `${Number(cofer.usd_share_pct).toFixed(2)}% · ${cofer.period || ''}` : '',
          coferQ >= 4 ? 'Four in a row = mix reverse' : 'Noise until four rising quarters',
        ],
      })
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
    const remain = Math.max(0, railsTarget - sc.value);
    railsMeter = meterHtml(Math.min(100, pctOfTarget), tone, left, right, {
      title: `$${fmt(sc.value, 0)}B rails`,
      body: `Private dollar rails vs $${fmt(railsTarget, 0)}B mid-path`,
      extra: [
        remain > 0 ? `$${fmt(remain, 0)}B still to mid-path` : 'Mid-path target reached',
        'Not a substitute for official duration',
      ],
    });
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
  const qLag = quartersBehind(hs.as_of_quarter);
  const lagNote = qLag != null && qLag >= 2
    ? `actuals ${qLag} quarters behind`
    : '';
  const crossWhen = hs.epoch_crossover_quarter
    ? (crossed ? `Epoch marked cross ${hs.epoch_crossover_quarter}` : `Trend cross ~${hs.epoch_crossover_quarter}`)
    : '';
  const metaParts = [q, 'cash only · 5 names', crossWhen, lagNote, staleMeta].filter(Boolean);

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
      <div class="oas-gauge-track oas-gauge-track--empty"></div>
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
  const etfStale = staleness(etfWeekEnd(etf), 8, 16);
  const etfAge = staleBadge(etfStale.level, etfStale.label);
  return `<div class="flow-chart">
    ${row('Week', thisM)}
    ${priorM != null ? row('Prior', priorM) : ''}
    <div class="flow-axis"><span>Out</span><span>0</span><span>In</span></div>
    <div class="btc-cell-meta">${read}${etf.period ? ` · ${etf.period}` : ''}${etfAge ? ` ${etfAge}` : ''}</div>
  </div>`;
}

function renderPillarHardMoney(prices, macro, manual, etfFlows) {
  const p = prices?.prices || {};
  const fg = macro?.indicators?.FEAR_GREED;
  const divStart = manual?.divergence?.start;
  const months = monthsSince(divStart);
  const etf = etfFlows;
  const tx = buildTransmission(macro, prices);

  const activeId = resolveActiveScenarioId(manual?.scenario);
  const pmarks = PATH_MARKS[activeId] || PATH_MARKS.B;
  const btcMarkers = [
    {
      value: FLOORS.btcBelow,
      label: `$${Math.round(FLOORS.btcBelow / 1000)}k`,
      kind: 'below',
      tipTitle: `$${Math.round(FLOORS.btcBelow / 1000)}k floor`,
      tipBody: 'Weekly close · aggregate realized price',
      tipExtra: manual?.btc_realized_floor?.as_of
        ? `As of ${manual.btc_realized_floor.as_of} · not ETF cost basis`
        : 'Not ETF cost basis',
    },
    {
      value: pmarks.btc[0],
      label: `$${Math.round(pmarks.btc[0] / 1000)}k`,
      kind: 'band',
      tipTitle: `$${Math.round(pmarks.btc[0] / 1000)}k path mark`,
      tipBody: `Path ${activeId} band`,
      tipExtra: 'Not a floor — book waypoint',
    },
    {
      value: pmarks.btc[1],
      label: `$${Math.round(pmarks.btc[1] / 1000)}k`,
      kind: 'band',
      tipTitle: `$${Math.round(pmarks.btc[1] / 1000)}k path mark`,
      tipBody: `Path ${activeId} band`,
      tipExtra: 'Not a floor — book waypoint',
    },
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
    const ticks = lagClockTicksHtml();
    if (divStart == null) {
      return `<div class="div-clock-track">${ticks}<div class="div-clock-fill fill-green" style="width:2%"></div></div>`;
    }
    if (months == null) return '';
    const pct = Math.min(100, (months / 18) * 100);
    const tone = months >= 18 ? 'red' : months >= 12 ? 'amber' : 'green';
    return `<div class="div-clock-track">${ticks}<div class="div-clock-fill fill-${tone}" style="width:${pct.toFixed(1)}%"></div></div>`;
  })();

  // Fear & Greed cell
  const fgVal = fg?.value;
  const fgCls = fgColorClass(fgVal);
  const fgValueHtml = fgVal != null
    ? `<span class="${fgCls}">${fgVal}</span> <span class="fg-inline-sub">${fg?.classification || ''}</span>`
    : '<span class="neu">—</span>';

  const wti = p.WTI;
  const vix = p.VIX;
  const wtiAlert = wti?.price != null && wti.price > FLOORS.wtiWatch;
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
    `watch &gt;$${FLOORS.wtiWatch}`,
    `shock &gt;$${FLOORS.wtiAbove} × 4w`,
  ].join(' · ');
  const vixMeta = [
    fmtPct(changePctOf(p, 'VIX'), 2),
    'equity vol',
    'alert &gt;30',
  ].join(' · ');
  const wtiTip = deskTip(
    wti?.price != null ? `WTI ${fmt(wti.price, 2, '$')}` : 'WTI',
    'Oil / inflation footnote — not the sink',
    [`Watch >$${FLOORS.wtiWatch}`, `Shock >$${FLOORS.wtiAbove} for 4 weekly closes`],
  );
  const vixTip = deskTip(
    vix?.price != null ? `VIX ${fmt(vix.price, 1)}` : 'VIX',
    'Equity vol footnote — not the sink',
    'Stress above 30',
  );
  const riskFoot = `
    <div class="hm-foot">
      <div class="desk-foot-kicker">Macro risk · not the sink</div>
      <button type="button" class="has-tip field-hit" aria-label="WTI, oil inflation footnote">
        ${fieldBlock('WTI', wtiVal, wtiMeta)}
        ${wtiTip}
      </button>
      <button type="button" class="has-tip field-hit" aria-label="VIX, equity vol footnote">
        ${fieldBlock('VIX', vixVal, vixMeta)}
        ${vixTip}
      </button>
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
              <div class="btc-cell-visual">${fgBarHtml(fgVal, fg?.classification)}</div>
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

function renderPillars(prices, macro, manual, etfFlows) {
  const ind = macro?.indicators || {};
  renderPillarAi(ind, manual);
  renderPillarDedollar(prices, manual, macro);
  renderPillarMonetary(ind, manual);
  renderPillarHardMoney(prices, macro, manual, etfFlows);
}

function spineTone(st) {
  if (st === 'red') return 'tone-red';
  if (st === 'amber') return 'tone-amber';
  if (st === 'unknown' || st === 'withheld' || st === 'structural' || st === 'inferred') return 'neu';
  return 'tone-green';
}

function spineStatusWord(st) {
  if (st === 'red') return 'broken';
  if (st === 'amber') return 'watching';
  if (st === 'unknown') return 'no data';
  if (st === 'withheld') return 'withheld';
  if (st === 'structural') return 'structural';
  if (st === 'inferred') return 'inferred';
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
    return row ? row.status() : 'unknown';
  };
  const cuts = !!manual?.ai_transition?.capex_cuts;
  const forceA = cuts ? 'amber' : 'green';
  const floors = worstStatus(stOf('gold_hedge'), stOf('btc_demand'));

  el.innerHTML = `
    <p class="desk-footnote desk-footnote--lead">
      AI cheapens knowledge work, then labour, and that makes existing public debt harder to service in real terms.
      At the same time, surplus countries no longer warehouse other people’s long government bonds the way they used to.
      Either pressure ends in more money, or in official gold — and both show up in gold and bitcoin.
    </p>
    <div class="spine-inflows">
      ${spineCell('inflow', 'Force A', 'AI capability ladder', 'Knowledge work → robotics / OTA labour', forceA, 'pillar-ai')}
      ${spineCell('inflow', 'Force B', 'No duration left', 'Demographics → seizure risk → no bid for long bonds', 'structural', 'pillar-dedollar')}
    </div>
    <p class="spine-hinge">both hit the hinge</p>
    <div class="spine-stages">
      ${spineCell('stage', '2', 'Credit &amp; long end', 'HY · 10Y · $ · net liq', stOf('ai_financing'), 'pillar-dedollar')}
      ${spineCell('stage', '3', 'Fiscal gap', 'Inferred — no receipts series', 'inferred', 'pillar-monetary')}
      ${spineCell('stage', '4', 'Money', 'Global M2 output', stOf('global_m2'), 'pillar-monetary')}
      ${spineCell('stage', '5', 'Gold + BTC', 'Official bid and private run', floors, 'pillar-hardmoney')}
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
  const goldDone = completedMonthly(gold);
  const goldRef = goldDone.value ?? gold?.price;
  const divMonths = monthsSince(manual?.divergence?.start);
  const id = wp?.id;
  const activeId = resolveActiveScenarioId(manual?.scenario);
  const marks = PATH_MARKS[activeId] || PATH_MARKS.B;

  if (id === 'btc_band') {
    if (btcPx == null) return wp.status || 'miss';
    const [lo, hi] = marks.btc;
    return (btcPx >= lo && btcPx <= hi) ? 'hit' : 'miss';
  }
  if (id === 'gold_line') {
    if (goldRef == null) return wp.status || 'miss';
    return goldRef >= marks.gold ? 'hit' : 'miss';
  }
  if (id === 'divergence') {
    if (manual?.divergence?.start == null) return 'hit'; // clock reset
    if (divMonths == null) return wp.status || 'miss';
    if (divMonths >= FLOORS.lagRed) return 'miss';
    // Path A: relink wants the clock reset. B/C/D: running clock is on-path until 18.
    if (activeId === 'A') return 'miss';
    return 'hit';
  }
  if (id === 'floors') {
    const btcOk = btcPx == null ? null : btcPx >= FLOORS.btcBelow;
    const goldOk = goldRef == null ? null : goldRef >= FLOORS.goldBelow;
    if (btcOk === false || goldOk === false) return 'miss';
    if (btcOk === true && goldOk === true) return 'hit';
    return wp.status || 'miss';
  }

  const st = (wp?.status || 'miss').toLowerCase();
  if (st === 'hit' || st === 'miss') return st;
  if (st === 'approaching' || st === 'near') return 'miss';
  return 'miss';
}

function waypointStatusLabel(st) {
  if (st === 'hit') return 'on path';
  return 'off';
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

  const show = hasBook || hasNotes || hasBullets || hasWps || hasRescore || hasNext;
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

  const bullets = [];
  if (hasBullets) {
    for (const b of manual.regime_bullets) {
      if (/watchpoint/i.test(b)) continue;
      bullets.push(b);
    }
  }
  const bulletList = bullets.length
    ? `<ul class="regime-bullets">${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
    : '';

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
      ${bulletList}
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

  if (!hasWps && bulletList) {
    parts.push(`<div class="context-footer">${bulletList}</div>`);
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
  let etfFlows = null;

  const [pricesResult, macroResult, manualResult, alertsResult, etfResult] = await Promise.allSettled([
    fetchJson(DATA.prices),
    fetchJson(DATA.macro),
    fetchJson(DATA.manual),
    fetchJson(DATA.alerts),
    fetchJson(DATA.etf_flows),
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

  if (etfResult.status === 'fulfilled') etfFlows = etfResult.value?.desk || null;
  else console.warn('etf_flows.json failed:', etfResult.reason);

  applyFloors(alerts, manual);

  const { tally, triggers } = renderTriggers(prices, macro, manual);
  renderStatusBar(manual, macro, tally, triggers);
  renderSpine(prices, macro, manual);
  renderScenarioContext(manual, prices, macro, tally);
  renderPillars(prices, macro, manual, etfFlows);
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
