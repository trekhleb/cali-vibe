import { render, screen } from "@testing-library/react";
import CountyHousingLayer, { HousingLegend, HOUSING_LABELS, type HousingMetric } from "@/components/map/layers/county-housing-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyHousingLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers for homeValue metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyHousingLayer housingMetric="homeValue" />);

    expect(screen.getByTestId("Source-counties-housing")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-housing-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-labels-highlight")).toBeInTheDocument();
  });

  it("renders sources and layers for rent metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyHousingLayer housingMetric="rent" />);

    expect(screen.getByTestId("Source-counties-housing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-fill")).toBeInTheDocument();
  });

  it("renders sources and layers for income metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyHousingLayer housingMetric="income" />);

    expect(screen.getByTestId("Source-counties-housing")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-housing-fill")).toBeInTheDocument();
  });

  it("shows popup with home value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Mateo",
      activeProperties: { housing: { homeValue: 1494500, rent: 2500 } },
    });

    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText("San Mateo County")).toBeInTheDocument();
    expect(screen.getByText(/\$1\.49M/)).toBeInTheDocument();
  });

  it("shows popup with rent value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alameda",
      activeProperties: { housing: { homeValue: 1057400, rent: 2318 } },
    });

    render(<CountyHousingLayer housingMetric="rent" />);
    expect(screen.getByText("Alameda County")).toBeInTheDocument();
    expect(screen.getByText(/\$2,318\/mo/)).toBeInTheDocument();
  });

  it("formats home value under 1M as $XK", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Imperial",
      activeProperties: { housing: { homeValue: 212000, rent: 1000 } },
    });

    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText(/\$212K/)).toBeInTheDocument();
  });

  it("shows popup with income value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Santa Clara",
      activeProperties: { housing: { homeValue: 1500000, rent: 2800, income: 159674 } },
    });

    render(<CountyHousingLayer housingMetric="income" />);
    expect(screen.getByText("Santa Clara County")).toBeInTheDocument();
    expect(screen.getByText(/\$160K\/yr/)).toBeInTheDocument();
  });

  it("handles null properties gracefully (no popup)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: null,
    });
    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles missing housing property gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: { population: 5000 },
    });
    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("handles null metric value (e.g. Alpine rent)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: { housing: { homeValue: 466100, rent: null } },
    });
    render(<CountyHousingLayer housingMetric="rent" />);
    // null rent → no popup
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles housing data as JSON string (serialized)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fresno",
      activeProperties: { housing: JSON.stringify({ homeValue: 350000, rent: 1200 }) },
    });
    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.getByText("Fresno County")).toBeInTheDocument();
    expect(screen.getByText(/\$350K/)).toBeInTheDocument();
  });

  it("handles invalid JSON string gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Broken",
      activeProperties: { housing: "not-json" },
    });
    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText("Broken County")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "LA",
      activeProperties: { housing: { homeValue: 900000, rent: 2000 } },
    });
    const { container } = render(<CountyHousingLayer housingMetric="homeValue" overlayOffset={200} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "224px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyHousingLayer housingMetric="homeValue" selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-housing",
      "county-housing-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });

  it("does not show popup when activeName is null even with properties", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: null,
      activeProperties: { housing: { homeValue: 500000, rent: 1500 } },
    });
    render(<CountyHousingLayer housingMetric="homeValue" />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });
});

describe("HousingLegend", () => {
  it("renders legend title for homeValue", () => {
    render(<HousingLegend housingMetric="homeValue" />);
    expect(screen.getByText(/Median Home Value.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for rent", () => {
    render(<HousingLegend housingMetric="rent" />);
    expect(screen.getByText(/Median Gross Rent.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops for homeValue", () => {
    const { container } = render(<HousingLegend housingMetric="homeValue" />);
    const colorBoxes = container.querySelectorAll(".h-3.w-8");
    expect(colorBoxes).toHaveLength(5);
  });

  it("renders 5 color stops for rent", () => {
    const { container } = render(<HousingLegend housingMetric="rent" />);
    const colorBoxes = container.querySelectorAll(".h-3.w-8");
    expect(colorBoxes).toHaveLength(5);
  });

  it("renders legend title for income", () => {
    render(<HousingLegend housingMetric="income" />);
    expect(screen.getByText(/Median Household Income.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops for income", () => {
    const { container } = render(<HousingLegend housingMetric="income" />);
    const colorBoxes = container.querySelectorAll(".h-3.w-8");
    expect(colorBoxes).toHaveLength(5);
  });

  it("formats income legend labels as $XK", () => {
    render(<HousingLegend housingMetric="income" />);
    expect(screen.getByText("$50K")).toBeInTheDocument();
    expect(screen.getByText("$75K")).toBeInTheDocument();
    expect(screen.getByText("$160K")).toBeInTheDocument();
  });

  it("formats homeValue legend labels as $XK and $XM", () => {
    render(<HousingLegend housingMetric="homeValue" />);
    expect(screen.getByText("$200K")).toBeInTheDocument();
    expect(screen.getByText("$400K")).toBeInTheDocument();
    expect(screen.getByText("$1.5M")).toBeInTheDocument();
  });

  it("formats rent legend labels as dollar amounts", () => {
    render(<HousingLegend housingMetric="rent" />);
    expect(screen.getByText("$800")).toBeInTheDocument();
    expect(screen.getByText("$1.2K")).toBeInTheDocument();
    expect(screen.getByText("$2.9K")).toBeInTheDocument();
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<HousingLegend housingMetric="homeValue" overlayOffset={150} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "174px" });
  });

  it("does not apply offset style when overlayOffset is 0", () => {
    const { container } = render(<HousingLegend housingMetric="homeValue" overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});

describe("HOUSING_LABELS", () => {
  it("has exactly 3 metrics", () => {
    expect(Object.keys(HOUSING_LABELS)).toHaveLength(3);
  });

  it("includes homeValue, rent, and income", () => {
    expect(HOUSING_LABELS.homeValue).toBe("Median Home Value");
    expect(HOUSING_LABELS.rent).toBe("Median Gross Rent");
    expect(HOUSING_LABELS.income).toBe("Median Household Income");
  });
});
