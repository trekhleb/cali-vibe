#!/usr/bin/env node

/**
 * Computes land area (sq mi) from GeoJSON polygon geometry using @turf/area,
 * then derives population density (people / sq mi) and injects both `area`
 * and `density` properties into county and city GeoJSON files.
 *
 * Usage: node scripts/build-population-density.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import turfArea from "@turf/area";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");
const SQ_M_PER_SQ_MI = 2_589_988.11;

function injectDensity(polygonPath, labelPath) {
  console.log(`\nProcessing: ${polygonPath}`);
  const polyGj = JSON.parse(readFileSync(polygonPath, "utf-8"));
  const nameToArea = new Map();
  let matched = 0;
  let skipped = 0;

  for (const feat of polyGj.features) {
    const areaM2 = turfArea(feat);
    const areaSqMi = Math.round((areaM2 / SQ_M_PER_SQ_MI) * 10) / 10;
    feat.properties.area = areaSqMi;

    const pop = feat.properties.population;
    if (pop != null && areaSqMi > 0) {
      feat.properties.density = Math.round((pop / areaSqMi) * 10) / 10;
      matched++;
    } else {
      feat.properties.density = 0;
      skipped++;
    }

    if (feat.properties.name) {
      nameToArea.set(feat.properties.name, {
        area: feat.properties.area,
        density: feat.properties.density,
      });
    }
  }

  writeFileSync(polygonPath, JSON.stringify(polyGj));
  console.log(`  ✓ Polygons: ${matched} computed, ${skipped} skipped (no pop or zero area)`);

  // Now inject into label file (Point geometry — join by name)
  console.log(`  Joining labels: ${labelPath}`);
  const labelGj = JSON.parse(readFileSync(labelPath, "utf-8"));
  let labelMatched = 0;
  let labelMissed = 0;

  for (const feat of labelGj.features) {
    const name = feat.properties.name;
    const data = nameToArea.get(name);
    if (data) {
      feat.properties.area = data.area;
      feat.properties.density = data.density;
      labelMatched++;
    } else {
      console.warn(`  ⚠ No area data for label: ${name}`);
      labelMissed++;
    }
  }

  writeFileSync(labelPath, JSON.stringify(labelGj));
  console.log(`  ✓ Labels: ${labelMatched} matched, ${labelMissed} missed`);
}

injectDensity(
  join(DATA_DIR, "california-counties.geojson"),
  join(DATA_DIR, "california-county-labels.geojson")
);
injectDensity(
  join(DATA_DIR, "california-cities.geojson"),
  join(DATA_DIR, "california-city-labels.geojson")
);

console.log("\nDone!");
