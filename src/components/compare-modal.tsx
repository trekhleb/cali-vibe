import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import LegalModal from "@/components/legal-modal";
import { LuChevronDown, LuX, LuSearch, LuPlus, LuUsers, LuSiren, LuHouse, LuGraduationCap, LuTrendingDown, LuThermometer, LuSun, LuGripVertical, LuCalendarDays, LuSchool } from "react-icons/lu";
import { IoManOutline } from "react-icons/io5";
import { fetchJsonCached } from "@/utils/fetch-json";

// --- Public types ---

export type CompareType = "county" | "city";
export type SortConfig = { metricKey: string; direction: "asc" | "desc" } | null;

// --- Metric definitions ---

type Polarity = "higher" | "lower" | "neutral" | "temperature";

interface MetricDef {
  key: string;
  label: string;
  format: (v: number) => string;
  polarity: Polarity;
}

interface CategoryDef {
  label: string;
  icon: ReactNode;
  metrics: MetricDef[];
}

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDec1 = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtUsd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const fmtSunHrs = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

const ANNUAL = 12;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Year"];

type TempUnit = "F" | "C";
type SunSource = "nsrdb" | "era5";

function cToF(c: number): number { return c * 9 / 5 + 32; }

function getClimateMonthVal(arr: number[] | null | undefined, month: number): number | null {
  if (!arr || !Array.isArray(arr)) return null;
  if (month === ANNUAL) return arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr[month] ?? null;
}

const DEMOGRAPHIC_CATEGORIES: CategoryDef[] = [
  {
    label: "Population",
    icon: <LuUsers className="h-3 w-3" />,
    metrics: [
      { key: "population", label: "Population", format: fmtInt, polarity: "neutral" },
      { key: "density", label: "Density (/sq mi)", format: fmtInt, polarity: "neutral" },
      { key: "area", label: "Area (mi²)", format: fmtDec1, polarity: "neutral" },
    ],
  },
  {
    label: "Crime",
    icon: <LuSiren className="h-3 w-3" />,
    metrics: [
      { key: "crime.total", label: "Total", format: fmtDec1, polarity: "lower" },
      { key: "crime.violentTotal", label: "Violent", format: fmtDec1, polarity: "lower" },
      { key: "crime.propertyTotal", label: "Property", format: fmtDec1, polarity: "lower" },
      { key: "crime.homicide", label: "Homicide", format: fmtDec1, polarity: "lower" },
      { key: "crime.robbery", label: "Robbery", format: fmtDec1, polarity: "lower" },
      { key: "crime.aggAssault", label: "Agg. Assault", format: fmtDec1, polarity: "lower" },
      { key: "crime.rape", label: "Rape", format: fmtDec1, polarity: "lower" },
      { key: "crime.burglary", label: "Burglary", format: fmtDec1, polarity: "lower" },
      { key: "crime.mvTheft", label: "MV Theft", format: fmtDec1, polarity: "lower" },
      { key: "crime.larceny", label: "Larceny", format: fmtDec1, polarity: "lower" },
    ],
  },
  {
    label: "Housing & Income",
    icon: <LuHouse className="h-3 w-3" />,
    metrics: [
      { key: "housing.homeValue", label: "Home Value", format: fmtUsd, polarity: "neutral" },
      { key: "housing.rent", label: "Median Rent", format: fmtUsd, polarity: "lower" },
      { key: "housing.income", label: "Median Income", format: fmtUsd, polarity: "higher" },
    ],
  },
  {
    label: "Education (%)",
    icon: <LuGraduationCap className="h-3 w-3" />,
    metrics: [
      { key: "education.bachPlus", label: "Bachelor's+", format: fmtPct, polarity: "higher" },
      { key: "education.gradPlus", label: "Graduate+", format: fmtPct, polarity: "higher" },
      { key: "education.hsPlus", label: "High School+", format: fmtPct, polarity: "higher" },
    ],
  },
  {
    label: "Race & Ethnicity (%)",
    icon: <IoManOutline className="h-3 w-3" />,
    metrics: [
      { key: "race.white", label: "White", format: fmtPct, polarity: "neutral" },
      { key: "race.hispanic", label: "Hispanic", format: fmtPct, polarity: "neutral" },
      { key: "race.black", label: "Black", format: fmtPct, polarity: "neutral" },
      { key: "race.asian", label: "Asian", format: fmtPct, polarity: "neutral" },
      { key: "race.other", label: "Other", format: fmtPct, polarity: "neutral" },
    ],
  },
  {
    label: "Age Distribution",
    icon: <LuCalendarDays className="h-3 w-3" />,
    metrics: [
      { key: "age.medianAge", label: "Median Age", format: fmtDec1, polarity: "neutral" },
      { key: "age.under18", label: "Under 18", format: fmtPct, polarity: "neutral" },
      { key: "age.age18_34", label: "18–34", format: fmtPct, polarity: "neutral" },
      { key: "age.age35_64", label: "35–64", format: fmtPct, polarity: "neutral" },
      { key: "age.age65plus", label: "65+", format: fmtPct, polarity: "neutral" },
    ],
  },
  {
    label: "Poverty",
    icon: <LuTrendingDown className="h-3 w-3" />,
    metrics: [
      { key: "poverty", label: "Poverty Rate", format: fmtPct, polarity: "lower" },
    ],
  },
  {
    label: "Schools (CDE)",
    icon: <LuSchool className="h-3 w-3" />,
    metrics: [
      { key: "schools.ela", label: "Avg ELA (DFS)", format: (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1), polarity: "higher" },
      { key: "schools.math", label: "Avg Math (DFS)", format: (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1), polarity: "higher" },
      { key: "schools.graduationRate", label: "Avg Graduation Rate", format: fmtPct, polarity: "higher" },
      { key: "schools.schoolCount", label: "School Count", format: fmtInt, polarity: "neutral" },
    ],
  },
];

