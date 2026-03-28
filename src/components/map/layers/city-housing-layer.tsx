import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import HeartButton from "@/components/heart-button";
import {
  HOUSING_LABELS,
  type HousingMetric,
} from "./county-housing-layer";

const SOURCE_ID = "cities-housing";
const LABEL_SOURCE_ID = "city-housing-labels-source";
const FILL_LAYER_ID = "city-housing-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const SCALE_CONFIGS: Record<HousingMetric, { stops: [number, string][] }> = {
  homeValue: {
    stops: [
      [200000, "#eff6ff"], [400000, "#bfdbfe"], [600000, "#60a5fa"],
      [900000, "#2563eb"], [1500000, "#1e3a8a"],
    ],
  },
  rent: {
    stops: [
      [800, "#f0fdf4"], [1200, "#bbf7d0"], [1600, "#4ade80"],
      [2200, "#16a34a"], [2900, "#14532d"],
    ],
  },
  income: {
    stops: [
      [50000, "#fefce8"], [75000, "#fde68a"], [100000, "#f59e0b"],
      [130000, "#d97706"], [160000, "#78350f"],
    ],
  },
};

function getScale(metric: HousingMetric) {
  return SCALE_CONFIGS[metric];
}

function housingExpr(metric: HousingMetric): ExpressionSpecification {
  return ["get", metric, ["get", "housing"]] as ExpressionSpecification;
}

function hasHousing(): ExpressionSpecification {
  return ["has", "housing"] as ExpressionSpecification;
}

function buildFillColor(metric: HousingMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "case", hasHousing(),
    ["interpolate", ["linear"], housingExpr(metric), ...scale.stops.flat()],
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

function parseHousingValue(props: Record<string, unknown> | null, metric: HousingMetric): number | null {
  if (!props) return null;
  try {
    const housing = typeof props.housing === "string" ? JSON.parse(props.housing) : props.housing;
    return (housing as Record<string, number>)?.[metric] ?? null;
  } catch {
    return null;
  }
}

function formatValue(val: number, metric: HousingMetric): string {
  if (metric === "rent") return `$${val.toLocaleString()}/mo`;
  if (metric === "income") return `$${(val / 1000).toFixed(0)}K/yr`;
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  return `$${(val / 1000).toFixed(0)}K`;
}

interface CityHousingLayerProps {
  housingMetric: HousingMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function CityHousingLegend({ housingMetric, overlayOffset = 0 }: { housingMetric: HousingMetric; overlayOffset?: number }) {
  const scale = getScale(housingMetric);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {HOUSING_LABELS[housingMetric]} (ACS 2019–2023)
      </div>
      <div className="flex">
        {scale.stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">
              {housingMetric === "rent"
                ? `$${val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val}`
                : `$${val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}K`}`
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CityHousingLayer({ housingMetric, overlayOffset = 0, selectName = null, onToggleFavorite, isFavorite }: CityHousingLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activeVal = parseHousingValue(activeProperties, housingMetric);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(housingMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-housing-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-housing-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-housing-labels",
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
        <Layer {...labelLayer} id="city-housing-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-housing-labels-highlight"
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
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-800">
              {activeName}
            </div>
            {onToggleFavorite && (
              <HeartButton favorited={favorited} onToggle={() => onToggleFavorite(activeName)} />
            )}
          </div>
          <div className="text-sm text-gray-600">
            {HOUSING_LABELS[housingMetric]}: {formatValue(activeVal, housingMetric)}
          </div>
        </div>
      )}
    </>
  );
}
