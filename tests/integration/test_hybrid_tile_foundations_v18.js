"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const assetRoot = fs.existsSync("HybridTileCryptoV18.js") ? "." : "upload";
require(path.resolve(assetRoot, "HybridTileSchemasV18.js"));
const cryptoApi = require(path.resolve(assetRoot, "HybridTileCryptoV18.js"));
const storage = require(path.resolve(assetRoot, "HybridTileStorageV18.js"));
const schemas = require(path.resolve(assetRoot, "HybridTileSchemaV18.js"));

(async () => {
  assert.equal(cryptoApi.version, "18.1.0");
  assert.equal(storage.version, "18.1.0");
  assert.equal(schemas.version, "18.1.0");
  assert.equal(cryptoApi.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(cryptoApi.canonicalText({ z: 1, a: { c: 2, b: 1 }, omitted: undefined }), '{"a":{"b":1,"c":2},"z":1}');
  const fingerprint = cryptoApi.fingerprint({ z: 1, a: 2 });
  assert.deepEqual(fingerprint, {
    algorithm: "sha256",
    canonicalizationVersion: 1,
    digest: cryptoApi.sha256Hex({ a: 2, z: 1 }),
    id: `sha256-${cryptoApi.sha256Hex({ a: 2, z: 1 })}`
  });

  // Browser recovery falls back to a clone-safe in-memory backend when IndexedDB is unavailable.
  storage._resetForTests();
  const original = { nested: { value: 1 } };
  await storage.put("draft:one", original, { updatedAt: Date.now() - 10_000 });
  original.nested.value = 99;
  assert.equal((await storage.get("draft:one")).nested.value, 1);
  await storage.put("draft:two", { value: 2 });
  await storage.put("other:one", { value: 3 });
  assert.equal((await storage.list("draft:")).length, 2);
  const pruned = await storage.prune("draft:", { maxEntries: 1, maxAgeMs: 0 });
  assert.equal(pruned.length, 1);
  assert.equal((await storage.list("draft:")).length, 1);
  const estimate = await storage.estimate();
  assert.ok(["memory", "indexeddb"].includes(estimate.backend));

  const draft = {
    id: "draft-map-1",
    format: "HybridVisualMapDraft",
    version: 3,
    studioVersion: "18.1.0",
    mapId: 1,
    baseHash: `sha256-${"0".repeat(64)}`,
    draftHash: `sha256-${"1".repeat(64)}`,
    savedAt: "2026-07-18T12:00:00.000Z",
    width: 2,
    height: 1,
    tilesetId: 1,
    changes: { count: 1, tiles: [{ index: 0, before: 0, after: 91 }] }
  };
  assert.equal((await schemas.validateNamed(draft, "HybridVisualMapDraft")).ok, true);
  const invalidDraft = structuredClone(draft);
  delete invalidDraft.changes;
  const invalidDraftReport = await schemas.validateNamed(invalidDraft, "HybridVisualMapDraft");
  assert.equal(invalidDraftReport.ok, false);
  assert.ok(invalidDraftReport.errors.some(error => error.path === "$.changes" && error.keyword === "required"));

  const release = {
    format: "HybridReleaseManifest",
    version: 2,
    studioVersion: "18.1.0",
    createdAt: "2026-07-18T12:00:00.000Z",
    fingerprint: fingerprint.id,
    fingerprintInfo: fingerprint,
    releaseVersion: "18.1.0",
    project: "Practice",
    verificationPolicyVersion: 1,
    budgets: {},
    evidence: [],
    realPlaytest: {},
    limitations: []
  };
  assert.equal((await schemas.validateNamed(release, "HybridReleaseManifest")).ok, true);

  // Ed25519 verifies the canonical payload, not mutable integrity metadata.
  const keyPair = await crypto.webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = new Uint8Array(await crypto.webcrypto.subtle.exportKey("raw", keyPair.publicKey));
  const pack = { format: "HybridWorldPack", schemaVersion: 4, id: "signed.pack", version: "1.0.0", recipes: [], metadata: { b: 2, a: 1 } };
  const payload = new TextEncoder().encode(cryptoApi.canonicalText(cryptoApi.stripIntegrity(pack)));
  const signature = new Uint8Array(await crypto.webcrypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, payload));
  const signatureInfo = { publicKey: Buffer.from(publicKey).toString("base64"), signature: Buffer.from(signature).toString("base64") };
  assert.equal((await cryptoApi.verifyEd25519(pack, signatureInfo)).ok, true);
  const tampered = { ...pack, version: "1.0.1" };
  assert.equal((await cryptoApi.verifyEd25519(tampered, signatureInfo)).ok, false);

  const serviceWorker = fs.readFileSync(path.join(assetRoot, "service-worker.js"), "utf8");
  assert.doesNotMatch(serviceWorker, /HybridTileStudioV17/);
  const installBlock = serviceWorker.match(/addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || "";
  assert.doesNotMatch(installBlock, /skipWaiting/);
  assert.match(serviceWorker, /message[\s\S]*SKIP_WAITING[\s\S]*skipWaiting/);
  assert.match(serviceWorker, /response\.ok/);
  assert.match(serviceWorker, /loadAssetManifest/);
  assert.match(serviceWorker, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(serviceWorker, /Asset digest mismatch/);
  assert.match(serviceWorker, /CACHE_PREFIX = "hybrid-tile-studio-v"/);
  assert.match(serviceWorker, /LEGACY_CACHE_PREFIX/);

  const exampleSchemas = {
    "ExamplePlaytestRecording.htgrecording": "HybridPlaytestRecording",
    "ExamplePlaytestScenario.htgscenario": "HybridPlaytestScenario",
    "HybridWorldRecipes.json": "HybridWorldRecipes",
    "StarterContentCatalog.htgcatalog": "HybridContentCatalog",
    "StarterContentLibrary.htgcontent": "HybridContentLibrary",
    "StarterQuest.htgquest": "HybridQuestProject",
    "StarterWorldPack.htgworld": "HybridWorldPack",
    "StarterWorldRecipeGraph.htggraph": "HybridWorldRecipeGraph"
  };
  for (const [filename, schemaName] of Object.entries(exampleSchemas)) {
    const value = JSON.parse(fs.readFileSync(path.join(assetRoot, "examples", filename), "utf8"));
    const report = await schemas.validateNamed(value, schemaName);
    assert.equal(report.ok, true, `${filename}: ${report.errors.map(error => `${error.path} ${error.message}`).join("; ")}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, "asset-manifest.json"), "utf8"));
  assert.equal(manifest.appVersion, "18.1.0");
  assert.ok(manifest.core.includes("./HybridTileSchemasV18.js"));
  assert.ok(!Object.keys(manifest.assets).some(name => /HybridTileStudioV17\.(?:js|css)$/.test(name)));
  for (const [relative, record] of Object.entries(manifest.assets)) {
    const bytes = fs.readFileSync(path.join(assetRoot, relative));
    assert.equal(record.bytes, bytes.length, `${relative} byte count`);
    assert.equal(record.sha256, crypto.createHash("sha256").update(bytes).digest("hex"), `${relative} digest`);
  }

  console.log("Hybrid Tile Studio v18.1 crypto, storage, schema, signature, and PWA foundations passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
