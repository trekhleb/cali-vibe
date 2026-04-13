#!/usr/bin/env node

/**
 * AI-powered legal/safety audit for generated place descriptions.
 * Sends each description to Claude Opus for compliance review and tracks
 * progress in a local journal file (gitignored).
 *
 * Usage:
 *   -- Run audit (resumes automatically) --
 *   node scripts/audit-descriptions.mjs --version v1-opus
 *   node scripts/audit-descriptions.mjs --version v1-opus --type city
 *   node scripts/audit-descriptions.mjs --version v1-opus --names "San Ramon,Los Angeles"
 *   node scripts/audit-descriptions.mjs --version v1-opus --limit 5
 *
 *   -- View results --
 *   node scripts/audit-descriptions.mjs --version v1-opus --report
 *   node scripts/audit-descriptions.mjs --version v1-opus --report --flagged-only
 *
 *   -- Reset a specific place (force re-review) --
 *   node scripts/audit-descriptions.mjs --version v1-opus --reset "San Ramon"
 *
 * Flags:
 *   --version <name>    Description version folder (e.g., "v1-opus")
 *   --type <type>       Audit only "county" or "city" (default: both)
 *   --names <list>      Comma-separated place names to audit
 *   --limit <n>         Audit only first N places per type
 *   --prompt <version>  Prompt version for review template (default: "v1")
 *   --rpm <n>           Target requests per minute (default: 40)
 *   --report            Print audit results from journal (no API calls)
 *   --flagged-only      With --report, show only flagged descriptions
 *   --reset <name>      Remove a place from the journal so it gets re-reviewed
 *
 * Journal file: .audit-journal.json in the version directory (gitignored).
 * Safe to cancel anytime — re-run picks up where it left off.
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data", "descriptions");
const PROMPTS_DIR = join(ROOT, "prompts", "place-reviews");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    version:      { type: "string", default: "" },
    type:         { type: "string", default: "both" },
    names:        { type: "string", default: "" },
    limit:        { type: "string", default: "0" },
    prompt:       { type: "string", default: "v1" },
    rpm:          { type: "string", default: "40" },
    report:       { type: "boolean", default: false },
    "flagged-only": { type: "boolean", default: false },
    reset:        { type: "string", default: "" },
  },
});

const VERSION = args.version;
const TYPE_FILTER = args.type;
const NAMES_FILTER = args.names ? args.names.split(",").map((n) => n.trim()) : [];
const LIMIT = parseInt(args.limit, 10) || 0;
const PROMPT_VERSION = args.prompt;
const TARGET_RPM = parseInt(args.rpm, 10) || 40;
const REPORT_MODE = args.report;
const FLAGGED_ONLY = args["flagged-only"];
const RESET_NAME = args.reset;

if (!VERSION) {
  if (existsSync(DATA_DIR)) {
    const versions = readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    console.log("Available versions:", versions.join(", ") || "(none)");
  }
  console.error("\nUsage: node scripts/audit-descriptions.mjs --version <name>");
  process.exit(1);
}

const VERSION_DIR = join(DATA_DIR, VERSION);
const JOURNAL_PATH = join(VERSION_DIR, ".audit-journal.json");

if (!existsSync(VERSION_DIR)) {
  console.error(`Error: Version directory not found: ${VERSION_DIR}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Journal — persistent progress tracker
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AuditEntry
 * @property {boolean} pass
 * @property {string[]} [issues]
 * @property {string} reviewedAt
 */

/**
 * @typedef {Object} AuditJournal
 * @property {string} version
 * @property {string} reviewModel
 * @property {string} promptVersion
 * @property {string} startedAt
 * @property {string} updatedAt
 * @property {Record<string, AuditEntry>} results
 */

/** @returns {AuditJournal} */
function loadJournal() {
  if (existsSync(JOURNAL_PATH)) {
    try {
      return JSON.parse(readFileSync(JOURNAL_PATH, "utf-8"));
    } catch {
      console.warn("  Warning: corrupted journal, starting fresh.");
    }
  }
  return {
    version: VERSION,
    reviewModel: "opus",
    promptVersion: PROMPT_VERSION,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    results: {},
  };
}

function saveJournal(journal) {
  journal.updatedAt = new Date().toISOString();
  writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + "\n");
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
// Collect all description files
// ---------------------------------------------------------------------------

