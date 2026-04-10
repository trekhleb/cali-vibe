import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map,
  NavigationControl,
  ScaleControl,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import type { HillshadeLayerSpecification } from "maplibre-gl";
import {
  INITIAL_VIEW_STATE,
  MAP_STYLES,
  TERRAIN_SOURCE,
  type MapStyleId,
} from "./map-config";
import CountyBordersLayer, { type CountyDisplayMode } from "./layers/county-borders-layer";
import CountyPopulationLayer, {
  PopulationLegend,
} from "./layers/county-population-layer";
import CountyCrimeLayer, {
  CrimeLegend,
  type CrimeType,
} from "./layers/county-crime-layer";
import CountyHousingLayer, {
  HousingLegend,
  type HousingMetric,
} from "./layers/county-housing-layer";
import CityBordersLayer, { type CityDisplayMode } from "./layers/city-borders-layer";
import CityCrimeLayer, { CityCrimeLegend } from "./layers/city-crime-layer";
import CityHousingLayer, { CityHousingLegend } from "./layers/city-housing-layer";
import CountyEducationLayer, {
  EducationLegend,
  type EducationMetric,
} from "./layers/county-education-layer";
import CityEducationLayer, { CityEducationLegend } from "./layers/city-education-layer";
import CountyRaceLayer, {
  RaceLegend,
  type RaceMetric,
} from "./layers/county-race-layer";
import CityRaceLayer, { CityRaceLegend } from "./layers/city-race-layer";
import CountyAgeLayer, {
  AgeLegend,
  type AgeMetric,
} from "./layers/county-age-layer";
import CityAgeLayer, { CityAgeLegend } from "./layers/city-age-layer";
import CountyPovertyLayer, {
  PovertyLegend,
} from "./layers/county-poverty-layer";
import CityPovertyLayer, { CityPovertyLegend } from "./layers/city-poverty-layer";
import TemperatureLayer, {
  TemperatureLegend,
  type TempMetric,
  type TempUnit,
  type HexResolution,
} from "./layers/temperature-layer";
import SunshineLayer, {
  SunshineLegend,
  type HexResolution as SunshineHexResolution,
  type SunshineDataSource,
} from "./layers/sunshine-layer";
import CityPopulationLayer, { CityPopulationLegend } from "./layers/city-population-layer";
import type { PopulationMetric } from "./layers/county-population-layer";
import CountySchoolsLayer, {
  SchoolsLegend,
  type SchoolMetric,
} from "./layers/county-schools-layer";
import CitySchoolsLayer, { CitySchoolsLegend } from "./layers/city-schools-layer";
import SchoolsPointLayer, {
  SchoolPointsLegend,
  type SchoolPointColor,
  type SchoolLevelFilter,
} from "./layers/schools-point-layer";
import TransitLayer, { type TransitSystem, type ActiveColorMap } from "./layers/transit-layer";
import LocateControl from "./locate-control";

const hillshadeLayer: HillshadeLayerSpecification = {
  id: "hillshade",
  type: "hillshade",
  source: TERRAIN_SOURCE.id,
  paint: {
    "hillshade-illumination-direction": 315,
    "hillshade-exaggeration": 0.5,
    "hillshade-shadow-color": "#473B24",
    "hillshade-highlight-color": "#ffffff",
    "hillshade-accent-color": "#374211",
  },
};

