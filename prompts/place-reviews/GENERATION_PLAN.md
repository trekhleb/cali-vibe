# AI Description Generation Plan

## Goal

Generate a single AI-written summary for every California city (~700) and county (~58) in CaliVibe:
- **The Gist** — data-driven narrative summary combining surprising insights with clear tradeoff analysis, grounded in specific metrics

The description is displayed in the place detail modal (`place-detail-modal.tsx`) under a tab labeled "The Gist" (violet theme). The tab infrastructure supports adding more tabs in the future. Each tab has an "AI-Generated Summary Based on Actual Location Metrics. For entertainment purposes only — not housing or relocation advice." disclaimer tag.

## Prompts

Prompts are versioned in `prompts/place-reviews/{version}/`:
- `summary.md` — The Gist prompt template

### Prompt placeholders
- `{PLACE_NAME}` — e.g., "Sunnyvale", "Alameda"
- `{PLACE_TYPE}` — "city" or "county"
- `{KEY_METRICS}` — formatted metrics block (human-readable, not raw JSON)

### Metrics format for the prompt
The script should format metrics in a clean, readable way for the LLM:
```
Population: 83,245 | Density: 2,100/sq mi | Area: 18.2 mi²
Median Home Value: $1,200,000 | Median Rent: $2,800/mo | Median Household Income: $145,000/yr
Crime (per 100K) — Total: 120.5 | Violent: 45.2 | Property: 75.3
Education — Bachelor's+: 62.5% | Graduate+: 28.1% | High School+: 95.2%
Temperature (annual avg) — Day High: 72°F | Average: 61°F | Night Low: 50°F
Sunshine: 8.5 hrs/day
Poverty Rate: 5.2%
...
```

### Content safety guardrails
The prompt includes a **"Content safety — strict rules"** section that instructs the model to:
- Never reference racial, ethnic, or religious composition — even positively
- Never discourage/encourage moving based on who lives there
- Never imply a place is unsafe for specific groups
- Never reference cultural communities, enclaves, or ethnic neighborhoods
- Never use language that could be interpreted as housing discrimination or steering (Fair Housing Act)
- Frame crime around infrastructure/policy, never stigmatize residents
- No political commentary or partisan framing

These rules are critical for avoiding legal risk (Fair Housing Act, defamation) and reputational harm.

## Data Sources

All metrics come from existing GeoJSON files (already in the project):
- `public/data/california-county-labels.geojson` — 58 counties
- `public/data/california-city-labels.geojson` — ~700 cities

Each feature's `properties` object contains: `name`, `population`, `density`, `area`, `crime`, `housing`, `education`, `race`, `age`, `poverty`, `climate`, `schools`.

### Metric extraction
Use the same `getNestedValue` logic as in `place-detail-modal.tsx`. Climate data needs hydration:
- Temperature: `climate.tmax`, `climate.tavg`, `climate.tmin` — arrays of 12 monthly values (°C). Convert to °F. Use annual average for the prompt.
- Sunshine: `climate.sunNsrdb` — array of 12 monthly values (hours/day). Use annual average.

## Output Structure

### File layout
```
public/data/descriptions/
  v1-sonnet/
    county/
      alameda.json
      alpine.json
      ...
    city/
      sunnyvale.json
      oakland.json
      ...
  v1-gpt4o/          (future alternative model run)
    county/...
    city/...
  v2-sonnet/          (future prompt revision)
    county/...
    city/...
```

### Version naming convention
`{prompt-version}-{model}` — e.g., `v1-sonnet`, `v1-gpt4o`, `v2-sonnet`

### Per-place JSON format
Each file contains one description:
```json
{
  "summary": "Here's what might surprise you about San Ramon..."
}
```

### Active version in the app
A single constant controls which version the app loads:
```ts
const DESCRIPTIONS_VERSION = "v1-opus";
// fetch URL: `${BASE_URL}data/descriptions/${DESCRIPTIONS_VERSION}/city/${slug}.json`
```
Change one line to switch all descriptions. The modal fetches per-place JSON on demand using `fetchJsonCached`.

## Generation Script

### Location
`scripts/generate-descriptions.mjs`

### CLI interface — Synchronous mode (test/debug)
```bash
# Test run: specific places you know well (best for evaluating quality)
npm run generate-descriptions -- --prompt v1 --model sonnet \
  --names "San Ramon,Sunnyvale,Cupertino,Half Moon Bay,Los Gatos,San Francisco,Santa Clara,Los Angeles,Orange,San Diego"

# Test run: 5 diverse places per type (auto-sampled by population spread)
npm run generate-descriptions -- --prompt v1 --model sonnet --limit 5

# Target only counties or cities with --type
npm run generate-descriptions -- --prompt v1 --model sonnet --names "San Diego" --type county

# Full synchronous run (all places)
npm run generate-descriptions -- --prompt v1 --model sonnet

# Resume interrupted run (skips existing files automatically)
npm run generate-descriptions -- --prompt v1 --model sonnet

# Dry run (print prompts without calling API)
npm run generate-descriptions -- --prompt v1 --model sonnet --names "San Ramon" --dry-run
```

