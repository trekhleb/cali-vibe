#!/usr/bin/env node

/**
 * Generates AI summary descriptions for California cities and counties.
 *
 * Usage:
 *   -- Synchronous mode (test/debug, one at a time) --
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet --limit 5
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet --names "San Ramon,Sunnyvale"
 *
 *   -- Batch mode (full runs, 50% cheaper, results within 24h) --
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet --batch
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet --batch-status
 *   node scripts/generate-descriptions.mjs --prompt v1 --model sonnet --batch-collect
 *
 * Flags:
 *   --prompt <version>  Prompt version folder (e.g., "v1") — reads from prompts/place-reviews/{version}/
 *   --model <name>      Model provider key (e.g., "sonnet", "opus", "gpt4o", "gemini")
 *   --limit <n>         Generate only N places per type (diverse sampling for test runs)
 *   --type <type>       Generate only "county" or "city" (default: both)
 *   --names <list>      Comma-separated place names to generate (e.g., "San Ramon,Sunnyvale,Los Gatos")
 *   --dry-run           Print prompts without calling the API
 *   --rpm <n>           Target requests per minute (default: 40, script adds 20% safety margin)
 *   --batch             Submit all pending places as an async batch (50% cheaper, up to 24h)
 *   --batch-status      Check the status of a pending batch
 *   --batch-collect     Download results from a completed batch and save to JSON files
 *
 * Rate limits (synchronous mode):
 *   - Default 40 RPM target → 32 effective RPM (with 20% safety margin)
 *   - Adjust with --rpm flag to match your Anthropic tier
 *   - Automatic retry with exponential backoff on 429/5xx (via Anthropic SDK)
 *
 * Resume: re-run the same command — existing files are skipped automatically.
 *
 * Environment variables (use .env file):
 *   ANTHROPIC_API_KEY   Required for sonnet/opus/haiku models
 *   OPENAI_API_KEY      Required for gpt4o model (future)
 *   GOOGLE_AI_API_KEY   Required for gemini model (future)
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");
const PROMPTS_DIR = join(ROOT, "prompts", "place-reviews");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    prompt:  { type: "string", default: "v1" },
    model:   { type: "string", default: "sonnet" },
    limit:   { type: "string", default: "0" },
    type:    { type: "string", default: "both" },
    names:   { type: "string", default: "" },
    "dry-run": { type: "boolean", default: false },
    rpm:     { type: "string", default: "40" },
    batch:   { type: "boolean", default: false },
    "batch-status": { type: "boolean", default: false },
    "batch-collect": { type: "boolean", default: false },
  },
});

const PROMPT_VERSION = args.prompt;
const MODEL_KEY = args.model;
const LIMIT = parseInt(args.limit, 10) || 0;
const TYPE_FILTER = args.type; // "county", "city", or "both"
const NAMES_FILTER = args.names ? args.names.split(",").map((n) => n.trim()) : [];
const DRY_RUN = args["dry-run"];
const TARGET_RPM = parseInt(args.rpm, 10) || 40;
const BATCH_SUBMIT = args.batch;
const BATCH_STATUS = args["batch-status"];
const BATCH_COLLECT = args["batch-collect"];

const OUTPUT_DIR = join(DATA_DIR, "descriptions", `${PROMPT_VERSION}-${MODEL_KEY}`);
const BATCH_STATE_PATH = join(OUTPUT_DIR, ".batch-state.json");

// ---------------------------------------------------------------------------
// Rate limiter (on top of SDK's built-in retry — ensures we stay well under 5 RPM)
// ---------------------------------------------------------------------------

// Derive interval from target RPM (with 20% safety margin)
const SAFE_RPM = TARGET_RPM * 0.8;
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / SAFE_RPM);
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
    const waitSec = (waitMs / 1000).toFixed(1);
    process.stdout.write(`    ⏱ rate limit: waiting ${waitSec}s...`);
    await new Promise((r) => setTimeout(r, waitMs));
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Model providers (pluggable)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ModelProvider
 * @property {string} displayName - Human-readable model name for logging
 * @property {(prompt: string) => Promise<string>} generate - Generate text from a prompt
 */

