import { useMemo, useState, useCallback, useEffect } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
  ExpressionSpecification,
  MapMouseEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";

// ── Public types ──

export type TempMetric = "tavg" | "tmax" | "tmin";
export type TempUnit = "F" | "C";
export type HexResolution = 4 | 5;

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const METRIC_LABELS: Record<TempMetric, string> = {
  tmax: "Day High",
  tmin: "Night Low",
  tavg: "Average",
};

// ── Constants ──

const SOURCE_ID = "temperature-hex";
const FILL_LAYER_ID = "temperature-hex-fill";

function dataUrl(resolution: HexResolution) {
  return `${import.meta.env.BASE_URL}data/california-temperature-h3-res${resolution}.geojson`;
}

// Temperature color scale (blue → yellow → red)
const TEMP_STOPS_C: [number, string][] = [
  [-5, "#313695"],   // deep blue
  [0, "#4575b4"],    // blue
  [5, "#74add1"],    // light blue
  [10, "#abd9e9"],   // pale blue
  [15, "#e0f3f8"],   // very pale blue
  [20, "#fee090"],   // pale yellow
  [25, "#fdae61"],   // orange
  [30, "#f46d43"],   // red-orange
  [35, "#d73027"],   // red
  [40, "#a50026"],   // dark red
];

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

function formatTemp(c: number, unit: TempUnit): string {
  const val = unit === "F" ? cToF(c) : c;
  return `${Math.round(val)}°${unit}`;
}

// ── Build MapLibre expressions ──

function buildFillColor(metric: TempMetric, month: number): ExpressionSpecification {
  // The property is an array like [12.5, 14.2, ...], index by month
  const valueExpr: ExpressionSpecification = [
    "at", month, ["get", metric],
  ] as ExpressionSpecification;

  const pairs: (string | number)[] = [];
  for (const [temp, color] of TEMP_STOPS_C) {
    pairs.push(temp, color);
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
  tmin: number[];
  tmax: number[];
  tavg: number[];
}

function parseTooltipInfo(feature: MapGeoJSONFeature): HexTooltipInfo | null {
  const props = feature.properties;
  if (!props) return null;
  try {
    const tmin = typeof props.tmin === "string" ? JSON.parse(props.tmin) : props.tmin;
    const tmax = typeof props.tmax === "string" ? JSON.parse(props.tmax) : props.tmax;
    const tavg = typeof props.tavg === "string" ? JSON.parse(props.tavg) : props.tavg;
    if (!tmin || !tmax || !tavg) return null;

    // Get center from h3 cell or approximate from geometry
    const geometry = feature.geometry;
    let lat = 0, lng = 0;
    if (geometry.type === "Polygon") {
      const coords = geometry.coordinates[0];
      for (const [x, y] of coords) { lng += x; lat += y; }
      lat /= coords.length;
      lng /= coords.length;
    }

    return { lat, lng, tmin, tmax, tavg };
  } catch {
    return null;
  }
}

// ── Components ──

interface TemperatureLayerProps {
  metric: TempMetric;
  month: number; // 0-11
  unit: TempUnit;
  resolution: HexResolution;
  selectedH3?: string | null;
  onDeselectHex?: () => void;
  overlayOffset?: number;
}

export function TemperatureLegend({
  metric,
  month,
  unit,
  overlayOffset = 0,
}: {
  metric: TempMetric;
  month: number;
  unit: TempUnit;
  overlayOffset?: number;
}) {
  const stops = TEMP_STOPS_C.map(([c, color]) => ({
    value: unit === "F" ? cToF(c) : c,
    color,
  }));

  return (
    <div
      className="absolute bottom-16 md:bottom-12 rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 md:left-6"
      style={overlayOffset ? { left: overlayOffset + 24 } : undefined}
    >
      <div className="mb-1 text-xs font-medium text-gray-700">
        {METRIC_LABELS[metric]} — {MONTH_LABELS[month]} (°{unit})
      </div>
      <div className="flex">
        {stops.map((stop, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-3 w-8" style={{ backgroundColor: stop.color }} />
            <span className="mt-0.5 text-[9px] text-gray-500">
              {Math.round(stop.value)}°
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[9px] text-gray-400">
        ERA5 reanalysis · 2014–2023 avg
      </div>
    </div>
  );
}

export default function TemperatureLayer({
  metric,
  month,
  unit,
  resolution,
  selectedH3 = null,
  onDeselectHex,
  overlayOffset = 0,
}: TemperatureLayerProps) {
  const { current: map } = useMap();
  const [hoverInfo, setHoverInfo] = useState<HexTooltipInfo | null>(null);

  const url = useMemo(() => dataUrl(resolution), [resolution]);

  const fillLayer: FillLayerSpecification = useMemo(
    () => ({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": buildFillColor(metric, month),
        "fill-opacity": 0.65,
      },
    }),
    [metric, month],
  );

  const lineLayer: LineLayerSpecification = useMemo(
    () => ({
      id: "temperature-hex-line",
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
      id: "temperature-hex-selected",
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

  // Fly to selected hex
  useEffect(() => {
    if (!selectedH3 || !map) return;
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
      }
    };
    tryFly();
    // Source may not be loaded yet
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
      if (!onDeselectHex || !selectedH3) return;
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID],
      });
      if (features.length === 0) {
        onDeselectHex();
      }
    },
    [onDeselectHex, selectedH3],
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

  const tooltipValues = hoverInfo
    ? {
      tmax: hoverInfo.tmax[month],
      tmin: hoverInfo.tmin[month],
      tavg: hoverInfo.tavg[month],
    }
    : null;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={url}>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
        <Layer {...selectedLineLayer} />
      </Source>

      {hoverInfo && tooltipValues && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="text-xs text-gray-500">
            {hoverInfo.lat.toFixed(2)}°N, {Math.abs(hoverInfo.lng).toFixed(2)}°W
          </div>
          <div className="mt-1 space-y-0.5 text-sm">
            <div className={`${metric === "tmax" ? "font-semibold text-gray-900" : "text-gray-600"}`}>
              Day High: {formatTemp(tooltipValues.tmax, unit)}
            </div>
            <div className={`${metric === "tmin" ? "font-semibold text-gray-900" : "text-gray-600"}`}>
              Night Low: {formatTemp(tooltipValues.tmin, unit)}
            </div>
            <div className={`${metric === "tavg" ? "font-semibold text-gray-900" : "text-gray-600"}`}>
              Average: {formatTemp(tooltipValues.tavg, unit)}
            </div>
          </div>
          <div className="mt-1 text-[10px] text-gray-400">{MONTH_LABELS[month]} avg</div>
        </div>
      )}
    </>
  );
}