interface CaliforniaMapProps {
  terrain3d?: boolean;
  mapStyleId?: MapStyleId;
  showCounties?: boolean;
  countyDisplayMode?: CountyDisplayMode;
  showPopulation?: boolean;
  populationMetric?: PopulationMetric;
  selectedPopulationCountyName?: string | null;
  showCityPopulation?: boolean;
  cityPopulationMetric?: PopulationMetric;
  selectedPopulationCityName?: string | null;
  showCrime?: boolean;
  crimeType?: CrimeType;
  selectedCrimeCountyName?: string | null;
  showHousing?: boolean;
  housingMetric?: HousingMetric;
  selectedHousingCountyName?: string | null;
  showIncome?: boolean;
  selectedIncomeCountyName?: string | null;
  showEducation?: boolean;
  educationMetric?: EducationMetric;
  selectedEducationCountyName?: string | null;
  showCityHousing?: boolean;
  cityHousingMetric?: HousingMetric;
  selectedHousingCityName?: string | null;
  showCityIncome?: boolean;
  selectedIncomeCityName?: string | null;
  showCityEducation?: boolean;
  cityEducationMetric?: EducationMetric;
  selectedEducationCityName?: string | null;
  showRace?: boolean;
  raceMetric?: RaceMetric;
  selectedRaceCountyName?: string | null;
  showCityRace?: boolean;
  cityRaceMetric?: RaceMetric;
  selectedRaceCityName?: string | null;
  showAge?: boolean;
  ageMetric?: AgeMetric;
  selectedAgeCountyName?: string | null;
  showCityAge?: boolean;
  cityAgeMetric?: AgeMetric;
  selectedAgeCityName?: string | null;
  showPoverty?: boolean;
  selectedPovertyCountyName?: string | null;
  showCityPoverty?: boolean;
  selectedPovertyCityName?: string | null;
  showCityCrime?: boolean;
  cityCrimeType?: CrimeType;
  selectedCrimeCityName?: string | null;
  showSchools?: boolean;
  schoolMetric?: SchoolMetric;
  selectedSchoolsCountyName?: string | null;
  showCitySchools?: boolean;
  citySchoolMetric?: SchoolMetric;
  selectedSchoolsCityName?: string | null;
  showSchoolPoints?: boolean;
  schoolPointColor?: SchoolPointColor;
  schoolLevelFilter?: SchoolLevelFilter;
  selectedSchoolPointName?: string | null;
  showTemperature?: boolean;
  tempMetric?: TempMetric;
  tempMonth?: number;
  tempUnit?: TempUnit;
  tempResolution?: HexResolution;
  selectedHexH3?: string | null;
  onSelectHex?: (h3: string) => void;
  onDeselectHex?: () => void;
  showSunshine?: boolean;
  sunshineMonth?: number;
  sunshineResolution?: SunshineHexResolution;
  sunshineDataSource?: SunshineDataSource;
  selectedSunshineH3?: string | null;
  onSelectSunshineHex?: (h3: string) => void;
  onDeselectSunshineHex?: () => void;
  showCities?: boolean;
  cityDisplayMode?: CityDisplayMode;
  onToggleCountyFavorite?: (name: string) => void;
  isCountyFavorite?: (name: string) => boolean;
  onViewCountyDetail?: (name: string) => void;
  onToggleCityFavorite?: (name: string) => void;
  isCityFavorite?: (name: string) => boolean;
  onViewCityDetail?: (name: string) => void;
  overlayOffset?: number;
  showTransit?: boolean;
  transitSystems?: TransitSystem[];
  activeColorMap?: ActiveColorMap;
  selectedTransitStopName?: string | null;
  flyToTransitStop?: boolean;
  onSelectTransitStop?: (name: string) => void;
  onDeselectTransitStop?: () => void;
  selectedCountyName?: string | null;
  selectedCityName?: string | null;
}

