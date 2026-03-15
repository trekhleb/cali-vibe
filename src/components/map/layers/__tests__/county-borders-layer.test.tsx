import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CountyBordersLayer from "@/components/map/layers/county-borders-layer";
import * as useMapInteractionModule from "@/hooks/use-map-interaction";
import { vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  Source: ({ children, id }: any) => <div data-testid={`Source-${id}`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-${id}`} />,
}));

vi.mock("@/components/heart-button", () => ({
  default: ({ onToggle }: any) => <button data-testid="HeartButton" onClick={onToggle}>Heart</button>,
}));

describe("CountyBordersLayer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders sources and layers with default props", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyBordersLayer />);
    
    expect(screen.getByTestId("Source-counties")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-county-fill")).toBeInTheDocument();
  });

  it("renders colored display mode", () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: null });
    render(<CountyBordersLayer displayMode="colored" />);
    expect(screen.getByTestId("Layer-county-fill")).toBeInTheDocument();
  });

  it("shows popup when activeName is truthy and handles favorite", async () => {
    vi.spyOn(useMapInteractionModule, "useMapInteraction").mockReturnValue({ activeName: "San Mateo" });
    const onToggleFavorite = vi.fn();
    
    render(
      <CountyBordersLayer 
        displayMode="borders" 
        onToggleFavorite={onToggleFavorite} 
        isFavorite={(name) => name === "San Mateo"} 
        overlayOffset={300}
      />
    );
    
    expect(screen.getByText("San Mateo County")).toBeInTheDocument();
    const btn = screen.getByTestId("HeartButton");
    await userEvent.click(btn);
    expect(onToggleFavorite).toHaveBeenCalledWith("San Mateo");
  });
});
