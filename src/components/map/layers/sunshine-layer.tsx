import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  ExpressionSpecification,
  MapMouseEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";

// ── Public types ──

export type HexResolution = 4 | 5;
export type SunshineDataSource = "nsrdb" | "era5";

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Month index 12 = yearly average */
export const ANNUAL_MONTH = 12;

export function monthLabel(month: number): string {
  return month === ANNUAL_MONTH ? "Year" : MONTH_LABELS[month];
}

// ── Constants ──

const SOURCE_ID = "sunshine-hex";
const FILL_LAYER_ID = "sunshine-hex-fill";

function dataUrl(resolution: HexResolution, dataSource: SunshineDataSource) {
  return `${import.meta.env.BASE_URL}data/california-sunshine-${dataSource}-h3-res${resolution}.geojson`;
}

// Sunshine color scale (gray/blue → yellow → orange)
// Values represent average daily sunshine hours (0–14+)
const SUNSHINE_STOPS: [number, string][] = [
  [2, "#4e79a7"],   // overcast blue
  [4, "#76b7b2"],   // teal
  [6, "#b3cde3"],   // pale blue
  [7, "#edc949"],   // yellow
  [8, "#f1c232"],   // golden yellow
  [9, "#f6b26b"],   // light orange
  [10, "#e69138"],  // orange
  [11, "#e06666"],  // salmon
  [12, "#cc4125"],  // red-orange
  [14, "#a61c00"],  // dark red
];

function formatHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

// ── Build MapLibre expressions ──

function buildFillColor(month: number): ExpressionSpecification {
  let valueExpr: ExpressionSpecification;

  if (month === ANNUAL_MONTH) {
    // Average all 12 months: (sum of at(0..11)) / 12
    const sumParts: ExpressionSpecification[] = [];
    for (let i = 0; i < 12; i++) {
      sumParts.push(["at", i, ["get", "sunshine"]] as ExpressionSpecification);
    }
    valueExpr = [
      "/",
      ["+", ...sumParts],
      12,
    ] as ExpressionSpecification;
  } else {
    valueExpr = [
      "at", month, ["get", "sunshine"],
    ] as ExpressionSpecification;
  }

  const pairs: (string | number)[] = [];
  for (const [hours, color] of SUNSHINE_STOPS) {
    pairs.push(hours, color);
  }

  return [
    "interpolate", ["linear"], valueExpr,
    ...pairs,
  ] as ExpressionSpecification;
}

// ── Tooltip ──

interface HexTooltipInfo {
  lat: number;
  lng: number;
  sunshine: number[];
}

function parseTooltipInfo(feature: MapGeoJSONFeature): HexTooltipInfo | null {
  const props = feature.properties;
  if (!props) return null;
  try {
    const sunshine = typeof props.sunshine === "string" ? JSON.parse(props.sunshine) : props.sunshine;
    if (!sunshine) return null;

    const geometry = feature.geometry;
    let lat = 0, lng = 0;
    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates[0];
      for (const [x, y] of coords) { lng += x; lat += y; }
      lat /= coords.length;
      lng /= coords.length;
    }

    return { lat, lng, sunshine };
  } catch {
    return null;
  }
}

// ── Components ──

interface SunshineLayerProps {
  month: number; // 0-11 or ANNUAL_MONTH (12)
  resolution: HexResolution;
  dataSource?: SunshineDataSource;
  selectedH3?: string | null;
  onSelectHex?: (h3: string) => void;
  onDeselectHex?: () => void;
  overlayOffset?: number;
}

export function SunshineLegend({
  month,
  dataSource = "nsrdb",
  overlayOffset = 0,
}: {
  month: number;
  dataSource?: SunshineDataSource;
  overlayOffset?: number;
}) {
  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        Daily Sunshine — {monthLabel(month)} (hours/day)
      </div>
      <div className="flex">
        {SUNSHINE_STOPS.map((stop, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: stop[1] }} />
            <span className="mt-0.5 text-[9px] text-gray-500">
              {stop[0]}h
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[9px] text-gray-400">
        {dataSource === "nsrdb" ? "NSRDB satellite · GOES TMY" : "ERA5 reanalysis · 2014–2023 avg"}
      </div>
    </div>
  );
}