// --- Data URL helpers ---

const DATA_URLS: Record<CompareType, string> = {
  county: `${import.meta.env.BASE_URL}data/california-county-labels.geojson`,
  city: `${import.meta.env.BASE_URL}data/california-city-labels.geojson`,
};

// --- Helpers ---

function getNestedValue(obj: Record<string, unknown>, path: string): number | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : null;
}

function hslColor(t: number): string {
  const hue = t * 120;
  return `hsl(${hue}, 65%, 88%)`;
}

/** Blue (cold) → orange/red (hot) gradient. t: 0 = coldest, 1 = hottest. */
function tempColor(t: number): string {
  // hue 220 (blue) → 30 (orange)
  const hue = 220 - t * 190;
  return `hsl(${hue}, 70%, 88%)`;
}

function getCellColor(value: number, values: (number | null)[], polarity: Polarity): string | undefined {
  if (polarity === "neutral") return undefined;
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return undefined;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return undefined;
  const normalized = (value - min) / (max - min);
  if (polarity === "temperature") return tempColor(normalized);
  const t = polarity === "higher" ? normalized : 1 - normalized;
  return hslColor(t);
}

// --- Types ---

interface PlaceData {
  name: string;
  properties: Record<string, unknown>;
}

export interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  compareType: CompareType;
  names: string[];
  sortConfig: SortConfig;
  onTypeChange: (type: CompareType) => void;
  onNamesChange: (names: string[]) => void;
  onSortChange: (sort: SortConfig) => void;
  tempMonth: number;
  tempUnit: TempUnit;
  sunMonth: number;
  sunSource: SunSource;
  crimeAbsolute: boolean;
  onTempMonthChange: (m: number) => void;
  onTempUnitChange: (u: TempUnit) => void;
  onSunMonthChange: (m: number) => void;
  onSunSourceChange: (s: SunSource) => void;
  onCrimeAbsoluteChange: (v: boolean) => void;
}

// --- Component ---

