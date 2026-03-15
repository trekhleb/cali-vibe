import { render, screen } from "@testing-library/react";
import CountyCrimeLayer, { CrimeLegend } from "@/components/map/layers/county-crime-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CountyCrimeLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyCrimeLayer crimeType="total" />);
    
    expect(screen.getByTestId("Source-counties-crime")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-crime-fill")).toBeInTheDocument();
  });

  it("shows popup when activeName and activeRate are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ 
      activeName: "Alameda",
      activeProperties: { crime: { total: 4321.0 } }
    });
    
    render(<CountyCrimeLayer crimeType="total" overlayOffset={100} />);
    expect(screen.getByText("Alameda County")).toBeInTheDocument();
    expect(screen.getByText(/4321\.0/)).toBeInTheDocument();
  });

  it("handles empty properties gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ 
      activeName: "Santa Clara",
      activeProperties: null
    });
    render(<CountyCrimeLayer crimeType="total" />);
    expect(screen.queryByText(/per 100K/)).not.toBeInTheDocument();
  });
});

describe("CrimeLegend", () => {
  it("renders legend format over 1K", () => {
    render(<CrimeLegend crimeType="total" overlayOffset={50} />);
    expect(screen.getByText("1K")).toBeInTheDocument();
  });

  it("renders legend format under 1K", () => {
    render(<CrimeLegend crimeType="homicide" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
