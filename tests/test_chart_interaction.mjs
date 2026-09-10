import test from 'node:test';
import assert from 'node:assert/strict';
import { chart } from '../src/charts.js';

// Small DOM adapter for event and containment checks; no browser/layout engine.
function fixture(t, { narrow = false, width = 800 } = {}) {
  const previous = { document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, matchMedia: globalThis.matchMedia };
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.style = {}; this.events = {}; this.className = ''; this.hidden = false; }
    get classList() {
      return {
        contains: name => this.className.split(' ').includes(name),
        add: name => this.classList.toggle(name, true),
        remove: name => this.classList.toggle(name, false),
        toggle: (name, enabled) => { this.className = [...this.className.split(' ').filter(n => n && n !== name), ...(enabled ? [name] : [])].join(' '); },
      };
    }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = value; }
    getAttribute(name) { return this.attributes[name]; }
    removeAttribute(name) { delete this.attributes[name]; }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parent = this; this.children.push(node); } }
    prepend(node) { this.append(node); this.children.unshift(this.children.pop()); }
    replaceChildren(...nodes) { this.children.forEach(node => { node.parent = null; }); this.children = []; this.append(...nodes); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.classList.contains(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]); }
    addEventListener(name, listener) { (this.events[name] ||= []).push(listener); }
    fire(name, details = {}) { for (const listener of this.events[name] || []) listener({ preventDefault() {}, ...details }); }
    focus() { const old = document.activeElement; if (old === this) return; document.activeElement = this; old?.fire('blur', { relatedTarget: this }); this.fire('focus'); }
    get clientWidth() { return width; }
    get offsetWidth() { return 250; }
    get offsetHeight() { return 130; }
    get offsetLeft() { return 0; }
    get offsetTop() { return 35; }
    getBoundingClientRect() { return { left: 0, top: 35 }; }
  }
  globalThis.document = {
    createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag),
    createTextNode: text => { const node = new Node('#text'); node.textContent = text; return node; },
  };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: narrow });
  t.after(() => Object.assign(globalThis, previous));
  const host = new Node('div');
  chart(host, {
    title: 'ECI', format: n => `${n} ECI`,
    series: [{ name: 'Frontier', color: 'purple', points: [{ date: '2025-01-01', value: 100 }, { date: '2026-01-01', value: 120 }] }],
    pointDetail: () => 'Illustrative task length, not a METR measurement.',
  });
  const find = cls => host.querySelectorAll(`.${cls}`)[0];
  return { host, find };
}

test('Touch readout stays below the plot after release and clears without reopening on focus', t => {
  const { host, find } = fixture(t);
  const hit = find('chart-hit'), tooltip = find('chart-tooltip'), frame = find('chart-frame');
  hit.fire('pointerdown', { pointerType: 'touch', clientX: 120, clientY: 100 });
  hit.focus();
  assert.equal(tooltip.parent, host);
  assert.equal(frame.contains(tooltip), false, 'Readout must not enlarge or cover the chart hit area');
  assert.equal(tooltip.classList.contains('is-docked'), true);
  assert.equal(tooltip.getAttribute('role'), 'group');
  hit.fire('pointerup', { pointerType: 'touch' });
  hit.fire('pointerleave', { pointerType: 'touch' });
  assert.equal(tooltip.hidden, false);
  assert.match(find('tooltip-detail').textContent, /not a METR measurement/);
  hit.fire('pointermove', { pointerType: 'touch', clientX: 770, clientY: 100 });
  assert.match(find('tooltip-date').textContent, /2026/);
  find('tooltip-dismiss').focus();
  assert.equal(tooltip.hidden, false, 'Moving focus into the readout must preserve it');
  find('tooltip-dismiss').fire('click');
  assert.equal(tooltip.hidden, true);
  assert.equal(document.activeElement, hit);
  assert.equal(find('chart-inspect-hint').hidden, false);
});

test('Desktop mouse inspection floats relative to the plot and closes on pointer exit', t => {
  const { find } = fixture(t);
  const hit = find('chart-hit'), tooltip = find('chart-tooltip');
  hit.fire('pointermove', { pointerType: 'mouse', clientX: 120, clientY: 100 });
  assert.equal(tooltip.classList.contains('is-docked'), false);
  assert.equal(tooltip.getAttribute('role'), 'tooltip');
  assert.equal(tooltip.hidden, false);
  assert.equal(tooltip.style.top, '114px', 'Position includes the legend offset above the plot');
  assert.equal(find('chart-inspect-hint').hidden, true);
  hit.fire('pointerleave');
  assert.equal(tooltip.hidden, true);
});

test('Narrow-screen keyboard inspection docks, navigates dates and dismisses with Escape', t => {
  const { find } = fixture(t, { narrow: true, width: 360 });
  const hit = find('chart-hit'), tooltip = find('chart-tooltip');
  hit.focus();
  hit.fire('keydown', { key: 'Home' });
  assert.equal(tooltip.classList.contains('is-docked'), true);
  assert.match(hit.getAttribute('aria-valuetext'), /100 ECI/);
  hit.fire('keydown', { key: 'ArrowRight' });
  assert.match(hit.getAttribute('aria-valuetext'), /120 ECI/);
  hit.fire('keydown', { key: 'Escape' });
  assert.equal(tooltip.hidden, true);
  assert.equal(find('chart-inspect-hint').hidden, false);
});
