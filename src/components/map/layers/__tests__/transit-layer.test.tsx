import { render, screen, act } from "@testing-library/react";
import TransitLayer, {
  TRANSIT_SYSTEMS,
  BART_LINES,
  type TransitSystem,
} from "@/components/map/layers/transit-layer";
import { useMap } from "react-map-gl/maplibre";
import { fetchJsonCached } from "@/utils/fetch-json";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => (
    <div data-testid={`Source-${id}`}>{children}</div>
  ),
  Layer: ({ id, filter }: any) => (
    <div data-testid={`Layer-${id}`} data-filter={filter ? JSON.stringify(filter) : undefined} />
  ),
  useMap: vi.fn(),
}));

vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn(),
}));

// fitBounds effect iterates f.geometry.coordinates expecting [lng, lat] pairs
const mockRoutesGeoJSON = {
  features: [
    {
      geometry: {
        type: "LineString",
        coordinates: [[-122.4, 37.8], [-122.3, 37.7]] as [number, number][],
      },
      properties: { routeId: "1", name: "Red Line", color: "#FF0000", system: "bart" },
    },
    {
      geometry: {
        type: "LineString",
        coordinates: [[-122.4, 37.8], [-122.2, 37.6]] as [number, number][],
      },
      properties: { routeId: "2", name: "Orange Line", color: "#FF9933", system: "bart" },
    },
  ],
};

const mockStopsGeoJSON = {
  features: [
    {
      geometry: { type: "Point", coordinates: [-122.4, 37.8] },
      properties: {
        name: "Embarcadero",
        stopId: "EMBR",
        system: "bart",
        routes: ["1", "2"],
        colors: ["#FF0000", "#FF9933"],
      },
    },
    {
      geometry: { type: "Point", coordinates: [-122.3, 37.7] },
      properties: {
        name: "Richmond",
        stopId: "RICH",
        system: "bart",
        routes: ["1"],
        colors: ["#FF0000"],
      },
    },
  ],
};

