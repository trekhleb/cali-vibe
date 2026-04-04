import { render, screen } from "@testing-library/react";
import CityRaceLayer, { CityRaceLegend } from "@/components/map/layers/city-race-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityRaceLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityRaceLayer raceMetric="hispanic" />);

    expect(screen.getByTestId("Source-cities-race")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-race-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-race-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-race-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-race-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-race-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-race-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup when activeName and race value are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "East Palo Alto",
      activeProperties: { race: { white: 5.2, hispanic: 56.3, black: 13.4, asian: 8.9, other: 16.2 } },
    });

    render(<CityRaceLayer raceMetric="hispanic" />);
    expect(screen.getByText("East Palo Alto")).toBeInTheDocument();
    expect(screen.getByText(/56\.3%/)).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Los Angeles",
      activeProperties: { race: "invalid" },
    });
    render(<CityRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText(/Hispanic/)).not.toBeInTheDocument();
  });

  it("handles null properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test City",
      activeProperties: null,
    });
    render(<CityRaceLayer raceMetric="hispanic" />);
    expect(screen.queryByText("Test City")).not.toBeInTheDocument();
  });

  it("handles race data as JSON string", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Cupertino",
      activeProperties: { race: JSON.stringify({ white: 23.1, hispanic: 3.2, black: 1.5, asian: 66.8, other: 5.4 }) },
    });
    render(<CityRaceLayer raceMetric="asian" />);
    expect(screen.getByText("Cupertino")).toBeInTheDocument();
    expect(screen.getByText(/66\.8%/)).toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Oakland",
      activeProperties: { race: { white: 28.0, hispanic: 27.0, black: 22.0, asian: 16.0, other: 7.0 } },
    });
    const { container } = render(<CityRaceLayer raceMetric="black" overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityRaceLayer raceMetric="hispanic" selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-race",
      "city-race-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });

  it("shows popup for CDP with race data", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { race: { white: 37.1, hispanic: 53.5, black: 2.3, asian: 3.4, other: 3.7 }, placeType: "cdp" },
    });
    render(<CityRaceLayer raceMetric="hispanic" />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/53\.5%/)).toBeInTheDocument();
  });
});

describe("CityRaceLegend", () => {
  it("renders legend with correct race metric", () => {
    render(<CityRaceLegend raceMetric="hispanic" />);
    expect(screen.getByText(/Hispanic or Latino.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<CityRaceLegend raceMetric="white" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityRaceLegend raceMetric="asian" overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });
});
