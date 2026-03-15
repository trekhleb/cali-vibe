import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173/cali-vibe/",
    trace: "on-first-retry",
  },
  expect: {
    timeout: 30000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      threshold: 0.3,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--use-gl=angle", "--use-angle=swiftshader", "--disable-gpu"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/cali-vibe/",
    reuseExistingServer: !process.env.CI,
  },
});
