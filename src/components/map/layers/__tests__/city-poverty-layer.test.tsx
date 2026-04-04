import { render, screen } from "@testing-library/react";
import CityPovertyLayer, { CityPovertyLegend } from "@/components/map/layers/city-poverty-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityPovertyLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPovertyLayer />);

    expect(screen.getByTestId("Source-cities-poverty")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-poverty-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-poverty-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-poverty-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-poverty-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-poverty-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-poverty-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup when activeName and poverty value are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Compton",
      activeProperties: { poverty: 25.1 },
    });

    render(<CityPovertyLayer />);
    expect(screen.getByText("Compton")).toBeInTheDocument();
    expect(screen.getByText(/25\.1%/)).toBeInTheDocument();
  });

  it("does not show popup when activeName is null", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPovertyLayer />);
    expect(screen.queryByText(/Poverty Rate/)).not.toBeInTheDocument();
  });

  it("handles poverty as string", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Parlier",
      activeProperties: { poverty: "32.5" },
    });
    render(<CityPovertyLayer />);
    expect(screen.getByText("Parlier")).toBeInTheDocument();
    expect(screen.getByText(/32\.5%/)).toBeInTheDocument();
  });

  it("handles null properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test City",
      activeProperties: null,
    });
    render(<CityPovertyLayer />);
    expect(screen.queryByText("Test City")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Oakland",
      activeProperties: { poverty: 15.7 },
    });
    const { container } = render(<CityPovertyLayer overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityPovertyLayer selectName="San Jose" />);
    expect(spy).toHaveBeenCalledWith(
      "cities-poverty",
      "city-poverty-fill",
      expect.objectContaining({ selectName: "San Jose" }),
    );
  });

  it("shows popup for CDP with poverty data", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fallbrook",
      activeProperties: { poverty: 14.8, placeType: "cdp" },
    });
    render(<CityPovertyLayer />);
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText(/14\.8%/)).toBeInTheDocument();
  });
});

describe("CityPovertyLegend", () => {
  it("renders legend with title", () => {
    render(<CityPovertyLegend />);
    expect(screen.getByText(/Poverty Rate.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<CityPovertyLegend />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<CityPovertyLegend overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });
});
