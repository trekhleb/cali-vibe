import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import LegalModal from "@/components/legal-modal";
import { LuChevronDown, LuChevronRight, LuColumns3, LuSearch, LuThermometer, LuSun, LuUsers, LuSiren, LuHouse, LuGraduationCap, LuTrendingDown, LuCalendarDays, LuSchool, LuMapPin, LuLandmark, LuMessageCircle, LuFlame } from "react-icons/lu";
import HeartButton from "@/components/heart-button";
import PlaceMiniMap from "@/components/place-mini-map";
import { IoManOutline } from "react-icons/io5";
import { fetchJsonCached } from "@/utils/fetch-json";
import type { PlaceType } from "@/utils/place-slugs";

// --- Metric definitions (shared with compare-modal) ---

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
    icon: <LuUsers className="h-3.5 w-3.5" />,
    metrics: [
      { key: "population", label: "Population", format: fmtInt, polarity: "neutral" },
      { key: "density", label: "Density (/sq mi)", format: fmtInt, polarity: "neutral" },
      { key: "area", label: "Area (mi²)", format: fmtDec1, polarity: "neutral" },
    ],
  },
  {
    label: "Crime (per 100K)",
    icon: <LuSiren className="h-3.5 w-3.5" />,
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
    icon: <LuHouse className="h-3.5 w-3.5" />,
    metrics: [
      { key: "housing.homeValue", label: "Median Home Value", format: fmtUsd, polarity: "neutral" },
      { key: "housing.rent", label: "Median Rent", format: fmtUsd, polarity: "lower" },
      { key: "housing.income", label: "Median Household Income", format: fmtUsd, polarity: "higher" },
    ],
  },
  {
    label: "Education",
    icon: <LuGraduationCap className="h-3.5 w-3.5" />,
    metrics: [
      { key: "education.bachPlus", label: "Bachelor's Degree+", format: fmtPct, polarity: "higher" },
      { key: "education.gradPlus", label: "Graduate Degree+", format: fmtPct, polarity: "higher" },
      { key: "education.hsPlus", label: "High School+", format: fmtPct, polarity: "higher" },
    ],
  },
  {
    label: "Race & Ethnicity",
    icon: <IoManOutline className="h-3.5 w-3.5" />,
    metrics: [
      { key: "race.white", label: "White", format: fmtPct, polarity: "neutral" },
      { key: "race.hispanic", label: "Hispanic/Latino", format: fmtPct, polarity: "neutral" },
      { key: "race.black", label: "Black", format: fmtPct, polarity: "neutral" },
      { key: "race.asian", label: "Asian", format: fmtPct, polarity: "neutral" },
      { key: "race.other", label: "Other", format: fmtPct, polarity: "neutral" },
    ],
  },
  {
    label: "Age Distribution",
    icon: <LuCalendarDays className="h-3.5 w-3.5" />,
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
    icon: <LuTrendingDown className="h-3.5 w-3.5" />,
    metrics: [
      { key: "poverty", label: "Poverty Rate", format: fmtPct, polarity: "lower" },
    ],
  },
  {
    label: "Schools (CDE Dashboard)",
    icon: <LuSchool className="h-3.5 w-3.5" />,
    metrics: [
      { key: "schools.ela", label: "Avg ELA (DFS)", format: (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1), polarity: "higher" },
      { key: "schools.math", label: "Avg Math (DFS)", format: (v: number) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1), polarity: "higher" },
      { key: "schools.graduationRate", label: "Avg Graduation Rate", format: fmtPct, polarity: "higher" },
      { key: "schools.schoolCount", label: "School Count", format: fmtInt, polarity: "neutral" },
    ],
  },
];

// --- Helpers ---

const DATA_URLS: Record<PlaceType, string> = {
  county: `${import.meta.env.BASE_URL}data/california-county-labels.geojson`,
  city: `${import.meta.env.BASE_URL}data/california-city-labels.geojson`,
};

function getNestedValue(obj: Record<string, unknown>, path: string): number | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : null;
}

// --- Ranking & coloring ---

interface RankInfo {
  rank: number;   // 1-based, 1 = best
  total: number;
  color?: string; // background color
}

