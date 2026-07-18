"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const assetRoot = fs.existsSync("HybridTileWorker.js") ? "." : "upload";

let response = null;
const context = { self: { postMessage(value) { response = value; } }, console, Uint8Array, Uint32Array, Int32Array, Map, Set, Math, Number, String, Array, Object, JSON, Error };
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${assetRoot}/HybridTileWorker.js`, "utf8"), context);
function run(data) { response = null; context.self.onmessage({ data }); return response; }

const wfc = run({ id: "wfc-1", type: "wfc", payload: {
  width: 8, height: 8, layer: 2, seed: "worker-smoke", maxCells: 100,
  rules: { palette: [1, 2], weights: { 1: 3, 2: 1 }, adjacency: {
    1: { N: [1, 2], E: [1, 2], S: [1, 2], W: [1, 2] },
    2: { N: [1, 2], E: [1, 2], S: [1, 2], W: [1, 2] }
  } }
} });
assert.equal(wfc.id, "wfc-1");
assert.equal(wfc.ok, true);
assert.equal(wfc.result.entries.length, 64);
assert.equal(wfc.result.stats.solved, true);
assert.ok(wfc.result.entries.every(([index, tile]) => index >= 128 && [1, 2].includes(tile)));

// The old implementation silently stopped around 100,000 cells. The replacement completes the full map.
const width = 400, height = 300;
const largeFill = run({ id: "fill-large", type: "flood-fill", payload: {
  width, height, layer: 0, x: 0, y: 0, target: 0, replacement: 91,
  data: new Array(width * height * 6).fill(0), requireComplete: true
} });
assert.equal(largeFill.ok, true);
assert.equal(largeFill.result.indices.length, width * height);
assert.equal(largeFill.result.stats.complete, true);
assert.equal(largeFill.result.indices[0], 0);
assert.equal(largeFill.result.indices.at(-1), width * height - 1);

const cappedFill = run({ id: "fill-capped", type: "flood-fill", payload: {
  width: 20, height: 20, data: new Array(20 * 20 * 6).fill(0), x: 0, y: 0,
  target: 0, replacement: 1, maxCells: 100, requireComplete: true
} });
assert.equal(cappedFill.ok, false);
assert.match(cappedFill.error, /smaller than the map/);

const generationRequest = { type: "generate-stage", payload: {
  seed: "deterministic-stage", map: { width: 64, height: 64 },
  stage: { id: "forest", type: "scatter", layer: 1, tileA: 30, tileB: 31, density: 0.2, count: 500 }
} };
const generatedA = run({ id: "generation-a", ...generationRequest });
const generatedB = run({ id: "generation-b", ...generationRequest });
assert.equal(generatedA.ok, true);
assert.equal(generatedA.result.stats.complete, true);
assert.equal(generatedA.result.stats.type, "scatter");
assert.deepEqual(JSON.parse(JSON.stringify(generatedA.result.entries)), JSON.parse(JSON.stringify(generatedB.result.entries)));
assert.ok(generatedA.result.entries.length > 0);
assert.ok(generatedA.result.entries.every(([index, tile]) => index >= 64 * 64 && [30, 31].includes(tile)));

console.log("Hybrid Tile Studio v18.1 worker WFC, complete flood fill, and deterministic generation tests passed.");
