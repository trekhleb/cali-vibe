import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RaceTableModal from "@/components/race-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "San Francisco", race: { white: 37.5, hispanic: 15.9, black: 4.8, asian: 34.7, other: 7.1 } } },
    { properties: { name: "Imperial", race: { white: 10.2, hispanic: 84.6, black: 2.1, asian: 1.5, other: 1.6 } } },
    { properties: { name: "Alameda", race: { white: 28.5, hispanic: 22.4, black: 10.3, asian: 32.1, other: 6.7 } } },
    { properties: { name: "Alpine", race: { white: 52.0, hispanic: 18.0, black: null, asian: 3.0, other: 27.0 } } },
    { properties: { name: "No Race" } },
  ],
};

describe("RaceTableModal", () => {
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
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText("Imperial")).toBeInTheDocument();
    expect(screen.getByText("Alameda")).toBeInTheDocument();
    expect(screen.getByText("Alpine")).toBeInTheDocument();
  });

  it("skips features without race data", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.queryByText("No Race")).not.toBeInTheDocument();
  });

  it("formats values as percentages", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText("15.9%")).toBeInTheDocument();
    expect(screen.getByText("84.6%")).toBeInTheDocument();
  });

  it("shows dash for null values", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="black" />
    );
    await waitFor(() => expect(screen.getByText("Alpine")).toBeInTheDocument());
    const alpineRow = screen.getByText("Alpine").closest("tr")!;
    expect(alpineRow.textContent).toContain("\u2014");
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("shows error on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <RaceTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Alameda");
  });

  it("toggles sort direction on repeated click", async () => {
    const user = userEvent.setup();
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader); // asc
    await user.click(nameHeader); // desc
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Francisco");
  });

  it("sorts by hispanic column", async () => {
    const user = userEvent.setup();
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const hispanicHeader = screen.getByText(/^Hispanic/, { selector: "th" });
    await user.click(hispanicHeader); // toggle to asc
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Francisco");
  });

  it("syncs sort key when activeRaceMetric changes", async () => {
    const { rerender } = render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    rerender(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="white" />
    );

    // After rerender, white column should have highlight bg
    const whiteCells = screen.getAllByText("37.5%");
    expect(whiteCells[0].closest("td")).toHaveClass("bg-amber-50");
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "San Francisco" });
    expect(nameButton).toBeInTheDocument();
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <RaceTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "San Francisco" }));
    expect(onSelectName).toHaveBeenCalledWith("San Francisco");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "San Francisco" })).toBeNull();
  });

  it("handles race data as JSON string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [
          { properties: { name: "County X", race: JSON.stringify({ white: 40.0, hispanic: 30.0, black: 10.0, asian: 15.0, other: 5.0 }) } },
        ],
      }),
    }));
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("County X")).toBeInTheDocument());
    expect(screen.getByText("30.0%")).toBeInTheDocument();
  });

  it("renders all column headers", async () => {
    render(
      <RaceTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Race" nameLabel="County" activeRaceMetric="hispanic" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText(/^White/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Hispanic/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Black/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Asian/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Other/, { selector: "th" })).toBeInTheDocument();
  });
});