### CLI interface — Batch mode (production runs, 50% cheaper)
```bash
# Step 1: Submit all pending places as an async batch
npm run generate-descriptions -- --prompt v1 --model sonnet --batch

# Step 2: Check batch progress (run anytime, as many times as you want)
npm run generate-descriptions -- --prompt v1 --model sonnet --batch-status

# Step 3: Download results when batch is complete
npm run generate-descriptions -- --prompt v1 --model sonnet --batch-collect

# Review the results
npm run review-descriptions -- --version v1-sonnet
```

### Batch mode — how it works

1. **`--batch`** reads all GeoJSON data, builds prompts for every pending place (skips places that already have JSON files), and submits them all as a single Anthropic Message Batch. Saves batch state to `.batch-state.json` in the output directory.

2. **`--batch-status`** reads `.batch-state.json`, calls the Anthropic API to check progress, and prints a status report showing how many requests succeeded/processing/errored/expired.

3. **`--batch-collect`** downloads results from the completed batch, maps each response back to its place using the `custom_id` (format: `{placeType}/{slug}`), and saves per-place JSON files. Failed or expired requests are logged — re-run `--batch` to retry only the missing places.

**Batch state file** (`public/data/descriptions/v1-sonnet/.batch-state.json`):
- Stores batch ID, model info, submission timestamp, and metadata mapping each `custom_id` to its place name/type
- Automatically created on `--batch`, read by `--batch-status` and `--batch-collect`
- Safe to delete after `--batch-collect` is done

**Cost**: Batch mode is 50% cheaper than synchronous mode. All ~758 places at Sonnet pricing: ~$2.50–4 total (1 API call per place instead of 2).

**Timing**: Batches complete within 24 hours, but often much faster (minutes to a few hours depending on load).

### npm scripts
```json
{
  "generate-descriptions": "node scripts/generate-descriptions.mjs",
  "review-descriptions": "node scripts/review-descriptions.mjs",
  "audit-descriptions": "node scripts/audit-descriptions.mjs"
}
```

### Flags
- `--prompt <version>` — prompt version (reads from `prompts/place-reviews/{version}/`)
- `--model <name>` — model key (`sonnet`, `opus`, `haiku`, `gpt4o`, `gemini`)
- `--limit <n>` — N places per type (diverse sampling, ignored when `--names` is used)
- `--names <list>` — comma-separated place names (e.g., `"San Ramon,Sunnyvale"`). Case-insensitive match against both county and city GeoJSON. Shared names (e.g., "San Diego") generate both unless `--type` restricts it.
- `--type <type>` — restrict to `"county"` or `"city"` (default: `"both"`)
- `--rpm <n>` — target requests per minute (default: 40, 20% safety margin applied automatically)
- `--dry-run` — print prompts without calling the API
- `--batch` — submit as async batch (50% cheaper, up to 24h)
- `--batch-status` — check batch progress
- `--batch-collect` — download completed batch results to JSON files
- Output folder is auto-derived: `public/data/descriptions/{prompt}-{model}/`

### Resume logic
Both synchronous and batch modes support resume:
- **Synchronous**: on startup, skips any place that already has a valid JSON file with a `summary` key. Ctrl+C anytime and re-run.
- **Batch**: `--batch` skips already-completed places when building the request list. If a batch partially fails, `--batch-collect` saves what succeeded, then `--batch` can be run again to retry only the missing places.

### Smart test sampling (`--limit`)
When `--limit N` is used, pick a diverse mix, not just the first N alphabetically:
- Large/major places (high population)
- Mid-size suburbs
- Small/rural places
- Places with sparse data (to test prompt robustness)

Implementation: sort by population, then pick evenly spaced samples across the range.

### Error handling
- Synchronous: if a single generation fails, log the error, skip the place, continue. Summary at end.
- Batch: errored/expired requests are logged during `--batch-collect`. Re-run `--batch` to retry.
- Never overwrite a valid existing file with an error.

## Review Script

### Location
`scripts/review-descriptions.mjs`

### CLI interface
```bash
# Print all generated descriptions for review
npm run review-descriptions -- --version v1-sonnet

# Review only test run results
npm run review-descriptions -- --version v1-sonnet --limit 5

# Review only cities
npm run review-descriptions -- --version v1-sonnet --type city

# Safety scan — flag descriptions with potentially sensitive content
npm run review-descriptions -- --version v1-sonnet --scan
```

Prints each place's descriptions to the terminal in a readable format for quick scanning and comparison.

### Safety scan (`--scan`)
The `--scan` flag runs all generated descriptions through a keyword-based content filter that flags potentially problematic content across categories:
- **Race/ethnicity** — racial terms, nationality references, demographic characterizations ("diverse community", "melting pot")
- **Religion** — religious groups, places of worship
- **Socioeconomic stigma** — class-based slurs, stereotypes about neighborhoods
- **Vulnerable populations** — references to homelessness, addiction
- **Crime stigma** — language that stigmatizes residents rather than critiquing policy
- **Political content** — partisan terms, political figures
- **Housing steering** — language discouraging moves based on demographics
- **Immigration, gender/sexuality, disability** — sensitive references