/** @type {Record<string, () => ModelProvider>} */
const MODEL_PROVIDERS = {
  sonnet: () => createAnthropicProvider("claude-sonnet-4-20250514", "Claude Sonnet 4"),
  // opus: () => createAnthropicProvider("claude-opus-4-0-20250514", "Claude Opus 4"),
  opus: () => createAnthropicProvider("claude-opus-4-6", "Claude Opus 4"),
  haiku: () => createAnthropicProvider("claude-haiku-4-5-20251001", "Claude Haiku 4.5"),

  // Future providers — uncomment and implement when needed:
  // gpt4o: () => createOpenAIProvider("gpt-4o", "GPT-4o"),
  // gemini: () => createGeminiProvider("gemini-1.5-pro", "Gemini 1.5 Pro"),
};

/**
 * Creates an Anthropic provider using the official SDK.
 * The SDK handles retries, rate-limit backoff, and error parsing automatically.
 */
function createAnthropicProvider(modelId, displayName) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required for Anthropic models.");
    console.error("Set it with: export ANTHROPIC_API_KEY=sk-ant-...");
    console.error("Or add it to the .env file (see .env.example).");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey, maxRetries: 5 });

  return {
    displayName,
    async generate(prompt) {
      await waitForRateLimit();

      const message = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content?.[0]?.type === "text" ? message.content[0].text : null;
      if (!text) throw new Error("Empty response from Anthropic API");
      return text.trim();
    },
  };
}

// Template for future OpenAI provider:
// function createOpenAIProvider(modelId, displayName) {
//   const apiKey = process.env.OPENAI_API_KEY;
//   if (!apiKey) { console.error("Error: OPENAI_API_KEY required"); process.exit(1); }
//   return {
//     displayName,
//     async generate(prompt) {
//       const res = await fetch("https://api.openai.com/v1/chat/completions", {
//         method: "POST",
//         headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
//         body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: prompt }], max_tokens: 1024 }),
//       });
//       if (!res.ok) { const body = await res.text(); throw new Error(`OpenAI API error ${res.status}: ${body}`); }
//       const data = await res.json();
//       return data.choices?.[0]?.message?.content?.trim() ?? "";
//     },
//   };
// }

// Template for future Gemini provider:
// function createGeminiProvider(modelId, displayName) {
//   const apiKey = process.env.GOOGLE_AI_API_KEY;
//   if (!apiKey) { console.error("Error: GOOGLE_AI_API_KEY required"); process.exit(1); }
//   return {
//     displayName,
//     async generate(prompt) {
//       const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
//       });
//       if (!res.ok) { const body = await res.text(); throw new Error(`Gemini API error ${res.status}: ${body}`); }
//       const data = await res.json();
//       return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
//     },
//   };
// }

// ---------------------------------------------------------------------------
// Anthropic model IDs (used by both sync and batch modes)
// ---------------------------------------------------------------------------

const ANTHROPIC_MODEL_IDS = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-0-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

// ---------------------------------------------------------------------------
// Batch mode functions
// ---------------------------------------------------------------------------

/**
 * Submit all pending places as an async batch.
 * Saves batch state to .batch-state.json for later collection.
 */