/** Compute rank among all places for a given metric. Rank 1 = best per polarity. */
function computeRank(
  value: number,
  allValues: number[],
  polarity: Polarity,
): RankInfo | null {
  if (polarity === "neutral") return null;
  const sorted = [...allValues].sort((a, b) => a - b);
  const total = sorted.length;
  if (total < 2) return null;

  // For "higher" polarity, rank 1 = highest value. For "lower", rank 1 = lowest.
  const rank = polarity === "higher" || polarity === "temperature"
    ? sorted.filter((v) => v > value).length + 1
    : sorted.filter((v) => v < value).length + 1;

  // Color: normalized 0–1, where 1 = best
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === min) return { rank, total };
  const normalized = (value - min) / (max - min);

  let t: number;
  if (polarity === "temperature") {
    // Cold = blue (220°), hot = red (10°), via purple — avoids green
    const hue = (220 + normalized * 150) % 360;
    return { rank, total, color: `hsl(${hue}, 70%, 88%)` };
  }
  t = polarity === "higher" ? normalized : 1 - normalized;
  const hue = 220 - t * 190;
  return { rank, total, color: `hsl(${hue}, 70%, 88%)` };
}

// --- Component ---

export type DetailTab = "local" | "roast";

interface TabTheme {
  activeBg: string;
  activeText: string;
  activeBorder: string;
  inactiveText: string;
  inactiveHoverBg: string;
  bodyBg: string;
  bodyBorder: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
}

const TAB_THEMES: Record<DetailTab, TabTheme> = {
  local: {
    activeBg: "bg-violet-50",
    activeText: "text-violet-800",
    activeBorder: "border-violet-200",
    inactiveText: "text-violet-800",
    inactiveHoverBg: "hover:bg-violet-50/50",
    bodyBg: "bg-violet-50",
    bodyBorder: "border-violet-200",
    tagBg: "bg-violet-100/60",
    tagBorder: "border-violet-200",
    tagText: "text-violet-400",
  },
  roast: {
    activeBg: "bg-orange-50",
    activeText: "text-orange-400",
    activeBorder: "border-orange-200",
    inactiveText: "text-orange-400",
    inactiveHoverBg: "hover:bg-orange-50/50",
    bodyBg: "bg-orange-50",
    bodyBorder: "border-orange-200",
    tagBg: "bg-orange-100/60",
    tagBorder: "border-orange-200",
    tagText: "text-orange-400",
  },
};

