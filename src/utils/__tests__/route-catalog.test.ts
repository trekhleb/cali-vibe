import { describe, it, expect } from "vitest";
import {
  pathToParams,
  paramsToPath,
  LAYERS,
  LAYER_PARAM_KEYS,
  TRANSIT_SYSTEM_SLUGS,
} from "../route-catalog";

const BASE = "/cali-vibe/";

describe("pathToParams", () => {
  it("returns null for root path", () => {
    expect(pathToParams("/cali-vibe/", BASE)).toBeNull();
    expect(pathToParams("/cali-vibe", BASE)).toBeNull();
  });

  it("parses single layer without metric", () => {
    const result = pathToParams("/cali-vibe/housing", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ housing: true });
  });

  it("parses single layer with metric", () => {
    const result = pathToParams("/cali-vibe/housing/rent", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ housing: true, hmetric: "rent" });
  });

  it("parses multi-layer path with +", () => {
    const result = pathToParams("/cali-vibe/housing+crime", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ housing: true, crime: true });
  });

  it("parses multi-layer with metrics", () => {
    const result = pathToParams("/cali-vibe/housing/rent+crime/violent", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({
      housing: true,
      hmetric: "rent",
      crime: true,
      ctype: "violentTotal",
    });
  });

  it("parses transit without system", () => {
    const result = pathToParams("/cali-vibe/transit", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ transit: true });
    expect(result!.transitSystem).toBeUndefined();
  });

  it("parses transit with system sub-route", () => {
    const result = pathToParams("/cali-vibe/transit/bart", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ transit: true });
    expect(result!.transitSystem).toBe("bart");
  });

  it("parses temperature metrics", () => {
    expect(pathToParams("/cali-vibe/temperature", BASE)!.layers).toEqual({ temp: true });
    expect(pathToParams("/cali-vibe/temperature/low", BASE)!.layers).toEqual({ temp: true, tmetric: "tmin" });
    expect(pathToParams("/cali-vibe/temperature/avg", BASE)!.layers).toEqual({ temp: true, tmetric: "tavg" });
  });

  it("parses education metrics", () => {
    expect(pathToParams("/cali-vibe/education", BASE)!.layers).toEqual({ edu: true });
    expect(pathToParams("/cali-vibe/education/hs", BASE)!.layers).toEqual({ edu: true, emetric: "hsPlus" });
    expect(pathToParams("/cali-vibe/education/grad", BASE)!.layers).toEqual({ edu: true, emetric: "gradPlus" });
  });

  it("parses age metrics", () => {
    expect(pathToParams("/cali-vibe/age/under18", BASE)!.layers).toEqual({ age: true, ametric: "under18" });
    expect(pathToParams("/cali-vibe/age/18-34", BASE)!.layers).toEqual({ age: true, ametric: "age18to34" });
    expect(pathToParams("/cali-vibe/age/65plus", BASE)!.layers).toEqual({ age: true, ametric: "age65plus" });
  });

  it("parses school points metrics", () => {
    expect(pathToParams("/cali-vibe/school-points", BASE)!.layers).toEqual({ schPts: true });
    expect(pathToParams("/cali-vibe/school-points/ela", BASE)!.layers).toEqual({ schPts: true, spcolor: "ela" });
  });

  it("parses terrain", () => {
    expect(pathToParams("/cali-vibe/terrain", BASE)!.layers).toEqual({ terrain3d: true });
  });

  it("handles trailing slash on path", () => {
    const result = pathToParams("/cali-vibe/housing/", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ housing: true });
  });

  it("returns null for unknown slugs", () => {
    expect(pathToParams("/cali-vibe/unknown", BASE)).toBeNull();
  });

  it("skips unknown slugs in multi-layer", () => {
    const result = pathToParams("/cali-vibe/unknown+housing", BASE);
    expect(result).not.toBeNull();
    expect(result!.layers).toEqual({ housing: true });
  });
});

describe("paramsToPath", () => {
  it("returns empty for no active layers", () => {
    const result = paramsToPath({});
    expect(result.path).toBe("");
  });

  it("builds single layer path", () => {
    const result = paramsToPath({ housing: true, hmetric: "homeValue" });
    expect(result.path).toBe("housing");
  });

  it("includes metric when non-default", () => {
    const result = paramsToPath({ housing: true, hmetric: "rent" });
    expect(result.path).toBe("housing/rent");
  });

  it("builds multi-layer path in canonical order", () => {
    // crime (priority 9) before education (priority 11)
    const result = paramsToPath({ edu: true, crime: true, ctype: "total", emetric: "bachPlus" });
    expect(result.path).toBe("crime+education");
  });

  it("includes metrics for each layer", () => {
    const result = paramsToPath({
      housing: true,
      hmetric: "rent",
      crime: true,
      ctype: "violentTotal",
    });
    expect(result.path).toBe("housing/rent+crime/violent");
  });

  it("handles transit with single system as sub-route", () => {
    const result = paramsToPath({ transit: true }, ["bart"]);
    expect(result.path).toBe("transit/bart");
    expect(result.transitInPath).toBe(true);
  });

  it("handles transit with default systems (no sub-route)", () => {
    const result = paramsToPath({ transit: true }, ["bart", "caltrain", "lametro"]);
    expect(result.path).toBe("transit");
    expect(result.transitInPath).toBe(false);
  });

  it("omits default metrics from path", () => {
    // "total" is default for crime
    const result = paramsToPath({ crime: true, ctype: "total" });
    expect(result.path).toBe("crime");
  });

  it("maintains canonical ordering regardless of input order", () => {
    const result = paramsToPath({
      transit: true,
      counties: true,
      housing: true,
      hmetric: "homeValue",
    });
    // counties (1) < housing (5) < transit (24)
    expect(result.path).toBe("counties+housing+transit");
  });
});

describe("LAYERS", () => {
  it("has unique slugs", () => {
    const slugs = LAYERS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique param keys", () => {
    const keys = LAYERS.map((l) => l.paramKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique priorities", () => {
    const priorities = LAYERS.map((l) => l.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("LAYER_PARAM_KEYS matches LAYERS", () => {
    expect(LAYER_PARAM_KEYS.size).toBe(LAYERS.length);
    for (const layer of LAYERS) {
      expect(LAYER_PARAM_KEYS.has(layer.paramKey)).toBe(true);
    }
  });
});

describe("round-trip: path → params → path", () => {
  const testCases = [
    "housing",
    "housing/rent",
    "crime/violent",
    "education/hs",
    "schools/math",
    "temperature/low",
    "age/18-34",
    "counties+housing",
    "housing/rent+crime/violent",
  ];

  for (const original of testCases) {
    it(`round-trips: ${original}`, () => {
      const parsed = pathToParams(`/cali-vibe/${original}`, BASE);
      expect(parsed).not.toBeNull();
      const { path } = paramsToPath(parsed!.layers);
      expect(path).toBe(original);
    });
  }
});
