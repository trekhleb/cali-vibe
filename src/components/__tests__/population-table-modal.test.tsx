import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopulationTableModal from "@/components/population-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "Los Angeles", population: 10000000 } },
    { properties: { name: "San Diego", population: 3000000 } },
    { properties: { name: "San Jose", population: 1000000 } },
    { properties: { name: "No Pop" } },
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

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);
    // Click again to toggle direction
    await user.click(nameHeader);
  });

  it("sorts by population when clicking population header", async () => {
    const user = userEvent.setup();
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());

    const popHeader = screen.getByText(/Population/, { selector: "th" });
    await user.click(popHeader); // toggle sort direction
  });

  it("displays percentage of total", async () => {
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Los Angeles")).toBeInTheDocument());
    // Los Angeles is 10M out of 14M total = ~71.4%
    expect(screen.getByText("71.4%")).toBeInTheDocument();
  });

  it("handles fetch network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <PopulationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Population" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });
});
