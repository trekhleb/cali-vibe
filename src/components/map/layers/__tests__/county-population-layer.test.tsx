import { render, screen } from "@testing-library/react";
import CountyPopulationLayer, { PopulationLegend } from "@/components/map/layers/county-population-layer";
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
    expect(screen.getByTestId("Layer-county-pop-fill")).toBeInTheDocument();
  });

  it("shows popup when activeName and activePop are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ 
      activeName: "Santa Clara",
      activeProperties: { population: 2000000 }
    });
    
    render(<CountyPopulationLayer overlayOffset={100} />);
    expect(screen.getByText("Santa Clara County")).toBeInTheDocument();
    expect(screen.getByText(/2,000,000/)).toBeInTheDocument();
  });
});

describe("PopulationLegend", () => {
  it("renders legend", () => {
    render(<PopulationLegend overlayOffset={50} />);
    expect(screen.getByText(/Population/i)).toBeInTheDocument();
  });
});
