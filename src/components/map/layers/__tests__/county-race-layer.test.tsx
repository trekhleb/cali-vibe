import { render, screen } from "@testing-library/react";
import CountyRaceLayer, { RaceLegend, RACE_LABELS } from "@/components/map/layers/county-race-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyRaceLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers for hispanic metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyRaceLayer raceMetric="hispanic" />);

    expect(screen.getByTestId("Source-counties-race")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-race-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-race-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-race-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-race-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-race-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-race-labels-highlight")).toBeInTheDocument();
  });

  it("renders for white metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyRaceLayer raceMetric="white" />);
    expect(screen.getByTestId("Layer-county-race-fill")).toBeInTheDocument();
  });

  it("renders for asian metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyRaceLayer raceMetric="asian" />);
    expect(screen.getByTestId("Layer-county-race-fill")).toBeInTheDocument();
  });

  it("shows popup with hispanic value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Los Angeles",
      activeProperties: { race: { white: 25.1, hispanic: 48.6, black: 7.8, asian: 14.2, other: 4.3 } },
    });

    render(<CountyRaceLayer raceMetric="hispanic" />);
    expect(screen.getByText("Los Angeles County")).toBeInTheDocument();
    expect(screen.getByText(/48\.6%/)).toBeInTheDocument();
  });

  it("shows popup with white value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Marin",
      activeProperties: { race: { white: 70.2, hispanic: 16.1, black: 2.5, asian: 5.8, other: 5.4 } },
    });

    render(<CountyRaceLayer raceMetric="white" />);
    expect(screen.getByText("Marin County")).toBeInTheDocument();
    expect(screen.getByText(/70\.2%/)).toBeInTheDocument();
  });

  it("handles null properties gracefully (no popup)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: null,
    });
    render(<CountyRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles missing race property gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: { population: 5000 },
    });
    render(<CountyRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("handles race data as JSON string (serialized)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Francisco",
      activeProperties: { race: JSON.stringify({ white: 37.5, hispanic: 15.9, black: 4.8, asian: 34.7, other: 7.1 }) },
    });
    render(<CountyRaceLayer raceMetric="asian" />);
    expect(screen.getByText("San Francisco County")).toBeInTheDocument();
    expect(screen.getByText(/34\.7%/)).toBeInTheDocument();
  });

  it("handles invalid JSON string gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Broken",
      activeProperties: { race: "not-json" },
    });
    render(<CountyRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText("Broken County")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "LA",
      activeProperties: { race: { white: 25.0, hispanic: 48.0, black: 8.0, asian: 14.0, other: 5.0 } },
    });
    const { container } = render(<CountyRaceLayer raceMetric="hispanic" overlayOffset={200} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "224px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyRaceLayer raceMetric="hispanic" selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-race",
      "county-race-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });

  it("does not show popup when activeName is null even with properties", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: null,
      activeProperties: { race: { white: 50.0, hispanic: 30.0, black: 5.0, asian: 10.0, other: 5.0 } },
    });
    render(<CountyRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });
});

describe("RaceLegend", () => {
  it("renders legend title for hispanic", () => {
    render(<RaceLegend raceMetric="hispanic" />);
    expect(screen.getByText(/Hispanic or Latino.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for white", () => {
    render(<RaceLegend raceMetric="white" />);
    expect(screen.getByText(/White \(non-Hispanic\).*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for black", () => {
    render(<RaceLegend raceMetric="black" />);
    expect(screen.getByText(/Black or African American.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for asian", () => {
    render(<RaceLegend raceMetric="asian" />);
    expect(screen.getByText(/Asian.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for other", () => {
    render(<RaceLegend raceMetric="other" />);
    expect(screen.getByText(/Other.*Two or More.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops for each metric", () => {
    const { container } = render(<RaceLegend raceMetric="hispanic" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<RaceLegend raceMetric="hispanic" overlayOffset={150} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "174px" });
  });

  it("does not apply offset style when overlayOffset is 0", () => {
    const { container } = render(<RaceLegend raceMetric="hispanic" overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});

describe("RACE_LABELS", () => {
  it("has exactly 5 metrics", () => {
    expect(Object.keys(RACE_LABELS)).toHaveLength(5);
  });

  it("includes all race metrics", () => {
    expect(RACE_LABELS.white).toBe("White (non-Hispanic)");
    expect(RACE_LABELS.hispanic).toBe("Hispanic or Latino");
    expect(RACE_LABELS.black).toBe("Black or African American");
    expect(RACE_LABELS.asian).toBe("Asian");
    expect(RACE_LABELS.other).toBe("Other / Two or More Races");
  });
});
