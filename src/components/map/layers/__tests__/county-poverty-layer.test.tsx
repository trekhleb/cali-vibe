import { render, screen } from "@testing-library/react";
import CountyPovertyLayer, { PovertyLegend, POVERTY_LABEL } from "@/components/map/layers/county-poverty-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyPovertyLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPovertyLayer />);

    expect(screen.getByTestId("Source-counties-poverty")).toBeInTheDocument();
    expect(screen.getByTestId("Source-county-poverty-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-poverty-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-poverty-borders")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-poverty-borders-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-poverty-labels-dim")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-poverty-labels-highlight")).toBeInTheDocument();
  });

  it("shows popup when activeName and poverty value are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Fresno",
      activeProperties: { poverty: 22.5 },
    });

    render(<CountyPovertyLayer />);
    expect(screen.getByText("Fresno County")).toBeInTheDocument();
    expect(screen.getByText(/22\.5%/)).toBeInTheDocument();
  });

  it("does not show popup when activeName is null", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPovertyLayer />);
    expect(screen.queryByText(/County/)).not.toBeInTheDocument();
  });

  it("does not show popup when poverty is missing", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alpine",
      activeProperties: {},
    });
    render(<CountyPovertyLayer />);
    expect(screen.queryByText("Alpine County")).not.toBeInTheDocument();
  });

  it("handles poverty as string", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Kern",
      activeProperties: { poverty: "18.3" },
    });
    render(<CountyPovertyLayer />);
    expect(screen.getByText("Kern County")).toBeInTheDocument();
    expect(screen.getByText(/18\.3%/)).toBeInTheDocument();
  });

  it("handles null properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Test",
      activeProperties: null,
    });
    render(<CountyPovertyLayer />);
    expect(screen.queryByText("Test County")).not.toBeInTheDocument();
  });

  it("applies overlayOffset to popup style", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({
      activeName: "Alameda",
      activeProperties: { poverty: 10.2 },
    });
    const { container } = render(<CountyPovertyLayer overlayOffset={100} />);
    const popup = container.querySelector(".absolute.rounded-lg");
    expect(popup).toHaveStyle({ left: "124px", top: "24px" });
  });

  it("passes selectName to useMapInteraction", () => {
    const spy = vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyPovertyLayer selectName="Los Angeles" />);
    expect(spy).toHaveBeenCalledWith(
      "counties-poverty",
      "county-poverty-fill",
      expect.objectContaining({ selectName: "Los Angeles" }),
    );
  });

  it("exports POVERTY_LABEL constant", () => {
    expect(POVERTY_LABEL).toBe("Poverty Rate");
  });
});

describe("PovertyLegend", () => {
  it("renders legend with title", () => {
    render(<PovertyLegend />);
    expect(screen.getByText(/Poverty Rate.*ACS 2019/)).toBeInTheDocument();
  });

  it("renders 5 color stops", () => {
    const { container } = render(<PovertyLegend />);
    expect(container.querySelectorAll(".h-3.w-8")).toHaveLength(5);
  });

  it("applies overlayOffset style", () => {
    const { container } = render(<PovertyLegend overlayOffset={50} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend).toHaveStyle({ left: "74px" });
  });

  it("uses default position when overlayOffset is 0", () => {
    const { container } = render(<PovertyLegend overlayOffset={0} />);
    const legend = container.firstChild as HTMLElement;
    expect(legend.style.left).toBe("");
  });
});