function collectDescriptions() {
  const types = TYPE_FILTER === "both" ? ["county", "city"] : [TYPE_FILTER];
  const items = []; // { placeType, slug, name, filePath }[]

  for (const placeType of types) {
    const typeDir = join(VERSION_DIR, placeType);
    if (!existsSync(typeDir)) continue;

    let files = readdirSync(typeDir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("."))
      .sort();

    for (const file of files) {
      const slug = basename(file, ".json");
      const filePath = join(typeDir, file);

      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        if (!data.summary) continue;

        // Derive display name from slug (best-effort reverse)
        const name = slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        items.push({ placeType, slug, name, filePath, summary: data.summary });
      } catch {
        console.warn(`  Warning: could not read ${file}`);
      }
    }
  }

  // Apply name filter
  if (NAMES_FILTER.length > 0) {
    const lowerNames = NAMES_FILTER.map((n) => nameToSlug(n));
    const filtered = items.filter((item) => lowerNames.includes(item.slug));
    return filtered;
  }

  // Apply limit
  if (LIMIT > 0) {
    return items.slice(0, LIMIT);
  }

  return items;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const SAFE_RPM = TARGET_RPM * 0.8;
const MIN_REQUEST_INTERVAL_MS = Math.ceil(60_000 / SAFE_RPM);
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
    const waitSec = (waitMs / 1000).toFixed(1);
    process.stdout.write(`    rate limit: waiting ${waitSec}s...`);
    await new Promise((r) => setTimeout(r, waitMs));
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Report mode — print journal results
// ---------------------------------------------------------------------------

