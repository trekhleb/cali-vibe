/**
 * Route catalog: single source of truth for mapping URL path slugs ↔ state params.
 *
 * URL structure: /cali-vibe/{layer}[/{metric}][+{layer}[/{metric}]...]
 * Examples:
 *   /cali-vibe/housing           → housing layer, default metric
 *   /cali-vibe/housing/rent      → housing layer, rent metric
 *   /cali-vibe/housing+crime     → housing + crime layers
 *   /cali-vibe/schools/math+temperature/low → schools (math) + temperature (low)
 */

export interface LayerDef {
  /** URL slug (e.g., "housing", "crime") */
  slug: string;
  /** Boolean query-param key that activates this layer (e.g., "housing", "crime") */
  paramKey: string;
  /** Canonical ordering priority — lower comes first in multi-layer URLs */
  priority: number;
  /** Query-param key for this layer's metric/subtype (e.g., "hmetric", "ctype") */
  metricKey?: string;
  /** Default metric value — omitted from URL path when active */
  defaultMetric?: string;
  /** Map: metricValue → urlSlug (e.g., { rent: "rent", violentTotal: "violent" }) */
  metricSlugs?: Record<string, string>;
}

export const LAYERS: LayerDef[] = [
  { slug: "counties", paramKey: "counties", priority: 1 },
  { slug: "cities", paramKey: "cities", priority: 2 },
  { slug: "population", paramKey: "pop", priority: 3, metricKey: "pmetric", defaultMetric: "total", metricSlugs: { density: "density" } },
  { slug: "city-population", paramKey: "cityPop", priority: 4, metricKey: "cpmetric", defaultMetric: "total", metricSlugs: { density: "density" } },
  { slug: "housing", paramKey: "housing", priority: 5, metricKey: "hmetric", defaultMetric: "homeValue", metricSlugs: { rent: "rent" } },
  { slug: "city-housing", paramKey: "cityHousing", priority: 6, metricKey: "chmetric", defaultMetric: "homeValue", metricSlugs: { rent: "rent" } },
  { slug: "income", paramKey: "income", priority: 7 },
  { slug: "city-income", paramKey: "cityIncome", priority: 8 },
  { slug: "crime", paramKey: "crime", priority: 9, metricKey: "ctype", defaultMetric: "total", metricSlugs: { violentTotal: "violent", propertyTotal: "property", homicide: "homicide", robbery: "robbery", burglary: "burglary", mvTheft: "vehicle-theft", larceny: "larceny", aggAssault: "assault", rape: "rape" } },
  { slug: "city-crime", paramKey: "cityCrime", priority: 10, metricKey: "cictype", defaultMetric: "total", metricSlugs: { violentTotal: "violent", propertyTotal: "property", homicide: "homicide", robbery: "robbery", burglary: "burglary", mvTheft: "vehicle-theft", larceny: "larceny", aggAssault: "assault", rape: "rape" } },
  { slug: "education", paramKey: "edu", priority: 11, metricKey: "emetric", defaultMetric: "bachPlus", metricSlugs: { hsPlus: "hs", gradPlus: "grad" } },
  { slug: "city-education", paramKey: "cityEdu", priority: 12, metricKey: "cemetric", defaultMetric: "bachPlus", metricSlugs: { hsPlus: "hs", gradPlus: "grad" } },
  { slug: "schools", paramKey: "schools", priority: 13, metricKey: "smetric", defaultMetric: "ela", metricSlugs: { math: "math", graduationRate: "graduation", schoolCount: "count" } },
  { slug: "city-schools", paramKey: "citySchools", priority: 14, metricKey: "csmetric", defaultMetric: "ela", metricSlugs: { math: "math", graduationRate: "graduation", schoolCount: "count" } },
  { slug: "school-points", paramKey: "schPts", priority: 15, metricKey: "spcolor", defaultMetric: "rating", metricSlugs: { ela: "ela", math: "math" } },
  { slug: "race", paramKey: "race", priority: 16, metricKey: "rmetric", defaultMetric: "hispanic", metricSlugs: { white: "white", asian: "asian", black: "black", other: "other" } },
  { slug: "city-race", paramKey: "cityRace", priority: 17, metricKey: "crmetric", defaultMetric: "hispanic", metricSlugs: { white: "white", asian: "asian", black: "black", other: "other" } },
  { slug: "age", paramKey: "age", priority: 18, metricKey: "ametric", defaultMetric: "medianAge", metricSlugs: { under18: "under18", age18to34: "18-34", age35to64: "35-64", age65plus: "65plus" } },
  { slug: "city-age", paramKey: "cityAge", priority: 19, metricKey: "cametric", defaultMetric: "medianAge", metricSlugs: { under18: "under18", age18to34: "18-34", age35to64: "35-64", age65plus: "65plus" } },
  { slug: "poverty", paramKey: "pov", priority: 20 },
  { slug: "city-poverty", paramKey: "cityPov", priority: 21 },
  { slug: "temperature", paramKey: "temp", priority: 22, metricKey: "tmetric", defaultMetric: "tmax", metricSlugs: { tmin: "low", tavg: "avg" } },
  { slug: "sunshine", paramKey: "shine", priority: 23 },
  { slug: "transit", paramKey: "transit", priority: 24 },
  { slug: "terrain", paramKey: "terrain3d", priority: 25 },
];

// --- Internal lookup maps (built once) ---

const _slugToLayer = new Map<string, LayerDef>();
const _paramKeyToLayer = new Map<string, LayerDef>();
/** layerSlug → (metricUrlSlug → metricParamValue) */
const _metricSlugToValue = new Map<string, Map<string, string>>();

