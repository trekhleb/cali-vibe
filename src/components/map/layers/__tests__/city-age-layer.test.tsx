import { render, screen } from "@testing-library/react";
import CityAgeLayer, { CityAgeLegend } from "@/components/map/layers/city-age-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityAgeLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityAgeLayer ageMetric="medianAge" />);

    expect(screen.getByTestId("Source-cities-age")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-age-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-age-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-age-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-age-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-age-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-age-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup when activeName and age value are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Jose",
      activeProperties: { age: { under18: 21.5, age18_34: 22.0, age35_64: 39.8, age65plus: 16.7, medianAge: 37.8 } },
    });

    render(<CityAgeLayer ageMetric="medianAge" />);
    expect(screen.getByText("San Jose")).toBeInTheDocument();
    expect(screen.getByText(/37\.8/)).toBeInTheDocument();
  });

  it("shows popup with under18 percentage", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Irvine",
      activeProperties: { age: { under18: 22.1, age18_34: 26.3, age35_64: 36.5, age65plus: 15.1, medianAge: 35.2 } },
    });

    render(<CityAgeLayer ageMetric="under18" />);
    expect(screen.getByText("Irvine")).toBeInTheDocument();
    expect(screen.getByText(/22\.1%/)).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Los Angeles",
      activeProperties: { age: "invalid" },
    });
    render(<CityAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText("Los Angeles")).not.toBeInTheDocument();
  });

  it("handles null properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test City",
      activeProperties: null,
    });
    render(<CityAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText("Test City")).not.toBeInTheDocument();
  });

  it("handles age data as JSON string", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Cupertino",
      activeProperties: { age: JSON.stringify({ under18: 20.0, age18_34: 18.5, age35_64: 42.0, age65plus: 19.5, medianAge: 42.3 }) },
    });
    render(<CityAgeLayer ageMetric="medianAge" />);
    expect(screen.getByText("Cupertino")).toBeInTheDocument();
    expect(screen.getByText(/42\.3/)).toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Oakland",
      activeProperties: { age: { under18: 20.0, age18_34: 24.0, age35_64: 38.0, age65plus: 18.0, medianAge: 37.0 } },
    });
    const { container } = render(<CityAgeLayer ageMetric="medianAge" overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("shows popup for CDP with age data", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { age: { under18: 26.0, age18_34: 25.1, age35_64: 31.8, age65plus: 17.1, medianAge: 34.4 }, placeType: "cdp" },
    });

    render(<CityAgeLayer ageMetric="medianAge" />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/34\.4/)).toBeInTheDocument();
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityAgeLayer ageMetric="medianAge" selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-age",
      "city-age-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });
});

describe("CityAgeLegend", () => {
  it("renders legend with correct age metric", () => {
    render(<CityAgeLegend ageMetric="medianAge" />);
    expect(screen.getByText(/Median Age.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<CityAgeLegend ageMetric="under18" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityAgeLegend ageMetric="age65plus" overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });
});
