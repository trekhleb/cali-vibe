import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import HeartButton from "@/components/heart-button";

const SOURCE_ID = "counties";
const LABEL_SOURCE_ID = "county-labels-source";
const FILL_LAYER_ID = "county-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

export type CountyDisplayMode = "borders" | "colored";

const COUNTY_PALETTE = [
  "#93c5fd", "#86efac", "#fca5a5", "#fde68a", "#c4b5fd", "#fdba74",
  "#67e8f9", "#f9a8d4", "#a5b4fc", "#6ee7b7", "#fcd34d", "#d8b4fe",
];

function buildPaletteColor(): ExpressionSpecification {
  const cases: (ExpressionSpecification | string)[] = [];
  for (let i = 0; i < COUNTY_PALETTE.length; i++) {
    cases.push(["==", ["%", ["id"], COUNTY_PALETTE.length], i] as ExpressionSpecification);
    cases.push(COUNTY_PALETTE[i]);
  }
  return ["case", ...cases, COUNTY_PALETTE[0]] as ExpressionSpecification;
}

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

interface CountyBordersLayerProps {
  displayMode?: CountyDisplayMode;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
  overlayOffset?: number;
  selectName?: string | null;
}

export default function CountyBordersLayer({
  displayMode = "borders",
  onToggleFavorite,
  isFavorite,
  overlayOffset = 0,
  selectName = null,
}: CountyBordersLayerProps) {
  const colored = displayMode === "colored";

  const { activeName } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 11,
  });

  const fillLayer: FillLayerSpecification = colored
    ? {
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": buildPaletteColor(),
        "fill-opacity": ["case", isHighlighted(), 0.85, 0.55],
      },
    }
    : {
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["case", isHighlighted(), "rgba(59, 130, 246, 0.12)", "transparent"],
      },
    };

  const lineLayer: LineLayerSpecification = colored
    ? {
      id: "county-borders",
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": "#ffffff", "line-width": 1, "line-opacity": 0.9 },
    }
    : {
      id: "county-borders",
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": "#6b7280", "line-width": 1, "line-opacity": 0.8 },
    };

  const highlightLineLayer: LineLayerSpecification = {
    id: "county-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), colored ? "#1e3a5f" : "#3b82f6", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "county-labels",
    type: "symbol",
    source: LABEL_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 0, 7, 10, 10, 14],
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-max-width": 8,
      "text-anchor": "center",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": colored ? "#1e293b" : "#6b7280",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": colored ? 2 : 1.5,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.5, 1],
    },
  };

  const labelHighlightFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["==", ["get", "name"], activeName]
    : ["==", ["get", "name"], ""];

  const labelDimFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["!=", ["get", "name"], activeName]
    : ["literal", true];

  const favorited = activeName ? isFavorite?.(activeName) ?? false : false;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={GEOJSON_URL} generateId>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...highlightLineLayer} />
      </Source>

      <Source id={LABEL_SOURCE_ID} type="geojson" data={LABELS_URL}>
        <Layer {...labelLayer} id="county-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-labels-highlight"
          filter={labelHighlightFilter}
          paint={{
            ...labelLayer.paint,
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
          }}
        />
      </Source>

      {activeName && (
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
        </div>
      )}
    </>
  );
}
