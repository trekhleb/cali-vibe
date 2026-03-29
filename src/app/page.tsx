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
import HousingTableModal from "@/components/housing-table-modal";
import EducationTableModal from "@/components/education-table-modal";
import RaceTableModal from "@/components/race-table-modal";
import PovertyTableModal from "@/components/poverty-table-modal";
import CompareModal, { type CompareType, type SortConfig } from "@/components/compare-modal";
import { POPULATION_LABELS, type PopulationMetric } from "@/components/map/layers/county-population-layer";
import { HOUSING_LABELS, type HousingMetric } from "@/components/map/layers/county-housing-layer";
import { EDUCATION_LABELS, type EducationMetric } from "@/components/map/layers/county-education-layer";
import { RACE_LABELS, type RaceMetric } from "@/components/map/layers/county-race-layer";
import TemperatureTableModal from "@/components/temperature-table-modal";
import SunshineTableModal from "@/components/sunshine-table-modal";
import { ANNUAL_MONTH, type HexResolution as SunshineHexResolution, type SunshineDataSource } from "@/components/map/layers/sunshine-layer";
import { TRANSIT_SYSTEMS, DEFAULT_TRANSIT_SYSTEMS, BART_LINES, CALTRAIN_LINES, LAMETRO_LINES, SMART_LINES, VTA_LINES, CAPITOLCORRIDOR_LINES, SURFLINER_LINES, COASTER_LINES, SPRINTER_LINES, SDTROLLEY_LINES, METROLINK_LINES, SACRT_LINES, SANJOAQUINS_LINES, ACE_LINES, COASTSTARLIGHT_LINES, CALZEPHYR_LINES, SWCHIEF_LINES, MUNIMETRO_LINES, type TransitSystem, type ActiveColorMap } from "@/components/map/layers/transit-layer";
import { useFavorites } from "@/hooks/use-favorites";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useGeoJsonFeatureCount } from "@/hooks/use-geojson-feature-count";
import SortableFavoriteList from "@/components/favorites/sortable-favorite-list";
import GeoSearch from "@/components/city-search";
import TransitStopSearch from "@/components/transit-stop-search";
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
  LuBuilding2,
  LuSiren,
  LuMountain,
  LuTrainFront,
  LuHouse,
  LuWallet,
  LuGraduationCap,
  LuTrendingDown,
  LuColumns3,
} from "react-icons/lu";
import { IoManOutline } from "react-icons/io5";
import { RiFocus3Line, RiFocus3Fill } from "react-icons/ri";
import { FaGithub } from "react-icons/fa";
import type { California3DTerrainRef } from "@/components/map/terrain-3d/california-3d-terrain";

const crimeTypeIds = Object.keys(CRIME_LABELS) as CrimeType[];
const tempMetricIds = Object.keys(METRIC_LABELS) as TempMetric[];
const populationMetricIds = Object.keys(POPULATION_LABELS) as PopulationMetric[];
const housingMetricIds = (Object.keys(HOUSING_LABELS) as HousingMetric[]).filter((id) => id !== "income");
const educationMetricIds = Object.keys(EDUCATION_LABELS) as EducationMetric[];
const raceMetricIds = Object.keys(RACE_LABELS) as RaceMetric[];

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
  pmetric: "total" as PopulationMetric,
  cityPop: false,
  cpmetric: "total" as PopulationMetric,
  cities: false,
  cimode: "colored" as CityDisplayMode,
  crime: false,
  ctype: "total" as CrimeType,
  housing: false,
  hmetric: "homeValue" as HousingMetric,
  income: false,
  cityHousing: false,
  chmetric: "homeValue" as HousingMetric,
  cityIncome: false,
  cityCrime: false,
  cictype: "total" as CrimeType,
  edu: false,
  emetric: "bachPlus" as EducationMetric,
  cityEdu: false,
  cemetric: "bachPlus" as EducationMetric,
  race: false,
  rmetric: "hispanic" as RaceMetric,
  cityRace: false,
  crmetric: "hispanic" as RaceMetric,
  pov: false,
  cityPov: false,
  style: "light" as MapStyleId,
  temp: true,
  tmetric: "tmax" as TempMetric,
  tmonth: new Date().getMonth() as number,
  tunit: "F" as TempUnit,
  tres: 5 as HexResolution,
  shine: false,
  smonth: new Date().getMonth() as number,
  sres: 5 as SunshineHexResolution,
  ssrc: "nsrdb" as SunshineDataSource,
  transit: false,
  relief: false,
  peaks: false,
  punit: "ft" as "ft" | "m",
  tab: "layers" as "layers" | "favorites",
  drawer: null as boolean | null,
  compare: null as CompareType | null,
  cnames: [] as string[],
  csort: null as SortConfig,
  ctmonth: 12,
  ctunit: "F" as "F" | "C",
  csmonth: 12,
  cssrc: "nsrdb" as "nsrdb" | "era5",
  ccrime: false,
  about: false,
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
    pmetric: str("pmetric", DEFAULTS.pmetric, populationMetricIds),
    cityPop: bool("cityPop", DEFAULTS.cityPop),
    cpmetric: str("cpmetric", DEFAULTS.cpmetric, populationMetricIds),
    cities: bool("cities", DEFAULTS.cities),
    cimode: str("cimode", DEFAULTS.cimode, ["borders", "colored"] as const),
    crime: bool("crime", DEFAULTS.crime),
    ctype: str("ctype", DEFAULTS.ctype, crimeTypeIds),
    housing: bool("housing", DEFAULTS.housing),
    hmetric: str("hmetric", DEFAULTS.hmetric, housingMetricIds),
    income: bool("income", DEFAULTS.income),
    cityHousing: bool("cityHousing", DEFAULTS.cityHousing),
    chmetric: str("chmetric", DEFAULTS.chmetric, housingMetricIds),
    cityIncome: bool("cityIncome", DEFAULTS.cityIncome),
    cityCrime: bool("cityCrime", DEFAULTS.cityCrime),
    cictype: str("cictype", DEFAULTS.cictype, crimeTypeIds),
    edu: bool("edu", DEFAULTS.edu),
    emetric: str("emetric", DEFAULTS.emetric, educationMetricIds),
    cityEdu: bool("cityEdu", DEFAULTS.cityEdu),
    cemetric: str("cemetric", DEFAULTS.cemetric, educationMetricIds),
    race: bool("race", DEFAULTS.race),
    rmetric: str("rmetric", DEFAULTS.rmetric, raceMetricIds),
    cityRace: bool("cityRace", DEFAULTS.cityRace),
    crmetric: str("crmetric", DEFAULTS.crmetric, raceMetricIds),
    pov: bool("pov", DEFAULTS.pov),
    cityPov: bool("cityPov", DEFAULTS.cityPov),
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
    shine: bool("shine", DEFAULTS.shine),
    smonth: (() => {
      const v = p.get("smonth");
      if (v === null) return DEFAULTS.smonth;
      const n = parseInt(v, 10);
      return (n >= 0 && n <= 12) ? n : DEFAULTS.smonth; // 12 = annual
    })(),
    sres: (() => {
      const v = p.get("sres");
      if (v === "4") return 4 as SunshineHexResolution;
      return 5 as SunshineHexResolution;
    })(),
    ssrc: str("ssrc", DEFAULTS.ssrc, ["nsrdb", "era5"] as const),
    transit: bool("transit", DEFAULTS.transit),
    tsys: (() => {
      const v = p.get("tsys");
      if (v === null) return [...DEFAULT_TRANSIT_SYSTEMS];
      const allIds = TRANSIT_SYSTEMS.map((s) => s.id) as string[];
      const parsed = v.split(",").filter((id) => allIds.includes(id)) as TransitSystem[];
      return parsed.length > 0 ? parsed : [...DEFAULT_TRANSIT_SYSTEMS];
    })(),
    style: str("style", DEFAULTS.style, styleIds),
    relief: bool("relief", DEFAULTS.relief),
    peaks: bool("peaks", DEFAULTS.peaks),
    punit: str("punit", DEFAULTS.punit, ["ft", "m"] as const),
    tab: str("tab", DEFAULTS.tab, ["layers", "favorites"] as const),
    drawer: p.has("drawer") ? p.get("drawer") === "1" : DEFAULTS.drawer,
    compare: (() => {
      const v = p.get("compare");
      if (v === "county" || v === "city") return v as CompareType;
      return null;
    })(),
    cnames: (() => {
      const v = p.get("cnames");
      if (!v) return [] as string[];
      try {
        return v.split(",").map(decodeURIComponent).filter(Boolean);
      } catch {
        return [] as string[];
      }
    })(),
    csort: (() => {
      const k = p.get("csort");
      const d = p.get("cdir");
      if (!k) return null;
      return { metricKey: k, direction: (d === "asc" ? "asc" : "desc") } as SortConfig;
    })(),
    ctmonth: (() => {
      const v = p.get("ctmonth");
      if (v === null) return DEFAULTS.ctmonth;
      const n = parseInt(v, 10);
      return n >= 0 && n <= 12 ? n : DEFAULTS.ctmonth;
    })(),
    ctunit: str("ctunit", DEFAULTS.ctunit, ["F", "C"] as const),
    csmonth: (() => {
      const v = p.get("csmonth");
      if (v === null) return DEFAULTS.csmonth;
      const n = parseInt(v, 10);
      return n >= 0 && n <= 12 ? n : DEFAULTS.csmonth;
    })(),
    cssrc: str("cssrc", DEFAULTS.cssrc, ["nsrdb", "era5"] as const),
    ccrime: bool("ccrime", DEFAULTS.ccrime),
    about: bool("about", DEFAULTS.about),
  };
}

