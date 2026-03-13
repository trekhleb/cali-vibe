import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAP_STYLES, type MapStyleId } from "@/components/map/map-config";
import { CRIME_LABELS, type CrimeType } from "@/components/map/layers/county-crime-layer";
import {
  MONTH_LABELS,
  METRIC_LABELS,
  type TempMetric,
  type TempUnit,
  type HexResolution,
} from "@/components/map/layers/temperature-layer";
import type { CityDisplayMode } from "@/components/map/layers/city-borders-layer";
import type { CountyDisplayMode } from "@/components/map/layers/county-borders-layer";
import InfoTooltip from "@/components/info-tooltip";
import CaliVibeLogo from "@/components/cali-vibe-logo";
import Toggle from "@/components/toggle";
import SegmentedControl from "@/components/segmented-control";
import ErrorBoundary from "@/components/error-boundary";
import MapFooter from "@/components/map-footer";
import CrimeTableModal from "@/components/crime-table-modal";
import PopulationTableModal from "@/components/population-table-modal";
import TemperatureTableModal from "@/components/temperature-table-modal";
import { useFavorites } from "@/hooks/use-favorites";
import { useIsMobile } from "@/hooks/use-is-mobile";
import SortableFavoriteList from "@/components/favorites/sortable-favorite-list";
import GeoSearch from "@/components/city-search";
import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuSquareDashed,
  LuPalette,
  LuRotateCcw,
  LuLayers,
  LuHeart,
  LuChevronDown,
  LuTable,
  LuSun,
  LuMoon,
  LuThermometer,
  LuHexagon,
  LuMap,
  LuUsers,
  LuShieldAlert,
  LuBuilding2,
  LuSiren,
  LuMountain,
} from "react-icons/lu";
import type { California3DTerrainRef } from "@/components/map/terrain-3d/california-3d-terrain";

const crimeTypeIds = Object.keys(CRIME_LABELS) as CrimeType[];
const tempMetricIds = Object.keys(METRIC_LABELS) as TempMetric[];

const CaliforniaMap = lazy(() => import("@/components/map/california-map"));
const California3DTerrain = lazy(() => import("@/components/map/terrain-3d/california-3d-terrain"));

const styleIds = Object.keys(MAP_STYLES) as MapStyleId[];

const DISPLAY_MODE_OPTIONS = [
  { value: "borders", label: "Borders", icon: <LuSquareDashed className="h-4 w-4" /> },
  { value: "colored", label: "Colored", icon: <LuPalette className="h-4 w-4" /> },
];

const PEAK_UNIT_OPTIONS = [
  { value: "ft", label: "ft" },
  { value: "m", label: "m" },
];

// --- URL search params helpers ---
const DEFAULTS = {
  terrain3d: false,
  counties: false,
  cmode: "colored" as CountyDisplayMode,
  pop: false,
  cities: false,
  cimode: "colored" as CityDisplayMode,
  crime: false,
  ctype: "total" as CrimeType,
  cityCrime: false,
  cictype: "total" as CrimeType,
  style: "light" as MapStyleId,
  temp: false,
  tmetric: "tmax" as TempMetric,
  tmonth: new Date().getMonth() as number,
  tunit: "F" as TempUnit,
  tres: 5 as HexResolution,
  relief: true,
  peaks: true,
  punit: "ft" as "ft" | "m",
  tab: "layers" as "layers" | "favorites",
  drawer: null as boolean | null,
};

