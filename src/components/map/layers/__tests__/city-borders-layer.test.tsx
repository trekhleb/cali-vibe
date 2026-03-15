import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CityBordersLayer from "@/components/map/layers/city-borders-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

vi.mock("@/components/heart-button", () => ({
  default: ({ onToggle }: any) => <button data-testid="HeartButton" onClick={onToggle}>Heart</button>,
}));

describe("CityBordersLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers with default props", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityBordersLayer />);
    
    expect(screen.getByTestId("Source-cities")).toBeInTheDocument();
    expect(screen.getByTestId("Source-city-labels-source")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-fill")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-city-borders")).toBeInTheDocument();
    
    // No active name popup
    expect(screen.queryByTestId("HeartButton")).not.toBeInTheDocument();
  });

  it("renders colored display mode", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CityBordersLayer displayMode="colored" />);
    expect(screen.getByTestId("Layer-city-fill")).toBeInTheDocument();
  });

  it("shows popup when activeName is truthy and handles favorite", async () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: "San Francisco" });
    const onToggleFavorite = vi.fn();
    
    // With offset and favorite interactions
    render(
      <CityBordersLayer 
        displayMode="borders" 
        activeName="San Francisco" 
        onToggleFavorite={onToggleFavorite} 
        isFavorite={(name) => name === "San Francisco"} 
        overlayOffset={300}
      />
    );
    
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    const btn = screen.getByTestId("HeartButton");
    await userEvent.click(btn);
    expect(onToggleFavorite).toHaveBeenCalledWith("San Francisco");
  });

  it("renders with activeName but no onToggleFavorite", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: "Los Angeles" });
    render(<CityBordersLayer />);
    expect(screen.getByText("Los Angeles")).toBeInTheDocument();
    expect(screen.queryByTestId("HeartButton")).not.toBeInTheDocument();
  });
});
