import { renderHook, act } from "@testing-library/react";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import { useMap } from "react-map-gl/maplibre";
import { fetchJsonCached } from "@/utils/fetch-json";

vi.mock("react-map-gl/maplibre", () => ({
  useMap: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({
  default: "mocked",
  LngLatBounds: class LngLatBounds {
    extend = vi.fn();
    isEmpty = vi.fn().mockReturnValue(false);
  }
}));

vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn(),
}));

describe("useMapInteraction", () => {
  let mockMap: any;
  let mapEventHandlers: Record<string, Function>;

  beforeEach(() => {
    mapEventHandlers = {};
    mockMap = {
      queryRenderedFeatures: vi.fn().mockReturnValue([]),
      querySourceFeatures: vi.fn().mockReturnValue([]),
      setFeatureState: vi.fn(),
      getCanvas: vi.fn().mockReturnValue({ style: {} }),
      on: vi.fn((event, layerId, handler) => {
        if (typeof layerId === "function") {
          mapEventHandlers[event] = layerId;
        } else {
          mapEventHandlers[`${event}-${layerId}`] = handler;
        }
      }),
      off: vi.fn(),
      fitBounds: vi.fn(),
    };

    (useMap as ReturnType<typeof vi.fn>).mockReturnValue({
      current: { getMap: () => mockMap },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handles mouse hover interactions", () => {
    const { result } = renderHook(() => useMapInteraction("source1", "layer1"));

    // Mouse move without features
    mockMap.queryRenderedFeatures.mockReturnValue([]);
    act(() => {
      mapEventHandlers["mousemove-layer1"]({ point: { x: 0, y: 0 } });
    });
    expect(result.current.activeName).toBeNull();
    expect(result.current.activeProperties).toBeNull();

    // Mouse move with feature
    mockMap.queryRenderedFeatures.mockReturnValue([
      { id: 1, properties: { name: "Hovered Area", prop1: "val1" } }
    ]);
    act(() => {
      mapEventHandlers["mousemove-layer1"]({ point: { x: 10, y: 10 } });
    });
    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 1 }, { hover: true });
    expect(result.current.activeName).toBe("Hovered Area");
    expect(result.current.activeProperties).toEqual({ name: "Hovered Area", prop1: "val1" });

    // Mouse leave
    act(() => {
      mapEventHandlers["mouseleave-layer1"]();
    });
    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 1 }, { hover: false });
    expect(result.current.activeName).toBeNull();
  });

  it("handles mouse click interactions", () => {
    const { result } = renderHook(() => useMapInteraction("source1", "layer1"));

    // Click on feature
    mockMap.queryRenderedFeatures.mockReturnValue([
      { id: 2, properties: { name: "Clicked Area", prop2: "val2" } }
    ]);
    act(() => {
      mapEventHandlers["click-layer1"]({ point: { x: 20, y: 20 } });
    });
    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 2 }, { selected: true });
    expect(result.current.activeName).toBe("Clicked Area");
    expect(result.current.activeProperties).toEqual({ name: "Clicked Area", prop2: "val2" });

    // Click same feature again deselects
    act(() => {
      mapEventHandlers["click-layer1"]({ point: { x: 20, y: 20 } });
    });
    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 2 }, { selected: false });
    expect(result.current.activeName).toBeNull();
  });

  it("handles programmatic selection and flies to bounds", async () => {
    const mockJson = {
      features: [
        {
          properties: { name: "Target Area" },
          geometry: {
            type: "Polygon",
            coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]]
          }
        },
        {
          properties: { name: "Target Area Multi" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [[[[0, 0], [1, 1], [0, 1], [0, 0]]]]
          }
        }
      ]
    };
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockResolvedValue(mockJson);

    // Ensure querySourceFeatures returns empty so trySelect waits
    mockMap.querySourceFeatures.mockReturnValue([]);

    const { unmount } = renderHook(() => useMapInteraction("source1", "layer1", {
      selectName: "Target Area",
      geojsonUrl: "dummy.json"
    }));

    // it should initially set up idle & sourcedata
    expect(mockMap.on).toHaveBeenCalledWith("idle", expect.any(Function));
    expect(mockMap.on).toHaveBeenCalledWith("sourcedata", expect.any(Function));

    // Wait for promise resolution
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    expect(fetchJsonCached).toHaveBeenCalledWith("dummy.json");
    expect(mockMap.fitBounds).toHaveBeenCalled();

    // Now Mock feature loaded
    mockMap.querySourceFeatures.mockReturnValue([{ id: 42 }]);

    // Trigger idle
    act(() => {
      mapEventHandlers["idle"]();
    });

    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 42 }, { selected: true });

    unmount();
  });

  it("cleans up active state on unmount", () => {
    const { unmount } = renderHook(() => useMapInteraction("source1", "layer1"));
    
    // Select something first
    mockMap.queryRenderedFeatures.mockReturnValue([{ id: 2 }]);
    act(() => {
      mapEventHandlers["click-layer1"]({ point: { x: 20, y: 20 } });
    });

    unmount();
    
    // Should call setFeatureState selected=false
    expect(mockMap.setFeatureState).toHaveBeenCalledWith({ source: "source1", id: 2 }, { selected: false });
  });
});