function readParams() {
  const p = new URLSearchParams(window.location.search);
  const bool = (key: string, def: boolean) => {
    const v = p.get(key);
    return v === null ? def : v === "1";
  };
  const str = <T extends string>(key: string, def: T, valid: readonly T[]) => {
    const v = p.get(key) as T | null;
    return v !== null && valid.includes(v) ? v : def;
  };
  return {
    terrain3d: bool("terrain3d", DEFAULTS.terrain3d),
    counties: bool("counties", DEFAULTS.counties),
    cmode: str("cmode", DEFAULTS.cmode, ["borders", "colored"] as const),
    pop: bool("pop", DEFAULTS.pop),
    cities: bool("cities", DEFAULTS.cities),
    cimode: str("cimode", DEFAULTS.cimode, ["borders", "colored"] as const),
    crime: bool("crime", DEFAULTS.crime),
    ctype: str("ctype", DEFAULTS.ctype, crimeTypeIds),
    cityCrime: bool("cityCrime", DEFAULTS.cityCrime),
    cictype: str("cictype", DEFAULTS.cictype, crimeTypeIds),
    temp: bool("temp", DEFAULTS.temp),
    tmetric: str("tmetric", DEFAULTS.tmetric, tempMetricIds),
    tmonth: (() => {
      const v = p.get("tmonth");
      if (v === null) return DEFAULTS.tmonth;
      const n = parseInt(v, 10);
      return n >= 0 && n <= 11 ? n : DEFAULTS.tmonth;
    })(),
    tunit: str("tunit", DEFAULTS.tunit, ["F", "C"] as const),
    tres: (() => {
      const v = p.get("tres");
      if (v === "4") return 4 as HexResolution;
      return 5 as HexResolution;
    })(),
    style: str("style", DEFAULTS.style, styleIds),
    relief: bool("relief", DEFAULTS.relief),
    peaks: bool("peaks", DEFAULTS.peaks),
    punit: str("punit", DEFAULTS.punit, ["ft", "m"] as const),
    tab: str("tab", DEFAULTS.tab, ["layers", "favorites"] as const),
    drawer: p.has("drawer") ? p.get("drawer") === "1" : DEFAULTS.drawer,
  };
}