export default function SunshineLayer({
  month,
  resolution,
  dataSource = "nsrdb",
  selectedH3 = null,
  onSelectHex,
  onDeselectHex,
  overlayOffset = 0,
}: SunshineLayerProps) {
  const { current: map } = useMap();
  const [hoverInfo, setHoverInfo] = useState<HexTooltipInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<HexTooltipInfo | null>(null);
  const selectedViaMapClick = useRef(false);

  const url = useMemo(() => dataUrl(resolution, dataSource), [resolution, dataSource]);

  const fillLayer: FillLayerSpecification = useMemo(
    () => ({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": buildFillColor(month),
        "fill-opacity": 0.65,
      },
    }),
    [month],
  );

  const lineLayer: LineLayerSpecification = useMemo(
    () => ({
      id: "sunshine-hex-line",
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.5,
        "line-opacity": 0.5,
      },
    }),
    [],
  );

  const selectedLineLayer: LineLayerSpecification = useMemo(
    () => ({
      id: "sunshine-hex-selected",
      type: "line",
      source: SOURCE_ID,
      filter: selectedH3
        ? ["==", ["get", "h3"], selectedH3]
        : ["==", ["get", "h3"], ""],
      paint: {
        "line-color": "#000000",
        "line-width": 3,
        "line-opacity": 1,
      },
    }),
    [selectedH3],
  );

  // Fly to selected hex (only for table-driven selection, not map clicks)
  useEffect(() => {
    if (!selectedH3 || !map) {
      if (!selectedH3) setSelectedInfo(null);
      return;
    }
    if (selectedViaMapClick.current) {
      selectedViaMapClick.current = false;
      return;
    }
    const tryFly = () => {
      const features = map.querySourceFeatures(SOURCE_ID, {
        filter: ["==", ["get", "h3"], selectedH3],
      });
      if (features.length > 0 && features[0].geometry.type === "Polygon") {
        const coords = features[0].geometry.coordinates[0];
        let lat = 0, lng = 0;
        for (const [x, y] of coords) { lng += x; lat += y; }
        lat /= coords.length;
        lng /= coords.length;
        map.flyTo({ center: [lng, lat], zoom: resolution === 4 ? 7 : 8, duration: 1000 });
        setSelectedInfo(parseTooltipInfo(features[0] as MapGeoJSONFeature));
      }
    };
    tryFly();
    const onIdle = () => tryFly();
    map.once("idle", onIdle);
    return () => { map.off("idle", onIdle); };
  }, [selectedH3, map, resolution]);

  // Hover interaction
  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      if (features.length > 0) {
        e.target.getCanvas().style.cursor = "pointer";
        setHoverInfo(parseTooltipInfo(features[0]));
      } else {
        e.target.getCanvas().style.cursor = "";
        setHoverInfo(null);
      }
    },
    [],
  );

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      if (features.length > 0) {
        const h3 = features[0].properties?.h3;
        if (h3 && h3 !== selectedH3) {
          selectedViaMapClick.current = true;
          onSelectHex?.(h3);
          setSelectedInfo(parseTooltipInfo(features[0]));
        } else {
          onDeselectHex?.();
          setSelectedInfo(null);
        }
      } else {
        onDeselectHex?.();
        setSelectedInfo(null);
      }
    },
    [onSelectHex, onDeselectHex, selectedH3],
  );

  useEffect(() => {
    if (!map) return;
    map.on("mousemove", onMouseMove);
    map.on("mouseleave", FILL_LAYER_ID, onMouseLeave);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("mouseleave", FILL_LAYER_ID, onMouseLeave);
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, onMouseMove, onMouseLeave, onClick]);

  const displayInfo = hoverInfo ?? selectedInfo;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={url}>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...selectedLineLayer} />
      </Source>

      {displayInfo && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="text-xs text-gray-500">
            {displayInfo.lat.toFixed(2)}°N, {Math.abs(displayInfo.lng).toFixed(2)}°W
          </div>
          <div className="mt-1 space-y-0.5 text-sm">
            {month === ANNUAL_MONTH ? (
              <div className="font-semibold text-gray-900">
                Annual avg: {formatHours(displayInfo.sunshine.reduce((s, v) => s + v, 0) / 12)}
              </div>
            ) : (
              <>
                <div className="font-semibold text-gray-900">
                  {MONTH_LABELS[month]}: {formatHours(displayInfo.sunshine[month])}
                </div>
                <div className="text-gray-600">
                  Annual avg: {formatHours(displayInfo.sunshine.reduce((s, v) => s + v, 0) / 12)}
                </div>
              </>
            )}
          </div>
          <div className="mt-1 text-[10px] text-gray-400">{monthLabel(month)} avg sunshine/day</div>
        </div>
      )}
    </>
  );
}
