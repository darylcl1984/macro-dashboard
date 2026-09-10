import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { m2Metrics, globalMoney, topDistinctLabs, trailingQuarters, quarterlyAverage, eciPace, eciHumanContext, eciTaskDuration, eciAnnualizedGain, frontier, windowYears, quarterLabel, periodEnd, calendarTicks, numericScale } from '../src/metrics.js';

test('M2 derives its reference from 30 years while plotting a separately anchored ten-year window', () => {
  const points = Array.from({ length: 361 }, (_, i) => ({ date: new Date(Date.UTC(1996, i, 1)).toISOString().slice(0, 10), value: 100 * 1.04 ** (Math.min(i, 240) / 12) * 1.08 ** (Math.max(0, i - 240) / 12) }));
  const result = m2Metrics(points);
  const expectedRate = (1.04 ** (2 / 3) * 1.08 ** (1 / 3) - 1) * 100;
  assert.ok(Math.abs(result.cagr - 8) < 1e-8);
  assert.ok(Math.abs(result.yoy - 8) < 1e-8);
  assert.ok(Math.abs(result.referenceCagr - expectedRate) < 1e-8);
  assert.equal(result.referenceStart, '1996-01-01');
  assert.equal(result.reference[0].value, points[240].value);
  assert.equal(result.points.length, 121);
  assert.equal(result.reference.length, 121);
  assert.ok(Math.abs(result.reference.at(-1).value - points[240].value * (1 + expectedRate / 100) ** 10) < 1e-8);
  assert.equal(m2Metrics(points.filter((_, i) => i !== 250)).cagr, null);
  assert.equal(m2Metrics(points.slice(1)).reference.length, 0);
  assert.equal(m2Metrics(points.slice(1)).referenceCagr, null);
  assert.ok(Math.abs(m2Metrics(points.slice(1)).cagr - 8) < 1e-8);
});
test('Global money excludes incomplete baskets and holds FX constant across historical stocks', () => {
  const c = { US_usd_bn: 1000, CN_cny_tn: 7, EZ_eur_tn: 1, JP_jpy_tn: 100, UK_gbp_bn: 1000 };
  const fx = { USDCNY: 7, EURUSD: 1, USDJPY: 100, GBPUSD: 1 };
  const result = globalMoney([{ period: '2025-01', components_local: c, fx }, { period: '2025-02', components_local: { ...c, UK_gbp_bn: null }, fx }, { period: '2025-03', components_local: c, fx: { ...fx, EURUSD: 2 } }]);
  assert.equal(result.headline.length, 2);
  assert.deepEqual(result.headline.map(p => p.value), [5, 6]);
  assert.deepEqual(result.fixed.map(p => p.value), [6, 6]);
});
test('Lab selection uses benchmark scores, excludes nulls and allows no duplicate creators', () => {
  const rows = [{ model: 'A1', creator: 'A', score: 50 }, { model: 'A2', creator: 'A', score: 80 }, { model: 'B', creator: 'B', score: null }, { model: 'C', creator: 'C', score: 70 }, { model: 'D', creator: 'D', score: 60 }];
  assert.deepEqual(topDistinctLabs(rows, 'score').map(r => r.model), ['A2', 'C', 'D']);
});
test('Global YoY uses matching complete baskets and separates currency translation', () => {
  const c = { US_usd_bn: 1000, CN_cny_tn: 7, EZ_eur_tn: 1, JP_jpy_tn: 100, UK_gbp_bn: 1000 };
  const fx = { USDCNY: 7, EURUSD: 1, USDJPY: 100, GBPUSD: 1 };
  const rows = [{ period: '2025-07', components_local: c, fx }, { period: '2026-07', components_local: c, fx: { ...fx, EURUSD: 2 } }];
  const result = globalMoney(rows);
  assert.ok(Math.abs(result.yoy - 20) < 1e-8);
  assert.equal(result.fixedYoy, 0);
  assert.equal(globalMoney(rows.slice(1)).yoy, null);
  const mixed = { ...rows[1], component_dates: { US: '2026-08', CN: '2026-07', EZ: '2026-07', JP: '2026-07', UK: '2026-07' } };
  assert.equal(globalMoney([rows[0], mixed]).latest.period, '2025-07');
});
test('Trailing annual gold purchases require four consecutive quarters', () => {
  const points = [{ date: '2025-04-01', value: 1 }, { date: '2025-07-01', value: 2 }, { date: '2025-10-01', value: 3 }, { date: '2026-01-01', value: 4 }];
  assert.equal(trailingQuarters(points)[0].value, 10);
  assert.equal(trailingQuarters(points.filter((_, i) => i !== 1)).length, 0);
});
test('Four-year view excludes earlier observations without extrapolating', () => {
  assert.deepEqual(windowYears([{ date: '2022-09-09', value: 1 }, { date: '2022-09-10', value: 2 }, { date: '2026-09-10', value: 3 }], 4).map(p => p.value), [2, 3]);
});

