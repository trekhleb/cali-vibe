import { useEffect, useRef, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { MapMouseEvent } from "maplibre-gl";
import { fetchJsonCached } from "@/utils/fetch-json";

interface UseMapInteractionOptions {
  selectName?: string | null;
  geojsonUrl?: string;
  flyToMaxZoom?: number;
}

interface UseMapInteractionResult {
  activeName: string | null;
  activeProperties: Record<string, unknown> | null;
}

export function useMapInteraction(
  sourceId: string,
  fillLayerId: string,
  options: UseMapInteractionOptions = {},
): UseMapInteractionResult {
  const { selectName = null, geojsonUrl, flyToMaxZoom = 11 } = options;
  const { current: mapRef } = useMap();
  const hoveredIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [hoveredProps, setHoveredProps] = useState<Record<string, unknown> | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedProps, setSelectedProps] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    function onMouseMove(e: MapMouseEvent) {
      const features = map!.queryRenderedFeatures(e.point, { layers: [fillLayerId] });

      if (hoveredIdRef.current !== null) {
        map!.setFeatureState({ source: sourceId, id: hoveredIdRef.current }, { hover: false });
      }

      if (features.length > 0 && features[0].id !== undefined) {
        const id = features[0].id as number;
        map!.setFeatureState({ source: sourceId, id }, { hover: true });
        hoveredIdRef.current = id;
        setHoveredName(features[0].properties?.name ?? null);
        setHoveredProps(features[0].properties ?? null);
        map!.getCanvas().style.cursor = "pointer";
      } else {
        hoveredIdRef.current = null;
        setHoveredName(null);
        setHoveredProps(null);
        map!.getCanvas().style.cursor = "";
      }
    }

    function onMouseLeave() {
      if (hoveredIdRef.current !== null) {
        map!.setFeatureState({ source: sourceId, id: hoveredIdRef.current }, { hover: false });
        hoveredIdRef.current = null;
      }
      setHoveredName(null);
      setHoveredProps(null);
      map!.getCanvas().style.cursor = "";
    }

    function onClick(e: MapMouseEvent) {
      const features = map!.queryRenderedFeatures(e.point, { layers: [fillLayerId] });

      if (features.length > 0 && features[0].id !== undefined) {
        const id = features[0].id as number;
        const name = features[0].properties?.name ?? null;
        const props = features[0].properties ?? null;

        if (selectedIdRef.current === id) {
          map!.setFeatureState({ source: sourceId, id }, { selected: false });
          selectedIdRef.current = null;
          setSelectedName(null);
          setSelectedProps(null);
        } else {
          if (selectedIdRef.current !== null) {
            map!.setFeatureState({ source: sourceId, id: selectedIdRef.current }, { selected: false });
          }
          map!.setFeatureState({ source: sourceId, id }, { selected: true });
          selectedIdRef.current = id;
          setSelectedName(name);
          setSelectedProps(props);
        }
      }
    }

    map.on("mousemove", fillLayerId, onMouseMove);
    map.on("mouseleave", fillLayerId, onMouseLeave);
    map.on("click", fillLayerId, onClick);

    return () => {
      map.off("mousemove", fillLayerId, onMouseMove);
      map.off("mouseleave", fillLayerId, onMouseLeave);
      map.off("click", fillLayerId, onClick);
      try {
        if (hoveredIdRef.current !== null) {
          map.setFeatureState({ source: sourceId, id: hoveredIdRef.current }, { hover: false });
        }
        if (selectedIdRef.current !== null) {
          map.setFeatureState({ source: sourceId, id: selectedIdRef.current }, { selected: false });
        }
        map.getCanvas().style.cursor = "";
      } catch { /* map may already be disposed */ }
    };
  }, [mapRef, sourceId, fillLayerId]);

  // Programmatic selection (fly to feature by name)
  useEffect(() => {
    if (!selectName || !geojsonUrl) return;
    const map = mapRef?.getMap();
    if (!map) return;

    let cancelled = false;

    Promise.all([
      fetchJsonCached(geojsonUrl),
      import("maplibre-gl"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]).then(([geojson, { LngLatBounds }]: [any, any]) => {
      if (cancelled) return;
      const bounds = new LngLatBounds();
      for (const feature of geojson.features) {
        if (feature.properties?.name !== selectName) continue;
        const geom = feature.geometry;
        if (geom.type === "Polygon") {
          for (const ring of geom.coordinates) {
            for (const coord of ring) bounds.extend(coord as [number, number]);
          }
        } else if (geom.type === "MultiPolygon") {
          for (const polygon of geom.coordinates) {
            for (const ring of polygon) {
              for (const coord of ring) bounds.extend(coord as [number, number]);
            }
          }
        }
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 120, animate: true, maxZoom: flyToMaxZoom });
      }
    });

    let selected = false;

    function trySelect() {
      if (selected || cancelled) return;
      const features = map!.querySourceFeatures(sourceId, {
        filter: ["==", ["get", "name"], selectName],
      });
      if (features.length > 0 && features[0].id !== undefined) {
        const id = features[0].id as number;
        if (selectedIdRef.current !== null) {
          map!.setFeatureState({ source: sourceId, id: selectedIdRef.current }, { selected: false });
        }
        map!.setFeatureState({ source: sourceId, id }, { selected: true });
        selectedIdRef.current = id;
        setSelectedName(selectName);
        selected = true;
        cleanup();
      }
    }

    function onSourceData() { trySelect(); }
    function onIdle() { trySelect(); }

    function cleanup() {
      map!.off("sourcedata", onSourceData);
      map!.off("idle", onIdle);
    }

    trySelect();
    if (!selected) {
      map.on("sourcedata", onSourceData);
      map.on("idle", onIdle);
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [mapRef, sourceId, selectName, geojsonUrl, flyToMaxZoom]);

  const activeName = selectedName ?? hoveredName;
  const activeProperties = selectedName ? selectedProps : hoveredProps;

  return { activeName, activeProperties };
}