export default function CompareModal({
  open,
  onClose,
  compareType,
  names,
  sortConfig,
  onTypeChange,
  onNamesChange,
  onSortChange,
  tempMonth,
  tempUnit,
  sunMonth,
  sunSource,
  crimeAbsolute,
  onTempMonthChange,
  onTempUnitChange,
  onSunMonthChange,
  onSunSourceChange,
  onCrimeAbsoluteChange,
}: CompareModalProps) {
  const [allData, setAllData] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const dragItemRef = useRef<string | null>(null);
  const [dragName, setDragName] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ name: string; side: "left" | "right" } | null>(null);

  const dataUrl = DATA_URLS[compareType];

  // Fetch GeoJSON when names change
  useEffect(() => {
    if (!open || names.length === 0) { setAllData([]); return; }
    setLoading(true);
    setError(null);
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((geo: { features: { properties: Record<string, unknown> }[] }) => {
        const nameSet = new Set(names);
        const matched = geo.features
          .filter((f) => nameSet.has(f.properties.name as string))
          .map((f) => ({ name: f.properties.name as string, properties: f.properties }));
        // Preserve the order from names array
        const byName = new Map(matched.map((m) => [m.name, m]));
        setAllData(names.map((n) => byName.get(n)).filter((d): d is PlaceData => d != null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, dataUrl, names]);

  // Hydrate climate data into flat properties based on current controls
  const hydratedData = useMemo(() => {
    return allData.map((place) => {
      const climate = place.properties.climate as
        | { tmin?: number[]; tmax?: number[]; tavg?: number[]; sunNsrdb?: number[]; sunEra5?: number[] }
        | undefined;
      const props = { ...place.properties };
      if (climate) {
        const toUnit = (c: number | null) => (c === null ? null : tempUnit === "F" ? cToF(c) : c);
        props._tmax = toUnit(getClimateMonthVal(climate.tmax, tempMonth));
        props._tavg = toUnit(getClimateMonthVal(climate.tavg, tempMonth));
        props._tmin = toUnit(getClimateMonthVal(climate.tmin, tempMonth));
        const sunArr = sunSource === "nsrdb" ? climate.sunNsrdb : climate.sunEra5;
        props._sunHrs = getClimateMonthVal(sunArr, sunMonth);
      }
      return { ...place, properties: props };
    });
  }, [allData, tempMonth, tempUnit, sunMonth, sunSource]);

  // Dynamic climate categories
  const fmtTemp = useMemo(
    () => tempUnit === "F"
      ? (v: number) => `${Math.round(v)}°F`
      : (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}°C`,
    [tempUnit],
  );

  const allCategories = useMemo<CategoryDef[]>(() => [
    {
      label: "Temperature",
      icon: <LuThermometer className="h-3 w-3" />,
      metrics: [
        { key: "_tmax", label: "Day High", format: fmtTemp, polarity: "temperature" as Polarity },
        { key: "_tavg", label: "Average", format: fmtTemp, polarity: "temperature" as Polarity },
        { key: "_tmin", label: "Night Low", format: fmtTemp, polarity: "temperature" as Polarity },
      ],
    },
    {
      label: "Sunshine",
      icon: <LuSun className="h-3 w-3" />,
      metrics: [
        { key: "_sunHrs", label: "Hours/day", format: fmtSunHrs, polarity: "higher" as Polarity },
      ],
    },
    ...DEMOGRAPHIC_CATEGORIES,
  ], [fmtTemp]);

  // Sort places (columns)
  const sortedData = useMemo(() => {
    if (!sortConfig) return hydratedData;
    const { metricKey, direction } = sortConfig;
    return [...hydratedData].sort((a, b) => {
      const va = getNestedValue(a.properties, metricKey);
      const vb = getNestedValue(b.properties, metricKey);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return direction === "asc" ? va - vb : vb - va;
    });
  }, [hydratedData, sortConfig]);

  const handleDragStart = useCallback((name: string, e: React.DragEvent) => {
    dragItemRef.current = name;
    setDragName(name);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((targetName: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragItemRef.current || dragItemRef.current === targetName) {
      setDropTarget(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
    setDropTarget({ name: targetName, side });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    setDragName(null);
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((targetName: string) => {
    const dragged = dragItemRef.current;
    dragItemRef.current = null;
    setDragName(null);
    setDropTarget(null);
    if (!dragged || dragged === targetName) return;
    const currentNames = sortedData.map((p) => p.name);
    const fromIdx = currentNames.indexOf(dragged);
    const toIdx = currentNames.indexOf(targetName);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...currentNames];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, dragged);
    onNamesChange(reordered);
    onSortChange(null);
  }, [sortedData, onNamesChange, onSortChange]);

  const toggleCategory = (label: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleMetricSort = (metricKey: string) => {
    onSortChange(
      sortConfig?.metricKey === metricKey
        ? sortConfig.direction === "desc" ? { metricKey, direction: "asc" } : null
        : { metricKey, direction: "desc" }
    );
  };

  const sortIndicator = (metricKey: string) => {
    if (sortConfig?.metricKey !== metricKey) return "";
    return sortConfig.direction === "desc" ? " →" : " ←";
  };

  const handleRemove = useCallback((name: string) => {
    onNamesChange(names.filter((n) => n !== name));
  }, [names, onNamesChange]);

  const handleAdd = useCallback((name: string) => {
    if (!names.includes(name)) {
      onNamesChange([...names, name]);
    }
  }, [names, onNamesChange]);

  const handleTypeSwitch = useCallback((type: CompareType) => {
    if (type !== compareType) {
      onTypeChange(type);
      onNamesChange([]);
      onSortChange(null);
    }
  }, [compareType, onTypeChange, onNamesChange, onSortChange]);

  const sizeClassName = names.length >= 8
    ? "!max-w-[96vw] !h-[92dvh]"
    : names.length >= 5
      ? "!max-w-[90vw] !h-[88dvh]"
      : names.length >= 3
        ? "!max-w-6xl !h-[85dvh]"
        : "";

  if (!open) return null;

  const typeLabel = compareType === "county" ? "Counties" : "Cities";

  return (
    <LegalModal open={open} onClose={onClose} title={`CaliVibe: Compare ${typeLabel}`} wide sizeClassName={sizeClassName}>
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50/50">
        {/* Type toggle */}
        <div className="inline-flex rounded-md border border-gray-300 text-xs overflow-hidden">
          <button
            onClick={() => handleTypeSwitch("county")}
            className={`px-2.5 py-1 font-medium transition-colors ${compareType === "county" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            Counties
          </button>
          <button
            onClick={() => handleTypeSwitch("city")}
            className={`px-2.5 py-1 font-medium transition-colors border-l border-gray-300 ${compareType === "city" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
          >
            Cities
          </button>
        </div>

        {/* Add search */}
        <div className="flex-1 min-w-[140px]">
          <AddSearch
            dataUrl={dataUrl}
            existingNames={names}
            onAdd={handleAdd}
            placeholder={`Add ${compareType === "county" ? "county" : "city"}...`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto min-h-0 flex-1 px-1">
        {loading && <p className="text-center py-8 text-gray-500">Loading...</p>}
        {error && <p className="text-center py-8 text-red-600">Error: {error}</p>}

        {!loading && !error && sortedData.length >= 1 && (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 px-2 py-1.5 text-left font-medium text-gray-500 border-b border-r border-gray-200 min-w-[120px]">
                  Metric
                </th>
                {sortedData.map((place) => {
                  const isDragging = dragName === place.name;
                  const dropLeft = dropTarget?.name === place.name && dropTarget.side === "left";
                  const dropRight = dropTarget?.name === place.name && dropTarget.side === "right";
                  return (
                    <th
                      key={place.name}
                      draggable
                      onDragStart={(e) => handleDragStart(place.name, e)}
                      onDragOver={(e) => handleDragOver(place.name, e)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => setDropTarget((prev) => prev?.name === place.name ? null : prev)}
                      onDrop={() => handleDrop(place.name)}
                      className={`group relative px-2 py-1.5 text-center font-semibold border-b border-gray-200 min-w-[90px] max-w-[120px] cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? "opacity-30" : "text-gray-800"}`}
                      title={place.name}
                    >
                      {dropLeft && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full" />}
                      {dropRight && <span className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full" />}
                      <span className="inline-flex items-center gap-0.5">
                        <LuGripVertical className="h-3 w-3 flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="truncate">{place.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemove(place.name); }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                          title={`Remove ${place.name}`}
                        >
                          <LuX className="h-3 w-3" />
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allCategories.map((cat) => {
                const isCollapsed = collapsedCategories.has(cat.label);

                let controls: ReactNode = undefined;
                if (cat.label === "Crime") {
                  controls = (
                    <SmallToggle
                      options={[{ value: "rate", label: "per 100k" }, { value: "abs", label: "absolute" }]}
                      value={crimeAbsolute ? "abs" : "rate"}
                      onChange={(v) => onCrimeAbsoluteChange(v === "abs")}
                    />
                  );
                } else if (cat.label === "Temperature") {
                  controls = (
                    <>
                      <MonthSelector value={tempMonth} onChange={(m) => { onTempMonthChange(m); onSunMonthChange(m); }} />
                      <SmallToggle
                        options={[{ value: "F", label: "°F" }, { value: "C", label: "°C" }]}
                        value={tempUnit}
                        onChange={(v) => onTempUnitChange(v as TempUnit)}
                      />
                    </>
                  );
                } else if (cat.label === "Sunshine") {
                  controls = (
                    <>
                      <MonthSelector value={sunMonth} onChange={(m) => { onSunMonthChange(m); onTempMonthChange(m); }} />
                      <SmallToggle
                        options={[{ value: "nsrdb", label: "NSRDB" }, { value: "era5", label: "ERA5" }]}
                        value={sunSource}
                        onChange={(v) => onSunSourceChange(v as SunSource)}
                      />
                    </>
                  );
                }

                return (
                  <CategoryGroup
                    key={cat.label}
                    category={cat}
                    places={sortedData}
                    collapsed={isCollapsed}
                    onToggle={() => toggleCategory(cat.label)}
                    onMetricSort={handleMetricSort}
                    sortIndicator={sortIndicator}
                    controls={controls}
                    crimeAbsolute={crimeAbsolute}
                    dragName={dragName}
                    dropTarget={dropTarget}
                  />
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !error && names.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Add {compareType === "county" ? "counties" : "cities"} to compare.</p>
            <p className="text-xs mt-1">Use the search above to add places.</p>
          </div>
        )}

        {!loading && !error && names.length >= 1 && sortedData.length === 0 && (
          <p className="text-center py-8 text-gray-500">No data found for the selected places.</p>
        )}
      </div>

      {/* Footer watermark */}
      <div className="flex-shrink-0 border-t border-gray-100 px-3 py-1.5 text-center text-[10px] text-gray-400">
        trekhleb.dev/cali-vibe
      </div>
    </LegalModal>
  );
}

// --- AddSearch: inline autocomplete to add places ---

function AddSearch({
  dataUrl,
  existingNames,
  onAdd,
  placeholder,
}: {
  dataUrl: string;
  existingNames: string[];
  onAdd: (name: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [allNames, setAllNames] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetchJsonCached(dataUrl)
      .then((geojson: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const loaded: string[] = geojson.features
          .map((f: { properties: { name: string } }) => f.properties.name)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        setAllNames(loaded);
      })
      .catch(() => { });
  }, [dataUrl]);

  const existingSet = useMemo(() => new Set(existingNames), [existingNames]);

  const lowerQuery = query.toLowerCase().trim();
  const suggestions = lowerQuery.length > 0
    ? allNames.filter((n) => !existingSet.has(n) && n.toLowerCase().includes(lowerQuery)).slice(0, 8)
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const selectItem = useCallback((name: string) => {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    onAdd(name);
  }, [onAdd]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) selectItem(suggestions[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <LuSearch className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setActiveIndex(-1); }}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 bg-white py-1 pl-7 pr-3 text-[16px] sm:text-xs text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none transition-colors"
        />
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-44 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((name, index) => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); selectItem(name); }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5 ${index === activeIndex ? "bg-gray-100 text-black" : "text-gray-700"
                }`}
            >
              <LuPlus className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span><HighlightMatch text={name} query={lowerQuery} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const matchIndex = lowerText.indexOf(query);
  if (matchIndex === -1) return <>{text}</>;
  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);
  return <>{before}<span className="font-bold text-black">{match}</span>{after}</>;
}

// --- Category group sub-component ---

function CategoryGroup({
  category,
  places,
  collapsed,
  onToggle,
  onMetricSort,
  sortIndicator,
  controls,
  crimeAbsolute,
  dragName,
  dropTarget,
}: {
  category: CategoryDef;
  places: PlaceData[];
  collapsed: boolean;
  onToggle: () => void;
  onMetricSort: (key: string) => void;
  sortIndicator: (key: string) => string;
  controls?: ReactNode;
  crimeAbsolute?: boolean;
  dragName?: string | null;
  dropTarget?: { name: string; side: "left" | "right" } | null;
}) {
  const isCrime = category.label === "Crime";

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 select-none"
        onClick={onToggle}
      >
        <td
          colSpan={places.length + 1}
          className="sticky left-0 px-2 py-1.5 font-semibold text-gray-700 bg-gray-100 border-b border-gray-200 text-[11px] uppercase tracking-wide"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <LuChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
              {category.icon}
              {category.label}
            </span>
            {controls && <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>{controls}</div>}
          </div>
        </td>
      </tr>
      {!collapsed &&
        category.metrics.map((metric) => (
          <MetricRow
            key={metric.key}
            metric={metric}
            places={places}
            onSort={() => onMetricSort(metric.key)}
            sortLabel={sortIndicator(metric.key)}
            crimeAbsolute={isCrime ? crimeAbsolute : undefined}
            dragName={dragName}
            dropTarget={dropTarget}
          />
        ))}
    </>
  );
}

// --- Reusable controls ---

function MonthSelector({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-px">
      {MONTH_LABELS.map((label, idx) => (
        <button
          key={idx}
          onClick={() => onChange(idx)}
          className={`px-1 py-0.5 text-[9px] font-medium rounded-sm transition-colors ${value === idx ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-200"
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SmallToggle({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex rounded border border-gray-300 text-[9px] font-medium overflow-hidden normal-case tracking-normal">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-1.5 py-0.5 transition-colors ${i > 0 ? "border-l border-gray-300" : ""} ${value === opt.value ? "bg-gray-700 text-white" : "bg-white text-gray-500 hover:bg-gray-100"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </span>
  );
}

// --- Metric row sub-component ---

function MetricRow({
  metric,
  places,
  onSort,
  sortLabel,
  crimeAbsolute,
  dragName,
  dropTarget,
}: {
  metric: MetricDef;
  places: PlaceData[];
  onSort: () => void;
  sortLabel: string;
  crimeAbsolute?: boolean;
  dragName?: string | null;
  dropTarget?: { name: string; side: "left" | "right" } | null;
}) {
  const rawValues = places.map((p) => getNestedValue(p.properties, metric.key));

  // When crimeAbsolute is on, convert per-100k rates to absolute counts
  const values = crimeAbsolute
    ? rawValues.map((val, i) => {
      if (val === null) return null;
      const pop = getNestedValue(places[i].properties, "population");
      if (pop === null) return null;
      return Math.round(val * pop / 100000);
    })
    : rawValues;

  const fmt = crimeAbsolute ? fmtInt : metric.format;

  return (
    <tr className="hover:bg-gray-50/50">
      <td
        className="sticky left-0 z-[5] bg-white px-2 py-1 text-gray-600 border-b border-r border-gray-100 cursor-pointer hover:text-gray-900 whitespace-nowrap"
        onClick={onSort}
        title={`Sort by ${metric.label}`}
      >
        {metric.label}
        {sortLabel && <span className="text-gray-400 ml-0.5">{sortLabel}</span>}
      </td>
      {values.map((val, i) => {
        const bg = val !== null ? getCellColor(val, values, metric.polarity) : undefined;
        const isDragging = dragName === places[i].name;
        const dropLeft = dropTarget?.name === places[i].name && dropTarget.side === "left";
        const dropRight = dropTarget?.name === places[i].name && dropTarget.side === "right";
        return (
          <td
            key={places[i].name}
            className={`relative px-2 py-1 text-center border-b border-gray-100 tabular-nums ${isDragging ? "opacity-30" : ""}`}
            style={bg ? { backgroundColor: bg } : undefined}
          >
            {dropLeft && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full" />}
            {dropRight && <span className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-full" />}
            {val !== null ? fmt(val) : <span className="text-gray-300">—</span>}
          </td>
        );
      })}
    </tr>
  );
}
