import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { FillLayerSpecification, LineLayerSpecification } from "maplibre-gl";
import { fetchJsonCached } from "@/utils/fetch-json";
import type { PlaceType } from "@/utils/place-slugs";
import "maplibre-gl/dist/maplibre-gl.css";

const BOUNDARY_URLS: Record<PlaceType, string> = {
  county: `${import.meta.env.BASE_URL}data/california-counties.geojson`,
  city: `${import.meta.env.BASE_URL}data/california-cities.geojson`,
};

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const FILL_LAYER: FillLayerSpecification = {
  id: "mini-map-fill",
  type: "fill",
  source: "place-boundary",
  paint: {
    "fill-color": "#3b82f6",
    "fill-opacity": 0.15,
  },
};

const LINE_LAYER: LineLayerSpecification = {
  id: "mini-map-line",
  type: "line",
  source: "place-boundary",
  paint: {
    "line-color": "#3b82f6",
    "line-width": 2,
    "line-opacity": 0.8,
  },
};

interface PlaceMiniMapProps {
  placeType: PlaceType;
  placeName: string;
}

export default function PlaceMiniMap({ placeType, placeName }: PlaceMiniMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

  // Load and filter GeoJSON to just this place
  useEffect(() => {
    fetchJsonCached(BOUNDARY_URLS[placeType]).then((data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const feature = data.features.find(
        (f: any) => f.properties?.name === placeName // eslint-disable-line @typescript-eslint/no-explicit-any
      );
      if (feature) {
        setGeojson({ type: "FeatureCollection", features: [feature] });
      }
    }).catch(() => { /* silently fail — map just won't show */ });
  }, [placeType, placeName]);

  // Fit bounds when geojson or map is ready
  const fitToPlace = useCallback(() => {
    const map = mapRef.current;
    if (!map || !geojson?.features[0]) return;

    const geom = geojson.features[0].geometry;
    const coords: [number, number][] = [];

    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) {
        for (const coord of ring) coords.push(coord as [number, number]);
      }
    } else if (geom.type === "MultiPolygon") {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          for (const coord of ring) coords.push(coord as [number, number]);
        }
      }
    }

    if (coords.length === 0) return;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 30, animate: false, maxZoom: 13 },
    );
  }, [geojson]);

  const handleLoad = useCallback(() => { fitToPlace(); }, [fitToPlace]);

  // Re-fit when geojson changes (place switch)
  useEffect(() => { fitToPlace(); }, [fitToPlace]);

  // Center for initial render (approximate California center, will be overridden by fitBounds)
  const initialViewState = useMemo(() => ({
    longitude: -119.5,
    latitude: 37.0,
    zoom: 5,
  }), []);

  return (
    <div className="w-full h-44 sm:h-52 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE}
        onLoad={handleLoad}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {geojson && (
          <Source id="place-boundary" type="geojson" data={geojson}>
            <Layer {...FILL_LAYER} />
            <Layer {...LINE_LAYER} />
          </Source>
        )}
      </Map>
    </div>
  );
}