export default function Home() {
  const init = useMemo(readParams, []);

  const [terrain3d, setTerrain3d] = useState(init.terrain3d);
  const [showCounties, setShowCounties] = useState(init.counties);
  const [countyDisplayMode, setCountyDisplayMode] = useState<CountyDisplayMode>(init.cmode);
  const [showPopulation, setShowPopulation] = useState(init.pop);
  const [showCities, setShowCities] = useState(init.cities);
  const [cityDisplayMode, setCityDisplayMode] = useState<CityDisplayMode>(init.cimode);
  const [showCrime, setShowCrime] = useState(init.crime);
  const [crimeType, setCrimeType] = useState<CrimeType>(init.ctype);
  const [showCityCrime, setShowCityCrime] = useState(init.cityCrime);
  const [cityCrimeType, setCityCrimeType] = useState<CrimeType>(init.cictype);
  const [showTemperature, setShowTemperature] = useState(init.temp);
  const [tempMetric, setTempMetric] = useState<TempMetric>(init.tmetric);
  const [tempMonth, setTempMonth] = useState(init.tmonth);
  const [tempUnit, setTempUnit] = useState<TempUnit>(init.tunit);
  const [tempResolution, setTempResolution] = useState<HexResolution>(init.tres);
  const [showTempTable, setShowTempTable] = useState(false);
  const [selectedHexH3, setSelectedHexH3] = useState<string | null>(null);
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>(init.style);
  const [showRelief, setShowRelief] = useState(init.relief);
  const [showPeaks, setShowPeaks] = useState(init.peaks);
  const [peakUnit, setPeakUnit] = useState<"ft" | "m">(init.punit);
  const [isDrawerOpen, setIsDrawerOpen] = useState(
    () => init.drawer !== null ? init.drawer : !window.matchMedia("(max-width: 767px)").matches
  );
  const [activeTab, setActiveTab] = useState<"layers" | "favorites">(init.tab);
  const [selectedCountyName, setSelectedCountyName] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [showPopulationTable, setShowPopulationTable] = useState(false);
  const [showCountyCrimeTable, setShowCountyCrimeTable] = useState(false);
  const [showCityCrimeTable, setShowCityCrimeTable] = useState(false);
  const isMobile = useIsMobile();

  const terrainRef = useRef<California3DTerrainRef>(null);

  // Sync state to URL search params
  useEffect(() => {
    const p = new URLSearchParams();
    const setBool = (key: string, val: boolean, def: boolean) => {
      if (val !== def) p.set(key, val ? "1" : "0");
    };
    const setStr = (key: string, val: string, def: string) => {
      if (val !== def) p.set(key, val);
    };
    setBool("terrain3d", terrain3d, DEFAULTS.terrain3d);
    setBool("counties", showCounties, DEFAULTS.counties);
    setStr("cmode", countyDisplayMode, DEFAULTS.cmode);
    setBool("pop", showPopulation, DEFAULTS.pop);
    setBool("cities", showCities, DEFAULTS.cities);
    setStr("cimode", cityDisplayMode, DEFAULTS.cimode);
    setBool("crime", showCrime, DEFAULTS.crime);
    setStr("ctype", crimeType, DEFAULTS.ctype);
    setBool("cityCrime", showCityCrime, DEFAULTS.cityCrime);
    setStr("cictype", cityCrimeType, DEFAULTS.cictype);
    setBool("temp", showTemperature, DEFAULTS.temp);
    setStr("tmetric", tempMetric, DEFAULTS.tmetric);
    if (tempMonth !== DEFAULTS.tmonth) p.set("tmonth", String(tempMonth));
    setStr("tunit", tempUnit, DEFAULTS.tunit);
    if (tempResolution !== DEFAULTS.tres) p.set("tres", String(tempResolution));
    setStr("style", mapStyleId, DEFAULTS.style);
    setBool("relief", showRelief, DEFAULTS.relief);
    setBool("peaks", showPeaks, DEFAULTS.peaks);
    setStr("punit", peakUnit, DEFAULTS.punit);
    setStr("tab", activeTab, DEFAULTS.tab);
    setBool("drawer", isDrawerOpen, !window.matchMedia("(max-width: 767px)").matches);
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [terrain3d, showCounties, countyDisplayMode, showPopulation, showCities, cityDisplayMode, showCrime, crimeType, showCityCrime, cityCrimeType, showTemperature, tempMetric, tempMonth, tempUnit, tempResolution, mapStyleId, showRelief, showPeaks, peakUnit, activeTab, isDrawerOpen]);

  const { favorites, favoriteCounties, favoriteCities, favoriteCountySet, favoriteCitySet, toggleFavorite, reorderFavorites } = useFavorites();

  const onToggleCountyFavorite = useCallback(
    (name: string) => toggleFavorite("county", name),
    [toggleFavorite]
  );
  const isCountyFavorite = useCallback(
    (name: string) => favoriteCountySet.has(name),
    [favoriteCountySet]
  );
  const onToggleCityFavorite = useCallback(
    (name: string) => toggleFavorite("city", name),
    [toggleFavorite]
  );
  const isCityFavorite = useCallback(
    (name: string) => favoriteCitySet.has(name),
    [favoriteCitySet]
  );

  // --- Mutually exclusive toggle helpers ---
  const toggleCounties = (on: boolean) => {
    setShowCounties(on);
    if (on) { setShowPopulation(false); setShowCrime(false); setShowCityCrime(false); setShowTemperature(false); setShowRelief(false); }
  };
  const togglePopulation = (on: boolean) => {
    setShowPopulation(on);
    if (on) { setShowCounties(false); setShowCrime(false); setShowCityCrime(false); setShowTemperature(false); setShowRelief(false); }
  };
  const toggleCrime = (on: boolean) => {
    setShowCrime(on);
    if (on) { setShowCounties(false); setShowPopulation(false); setShowCityCrime(false); setShowTemperature(false); setShowRelief(false); }
  };
  const toggleCityCrime = (on: boolean) => {
    setShowCityCrime(on);
    if (on) { setShowCounties(false); setShowPopulation(false); setShowCrime(false); setShowCities(false); setShowTemperature(false); setShowRelief(false); }
  };
  const toggleTemperature = (on: boolean) => {
    setShowTemperature(on);
    if (on) { setShowCounties(false); setShowPopulation(false); setShowCrime(false); setShowCityCrime(false); setShowCities(false); setShowRelief(false); }
  };
  const toggleCities = (on: boolean) => {
    setShowCities(on);
    if (on) { setShowCityCrime(false); setShowTemperature(false); setShowRelief(false); }
  };
  const toggleTerrain3d = (on: boolean) => {
    setTerrain3d(on);
    if (on) { setShowRelief(false); }
  };
  const toggleRelief = (on: boolean) => {
    setShowRelief(on);
    if (on) { setShowCounties(false); setShowPopulation(false); setShowCrime(false); setShowCityCrime(false); setShowTemperature(false); setShowCities(false); setTerrain3d(false); }
  };

  const resetAll = useCallback(() => {
    setTerrain3d(false);
    setShowCounties(false);
    setCountyDisplayMode("colored");
    setShowPopulation(false);
    setShowCities(false);
    setCityDisplayMode("colored");
    setShowCrime(false);
    setCrimeType("total");
    setShowCityCrime(false);
    setCityCrimeType("total");
    setShowTemperature(false);
    setTempMetric(DEFAULTS.tmetric);
    setTempMonth(new Date().getMonth());
    setTempUnit("F");
    setTempResolution(DEFAULTS.tres);
    setMapStyleId(DEFAULTS.style);
    setShowRelief(true);
    setShowPeaks(true);
    setPeakUnit("ft");
    setActiveTab("layers");
    setSelectedCountyName(null);
    setSelectedCityName(null);
  }, []);

  const goToFavoriteCounty = useCallback((name: string) => {
    setSelectedCityName(null);
    setShowCities(false);
    setShowPopulation(false);
    setShowCrime(false);
    setShowCityCrime(false);
    setShowTemperature(false);
    setShowRelief(false);
    setShowCounties(true);
    setSelectedCountyName(name);
  }, []);

  const goToFavoriteCity = useCallback((name: string) => {
    setSelectedCountyName(null);
    setShowCounties(false);
    setShowPopulation(false);
    setShowCrime(false);
    setShowCityCrime(false);
    setShowTemperature(false);
    setShowRelief(false);
    setShowCities(true);
    setSelectedCityName(name);
  }, []);

  const hasAnyFavorites = favorites.length > 0;

  // --- Resizable panel ---
  const MIN_PANEL = 220;
  const MAX_PANEL = 600;
  const [panelWidth, setPanelWidth] = useState(360);
  const dragging = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      setPanelWidth(Math.min(MAX_PANEL, Math.max(MIN_PANEL, e.clientX)));
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const overlayOffset = isDrawerOpen && !isMobile ? panelWidth : 0;

  return (
    <div className="relative h-dvh w-screen overflow-hidden">
      {/* Map layer: full screen underneath */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary>
          <Suspense fallback={null}>
            {showRelief ? (
              <California3DTerrain
                ref={terrainRef}
                className="h-full w-full"
                overlayOffset={overlayOffset}
                showPeaks={showPeaks}
                peakUnit={peakUnit}
              />
            ) : (
              <CaliforniaMap
                terrain3d={terrain3d}
                mapStyleId={mapStyleId}
                showCounties={showCounties}
                countyDisplayMode={countyDisplayMode}
                showPopulation={showPopulation}
                showCities={showCities}
                cityDisplayMode={cityDisplayMode}
                showCrime={showCrime}
                crimeType={crimeType}
                showCityCrime={showCityCrime}
                cityCrimeType={cityCrimeType}
                showTemperature={showTemperature}
                tempMetric={tempMetric}
                tempMonth={tempMonth}
                tempUnit={tempUnit}
                tempResolution={tempResolution}
                selectedHexH3={selectedHexH3}
                onDeselectHex={() => setSelectedHexH3(null)}
                onToggleCountyFavorite={onToggleCountyFavorite}
                isCountyFavorite={isCountyFavorite}
                onToggleCityFavorite={onToggleCityFavorite}
                isCityFavorite={isCityFavorite}
                overlayOffset={overlayOffset}
                selectedCountyName={selectedCountyName}
                selectedCityName={selectedCityName}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Persistent legal footer on the map */}
      <MapFooter overlayOffset={overlayOffset} />

      {/* Mobile backdrop */}
      {isDrawerOpen && (
        <div
          className="absolute inset-0 z-10 bg-black/20 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Container */}
      <div
        className="absolute top-0 bottom-0 left-0 z-20 flex w-[85%] md:w-auto transition-transform duration-300 ease-in-out"
        style={{ transform: isDrawerOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        {/* Left panel content */}
        <div
          className="flex flex-col p-4 md:p-6 bg-white/60 backdrop-blur-md shadow-2xl h-full border-r border-white/20 w-full md:w-auto"
          style={isMobile ? undefined : { width: panelWidth, minWidth: MIN_PANEL }}
        >
          <div className="flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CaliVibeLogo size={54} onClick={resetAll} />
              <div>
                <h1 className="text-lg font-bold leading-tight">CaliVibe</h1>
                <p className="text-xs text-gray-500">
                  Explore California neighborhoods
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-full p-2 text-black hover:bg-black/5 transition-colors"
              title="Close Menu"
            >
              <LuPanelLeftClose className="h-5 w-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex-shrink-0 mt-4 md:mt-5 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-gray-200/60">
            <div className="flex">
              <button
                onClick={() => setActiveTab("layers")}
                className={`flex-1 flex items-center justify-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "layers"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                <LuLayers className="h-4 w-4" />
                Layers
              </button>
              <button
                onClick={() => setActiveTab("favorites")}
                className={`flex-1 flex items-center justify-center gap-1.5 pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "favorites"
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                <LuHeart className="h-4 w-4" />
                Favorites
                {favorites.length > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-gray-400 text-white">
                    {favorites.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto -mx-4 px-4 md:-mx-6 md:px-6">
            {activeTab === "layers" && (
              <div className="flex flex-col gap-2">
                {/* Map style selector */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Map Style</span>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative inline-flex items-center flex-1 min-w-0">
                      <select
                        value={mapStyleId}
                        onChange={(e) => setMapStyleId(e.target.value as MapStyleId)}
                        className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                      >
                        {styleIds.map((id) => (
                          <option key={id} value={id}>
                            {MAP_STYLES[id].label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                        <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-1.5 shrink-0">
                      <Toggle checked={terrain3d} onChange={toggleTerrain3d} size="sm" />
                      <span className="text-xs font-medium text-gray-600">Terrain</span>
                    </label>
                  </div>
                </div>

                {/* County borders toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCounties ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCounties} onChange={toggleCounties} />
                    <LuMap className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">Counties</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.ca.gov/dataset/ca-geographic-boundaries" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        California Open Data Portal
                      </a>
                      <br />
                      US Census Bureau TIGER/Line, 2023
                    </InfoTooltip>
                  </label>
                  {showCounties && (
                    <>
                      <div className="mt-2 ml-14">
                        <SegmentedControl
                          value={countyDisplayMode}
                          onChange={(v) => setCountyDisplayMode(v as CountyDisplayMode)}
                          options={DISPLAY_MODE_OPTIONS}
                        />
                      </div>
                      <GeoSearch dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`} placeholder="Search counties..." onSelect={goToFavoriteCounty} />
                    </>
                  )}
                </div>

                {/* County population toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showPopulation ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showPopulation} onChange={togglePopulation} />
                    <LuUsers className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Population</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://dof.ca.gov/forecasting/demographics/estimates/E-6/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        CA Dept. of Finance
                      </a>
                      <br />
                      E-6 Population Estimates, 2024
                    </InfoTooltip>
                  </label>
                  {showPopulation && (
                    <div className="mt-2 ml-14">
                      <button
                        onClick={() => setShowPopulationTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* County crime toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCrime ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCrime} onChange={toggleCrime} />
                    <LuShieldAlert className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Crime</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://openjustice.doj.ca.gov/data" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        CA DOJ OpenJustice
                      </a>
                      <br />
                      &ldquo;Crime in California&rdquo; 2023 report.
                      <br />
                      Rates per 100K population.
                    </InfoTooltip>
                  </label>
                  {showCrime && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={crimeType}
                          onChange={(e) => setCrimeType(e.target.value as CrimeType)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {crimeTypeIds.map((id) => (
                            <option key={id} value={id}>
                              {CRIME_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCountyCrimeTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* City borders toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCities ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCities} onChange={toggleCities} />
                    <LuBuilding2 className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">Cities</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      TIGER/Line Places, 2024.
                      <br />
                      482 incorporated cities.
                    </InfoTooltip>
                  </label>
                  {showCities && (
                    <>
                      <div className="mt-2 ml-14">
                        <SegmentedControl
                          value={cityDisplayMode}
                          onChange={(v) => setCityDisplayMode(v as CityDisplayMode)}
                          options={DISPLAY_MODE_OPTIONS}
                        />
                      </div>
                      <GeoSearch dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`} placeholder="Search cities..." onSelect={goToFavoriteCity} />
                    </>
                  )}
                </div>

                {/* City crime toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityCrime ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityCrime} onChange={toggleCityCrime} />
                    <LuSiren className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Crime</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://openjustice.doj.ca.gov/data" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        CA DOJ OpenJustice
                      </a>
                      <br />
                      Crimes &amp; Clearances 2023.
                      <br />
                      Rates per 100K population.
                      <br />
                      Population:{" "}
                      <a href="https://dof.ca.gov/forecasting/demographics/estimates-e1/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        CA Dept. of Finance
                      </a>{" "}
                      E-1, 2024.
                    </InfoTooltip>
                  </label>
                  {showCityCrime && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cityCrimeType}
                          onChange={(e) => setCityCrimeType(e.target.value as CrimeType)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {crimeTypeIds.map((id) => (
                            <option key={id} value={id}>
                              {CRIME_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCityCrimeTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* Temperature toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showTemperature ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showTemperature} onChange={toggleTemperature} />
                    <LuThermometer className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">Temperature</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        ERA5 Reanalysis (ECMWF)
                      </a>
                      <br />
                      via{" "}
                      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        Open-Meteo
                      </a>
                      <br />
                      10-year monthly normals (2014–2023).
                      <br />
                      H3 hexagonal grid by Uber.
                    </InfoTooltip>
                  </label>
                  {showTemperature && (
                    <div className="mt-2 ml-14 flex flex-col gap-3">
                      {/* Metric selector */}
                      <SegmentedControl
                        value={tempMetric}
                        onChange={(v) => setTempMetric(v as TempMetric)}
                        options={[
                          { value: "tmax", label: "Day", icon: <LuSun className="h-3.5 w-3.5" /> },
                          { value: "tavg", label: "Avg", icon: <LuThermometer className="h-3.5 w-3.5" /> },
                          { value: "tmin", label: "Night", icon: <LuMoon className="h-3.5 w-3.5" /> },
                        ]}
                      />

                      {/* Month selector grid */}
                      <div className="grid grid-cols-6 gap-0.5">
                        {MONTH_LABELS.map((label, i) => (
                          <button
                            key={i}
                            onClick={() => setTempMonth(i)}
                            className={`rounded px-1 py-1 text-[11px] font-medium transition-colors ${
                              tempMonth === i
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Unit + Resolution row */}
                      <div className="flex items-center gap-3">
                        <SegmentedControl
                          value={tempUnit}
                          onChange={(v) => setTempUnit(v as TempUnit)}
                          options={[
                            { value: "F", label: "°F" },
                            { value: "C", label: "°C" },
                          ]}
                        />
                        <SegmentedControl
                          value={String(tempResolution)}
                          onChange={(v) => setTempResolution(Number(v) as HexResolution)}
                          options={[
                            { value: "4", label: "Large", icon: <LuHexagon className="h-4 w-4" /> },
                            { value: "5", label: "Small", icon: <LuHexagon className="h-3 w-3" /> },
                          ]}
                        />
                      </div>

                      <button
                        onClick={() => setShowTempTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* 3D Relief toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showRelief ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showRelief} onChange={toggleRelief} />
                    <LuMountain className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">3D Vibe</span>
                    <InfoTooltip>
                      Artistic raised-relief visualization.
                      <br />
                      Elevation data:{" "}
                      <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        AWS Terrain Tiles
                      </a>
                      <br />
                      Rotatable 3D view (drag to rotate).
                    </InfoTooltip>
                  </label>
                  {showRelief && (
                    <div className="mt-2 ml-14 flex flex-col gap-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <Toggle checked={showPeaks} onChange={setShowPeaks} size="sm" />
                        <span className="text-sm font-medium text-gray-700">Show Peaks</span>
                      </label>

                      {showPeaks && (
                        <div className="ml-11">
                          <SegmentedControl
                            value={peakUnit}
                            onChange={(v) => setPeakUnit(v as "ft" | "m")}
                            options={PEAK_UNIT_OPTIONS}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => terrainRef.current?.resetView()}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start w-auto"
                      >
                        <LuRotateCcw className="h-4 w-4 text-gray-900" />
                        Reset View
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "favorites" && (
              <div className="py-2">
                {!hasAnyFavorites ? (
                  <div className="text-center py-12 text-gray-500">
                    <LuHeart className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No favorites yet</p>
                    <p className="text-xs mt-1 text-gray-400">
                      Click the heart icon on the map to save counties and cities.
                    </p>
                  </div>
                ) : (
                  <>
                    {favoriteCounties.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Counties</h3>
                        <div className="mt-1">
                          <SortableFavoriteList
                            items={favoriteCounties}
                            onReorder={(names) => reorderFavorites("county", names)}
                            onClickItem={goToFavoriteCounty}
                            onRemoveItem={(name) => toggleFavorite("county", name)}
                          />
                        </div>
                      </div>
                    )}

                    {favoriteCities.length > 0 && (
                      <div className="mt-3">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cities</h3>
                        <div className="mt-1">
                          <SortableFavoriteList
                            items={favoriteCities}
                            onReorder={(names) => reorderFavorites("city", names)}
                            onClickItem={goToFavoriteCity}
                            onRemoveItem={(name) => toggleFavorite("city", name)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 pt-3 pb-1 border-t border-gray-300 text-center">
            <span className="text-[11px] text-gray-400">
              Vibecoded for fun by{" "}
              <a href="https://trekhleb.dev" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors">trekhleb.dev</a>
              <br />
              For illustration only, data may be inaccurate
            </span>
          </div>
        </div>

        {/* Drag divider */}
        <div
          onMouseDown={onDividerMouseDown}
          className="group hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-white/40 transition-colors bg-white/20 backdrop-blur-md"
        >
          <div className="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-gray-600 transition-colors" />
        </div>
      </div>

      {/* Logo + open button when drawer is closed */}
      <div
        className={`absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-3 rounded-xl bg-white/80 backdrop-blur-md shadow-lg px-4 py-3 transition-all duration-300 ${isDrawerOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"}`}
      >
        <CaliVibeLogo size={54} onClick={resetAll} />
        <div>
          <h1 className="text-lg font-bold leading-tight">CaliVibe</h1>
          <p className="text-xs text-gray-500">Explore California neighborhoods</p>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-2 rounded-full text-black hover:bg-black/5 transition-colors"
          title="Open Menu"
        >
          <LuPanelLeftOpen className="h-5 w-5" />
        </button>
      </div>

      {/* Data table modals */}
      <PopulationTableModal
        open={showPopulationTable}
        onClose={() => setShowPopulationTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Population (2024)"
        nameLabel="County"
      />
      <CrimeTableModal
        open={showCountyCrimeTable}
        onClose={() => setShowCountyCrimeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Crime Rates per 100K (2023)"
        nameLabel="County"
        activeCrimeType={crimeType}
      />
      <CrimeTableModal
        open={showCityCrimeTable}
        onClose={() => setShowCityCrimeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Crime Rates per 100K (2023)"
        nameLabel="City"
        activeCrimeType={cityCrimeType}
      />
      <TemperatureTableModal
        open={showTempTable}
        onClose={() => setShowTempTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-temperature-h3-res${tempResolution}.geojson`}
        title="Temperature Normals (2014–2023 avg)"
        nameLabel="Location"
        activeMonth={tempMonth}
        activeMetric={tempMetric}
        unit={tempUnit}
        onSelectHex={setSelectedHexH3}
      />
    </div>
  );
}
