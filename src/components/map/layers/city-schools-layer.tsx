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
  SCHOOL_LABELS,
  type SchoolMetric,
} from "./county-schools-layer";

const SOURCE_ID = "cities-schools";
const LABEL_SOURCE_ID = "city-schools-labels-source";
const FILL_LAYER_ID = "city-schools-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const SCALE_CONFIGS: Record<SchoolMetric, { stops: [number, string][] }> = {
  ela: {
    stops: [
      [-80, "#ef4444"], [-40, "#f97316"], [-10, "#eab308"],
      [10, "#22c55e"], [45, "#3b82f6"],
    ],
  },
  math: {
    stops: [
      [-120, "#ef4444"], [-70, "#f97316"], [-40, "#eab308"],
      [-10, "#22c55e"], [20, "#3b82f6"],
    ],
  },
  graduationRate: {
    stops: [
      [60, "#ef4444"], [72, "#f97316"], [82, "#eab308"],
      [90, "#22c55e"], [96, "#3b82f6"],
    ],
  },
  schoolCount: {
    stops: [
      [1, "#eff6ff"], [10, "#93c5fd"], [30, "#3b82f6"],
      [80, "#1d4ed8"], [300, "#1e3a5f"],
    ],
  },
};

function getScale(metric: SchoolMetric) {
  return SCALE_CONFIGS[metric];
}

function schoolExpr(metric: SchoolMetric): ExpressionSpecification {
  return ["get", metric, ["get", "schools"]] as ExpressionSpecification;
}

function hasSchools(): ExpressionSpecification {
  return ["has", "schools"] as ExpressionSpecification;
}

function buildFillColor(metric: SchoolMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "case", hasSchools(),
    ["interpolate", ["linear"], schoolExpr(metric), ...scale.stops.flat()],
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

function parseSchoolValue(props: Record<string, unknown> | null, metric: SchoolMetric): number | null {
  if (!props) return null;
  try {
    const schools = typeof props.schools === "string" ? JSON.parse(props.schools) : props.schools;
    return (schools as Record<string, number>)?.[metric] ?? null;
  } catch {
    return null;
  }
}

function formatSchoolValue(val: number, metric: SchoolMetric): string {
  if (metric === "schoolCount") return val.toLocaleString("en-US");
  if (metric === "graduationRate") return `${val.toFixed(1)}%`;
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

interface CitySchoolsLayerProps {
  schoolMetric: SchoolMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function CitySchoolsLegend({ schoolMetric, overlayOffset = 0 }: { schoolMetric: SchoolMetric; overlayOffset?: number }) {
  const scale = getScale(schoolMetric);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {SCHOOL_LABELS[schoolMetric]} (CDE Dashboard 2025)
      </div>
      <div className="flex">
        {scale.stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">
              {schoolMetric === "graduationRate" ? `${val}%` : schoolMetric === "schoolCount" ? val : (val >= 0 ? `+${val}` : val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CitySchoolsLayer({ schoolMetric, overlayOffset = 0, selectName = null, onToggleFavorite, isFavorite }: CitySchoolsLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activeVal = parseSchoolValue(activeProperties, schoolMetric);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(schoolMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-schools-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-schools-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-schools-labels",
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
        <Layer {...labelLayer} id="city-schools-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-schools-labels-highlight"
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
            {SCHOOL_LABELS[schoolMetric]}: {formatSchoolValue(activeVal, schoolMetric)}
          </div>
        </div>
      )}
    </>
  );
}
