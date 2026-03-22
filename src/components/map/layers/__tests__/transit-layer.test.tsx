import { render, screen, act } from "@testing-library/react";
import TransitLayer, {
  TRANSIT_SYSTEMS,
  BART_LINES,
  CALTRAIN_LINES,
  LAMETRO_LINES,
  SMART_LINES,
  VTA_LINES,
  CAPITOLCORRIDOR_LINES,
  SURFLINER_LINES,
  COASTER_LINES,
  SPRINTER_LINES,
  SDTROLLEY_LINES,
  METROLINK_LINES,
  SACRT_LINES,
  SANJOAQUINS_LINES,
  MUNIMETRO_LINES,
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

  it("exports TRANSIT_SYSTEMS with all systems", () => {
    expect(TRANSIT_SYSTEMS).toEqual([
      { id: "bart", label: "BART" },
      { id: "caltrain", label: "Caltrain" },
      { id: "smart", label: "SMART" },
      { id: "munimetro", label: "Muni Metro" },
      { id: "vta", label: "VTA" },
      { id: "capitolcorridor", label: "Capitol Corridor" },
      { id: "surfliner", label: "Pacific Surfliner" },
      { id: "coaster", label: "Coaster" },
      { id: "sprinter", label: "Sprinter" },
      { id: "sdtrolley", label: "SD Trolley" },
      { id: "metrolink", label: "Metrolink" },
      { id: "sacrt", label: "SacRT" },
      { id: "sanjoaquins", label: "San Joaquins" },
      { id: "lametro", label: "LA Metro" },
    ]);
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

  it("exports CALTRAIN_LINES with 4 lines and correct colors", () => {
    expect(CALTRAIN_LINES).toHaveLength(4);
    const colors = CALTRAIN_LINES.map((l) => l.color);
    expect(colors).toContain("#808080");
    expect(colors).toContain("#00A5B8");
    expect(colors).toContain("#CE202F");
    expect(colors).toContain("#E8A317");
  });

  it("every BART_LINES entry has a non-empty label", () => {
    for (const line of BART_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  it("every CALTRAIN_LINES entry has a non-empty label", () => {
    for (const line of CALTRAIN_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  // ── Rendering ──

  it("renders sources and layers when system is provided", () => {
    render(<TransitLayer systems={["bart"]} />);
    expect(screen.getByTestId("Source-transit-bart-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-bart-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-bart-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-bart-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-bart-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-bart-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-bart-stops-highlight")).toBeInTheDocument();
  });

  it("renders nothing when systems array is empty", () => {
    const { container } = render(<TransitLayer systems={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders layers for multiple systems", () => {
    render(<TransitLayer systems={["bart", "caltrain"]} />);
    expect(screen.getByTestId("Source-transit-bart-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-caltrain-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-bart-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-caltrain-stops")).toBeInTheDocument();
  });

  // ── Route filter ──

  it("applies no route filter when activeColorMap is empty", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{}} />);
    const casingLayer = screen.getByTestId("Layer-transit-bart-routes-line-casing");
    const routeLayer = screen.getByTestId("Layer-transit-bart-routes-line");
    expect(casingLayer).not.toHaveAttribute("data-filter");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("applies route filter when activeColorMap has colors for system", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const casingLayer = screen.getByTestId("Layer-transit-bart-routes-line-casing");
    const routeLayer = screen.getByTestId("Layer-transit-bart-routes-line");

    const expectedFilter = JSON.stringify(["in", ["get", "color"], ["literal", ["#FF0000"]]]);
    expect(casingLayer).toHaveAttribute("data-filter", expectedFilter);
    expect(routeLayer).toHaveAttribute("data-filter", expectedFilter);
  });

  it("applies route filter with multiple colors", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{ bart: ["#FF0000", "#339933"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-bart-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("in");
    expect(filter[2]).toEqual(["literal", ["#FF0000", "#339933"]]);
  });

  it("applies filter independently per system", () => {
    render(
      <TransitLayer
        systems={["bart", "caltrain"]}
        activeColorMap={{ bart: ["#FF0000"], caltrain: null }}
      />,
    );
    // BART should have filter
    const bartRoute = screen.getByTestId("Layer-transit-bart-routes-line");
    expect(bartRoute).toHaveAttribute("data-filter");

    // Caltrain should have no filter (null = show all)
    const caltrainRoute = screen.getByTestId("Layer-transit-caltrain-routes-line");
    expect(caltrainRoute).not.toHaveAttribute("data-filter");
  });

  // ── Stop filter ──

  it("applies no stop filter when activeColorMap is empty", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{}} />);
    const stopsLayer = screen.getByTestId("Layer-transit-bart-stops-circle");
    const labelsLayer = screen.getByTestId("Layer-transit-bart-stops-label");
    expect(stopsLayer).not.toHaveAttribute("data-filter");
    expect(labelsLayer).not.toHaveAttribute("data-filter");
  });

  it("applies stop filter when activeColorMap has colors", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-bart-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#FF0000", ["to-string", ["get", "colors"]]]);
  });

  it("stop filter includes all active colors", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{ bart: ["#FF0000", "#FF9933"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-bart-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter).toHaveLength(3); // ["any", condition1, condition2]
  });

  it("highlight layer uses its own filter, not the stop filter", () => {
    render(<TransitLayer systems={["bart"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const highlightLayer = screen.getByTestId("Layer-transit-bart-stops-highlight");
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

  // ── Caltrain-specific rendering ──

  it("renders all caltrain layer IDs when caltrain is the system", () => {
    render(<TransitLayer systems={["caltrain"]} />);
    expect(screen.getByTestId("Source-transit-caltrain-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-caltrain-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-caltrain-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-caltrain-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-caltrain-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-caltrain-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-caltrain-stops-highlight")).toBeInTheDocument();
  });

  it("applies caltrain filter via activeColorMap", () => {
    render(<TransitLayer systems={["caltrain"]} activeColorMap={{ caltrain: ["#CE202F"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-caltrain-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#CE202F"]]]);
  });

  it("applies no filter when system is not in activeColorMap (undefined)", () => {
    render(<TransitLayer systems={["caltrain"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-caltrain-routes-line");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("renders both systems with independent filters simultaneously", () => {
    render(
      <TransitLayer
        systems={["bart", "caltrain"]}
        activeColorMap={{ bart: ["#FF0000"], caltrain: ["#808080", "#CE202F"] }}
      />,
    );
    const bartFilter = JSON.parse(
      screen.getByTestId("Layer-transit-bart-routes-line").getAttribute("data-filter")!,
    );
    expect(bartFilter[2]).toEqual(["literal", ["#FF0000"]]);

    const caltrainFilter = JSON.parse(
      screen.getByTestId("Layer-transit-caltrain-routes-line").getAttribute("data-filter")!,
    );
    expect(caltrainFilter[2]).toEqual(["literal", ["#808080", "#CE202F"]]);
  });

  // ── Caltrain stop filter ──

  it("applies caltrain stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["caltrain"]} activeColorMap={{ caltrain: ["#00A5B8"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-caltrain-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#00A5B8", ["to-string", ["get", "colors"]]]);
  });

  it("caltrain highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["caltrain"]} activeColorMap={{ caltrain: ["#CE202F"] }} />);
    const hl = screen.getByTestId("Layer-transit-caltrain-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  // ── Hover interaction with Caltrain ──

  it("shows tooltip with Caltrain label on hover over caltrain stop", () => {
    render(<TransitLayer systems={["caltrain"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Palo Alto Station",
        colors: JSON.stringify(["#808080", "#00A5B8", "#CE202F"]),
        system: "caltrain",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Palo Alto Station")).toBeInTheDocument();
    expect(screen.getByText("Caltrain")).toBeInTheDocument();
  });

  // ── Multi-system hover queries all stop layers ──

  it("queries all stop layers across systems on hover", () => {
    render(<TransitLayer systems={["bart", "caltrain"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([]);
    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(mockMap.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 100, y: 100 },
      { layers: ["transit-bart-stops-circle", "transit-caltrain-stops-circle"] },
    );
  });

  it("queries all stop layers across systems on click", () => {
    render(<TransitLayer systems={["bart", "caltrain"]} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([]);
    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(mockMap.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 50, y: 50 },
      { layers: ["transit-bart-stops-circle", "transit-caltrain-stops-circle"] },
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

  it("removes event listeners on unmount with multiple systems", () => {
    const { unmount } = render(<TransitLayer systems={["bart", "caltrain"]} />);

    expect(mockMap.on).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));

    unmount();

    expect(mockMap.off).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(mockMap.off).toHaveBeenCalledWith("click", expect.any(Function));
  });

  // ── LA Metro exports ──

  it("exports LAMETRO_LINES with 6 lines and correct colors", () => {
    expect(LAMETRO_LINES).toHaveLength(6);
    const colors = LAMETRO_LINES.map((l) => l.color);
    expect(colors).toContain("#0072BC");
    expect(colors).toContain("#EB131B");
    expect(colors).toContain("#58A738");
    expect(colors).toContain("#A05DA5");
    expect(colors).toContain("#FDB913");
    expect(colors).toContain("#E56DB1");
  });

  it("every LAMETRO_LINES entry has a non-empty label", () => {
    for (const line of LAMETRO_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  // ── LA Metro rendering ──

  it("renders all lametro layer IDs when lametro is the system", () => {
    render(<TransitLayer systems={["lametro"]} />);
    expect(screen.getByTestId("Source-transit-lametro-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-lametro-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-lametro-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-lametro-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-lametro-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-lametro-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-lametro-stops-highlight")).toBeInTheDocument();
  });

  it("applies lametro filter via activeColorMap", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ lametro: ["#0072BC"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-lametro-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#0072BC"]]]);
  });

  it("applies lametro stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ lametro: ["#EB131B"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-lametro-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#EB131B", ["to-string", ["get", "colors"]]]);
  });

  it("shows tooltip with LA Metro label on hover over lametro stop", () => {
    render(<TransitLayer systems={["lametro"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Union Station",
        colors: JSON.stringify(["#0072BC", "#EB131B", "#A05DA5"]),
        system: "lametro",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Union Station")).toBeInTheDocument();
    expect(screen.getByText("LA Metro")).toBeInTheDocument();
  });

  it("lametro highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ lametro: ["#0072BC"] }} />);
    const hl = screen.getByTestId("Layer-transit-lametro-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  it("applies no filter when lametro is not in activeColorMap (undefined)", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-lametro-routes-line");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("calls onSelectStop when clicking a lametro stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["lametro"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Union Station",
        colors: JSON.stringify(["#0072BC", "#EB131B"]),
        system: "lametro",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Union Station");
  });

  it("renders lametro and smart with independent filters", () => {
    render(
      <TransitLayer
        systems={["lametro", "smart"]}
        activeColorMap={{ lametro: ["#0072BC"], smart: null }}
      />,
    );
    const lametroRoute = screen.getByTestId("Layer-transit-lametro-routes-line");
    expect(lametroRoute).toHaveAttribute("data-filter");

    const smartRoute = screen.getByTestId("Layer-transit-smart-routes-line");
    expect(smartRoute).not.toHaveAttribute("data-filter");
  });

  it("applies lametro route filter with multiple colors", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ lametro: ["#0072BC", "#58A738"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-lametro-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("in");
    expect(filter[2]).toEqual(["literal", ["#0072BC", "#58A738"]]);
  });

  it("lametro stop filter includes all active colors", () => {
    render(<TransitLayer systems={["lametro"]} activeColorMap={{ lametro: ["#0072BC", "#EB131B"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-lametro-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter).toHaveLength(3); // ["any", condition1, condition2]
  });

  // ── SMART exports ──

  it("exports SMART_LINES with 1 line and correct color", () => {
    expect(SMART_LINES).toHaveLength(1);
    expect(SMART_LINES[0].color).toBe("#2E8B57");
    expect(SMART_LINES[0].label).toBe("Main Line");
  });

  // ── SMART rendering ──

  it("renders all smart layer IDs when smart is the system", () => {
    render(<TransitLayer systems={["smart"]} />);
    expect(screen.getByTestId("Source-transit-smart-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-smart-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-smart-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-smart-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-smart-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-smart-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-smart-stops-highlight")).toBeInTheDocument();
  });

  it("applies smart route filter via activeColorMap", () => {
    render(<TransitLayer systems={["smart"]} activeColorMap={{ smart: ["#2E8B57"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-smart-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#2E8B57"]]]);
  });

  it("applies smart stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["smart"]} activeColorMap={{ smart: ["#2E8B57"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-smart-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#2E8B57", ["to-string", ["get", "colors"]]]);
  });

  it("smart highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["smart"]} activeColorMap={{ smart: ["#2E8B57"] }} />);
    const hl = screen.getByTestId("Layer-transit-smart-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  it("applies no filter when smart is not in activeColorMap (undefined)", () => {
    render(<TransitLayer systems={["smart"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-smart-routes-line");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("shows tooltip with SMART label on hover over smart stop", () => {
    render(<TransitLayer systems={["smart"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "San Rafael",
        colors: JSON.stringify(["#2E8B57"]),
        system: "smart",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("San Rafael")).toBeInTheDocument();
    expect(screen.getByText("SMART")).toBeInTheDocument();
  });

  it("calls onSelectStop when clicking a smart stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["smart"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Larkspur",
        colors: JSON.stringify(["#2E8B57"]),
        system: "smart",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Larkspur");
  });

  // ── VTA exports ──

  it("exports VTA_LINES with 3 lines and correct colors", () => {
    expect(VTA_LINES).toHaveLength(3);
    const colors = VTA_LINES.map((l) => l.color);
    expect(colors).toContain("#007ACC");
    expect(colors).toContain("#379400");
    expect(colors).toContain("#CC6600");
  });

  it("every VTA_LINES entry has a non-empty label", () => {
    for (const line of VTA_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  // ── VTA rendering ──

  it("renders all vta layer IDs when vta is the system", () => {
    render(<TransitLayer systems={["vta"]} />);
    expect(screen.getByTestId("Source-transit-vta-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-vta-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-vta-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-vta-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-vta-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-vta-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-vta-stops-highlight")).toBeInTheDocument();
  });

  it("applies vta route filter via activeColorMap", () => {
    render(<TransitLayer systems={["vta"]} activeColorMap={{ vta: ["#007ACC"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-vta-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#007ACC"]]]);
  });

  it("applies vta stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["vta"]} activeColorMap={{ vta: ["#379400"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-vta-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#379400", ["to-string", ["get", "colors"]]]);
  });

  it("vta highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["vta"]} activeColorMap={{ vta: ["#007ACC"] }} />);
    const hl = screen.getByTestId("Layer-transit-vta-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  it("applies no filter when vta is not in activeColorMap (undefined)", () => {
    render(<TransitLayer systems={["vta"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-vta-routes-line");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("shows tooltip with VTA label on hover over vta stop", () => {
    render(<TransitLayer systems={["vta"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Diridon",
        colors: JSON.stringify(["#007ACC", "#379400"]),
        system: "vta",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Diridon")).toBeInTheDocument();
    expect(screen.getByText("VTA")).toBeInTheDocument();
  });

  it("calls onSelectStop when clicking a vta stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["vta"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Mountain View",
        colors: JSON.stringify(["#007ACC", "#CC6600"]),
        system: "vta",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Mountain View");
  });

  // ── Capitol Corridor exports ──

  it("exports CAPITOLCORRIDOR_LINES with 1 line and correct color", () => {
    expect(CAPITOLCORRIDOR_LINES).toHaveLength(1);
    expect(CAPITOLCORRIDOR_LINES[0].color).toBe("#1C4E8A");
    expect(CAPITOLCORRIDOR_LINES[0].label).toBe("Main Line");
  });

  // ── Capitol Corridor rendering ──

  it("renders all capitolcorridor layer IDs when capitolcorridor is the system", () => {
    render(<TransitLayer systems={["capitolcorridor"]} />);
    expect(screen.getByTestId("Source-transit-capitolcorridor-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-capitolcorridor-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-capitolcorridor-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-capitolcorridor-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-capitolcorridor-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-capitolcorridor-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-capitolcorridor-stops-highlight")).toBeInTheDocument();
  });

  it("applies capitolcorridor route filter via activeColorMap", () => {
    render(<TransitLayer systems={["capitolcorridor"]} activeColorMap={{ capitolcorridor: ["#1C4E8A"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-capitolcorridor-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#1C4E8A"]]]);
  });

  it("applies capitolcorridor stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["capitolcorridor"]} activeColorMap={{ capitolcorridor: ["#1C4E8A"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-capitolcorridor-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#1C4E8A", ["to-string", ["get", "colors"]]]);
  });

  it("capitolcorridor highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["capitolcorridor"]} activeColorMap={{ capitolcorridor: ["#1C4E8A"] }} />);
    const hl = screen.getByTestId("Layer-transit-capitolcorridor-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  it("shows tooltip with Capitol Corridor label on hover over capitolcorridor stop", () => {
    render(<TransitLayer systems={["capitolcorridor"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Sacramento",
        colors: JSON.stringify(["#1C4E8A"]),
        system: "capitolcorridor",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Sacramento")).toBeInTheDocument();
    expect(screen.getByText("Capitol Corridor")).toBeInTheDocument();
  });

  it("calls onSelectStop when clicking a capitolcorridor stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["capitolcorridor"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Davis",
        colors: JSON.stringify(["#1C4E8A"]),
        system: "capitolcorridor",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Davis");
  });

  // ── Pacific Surfliner exports ──

  it("exports SURFLINER_LINES with 1 line and correct color", () => {
    expect(SURFLINER_LINES).toHaveLength(1);
    expect(SURFLINER_LINES[0].color).toBe("#1B5BA3");
    expect(SURFLINER_LINES[0].label).toBe("Main Line");
  });

  // ── Pacific Surfliner rendering ──

  it("renders all surfliner layer IDs when surfliner is the system", () => {
    render(<TransitLayer systems={["surfliner"]} />);
    expect(screen.getByTestId("Source-transit-surfliner-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-surfliner-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-surfliner-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-surfliner-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-surfliner-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-surfliner-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-surfliner-stops-highlight")).toBeInTheDocument();
  });

  it("shows tooltip with Pacific Surfliner label on hover over surfliner stop", () => {
    render(<TransitLayer systems={["surfliner"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Santa Barbara",
        colors: JSON.stringify(["#1B5BA3"]),
        system: "surfliner",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Santa Barbara")).toBeInTheDocument();
    expect(screen.getByText("Pacific Surfliner")).toBeInTheDocument();
  });

  it("calls onSelectStop when clicking a surfliner stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["surfliner"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "San Diego",
        colors: JSON.stringify(["#1B5BA3"]),
        system: "surfliner",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("San Diego");
  });

  // ── COASTER exports ──

  it("exports COASTER_LINES with 1 line and correct color", () => {
    expect(COASTER_LINES).toHaveLength(1);
    expect(COASTER_LINES[0].color).toBe("#00459D");
    expect(COASTER_LINES[0].label).toBe("Main Line");
  });

  it("renders all coaster layer IDs when coaster is the system", () => {
    render(<TransitLayer systems={["coaster"]} />);
    expect(screen.getByTestId("Source-transit-coaster-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-coaster-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-coaster-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-coaster-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with Coaster label on hover over coaster stop", () => {
    render(<TransitLayer systems={["coaster"]} />);
    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "Oceanside", colors: JSON.stringify(["#00459D"]), system: "coaster" },
    }]);
    act(() => { onMouseMove({ target: mockMap, point: { x: 100, y: 100 } }); });
    expect(screen.getByText("Oceanside")).toBeInTheDocument();
    expect(screen.getByText("Coaster")).toBeInTheDocument();
  });

  // ── Muni Metro exports ──

  it("exports MUNIMETRO_LINES with 7 lines and correct colors", () => {
    expect(MUNIMETRO_LINES).toHaveLength(7);
    const colors = MUNIMETRO_LINES.map((l) => l.color);
    expect(colors).toContain("#A96614");
    expect(colors).toContain("#437C93");
    expect(colors).toContain("#942D83");
    expect(colors).toContain("#008547");
    expect(colors).toContain("#005B95");
    expect(colors).toContain("#BF2B45");
    expect(colors).toContain("#B49A36");
  });

  it("every MUNIMETRO_LINES entry has a non-empty label", () => {
    for (const line of MUNIMETRO_LINES) {
      expect(line.label.length).toBeGreaterThan(0);
    }
  });

  // ── Muni Metro rendering ──

  it("renders all munimetro layer IDs when munimetro is the system", () => {
    render(<TransitLayer systems={["munimetro"]} />);
    expect(screen.getByTestId("Source-transit-munimetro-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-munimetro-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-munimetro-routes-line-casing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-munimetro-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-munimetro-stops-circle")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-munimetro-stops-label")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-munimetro-stops-highlight")).toBeInTheDocument();
  });

  it("applies munimetro route filter via activeColorMap", () => {
    render(<TransitLayer systems={["munimetro"]} activeColorMap={{ munimetro: ["#005B95"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-munimetro-routes-line");
    const filter = JSON.parse(routeLayer.getAttribute("data-filter")!);
    expect(filter).toEqual(["in", ["get", "color"], ["literal", ["#005B95"]]]);
  });

  it("applies munimetro stop filter via activeColorMap", () => {
    render(<TransitLayer systems={["munimetro"]} activeColorMap={{ munimetro: ["#BF2B45"] }} />);
    const stopsLayer = screen.getByTestId("Layer-transit-munimetro-stops-circle");
    const filter = JSON.parse(stopsLayer.getAttribute("data-filter")!);
    expect(filter[0]).toBe("any");
    expect(filter[1]).toEqual(["in", "#BF2B45", ["to-string", ["get", "colors"]]]);
  });

  it("munimetro highlight layer uses name filter, not color filter", () => {
    render(<TransitLayer systems={["munimetro"]} activeColorMap={{ munimetro: ["#005B95"] }} />);
    const hl = screen.getByTestId("Layer-transit-munimetro-stops-highlight");
    const filter = JSON.parse(hl.getAttribute("data-filter")!);
    expect(filter[0]).toBe("==");
  });

  it("applies no filter when munimetro is not in activeColorMap (undefined)", () => {
    render(<TransitLayer systems={["munimetro"]} activeColorMap={{ bart: ["#FF0000"] }} />);
    const routeLayer = screen.getByTestId("Layer-transit-munimetro-routes-line");
    expect(routeLayer).not.toHaveAttribute("data-filter");
  });

  it("shows tooltip with Muni Metro label on hover over munimetro stop", () => {
    render(<TransitLayer systems={["munimetro"]} />);

    const onMouseMove = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Church Station",
        colors: JSON.stringify(["#A96614"]),
        system: "munimetro",
      },
    }]);

    act(() => {
      onMouseMove({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText("Church Station")).toBeInTheDocument();
    expect(screen.getByText("Muni Metro")).toBeInTheDocument();
  });

  it("calls onSelectStop when clicking a munimetro stop", () => {
    const onSelectStop = vi.fn();
    render(<TransitLayer systems={["munimetro"]} onSelectStop={onSelectStop} />);

    const onClick = mockMap.on.mock.calls.find((c: any) => c[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: {
        name: "Embarcadero Station",
        colors: JSON.stringify(["#A96614", "#437C93", "#005B95"]),
        system: "munimetro",
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 50, y: 50 } });
    });

    expect(onSelectStop).toHaveBeenCalledWith("Embarcadero Station");
  });

  // ── SPRINTER exports ──

  it("exports SPRINTER_LINES with 1 line and correct color", () => {
    expect(SPRINTER_LINES).toHaveLength(1);
    expect(SPRINTER_LINES[0].color).toBe("#00AB9B");
    expect(SPRINTER_LINES[0].label).toBe("Main Line");
  });

  it("renders all sprinter layer IDs when sprinter is the system", () => {
    render(<TransitLayer systems={["sprinter"]} />);
    expect(screen.getByTestId("Source-transit-sprinter-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sprinter-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sprinter-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sprinter-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with Sprinter label on hover over sprinter stop", () => {
    render(<TransitLayer systems={["sprinter"]} />);
    const handler = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")?.[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "Escondido", colors: JSON.stringify(["#00AB9B"]), system: "sprinter" },
    }]);
    act(() => { handler({ point: { x: 0, y: 0 }, target: mockMap }); });
    expect(screen.getByText("Escondido")).toBeInTheDocument();
    expect(screen.getByText("Sprinter")).toBeInTheDocument();
  });

  // ── SD Trolley exports ──

  it("exports SDTROLLEY_LINES with 3 lines and correct colors", () => {
    expect(SDTROLLEY_LINES).toHaveLength(3);
    expect(SDTROLLEY_LINES.map(l => l.color)).toEqual(["#0000FF", "#FF6600", "#009900"]);
    expect(SDTROLLEY_LINES.map(l => l.label)).toEqual(["Blue", "Orange", "Green"]);
  });

  it("renders all sdtrolley layer IDs when sdtrolley is the system", () => {
    render(<TransitLayer systems={["sdtrolley"]} />);
    expect(screen.getByTestId("Source-transit-sdtrolley-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sdtrolley-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sdtrolley-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sdtrolley-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with SD Trolley label on hover over sdtrolley stop", () => {
    render(<TransitLayer systems={["sdtrolley"]} />);
    const handler = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")?.[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "Old Town", colors: JSON.stringify(["#009900"]), system: "sdtrolley" },
    }]);
    act(() => { handler({ point: { x: 0, y: 0 }, target: mockMap }); });
    expect(screen.getByText("Old Town")).toBeInTheDocument();
    expect(screen.getByText("SD Trolley")).toBeInTheDocument();
  });

  // ── Metrolink exports ──

  it("exports METROLINK_LINES with 7 lines and correct colors", () => {
    expect(METROLINK_LINES).toHaveLength(7);
    expect(METROLINK_LINES.map(l => l.color)).toContain("#00AF43");
    expect(METROLINK_LINES.map(l => l.color)).toContain("#0071CE");
  });

  it("renders all metrolink layer IDs when metrolink is the system", () => {
    render(<TransitLayer systems={["metrolink"]} />);
    expect(screen.getByTestId("Source-transit-metrolink-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-metrolink-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-metrolink-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-metrolink-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with Metrolink label on hover over metrolink stop", () => {
    render(<TransitLayer systems={["metrolink"]} />);
    const handler = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")?.[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "L.A. Union", colors: JSON.stringify(["#00AF43"]), system: "metrolink" },
    }]);
    act(() => { handler({ point: { x: 0, y: 0 }, target: mockMap }); });
    expect(screen.getByText("L.A. Union")).toBeInTheDocument();
    expect(screen.getByText("Metrolink")).toBeInTheDocument();
  });

  // ── SacRT exports ──

  it("exports SACRT_LINES with 3 lines and correct colors", () => {
    expect(SACRT_LINES).toHaveLength(3);
    expect(SACRT_LINES.map(l => l.color)).toEqual(["#C4A600", "#008040", "#0000FF"]);
    expect(SACRT_LINES.map(l => l.label)).toEqual(["Gold", "Green", "Blue"]);
  });

  it("renders all sacrt layer IDs when sacrt is the system", () => {
    render(<TransitLayer systems={["sacrt"]} />);
    expect(screen.getByTestId("Source-transit-sacrt-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sacrt-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sacrt-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sacrt-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with SacRT label on hover over sacrt stop", () => {
    render(<TransitLayer systems={["sacrt"]} />);
    const handler = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")?.[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "7th & Capitol", colors: JSON.stringify(["#C4A600", "#008040", "#0000FF"]), system: "sacrt" },
    }]);
    act(() => { handler({ point: { x: 0, y: 0 }, target: mockMap }); });
    expect(screen.getByText("7th & Capitol")).toBeInTheDocument();
    expect(screen.getByText("SacRT")).toBeInTheDocument();
  });

  // ── San Joaquins exports ──

  it("exports SANJOAQUINS_LINES with 1 line and correct color", () => {
    expect(SANJOAQUINS_LINES).toHaveLength(1);
    expect(SANJOAQUINS_LINES.map(l => l.color)).toEqual(["#1A6B8A"]);
    expect(SANJOAQUINS_LINES.map(l => l.label)).toEqual(["Gold Runner"]);
  });

  it("renders all sanjoaquins layer IDs when sanjoaquins is the system", () => {
    render(<TransitLayer systems={["sanjoaquins"]} />);
    expect(screen.getByTestId("Source-transit-sanjoaquins-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sanjoaquins-stops")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sanjoaquins-routes-line")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-transit-sanjoaquins-stops-circle")).toBeInTheDocument();
  });

  it("shows tooltip with San Joaquins label on hover over sanjoaquins stop", () => {
    render(<TransitLayer systems={["sanjoaquins"]} />);
    const handler = mockMap.on.mock.calls.find((c: any) => c[0] === "mousemove")?.[1];
    mockMap.queryRenderedFeatures.mockReturnValue([{
      properties: { name: "Fresno", colors: JSON.stringify(["#1A6B8A"]), system: "sanjoaquins" },
    }]);
    act(() => { handler({ point: { x: 0, y: 0 }, target: mockMap }); });
    expect(screen.getByText("Fresno")).toBeInTheDocument();
    expect(screen.getByText("San Joaquins")).toBeInTheDocument();
  });

  // ── All fourteen systems ──

  it("renders layers for all fourteen systems simultaneously", () => {
    render(<TransitLayer systems={["bart", "caltrain", "smart", "vta", "capitolcorridor", "surfliner", "coaster", "sprinter", "sdtrolley", "metrolink", "sacrt", "sanjoaquins", "munimetro", "lametro"]} />);
    expect(screen.getByTestId("Source-transit-bart-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-caltrain-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-smart-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-vta-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-capitolcorridor-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-surfliner-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-coaster-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sprinter-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sdtrolley-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-metrolink-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sacrt-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-sanjoaquins-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-munimetro-routes")).toBeInTheDocument();
    expect(screen.getByTestId("Source-transit-lametro-routes")).toBeInTheDocument();
  });

  it("applies independent filters across all fourteen systems", () => {
    render(
      <TransitLayer
        systems={["bart", "caltrain", "smart", "vta", "capitolcorridor", "surfliner", "coaster", "sprinter", "sdtrolley", "metrolink", "sacrt", "sanjoaquins", "munimetro", "lametro"]}
        activeColorMap={{
          bart: ["#FF0000"],
          caltrain: null,
          smart: ["#2E8B57"],
          vta: ["#007ACC"],
          capitolcorridor: ["#1C4E8A"],
          surfliner: ["#1B5BA3"],
          coaster: ["#00459D"],
          sprinter: ["#00AB9B"],
          sdtrolley: ["#0000FF"],
          metrolink: ["#00AF43"],
          sacrt: ["#C4A600"],
          sanjoaquins: ["#1A6B8A"],
          munimetro: ["#005B95"],
          lametro: ["#0072BC", "#EB131B"],
        }}
      />,
    );
    expect(screen.getByTestId("Layer-transit-bart-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-caltrain-routes-line")).not.toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-smart-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-vta-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-capitolcorridor-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-surfliner-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-coaster-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-sprinter-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-sdtrolley-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-metrolink-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-sacrt-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-sanjoaquins-routes-line")).toHaveAttribute("data-filter");
    expect(screen.getByTestId("Layer-transit-munimetro-routes-line")).toHaveAttribute("data-filter");
    const lametroFilter = JSON.parse(
      screen.getByTestId("Layer-transit-lametro-routes-line").getAttribute("data-filter")!,
    );
    expect(lametroFilter[2]).toEqual(["literal", ["#0072BC", "#EB131B"]]);
  });
});
