import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HousingTableModal from "@/components/housing-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "San Mateo", housing: { homeValue: 1494500, rent: 2893, income: 159674 } } },
    { properties: { name: "Imperial", housing: { homeValue: 212000, rent: 818, income: 53498 } } },
    { properties: { name: "Alameda", housing: { homeValue: 1057400, rent: 2318, income: 126240 } } },
    { properties: { name: "Alpine", housing: { homeValue: 466100, rent: null, income: 110781 } } },
    { properties: { name: "No Housing" } },
    { properties: { name: "Fallbrook", placeType: "cdp", housing: { homeValue: 713000, rent: 1675, income: 87293 } } },
  ],
};

describe("HousingTableModal", () => {
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
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText("Imperial")).toBeInTheDocument();
    expect(screen.getByText("Alameda")).toBeInTheDocument();
    expect(screen.getByText("Alpine")).toBeInTheDocument();
  });

  it("skips features without housing data", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.queryByText("No Housing")).not.toBeInTheDocument();
  });

  it("formats home values with dollar sign and K/M suffixes", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText("$1.49M")).toBeInTheDocument(); // San Mateo
    expect(screen.getByText("$212K")).toBeInTheDocument();   // Imperial
    expect(screen.getByText("$1.06M")).toBeInTheDocument();  // Alameda
  });

  it("formats rent values with dollar sign", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="rent" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText("$2,893")).toBeInTheDocument();
    expect(screen.getByText("$818")).toBeInTheDocument();
  });

  it("shows dash for null values", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="rent" />
    );
    await waitFor(() => expect(screen.getByText("Alpine")).toBeInTheDocument());
    // Alpine has null rent, should show em dash
    const alpineRow = screen.getByText("Alpine").closest("tr")!;
    expect(alpineRow.textContent).toContain("\u2014");
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("shows error on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <HousingTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);

    // After first click: asc by name → Alameda first
    const rows = screen.getAllByRole("row");
    // Row 0 is header, row 1 is first data row
    expect(rows[1].textContent).toContain("Alameda");
  });

  it("toggles sort direction on repeated click", async () => {
    const user = userEvent.setup();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader); // asc
    await user.click(nameHeader); // desc
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Mateo");
  });

  it("sorts by homeValue column", async () => {
    const user = userEvent.setup();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    const homeValueHeader = screen.getByText(/Home Value/, { selector: "th" });
    await user.click(homeValueHeader); // toggle to asc
    const rows = screen.getAllByRole("row");
    // Ascending: Imperial ($212K) should be first
    expect(rows[1].textContent).toContain("Imperial");
  });

  it("sorts by rent column", async () => {
    const user = userEvent.setup();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="rent" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    // Default sort is desc by rent → San Mateo ($2,893) first
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Mateo");
  });

  it("syncs sort key when activeHousingMetric changes", async () => {
    const { rerender } = render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    rerender(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="rent" />
    );

    // After rerender, rent column should have highlight bg
    const rentCells = screen.getAllByText("$2,893");
    expect(rentCells[0].closest("td")).toHaveClass("bg-amber-50");
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "San Mateo" });
    expect(nameButton).toBeInTheDocument();
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <HousingTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "San Mateo" }));
    expect(onSelectName).toHaveBeenCalledWith("San Mateo");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "San Mateo" })).toBeNull();
  });

  it("handles housing data as JSON string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [
          { properties: { name: "County X", housing: JSON.stringify({ homeValue: 500000, rent: 1500 }) } },
        ],
      }),
    }));
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("County X")).toBeInTheDocument());
    expect(screen.getByText("$500K")).toBeInTheDocument();
  });

  it("formats income values with dollar sign and commas", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="income" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText("$159,674")).toBeInTheDocument();
    expect(screen.getByText("$53,498")).toBeInTheDocument();
  });

  it("sorts by income column", async () => {
    const user = userEvent.setup();
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="income" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());

    // Default sort is desc by income → San Mateo ($159,674) first
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Mateo");
  });

  it("renders all column headers", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText(/Home Value/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Rent/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/^Income/, { selector: "th" })).toBeInTheDocument();
  });

  it("renders row numbers", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="County" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    // Row numbers 1-5 (5 rows with housing data, including CDP)
    const cells = screen.getAllByText("1");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("includes CDPs with housing data in the table", async () => {
    render(
      <HousingTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Housing" nameLabel="City" activeHousingMetric="homeValue" />
    );
    await waitFor(() => expect(screen.getByText("San Mateo")).toBeInTheDocument());
    expect(screen.getByText("Fallbrook")).toBeInTheDocument();
  });
});
