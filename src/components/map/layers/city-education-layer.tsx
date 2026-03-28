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
  EDUCATION_LABELS,
  type EducationMetric,
} from "./county-education-layer";

const SOURCE_ID = "cities-education";
const LABEL_SOURCE_ID = "city-education-labels-source";
const FILL_LAYER_ID = "city-education-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const SCALE_CONFIGS: Record<EducationMetric, { stops: [number, string][] }> = {
  bachPlus: {
    stops: [
      [15, "#f3e8ff"], [25, "#d8b4fe"], [35, "#a855f7"],
      [45, "#7e22ce"], [60, "#3b0764"],
    ],
  },
  hsPlus: {
    stops: [
      [70, "#ecfdf5"], [78, "#a7f3d0"], [84, "#34d399"],
      [90, "#059669"], [95, "#022c22"],
    ],
  },
  gradPlus: {
    stops: [
      [5, "#fef3c7"], [10, "#fcd34d"], [18, "#f59e0b"],
      [25, "#b45309"], [35, "#451a03"],
    ],
  },
};

function getScale(metric: EducationMetric) {
  return SCALE_CONFIGS[metric];
}

function educationExpr(metric: EducationMetric): ExpressionSpecification {
  return ["get", metric, ["get", "education"]] as ExpressionSpecification;
}

function hasEducation(): ExpressionSpecification {
  return ["has", "education"] as ExpressionSpecification;
}

function buildFillColor(metric: EducationMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "case", hasEducation(),
    ["interpolate", ["linear"], educationExpr(metric), ...scale.stops.flat()],
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

function parseEducationValue(props: Record<string, unknown> | null, metric: EducationMetric): number | null {
  if (!props) return null;
  try {
    const education = typeof props.education === "string" ? JSON.parse(props.education) : props.education;
    return (education as Record<string, number>)?.[metric] ?? null;
  } catch {
    return null;
  }
}

interface CityEducationLayerProps {
  educationMetric: EducationMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function CityEducationLegend({ educationMetric, overlayOffset = 0 }: { educationMetric: EducationMetric; overlayOffset?: number }) {
  const scale = getScale(educationMetric);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {EDUCATION_LABELS[educationMetric]} (ACS 2019–2023)
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

export default function CityEducationLayer({ educationMetric, overlayOffset = 0, selectName = null, onToggleFavorite, isFavorite }: CityEducationLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activeVal = parseEducationValue(activeProperties, educationMetric);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(educationMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-education-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-education-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-education-labels",
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
        <Layer {...labelLayer} id="city-education-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-education-labels-highlight"
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
            {EDUCATION_LABELS[educationMetric]}: {activeVal.toFixed(1)}%
          </div>
        </div>
      )}
    </>
  );
}
