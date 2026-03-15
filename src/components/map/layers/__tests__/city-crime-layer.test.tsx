import { render, screen } from "@testing-library/react";
import CityCrimeLayer, { CityCrimeLegend } from "@/components/map/layers/city-crime-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

describe("CityCrimeLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityCrimeLayer crimeType="total" />);
    
    expect(screen.getByTestId("Source-cities-crime")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-crime-fill")).toBeInTheDocument();
  });

  it("shows popup when activeName and activeRate are present", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ 
      activeName: "San Francisco",
      activeProperties: { crime: JSON.stringify({ total: 1234.5 }) }
    });
    
    render(<CityCrimeLayer crimeType="total" overlayOffset={100} />);
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText(/1234\.5/)).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ 
      activeName: "Los Angeles",
      activeProperties: { crime: "invalid" }
    });
    render(<CityCrimeLayer crimeType="total" />);
    // Shouldn't show the rate, not crashing
    expect(screen.queryByText(/per 100K/)).not.toBeInTheDocument();
  });

  it("supports fallback to default scale config", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    // Any invalid crime type that falls back to default
    render(<CityCrimeLayer crimeType={"unknown" as any} />);
    expect(screen.getByTestId("Layer-city-crime-fill")).toBeInTheDocument();
  });
});

describe("CityCrimeLegend", () => {
  it("renders legend with correct crime type", () => {
    render(<CityCrimeLegend crimeType="total" overlayOffset={50} />);
    expect(screen.getByText(/All Crime Rate per 100K/i)).toBeInTheDocument();
  });

  it("renders with a crime type producing value > 1000", () => {
    render(<CityCrimeLegend crimeType="propertyTotal" />);
    expect(screen.getByText("1K")).toBeInTheDocument();
  });
});
