import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import PlacePopupHeader from "@/components/map/place-popup-header";

const SOURCE_ID = "counties-schools";
const LABEL_SOURCE_ID = "county-schools-labels-source";
const FILL_LAYER_ID = "county-schools-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

export type SchoolMetric = "ela" | "math" | "graduationRate" | "schoolCount";

export const SCHOOL_LABELS: Record<SchoolMetric, string> = {
  ela: "Avg ELA (Dist. from Std.)",
  math: "Avg Math (Dist. from Std.)",
  graduationRate: "Avg Graduation Rate",
  schoolCount: "School Count",
};

export const SCHOOL_METRIC_DESCRIPTIONS: Record<SchoolMetric, string> = {
  ela: "Average English Language Arts (ELA) score distance from the state standard.",
  math: "Average Mathematics score distance from the state standard.",
  graduationRate: "Percentage of high school students who graduate in 4 years.",
  schoolCount: "Total number of public schools in the region.",
};

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
      [5, "#eff6ff"], [50, "#93c5fd"], [200, "#3b82f6"],
      [500, "#1d4ed8"], [2000, "#1e3a5f"],
    ],
  },
};

function getScale(metric: SchoolMetric) {
  return SCALE_CONFIGS[metric];
}

function schoolExpr(metric: SchoolMetric): ExpressionSpecification {
  return ["get", metric, ["get", "schools"]] as ExpressionSpecification;
}

function buildFillColor(metric: SchoolMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "interpolate", ["linear"], schoolExpr(metric),
    ...scale.stops.flat(),
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
  // ELA and Math are DFS — show sign
  return val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
}

interface CountySchoolsLayerProps {
  schoolMetric: SchoolMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  onViewDetail?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function SchoolsLegend({ schoolMetric, overlayOffset = 0 }: { schoolMetric: SchoolMetric; overlayOffset?: number }) {
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

export default function CountySchoolsLayer({ schoolMetric, overlayOffset = 0, selectName = null, onToggleFavorite, onViewDetail, isFavorite }: CountySchoolsLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 11,
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
    id: "county-schools-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.8 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "county-schools-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "county-schools-labels",
    type: "symbol",
    source: LABEL_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 0, 7, 10, 10, 13],
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-max-width": 8,
      "text-anchor": "center",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#1e293b",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": 1.5,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.5, 1],
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
        <Layer {...labelLayer} id="county-schools-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-schools-labels-highlight"
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
            placeType="county"
            name={activeName}
            favorited={favorited}
            onToggleFavorite={onToggleFavorite}
            onViewDetail={onViewDetail}
          />
          <div className="text-sm text-gray-600">
            {SCHOOL_LABELS[schoolMetric]}: {formatSchoolValue(activeVal, schoolMetric)}
          </div>
        </div>
      )}
    </>
  );
}
