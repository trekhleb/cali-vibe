/**
 * Post-build script: generates per-route index.html files with unique
 * <title>, <meta>, and OG tags for each single-layer route.
 *
 * Also generates:
 *  - dist/404.html (SPA fallback for GitHub Pages)
 *  - dist/sitemap.xml (path-based URLs)
 *
 * Run after `vite build`: node scripts/build-html-routes.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = "dist";

export const BASE = "/cali-vibe";
export const ORIGIN = "https://trekhleb.dev";

// ── SEO metadata per route slug ──────────────────────────────────────

const routesPath = join(fileURLToPath(import.meta.url), "../../src/utils/seo-routes.json");
export const ROUTES = JSON.parse(readFileSync(routesPath, "utf-8"));

// ── Template helpers ─────────────────────────────────────────────────

/**
 * Replace a meta/tag pattern in HTML with a new value.
 */
export function replaceTag(html, regex, replacement) {
  return html.replace(regex, replacement);
}

/**
 * Generate route-specific HTML from a template and route metadata.
 */
export function generateHtml(template, route, origin = ORIGIN, base = BASE) {
  const fullTitle = `${route.title} | CaliVibe`;
  const canonicalUrl = `${origin}${base}/${route.slug}`;

  let html = template;

  // <title>
  html = replaceTag(html, /<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`);

  // <meta name="description">
  html = replaceTag(
    html,
    /<meta name="description" content="[^"]*"\s*\/>/,
    `<meta name="description" content="${route.desc}" />`,
  );

  // og:url
  html = replaceTag(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${canonicalUrl}" />`,
  );

  // og:title
  html = replaceTag(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${fullTitle}" />`,
  );

  // og:description
  html = replaceTag(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${route.desc}" />`,
  );

  // twitter:title
  html = replaceTag(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${fullTitle}" />`,
  );

  // twitter:description
  html = replaceTag(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${route.desc}" />`,
  );

  // canonical
  html = replaceTag(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonicalUrl}" />`,
  );

  // JSON-LD url
  html = replaceTag(
    html,
    /"url":\s*"[^"]*"/,
    `"url": "${canonicalUrl}"`,
  );

  return html;
}

/**
 * Build sitemap XML content from routes.
 */
export function buildSitemapXml(routes, origin = ORIGIN, base = BASE) {
  const sitemapEntries = [
    // Root
    `  <url>\n    <loc>${origin}${base}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    // All routes
    ...routes.map(
      (r) =>
        `  <url>\n    <loc>${origin}${base}/${r.slug}</loc>\n    <changefreq>${r.freq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${sitemapEntries.join("\n\n")}

</urlset>
`;
}

// ── Main (only runs when executed directly) ──────────────────────────

// ── Place (county/city) detail route helpers ─────────────────────────

function nameToSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function buildPlaceRoutes(type, names) {
  return names.map((name) => {
    const slug = `${type}/${nameToSlug(name)}`;
    const displayName = type === "county" ? `${name} County` : name;
    return {
      slug,
      title: `${displayName}, California — Demographics, Housing, Crime & More`,
      desc: `Explore ${displayName} demographics, housing costs, crime rates, education, schools, and more on the interactive CaliVibe California map.`,
      priority: type === "county" ? 0.6 : 0.5,
      freq: "yearly",
    };
  });
}

function loadPlaceNames(geojsonPath) {
  const geo = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  return geo.features.map((f) => f.properties.name).filter(Boolean).sort();
}

// ── Main (only runs when executed directly) ──────────────────────────

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const template = readFileSync(join(DIST, "index.html"), "utf-8");
  let generated = 0;

  // Layer routes (from seo-routes.json)
  for (const route of ROUTES) {
    const html = generateHtml(template, route);
    const dir = join(DIST, route.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    generated++;
  }

  // County/city detail routes (from GeoJSON data)
  const dataDir = join(DIST, "data");
  const countyNames = loadPlaceNames(join(dataDir, "california-county-labels.geojson"));
  const cityNames = loadPlaceNames(join(dataDir, "california-city-labels.geojson"));
  const placeRoutes = [
    ...buildPlaceRoutes("county", countyNames),
    ...buildPlaceRoutes("city", cityNames),
  ];

  for (const route of placeRoutes) {
    const html = generateHtml(template, route);
    const dir = join(DIST, route.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    generated++;
  }

  // 404.html (SPA fallback — generic meta tags)
  writeFileSync(join(DIST, "404.html"), template);

  // sitemap.xml (includes all routes: layer + place detail)
  const allRoutes = [...ROUTES, ...placeRoutes];
  writeFileSync(join(DIST, "sitemap.xml"), buildSitemapXml(allRoutes));

  console.log(`Generated ${generated} route HTML files (${ROUTES.length} layer + ${placeRoutes.length} place detail), 404.html, and sitemap.xml (${allRoutes.length + 1} URLs)`);
}
