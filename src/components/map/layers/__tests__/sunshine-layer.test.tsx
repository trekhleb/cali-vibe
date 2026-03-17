import { render, screen, act } from "@testing-library/react";
import SunshineLayer, { SunshineLegend, ANNUAL_MONTH } from "@/components/map/layers/sunshine-layer";
import { useMap } from "react-map-gl/maplibre";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
  useMap: vi.fn(),
}));

describe("SunshineLayer", () => {
  let mockMap: any;

  beforeEach(() => {
    mockMap = {
      querySourceFeatures: vi.fn().mockReturnValue([]),
      queryRenderedFeatures: vi.fn().mockReturnValue([]),
      flyTo: vi.fn(),
      once: vi.fn((event, cb) => {
        if (event === "idle") cb();
      }),
      on: vi.fn(),
      off: vi.fn(),
      getCanvas: vi.fn(() => ({ style: {} })),
    };
    (useMap as ReturnType<typeof vi.fn>).mockReturnValue({ current: mockMap });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    render(<SunshineLayer month={6} resolution={4} />);
    expect(screen.getByTestId("Source-sunshine-hex")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-sunshine-hex-fill")).toBeInTheDocument();
  });

  it("flies to selected hex on mount", () => {
    mockMap.querySourceFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
    }]);

    render(<SunshineLayer month={6} resolution={4} selectedH3="some-id" />);
    expect(mockMap.flyTo).toHaveBeenCalled();
  });

  it("handles mouse events for hovering and tooltip", () => {
    const { unmount } = render(<SunshineLayer month={6} resolution={4} overlayOffset={50} />);

    const onMouseMove = mockMap.on.mock.calls.find((call: any) => call[0] === "mousemove")[1];

    // hover with empty features
    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    // setup queryRenderedFeatures to return a feature with sunshine data
    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: {
        sunshine: JSON.stringify([5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5]),
      },
    }]);

    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    expect(screen.getByText(/Jul:/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual avg:/i)).toBeInTheDocument();

    // handle bad props
    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: null,
    }]);

    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    // simulate unhover
    const onMouseLeave = mockMap.on.mock.calls.find((call: any) => call[0] === "mouseleave")[2];
    act(() => {
      onMouseLeave();
    });

    expect(screen.queryByText(/Jul:/i)).not.toBeInTheDocument();

    unmount();
  });

  it("handles click to deselect when clicking empty space", () => {
    const onDeselectHex = vi.fn();
    render(<SunshineLayer month={6} resolution={4} selectedH3="some-id" onDeselectHex={onDeselectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([]);

    act(() => {
      onClick({ target: mockMap, point: { x: 0, y: 0 } });
    });

    expect(onDeselectHex).toHaveBeenCalled();
  });

  it("selects a hex when clicking on it", () => {
    const onSelectHex = vi.fn();
    render(<SunshineLayer month={6} resolution={5} onSelectHex={onSelectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "abc123",
        sunshine: JSON.stringify([5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(onSelectHex).toHaveBeenCalledWith("abc123");
  });

  it("shows persistent info panel after clicking a hex", () => {
    const onSelectHex = vi.fn();
    render(<SunshineLayer month={6} resolution={5} onSelectHex={onSelectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "abc123",
        sunshine: JSON.stringify([5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(screen.getByText(/Jul:/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual avg:/i)).toBeInTheDocument();
  });

  it("does not fly to hex when selecting via map click", () => {
    const onSelectHex = vi.fn();
    const { rerender } = render(
      <SunshineLayer month={6} resolution={4} onSelectHex={onSelectHex} />,
    );

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "map-click-hex",
        sunshine: JSON.stringify([5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    mockMap.flyTo.mockClear();

    rerender(
      <SunshineLayer month={6} resolution={4} selectedH3="map-click-hex" onSelectHex={onSelectHex} />,
    );

    expect(mockMap.flyTo).not.toHaveBeenCalled();
  });

  it("deselects when clicking the same hex again", () => {
    const onDeselectHex = vi.fn();
    render(
      <SunshineLayer month={6} resolution={4} selectedH3="abc123" onDeselectHex={onDeselectHex} />,
    );

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: { h3: "abc123" },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(onDeselectHex).toHaveBeenCalled();
  });

  it("flies to hex when selected from table (prop change without map click)", () => {
    mockMap.querySourceFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        sunshine: [5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5],
      },
    }]);

    const { rerender } = render(
      <SunshineLayer month={6} resolution={4} />,
    );

    mockMap.flyTo.mockClear();

    rerender(
      <SunshineLayer month={6} resolution={4} selectedH3="table-hex" />,
    );

    expect(mockMap.flyTo).toHaveBeenCalled();
  });

  it("renders tooltip with annual average when month is ANNUAL_MONTH", () => {
    render(<SunshineLayer month={ANNUAL_MONTH} resolution={4} />);

    const onMouseMove = mockMap.on.mock.calls.find((call: any) => call[0] === "mousemove")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: {
        sunshine: JSON.stringify([5, 6, 7, 8, 9, 10, 11, 12, 11, 9, 7, 5]),
      },
    }]);

    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    // Annual mode: shows "Annual avg:" as the primary (bold) line, not a month label
    expect(screen.getByText(/Annual avg:/i)).toBeInTheDocument();
    // Should NOT show a month-specific line
    expect(screen.queryByText(/^Jul:/)).not.toBeInTheDocument();
  });

  it("renders sources and layers with ANNUAL_MONTH", () => {
    render(<SunshineLayer month={ANNUAL_MONTH} resolution={5} />);
    expect(screen.getByTestId("Source-sunshine-hex")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-sunshine-hex-fill")).toBeInTheDocument();
  });
});

describe("SunshineLegend", () => {
  it("renders with given month", () => {
    render(<SunshineLegend month={6} overlayOffset={50} />);
    expect(screen.getByText(/Daily Sunshine/i)).toBeInTheDocument();
    expect(screen.getByText(/Jul/i)).toBeInTheDocument();
  });

  it("renders for January", () => {
    render(<SunshineLegend month={0} />);
    expect(screen.getByText(/Jan/i)).toBeInTheDocument();
  });

  it("renders for annual average", () => {
    render(<SunshineLegend month={ANNUAL_MONTH} />);
    expect(screen.getByText(/Year/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Sunshine/i)).toBeInTheDocument();
  });
});
