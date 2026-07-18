const { test, expect } = require("@playwright/test");
const path = require("path");

const mapFixture = path.join(__dirname, "fixtures", "Map001.json");

async function openLooseMap(page) {
  await page.setInputFiles("#mapFileInput", mapFixture);
  await page.locator('[data-v18-view="create"]').first().click();
  await expect(page.locator("#v18MapCanvas")).toBeVisible();
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("v18.1 completes paint, delta recovery, undo/redo, and safe Apply in a real browser", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("HybridTileStudio.html");
  await expect(page.locator("#statusText")).toContainText("18.1.0 ready");
  await expect(page.locator("#v18Studio")).toBeVisible();
  await expect(page.locator(".v18-nav [data-v18-view]")).toHaveCount(8);
  await expect(page.locator(".v18-hero-pip img")).toHaveAttribute("src", "HybridTileGuide.png");
  expect(await page.evaluate(() => window.HybridTileStudioV16)).toBeUndefined();

  await openLooseMap(page);
  await expect(page.locator("#v18Palette button")).toHaveCount(64);
  await page.locator("#v18TileId").fill("91");
  await page.locator("#v18TileId").dispatchEvent("change");
  await page.locator("#v18MapCanvas").click({ position: { x: 4, y: 4 } });

  await expect(page.locator("#v18ApplyMap")).toBeEnabled();
  await expect(page.locator("#v18ApplyMap")).toHaveText("Apply 1 change");
  await expect(page.locator("#v18Status")).toContainText("1 recoverable map change");
  const transaction = await page.evaluate(() => window.HybridTileStudioV18.mapHistory().at(-1));
  expect(transaction.label).toMatch(/paint/i);
  expect(transaction.changes).toHaveLength(1);
  expect(transaction.before).toBeUndefined();
  expect(transaction.after).toBeUndefined();

  await page.evaluate(() => window.HybridTileStudioV18.saveDraftRecoveryNow());
  await expect.poll(() => page.evaluate(() => window.HybridTileStudioV18.recoveryStatus().state)).toBe("saved");
  expect(await page.evaluate(() => window.HybridTileStudioV18.recoveryStatus().backend)).toBe("browser");
  const storedDrafts = await page.evaluate(() => window.HybridTileStorageV18.list("htg-v18-draft:"));
  expect(storedDrafts).toHaveLength(1);
  expect(storedDrafts[0].value.version).toBe(3);
  expect(storedDrafts[0].value.changes.tiles).toHaveLength(1);
  expect(storedDrafts[0].value.map).toBeUndefined();

  await page.locator("#v18Undo").click();
  await expect(page.locator("#v18ApplyMap")).toBeDisabled();
  await expect(page.locator("#v18ApplyMap")).toHaveText("Apply 0 changes");
  await page.locator("#v18Redo").click();
  await expect(page.locator("#v18ApplyMap")).toBeEnabled();

  await page.locator("#v18ApplyMap").click();
  await expect(page.locator("#v18Confirm")).toBeVisible();
  await expect(page.locator("#v18ConfirmText")).toContainText("1 tile values");
  await page.locator("#v18ConfirmAccept").click();
  await expect(page.locator("#v18ApplyMap")).toBeDisabled();
  await expect(page.locator("#v18ApplyMap")).toHaveText("Apply 0 changes");
  await expect.poll(() => page.evaluate(() => window.HybridTileStudioV18.recoveryStatus().state)).toBe("applied");
  expect(await page.evaluate(async () => (await window.HybridTileStudio.mapSnapshot(1)).data[0])).toBe(91);
  expect(await page.evaluate(() => window.HybridTileStudioV18.mapHistory().length)).toBe(0);
  expect(await page.evaluate(() => window.HybridTileStorageV18.list("htg-v18-draft:").then(values => values.length))).toBe(0);

  const fingerprint = await page.evaluate(() => window.HybridTileStudioV18.projectFingerprint());
  expect(fingerprint).toMatch(/^sha256-[0-9a-f]{64}$/);

  await page.locator('[data-v18-view="world"]').first().click();
  await page.locator('[data-v18-action="preview-recipe"]').click();
  await expect(page.locator("#v18RecipeAfter")).toBeVisible();
  await expect(page.locator(".v18-preview-pair")).toContainText("Preview");

  await page.locator('[data-v18-view="test"]').first().click();
  await page.locator('[data-v18-action="run-lab"]').click();
  await expect(page.locator("#v18LabStage")).toContainText("VERIFIED");

  await page.locator('[data-v18-view="release"]').first().click();
  await expect(page.locator(".v18-gates")).toContainText("Real player path");
  await expect(page.locator('[data-v18-action="create-release"]')).toBeDisabled();
  expect(errors).toEqual([]);
});

