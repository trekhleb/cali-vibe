import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import LegalModal from "@/components/legal-modal";
import { LuChevronDown, LuX, LuSearch, LuPlus, LuUsers, LuSiren, LuHouse, LuGraduationCap, LuTrendingDown } from "react-icons/lu";
import { IoManOutline } from "react-icons/io5";
import { fetchJsonCached } from "@/utils/fetch-json";

// --- Public types ---

export type CompareType = "county" | "city";
export type SortConfig = { metricKey: string; direction: "asc" | "desc" } | null;

// --- Metric definitions ---

type Polarity = "higher" | "lower" | "neutral";

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

const CATEGORIES: CategoryDef[] = [
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
    label: "Poverty",
    icon: <LuTrendingDown className="h-3 w-3" />,
    metrics: [
      { key: "poverty", label: "Poverty Rate", format: fmtPct, polarity: "lower" },
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

function getCellColor(value: number, values: (number | null)[], polarity: Polarity): string | undefined {
  if (polarity === "neutral") return undefined;
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return undefined;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return undefined;
  const normalized = (value - min) / (max - min);
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
}: CompareModalProps) {
  const [allData, setAllData] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [crimeAbsolute, setCrimeAbsolute] = useState(false);
  const dragItemRef = useRef<string | null>(null);

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

  // Sort places (columns)
  const sortedData = useMemo(() => {
    if (!sortConfig) return allData;
    const { metricKey, direction } = sortConfig;
    return [...allData].sort((a, b) => {
      const va = getNestedValue(a.properties, metricKey);
      const vb = getNestedValue(b.properties, metricKey);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return direction === "asc" ? va - vb : vb - va;
    });
  }, [allData, sortConfig]);

  const handleDragStart = useCallback((name: string) => {
    dragItemRef.current = name;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((targetName: string) => {
    const dragName = dragItemRef.current;
    dragItemRef.current = null;
    if (!dragName || dragName === targetName) return;
    const currentNames = sortedData.map((p) => p.name);
    const fromIdx = currentNames.indexOf(dragName);
    const toIdx = currentNames.indexOf(targetName);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...currentNames];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, dragName);
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
                {sortedData.map((place) => (
                  <th
                    key={place.name}
                    draggable
                    onDragStart={() => handleDragStart(place.name)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(place.name)}
                    className="group px-2 py-1.5 text-center font-semibold text-gray-800 border-b border-gray-200 min-w-[90px] max-w-[120px] cursor-grab active:cursor-grabbing"
                    title={place.name}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="truncate">{place.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(place.name); }}
                        className="flex-shrink-0 opacity-30 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                        title={`Remove ${place.name}`}
                      >
                        <LuX className="h-3 w-3" />
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const isCollapsed = collapsedCategories.has(cat.label);
                return (
                  <CategoryGroup
                    key={cat.label}
                    category={cat}
                    places={sortedData}
                    collapsed={isCollapsed}
                    onToggle={() => toggleCategory(cat.label)}
                    onMetricSort={handleMetricSort}
                    sortIndicator={sortIndicator}
                    crimeAbsolute={crimeAbsolute}
                    onCrimeAbsoluteToggle={() => setCrimeAbsolute((v) => !v)}
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
      <div className="flex-shrink-0 border-t border-gray-100 px-3 py-1.5 text-center text-[10px] text-gray-300">
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
      .catch(() => {});
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
          className="w-full rounded-md border border-gray-200 bg-white py-1 pl-7 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none transition-colors"
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
              className={`cursor-pointer px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5 ${
                index === activeIndex ? "bg-gray-100 text-black" : "text-gray-700"
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
  crimeAbsolute,
  onCrimeAbsoluteToggle,
}: {
  category: CategoryDef;
  places: PlaceData[];
  collapsed: boolean;
  onToggle: () => void;
  onMetricSort: (key: string) => void;
  sortIndicator: (key: string) => string;
  crimeAbsolute?: boolean;
  onCrimeAbsoluteToggle?: () => void;
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
          <span className="inline-flex items-center gap-1">
            <LuChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
            {category.icon}
            {category.label}
            {isCrime && onCrimeAbsoluteToggle && (
              <span
                className="inline-flex rounded border border-gray-300 text-[9px] font-medium overflow-hidden ml-1 normal-case tracking-normal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={onCrimeAbsoluteToggle}
                  className={`px-1.5 py-0.5 transition-colors ${!crimeAbsolute ? "bg-gray-700 text-white" : "bg-white text-gray-500 hover:bg-gray-100"}`}
                >
                  per 100k
                </button>
                <button
                  onClick={onCrimeAbsoluteToggle}
                  className={`px-1.5 py-0.5 transition-colors border-l border-gray-300 ${crimeAbsolute ? "bg-gray-700 text-white" : "bg-white text-gray-500 hover:bg-gray-100"}`}
                >
                  absolute
                </button>
              </span>
            )}
          </span>
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
          />
        ))}
    </>
  );
}

// --- Metric row sub-component ---

function MetricRow({
  metric,
  places,
  onSort,
  sortLabel,
  crimeAbsolute,
}: {
  metric: MetricDef;
  places: PlaceData[];
  onSort: () => void;
  sortLabel: string;
  crimeAbsolute?: boolean;
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
        return (
          <td
            key={places[i].name}
            className="px-2 py-1 text-center border-b border-gray-100 tabular-nums"
            style={bg ? { backgroundColor: bg } : undefined}
          >
            {val !== null ? fmt(val) : <span className="text-gray-300">—</span>}
          </td>
        );
      })}
    </tr>
  );
}