test('Gold moving average begins after four complete quarters and cannot bridge a missing quarter', () => {
  const points = [10, 20, 30, 40, 50, 60].map((value, i) => ({ date: new Date(Date.UTC(2025, i * 3, 1)).toISOString().slice(0, 10), value }));
  assert.deepEqual(quarterlyAverage(points).map(p => p.value), [25, 35, 45]);
  assert.equal(quarterlyAverage(points)[0].date, '2025-10-01');
  assert.deepEqual(quarterlyAverage(points.filter((_, i) => i !== 2)), []);
});

test('ECI calendar gains use the frontier, not the last model or an average of releases', () => {
  const points = [
    { date: '2023-02-01', value: 120 }, { date: '2023-11-01', value: 125 },
    { date: '2024-06-01', value: 137 }, { date: '2024-11-01', value: 140 },
    { date: '2024-12-01', value: 130 }, { date: '2025-06-01', value: 150 },
    { date: '2025-12-01', value: 149 }, { date: '2026-07-01', value: 158 },
  ];
  const result = eciPace(points);
  assert.deepEqual(result.annual.map(r => r.gain), [15, 10, 8]);
  assert.equal(result.annual[0].pace, 15); // Leap year is still one full year.
  assert.equal(result.annual[0].partial, false);
  assert.equal(result.annual[2].partial, true);
  assert.ok(Math.abs(result.annual[2].pace - 8 * 365 / 182) < 1e-10);
  assert.equal(result.trailingGain, 8);
  assert.equal(eciPace([]).latest, null);
  assert.equal(eciPace(points.slice(0, 2)).trailingGain, null);
});

test('Same-day ECI frontier releases collapse to the best model before drawing steps', () => {
  const points = [{ date: '2024-01-01', value: 120 }, { date: '2024-02-01', value: 130 }, { date: '2024-02-01', value: 140 }, { date: '2024-03-01', value: 135 }];
  assert.deepEqual(frontier(points).map(p => p.value), [120, 140]);
  assert.deepEqual(frontier([...points].reverse()).map(p => p.value), [120, 140]);
});

test('Quarterly dates identify reporting periods, with age measured from the quarter end', () => {
  assert.equal(quarterLabel('2026-01-01'), 'Q1 2026');
  assert.equal(quarterLabel('2026-04-01'), 'Q2 2026');
  assert.equal(quarterLabel('2026-10-01'), 'Q4 2026');
  assert.equal(new Date(periodEnd('2026-01-01', 'quarterly')).toISOString().slice(0, 10), '2026-03-31');
  assert.equal(new Date(periodEnd('2026-10-01', 'quarterly')).toISOString().slice(0, 10), '2026-12-31');
  assert.equal(new Date(periodEnd('2026-01-01')).toISOString().slice(0, 10), '2026-01-01');
});

test('Calendar axes retain partial endpoints and place interior years on January 1', () => {
  const start = Date.UTC(2016, 6, 1), end = Date.UTC(2026, 6, 1);
  const ticks = calendarTicks(start, end, 1100);
  assert.equal(ticks[0].label, 'Jul 2016');
  assert.equal(ticks.at(-1).label, 'Jul 2026');
  assert.ok(ticks.length > 6);
  for (const tick of ticks.slice(1, -1)) {
    assert.match(tick.label, /^20\d{2}$/);
    assert.equal(tick.time, Date.UTC(Number(tick.label), 0, 1));
  }
  const narrow = calendarTicks(start, end, 180);
  assert.ok(narrow.length < ticks.length);
  assert.equal(narrow[0].time, start);
  assert.equal(narrow.at(-1).time, end);
  const positions = narrow.map(tick => {
    const x = (tick.time - start) / (end - start) * 180;
    const width = tick.label.length * 6.5;
    const left = tick.anchor === 'start' ? x : tick.anchor === 'end' ? x - width : x - width / 2;
    return { left, right: left + width };
  });
  positions.slice(1).forEach((p, i) => assert.ok(p.left >= positions[i].right + 14));
});

test('Readable value scales enclose all observations, including ECI uncertainty bounds', () => {
  const eci = numericScale(31.39, 171.7);
  assert.deepEqual(eci.ticks, [25, 50, 75, 100, 125, 150, 175]);
  assert.deepEqual(numericScale(0, 5.3).ticks, [0, 1, 2, 3, 4, 5, 6]);
  const money = numericScale(13.1, 23.8);
  assert.deepEqual(money.ticks, [12, 14, 16, 18, 20, 22, 24]);
  const flat = numericScale(0, 0);
  assert.ok(flat.min < 0 && flat.max > 0);
});

