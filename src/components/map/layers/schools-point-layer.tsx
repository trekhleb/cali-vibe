import { Source, Layer } from "react-map-gl/maplibre";
import type {
  CircleLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import { useMapInteraction } from "@/hooks/use-map-interaction";

const SOURCE_ID = "school-points";
const CIRCLE_LAYER_ID = "school-points-circle";
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/california-schools.geojson`;

export type SchoolPointColor = "rating" | "ela" | "math";
export type SchoolLevelFilter = "all" | "Elementary" | "Middle" | "High";

export const SCHOOL_POINT_COLOR_LABELS: Record<SchoolPointColor, string> = {
  rating: "Dashboard Rating",
  ela: "ELA Score",
  math: "Math Score",
};

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevelFilter, string> = {
  all: "All Levels",
  Elementary: "Elementary",
  Middle: "Middle",
  High: "High",
};

// Dashboard 5-color system: Blue (5), Green (4), Yellow (3), Orange (2), Red (1)
const RATING_COLORS: [number, string][] = [
  [1, "#ef4444"], // Red
  [2, "#f97316"], // Orange
  [3, "#eab308"], // Yellow
  [4, "#22c55e"], // Green
  [5, "#3b82f6"], // Blue
];

function buildCircleColor(colorBy: SchoolPointColor): ExpressionSpecification {
  if (colorBy === "rating") {
    return [
      "case",
      ["==", ["get", "rating"], null], "#9ca3af",
      ["match", ["get", "rating"],
        1, "#ef4444",
        2, "#f97316",
        3, "#eab308",
        4, "#22c55e",
        5, "#3b82f6",
        "#9ca3af",
      ],
    ] as ExpressionSpecification;
  }
  // ELA or Math — DFS color scale
  const prop = colorBy === "ela" ? "ela" : "math";
  return [
    "case",
    ["==", ["get", prop], null], "#9ca3af",
    ["interpolate", ["linear"], ["get", prop],
      -100, "#ef4444", -50, "#f97316", -10, "#eab308",
      10, "#22c55e", 50, "#3b82f6",
    ],
  ] as ExpressionSpecification;
}

function isHighlighted(): ExpressionSpecification {
  return [
    "any",
    ["boolean", ["feature-state", "hover"], false],
    ["boolean", ["feature-state", "selected"], false],
  ] as ExpressionSpecification;
}

export function SchoolPointsLegend({ colorBy, overlayOffset = 0 }: { colorBy: SchoolPointColor; overlayOffset?: number }) {
  if (colorBy === "rating") {
    return (
      <div
        className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
        style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
      >
        <div className="mb-1 text-xs font-medium text-gray-700">
          Dashboard Rating (CDE 2025)
        </div>
        <div className="flex gap-1.5">
          {RATING_COLORS.map(([rating, color]) => (
            <div key={rating} className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-gray-500">{rating}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const label = colorBy === "ela" ? "ELA Dist. from Std." : "Math Dist. from Std.";
  const stops: [number, string][] = [[-100, "#ef4444"], [-50, "#f97316"], [-10, "#eab308"], [10, "#22c55e"], [50, "#3b82f6"]];
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">{label} (CDE 2025)</div>
      <div className="flex">
        {stops.map(([val, color], i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">{val >= 0 ? `+${val}` : val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SchoolsPointLayerProps {
  colorBy?: SchoolPointColor;
  levelFilter?: SchoolLevelFilter;
  overlayOffset?: number;
}

export default function SchoolsPointLayer({
  colorBy = "rating",
  levelFilter = "all",
  overlayOffset = 0,
}: SchoolsPointLayerProps) {
  const { activeName, activeProperties } = useMapInteraction(SOURCE_ID, CIRCLE_LAYER_ID, {
    geojsonUrl: GEOJSON_URL,
    flyToMaxZoom: 15,
  });

  const circleLayer: CircleLayerSpecification = {
    id: CIRCLE_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    minzoom: 1,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 4, 1.5, 9, 2, 12, 4, 15, 8],
      "circle-color": buildCircleColor(colorBy),
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0, 4, 0.1, 9, 0.3, 12, 1],
      "circle-opacity": ["case", isHighlighted(), 1, 0.8],
    },
    ...(levelFilter !== "all" ? { filter: ["==", ["get", "level"], levelFilter] } : {}),
  };

  const labelLayer: SymbolLayerSpecification = {
    id: "school-points-labels",
    type: "symbol",
    source: SOURCE_ID,
    minzoom: 13,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 12],
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-max-width": 10,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#374151",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": 1,
    },
    ...(levelFilter !== "all" ? { filter: ["==", ["get", "level"], levelFilter] } : {}),
  };

  const ela = activeProperties?.ela as number | null;
  const math = activeProperties?.math as number | null;
  const grad = activeProperties?.graduationRate as number | null;
  const level = activeProperties?.level as string | null;
  const charter = activeProperties?.charter as boolean | null;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={GEOJSON_URL} generateId>
        <Layer {...circleLayer} />
        <Layer {...labelLayer} />
      </Source>

      {activeName && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="text-sm font-semibold text-gray-800">{activeName}</div>
          <div className="text-xs text-gray-500">
            {level}{charter ? " (Charter)" : ""}
          </div>
          {ela != null && (
            <div className="text-sm text-gray-600">ELA: {ela >= 0 ? `+${ela.toFixed(1)}` : ela.toFixed(1)}</div>
          )}
          {math != null && (
            <div className="text-sm text-gray-600">Math: {math >= 0 ? `+${math.toFixed(1)}` : math.toFixed(1)}</div>
          )}
          {grad != null && (
            <div className="text-sm text-gray-600">Graduation: {grad.toFixed(1)}%</div>
          )}
        </div>
      )}
    </>
  );
}
