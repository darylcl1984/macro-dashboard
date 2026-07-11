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
  const color = alerted ? 'var(--amber)' : 'var(--text-dim)';

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
    ticks += `<div class="range-tick" style="left:${left}%" data-tooltip="${tip}"></div>`;
    labels += `<span class="range-mark-label" style="left:${left}%">${tip}</span>`;
  }

  return `<div class="range-wrap">
    <div class="range-track">${zones}${ticks}<div class="range-dot" style="left:${(pct * 100).toFixed(1)}%;background:${color}"></div></div>
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

  return [
    {
      id: 'btc_demand',
      label: 'BTC structural demand',
      threshold: 'Weekly close < $53,000',
      current() {
        const price = btc?.price;
        if (price == null) return '—';
        const low = btc.week52_low;
        const bits = [fmt(price, 0, '$')];
        if (low != null) bits.push(`52w low ${fmt(low, 0, '$')}`);
        return bits.join(' · ');
      },
      status() {
        const price = btc?.price;
        if (price == null) return 'green';
        if (price < 53000) return 'red';
        if (price < 60950 || (btc.week52_low != null && btc.week52_low < 58300)) return 'amber';
        return 'green';
      },
      note() { return ''; },
    },
    {
      id: 'gold_hedge',
      label: 'Gold monetary-hedge bid',
      threshold: 'Monthly close < $4,000',
      current() {
        const price = gold?.price;
        const base = price != null ? fmt(price, 0, '$') + ' live' : '—';
        const n = manualNotes('gold_monthly_close');
        return n ? `${base} · ${n}` : base;
      },
      status() {
        const live = gold?.price;
        const man = manualStatus('gold_monthly_close');
        const liveRed = live != null && live < 4000;
        const liveAmber = live != null && live < 4000;
        // Red: manual red, or live < 4000 AND manual red
        if (man === 'red' || (liveRed && man === 'red')) return 'red';
        // Amber: live < 4000 (pending close) OR manual amber
        if (liveAmber || man === 'amber') return 'amber';
        return 'green';
      },
      note() { return manualNotes('gold_monthly_close'); },
    },
    {
      id: 'divergence',
      label: 'BTC–M2 divergence',
      threshold: '≥ 18 months',
      current() {
        if (manual?.divergence?.start == null) return 'Reconnected';
        if (divMonths == null) return '—';
        return `${divMonths} mo since ${manual.divergence.start}`;
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
      label: 'COFER reversal',
      threshold: '4 consecutive rising quarters',
      current() {
        if (coferQ == null) return '—';
        return `${coferQ} consecutive · ${manual?.cofer_usd_share?.period || ''}`.trim();
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
      label: 'Global M2',
      threshold: 'YoY < 0%',
      current() {
        if (m2yoy.value == null) return '—';
        const tag = m2yoy.estimated ? ' (est.)' : '';
        const sign = m2yoy.value >= 0 ? '+' : '';
        return `${sign}${m2yoy.value.toFixed(1)}%${tag}`;
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
      label: 'Oil shock',
      threshold: '> $120 sustained 4+ weeks',
      current() {
        const price = wti?.price;
        if (price == null) return '—';
        if (price > 120) return `${fmt(price, 2, '$')} (pending 4-wk confirmation)`;
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
      label: 'AI financing break',
      threshold: 'HY OAS > 5% + capex cuts',
      current() {
        const oasStr = oas != null ? `${oas.toFixed(2)}% OAS` : 'OAS —';
        const n = manualNotes('ai_financing');
        return n ? `${oasStr} · ${n}` : oasStr;
      },
      status() {
        const man = manualStatus('ai_financing');
        const oasRed = oas != null && oas > 5;
        const oasAmber = oas != null && oas > 4;
        return worstStatus(
          oasRed ? 'red' : oasAmber ? 'amber' : 'green',
          man || 'green',
        );
      },
      note() { return manualNotes('ai_financing'); },
    },
    {
      id: 'taiwan',
      label: 'Taiwan escalation',
      threshold: 'Major military escalation',
      current() {
        return manualNotes('taiwan') || '—';
      },
      status() {
        return manualStatus('taiwan') || 'green';
      },
      note() { return manualNotes('taiwan'); },
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
      <td class="num" data-label="Status">${statusChip(status)}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
  return tallyTriggers(triggers);
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
  scenarioCell.className = `status-cell ${cls}`;
  document.getElementById('scenario-prob').textContent = prob;

  const ind = macro?.indicators || {};
  const m2yoy = resolveM2Yoy(ind, manual);
  const m2yoyEl = document.getElementById('m2-yoy');
  if (m2yoy.value != null) {
    const sign = m2yoy.value >= 0 ? '+' : '';
    const cls2 = m2yoy.value > 0 ? 'pos' : 'neg';
    const est  = m2yoy.estimated ? ' <span class="est-tag">est.</span>' : '';
    m2yoyEl.innerHTML = `<span class="${cls2}">${sign}${m2yoy.value.toFixed(1)}%</span>${est}`;
  } else {
    m2yoyEl.textContent = '—';
  }
  const m2s = staleness(m2yoy.sourceDate, 45, 90);
  document.getElementById('m2-stale').innerHTML = staleBadge(m2s.level, m2s.label);

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

function heroStat(valueHtml, subHtml) {
  return `<div class="hero-stat">
    <div class="hero-stat-value">${valueHtml}</div>
    ${subHtml ? `<div class="hero-stat-sub">${subHtml}</div>` : ''}
  </div>`;
}

function miniCard(label, valueHtml, subHtml = '') {
  return `<div class="mini-card">
    <div class="mini-card-label">${label}</div>
    <div class="mini-card-value">${valueHtml}</div>
    ${subHtml ? `<div class="mini-card-sub">${subHtml}</div>` : ''}
  </div>`;
}

function fgBarHtml(val) {
  if (val == null) return '';
  const pct = Math.min(100, Math.max(0, val));
  const color = val <= 25 ? 'var(--red)' : val <= 45 ? 'var(--amber)'
              : val <= 55 ? 'var(--text-dim)' : val <= 75 ? '#84cc16' : 'var(--green)';
  return `<div class="fg-bar-track">
    <div class="fg-bar-fill" style="width:${pct}%;background:${color}"></div>
    <div class="fg-bar-marker" style="left:${pct}%"></div>
  </div>`;
}

function divergenceClockHtml(months, start) {
  if (start == null) {
    return `<div class="div-clock">
      <div class="div-clock-label pos">Reconnected</div>
      <div class="div-clock-track"><div class="div-clock-fill fill-green" style="width:0%"></div></div>
    </div>`;
  }
  if (months == null) return '<span class="neu">—</span>';
  const pct = Math.min(100, (months / 18) * 100);
  const tone = months >= 18 ? 'red' : months >= 12 ? 'amber' : 'green';
  return `<div class="div-clock">
    <div class="div-clock-label chip-${tone}">${months} mo <span class="neu">/ 18</span></div>
    <div class="div-clock-track"><div class="div-clock-fill fill-${tone}" style="width:${pct.toFixed(1)}%"></div></div>
  </div>`;
}

function renderPillarMonetary(ind, manual) {
  const gm2 = ind.GLOBAL_M2;
  const m2yoy = resolveM2Yoy(ind, manual);
  const fxAdj = ind.GLOBAL_M2_YOY?.fx_adjusted_pct;
  const comps = gm2?.components || {};
  const dates = gm2?.component_dates || {};
  const cn = manual?.china_m2;
  const fx = ind.fx || {};

  const localVals = {
    US: ind.US_M2?.value != null ? `$${fmt(ind.US_M2.value, 0)}B` : '—',
    CN: cn?.value != null ? `¥${fmt(cn.value, 2)}T` : '—',
    EZ: ind.EZ_M2?.value != null ? `€${fmt(ind.EZ_M2.value, 2)}T` : '—',
    JP: ind.JP_M2?.value != null ? `¥${fmt(ind.JP_M2.value, 2)}T` : '—',
    UK: ind.UK_M4?.value != null ? `£${fmt(ind.UK_M4.value, 1)}B` : '—',
  };

  const yoyHtml = m2yoy.value != null
    ? `${fmtPct(m2yoy.value)}${m2yoy.estimated ? ' <span class="est-tag">est.</span>' : ''}`
    : '—';
  const fxAdjHtml = fxAdj != null ? ` · FX-adj ${fmtPct(fxAdj)}` : '';

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
      <td data-label="Bloc">${bloc}${src}</td>
      <td class="num" data-label="Local">${localVals[bloc]}</td>
      <td class="num" data-label="USD">${usd != null ? `$${fmt(usd, 2)}T` : '—'}</td>
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

  document.getElementById('pillar-monetary-body').innerHTML = `
    ${heroStat(
      gm2?.value != null ? `$${fmt(gm2.value, 2)}T` : '—',
      `YoY ${yoyHtml}${fxAdjHtml}`,
    )}
    <table class="bloc-table">
      <thead><tr><th>Bloc</th><th class="num">Local</th><th class="num">USD</th><th>As of</th></tr></thead>
      <tbody>${blocRows}</tbody>
    </table>
    <div class="mini-grid">
      ${miniCard('US M2', usM2?.value != null ? `$${fmt(usM2.value, 0)}B` : '—',
        `${fmtMacroDate(usM2?.date)} ${staleBadge(staleUsM2.level, staleUsM2.label)}`)}
      ${miniCard('US Net Liquidity', netLiq?.value != null ? `$${fmt(netLiq.value, 0)}B` : '—',
        `${fmtMacroDate(netLiq?.date)} ${staleBadge(staleNet.level, staleNet.label)}`)}
      ${miniCard('US 10Y', us10y?.value != null ? `${fmt(us10y.value, 2)}%` : '—',
        `${fmtMacroDate(us10y?.date)} ${staleBadge(stale10y.level, stale10y.label)}`)}
      ${miniCard('USD Broad Index (Fed)', usdIdx?.value != null ? fmt(usdIdx.value, 2) : '—',
        `${fmtMacroDate(usdIdx?.date)} ${staleBadge(staleUsd.level, staleUsd.label)}`)}
    </div>
  `;
}

function renderPillarDedollar(prices, manual) {
  const gold = prices?.prices?.XAUUSD;
  const price = gold?.price;
  const cb = manual?.cb_gold;
  const cofer = manual?.cofer_usd_share;
  const staleCb = staleness(cb?.updated || cb?.period, 120, 180);
  const staleCofer = staleness(cofer?.updated || cofer?.period, 120, 180);

  const markers = [{ value: 4000, label: '$4,000', kind: 'below' }];

  document.getElementById('pillar-dedollar-body').innerHTML = `
    <table class="price-table pillar-price-table">
      <thead><tr><th>Asset</th><th class="num">Price</th><th class="num">Δ</th><th>52W Range</th></tr></thead>
      <tbody>
        ${priceRowHtml('XAUUSD', 'Gold', price, changePctOf(prices?.prices, 'XAUUSD'), gold, markers, 0, '$')}
      </tbody>
    </table>
    <div class="mini-grid">
      ${miniCard(
        'CB Gold Purchases',
        cb?.quarterly_tonnes != null ? `${fmt(cb.quarterly_tonnes, 0)} t` : '—',
        [
          cb?.yoy_pct != null ? `YoY ${fmtPct(cb.yoy_pct, 0)}` : null,
          cb?.latest_monthly ? `Latest ${cb.latest_monthly.tonnes} t (${cb.latest_monthly.period})` : null,
          `${fmtMacroDate(cb?.period)} ${staleBadge(staleCb.level, staleCb.label)}`,
          cb?.note || null,
        ].filter(Boolean).join(' · '),
      )}
      ${miniCard(
        'COFER USD Share',
        cofer?.consecutive_rising_quarters != null
          ? `${cofer.consecutive_rising_quarters} rising Qs`
          : '—',
        [
          cofer?.period || null,
          staleBadge(staleCofer.level, staleCofer.label),
          cofer?.note || null,
        ].filter(Boolean).join(' · '),
      )}
    </div>
  `;
}

function renderPillarAi(ind, manual) {
  const ai = manual?.ai_transition || {};
  const oas = ind.HY_OAS;
  const staleOas = staleness(oas?.date, 4, 10);
  const staleAi = staleness(ai.updated, 45, 90);
  let oasTone = 'neu';
  if (oas?.value != null) {
    oasTone = oas.value > 5 ? 'chip-red' : oas.value > 4 ? 'chip-amber' : 'chip-green';
  }

  document.getElementById('pillar-ai-body').innerHTML = `
    <div class="mini-grid mini-grid-3">
      ${miniCard('Crossover Status', ai.crossover_status || '—', staleBadge(staleAi.level, staleAi.label))}
      ${miniCard('Structural Slopes', ai.structural_slopes || '—')}
      ${miniCard('Next Test', ai.next_test || '—')}
    </div>
    <div class="mini-grid">
      ${miniCard(
        'HY OAS',
        oas?.value != null
          ? `<span class="${oasTone}">${fmt(oas.value, 2)}%</span>`
          : '—',
        [
          'green &lt;4% · amber 4–5% · red &gt;5%',
          fmtMacroDate(oas?.date),
          staleBadge(staleOas.level, staleOas.label),
        ].filter(Boolean).join(' · '),
      )}
    </div>
  `;
}

function renderPillarHardMoney(prices, macro, manual) {
  const p = prices?.prices || {};
  const fg = macro?.indicators?.FEAR_GREED;
  const divStart = manual?.divergence?.start;
  const months = monthsSince(divStart);

  const btcMarkers = [
    { value: 53000, label: '$53k', kind: 'below' },
    { value: 83800, label: '$83.8k', kind: 'mark' },
  ];

  document.getElementById('pillar-hardmoney-body').innerHTML = `
    <table class="price-table pillar-price-table">
      <thead><tr><th>Asset</th><th class="num">Price</th><th class="num">Δ</th><th>52W Range</th></tr></thead>
      <tbody>
        ${priceRowHtml('BTC', 'BTC', p.BTC?.price, changePctOf(p, 'BTC'), p.BTC, btcMarkers, 0, '$')}
        ${priceRowHtml('WTI', 'WTI Crude', p.WTI?.price, changePctOf(p, 'WTI'), p.WTI,
          [{ value: 120, label: '$120', kind: 'above' }], 2, '$')}
        ${priceRowHtml('VIX', 'VIX', p.VIX?.price, changePctOf(p, 'VIX'), p.VIX,
          [{ value: 30, label: '30', kind: 'above' }], 1, '')}
      </tbody>
    </table>
    <div class="mini-grid">
      ${miniCard('Divergence Clock', divergenceClockHtml(months, divStart),
        manual?.divergence?.note || '')}
      ${miniCard(
        'Fear &amp; Greed',
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
  renderPillarDedollar(prices, manual);
  renderPillarAi(ind, manual);
  renderPillarHardMoney(prices, macro, manual);
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
  const details = document.getElementById('thesis-details');
  if (!details) return;
  const summary = details.querySelector('.thesis-summary');
  if (!summary) return;

  const NS   = 'http://www.w3.org/2000/svg';
  const svg  = document.createElementNS(NS, 'svg');
  const path = document.createElementNS(NS, 'path');
  const PAD  = 1, STROKE = 1.5;

  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'rgba(59,130,246,0.55)');
  path.setAttribute('stroke-width', String(STROKE));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('pathLength', '1');
  path.setAttribute('stroke-dasharray', '0.12 0.88');

  let kf = document.getElementById('ring-kf');
  if (!kf) { kf = document.createElement('style'); kf.id = 'ring-kf'; document.head.appendChild(kf); }
  kf.textContent = '@keyframes ring-travel { to { stroke-dashoffset: -1; } }';
  path.style.animation = 'ring-travel 4s linear infinite';

  svg.appendChild(path);
  summary.appendChild(svg);

  function sizeRing() {
    const { width, height } = summary.getBoundingClientRect();
    if (!width || !height) return;
    const w = width + PAD * 2, h = height + PAD * 2;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.position      = 'absolute';
    svg.style.top           = `${-PAD}px`;
    svg.style.left          = `${-PAD}px`;
    svg.style.width         = `${w}px`;
    svg.style.height        = `${h}px`;
    svg.style.pointerEvents = 'none';
    svg.style.zIndex        = '2';
    svg.style.overflow      = 'visible';
    const x = PAD, y = PAD;
    path.setAttribute('d', `M ${x},${y} h ${width} v ${height} h ${-width} Z`);
  }

  requestAnimationFrame(sizeRing);
  const updateVisibility = () => { svg.style.display = details.hasAttribute('open') ? 'none' : ''; };
  updateVisibility();
  new MutationObserver(updateVisibility).observe(details, { attributes: true, attributeFilter: ['open'] });
  window.addEventListener('resize', sizeRing, { passive: true });
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
