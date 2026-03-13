const cache = new Map<string, Promise<unknown>>();

export function fetchJsonCached(url: string): Promise<unknown> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch((err) => {
      cache.delete(url);
      throw err;
    });
    cache.set(url, promise);
  }
  return promise;
}
