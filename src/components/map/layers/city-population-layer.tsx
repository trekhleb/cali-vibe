import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";
import { POPULATION_LABELS, type PopulationMetric } from "./county-population-layer";

const SOURCE_ID = "cities-pop";
const LABEL_SOURCE_ID = "city-pop-labels-source";
const FILL_LAYER_ID = "city-pop-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-cities.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-city-labels.geojson`;

const POP_STOPS: [number, string][] = [
  [0, "#f0f9e8"],
  [5000, "#ccebc5"],
  [25000, "#a8ddb5"],
  [100000, "#7bccc4"],
  [250000, "#4eb3d3"],
  [500000, "#2b8cbe"],
  [1000000, "#08589e"],
];

const DENSITY_STOPS: [number, string][] = [
  [0, "#fef3c7"],
  [500, "#fde68a"],
  [2000, "#fbbf24"],
  [5000, "#f59e0b"],
  [10000, "#d97706"],
  [15000, "#b45309"],
  [25000, "#78350f"],
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

interface CityPopulationLayerProps {
  overlayOffset?: number;
  selectName?: string | null;
  populationMetric?: PopulationMetric;
}

export function CityPopulationLegend({ overlayOffset = 0, populationMetric = "total" as PopulationMetric }: { overlayOffset?: number; populationMetric?: PopulationMetric }) {
  const popLabels = ["0", "5K", "25K", "100K", "250K", "500K", "1M+"];
  const densityLabels = ["0", "500", "2K", "5K", "10K", "15K", "25K+"];
  const stops = populationMetric === "density" ? DENSITY_STOPS : POP_STOPS;
  const labels = populationMetric === "density" ? densityLabels : popLabels;
  const title = populationMetric === "density"
    ? "Pop. Density / sq mi (2024)"
    : `${POPULATION_LABELS.total} (2024)`;
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

export default function CityPopulationLayer({ overlayOffset = 0, selectName = null, populationMetric = "total" }: CityPopulationLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID, {
    selectName,
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 13,
  });

  const activePop = (activeProperties?.population as number) ?? null;
  const activeDensity = (activeProperties?.density as number) ?? null;

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(populationMetric ?? "total"),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "city-pop-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.5, "line-opacity": 0.6 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "city-pop-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#1e3a5f", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "city-pop-labels",
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
        <Layer {...labelLayer} id="city-pop-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="city-pop-labels-highlight"
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
            {activeName}
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
