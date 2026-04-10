# URL Architecture & SEO Strategy

## Path-Based URL Migration (from query params)

The app currently uses query parameters for all state (`?schools=1&temp=0`). Migrating to path-based URLs because:
- Social platforms (HackerNews, Reddit) strip query params and deduplicate URLs
- Static meta/OG tags — all views share the same `<title>` and `og:image`
- Canonical URL consolidates all views into one page for search engines

### Chosen approach: Build-time HTML templating (Option 1)

- Post-build script generates a directory per route, each with its own `index.html`
- Each `index.html` has unique `<title>`, `<meta description>`, OG tags
- All load the same JS bundle — React reads `window.location.pathname` to determine active layer
- No framework migration, no headless browser, no server needed
- Stays compatible with GitHub Pages static hosting

### URL patterns

**Layer views (multi-segment, Option B):**
```
/cali-vibe/schools
/cali-vibe/housing/rent
/cali-vibe/housing+crime
/cali-vibe/schools/math+temp
/cali-vibe/counties+housing+transit
```

- Multi-layer combos use `+` separator
- Canonical ordering defined by fixed layer priority (never `/crime+housing`, always `/housing+crime`)
- Metrics slot after their layer: `/housing/rent+crime/robbery`
- Only single-layer pages are pre-generated; combos work client-side with generic `<head>` fallback
- Display preferences (style, relief) remain as query params

**Layer priority order:**
counties, cities, pop, cityPop, housing, cityHousing, income, cityIncome, crime, cityCrime, edu, cityEdu, schools, race, cityRace, age, cityAge, pov, cityPov, temp, shine, transit, peaks

### Future: County & City pages

```
/cali-vibe/county/san-francisco
/cali-vibe/county/alameda
/cali-vibe/city/san-jose
/cali-vibe/city/oakland
/cali-vibe/compare/counties/san-francisco,alameda
/cali-vibe/compare/cities/san-jose,oakland
```

**Dual rendering mode:**
- Direct navigation / search engine → full standalone page with static SEO content (data tables, auto-generated descriptions)
- Click from within the map → modal/popup overlay on top of map

**Blurred map background on county/city pages:**
- Map loads behind the modal, shown blurred
- Gives users visual hint of the interactive map to encourage exploration
- "Explore on map" CTA converts SEO traffic into engaged map users
- Reduces bounce rate; closing modal reveals full interactive map already loaded

**Why:** These pages are data-driven text content (no WebGL), so build-time generation produces real pre-rendered HTML that crawlers can fully index.