export default function Home() {
  const init = useMemo(readParams, []);

  const [terrain3d, setTerrain3d] = useState(init.terrain3d);
  const [showCounties, setShowCounties] = useState(init.counties);
  const [countyDisplayMode, setCountyDisplayMode] = useState<CountyDisplayMode>(init.cmode);
  const [showPopulation, setShowPopulation] = useState(init.pop);
  const [populationMetric, setPopulationMetric] = useState<PopulationMetric>(init.pmetric);
  const [showCityPopulation, setShowCityPopulation] = useState(init.cityPop);
  const [cityPopulationMetric, setCityPopulationMetric] = useState<PopulationMetric>(init.cpmetric);
  const [showCityPopulationTable, setShowCityPopulationTable] = useState(false);
  const [selectedPopulationCityName, setSelectedPopulationCityName] = useState<string | null>(null);
  const [showCities, setShowCities] = useState(init.cities);
  const [cityDisplayMode, setCityDisplayMode] = useState<CityDisplayMode>(init.cimode);
  const [showCrime, setShowCrime] = useState(init.crime);
  const [crimeType, setCrimeType] = useState<CrimeType>(init.ctype);
  const [showHousing, setShowHousing] = useState(init.housing);
  const [housingMetric, setHousingMetric] = useState<HousingMetric>(init.hmetric);
  const [showIncome, setShowIncome] = useState(init.income);
  const [showCityHousing, setShowCityHousing] = useState(init.cityHousing);
  const [cityHousingMetric, setCityHousingMetric] = useState<HousingMetric>(init.chmetric);
  const [showCityIncome, setShowCityIncome] = useState(init.cityIncome);
  const [showCityCrime, setShowCityCrime] = useState(init.cityCrime);
  const [cityCrimeType, setCityCrimeType] = useState<CrimeType>(init.cictype);
  const [showEducation, setShowEducation] = useState(init.edu);
  const [educationMetric, setEducationMetric] = useState<EducationMetric>(init.emetric);
  const [showCityEducation, setShowCityEducation] = useState(init.cityEdu);
  const [cityEducationMetric, setCityEducationMetric] = useState<EducationMetric>(init.cemetric);
  const [showEducationTable, setShowEducationTable] = useState(false);
  const [selectedEducationCountyName, setSelectedEducationCountyName] = useState<string | null>(null);
  const [showCityEducationTable, setShowCityEducationTable] = useState(false);
  const [selectedEducationCityName, setSelectedEducationCityName] = useState<string | null>(null);
  const [showRace, setShowRace] = useState(init.race);
  const [raceMetric, setRaceMetric] = useState<RaceMetric>(init.rmetric);
  const [showCityRace, setShowCityRace] = useState(init.cityRace);
  const [cityRaceMetric, setCityRaceMetric] = useState<RaceMetric>(init.crmetric);
  const [showRaceTable, setShowRaceTable] = useState(false);
  const [selectedRaceCountyName, setSelectedRaceCountyName] = useState<string | null>(null);
  const [showCityRaceTable, setShowCityRaceTable] = useState(false);
  const [selectedRaceCityName, setSelectedRaceCityName] = useState<string | null>(null);
  const [showPoverty, setShowPoverty] = useState(init.pov);
  const [showCityPoverty, setShowCityPoverty] = useState(init.cityPov);
  const [showPovertyTable, setShowPovertyTable] = useState(false);
  const [selectedPovertyCountyName, setSelectedPovertyCountyName] = useState<string | null>(null);
  const [showCityPovertyTable, setShowCityPovertyTable] = useState(false);
  const [selectedPovertyCityName, setSelectedPovertyCityName] = useState<string | null>(null);
  const [showTemperature, setShowTemperature] = useState(init.temp);
  const [tempMetric, setTempMetric] = useState<TempMetric>(init.tmetric);
  const [tempMonth, setTempMonth] = useState(init.tmonth);
  const [tempUnit, setTempUnit] = useState<TempUnit>(init.tunit);
  const [tempResolution, setTempResolution] = useState<HexResolution>(init.tres);
  const [showTempTable, setShowTempTable] = useState(false);
  const [selectedHexH3, setSelectedHexH3] = useState<string | null>(null);
  const [showSunshine, setShowSunshine] = useState(init.shine);
  const [sunshineMonth, setSunshineMonth] = useState(init.smonth);
  const [sunshineResolution, setSunshineResolution] = useState<SunshineHexResolution>(init.sres);
  const [sunshineDataSource, setSunshineDataSource] = useState<SunshineDataSource>(init.ssrc);
  const [showSunshineTable, setShowSunshineTable] = useState(false);
  const [selectedSunshineH3, setSelectedSunshineH3] = useState<string | null>(null);
  const [showTransit, setShowTransit] = useState(init.transit);
  const [transitSystems, setTransitSystems] = useState<TransitSystem[]>(init.tsys);
  const [selectedTransitStopName, setSelectedTransitStopName] = useState<string | null>(null);
  const [flyToTransitStop, setFlyToTransitStop] = useState(false);
  // null = all lines visible; string[] = only these colors visible
  const [bartActiveColors, setBartActiveColors] = useState<string[] | null>(null);
  const [caltrainActiveColors, setCaltrainActiveColors] = useState<string[] | null>(null);
  const [lametroActiveColors, setLametroActiveColors] = useState<string[] | null>(null);
  const [smartActiveColors, setSmartActiveColors] = useState<string[] | null>(null);
  const [vtaActiveColors, setVtaActiveColors] = useState<string[] | null>(null);
  const [capitolcorridorActiveColors, setCapitolcorridorActiveColors] = useState<string[] | null>(null);
  const [surflinerActiveColors, setSurflinerActiveColors] = useState<string[] | null>(null);
  const [coasterActiveColors, setCoasterActiveColors] = useState<string[] | null>(null);
  const [sprinterActiveColors, setSprinterActiveColors] = useState<string[] | null>(null);
  const [sdtrolleyActiveColors, setSdtrolleyActiveColors] = useState<string[] | null>(null);
  const [metrolinkActiveColors, setMetrolinkActiveColors] = useState<string[] | null>(null);
  const [sacrtActiveColors, setSacrtActiveColors] = useState<string[] | null>(null);
  const [sanjoaquinsActiveColors, setSanjoaquinsActiveColors] = useState<string[] | null>(null);
  const [aceActiveColors, setAceActiveColors] = useState<string[] | null>(null);
  const [coaststarlightActiveColors, setCoaststarlightActiveColors] = useState<string[] | null>(null);
  const [calzephyrActiveColors, setCalzephyrActiveColors] = useState<string[] | null>(null);
  const [swchiefActiveColors, setSwchiefActiveColors] = useState<string[] | null>(null);
  const [munimetroActiveColors, setMunimetroActiveColors] = useState<string[] | null>(null);
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
  const [selectedPopulationCountyName, setSelectedPopulationCountyName] = useState<string | null>(null);
  const [selectedCrimeCountyName, setSelectedCrimeCountyName] = useState<string | null>(null);
  const [selectedCrimeCityName, setSelectedCrimeCityName] = useState<string | null>(null);
  const [showPopulationTable, setShowPopulationTable] = useState(false);
  const [showCountyCrimeTable, setShowCountyCrimeTable] = useState(false);
  const [showCityCrimeTable, setShowCityCrimeTable] = useState(false);
  const [showHousingTable, setShowHousingTable] = useState(false);
  const [selectedHousingCountyName, setSelectedHousingCountyName] = useState<string | null>(null);
  const [showIncomeTable, setShowIncomeTable] = useState(false);
  const [selectedIncomeCountyName, setSelectedIncomeCountyName] = useState<string | null>(null);
  const [showCityHousingTable, setShowCityHousingTable] = useState(false);
  const [selectedHousingCityName, setSelectedHousingCityName] = useState<string | null>(null);
  const [showCityIncomeTable, setShowCityIncomeTable] = useState(false);
  const [selectedIncomeCityName, setSelectedIncomeCityName] = useState<string | null>(null);
  const [compareType, setCompareType] = useState<CompareType | null>(init.compare);
  const [compareNames, setCompareNames] = useState<string[]>(init.cnames);
  const [compareSortConfig, setCompareSortConfig] = useState<SortConfig>(init.csort);
  const [compareTempMonth, setCompareTempMonth] = useState(init.ctmonth);
  const [compareTempUnit, setCompareTempUnit] = useState<"F" | "C">(init.ctunit);
  const [compareSunMonth, setCompareSunMonth] = useState(init.csmonth);
  const [compareSunSource, setCompareSunSource] = useState<"nsrdb" | "era5">(init.cssrc);
  const [compareCrimeAbsolute, setCompareCrimeAbsolute] = useState(init.ccrime);
  const [showAbout, setShowAbout] = useState(init.about);
  const isMobile = useIsMobile();

  const tempHexUrl = `${import.meta.env.BASE_URL}data/california-temperature-h3-res${tempResolution}.geojson`;
  const sunshineHexUrl = `${import.meta.env.BASE_URL}data/california-sunshine-${sunshineDataSource}-h3-res${sunshineResolution}.geojson`;
  const tempHexCount = useGeoJsonFeatureCount(showTemperature ? tempHexUrl : "");
  const sunshineHexCount = useGeoJsonFeatureCount(showSunshine ? sunshineHexUrl : "");

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
    setStr("pmetric", populationMetric, DEFAULTS.pmetric);
    setBool("cityPop", showCityPopulation, DEFAULTS.cityPop);
    setStr("cpmetric", cityPopulationMetric, DEFAULTS.cpmetric);
    setBool("cities", showCities, DEFAULTS.cities);
    setStr("cimode", cityDisplayMode, DEFAULTS.cimode);
    setBool("crime", showCrime, DEFAULTS.crime);
    setStr("ctype", crimeType, DEFAULTS.ctype);
    setBool("housing", showHousing, DEFAULTS.housing);
    setStr("hmetric", housingMetric, DEFAULTS.hmetric);
    setBool("income", showIncome, DEFAULTS.income);
    setBool("cityHousing", showCityHousing, DEFAULTS.cityHousing);
    setStr("chmetric", cityHousingMetric, DEFAULTS.chmetric);
    setBool("cityIncome", showCityIncome, DEFAULTS.cityIncome);
    setBool("cityCrime", showCityCrime, DEFAULTS.cityCrime);
    setStr("cictype", cityCrimeType, DEFAULTS.cictype);
    setBool("edu", showEducation, DEFAULTS.edu);
    setStr("emetric", educationMetric, DEFAULTS.emetric);
    setBool("cityEdu", showCityEducation, DEFAULTS.cityEdu);
    setStr("cemetric", cityEducationMetric, DEFAULTS.cemetric);
    setBool("race", showRace, DEFAULTS.race);
    setStr("rmetric", raceMetric, DEFAULTS.rmetric);
    setBool("cityRace", showCityRace, DEFAULTS.cityRace);
    setStr("crmetric", cityRaceMetric, DEFAULTS.crmetric);
    setBool("pov", showPoverty, DEFAULTS.pov);
    setBool("cityPov", showCityPoverty, DEFAULTS.cityPov);
    setBool("temp", showTemperature, DEFAULTS.temp);
    setStr("tmetric", tempMetric, DEFAULTS.tmetric);
    if (tempMonth !== DEFAULTS.tmonth) p.set("tmonth", String(tempMonth));
    setStr("tunit", tempUnit, DEFAULTS.tunit);
    if (tempResolution !== DEFAULTS.tres) p.set("tres", String(tempResolution));
    setBool("shine", showSunshine, DEFAULTS.shine);
    if (sunshineMonth !== DEFAULTS.smonth) p.set("smonth", String(sunshineMonth));
    if (sunshineResolution !== DEFAULTS.sres) p.set("sres", String(sunshineResolution));
    if (sunshineDataSource !== DEFAULTS.ssrc) p.set("ssrc", sunshineDataSource);
    setBool("transit", showTransit, DEFAULTS.transit);
    const isDefaultSystems = DEFAULT_TRANSIT_SYSTEMS.length === transitSystems.length && DEFAULT_TRANSIT_SYSTEMS.every((id) => transitSystems.includes(id));
    if (!isDefaultSystems) p.set("tsys", transitSystems.join(","));
    setStr("style", mapStyleId, DEFAULTS.style);
    setBool("relief", showRelief, DEFAULTS.relief);
    setBool("peaks", showPeaks, DEFAULTS.peaks);
    setStr("punit", peakUnit, DEFAULTS.punit);
    setStr("tab", activeTab, DEFAULTS.tab);
    setBool("drawer", isDrawerOpen, !window.matchMedia("(max-width: 767px)").matches);
    if (compareType) {
      p.set("compare", compareType);
      if (compareNames.length > 0) p.set("cnames", compareNames.map(encodeURIComponent).join(","));
      if (compareSortConfig) {
        p.set("csort", compareSortConfig.metricKey);
        if (compareSortConfig.direction === "asc") p.set("cdir", "asc");
      }
      if (compareTempMonth !== DEFAULTS.ctmonth) p.set("ctmonth", String(compareTempMonth));
      if (compareTempUnit !== DEFAULTS.ctunit) p.set("ctunit", compareTempUnit);
      if (compareSunMonth !== DEFAULTS.csmonth) p.set("csmonth", String(compareSunMonth));
      if (compareSunSource !== DEFAULTS.cssrc) p.set("cssrc", compareSunSource);
      if (compareCrimeAbsolute !== DEFAULTS.ccrime) p.set("ccrime", "1");
    }
    setBool("about", showAbout, DEFAULTS.about);
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [terrain3d, showCounties, countyDisplayMode, showPopulation, populationMetric, showCityPopulation, cityPopulationMetric, showCities, cityDisplayMode, showCrime, crimeType, showHousing, housingMetric, showIncome, showEducation, educationMetric, showCityEducation, cityEducationMetric, showRace, raceMetric, showCityRace, cityRaceMetric, showPoverty, showCityPoverty, showCityHousing, cityHousingMetric, showCityIncome, showCityCrime, cityCrimeType, showTemperature, tempMetric, tempMonth, tempUnit, tempResolution, showSunshine, sunshineMonth, sunshineResolution, sunshineDataSource, showTransit, transitSystems, mapStyleId, showRelief, showPeaks, peakUnit, activeTab, isDrawerOpen, compareType, compareNames, compareSortConfig, compareTempMonth, compareTempUnit, compareSunMonth, compareSunSource, compareCrimeAbsolute, showAbout]);

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

  const openCompare = useCallback((type: CompareType, names: string[]) => {
    setCompareType(type);
    setCompareNames(names);
    setCompareSortConfig(null);
  }, []);
  const closeCompare = useCallback(() => {
    setCompareType(null);
    setCompareNames([]);
    setCompareSortConfig(null);
  }, []);

  // --- Mutually exclusive toggle helpers ---
  const clearOverlays = () => {
    setShowCounties(false); setShowPopulation(false); setShowCrime(false);
    setShowHousing(false); setShowIncome(false); setShowEducation(false); setShowRace(false); setShowPoverty(false);
    setShowCityPopulation(false); setShowCityHousing(false); setShowCityIncome(false); setShowCityEducation(false); setShowCityRace(false); setShowCityPoverty(false);
    setShowCityCrime(false); setShowTemperature(false); setShowSunshine(false);
    setShowRelief(false);
  };
  const toggleCounties = (on: boolean) => {
    if (on) clearOverlays();
    setShowCounties(on);
  };
  const togglePopulation = (on: boolean) => {
    if (on) clearOverlays();
    setShowPopulation(on);
  };
  const toggleCrime = (on: boolean) => {
    if (on) clearOverlays();
    setShowCrime(on);
  };
  const toggleHousing = (on: boolean) => {
    if (on) clearOverlays();
    setShowHousing(on);
  };
  const toggleIncome = (on: boolean) => {
    if (on) clearOverlays();
    setShowIncome(on);
  };
  const toggleEducation = (on: boolean) => {
    if (on) clearOverlays();
    setShowEducation(on);
  };
  const toggleCityEducation = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityEducation(on);
  };
  const toggleRace = (on: boolean) => {
    if (on) clearOverlays();
    setShowRace(on);
  };
  const toggleCityRace = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityRace(on);
  };
  const toggleCityPopulation = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityPopulation(on);
  };
  const togglePoverty = (on: boolean) => {
    if (on) clearOverlays();
    setShowPoverty(on);
  };
  const toggleCityPoverty = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityPoverty(on);
  };
  const toggleCityHousing = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityHousing(on);
  };
  const toggleCityIncome = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityIncome(on);
  };
  const toggleCityCrime = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowCityCrime(on);
  };
  const toggleTemperature = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowTemperature(on);
  };
  const toggleSunshine = (on: boolean) => {
    if (on) { clearOverlays(); setShowCities(false); }
    setShowSunshine(on);
  };
  const toggleCities = (on: boolean) => {
    setShowCities(on);
    if (on) { setShowCityPopulation(false); setShowCityCrime(false); setShowCityHousing(false); setShowCityIncome(false); setShowCityEducation(false); setShowCityRace(false); setShowCityPoverty(false); setShowTemperature(false); setShowSunshine(false); setShowRelief(false); }
  };
  const toggleTerrain3d = (on: boolean) => {
    setTerrain3d(on);
    if (on) { setShowRelief(false); setShowPeaks(true); }
  };
  const toggleTransit = (on: boolean) => {
    setShowTransit(on);
    if (on) { setShowRelief(false); }
  };
  const toggleRelief = (on: boolean) => {
    setShowRelief(on);
    if (on) { setShowCounties(false); setShowPopulation(false); setShowCrime(false); setShowHousing(false); setShowIncome(false); setShowEducation(false); setShowRace(false); setShowPoverty(false); setShowCityPopulation(false); setShowCityHousing(false); setShowCityIncome(false); setShowCityEducation(false); setShowCityRace(false); setShowCityPoverty(false); setShowCityCrime(false); setShowTemperature(false); setShowSunshine(false); setShowCities(false); setShowTransit(false); setTerrain3d(false); setShowPeaks(true); }
  };

  const resetAll = useCallback(() => {
    setTerrain3d(false);
    setShowCounties(false);
    setCountyDisplayMode("colored");
    setShowPopulation(false);
    setPopulationMetric("total");
    setShowCityPopulation(false);
    setCityPopulationMetric("total");
    setShowCities(false);
    setCityDisplayMode("colored");
    setShowCrime(false);
    setCrimeType("total");
    setShowHousing(false);
    setHousingMetric("homeValue");
    setShowIncome(false);
    setShowCityHousing(false);
    setCityHousingMetric("homeValue");
    setShowCityIncome(false);
    setShowCityCrime(false);
    setCityCrimeType("total");
    setShowEducation(false);
    setEducationMetric("bachPlus");
    setShowCityEducation(false);
    setCityEducationMetric("bachPlus");
    setShowRace(false);
    setRaceMetric("hispanic");
    setShowCityRace(false);
    setCityRaceMetric("hispanic");
    setShowPoverty(false);
    setShowCityPoverty(false);
    setShowTemperature(DEFAULTS.temp);
    setTempMetric(DEFAULTS.tmetric);
    setTempMonth(new Date().getMonth());
    setTempUnit("F");
    setTempResolution(DEFAULTS.tres);
    setShowSunshine(false);
    setSunshineMonth(new Date().getMonth());
    setSunshineResolution(DEFAULTS.sres);
    setSunshineDataSource(DEFAULTS.ssrc);
    setShowTransit(false);
    setTransitSystems([...DEFAULT_TRANSIT_SYSTEMS]);
    setBartActiveColors(null);
    setCaltrainActiveColors(null);
    setLametroActiveColors(null);
    setSmartActiveColors(null);
    setVtaActiveColors(null);
    setCapitolcorridorActiveColors(null);
    setSurflinerActiveColors(null);
    setCoasterActiveColors(null);
    setSprinterActiveColors(null);
    setSdtrolleyActiveColors(null);
    setMetrolinkActiveColors(null);
    setSacrtActiveColors(null);
    setSanjoaquinsActiveColors(null);
    setAceActiveColors(null);
    setCoaststarlightActiveColors(null);
    setCalzephyrActiveColors(null);
    setSwchiefActiveColors(null);
    setMunimetroActiveColors(null);
    setSelectedTransitStopName(null);
    setFlyToTransitStop(false);
    setMapStyleId(DEFAULTS.style);
    setShowRelief(DEFAULTS.relief);
    setShowPeaks(DEFAULTS.peaks);
    setPeakUnit("ft");
    setActiveTab("layers");
    setSelectedCountyName(null);
    setSelectedCityName(null);
    setSelectedPopulationCountyName(null);
    setSelectedPopulationCityName(null);
    setSelectedCrimeCountyName(null);
    setSelectedHousingCountyName(null);
    setSelectedIncomeCountyName(null);
    setSelectedHousingCityName(null);
    setSelectedIncomeCityName(null);
    setSelectedCrimeCityName(null);
    setSelectedEducationCountyName(null);
    setSelectedEducationCityName(null);
    setSelectedRaceCountyName(null);
    setSelectedRaceCityName(null);
  }, []);

  const goToFavoriteCounty = useCallback((name: string) => {
    setSelectedCityName(null);
    setShowCities(false);
    setShowPopulation(false);
    setShowCrime(false);
    setShowHousing(false);
    setShowIncome(false);
    setShowEducation(false);
    setShowRace(false);
    setShowPoverty(false);
    setShowCityPopulation(false);
    setShowCityHousing(false);
    setShowCityIncome(false);
    setShowCityEducation(false);
    setShowCityRace(false);
    setShowCityPoverty(false);
    setShowCityCrime(false);
    setShowTemperature(false);
    setShowSunshine(false);
    setShowRelief(false);
    setShowCounties(true);
    setSelectedCountyName(name);
  }, []);

  const goToFavoriteCity = useCallback((name: string) => {
    setSelectedCountyName(null);
    setShowCounties(false);
    setShowPopulation(false);
    setShowCrime(false);
    setShowHousing(false);
    setShowIncome(false);
    setShowEducation(false);
    setShowRace(false);
    setShowPoverty(false);
    setShowCityPopulation(false);
    setShowCityHousing(false);
    setShowCityIncome(false);
    setShowCityEducation(false);
    setShowCityRace(false);
    setShowCityPoverty(false);
    setShowCityCrime(false);
    setShowTemperature(false);
    setShowSunshine(false);
    setShowRelief(false);
    setShowCities(true);
    setSelectedCityName(name);
  }, []);

  const goToCrimeCounty = useCallback((name: string) => {
    setSelectedCrimeCountyName(name);
  }, []);

  const goToCrimeCity = useCallback((name: string) => {
    setSelectedCrimeCityName(name);
  }, []);

  const goToHousingCounty = useCallback((name: string) => {
    setSelectedHousingCountyName(name);
  }, []);

  const goToIncomeCounty = useCallback((name: string) => {
    setSelectedIncomeCountyName(name);
  }, []);

  const goToHousingCity = useCallback((name: string) => {
    setSelectedHousingCityName(name);
  }, []);

  const goToIncomeCity = useCallback((name: string) => {
    setSelectedIncomeCityName(name);
  }, []);

  const goToEducationCounty = useCallback((name: string) => {
    setSelectedEducationCountyName(name);
  }, []);

  const goToEducationCity = useCallback((name: string) => {
    setSelectedEducationCityName(name);
  }, []);

  const goToRaceCounty = useCallback((name: string) => {
    setSelectedRaceCountyName(name);
  }, []);

  const goToRaceCity = useCallback((name: string) => {
    setSelectedRaceCityName(name);
  }, []);

  const goToPopulationCity = useCallback((name: string) => {
    setSelectedPopulationCityName(name);
  }, []);

  const goToPovertyCounty = useCallback((name: string) => {
    setSelectedPovertyCountyName(name);
  }, []);

  const goToPovertyCity = useCallback((name: string) => {
    setSelectedPovertyCityName(name);
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
                populationMetric={populationMetric}
                selectedPopulationCountyName={selectedPopulationCountyName}
                showCityPopulation={showCityPopulation}
                cityPopulationMetric={cityPopulationMetric}
                selectedPopulationCityName={selectedPopulationCityName}
                showCities={showCities}
                cityDisplayMode={cityDisplayMode}
                showCrime={showCrime}
                crimeType={crimeType}
                selectedCrimeCountyName={selectedCrimeCountyName}
                showHousing={showHousing}
                housingMetric={housingMetric}
                selectedHousingCountyName={selectedHousingCountyName}
                showIncome={showIncome}
                selectedIncomeCountyName={selectedIncomeCountyName}
                showCityHousing={showCityHousing}
                cityHousingMetric={cityHousingMetric}
                selectedHousingCityName={selectedHousingCityName}
                showCityIncome={showCityIncome}
                selectedIncomeCityName={selectedIncomeCityName}
                showEducation={showEducation}
                educationMetric={educationMetric}
                selectedEducationCountyName={selectedEducationCountyName}
                showCityEducation={showCityEducation}
                cityEducationMetric={cityEducationMetric}
                selectedEducationCityName={selectedEducationCityName}
                showRace={showRace}
                raceMetric={raceMetric}
                selectedRaceCountyName={selectedRaceCountyName}
                showCityRace={showCityRace}
                cityRaceMetric={cityRaceMetric}
                selectedRaceCityName={selectedRaceCityName}
                showPoverty={showPoverty}
                selectedPovertyCountyName={selectedPovertyCountyName}
                showCityPoverty={showCityPoverty}
                selectedPovertyCityName={selectedPovertyCityName}
                showCityCrime={showCityCrime}
                cityCrimeType={cityCrimeType}
                selectedCrimeCityName={selectedCrimeCityName}
                showTemperature={showTemperature}
                tempMetric={tempMetric}
                tempMonth={tempMonth}
                tempUnit={tempUnit}
                tempResolution={tempResolution}
                selectedHexH3={selectedHexH3}
                onSelectHex={setSelectedHexH3}
                onDeselectHex={() => setSelectedHexH3(null)}
                showSunshine={showSunshine}
                sunshineMonth={sunshineMonth}
                sunshineResolution={sunshineResolution}
                sunshineDataSource={sunshineDataSource}
                selectedSunshineH3={selectedSunshineH3}
                onSelectSunshineHex={setSelectedSunshineH3}
                onDeselectSunshineHex={() => setSelectedSunshineH3(null)}
                showTransit={showTransit}
                transitSystems={transitSystems}
                activeColorMap={{ bart: bartActiveColors, caltrain: caltrainActiveColors, lametro: lametroActiveColors, smart: smartActiveColors, vta: vtaActiveColors, capitolcorridor: capitolcorridorActiveColors, surfliner: surflinerActiveColors, coaster: coasterActiveColors, sprinter: sprinterActiveColors, sdtrolley: sdtrolleyActiveColors, metrolink: metrolinkActiveColors, sacrt: sacrtActiveColors, sanjoaquins: sanjoaquinsActiveColors, ace: aceActiveColors, coaststarlight: coaststarlightActiveColors, calzephyr: calzephyrActiveColors, swchief: swchiefActiveColors, munimetro: munimetroActiveColors }}
                selectedTransitStopName={selectedTransitStopName}
                flyToTransitStop={flyToTransitStop}
                onSelectTransitStop={(name) => { setFlyToTransitStop(false); setSelectedTransitStopName(name); }}
                onDeselectTransitStop={() => { setFlyToTransitStop(false); setSelectedTransitStopName(null); }}
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
      <MapFooter overlayOffset={overlayOffset} initialModal={showAbout ? "about" : null} onModalChange={(m) => setShowAbout(m === "about")} />

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
                  <span className={`ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full text-white ${activeTab === "favorites" ? "bg-black" : "bg-gray-500"}`}>
                    {favorites.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Compare button */}
          <div className="flex-shrink-0 mt-2 -mx-4 px-4 md:-mx-6 md:px-6">
            <button
              onClick={() => openCompare(compareType ?? "county", compareNames)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <LuColumns3 className="h-3.5 w-3.5" />
              Compare Counties / Cities
            </button>
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

                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-700">Overlays</span>
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
                            className={`rounded px-1 py-1 text-[11px] font-medium transition-colors ${tempMonth === i
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
                      {tempHexCount != null && (
                        <span className="text-[10px] text-gray-400">
                          {tempHexCount.toLocaleString()} hexagons
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Sunshine toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showSunshine ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showSunshine} onChange={toggleSunshine} />
                    <LuSun className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">Sunshine</span>
                    <InfoTooltip>
                      Average daily sunshine hours.
                      <br />
                      Sunshine = DNI &gt; 120 W/m² (WMO standard).
                      <br />
                      H3 hexagonal grid by Uber.
                    </InfoTooltip>
                  </label>
                  {showSunshine && (
                    <div className="mt-2 ml-14 flex flex-col gap-3">
                      {/* Data source row */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center">
                          <button
                            onClick={() => setSunshineDataSource("nsrdb")}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                              sunshineDataSource === "nsrdb"
                                ? "bg-black text-white"
                                : "bg-white text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            NSRDB
                          </button>
                          <InfoTooltip>
                            <a href="https://nsrdb.nrel.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                              NSRDB (NREL)
                            </a>
                            {" "}— satellite-derived, 4 km resolution.
                            <br />
                            GOES TMY (Typical Meteorological Year).
                            <br />
                            Better accuracy for coastal fog and microclimates.
                          </InfoTooltip>
                        </div>
                        <div className="flex items-center">
                          <button
                            onClick={() => setSunshineDataSource("era5")}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                              sunshineDataSource === "era5"
                                ? "bg-black text-white"
                                : "bg-white text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            ERA5
                          </button>
                          <InfoTooltip>
                          <a href="https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                            ERA5 Reanalysis (ECMWF)
                          </a>
                          {" "}via{" "}
                          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                            Open-Meteo
                          </a>
                          <br />
                          ~31 km grid, 2014–2023 avg.
                          <br />
                          <br />
                          Note: ERA5 grid resolution (~31 km) may
                          underestimate fog effects in coastal areas
                          (e.g. San Francisco), smoothing out microclimate
                          differences with nearby inland locations.
                          </InfoTooltip>
                        </div>
                      </div>

                      {/* Month selector grid + Year */}
                      <div className="grid grid-cols-6 gap-0.5">
                        {MONTH_LABELS.map((label, i) => (
                          <button
                            key={i}
                            onClick={() => setSunshineMonth(i)}
                            className={`rounded px-1 py-1 text-[11px] font-medium transition-colors ${sunshineMonth === i
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => setSunshineMonth(ANNUAL_MONTH)}
                          className={`rounded px-1 py-1 text-[11px] font-medium transition-colors col-span-2 ${sunshineMonth === ANNUAL_MONTH
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            }`}
                        >
                          Year
                        </button>
                      </div>

                      {/* Resolution row */}
                      <SegmentedControl
                        value={String(sunshineResolution)}
                        onChange={(v) => setSunshineResolution(Number(v) as SunshineHexResolution)}
                        options={[
                          { value: "4", label: "Large", icon: <LuHexagon className="h-4 w-4" /> },
                          { value: "5", label: "Small", icon: <LuHexagon className="h-3 w-3" /> },
                        ]}
                      />

                      <button
                        onClick={() => setShowSunshineTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                      {sunshineHexCount != null && (
                        <span className="text-[10px] text-gray-400">
                          {sunshineHexCount.toLocaleString()} hexagons
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Transit toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showTransit ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showTransit} onChange={toggleTransit} />
                    <LuTrainFront className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">Transit</span>
                    <InfoTooltip>
                      Public rail transit systems.
                      <br />
                      Data: GTFS feeds from transit agencies.
                      <br />
                      Click a station for details.
                    </InfoTooltip>
                  </label>
                  {showTransit && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      {TRANSIT_SYSTEMS.map((sys) => {
                        const enabled = transitSystems.includes(sys.id);
                        const isFocused = transitSystems.length === 1 && transitSystems[0] === sys.id;
                        return (
                          <div key={sys.id}>
                            <label className="flex cursor-pointer items-center gap-2">
                              <Toggle
                                checked={enabled}
                                onChange={(on) => {
                                  setTransitSystems((prev) =>
                                    on
                                      ? [...prev, sys.id]
                                      : prev.filter((s) => s !== sys.id),
                                  );
                                }}
                                size="sm"
                              />
                              <span className="text-sm font-medium text-gray-700">{sys.label}{sys.tag && <span className="ml-1 text-[10px] font-normal text-gray-400">{sys.tag}</span>}</span>
                              {sys.id === "bart" && (
                                <InfoTooltip>
                                  <a href="https://www.bart.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Bay Area Rapid Transit
                                  </a>
                                  <br />
                                  6 lines, 50 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.bart.gov/schedules/developers/gtfs" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    BART GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "caltrain" && (
                                <InfoTooltip>
                                  <a href="https://www.caltrain.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Caltrain
                                  </a>
                                  <br />
                                  SF to San Jose/Gilroy. 4 services, 30 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.caltrain.com/developer-resources" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Caltrain GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "lametro" && (
                                <InfoTooltip>
                                  <a href="https://www.metro.net/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    LA Metro Rail
                                  </a>
                                  <br />
                                  6 lines, 108 stations. Los Angeles.
                                  <br />
                                  Data:{" "}
                                  <a href="https://developer.metro.net/gtfs-schedule-data/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    LA Metro GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "smart" && (
                                <InfoTooltip>
                                  <a href="https://www.sonomamarintrain.org/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    SMART Train
                                  </a>
                                  <br />
                                  Sonoma-Marin Area Rail Transit. 1 line, 14 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.transit.land/feeds/f-smart~ca~us/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    SMART GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "capitolcorridor" && (
                                <InfoTooltip>
                                  <a href="https://www.capitolcorridor.org/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Capitol Corridor
                                  </a>
                                  <br />
                                  Auburn/Sacramento to San Jose. 1 line, 20 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.capitolcorridor.org/developer_resources/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Capitol Corridor GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "coaster" && (
                                <InfoTooltip>
                                  <a href="https://gonctd.com/services/coaster-commuter-rail/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    COASTER
                                  </a>
                                  <br />
                                  Oceanside to San Diego. 1 line, 8 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://gonctd.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    NCTD GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "sprinter" && (
                                <InfoTooltip>
                                  <a href="https://gonctd.com/services/sprinter/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    SPRINTER
                                  </a>
                                  <br />
                                  Oceanside to Escondido. 1 line, 15 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://gonctd.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    NCTD GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "sdtrolley" && (
                                <InfoTooltip>
                                  <a href="https://www.sdmts.com/transit-services/trolley" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    San Diego Trolley
                                  </a>
                                  <br />
                                  5 light rail lines, 65 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.sdmts.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    MTS GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "metrolink" && (
                                <InfoTooltip>
                                  <a href="https://metrolinktrains.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Metrolink
                                  </a>
                                  <br />
                                  Southern California commuter rail. 7 lines, 67 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://metrolinktrains.com/about/agency/open-data/gtfs/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Metrolink GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "sacrt" && (
                                <InfoTooltip>
                                  <a href="https://www.sacrt.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Sacramento RT
                                  </a>
                                  <br />
                                  Sacramento light rail. 3 lines, 55 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.sacrt.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    SacRT GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "sanjoaquins" && (
                                <InfoTooltip>
                                  <a href="https://www.sanjoaquins.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    San Joaquins (Gold Runner)
                                  </a>
                                  <br />
                                  Oakland &amp; Sacramento to Bakersfield. 2 branches, 17 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://data.trilliumtransit.com/gtfs/sanjoaquins-ca-us/sanjoaquins-ca-us.zip" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Trillium GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "ace" && (
                                <InfoTooltip>
                                  <a href="https://acerail.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    ACE (Altamont Corridor Express)
                                  </a>
                                  <br />
                                  Stockton to San Jose. 1 line, 10 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://511.org/open-data" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    511.org GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "coaststarlight" && (
                                <InfoTooltip>
                                  <a href="https://www.amtrak.com/coast-starlight-train" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Coast Starlight
                                  </a>
                                  <br />
                                  LA to Seattle (CA segment). 19 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://content.amtrak.com/content/gtfs/GTFS.zip" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Amtrak GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "calzephyr" && (
                                <InfoTooltip>
                                  <a href="https://www.amtrak.com/california-zephyr-train" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    California Zephyr
                                  </a>
                                  <br />
                                  Emeryville to Chicago (CA segment). 9 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://content.amtrak.com/content/gtfs/GTFS.zip" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Amtrak GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "swchief" && (
                                <InfoTooltip>
                                  <a href="https://www.amtrak.com/southwest-chief-train" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Southwest Chief
                                  </a>
                                  <br />
                                  LA to Chicago (CA segment). 9 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://content.amtrak.com/content/gtfs/GTFS.zip" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Amtrak GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "surfliner" && (
                                <InfoTooltip>
                                  <a href="https://www.pacificsurfliner.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Pacific Surfliner
                                  </a>
                                  <br />
                                  San Luis Obispo to San Diego. 1 line, 28 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.amtrak.com/pacific-surfliner-train" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Amtrak GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "vta" && (
                                <InfoTooltip>
                                  <a href="https://www.vta.org/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    VTA Light Rail
                                  </a>
                                  <br />
                                  Santa Clara Valley. 3 lines, 56 stations.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.vta.org/go/real-time" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    VTA GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              {sys.id === "munimetro" && (
                                <InfoTooltip>
                                  <a href="https://www.sfmta.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    Muni Metro
                                  </a>
                                  <br />
                                  San Francisco light rail. 7 lines, 193 stops.
                                  <br />
                                  Data:{" "}
                                  <a href="https://www.sfmta.com/reports/gtfs-transit-data" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                                    SFMTA GTFS
                                  </a>
                                </InfoTooltip>
                              )}
                              <span className="group/focus relative ml-auto shrink-0 self-center">
                                <button
                                  type="button"
                                  aria-label={isFocused ? "Unfocus" : "Focus"}
                                  className={`flex cursor-pointer items-center rounded p-0.5 transition-colors ${
                                    isFocused
                                      ? "text-gray-900 hover:text-black"
                                      : "text-gray-400 hover:text-gray-600"
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (isFocused) {
                                      setTransitSystems([...DEFAULT_TRANSIT_SYSTEMS]);
                                    } else {
                                      setTransitSystems([sys.id]);
                                    }
                                  }}
                                >
                                  {isFocused ? <RiFocus3Fill className="h-4 w-4" /> : <RiFocus3Line className="h-4 w-4" />}
                                </button>
                                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/focus:opacity-100">
                                  {isFocused ? "Unfocus" : "Focus"}
                                </span>
                              </span>
                            </label>
                            {enabled && (
                              <div className="mt-1.5 ml-9 flex flex-col gap-1.5">
                                {(() => {
                                  const lines = sys.id === "bart" ? BART_LINES : sys.id === "caltrain" ? CALTRAIN_LINES : sys.id === "lametro" ? LAMETRO_LINES : sys.id === "smart" ? SMART_LINES : sys.id === "vta" ? VTA_LINES : sys.id === "capitolcorridor" ? CAPITOLCORRIDOR_LINES : sys.id === "surfliner" ? SURFLINER_LINES : sys.id === "coaster" ? COASTER_LINES : sys.id === "sprinter" ? SPRINTER_LINES : sys.id === "sdtrolley" ? SDTROLLEY_LINES : sys.id === "metrolink" ? METROLINK_LINES : sys.id === "sacrt" ? SACRT_LINES : sys.id === "sanjoaquins" ? SANJOAQUINS_LINES : sys.id === "ace" ? ACE_LINES : sys.id === "coaststarlight" ? COASTSTARLIGHT_LINES : sys.id === "calzephyr" ? CALZEPHYR_LINES : sys.id === "swchief" ? SWCHIEF_LINES : sys.id === "munimetro" ? MUNIMETRO_LINES : [];
                                  const activeColors = sys.id === "bart" ? bartActiveColors : sys.id === "caltrain" ? caltrainActiveColors : sys.id === "lametro" ? lametroActiveColors : sys.id === "smart" ? smartActiveColors : sys.id === "vta" ? vtaActiveColors : sys.id === "capitolcorridor" ? capitolcorridorActiveColors : sys.id === "surfliner" ? surflinerActiveColors : sys.id === "coaster" ? coasterActiveColors : sys.id === "sprinter" ? sprinterActiveColors : sys.id === "sdtrolley" ? sdtrolleyActiveColors : sys.id === "metrolink" ? metrolinkActiveColors : sys.id === "sacrt" ? sacrtActiveColors : sys.id === "sanjoaquins" ? sanjoaquinsActiveColors : sys.id === "ace" ? aceActiveColors : sys.id === "coaststarlight" ? coaststarlightActiveColors : sys.id === "calzephyr" ? calzephyrActiveColors : sys.id === "swchief" ? swchiefActiveColors : sys.id === "munimetro" ? munimetroActiveColors : null;
                                  const setActiveColors = sys.id === "bart" ? setBartActiveColors : sys.id === "caltrain" ? setCaltrainActiveColors : sys.id === "lametro" ? setLametroActiveColors : sys.id === "smart" ? setSmartActiveColors : sys.id === "vta" ? setVtaActiveColors : sys.id === "capitolcorridor" ? setCapitolcorridorActiveColors : sys.id === "surfliner" ? setSurflinerActiveColors : sys.id === "coaster" ? setCoasterActiveColors : sys.id === "sprinter" ? setSprinterActiveColors : sys.id === "sdtrolley" ? setSdtrolleyActiveColors : sys.id === "metrolink" ? setMetrolinkActiveColors : sys.id === "sacrt" ? setSacrtActiveColors : sys.id === "sanjoaquins" ? setSanjoaquinsActiveColors : sys.id === "ace" ? setAceActiveColors : sys.id === "coaststarlight" ? setCoaststarlightActiveColors : sys.id === "calzephyr" ? setCalzephyrActiveColors : sys.id === "swchief" ? setSwchiefActiveColors : sys.id === "munimetro" ? setMunimetroActiveColors : null;
                                  if (lines.length === 0 || !setActiveColors) return null;
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {lines.map((line) => {
                                        const isActive = !activeColors || activeColors.includes(line.color);
                                        return (
                                          <span key={line.color} className="group relative">
                                            <button
                                              type="button"
                                              aria-label={line.label}
                                              className="h-5 w-5 rounded-full border-2 transition-all hover:scale-110"
                                              style={{
                                                backgroundColor: isActive ? line.color : "transparent",
                                                borderColor: line.color,
                                                opacity: isActive ? 1 : 0.5,
                                              }}
                                              onClick={() => {
                                                setActiveColors((prev: string[] | null) => {
                                                  if (prev && prev.length === 1 && prev[0] === line.color) {
                                                    return null;
                                                  }
                                                  return [line.color];
                                                });
                                              }}
                                            />
                                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                              {line.label}
                                            </span>
                                          </span>
                                        );
                                      })}
                                      {activeColors && (
                                        <button
                                          type="button"
                                          className="ml-1 rounded px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                                          onClick={() => setActiveColors(null)}
                                        >
                                          All
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                                <TransitStopSearch
                                  dataUrl={`${import.meta.env.BASE_URL}data/transit/${sys.id}-stops.geojson`}
                                  placeholder={`Search ${sys.label} stations...`}
                                  onSelect={(name) => { setFlyToTransitStop(true); setSelectedTransitStopName(name); }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
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

                <div className="my-1 border-t border-gray-300">
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-gray-400">Counties</div>
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
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={populationMetric}
                          onChange={(e) => setPopulationMetric(e.target.value as PopulationMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {populationMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {POPULATION_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
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
                    <LuSiren className="h-4 w-4 text-gray-900" />
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

                {/* County housing toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showHousing ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showHousing} onChange={toggleHousing} />
                    <LuHouse className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Housing</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Median Home Value &amp; Median Gross Rent by county.
                    </InfoTooltip>
                  </label>
                  {showHousing && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={housingMetric}
                          onChange={(e) => setHousingMetric(e.target.value as HousingMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {housingMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {HOUSING_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowHousingTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* County income toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showIncome ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showIncome} onChange={toggleIncome} />
                    <LuWallet className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Income</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Median Household Income by county.
                    </InfoTooltip>
                  </label>
                  {showIncome && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <button
                        onClick={() => setShowIncomeTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* County education toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showEducation ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showEducation} onChange={toggleEducation} />
                    <LuGraduationCap className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Education</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Educational Attainment (Table B15003).
                      <br />
                      Population 25 years and over.
                    </InfoTooltip>
                  </label>
                  {showEducation && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={educationMetric}
                          onChange={(e) => setEducationMetric(e.target.value as EducationMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {educationMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {EDUCATION_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowEducationTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* County race/ethnicity toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showRace ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showRace} onChange={toggleRace} />
                    <IoManOutline className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Race</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Hispanic or Latino Origin by Race (Table B03002).
                    </InfoTooltip>
                  </label>
                  {showRace && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={raceMetric}
                          onChange={(e) => setRaceMetric(e.target.value as RaceMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {raceMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {RACE_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowRaceTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* County poverty toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showPoverty ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showPoverty} onChange={togglePoverty} />
                    <LuTrendingDown className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">County Poverty</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Poverty Status (Table B17001).
                      <br />
                      % of population with income below
                      the federal poverty threshold.
                    </InfoTooltip>
                  </label>
                  {showPoverty && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <button
                        onClick={() => setShowPovertyTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                <div className="my-1 border-t border-gray-300">
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-gray-400">Cities</div>
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

                {/* City population toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityPopulation ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityPopulation} onChange={toggleCityPopulation} />
                    <LuUsers className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Population</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://dof.ca.gov/forecasting/demographics/estimates-e1/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        CA Dept. of Finance
                      </a>
                      <br />
                      E-1 Population Estimates, 2024
                    </InfoTooltip>
                  </label>
                  {showCityPopulation && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cityPopulationMetric}
                          onChange={(e) => setCityPopulationMetric(e.target.value as PopulationMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {populationMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {POPULATION_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCityPopulationTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
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

                {/* City housing toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityHousing ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityHousing} onChange={toggleCityHousing} />
                    <LuHouse className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Housing</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Median Home Value &amp; Median Gross Rent by city.
                    </InfoTooltip>
                  </label>
                  {showCityHousing && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cityHousingMetric}
                          onChange={(e) => setCityHousingMetric(e.target.value as HousingMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {housingMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {HOUSING_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCityHousingTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* City income toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityIncome ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityIncome} onChange={toggleCityIncome} />
                    <LuWallet className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Income</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Median Household Income by city.
                    </InfoTooltip>
                  </label>
                  {showCityIncome && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <button
                        onClick={() => setShowCityIncomeTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* City education toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityEducation ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityEducation} onChange={toggleCityEducation} />
                    <LuGraduationCap className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Education</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Educational Attainment (Table B15003).
                      <br />
                      Population 25 years and over.
                    </InfoTooltip>
                  </label>
                  {showCityEducation && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cityEducationMetric}
                          onChange={(e) => setCityEducationMetric(e.target.value as EducationMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {educationMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {EDUCATION_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCityEducationTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* City race/ethnicity toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityRace ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityRace} onChange={toggleCityRace} />
                    <IoManOutline className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Race</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Hispanic or Latino Origin by Race (Table B03002).
                    </InfoTooltip>
                  </label>
                  {showCityRace && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cityRaceMetric}
                          onChange={(e) => setCityRaceMetric(e.target.value as RaceMetric)}
                          className="appearance-none block w-full rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none cursor-pointer hover:bg-gray-50 transition-colors z-10"
                        >
                          {raceMetricIds.map((id) => (
                            <option key={id} value={id}>
                              {RACE_LABELS[id]}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 z-20">
                          <LuChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCityRaceTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
                      </button>
                    </div>
                  )}
                </div>

                {/* City poverty toggle */}
                <div className={`-mx-2 rounded-lg p-2 transition-colors ${showCityPoverty ? "bg-gray-100/80" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <Toggle checked={showCityPoverty} onChange={toggleCityPoverty} />
                    <LuTrendingDown className="h-4 w-4 text-gray-900" />
                    <span className="text-sm font-medium">City Poverty</span>
                    <InfoTooltip>
                      Source:{" "}
                      <a href="https://data.census.gov/" target="_blank" rel="noopener noreferrer" className="text-gray-300 underline hover:text-white">
                        US Census Bureau
                      </a>
                      <br />
                      ACS 5-Year Estimates (2019–2023).
                      <br />
                      Poverty Status (Table B17001).
                      <br />
                      % of population with income below
                      the federal poverty threshold.
                    </InfoTooltip>
                  </label>
                  {showCityPoverty && (
                    <div className="mt-2 ml-14 flex flex-col gap-2">
                      <button
                        onClick={() => setShowCityPovertyTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 self-start"
                      >
                        <LuTable className="h-4 w-4 text-gray-900" />
                        View Table
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
                    <p className="text-xs mt-3 text-gray-400">
                      Add 2 or more to <strong className="text-gray-500">compare</strong> them side by side across all metrics.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Counties</h3>
                        {favoriteCounties.length >= 2 && (
                          <button
                            onClick={() => openCompare("county", favoriteCounties)}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <LuColumns3 className="h-3 w-3" />
                            Compare
                          </button>
                        )}
                      </div>
                      {favoriteCounties.length > 0 ? (
                        <div className="mt-1">
                          <SortableFavoriteList
                            items={favoriteCounties}
                            onReorder={(names) => reorderFavorites("county", names)}
                            onClickItem={goToFavoriteCounty}
                            onRemoveItem={(name) => toggleFavorite("county", name)}
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400">
                          Hover over a county on the map and tap the heart icon to add it here. Add 2+ to compare.
                        </p>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cities</h3>
                        {favoriteCities.length >= 2 && (
                          <button
                            onClick={() => openCompare("city", favoriteCities)}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
                          >
                            <LuColumns3 className="h-3 w-3" />
                            Compare
                          </button>
                        )}
                      </div>
                      {favoriteCities.length > 0 ? (
                        <div className="mt-1">
                          <SortableFavoriteList
                            items={favoriteCities}
                            onReorder={(names) => reorderFavorites("city", names)}
                            onClickItem={goToFavoriteCity}
                            onRemoveItem={(name) => toggleFavorite("city", name)}
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400">
                          Hover over a city on the map and tap the heart icon to add it here. Add 2+ to compare.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 pt-3 pb-1 border-t border-gray-300 text-center">
            <span className="text-[11px] text-gray-400">
              Vibecoded for fun by{" "}
              <a href="https://trekhleb.dev" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors">trekhleb.dev</a>
              {" • "}
              <a href="https://github.com/trekhleb/cali-vibe" target="_blank" rel="noopener noreferrer" className="inline-flex align-text-bottom text-gray-500 hover:text-gray-700 transition-colors" aria-label="GitHub repository">
                <FaGithub className="h-3.5 w-3.5" />
              </a>
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
          className="relative p-2 rounded-full text-black hover:bg-black/5 transition-colors"
          title="Open Menu"
        >
          <span className="absolute inset-0 rounded-full bg-gray-400/60" style={{ animation: "pulse-ring 3s ease-out infinite", animationDelay: "-3s" }} />
          <LuPanelLeftOpen className="relative h-5 w-5" />
        </button>
      </div>

      {/* Data table modals */}
      <PopulationTableModal
        open={showPopulationTable}
        onClose={() => setShowPopulationTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Population (2024)"
        nameLabel="County"
        onSelectName={setSelectedPopulationCountyName}
      />
      <PopulationTableModal
        open={showCityPopulationTable}
        onClose={() => setShowCityPopulationTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Population (2024)"
        nameLabel="City"
        onSelectName={goToPopulationCity}
      />
      <CrimeTableModal
        open={showCountyCrimeTable}
        onClose={() => setShowCountyCrimeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Crime Rates per 100K (2023)"
        nameLabel="County"
        activeCrimeType={crimeType}
        onSelectName={goToCrimeCounty}
      />
      <CrimeTableModal
        open={showCityCrimeTable}
        onClose={() => setShowCityCrimeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Crime Rates per 100K (2023)"
        nameLabel="City"
        activeCrimeType={cityCrimeType}
        onSelectName={goToCrimeCity}
      />
      <HousingTableModal
        open={showHousingTable}
        onClose={() => setShowHousingTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Housing Cost (ACS 2019–2023)"
        nameLabel="County"
        activeHousingMetric={housingMetric}
        onSelectName={goToHousingCounty}
        visibleMetrics={["homeValue", "rent"]}
      />
      <HousingTableModal
        open={showIncomeTable}
        onClose={() => setShowIncomeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Household Income (ACS 2019–2023)"
        nameLabel="County"
        activeHousingMetric="income"
        onSelectName={goToIncomeCounty}
        visibleMetrics={["income"]}
      />
      <HousingTableModal
        open={showCityHousingTable}
        onClose={() => setShowCityHousingTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Housing Cost (ACS 2019–2023)"
        nameLabel="City"
        activeHousingMetric={cityHousingMetric}
        onSelectName={goToHousingCity}
        visibleMetrics={["homeValue", "rent"]}
      />
      <HousingTableModal
        open={showCityIncomeTable}
        onClose={() => setShowCityIncomeTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Household Income (ACS 2019–2023)"
        nameLabel="City"
        activeHousingMetric="income"
        onSelectName={goToIncomeCity}
        visibleMetrics={["income"]}
      />
      <EducationTableModal
        open={showEducationTable}
        onClose={() => setShowEducationTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Educational Attainment (ACS 2019–2023)"
        nameLabel="County"
        activeEducationMetric={educationMetric}
        onSelectName={goToEducationCounty}
      />
      <EducationTableModal
        open={showCityEducationTable}
        onClose={() => setShowCityEducationTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Educational Attainment (ACS 2019–2023)"
        nameLabel="City"
        activeEducationMetric={cityEducationMetric}
        onSelectName={goToEducationCity}
      />
      <RaceTableModal
        open={showRaceTable}
        onClose={() => setShowRaceTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Race/Ethnicity (ACS 2019–2023)"
        nameLabel="County"
        activeRaceMetric={raceMetric}
        onSelectName={goToRaceCounty}
      />
      <RaceTableModal
        open={showCityRaceTable}
        onClose={() => setShowCityRaceTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Race/Ethnicity (ACS 2019–2023)"
        nameLabel="City"
        activeRaceMetric={cityRaceMetric}
        onSelectName={goToRaceCity}
      />
      <PovertyTableModal
        open={showPovertyTable}
        onClose={() => setShowPovertyTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-county-labels.geojson`}
        title="County Poverty Rate (ACS 2019–2023)"
        nameLabel="County"
        onSelectName={goToPovertyCounty}
      />
      <PovertyTableModal
        open={showCityPovertyTable}
        onClose={() => setShowCityPovertyTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-city-labels.geojson`}
        title="City Poverty Rate (ACS 2019–2023)"
        nameLabel="City"
        onSelectName={goToPovertyCity}
      />
      <CompareModal
        open={compareType !== null}
        onClose={closeCompare}
        compareType={compareType ?? "county"}
        names={compareNames}
        sortConfig={compareSortConfig}
        onTypeChange={setCompareType}
        onNamesChange={setCompareNames}
        onSortChange={setCompareSortConfig}
        tempMonth={compareTempMonth}
        tempUnit={compareTempUnit}
        sunMonth={compareSunMonth}
        sunSource={compareSunSource}
        crimeAbsolute={compareCrimeAbsolute}
        onTempMonthChange={setCompareTempMonth}
        onTempUnitChange={setCompareTempUnit}
        onSunMonthChange={setCompareSunMonth}
        onSunSourceChange={setCompareSunSource}
        onCrimeAbsoluteChange={setCompareCrimeAbsolute}
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
      <SunshineTableModal
        open={showSunshineTable}
        onClose={() => setShowSunshineTable(false)}
        dataUrl={`${import.meta.env.BASE_URL}data/california-sunshine-${sunshineDataSource}-h3-res${sunshineResolution}.geojson`}
        title="Daily Sunshine Hours (2014–2023 avg)"
        nameLabel="Location"
        activeMonth={sunshineMonth}
        onSelectHex={setSelectedSunshineH3}
      />
    </div>
  );
}
