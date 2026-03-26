'use strict';

// ─── Config ──────────────────────────────────────────────────────────────────

const DATA = {
  prices:  '../data/prices.json',
  macro:   '../data/macro.json',
  manual:  '../data/manual.json',
  alerts:  '../data/alerts.json',
  thesis:  '../docs/thesis.md',
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
  if (n == null || isNaN(n)) return '<span class="neu">—</span>';
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

function renderStatusBar(manual, macro) {
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

  // Last assessed
  const assessedDate = scenario?.updated;
  document.getElementById('assessed-date').textContent = fmtDate(assessedDate);
  const as = staleness(assessedDate, 30, 60);
  document.getElementById('assessed-stale').innerHTML = staleBadge(as.level, as.label);
  document.getElementById('assessed-stale').className = `stale-badge ${as.level !== 'fresh' ? 'stale-' + as.level : ''}`;

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
        <td>${current}</td>
        <td>${t.thresholdLabel}</td>
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
  rows.push(`
    <tr>
      <td>Global M2 YoY</td>
      <td>${yoy != null ? (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%' : '—'} ${staleBadge(m2Stale.level, m2Stale.label)}</td>
      <td>&lt; 0%</td>
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
        <td>${notes} ${staleBadge(stale.level, stale.label)}</td>
        <td>${meta.threshold}</td>
        <td class="trigger-status ${dotClass}">●</td>
      </tr>`);
  }

  tbody.innerHTML = rows.join('');
}

// ─── Section 3: Positions ─────────────────────────────────────────────────────

function priceRow(prices, sym, label, prefix, decimals, note) {
  const price = priceOf(prices?.prices, sym);
  const chg   = changePctOf(prices?.prices, sym);
  return `<tr>
    <td class="asset-name">${label}</td>
    <td class="num">${fmt(price, decimals, prefix)}</td>
    <td class="num">${fmtPct(chg)}</td>
    <td class="note-cell">${note}</td>
  </tr>`;
}

function alertRow(prices, alerts, sym, label, prefix, decimals, note) {
  const price = priceOf(prices?.prices, sym);
  const chg   = changePctOf(prices?.prices, sym);
  const al    = alerts?.[sym];
  const below = al?.below ?? null;
  const above = al?.above ?? null;

  // Alert text: "<$150 / >$200", "<$150", ">$200", or ""
  const parts = [];
  if (below != null) parts.push(`&lt;$${below.toLocaleString('en-US')}`);
  if (above != null) parts.push(`&gt;$${above.toLocaleString('en-US')}`);
  const alertText = parts.join(' / ');

  // Status dot
  let statusHtml = '';
  if (below != null || above != null) {
    if (price != null && below != null && price < below) {
      statusHtml = '<span class="dot-red">●</span>';
    } else if (price != null && above != null && price > above) {
      statusHtml = '<span class="dot-green">●</span>';
    } else {
      statusHtml = '<span class="neu">●</span>';
    }
  }

  return `<tr>
    <td class="asset-name">${label}</td>
    <td class="num">${fmt(price, decimals, prefix)}</td>
    <td class="num">${fmtPct(chg)}</td>
    <td class="alert-cell">${alertText}</td>
    <td class="alert-status">${statusHtml}</td>
    <td class="note-cell">${note}</td>
  </tr>`;
}

