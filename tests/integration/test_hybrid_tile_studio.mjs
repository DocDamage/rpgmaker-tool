import assert from "node:assert/strict";
import fs from "node:fs";
let Window;
try { ({ Window } = await import("happy-dom")); }
catch (_) { ({ Window } = await import("/tmp/htg-dom/node_modules/happy-dom/lib/index.js")); }
const assetRoot = fs.existsSync("HybridTileStudio.html") ? "." : "upload";

const window = new Window({ url: "file:///HybridTileStudio.html" });
const document = window.document;
document.write(fs.readFileSync(`${assetRoot}/HybridTileStudio.html`, "utf8"));

const context = new Proxy({
    save() {}, restore() {}, clearRect() {}, fillRect() {}, strokeRect() {}, drawImage() {},
    fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {},
    setTransform() {}, measureText() { return { width: 10 }; }
}, { set(target, key, value) { target[key] = value; return true; }, get(target, key) { return target[key] ?? (() => {}); } });

window.TextEncoder ||= globalThis.TextEncoder;
window.TextDecoder ||= globalThis.TextDecoder;
window.HTMLCanvasElement.prototype.getContext = () => context;
window.HTMLElement.prototype.getBoundingClientRect = function() { return { x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: 720, width: 1200, height: 720 }; };
window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
window.requestAnimationFrame = callback => { callback?.(window.performance.now()); return 1; };
window.cancelAnimationFrame = () => {};
window.URL.createObjectURL = () => "blob:test";
window.URL.revokeObjectURL = () => {};
window.Image = class { constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 768; } set src(_value) { if (this.onload) this.onload(); } };
window.console = console;

for (const name of [
    "HybridTileCryptoV18.js", "HybridTileStorageV18.js", "HybridTileSchemasV18.js", "HybridTileSchemaV18.js", "HybridTilePwaV18.js",
    "HybridTileStudio.js", "HybridTileStudioServicesV18.js", "HybridTileStudioV18.js"
]) window.eval(fs.readFileSync(`${assetRoot}/${name}`, "utf8"));
await new Promise(resolve => window.setTimeout(resolve, 0));

assert.match(document.getElementById("statusText").textContent, /18\.1\.0 ready/);
assert.equal(window.HybridTileStudio.version, "18.1.0");
assert.equal(window.HybridTileStudioV18.version, "18.1.0");
assert.equal(window.HybridTileStudioServicesV18.version, "18.1.0");
assert.equal(window.HybridTileCryptoV18.version, "18.1.0");
assert.equal(window.HybridTileStorageV18.version, "18.1.0");
assert.equal(window.HybridTileSchemaV18.version, "18.1.0");
assert.ok(document.getElementById("v18Studio").open);
assert.equal(document.querySelectorAll("[data-v18-view]").length >= 8, true);
assert.equal(document.documentElement.dataset.v18Mode, "guided");
assert.equal(window.HybridTileStudioV16, undefined, "specialist modules must not load at startup");
assert.equal([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => /V16\.css$/.test(link.getAttribute("href") || "")), false);
assert.equal(document.querySelectorAll(".v18-journey-grid > button").length, 6);

const map = { width: 4, height: 4, tilesetId: 1, data: new Array(4 * 4 * 6).fill(0), events: [null, {
    id: 1, name: "Door", note: "", x: 1, y: 1, pages: [{ conditions: {}, directionFix: false,
        image: { characterIndex: 0, characterName: "", direction: 2, pattern: 1, tileId: 0 },
        list: [{ code: 201, indent: 0, parameters: [0, 1, 2, 2, 2, 0] }, { code: 0, indent: 0, parameters: [] }],
        moveFrequency: 3, moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
        moveSpeed: 3, moveType: 0, priorityType: 1, stepAnime: false, through: false, trigger: 0, walkAnime: true }]
}] };
map.data[0] = 2048; map.data[1] = 2048;
await window.HybridTileStudio.openMapFiles([new window.File([JSON.stringify(map)], "Map001.json", { type: "application/json" })]);
await new Promise(resolve => window.setTimeout(resolve, 20));
assert.equal(window.HybridTileStudio.state().activeMapId, 1);

