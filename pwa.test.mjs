import assert from 'node:assert/strict';
import {loadCatalogFile} from './site/pwa.mjs';

const catalog = 'data/cards.json';
const good = {cards: ['Lightning Bolt']};
const isComplete = data => data?.cards?.length === 1;
const cached = new Map();
const storage = {
  async match(url) { return cached.get(url.href)?.clone(); },
  async put(url, response) { cached.set(url.href, response.clone()); },
};
const navigatorState = {onLine: true};
Object.defineProperty(globalThis, 'navigator', {value: navigatorState, configurable: true});
globalThis.caches = {async open() { return storage; }};

let requests = 0;
globalThis.fetch = async () => {
  requests++;
  return Response.json(good);
};
assert.deepEqual(await loadCatalogFile(catalog, isComplete), good);
assert.equal(requests, 1);
assert.equal(cached.size, 1);

navigatorState.onLine = false;
assert.deepEqual(await loadCatalogFile(catalog, isComplete), good);
assert.equal(requests, 1);
await assert.rejects(loadCatalogFile('data/decks.json', Array.isArray), /Data unavailable/);

navigatorState.onLine = true;
globalThis.fetch = async () => Response.json({cards: []});
assert.deepEqual(await loadCatalogFile(catalog, isComplete), good);
globalThis.fetch = async () => { throw new TypeError('Network error'); };
assert.deepEqual(await loadCatalogFile(catalog, isComplete), good);

globalThis.caches.open = async () => { throw new Error('Storage unavailable'); };
globalThis.fetch = async () => Response.json(good);
assert.deepEqual(await loadCatalogFile(catalog, isComplete), good);

console.log('PWA catalog cache: online, offline, incomplete response, network and storage failures OK');
