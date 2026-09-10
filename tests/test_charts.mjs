import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { axisValues, axisPosition, seriesValueText } from '../src/charts.js';
import { eciHumanContext, estimatedExpertFrontier, expertDurationScale } from '../src/metrics.js';

test('ECI and expert-minutes use independent domains and their own tooltip units', () => {
  const eci = { points: [{ value: 150, low: 145, high: 155 }], format: n => `${n} ECI` };
  const time = { axis: 'right', points: [{ value: 2040 }], format: n => `≈${n / 60} h` };
  assert.deepEqual(axisValues([eci, time]), [150, 145, 155]);
  assert.deepEqual(axisValues([eci, time], 'right'), [2040]);
  assert.equal(seriesValueText(2040, time, { format: n => `${n} ECI` }), '≈34 h');
  assert.equal(seriesValueText(150, eci), '150 ECI');
  assert.equal(axisPosition(150, [100, 200], 0, 200), 100);
  assert.ok(Math.abs(axisPosition(60, [15, 240], 0, 200, true) - 100) < 1e-10);
  assert.notEqual(axisPosition(60, [15, 240], 0, 200), 100);
});

test('The time frontier is a derived line, with no borrowed ECI uncertainty or substituted METR points', () => {
  const eci = JSON.parse(readFileSync(new URL('../data/technology.json', import.meta.url))).eci;
  const metr = JSON.parse(readFileSync(new URL('../data/metr_context.json', import.meta.url)));
  const human = eciHumanContext(eci, metr);
  const times = estimatedExpertFrontier(eci, human);
  const gpt5 = times.find(p => p.label === 'GPT-5');
  assert.equal(gpt5.estimateKind, 'illustration');
  assert.notEqual(gpt5.value, human.matches.find(m => m.label === 'GPT-5').minutes);
  const latest = times.at(-1);
  assert.equal(latest.label, 'GPT-6 Astra');
  assert.equal(latest.estimateKind, 'extrapolation');
  assert.ok(Math.abs(latest.value / 60 - 34.04383779163984) < 1e-10);
  assert.ok(times.every(p => !('low' in p) && !('high' in p) && p.value > 0));
  assert.deepEqual(estimatedExpertFrontier(eci, eciHumanContext(eci, null)), []);
});

test('Log time scale includes the complete derived frontier and expands for later data', () => {
  const current = expertDurationScale([{ value: 7.25 }, { value: 2042.63 }]);
  assert.deepEqual(current.domain, [5, 3840]);
  assert.deepEqual(current.ticks, [5, 15, 60, 240, 960, 3840]);
  const expanded = expertDurationScale([{ value: 1 }, { value: 20000 }]);
  assert.ok(expanded.domain[0] <= 1 && expanded.domain[1] >= 20000);
  assert.equal(expertDurationScale([]), null);
});
