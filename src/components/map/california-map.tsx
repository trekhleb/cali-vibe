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
  showCrime?: boolean;
  crimeType?: CrimeType;
  showCityCrime?: boolean;
  cityCrimeType?: CrimeType;
  showTemperature?: boolean;
  tempMetric?: TempMetric;
  tempMonth?: number;
  tempUnit?: TempUnit;
  tempResolution?: HexResolution;
  selectedHexH3?: string | null;
  onDeselectHex?: () => void;
  showCities?: boolean;
  cityDisplayMode?: CityDisplayMode;
  onToggleCountyFavorite?: (name: string) => void;
  isCountyFavorite?: (name: string) => boolean;
  onToggleCityFavorite?: (name: string) => void;
  isCityFavorite?: (name: string) => boolean;
  overlayOffset?: number;
  selectedCountyName?: string | null;
  selectedCityName?: string | null;
}

export default function CaliforniaMap({
  terrain3d = false,
  mapStyleId = "liberty",
  showCounties = false,
  countyDisplayMode = "colored",
  showPopulation = false,
  showCrime = false,
  crimeType = "total",
  showCityCrime = false,
  cityCrimeType = "total",
  showTemperature = false,
  tempMetric = "tavg",
  tempMonth = 6,
  tempUnit = "F",
  tempResolution = 5,
  selectedHexH3 = null,
  onDeselectHex,
  showCities = false,
  cityDisplayMode = "borders",
  onToggleCountyFavorite,
  isCountyFavorite,
  onToggleCityFavorite,
  isCityFavorite,
  overlayOffset = 0,
  selectedCountyName = null,
  selectedCityName = null,
}: CaliforniaMapProps) {
  return (
    <Map
      initialViewState={INITIAL_VIEW_STATE}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLES[mapStyleId].style}
      fadeDuration={50}
      padding={{ left: overlayOffset }}
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
      {showPopulation && !showCrime && <CountyPopulationLayer overlayOffset={overlayOffset} />}
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
      {showCrime && <CountyCrimeLayer crimeType={crimeType} overlayOffset={overlayOffset} />}
      {showCrime && <CrimeLegend crimeType={crimeType} overlayOffset={overlayOffset} />}
      {showCityCrime && <CityCrimeLayer crimeType={cityCrimeType} overlayOffset={overlayOffset} />}
      {showCityCrime && <CityCrimeLegend crimeType={cityCrimeType} overlayOffset={overlayOffset} />}
      {showTemperature && (
        <TemperatureLayer
          metric={tempMetric}
          month={tempMonth}
          unit={tempUnit}
          resolution={tempResolution}
          selectedH3={selectedHexH3}
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
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-right" />
    </Map>
  );
}
