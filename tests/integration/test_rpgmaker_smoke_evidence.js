"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const pluginPath = "HybridTileGraft.js";
const probePath = "tests/fixtures/rpgmaker/HybridTileGraftSmokeProbe.js";
const markerPath = "tests/evidence/rpgmaker/real-engine-smoke.json";
const attestationPath = "tests/evidence/rpgmaker/real-engine-smoke.attestation.json";

function readNormalized(path) {
    return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function sha256(path) {
    return crypto.createHash("sha256").update(readNormalized(path)).digest("hex").toUpperCase();
}

const probeSource = readNormalized(probePath);
const marker = JSON.parse(readNormalized(markerPath));
const attestation = JSON.parse(readNormalized(attestationPath));

// Parse the test-only plugin without executing it outside RPG Maker.
new vm.Script(probeSource, { filename: probePath });

assert.equal(attestation.format, "HybridTileGraftRealEngineSmokeAttestation");
assert.equal(sha256(pluginPath), attestation.pluginSourceSha256, "real-engine evidence is stale for HybridTileGraft.js");
assert.equal(sha256(probePath), attestation.probeSourceSha256, "real-engine evidence is stale for the smoke probe");
assert.equal(sha256(markerPath), attestation.markerSha256, "the retained runtime marker changed");

assert.equal(marker.format, "HybridTileGraftRealEngineSmoke");
assert.equal(marker.ok, true);
assert.equal(marker.rpgMakerVersion, attestation.engineVersion);
assert.equal(marker.pluginName, "HybridTileGraft");
assert.equal(marker.pluginVersion, "18.1.0");
assert.equal(marker.commandCount, 196);
assert.equal(marker.mapId, 1);
assert.equal(marker.markerWritten, true);
assert.equal(marker.storeValidation?.ok, true);
assert.equal(marker.diagnosis?.mapId, marker.mapId);
assert.equal(marker.health?.ok, true);
assert.deepEqual(marker.errors, []);
assert.ok(Object.values(marker.checks || {}).every(Boolean), "one or more real-engine checks failed");

console.log("Source-bound RPG Maker MZ 1.10.0 real-engine smoke evidence passed.");
