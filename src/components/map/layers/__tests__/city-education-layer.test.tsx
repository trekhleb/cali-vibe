import { render, screen } from "@testing-library/react";
import CityEducationLayer, { CityEducationLegend } from "@/components/map/layers/city-education-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityEducationLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityEducationLayer educationMetric="bachPlus" />);

    expect(screen.getByTestId("Source-cities-education")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-education-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-education-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-education-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-education-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-education-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-education-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup when activeName and education value are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Palo Alto",
      activeProperties: { education: { bachPlus: 78.5, hsPlus: 97.2, gradPlus: 42.1 } },
    });

    render(<CityEducationLayer educationMetric="bachPlus" />);
    expect(screen.getByText("Palo Alto")).toBeInTheDocument();
    expect(screen.getByText(/78\.5%/)).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Los Angeles",
      activeProperties: { education: "invalid" },
    });
    render(<CityEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText(/Bachelor's/)).not.toBeInTheDocument();
  });

  it("handles null properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test City",
      activeProperties: null,
    });
    render(<CityEducationLayer educationMetric="bachPlus" />);
    expect(screen.queryByText("Test City")).not.toBeInTheDocument();
  });

  it("handles education data as JSON string", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Berkeley",
      activeProperties: { education: JSON.stringify({ bachPlus: 72.3, hsPlus: 95.1, gradPlus: 38.7 }) },
    });
    render(<CityEducationLayer educationMetric="bachPlus" />);
    expect(screen.getByText("Berkeley")).toBeInTheDocument();
    expect(screen.getByText(/72\.3%/)).toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Cupertino",
      activeProperties: { education: { bachPlus: 75.0, hsPlus: 96.0, gradPlus: 35.0 } },
    });
    const { container } = render(<CityEducationLayer educationMetric="bachPlus" overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityEducationLayer educationMetric="bachPlus" selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-education",
      "city-education-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });

  it("shows popup for CDP with education data", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { education: { hsPlus: 82.7, bachPlus: 27.3, gradPlus: 10.3 }, placeType: "cdp" },
    });
    render(<CityEducationLayer educationMetric="bachPlus" />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/27\.3%/)).toBeInTheDocument();
  });
});

describe("CityEducationLegend", () => {
  it("renders legend with correct education metric", () => {
    render(<CityEducationLegend educationMetric="bachPlus" />);
    expect(screen.getByText(/Bachelor's Degree or Higher.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<CityEducationLegend educationMetric="hsPlus" />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityEducationLegend educationMetric="bachPlus" overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });
});
