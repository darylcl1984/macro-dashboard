'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const DATA = {
  prices:  '../data/prices.json',
  macro:   '../data/macro.json',
  manual:  '../data/manual.json',
  alerts:  '../data/alerts.json',
  thesis:  '../docs/thesis.md',
  m2note:  '../docs/m2_note.md',
};

// Invalidation trigger thresholds (price-based, auto-evaluated)
const PRICE_TRIGGERS = [
  {
    key:       'btc_weekly_close',
    label:     'BTC weekly close',
    priceKey:  'BTC',
    prefix:    '$',
    decimals:  0,
    threshold: 52000,
    thresholdLabel: '< $52,000',
    // amber: within 15% above threshold
    amberFn: (price) => price < 52000 * 1.15,
    redFn:   (price) => price < 52000,
  },
  {
    key:       'gold_monthly_close',
    label:     'Gold monthly close',
    priceKey:  'XAUUSD',
    prefix:    '$',
    decimals:  0,
    threshold: 4000,
    thresholdLabel: '< $4,000',
    amberFn: (price) => price < 4000 * 1.10,
    redFn:   (price) => price < 4000,
  },
  {
    key:       'oil_sustained',
    label:     'Oil sustained > $120',
    priceKey:  'WTI',
    prefix:    '$',
    decimals:  2,
    threshold: 120,
    thresholdLabel: '> $120',
    amberFn: (price) => price > 100,
    redFn:   (price) => price > 120,
  },
];