await window.HybridTileStudioV18.switchView("create");
await new Promise(resolve => window.setTimeout(resolve, 0));
assert.ok(document.getElementById("v18MapCanvas"));
assert.equal(document.querySelectorAll("#v18Palette button").length, 64);
assert.equal(document.querySelectorAll("[data-v18-tool]").length, 7);
assert.deepEqual([...document.querySelectorAll("[data-v18-palette]")].map(item=>item.textContent),["B","C","D","E","A5","A1","A2","A3","A4"]);
assert.equal(document.querySelector("#v18Palette button small").textContent, "A1 2048");
const beforePaint = window.HybridTileStudioV18.mapDraft().data[0];
document.getElementById("v18TileId").value = "91";
document.getElementById("v18TileId").dispatchEvent(new window.Event("change"));
document.getElementById("v18MapCanvas").dispatchEvent(new window.MouseEvent("pointerdown", { clientX: 1, clientY: 1 }));
document.getElementById("v18MapCanvas").dispatchEvent(new window.MouseEvent("pointerup", { clientX: 1, clientY: 1 }));
assert.notEqual(window.HybridTileStudioV18.mapDraft().data[0], beforePaint);
assert.equal(window.HybridTileStudioV18.mapDraft().data[0], 91);
assert.match(document.getElementById("v18Status").textContent, /1 recoverable map change/);
assert.equal(document.getElementById("v18ApplyMap").disabled, false);
assert.equal(document.getElementById("v18ApplyMap").textContent, "Apply 1 change");
const history = window.HybridTileStudioV18.mapHistory();
assert.equal(history.length, 1);
assert.equal(history[0].changes.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(history[0].changes[0])), { index: 0, before: beforePaint, after: 91 });
assert.equal("map" in history[0], false, "undo history must not retain complete maps");

await window.HybridTileStudioV18.saveDraftRecoveryNow();
const recoveries = await window.HybridTileStorageV18.list("htg-v18-draft:");
assert.equal(recoveries.length, 1);
assert.equal(recoveries[0].value.version, 3);
assert.equal(recoveries[0].value.changes.count, 1);
assert.equal("map" in recoveries[0].value, false);
assert.equal("baseMap" in recoveries[0].value, false);
assert.equal(window.HybridTileStudioV18.recoveryStatus().state, "saved");
assert.equal(window.HybridTileStudioV18.recoveryStatus().backend, "browser");

document.getElementById("v18Undo").click();
assert.equal(window.HybridTileStudioV18.mapDraft().data[0], beforePaint);
assert.equal(document.getElementById("v18ApplyMap").disabled, true);
document.getElementById("v18Redo").click();
assert.equal(window.HybridTileStudioV18.mapDraft().data[0], 91);
assert.equal(document.getElementById("v18ApplyMap").disabled, false);

const applyPromise = window.HybridTileStudioV18.applyMapDraft();
await new Promise(resolve => window.setTimeout(resolve, 0));
const confirm = document.getElementById("v18Confirm");
assert.equal(confirm.open, true);
confirm.close("confirm");
await applyPromise;
assert.equal((await window.HybridTileStudio.mapSnapshot(1)).data[0], 91);
assert.equal(window.HybridTileStudioV18.mapHistory().length, 0);
assert.equal(document.getElementById("v18ApplyMap").disabled, true);
assert.equal(document.getElementById("v18ApplyMap").textContent, "Apply 0 changes");
assert.equal((await window.HybridTileStorageV18.list("htg-v18-draft:")).length, 0);
assert.equal(window.HybridTileStudioV18.recoveryStatus().state, "applied");
const fingerprint = await window.HybridTileStudioV18.projectFingerprintDetails();
assert.equal(fingerprint.algorithm, "sha256");
assert.match(fingerprint.id, /^sha256-[0-9a-f]{64}$/);

await window.HybridTileStudioV18.switchView("world");
await window.HybridTileStudioV18.previewRecipe();
assert.ok(document.getElementById("v18RecipeAfter"));
assert.equal(window.HybridTileStudioV18.validateQuest().ok, true);

// An unapplied recipe preview is explicit evidence, never a project mutation.
await window.HybridTileStudioV18.switchView("test");
const lab = await window.HybridTileStudioV18.runStructuralLab();
assert.equal(lab.status, "verified");
assert.equal(window.HybridTileStudioV18.state().testRuns[0].status, "verified");
assert.equal(window.HybridTileStudioV18.state().testRuns[0].maps, 1);

