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

function assetContextHtml(entry) {
  if (!entry || entry.price == null) return '';
  const price = entry.price;
  const ath = entry.ath_proxy ?? entry.week52_high;
  const low = entry.week52_low;
  const bits = [];
  if (ath != null && ath > 0) {
    const dd = ((price / ath) - 1) * 100;
    bits.push(`${dd.toFixed(0)}% from cycle high`);
  }
  if (low != null && low > 0) {
    const up = ((price / low) - 1) * 100;
    bits.push(`${up.toFixed(0)}% above 52w low`);
  }
  if (!bits.length) return '';
  return `<div class="asset-context">${bits.join(' · ')}</div>`;
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
  // last 12 months of comparable pairs
  const recent = months.slice(-12);
  const a = recent.filter(m => m.state === 'agree').length;
  const d = recent.filter(m => m.state === 'disagree').length;
  let note = `${a} agree · ${d} disagree (last ${recent.length} months)`;
  if (d > a) note += ' — still mostly out of sync';
  else if (a > d) note += ' — leaning back into agreement';
  return { months: recent, agree: a, disagree: d, note };
}

function transmissionHtml(tx) {
  if (!tx.months.length) {
    return `<div class="desk-block"><div class="tx-strip">
      <div class="tx-strip-head">
        <span class="tx-strip-title">US M2 vs Bitcoin (monthly)</span>
        <span class="tx-strip-summary">${tx.note}</span>
      </div>
    </div></div>`;
  }
  const cells = tx.months.map(m =>
    `<span class="tx-month ${m.state}" title="${m.title || m.period}">${m.label}</span>`
  ).join('');
  return `<div class="desk-block"><div class="tx-strip">
    <div class="tx-strip-head">
      <span class="tx-strip-title">US M2 vs Bitcoin (monthly)</span>
      <span class="tx-strip-summary">${tx.note}</span>
    </div>
    <div class="tx-months" aria-label="Month-by-month direction">${cells}</div>
    <div class="tx-legend">Each cell is a calendar month · green = same direction · amber = opposite · US M2 level vs BTC monthly close</div>
  </div></div>`;
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
  return `<span class="status-chip chip-${s}">${s}</span>`;
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
  const computed = ind?.GLOBAL_M2_YOY?.headline_pct;
  if (computed != null && !isNaN(computed)) {
    return { value: computed, estimated: false, sourceDate: ind.GLOBAL_M2_YOY.as_of_period };
  }
  const est = manual?.global_m2_yoy_estimate?.value;
  if (est != null && !isNaN(est)) {
    return { value: est, estimated: true, sourceDate: manual.global_m2_yoy_estimate.updated };
  }
  return { value: null, estimated: false, sourceDate: null };
}

