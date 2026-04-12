#!/usr/bin/env node

/**
 * Review generated AI descriptions — prints them to the terminal for easy scanning.
 * Includes a --scan mode that flags potentially problematic content.
 *
 * Usage:
 *   node scripts/review-descriptions.mjs --version v1-sonnet
 *   node scripts/review-descriptions.mjs --version v1-sonnet --type city --limit 5
 *   node scripts/review-descriptions.mjs --version v1-sonnet --scan
 *
 * Flags:
 *   --version <name>  Description version folder (e.g., "v1-sonnet")
 *   --type <type>     Review only "county" or "city" (default: both)
 *   --limit <n>       Show only first N places per type
 *   --tab <tab>       Show only a specific tab (e.g., "summary")
 *   --scan            Safety scan — only show descriptions with flagged keywords
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data", "descriptions");

// ---------------------------------------------------------------------------
// Sensitive keyword patterns for --scan mode
// Each entry: [regex, category] — regex is case-insensitive
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS = [
  // Racial / ethnic references
  [/\b(white|black|hispanic|latino|latina|latinx|asian|african[- ]american|caucasian|indigenous|native american)\b/i, "race/ethnicity"],
  [/\b(mexican|chinese|japanese|korean|vietnamese|filipino|indian|arab|middle[- ]eastern|pacific islander)\b/i, "nationality/ethnicity"],
  [/\b(ethnic|racial|minority|majority[- ]minority|people of color|POC)\b/i, "race/ethnicity"],
  [/\b(diverse community|cultural melting pot|melting pot|multicultural)\b/i, "demographic characterization"],
  [/\b(gentrification|gentrified|gentrifying)\b/i, "socioeconomic sensitivity"],

  // Religious references
  [/\b(muslim|christian|jewish|hindu|buddhist|sikh|church|mosque|temple|synagogue)\b/i, "religion"],

  // Socioeconomic / class mockery
  [/\b(ghetto|hood|sketchy|rough neighborhood|wrong side of the tracks|trailer|trailer park)\b/i, "socioeconomic stigma"],
  [/\b(homeless|hobo|bum|vagrant|transient|tweaker|junkie|addict)\b/i, "vulnerable population"],
  [/\b(welfare|food stamp|section 8)\b/i, "socioeconomic stigma"],
  [/\b(white[- ]trash|redneck|hick)\b/i, "class-based slur"],

  // Crime stigma (when applied to people, not policy)
  [/\b(dangerous people|criminals live|criminal element|thugs|gangster|gang[- ]infested|gang[- ]ridden)\b/i, "crime stigma"],

  // Political / partisan
  [/\b(liberal|conservative|republican|democrat|MAGA|woke|left[- ]wing|right[- ]wing|red state|blue state)\b/i, "political"],
  [/\b(trump|biden|newsom|governor)\b/i, "political figure"],

  // Housing discrimination / steering
  [/\b(don't move here|stay away|avoid this|you don't belong|not for you|wrong kind of people)\b/i, "steering"],

  // Gender / sexuality
  [/\b(gay neighborhood|lesbian|queer enclave|LGBT|LGBTQ)\b/i, "sexuality"],

  // Immigration
  [/\b(illegal immigrant|illegal alien|undocumented|border|deportation|ICE)\b/i, "immigration"],

  // Disability
  [/\b(retarded|crippled|lame|crazy people|insane people|mental patients)\b/i, "disability slur"],
];

/**
 * Scan text for sensitive patterns. Returns array of { keyword, category, context }.
 */
function scanText(text) {
  const flags = [];
  for (const [regex, category] of SENSITIVE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      // Extract surrounding context (±40 chars)
      const idx = match.index;
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + match[0].length + 40);
      const context = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
      flags.push({ keyword: match[0], category, context });
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    version: { type: "string", default: "" },
    type:    { type: "string", default: "both" },
    limit:   { type: "string", default: "0" },
    tab:     { type: "string", default: "both" },
    scan:    { type: "boolean", default: false },
  },
});

const VERSION = args.version;
const TYPE_FILTER = args.type;
const LIMIT = parseInt(args.limit, 10) || 0;
const TAB_FILTER = args.tab;
const SCAN_MODE = args.scan;

if (!VERSION) {
  if (existsSync(DATA_DIR)) {
    const versions = readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    console.log("Available versions:", versions.join(", ") || "(none)");
  }
  console.error("\nUsage: node scripts/review-descriptions.mjs --version <name>");
  process.exit(1);
}

const versionDir = join(DATA_DIR, VERSION);
if (!existsSync(versionDir)) {
  console.error(`Error: Version directory not found: ${versionDir}`);
  process.exit(1);
}

if (SCAN_MODE) {
  console.log("\n⚠  SAFETY SCAN MODE — flagging sensitive content\n");
}

const types = TYPE_FILTER === "both" ? ["county", "city"] : [TYPE_FILTER];
let totalCount = 0;
let flaggedCount = 0;

for (const placeType of types) {
  const typeDir = join(versionDir, placeType);
  if (!existsSync(typeDir)) {
    console.log(`\nNo ${placeType} descriptions found.`);
    continue;
  }

  let files = readdirSync(typeDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (LIMIT > 0) files = files.slice(0, LIMIT);

  if (!SCAN_MODE) {
    console.log("\n" + "=".repeat(70));
    console.log(`  ${placeType === "county" ? "COUNTIES" : "CITIES"} — ${files.length} descriptions`);
    console.log("=".repeat(70));
  }

  for (const file of files) {
    const slug = basename(file, ".json");
    const filePath = join(typeDir, file);

    try {
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      const tabs = [];
      if (TAB_FILTER === "both" || TAB_FILTER === "summary") tabs.push(["summary", data.summary]);

      if (SCAN_MODE) {
        // Only show places with flags
        const allFlags = [];
        for (const [tabName, text] of tabs) {
          if (!text) continue;
          const flags = scanText(text);
          for (const f of flags) allFlags.push({ tab: tabName, ...f });
        }

        if (allFlags.length > 0) {
          flaggedCount++;
          console.log("-".repeat(70));
          console.log(`  ⚠ ${slug} (${placeType}) — ${allFlags.length} flag(s)`);
          console.log("-".repeat(70));
          for (const f of allFlags) {
            console.log(`    [${f.tab}] ${f.category}: "${f.keyword}"`);
            console.log(`      ...${f.context}`);
          }
          console.log();
        }
      } else {
        // Normal review mode
        console.log("\n" + "-".repeat(70));
        console.log(`  📍 ${slug} (${placeType})`);
        console.log("-".repeat(70));

        for (const [tabName, text] of tabs) {
          const label = tabName === "summary" ? "✨ THE GIST" : tabName.toUpperCase();
          console.log(`\n  ${label}:`);
          console.log(`  ${text || "(empty)"}`);
        }
      }

      totalCount++;
    } catch (err) {
      console.error(`\n  ⚠ Error reading ${file}: ${err.message}`);
    }
  }
}

console.log("\n" + "=".repeat(70));
if (SCAN_MODE) {
  console.log(`  Scanned: ${totalCount} | Flagged: ${flaggedCount}`);
  if (flaggedCount === 0) {
    console.log("  ✅ No sensitive content detected.");
  } else {
    console.log("  ⚠ Review flagged descriptions above before publishing.");
  }
} else {
  console.log(`  Total reviewed: ${totalCount}`);
}
console.log("=".repeat(70) + "\n");
