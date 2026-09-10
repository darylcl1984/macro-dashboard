import { chart } from './charts.js';
import { finite, utc, monthIndex, ordered, windowYears, m2Metrics, globalMoney, trailingQuarters, quarterlyAverage, eciPace, eciHumanContext, eciTaskDuration, estimatedExpertFrontier, expertDurationScale, eciAnnualizedGain, frontier, topDistinctLabs, quarterLabel, periodEnd } from './metrics.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = (n, decimals = 1) => finite(n) ? new Intl.NumberFormat('en', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n) : '—';
const pct = n => finite(n) ? `${n > 0 ? '+' : ''}${fmt(n, 2)}%` : '—';
const date = value => value ? new Date(utc(value)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date unavailable';
const colors = { money: 'var(--accent)', debt: 'var(--blue)', gold: 'var(--gold)', btc: 'var(--bitcoin)', ai: 'var(--technology)', muted: 'var(--text-muted)' };
const metric = (label, value, secondary = false, caption = '') => `<div class="metric"><span class="metric-label">${escape(label)}</span><span class="${secondary ? 'metric-secondary' : 'metric-value'}">${escape(value)}</span>${caption ? `<span class="metric-caption">${escape(caption)}</span>` : ''}</div>`;
const panel = (id, title, period, unit, extra = '', cls = '') => `<article class="panel ${cls}"><div class="panel-heading"><h3>${title}</h3><span class="period-label">${period}</span></div><div class="metrics" id="${id}-metrics"></div><div id="${id}-chart" class="chart"></div><div class="chart-unit">${unit}</div><div id="${id}-source" class="source-note"></div>${extra}</article>`;
const details = (title, text) => `<details class="method-note"><summary>${title}</summary><p>${text}</p></details>`;
function source(id, data, lastDate, tolerance = 7, note = '') {
  const host = $(`${id}-source`);
  const outdated = lastDate && (Date.now() - periodEnd(lastDate, data?.frequency)) / 86400000 > tolerance;
  const link = data?.source_url && /^https?:\/\//.test(data.source_url) ? `<a href="${escape(data.source_url)}" target="_blank" rel="noopener noreferrer">${escape(data.source)} ↗</a>` : escape(data?.source || 'Source unavailable');
  const licence = data?.license === 'CC BY 4.0' ? '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 ↗</a>' : '';
  const period = data?.frequency === 'quarterly' && lastDate ? quarterLabel(lastDate) : date(lastDate);
  host.innerHTML = `${link}${licence}<span>· ${escape(data?.date_kind || (data?.frequency === 'quarterly' ? 'Period' : 'As of'))} ${escape(period)}</span>${outdated ? '<span class="stale">Reporting lag</span>' : ''}${note ? `<span>· ${escape(note)}</span>` : ''}`;
}
const line = (name, points, color, extra = {}) => ({ name, points, color, ...extra });
const draw = (id, series, extras = {}) => {
  const formats = { m2: n => `$${fmt(n, 2)}T`, global: n => `$${fmt(n, 2)}T`, debt: n => `${fmt(n, 2)}%`, yield: n => `${fmt(n, 2)}%`, stable: n => `$${fmt(n, 2)}B`, gold: n => `$${fmt(n, 2)} / oz`, btc: n => `$${fmt(n, 0)}`, cb: n => `${fmt(n, 2)} tonnes`, etf: n => `${n > 0 ? '+' : ''}$${fmt(n, 1)}M`, eci: n => `${fmt(n, 2)} pts` };
  return chart($(`${id}-chart`), { title: $(`${id}-chart`).closest('.panel')?.querySelector('h3')?.textContent || id, series, format: formats[id], ...extras });
};

function shell() {
  $('fiscal-content').innerHTML = `<div class="fiscal-stack">
  <article class="panel global-panel"><div class="panel-heading"><h3>Global broad money</h3><span class="period-label">FIVE-BLOC COMPOSITE</span></div><div class="global-grid"><div><div class="metrics" id="global-metrics"></div><div id="global-chart" class="chart"></div><div class="chart-unit">USD trillions ($T) · monthly</div></div><div><table class="regional-table"><caption>Regional broad money</caption><thead><tr><th>Region</th><th>Local stock</th><th>USD equivalent</th><th>YoY</th></tr></thead><tbody id="region-rows"></tbody><tfoot id="region-total"></tfoot></table><p class="small-note" id="region-note"></p></div></div><div id="global-source" class="source-note"></div>${details('How global money is measured', 'The composite combines US, China, euro-area and Japan M2 with UK M4. The fixed-FX series holds exchange rates at the latest complete month. Only complete, same-month baskets are included; missing observations remain gaps. <a href="methodology.html">Read the methodology ↗</a>')}</article>
  ${panel('m2', 'US M2 money supply', 'ROLLING 10 YEARS', 'USD trillions ($T) · monthly', details('30-year growth reference', 'The reference uses the compound annual growth rate over the 30 years ending at the latest observation. It is anchored to the beginning of the ten-year chart. The observed ten-year growth rate and latest year-on-year change are reported separately.'))}
  ${panel('yield', 'US Treasury yields', '10 YEARS', 'Percent per annum · daily · common scale')}
  <div class="two-grid fiscal-bottom">${panel('debt', 'Federal debt-to-GDP ratio', '10 YEARS', 'Percent of GDP · quarterly', details('Definition and publication lag', 'Total federal debt, including intragovernmental holdings, divided by nominal GDP. FRED dates quarterly observations to the first day of the quarter; the chart labels them by quarter. The latest published observation and retrieval date are shown separately.'))}${panel('stable', 'Dollar rails', '4 YEARS', 'USD stablecoin supply · billions', details('Measure and scope', 'Circulating supply of USD-pegged stablecoins. This measures dollar-token supply; it does not directly measure payment activity, foreign adoption or incremental Treasury demand.'))}</div></div>`;
  $('hard-content').innerHTML = `<div class="asset-grid">
    <section class="asset-group gold-group" aria-labelledby="gold-group-title"><div class="asset-heading"><span class="asset-symbol" aria-hidden="true">Au</span><div><h3 id="gold-group-title">Gold</h3><p>Market price &amp; official-sector demand</p></div></div>
      ${panel('gold', 'Gold price', '4 YEARS', 'USD per troy ounce · daily close', details('Price series', 'The source identifies the instrument used. Continuous futures prices may include contract-roll effects and can differ from spot prices.'))}
      ${panel('cb', 'Central-bank gold purchases', '4 YEARS · QUARTERLY', 'Net tonnes · central banks and other institutions', '<div id="cb-annual" class="annual-total"></div>')}
    </section>
    <section class="asset-group bitcoin-group" aria-labelledby="bitcoin-group-title"><div class="asset-heading"><span class="asset-symbol" aria-hidden="true">₿</span><div><h3 id="bitcoin-group-title">Bitcoin</h3><p>Market price, fund flows &amp; sentiment</p></div></div>
      ${panel('btc', 'Bitcoin price', '4 YEARS', 'USD per bitcoin · daily close', details('Halving-cycle reference dates', 'The 2024 halving is marked on April 20. The current-cycle midpoint is provisionally April 20, 2026, two years later. These are calendar reference dates, not projected price peaks.'))}
      ${panel('etf', 'US spot Bitcoin ETF flows', '1 YEAR+ · WEEKLY', 'Net flows · USD millions', '<div class="sentiment-block"><div class="sentiment-heading"><h4>Fear &amp; Greed Index</h4><span id="fear-value" class="mono"></span></div><div id="fear-meter" class="sentiment-meter" role="meter" aria-label="Bitcoin Fear and Greed Index" aria-valuemin="0" aria-valuemax="100"><span class="sentiment-marker"></span></div><div class="sentiment-scale" aria-hidden="true"><span>0 · Extreme fear</span><span>50</span><span>100 · Extreme greed</span></div><div id="fear-source" class="source-note"></div></div>')}
    </section></div>`;
  $('tech-content').innerHTML = `<div class="subsection-heading"><h3>Trajectory</h3><span>How frontier capability is advancing</span></div>${panel('eci', '<span class="technology-text">Epoch Capabilities Index</span>', '2023 ONWARD', 'Left: ECI · Right: estimated expert-task duration at 50% AI success, logarithmic scale', '<div id="eci-human-context" class="human-context eci-context"></div>')}<div class="subsection-heading benchmark-heading"><h3>Benchmarks</h3><span>Top three per benchmark · at most one model per lab</span></div><div class="two-grid baseline-grid" id="baseline-cards"></div><p class="baseline-source">Original-publisher results · scores reflect the model, agent setup and task set.</p>`;
}

function renderBaseline(work) {
  const benches = work?.benchmarks || [];
  if (!benches.length) {
    $('baseline-cards').innerHTML = '<article class="panel"><p>Work benchmark results are unavailable.</p></article>';
    return;
  }
  $('baseline-cards').innerHTML = benches.map(b => {
    const top = topDistinctLabs(b.rows || [], 'score');
    const extras = ['Fable 5.1', 'GPT-6 Astra'].flatMap(name => {
      if (top.some(r => r.model.toLowerCase().includes(name.toLowerCase()))) return [];
      const row = (b.rows || []).filter(r => r.model.toLowerCase().includes(name.toLowerCase())).sort((a, b) => b.score-a.score)[0];
      return row ? [row] : [];
    });
    const setup = r => `${b.id === 'apex' ? 'Mercor agent' : r.agent} · ${r.effort} reasoning`;
    const error = r => finite(r.reported_error) ? ` ± ${fmt(r.reported_error, 1)}` : '';
    const acceptance = b.id === 'apex'
      ? '<p>An attempt passes when its output meets all required criteria in the expert-authored rubric for that assignment.</p><p class="small-note">The percentage describes success on this task set. It does not measure speed, hours saved or performance relative to a human. <a href="https://www.mercor.com/blog/introducing-apex-agents-1-1/" target="_blank" rel="noopener noreferrer">Evaluation method ↗</a></p>'
      : '<p>An attempt passes when the completed work satisfies the task’s verification checks. The score includes the model and its agent setup.</p><p class="small-note">The percentage describes success on this task set. It does not measure speed, hours saved or performance relative to a human. <a href="https://www.tbench.ai/news/terminal-bench-4-0" target="_blank" rel="noopener noreferrer">Evaluation method ↗</a></p>';
    const lead = top[0];
    return `<article class="panel baseline-panel">
      <div class="panel-heading"><h3>${escape(b.title)}</h3><span class="period-label">${escape(b.version)}</span></div>
      <p class="baseline-description">${escape(b.description)}</p>
      ${lead ? `<span class="context-label">Success on benchmark tasks</span><div class="capability-summary"><span class="capability-number">${fmt(lead.score, 0)}<small>/ 100</small></span><p>attempts meet the benchmark’s completion requirements<span>${escape(lead.model)} · per 100 single attempts · ${fmt(lead.score, 1)}% reported success</span></p></div>` : ''}
      <div class="human-context benchmark-work-context"><span class="context-label">What counts as success</span>${acceptance}</div>
      <table class="baseline-table"><caption>${escape(b.metric)} · task completion rate</caption><thead><tr><th scope="col">Model / setup</th><th scope="col">Success</th></tr></thead><tbody>${top.map((r, i) => `<tr><td><span class="baseline-model"><span class="rank">${i + 1}</span>${escape(r.model)}</span><span class="baseline-setup">${escape(r.creator)} · ${escape(setup(r))}</span>${r.evaluation_date ? `<span class="baseline-setup">Reported ${escape(date(r.evaluation_date))}</span>` : ''}<span class="score-track" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, r.score))}%"></span></span></td><td class="baseline-score">${fmt(r.score, 1)}%<span class="baseline-setup">${escape(error(r))}</span></td></tr>`).join('')}</tbody></table>
      ${extras.map(r => `<p class="frontier-comparison">${escape(r.model)} · ${fmt(r.score, 1)}%${escape(error(r))}<br><span>${escape(setup(r))} · outside the top three distinct labs</span></p>`).join('')}
      <p class="small-note">${escape(b.note)}</p><div class="source-note"><a href="${escape(b.source_url)}" target="_blank" rel="noopener noreferrer">${escape(b.source)} ↗</a><a href="${escape(b.license_url)}" target="_blank" rel="noopener noreferrer">${escape(b.license)} ↗</a><span>Checked ${escape(date(work.fetched_at))} · selected and reformatted</span></div></article>`;
  }).join('');
}

function render(data) {
  const [history, macro, globalHistory, manual, etf, tech, goldBuying, work, metr] = data;
  const stored = history?.series || {}, indicators = macro?.indicators || {};
  const getSeries = name => ({ source: 'Historical data unavailable', ...stored[name], points: ordered(stored[name]?.points) });
  const renderSection = (id, callback) => {
    try { callback(); } catch (error) {
      const notice = document.createElement('p');
      notice.className = 'notice';
      notice.textContent = 'Some charts in this section could not be drawn. Reload to retry.';
      $(id).prepend(notice);
      console.error(`Unable to finish ${id}`, error);
    }
  };
  renderSection('fiscal-content', () => {
  const m2 = getSeries('us_m2');
  if (!m2.points.length) { m2.points = (indicators.US_M2?.history || []).map(p => ({ date: `${p.period}-01`, value: p.value })); m2.source = 'FRED · M2SL (stored snapshot)'; m2.source_url = 'https://fred.stlouisfed.org/series/M2SL'; }
  const money = m2Metrics(m2.points);
  $('m2-metrics').innerHTML = metric('Money stock', money.latest ? `$${fmt(money.latest.value / 1000, 2)}T` : '—') + metric('Observed 10Y CAGR', pct(money.cagr), true) + metric('Latest YoY', pct(money.yoy), true);
  const referenceLabel = money.referenceCagr === null ? '30Y reference unavailable' : `${fmt(money.referenceCagr, 2)}% · 30Y reference`;
  draw('m2', [line('US M2', money.points.map(p => ({ ...p, value: p.value / 1000 })), colors.money), line(referenceLabel, money.reference.map(p => ({ ...p, value: p.value / 1000 })), colors.muted, { dashed: true })], { maxGapDays: 45, height: 320, calendarAxis: 'Observation date', tickFormat: n => `$${fmt(n, Number.isInteger(n) ? 0 : 1)}T`, dateFormat: value => new Date(utc(value)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
  source('m2', m2, money.latest?.date, 90, money.cagr === null ? 'Partial ten-year history' : money.referenceCagr === null ? 'Insufficient history for the 30-year reference' : `30Y CAGR ${fmt(money.referenceCagr, 2)}% · ${date(money.referenceStart)}–${date(money.latest.date)}`);
  if (money.cagr === null) $('m2-chart').closest('.panel').querySelector('.period-label').textContent = 'PARTIAL HISTORY';
  const debt = getSeries('debt_gdp'), dp = windowYears(debt.points, 10);
  if (!dp.length) Object.assign(debt, { source: 'FRED · GFDEGDQ188S', source_url: 'https://fred.stlouisfed.org/series/GFDEGDQ188S' });
  $('debt-metrics').innerHTML = metric('Federal debt / nominal GDP', dp.length ? `${fmt(dp.at(-1).value, 1)}%` : '—');
  draw('debt', [line('Debt / GDP', dp, colors.debt)], { dateFormat: quarterLabel, empty: 'Quarterly debt-to-GDP data are currently unavailable.' });
  source('debt', { ...debt, frequency: 'quarterly' }, dp.at(-1)?.date, 180, `Latest FRED observation · retrieved ${date(debt.fetched_at)}`);
  const gm = globalMoney(globalHistory || []);
  $('global-metrics').innerHTML = metric('Five-bloc stock', gm.latest ? `$${fmt(gm.headline.at(-1).value, 2)}T` : '—') + metric('Headline YoY', pct(gm.yoy), true) + metric('Fixed-FX YoY', pct(gm.fixedYoy), true);
  draw('global', [line('Current FX', gm.headline, colors.money), line('Fixed FX', gm.fixed, colors.debt, { dashed: true })], { maxGapDays: 45, tickFormat: n => `$${fmt(n, Number.isInteger(n) ? 0 : 1)}T` });
  source('global', { source: 'FRED · ECB · PBoC · BOJ · BoE', source_url: 'https://data.ecb.europa.eu/data/datasets/BSI/BSI.M.U2.Y.V.M20.X.1.U2.2300.Z01.E' }, gm.latest?.period, 100, `${gm.headline.length} complete months · monthly-average FX · fixed at ${gm.latest?.period || '—'}`);
  if (gm.latest) {
    const latest = gm.latest, c = latest.components_local, fx = latest.fx;
    const base = (globalHistory || []).find(r => monthIndex(r.period) === monthIndex(latest.period) - 12)?.components_local || {};
    const regions = [['US · M2', 'US_usd_bn', c.US_usd_bn / 1000, '$', c.US_usd_bn / 1000], ['China · M2', 'CN_cny_tn', c.CN_cny_tn, '¥', c.CN_cny_tn / fx.USDCNY], ['Euro area · M2', 'EZ_eur_tn', c.EZ_eur_tn, '€', c.EZ_eur_tn * fx.EURUSD], ['Japan · M2', 'JP_jpy_tn', c.JP_jpy_tn, '¥', c.JP_jpy_tn / fx.USDJPY], ['UK · M4', 'UK_gbp_bn', c.UK_gbp_bn / 1000, '£', c.UK_gbp_bn / 1000 * fx.GBPUSD]];
    $('region-rows').innerHTML = regions.map(([name, key, value, symbol, dollars]) => `<tr><td>${name}<span class="region-date">${latest.period}</span></td><td>${symbol}${fmt(value, 2)}T</td><td>$${fmt(dollars, 2)}T</td><td>${base[key] > 0 ? pct((c[key] / base[key] - 1) * 100) : '—'}</td></tr>`).join('');
    $('region-total').innerHTML = `<tr class="region-total"><td>Global total<span class="region-date">Five blocs · ${latest.period}</span></td><td>—</td><td>$${fmt(gm.headline.at(-1).value, 2)}T</td><td>${pct(gm.yoy)}</td></tr>`;
    $('region-note').textContent = 'T = trillion. USD equivalents use monthly-average exchange rates. Regional YoY is in local currency; global YoY includes exchange-rate changes. This total covers the five listed blocs.';
  }
  const short = getSeries('us_2y'), long = getSeries('us_30y');
  $('yield-metrics').innerHTML = metric('2-year', short.points.length ? `${fmt(short.points.at(-1).value, 2)}%` : '—') + metric('30-year', long.points.length ? `${fmt(long.points.at(-1).value, 2)}%` : '—', true);
  draw('yield', [line('2-year Treasury', windowYears(short.points, 10), colors.money), line('30-year Treasury', windowYears(long.points, 10), colors.debt)], { maxGapDays: 7, height: 320, calendarAxis: 'Observation date', tickFormat: n => `${fmt(n, Number.isInteger(n) ? 0 : 1)}%`, zero: true, empty: 'Treasury yield data are currently unavailable.' });
  source('yield', { source: 'FRED · DGS2 / DGS30', source_url: 'https://fred.stlouisfed.org/series/DGS2' }, long.points.at(-1)?.date, 7);
  const stable = getSeries('stablecoins'), sp = windowYears(stable.points, 4);
  $('stable-metrics').innerHTML = metric('USD stablecoin supply', sp.length ? `$${fmt(sp.at(-1).value, 1)}B` : '—'); draw('stable', [line('USD stablecoins', sp, colors.money)]); source('stable', stable, sp.at(-1)?.date);
  });
  renderSection('hard-content', () => {
  for (const [id, key, color] of [['gold', 'gold', colors.gold], ['btc', 'bitcoin', colors.btc]]) {
    const s = getSeries(key), points = windowYears(s.points, 4);
    $(''+id+'-metrics').innerHTML = metric(id === 'gold' ? s.instrument || 'Gold' : 'Daily close', points.length ? `$${fmt(points.at(-1).value, 0)}` : '—');
    const markers = id === 'btc' ? [{ date: '2024-04-20', label: '2024 halving' }, { date: '2026-04-20', label: 'Midpoint*' }] : [];
    draw(id, [line(id === 'gold' ? 'Gold' : 'Bitcoin', points, color)], { markers, tickFormat: n => n >= 10000 ? `${fmt(n / 1000, 0)}k` : fmt(n, 0) });
    source(id, s, points.at(-1)?.date, 7, s.note || '');
  }
  const cb = manual?.cb_gold;
  const cbPoints = goldBuying?.points || (manual?.cb_gold_history || []).map(p => ({ date: p.date, value: p.tonnes }));
  if (!cbPoints.length && cb?.quarterly_tonnes !== undefined) {
    const [year, q] = cb.period.split('-Q');
    cbPoints.push({ date: `${year}-${String((Number(q) - 1) * 3 + 1).padStart(2, '0')}-01`, value: cb.quarterly_tonnes });
  }
  const average = quarterlyAverage(cbPoints);
  $('cb-metrics').innerHTML = metric('Quarterly net purchases', cbPoints.length ? `${fmt(cbPoints.at(-1).value, 1)}t` : '—') + metric('4-quarter average', average.length ? `${fmt(average.at(-1).value, 1)}t` : '—', true);
  draw('cb', [line('Net purchases', cbPoints.length > 1 ? cbPoints : [], colors.gold, { type: 'bars' }), line('4-quarter moving average', average, colors.money, { width: 2.5 })], { zero: true, maxGapDays: 100, dateFormat: quarterLabel, empty: 'A quarterly reading is available; the historical series is incomplete.' });
  const trailing = trailingQuarters(cbPoints);
  $('cb-annual').innerHTML = trailing.length ? `<span class="metric-label">Trailing four-quarter purchases</span><strong class="mono">${fmt(trailing.at(-1).value, 1)} tonnes</strong><p>The moving average measures net purchases per quarter over four consecutive quarters.</p>` : 'Four consecutive observations are required to calculate the moving average.';
  source('cb', { ...(goldBuying || { source: 'World Gold Council · reviewed snapshot', source_url: 'https://www.gold.org/goldhub/data/gold-demand-by-country' }), date_kind: 'Published' }, goldBuying?.published_at || cb?.updated, 130, `${cbPoints.length ? `Latest period ${quarterLabel(cbPoints.at(-1).date)} · ` : ''}Four-year extract · Q2 2026 vintage, including revisions`);
  const flows = (etf?.weekly || []).map(r => ({ date: r.week_ending, value: r.net_flow_musd }));
  $('etf-metrics').innerHTML = metric('Latest complete week', flows.length ? `${flows.at(-1).value >= 0 ? '+' : '−'}$${fmt(Math.abs(flows.at(-1).value), 1)}M` : '—');
  draw('etf', [line('Weekly net flow', flows, colors.btc, { type: 'bars' })], { zero: true }); source('etf', { source: 'Farside Investors', source_url: etf?.source_url }, flows.at(-1)?.date, 10, `${flows.length} complete reporting weeks`);
  const fear = getSeries('fear_greed'), fp = fear.points, fv = fp.at(-1)?.value;
  $('fear-value').textContent = `${fmt(fv, 0)} / 100`;
  const meter = $('fear-meter');
  if (finite(fv) && fv >= 0 && fv <= 100) {
    meter.style.setProperty('--sentiment', `${fv}%`);
    meter.setAttribute('aria-valuenow', fv);
    meter.setAttribute('aria-valuetext', `${fmt(fv, 0)} out of 100; 0 is extreme fear and 100 is extreme greed`);
  } else { meter.hidden = true; $('fear-value').textContent = 'Unavailable'; }
  source('fear', fear, fp.at(-1)?.date, 3);
  });
  renderSection('tech-content', () => {
  const eci = ordered(tech?.eci), pace = eciPace(eci), best = pace.latest;
  const threeYear = eciAnnualizedGain(eci);
  renderBaseline(work);
  const human = eciHumanContext(eci, metr);
  const expertFrontier = estimatedExpertFrontier(eci, human), timeScale = expertDurationScale(expertFrontier);
  const latestTime = expertFrontier.at(-1);
  const duration = minutes => {
    const rounded = Math.round(minutes), hours = Math.floor(rounded / 60), remainder = rounded % 60;
    return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${rounded} min`;
  };
  $('eci-metrics').innerHTML = metric('Highest published ECI', fmt(best?.value, 1), false, best ? `${best.label} · ${date(best.date)}` : '') + metric('Estimated expert task-length', latestTime ? `≈${duration(latestTime.value)}` : '—', true, latestTime?.estimateKind === 'extrapolation' ? 'Unvalidated rule extrapolation · 50% AI success' : 'Historical-rule illustration · 50% AI success');
  const ratios = human.matches.map(m => m.measured_to_illustrative_ratio).filter(finite);
  const calibrationDetail = human.anchor ? `The time curve uses ${escape(human.anchor.label)}’s published ${fmt(human.anchor.minutes, 2)}-minute METR TH1.1 estimate at ECI ${fmt(human.anchor.eci, 2)}. Each additional ${fmt(metr.points_per_doubling, 0)} ECI points doubles that illustrative duration. Across ${human.matches.length} matched releases, measured times range from ${fmt(Math.min(...ratios), 2)} to ${fmt(Math.max(...ratios), 2)} times the illustration. ` : '';
  const paceDetail = threeYear ? `The three-year window runs from ${date(threeYear.start)} to ${date(threeYear.end)}. Its starting frontier is ${fmt(threeYear.base.value, 2)} ECI (${escape(threeYear.base.label)}, released ${date(threeYear.base.date)}); its ending frontier is ${fmt(threeYear.latest.value, 2)}. The ${fmt(threeYear.gain, 2)}-point gain divided by three is ${fmt(threeYear.pointsPerYear, 2)} points per year. This is an absolute point gain, not percentage CAGR. ` : 'A full three-year history is required to calculate the annualized point gain. ';
  const doublingMonths = threeYear?.pointsPerYear > 0 ? 60 / threeYear.pointsPerYear : null;
  $('eci-human-context').innerHTML = `<div class="eci-explainer">
    <div class="eci-rate">
      <span class="context-label">Observed pace</span>
      <h4>Three-year annualized gain</h4>
      <div class="eci-reading"><strong>${threeYear ? `+${fmt(threeYear.pointsPerYear, 1)}` : '—'}</strong><span>ECI points / year</span></div>
      <p class="eci-period">${threeYear ? `${escape(date(threeYear.start))} – ${escape(date(threeYear.end))}` : 'Full window unavailable'}</p>
    </div>
    <div class="eci-meaning">
      <span class="context-label">Rule illustration · not a forecast</span>
      <h4>From one hour to two, then four</h4>
      <div class="eci-reading"><strong>+5 ECI</strong><span>≈ 2× expert-task length</span></div>
      <p>${doublingMonths ? `At the observed pace, the rule implies a doubling about every <strong>${fmt(doublingMonths, 1)} months</strong>.` : 'The historical rule translates capability gains into task length.'}</p>
    </div>
  </div><p class="small-note">${human.valid ? 'The time curve is calculated from ECI. Short dashes show the checked range; long dashes mark unvalidated extrapolation. Expert time means task length at 50% AI success, not how long the AI runs.' : 'The estimated time curve is unavailable until its METR–Epoch calibration is refreshed. Published METR measurements remain available in model tooltips.'}</p>${details('Calculation and interpretation', paceDetail + calibrationDetail + 'The right axis independently scales expert-minutes logarithmically, while the left axis shows ECI. The estimated time curve carries no measured uncertainty band. Its longer-dashed extension beyond the checked ECI range is unvalidated, including the latest frontier. METR warns that measurements beyond 16 hours are unreliable with its current suite. Separate published METR estimates remain in ECI tooltips. Evaluation scaffolds differ across the two sources. These software-task comparisons do not measure whole-job equivalence or price deflation. <a href="https://metr.org/time-horizons/" target="_blank" rel="noopener noreferrer">METR measurements ↗</a> · <a href="https://epoch.ai/data/eci-documentation/faq" target="_blank" rel="noopener noreferrer">Epoch interpretation ↗</a>')}`;
  draw('eci', [line('Model ECI', eci, colors.ai, { type: 'scatter' }), line('ECI frontier', frontier(eci), colors.money, { step: true }), ...(expertFrontier.length ? [line('Estimated expert-time frontier', expertFrontier, colors.gold, { axis: 'right', step: true, format: n => `≈${duration(n)}`, dashForPoint: p => p.estimateKind === 'extrapolation' ? '9 6' : '2 4', width: 2.5 })] : [])], {
    height: 390, calendarAxis: 'Model release date', tickFormat: n => fmt(n, 0),
    rightAxis: timeScale ? { domain: timeScale.domain, log: true, ticks: timeScale.ticks.map(value => ({ value, label: value < 60 ? `${fmt(value, value < 1 ? 2 : 0)} min` : `${fmt(value / 60, 0)} h` })) } : null,
    pointDetail: (p, series) => {
      if (series.axis === 'right') return `${p.estimateKind === 'extrapolation' ? 'Unvalidated extrapolation beyond the checked range' : 'Historical-rule illustration within the checked range'} · calculated from ECI ${fmt(p.eci, 2)}. Expert task-length at 50% AI success; not a METR measurement or AI runtime.`;
      const task = eciTaskDuration(p, human, true);
      if (task.kind === 'measured') return `METR: ${duration(task.minutes)} expert task-time · 50% success · 95% interval ${duration(task.low)}–${duration(task.high)}. Separate measurement; the point’s height shows ECI.`;
      if (task.kind === 'extrapolation') return `Unvalidated rule extrapolation: ≈${duration(task.minutes)} expert task-time at 50% success. Beyond the checked range; not a METR measurement.`;
      return task.kind === 'illustration' ? `Rule illustration: ≈${duration(task.minutes)} expert task-time at 50% success · not a METR measurement for this model` : 'Task-time conversion unavailable';
    },
  });
  source('eci', { source: 'Epoch AI · AI Benchmarking Hub', license: 'CC BY 4.0', date_kind: 'Retrieved', source_url: 'https://epoch.ai/benchmarks?view=graph&tab=eci' }, tech?.fetched_at?.slice(0, 10), 14, 'Adapted from published scores');

  });
  $('desk-asof').innerHTML = `Data retrieved ${escape(date(history?.last_attempt?.slice(0, 10)))}<br>Reporting periods vary by source`;
}