test("practice project, responsive drawers, and two-column workspaces remain usable at supported widths", async ({ page }) => {
  await page.goto("HybridTileStudio.html");
  await page.locator('[data-v18-action="practice-project"]').first().click();
  await expect(page.locator("#v18Project")).toHaveText("Loose map workspace");
  expect(await page.evaluate(() => window.HybridTileStudio.projectInfo().open)).toBe(false);
  expect(await page.evaluate(() => window.HybridTileStudio.state().activeMapId)).toBe(1);

  for (const width of [1600, 1366, 1180, 1024, 960]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-v18-view="create"]').first().click();
    await assertNoHorizontalOverflow(page);

    const toolToggle = page.locator('[data-v18-action="toggle-tools"]');
    if (width <= 1180) {
      await expect(toolToggle).toBeVisible();
      await toolToggle.click();
      await expect(page.locator("#v18CreateWorkspace")).toHaveClass(/tools-open/);
      await page.locator('.v18-tools [data-v18-action="close-panes"]').click();
      await page.locator('[data-v18-action="toggle-inspector"]').click();
      await expect(page.locator("#v18CreateWorkspace")).toHaveClass(/inspector-open/);
      await page.locator('.v18-inspector [data-v18-action="close-panes"]').click();
    } else {
      await expect(toolToggle).toBeHidden();
    }

    await page.locator('[data-v18-view="settings"]').first().click();
    await expect(page.locator(".v18-settings-layout")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    const settingsColumns = await page.locator(".v18-settings-layout").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
    expect(settingsColumns).toBe(width <= 960 ? 1 : 2);

    await page.locator('[data-v18-view="release"]').first().click();
    await expect(page.locator(".v18-release-layout")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    const releaseColumns = await page.locator(".v18-release-layout").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length);
    expect(releaseColumns).toBe(width <= 960 ? 1 : 2);
  }
});

test("modes, accessibility, semantic tile search, command focus, and service-worker shell are real", async ({ page }) => {
  await page.goto("HybridTileStudio.html");
  await openLooseMap(page);
  await page.locator("#v18PaletteQuery").fill("water");
  await expect(page.locator("#v18Palette button").first()).toContainText("A1");
  await expect(page.locator("#v18TileDescriptor")).toContainText("source");

  await page.locator('[data-v18-view="settings"]').first().click();
  await page.locator('[data-v18-mode-choice="beginner"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-v18-mode", "beginner");
  await expect(page.locator('[data-v18-view="advanced"]').first()).toBeHidden();
  await page.locator('[data-v18-setting="highContrast"]').check();
  await expect(page.locator("html")).toHaveClass(/v18-high-contrast/);
  await page.locator("#v18PipMode").selectOption("hidden");
  await expect(page.locator("html")).toHaveAttribute("data-v18-pip", "hidden");
  await expect(page.locator("#v18Help")).toBeHidden();

  await page.keyboard.press("Control+k");
  await expect(page.locator("#v18CommandPalette")).toBeVisible();
  await page.locator("#v18CommandQuery").fill("structural");
  await expect(page.locator("#v18CommandResults")).toContainText("Run structural lab");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  const protocol = await page.evaluate(() => location.protocol);
  if (protocol === "file:") {
    expect(await page.evaluate(() => window.HybridTilePwaV18.register())).toBeNull();
  } else {
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const cacheNames = await caches.keys();
      const assets = [];
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        assets.push(...(await cache.keys()).map(request => new URL(request.url).pathname));
      }
      return { active: registration.active?.state, cacheNames, assets };
    });
    expect(swState.active).toBe("activated");
    expect(swState.cacheNames.some(name => name.includes("v18.1"))).toBe(true);
    expect(swState.assets).toContain("/HybridTileStudio.html");
    expect(swState.assets.some(asset => /HybridTileStudioV(?:9|1[0-6])\.js$/.test(asset))).toBe(false);
  }
});
