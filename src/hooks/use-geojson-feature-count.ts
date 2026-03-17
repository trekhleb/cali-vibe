import { useEffect, useState } from "react";

/**
 * Fetches a GeoJSON file and returns its feature count.
 * Returns null while loading or on error.
 */
export function useGeoJsonFeatureCount(url: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCount(null);
    if (!url) return;
    fetch(url)
      .then((r) => r.json())
      .then((gj) => {
        if (!cancelled) setCount(gj.features?.length ?? null);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => { cancelled = true; };
  }, [url]);

  return count;
}
