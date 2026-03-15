import { INITIAL_VIEW_STATE, MAP_STYLES, TERRAIN_SOURCE } from "@/components/map/map-config";

describe("map-config", () => {
  it("INITIAL_VIEW_STATE has correct shape", () => {
    expect(INITIAL_VIEW_STATE).toEqual({
      longitude: -119.5,
      latitude: 37.0,
      zoom: 5.5,
      pitch: 0,
    });
  });

  it("MAP_STYLES has all four style keys", () => {
    expect(Object.keys(MAP_STYLES)).toEqual(["liberty", "light", "dark", "satellite"]);
  });

  it("each style has label and style properties", () => {
    for (const [, value] of Object.entries(MAP_STYLES)) {
      expect(value).toHaveProperty("label");
      expect(value).toHaveProperty("style");
      expect(typeof value.label).toBe("string");
    }
  });

  it("dark and satellite styles are raster StyleSpecification objects", () => {
    const dark = MAP_STYLES.dark.style;
    const sat = MAP_STYLES.satellite.style;
    expect(typeof dark).toBe("object");
    expect(typeof sat).toBe("object");
    if (typeof dark === "object") {
      expect(dark.version).toBe(8);
      expect(dark.sources).toHaveProperty("basemap");
    }
  });

  it("TERRAIN_SOURCE has correct structure", () => {
    expect(TERRAIN_SOURCE.type).toBe("raster-dem");
    expect(TERRAIN_SOURCE.encoding).toBe("terrarium");
    expect(TERRAIN_SOURCE.tiles).toHaveLength(1);
  });
});
