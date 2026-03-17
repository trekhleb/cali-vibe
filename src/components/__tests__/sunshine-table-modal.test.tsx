import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SunshineTableModal from "@/components/sunshine-table-modal";
import { ANNUAL_MONTH } from "@/components/map/layers/sunshine-layer";

const mockGeoJson = {
  features: [
    {
      properties: {
        h3: "abc123",
        name: "Hex A",
        sunshine: [6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 7, 6],
      },
      geometry: { type: "Point", coordinates: [-122, 37] },
    },
    {
      properties: {
        h3: "def456",
        name: "Hex B",
        sunshine: [5, 6, 7, 8, 9, 10, 11, 10, 9, 8, 6, 5],
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[-121, 36], [-121.1, 36.1], [-121.2, 36.2]]],
      },
    },
  ],
};

const mockCitiesGeoJson = {
  features: [
    { properties: { name: "San Francisco" }, geometry: { coordinates: [-122.4, 37.7] } },
    { properties: { name: "Los Angeles" }, geometry: { coordinates: [-118.2, 34.0] } },
  ],
};

describe("SunshineTableModal", () => {
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
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());
    expect(screen.getByText("Hex B")).toBeInTheDocument();
    expect(screen.getAllByText("San Francisco").length).toBeGreaterThan(0);
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <SunshineTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles sorting by name and nearest city", async () => {
    const user = userEvent.setup();
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    const nameHeader = screen.getByRole("columnheader", { name: /Hex/i });
    await user.click(nameHeader);
    await user.click(nameHeader); // toggle direction

    const nearestCityHeader = screen.getByRole("columnheader", { name: /Nearest City/i });
    await user.click(nearestCityHeader);
  });

  it("handles sorting by month column", async () => {
    const user = userEvent.setup();
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    const janHeader = screen.getByRole("columnheader", { name: /Jan/i });
    await user.click(janHeader);
  });

  it("handles sorting by annual average", async () => {
    const user = userEvent.setup();
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={ANNUAL_MONTH} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    const avgHeader = screen.getByRole("columnheader", { name: /Avg/i });
    await user.click(avgHeader); // toggle direction
  });

  it("switches distance unit between mi and km", async () => {
    const user = userEvent.setup();
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    await user.click(screen.getByText("km"));
    expect(screen.getAllByText(/km/)[0]).toBeInTheDocument();

    await user.click(screen.getByText("mi"));
  });

  it("renders names as clickable links when onSelectHex is provided", async () => {
    const onSelectHex = vi.fn();
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} onSelectHex={onSelectHex} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "Hex A" });
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectHex and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectHex = vi.fn();
    const onClose = vi.fn();
    render(
      <SunshineTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} onSelectHex={onSelectHex} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Hex A" }));
    expect(onSelectHex).toHaveBeenCalledWith("abc123");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectHex is not provided", async () => {
    render(
      <SunshineTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Sunshine" nameLabel="Hex" activeMonth={0} />
    );
    await waitFor(() => expect(screen.getByText("Hex A")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "Hex A" })).toBeNull();
  });
});
