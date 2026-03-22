import { test, expect, Page } from "@playwright/test";

const IS_CI = !!process.env.CI;
const LOAD_TIMEOUT = 15000;
const MAP_SETTLE = 3000;
const TOGGLE_SETTLE = 1500;
const MODAL_SETTLE = 500;

// The app defaults to relief=1 (3D terrain). All 2D map tests must
// explicitly set relief=0 so the MapLibre map renders instead.
const MAP_2D = "relief=0";

async function waitForApp(page: Page, params = "") {
  // Block Google Analytics to keep analytics clean
  await page.addInitScript(() => {
    // GA4 official opt-out: prevents all data collection for this property
    (window as any)["ga-disable-G-YJ73BX984Z"] = true;
  });
  await page.route("**/googletagmanager.com/**", (route) => route.abort());
  await page.route("**/google-analytics.com/**", (route) => route.abort());
  await page.route("**/analytics.google.com/**", (route) => route.abort());

  await page.goto(`/${params ? "?" + params : ""}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("h1", { timeout: LOAD_TIMEOUT });
  await page
    .waitForSelector("canvas", { timeout: LOAD_TIMEOUT })
    .catch(() => {});
  await page.waitForTimeout(MAP_SETTLE);
  // Freeze animations/transitions/backdrop-blur so screenshots are stable
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        animation: none !important;
        transition: none !important;
      }
    `,
  });
  await page.waitForTimeout(200);
}

/**
 * Take a screenshot and compare against a saved baseline.
 * Uses page.screenshot() directly (no stability check) to avoid
 * issues with continuously-rendering WebGL canvases.
 */
async function assertScreenshot(page: Page, name: string, maxDiffPixelRatio = 0.05) {
  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot(name, { maxDiffPixelRatio });
}

// ─── Desktop: Default & Navigation ──────────────────────────────────────────

test.describe("Desktop - default views", () => {
  // Three.js + SwiftShader times out on CI runners
  (IS_CI ? test.skip : test)("default view with sidebar open (3D relief)", async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator("text=Layers")).toBeVisible();
    await expect(page.locator("text=Favorites")).toBeVisible();
    await assertScreenshot(page, "desktop-default.png");
  });

  test("sidebar closed", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await assertScreenshot(page, "sidebar-closed.png");
  });

  test("favorites tab - empty", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await expect(page.locator("text=No favorites yet")).toBeVisible();
    await assertScreenshot(page, "favorites-tab-empty.png");
  });
});

// ─── Desktop: Layer toggles via URL params ──────────────────────────────────

