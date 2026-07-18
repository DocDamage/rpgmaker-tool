const { defineConfig } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const fileFallback = process.env.HTG_E2E_FILE === "1";
const baseURL = fileFallback
  ? pathToFileURL(`${__dirname}${path.sep}`).href
  : "http://127.0.0.1:4173/";

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests"),
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  ...(fileFallback ? {} : {
    webServer: {
      command: "node tests/serve.js",
      url: "http://127.0.0.1:4173/HybridTileStudio.html",
      reuseExistingServer: true,
      timeout: 15_000
    }
  }),
  use: {
    baseURL,
    viewport: { width: 1600, height: 960 },
    serviceWorkers: "allow",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [{
    name: "chromium",
    use: {
      browserName: "chromium",
      launchOptions: {
        ...(systemChromium ? { executablePath: systemChromium } : {}),
        args: fileFallback ? ["--allow-file-access-from-files"] : []
      }
    }
  }]
});
