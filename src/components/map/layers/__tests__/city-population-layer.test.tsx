import { render, screen } from "@testing-library/react";
import CityPopulationLayer, { CityPopulationLegend } from "@/components/map/layers/city-population-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityPopulationLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPopulationLayer />);

    expect(screen.getByTestId("Source-cities-pop")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-pop-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-pop-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-pop-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-pop-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-pop-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-pop-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup with population and density", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Francisco",
      activeProperties: { population: 870000, density: 18500.3 },
    });

    render(<CityPopulationLayer />);
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText(/870,000/)).toBeInTheDocument();
    expect(screen.getByText(/18,500/)).toBeInTheDocument();
  });

  it("does not show popup when activeName is null", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPopulationLayer />);
    expect(screen.queryByText(/Pop:/)).not.toBeInTheDocument();
  });

  it("does not show popup when population is missing", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Ghost Town",
      activeProperties: {},
    });
    render(<CityPopulationLayer />);
    expect(screen.queryByText("Ghost Town")).not.toBeInTheDocument();
  });

  it("shows density line only when density is available", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Tiny Town",
      activeProperties: { population: 500, density: null },
    });
    render(<CityPopulationLayer />);
    expect(screen.getByText("Tiny Town")).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.queryByText(/Density/)).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Oakland",
      activeProperties: { population: 430000, density: 7500 },
    });
    const { container } = render(<CityPopulationLayer overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPopulationLayer selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-pop",
      "city-pop-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });

  it("shows popup for CDP with population and density", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { population: 32467, density: 1844.7, placeType: "cdp" },
    });

    render(<CityPopulationLayer />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/32,467/)).toBeInTheDocument();
    expect(screen.getByText(/1,844\.7/)).toBeInTheDocument();
  });

  it("accepts populationMetric prop", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPopulationLayer populationMetric="density" />);
    expect(screen.getByTestId("Layer-city-pop-fill")).toBeInTheDocument();
  });
});

describe("CityPopulationLegend", () => {
  it("renders legend for total metric", () => {
    render(<CityPopulationLegend populationMetric="total" />);
    expect(screen.getByText(/Total Population.*2024/)).toBeInTheDocument();
  });

  it("renders legend for density metric", () => {
    render(<CityPopulationLegend populationMetric="density" />);
    expect(screen.getByText(/Density.*sq mi.*2024/)).toBeInTheDocument();
  });

  it("renders 7 color stops", () => {
    const { container } = render(<CityPopulationLegend />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(7);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityPopulationLegend overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });

  it("defaults to total metric", () => {
    render(<CityPopulationLegend />);
    expect(screen.getByText(/Total Population/)).toBeInTheDocument();
  });
});