function scenarioClass(current) {
  if (!current) return 'base';
  const c = String(current).toLowerCase();
  if (c.startsWith('a') || c.includes('reconnection') || c.includes('bull')) return 'bull';
  if (c.startsWith('c') || c.includes('credit') || c.includes('bear')) return 'bear';
  if (c.startsWith('d') || c.includes('tail') || c.includes('geopolit')) return 'tail';
  return 'base'; // B / Hawkish Grind / Base
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
 * markers: [{ value, label, kind?: 'below'|'above'|'mark' }]
 */
function rangeBarHtml(sym, price, low, high, markers = []) {
  if (price == null || low == null || high == null || high <= low) {
    return '<span class="neu">—</span>';
  }
  const span = high - low;
  const pct  = Math.min(1, Math.max(0, (price - low) / span));

  let alerted = false;
  for (const mk of markers) {
    if (mk.kind === 'below' && price < mk.value) alerted = true;
    if (mk.kind === 'above' && price > mk.value) alerted = true;
  }

  const reversed = RANGE_REVERSED.has(sym);
  const descText = pct <= 0.10 ? 'Near 52w low'  : pct <= 0.25 ? 'Lower quarter'
                 : pct <= 0.40 ? 'Lower third'   : pct <= 0.60 ? 'Mid-range'
                 : pct <= 0.75 ? 'Upper third'   : pct <= 0.90 ? 'Upper quarter'
                 : 'Near 52w high';
  const descCls  = reversed
    ? (pct <= 0.25 ? 'pos' : pct >= 0.75 ? 'highlight-warn' : '')
    : (pct <= 0.25 ? 'highlight-warn' : pct >= 0.75 ? 'pos' : '');
  const alertIcon = alerted ? '<span class="range-alert-icon">⚠</span> ' : '';
  const desc = descCls
    ? `${alertIcon}<span class="${descCls}">${descText}</span>`
    : `${alertIcon}${descText}`;

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

  const dotCls = alerted ? 'range-dot is-alert' : 'range-dot';
  return `<div class="range-wrap">
    <div class="range-track">${zones}${ticks}<div class="${dotCls}" style="left:${(pct * 100).toFixed(1)}%"></div></div>
    <div class="range-mark-row">${labels}</div>
    <div class="range-desc">${desc}</div>
  </div>`;
}

function priceRowHtml(sym, label, price, chg, entry, markers, decimals, prefix) {
  return `<tr>
    <td class="asset-name" data-label="Asset">${label}</td>
    <td class="num" data-label="Price">${fmt(price, decimals, prefix)}</td>
    <td class="num" data-label="Δ">${fmtPct(chg, 2)}</td>
    <td class="range-cell" data-label="52W">${rangeBarHtml(sym, price, entry?.week52_low ?? null, entry?.week52_high ?? null, markers)}</td>
  </tr>`;
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

  return [
    {
      id: 'btc_demand',
      label: 'Bitcoin demand floor',
      threshold: 'Weekly close under $53,000',
      current() {
        const live = btc?.price;
        const bits = [];
        if (btcWeekly != null) bits.push(`Weekly close ${fmt(btcWeekly, 0, '$')}`);
        if (live != null) bits.push(`Live ${fmt(live, 0, '$')}`);
        if (btc?.week52_low != null) bits.push(`52w low ${fmt(btc.week52_low, 0, '$')}`);
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
          return `Adjudicated on weekly close as of ${btc.weekly_close_as_of}.`;
        return 'Weekly close not loaded yet — using live price as stand-in.';
      },
    },
    {
      id: 'gold_hedge',
      label: 'Gold holding $4,000',
      threshold: 'Monthly close under $4,000',
      current() {
        const live = gold?.price;
        const bits = [];
        if (goldMonthly != null) {
          bits.push(`Month close ${fmt(goldMonthly, 0, '$')}`);
          if (gold.monthly_close_as_of) bits.push(`(${gold.monthly_close_as_of})`);
        }
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
      id: 'divergence',
      label: 'Bitcoin lagging money growth',
      threshold: '18 months or more out of sync',
      current() {
        if (manual?.divergence?.start == null) return 'Back in sync';
        if (divMonths == null) return '—';
        return `${divMonths} months since ${manual.divergence.start}`;
      },
      status() {
        if (manual?.divergence?.start == null) return 'green';
        if (divMonths == null) return 'green';
        if (divMonths >= 18) return 'red';
        if (divMonths >= 12) return 'amber';
        return 'green';
      },
      note() { return manual?.divergence?.note || ''; },
    },
    {
      id: 'cofer',
      label: 'Dollar share of reserves',
      threshold: 'Up 4 quarters in a row',
      current() {
        if (coferQ == null) return '—';
        const q = coferQ === 1 ? '1 rising quarter' : `${coferQ} rising quarters`;
        return `${q}${manual?.cofer_usd_share?.period ? ` · ${manual.cofer_usd_share.period}` : ''}`;
      },
      status() {
        if (coferQ == null) return 'green';
        if (coferQ >= 4) return 'red';
        if (coferQ >= 1) return 'amber';
        return 'green';
      },
      note() { return manual?.cofer_usd_share?.note || ''; },
    },
    {
      id: 'global_m2',
      label: 'Global money supply',
      threshold: 'Shrinking year-over-year',
      current() {
        if (m2yoy.value == null) return '—';
        const tag = m2yoy.estimated ? ' (est.)' : '';
        const sign = m2yoy.value >= 0 ? '+' : '';
        return `${sign}${m2yoy.value.toFixed(1)}%${tag} vs a year ago`;
      },
      status() {
        const y = m2yoy.value;
        if (y == null) return 'green';
        if (y < 0) return 'red';
        if (y < 3) return 'amber';
        return 'green';
      },
      note() { return m2yoy.estimated ? (manual?.global_m2_yoy_estimate?.note || '') : ''; },
    },
    {
      id: 'oil',
      label: 'Oil price spike',
      threshold: 'Above $120 for 4+ weeks',
      current() {
        const price = wti?.price;
        if (price == null) return '—';
        if (price > 120) return `${fmt(price, 2, '$')} (needs 4 weeks above $120 to confirm)`;
        return fmt(price, 2, '$');
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
    {
      id: 'ai_financing',
      label: 'AI funding stress',
      threshold: 'Junk spreads > 5% plus spending cuts',
      current() {
        const bits = [];
        if (oas != null) bits.push(`Junk bond spread ${oas.toFixed(2)}%`);
        const cuts = manual?.ai_transition?.capex_cuts;
        bits.push(cuts ? 'Capex cuts: yes' : 'Capex cuts: no');
        return bits.join(' · ') || '—';
      },
      status() {
        const man = manualStatus('ai_financing');
        const cuts = !!manual?.ai_transition?.capex_cuts;
        const oasRed = oas != null && oas > 5;
        const oasAmber = oas != null && oas > 4;
        let computed = 'green';
        if (oasRed && cuts) computed = 'red';
        else if (oasRed || oasAmber || cuts) computed = 'amber';
        return worstStatus(computed, man || 'green');
      },
      note() { return manualNotes('ai_financing'); },
    },
    {
      id: 'taiwan',
      label: 'Taiwan conflict risk',
      threshold: 'Major military escalation',
      current() {
        return manualNotes('taiwan') || '—';
      },
      status() {
        return manualStatus('taiwan') || 'green';
      },
      note() { return ''; },
    },
  ];
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
  const rows = triggers.map(t => {
    const status = t.status();
    const note = t.note();
    const current = t.current();
    const noteHtml = note
      ? `<div class="trigger-note">${note}</div>`
      : '';
    return `<tr>
      <td data-label="Trigger">${t.label}</td>
      <td data-label="Threshold"><span class="trigger-threshold-inline">${t.threshold}</span></td>
      <td data-label="Current"><span class="trigger-current">${current}</span>${noteHtml}</td>
      <td class="trigger-status-cell" data-label="Status">${statusChip(status)}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');

  const tally = tallyTriggers(triggers);
  const board = document.getElementById('panel-triggers');
  if (board) {
    board.classList.remove('panel-alarm-amber', 'panel-alarm-red');
    if (tally.red > 0) board.classList.add('panel-alarm-red');
    else if (tally.amber >= 4) board.classList.add('panel-alarm-amber');
  }
  const sumEl = document.getElementById('trigger-summary');
  if (sumEl) {
    const stressed = tally.amber + tally.red;
    const total = tally.green + tally.amber + tally.red;
    if (tally.red > 0) {
      sumEl.innerHTML = `<strong>${tally.red} broken</strong> · ${tally.amber} under stress · ${tally.green} clear — reassess assumptions.`;
    } else if (tally.amber > 0) {
      sumEl.innerHTML = `<strong>${tally.amber} of ${total} under stress</strong> · ${tally.red} broken · ${tally.green} clear. Concurrent ambers are pressure, not automatic invalidation.`;
    } else {
      sumEl.innerHTML = `<strong>All clear on formal lines</strong> · ${total} watchpoints green.`;
    }
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
  const m2s = staleness(m2yoy.sourceDate, 45, 90);
  if (m2yoy.value != null) {
    const sign = m2yoy.value >= 0 ? '+' : '';
    const cls2 = m2yoy.value > 0 ? 'pos' : 'neg';
    const staleCls = m2s.level === 'amber' ? ' value-stale-amber'
                   : m2s.level === 'red' ? ' value-stale-red' : '';
    const est  = m2yoy.estimated ? ' <span class="est-tag">est.</span>' : '';
    m2yoyEl.innerHTML = `<span class="${cls2}${staleCls}">${sign}${m2yoy.value.toFixed(1)}%</span>${est}`;
  } else {
    m2yoyEl.textContent = '—';
  }
  document.getElementById('m2-sub').innerHTML = staleBadge(m2s.level, m2s.label);

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
  const fxAdj = gy.fx_adjusted_pct;
  const comps = gm2?.components || {};
  const dates = gm2?.component_dates || {};
  const cn = manual?.china_m2;

  const localVals = {
    US: ind.US_M2?.value != null ? `$${fmt(ind.US_M2.value, 0)}B` : '—',
    CN: cn?.value != null ? `¥${fmt(cn.value, 2)}T` : '—',
    EZ: ind.EZ_M2?.value != null ? `€${fmt(ind.EZ_M2.value, 2)}T` : '—',
    JP: ind.JP_M2?.value != null ? `¥${fmt(ind.JP_M2.value, 2)}T` : '—',
    UK: ind.UK_M4?.value != null ? `£${fmt(ind.UK_M4.value, 1)}B` : '—',
  };

  const yoyHtml = m2yoy.value != null
    ? `<span class="${m2BandClass(m2yoy.value)}">${m2yoy.value >= 0 ? '+' : ''}${m2yoy.value.toFixed(1)}%</span>${m2yoy.estimated ? ' <span class="est-tag">est.</span>' : ''}`
    : '—';
  const fxCell = fxAdj != null
    ? `<span class="${m2BandClass(fxAdj)}">${fxAdj >= 0 ? '+' : ''}${fxAdj.toFixed(1)}%</span>`
    : '<span class="neu">—</span>';

  const histMonths = gy.history_months ?? 0;
  const histNeed = gy.history_needed ?? 13;
  const histPct = Math.min(100, (histMonths / histNeed) * 100);
  const histNote = gy.history_ready
    ? 'Computed YoY live from dashboard history.'
    : (gy.history_note || `Need ~${histNeed} months of history for auto YoY (${histMonths} on file).`);

  const dualHtml = `<div class="metric-row">
    <div class="metric-cell">
      <div class="metric-label">USD total growth</div>
      <div class="metric-value">${yoyHtml}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">At fixed FX</div>
      <div class="metric-value">${fxCell}</div>
    </div>
  </div>
  <div class="track-block">
    <div class="track-caption">${histNote}</div>
    <div class="history-track"><div class="history-fill" style="width:${histPct.toFixed(0)}%"></div></div>
  </div>`;

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
      <td class="num" data-label="Local">${localVals[bloc]}</td>
      <td class="num" data-label="USD">${usd != null ? `$${fmt(usd, 2)}T` : '—'}</td>
      <td class="num" data-label="YoY">${blocM2YoyHtml(manual, bloc)}</td>
      <td data-label="As of">${fmtMacroDate(date)} ${staleBadge(stale.level, stale.label)}</td>
    </tr>`;
  }).join('');

  const usM2 = ind.US_M2;
  const netLiq = ind.US_NET_LIQ;
  const us10y = ind.US_10Y;
  const usdIdx = ind.USD_INDEX;
  const staleNet = staleness(netLiq?.date, 10, 20);
  const stale10y = staleness(us10y?.date, 5, 10);
  const staleUsd = staleness(usdIdx?.date, 5, 10);
  const staleUsM2 = staleness(usM2?.date, 45, 90);
  const blocYoyNote = manual?.bloc_m2_yoy?.note
    || 'Year-over-year money growth in each region’s own currency.';

  let usYoySub = fmtMacroDate(usM2?.date);
  if (usM2?.yoy_pct != null) {
    const acc = usM2.yoy_delta_pp;
    const accTxt = acc != null
      ? (acc > 0 ? ` · accelerating (+${acc.toFixed(1)} pp)` : acc < 0 ? ` · cooling (${acc.toFixed(1)} pp)` : ' · steady')
      : '';
    usYoySub = `<span class="${m2BandClass(usM2.yoy_pct)}">${usM2.yoy_pct >= 0 ? '+' : ''}${usM2.yoy_pct.toFixed(1)}% YoY</span>${accTxt} · ${fmtMacroDate(usM2.date)}`;
  }
  usYoySub += staleBadge(staleUsM2.level, staleUsM2.label);

  document.getElementById('pillar-monetary-body').innerHTML = `
    ${heroStat(
      'Global money supply (M2)',
      gm2?.value != null ? `$${fmt(gm2.value, 2)}T` : '—',
      '',
    )}
    ${dualHtml}
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
    <div class="mini-grid">
      ${miniCard('US money supply', usM2?.value != null ? `$${fmt(usM2.value, 0)}B` : '—', usYoySub)}
      ${miniCard('US net liquidity', netLiq?.value != null ? `$${fmt(netLiq.value, 0)}B` : '—',
        `${fmtMacroDate(netLiq?.date)}${staleBadge(staleNet.level, staleNet.label)}`)}
      ${miniCard('US 10-year yield', us10y?.value != null ? `${fmt(us10y.value, 2)}%` : '—',
        `${fmtMacroDate(us10y?.date)}${staleBadge(stale10y.level, stale10y.label)}`)}
      ${miniCard('US dollar (broad index)', usdIdx?.value != null ? fmt(usdIdx.value, 2) : '—',
        `${fmtMacroDate(usdIdx?.date)}${staleBadge(staleUsd.level, staleUsd.label)}`)}
    </div>
  `;
}

function renderPillarDedollar(prices, manual, macro) {
  const gold = prices?.prices?.XAUUSD;
  const price = gold?.price;
  const cb = manual?.cb_gold;
  const cofer = manual?.cofer_usd_share;
  const staleCb = staleness(cb?.updated || cb?.period, 120, 180);
  const staleCofer = staleness(cofer?.updated || cofer?.period, 120, 180);
  const sc = macro?.indicators?.STABLECOIN_MCAP;

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
    ? meterHtml(coferPct, coferTone, `${coferQ} of 4 rising quarters`, coferQ >= 4 ? 'Reversal risk' : 'Noise until 4')
    : '';

  document.getElementById('pillar-dedollar-body').innerHTML = `
    <div class="desk-block">
      <table class="price-table pillar-price-table">
        <thead><tr><th>Asset</th><th class="num">Price</th><th class="num">Δ</th><th>52W Range</th></tr></thead>
        <tbody>
          ${priceRowHtml('XAUUSD', 'Gold', price, changePctOf(prices?.prices, 'XAUUSD'), gold, markers, 0, '$')}
        </tbody>
      </table>
    </div>
    ${assetContextHtml(gold)}
    <p class="desk-footnote">Central-bank buying is the floor; day-to-day gold price is still set by markets.</p>
    <div class="mini-grid">
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
        'Dollar share of world reserves',
        coferQ != null
          ? (coferQ === 1 ? '1 rising quarter' : `${coferQ} rising quarters`)
          : '—',
        [cofer?.period || null, staleBadge(staleCofer.level, staleCofer.label)].filter(Boolean).join(' · '),
        'metric',
        coferMeter,
      )}
      ${miniCard(
        'Dollar rails (stablecoins)',
        sc?.value != null ? `$${fmt(sc.value, 1)}B` : '—',
        [
          'Tokenized dollars expanding with reserve diversification',
          sc?.date ? fmtMacroDate(sc.date) : null,
        ].filter(Boolean).join(' · '),
      )}
    </div>
    ${cb?.note || cofer?.note ? `<p class="desk-footnote">${[cb?.note, cofer?.note].filter(Boolean).join(' · ')}</p>` : ''}
  `;
}

function renderPillarAi(ind, manual) {
  const ai = manual?.ai_transition || {};
  const oas = ind.HY_OAS;
  const staleOas = staleness(oas?.date, 4, 10);
  const staleAi = staleness(ai.updated, 45, 90);
  let oasTone = 'neu';
  if (oas?.value != null) {
    oasTone = oas.value > 5 ? 'tone-red' : oas.value > 4 ? 'tone-amber' : 'tone-green';
  }

  const cuts = !!ai.capex_cuts;
  let financeStatus = 'green';
  let financeLabel = 'Funding calm';
  if (oas?.value != null && oas.value > 5 && cuts) {
    financeStatus = 'red';
    financeLabel = 'Funding break risk';
  } else if ((oas?.value != null && oas.value > 4) || cuts) {
    financeStatus = 'amber';
    financeLabel = cuts ? 'Watch — capex cuts noted' : 'Watch — spreads elevated';
  }

  const oasLegend = `<span class="band-legend">
    <span class="tone-green">calm &lt;4%</span>
    <span class="tone-amber">watch 4–5%</span>
    <span class="tone-red">stress &gt;5%</span>
  </span>`;

  document.getElementById('pillar-ai-body').innerHTML = `
    <div class="ai-split">
      <div class="ai-col">
        <div class="ai-col-title">Near term — credit &amp; buildout</div>
        <div class="field-stack">
          ${fieldBlock('Spending vs cash flow', ai.crossover_status || '—', staleBadge(staleAi.level, staleAi.label), true)}
          ${fieldBlock(
            'Junk bond stress (HY OAS)',
            oas?.value != null ? `<span class="${oasTone}">${fmt(oas.value, 2)}%</span>` : '—',
            [oasLegend, fmtMacroDate(oas?.date), staleBadge(staleOas.level, staleOas.label)].filter(Boolean).join(' · '),
            false,
          )}
        </div>
        <div class="ai-finance-row">
          <span class="status-chip chip-${financeStatus}">${financeLabel}</span>
          <span class="meta-inline">Capex cuts: ${cuts ? 'yes' : 'no'}</span>
        </div>
      </div>
      <div class="ai-col">
        <div class="ai-col-title">Structural — cost of intelligence</div>
        <div class="field-stack">
          ${fieldBlock('Cost trends', ai.structural_slopes || '—', '', true)}
          ${fieldBlock('Next checkpoint', ai.next_test || '—', '', true)}
        </div>
      </div>
    </div>
  `;
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
  const wtiMarkers = [
    { value: 95, label: '$95', kind: 'above' },
    { value: 120, label: '$120', kind: 'above' },
  ];

  let etfValue = '—';
  let etfSub = '';
  if (etf?.net_usd_bn != null) {
    const n = etf.net_usd_bn;
    const cls = n >= 0 ? 'pos' : 'neg';
    etfValue = `<span class="${cls}">${n >= 0 ? '+' : ''}${n.toFixed(1)}B</span>`;
    const flowNote = n >= 0 ? 'Flows with liquidity' : 'Flows fighting liquidity';
    etfSub = [
      flowNote,
      etf.streak_weeks_outflow != null && n < 0 ? `${etf.streak_weeks_outflow}w outflow streak` : null,
      etf.period || null,
      etf.note || null,
    ].filter(Boolean).join(' · ');
  }

  document.getElementById('pillar-hardmoney-body').innerHTML = `
    <div class="desk-block">
      <table class="price-table pillar-price-table">
        <thead><tr><th>Asset</th><th class="num">Price</th><th class="num">Δ</th><th>52W Range</th></tr></thead>
        <tbody>
          ${priceRowHtml('BTC', 'BTC', p.BTC?.price, changePctOf(p, 'BTC'), p.BTC, btcMarkers, 0, '$')}
          ${priceRowHtml('WTI', 'WTI Crude', p.WTI?.price, changePctOf(p, 'WTI'), p.WTI, wtiMarkers, 2, '$')}
          ${priceRowHtml('VIX', 'VIX', p.VIX?.price, changePctOf(p, 'VIX'), p.VIX,
            [{ value: 30, label: '30', kind: 'above' }], 1, '')}
        </tbody>
      </table>
    </div>
    ${assetContextHtml(p.BTC)}
    ${transmissionHtml(tx)}
    <div class="mini-grid">
      ${miniCard('How long BTC has lagged money growth', divergenceClockHtml(months, divStart),
        manual?.divergence?.note || '')}
      ${miniCard('Spot BTC ETF flows', etfValue, etfSub || 'Update manually in manual.json')}
      ${miniCard(
        'Market mood (Fear &amp; Greed)',
        `<span class="${fgColorClass(fg?.value)}">${fg?.value ?? '—'}</span>
         <span class="fg-inline-sub">${fg?.classification || ''}</span>`,
        fgBarHtml(fg?.value),
      )}
    </div>
  `;
}

function renderPillars(prices, macro, manual) {
  const ind = macro?.indicators || {};
  renderPillarMonetary(ind, manual);
  renderPillarDedollar(prices, manual, macro);
  renderPillarAi(ind, manual);
  renderPillarHardMoney(prices, macro, manual);
}

function renderScenarioContext(manual) {
  const shell = document.getElementById('context-block');
  const regimeBlock = document.getElementById('regime-block');
  const waypointsBlock = document.getElementById('waypoints-block');
  const list = document.getElementById('regime-bullets');
  const body = document.getElementById('waypoints-body');
  const title = document.getElementById('context-title');
  const wpLabel = document.getElementById('waypoints-label');
  if (!shell) return;

  const bullets = manual?.regime_bullets;
  const wps = manual?.scenario?.waypoints;
  let show = false;

  if (regimeBlock && list && Array.isArray(bullets) && bullets.length) {
    list.innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
    regimeBlock.hidden = false;
    show = true;
  } else if (regimeBlock) {
    regimeBlock.hidden = true;
  }

  if (waypointsBlock && body && Array.isArray(wps) && wps.length) {
    const sc = manual?.scenario?.current || 'Current scenario';
    if (title) title.textContent = sc;
    if (wpLabel) wpLabel.textContent = 'Waypoints';
    body.innerHTML = wps.map(w => {
      const st = (w.status || 'pending').toLowerCase();
      const cls = st === 'hit' ? 'is-hit' : st === 'miss' ? 'is-miss' : 'is-approaching';
      const label = st === 'hit' ? 'hit' : st === 'miss' ? 'miss' : 'near';
      return `<div class="waypoint-row">
        <span class="waypoint-status ${cls}">${label}</span>
        <span class="waypoint-label">${w.label || w.id || '—'}</span>
      </div>`;
    }).join('');
    waypointsBlock.hidden = false;
    show = true;
  } else if (waypointsBlock) {
    waypointsBlock.hidden = true;
  }

  shell.hidden = !show;
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

// ─── Footer + ring hint ───────────────────────────────────────────────────────

function renderFooter(prices, macro, manual) {
  document.getElementById('footer-prices-ts').textContent   = fmtTs(prices?.updated_at);
  document.getElementById('footer-macro-ts').textContent    = fmtTs(macro?.updated_at);
  document.getElementById('footer-assessed-ts').textContent = fmtDate(manual?.scenario?.updated);
}

function setupRingHint() {
  // Outline the whole source-narrative panel (both disclosures), not just the
  // first summary row — inset so stroke isn't clipped by panel overflow:hidden.
  const panel = document.getElementById('panel-thesis');
  const details = document.getElementById('thesis-details');
  if (!panel || !details) return;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const path = document.createElementNS(NS, 'path');
  const INSET = 2;
  const RADIUS = 3;
  const STROKE = 1.25;

  svg.setAttribute('class', 'thesis-ring');
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-width', String(STROKE));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('pathLength', '100');
  // Dash ~12% of perimeter, gap the rest — offset 0→100 completes a full loop
  path.setAttribute('stroke-dasharray', '12 88');

  const ringColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-ring').trim() || 'rgba(107,159,212,0.55)';
  path.setAttribute('stroke', ringColor);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    let kf = document.getElementById('ring-kf');
    if (!kf) {
      kf = document.createElement('style');
      kf.id = 'ring-kf';
      document.head.appendChild(kf);
    }
    kf.textContent = `
      @keyframes ring-travel {
        from { stroke-dashoffset: 0; }
        to   { stroke-dashoffset: -100; }
      }
      .thesis-ring path {
        animation: ring-travel 5.5s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .thesis-ring path { animation: none; }
      }
    `;
  }

  svg.appendChild(path);
  panel.appendChild(svg);

  function roundedRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    return [
      `M ${x + rr},${y}`,
      `H ${x + w - rr}`,
      `A ${rr} ${rr} 0 0 1 ${x + w},${y + rr}`,
      `V ${y + h - rr}`,
      `A ${rr} ${rr} 0 0 1 ${x + w - rr},${y + h}`,
      `H ${x + rr}`,
      `A ${rr} ${rr} 0 0 1 ${x},${y + h - rr}`,
      `V ${y + rr}`,
      `A ${rr} ${rr} 0 0 1 ${x + rr},${y}`,
      'Z',
    ].join(' ');
  }

  function sizeRing() {
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    const iw = Math.max(0, w - INSET * 2);
    const ih = Math.max(0, h - INSET * 2);
    path.setAttribute('d', roundedRectPath(INSET, INSET, iw, ih, RADIUS));
  }

  function updateVisibility() {
    // Hide once the primary thesis is opened; show again if collapsed
    svg.style.display = details.hasAttribute('open') ? 'none' : '';
    if (!details.hasAttribute('open')) sizeRing();
  }

  requestAnimationFrame(() => {
    sizeRing();
    updateVisibility();
  });
  new MutationObserver(updateVisibility).observe(details, {
    attributes: true,
    attributeFilter: ['open'],
  });
  window.addEventListener('resize', sizeRing, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(sizeRing).observe(panel);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

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
  renderScenarioContext(manual);
  renderPillars(prices, macro, manual);
  renderFooter(prices, macro, manual);
  renderThesis();
  setupTriggerScroll();
  setupRingHint();

  // Console fixture check for July 2026 expected tally
  console.info(`Trigger tally: ${tally.green} green · ${tally.amber} amber · ${tally.red} red`);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
}

document.addEventListener('DOMContentLoaded', init);
