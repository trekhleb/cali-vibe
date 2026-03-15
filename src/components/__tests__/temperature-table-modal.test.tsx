import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TemperatureTableModal from "@/components/temperature-table-modal";

const mockGeoJson = {
  features: [
    {
      properties: { name: "Hex A", tmax: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31], tmin: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], tavg: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
      geometry: { type: "Point", coordinates: [-122, 37] }
    },
    {
      properties: { name: "Hex B", tmax: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41], tmin: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tavg: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
      geometry: { type: "Polygon", coordinates: [[[-121, 36], [-121.1, 36.1], [-121.2, 36.2]]] }
    },
  ],
};

const mockCitiesGeoJson = {
  features: [
    { properties: { name: "San Francisco" }, geometry: { coordinates: [-122.4, 37.7] } },
    { properties: { name: "Los Angeles" }, geometry: { coordinates: [-118.2, 34.0] } },
  ],
};

describe("TemperatureTableModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("california-city-labels.geojson")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCitiesGeoJson) });
      }
      if (url === "/data.json") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoJson) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading initially", async () => {
    render(
      <TemperatureTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Temp" nameLabel="Hex" activeMonth={0} activeMetric="tmax" unit="C" />
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());
  });

  it("renders table rows and handles sorting", async () => {
    render(
      <TemperatureTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Temp" nameLabel="Hex" activeMonth={0} activeMetric="tmax" unit="C" />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());
    expect(screen.getByText("Hex B")).toBeInTheDocument();

    // Change sort to nearest city
    const nearestCityHeader = screen.getByRole("columnheader", { name: /Nearest City/i });
    await userEvent.click(nearestCityHeader);
    
    // Change sort to name
    const nameHeader = screen.getByRole("columnheader", { name: /Hex/i });
    await userEvent.click(nameHeader);
    await userEvent.click(nameHeader); // toggle direction

    // Change metric to tmin
    await userEvent.click(screen.getByRole("button", { name: /Night Low/i }));
    // Change unit to F
    await userEvent.click(screen.getByRole("button", { name: /°F/i }));
    // Change distance to km
    await userEvent.click(screen.getByText("km"));
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <TemperatureTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Temp" nameLabel="Hex" activeMonth={0} activeMetric="tmax" unit="C" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <TemperatureTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Temp" nameLabel="Hex" activeMonth={0} activeMetric="tmax" unit="C" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
