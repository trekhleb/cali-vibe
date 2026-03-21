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
import CityBordersLayer, { type CityDisplayMode } from "./layers/city-borders-layer";
import CityCrimeLayer, { CityCrimeLegend } from "./layers/city-crime-layer";
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
  selectedPopulationCountyName?: string | null;
  showCrime?: boolean;
  crimeType?: CrimeType;
  selectedCrimeCountyName?: string | null;
  showCityCrime?: boolean;
  cityCrimeType?: CrimeType;
  selectedCrimeCityName?: string | null;
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
  onToggleCityFavorite?: (name: string) => void;
  isCityFavorite?: (name: string) => boolean;
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
  selectedPopulationCountyName = null,
  showCrime = false,
  crimeType = "total",
  selectedCrimeCountyName = null,
  showCityCrime = false,
  cityCrimeType = "total",
  selectedCrimeCityName = null,
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
  onToggleCityFavorite,
  isCityFavorite,
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
    showCities || showCityCrime ? 11 :
    showCounties || showPopulation || showCrime ? 8 :
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
      {showCounties && !showPopulation && !showCrime && (
        <CountyBordersLayer
          displayMode={countyDisplayMode}
          onToggleFavorite={onToggleCountyFavorite}
          isFavorite={isCountyFavorite}
          overlayOffset={overlayOffset}
          selectName={selectedCountyName}
        />
      )}
      {showPopulation && !showCrime && <CountyPopulationLayer overlayOffset={overlayOffset} selectName={selectedPopulationCountyName} />}
      {showPopulation && !showCrime && <PopulationLegend overlayOffset={overlayOffset} />}
      {showCities && (
        <CityBordersLayer
          displayMode={cityDisplayMode}
          onToggleFavorite={onToggleCityFavorite}
          isFavorite={isCityFavorite}
          overlayOffset={overlayOffset}
          selectName={selectedCityName}
        />
      )}
      {showCrime && <CountyCrimeLayer crimeType={crimeType} overlayOffset={overlayOffset} selectName={selectedCrimeCountyName} />}
      {showCrime && <CrimeLegend crimeType={crimeType} overlayOffset={overlayOffset} />}
      {showCityCrime && <CityCrimeLayer crimeType={cityCrimeType} overlayOffset={overlayOffset} selectName={selectedCrimeCityName} />}
      {showCityCrime && <CityCrimeLegend crimeType={cityCrimeType} overlayOffset={overlayOffset} />}
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
