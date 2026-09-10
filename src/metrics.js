export const finite = value => typeof value === 'number' && Number.isFinite(value);
export const utc = value => new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value.slice(0, 10)}T00:00:00Z`).getTime();
export const monthIndex = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
export const quarterLabel = value => `Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1} ${value.slice(0, 4)}`;
export const periodEnd = (value, frequency) => frequency === 'quarterly'
  ? Date.UTC(Number(value.slice(0, 4)), Math.floor((Number(value.slice(5, 7)) - 1) / 3) * 3 + 3, 0)
  : utc(value);
export const ordered = points => (Array.isArray(points) ? [...points] : []).filter(p => typeof p?.date === 'string' && Number.isFinite(utc(p.date)) && finite(p.value)).sort((a, b) => utc(a.date) - utc(b.date));

export function calendarTicks(start, end, width) {
  if (!(end > start) || !(width > 0)) return [];
  const label = time => new Date(time).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const ticks = [{ time: start, label: label(start), anchor: 'start' }];
  const endLabel = label(end);
  const endLeft = width - endLabel.length * 6.5;
  const yearCount = new Date(end).getUTCFullYear() - new Date(start).getUTCFullYear();
  const capacity = Math.max(1, Math.floor(width / 65));
  const step = [1, 2, 5, 10, 20, 50].find(n => yearCount / n <= capacity) || 100;
  let previousRight = ticks[0].label.length * 6.5;
  for (let year = new Date(start).getUTCFullYear(); year <= new Date(end).getUTCFullYear(); year++) {
    const time = Date.UTC(year, 0, 1);
    if (time <= start || time >= end || year % step) continue;
    const position = (time - start) / (end - start) * width;
    const halfLabel = String(year).length * 3.25;
    if (position - halfLabel < previousRight + 14 || position + halfLabel > endLeft - 14) continue;
    ticks.push({ time, label: String(year), anchor: 'middle' });
    previousRight = position + halfLabel;
  }
  ticks.push({ time: end, label: endLabel, anchor: 'end' });
  return ticks;
}

export function numericScale(min, max, intervals = 6) {
  const span = max - min || Math.abs(max) || 1;
  const rawStep = span / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= rawStep) * magnitude;
  let low = Math.floor(min / step) * step, high = Math.ceil(max / step) * step;
  if (low === high) { low -= step; high += step; }
  const count = Math.round((high - low) / step);
  return { min: low, max: high, ticks: Array.from({ length: count + 1 }, (_, i) => Number((low + i * step).toPrecision(12))) };
}

export function windowYears(points, years) {
  const sorted = ordered(points);
  if (!sorted.length) return [];
  const end = new Date(utc(sorted.at(-1).date));
  end.setUTCFullYear(end.getUTCFullYear() - years);
  return sorted.filter(p => utc(p.date) >= end.getTime());
}

export function m2Metrics(points) {
  const all = ordered(points);
  const latest = all.at(-1);
  if (!latest) return { points: [], reference: [], cagr: null, yoy: null, referenceCagr: null, referenceStart: null };
  const end = monthIndex(latest.date);
  const months = new Map(all.map(p => [monthIndex(p.date), p]));
  const anchor = months.get(end - 120);
  const prior = months.get(end - 12);
  const longAnchor = months.get(end - 360);
  const referenceCagr = longAnchor?.value > 0 && latest.value > 0 ? ((latest.value / longAnchor.value) ** (1 / 30) - 1) * 100 : null;
  const complete = anchor && Array.from({ length: 121 }, (_, i) => months.has(end - i)).every(Boolean);
  const visible = all.filter(p => monthIndex(p.date) >= end - 120);
  return {
    latest, points: visible, referenceCagr, referenceStart: longAnchor?.date || null,
    reference: complete && referenceCagr !== null ? visible.map(p => ({ date: p.date, value: anchor.value * (1 + referenceCagr / 100) ** ((monthIndex(p.date) - (end - 120)) / 12) })) : [],
    cagr: complete && anchor.value > 0 ? ((latest.value / anchor.value) ** 0.1 - 1) * 100 : null,
    yoy: prior?.value > 0 ? (latest.value / prior.value - 1) * 100 : null,
  };
}

export function globalMoney(history) {
  const rows = [...history].sort((a, b) => a.period.localeCompare(b.period));
  const complete = r => ['US_usd_bn', 'CN_cny_tn', 'EZ_eur_tn', 'JP_jpy_tn', 'UK_gbp_bn'].every(k => finite(r.components_local?.[k])) && (!r.component_dates || (r.flags?.includes('fx_monthly_avg_FRED') && ['US', 'CN', 'EZ', 'JP', 'UK'].every(k => r.component_dates[k]?.slice(0, 7) === r.period)));
  const fxValid = fx => ['EURUSD', 'GBPUSD', 'USDCNY', 'USDJPY'].every(k => finite(fx?.[k]) && fx[k] > 0);
  const latest = [...rows].reverse().find(r => complete(r) && fxValid(r.fx));
  if (!latest) return { headline: [], fixed: [], latest: null, yoy: null, fixedYoy: null };
  const total = (r, fx) => {
    const c = r.components_local;
    return c.US_usd_bn / 1000 + c.CN_cny_tn / fx.USDCNY + c.EZ_eur_tn * fx.EURUSD + c.JP_jpy_tn / fx.USDJPY + c.UK_gbp_bn / 1000 * fx.GBPUSD;
  };
  const matched = rows.filter(r => complete(r) && fxValid(r.fx));
  const prior = matched.find(r => monthIndex(r.period) === monthIndex(latest.period) - 12);
  return { latest,
    yoy: prior ? (total(latest, latest.fx) / total(prior, prior.fx) - 1) * 100 : null,
    fixedYoy: prior ? (total(latest, latest.fx) / total(prior, latest.fx) - 1) * 100 : null,
    headline: matched.map(r => ({ date: `${r.period}-01`, value: total(r, r.fx), note: (r.flags || []).join(' · ') })),
    fixed: matched.map(r => ({ date: `${r.period}-01`, value: total(r, latest.fx), note: `FX fixed at ${latest.period}` })),
  };
}

export function topDistinctLabs(rows, key, limit = 3) {
  const seen = new Set();
  return rows.filter(r => finite(r[key]) && r.creator).sort((a, b) => b[key] - a[key] || a.model.localeCompare(b.model)).filter(r => {
    const lab = r.creator.trim().toLowerCase();
    if (seen.has(lab)) return false;
    seen.add(lab);
    return true;
  }).slice(0, limit);
}

export function trailingQuarters(points) {
  const rows = ordered(points);
  const months = new Map(rows.map(r => [monthIndex(r.date), r]));
  return rows.flatMap(row => {
    const group = [0, 3, 6, 9].map(offset => months.get(monthIndex(row.date) - offset));
    return group.every(Boolean) ? [{ date: row.date, value: group.reduce((n, r) => n + r.value, 0) }] : [];
  });
}

export function frontier(points) {
  // One frontier result per release date, regardless of input order.
  const daily = new Map();
  ordered(points).forEach(p => {
    if (!daily.has(p.date) || p.value > daily.get(p.date).value) daily.set(p.date, p);
  });
  let max = -Infinity;
  return [...daily.values()].filter(p => { if (p.value <= max) return false; max = p.value; return true; });
}

export function quarterlyAverage(points) {
  return trailingQuarters(points).map(p => ({ ...p, value: p.value / 4 }));
}

// Preserve the distinction between a published METR estimate and an illustrative
// axis. Disable the latter if a new Epoch fit changes any checked calibration.
export function eciHumanContext(points, context) {
  const measurements = context?.points || [];
  const matches = measurements.map(m => ({ ...m, point: points.find(p => p.label === m.label && p.date === m.date) })).filter(m => m.point);
  const anchor = matches.find(m => m.id === context?.anchor_id);
  const valid = Boolean(matches.length >= 3 && matches.length === measurements.length && anchor?.minutes > 0
    && context.points_per_doubling > 0 && matches.every(m => finite(m.eci) && m.point.value === m.eci));
  const range = valid ? [Math.min(...matches.map(m => m.eci)), Math.max(...matches.map(m => m.eci))] : null;
  const ruleMinutesAt = value => valid && finite(value) ? anchor.minutes * 2 ** ((value - anchor.eci) / context.points_per_doubling) : null;
  const minutesAt = value => {
    if (!range || !finite(value) || value < range[0] || value > range[1]) return null;
    const minutes = ruleMinutesAt(value);
    return minutes <= context.reliable_limit_minutes ? minutes : null;
  };
  const extrapolatedMinutesAt = value => range && value > range[1] ? ruleMinutesAt(value) : null;
  const valueAt = minutes => anchor && minutes > 0 ? anchor.eci + context.points_per_doubling * Math.log2(minutes / anchor.minutes) : null;
  const ticks = valid ? [15, 60, 240].map(minutes => ({ value: valueAt(minutes), label: minutes < 60 ? '≈15 min' : `≈${minutes / 60} h` })).filter(t => minutesAt(t.value) !== null) : [];
  return { matches, anchor, range, minutesAt, extrapolatedMinutesAt, ticks, valid };
}

// Frontier steps retain their underlying model/release date. Use the same lookup
// as scatter points so toggling a series cannot remove the human-time context.
export function eciTaskDuration(point, context, allowExtrapolation = false) {
  const measured = context.matches.find(m => m.label === point.label && m.date === point.date);
  if (measured) return { kind: 'measured', minutes: measured.minutes, low: measured.low_minutes, high: measured.high_minutes };
  const minutes = context.minutesAt(point.value);
  if (minutes !== null) return { kind: 'illustration', minutes };
  const extrapolated = allowExtrapolation ? context.extrapolatedMinutesAt(point.value) : null;
  return extrapolated !== null ? { kind: 'extrapolation', minutes: extrapolated } : { kind: 'unavailable', minutes: null };
}

// This curve is derived entirely from ECI. Published METR measurements remain
// separate context and never replace points in the estimated time series.
export function estimatedExpertFrontier(points, context) {
  return frontier(points).flatMap(p => {
    const bounded = context.minutesAt(p.value);
    const value = bounded ?? context.extrapolatedMinutesAt(p.value);
    if (!finite(value) || value <= 0) return [];
    return [{ date: p.date, label: p.label, value, eci: p.value,
      estimateKind: bounded !== null ? 'illustration' : 'extrapolation' }];
  });
}

export function expertDurationScale(points) {
  const values = points.map(p => p.value).filter(v => finite(v) && v > 0);
  if (!values.length) return null;
  const ticks = [5, 15, 60, 240, 960, 3840];
  while (ticks[0] > Math.min(...values)) ticks.unshift(ticks[0] / 4);
  while (ticks.at(-1) < Math.max(...values)) ticks.push(ticks.at(-1) * 4);
  return { domain: [ticks[0], ticks.at(-1)], ticks };
}

export function eciAnnualizedGain(points, years = 3) {
  const all = ordered(points);
  if (!all.length || !Number.isInteger(years) || years <= 0) return null;
  const end = all.at(-1).date, startDate = new Date(utc(end));
  const month = startDate.getUTCMonth();
  startDate.setUTCFullYear(startDate.getUTCFullYear() - years);
  // February 29 maps to the last day of February in a non-leap start year.
  if (startDate.getUTCMonth() !== month) startDate.setUTCDate(0);
  const start = startDate.toISOString().slice(0, 10);
  const available = frontier(all);
  const base = available.findLast(p => p.date <= start), latest = available.at(-1);
  if (!base) return null;
  const gain = latest.value - base.value;
  return { start, end, base, latest, years, gain, pointsPerYear: gain / years };
}

export function eciPace(points) {
  const all = ordered(points);
  if (!all.length) return { annual: [], latest: null, trailingGain: null };
  const latestDate = all.at(-1).date;
  const lastYear = Number(latestDate.slice(0, 4));
  const firstYear = Number(all[0].date.slice(0, 4));
  const bestAt = day => all.filter(p => p.date <= day).reduce((best, p) => !best || p.value > best.value ? p : best, null);
  const latest = bestAt(latestDate);
  const priorDate = new Date(utc(latestDate));
  priorDate.setUTCFullYear(priorDate.getUTCFullYear() - 1);
  const prior = bestAt(priorDate.toISOString().slice(0, 10));
  const annual = [];
  for (let year = firstYear + 1; year <= lastYear; year++) {
    const start = `${year - 1}-12-31`, end = year === lastYear ? latestDate : `${year}-12-31`;
    const base = bestAt(start), finish = bestAt(end);
    if (!base || !finish) continue;
    const gain = finish.value - base.value;
    const yearDays = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    const elapsedDays = (utc(end) - Date.UTC(year, 0, 1)) / 86400000 + 1;
    annual.push({ year, start, end, gain, pace: gain * yearDays / elapsedDays, value: finish.value, partial: elapsedDays < yearDays });
  }
  return { annual, latest, latestDate, trailingGain: prior ? latest.value - prior.value : null };
}
