"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const pluginPath = "HybridTileGraft.js";
const probePath = "tests/fixtures/rpgmaker/HybridTileGraftSmokeProbe.js";
const matrix = JSON.parse(fs.readFileSync("tests/fixtures/rpgmaker/engine-matrix.json", "utf8"));

function readNormalized(path) {
    return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function sha256(path) {
    return crypto.createHash("sha256").update(readNormalized(path)).digest("hex").toUpperCase();
}

new vm.Script(readNormalized(probePath), { filename: probePath });

for (const engine of matrix.engines) {
    const marker = JSON.parse(readNormalized(engine.marker));
    const attestation = JSON.parse(readNormalized(engine.attestation));

    assert.equal(attestation.format, "HybridTileGraftRealEngineSmokeAttestation");
    assert.equal(attestation.engineVersion, engine.version);
    assert.equal(attestation.coreSource, engine.coreSource);
    assert.equal(sha256(pluginPath), attestation.pluginSourceSha256, `real-engine ${engine.version} evidence is stale for HybridTileGraft.js`);
    assert.equal(sha256(probePath), attestation.probeSourceSha256, `real-engine ${engine.version} evidence is stale for the smoke probe`);
    assert.equal(sha256(engine.marker), attestation.markerSha256, `the retained RPG Maker ${engine.version} marker changed`);

    assert.equal(marker.format, "HybridTileGraftRealEngineSmoke");
    assert.equal(marker.version, 2);
    assert.equal(marker.ok, true);
    assert.equal(marker.rpgMakerVersion, engine.version);
    assert.equal(marker.pluginName, "HybridTileGraft");
    assert.equal(marker.pluginVersion, "18.1.0");
    assert.equal(marker.commandCount, 196);
    assert.ok(marker.publicApiEntryCount >= 500);
    assert.equal(marker.mapId, 1);
    assert.equal(marker.markerWritten, true);
    assert.equal(marker.storeValidation?.ok, true);
    assert.equal(marker.diagnosis?.mapId, marker.mapId);
    assert.equal(marker.health?.ok, true);
    assert.equal(marker.persistence?.ok, true);
    assert.ok(marker.persistence?.saveBytes > 0);
    assert.equal(marker.persistence?.loadedStateMatched, true);
    assert.ok(marker.persistence?.loadedPatchCount > 0);
    assert.equal(marker.persistence?.temporarySaveRemoved, true);
    assert.equal(marker.frameTiming?.frames, 30);
    assert.ok(Number.isFinite(marker.frameTiming?.p95Ms));
    assert.ok(marker.benchmark?.sampleCount > 0);
    assert.deepEqual(marker.errors, []);
    assert.ok(Object.values(marker.checks || {}).every(Boolean), `one or more RPG Maker ${engine.version} checks failed`);
}

console.log(`Source-bound RPG Maker MZ engine matrix evidence passed (${matrix.engines.map(item => item.version).join(", ")}).`);
