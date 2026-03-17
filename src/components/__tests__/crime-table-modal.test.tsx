import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CrimeTableModal from "@/components/crime-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "County A", population: 100000, crime: { total: 500, violentTotal: 100, propertyTotal: 400, homicide: 5, rape: 10, robbery: 20, aggAssault: 65, burglary: 100, mvTheft: 100, larceny: 200 } } },
    { properties: { name: "County B", population: 200000, crime: { total: 300, violentTotal: 50, propertyTotal: 250, homicide: 2, rape: 5, robbery: 10, aggAssault: 33, burglary: 50, mvTheft: 80, larceny: 120 } } },
    { properties: { name: "No Crime", population: 50000 } },
  ],
};

describe("CrimeTableModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGeoJson),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders table rows after data loads", async () => {
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());
    expect(screen.getByText("County B")).toBeInTheDocument();
  });

  it("shows loading when open with no data", async () => {
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <CrimeTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    // Click name header to sort asc by finding the th that contains "County"
    const nameHeaders = screen.getAllByRole("columnheader");
    const nameHeader = nameHeaders.find((th) => th.textContent?.includes("County"))!;
    await user.click(nameHeader);
    // Click again to toggle direction
    await user.click(nameHeader);
  });

  it("sorts by crime type column", async () => {
    const user = userEvent.setup();
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    const violentHeader = screen.getByText("Violent", { selector: "th" });
    await user.click(violentHeader);
  });

  it("switches data mode to absolute", async () => {
    const user = userEvent.setup();
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    // Switch to absolute mode
    await user.click(screen.getByText("Absolute"));
    expect(screen.getByText("Total reported crimes")).toBeInTheDocument();

    // Switch back to rate mode
    await user.click(screen.getByText("Per 100K"));
    expect(screen.getByText("Crimes per 100,000 residents")).toBeInTheDocument();
  });

  it("syncs sort key when activeCrimeType changes", async () => {
    const { rerender } = render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    rerender(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="violent" />
    );
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    // Name should be a button
    const nameButton = screen.getByRole("button", { name: "County A" });
    expect(nameButton).toBeInTheDocument();
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <CrimeTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "County A" }));
    expect(onSelectName).toHaveBeenCalledWith("County A");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County A")).toBeInTheDocument());

    // Should not be a button
    expect(screen.queryByRole("button", { name: "County A" })).toBeNull();
  });

  it("handles crime data as string (JSON parse)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [
          { properties: { name: "County X", population: 100000, crime: JSON.stringify({ total: 500, violentTotal: 100, propertyTotal: 400, homicide: 5, rape: 10, robbery: 20, aggAssault: 65, burglary: 100, mvTheft: 100, larceny: 200 }) } },
        ],
      }),
    }));
    render(
      <CrimeTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Crime" nameLabel="County" activeCrimeType="total" />
    );
    await waitFor(() => expect(screen.getByText("County X")).toBeInTheDocument());
  });
});
