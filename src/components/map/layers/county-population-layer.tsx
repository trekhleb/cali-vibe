import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";

const SOURCE_ID = "counties-pop";
const LABEL_SOURCE_ID = "county-pop-labels-source";
const FILL_LAYER_ID = "county-pop-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

const POP_STOPS: [number, string][] = [
  [0, "#f0f9e8"],
  [10000, "#ccebc5"],
  [50000, "#a8ddb5"],
  [100000, "#7bccc4"],
  [500000, "#4eb3d3"],
  [1000000, "#2b8cbe"],
  [3000000, "#08589e"],
];

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

const fillLayer: FillLayerSpecification = {
  id: FILL_LAYER_ID,
  type: "fill",
  source: SOURCE_ID,
  paint: {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["get", "population"],
      ...POP_STOPS.flat(),
    ],
    "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
  },
};

const lineLayer: LineLayerSpecification = {
  id: "county-pop-borders",
  type: "line",
  source: SOURCE_ID,
  paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.8 },
};

const highlightLineLayer: LineLayerSpecification = {
  id: "county-pop-borders-highlight",
  type: "line",
  source: SOURCE_ID,
  paint: {
    "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
    "line-width": ["case", isHighlighted(), 3, 0],
    "line-opacity": 1,
  },
};

const labelLayer: SymbolLayerSpecification = {
  id: "county-pop-labels",
  type: "symbol",
  source: LABEL_SOURCE_ID,
  layout: {
    "text-field": [
      "format",
      ["get", "name"],
      { "font-scale": 1 },
      "\n",
      {},
      [
        "case",
        [">=", ["get", "population"], 1000000],
        ["concat", ["to-string", ["/", ["round", ["/", ["get", "population"], 100000]], 10]], "M"],
        [">=", ["get", "population"], 1000],
        ["concat", ["to-string", ["round", ["/", ["get", "population"], 1000]]], "K"],
        ["to-string", ["get", "population"]],
      ],
      { "font-scale": 0.8 },
    ],
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

export function PopulationLegend({ overlayOffset = 0 }: { overlayOffset?: number }) {
  const labels = ["0", "10K", "50K", "100K", "500K", "1M", "3M+"];
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        Population (2024)
      </div>
      <div className="flex">
        {POP_STOPS.map(([, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CountyPopulationLayer({ overlayOffset = 0 }: { overlayOffset?: number }) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID);

  const activePop = (activeProperties?.population as number) ?? null;

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
        <Layer {...labelLayer} id="county-pop-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-pop-labels-highlight"
          filter={labelHighlightFilter}
          paint={{
            ...labelLayer.paint,
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
          }}
        />
      </Source>

      {activeName && activePop !== null && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="text-sm font-semibold text-gray-800">
            {activeName} County
          </div>
          <div className="text-sm text-gray-600">
            Pop: {activePop.toLocaleString()}
          </div>
        </div>
      )}
    </>
  );
}
