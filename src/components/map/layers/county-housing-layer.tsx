import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";

const SOURCE_ID = "counties-housing";
const LABEL_SOURCE_ID = "county-housing-labels-source";
const FILL_LAYER_ID = "county-housing-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

export type HousingMetric = "homeValue" | "rent";

export const HOUSING_LABELS: Record<HousingMetric, string> = {
  homeValue: "Median Home Value",
  rent: "Median Gross Rent",
};

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
};

function getScale(metric: HousingMetric) {
  return SCALE_CONFIGS[metric];
}

function housingExpr(metric: HousingMetric): ExpressionSpecification {
  return ["get", metric, ["get", "housing"]] as ExpressionSpecification;
}

function buildFillColor(metric: HousingMetric): ExpressionSpecification {
  const scale = getScale(metric);
  return [
    "interpolate", ["linear"], housingExpr(metric),
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
  if (metric === "rent") {
    return `$${val.toLocaleString()}/mo`;
  }
  if (val >= 1000000) {
    return `$${(val / 1000000).toFixed(2)}M`;
  }
  return `$${(val / 1000).toFixed(0)}K`;
}

interface CountyHousingLayerProps {
  housingMetric: HousingMetric;
  overlayOffset?: number;
  selectName?: string | null;
}

export function HousingLegend({ housingMetric, overlayOffset = 0 }: { housingMetric: HousingMetric; overlayOffset?: number }) {
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
                : `$${val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}K`}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CountyHousingLayer({ housingMetric, overlayOffset = 0, selectName = null }: CountyHousingLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 11,
  });

  const activeVal = parseHousingValue(activeProperties, housingMetric);

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
    id: "county-housing-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.8 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "county-housing-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "county-housing-labels",
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
        <Layer {...labelLayer} id="county-housing-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-housing-labels-highlight"
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
          <div className="text-sm font-semibold text-gray-800">
            {activeName} County
          </div>
          <div className="text-sm text-gray-600">
            {HOUSING_LABELS[housingMetric]}: {formatValue(activeVal, housingMetric)}
          </div>
        </div>
      )}
    </>
  );
}
