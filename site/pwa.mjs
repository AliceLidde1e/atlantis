const scope = new URL('./', import.meta.url);
const catalogCache = 'atlantis:' + scope.pathname + ':catalog:v1';

export function registerPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('sw.js', scope), {updateViaCache: 'none'})
      .catch(error => console.warn('ATLANTIS offline setup failed', error));
  }
}

async function readJson(response, isValid) {
  if (!response?.ok) throw new Error('Data unavailable');
  const data = await response.clone().json();
  if (!isValid(data)) throw new Error('Incomplete data');
  return data;
}

export async function loadCatalogFile(file, isValid) {
  const url = new URL(file, scope);
  const cache = await globalThis.caches?.open(catalogCache).catch(() => null);
  if (navigator.onLine) {
    try {
      const response = await fetch(url, {cache: 'no-store'});
      const data = await readJson(response, isValid);
      // Storage pressure must not prevent normal online use.
      await cache?.put(url, response).catch(() => {});
      return data;
    } catch {
      // Keep the last complete response when the network or server fails.
    }
  }
  return readJson(await cache?.match(url), isValid);
}