test('Human-duration illustration uses the measured anchor and does not extrapolate beyond checked releases', () => {
  const points = JSON.parse(readFileSync(new URL('../data/technology.json', import.meta.url))).eci;
  const context = JSON.parse(readFileSync(new URL('../data/metr_context.json', import.meta.url)));
  const human = eciHumanContext(points, context);
  assert.equal(human.valid, true);
  assert.equal(human.matches.length, 17);
  assert.equal(human.minutesAt(141.17), 60.388937);
  assert.ok(Math.abs(human.minutesAt(146.17) / human.minutesAt(141.17) - 2) < 1e-12);
  assert.equal(human.minutesAt(166.57), null);
  assert.equal(human.minutesAt(100), null);
  assert.equal(human.minutesAt(NaN), null);
  assert.ok(!human.matches.some(m => /Astra|Fable/.test(m.label)));
  const gpt5 = human.matches.find(m => m.label === 'GPT-5');
  assert.equal(gpt5.minutes, 203.012577);
  assert.notEqual(gpt5.minutes, human.minutesAt(gpt5.eci));
  human.ticks.forEach(t => assert.ok(human.minutesAt(t.value) > 0));
});

test('An Epoch refit disables stale calibration while retaining separately published METR facts', () => {
  const points = JSON.parse(readFileSync(new URL('../data/technology.json', import.meta.url))).eci;
  const context = JSON.parse(readFileSync(new URL('../data/metr_context.json', import.meta.url)));
  const changed = points.map(p => p.label === 'GPT-5' ? { ...p, value: p.value + 0.01 } : p);
  const stale = eciHumanContext(changed, context);
  assert.equal(stale.valid, false);
  assert.deepEqual(stale.ticks, []);
  assert.equal(stale.minutesAt(141.17), null);
  assert.equal(stale.matches.find(m => m.label === 'GPT-5').minutes, 203.012577);
  assert.equal(eciHumanContext(points, null).valid, false);
  assert.equal(eciHumanContext(points.map(p => ({ ...p, date: '2000-01-01' })), context).matches.length, 0);
});

test('Frontier tooltips resolve the same measured human-time facts as scatter points', () => {
  const points = JSON.parse(readFileSync(new URL('../data/technology.json', import.meta.url))).eci;
  const context = JSON.parse(readFileSync(new URL('../data/metr_context.json', import.meta.url)));
  const human = eciHumanContext(points, context);
  const gpt5 = frontier(points).find(p => p.label === 'GPT-5');
  assert.ok(gpt5);
  const task = eciTaskDuration(gpt5, human, true);
  assert.equal(task.kind, 'measured');
  assert.equal(task.minutes, 203.012577);
  assert.equal(task.low, 112.641357);
  assert.equal(task.high, 405.551565);
  const astra = points.find(p => p.label === 'GPT-6 Astra');
  assert.equal(eciTaskDuration(astra, human).kind, 'unavailable');
  const extrapolation = eciTaskDuration(astra, human, true);
  assert.equal(extrapolation.kind, 'extrapolation');
  assert.ok(Math.abs(extrapolation.minutes / 60 - 34.04383779163984) < 1e-10);
  assert.equal(human.minutesAt(astra.value), null); // The chart axis stays bounded.
});

test('Three-year point pace uses a full calendar window and the frontier available at its start', () => {
  const points = [
    { date: '2023-03-14', value: 125.88 },
    { date: '2023-09-04', value: 130 }, // Too late to be the start observation.
    { date: '2026-08-01', value: 166.57 },
    { date: '2026-09-03', value: 160 }, // End date advances; frontier does not fall.
  ];
  const pace = eciAnnualizedGain(points);
  assert.equal(pace.start, '2023-09-03');
  assert.equal(pace.end, '2026-09-03');
  assert.equal(pace.base.value, 125.88);
  assert.equal(pace.latest.value, 166.57);
  assert.ok(Math.abs(pace.pointsPerYear - 13.563333333333333) < 1e-10);
  assert.equal(eciAnnualizedGain(points.slice(1)), null);
  assert.equal(eciAnnualizedGain([]), null);
  assert.equal(eciAnnualizedGain(points, 0), null);
  const leap = eciAnnualizedGain([{ date: '2021-02-28', value: 100 }, { date: '2024-02-29', value: 130 }]);
  assert.equal(leap.start, '2021-02-28');
  assert.equal(leap.pointsPerYear, 10);
});
