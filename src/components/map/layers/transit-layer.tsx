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

export type TransitSystem = "bart";

export const TRANSIT_SYSTEMS: {
  id: TransitSystem;
  label: string;
}[] = [
  { id: "bart", label: "BART" },
];

// Line colors + labels for per-line toggle UI
export const BART_LINES: { color: string; label: string }[] = [
  { color: "#FF0000", label: "Red" },
  { color: "#FF9933", label: "Orange" },
  { color: "#FFFF33", label: "Yellow" },
  { color: "#339933", label: "Green" },
  { color: "#0099CC", label: "Blue" },
  { color: "#B0BEC7", label: "Gray" },
];

// ── Constants ──

function routesUrl(system: TransitSystem) {
  return `${import.meta.env.BASE_URL}data/transit/${system}-routes.geojson`;
}

function stopsUrl(system: TransitSystem) {
  return `${import.meta.env.BASE_URL}data/transit/${system}-stops.geojson`;
}

const ROUTES_SOURCE = "transit-routes";
const STOPS_SOURCE = "transit-stops";
const ROUTES_LAYER = "transit-routes-line";
const STOPS_FILL_LAYER = "transit-stops-circle";
const STOPS_LABEL_LAYER = "transit-stops-label";
const STOPS_HIGHLIGHT_LAYER = "transit-stops-highlight";

// ── Layer specs ──

// Dark outline underneath each colored line (BART map style)
const routesCasingLayer: LineLayerSpecification = {
  id: ROUTES_LAYER + "-casing",
  type: "line",
  source: ROUTES_SOURCE,
  paint: {
    "line-color": "#1a1a1a",
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4.5, 13, 6] as unknown as number,
    "line-opacity": 0.8,
  },
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
};

const routesLayer: LineLayerSpecification = {
  id: ROUTES_LAYER,
  type: "line",
  source: ROUTES_SOURCE,
  paint: {
    "line-color": ["get", "color"],
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 13, 4] as unknown as number,
    "line-opacity": 1,
  },
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
};

// Station circles — white fill, dark outline, uniform size
const stopsLayer: CircleLayerSpecification = {
  id: STOPS_FILL_LAYER,
  type: "circle",
  source: STOPS_SOURCE,
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

const stopsLabelLayer: SymbolLayerSpecification = {
  id: STOPS_LABEL_LAYER,
  type: "symbol",
  source: STOPS_SOURCE,
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

// ── Component ──

interface TransitLayerProps {
  systems: TransitSystem[];
  selectedStopName?: string | null;
  flyToSelected?: boolean;
  onSelectStop?: (name: string) => void;
  onDeselectStop?: () => void;
  overlayOffset?: number;
  activeRouteColors?: string[] | null; // null = show all
}

export default function TransitLayer({
  systems,
  selectedStopName = null,
  flyToSelected = false,
  onSelectStop,
  onDeselectStop,
  overlayOffset = 0,
  activeRouteColors = null,
}: TransitLayerProps) {
  const { current: map } = useMap();
  const [hoverStop, setHoverStop] = useState<{ name: string; colors: string[]; system: string } | null>(null);
  const [selectedStopInfo, setSelectedStopInfo] = useState<{ name: string; colors: string[]; system: string } | null>(null);

  // For now, single system — will extend later
  const system = systems[0] as TransitSystem | undefined;

  const routesData = useMemo(() => (system ? routesUrl(system) : undefined), [system]);
  const stopsData = useMemo(() => (system ? stopsUrl(system) : undefined), [system]);

  // Route filter: show only lines whose color is in the active set
  const routeFilter = useMemo(
    () =>
      activeRouteColors
        ? (["in", ["get", "color"], ["literal", activeRouteColors]] as LineLayerSpecification["filter"])
        : undefined,
    [activeRouteColors],
  );

  // Stop filter: show only stops served by at least one active line
  const stopFilter = useMemo(() => {
    if (!activeRouteColors) return undefined;
    // colors is stored as a JSON array string; substring match on each active color
    return [
      "any",
      ...activeRouteColors.map((c) => ["in", c, ["to-string", ["get", "colors"]]]),
    ] as LineLayerSpecification["filter"];
  }, [activeRouteColors]);

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

  // Selected station: inverted colors (black fill, white border)
  const highlightLayer: CircleLayerSpecification = useMemo(
    () => ({
      id: STOPS_HIGHLIGHT_LAYER,
      type: "circle",
      source: STOPS_SOURCE,
      minzoom: 6,
      filter: highlightFilter,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1, 8, 3, 12, 6, 15, 10] as unknown as number,
        "circle-color": "#1a1a1a",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 12, 2.5] as unknown as number,
        "circle-opacity": 1,
      },
    }),
    [highlightFilter],
  );

  // Populate tooltip info (always) and fly to stop (only from search)
  useEffect(() => {
    if (!selectedStopName || !map || !stopsData) return;
    fetchJsonCached(stopsData).then((geojson: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const feature = geojson.features?.find(
        (f: any) => f.properties?.name === selectedStopName, // eslint-disable-line @typescript-eslint/no-explicit-any
      );
      if (!feature || feature.geometry.type !== "Point") return;
      const colors = feature.properties.colors || [];
      const sys = feature.properties.system || "";
      setSelectedStopInfo({ name: selectedStopName, colors, system: sys });
      if (flyToSelected) {
        const [lng, lat] = feature.geometry.coordinates;
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
      }
    }).catch(() => {});
  }, [selectedStopName, map, stopsData, flyToSelected]);

  // Hover interaction
  const onMouseMove = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: [STOPS_FILL_LAYER],
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
    [],
  );

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const features = e.target.queryRenderedFeatures(e.point, {
        layers: [STOPS_FILL_LAYER],
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
    [onSelectStop, onDeselectStop, selectedStopName],
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

  if (!system || !routesData || !stopsData) return null;

  const displayStop = hoverStop || selectedStopInfo;

  return (
    <>
      <Source id={ROUTES_SOURCE} type="geojson" data={routesData}>
        <Layer {...routesCasingLayer} {...(routeFilter ? { filter: routeFilter } : {})} />
        <Layer {...routesLayer} {...(routeFilter ? { filter: routeFilter } : {})} />
      </Source>
      <Source id={STOPS_SOURCE} type="geojson" data={stopsData}>
        <Layer {...stopsLayer} {...(stopFilter ? { filter: stopFilter } : {})} />
        <Layer {...highlightLayer} />
        <Layer {...stopsLabelLayer} {...(stopFilter ? { filter: stopFilter } : {})} />
      </Source>

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