for (const layer of LAYERS) {
  _slugToLayer.set(layer.slug, layer);
  _paramKeyToLayer.set(layer.paramKey, layer);
  if (layer.metricSlugs) {
    const inverse = new Map<string, string>();
    for (const [value, slug] of Object.entries(layer.metricSlugs)) {
      inverse.set(slug, value);
    }
    _metricSlugToValue.set(layer.slug, inverse);
  }
}

/** Set of all boolean layer param keys */
export const LAYER_PARAM_KEYS = new Set(LAYERS.map((l) => l.paramKey));

/** Set of all metric param keys */
export const METRIC_PARAM_KEYS = new Set(
  LAYERS.filter((l) => l.metricKey).map((l) => l.metricKey!),
);

/** Valid transit system IDs that can appear as /transit/{id} sub-routes */
export const TRANSIT_SYSTEM_SLUGS = new Set([
  "bart", "caltrain", "lametro", "munimetro", "metrolink", "sdtrolley",
  "smart", "vta", "sacrt", "capitolcorridor", "surfliner", "sanjoaquins",
  "coaststarlight", "calzephyr", "swchief", "coaster", "sprinter", "ace",
]);

// ── Path → Params (reading) ──────────────────────────────────────────

export interface PathParams {
  /** Layer boolean and metric params extracted from the path */
  layers: Record<string, string | boolean>;
  /** Transit system ID if specified as a sub-route (e.g., "bart") */
  transitSystem?: string;
}

/**
 * Parse a URL pathname into layer state params.
 * Returns null if the path is root (no layer segments found).
 */
export function pathToParams(pathname: string, basePath: string): PathParams | null {
  const base = basePath.replace(/\/$/, "");
  let suffix = pathname.replace(/\/$/, "");
  if (suffix.startsWith(base)) {
    suffix = suffix.slice(base.length);
  }
  suffix = suffix.replace(/^\//, "");
  if (!suffix) return null;

  const segments = suffix.split("+");
  const layers: Record<string, string | boolean> = {};
  let transitSystem: string | undefined;
  let found = false;

  for (const segment of segments) {
    const slashIdx = segment.indexOf("/");
    const layerSlug = slashIdx === -1 ? segment : segment.slice(0, slashIdx);
    const subSlug = slashIdx === -1 ? undefined : segment.slice(slashIdx + 1);

    const layer = _slugToLayer.get(layerSlug);
    if (!layer) continue;

    layers[layer.paramKey] = true;
    found = true;

    if (subSlug) {
      // Transit system sub-route
      if (layer.paramKey === "transit" && TRANSIT_SYSTEM_SLUGS.has(subSlug)) {
        transitSystem = subSlug;
        continue;
      }
      // Standard metric sub-route
      if (layer.metricKey) {
        const inverse = _metricSlugToValue.get(layer.slug);
        if (inverse) {
          const metricValue = inverse.get(subSlug);
          if (metricValue) {
            layers[layer.metricKey] = metricValue;
          }
        }
      }
    }
  }

  return found ? { layers, transitSystem } : null;
}

// ── Params → Path (writing) ──────────────────────────────────────────

export interface PathResult {
  /** URL path segment (e.g., "housing/rent+crime") — empty string for root */
  path: string;
  /** Whether transit system was encoded in the path (single system as sub-route) */
  transitInPath: boolean;
}

/**
 * Build a URL path from current layer state.
 *
 * @param layerState Object keyed by param keys: boolean toggles + string metrics
 * @param transitSystems Current transit system selection (array of IDs)
 */
export function paramsToPath(
  layerState: Record<string, any>,
  transitSystems?: string[],
): PathResult {
  const activeLayers = LAYERS.filter((l) => layerState[l.paramKey] === true);

  if (activeLayers.length === 0) {
    return { path: "", transitInPath: false };
  }

  let transitInPath = false;

  const slugs = activeLayers
    .sort((a, b) => a.priority - b.priority)
    .map((layer) => {
      let slug = layer.slug;

      // Transit: single system → sub-route
      if (layer.paramKey === "transit" && transitSystems && transitSystems.length === 1) {
        const sys = transitSystems[0];
        if (TRANSIT_SYSTEM_SLUGS.has(sys)) {
          slug += "/" + sys;
          transitInPath = true;
        }
        return slug;
      }

      // Standard metric sub-route
      if (layer.metricKey && layer.metricSlugs) {
        const metricValue = layerState[layer.metricKey];
        if (metricValue && metricValue !== layer.defaultMetric) {
          const metricSlug = layer.metricSlugs[metricValue];
          if (metricSlug) {
            slug += "/" + metricSlug;
          }
        }
      }

      return slug;
    });

  return { path: slugs.join("+"), transitInPath };
}

/**
 * Look up LayerDef by paramKey.
 */
export function getLayerByParamKey(paramKey: string): LayerDef | undefined {
  return _paramKeyToLayer.get(paramKey);
}

// ── Detail route (county/city pages) ─────────────────────────────────

export interface DetailRoute {
  type: "county" | "city";
  slug: string;
}

/**
 * Parse a URL pathname to see if it matches a county/city detail route.
 * Pattern: {base}/county/{slug} or {base}/city/{slug}
 * Returns null if no match.
 */
export function parseDetailRoute(pathname: string, basePath: string): DetailRoute | null {
  const base = basePath.replace(/\/$/, "");
  let suffix = pathname.replace(/\/$/, "");
  if (suffix.startsWith(base)) {
    suffix = suffix.slice(base.length);
  }
  suffix = suffix.replace(/^\//, "");

  const match = suffix.match(/^(county|city)\/(.+)$/);
  if (!match) return null;
  return { type: match[1] as "county" | "city", slug: match[2] };
}
