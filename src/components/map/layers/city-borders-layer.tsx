import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import HeartButton from "@/components/heart-button";

const SOURCE_ID = "cities";
const LABEL_SOURCE_ID = "city-labels-source";
const FILL_LAYER_ID = "city-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

export type CityDisplayMode = "borders" | "colored";

const CITY_PALETTE = [
  "#93c5fd", "#86efac", "#fca5a5", "#fde68a", "#c4b5fd", "#fdba74",
  "#67e8f9", "#f9a8d4", "#a5b4fc", "#6ee7b7", "#fcd34d", "#d8b4fe",
];

function buildPaletteColor(): ExpressionSpecification {
  const cases: (ExpressionSpecification | string)[] = [];
  for (let i = 0; i < CITY_PALETTE.length; i++) {
    cases.push(["==", ["%", ["id"], CITY_PALETTE.length], i] as ExpressionSpecification);
    cases.push(CITY_PALETTE[i]);
  }
  return ["case", ...cases, CITY_PALETTE[0]] as ExpressionSpecification;
}

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

interface CityBordersLayerProps {
  displayMode?: CityDisplayMode;
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
  overlayOffset?: number;
  selectName?: string | null;
}

export default function CityBordersLayer({
  displayMode = "borders",
  onToggleFavorite,
  isFavorite,
  overlayOffset = 0,
  selectName = null,
}: CityBordersLayerProps) {
  const colored = displayMode === "colored";

  const { activeName } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
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
      id: "city-borders",
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.9 },
    }
    : {
      id: "city-borders",
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": "#9ca3af", "line-width": 0.6, "line-opacity": 0.8 },
    };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), colored ? "#1e3a5f" : "#3b82f6", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-labels",
    type: "symbol",
    source: LABEL_SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 9, 12, 12],
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-max-width": 8,
      "text-anchor": "center",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": colored ? "#1e293b" : "#6b7280",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": colored ? 2 : 1.5,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 9, 1],
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
        <Layer {...labelLayer} id="city-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-labels-highlight"
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
              {activeName}
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
