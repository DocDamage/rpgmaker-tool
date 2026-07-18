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
window.HTMLElement.prototype.getBoundingClientRect = function() { return { x:0, y:0, top:0, left:0, right:1200, bottom:720, width:1200, height:720 }; };
window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
window.requestAnimationFrame = callback => { callback?.(window.performance.now()); return 1; };
window.cancelAnimationFrame = () => {};
window.URL.createObjectURL = () => "blob:test";
window.URL.revokeObjectURL = () => {};
window.Image = class { constructor() { this.complete=true; this.naturalWidth=768; this.naturalHeight=768; } set src(_value) { this.onload?.(); } };
window.console = console;
window.confirm = () => true;

const control = { events: [], failDraftWrites: false };

class MemoryFileHandle {
  constructor(name, text, fullPath) { this.kind = "file"; this.name = name; this.text = String(text ?? ""); this.fullPath = fullPath; }
  async getFile() { return new window.File([this.text], this.name, { type: "application/json" }); }
  async createWritable() {
    control.events.push(`project-write:${this.fullPath}`);
    if (control.failDraftWrites && /\.htgmapdraft$/i.test(this.fullPath)) throw new Error("simulated project draft write failure");
    let next = this.text;
    return {
      write: async value => { next = String(value); },
      close: async () => { this.text = next; }
    };
  }
}

class MemoryDirectoryHandle {
  constructor(name, fullPath = name) { this.kind = "directory"; this.name = name; this.fullPath = fullPath; this.children = new Map(); }
  directory(name) { const child = new MemoryDirectoryHandle(name, `${this.fullPath}/${name}`); this.children.set(name, child); return child; }
  file(name, value) { const child = new MemoryFileHandle(name, typeof value === "string" ? value : JSON.stringify(value), `${this.fullPath}/${name}`); this.children.set(name, child); return child; }
  async getDirectoryHandle(name, options = {}) {
    const child = this.children.get(name);
    if (child?.kind === "directory") return child;
    if (!child && options.create) return this.directory(name);
    throw new Error(`Directory not found: ${this.fullPath}/${name}`);
  }
  async getFileHandle(name, options = {}) {
    const child = this.children.get(name);
    if (child?.kind === "file") return child;
    if (!child && options.create) return this.file(name, "");
    throw new Error(`File not found: ${this.fullPath}/${name}`);
  }
  async removeEntry(name, options = {}) {
    const child = this.children.get(name);
    if (!child) throw new Error(`Entry not found: ${this.fullPath}/${name}`);
    if (child.kind === "directory" && child.children.size && !options.recursive) throw new Error("Directory is not empty");
    this.children.delete(name);
  }
  async *entries() { for (const entry of this.children) yield entry; }
}

const map = { width:4, height:4, tilesetId:1, data:new Array(4*4*6).fill(0), events:[null] };
map.data[0] = 2048;
const root = new MemoryDirectoryHandle("MigrationProject", "MigrationProject");
const data = root.directory("data");
data.file("MapInfos.json", [null, { id:1, name:"Migration Map", order:1, parentId:0 }]);
data.file("Tilesets.json", [null, { id:1, name:"Outside", tilesetNames:[] }]);
data.file("Map001.json", map);
root.directory("img").directory("tilesets");

for (const name of [
  "HybridTileCryptoV18.js", "HybridTileStorageV18.js", "HybridTileSchemasV18.js", "HybridTileSchemaV18.js", "HybridTilePwaV18.js",
  "HybridTileStudio.js", "HybridTileStudioServicesV18.js"
]) window.eval(fs.readFileSync(`${assetRoot}/${name}`, "utf8"));

await window.HybridTileStudio.openProjectHandle(root);
await window.HybridTileStudio.activateMap(1);
await window.HybridTileStudio.setExtensionData("worldsmith-v17", {
  view: "settings",
  mode: "expert",
  highContrast: true,
  budgets: { maxMapCells: 12345, maxEventsPerMap: 42 },
  map: { selectedId: 1, palette: "A2", tileId: 2816 },
  milestones: { opened: true, edited: true }
});

