import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../src/sw.js', import.meta.url), 'utf8');
const currentCache = code.match(/const CACHE_NAME\s*=\s*'([^']+)'/)[1];
function worker(overrides = {}) {
  const handlers = {};
  const deleted = [];
  let claimed = false;
  const cache = { match: async () => undefined, put: async () => {}, addAll: async () => {} };
  const context = {
    URL, Response,
    self: {
      registration: { scope: 'https://example.org/macro-dashboard/src/' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: () => {}, clients: { claim: () => { claimed = true; } },
    },
    caches: {
      keys: async () => ['macro-dashboard-v1', currentCache, 'liquidity-monitor-v100'],
      delete: async key => deleted.push(key), open: async () => cache,
    },
    fetch: async () => { throw new Error('Offline'); },
    ...overrides,
  };
  vm.runInNewContext(code, context);
  return { handlers, deleted, cache, claimed: () => claimed };
}

test('Cache cleanup preserves sibling dashboards on the same origin', async () => {
  const w = worker();
  let activation;
  w.handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(w.deleted, ['macro-dashboard-v1']);
  assert.equal(w.claimed(), true);
});

test('Worker ignores external URLs, sibling apps and mutations', () => {
  const w = worker();
  for (const [url, method] of [
    ['https://other.org/data.json', 'GET'],
    ['https://example.org/liquidity-monitor/data.json', 'GET'],
    ['https://example.org/macro-dashboard/data.json', 'POST'],
  ]) {
    w.handlers.fetch({ request: { url, method }, respondWith: () => assert.fail('Request intercepted') });
  }
});

test('Offline data cache miss returns a valid 503, while navigation can use the shell', async () => {
  const w = worker();
  let response;
  const event = { request: { url: 'https://example.org/macro-dashboard/data/example.json', method: 'GET' }, waitUntil: () => {}, respondWith: promise => { response = promise; } };
  w.handlers.fetch(event);
  assert.equal((await response).status, 503);
  w.cache.match = async request => String(request).endsWith('/src/index.html') ? new Response('<html>offline shell</html>') : undefined;
  w.handlers.fetch({ ...event, request: { url: 'https://example.org/macro-dashboard/src/', method: 'GET', mode: 'navigate' } });
  assert.match(await (await response).text(), /offline shell/);
});

test('Successful responses remain available when cache storage fails', async () => {
  const w = worker({ fetch: async () => new Response('{"fresh":true}') });
  w.cache.put = async () => { throw new Error('Storage full'); };
  let response, saving;
  w.handlers.fetch({ request: { url: 'https://example.org/macro-dashboard/data/example.json', method: 'GET' }, waitUntil: promise => { saving = promise; }, respondWith: promise => { response = promise; } });
  assert.deepEqual(await (await response).json(), { fresh: true });
  await saving;
});
