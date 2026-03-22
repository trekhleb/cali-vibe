import { useMemo, useState, useCallback, useEffect } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type {
  LineLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
  MapMouseEvent,
} from "maplibre-gl";
import { fetchJsonCached } from "@/utils/fetch-json";

// ── Public types ──

export type TransitSystem = "bart" | "caltrain" | "lametro" | "smart" | "munimetro" | "vta";

export const TRANSIT_SYSTEMS: {
  id: TransitSystem;
  label: string;
}[] = [
  { id: "bart", label: "BART" },
  { id: "caltrain", label: "Caltrain" },
  { id: "smart", label: "SMART" },
  { id: "munimetro", label: "Muni Metro" },
  { id: "vta", label: "VTA" },
  { id: "lametro", label: "LA Metro" },
];

// Systems enabled by default (Muni Metro is opt-in due to dense overlapping stops)
export const DEFAULT_TRANSIT_SYSTEMS: TransitSystem[] = ["bart", "caltrain", "smart", "vta", "lametro"];

// Line colors + labels for per-line toggle UI
export const BART_LINES: { color: string; label: string }[] = [
  { color: "#FF0000", label: "Red" },
  { color: "#FF9933", label: "Orange" },
  { color: "#FFFF33", label: "Yellow" },
  { color: "#339933", label: "Green" },
  { color: "#0099CC", label: "Blue" },
  { color: "#B0BEC7", label: "Gray" },
];

export const CALTRAIN_LINES: { color: string; label: string }[] = [
  { color: "#808080", label: "Local" },
  { color: "#00A5B8", label: "Limited" },
  { color: "#CE202F", label: "Express" },
  { color: "#E8A317", label: "South County" },
];

export const LAMETRO_LINES: { color: string; label: string }[] = [
  { color: "#0072BC", label: "A Line" },
  { color: "#EB131B", label: "B Line" },
  { color: "#58A738", label: "C Line" },
  { color: "#A05DA5", label: "D Line" },
  { color: "#FDB913", label: "E Line" },
  { color: "#E56DB1", label: "K Line" },
];

export const SMART_LINES: { color: string; label: string }[] = [
  { color: "#2E8B57", label: "Main Line" },
];

export const VTA_LINES: { color: string; label: string }[] = [
  { color: "#007ACC", label: "Blue" },
  { color: "#379400", label: "Green" },
  { color: "#CC6600", label: "Orange" },
];

export const MUNIMETRO_LINES: { color: string; label: string }[] = [
  { color: "#A96614", label: "J-Church" },
  { color: "#437C93", label: "K-Ingleside" },
  { color: "#942D83", label: "L-Taraval" },
  { color: "#008547", label: "M-Ocean View" },
  { color: "#005B95", label: "N-Judah" },
  { color: "#BF2B45", label: "T-Third" },
  { color: "#B49A36", label: "F-Market" },
];

// Per-system active colors: null = show all, string[] = show only these
export type ActiveColorMap = Partial<Record<TransitSystem, string[] | null>>;

// ── Constants ──

function routesUrl(system: TransitSystem) {
  return `${import.meta.env.BASE_URL}data/transit/${system}-routes.geojson`;
}

function stopsUrl(system: TransitSystem) {
  return `${import.meta.env.BASE_URL}data/transit/${system}-stops.geojson`;
}

// Per-system ID helpers
function routesSourceId(system: TransitSystem) { return `transit-${system}-routes`; }
function stopsSourceId(system: TransitSystem) { return `transit-${system}-stops`; }
function routesCasingLayerId(system: TransitSystem) { return `transit-${system}-routes-line-casing`; }
function routesLineLayerId(system: TransitSystem) { return `transit-${system}-routes-line`; }
function stopsCircleLayerId(system: TransitSystem) { return `transit-${system}-stops-circle`; }
function stopsLabelLayerId(system: TransitSystem) { return `transit-${system}-stops-label`; }
function stopsHighlightLayerId(system: TransitSystem) { return `transit-${system}-stops-highlight`; }

// ── Layer spec factories ──

