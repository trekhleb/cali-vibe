import { render, screen } from "@testing-library/react";
import CaliforniaMap from "@/components/map/california-map";

vi.mock("react-map-gl/maplibre", () => ({
  Map: ({ children }: any) => <div data-testid="Map">{children}</div>,
  NavigationControl: () => <div data-testid="NavigationControl" />,
  ScaleControl: () => <div data-testid="ScaleControl" />,
  Source: ({ children, id }: any) => <div data-testid={`Source-[${id}]`}>{children}</div>,
  Layer: ({ id }: any) => <div data-testid={`Layer-[${id}]`} />,
}));

vi.mock("@/components/map/layers/county-borders-layer", () => ({ default: () => <div data-testid="CountyBordersLayer" /> }));
vi.mock("@/components/map/layers/county-population-layer", () => ({
  default: () => <div data-testid="CountyPopulationLayer" />,
  PopulationLegend: () => <div data-testid="PopulationLegend" />,
}));
vi.mock("@/components/map/layers/county-crime-layer", () => ({
  default: () => <div data-testid="CountyCrimeLayer" />,
  CrimeLegend: () => <div data-testid="CrimeLegend" />,
}));
vi.mock("@/components/map/layers/city-borders-layer", () => ({ default: () => <div data-testid="CityBordersLayer" /> }));
vi.mock("@/components/map/layers/city-crime-layer", () => ({
  default: () => <div data-testid="CityCrimeLayer" />,
  CityCrimeLegend: () => <div data-testid="CityCrimeLegend" />,
}));
vi.mock("@/components/map/layers/temperature-layer", () => ({
  default: () => <div data-testid="TemperatureLayer" />,
  TemperatureLegend: () => <div data-testid="TemperatureLegend" />,
}));

describe("CaliforniaMap", () => {
  it("renders default map with controls", () => {
    render(<CaliforniaMap />);
    expect(screen.getByTestId("Map")).toBeInTheDocument();
    expect(screen.getByTestId("NavigationControl")).toBeInTheDocument();
    expect(screen.getByTestId("ScaleControl")).toBeInTheDocument();

    // Layers are not rendered by default
    expect(screen.queryByTestId("Source-[terrain-dem]")).not.toBeInTheDocument();
    expect(screen.queryByTestId("CountyBordersLayer")).not.toBeInTheDocument();
  });

  it("renders terrain3d layer", () => {
    render(<CaliforniaMap terrain3d />);
    expect(screen.getByTestId("Source-[terrain-dem]")).toBeInTheDocument();
    expect(screen.getByTestId("Layer-[hillshade]")).toBeInTheDocument();
  });

  it("renders county borders", () => {
    render(<CaliforniaMap showCounties />);
    expect(screen.getByTestId("CountyBordersLayer")).toBeInTheDocument();
  });

  it("renders population layer", () => {
    render(<CaliforniaMap showPopulation />);
    expect(screen.getByTestId("CountyPopulationLayer")).toBeInTheDocument();
    expect(screen.getByTestId("PopulationLegend")).toBeInTheDocument();
  });

  it("renders city borders", () => {
    render(<CaliforniaMap showCities />);
    expect(screen.getByTestId("CityBordersLayer")).toBeInTheDocument();
  });

  it("renders crime layer", () => {
    render(<CaliforniaMap showCrime />);
    expect(screen.getByTestId("CountyCrimeLayer")).toBeInTheDocument();
    expect(screen.getByTestId("CrimeLegend")).toBeInTheDocument();
    
    // showCrime takes precedence over showPopulation and count borders 
    // for those layers visibility
    render(<CaliforniaMap showCrime showCounties showPopulation />);
    expect(screen.queryByTestId("CountyBordersLayer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("CountyPopulationLayer")).not.toBeInTheDocument();
  });

  it("renders city crime", () => {
    render(<CaliforniaMap showCityCrime />);
    expect(screen.getByTestId("CityCrimeLayer")).toBeInTheDocument();
    expect(screen.getByTestId("CityCrimeLegend")).toBeInTheDocument();
  });

  it("renders temperature layer", () => {
    render(<CaliforniaMap showTemperature />);
    expect(screen.getByTestId("TemperatureLayer")).toBeInTheDocument();
    expect(screen.getByTestId("TemperatureLegend")).toBeInTheDocument();
  });
});