async function batchSubmit(workItems, summaryPromptTemplate) {
  const modelId = ANTHROPIC_MODEL_IDS[MODEL_KEY];
  if (!modelId) {
    console.error(`\nError: Batch mode only supports Anthropic models. "${MODEL_KEY}" is not supported.`);
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    process.exit(1);
  }

  // Filter out already-completed places
  const pending = [];
  for (const { placeType, feature } of workItems) {
    const name = feature.properties.name;
    const slug = nameToSlug(name);
    const outPath = join(OUTPUT_DIR, placeType, `${slug}.json`);
    if (existsSync(outPath)) {
      try {
        const existing = JSON.parse(readFileSync(outPath, "utf-8"));
        if (existing.summary) continue; // already done
      } catch { /* corrupted, include in batch */ }
    }
    pending.push({ placeType, feature });
  }

  if (pending.length === 0) {
    console.log("\n  All places already generated. Nothing to batch.");
    return;
  }

  // Build batch requests (1 per place)
  const requests = [];
  const metadata = {}; // custom_id → { placeType, name, slug }

  for (const { placeType, feature } of pending) {
    const props = feature.properties;
    const name = props.name;
    const slug = nameToSlug(name);
    const metricsBlock = formatMetrics(props);

    const prompt = summaryPromptTemplate
      .replace("{PLACE_NAME}", name)
      .replace("{PLACE_TYPE}", placeType)
      .replace("{KEY_METRICS}", metricsBlock);

    const customId = `${placeType}/${slug}`;
    requests.push({
      custom_id: customId,
      params: {
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      },
    });
    metadata[customId] = { placeType, name, slug };
  }

  console.log(`\n  Submitting batch: ${pending.length} places, ${requests.length} requests...`);

  const client = new Anthropic({ apiKey });
  const batch = await client.messages.batches.create({ requests });

  // Save batch state for later status checks and collection
  const state = {
    batchId: batch.id,
    model: MODEL_KEY,
    modelId,
    promptVersion: PROMPT_VERSION,
    submittedAt: new Date().toISOString(),
    totalPlaces: pending.length,
    totalRequests: requests.length,
    metadata,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(BATCH_STATE_PATH, JSON.stringify(state, null, 2) + "\n");

  console.log(`\n  ✓ Batch submitted!`);
  console.log(`    Batch ID       : ${batch.id}`);
  console.log(`    Places         : ${pending.length}`);
  console.log(`    API requests   : ${requests.length}`);
  console.log(`    Status         : ${batch.processing_status}`);
  console.log(`    State saved to : ${BATCH_STATE_PATH}`);
  console.log(`\n  Next steps:`);
  console.log(`    Check status : npm run generate-descriptions -- --prompt ${PROMPT_VERSION} --model ${MODEL_KEY} --batch-status`);
  console.log(`    Collect      : npm run generate-descriptions -- --prompt ${PROMPT_VERSION} --model ${MODEL_KEY} --batch-collect`);
}

/**
 * Check the status of a pending batch.
 */
async function batchStatus() {
  if (!existsSync(BATCH_STATE_PATH)) {
    console.error(`\n  No batch state found at: ${BATCH_STATE_PATH}`);
    console.error(`  Submit a batch first with --batch`);
    process.exit(1);
  }

  const state = JSON.parse(readFileSync(BATCH_STATE_PATH, "utf-8"));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY required.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const batch = await client.messages.batches.retrieve(state.batchId);

  const counts = batch.request_counts;
  const elapsed = ((Date.now() - new Date(state.submittedAt).getTime()) / 60000).toFixed(0);

  console.log(`\n  Batch status for: ${state.batchId}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`    Status       : ${batch.processing_status}`);
  console.log(`    Submitted    : ${state.submittedAt} (${elapsed} min ago)`);
  console.log(`    Model        : ${state.modelId}`);
  console.log(`    Total places : ${state.totalPlaces}`);
  console.log(`    Total reqs   : ${state.totalRequests}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`    Succeeded    : ${counts.succeeded}`);
  console.log(`    Processing   : ${counts.processing}`);
  console.log(`    Errored      : ${counts.errored}`);
  console.log(`    Canceled     : ${counts.canceled}`);
  console.log(`    Expired      : ${counts.expired}`);

  if (batch.processing_status === "ended") {
    console.log(`\n  ✓ Batch is complete! Run --batch-collect to download results.`);
  } else {
    console.log(`\n  ⏳ Batch still processing. Check again later.`);
  }
}

/**
 * Download results from a completed batch and save to per-place JSON files.
 */
async function batchCollect() {
  if (!existsSync(BATCH_STATE_PATH)) {
    console.error(`\n  No batch state found at: ${BATCH_STATE_PATH}`);
    process.exit(1);
  }

  const state = JSON.parse(readFileSync(BATCH_STATE_PATH, "utf-8"));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY required.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Check if batch is done
  const batch = await client.messages.batches.retrieve(state.batchId);
  if (batch.processing_status !== "ended") {
    console.log(`\n  Batch is still ${batch.processing_status}. Wait for it to finish.`);
    console.log(`  Run --batch-status to check progress.`);
    return;
  }

  console.log(`\n  Collecting results from batch: ${state.batchId}...`);

  // Download and process results
  const resultsStream = await client.messages.batches.results(state.batchId);

  // Process results
  let succeeded = 0;
  let errored = 0;
  let saved = 0;
  const errors = [];

  for await (const result of resultsStream) {
    const customId = result.custom_id;
    const meta = state.metadata[customId];
    if (!meta) {
      console.error(`    ⚠ Unknown custom_id: ${customId}`);
      continue;
    }

    if (result.result.type === "succeeded") {
      const text = result.result.message?.content?.[0]?.text?.trim();
      if (text) {
        const typeDir = join(OUTPUT_DIR, meta.placeType);
        mkdirSync(typeDir, { recursive: true });
        const outPath = join(typeDir, `${meta.slug}.json`);
        writeFileSync(outPath, JSON.stringify({ summary: text }, null, 2) + "\n");
        succeeded++;
        saved++;
      }
    } else {
      errored++;
      errors.push({ name: meta.name, type: result.result.type, error: result.result.error });
    }
  }

  console.log(`\n  ✓ Batch collection complete!`);
  console.log(`    Succeeded    : ${succeeded} responses`);
  console.log(`    Errored      : ${errored} responses`);
  console.log(`    Saved        : ${saved} places`);

  if (errors.length > 0) {
    console.log(`\n  Failed requests:`);
    for (const { name, type, error } of errors) {
      console.log(`    - ${name}: ${type} — ${JSON.stringify(error)}`);
    }
  }

  console.log(`\n  Review results: npm run review-descriptions -- --version ${PROMPT_VERSION}-${MODEL_KEY}`);
}

// ---------------------------------------------------------------------------
// Slug conversion (mirrors src/utils/place-slugs.ts)
// ---------------------------------------------------------------------------

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ---------------------------------------------------------------------------
// Metric formatting
// ---------------------------------------------------------------------------

function cToF(c) {
  return c * 9 / 5 + 32;
}

function annualAvg(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmtNum(v, decimals = 0) {
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsd(v) {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function fmtPct(v) {
  return `${v.toFixed(1)}%`;
}

function fmtTemp(fVal) {
  return `${Math.round(fVal)}°F`;
}

/**
 * Format all available metrics for a place into a human-readable block.
 */
function formatMetrics(props) {
  const lines = [];

  // Population
  const popParts = [];
  if (props.population) popParts.push(`Population: ${fmtNum(props.population)}`);
  if (props.density) popParts.push(`Density: ${fmtNum(props.density)}/sq mi`);
  if (props.area) popParts.push(`Area: ${fmtNum(props.area, 1)} mi²`);
  if (popParts.length) lines.push(popParts.join(" | "));

  // Housing & Income
  const housing = props.housing;
  if (housing) {
    const hParts = [];
    if (housing.homeValue) hParts.push(`Median Home Value: ${fmtUsd(housing.homeValue)}`);
    if (housing.rent) hParts.push(`Median Rent: ${fmtUsd(housing.rent)}/mo`);
    if (housing.income) hParts.push(`Median Household Income: ${fmtUsd(housing.income)}/yr`);
    if (hParts.length) lines.push(hParts.join(" | "));
  }

  // Crime
  const crime = props.crime;
  if (crime) {
    const cParts = [];
    if (crime.total != null) cParts.push(`Total: ${fmtNum(crime.total, 1)}`);
    if (crime.violentTotal != null) cParts.push(`Violent: ${fmtNum(crime.violentTotal, 1)}`);
    if (crime.propertyTotal != null) cParts.push(`Property: ${fmtNum(crime.propertyTotal, 1)}`);
    if (crime.homicide != null) cParts.push(`Homicide: ${fmtNum(crime.homicide, 1)}`);
    if (crime.robbery != null) cParts.push(`Robbery: ${fmtNum(crime.robbery, 1)}`);
    if (crime.aggAssault != null) cParts.push(`Agg. Assault: ${fmtNum(crime.aggAssault, 1)}`);
    if (crime.burglary != null) cParts.push(`Burglary: ${fmtNum(crime.burglary, 1)}`);
    if (crime.mvTheft != null) cParts.push(`MV Theft: ${fmtNum(crime.mvTheft, 1)}`);
    if (crime.larceny != null) cParts.push(`Larceny: ${fmtNum(crime.larceny, 1)}`);
    if (cParts.length) lines.push(`Crime (per 100K) — ${cParts.join(" | ")}`);
  }

  // Education
  const edu = props.education;
  if (edu) {
    const eParts = [];
    if (edu.bachPlus != null) eParts.push(`Bachelor's+: ${fmtPct(edu.bachPlus)}`);
    if (edu.gradPlus != null) eParts.push(`Graduate+: ${fmtPct(edu.gradPlus)}`);
    if (edu.hsPlus != null) eParts.push(`High School+: ${fmtPct(edu.hsPlus)}`);
    if (eParts.length) lines.push(`Education — ${eParts.join(" | ")}`);
  }

  // Race & Ethnicity
  const race = props.race;
  if (race) {
    const rParts = [];
    if (race.white != null) rParts.push(`White: ${fmtPct(race.white)}`);
    if (race.hispanic != null) rParts.push(`Hispanic/Latino: ${fmtPct(race.hispanic)}`);
    if (race.black != null) rParts.push(`Black: ${fmtPct(race.black)}`);
    if (race.asian != null) rParts.push(`Asian: ${fmtPct(race.asian)}`);
    if (race.other != null) rParts.push(`Other: ${fmtPct(race.other)}`);
    if (rParts.length) lines.push(`Race & Ethnicity — ${rParts.join(" | ")}`);
  }

  // Age
  const age = props.age;
  if (age) {
    const aParts = [];
    if (age.medianAge != null) aParts.push(`Median Age: ${fmtNum(age.medianAge, 1)}`);
    if (age.under18 != null) aParts.push(`Under 18: ${fmtPct(age.under18)}`);
    if (age.age18_34 != null) aParts.push(`18–34: ${fmtPct(age.age18_34)}`);
    if (age.age35_64 != null) aParts.push(`35–64: ${fmtPct(age.age35_64)}`);
    if (age.age65plus != null) aParts.push(`65+: ${fmtPct(age.age65plus)}`);
    if (aParts.length) lines.push(`Age — ${aParts.join(" | ")}`);
  }

  // Poverty
  if (props.poverty != null) {
    lines.push(`Poverty Rate: ${fmtPct(props.poverty)}`);
  }

  // Climate — Temperature (annual averages, converted to °F)
  const climate = props.climate;
  if (climate) {
    const tParts = [];
    const tmax = annualAvg(climate.tmax);
    const tavg = annualAvg(climate.tavg);
    const tmin = annualAvg(climate.tmin);
    if (tmax != null) tParts.push(`Day High: ${fmtTemp(cToF(tmax))}`);
    if (tavg != null) tParts.push(`Average: ${fmtTemp(cToF(tavg))}`);
    if (tmin != null) tParts.push(`Night Low: ${fmtTemp(cToF(tmin))}`);
    if (tParts.length) lines.push(`Temperature (annual avg) — ${tParts.join(" | ")}`);

    // Sunshine
    const sun = annualAvg(climate.sunNsrdb) ?? annualAvg(climate.sunEra5);
    if (sun != null) lines.push(`Sunshine: ${(Math.round(sun * 10) / 10).toFixed(1)} hrs/day`);
  }

  // Schools
  const schools = props.schools;
  if (schools) {
    const sParts = [];
    if (schools.ela != null) sParts.push(`Avg ELA (DFS): ${schools.ela >= 0 ? "+" : ""}${schools.ela.toFixed(1)}`);
    if (schools.math != null) sParts.push(`Avg Math (DFS): ${schools.math >= 0 ? "+" : ""}${schools.math.toFixed(1)}`);
    if (schools.graduationRate != null) sParts.push(`Avg Graduation Rate: ${fmtPct(schools.graduationRate)}`);
    if (schools.schoolCount != null) sParts.push(`School Count: ${schools.schoolCount}`);
    if (sParts.length) lines.push(`Schools (CDE Dashboard) — ${sParts.join(" | ")}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Diverse sampling for --limit
// ---------------------------------------------------------------------------

/**
 * Pick N diverse places sorted by population spread (large, mid, small).
 */
function diverseSample(features, n) {
  if (n <= 0 || n >= features.length) return features;

  // Sort by population descending
  const sorted = [...features].sort((a, b) => (b.properties.population ?? 0) - (a.properties.population ?? 0));

  // Pick evenly spaced indices
  const step = (sorted.length - 1) / (n - 1);
  const picked = new Set();
  const result = [];

  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * step);
    if (!picked.has(idx)) {
      picked.add(idx);
      result.push(sorted[idx]);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// ETA helper
// ---------------------------------------------------------------------------

function formatEta(remainingCalls) {
  // Each call takes ~13s (rate limit) + API response time
  const estSecondsPerCall = 15;
  const totalSec = remainingCalls * estSecondsPerCall;
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) return `${Math.ceil(totalSec / 60)}min`;
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.ceil((totalSec % 3600) / 60);
  return `${hrs}h ${mins}min`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("AI Description Generator");
  console.log("=".repeat(60));
  console.log(`  Prompt version : ${PROMPT_VERSION}`);
  console.log(`  Model          : ${MODEL_KEY}`);
  console.log(`  Output         : ${OUTPUT_DIR}`);
  console.log(`  Limit          : ${LIMIT || "all"}`);
  console.log(`  Names filter   : ${NAMES_FILTER.length ? NAMES_FILTER.join(", ") : "none (all places)"}`);
  console.log(`  Type filter    : ${TYPE_FILTER}`);
  console.log(`  Mode           : ${BATCH_SUBMIT ? "batch submit" : BATCH_STATUS ? "batch status" : BATCH_COLLECT ? "batch collect" : DRY_RUN ? "dry run" : "synchronous"}`);
  if (!BATCH_STATUS && !BATCH_COLLECT) {
    console.log(`  Rate limit     : ${MIN_REQUEST_INTERVAL_MS / 1000}s between requests (~${(60000 / MIN_REQUEST_INTERVAL_MS).toFixed(1)} RPM)`);
    console.log(`  Retries        : handled by Anthropic SDK (automatic backoff on 429/5xx)`);
  }
  console.log("=".repeat(60));

  // Handle batch status/collect early (no need to load GeoJSON or prompts)
  if (BATCH_STATUS) {
    await batchStatus();
    return;
  }
  if (BATCH_COLLECT) {
    await batchCollect();
    return;
  }

  // Validate model
  if (!MODEL_PROVIDERS[MODEL_KEY]) {
    console.error(`\nError: Unknown model "${MODEL_KEY}". Available: ${Object.keys(MODEL_PROVIDERS).join(", ")}`);
    process.exit(1);
  }

  // Read prompt templates
  const promptDir = join(PROMPTS_DIR, PROMPT_VERSION);
  if (!existsSync(promptDir)) {
    console.error(`\nError: Prompt directory not found: ${promptDir}`);
    process.exit(1);
  }

  const summaryPromptTemplate = readFileSync(join(promptDir, "summary.md"), "utf-8");

  // Initialize model provider (validates API key — skip for batch submit, it creates its own client)
  const provider = BATCH_SUBMIT
    ? { displayName: "BATCH", generate: async () => "" }
    : DRY_RUN ? { displayName: "DRY RUN", generate: async () => "[dry run]" } : MODEL_PROVIDERS[MODEL_KEY]();
  console.log(`\n  Provider       : ${provider.displayName}\n`);

  // Read GeoJSON data
  const geojsonFiles = {
    county: join(DATA_DIR, "california-county-labels.geojson"),
    city: join(DATA_DIR, "california-city-labels.geojson"),
  };

  // First pass: count total work for ETA
  const types = TYPE_FILTER === "both" ? ["county", "city"] : [TYPE_FILTER];
  const workItems = []; // { placeType, feature }[]

  for (const placeType of types) {
    const geojsonPath = geojsonFiles[placeType];
    if (!existsSync(geojsonPath)) continue;

    const geojson = JSON.parse(readFileSync(geojsonPath, "utf-8"));
    let features = geojson.features.filter((f) => f.properties?.name);

    if (NAMES_FILTER.length > 0) {
      const lowerNames = NAMES_FILTER.map((n) => n.toLowerCase());
      features = features.filter((f) => lowerNames.includes(f.properties.name.toLowerCase()));
      const found = features.map((f) => f.properties.name);
      const missing = NAMES_FILTER.filter((n) => !found.some((f) => f.toLowerCase() === n.toLowerCase()));
      if (missing.length > 0) {
        console.log(`  ⚠ Not found in ${placeType} data: ${missing.join(", ")}`);
      }
    }

    if (NAMES_FILTER.length === 0 && LIMIT > 0) {
      features = diverseSample(features, LIMIT);
    }

    for (const feature of features) {
      workItems.push({ placeType, feature });
    }
  }

  // Count how many are already done vs pending
  let pendingCount = 0;
  for (const { placeType, feature } of workItems) {
    const slug = nameToSlug(feature.properties.name);
    const outPath = join(OUTPUT_DIR, placeType, `${slug}.json`);
    if (existsSync(outPath)) {
      try {
        const existing = JSON.parse(readFileSync(outPath, "utf-8"));
        if (existing.summary) continue;
      } catch { /* corrupted, will regenerate */ }
    }
    pendingCount++;
  }

  const pendingCalls = pendingCount; // 1 API call per place
  console.log(`  Total places   : ${workItems.length}`);
  console.log(`  Already done   : ${workItems.length - pendingCount}`);
  console.log(`  Pending        : ${pendingCount}`);
  console.log(`  API calls      : ${pendingCalls}`);
  if (!DRY_RUN && !BATCH_SUBMIT && pendingCount > 0) {
    console.log(`  Estimated time : ${formatEta(pendingCalls)}`);
  }
  if (BATCH_SUBMIT) {
    console.log(`  Cost savings   : 50% vs synchronous mode`);
  }
  console.log();

  // Dispatch to batch submit if requested
  if (BATCH_SUBMIT) {
    await batchSubmit(workItems, summaryPromptTemplate);
    return;
  }

  // Synchronous processing
  const stats = { generated: 0, skipped: 0, errors: 0, errorList: [] };
  const startTime = Date.now();
  let processedCount = 0;

  for (const { placeType, feature } of workItems) {
    const props = feature.properties;
    const name = props.name;
    const slug = nameToSlug(name);
    const typeDir = join(OUTPUT_DIR, placeType);
    mkdirSync(typeDir, { recursive: true });
    const outPath = join(typeDir, `${slug}.json`);
    const displayName = placeType === "county" ? `${name} County` : name;
    processedCount++;

    // Resume: skip if already generated
    if (existsSync(outPath)) {
      try {
        const existing = JSON.parse(readFileSync(outPath, "utf-8"));
        if (existing.summary) {
          stats.skipped++;
          console.log(`  [${processedCount}/${workItems.length}] ⏭  ${displayName} (already done)`);
          continue;
        }
      } catch { /* corrupted file, regenerate */ }
    }

    console.log(`  [${processedCount}/${workItems.length}] ⏳ ${displayName}...`);

    const metricsBlock = formatMetrics(props);

    // Build prompt
    const summaryPrompt = summaryPromptTemplate
      .replace("{PLACE_NAME}", name)
      .replace("{PLACE_TYPE}", placeType)
      .replace("{KEY_METRICS}", metricsBlock);

    if (DRY_RUN) {
      console.log(`\n--- SUMMARY PROMPT for ${displayName} ---\n${summaryPrompt}\n`);
      stats.generated++;
      continue;
    }

    try {
      // Generate description (SDK handles retries + rate limit backoff)
      const summary = await provider.generate(summaryPrompt);

      // Save immediately (crash-safe)
      writeFileSync(outPath, JSON.stringify({ summary }, null, 2) + "\n");

      stats.generated++;

      // ETA based on actual elapsed time
      const elapsedMs = Date.now() - startTime;
      const avgMsPerPlace = elapsedMs / stats.generated;
      const remaining = pendingCount - stats.generated;
      const etaSec = Math.ceil((remaining * avgMsPerPlace) / 1000);
      const etaStr = etaSec < 60 ? `${etaSec}s` : etaSec < 3600 ? `${Math.ceil(etaSec / 60)}min` : `${Math.floor(etaSec / 3600)}h ${Math.ceil((etaSec % 3600) / 60)}min`;

      console.log(`  [${processedCount}/${workItems.length}] ✓  ${displayName}  (ETA: ${etaStr} remaining)`);
    } catch (err) {
      stats.errors++;
      stats.errorList.push({ name: displayName, error: err.message });
      console.error(`  [${processedCount}/${workItems.length}] ✗  ${displayName}: ${err.message}`);
    }
  }

  // Summary
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`  Generated : ${stats.generated}`);
  console.log(`  Skipped   : ${stats.skipped} (already existed)`);
  console.log(`  Errors    : ${stats.errors}`);
  console.log(`  Duration  : ${totalSec}s`);

  if (stats.errorList.length > 0) {
    console.log("\nFailed places (re-run to retry):");
    for (const { name, error } of stats.errorList) {
      console.log(`  - ${name}: ${error}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
