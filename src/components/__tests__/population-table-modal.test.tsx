import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopulationTableModal from "@/components/population-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "Los Angeles", population: 10000000, area: 4058.5, density: 2464.2 } },
    { properties: { name: "San Diego", population: 3000000, area: 4260.9, density: 704.1 } },
    { properties: { name: "San Jose", population: 1000000, area: 180.5, density: 5540.2 } },
    { properties: { name: "No Pop" } },
    { properties: { name: "Fallbrook", population: 32467, area: 17.6, density: 1844.7, placeType: "cdp" } },
  ],
};

describe("PopulationTableModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGeoJson),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    expect(screen.getByText("San Diego")).toBeInTheDocument();
    expect(screen.getByText("San Jose")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <PopulationTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders all column headers", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    expect(screen.getByText("County", { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/Pop\./, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText("%", { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText("mi²", { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/\/mi²/, { selector: "th" })).toBeInTheDocument();
  });

  it("displays density values", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    // San Jose has density 5540.2 → formatted as "5,540"
    expect(screen.getByText("5,540")).toBeInTheDocument();
  });

  it("displays area values", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    expect(screen.getByText("4,058.5")).toBeInTheDocument();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);
    await user.click(nameHeader);
  });

  it("sorts by population when clicking pop header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const popHeader = screen.getByText(/Pop\./, { selector: "th" });
    await user.click(popHeader);
  });

  it("sorts by density when clicking density header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const densityHeader = screen.getByText(/\/mi²/, { selector: "th" });
    await user.click(densityHeader);
  });

  it("sorts by area when clicking area header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const areaHeader = screen.getByText("mi²", { selector: "th" });
    await user.click(areaHeader);
  });

  it("displays percentage of total", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    // Los Angeles is 10M out of 14,032,467 total = ~71.3%
    expect(screen.getByText("71.3%")).toBeInTheDocument();
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "Los Angeles" });
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <PopulationTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Population" nameLabel="County" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Los Angeles" }));
    expect(onSelectName).toHaveBeenCalledWith("Los Angeles");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "Los Angeles" })).toBeNull();
  });

  it("includes CDPs with population in the table", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="City" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    // CDPs with population should appear in the population table
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
    expect(screen.getByText("32,467")).toBeInTheDocument();
    expect(screen.getByText("1,845")).toBeInTheDocument(); // density rounded
  });

  it("handles missing area and density gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [{ properties: { name: "OldCounty", population: 5000 } }],
      }),
    }));
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("OldCounty")).toBeInTheDocument());
    // area and density default to 0
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });

  it("handles fetch network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });
});