export default function CaliforniaMap({
  terrain3d = false,
  mapStyleId = "liberty",
  showCounties = false,
  countyDisplayMode = "colored",
  showPopulation = false,
  populationMetric = "total",
  selectedPopulationCountyName = null,
  showCityPopulation = false,
  cityPopulationMetric = "total",
  selectedPopulationCityName = null,
  showCrime = false,
  crimeType = "total",
  selectedCrimeCountyName = null,
  showHousing = false,
  housingMetric = "homeValue",
  selectedHousingCountyName = null,
  showIncome = false,
  selectedIncomeCountyName = null,
  showEducation = false,
  educationMetric = "bachPlus",
  selectedEducationCountyName = null,
  showCityHousing = false,
  cityHousingMetric = "homeValue",
  selectedHousingCityName = null,
  showCityIncome = false,
  selectedIncomeCityName = null,
  showCityEducation = false,
  cityEducationMetric = "bachPlus",
  selectedEducationCityName = null,
  showRace = false,
  raceMetric = "white",
  selectedRaceCountyName = null,
  showCityRace = false,
  cityRaceMetric = "white",
  selectedRaceCityName = null,
  showAge = false,
  ageMetric = "medianAge",
  selectedAgeCountyName = null,
  showCityAge = false,
  cityAgeMetric = "medianAge",
  selectedAgeCityName = null,
  showPoverty = false,
  selectedPovertyCountyName = null,
  showCityPoverty = false,
  selectedPovertyCityName = null,
  showCityCrime = false,
  cityCrimeType = "total",
  selectedCrimeCityName = null,
  showSchools = false,
  schoolMetric = "ela",
  selectedSchoolsCountyName = null,
  showCitySchools = false,
  citySchoolMetric = "ela",
  selectedSchoolsCityName = null,
  showSchoolPoints = false,
  schoolPointColor = "rating",
  schoolLevelFilter = "all",
  selectedSchoolPointName = null,
  showTemperature = false,
  tempMetric = "tavg",
  tempMonth = 6,
  tempUnit = "F",
  tempResolution = 5,
  selectedHexH3 = null,
  onSelectHex,
  onDeselectHex,
  showSunshine = false,
  sunshineMonth = 6,
  sunshineResolution = 5,
  sunshineDataSource = "nsrdb",
  selectedSunshineH3 = null,
  onSelectSunshineHex,
  onDeselectSunshineHex,
  showCities = false,
  cityDisplayMode = "borders",
  onToggleCountyFavorite,
  isCountyFavorite,
  onViewCountyDetail,
  onToggleCityFavorite,
  isCityFavorite,
  onViewCityDetail,
  showTransit = false,
  transitSystems = [],
  activeColorMap = {},
  selectedTransitStopName = null,
  flyToTransitStop = false,
  onSelectTransitStop,
  onDeselectTransitStop,
  overlayOffset = 0,
  selectedCountyName = null,
  selectedCityName = null,
}: CaliforniaMapProps) {
  // Smart zoom for "locate me": city layers → street level, county → county level
  const locateZoom =
    showSchoolPoints ? 12 :
    showCities || showCityCrime || showCityHousing || showCityIncome || showCityEducation || showCityRace || showCityAge || showCityPoverty || showCityPopulation || showCitySchools ? 11 :
    showCounties || showPopulation || showCrime || showHousing || showIncome || showEducation || showRace || showAge || showPoverty || showSchools ? 8 :
    showTemperature || showSunshine ? 9 : 10;

  return (
    <Map
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLES[mapStyleId].style}
      fadeDuration={50}
      padding={{ left: overlayOffset }}
      onError={(e) => console.warn("Map error:", e.error)}
    >
      {terrain3d && (
        <Source {...TERRAIN_SOURCE} id={TERRAIN_SOURCE.id}>
          <Layer {...hillshadeLayer} />
        </Source>
      )}
      {showCounties && !showPopulation && !showCrime && !showHousing && !showIncome && (
        <CountyBordersLayer
          displayMode={countyDisplayMode}
          onToggleFavorite={onToggleCountyFavorite}
          onViewDetail={onViewCountyDetail}
          isFavorite={isCountyFavorite}
          overlayOffset={overlayOffset}
          selectName={selectedCountyName}
        />
      )}
      {showPopulation && !showCrime && !showHousing && !showIncome && <CountyPopulationLayer overlayOffset={overlayOffset} selectName={selectedPopulationCountyName} populationMetric={populationMetric} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showPopulation && !showCrime && !showHousing && !showIncome && <PopulationLegend overlayOffset={overlayOffset} populationMetric={populationMetric} />}
      {showHousing && <CountyHousingLayer housingMetric={housingMetric} overlayOffset={overlayOffset} selectName={selectedHousingCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showHousing && <HousingLegend housingMetric={housingMetric} overlayOffset={overlayOffset} />}
      {showIncome && <CountyHousingLayer housingMetric="income" overlayOffset={overlayOffset} selectName={selectedIncomeCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showIncome && <HousingLegend housingMetric="income" overlayOffset={overlayOffset} />}
      {showEducation && <CountyEducationLayer educationMetric={educationMetric} overlayOffset={overlayOffset} selectName={selectedEducationCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showEducation && <EducationLegend educationMetric={educationMetric} overlayOffset={overlayOffset} />}
      {showCities && (
        <CityBordersLayer
          displayMode={cityDisplayMode}
          onToggleFavorite={onToggleCityFavorite}
          onViewDetail={onViewCityDetail}
          isFavorite={isCityFavorite}
          overlayOffset={overlayOffset}
          selectName={selectedCityName}
        />
      )}
      {showCrime && <CountyCrimeLayer crimeType={crimeType} overlayOffset={overlayOffset} selectName={selectedCrimeCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showCrime && <CrimeLegend crimeType={crimeType} overlayOffset={overlayOffset} />}
      {showCityCrime && <CityCrimeLayer crimeType={cityCrimeType} overlayOffset={overlayOffset} selectName={selectedCrimeCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityCrime && <CityCrimeLegend crimeType={cityCrimeType} overlayOffset={overlayOffset} />}
      {showCityHousing && <CityHousingLayer housingMetric={cityHousingMetric} overlayOffset={overlayOffset} selectName={selectedHousingCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityHousing && <CityHousingLegend housingMetric={cityHousingMetric} overlayOffset={overlayOffset} />}
      {showCityIncome && <CityHousingLayer housingMetric="income" overlayOffset={overlayOffset} selectName={selectedIncomeCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityIncome && <CityHousingLegend housingMetric="income" overlayOffset={overlayOffset} />}
      {showRace && <CountyRaceLayer raceMetric={raceMetric} overlayOffset={overlayOffset} selectName={selectedRaceCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showRace && <RaceLegend raceMetric={raceMetric} overlayOffset={overlayOffset} />}
      {showCityEducation && <CityEducationLayer educationMetric={cityEducationMetric} overlayOffset={overlayOffset} selectName={selectedEducationCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityEducation && <CityEducationLegend educationMetric={cityEducationMetric} overlayOffset={overlayOffset} />}
      {showCityRace && <CityRaceLayer raceMetric={cityRaceMetric} overlayOffset={overlayOffset} selectName={selectedRaceCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityRace && <CityRaceLegend raceMetric={cityRaceMetric} overlayOffset={overlayOffset} />}
      {showAge && <CountyAgeLayer ageMetric={ageMetric} overlayOffset={overlayOffset} selectName={selectedAgeCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showAge && <AgeLegend ageMetric={ageMetric} overlayOffset={overlayOffset} />}
      {showCityAge && <CityAgeLayer ageMetric={cityAgeMetric} overlayOffset={overlayOffset} selectName={selectedAgeCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityAge && <CityAgeLegend ageMetric={cityAgeMetric} overlayOffset={overlayOffset} />}
      {showPoverty && <CountyPovertyLayer overlayOffset={overlayOffset} selectName={selectedPovertyCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showPoverty && <PovertyLegend overlayOffset={overlayOffset} />}
      {showCityPoverty && <CityPovertyLayer overlayOffset={overlayOffset} selectName={selectedPovertyCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityPoverty && <CityPovertyLegend overlayOffset={overlayOffset} />}
      {showCityPopulation && <CityPopulationLayer overlayOffset={overlayOffset} selectName={selectedPopulationCityName} populationMetric={cityPopulationMetric} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCityPopulation && <CityPopulationLegend overlayOffset={overlayOffset} populationMetric={cityPopulationMetric} />}
      {showSchools && <CountySchoolsLayer schoolMetric={schoolMetric} overlayOffset={overlayOffset} selectName={selectedSchoolsCountyName} onToggleFavorite={onToggleCountyFavorite} onViewDetail={onViewCountyDetail} isFavorite={isCountyFavorite} />}
      {showSchools && <SchoolsLegend schoolMetric={schoolMetric} overlayOffset={overlayOffset} />}
      {showCitySchools && <CitySchoolsLayer schoolMetric={citySchoolMetric} overlayOffset={overlayOffset} selectName={selectedSchoolsCityName} onToggleFavorite={onToggleCityFavorite} onViewDetail={onViewCityDetail} isFavorite={isCityFavorite} />}
      {showCitySchools && <CitySchoolsLegend schoolMetric={citySchoolMetric} overlayOffset={overlayOffset} />}
      {showSchoolPoints && <SchoolsPointLayer colorBy={schoolPointColor} levelFilter={schoolLevelFilter} overlayOffset={overlayOffset} selectName={selectedSchoolPointName} />}
      {showSchoolPoints && <SchoolPointsLegend colorBy={schoolPointColor} overlayOffset={overlayOffset} />}
      {showTemperature && (
        <TemperatureLayer
          metric={tempMetric}
          month={tempMonth}
          unit={tempUnit}
          resolution={tempResolution}
          selectedH3={selectedHexH3}
          onSelectHex={onSelectHex}
          onDeselectHex={onDeselectHex}
          overlayOffset={overlayOffset}
        />
      )}
      {showTemperature && (
        <TemperatureLegend
          metric={tempMetric}
          month={tempMonth}
          unit={tempUnit}
          overlayOffset={overlayOffset}
        />
      )}
      {showSunshine && (
        <SunshineLayer
          month={sunshineMonth}
          resolution={sunshineResolution}
          dataSource={sunshineDataSource}
          selectedH3={selectedSunshineH3}
          onSelectHex={onSelectSunshineHex}
          onDeselectHex={onDeselectSunshineHex}
          overlayOffset={overlayOffset}
        />
      )}
      {showSunshine && (
        <SunshineLegend
          month={sunshineMonth}
          dataSource={sunshineDataSource}
          overlayOffset={overlayOffset}
        />
      )}
      {showTransit && transitSystems.length > 0 && (
        <TransitLayer
          systems={transitSystems}
          activeColorMap={activeColorMap}
          selectedStopName={selectedTransitStopName}
          flyToSelected={flyToTransitStop}
          onSelectStop={onSelectTransitStop}
          onDeselectStop={onDeselectTransitStop}
          overlayOffset={overlayOffset}
        />
      )}
      <NavigationControl position="top-right" />
      <LocateControl targetZoom={locateZoom} />
      <ScaleControl position="bottom-right" />
    </Map>
  );
}