test.describe("Desktop - layer toggles", () => {
  test("counties - colored mode", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&counties=1&cmode=colored`);
    await assertScreenshot(page, "counties-colored.png");
  });

  test("counties - borders mode", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&counties=1&cmode=borders`);
    await assertScreenshot(page, "counties-borders.png");
  });

  test("county population", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&pop=1`);
    await expect(page.locator("text=View Table")).toBeVisible();
    await assertScreenshot(page, "county-population.png");
  });

  test("county crime", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&crime=1`);
    await expect(page.locator("text=View Table")).toBeVisible();
    await assertScreenshot(page, "county-crime.png");
  });

  test("county crime - violent type", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&crime=1&ctype=violent`);
    await assertScreenshot(page, "county-crime-violent.png");
  });

  test("cities - colored mode", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&cities=1&cimode=colored`);
    await assertScreenshot(page, "cities-colored.png");
  });

  test("cities - borders mode", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&cities=1&cimode=borders`);
    await assertScreenshot(page, "cities-borders.png");
  });

  test("city crime", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&cityCrime=1`);
    await expect(page.locator("text=View Table")).toBeVisible();
    await assertScreenshot(page, "city-crime.png");
  });

  test("temperature - default (day, °F, small hex)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1`);
    await assertScreenshot(page, "temperature-default.png");
  });

  test("temperature - night metric", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1&tmetric=tmin`);
    await assertScreenshot(page, "temperature-night.png");
  });

  test("temperature - celsius", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1&tunit=C`);
    await assertScreenshot(page, "temperature-celsius.png");
  });

  test("temperature - large hex", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1&tres=4`);
    await assertScreenshot(page, "temperature-large-hex.png");
  });

  test("temperature - January", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1&tmonth=0`);
    await assertScreenshot(page, "temperature-january.png");
  });

  test("temperature - selected hex cell", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1&drawer=0`);
    // Click on a hex cell in California to select it
    await page.locator("canvas").click({ position: { x: 400, y: 250 } });
    // Wait for the info panel to appear in the DOM
    await page.waitForSelector("text=Night Low", { timeout: 5000 });
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "temperature-selected-hex.png");
  });

  test("sunshine - default (small hex, current month)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1`);
    await assertScreenshot(page, "sunshine-default.png");
  });

  test("sunshine - large hex", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&sres=4`);
    await assertScreenshot(page, "sunshine-large-hex.png");
  });

  test("sunshine - January", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&smonth=0`);
    await assertScreenshot(page, "sunshine-january.png");
  });

  test("sunshine - yearly average", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&smonth=12`);
    await assertScreenshot(page, "sunshine-yearly-average.png");
  });

  test("sunshine - selected hex cell", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&drawer=0`);
    await page.locator("canvas").click({ position: { x: 400, y: 250 } });
    await page.waitForSelector("text=Annual avg", { timeout: 5000 });
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "sunshine-selected-hex.png");
  });

  test("sunshine - ERA5 data source", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&ssrc=era5`);
    await expect(page.getByRole("button", { name: "ERA5" })).toBeVisible();
    await assertScreenshot(page, "sunshine-era5.png");
  });

  test("sunshine - ERA5 large hex", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1&ssrc=era5&sres=4`);
    await assertScreenshot(page, "sunshine-era5-large-hex.png");
  });

  // Three.js + SwiftShader times out on CI runners
  (IS_CI ? test.skip : test)("3D vibe with peaks (ft)", async ({ page }) => {
    await waitForApp(page, "relief=1&peaks=1&punit=ft");
    await expect(page.locator("text=Show Peaks")).toBeVisible();
    await expect(page.locator("text=Reset View")).toBeVisible();
    await assertScreenshot(page, "3d-vibe.png", 0.15);
  });

  (IS_CI ? test.skip : test)("3D vibe - no peaks", async ({ page }) => {
    await waitForApp(page, "relief=1&peaks=0");
    await assertScreenshot(page, "3d-vibe-no-peaks.png", 0.15);
  });

  (IS_CI ? test.skip : test)("3D vibe - meters unit", async ({ page }) => {
    await waitForApp(page, "relief=1&peaks=1&punit=m");
    await assertScreenshot(page, "3d-vibe-meters.png", 0.15);
  });

  // ── Transit: BART only (via tsys URL param) ──

  test("transit - BART default (all lines)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=bart`);
    await expect(page.getByPlaceholder("Search BART stations...")).toBeVisible();
    await assertScreenshot(page, "transit-bart-default.png");
  });

  test("transit - BART solo red line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=bart`);
    await page.getByRole("button", { name: "Red" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-bart-solo-red.png");
  });

  test("transit - BART solo red then restore all", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=bart`);
    await page.getByRole("button", { name: "Red" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-bart-restore-all.png");
  });

  test("transit - BART station search", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=bart`);
    const searchInput = page.getByPlaceholder("Search BART stations...");
    await searchInput.fill("Embarcadero");
    await expect(page.locator("text=Embarcadero")).toBeVisible();
    await assertScreenshot(page, "transit-bart-search.png");
  });

  // ── Transit: Caltrain only ──

  test("transit - Caltrain default (all lines)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=caltrain`);
    await expect(page.getByPlaceholder("Search Caltrain stations...")).toBeVisible();
    await assertScreenshot(page, "transit-caltrain-default.png");
  });

  test("transit - Caltrain solo express line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=caltrain`);
    await page.getByRole("button", { name: "Express" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-caltrain-solo-express.png");
  });

  test("transit - Caltrain solo express then restore all", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=caltrain`);
    await page.getByRole("button", { name: "Express" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-caltrain-restore-all.png");
  });

  test("transit - Caltrain station search", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=caltrain`);
    const searchInput = page.getByPlaceholder("Search Caltrain stations...");
    await searchInput.fill("Palo Alto");
    await expect(page.locator("text=Palo Alto Station")).toBeVisible();
    await assertScreenshot(page, "transit-caltrain-search.png");
  });

  // ── Transit: SMART only ──

  test("transit - SMART default (all lines)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=smart`);
    await expect(page.getByPlaceholder("Search SMART stations...")).toBeVisible();
    await assertScreenshot(page, "transit-smart-default.png");
  });

  test("transit - SMART solo main line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=smart`);
    await page.getByRole("button", { name: "Main Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-smart-solo-main-line.png");
  });

  test("transit - SMART station search", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=smart`);
    const searchInput = page.getByPlaceholder("Search SMART stations...");
    await searchInput.fill("San Rafael");
    await expect(page.locator("text=San Rafael")).toBeVisible();
    await assertScreenshot(page, "transit-smart-search.png");
  });

  // ── Transit: LA Metro only ──

  test("transit - LA Metro default (all lines)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=lametro`);
    await expect(page.getByPlaceholder("Search LA Metro stations...")).toBeVisible();
    await assertScreenshot(page, "transit-lametro-default.png");
  });

  test("transit - LA Metro solo A Line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=lametro`);
    await page.getByRole("button", { name: "A Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-lametro-solo-a-line.png");
  });

  test("transit - LA Metro solo A Line then restore all", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=lametro`);
    await page.getByRole("button", { name: "A Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-lametro-restore-all.png");
  });

  test("transit - LA Metro station search", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1&tsys=lametro`);
    const searchInput = page.getByPlaceholder("Search LA Metro stations...");
    await searchInput.fill("Union Station");
    await expect(page.locator("text=Union Station")).toBeVisible();
    await assertScreenshot(page, "transit-lametro-search.png");
  });

  // ── Transit: All systems together ──

  test("transit - all systems default view", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1`);
    await expect(page.getByPlaceholder("Search BART stations...")).toBeVisible();
    await expect(page.getByPlaceholder("Search Caltrain stations...")).toBeVisible();
    await expect(page.getByPlaceholder("Search SMART stations...")).toBeVisible();
    await expect(page.getByPlaceholder("Search LA Metro stations...")).toBeVisible();
    await assertScreenshot(page, "transit-all-default.png");
  });

  test("transit - all systems with solo lines", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&transit=1`);
    await page.getByRole("button", { name: "Red" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "Express" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "Main Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await page.getByRole("button", { name: "A Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "transit-all-solo-lines.png");
  });

  test("terrain 3D map checkbox", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&terrain3d=1`);
    await assertScreenshot(page, "map-terrain-3d.png");
  });
});

// ─── Desktop: Modals ────────────────────────────────────────────────────────

test.describe("Desktop - modals", () => {
  // Text-heavy modals use a higher threshold to tolerate cross-platform font rendering
  test("disclaimer modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await page.getByRole("button", { name: "Disclaimer" }).click();
    await page.waitForTimeout(MODAL_SETTLE);
    await expect(page.locator("text=non-commercial project")).toBeVisible();
    await assertScreenshot(page, "modal-disclaimer.png", 0.15);
  });

  test("sources modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await page.getByRole("button", { name: "Sources" }).click();
    await page.waitForTimeout(MODAL_SETTLE);
    await expect(page.locator("text=Data Sources")).toBeVisible();
    await assertScreenshot(page, "modal-sources.png", 0.15);
  });

  test("privacy modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await page.getByRole("button", { name: "Privacy" }).click();
    await page.waitForTimeout(MODAL_SETTLE);
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
    await assertScreenshot(page, "modal-privacy.png", 0.15);
  });

  test("population table modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&pop=1`);
    await page.locator("text=View Table").click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "modal-population-table.png", 0.15);
  });

  test("county crime table modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&crime=1`);
    await page.locator("text=View Table").click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "modal-county-crime-table.png", 0.15);
  });

  test("city crime table modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&cityCrime=1`);
    await page.locator("text=View Table").click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "modal-city-crime-table.png", 0.15);
  });

  test("temperature table modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&temp=1`);
    await page.locator("text=View Table").click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "modal-temperature-table.png", 0.15);
  });

  test("sunshine table modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&shine=1`);
    await page.locator("text=View Table").click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "modal-sunshine-table.png", 0.15);
  });
});