// Manual triggers: key → display label
const MANUAL_TRIGGER_LABELS = {
  googl_ad_revenue_decline: { label: 'GOOGL ad revenue',     threshold: 'Decline 2 consecutive Qs' },
  meta_ad_revenue:          { label: 'META ad revenue',      threshold: '< 5% YoY 2 consecutive Qs while AI capex rising' },
  nvda_gross_margin:        { label: 'NVDA gross margin',    threshold: '< 60%' },
  taiwan_crisis:            { label: 'Taiwan military crisis', threshold: 'Binary escalation' },
  tsla_optimus_musk:        { label: 'TSLA Optimus / Musk',  threshold: 'Binary reversal' },
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

function fmtPct(n) {
  if (n == null || isNaN(n)) return '<span class="neu">n/a</span>';
  const sign = n >= 0 ? '+' : '';
  const cls  = n >= 0 ? 'pos' : 'neg';
  return `<span class="${cls}">${sign}${n.toFixed(2)}%</span>`;
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

function hoursAgo(isoStr) {
  if (!isoStr) return { text: '—', cls: '' };
  const ms = Date.now() - new Date(isoStr).getTime();
  const h  = ms / 3600000;
  const text = h < 1   ? `${Math.round(ms / 60000)}m ago`
             : h < 24  ? `${Math.round(h)}h ago`
             : `${Math.floor(h / 24)}d ago`;
  const cls  = h < 12  ? 'pos'
             : h < 24  ? 'highlight-warn'
             : 'neg';
  return { text, cls };
}

function daysAgo(ms) {
  const d = Math.floor(ms / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

/**
 * Returns staleness level and badge label for a given date.
 * @param {string|null} dateStr - ISO date/datetime string
 * @param {number} amberDays
 * @param {number} redDays
 * @returns {{ level: 'fresh'|'amber'|'red', label: string }}
 */
function staleness(dateStr, amberDays, redDays) {
  if (!dateStr) return { level: 'red', label: 'No date' };
  const age = Date.now() - new Date(dateStr).getTime();
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
  const entry = prices?.[key];
  if (!entry) return null;
  return entry.price ?? null;
}

function changePctOf(prices, key) {
  return prices?.[key]?.change_pct ?? null;
}

// ─── Section 1: Status Bar ────────────────────────────────────────────────────

function renderStatusBar(manual, macro, prices) {
  // Scenario
  const scenario = manual?.scenario;
  const current  = scenario?.current || '—';
  const prob     = scenario?.probability || '';
  const scenarioEl = document.getElementById('scenario-value');
  const scenarioCell = document.getElementById('s-scenario');
  const clsMap = { Bull: 'bull', Base: 'base', Bear: 'bear', 'Tail Risk': 'tail' };
  const cls = clsMap[current] || 'base';
  scenarioEl.textContent = current;
  scenarioEl.className = `status-value scenario-${cls}`;
  scenarioCell.classList.add(cls);
  document.getElementById('s-scenario').querySelector('.status-sub').textContent = prob;

  // Last Updated — older of prices and macro timestamps
  const pricesTs  = prices?.updated_at;
  const macroTs   = macro?.updated_at;
  const olderTs   = (!pricesTs || !macroTs)
    ? (pricesTs || macroTs)
    : (new Date(pricesTs) < new Date(macroTs) ? pricesTs : macroTs);
  const { text: updText, cls: updCls } = hoursAgo(olderTs);
  const updEl = document.getElementById('last-updated-value');
  updEl.textContent = updText;
  updEl.className   = `status-value ${updCls}`;
  document.getElementById('last-updated-sub').textContent = scenario?.updated
    ? `Scenario: ${fmtDate(scenario.updated)}` : '';

  // Global M2 YoY
  const gm2 = manual?.global_m2;
  const yoy = gm2?.yoy_pct;
  const m2yoyEl = document.getElementById('m2-yoy');
  if (yoy != null) {
    const sign = yoy >= 0 ? '+' : '';
    const cls2 = yoy > 0 ? 'pos' : 'neg';
    m2yoyEl.innerHTML = `<span class="${cls2}">${sign}${yoy.toFixed(1)}%</span>`;
  } else {
    m2yoyEl.textContent = '—';
  }
  const m2s = staleness(gm2?.updated, 90, 180);
  document.getElementById('m2-stale').innerHTML = staleBadge(m2s.level, m2s.label);

  // Fear & Greed
  const fg = macro?.indicators?.FEAR_GREED;
  const fgVal = fg?.value;
  const fgClass = fg?.classification || '';
  const fgEl = document.getElementById('fg-value');
  fgEl.textContent = fgVal != null ? fgVal : '—';
  fgEl.className = `status-value ${fgColorClass(fgVal)}`;
  document.getElementById('fg-class').textContent = fgClass;

  // Regime summary bar
  const regimeBar = document.getElementById('regime-bar');
  if (regimeBar) {
    const yoy2   = manual?.global_m2?.yoy_pct;
    const yoyStr = yoy2 != null ? `M2 ${yoy2 >= 0 ? '+' : ''}${yoy2.toFixed(1)}% YoY` : null;
    const parts  = [`${current} scenario`, yoyStr, fgClass || null].filter(Boolean);
    const dotColors = { Bull: 'var(--green)', Base: 'var(--blue)', Bear: 'var(--amber)', 'Tail Risk': 'var(--red)' };
    const dotColor  = dotColors[current] || 'var(--text-dim)';
    regimeBar.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:8px;vertical-align:middle"></span>${parts.join(' · ')}`;
  }
}

function fgColorClass(val) {
  if (val == null) return '';
  if (val <= 25) return 'fg-extreme-fear';
  if (val <= 45) return 'fg-fear';
  if (val <= 55) return 'fg-neutral';
  if (val <= 75) return 'fg-greed';
  return 'fg-extreme-greed';
}

// ─── Section 2: Invalidation Triggers ─────────────────────────────────────────

function renderTriggers(prices, manual) {
  const tbody = document.getElementById('trigger-rows');
  const rows = [];

  // Price-based triggers
  for (const t of PRICE_TRIGGERS) {
    const price = priceOf(prices?.prices, t.priceKey);
    const current = price != null ? fmt(price, t.decimals, t.prefix) : '—';
    let status, dotClass;
    if (price == null) {
      status = '○'; dotClass = 'neu';
    } else if (t.redFn(price)) {
      status = '●'; dotClass = 'dot-red';
    } else if (t.amberFn(price)) {
      status = '●'; dotClass = 'dot-amber';
    } else {
      status = '●'; dotClass = 'dot-green';
    }
    rows.push(`
      <tr>
        <td>${t.label}</td>
        <td><span class="trigger-current">${current}</span> <span class="trigger-arrow">→</span> <span class="trigger-threshold-inline">${t.thresholdLabel}</span></td>
        <td class="trigger-status ${dotClass}">${status}</td>
      </tr>`);
  }

  // Global M2 YoY trigger
  const gm2 = manual?.global_m2;
  const yoy = gm2?.yoy_pct;
  let m2Status, m2Dot;
  if (yoy == null) {
    m2Status = '○'; m2Dot = 'neu';
  } else if (yoy < 0) {
    m2Status = '●'; m2Dot = 'dot-red';
  } else if (yoy < 3) {
    m2Status = '●'; m2Dot = 'dot-amber';
  } else {
    m2Status = '●'; m2Dot = 'dot-green';
  }
  const m2Stale = staleness(gm2?.updated, 90, 180);
  const m2Str = yoy != null ? (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%' : '—';
  rows.push(`
    <tr>
      <td>Global M2 YoY</td>
      <td><span class="trigger-current">${m2Str}</span> ${staleBadge(m2Stale.level, m2Stale.label)} <span class="trigger-arrow">→</span> <span class="trigger-threshold-inline">&lt; 0%</span></td>
      <td class="trigger-status ${m2Dot}">${m2Status}</td>
    </tr>`);

  // Manual / binary triggers
  const manualTriggers = manual?.invalidation_triggers || {};
  for (const [key, meta] of Object.entries(MANUAL_TRIGGER_LABELS)) {
    const t = manualTriggers[key];
    const status = t?.status || 'green';
    const notes  = t?.notes  || '—';
    const upd    = t?.updated;
    const dotClass = status === 'red' ? 'dot-red' : status === 'amber' ? 'dot-amber' : 'dot-green';
    const stale  = staleness(upd, 30, 60);
    rows.push(`
      <tr>
        <td>${meta.label}</td>
        <td>${notes} ${staleBadge(stale.level, stale.label)} <span class="trigger-sep">—</span> <span class="trigger-threshold-inline">Trigger: ${meta.threshold}</span></td>
        <td class="trigger-status ${dotClass}">●</td>
      </tr>`);
  }

  tbody.innerHTML = rows.join('');
}

// ─── Section 3: Positions ─────────────────────────────────────────────────────

const RANGE_REVERSED = new Set(['WTI', 'VIX']);

function fmtRangeVal(v) {
  if (v == null) return '—';
  if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 10)   return '$' + Math.round(v);
  return '$' + v.toFixed(2);
}

function alertTagHtml(price, al) {
  if (price == null || al == null) return '';
  if (al.below != null && price < al.below) return ` <span class="alert-tag">(⚠ &lt;${fmtRangeVal(al.below)})</span>`;
  if (al.above != null && price > al.above) return ` <span class="alert-tag">(⚠ &gt;${fmtRangeVal(al.above)})</span>`;
  return '';
}

function rangeBarHtml(sym, price, low, high, below, above) {
  if (price == null || low == null || high == null || high <= low)
    return '<span class="neu">—</span>';
  const span = high - low;
  const pct  = Math.min(1, Math.max(0, (price - low) / span));

  // Dot colour — grey normally, orange when price has breached a threshold
  const belowBreach = below != null && price < below;
  const aboveBreach = above != null && price > above;
  const alerted     = belowBreach || aboveBreach;
  const color       = alerted ? 'var(--amber)' : 'var(--text-dim)';

  // Descriptor text with position-based colour (reversed for WTI/VIX)
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

  // Alert tick marks and zone fills — only render if threshold is within the 52w range
  let ticks = '', zones = '';
  if (below != null) {
    const tp = (below - low) / span;
    if (tp > 0 && tp < 1) {
      zones += `<div class="range-zone" style="left:0;width:${(tp * 100).toFixed(1)}%"></div>`;
      ticks += `<div class="range-tick" style="left:${(tp * 100).toFixed(1)}%" data-tooltip="Alert: <${fmtRangeVal(below)}"></div>`;
    }
  }
  if (above != null) {
    const tp = (above - low) / span;
    if (tp > 0 && tp < 1) {
      zones += `<div class="range-zone" style="left:${(tp * 100).toFixed(1)}%;right:0"></div>`;
      ticks += `<div class="range-tick" style="left:${(tp * 100).toFixed(1)}%" data-tooltip="Alert: >${fmtRangeVal(above)}"></div>`;
    }
  }

  return `<div class="range-track">${zones}${ticks}<div class="range-dot" style="left:${(pct * 100).toFixed(1)}%;background:${color}"></div></div>`
       + `<div class="range-desc">${desc}</div>`;
}

function alertRow(prices, alerts, sym, label, prefix, decimals) {
  const price = priceOf(prices?.prices, sym);
  const chg   = changePctOf(prices?.prices, sym);
  const entry = prices?.prices?.[sym];
  const al    = alerts?.[sym];

  return `<tr>
    <td class="asset-name">${label}${alertTagHtml(price, al)}</td>
    <td class="num">${fmt(price, decimals, prefix)}</td>
    <td class="num">${fmtPct(chg)}</td>
    <td class="range-cell">${rangeBarHtml(sym, price, entry?.week52_low ?? null, entry?.week52_high ?? null, al?.below ?? null, al?.above ?? null)}</td>
  </tr>`;
}

function renderPositions(prices, alerts) {
  // Hard Money
  const hardMoney = [
    alertRow(prices, alerts, 'BTC',    'BTC',       '$', 0),
    alertRow(prices, alerts, 'XAUUSD', 'Gold',       '$', 0),
  ].join('');
  document.getElementById('group-hard-money').innerHTML = hardMoney;

  // Macro Signals (placed under Hard Money)
  const macroSignals = [
    alertRow(prices, alerts, 'WTI', 'WTI Crude', '$', 2),
    alertRow(prices, alerts, 'VIX', 'VIX',       '',  1),
  ].join('');
  document.getElementById('group-macro-signals').innerHTML = macroSignals;

  // AI & Tech
  const tech = [
    alertRow(prices, alerts, 'NVDA',  'NVDA',  '$', 2),
    alertRow(prices, alerts, 'TSLA',  'TSLA',  '$', 2),
    alertRow(prices, alerts, 'GOOGL', 'GOOGL', '$', 2),
    alertRow(prices, alerts, 'META',  'META',  '$', 2),
    alertRow(prices, alerts, 'TSM',   'TSM',   '$', 2),
    alertRow(prices, alerts, 'PLTR',  'PLTR',  '$', 2),
    alertRow(prices, alerts, 'MSTR',  'MSTR',  '$', 2),
    alertRow(prices, alerts, 'NOW',   'NOW',   '$', 2),
    alertRow(prices, alerts, 'GEV',   'GEV',   '$', 2),
  ].join('');
  document.getElementById('group-tech').innerHTML = tech;
}

// ─── Section 4: Macro Indicators Panel ────────────────────────────────────────

function macroCard(label, valueHtml, subHtml = '', extraClass = '') {
  return `<div class="macro-card ${extraClass}">
    <div class="macro-card-label">${label}</div>
    <div class="macro-card-value">${valueHtml}</div>
    ${subHtml ? `<div class="macro-card-sub">${subHtml}</div>` : ''}
  </div>`;
}

function fgBarHtml(val) {
  if (val == null) return '';
  const pct = Math.min(100, Math.max(0, val));
  const color = val <= 25 ? 'var(--red)' : val <= 45 ? 'var(--amber)' : val <= 55 ? 'var(--text-dim)' : val <= 75 ? '#84cc16' : 'var(--green)';
  return `<div class="fg-bar-track">
    <div class="fg-bar-fill" style="width:${pct}%;background:${color}"></div>
    <div class="fg-bar-marker" style="left:${pct}%"></div>
  </div>`;
}

function renderMacro(macro, manual, prices) {
  const ind = macro?.indicators || {};

  const usM2   = ind.US_M2;
  const dgy    = ind.USD_INDEX;
  const us10y  = ind.US_10Y;
  const jpM2   = ind.JP_M2;
  const fg     = ind.FEAR_GREED;
  const gm2    = manual?.global_m2;
  const eurM2  = manual?.eur_m2;
  const cnM2   = manual?.china_m2;
  const ukM2   = manual?.uk_m2;

  const dxyCls  = dgy?.value < 100 ? 'highlight-warn' : '';
  const us10yCls = us10y?.value > 4.5 ? 'highlight-warn' : '';

  const staleM2  = staleness(usM2?.date,   35,  60);
  const staleGm2 = staleness(gm2?.updated, 90, 180);
  const stale10y = staleness(us10y?.date,   5,  10);
  const staleDxy = staleness(dgy?.date,     5,  10);
  const staleEu  = staleness(eurM2?.updated, 90, 180);
  const staleJp  = staleness(jpM2?.date,   35,  60);
  const staleCn  = staleness(cnM2?.updated, 90, 180);
  const staleUk  = staleness(ukM2?.updated, 90, 180);

  // JP M2 from BOJ is in trillions JPY — convert to USD using live USDJPY from Stooq
  const usdjpy = prices?.fx?.USDJPY;
  const jpM2Usd = (jpM2?.value != null && usdjpy) ? jpM2.value / usdjpy : null;

  const cards = [
    macroCard(
      'Global M2 Composite',
      gm2?.value != null ? `$${gm2.value.toFixed(1)}T` : '—',
      `YoY: ${gm2?.yoy_pct != null ? `<span class="${gm2.yoy_pct >= 0 ? 'pos' : 'neg'}">${gm2.yoy_pct >= 0 ? '+' : ''}${gm2.yoy_pct.toFixed(1)}%</span>` : '—'} ${staleBadge(staleGm2.level, staleGm2.label)}`,
      `macro-card-hero${staleGm2.level !== 'fresh' ? ` value-stale-${staleGm2.level}` : ''}`,
    ),
    macroCard(
      'US M2',
      `${fmt(usM2?.value, 0, '$')}B`,
      `${fmtMacroDate(usM2?.date)} ${staleBadge(staleM2.level, staleM2.label)}`,
    ),
    macroCard(
      'Eurozone M2',
      eurM2?.value != null ? `$${eurM2.value.toFixed(2)}T` : '—',
      `${fmtMacroDate(eurM2?.period)} ${staleBadge(staleEu.level, staleEu.label)}`,
    ),
    macroCard(
      'Japan M2',
      jpM2Usd != null ? `$${jpM2Usd.toFixed(1)}T` : '—',
      `${fmtMacroDate(jpM2?.date)} ${staleBadge(staleJp.level, staleJp.label)}`,
    ),
    macroCard(
      'China M2',
      cnM2?.value != null ? `$${cnM2.value.toFixed(2)}T` : '—',
      `${fmtMacroDate(cnM2?.period)} ${staleBadge(staleCn.level, staleCn.label)}`,
    ),
    macroCard(
      'UK M2',
      ukM2?.value != null ? `$${ukM2.value.toFixed(2)}T` : '—',
      `${fmtMacroDate(ukM2?.period)} ${staleBadge(staleUk.level, staleUk.label)}`,
    ),
    macroCard(
      'US 10Y Treasury',
      `<span class="${us10yCls}">${fmt(us10y?.value, 2)}%</span>`,
      `${fmtMacroDate(us10y?.date)} ${staleBadge(stale10y.level, stale10y.label)}`,
    ),
    macroCard(
      'US Dollar Index (DXY)',
      `<span class="${dxyCls}">${fmt(dgy?.value, 2)}</span>`,
      `${fmtMacroDate(dgy?.date)} ${staleBadge(staleDxy.level, staleDxy.label)} ${dgy?.value < 100 ? '<span class="highlight-warn">Below 100 — thesis signal</span>' : ''}`,
    ),
    macroCard(
      'Fear &amp; Greed',
      `<span class="${fgColorClass(fg?.value)}">${fg?.value ?? '—'}</span> <span class="fg-inline-sub">${fg?.classification || ''} · ${fmtMacroDate(fg?.date)}</span>`,
      fgBarHtml(fg?.value),
      'macro-card-primary',
    ),
  ].join('');

  document.getElementById('macro-grid').innerHTML = cards;
}

// ─── Section 5: Thesis ────────────────────────────────────────────────────────

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
  renderMarkdownDoc(DATA.thesis,  'thesis-content',   'Thesis document not yet written. Check back soon.');
  renderMarkdownDoc(DATA.m2note,  'm2-note-content',  'Notes not yet written. Check back soon.');
}

function mdToHtml(md) {
  // Process tables before general paragraph handling
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

// ─── Thesis ring hint ─────────────────────────────────────────────────────────

function setupRingHint() {
  const details = document.getElementById('thesis-details');
  if (!details) return;
  const summary = details.querySelector('.thesis-summary');
  if (!summary) return;

  const NS   = 'http://www.w3.org/2000/svg';
  const svg  = document.createElementNS(NS, 'svg');
  const rect = document.createElementNS(NS, 'rect');
  const RX = 2, STROKE = 1.5, PAD = 1;

  // Static attributes — pathLength="1" normalises the coordinate system so
  // dasharray/dashoffset are simple fractions; no pixel perimeter calculation needed.
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'rgba(59,130,246,0.55)');
  rect.setAttribute('stroke-width', String(STROKE));
  rect.setAttribute('stroke-linecap', 'round');
  rect.setAttribute('pathLength', '1');
  rect.setAttribute('stroke-dasharray', '0.12 0.88');
  rect.setAttribute('rx', String(RX));

  // Inject keyframe once — offset travels from 0 → -1 (one full revolution)
  let kf = document.getElementById('ring-kf');
  if (!kf) { kf = document.createElement('style'); kf.id = 'ring-kf'; document.head.appendChild(kf); }
  kf.textContent = '@keyframes ring-travel { to { stroke-dashoffset: -1; } }';
  rect.style.animation = 'ring-travel 4s linear infinite';

  svg.appendChild(rect);
  summary.appendChild(svg);

  function sizeRing() {
    const { width, height } = summary.getBoundingClientRect();
    if (!width || !height) return;
    const w = width + PAD * 2, h = height + PAD * 2;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.position     = 'absolute';
    svg.style.top          = `${-PAD}px`;
    svg.style.left         = `${-PAD}px`;
    svg.style.width        = `${w}px`;
    svg.style.height       = `${h}px`;
    svg.style.pointerEvents = 'none';
    svg.style.zIndex       = '2';
    svg.style.overflow     = 'visible';
    rect.setAttribute('x', String(PAD));
    rect.setAttribute('y', String(PAD));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
  }

  // Defer initial sizing until after paint so getBoundingClientRect is reliable
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

  // Fetch all data in parallel; fail gracefully per source
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

  if (manualResult.status === 'fulfilled') manual = manualResult.value;
  else console.warn('manual.json failed:', manualResult.reason);

  if (alertsResult.status === 'fulfilled') alerts = alertsResult.value;
  else console.warn('alerts.json failed:', alertsResult.reason);

  renderStatusBar(manual, macro, prices);
  renderTriggers(prices, manual);
  renderPositions(prices, alerts);
  renderMacro(macro, manual, prices);
  renderFooter(prices, macro, manual);
  renderThesis();
  setupRingHint();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
}

document.addEventListener('DOMContentLoaded', init);
