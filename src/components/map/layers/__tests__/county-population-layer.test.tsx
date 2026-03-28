import { render, screen } from "@testing-library/react";
import CountyPopulationLayer, { PopulationLegend, POPULATION_LABELS, type PopulationMetric } from "@/components/map/layers/county-population-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyPopulationLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPopulationLayer />);

    expect(screen.getByTestId("Source-counties-pop")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-pop-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-pop-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-pop-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-pop-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-pop-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-pop-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup with population when activeName is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Santa Clara",
      activeProperties: { population: 2000000, density: 1700.5 }
    });

    render(<CountyPopulationLayer overlayOffset={100} />);
    expect(screen.getByText("Santa Clara County")).toBeInTheDocument();
    expect(screen.getByText(/2,000,000/)).toBeInTheDocument();
  });

  it("shows density in popup when available", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Francisco",
      activeProperties: { population: 870000, density: 17500.3 },
    });

    render(<CountyPopulationLayer />);
    expect(screen.getByText("San Francisco County")).toBeInTheDocument();
    expect(screen.getByText(/17,500/)).toBeInTheDocument();
    expect(screen.getByText(/\/sq mi/)).toBeInTheDocument();
  });

  it("does not show density line when density is null", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: { population: 1099, density: null },
    });

    render(<CountyPopulationLayer />);
    expect(screen.getByText("Alpine County")).toBeInTheDocument();
    expect(screen.queryByText(/Density/)).not.toBeInTheDocument();
  });

  it("does not show popup when activeName is null", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPopulationLayer />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });

  it("does not show popup when population is missing", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: {},
    });
    render(<CountyPopulationLayer />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("accepts populationMetric prop", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPopulationLayer populationMetric="density" />);
    expect(screen.getByTestId("Layer-county-pop-fill")).toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alameda",
      activeProperties: { population: 1649060, density: 2217 },
    });
    const { container } = render(<CountyPopulationLayer overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPopulationLayer selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-pop",
      "county-pop-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });
});

describe("PopulationLegend", () => {
  it("renders legend for total metric", () => {
    render(<PopulationLegend populationMetric="total" />);
    expect(screen.getByText("Population (2024)")).toBeInTheDocument();
  });

  it("renders legend for density metric", () => {
    render(<PopulationLegend populationMetric="density" />);
    expect(screen.getByText(/Density.*sq mi.*2024/)).toBeInTheDocument();
  });

  it("defaults to total metric", () => {
    render(<PopulationLegend />);
    expect(screen.getByText("Population (2024)")).toBeInTheDocument();
  });

  it("renders 7 color stops", () => {
    const { container } = render(<PopulationLegend />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(7);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<PopulationLegend overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });

  it("uses default position when overlayOffset is 0", () => {
    const { container } = render(<PopulationLegend overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});

describe("POPULATION_LABELS", () => {
  it("exports correct labels", () => {
    expect(POPULATION_LABELS.total).toBe("Total Population");
    expect(POPULATION_LABELS.density).toBe("Density (per sq mi)");
  });
});
