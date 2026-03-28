import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";

export type PopulationMetric = "total" | "density";
export const POPULATION_LABELS: Record<PopulationMetric, string> = {
  total: "Total Population",
  density: "Density (per sq mi)",
};

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

const DENSITY_STOPS: [number, string][] = [
  [0, "#fef3c7"],
  [50, "#fde68a"],
  [200, "#fbbf24"],
  [500, "#f59e0b"],
  [2000, "#d97706"],
  [5000, "#b45309"],
  [15000, "#78350f"],
];

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

function buildFillColor(metric: PopulationMetric): ExpressionSpecification {
  const stops = metric === "density" ? DENSITY_STOPS : POP_STOPS;
  const prop = metric === "density" ? "density" : "population";
  return [
    "interpolate",
    ["linear"],
    ["get", prop],
    ...stops.flat(),
  ] as ExpressionSpecification;
}

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

function buildLabelTextField(metric: PopulationMetric): ExpressionSpecification {
  if (metric === "density") {
    return [
      "format",
      ["get", "name"],
      { "font-scale": 1 },
      "\n",
      {},
      [
        "case",
        [">=", ["get", "density"], 1000],
        ["concat", ["to-string", ["round", ["/", ["get", "density"], 1000]]], "K/mi²"],
        ["concat", ["to-string", ["round", ["get", "density"]]], "/mi²"],
      ],
      { "font-scale": 0.8 },
    ] as ExpressionSpecification;
  }
  return [
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
  ] as ExpressionSpecification;
}

const labelLayerBase: Omit<SymbolLayerSpecification, "layout"> & { layout: Omit<SymbolLayerSpecification["layout"], "text-field"> } = {
  id: "county-pop-labels",
  type: "symbol",
  source: LABEL_SOURCE_ID,
  layout: {
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

export function PopulationLegend({ overlayOffset = 0, populationMetric = "total" as PopulationMetric }: { overlayOffset?: number; populationMetric?: PopulationMetric }) {
  const popLabels = ["0", "10K", "50K", "100K", "500K", "1M", "3M+"];
  const densityLabels = ["0", "50", "200", "500", "2K", "5K", "15K+"];
  const stops = populationMetric === "density" ? DENSITY_STOPS : POP_STOPS;
  const labels = populationMetric === "density" ? densityLabels : popLabels;
  const title = populationMetric === "density" ? "Pop. Density / sq mi (2024)" : "Population (2024)";
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {title}
      </div>
      <div className="flex">
        {stops.map(([, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CountyPopulationLayer({ overlayOffset = 0, selectName = null, populationMetric = "total" as PopulationMetric }: { overlayOffset?: number; selectName?: string | null; populationMetric?: PopulationMetric }) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 11,
  });

  const activePop = (activeProperties?.population as number) ?? null;
  const activeDensity = (activeProperties?.density as number) ?? null;

  const labelHighlightFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["==", ["get", "name"], activeName]
    : ["==", ["get", "name"], ""];

  const labelDimFilter: SymbolLayerSpecification["filter"] = activeName
    ? ["!=", ["get", "name"], activeName]
    : ["literal", true];

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(populationMetric),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const labelLayout = {
    ...labelLayerBase.layout,
    "text-field": buildLabelTextField(populationMetric),
  };

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={GEOJSON_URL} generateId>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...highlightLineLayer} />
      </Source>

      <Source id={LABEL_SOURCE_ID} type="geojson" data={LABELS_URL}>
        <Layer {...labelLayerBase} layout={labelLayout} id="county-pop-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayerBase}
          layout={labelLayout}
          id="county-pop-labels-highlight"
          filter={labelHighlightFilter}
          paint={{
            ...labelLayerBase.paint,
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
          {activeDensity !== null && (
            <div className="text-sm text-gray-600">
              Density: {activeDensity.toLocaleString()}/sq mi
            </div>
          )}
        </div>
      )}
    </>
  );
}
