import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const events = {}, cached = [], removed = [];
let offline = false;
const fallback = new Response('offline');
const context = {
  URL, Response,
  self: { location: { origin: 'https://hoopslab.test' }, clients: { claim: async () => {} }, addEventListener: (name, fn) => { events[name] = fn; } },
  caches: {
    open: async () => ({ add: async path => cached.push(path), match: async path => path === '/offline.html' ? fallback : undefined }),
    keys: async () => ['hoopslab-offline-v0', 'unrelated-cache', 'hoopslab-offline-v1'],
    delete: async key => removed.push(key),
  },
  fetch: async () => { if (offline) throw new Error('offline'); return new Response('live'); },
};
vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
let work;
events.install({ waitUntil: task => { work = task; } }); await work;
assert.deepEqual(cached, ['/offline.html']);
events.activate({ waitUntil: task => { work = task; } }); await work;
assert.deepEqual(removed, ['hoopslab-offline-v0']);
async function request(overrides = {}) {
  let response;
  events.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://hoopslab.test/player', ...overrides }, respondWith: task => { response = task; } });
  return response ? await response : undefined;
}
assert.equal(await (await request()).text(), 'live');
offline = true;
assert.equal(await request(), fallback);
assert.equal(await request({ method: 'POST' }), undefined);
assert.equal(await request({ mode: 'cors' }), undefined);
assert.equal(await request({ url: 'https://youtube.com/video' }), undefined);
assert.deepEqual(cached, ['/offline.html']);

const mod = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync(new URL('../app/manifest.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
new Function('exports', outputText)(mod.exports);
const manifest = mod.exports.default();
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
for (const icon of manifest.icons) {
  const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
console.log('PASS: manifest/icons, network-only private pages, offline navigation, no mutation/API caching, scoped cache cleanup');
