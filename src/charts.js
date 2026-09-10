import { finite, utc, ordered, calendarTicks, numericScale } from './metrics.js?v=91';

const NS = 'http://www.w3.org/2000/svg';
const element = (name, attrs = {}, text = '') => {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (text) el.textContent = text;
  return el;
};
const dateLabel = date => new Date(utc(date)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const number = value => new Intl.NumberFormat('en', { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 }).format(value);
const observers = new WeakMap();

export const axisValues = (series, axis = 'left') => series.filter(s => (s.axis || 'left') === axis).flatMap(s => s.points.flatMap(p => [p.value, p.low, p.high].filter(finite)));
export function axisPosition(value, domain, top, bottom, logarithmic = false) {
  const transform = logarithmic ? Math.log : v => v;
  const [lo, hi] = domain.map(transform);
  return bottom - (transform(value) - lo) / (hi - lo) * (bottom - top);
}
export const seriesValueText = (value, series, options = {}) => (series.format || options.format || number)(value);

export function chart(host, options) {
  observers.get(host)?.disconnect();
  host.replaceChildren();
  const series = options.series.map(s => ({ ...s, points: ordered(s.points), visible: true }));
  const all = series.flatMap(s => s.points);
  if (!all.length) {
    host.classList.add('empty-chart');
    host.textContent = options.empty || 'History not available yet';
    return;
  }
  host.classList.remove('empty-chart');
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  if (series.length > 1) series.forEach(s => {
    const button = document.createElement('button');
    button.type = 'button'; button.setAttribute('aria-pressed', 'true');
    const swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.background = s.color;
    if (s.dashed || s.dashForPoint) { swatch.style.background = 'transparent'; swatch.style.borderTop = `2px dashed ${s.color}`; }
    if (s.hollow) { swatch.classList.add('hollow-swatch'); swatch.style.background = 'transparent'; swatch.style.borderColor = s.color; }
    button.append(swatch, document.createTextNode(s.name));
    button.addEventListener('click', () => { s.visible = !s.visible; button.setAttribute('aria-pressed', String(s.visible)); draw(); });
    legend.append(button);
  });
  const frame = document.createElement('div'); frame.className = 'chart-frame';
  const svg = element('svg', { role: 'img', 'aria-label': options.title });
  const hit = document.createElement('div'); hit.className = 'chart-hit'; hit.tabIndex = 0;
  hit.setAttribute('role', 'slider'); hit.setAttribute('aria-label', `${options.title}. Use left and right arrows to inspect dates.`);
  hit.setAttribute('aria-valuemin', '0');
  const tooltip = document.createElement('div'); tooltip.className = 'chart-tooltip';
  tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  const tooltipDate = document.createElement('div'); tooltipDate.className = 'tooltip-date';
  const tooltipRows = document.createElement('div'); tooltipRows.className = 'tooltip-rows';
  tooltip.append(tooltipDate, tooltipRows);
  frame.append(svg, hit, tooltip); host.append(legend, frame);
  let dates = [...new Set(all.map(p => utc(p.date)))].sort((a, b) => a - b);
  let selected = dates.length - 1;
  let geometry;
  let inspecting = false, pointer = null;
  hit.setAttribute('aria-valuemax', dates.length - 1);
  const setSelected = index => {
    selected = Math.max(0, Math.min(dates.length - 1, index));
    if (!geometry) return;
    svg.querySelectorAll('.inspect-guide').forEach(el => el.remove());
    const t = dates[selected];
    if (inspecting) svg.append(element('line', { class: 'inspect-guide', x1: geometry.x(t), x2: geometry.x(t), y1: geometry.top, y2: geometry.bottom }));
    const lines = [];
    tooltipRows.replaceChildren();
    series.filter(s => s.visible).forEach(s => {
      const sy = s.axis === 'right' ? geometry.rightY : geometry.y;
      if (!s.points.length || t < utc(s.points[0].date) || (!s.step && t > utc(s.points.at(-1).date))) return;
      const exact = s.points.filter(p => utc(p.date) === t);
      const nearby = s.step ? s.points.findLast(p => utc(p.date) <= t) : s.points.reduce((a, b) => Math.abs(utc(a.date) - t) <= Math.abs(utc(b.date) - t) ? a : b);
      // Scatter results sharing a release date must all remain inspectable.
      let selectedPoints = s.type === 'scatter' ? exact.sort((a, b) => b.value - a.value) : exact.length ? exact : [nearby];
      if (s.type === 'scatter' && pointer && selectedPoints.length > 1) selectedPoints = [selectedPoints.reduce((a, b) => Math.abs(sy(a.value) - pointer.y) <= Math.abs(sy(b.value) - pointer.y) ? a : b)];
      selectedPoints.forEach(p => {
        if (!p || (!s.step && options.maxGapDays && Math.abs(utc(p.date) - t) > options.maxGapDays * 86400000)) return;
        const value = seriesValueText(p.value, s, options);
        const pointNote = options.pointDetail?.(p, s) || p.note || '';
        const bounds = finite(p.low) && finite(p.high) ? ` [${seriesValueText(p.low, s, options)}–${seriesValueText(p.high, s, options)}]` : '';
        lines.push(`${p.label || s.name}: ${value}${bounds}${utc(p.date) !== t && !s.step ? ` (${dateLabel(p.date)})` : ''}${pointNote ? ` · ${pointNote}` : ''}`);
        const row = document.createElement('div'); row.className = 'tooltip-row';
        const name = document.createElement('span'); name.className = 'tooltip-name'; name.textContent = s.step && p.label ? `${s.name} · ${p.label}` : p.label || s.name;
        const swatch = document.createElement('i'); swatch.style.background = s.color; swatch.setAttribute('aria-hidden', 'true'); name.prepend(swatch);
        const score = document.createElement('strong'); score.textContent = value;
        row.append(name, score);
        if (bounds || (utc(p.date) !== t && !s.step)) {
          const detail = document.createElement('span'); detail.className = 'tooltip-detail';
          detail.textContent = `${bounds ? `Interval${bounds}` : ''}${utc(p.date) !== t && !s.step ? ` · ${dateLabel(p.date)}` : ''}`;
          row.append(detail);
        }
        tooltipRows.append(row);
        if (pointNote) {
          const detail = document.createElement('span'); detail.className = 'tooltip-detail';
          detail.textContent = pointNote; row.append(detail);
        }
        if (inspecting && s.type !== 'bars') svg.append(element('circle', { class: 'inspect-guide inspect-point', cx: geometry.x(t), cy: sy(p.value), r: 4, fill: s.color, stroke: 'var(--plot)', 'stroke-width': 2, 'stroke-dasharray': 'none' }));
      });
    });
    const text = `${(options.dateFormat || dateLabel)(new Date(t).toISOString().slice(0, 10))} · ${lines.length ? lines.join(' · ') : 'No visible result on this date'}`;
    tooltipDate.textContent = (options.dateFormat || dateLabel)(new Date(t).toISOString().slice(0, 10));
    tooltip.hidden = !inspecting || !lines.length;
    if (inspecting) {
      const x = pointer?.x ?? geometry.x(t);
      const width = tooltip.offsetWidth;
      const desired = x + 18 + width > frame.clientWidth - 8 ? x - width - 18 : x + 18;
      tooltip.style.left = `${Math.max(8, Math.min(frame.clientWidth - width - 8, desired))}px`;
      tooltip.style.top = `${Math.max(8, Math.min((pointer?.y ?? 18) + 14, geometry.bottom - tooltip.offsetHeight))}px`;
    }
    hit.setAttribute('aria-valuenow', selected); hit.setAttribute('aria-valuetext', text);
  };
  hit.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hide(); return; }
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      inspecting = true; pointer = null;
      setSelected(event.key === 'Home' ? 0 : event.key === 'End' ? dates.length - 1 : selected + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  const inspectPointer = event => {
    if (!geometry) return;
    const rect = frame.getBoundingClientRect();
    const position = event.clientX - rect.left;
    inspecting = true; pointer = { x: position, y: event.clientY - rect.top };
    const target = geometry.start + (position - geometry.left) / geometry.width * (geometry.end - geometry.start);
    let lo = 0, hi = dates.length - 1;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (dates[mid] < target) lo = mid + 1; else hi = mid; }
    setSelected(lo > 0 && Math.abs(dates[lo - 1] - target) < Math.abs(dates[lo] - target) ? lo - 1 : lo);
  };
  function hide() { inspecting = false; pointer = null; tooltip.hidden = true; svg.querySelectorAll('.inspect-guide').forEach(el => el.remove()); }
  hit.addEventListener('pointermove', inspectPointer);
  hit.addEventListener('pointerdown', inspectPointer);
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('blur', hide);
  hit.addEventListener('focus', () => { if (!inspecting) { inspecting = true; pointer = null; setSelected(selected); } });

  function draw() {
    const width = Math.max(160, frame.clientWidth);
    const height = options.height || 250;
    const left = width < 450 ? 52 : 62, right = options.rightAxis ? 70 : 14, top = options.markers?.length ? 44 : options.rightAxis ? 30 : 16, bottom = height - (options.calendarAxis ? 52 : 30);
    const rawStart = dates[0], rawEnd = dates.at(-1);
    const barPad = series.some(s => s.type === 'bars') ? (rawEnd - rawStart || 86400000) / Math.max(dates.length - 1, 1) / 2 : 0;
    const start = rawStart - barPad;
    const end = rawEnd + barPad === start ? start + 86400000 : rawEnd + barPad;
    const values = axisValues(series);
    let min = Math.min(...values), max = Math.max(...values);
    if (options.zero) { min = Math.min(0, min); max = Math.max(0, max); }
    let yTicks;
    if (options.calendarAxis && !options.domain) {
      const scale = numericScale(min, max);
      min = scale.min; max = scale.max; yTicks = scale.ticks;
    } else {
      const pad = (max - min || Math.abs(max) || 1) * 0.1;
      min -= options.zero && min === 0 ? 0 : pad; max += pad;
      if (options.domain) [min, max] = options.domain;
      yTicks = Array.from({ length: 5 }, (_, i) => min + (max - min) * i / 4);
    }
    const x = t => left + (t - start) / (end - start) * (width - left - right);
    const y = v => axisPosition(v, [min, max], top, bottom);
    const rightY = options.rightAxis ? v => axisPosition(v, options.rightAxis.domain, top, bottom, options.rightAxis.log) : null;
    geometry = { x, y, rightY, start, end, left, width: width - left - right, top, bottom };
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.style.height = `${height}px`;
    svg.append(element('title', {}, options.title));
    for (const value of yTicks) {
      const yy = y(value);
      svg.append(element('line', { class: 'grid-line', x1: left, x2: width - right, y1: yy, y2: yy }));
      svg.append(element('text', { class: 'axis-label', x: left - 10, y: yy + 4, 'text-anchor': 'end' }, options.tickFormat ? options.tickFormat(value) : number(value)));
    }
    if (options.rightAxis) {
      const axis = options.rightAxis, xx = width - right;
      svg.append(element('text', { class: 'axis-title', x: left, y: 13 }, 'ECI'));
      svg.append(element('text', { class: 'axis-title expert-axis-title', x: width - 4, y: 13, 'text-anchor': 'end' }, axis.title || 'Expert task-time (log)'));
      const [lo, hi] = axis.domain;
      svg.append(element('line', { class: 'axis-tick', x1: xx, x2: xx, y1: top, y2: bottom }));
      axis.ticks.filter(t => t.value >= lo && t.value <= hi).forEach(t => {
        svg.append(element('line', { class: 'axis-tick', x1: xx, x2: xx + 5, y1: rightY(t.value), y2: rightY(t.value) }));
        svg.append(element('text', { class: 'axis-label expert-axis-label', x: xx + 9, y: rightY(t.value) + 4 }, t.label));
      });
    }
    if (options.calendarAxis) {
      for (const tick of calendarTicks(start, end, geometry.width)) {
        const xx = x(tick.time);
        svg.append(element('line', { class: 'calendar-grid-line', x1: xx, x2: xx, y1: top, y2: bottom }));
        svg.append(element('line', { class: 'axis-tick', x1: xx, x2: xx, y1: bottom, y2: bottom + 5 }));
        svg.append(element('text', { class: 'axis-label', x: xx, y: bottom + 20, 'text-anchor': tick.anchor }, tick.label));
      }
      svg.append(element('text', { class: 'axis-title', x: left + geometry.width / 2, y: height - 4, 'text-anchor': 'middle' }, options.calendarAxis));
    } else {
      const tickCount = width < 450 ? 3 : 5;
      for (let i = 0; i < tickCount; i++) {
        const t = start + (end - start) * i / (tickCount - 1);
        const label = new Date(t).toLocaleDateString('en-GB', { month: end - start < 86400000 * 730 ? 'short' : undefined, year: '2-digit', timeZone: 'UTC' });
        svg.append(element('text', { class: 'axis-label', x: x(t), y: height - 7, 'text-anchor': i === 0 ? 'start' : i === tickCount - 1 ? 'end' : 'middle' }, label));
      }
    }
    series.filter(s => s.visible).forEach(s => {
      const y = s.axis === 'right' ? rightY : geometry.y;
      if (s.type === 'bars') {
        const bw = Math.max(2, Math.min(28, geometry.width / Math.max(s.points.length, 2) * 0.65));
        s.points.forEach(p => svg.append(element('rect', { x: x(utc(p.date)) - bw / 2, y: Math.min(y(0), y(p.value)), width: bw, height: Math.abs(y(p.value) - y(0)), fill: p.value < 0 ? 'var(--negative)' : s.color, rx: 2 })));
      } else if (s.type === 'scatter') {
        s.points.forEach(p => {
          if (finite(p.low) && finite(p.high)) svg.append(element('line', { x1: x(utc(p.date)), x2: x(utc(p.date)), y1: y(p.low), y2: y(p.high), stroke: s.color, opacity: 0.3 }));
          svg.append(element('circle', { cx: x(utc(p.date)), cy: y(p.value), r: s.hollow ? 4.5 : 3.3, fill: s.hollow ? 'var(--plot)' : s.color, stroke: s.hollow ? s.color : 'none', 'stroke-width': s.hollow ? 1.7 : 0, opacity: s.hollow ? 1 : 0.75 }));
        });
      } else if (s.dashForPoint) {
        // Draw status changes separately: an estimated curve must not make its
        // extrapolated portion look like an observed continuation.
        s.points.forEach((p, i) => {
          const previous = s.points[i - 1];
          if (!previous) return;
          const segments = s.step ? [
            { path: `M${x(utc(previous.date))},${y(previous.value)}H${x(utc(p.date))}`, point: previous },
            { path: `M${x(utc(p.date))},${y(previous.value)}V${y(p.value)}`, point: p },
          ] : [{ path: `M${x(utc(previous.date))},${y(previous.value)}L${x(utc(p.date))},${y(p.value)}`, point: p }];
          segments.forEach(segment => svg.append(element('path', { d: segment.path, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dashForPoint(segment.point), 'stroke-linejoin': 'round' })));
        });
        const last = s.points.at(-1);
        if (last && s.step && utc(last.date) < rawEnd) svg.append(element('path', { d: `M${x(utc(last.date))},${y(last.value)}H${x(rawEnd)}`, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dashForPoint(last) }));
      } else {
        let lastDate, lastValue;
        let path = s.points.map(p => {
          const t = utc(p.date), broken = lastDate === undefined || (options.maxGapDays && (t - lastDate) / 86400000 > options.maxGapDays);
          const segment = broken ? `M${x(t).toFixed(2)},${y(p.value).toFixed(2)}` : s.step ? `H${x(t).toFixed(2)}V${y(p.value).toFixed(2)}` : `L${x(t).toFixed(2)},${y(p.value).toFixed(2)}`;
          lastDate = t;
          lastValue = p.value;
          return segment;
        }).join(' ');
        if (s.step && finite(lastValue) && lastDate < rawEnd) path += `H${x(rawEnd).toFixed(2)}`;
        svg.append(element('path', { d: path, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dashed ? '5 5' : '', 'stroke-linejoin': 'round' }));
        if (s.points.length < 20) s.points.forEach(p => svg.append(element('circle', { cx: x(utc(p.date)), cy: y(p.value), r: 3, fill: s.color })));
      }
    });
    (options.markers || []).filter(m => utc(m.date) >= start && utc(m.date) <= end).forEach((marker, i) => {
      const xx = x(utc(marker.date));
      svg.append(element('line', { x1: xx, x2: xx, y1: top - 4, y2: bottom, stroke: 'var(--text-muted)', 'stroke-dasharray': '3 5', opacity: 0.6 }));
      svg.append(element('text', { class: 'axis-label', x: Math.max(left, Math.min(width - 110, xx)), y: 13 + (i % 2) * 15 }, marker.label));
    });
    setSelected(selected);
  }
  const observer = new ResizeObserver(draw);
  observer.observe(frame);
  observers.set(host, observer);
  draw();
}
