import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import PlacePopupHeader from "@/components/map/place-popup-header";
import {
  RACE_LABELS,
  type RaceMetric,
} from "./county-race-layer";

const SOURCE_ID = "cities-race";
const LABEL_SOURCE_ID = "city-race-labels-source";
const FILL_LAYER_ID = "city-race-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const SCALE_CONFIGS: Record<RaceMetric, { stops: [number, string][] }> = {
  white: {
    stops: [
      [10, "#eff6ff"], [25, "#bfdbfe"], [40, "#60a5fa"],
      [55, "#2563eb"], [75, "#1e3a8a"],
    ],
  },
  hispanic: {
    stops: [
      [10, "#fef3c7"], [25, "#fcd34d"], [45, "#f59e0b"],
      [65, "#b45309"], [85, "#451a03"],
    ],
  },
  black: {
    stops: [
      [1, "#fce7f3"], [5, "#f9a8d4"], [10, "#ec4899"],
      [15, "#be185d"], [25, "#500724"],
    ],
  },
  asian: {
    stops: [
      [2, "#ecfdf5"], [8, "#a7f3d0"], [18, "#34d399"],
      [30, "#059669"], [50, "#022c22"],
    ],
  },
  other: {
    stops: [
      [3, "#f5f3ff"], [6, "#c4b5fd"], [9, "#8b5cf6"],
      [13, "#6d28d9"], [20, "#2e1065"],
    ],
  },
};

function getScale(metric: RaceMetric) {
  return SCALE_CONFIGS[metric];
}

function raceExpr(metric: RaceMetric): ExpressionSpecification {
  return ["get", metric, ["get", "race"]] as ExpressionSpecification;
}

function hasRace(): ExpressionSpecification {
  return ["has", "race"] as ExpressionSpecification;
}

function buildFillColor(metric: RaceMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "case", hasRace(),
    ["interpolate", ["linear"], raceExpr(metric), ...scale.stops.flat()],
    "rgba(200,200,200,0.3)",
  ] as ExpressionSpecification;
}

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

function parseRaceValue(props: Record<string, unknown> | null, metric: RaceMetric): number | null {
  if (!props) return null;
  try {
    const race = typeof props.race === "string" ? JSON.parse(props.race) : props.race;
    return (race as Record<string, number>)?.[metric] ?? null;
  } catch {
    return null;
  }
}

interface CityRaceLayerProps {
  raceMetric: RaceMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  onViewDetail?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function CityRaceLegend({ raceMetric, overlayOffset = 0 }: { raceMetric: RaceMetric; overlayOffset?: number }) {
  const scale = getScale(raceMetric);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {RACE_LABELS[raceMetric]} (ACS 2019–2023)
      </div>
      <div className="flex">
        {scale.stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CityRaceLayer({ raceMetric, overlayOffset = 0, selectName = null, onToggleFavorite, onViewDetail, isFavorite }: CityRaceLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activeVal = parseRaceValue(activeProperties, raceMetric);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(raceMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-race-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-race-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-race-labels",
    type: "symbol",
    source: LABEL_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 7, 0, 9, 9, 12, 12],
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-max-width": 8,
      "text-anchor": "center",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#1e293b",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": 1.5,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, 0, 8.5, 1],
    },
  };

  const labelHighlightFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["==", ["get", "name"], activeName]
    : ["==", ["get", "name"], ""];

  const labelDimFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["!=", ["get", "name"], activeName]
    : ["literal", true];

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={GEOJSON_URL} generateId>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...highlightLineLayer} />
      </Source>

      <Source id={LABEL_SOURCE_ID} type="geojson" data={LABELS_URL}>
        <Layer {...labelLayer} id="city-race-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-race-labels-highlight"
          filter={labelHighlightFilter}
          paint={{
            ...labelLayer.paint,
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
          }}
        />
      </Source>

      {activeName && activeVal !== null && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <PlacePopupHeader
            placeType="city"
            name={activeName}
            favorited={favorited}
            onToggleFavorite={onToggleFavorite}
            onViewDetail={onViewDetail}
          />
          <div className="text-sm text-gray-600">
            {RACE_LABELS[raceMetric]}: {activeVal.toFixed(1)}%
          </div>
        </div>
      )}
    </>
  );
}