function renderPositions(prices, alerts) {
  // Hard Money
  const hardMoney = [
    alertRow(prices, alerts, 'BTC',    'BTC',       '$', 0, 'M2 correlation proxy'),
    alertRow(prices, alerts, 'XAUUSD', 'Gold (USD)','$', 0, 'CB accumulation 1k+ tonnes/y. De-dollarisation hedge. Gold share of reserves rising from 15% to 20%+ and projected to reach 25-30% by 2030.'),
  ].join('');
  document.getElementById('group-hard-money').innerHTML = hardMoney;

  // Macro Signals (placed under Hard Money)
  const macroSignals = [
    alertRow(prices, alerts, 'WTI', 'WTI Crude', '$', 2, '&gt;$100 equity headwind; &lt;$85 resolution'),
    alertRow(prices, alerts, 'VIX', 'VIX',       '',  1, '&gt;30 elevated risk; DCA timing signal'),
  ].join('');
  document.getElementById('group-macro-signals').innerHTML = macroSignals;

  // AI & Tech
  const tech = [
    alertRow(prices, alerts, 'NVDA',  'NVDA',  '$', 2, 'Watch: gross margin'),
    alertRow(prices, alerts, 'TSLA',  'TSLA',  '$', 2, 'Physical AI deployment proxy'),
    alertRow(prices, alerts, 'GOOGL', 'GOOGL', '$', 2, 'Watch: ad revenue trend'),
    alertRow(prices, alerts, 'META',  'META',  '$', 2, 'Watch: ad revenue vs AI capex'),
    alertRow(prices, alerts, 'TSM',   'TSM',   '$', 2, 'Watch: geopolitical risk'),
    alertRow(prices, alerts, 'PLTR',  'PLTR',  '$', 2, 'Watch: AIP adoption'),
    alertRow(prices, alerts, 'MSTR',  'MSTR',  '$', 2, 'BTC proxy / leverage'),
    alertRow(prices, alerts, 'NOW',   'NOW',   '$', 2, 'Enterprise workflow automation'),
    alertRow(prices, alerts, 'GEV',   'GEV',   '$', 2, 'Power Generation'),
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

  const dxy  = priceOf(prices?.prices, 'WTI') !== undefined ? dgy?.value : dgy?.value;
  const dxyCls  = dgy?.value < 100 ? 'highlight-warn' : '';
  const us10yCls = us10y?.value > 4.5 ? 'highlight-warn' : '';

  const staleM2  = staleness(usM2?.date,   35,  60);
  const staleGm2 = staleness(gm2?.updated, 90, 180);
  const stale10y = staleness(us10y?.date,   2,   5);
  const staleDxy = staleness(dgy?.date,     2,   5);
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
      `YoY: ${gm2?.yoy_pct != null ? (gm2.yoy_pct >= 0 ? '+' : '') + gm2.yoy_pct.toFixed(1) + '%' : '—'} ${staleBadge(staleGm2.level, staleGm2.label)}`,
      staleGm2.level !== 'fresh' ? `value-stale-${staleGm2.level}` : '',
    ),
    macroCard(
      'US M2',
      `${fmt(usM2?.value, 0, '$')}B`,
      `Period: ${usM2?.date || '—'} ${staleBadge(staleM2.level, staleM2.label)}`,
    ),
    macroCard(
      'Eurozone M2',
      eurM2?.value != null ? `$${eurM2.value.toFixed(2)}T` : '—',
      `Period: ${eurM2?.period || '—'} ${staleBadge(staleEu.level, staleEu.label)}`,
    ),
    macroCard(
      'Japan M2',
      jpM2Usd != null ? `$${jpM2Usd.toFixed(1)}T` : '—',
      `Period: ${jpM2?.date || '—'} ${staleBadge(staleJp.level, staleJp.label)}`,
    ),
    macroCard(
      'China M2',
      cnM2?.value != null ? `$${cnM2.value.toFixed(2)}T` : '—',
      `Period: ${cnM2?.period || '—'} ${staleBadge(staleCn.level, staleCn.label)}`,
    ),
    macroCard(
      'UK M2',
      ukM2?.value != null ? `$${ukM2.value.toFixed(2)}T` : '—',
      `Period: ${ukM2?.period || '—'} ${staleBadge(staleUk.level, staleUk.label)}`,
    ),
    macroCard(
      'US 10Y Treasury',
      `<span class="${us10yCls}">${fmt(us10y?.value, 2)}%</span>`,
      `${us10y?.date || '—'} ${staleBadge(stale10y.level, stale10y.label)}`,
    ),
    macroCard(
      'US Dollar Index (DXY)',
      `<span class="${dxyCls}">${fmt(dgy?.value, 2)}</span>`,
      `${dgy?.date || '—'} ${staleBadge(staleDxy.level, staleDxy.label)} ${dgy?.value < 100 ? '<span class="highlight-warn">Below 100 — thesis signal</span>' : ''}`,
    ),
    macroCard(
      'Fear &amp; Greed',
      `<span class="${fgColorClass(fg?.value)}">${fg?.value ?? '—'}</span>`,
      `${fg?.classification || ''} · ${fg?.date || '—'}${fgBarHtml(fg?.value)}`,
    ),
  ].join('');

  document.getElementById('macro-grid').innerHTML = cards;
}

// ─── Section 5: Thesis ────────────────────────────────────────────────────────

async function renderThesis() {
  const el = document.getElementById('thesis-content');
  try {
    const resp = await fetch(DATA.thesis);
    if (!resp.ok) throw new Error(`${resp.status}`);
    const text = await resp.text();
    // Very basic Markdown→HTML: headings, bold, italic, paragraphs, lists
    el.innerHTML = mdToHtml(text);
  } catch {
    el.innerHTML = '<p class="neu">Thesis document not yet written. Check back soon.</p>';
  }
}

function mdToHtml(md) {
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

function renderFooter(prices, macro) {
  document.getElementById('footer-prices-ts').textContent = fmtTs(prices?.updated_at);
  document.getElementById('footer-macro-ts').textContent  = fmtTs(macro?.updated_at);
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

  renderStatusBar(manual, macro);
  renderTriggers(prices, manual);
  renderPositions(prices, alerts);
  renderMacro(macro, manual, prices);
  renderFooter(prices, macro);
  renderThesis();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
}

document.addEventListener('DOMContentLoaded', init);
