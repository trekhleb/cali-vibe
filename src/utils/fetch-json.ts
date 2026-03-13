const cache = new Map<string, Promise<unknown>>();

export function fetchJsonCached(url: string): Promise<unknown> {
  let promise = cache.get(url);
  if (!promise) {
    promise = fetch(url).then((r) => r.json());
    cache.set(url, promise);
  }
  return promise;
}
