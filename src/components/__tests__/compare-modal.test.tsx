import { render, screen, waitFor, act } from "@testing-library/react";
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
        age: { under18: 20.0, age18_34: 23.7, age35_64: 41.3, age65plus: 14.9, medianAge: 38.7 },
        poverty: 9.2,
        climate: {
          tmin: [5.0, 6.0, 7.0, 8.0, 10.0, 12.0, 13.0, 13.0, 12.0, 10.0, 7.0, 5.0],
          tmax: [14.0, 16.0, 18.0, 20.0, 23.0, 27.0, 28.0, 28.0, 26.0, 22.0, 17.0, 14.0],
          tavg: [9.5, 11.0, 12.5, 14.0, 16.5, 19.5, 20.5, 20.5, 19.0, 16.0, 12.0, 9.5],
          sunNsrdb: [6.0, 7.0, 8.0, 9.5, 10.5, 11.0, 11.5, 11.0, 10.0, 8.5, 7.0, 5.5],
          sunEra5: [5.5, 6.5, 7.5, 9.0, 10.0, 10.5, 11.0, 10.5, 9.5, 8.0, 6.5, 5.0],
          hexCount: 7,
        },
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
        age: { under18: 13.7, age18_34: 27.5, age35_64: 40.1, age65plus: 18.7, medianAge: 39.7 },
        poverty: 10.5,
        climate: {
          tmin: [7.0, 8.0, 8.5, 9.0, 10.0, 11.0, 12.0, 12.5, 12.0, 11.0, 9.0, 7.0],
          tmax: [13.0, 15.0, 16.0, 17.0, 18.0, 20.0, 20.0, 20.5, 21.0, 19.0, 16.0, 13.0],
          tavg: [10.0, 11.5, 12.3, 13.0, 14.0, 15.5, 16.0, 16.5, 16.5, 15.0, 12.5, 10.0],
          sunNsrdb: [5.0, 6.0, 7.5, 9.0, 10.0, 10.5, 9.5, 9.0, 9.5, 8.0, 6.0, 4.5],
          sunEra5: [4.5, 5.5, 7.0, 8.5, 9.5, 10.0, 9.0, 8.5, 9.0, 7.5, 5.5, 4.0],
          hexCount: 1,
        },
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
        age: { under18: 22.6, age18_34: 18.0, age35_64: 37.6, age65plus: 21.8, medianAge: 41.1 },
        poverty: 15.0,
        climate: {
          tmin: [-5.0, -3.0, 0.0, 2.0, 5.0, 8.0, 11.0, 10.0, 7.0, 3.0, -1.0, -5.0],
          tmax: [4.0, 6.0, 10.0, 14.0, 19.0, 25.0, 29.0, 28.0, 24.0, 17.0, 9.0, 4.0],
          tavg: [-0.5, 1.5, 5.0, 8.0, 12.0, 16.5, 20.0, 19.0, 15.5, 10.0, 4.0, -0.5],
          sunNsrdb: [7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 12.5, 12.0, 11.0, 9.5, 8.0, 6.5],
          sunEra5: [6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.0, 11.5, 10.5, 9.0, 7.5, 6.0],
          hexCount: 7,
        },
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
  tempMonth: number;
  tempUnit: "F" | "C";
  sunMonth: number;
  sunSource: "nsrdb" | "era5";
  crimeAbsolute: boolean;
  onTempMonthChange: (m: number) => void;
  onTempUnitChange: (u: "F" | "C") => void;
  onSunMonthChange: (m: number) => void;
  onSunSourceChange: (s: "nsrdb" | "era5") => void;
  onCrimeAbsoluteChange: (v: boolean) => void;
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
    tempMonth: 12,
    tempUnit: "F" as const,
    sunMonth: 12,
    sunSource: "nsrdb" as const,
    crimeAbsolute: false,
    onTempMonthChange: vi.fn(),
    onTempUnitChange: vi.fn(),
    onSunMonthChange: vi.fn(),
    onSunSourceChange: vi.fn(),
    onCrimeAbsoluteChange: vi.fn(),
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
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("Sunshine")).toBeInTheDocument();
    expect(screen.getByText("Crime")).toBeInTheDocument();
    expect(screen.getByText("Housing & Income")).toBeInTheDocument();
    expect(screen.getByText("Education (%)")).toBeInTheDocument();
    expect(screen.getByText("Race & Ethnicity (%)")).toBeInTheDocument();
    expect(screen.getByText("Age Distribution")).toBeInTheDocument();
  });

  it("renders metric labels as row headers", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Density (/sq mi)")).toBeInTheDocument();
    expect(screen.getByText("Poverty Rate")).toBeInTheDocument();
    expect(screen.getByText("Bachelor's+")).toBeInTheDocument();
    expect(screen.getByText("Home Value")).toBeInTheDocument();
    expect(screen.getByText("Median Age")).toBeInTheDocument();
    expect(screen.getByText("Under 18")).toBeInTheDocument();
    expect(screen.getByText("65+")).toBeInTheDocument();
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
    await user.click(screen.getByText("Crime"));
    expect(screen.queryByText("Homicide")).not.toBeInTheDocument();
    await user.click(screen.getByText("Crime"));
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
    await act(async () => {});
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

  it("renders temperature metrics with °F by default (annual avg)", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Day High")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
    expect(screen.getByText("Night Low")).toBeInTheDocument();
    // Annual avg of Alameda tavg: mean of 12 values ≈ 15.04°C → 59°F
    expect(screen.getByText("59°F")).toBeInTheDocument();
  });

  it("switches temperature unit to °C", async () => {
    renderModal({ tempUnit: "C" });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    // Annual avg of Alameda tavg: 15.0°C
    expect(screen.getByText("15.0°C")).toBeInTheDocument();
  });

  it("switches temperature month", async () => {
    renderModal({ tempMonth: 0 });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    // Jan — Alameda tavg[0]=9.5°C → 49°F
    expect(screen.getByText("49°F")).toBeInTheDocument();
  });

  it("renders sunshine metric with hours/day", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    expect(screen.getByText("Hours/day")).toBeInTheDocument();
    // Annual avg NSRDB for Alameda: mean of 12 values ≈ 8.8
    expect(screen.getByText("8.8")).toBeInTheDocument();
  });

  it("switches sunshine data source to ERA5", async () => {
    renderModal({ sunSource: "era5" });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    // Annual avg ERA5 for Alameda: mean of 12 values ≈ 8.3
    expect(screen.getByText("8.3")).toBeInTheDocument();
  });

  it("switches sunshine month", async () => {
    renderModal({ sunMonth: 6 });
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    // Jul — Alameda sunNsrdb[6] = 11.5
    expect(screen.getByText("11.5")).toBeInTheDocument();
  });

  it("calls onTempMonthChange and onSunMonthChange when changing temperature month", async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await waitFor(() => expect(screen.getByText("Alameda")).toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Jan" })[0]);
    expect(props.onTempMonthChange).toHaveBeenCalledWith(0);
    expect(props.onSunMonthChange).toHaveBeenCalledWith(0);
  });
});