function makeRoutesCasingSpec(system: TransitSystem): LineLayerSpecification {
  return {
    id: routesCasingLayerId(system),
    type: "line",
    source: routesSourceId(system),
    paint: {
      "line-color": "#1a1a1a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4.5, 13, 6] as unknown as number,
      "line-opacity": 0.8,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

function makeRoutesLineSpec(system: TransitSystem): LineLayerSpecification {
  return {
    id: routesLineLayerId(system),
    type: "line",
    source: routesSourceId(system),
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 13, 4] as unknown as number,
      "line-opacity": 1,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

function makeStopsCircleSpec(system: TransitSystem): CircleLayerSpecification {
  return {
    id: stopsCircleLayerId(system),
    type: "circle",
    source: stopsSourceId(system),
    minzoom: 6,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 3, 12, 6, 15, 10] as unknown as number,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#333333",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 8, 1.5, 12, 2.5] as unknown as number,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 6.5, 1] as unknown as number,
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 6.5, 1] as unknown as number,
    },
  };
}

function makeStopsLabelSpec(system: TransitSystem): SymbolLayerSpecification {
  return {
    id: stopsLabelLayerId(system),
    type: "symbol",
    source: stopsSourceId(system),
    minzoom: 6,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13],
      "text-anchor": "left",
      "text-offset": [1.2, 0],
      "text-optional": true,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#1a1a1a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  };
}

function makeStopsHighlightSpec(
  system: TransitSystem,
  filter: LineLayerSpecification["filter"],
): CircleLayerSpecification {
  return {
    id: stopsHighlightLayerId(system),
    type: "circle",
    source: stopsSourceId(system),
    minzoom: 6,
    filter,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 3, 12, 6, 15, 10] as unknown as number,
      "circle-color": "#1a1a1a",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 12, 2.5] as unknown as number,
      "circle-opacity": 1,
    },
  };
}

// ── Filter helpers ──

function makeRouteFilter(colors: string[] | null | undefined): LineLayerSpecification["filter"] | undefined {
  if (!colors) return undefined;
  return ["in", ["get", "color"], ["literal", colors]] as LineLayerSpecification["filter"];
}

function makeStopFilter(colors: string[] | null | undefined): LineLayerSpecification["filter"] | undefined {
  if (!colors) return undefined;
  return [
    "any",
    ...colors.map((c) => ["in", c, ["to-string", ["get", "colors"]]]),
  ] as LineLayerSpecification["filter"];
}

// ── Component ──

interface TransitLayerProps {
  systems: TransitSystem[];
  selectedStopName?: string | null;
  flyToSelected?: boolean;
  onSelectStop?: (name: string) => void;
  onDeselectStop?: () => void;
  overlayOffset?: number;
  activeColorMap?: ActiveColorMap; // per-system color filter
}