// ─── Desktop: Map styles ───────────────────────────────────────────────────

test.describe("Desktop - map styles", () => {
  test("map style - streets (liberty)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&style=liberty&counties=1&cmode=colored`);
    await assertScreenshot(page, "map-style-streets.png");
  });

  test("map style - light (positron)", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&style=light&counties=1&cmode=colored`);
    await assertScreenshot(page, "map-style-light.png");
  });

  test("map style - dark", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&style=dark&counties=1&cmode=colored`);
    await assertScreenshot(page, "map-style-dark.png");
  });

  test("map style - satellite", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&style=satellite&counties=1&cmode=colored`);
    await assertScreenshot(page, "map-style-satellite.png");
  });
});

// ─── Desktop: Favorites & Selection ────────────────────────────────────────

const FAVORITES_DATA = JSON.stringify([
  { type: "county", name: "Los Angeles" },
  { type: "county", name: "San Diego" },
  { type: "city", name: "San Jose" },
  { type: "city", name: "San Francisco" },
]);

function seedFavorites(page: Page) {
  return page.addInitScript((data) => {
    localStorage.setItem("cali-vibe-favorites", data);
  }, FAVORITES_DATA);
}

test.describe("Desktop - favorites & selection", () => {
  test("favorites tab - with items", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await expect(page.getByRole("button", { name: "Los Angeles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "San Diego" })).toBeVisible();
    await expect(page.getByRole("button", { name: "San Jose" })).toBeVisible();
    await expect(page.getByRole("button", { name: "San Francisco" })).toBeVisible();
    await assertScreenshot(page, "favorites-tab-with-items.png");
  });

  test("selected county on map", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await page.getByRole("button", { name: "Los Angeles" }).click();
    await page.waitForTimeout(MAP_SETTLE);
    await expect(page.locator("text=Los Angeles County")).toBeVisible();
    await assertScreenshot(page, "selected-county.png");
  });

  test("selected city on map", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await page.getByRole("button", { name: "San Jose" }).click();
    await page.waitForTimeout(MAP_SETTLE);
    await assertScreenshot(page, "selected-city.png");
  });
});

// ─── Mobile views ───────────────────────────────────────────────────────────

test.describe("Mobile views", () => {
  test.use({ viewport: { width: 393, height: 852 } }); // iPhone 16 Pro

  test("mobile - closed sidebar", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await assertScreenshot(page, "mobile-closed.png");
  });

  test("mobile - sidebar open", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1`);
    await expect(page.locator("text=Layers")).toBeVisible();
    await assertScreenshot(page, "mobile-sidebar.png");
  });

  test("mobile - favorites tab", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&tab=favorites`);
    await expect(page.locator("text=No favorites yet")).toBeVisible();
    await assertScreenshot(page, "mobile-favorites.png");
  });

  test("mobile - counties", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&counties=1`);
    await assertScreenshot(page, "mobile-counties.png");
  });

  test("mobile - county population", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&pop=1`);
    await assertScreenshot(page, "mobile-population.png");
  });

  test("mobile - county crime", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&crime=1`);
    await assertScreenshot(page, "mobile-crime.png");
  });

  test("mobile - cities", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&cities=1`);
    await assertScreenshot(page, "mobile-cities.png");
  });

  test("mobile - city crime", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&cityCrime=1`);
    await assertScreenshot(page, "mobile-city-crime.png");
  });

  test("mobile - temperature", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&temp=1`);
    await assertScreenshot(page, "mobile-temperature.png");
  });

  test("mobile - sunshine", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&shine=1`);
    await assertScreenshot(page, "mobile-sunshine.png");
  });

  test("mobile - sunshine ERA5", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&shine=1&ssrc=era5`);
    await assertScreenshot(page, "mobile-sunshine-era5.png");
  });

  test("mobile - transit BART only", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1&tsys=bart`);
    await assertScreenshot(page, "mobile-transit-bart.png");
  });

  test("mobile - transit BART solo line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1&tsys=bart`);
    await page.getByRole("button", { name: "Blue" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "mobile-transit-bart-solo.png");
  });

  test("mobile - transit Caltrain solo line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1&tsys=caltrain`);
    await page.getByRole("button", { name: "Limited" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "mobile-transit-caltrain-solo.png");
  });

  test("mobile - transit SMART only", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1&tsys=smart`);
    await assertScreenshot(page, "mobile-transit-smart.png");
  });

  test("mobile - transit LA Metro solo line", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1&tsys=lametro`);
    await page.getByRole("button", { name: "A Line" }).click();
    await page.waitForTimeout(TOGGLE_SETTLE);
    await assertScreenshot(page, "mobile-transit-lametro-solo.png");
  });

  test("mobile - transit all systems", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=1&transit=1`);
    await assertScreenshot(page, "mobile-transit-all.png");
  });

  (IS_CI ? test.skip : test)("mobile - 3D vibe", async ({ page }) => {
    await waitForApp(page, "drawer=1&relief=1");
    await assertScreenshot(page, "mobile-3d-vibe.png", 0.15);
  });

  test("mobile - favorites with items", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&drawer=1&tab=favorites`);
    await expect(page.getByRole("button", { name: "Los Angeles" })).toBeVisible();
    await assertScreenshot(page, "mobile-favorites-with-items.png");
  });

  test("mobile - disclaimer modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await page.getByRole("button", { name: "Disclaimer" }).click();
    await page.waitForTimeout(MODAL_SETTLE);
    await assertScreenshot(page, "mobile-disclaimer-modal.png", 0.15);
  });
});
