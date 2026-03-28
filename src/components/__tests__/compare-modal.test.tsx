import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompareModal from "@/components/compare-modal";
import type { CompareType, SortConfig } from "@/components/compare-modal";

// Mock fetchJsonCached used by AddSearch
vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn().mockResolvedValue({ features: [] }),
}));

const mockGeoJson = {
  features: [
    {
      properties: {
        name: "Alameda",
        population: 1649060,
        density: 2217.4,
        area: 743.7,
        crime: { total: 3502.8, violentTotal: 514.1, propertyTotal: 2988.7, homicide: 8.2, robbery: 168.3, aggAssault: 312.5, burglary: 453.2, mvTheft: 712.4, larceny: 1823.1 },
        housing: { homeValue: 1057400, rent: 2318, income: 126240 },
        education: { hsPlus: 88.9, bachPlus: 51.5, gradPlus: 22.8 },
        race: { white: 28.2, hispanic: 23.3, black: 9.6, asian: 32, other: 6.8 },
        poverty: 9.2,
      },
    },
    {
      properties: {
        name: "San Francisco",
        population: 808988,
        density: 17569.6,
        area: 46.0,
        crime: { total: 5200.1, violentTotal: 670.2, propertyTotal: 4529.9, homicide: 6.1, robbery: 250.0, aggAssault: 380.0, burglary: 600.0, mvTheft: 900.0, larceny: 2029.9 },
        housing: { homeValue: 1325000, rent: 2800, income: 140000 },
        education: { hsPlus: 90.2, bachPlus: 60.1, gradPlus: 28.5 },
        race: { white: 35.5, hispanic: 15.2, black: 5.1, asian: 34.4, other: 9.8 },
        poverty: 10.5,
      },
    },
    {
      properties: {
        name: "Alpine",
        population: 1120,
        density: 1.5,
        area: 739.1,
        crime: { total: 200.0, violentTotal: 50.0, propertyTotal: 150.0, homicide: 0, robbery: 10.0, aggAssault: 30.0, burglary: 50.0, mvTheft: 20.0, larceny: 80.0 },
        housing: { homeValue: 350000, rent: 900, income: 65000 },
        education: { hsPlus: 85.0, bachPlus: 25.0, gradPlus: 10.0 },
        race: { white: 60.0, hispanic: 20.0, black: 1.0, asian: 5.0, other: 14.0 },
        poverty: 15.0,
      },
    },
  ],
};

function renderModal(overrides: Partial<{
  open: boolean;
  compareType: CompareType;
  names: string[];
  sortConfig: SortConfig;
  onClose: () => void;
  onTypeChange: (t: CompareType) => void;
  onNamesChange: (n: string[]) => void;
  onSortChange: (s: SortConfig) => void;
}> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    compareType: "county" as CompareType,
    names: ["Alameda", "San Francisco"],
    sortConfig: null as SortConfig,
    onTypeChange: vi.fn(),
    onNamesChange: vi.fn(),
    onSortChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<CompareModal {...props} />), props };
}

describe("CompareModal", () => {
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
    renderModal();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
  });

  it("renders place names as column headers", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
  });

  it("renders category headers", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Crime (per 100k)")).toBeInTheDocument();
    expect(screen.getByText("Housing & Income")).toBeInTheDocument();
    expect(screen.getByText("Education (%)")).toBeInTheDocument();
    expect(screen.getByText("Race & Ethnicity (%)")).toBeInTheDocument();
  });

  it("renders metric labels as row headers", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Density (/sq mi)")).toBeInTheDocument();
    expect(screen.getByText("Poverty Rate")).toBeInTheDocument();
    expect(screen.getByText("Bachelor's+")).toBeInTheDocument();
    expect(screen.getByText("Home Value")).toBeInTheDocument();
  });

  it("displays formatted metric values", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("1,649,060")).toBeInTheDocument();
    expect(screen.getByText("$1,325,000")).toBeInTheDocument();
    expect(screen.getByText("9.2%")).toBeInTheDocument();
  });

  it("collapses and expands categories", async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());

    expect(screen.getByText("Homicide")).toBeInTheDocument();
    await user.click(screen.getByText("Crime (per 100k)"));
    expect(screen.queryByText("Homicide")).not.toBeInTheDocument();
    await user.click(screen.getByText("Crime (per 100k)"));
    expect(screen.getByText("Homicide")).toBeInTheDocument();
  });

  it("calls onSortChange when clicking metric label", async () => {
    const user = userEvent.setup();
    const { props } = renderModal({ names: ["Alameda", "San Francisco", "Alpine"] });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());

    await user.click(screen.getByText("Population", { selector: "td" }));
    expect(props.onSortChange).toHaveBeenCalledWith({ metricKey: "population", direction: "desc" });
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    renderModal();
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    renderModal({ open: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows table with a single name", async () => {
    renderModal({ names: ["Alameda"] });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("1,649,060")).toBeInTheDocument();
  });

  it("shows empty state with no names", async () => {
    renderModal({ names: [] });
    expect(screen.getByText(/Add counties to compare/)).toBeInTheDocument();
  });

  it("handles network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    renderModal();
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });

  it("shows no data message when names don't match", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    }));
    renderModal({ names: ["NonExistent1", "NonExistent2"] });
    await waitFor(() => expect(screen.getByText(/No data found/)).toBeInTheDocument());
  });

  it("applies color coding to cells with polarity", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());

    const povertyCell92 = screen.getByText("9.2%");
    const povertyCell105 = screen.getByText("10.5%");
    expect(povertyCell92.closest("td")).toHaveStyle({ backgroundColor: expect.any(String) });
    expect(povertyCell105.closest("td")).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it("does not apply color to neutral polarity cells", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());

    const popCell = screen.getByText("1,649,060");
    expect(popCell.closest("td")?.style.backgroundColor).toBe("");
  });

  it("calls onNamesChange when removing a column", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());

    const removeBtn = screen.getByTitle("Remove Alameda");
    await user.click(removeBtn);
    expect(props.onNamesChange).toHaveBeenCalledWith(["San Francisco"]);
  });

  it("renders type toggle buttons", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Counties")).toBeInTheDocument();
    expect(screen.getByText("Cities")).toBeInTheDocument();
  });
});
