import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as metrics from '../src/metrics.js';

// Run the real render functions with inert DOM sinks; no browser or network.
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8')
  .split(/\r?\nshell\(\);/)[0].replace(/^import .*;\r?$/gm, '');
function fixture() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      innerHTML: '', textContent: '', style: { setProperty() {} }, setAttribute() {},
      closest: () => ({ querySelector: () => ({ textContent: 'Chart' }) }), prepend() {},
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    ...metrics, URL, chart() {},
    document: { getElementById: node, createElement: () => ({}) },
    console: { error: (...args) => assert.fail(args.join(' ')) },
  });
  vm.runInContext(app + '\nthis.api = { externalLink, renderBaseline, render, source };', context);
  return { ...context.api, node };
}

test('Data links reject executable schemes, obfuscation and credentials', () => {
  const { externalLink } = fixture();
  for (const url of [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)',
    '\tjavascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)', '//evil.example/', '/relative', 'not a URL',
    'https://user:password@example.org/', null, undefined,
  ]) {
    assert.equal(externalLink(url, '<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  }
  assert.equal(externalLink('https://example.org/?a=1&b=2', 'A & B'),
    '<a href="https://example.org/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">A &amp; B ↗</a>');
  assert.match(externalLink('http://example.org/', 'Source'), /^<a href="http:/);
});

test('Benchmark source and licence URLs use the safe link renderer', () => {
  const { renderBaseline, source, node } = fixture();
  renderBaseline({ benchmarks: [{ rows: [], source: 'Publisher', license: 'Licence',
    source_url: 'javascript:alert(1)', license_url: 'data:text/html,<script>alert(1)</script>' }] });
  const html = node('baseline-cards').innerHTML;
  assert.ok(html.includes('Publisher') && html.includes('Licence'));
  assert.doesNotMatch(html, /href="(?:javascript:|data:)/i);
  source('test', { source: '<img src=x onerror=alert(1)>', source_url: 'javascript:alert(1)' });
  assert.doesNotMatch(node('test-source').innerHTML, /<img|href=/);
});

test('Regional period markup stays inert in rows and totals', () => {
  const { render, node } = fixture();
  const names = ['dashboard_history', 'macro', 'm2_history', 'manual', 'etf_flows',
    'technology', 'gold_buying', 'work_benchmarks', 'metr_context'];
  const data = names.map(name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url))));
  const latest = structuredClone(data[2].at(-1));
  latest.period = '2026-07-01<img src=x onerror=alert(1)>';
  delete latest.component_dates;
  data[2] = [latest];
  render(data);
  for (const id of ['region-rows', 'region-total']) {
    assert.ok(node(id).innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.doesNotMatch(node(id).innerHTML, /<img/);
  }
});