describe("TransitLayer", () => {
  let mockMap: any;

  beforeEach(() => {
    mockMap = {
      queryRenderedFeatures: vi.fn().mockReturnValue([]),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getCanvas: vi.fn(() => ({ style: {} })),
    };
    (useMap as ReturnType<typeof vi.fn>).mockReturnValue({ current: mockMap });
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockResolvedValue(mockRoutesGeoJSON);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Exports ──

  it("exports TRANSIT_SYSTEMS with bart", () => {
    expect(TRANSIT_SYSTEMS).toEqual([{ id: "bart", label: "BART" }]);
  });

  it("exports BART_LINES with 6 lines and correct colors", () => {
    expect(BART_LINES).toHaveLength(6);
    const colors = BART_LINES.map((l) => l.color);
    expect(colors).toContain("#FF0000");
    expect(colors).toContain("#FF9933");
    expect(colors).toContain("#FFFF33");
    expect(colors).toContain("#339933");
    expect(colors).toContain("#0099CC");
    expect(colors).toContain("#B0BEC7");
  });

  it("every BART_LINES entry has a non-empty label", () => {
    for (const line of BART_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  // ── Rendering ──

  it("renders sources and layers when system is provided", () => {
    render(<TransitLayer systems={["bart"]} />);
    expect(screen.getByTestId("Source-transit-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-stops-highlight")).toBeInTheDocument();
  });

  it("renders nothing when systems array is empty", () => {
    const { container } = render(<TransitLayer systems={[]} />);
    expect(container.innerHTML).toBe("");
  });

  // ── Route filter ──

  it("applies no route filter when activeRouteColors is null", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={null} />);
    const casingLayer = screen.getByTestId("Layer-transit-routes-line-casing");
    const routeLayer = screen.getByTestId("Layer-transit-routes-line");
    expect(casingLayer).not.toHaveAttribute("data-filter");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("applies route filter when activeRouteColors is provided", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={["#FF0000"]} />);
    const casingLayer = screen.getByTestId("Layer-transit-routes-line-casing");
    const routeLayer = screen.getByTestId("Layer-transit-routes-line");

    const expectedFilter = JSON.stringify(["in", ["get", "color"], ["literal", ["#FF0000"]]]);
    expect(casingLayer).toHaveAttribute("data-filter", expectedFilter);
    expect(routeLayer).toHaveAttribute("data-filter", expectedFilter);
  });

  it("applies route filter with multiple colors", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={["#FF0000", "#339933"]} />);
    const routeLayer = screen.getByTestId("Layer-transit-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("in");
    expect(filter[2]).toEqual(["literal", ["#FF0000", "#339933"]]);
  });

  // ── Stop filter ──

  it("applies no stop filter when activeRouteColors is null", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={null} />);
    const stopsLayer = screen.getByTestId("Layer-transit-stops-circle");
    const labelsLayer = screen.getByTestId("Layer-transit-stops-label");
    expect(stopsLayer).not.toHaveAttribute("data-filter");
    expect(labelsLayer).not.toHaveAttribute("data-filter");
  });

  it("applies stop filter when activeRouteColors is provided", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={["#FF0000"]} />);
    const stopsLayer = screen.getByTestId("Layer-transit-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#FF0000", ["to-string", ["get", "colors"]]]);
  });

  it("stop filter includes all active colors", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={["#FF0000", "#FF9933"]} />);
    const stopsLayer = screen.getByTestId("Layer-transit-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter).toHaveLength(3); // ["any", condition1, condition2]
  });

  it("highlight layer uses its own filter, not the stop filter", () => {
    render(<TransitLayer systems={["bart"]} activeRouteColors={["#FF0000"]} />);
    const highlightLayer = screen.getByTestId("Layer-transit-stops-highlight");
    // Highlight has its own filter (for selected stop name), not the color-based stopFilter
    const filter = JSON.parse(highlightLayer.getAttribute("data-filter")!);
    // Should be the highlight filter ["==", ["get", "name"], ""], not ["any", ...]
    expect(filter[0]).toBe("==");
  });

  // ── Hover interaction ──

  it("shows tooltip on hover over a stop", () => {
    render(<TransitLayer systems={["bart"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Embarcadero",
        colors: JSON.stringify(["#FF0000", "#FF9933"]),
        system: "bart",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Embarcadero")).toBeInTheDocument();
    expect(screen.getByText("BART")).toBeInTheDocument();
  });

  it("hides tooltip when hovering away from stops", () => {
    render(<TransitLayer systems={["bart"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    // First hover over a stop
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Embarcadero",
        colors: JSON.stringify(["#FF0000"]),
        system: "bart",
      },
    }]);
    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });
    expect(screen.getByText("Embarcadero")).toBeInTheDocument();

    // Then hover away
    mockMap.queryRenderedFeatures.mockReturnValue([]);
    act(() => {
      onMouseMove({ target: mockMap, point: { x: 200, y: 200 } });
    });
    expect(screen.queryByText("Embarcadero")).not.toBeInTheDocument();
  });

  // ── Click interaction ──

  it("calls onSelectStop when clicking a stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["bart"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Richmond",
        colors: JSON.stringify(["#FF0000"]),
        system: "bart",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Richmond");
  });

  it("calls onDeselectStop when clicking empty space", () => {
    const onDeselectStop = vi.fn();
    render(<TransitLayer systems={["bart"]} onDeselectStop={onDeselectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];
    mockMap.queryRenderedFeatures.mockReturnValue([]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onDeselectStop).toHaveBeenCalled();
  });

  it("deselects when clicking the already-selected stop", () => {
    const onDeselectStop = vi.fn();
    render(
      <TransitLayer systems={["bart"]} selectedStopName="Richmond" onDeselectStop={onDeselectStop} />,
    );

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Richmond",
        colors: JSON.stringify(["#FF0000"]),
        system: "bart",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onDeselectStop).toHaveBeenCalled();
  });

  // ── Fly to selected stop ──

  it("flies to stop when flyToSelected is true", async () => {
    // fetchJsonCached is called for both routes (fitBounds) and stops (flyTo)
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("stops")) return Promise.resolve(mockStopsGeoJSON);
      return Promise.resolve(mockRoutesGeoJSON);
    });

    render(
      <TransitLayer systems={["bart"]} selectedStopName="Embarcadero" flyToSelected={true} />,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockMap.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-122.4, 37.8], zoom: 14 }),
    );
  });

  // ── Cleanup ──

  it("removes event listeners on unmount", () => {
    const { unmount } = render(<TransitLayer systems={["bart"]} />);

    expect(mockMap.on).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));

    unmount();

    expect(mockMap.off).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(mockMap.off).toHaveBeenCalledWith("click", expect.any(Function));
  });
});
