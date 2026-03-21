import {
  normalizeDirection,
  computePerps,
  oGridKey,
  oGridNeighborKeys,
  stabilizeSigns,
  smoothOffsets,
} from "@/utils/transit-offset";

describe("normalizeDirection", () => {
  it("keeps coords that already go west→east", () => {
    const coords = [[-122.4, 37.8], [-122.3, 37.7], [-122.2, 37.6]];
    const result = normalizeDirection(coords);
    expect(result).toEqual(coords);
  });

  it("reverses coords that go east→west", () => {
    const coords = [[-122.0, 37.6], [-122.2, 37.7], [-122.4, 37.8]];
    const result = normalizeDirection(coords);
    expect(result[0]).toEqual([-122.4, 37.8]);
    expect(result[result.length - 1]).toEqual([-122.0, 37.6]);
  });

  it("reverses coords that go north→south when longitude is similar", () => {
    // dLng ≈ 0, dLat < 0 → should reverse
    const coords = [[-122.3, 37.9], [-122.3, 37.8], [-122.3, 37.7]];
    const result = normalizeDirection(coords);
    expect(result[0]).toEqual([-122.3, 37.7]);
    expect(result[result.length - 1]).toEqual([-122.3, 37.9]);
  });

  it("keeps coords that go south→north when longitude is similar", () => {
    const coords = [[-122.3, 37.7], [-122.3, 37.8], [-122.3, 37.9]];
    const result = normalizeDirection(coords);
    expect(result).toEqual(coords);
  });

  it("handles single-point coords", () => {
    const coords = [[-122.4, 37.8]];
    const result = normalizeDirection(coords);
    expect(result).toEqual(coords);
  });

  it("handles two-point coords", () => {
    const coords = [[-122.0, 37.8], [-122.4, 37.8]];
    const result = normalizeDirection(coords);
    // Goes east→west, should reverse
    expect(result[0]).toEqual([-122.4, 37.8]);
  });

  it("does not reverse when dLng is small positive (barely east)", () => {
    const coords = [[-122.305, 37.6], [-122.3, 37.9]];
    const result = normalizeDirection(coords);
    // dLng = 0.005 (within ±0.01 threshold), dLat > 0 → keeps
    expect(result).toEqual(coords);
  });
});

