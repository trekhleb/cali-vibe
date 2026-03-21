/**
 * Pure utility functions for offsetting overlapping transit routes.
 *
 * Shared between the build script (scripts/build-transit-bart.mjs) and tests.
 * If you modify these, update the build script copies too.
 */

/** Reverse coordinates so the route goes generally west→east (or S→N). */
export function normalizeDirection(coords: number[][]): number[][] {
  const start = coords[0];
  const end = coords[coords.length - 1];
  const dLng = end[0] - start[0];
  const dLat = end[1] - start[1];
  if (dLng < -0.01 || (Math.abs(dLng) <= 0.01 && dLat < -0.01)) {
    return [...coords].reverse();
  }
  return coords;
}

export interface Perp {
  px: number;
  py: number;
}

/**
 * Compute perpendicular unit vectors along a route, propagating direction
 * sequentially so curves never cause a sudden flip.
 */
export function computePerps(coords: number[][]): Perp[] {
  const perps: Perp[] = [];
  for (let p = 0; p < coords.length; p++) {
    const prev = coords[Math.max(0, p - 1)];
    const next = coords[Math.min(coords.length - 1, p + 1)];
    const [, lat] = coords[p];
    const cosLat = Math.cos(lat * (Math.PI / 180));
    const tx = (next[0] - prev[0]) * cosLat;
    const ty = next[1] - prev[1];
    const len = Math.sqrt(tx * tx + ty * ty);

    if (len < 1e-10) {
      perps.push(p > 0 ? perps[p - 1] : { px: 0, py: 1 });
      continue;
    }

    let px = -ty / len;
    let py = tx / len;

    if (p > 0) {
      const dot = px * perps[p - 1].px + py * perps[p - 1].py;
      if (dot < 0) {
        px = -px;
        py = -py;
      }
    } else {
      if (py < -0.01 || (Math.abs(py) <= 0.01 && px < 0)) {
        px = -px;
        py = -py;
      }
    }

    perps.push({ px, py });
  }
  return perps;
}

/** Grid cell key for overlap detection. */
export function oGridKey(lng: number, lat: number, gridDeg: number): string {
  return `${Math.round(lng / gridDeg)},${Math.round(lat / gridDeg)}`;
}

/** 3×3 neighbor keys around a grid cell. */
export function oGridNeighborKeys(lng: number, lat: number, gridDeg: number): string[] {
  const gx = Math.round(lng / gridDeg);
  const gy = Math.round(lat / gridDeg);
  const keys: string[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      keys.push(`${gx + dx},${gy + dy}`);
    }
  }
  return keys;
}

/**
 * Majority-vote sign stabilizer: for each non-zero offset, adopt the sign
 * that the majority of neighbors within the window share.
 */
export function stabilizeSigns(arr: number[], windowSize: number): number[] {
  const result = new Array(arr.length);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) {
      result[i] = 0;
      continue;
    }
    let pos = 0,
      neg = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      if (arr[j] > 0) pos++;
      else if (arr[j] < 0) neg++;
    }
    result[i] = pos >= neg ? Math.abs(arr[i]) : -Math.abs(arr[i]);
  }
  return result;
}

/** Simple moving-average smoother. */
export function smoothOffsets(arr: number[], windowSize: number): number[] {
  const result = new Array(arr.length);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(arr.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      sum += arr[j];
      count++;
    }
    result[i] = sum / count;
  }
  return result;
}
