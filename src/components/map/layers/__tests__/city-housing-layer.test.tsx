import { render, screen } from "@testing-library/react";
import CityHousingLayer, { CityHousingLegend } from "@/components/map/layers/city-housing-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityHousingLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers for homeValue metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityHousingLayer housingMetric="homeValue" />);

    expect(screen.getByTestId("Source-cities-housing")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-housing-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-housing-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-housing-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-housing-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-housing-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-housing-labels-highlight")).toBeInTheDocument();
  });

  it("renders for rent metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityHousingLayer housingMetric="rent" />);
    expect(screen.getByTestId("Layer-city-housing-fill")).toBeInTheDocument();
  });

  it("renders for income metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityHousingLayer housingMetric="income" />);
    expect(screen.getByTestId("Layer-city-housing-fill")).toBeInTheDocument();
  });

  it("shows popup with home value when active city is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Palo Alto",
      activeProperties: { housing: { homeValue: 3200000, rent: 3100, income: 200000 } },
    });

    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText("Palo Alto")).toBeInTheDocument();
    expect(screen.getByText(/\$3\.20M/)).toBeInTheDocument();
  });

  it("shows popup with rent value when active city is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Oakland",
      activeProperties: { housing: { homeValue: 800000, rent: 1850, income: 85000 } },
    });

    render(<CityHousingLayer housingMetric="rent" />);
    expect(screen.getByText("Oakland")).toBeInTheDocument();
    expect(screen.getByText(/\$1,850\/mo/)).toBeInTheDocument();
  });

  it("shows popup with income value when active city is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Cupertino",
      activeProperties: { housing: { homeValue: 2500000, rent: 3000, income: 175000 } },
    });

    render(<CityHousingLayer housingMetric="income" />);
    expect(screen.getByText("Cupertino")).toBeInTheDocument();
    expect(screen.getByText(/\$175K\/yr/)).toBeInTheDocument();
  });

  it("formats home value under 1M as $XK", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fresno",
      activeProperties: { housing: { homeValue: 310000, rent: 1100, income: 55000 } },
    });

    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText(/\$310K/)).toBeInTheDocument();
  });

  it("handles null properties gracefully (no popup)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: null,
    });
    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("handles missing housing property gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: { population: 5000 },
    });
    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Median Home Value")).not.toBeInTheDocument();
  });

  it("handles housing data as JSON string (serialized)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Berkeley",
      activeProperties: { housing: JSON.stringify({ homeValue: 1250000, rent: 2200, income: 95000 }) },
    });
    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText("Berkeley")).toBeInTheDocument();
    expect(screen.getByText(/\$1\.25M/)).toBeInTheDocument();
  });

  it("handles invalid JSON string gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Broken",
      activeProperties: { housing: "not-json" },
    });
    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Broken")).not.toBeInTheDocument();
  });

  it("handles null metric value (e.g. rent)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "SmallTown",
      activeProperties: { housing: { homeValue: 200000, rent: null, income: 45000 } },
    });
    render(<CityHousingLayer housingMetric="rent" />);
    expect(screen.queryByText("SmallTown")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "LA",
      activeProperties: { housing: { homeValue: 900000, rent: 2000, income: 70000 } },
    });
    const { container } = render(<CityHousingLayer housingMetric="homeValue" overlayOffset={200} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "224px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityHousingLayer housingMetric="homeValue" selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-housing",
      "city-housing-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });

  it("shows popup for CDP with housing data", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { housing: { homeValue: 713000, rent: 1675, income: 87293 }, placeType: "cdp" },
    });

    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/\$713K/)).toBeInTheDocument();
  });

  it("does not show popup when activeName is null even with properties", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: null,
      activeProperties: { housing: { homeValue: 500000, rent: 1500, income: 80000 } },
    });
    render(<CityHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText(/Median/)).not.toBeInTheDocument();
  });
});

describe("CityHousingLegend", () => {
  it("renders legend title for homeValue", () => {
    render(<CityHousingLegend housingMetric="homeValue" />);
    expect(screen.getByText(/Median Home Value.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for rent", () => {
    render(<CityHousingLegend housingMetric="rent" />);
    expect(screen.getByText(/Median Gross Rent.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for income", () => {
    render(<CityHousingLegend housingMetric="income" />);
    expect(screen.getByText(/Median Household Income.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<CityHousingLegend housingMetric="homeValue" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("formats homeValue legend labels as $XK and $XM", () => {
    render(<CityHousingLegend housingMetric="homeValue" />);
    expect(screen.getByText("$200K")).toBeInTheDocument();
    expect(screen.getByText("$1.5M")).toBeInTheDocument();
  });

  it("formats rent legend labels", () => {
    render(<CityHousingLegend housingMetric="rent" />);
    expect(screen.getByText("$800")).toBeInTheDocument();
    expect(screen.getByText("$1.2K")).toBeInTheDocument();
    expect(screen.getByText("$2.9K")).toBeInTheDocument();
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityHousingLegend housingMetric="homeValue" overlayOffset={150} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "174px" });
  });

  it("does not apply offset style when overlayOffset is 0", () => {
    const { container } = render(<CityHousingLegend housingMetric="homeValue" overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});
