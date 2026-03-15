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
  await page.route("**/googletagmanager.com/**", (route) => route.abort());

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
    await expect(page.locator("text=Los Angeles")).toBeVisible();
    await expect(page.locator("text=San Diego")).toBeVisible();
    await expect(page.locator("text=San Jose")).toBeVisible();
    await expect(page.locator("text=San Francisco")).toBeVisible();
    await assertScreenshot(page, "favorites-tab-with-items.png");
  });

  test("selected county on map", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await page.locator("text=Los Angeles").click();
    await page.waitForTimeout(MAP_SETTLE);
    await expect(page.locator("text=Los Angeles County")).toBeVisible();
    await assertScreenshot(page, "selected-county.png");
  });

  test("selected city on map", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&tab=favorites`);
    await page.locator("text=San Jose").click();
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

  (IS_CI ? test.skip : test)("mobile - 3D vibe", async ({ page }) => {
    await waitForApp(page, "drawer=1&relief=1");
    await assertScreenshot(page, "mobile-3d-vibe.png", 0.15);
  });

  test("mobile - favorites with items", async ({ page }) => {
    await seedFavorites(page);
    await waitForApp(page, `${MAP_2D}&drawer=1&tab=favorites`);
    await expect(page.locator("text=Los Angeles")).toBeVisible();
    await assertScreenshot(page, "mobile-favorites-with-items.png");
  });

  test("mobile - disclaimer modal", async ({ page }) => {
    await waitForApp(page, `${MAP_2D}&drawer=0`);
    await page.getByRole("button", { name: "Disclaimer" }).click();
    await page.waitForTimeout(MODAL_SETTLE);
    await assertScreenshot(page, "mobile-disclaimer-modal.png", 0.15);
  });
});
