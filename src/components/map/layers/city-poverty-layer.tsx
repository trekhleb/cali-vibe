import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import HeartButton from "@/components/heart-button";
import DetailLinkButton from "@/components/detail-link-button";
import { POVERTY_LABEL } from "./county-poverty-layer";

const SOURCE_ID = "cities-poverty";
const LABEL_SOURCE_ID = "city-poverty-labels-source";
const FILL_LAYER_ID = "city-poverty-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const SCALE_STOPS: [number, string][] = [
  [5, "#fef2f2"],
  [10, "#fecaca"],
  [15, "#f87171"],
  [22, "#dc2626"],
  [30, "#7f1d1d"],
];

function hasPoverty(): ExpressionSpecification {
  return ["has", "poverty"] as ExpressionSpecification;
}

function buildFillColor(): ExpressionSpecification {
  return [
    "case", hasPoverty(),
    ["interpolate", ["linear"], ["get", "poverty"], ...SCALE_STOPS.flat()],
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

function parsePovertyValue(props: Record<string, unknown> | null): number | null {
  if (!props) return null;
  const v = props.poverty;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface CityPovertyLayerProps {
  overlayOffset?: number;
  selectName?: string | null;
  onToggleFavorite?: (name: string) => void;
  onViewDetail?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
}

export function CityPovertyLegend({ overlayOffset = 0 }: { overlayOffset?: number }) {
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {POVERTY_LABEL} (ACS 2019–2023)
      </div>
      <div className="flex">
        {SCALE_STOPS.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{val}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CityPovertyLayer({ overlayOffset = 0, selectName = null, onToggleFavorite, onViewDetail, isFavorite }: CityPovertyLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activeVal = parsePovertyValue(activeProperties);
  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-poverty-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-poverty-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-poverty-labels",
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
        <Layer {...labelLayer} id="city-poverty-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-poverty-labels-highlight"
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
            {POVERTY_LABEL}: {activeVal.toFixed(1)}%
          </div>
        </div>
      )}
    </>
  );
}
