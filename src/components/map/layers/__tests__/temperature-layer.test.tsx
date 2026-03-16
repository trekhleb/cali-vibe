import { render, screen, act } from "@testing-library/react";
import TemperatureLayer, { TemperatureLegend } from "@/components/map/layers/temperature-layer";
import { useMap } from "react-map-gl/maplibre";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
  useMap: vi.fn(),
}));

describe("TemperatureLayer", () => {
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
    render(<TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} />);
    expect(screen.getByTestId("Source-temperature-hex")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-temperature-hex-fill")).toBeInTheDocument();
  });

  it("flies to selected hex on mount", () => {
    mockMap.querySourceFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
    }]);

    render(<TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} selectedH3="some-id" />);
    expect(mockMap.flyTo).toHaveBeenCalled();
  });

  it("handles mouse events for hovering and tooltip", () => {
    const { unmount } = render(<TemperatureLayer metric="tmax" month={6} unit="F" resolution={4} overlayOffset={50} />);
    
    // simulate onmousemove
    const onMouseMove = mockMap.on.mock.calls.find((call: any) => call[0] === "mousemove")[1];
    
    // hover with empty features
    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    // should need mockMap to return some features from queryRenderedFeatures inside the act
    // let's setup queryRenderedFeatures to return a feature
    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: { 
        tmin: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
        tmax: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
        tavg: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
      }
    }]);

    act(() => {
      onMouseMove({
        target: mockMap,
        point: { x: 0, y: 0 },
      });
    });

    expect(screen.getByText(/Day High/i)).toBeInTheDocument();

    // handle bad props
    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 1], [0, 0]]] },
      properties: null
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

    expect(screen.queryByText(/Day High:/i)).not.toBeInTheDocument();

    unmount();
  });

  it("handles click to deselect when clicking empty space", () => {
    const onDeselectHex = vi.fn();
    render(<TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} selectedH3="some-id" onDeselectHex={onDeselectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([]);

    act(() => {
      onClick({ target: mockMap, point: { x: 0, y: 0 } });
    });

    expect(onDeselectHex).toHaveBeenCalled();
  });

  it("selects a hex when clicking on it", () => {
    const onSelectHex = vi.fn();
    render(<TemperatureLayer metric="tavg" month={6} unit="F" resolution={5} onSelectHex={onSelectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "abc123",
        tmin: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
        tmax: JSON.stringify([10,11,12,13,14,15,16,17,18,19,20,21]),
        tavg: JSON.stringify([5,6,7,8,9,10,11,12,13,14,15,16]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    expect(onSelectHex).toHaveBeenCalledWith("abc123");
  });

  it("shows persistent info panel after clicking a hex", () => {
    const onSelectHex = vi.fn();
    render(<TemperatureLayer metric="tavg" month={6} unit="F" resolution={5} onSelectHex={onSelectHex} />);

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "abc123",
        tmin: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
        tmax: JSON.stringify([10,11,12,13,14,15,16,17,18,19,20,21]),
        tavg: JSON.stringify([5,6,7,8,9,10,11,12,13,14,15,16]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    // Info panel stays visible (not just on hover)
    expect(screen.getByText(/Day High/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Low/i)).toBeInTheDocument();
    expect(screen.getByText(/Average/i)).toBeInTheDocument();
  });

  it("does not fly to hex when selecting via map click", () => {
    const onSelectHex = vi.fn();
    const { rerender } = render(
      <TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} onSelectHex={onSelectHex} />,
    );

    const onClick = mockMap.on.mock.calls.find((call: any) => call[0] === "click")[1];

    mockMap.queryRenderedFeatures.mockReturnValue([{
      geometry: { type: "Polygon", coordinates: [[[-118, 34], [-117, 34], [-117, 35], [-118, 34]]] },
      properties: {
        h3: "map-click-hex",
        tmin: JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
        tmax: JSON.stringify([10,11,12,13,14,15,16,17,18,19,20,21]),
        tavg: JSON.stringify([5,6,7,8,9,10,11,12,13,14,15,16]),
      },
    }]);

    act(() => {
      onClick({ target: mockMap, point: { x: 100, y: 100 } });
    });

    mockMap.flyTo.mockClear();

    // Simulate the parent setting selectedH3 after onSelectHex was called
    rerender(
      <TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} selectedH3="map-click-hex" onSelectHex={onSelectHex} />,
    );

    expect(mockMap.flyTo).not.toHaveBeenCalled();
  });

  it("deselects when clicking the same hex again", () => {
    const onDeselectHex = vi.fn();
    render(
      <TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} selectedH3="abc123" onDeselectHex={onDeselectHex} />,
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
        tmin: [1,2,3,4,5,6,7,8,9,10,11,12],
        tmax: [10,11,12,13,14,15,16,17,18,19,20,21],
        tavg: [5,6,7,8,9,10,11,12,13,14,15,16],
      },
    }]);

    const { rerender } = render(
      <TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} />,
    );

    mockMap.flyTo.mockClear();

    // Simulate table-driven selection (no map click happened)
    rerender(
      <TemperatureLayer metric="tavg" month={0} unit="C" resolution={4} selectedH3="table-hex" />,
    );

    expect(mockMap.flyTo).toHaveBeenCalled();
  });
});

describe("TemperatureLegend", () => {
  it("renders with given metric and month", () => {
    render(<TemperatureLegend metric="tmax" month={0} unit="C" overlayOffset={50} />);
    expect(screen.getByText(/Day High/i)).toBeInTheDocument();
  });

  it("calculates F correctly", () => {
    render(<TemperatureLegend metric="tmin" month={6} unit="F" />);
    expect(screen.getByText(/Night Low/i)).toBeInTheDocument();
  });
});