await window.HybridTileStudioV18.switchView("release");
assert.ok(document.querySelector(".v18-release-layout"));
assert.match(document.querySelector(".v18-gates").textContent, /Real player path/);

await window.HybridTileStudioV18.switchView("settings");
assert.ok(document.querySelector(".v18-settings-layout"));
assert.equal(document.querySelectorAll(".v18-mode-card > span").length, 3);
document.querySelector('[data-v18-mode-choice="beginner"]').click();
assert.equal(document.documentElement.dataset.v18Mode, "beginner");
assert.equal(window.HybridTileStudioV18.state().mode, "beginner");
assert.equal(document.querySelector('[data-v18-mode-choice="beginner"]').getAttribute("aria-pressed"), "true");
const highContrast = document.querySelector('[data-v18-setting="highContrast"]');
highContrast.click();
assert.equal(highContrast.isConnected, true);
assert.equal(highContrast.checked, true);
assert.equal(document.documentElement.classList.contains("v18-high-contrast"), true);
const pipMode = document.getElementById("v18PipMode");
pipMode.value = "hidden";
pipMode.dispatchEvent(new window.Event("change"));
assert.equal(pipMode.isConnected, true);
assert.equal(document.documentElement.dataset.v18Pip, "hidden");
assert.equal(typeof window.HybridTileStudio.auditProject, "function");
assert.equal(typeof window.HybridTileStudio.registerExtension, "function");
assert.equal(typeof window.HybridTileStudio.learnWfcRules, "function");
assert.equal(typeof window.HybridTileStudio.openNativeProject, "function");
assert.equal(typeof window.HybridTileStudio.runWorker, "function");
assert.equal(JSON.stringify(window.HybridTileStudio.tileSource(128)), JSON.stringify({ sheet: 5, sx: 384, sy: 0, sw: 48, sh: 48 }));
assert.equal(window.HybridTileStudio.autotileLayout(2048).sheet, 0);

// A large map redraw is viewport-cull bounded rather than proportional to the whole map.
const largeMap = { width:250, height:250, tilesetId:1, data:new Array(250*250*6).fill(0), events:[null] };
for (let cell = 0; cell < 250*250; cell++) largeMap.data[cell] = 1;
await window.HybridTileStudio.openMapFiles([new window.File([JSON.stringify(largeMap)], "Map002.json", { type:"application/json" })]);
await window.HybridTileStudioV18.switchView("create");
const mapSelect = document.getElementById("v18MapSelect");
mapSelect.value = "2";
mapSelect.dispatchEvent(new window.Event("change"));
await new Promise(resolve => window.setTimeout(resolve, 20));
const mapScroll = document.querySelector(".v18-canvas-scroll");
Object.defineProperty(mapScroll, "clientWidth", { configurable:true, value:320 });
Object.defineProperty(mapScroll, "clientHeight", { configurable:true, value:240 });
mapScroll.scrollLeft = 500;
mapScroll.scrollTop = 500;
mapScroll.dispatchEvent(new window.Event("scroll"));
const largeMetrics = window.HybridTileStudioV18.performanceMetrics();
assert.ok(largeMetrics.lastTilesDrawn > 0);
assert.ok(largeMetrics.lastTilesDrawn < 6000, `expected viewport culling, drew ${largeMetrics.lastTilesDrawn} non-empty tiles`);
assert.ok(largeMetrics.lastTilesDrawn < 250*250, "a viewport redraw must not scan the entire populated layer");

// Expert workbenches are compatible with the v18 core, but remain absent until explicitly loaded.
for (let version=9;version<=16;version++) window.eval(fs.readFileSync(`${assetRoot}/HybridTileStudioV${version}.js`,"utf8"));
await new Promise(resolve=>window.setTimeout(resolve,20));
assert.equal(window.HybridTileStudioV16.version,"16.0.0");
assert.equal(window.HybridTileStudioV15.version,"15.0.0");
assert.ok(document.getElementById("v16Studio"));

console.log("Hybrid Tile Studio v18.1 consolidated DOM, delta edit, recovery, apply, and integrity test passed.");