When a flag is found, the scan prints the matched keyword, its category, and surrounding context. **Always run `--scan` before committing generated descriptions.** Flagged content should be manually reviewed — some flags may be false positives (e.g., "church" used as a street name), but all should be checked.

## AI Legal Audit Script

### Location
`scripts/audit-descriptions.mjs`

### Purpose
Sends each generated description to Claude Opus for automated legal/safety compliance review. Checks for Fair Housing Act violations, demographic references, audience targeting, unverifiable claims, crime stigma, political content, invented names, and promotional tone.

### Review prompt
`prompts/place-reviews/v1/legal-review.md` — instructs the reviewer model to check 10 specific violation categories and return structured JSON.

### CLI interface
```bash
# Run audit (resumes automatically from where it left off)
npm run audit-descriptions -- --version v1-opus

# Audit only cities
npm run audit-descriptions -- --version v1-opus --type city

# Audit specific places
npm run audit-descriptions -- --version v1-opus --names "San Ramon,Los Angeles"

# Test with a few places first
npm run audit-descriptions -- --version v1-opus --limit 5

# View full report from journal
npm run audit-descriptions -- --version v1-opus --report

# View only flagged descriptions
npm run audit-descriptions -- --version v1-opus --report --flagged-only

# Reset a place to force re-review (e.g., after regenerating its description)
npm run audit-descriptions -- --version v1-opus --reset "San Ramon"
```

### Journal file
`.audit-journal.json` in the version directory (gitignored). Tracks every reviewed place with pass/flag status, issue list, and timestamp. Saved after each review — safe to cancel anytime.

### Resume logic
On startup, the script loads the journal and skips any place already reviewed. Errors are NOT saved to the journal, so they get retried automatically on next run.

### Workflow
1. Generate descriptions (generate-descriptions.mjs)
2. Keyword scan: `npm run review-descriptions -- --version v1-opus --scan`
3. AI audit: `npm run audit-descriptions -- --version v1-opus`
4. Review flags: `npm run audit-descriptions -- --version v1-opus --report --flagged-only`
5. Fix flagged descriptions (regenerate or manually edit)
6. Reset fixed places: `npm run audit-descriptions -- --version v1-opus --reset "Place Name"`
7. Re-run audit for reset places
8. Commit when all pass

## Model Recommendation

### Primary: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- Excellent creative writing with constraints
- Fast, cost-effective
- Synchronous: ~$5–8 for all ~758 generations (1 per place)
- **Batch: ~$2.50–4 (50% discount)**
- Quality very close to Opus for single-paragraph creative descriptions

### API: Anthropic SDK (`@anthropic-ai/sdk`)
- Official SDK with built-in retries, rate limit handling, and batch support
- Requires `ANTHROPIC_API_KEY` in `.env` file (see `.env.example`)

### Alternative models to try later
- Claude Opus — higher quality, 5–10x more expensive
- GPT-4o — different style/voice, for comparison
- Gemini — another option for comparison

## Workflow

### Prompt tuning phase (synchronous mode)
1. Run with `--names` for places you know well
2. Review outputs — check tone, data accuracy, insight quality, readability
3. Tweak prompt if needed (still v1 while iterating)
4. Repeat until happy

### Production run (batch mode)
1. Freeze prompt as final v1
2. Submit batch: `npm run generate-descriptions -- --prompt v1 --model opus --batch`
3. Check progress: `npm run generate-descriptions -- --prompt v1 --model opus --batch-status`
4. Collect results: `npm run generate-descriptions -- --prompt v1 --model opus --batch-collect`
5. Keyword scan: `npm run review-descriptions -- --version v1-opus --scan`
6. AI legal audit: `npm run audit-descriptions -- --version v1-opus`
7. Review flagged items: `npm run audit-descriptions -- --version v1-opus --report --flagged-only`
8. Fix flagged descriptions, reset, and re-audit until clean
9. Full human review: `npm run review-descriptions -- --version v1-opus`
10. Commit generated files to repo

### Model comparison (optional)
1. Same prompt v1, different model: `--prompt v1 --model gpt4o`
2. Compare `v1-sonnet` vs `v1-gpt4o` descriptions
3. Pick the winner, set as active version

## Integration with the App

### Modal changes needed
- In `place-detail-modal.tsx`, add a `useEffect` that fetches the description JSON when the modal opens
- Use `fetchJsonCached` for caching
- Display the text in the tab panel
- Show a loading state while fetching
- Gracefully handle missing descriptions (show placeholder text)

### Slug conversion
Place names need to be converted to URL-safe slugs for file paths. Use the existing `nameToSlug` utility from `src/utils/place-slugs.ts`. Example: "San Francisco" → `san-francisco`, "Los Angeles" → `los-angeles`.

## Hosting Constraints
- Static files only (GitHub Pages)
- All descriptions are pre-generated at build time (no runtime API calls)
- Per-place files avoid loading all descriptions at once
- `fetchJsonCached` handles caching for repeat views within a session
