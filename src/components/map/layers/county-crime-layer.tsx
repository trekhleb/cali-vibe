import { Source, Layer } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";

const SOURCE_ID = "counties-crime";
const LABEL_SOURCE_ID = "county-crime-labels-source";
const FILL_LAYER_ID = "county-crime-fill";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-counties.geojson`;
const LABELS_URL = `${import.meta.env.BASE_URL}data/california-county-labels.geojson`;

export type CrimeType =
  | "total"
  | "violentTotal"
  | "propertyTotal"
  | "homicide"
  | "rape"
  | "robbery"
  | "aggAssault"
  | "burglary"
  | "mvTheft"
  | "larceny";

export const CRIME_LABELS: Record<CrimeType, string> = {
  total: "All Crime",
  violentTotal: "Violent Crime",
  propertyTotal: "Property Crime",
  homicide: "Homicide",
  rape: "Rape",
  robbery: "Robbery",
  aggAssault: "Aggravated Assault",
  burglary: "Burglary",
  mvTheft: "Motor Vehicle Theft",
  larceny: "Larceny-Theft",
};

const SCALE_CONFIGS: Record<string, { stops: [number, string][] }> = {
  total: {
    stops: [
      [400, "#fff5f0"], [1000, "#fcbba1"], [2000, "#fb6a4a"],
      [3000, "#cb181d"], [5000, "#67000d"],
    ],
  },
  violentTotal: {
    stops: [
      [50, "#fff5f0"], [200, "#fcbba1"], [400, "#fb6a4a"],
      [600, "#cb181d"], [800, "#67000d"],
    ],
  },
  propertyTotal: {
    stops: [
      [300, "#fff5f0"], [1000, "#fcbba1"], [2000, "#fb6a4a"],
      [3000, "#cb181d"], [5000, "#67000d"],
    ],
  },
  homicide: {
    stops: [
      [0, "#fff5f0"], [3, "#fcbba1"], [6, "#fb6a4a"],
      [9, "#cb181d"], [12, "#67000d"],
    ],
  },
  default: {
    stops: [
      [0, "#fff5f0"], [100, "#fcbba1"], [250, "#fb6a4a"],
      [500, "#cb181d"], [800, "#67000d"],
    ],
  },
};

function getScale(crimeType: CrimeType) {
  return SCALE_CONFIGS[crimeType] ?? SCALE_CONFIGS.default;
}

function crimeExpr(crimeType: CrimeType): ExpressionSpecification {
  return ["get", crimeType, ["get", "crime"]] as ExpressionSpecification;
}

function buildFillColor(crimeType: CrimeType): ExpressionSpecification {
  const scale = getScale(crimeType);
  return [
    "interpolate", ["linear"], crimeExpr(crimeType),
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

function parseCrimeRate(props: Record<string, unknown> | null, type: CrimeType): number | null {
  if (!props) return null;
  try {
    const crime = typeof props.crime === "string" ? JSON.parse(props.crime) : props.crime;
    return (crime as Record<string, number>)?.[type] ?? null;
  } catch {
    return null;
  }
}

interface CountyCrimeLayerProps {
  crimeType: CrimeType;
  overlayOffset?: number;
}

export function CrimeLegend({ crimeType, overlayOffset = 0 }: { crimeType: CrimeType; overlayOffset?: number }) {
  const scale = getScale(crimeType);
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {CRIME_LABELS[crimeType]} Rate per 100K (2023)
      </div>
      <div className="flex">
        {scale.stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CountyCrimeLayer({ crimeType, overlayOffset = 0 }: CountyCrimeLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, FILL_LAYER_ID);

  const activeRate = parseCrimeRate(activeProperties, crimeType);

  const fillLayer: FillLayerSpecification = {
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": buildFillColor(crimeType),
      "fill-opacity": ["case", isHighlighted(), 0.9, 0.7],
    },
  };

  const lineLayer: LineLayerSpecification = {
    id: "county-crime-borders",
    type: "line",
    source: SOURCE_ID,
    paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.8 },
  };

  const highlightLineLayer: LineLayerSpecification = {
    id: "county-crime-borders-highlight",
    type: "line",
    source: SOURCE_ID,
    paint: {
      "line-color": ["case", isHighlighted(), "#7f1d1d", "transparent"],
      "line-width": ["case", isHighlighted(), 3, 0],
      "line-opacity": 1,
    },
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "county-crime-labels",
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
        <Layer {...labelLayer} id="county-crime-labels-dim" filter={labelDimFilter} />
        <Layer
          {...labelLayer}
          id="county-crime-labels-highlight"
          filter={labelHighlightFilter}
          paint={{
            ...labelLayer.paint,
            "text-color": "#0f172a",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
          }}
        />
      </Source>

      {activeName && activeRate !== null && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="text-sm font-semibold text-gray-800">
            {activeName} County
          </div>
          <div className="text-sm text-gray-600">
            {CRIME_LABELS[crimeType]}: {activeRate.toFixed(1)} per 100K
          </div>
        </div>
      )}
    </>
  );
}