export default function TransitLayer({
  systems,
  selectedStopName = null,
  flyToSelected = false,
  onSelectStop,
  onDeselectStop,
  overlayOffset = 0,
  activeColorMap = {},
}: TransitLayerProps) {
  const { current: map } = useMap();
  const [hoverStop, setHoverStop] = useState<{ name: string; colors: string[]; system: string } | null>(null);
  const [selectedStopInfo, setSelectedStopInfo] = useState<{ name: string; colors: string[]; system: string } | null>(null);

  // All stop circle layer IDs (for querying hover/click across systems)
  const allStopLayerIds = useMemo(
    () => systems.map(stopsCircleLayerId),
    [systems],
  );

  // Fit map bounds to all active transit systems when toggles change
  const systemsKey = systems.join(",");
  useEffect(() => {
    if (!map || systems.length === 0) return;
    const urls = systems.map((s) => routesUrl(s));
    Promise.all(urls.map((url) => fetchJsonCached(url).catch(() => null)))
      .then((results) => {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        let hasCoords = false;
        for (const geojson of results) {
          const gj = geojson as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!gj?.features) continue;
          for (const f of gj.features) {
            for (const coord of f.geometry.coordinates) {
              const [lng, lat] = coord;
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
              hasCoords = true;
            }
          }
        }
        if (hasCoords) {
          map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, animate: true, duration: 1000 },
          );
        }
      });
  }, [systemsKey, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selectedStopInfo when parent deselects
  useEffect(() => {
    if (!selectedStopName) setSelectedStopInfo(null);
  }, [selectedStopName]);

  const highlightFilter = useMemo(
    () =>
      selectedStopName
        ? (["==", ["get", "name"], selectedStopName] as LineLayerSpecification["filter"])
        : (["==", ["get", "name"], ""] as LineLayerSpecification["filter"]),
    [selectedStopName],
  );

  // Populate tooltip info (always) and fly to stop (only from search)
  useEffect(() => {
    if (!selectedStopName || !map || systems.length === 0) return;
    const urls = systems.map((s) => stopsUrl(s));
    Promise.all(urls.map((url) => fetchJsonCached(url).catch(() => null)))
      .then((results) => {
        for (const geojson of results) {
          const gj = geojson as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!gj?.features) continue;
          const feature = gj.features.find(
            (f: any) => f.properties?.name === selectedStopName, // eslint-disable-line @typescript-eslint/no-explicit-any
          );
          if (!feature || feature.geometry.type !== "Point") continue;
          const colors = feature.properties.colors || [];
          const sys = feature.properties.system || "";
          setSelectedStopInfo({ name: selectedStopName, colors, system: sys });
          if (flyToSelected) {
            const [lng, lat] = feature.geometry.coordinates;
            map.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
          }
          return; // found — stop searching
        }
      });
  }, [selectedStopName, map, systems, flyToSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hover interaction
  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: allStopLayerIds,
      });
      if (features.length > 0) {
        e.target.getCanvas().style.cursor = "pointer";
        const props = features[0].properties;
        const colors = typeof props?.colors === "string" ? JSON.parse(props.colors) : props?.colors || [];
        setHoverStop({ name: props?.name || "", colors, system: props?.system || "" });
      } else {
        e.target.getCanvas().style.cursor = "";
        setHoverStop(null);
      }
    },
    [allStopLayerIds],
  );

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: allStopLayerIds,
      });
      if (features.length > 0) {
        const props = features[0].properties;
        const name = props?.name;
        if (name && name !== selectedStopName) {
          const colors = typeof props?.colors === "string" ? JSON.parse(props.colors) : props?.colors || [];
          setSelectedStopInfo({ name, colors, system: props?.system || "" });
          onSelectStop?.(name);
        } else {
          setSelectedStopInfo(null);
          onDeselectStop?.();
        }
      } else {
        setSelectedStopInfo(null);
        onDeselectStop?.();
      }
    },
    [onSelectStop, onDeselectStop, selectedStopName, allStopLayerIds],
  );

  useEffect(() => {
    if (!map) return;
    map.on("mousemove", onMouseMove);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMouseMove);
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, onMouseMove, onClick]);

  if (systems.length === 0) return null;

  const displayStop = hoverStop || selectedStopInfo;

  return (
    <>
      {systems.map((sys) => {
        const activeColors = activeColorMap[sys] ?? null;
        const routeFilter = makeRouteFilter(activeColors);
        const stopFilter = makeStopFilter(activeColors);

        return (
          <span key={sys}>
            <Source id={routesSourceId(sys)} type="geojson" data={routesUrl(sys)}>
              <Layer {...makeRoutesCasingSpec(sys)} {...(routeFilter ? { filter: routeFilter } : {})} />
              <Layer {...makeRoutesLineSpec(sys)} {...(routeFilter ? { filter: routeFilter } : {})} />
            </Source>
            <Source id={stopsSourceId(sys)} type="geojson" data={stopsUrl(sys)}>
              <Layer {...makeStopsCircleSpec(sys)} {...(stopFilter ? { filter: stopFilter } : {})} />
              <Layer {...makeStopsHighlightSpec(sys, highlightFilter)} />
              <Layer {...makeStopsLabelSpec(sys)} {...(stopFilter ? { filter: stopFilter } : {})} />
            </Source>
          </span>
        );
      })}

      {displayStop && (
        <div
          className="absolute rounded-lg bg-white/90 px-3 py-2 shadow backdrop-blur-sm transition-all duration-300 left-4 top-24 md:left-6 md:top-28"
          style={overlayOffset ? { left: overlayOffset + 24, top: 24 } : undefined}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {displayStop.colors.map((c, i) => (
                <span
                  key={i}
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-800">{displayStop.name}</span>
            {displayStop.system && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {TRANSIT_SYSTEMS.find(s => s.id === displayStop.system)?.label || displayStop.system}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
