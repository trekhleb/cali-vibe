import { render, screen } from "@testing-library/react";
import CountyAgeLayer, { AgeLegend, AGE_LABELS } from "@/components/map/layers/county-age-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyAgeLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers for medianAge metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyAgeLayer ageMetric="medianAge" />);

    expect(screen.getByTestId("Source-counties-age")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-age-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-age-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-age-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-age-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-age-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-age-labels-highlight")).toBeInTheDocument();
  });

  it("renders for under18 metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyAgeLayer ageMetric="under18" />);
    expect(screen.getByTestId("Layer-county-age-fill")).toBeInTheDocument();
  });

  it("renders for age65plus metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyAgeLayer ageMetric="age65plus" />);
    expect(screen.getByTestId("Layer-county-age-fill")).toBeInTheDocument();
  });

  it("shows popup with medianAge value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Los Angeles",
      activeProperties: { age: { under18: 20.9, age18_34: 24.1, age35_64: 38.5, age65plus: 16.5, medianAge: 37.9 } },
    });

    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.getByText("Los Angeles County")).toBeInTheDocument();
    expect(screen.getByText(/37\.9/)).toBeInTheDocument();
  });

  it("shows popup with under18 percentage when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Marin",
      activeProperties: { age: { under18: 19.5, age18_34: 15.2, age35_64: 42.1, age65plus: 23.2, medianAge: 46.5 } },
    });

    render(<CountyAgeLayer ageMetric="under18" />);
    expect(screen.getByText("Marin County")).toBeInTheDocument();
    expect(screen.getByText(/19\.5%/)).toBeInTheDocument();
  });

  it("handles null properties gracefully (no popup)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: null,
    });
    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles missing age property gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: { population: 5000 },
    });
    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("handles age data as JSON string (serialized)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Francisco",
      activeProperties: { age: JSON.stringify({ under18: 13.7, age18_34: 27.5, age35_64: 40.1, age65plus: 18.7, medianAge: 39.7 }) },
    });
    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.getByText("San Francisco County")).toBeInTheDocument();
    expect(screen.getByText(/39\.7/)).toBeInTheDocument();
  });

  it("handles invalid JSON string gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Broken",
      activeProperties: { age: "not-json" },
    });
    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText("Broken County")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "LA",
      activeProperties: { age: { under18: 20.0, age18_34: 24.0, age35_64: 38.0, age65plus: 18.0, medianAge: 37.0 } },
    });
    const { container } = render(<CountyAgeLayer ageMetric="medianAge" overlayOffset={200} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "224px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyAgeLayer ageMetric="medianAge" selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-age",
      "county-age-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });

  it("does not show popup when activeName is null even with properties", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: null,
      activeProperties: { age: { under18: 20.0, age18_34: 24.0, age35_64: 38.0, age65plus: 18.0, medianAge: 37.0 } },
    });
    render(<CountyAgeLayer ageMetric="medianAge" />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });
});

describe("AgeLegend", () => {
  it("renders legend title for medianAge", () => {
    render(<AgeLegend ageMetric="medianAge" />);
    expect(screen.getByText(/Median Age.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for under18", () => {
    render(<AgeLegend ageMetric="under18" />);
    expect(screen.getByText(/Under 18.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for age65plus", () => {
    render(<AgeLegend ageMetric="age65plus" />);
    expect(screen.getByText(/65\+.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops for each metric", () => {
    const { container } = render(<AgeLegend ageMetric="medianAge" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<AgeLegend ageMetric="medianAge" overlayOffset={150} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "174px" });
  });

  it("does not apply offset style when overlayOffset is 0", () => {
    const { container } = render(<AgeLegend ageMetric="medianAge" overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});

describe("AGE_LABELS", () => {
  it("has exactly 5 metrics", () => {
    expect(Object.keys(AGE_LABELS)).toHaveLength(5);
  });

  it("includes all age metrics", () => {
    expect(AGE_LABELS.under18).toBe("Under 18");
    expect(AGE_LABELS.age18_34).toBe("18–34");
    expect(AGE_LABELS.age35_64).toBe("35–64");
    expect(AGE_LABELS.age65plus).toBe("65+");
    expect(AGE_LABELS.medianAge).toBe("Median Age");
  });
});