function printReport() {
  const journal = loadJournal();
  const results = journal.results;
  const keys = Object.keys(results).sort();

  if (keys.length === 0) {
    console.log("\n  No audit results yet. Run without --report to start auditing.");
    return;
  }

  let passCount = 0;
  let flagCount = 0;
  let totalIssues = 0;

  console.log("\n" + "=".repeat(70));
  console.log(`  AUDIT REPORT — ${VERSION}`);
  console.log(`  Model: ${journal.reviewModel} | Prompt: ${journal.promptVersion}`);
  console.log(`  Last updated: ${journal.updatedAt}`);
  console.log("=".repeat(70));

  for (const key of keys) {
    const entry = results[key];
    if (entry.pass) {
      passCount++;
      if (!FLAGGED_ONLY) {
        console.log(`\n  PASS  ${key}`);
      }
    } else {
      flagCount++;
      totalIssues += entry.issues?.length || 0;
      console.log(`\n  FLAG  ${key}`);
      if (entry.issues) {
        for (const issue of entry.issues) {
          console.log(`        - ${issue}`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`  Total reviewed : ${keys.length}`);
  console.log(`  Passed         : ${passCount}`);
  console.log(`  Flagged        : ${flagCount}`);
  console.log(`  Total issues   : ${totalIssues}`);
  console.log("=".repeat(70) + "\n");
}

// ---------------------------------------------------------------------------
// Reset mode — remove a place from the journal
// ---------------------------------------------------------------------------

function resetPlace() {
  const journal = loadJournal();
  const slug = nameToSlug(RESET_NAME);

  // Try both county and city keys
  let removed = false;
  for (const prefix of ["county", "city"]) {
    const key = `${prefix}/${slug}`;
    if (journal.results[key]) {
      delete journal.results[key];
      console.log(`  Removed: ${key}`);
      removed = true;
    }
  }

  if (!removed) {
    console.log(`  No journal entry found for "${RESET_NAME}" (slug: ${slug})`);
    return;
  }

  saveJournal(journal);
  console.log("  Journal updated. Re-run audit to re-review this place.");
}

// ---------------------------------------------------------------------------
// Main audit loop
// ---------------------------------------------------------------------------

async function runAudit() {
  // Load review prompt template
  const promptPath = join(PROMPTS_DIR, PROMPT_VERSION, "legal-review.md");
  if (!existsSync(promptPath)) {
    console.error(`Error: Review prompt not found: ${promptPath}`);
    process.exit(1);
  }
  const reviewPromptTemplate = readFileSync(promptPath, "utf-8");

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey, maxRetries: 5 });
  const modelId = "claude-opus-4-6";

  // Collect descriptions
  const items = collectDescriptions();
  if (items.length === 0) {
    console.log("\n  No descriptions found to audit.");
    return;
  }

  // Load journal and determine pending work
  const journal = loadJournal();
  const pending = items.filter((item) => {
    const key = `${item.placeType}/${item.slug}`;
    return !journal.results[key];
  });

  console.log("\n" + "=".repeat(60));
  console.log("  AI Legal Audit");
  console.log("=".repeat(60));
  console.log(`  Version        : ${VERSION}`);
  console.log(`  Review model   : ${modelId}`);
  console.log(`  Review prompt  : ${PROMPT_VERSION}/legal-review.md`);
  console.log(`  Total descs    : ${items.length}`);
  console.log(`  Already audited: ${items.length - pending.length}`);
  console.log(`  Pending        : ${pending.length}`);
  console.log(`  Journal        : ${JOURNAL_PATH}`);
  console.log("=".repeat(60));

  if (pending.length === 0) {
    console.log("\n  All descriptions already audited. Use --report to view results.");
    return;
  }

  const stats = { passed: 0, flagged: 0, errors: 0, errorList: [] };
  const startTime = Date.now();
  let processed = 0;

  // Graceful shutdown on Ctrl+C — save journal before exiting
  let interrupted = false;
  const onInterrupt = () => {
    if (interrupted) process.exit(1); // second Ctrl+C = force quit
    interrupted = true;
    console.log("\n\n  Interrupted! Saving journal...");
    saveJournal(journal);
    console.log(`  Journal saved. ${processed} places audited this session.`);
    console.log("  Re-run to continue from where you left off.\n");
    process.exit(0);
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);

  for (const item of pending) {
    if (interrupted) break;

    processed++;
    const key = `${item.placeType}/${item.slug}`;
    const displayName = item.placeType === "county" ? `${item.name} County` : item.name;

    console.log(`\n  [${processed}/${pending.length}] Auditing: ${displayName}...`);

    // Build review prompt
    const prompt = reviewPromptTemplate
      .replace("{PLACE_NAME}", item.name)
      .replace("{PLACE_TYPE}", item.placeType)
      .replace("{DESCRIPTION}", item.summary);

    try {
      await waitForRateLimit();

      const message = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const rawText = message.content?.[0]?.type === "text" ? message.content[0].text : null;
      if (!rawText) throw new Error("Empty response from API");

      // Parse JSON response — handle markdown code blocks if model wraps it
      let jsonText = rawText.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }

      const result = JSON.parse(jsonText);

      // Save to journal
      journal.results[key] = {
        pass: !!result.pass,
        ...(result.issues?.length ? { issues: result.issues } : {}),
        reviewedAt: new Date().toISOString(),
      };

      // Save after each entry (crash-safe)
      saveJournal(journal);

      if (result.pass) {
        stats.passed++;
        console.log(`  [${processed}/${pending.length}] PASS  ${displayName}`);
      } else {
        stats.flagged++;
        console.log(`  [${processed}/${pending.length}] FLAG  ${displayName}`);
        if (result.issues) {
          for (const issue of result.issues) {
            console.log(`        - ${issue}`);
          }
        }
      }

      // ETA
      const elapsedMs = Date.now() - startTime;
      const avgMs = elapsedMs / processed;
      const remaining = pending.length - processed;
      const etaSec = Math.ceil((remaining * avgMs) / 1000);
      const etaStr = etaSec < 60 ? `${etaSec}s` : etaSec < 3600 ? `${Math.ceil(etaSec / 60)}min` : `${Math.floor(etaSec / 3600)}h ${Math.ceil((etaSec % 3600) / 60)}min`;
      if (remaining > 0) {
        console.log(`        ETA: ~${etaStr} remaining`);
      }
    } catch (err) {
      stats.errors++;
      stats.errorList.push({ name: displayName, error: err.message });
      console.error(`  [${processed}/${pending.length}] ERROR ${displayName}: ${err.message}`);
      // Do NOT save a journal entry for errors — they'll be retried on next run
    }
  }

  // Final save
  saveJournal(journal);

  // Summary
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n" + "=".repeat(60));
  console.log("  Audit Summary");
  console.log("=".repeat(60));
  console.log(`  Passed    : ${stats.passed}`);
  console.log(`  Flagged   : ${stats.flagged}`);
  console.log(`  Errors    : ${stats.errors} (will be retried on next run)`);
  console.log(`  Duration  : ${totalSec}s`);

  if (stats.errorList.length > 0) {
    console.log("\n  Failed places (re-run to retry):");
    for (const { name, error } of stats.errorList) {
      console.log(`    - ${name}: ${error}`);
    }
  }

  const totalReviewed = Object.keys(journal.results).length;
  const totalFlagged = Object.values(journal.results).filter((r) => !r.pass).length;
  console.log(`\n  Journal totals: ${totalReviewed} reviewed, ${totalFlagged} flagged`);
  console.log(`  View full report: npm run audit-descriptions -- --version ${VERSION} --report`);
  console.log("=".repeat(60) + "\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (REPORT_MODE) {
  printReport();
} else if (RESET_NAME) {
  resetPlace();
} else {
  runAudit().catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  });
}
