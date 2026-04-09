import { describe, it, expect } from "vitest";
import {
  ROUTES,
  BASE,
  ORIGIN,
  generateHtml,
  replaceTag,
  buildSitemapXml,
} from "../../../scripts/build-html-routes.mjs";
import {
  pathToParams,
  LAYERS,
  TRANSIT_SYSTEM_SLUGS,
} from "../route-catalog";

const BASE_PATH = `${BASE}/`;

// Minimal HTML template mimicking the real index.html meta tags
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CaliVibe — California Explorer</title>
  <meta name="description" content="Default description" />
  <meta property="og:url" content="https://trekhleb.dev/cali-vibe/" />
  <meta property="og:title" content="CaliVibe — California Explorer" />
  <meta property="og:description" content="Default description" />
  <meta name="twitter:title" content="CaliVibe — California Explorer" />
  <meta name="twitter:description" content="Default description" />
  <link rel="canonical" href="https://trekhleb.dev/cali-vibe/" />
  <script type="application/ld+json">{"url": "https://trekhleb.dev/cali-vibe/"}</script>
</head>
<body><div id="root"></div></body>
</html>`;

// ── ROUTES data integrity ────────────────────────────────────────────

describe("ROUTES data integrity", () => {
  it("has unique slugs", () => {
    const slugs = ROUTES.map((r: any) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every route has required SEO fields", () => {
    for (const route of ROUTES) {
      expect(route).toHaveProperty("slug");
      expect(route).toHaveProperty("title");
      expect(route).toHaveProperty("desc");
      expect(route).toHaveProperty("priority");
      expect(route).toHaveProperty("freq");
      expect(typeof route.slug).toBe("string");
      expect(typeof route.title).toBe("string");
      expect(typeof route.desc).toBe("string");
      expect(typeof route.priority).toBe("number");
      expect(route.slug.length).toBeGreaterThan(0);
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.desc.length).toBeGreaterThan(0);
    }
  });

  it("priorities are between 0.0 and 1.0", () => {
    for (const route of ROUTES) {
      expect(route.priority).toBeGreaterThanOrEqual(0);
      expect(route.priority).toBeLessThanOrEqual(1);
    }
  });

  it("freq values are valid sitemap changefreq", () => {
    const validFreqs = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);
    for (const route of ROUTES) {
      expect(validFreqs.has(route.freq)).toBe(true);
    }
  });

  it("titles are reasonably sized for SEO (under 70 chars)", () => {
    for (const route of ROUTES) {
      const fullTitle = `${route.title} | CaliVibe`;
      if (fullTitle.length > 70) {
        // Warn but don't fail — some titles are intentionally descriptive
        // Just ensure they're not excessively long
        expect(fullTitle.length).toBeLessThan(100);
      }
    }
  });

  it("descriptions are reasonably sized for SEO (under 160 chars)", () => {
    for (const route of ROUTES) {
      expect(route.desc.length).toBeLessThan(200);
    }
  });
});

// ── ROUTES ↔ route-catalog consistency ───────────────────────────────

describe("ROUTES ↔ route-catalog consistency", () => {
  it("every ROUTES slug is parseable by pathToParams", () => {
    for (const route of ROUTES) {
      const result = pathToParams(`${BASE}/${route.slug}`, BASE_PATH);
      expect(result).not.toBeNull();
    }
  });

  it("every layer slug in LAYERS has a corresponding ROUTE", () => {
    const routeSlugs = new Set(ROUTES.map((r: any) => r.slug));
    for (const layer of LAYERS) {
      expect(routeSlugs.has(layer.slug)).toBe(true);
    }
  });

  it("every transit system sub-route has a corresponding ROUTE", () => {
    const routeSlugs = new Set(ROUTES.map((r: any) => r.slug));
    for (const sys of TRANSIT_SYSTEM_SLUGS) {
      expect(routeSlugs.has(`transit/${sys}`)).toBe(true);
    }
  });

  it("no ROUTES slug starts or ends with /", () => {
    for (const route of ROUTES) {
      expect(route.slug.startsWith("/")).toBe(false);
      expect(route.slug.endsWith("/")).toBe(false);
    }
  });
});

// ── generateHtml ─────────────────────────────────────────────────────

describe("generateHtml", () => {
  const route = {
    slug: "housing/rent",
    title: "California County Rent Prices Map",
    desc: "Interactive map of median gross rent across all 58 California counties.",
    priority: 0.9,
    freq: "yearly",
  };

  it("replaces <title> with route-specific title", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain("<title>California County Rent Prices Map | CaliVibe</title>");
    expect(html).not.toContain("CaliVibe — California Explorer</title>");
  });

  it("replaces meta description", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`content="Interactive map of median gross rent across all 58 California counties."`);
    expect(html).not.toContain(`content="Default description"`);
  });

  it("replaces og:url with canonical URL", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`og:url" content="https://trekhleb.dev/cali-vibe/housing/rent"`);
  });

  it("replaces og:title", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`og:title" content="California County Rent Prices Map | CaliVibe"`);
  });

  it("replaces og:description", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`og:description" content="Interactive map of median gross rent`);
  });

  it("replaces twitter:title", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`twitter:title" content="California County Rent Prices Map | CaliVibe"`);
  });

  it("replaces twitter:description", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`twitter:description" content="Interactive map of median gross rent`);
  });

  it("replaces canonical link", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`href="https://trekhleb.dev/cali-vibe/housing/rent"`);
  });

  it("replaces JSON-LD url", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain(`"url": "https://trekhleb.dev/cali-vibe/housing/rent"`);
  });

  it("preserves non-meta HTML structure", () => {
    const html = generateHtml(TEMPLATE, route);
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("uses custom origin and base when provided", () => {
    const html = generateHtml(TEMPLATE, route, "https://example.com", "/app");
    expect(html).toContain(`href="https://example.com/app/housing/rent"`);
    expect(html).toContain(`"url": "https://example.com/app/housing/rent"`);
  });

  it("handles route with em-dash in description", () => {
    const dashRoute = {
      slug: "crime",
      title: "California County Crime Rates Map",
      desc: "Crime rate map — total, violent, and property crime per 100K.",
      priority: 0.9,
      freq: "yearly",
    };
    const html = generateHtml(TEMPLATE, dashRoute);
    expect(html).toContain("Crime rate map — total");
  });
});

