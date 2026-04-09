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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const DIST = "dist";
const BASE = "/cali-vibe";
const ORIGIN = "https://trekhleb.dev";

// ── SEO metadata per route slug ──────────────────────────────────────

const ROUTES = [
  // --- County data layers ---
  { slug: "housing", title: "California County Housing Costs Map", desc: "Interactive map of median home values across all 58 California counties. Census ACS 2019–2023 data.", priority: 0.9, freq: "yearly" },
  { slug: "housing/rent", title: "California County Rent Prices Map", desc: "Interactive map of median gross rent across all 58 California counties. Census ACS 2019–2023 data.", priority: 0.9, freq: "yearly" },
  { slug: "income", title: "California County Household Income Map", desc: "Interactive map of median household income across all 58 California counties. Census ACS 2019–2023 data.", priority: 0.9, freq: "yearly" },
  { slug: "population", title: "California County Population Map", desc: "Interactive population map of all 58 California counties. CA Dept. of Finance 2024 estimates.", priority: 0.8, freq: "yearly" },
  { slug: "population/density", title: "California County Population Density Map", desc: "Interactive population density map (per sq mi) of all 58 California counties.", priority: 0.8, freq: "yearly" },
  { slug: "crime", title: "California County Crime Rates Map", desc: "Interactive crime rate map of all 58 California counties — total, violent, and property crime per 100K. CA DOJ 2023.", priority: 0.9, freq: "yearly" },
  { slug: "crime/violent", title: "California County Violent Crime Map", desc: "Interactive violent crime rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.8, freq: "yearly" },
  { slug: "crime/property", title: "California County Property Crime Map", desc: "Interactive property crime rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.8, freq: "yearly" },
  { slug: "crime/homicide", title: "California County Homicide Rate Map", desc: "Interactive homicide rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/robbery", title: "California County Robbery Rate Map", desc: "Interactive robbery rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/burglary", title: "California County Burglary Rate Map", desc: "Interactive burglary rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/vehicle-theft", title: "California County Vehicle Theft Map", desc: "Interactive motor vehicle theft rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/larceny", title: "California County Larceny-Theft Map", desc: "Interactive larceny-theft rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/assault", title: "California County Aggravated Assault Map", desc: "Interactive aggravated assault rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "crime/rape", title: "California County Rape Rate Map", desc: "Interactive rape rate map of all 58 California counties per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "education", title: "California County Education Map — Bachelor's Degree+", desc: "Interactive map of bachelor's degree attainment rates across all 58 California counties. Census ACS 2019–2023.", priority: 0.9, freq: "yearly" },
  { slug: "education/hs", title: "California County Education Map — High School+", desc: "Interactive map of high school diploma attainment rates across all 58 California counties. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "education/grad", title: "California County Education Map — Graduate Degree+", desc: "Interactive map of graduate degree attainment rates across all 58 California counties. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "schools", title: "California County School Performance Map — ELA Scores", desc: "Interactive map of average ELA proficiency scores by county. CA Dept. of Education 2025.", priority: 0.9, freq: "yearly" },
  { slug: "schools/math", title: "California County School Performance Map — Math Scores", desc: "Interactive map of average Math proficiency scores by county. CA Dept. of Education 2025.", priority: 0.8, freq: "yearly" },
  { slug: "schools/graduation", title: "California County Graduation Rate Map", desc: "Interactive map of high school graduation rates by county. CA Dept. of Education 2025.", priority: 0.8, freq: "yearly" },
  { slug: "schools/count", title: "California County School Count Map", desc: "Interactive map of school counts by county. CA Dept. of Education 2025.", priority: 0.7, freq: "yearly" },
  { slug: "school-points", title: "California Individual School Locations & Ratings Map", desc: "Interactive map of 11,600+ California schools with Dashboard ratings. CA Dept. of Education 2025.", priority: 0.8, freq: "yearly" },
  { slug: "school-points/ela", title: "California School Locations Colored by ELA Scores", desc: "Interactive map of 11,600+ California schools colored by ELA proficiency. CA Dept. of Education 2025.", priority: 0.7, freq: "yearly" },
  { slug: "school-points/math", title: "California School Locations Colored by Math Scores", desc: "Interactive map of 11,600+ California schools colored by Math proficiency. CA Dept. of Education 2025.", priority: 0.7, freq: "yearly" },
  { slug: "race", title: "California County Race & Ethnicity Map — Hispanic/Latino", desc: "Interactive map of Hispanic/Latino population percentage across all 58 California counties. Census ACS 2019–2023.", priority: 0.9, freq: "yearly" },
  { slug: "race/white", title: "California County Race Map — White Population", desc: "Interactive map of White population percentage across all 58 California counties. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "race/asian", title: "California County Race Map — Asian Population", desc: "Interactive map of Asian population percentage across all 58 California counties. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "race/black", title: "California County Race Map — Black Population", desc: "Interactive map of Black population percentage across all 58 California counties. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "age", title: "California County Age Distribution Map — Median Age", desc: "Interactive map of median age across all 58 California counties. Census ACS 2019–2023.", priority: 0.9, freq: "yearly" },
  { slug: "age/under18", title: "California County Age Map — Under 18", desc: "Interactive map of under-18 population percentage across all 58 California counties.", priority: 0.8, freq: "yearly" },
  { slug: "age/18-34", title: "California County Age Map — 18 to 34", desc: "Interactive map of 18–34 population percentage across all 58 California counties.", priority: 0.7, freq: "yearly" },
  { slug: "age/35-64", title: "California County Age Map — 35 to 64", desc: "Interactive map of 35–64 population percentage across all 58 California counties.", priority: 0.7, freq: "yearly" },
  { slug: "age/65plus", title: "California County Age Map — 65+", desc: "Interactive map of 65+ population percentage across all 58 California counties.", priority: 0.7, freq: "yearly" },
  { slug: "poverty", title: "California County Poverty Rate Map", desc: "Interactive map of poverty rates across all 58 California counties. Census ACS 2019–2023.", priority: 0.9, freq: "yearly" },

  // --- City data layers ---
  { slug: "city-housing", title: "California City Housing Costs Map", desc: "Interactive map of median home values across 697 California cities and CDPs. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-housing/rent", title: "California City Rent Prices Map", desc: "Interactive map of median gross rent across 697 California cities and CDPs. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-income", title: "California City Household Income Map", desc: "Interactive map of median household income across 697 California cities and CDPs. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-population", title: "California City Population Map", desc: "Interactive population map of 697 California cities and CDPs. CA Dept. of Finance 2024 estimates.", priority: 0.8, freq: "yearly" },
  { slug: "city-population/density", title: "California City Population Density Map", desc: "Interactive population density map (per sq mi) of 697 California cities and CDPs.", priority: 0.7, freq: "yearly" },
  { slug: "city-crime", title: "California City Crime Rates Map", desc: "Interactive crime rate map of California cities per 100K residents. CA DOJ 2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-crime/violent", title: "California City Violent Crime Map", desc: "Interactive violent crime rate map of California cities per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "city-crime/property", title: "California City Property Crime Map", desc: "Interactive property crime rate map of California cities per 100K residents. CA DOJ 2023.", priority: 0.7, freq: "yearly" },
  { slug: "city-education", title: "California City Education Map — Bachelor's Degree+", desc: "Interactive map of bachelor's degree attainment across 697 California cities. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-education/hs", title: "California City Education Map — High School+", desc: "Interactive map of high school diploma attainment across 697 California cities. Census ACS 2019–2023.", priority: 0.7, freq: "yearly" },
  { slug: "city-education/grad", title: "California City Education Map — Graduate Degree+", desc: "Interactive map of graduate degree attainment across 697 California cities. Census ACS 2019–2023.", priority: 0.7, freq: "yearly" },
  { slug: "city-schools", title: "California City School Performance Map — ELA Scores", desc: "Interactive map of average ELA scores by city. CA Dept. of Education 2025.", priority: 0.8, freq: "yearly" },
  { slug: "city-schools/math", title: "California City School Performance Map — Math Scores", desc: "Interactive map of average Math scores by city. CA Dept. of Education 2025.", priority: 0.7, freq: "yearly" },
  { slug: "city-schools/graduation", title: "California City Graduation Rate Map", desc: "Interactive map of graduation rates by city. CA Dept. of Education 2025.", priority: 0.7, freq: "yearly" },
  { slug: "city-schools/count", title: "California City School Count Map", desc: "Interactive map of school counts by city. CA Dept. of Education 2025.", priority: 0.6, freq: "yearly" },
  { slug: "city-race", title: "California City Race & Ethnicity Map — Hispanic/Latino", desc: "Interactive map of Hispanic/Latino population percentage across 697 California cities. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-race/white", title: "California City Race Map — White Population", desc: "Interactive map of White population percentage across 697 California cities. Census ACS 2019–2023.", priority: 0.7, freq: "yearly" },
  { slug: "city-age", title: "California City Age Distribution Map — Median Age", desc: "Interactive map of median age across 697 California cities. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },
  { slug: "city-poverty", title: "California City Poverty Rate Map", desc: "Interactive map of poverty rates across 697 California cities and CDPs. Census ACS 2019–2023.", priority: 0.8, freq: "yearly" },

  // --- Weather ---
  { slug: "temperature", title: "California Temperature Map — Day High", desc: "Interactive temperature map of California showing average daily high temperatures on an H3 hex grid. 2014–2023 normals.", priority: 0.9, freq: "yearly" },
  { slug: "temperature/low", title: "California Temperature Map — Night Low", desc: "Interactive temperature map of California showing average nightly low temperatures on an H3 hex grid. 2014–2023 normals.", priority: 0.8, freq: "yearly" },
  { slug: "temperature/avg", title: "California Temperature Map — Average", desc: "Interactive temperature map of California showing average daily mean temperatures on an H3 hex grid. 2014–2023 normals.", priority: 0.8, freq: "yearly" },
  { slug: "sunshine", title: "California Sunshine Hours Map", desc: "Interactive map of average daily sunshine hours across California. Satellite-derived data (NREL NSRDB).", priority: 0.8, freq: "yearly" },

  // --- Transit ---
  { slug: "transit", title: "California Transit Map — All Rail Systems", desc: "Interactive map of 18 California rail systems: BART, Caltrain, LA Metro, Muni Metro, Metrolink, and more.", priority: 0.8, freq: "monthly" },
  { slug: "transit/bart", title: "BART System Map — Bay Area Rapid Transit", desc: "Interactive BART rail map with all stations and lines in the San Francisco Bay Area.", priority: 0.7, freq: "monthly" },
  { slug: "transit/caltrain", title: "Caltrain System Map — Peninsula Rail", desc: "Interactive Caltrain rail map with all stations between San Francisco and San Jose.", priority: 0.7, freq: "monthly" },
  { slug: "transit/lametro", title: "LA Metro Rail System Map", desc: "Interactive LA Metro rail map with all lines and stations in Los Angeles County.", priority: 0.7, freq: "monthly" },
  { slug: "transit/munimetro", title: "Muni Metro System Map — San Francisco", desc: "Interactive Muni Metro light rail map with all lines and stations in San Francisco.", priority: 0.7, freq: "monthly" },
  { slug: "transit/metrolink", title: "Metrolink System Map — Southern California", desc: "Interactive Metrolink commuter rail map with all lines and stations in Southern California.", priority: 0.7, freq: "monthly" },
  { slug: "transit/sdtrolley", title: "San Diego Trolley System Map", desc: "Interactive San Diego Trolley light rail map with all lines and stations.", priority: 0.7, freq: "monthly" },
  { slug: "transit/smart", title: "SMART Train System Map — Sonoma-Marin", desc: "Interactive SMART commuter rail map in Sonoma and Marin counties.", priority: 0.6, freq: "monthly" },
  { slug: "transit/vta", title: "VTA Light Rail System Map — Santa Clara", desc: "Interactive VTA light rail map with all lines and stations in Santa Clara County.", priority: 0.6, freq: "monthly" },
  { slug: "transit/sacrt", title: "Sacramento RT Light Rail System Map", desc: "Interactive Sacramento Regional Transit light rail map.", priority: 0.6, freq: "monthly" },
  { slug: "transit/capitolcorridor", title: "Capitol Corridor Amtrak Route Map", desc: "Interactive Capitol Corridor Amtrak route map between Auburn and San Jose.", priority: 0.6, freq: "monthly" },
  { slug: "transit/surfliner", title: "Pacific Surfliner Amtrak Route Map", desc: "Interactive Pacific Surfliner Amtrak route map along the Southern California coast.", priority: 0.6, freq: "monthly" },
  { slug: "transit/sanjoaquins", title: "San Joaquins Amtrak Route Map", desc: "Interactive San Joaquins Amtrak route map through California's Central Valley.", priority: 0.6, freq: "monthly" },
  { slug: "transit/coaststarlight", title: "Coast Starlight Amtrak Route Map — California", desc: "Interactive Coast Starlight Amtrak route map through California.", priority: 0.6, freq: "monthly" },
  { slug: "transit/calzephyr", title: "California Zephyr Amtrak Route Map — California", desc: "Interactive California Zephyr Amtrak route map through California.", priority: 0.6, freq: "monthly" },
  { slug: "transit/swchief", title: "Southwest Chief Amtrak Route Map — California", desc: "Interactive Southwest Chief Amtrak route map through California.", priority: 0.6, freq: "monthly" },
  { slug: "transit/coaster", title: "Coaster Commuter Rail Map — San Diego", desc: "Interactive Coaster commuter rail map between Oceanside and San Diego.", priority: 0.6, freq: "monthly" },
  { slug: "transit/sprinter", title: "Sprinter Light Rail Map — North San Diego", desc: "Interactive Sprinter light rail map between Oceanside and Escondido.", priority: 0.6, freq: "monthly" },
  { slug: "transit/ace", title: "ACE Train System Map — Altamont Corridor", desc: "Interactive ACE commuter rail map between Stockton and San Jose.", priority: 0.6, freq: "monthly" },

  // --- Other ---
  { slug: "terrain", title: "California 3D Terrain Map", desc: "Interactive 3D raised-relief terrain map of California with mountain peaks.", priority: 0.8, freq: "yearly" },
  { slug: "counties", title: "California County Borders Map", desc: "Interactive map showing all 58 California county boundaries.", priority: 0.7, freq: "yearly" },
  { slug: "cities", title: "California City Borders Map", desc: "Interactive map showing boundaries of 697 California cities and CDPs.", priority: 0.7, freq: "yearly" },
];

// ── Template helpers ─────────────────────────────────────────────────

const template = readFileSync(join(DIST, "index.html"), "utf-8");

function replaceTag(html, regex, replacement) {
  return html.replace(regex, replacement);
}

function generateHtml(route) {
  const fullTitle = `${route.title} | CaliVibe`;
  const canonicalUrl = `${ORIGIN}${BASE}/${route.slug}`;
  const ogImage = `${ORIGIN}${BASE}/demo/00-preview-md.jpg`;

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

// ── Generate per-route HTML files ────────────────────────────────────

let generated = 0;

for (const route of ROUTES) {
  const html = generateHtml(route);
  const dir = join(DIST, route.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  generated++;
}

// ── 404.html (SPA fallback — generic meta tags) ─────────────────────

writeFileSync(join(DIST, "404.html"), template);

// ── sitemap.xml ──────────────────────────────────────────────────────

const sitemapEntries = [
  // Root
  `  <url>\n    <loc>${ORIGIN}${BASE}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  // All routes
  ...ROUTES.map(
    (r) =>
      `  <url>\n    <loc>${ORIGIN}${BASE}/${r.slug}</loc>\n    <changefreq>${r.freq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
  ),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${sitemapEntries.join("\n\n")}

</urlset>
`;

writeFileSync(join(DIST, "sitemap.xml"), sitemap);

console.log(`Generated ${generated} route HTML files, 404.html, and sitemap.xml (${ROUTES.length + 1} URLs)`);