describe("computePerps", () => {
  it("returns perpendiculars for each point", () => {
    const coords = [[-122.4, 37.8], [-122.3, 37.8], [-122.2, 37.8]];
    const perps = computePerps(coords);
    expect(perps).toHaveLength(3);
    for (const p of perps) {
      expect(p).toHaveProperty("px");
      expect(p).toHaveProperty("py");
    }
  });

  it("produces unit-length perpendiculars", () => {
    const coords = [[-122.4, 37.8], [-122.3, 37.8], [-122.2, 37.8]];
    const perps = computePerps(coords);
    for (const p of perps) {
      const len = Math.sqrt(p.px * p.px + p.py * p.py);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it("perpendiculars are orthogonal to tangent for straight east-west line", () => {
    // Points going east at constant latitude → tangent is (1, 0)
    // perpendicular should be (0, ±1)
    const coords = [[-122.4, 37.8], [-122.3, 37.8], [-122.2, 37.8]];
    const perps = computePerps(coords);
    for (const p of perps) {
      // px should be ~0 (no east-west component in perpendicular)
      expect(Math.abs(p.px)).toBeLessThan(0.01);
      // py should be ~±1
      expect(Math.abs(p.py)).toBeCloseTo(1, 1);
    }
  });

  it("maintains consistent direction along a curve (no sudden flips)", () => {
    // Quarter-circle curve
    const coords: number[][] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * (Math.PI / 2);
      coords.push([-122 + Math.cos(angle) * 0.1, 37.8 + Math.sin(angle) * 0.1]);
    }
    const perps = computePerps(coords);

    // Check consecutive perpendiculars have positive dot product (same direction)
    for (let i = 1; i < perps.length; i++) {
      const dot = perps[i].px * perps[i - 1].px + perps[i].py * perps[i - 1].py;
      expect(dot).toBeGreaterThan(0);
    }
  });

  it("handles duplicate points (zero-length segments)", () => {
    const coords = [[-122.4, 37.8], [-122.4, 37.8], [-122.3, 37.8]];
    const perps = computePerps(coords);
    expect(perps).toHaveLength(3);
    // First two points are the same; should use fallback
    const len0 = Math.sqrt(perps[0].px ** 2 + perps[0].py ** 2);
    expect(len0).toBeCloseTo(1, 5);
  });

  it("handles single point", () => {
    const coords = [[-122.4, 37.8]];
    const perps = computePerps(coords);
    expect(perps).toHaveLength(1);
  });
});

describe("oGridKey", () => {
  const gridDeg = 0.001;

  it("returns a comma-separated string of grid coordinates", () => {
    const key = oGridKey(-122.4, 37.8, gridDeg);
    expect(key).toMatch(/^-?\d+,-?\d+$/);
  });

  it("nearby points in same cell get same key", () => {
    const k1 = oGridKey(-122.4001, 37.8001, gridDeg);
    const k2 = oGridKey(-122.4002, 37.8002, gridDeg);
    expect(k1).toBe(k2);
  });

  it("distant points get different keys", () => {
    const k1 = oGridKey(-122.4, 37.8, gridDeg);
    const k2 = oGridKey(-122.5, 37.9, gridDeg);
    expect(k1).not.toBe(k2);
  });
});

describe("oGridNeighborKeys", () => {
  const gridDeg = 0.001;

  it("returns 9 keys (3×3 neighborhood)", () => {
    const keys = oGridNeighborKeys(-122.4, 37.8, gridDeg);
    expect(keys).toHaveLength(9);
  });

  it("includes the center cell", () => {
    const center = oGridKey(-122.4, 37.8, gridDeg);
    const keys = oGridNeighborKeys(-122.4, 37.8, gridDeg);
    expect(keys).toContain(center);
  });

  it("all keys are unique", () => {
    const keys = oGridNeighborKeys(-122.4, 37.8, gridDeg);
    expect(new Set(keys).size).toBe(9);
  });
});

describe("stabilizeSigns", () => {
  it("preserves zeros", () => {
    const result = stabilizeSigns([0, 0, 0], 4);
    expect(result).toEqual([0, 0, 0]);
  });

  it("preserves consistent positive signs", () => {
    const result = stabilizeSigns([75, 75, 75, 75, 75], 4);
    expect(result).toEqual([75, 75, 75, 75, 75]);
  });

  it("preserves consistent negative signs", () => {
    const result = stabilizeSigns([-75, -75, -75, -75, -75], 4);
    expect(result).toEqual([-75, -75, -75, -75, -75]);
  });

  it("corrects isolated sign flip in positive region", () => {
    //                 ↓ isolated flip
    const input = [75, 75, -75, 75, 75];
    const result = stabilizeSigns(input, 4);
    // Majority in window around index 2 is positive → should flip to +75
    expect(result[2]).toBe(75);
  });

  it("corrects isolated sign flip in negative region", () => {
    const input = [-75, -75, 75, -75, -75];
    const result = stabilizeSigns(input, 4);
    expect(result[2]).toBe(-75);
  });

  it("does not change values at a genuine sign boundary", () => {
    // Half positive, half negative — the transition should be preserved
    const input = [75, 75, 75, -75, -75, -75];
    const result = stabilizeSigns(input, 4);
    // The first three should stay positive, last three negative
    expect(result[0]).toBe(75);
    expect(result[result.length - 1]).toBe(-75);
  });

  it("preserves magnitudes while fixing signs", () => {
    const input = [100, 100, -50, 100, 100];
    const result = stabilizeSigns(input, 4);
    // Magnitude at index 2 should be 50, but sign corrected to positive
    expect(result[2]).toBe(50);
  });

  it("handles single element", () => {
    expect(stabilizeSigns([75], 4)).toEqual([75]);
    expect(stabilizeSigns([-75], 4)).toEqual([-75]);
    expect(stabilizeSigns([0], 4)).toEqual([0]);
  });

  it("handles mixed zeros and values", () => {
    const input = [0, 75, 0, -75, 0];
    const result = stabilizeSigns(input, 2);
    expect(result[0]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[4]).toBe(0);
  });
});

describe("smoothOffsets", () => {
  it("returns same length array", () => {
    const result = smoothOffsets([1, 2, 3, 4, 5], 3);
    expect(result).toHaveLength(5);
  });

  it("does not change a constant array", () => {
    const result = smoothOffsets([5, 5, 5, 5, 5], 3);
    for (const v of result) {
      expect(v).toBeCloseTo(5);
    }
  });

  it("smooths a step function", () => {
    const input = [0, 0, 0, 0, 0, 100, 100, 100, 100, 100];
    const result = smoothOffsets(input, 4);

    // Values before the step should be < 100
    expect(result[3]).toBeLessThan(100);
    // Values after the step should be > 0
    expect(result[6]).toBeGreaterThan(0);
    // Far from the step, values should be close to original
    expect(result[0]).toBeCloseTo(0, 0);
    expect(result[9]).toBeCloseTo(100, 0);
  });

  it("produces symmetric output for symmetric input", () => {
    const input = [0, 0, 0, 100, 0, 0, 0];
    const result = smoothOffsets(input, 4);
    // Should be symmetric around index 3
    expect(result[2]).toBeCloseTo(result[4], 5);
    expect(result[1]).toBeCloseTo(result[5], 5);
    expect(result[0]).toBeCloseTo(result[6], 5);
  });

  it("handles window size 1 (no smoothing)", () => {
    const input = [0, 100, 0];
    const result = smoothOffsets(input, 1);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(100);
    expect(result[2]).toBeCloseTo(0);
  });

  it("handles single element", () => {
    expect(smoothOffsets([42], 5)).toEqual([42]);
  });

  it("handles all-zero input", () => {
    const result = smoothOffsets([0, 0, 0], 3);
    expect(result).toEqual([0, 0, 0]);
  });

  it("multi-pass smoothing produces smoother result than single pass", () => {
    const input = [0, 0, 0, 0, 0, 100, 100, 100, 100, 100];

    const singlePass = smoothOffsets(input, 4);
    let multiPass = [...input];
    for (let i = 0; i < 3; i++) {
      multiPass = smoothOffsets(multiPass, 4);
    }

    // At the transition point, multi-pass should have a gentler slope
    // Check that the derivative (difference between consecutive points)
    // is smaller for multi-pass
    const singleMaxDiff = Math.max(
      ...singlePass.slice(1).map((v, i) => Math.abs(v - singlePass[i])),
    );
    const multiMaxDiff = Math.max(
      ...multiPass.slice(1).map((v, i) => Math.abs(v - multiPass[i])),
    );

    expect(multiMaxDiff).toBeLessThan(singleMaxDiff);
  });
});