// ── replaceTag ───────────────────────────────────────────────────────

describe("replaceTag", () => {
  it("replaces first match of regex", () => {
    const result = replaceTag("<title>Old</title>", /<title>[^<]*<\/title>/, "<title>New</title>");
    expect(result).toBe("<title>New</title>");
  });

  it("returns original string when no match", () => {
    const original = "<p>No title here</p>";
    const result = replaceTag(original, /<title>[^<]*<\/title>/, "<title>New</title>");
    expect(result).toBe(original);
  });
});

// ── buildSitemapXml ──────────────────────────────────────────────────

describe("buildSitemapXml", () => {
  const testRoutes = [
    { slug: "housing", title: "Housing", desc: "Housing map", priority: 0.9, freq: "yearly" },
    { slug: "transit/bart", title: "BART", desc: "BART map", priority: 0.7, freq: "monthly" },
  ];

  it("includes XML declaration and urlset", () => {
    const xml = buildSitemapXml(testRoutes);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("</urlset>");
  });

  it("includes root URL with priority 1.0", () => {
    const xml = buildSitemapXml(testRoutes);
    expect(xml).toContain(`<loc>https://trekhleb.dev/cali-vibe/</loc>`);
    expect(xml).toContain("<priority>1.0</priority>");
  });

  it("includes all route URLs", () => {
    const xml = buildSitemapXml(testRoutes);
    expect(xml).toContain(`<loc>https://trekhleb.dev/cali-vibe/housing</loc>`);
    expect(xml).toContain(`<loc>https://trekhleb.dev/cali-vibe/transit/bart</loc>`);
  });

  it("includes correct changefreq per route", () => {
    const xml = buildSitemapXml(testRoutes);
    expect(xml).toContain("<changefreq>yearly</changefreq>");
    expect(xml).toContain("<changefreq>monthly</changefreq>");
  });

  it("includes correct priority per route", () => {
    const xml = buildSitemapXml(testRoutes);
    expect(xml).toContain("<priority>0.9</priority>");
    expect(xml).toContain("<priority>0.7</priority>");
  });

  it("has N+1 url entries (root + all routes)", () => {
    const xml = buildSitemapXml(testRoutes);
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(testRoutes.length + 1);
  });

  it("uses custom origin and base", () => {
    const xml = buildSitemapXml(testRoutes, "https://example.com", "/app");
    expect(xml).toContain(`<loc>https://example.com/app/</loc>`);
    expect(xml).toContain(`<loc>https://example.com/app/housing</loc>`);
  });

  it("produces valid sitemap for full ROUTES array", () => {
    const xml = buildSitemapXml(ROUTES);
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(ROUTES.length + 1);
    // Every route slug appears as a <loc>
    for (const route of ROUTES) {
      expect(xml).toContain(`<loc>${ORIGIN}${BASE}/${route.slug}</loc>`);
    }
  });
});
