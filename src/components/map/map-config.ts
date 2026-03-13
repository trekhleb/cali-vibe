import type { StyleSpecification } from "maplibre-gl";

export const INITIAL_VIEW_STATE = {
  longitude: -119.5,
  latitude: 37.0,
  zoom: 5.5,
  pitch: 0,
} as const;

export type MapStyleId = "liberty" | "light" | "dark" | "satellite";

function rasterStyle(
  tiles: string[],
  attribution: string,
  paint?: Record<string, unknown>,
): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: { type: "raster", tiles, tileSize: 256, attribution },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap", ...(paint && { paint }) }],
  };
}

export const MAP_STYLES: Record<MapStyleId, { label: string; style: string | StyleSpecification }> = {
  liberty: {
    label: "Streets",
    style: "https://tiles.openfreemap.org/styles/liberty",
  },
  light: {
    label: "Light",
    style: "https://tiles.openfreemap.org/styles/positron",
  },
  dark: {
    label: "Dark",
    style: rasterStyle(
      ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
      "&copy; OpenStreetMap contributors &copy; CARTO",
    ),
  },
  satellite: {
    label: "Satellite",
    style: rasterStyle(
      ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      "&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    ),
  },
};

export const TERRAIN_SOURCE = {
  id: "terrain-dem",
  type: "raster-dem" as const,
  tiles: [
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  ],
  tileSize: 256,
  encoding: "terrarium" as const,
};
