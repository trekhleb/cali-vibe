import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import HeartButton from "@/components/heart-button";

const SOURCE_ID = "counties-age";
const LABEL_SOURCE_ID = "county-age-labels-source";
const FILL_LAYER_ID = "county-age-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

export type AgeMetric = "under18" | "age18_34" | "age35_64" | "age65plus" | "medianAge";

export const AGE_LABELS: Record<AgeMetric, string> = {
  under18: "Under 18",
  age18_34: "18–34",
  age35_64: "35–64",
  age65plus: "65+",
  medianAge: "Median Age",
};

export const ageMetricIds = Object.keys(AGE_LABELS) as AgeMetric[];

const SCALE_CONFIGS: Record<AgeMetric, { stops: [number, string][]; suffix: string }> = {
  under18: {
    stops: [
      [12, "#eff6ff"], [17, "#bfdbfe"], [22, "#60a5fa"],
      [27, "#2563eb"], [35, "#1e3a8a"],
    ],
    suffix: "%",
  },
  age18_34: {
    stops: [
      [12, "#fef3c7"], [18, "#fcd34d"], [24, "#f59e0b"],
      [30, "#b45309"], [40, "#451a03"],
    ],
    suffix: "%",
  },
  age35_64: {
    stops: [
      [30, "#ecfdf5"], [35, "#a7f3d0"], [40, "#34d399"],
      [45, "#059669"], [55, "#022c22"],
    ],
    suffix: "%",
  },
  age65plus: {
    stops: [
      [8, "#fce7f3"], [14, "#f9a8d4"], [20, "#ec4899"],
      [26, "#be185d"], [35, "#500724"],
    ],
    suffix: "%",
  },
  medianAge: {
    stops: [
      [25, "#f5f3ff"], [32, "#c4b5fd"], [38, "#8b5cf6"],
      [44, "#6d28d9"], [55, "#2e1065"],
    ],
    suffix: "",
  },
};

function getScale(metric: AgeMetric) {
  return SCALE_CONFIGS[metric];
}

function ageExpr(metric: AgeMetric): ExpressionSpecification {
  return ["get", metric, ["get", "age"]] as ExpressionSpecification;
}

function hasAge(): ExpressionSpecification {
  return ["has", "age"] as ExpressionSpecification;
}

function buildFillColor(metric: AgeMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "case", hasAge(),
    ["interpolate", ["linear"], ageExpr(metric), ...scale.stops.flat()],
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

function parseAgeValue(props: Record<string, unknown> | null, metric: AgeMetric): number | null {
  if (!props) return null;
  try {
    const age = typeof props.age === "string" ? JSON.parse(props.age) : props.age;
    return (age as Record<string, number>)?.[metric] ?? null;
  } catch {
    return null;
  }
}

interface CountyAgeLayerProps {
  ageMetric: AgeMetric;
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function AgeLegend({ ageMetric, overlayOffset = 0 }: { ageMetric: AgeMetric; overlayOffset?: number }) {
  const scale = getScale(ageMetric);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {AGE_LABELS[ageMetric]} (ACS 2019–2023)
      </div>
      <div className="flex">
        {scale.stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{val}{scale.suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CountyAgeLayer({ ageMetric, overlayOffset = 0, selectName = null, onToggleFavorite, isFavorite }: CountyAgeLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 11,
  });

  const activeVal = parseAgeValue(activeProperties, ageMetric);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;
  const scale = getScale(ageMetric);

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(ageMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "county-age-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.8 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "county-age-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "county-age-labels",
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
        <Layer {...labelLayer} id="county-age-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-age-labels-highlight"
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
              {activeName} County
            </div>
            {onToggleFavorite && (
              <HeartButton favorited={favorited} onToggle={() => onToggleFavorite(activeName)} />
            )}
          </div>
          <div className="text-sm text-gray-600">
            {AGE_LABELS[ageMetric]}: {activeVal.toFixed(1)}{scale.suffix}
          </div>
        </div>
      )}
    </>
  );
}