shell();
const themeButton = $('theme-toggle');
function themeLabel() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeButton.textContent = dark ? 'Light' : 'Dark';
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0c151b' : '#edf0eb';
}
themeLabel();
themeButton.addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('macro-theme', document.documentElement.dataset.theme); } catch {} themeLabel(); });
const files = ['dashboard_history', 'macro', 'm2_history', 'manual', 'etf_flows', 'technology', 'gold_buying', 'work_benchmarks', 'metr_context'];
const results = await Promise.allSettled(files.map(async name => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`../data/${name}.json`, { signal: controller.signal });
    if (!response.ok) throw new Error(`${name} unavailable`);
    return await response.json();
  } finally { clearTimeout(timer); }
}));
try { render(results.map(r => r.status === 'fulfilled' ? r.value : null)); } catch (error) { $('load-notice').hidden = false; $('load-notice').textContent = 'Some charts could not be drawn. Reload to retry.'; console.error(error); }
const failed = results.flatMap((r, i) => r.status === 'rejected' ? [files[i]] : []);
if (failed.length) { $('load-notice').hidden = false; $('load-notice').textContent = `${failed.length} data source${failed.length === 1 ? '' : 's'} unavailable. Other charts remain usable.`; }
const sections = [...document.querySelectorAll('.desk-section')];
const updateNav = () => {
  const active = [...sections].reverse().find(s => s.getBoundingClientRect().top < 170) || sections[0];
  document.querySelectorAll('.topbar nav a').forEach(a => {
    const current = a.hash === `#${active.id}`;
    a.classList.toggle('active', current);
    if (current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
};
let navScheduled = false;
window.addEventListener('scroll', () => {
  if (!navScheduled) { navScheduled = true; requestAnimationFrame(() => { updateNav(); navScheduled = false; }); }
}, { passive: true });
updateNav();
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => {});
