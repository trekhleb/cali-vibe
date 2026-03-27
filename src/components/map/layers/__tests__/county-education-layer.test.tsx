import { render, screen } from "@testing-library/react";
import CountyEducationLayer, { EducationLegend, EDUCATION_LABELS } from "@/components/map/layers/county-education-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyEducationLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers for bachPlus metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyEducationLayer educationMetric="bachPlus" />);

    expect(screen.getByTestId("Source-counties-education")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-education-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-labels-highlight")).toBeInTheDocument();
  });

  it("renders sources and layers for hsPlus metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyEducationLayer educationMetric="hsPlus" />);

    expect(screen.getByTestId("Source-counties-education")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-fill")).toBeInTheDocument();
  });

  it("renders sources and layers for gradPlus metric", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyEducationLayer educationMetric="gradPlus" />);

    expect(screen.getByTestId("Source-counties-education")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-education-fill")).toBeInTheDocument();
  });

  it("shows popup with bachPlus value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "San Francisco",
      activeProperties: { education: { bachPlus: 58.3, hsPlus: 88.1, gradPlus: 24.5 } },
    });

    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.getByText("San Francisco County")).toBeInTheDocument();
    expect(screen.getByText(/58\.3%/)).toBeInTheDocument();
  });

  it("shows popup with hsPlus value when active county is present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alameda",
      activeProperties: { education: { bachPlus: 48.2, hsPlus: 89.5, gradPlus: 20.1 } },
    });

    render(<CountyEducationLayer educationMetric="hsPlus" />);
    expect(screen.getByText("Alameda County")).toBeInTheDocument();
    expect(screen.getByText(/89\.5%/)).toBeInTheDocument();
  });

  it("handles null properties gracefully (no popup)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: null,
    });
    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles missing education property gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: { population: 5000 },
    });
    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("handles education data as JSON string (serialized)", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fresno",
      activeProperties: { education: JSON.stringify({ bachPlus: 22.1, hsPlus: 75.3, gradPlus: 8.4 }) },
    });
    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.getByText("Fresno County")).toBeInTheDocument();
    expect(screen.getByText(/22\.1%/)).toBeInTheDocument();
  });

  it("handles invalid JSON string gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Broken",
      activeProperties: { education: "not-json" },
    });
    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText("Broken County")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "LA",
      activeProperties: { education: { bachPlus: 32.0, hsPlus: 78.0, gradPlus: 12.0 } },
    });
    const { container } = render(<CountyEducationLayer educationMetric="bachPlus" overlayOffset={200} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "224px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyEducationLayer educationMetric="bachPlus" selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-education",
      "county-education-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });

  it("does not show popup when activeName is null even with properties", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: null,
      activeProperties: { education: { bachPlus: 50.0, hsPlus: 90.0, gradPlus: 20.0 } },
    });
    render(<CountyEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });
});

describe("EducationLegend", () => {
  it("renders legend title for bachPlus", () => {
    render(<EducationLegend educationMetric="bachPlus" />);
    expect(screen.getByText(/Bachelor's Degree or Higher.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for hsPlus", () => {
    render(<EducationLegend educationMetric="hsPlus" />);
    expect(screen.getByText(/High School Diploma or Higher.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders legend title for gradPlus", () => {
    render(<EducationLegend educationMetric="gradPlus" />);
    expect(screen.getByText(/Graduate Degree or Higher.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops for each metric", () => {
    const { container: c1 } = render(<EducationLegend educationMetric="bachPlus" />);
    expect(c1.querySelectorAll(".h-3.w-8")).toHaveLength(5);

    const { container: c2 } = render(<EducationLegend educationMetric="hsPlus" />);
    expect(c2.querySelectorAll(".h-3.w-8")).toHaveLength(5);

    const { container: c3 } = render(<EducationLegend educationMetric="gradPlus" />);
    expect(c3.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<EducationLegend educationMetric="bachPlus" overlayOffset={150} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "174px" });
  });

  it("does not apply offset style when overlayOffset is 0", () => {
    const { container } = render(<EducationLegend educationMetric="bachPlus" overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});

describe("EDUCATION_LABELS", () => {
  it("has exactly 3 metrics", () => {
    expect(Object.keys(EDUCATION_LABELS)).toHaveLength(3);
  });

  it("includes bachPlus, hsPlus, and gradPlus", () => {
    expect(EDUCATION_LABELS.bachPlus).toBe("Bachelor's Degree or Higher");
    expect(EDUCATION_LABELS.hsPlus).toBe("High School Diploma or Higher");
    expect(EDUCATION_LABELS.gradPlus).toBe("Graduate Degree or Higher");
  });
});