const originalStorage = window.HybridTileStorageV18;
let failBrowserWrites = false;
window.HybridTileStorageV18 = Object.freeze({
  ...originalStorage,
  put: async (...args) => {
    control.events.push(`browser-put:${args[0]}`);
    if (failBrowserWrites) throw new Error("simulated browser storage failure");
    return originalStorage.put(...args);
  }
});

window.eval(fs.readFileSync(`${assetRoot}/HybridTileStudioV18.js`, "utf8"));
await new Promise(resolve => window.setTimeout(resolve, 0));

const migrated = window.HybridTileStudioV18.state();
assert.equal(migrated.mode, "expert");
assert.equal(migrated.highContrast, true);
assert.equal(migrated.budgets.maxMapCells, 12345);
assert.equal(migrated.budgets.maxEventsPerMap, 42);
assert.equal(migrated.map.palette, "A2");
assert.equal(migrated.map.tileId, 2816);
assert.equal(migrated.milestones.opened, true);
assert.equal(migrated.milestones.edited, true);
assert.equal(migrated.pipMode, "contextual", "new v18.1 preferences must receive safe defaults during migration");

await window.HybridTileStudioV18.switchView("create");
document.getElementById("v18TileId").value = "91";
document.getElementById("v18TileId").dispatchEvent(new window.Event("change"));
document.getElementById("v18MapCanvas").dispatchEvent(new window.MouseEvent("pointerdown", { clientX:1, clientY:1 }));
document.getElementById("v18MapCanvas").dispatchEvent(new window.MouseEvent("pointerup", { clientX:1, clientY:1 }));
assert.equal(window.HybridTileStudioV18.mapDraft().data[0], 91);

control.events.length = 0;
control.failDraftWrites = true;
await window.HybridTileStudioV18.saveDraftRecoveryNow();
assert.equal(window.HybridTileStudioV18.recoveryStatus().state, "fallback");
assert.equal(window.HybridTileStudioV18.recoveryStatus().backend, "browser");
const projectAttempt = control.events.findIndex(value => value.startsWith("project-write:"));
const browserAttempt = control.events.findIndex(value => value.startsWith("browser-put:"));
assert.ok(projectAttempt >= 0 && browserAttempt > projectAttempt, "project recovery must be attempted before the browser mirror");

control.events.length = 0;
control.failDraftWrites = false;
await window.HybridTileStudioV18.saveDraftRecoveryNow();
assert.equal(window.HybridTileStudioV18.recoveryStatus().state, "saved");
assert.equal(window.HybridTileStudioV18.recoveryStatus().backend, "project");
const draftFile = await (await (await (await root.getDirectoryHandle(".hybrid")).getDirectoryHandle("worldsmith")).getDirectoryHandle("drafts")).getFileHandle("Map001.htgmapdraft");
const projectDraft = JSON.parse(await (await draftFile.getFile()).text());
assert.equal(projectDraft.version, 3);
assert.equal(projectDraft.changes.count, 1);
assert.equal(projectDraft.changes.tiles.length, 1);
assert.equal("map" in projectDraft, false);
assert.equal(control.events.some(value => value.startsWith("browser-put:")), true, "successful project recovery is still mirrored to IndexedDB");

control.failDraftWrites = true;
failBrowserWrites = true;
await assert.rejects(window.HybridTileStudioV18.saveDraftRecoveryNow(), /simulated project draft write failure|could not be saved/i);
assert.equal(window.HybridTileStudioV18.recoveryStatus().state, "failed");
assert.equal(window.HybridTileStudioV18.recoveryStatus().backend, "none");

await new Promise(resolve => window.setTimeout(resolve, 160));
const v18State = window.HybridTileStudio.getExtensionData("worldsmith-v18", null);
assert.equal(v18State.mode, "expert", "the migrated V17 state must be persisted into the V18 namespace after a real edit");
assert.equal(fs.existsSync(`${assetRoot}/HybridTileStudioV17.js`), false, "V17 must not ship as an active production module");
assert.equal(fs.existsSync(`${assetRoot}/tests/fixtures/migrations/v17/HybridTileStudioV17.js`), true, "V17 remains available as a migration fixture");

console.log("Hybrid Tile Studio v18.1 V17 migration, project-first recovery, browser fallback, and dual-failure tests passed.");