const DETAIL_TABS: { id: DetailTab; label: string; icon: ReactNode }[] = [
  { id: "local", label: "Local's Take", icon: <LuMessageCircle className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" /> },
  { id: "roast", label: "Roast", icon: <LuFlame className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" /> },
];

export interface PlaceDetailModalProps {
  open: boolean;
  onClose: () => void;
  placeType: PlaceType;
  placeName: string;
  onNavigate?: (type: PlaceType, name: string) => void;
  onCompare?: (type: PlaceType, name: string) => void;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
  activeTab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
}

export default function PlaceDetailModal({ open, onClose, placeType, placeName, onNavigate, onCompare, onToggleFavorite, isFavorite, activeTab = "local", onTabChange }: PlaceDetailModalProps) {
  const [properties, setProperties] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [tempMonth, setTempMonth] = useState(() => new Date().getMonth());
  const [tempUnit, setTempUnit] = useState<TempUnit>("F");
  const [sunMonth, setSunMonth] = useState(() => new Date().getMonth());
  const [sunSource, setSunSource] = useState<SunSource>("nsrdb");

  // Place switcher state
  const [searchType, setSearchType] = useState<PlaceType>(placeType);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchNames, setSearchNames] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync searchType when placeType changes externally
  useEffect(() => { setSearchType(placeType); }, [placeType]);

  // Load names for the selected search type
  useEffect(() => {
    if (!open) return;
    fetchJsonCached(DATA_URLS[searchType])
      .then((geo: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const names: string[] = geo.features
          .map((f: { properties: { name: string } }) => f.properties.name)
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b));
        setSearchNames(names);
      })
      .catch(() => { });
  }, [open, searchType]);

  const lowerQuery = searchQuery.toLowerCase().trim();
  const filteredNames = useMemo(() => {
    if (!lowerQuery) return searchNames;
    return searchNames.filter((n) => n.toLowerCase().includes(lowerQuery));
  }, [searchNames, lowerQuery]);

  const handleSearchSelect = useCallback((name: string) => {
    setSearchQuery("");
    setShowDropdown(false);
    onNavigate?.(searchType, name);
  }, [searchType, onNavigate]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const [allFeatures, setAllFeatures] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!open || !placeName) { setProperties(null); return; }
    setLoading(true);
    setError(null);
    fetchJsonCached(DATA_URLS[placeType])
      .then((geo: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const features = geo.features.map((f: { properties: Record<string, unknown> }) => f.properties);
        setAllFeatures(features);
        const props = features.find((p: Record<string, unknown>) => p.name === placeName);
        if (props) {
          setProperties(props as Record<string, unknown>);
        } else {
          setError(`${placeName} not found`);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, placeType, placeName]);

  // Hydrate climate data
  const hydratedProps = useMemo(() => {
    if (!properties) return null;
    const climate = properties.climate as
      | { tmin?: number[]; tmax?: number[]; tavg?: number[]; sunNsrdb?: number[]; sunEra5?: number[] }
      | undefined;
    const props = { ...properties };
    if (climate) {
      const toUnit = (c: number | null) => (c === null ? null : tempUnit === "F" ? cToF(c) : c);
      props._tmax = toUnit(getClimateMonthVal(climate.tmax, tempMonth));
      props._tavg = toUnit(getClimateMonthVal(climate.tavg, tempMonth));
      props._tmin = toUnit(getClimateMonthVal(climate.tmin, tempMonth));
      const sunArr = sunSource === "nsrdb" ? climate.sunNsrdb : climate.sunEra5;
      props._sunHrs = getClimateMonthVal(sunArr, sunMonth);
    }
    return props;
  }, [properties, tempMonth, tempUnit, sunMonth, sunSource]);

  const fmtTemp = useMemo(
    () => tempUnit === "F"
      ? (v: number) => `${Math.round(v)}°F`
      : (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}°C`,
    [tempUnit],
  );

  // Build map of all values per metric key (for ranking)
  const allValuesMap = useMemo(() => {
    if (allFeatures.length === 0) return new Map<string, number[]>();
    const map = new Map<string, number[]>();

    // Collect all demographic metric values
    for (const cat of DEMOGRAPHIC_CATEGORIES) {
      for (const m of cat.metrics) {
        const vals: number[] = [];
        for (const feat of allFeatures) {
          const v = getNestedValue(feat, m.key);
          if (v !== null) vals.push(v);
        }
        map.set(m.key, vals);
      }
    }

    // Collect climate metric values (hydrated for current month/unit/source)
    const climateKeys = [
      { key: "_tmax", getter: (c: any) => getClimateMonthVal(c?.tmax, tempMonth) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { key: "_tavg", getter: (c: any) => getClimateMonthVal(c?.tavg, tempMonth) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { key: "_tmin", getter: (c: any) => getClimateMonthVal(c?.tmin, tempMonth) }, // eslint-disable-line @typescript-eslint/no-explicit-any
      {
        key: "_sunHrs", getter: (c: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const arr = sunSource === "nsrdb" ? c?.sunNsrdb : c?.sunEra5;
          return getClimateMonthVal(arr, sunMonth);
        }
      },
    ];
    for (const ck of climateKeys) {
      const vals: number[] = [];
      for (const feat of allFeatures) {
        const raw = ck.getter(feat.climate);
        if (raw === null) continue;
        const v = ck.key.startsWith("_t") && tempUnit === "F" ? cToF(raw) : raw;
        vals.push(v);
      }
      map.set(ck.key, vals);
    }

    return map;
  }, [allFeatures, tempMonth, tempUnit, sunMonth, sunSource]);

  const allCategories = useMemo<CategoryDef[]>(() => [
    {
      label: "Temperature",
      icon: <LuThermometer className="h-3.5 w-3.5" />,
      metrics: [
        { key: "_tmax", label: "Day High", format: fmtTemp, polarity: "temperature" as Polarity },
        { key: "_tavg", label: "Average", format: fmtTemp, polarity: "temperature" as Polarity },
        { key: "_tmin", label: "Night Low", format: fmtTemp, polarity: "temperature" as Polarity },
      ],
    },
    {
      label: "Sunshine",
      icon: <LuSun className="h-3.5 w-3.5" />,
      metrics: [
        { key: "_sunHrs", label: "Hours/day", format: fmtSunHrs, polarity: "higher" as Polarity },
      ],
    },
    ...DEMOGRAPHIC_CATEGORIES,
  ], [fmtTemp]);

  const toggleCategory = (label: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (!open) return null;

  const displayName = placeType === "county" ? `${placeName} County` : placeName;

  return (
    <LegalModal
      open={open}
      onClose={onClose}
      title={placeType === "county" ? "CaliVibe: County Review" : "CaliVibe: City Review"}
      wide
      sizeClassName="!max-w-4xl !h-[90dvh] !w-[95vw] md:!w-[90vw]"
    >
      {/* Place switcher */}
      {onNavigate && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50/50">
          <div className="inline-flex rounded-md border border-gray-300 text-xs overflow-hidden">
            <button
              onClick={() => { setSearchType("county"); setSearchQuery(""); }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 font-medium transition-colors ${searchType === "county" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
            >
              <LuLandmark className="h-3 w-3" />
              Counties
            </button>
            <button
              onClick={() => { setSearchType("city"); setSearchQuery(""); }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 font-medium transition-colors border-l border-gray-300 ${searchType === "city" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
            >
              <LuMapPin className="h-3 w-3" />
              Cities
            </button>
          </div>
          <div className="flex-1 relative">
            <LuSearch className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={`Switch to another ${searchType === "county" ? "county" : "city"}...`}
              className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-[16px] sm:text-xs text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none transition-colors"
            />
            {showDropdown && lowerQuery && (
              <div
                ref={dropdownRef}
                className="absolute z-50 left-0 right-0 top-full mt-1 max-h-52 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
              >
                {filteredNames.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {filteredNames.slice(0, 50).map((name) => (
                      <li key={name}>
                        <button
                          onClick={() => handleSearchSelect(name)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                        >
                          <span>
                            <HighlightMatch text={name} query={lowerQuery} />
                            {searchType === "county" && <span className="text-gray-400 ml-1">County</span>}
                          </span>
                          <LuChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="overflow-y-auto overflow-x-hidden min-h-0 flex-1">
        {loading && <p className="text-center py-12 text-gray-500">Loading...</p>}
        {error && <p className="text-center py-12 text-red-600">Error: {error}</p>}

        {!loading && !error && hydratedProps && (
          <>
            {/* Title + Actions + Description */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="flex items-center gap-2 text-xl text-gray-900 min-w-0">
                  {placeType === "county"
                    ? <LuLandmark className="h-5 w-5 text-black flex-shrink-0" />
                    : <LuMapPin className="h-5 w-5 text-black flex-shrink-0" />}
                  <span className="truncate"><span className="font-bold">{displayName}</span><span className="text-gray-400 font-normal">, California</span></span>
                </h2>
                <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                  {onCompare && (
                    <button
                      onClick={() => onCompare(placeType, placeName)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      title={`Compare with other ${placeType === "county" ? "counties" : "cities"}`}
                    >
                      <LuColumns3 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Compare</span>
                    </button>
                  )}
                  {onToggleFavorite && (
                    <HeartButton
                      favorited={isFavorite?.(placeName) ?? false}
                      onToggle={() => onToggleFavorite(placeName)}
                    />
                  )}
                </div>
              </div>
              {/* Tabs — connected header + body block */}
              {(() => {
                const theme = TAB_THEMES[activeTab];
                return (
                  <div className="mt-3 mb-4 -mx-4 px-4">
                    {/* Tab buttons */}
                    <div className="flex gap-1" role="tablist">
                      {DETAIL_TABS.map((tab) => {
                        const t = TAB_THEMES[tab.id];
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onTabChange?.(tab.id)}
                            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${isActive
                              ? `border ${t.activeBorder} border-b-0 -mb-px relative z-10 ${t.activeBg} ${t.activeText}`
                              : `border border-transparent mb-0 ${t.inactiveText} ${t.inactiveHoverBg} rounded-lg`
                              }`}
                          >
                            {tab.icon}
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Tab body */}
                    <div className={`${theme.bodyBg} border ${theme.bodyBorder} rounded-b-lg rounded-tr-lg ${activeTab !== "local" ? "rounded-tl-lg" : ""}`}>
                      {DETAIL_TABS.map((tab) => (
                        <div
                          key={tab.id}
                          className={activeTab === tab.id ? "" : "hidden"}
                          role="tabpanel"
                          aria-label={tab.label}
                        >
                          <div className="px-4 py-4 text-sm text-gray-600">
                            <span className={`inline-block mb-2 rounded border ${theme.tagBorder} ${theme.tagBg} px-1.5 py-0.5 text-[8px] font-medium ${theme.tagText} uppercase tracking-wide`}>AI-Generated Summary Based on Actual Location Metrics. For entertainment purposes only — not housing or relocation advice.</span>
                            {tab.id === "local" && <p>Local&apos;s perspective on {displayName} will appear here.</p>}
                            {tab.id === "roast" && <p>Data-driven roast of {displayName} will appear here.</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Mini map */}
            <div className="px-4 pt-4">
              <PlaceMiniMap placeType={placeType} placeName={placeName} />
            </div>

            {/* Key Metrics subheader */}
            <div className="px-4">
              <h3 className="pt-4 pb-2 text-xs font-semibold text-gray-900 uppercase tracking-wide">Key Metrics</h3>

              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col />
                  <col className="w-24 sm:w-28" />
                  <col className="w-14 sm:w-18" />
                </colgroup>
                <tbody>
                  {allCategories.map((cat) => {
                    const isCollapsed = collapsedCategories.has(cat.label);

                    let controls: ReactNode = undefined;
                    if (cat.label === "Temperature") {
                      controls = (
                        <>
                          <MonthSelector value={tempMonth} onChange={(m) => { setTempMonth(m); setSunMonth(m); }} />
                          <SmallToggle
                            options={[{ value: "F", label: "°F" }, { value: "C", label: "°C" }]}
                            value={tempUnit}
                            onChange={(v) => setTempUnit(v as TempUnit)}
                          />
                        </>
                      );
                    } else if (cat.label === "Sunshine") {
                      controls = (
                        <>
                          <MonthSelector value={sunMonth} onChange={(m) => { setSunMonth(m); setTempMonth(m); }} />
                          <SmallToggle
                            options={[{ value: "nsrdb", label: "NSRDB" }, { value: "era5", label: "ERA5" }]}
                            value={sunSource}
                            onChange={(v) => setSunSource(v as SunSource)}
                          />
                        </>
                      );
                    }

                    return (
                      <DetailCategoryGroup
                        key={cat.label}
                        category={cat}
                        properties={hydratedProps}
                        collapsed={isCollapsed}
                        onToggle={() => toggleCategory(cat.label)}
                        controls={controls}
                        allValuesMap={allValuesMap}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-3 py-1.5 text-center text-[10px] text-gray-400">
        trekhleb.dev/cali-vibe
      </div>
    </LegalModal>
  );
}

// --- Category group ---

function DetailCategoryGroup({
  category,
  properties,
  collapsed,
  onToggle,
  controls,
  allValuesMap,
}: {
  category: CategoryDef;
  properties: Record<string, unknown>;
  collapsed: boolean;
  onToggle: () => void;
  controls?: ReactNode;
  allValuesMap: Map<string, number[]>;
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 select-none"
        onClick={onToggle}
      >
        <td
          colSpan={3}
          className="px-2 sm:px-4 py-2 font-semibold text-gray-700 bg-gray-100 border-b border-gray-200 text-xs uppercase tracking-wide"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <LuChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
              {category.icon}
              {category.label}
            </span>
            {controls && <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>{controls}</div>}
          </div>
        </td>
      </tr>
      {!collapsed &&
        category.metrics.map((metric) => {
          const val = getNestedValue(properties, metric.key);
          const allVals = allValuesMap.get(metric.key);
          const rankInfo = val !== null && allVals ? computeRank(val, allVals, metric.polarity) : null;
          return (
            <tr key={metric.key} className="hover:bg-gray-50/50">
              <td className="px-2 sm:px-4 py-1.5 text-gray-600 border-b border-gray-100 truncate" title={metric.label}>
                {metric.label}
              </td>
              <td className="px-2 sm:px-4 py-1.5 text-right border-b border-gray-100 tabular-nums font-medium text-gray-900 whitespace-nowrap">
                {val !== null ? metric.format(val) : <span className="text-gray-300">—</span>}
              </td>
              <td className="pr-2 sm:pr-4 py-1.5 text-right border-b border-gray-100 w-14 sm:w-16">
                {rankInfo && (
                  <span
                    className="inline-block rounded px-1 sm:px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                    style={rankInfo.color ? { backgroundColor: rankInfo.color } : undefined}
                  >
                    {rankInfo.rank}/{rankInfo.total}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
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
          className={`px-1 py-0.5 text-[9px] font-medium rounded-sm transition-colors ${value === idx ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-200"}`}
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
          className={`px-1.5 py-0.5 transition-colors ${i > 0 ? "border-l border-gray-300" : ""} ${value === opt.value ? "bg-gray-700 text-white" : "bg-white text-gray-500 hover:bg-gray-100"}`}
        >
          {opt.label}
        </button>
      ))}
    </span>
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
