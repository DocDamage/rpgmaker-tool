"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const capabilityContract = JSON.parse(fs.readFileSync("src/contracts/extension-capabilities.json", "utf8"));
const capabilityIds = capabilityContract.capabilities.map(item => item.id);
const schema = JSON.parse(fs.readFileSync("schemas/HybridStudioExtension.schema.json", "utf8"));
const runtimeCapabilities = fs.readFileSync("src/runtime/generated/05-extension-capability-contract.js", "utf8");
const sdkCapabilities = fs.readFileSync("EXTENSION_CAPABILITIES.md", "utf8");

assert.equal(new Set(capabilityIds).size, capabilityIds.length, "extension capability ids must be unique");
assert.deepEqual(schema.properties.permissions.items.enum, capabilityIds, "extension schema permissions drifted from the canonical registry");
assert.deepEqual(schema.properties.capabilityPolicy.properties.capabilities.items.enum, capabilityIds, "extension capability policy schema drifted from the canonical registry");
for (const id of capabilityIds) {
    assert.match(runtimeCapabilities, new RegExp(`"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `runtime capability ${id} is missing`);
    assert.ok(sdkCapabilities.includes(`| \`${id}\` |`), `SDK capability ${id} is missing`);
}

const apiPolicy = JSON.parse(fs.readFileSync("src/contracts/public-api-policy.json", "utf8"));
const apiManifest = JSON.parse(fs.readFileSync("HybridTileGraft.api.json", "utf8"));
const declarations = fs.readFileSync("HybridTileGraft.d.ts", "utf8");
const publicApiSource = fs.readFileSync("src/runtime/parts/170-public-api.js", "utf8");
const apiBlock = publicApiSource.match(/window\.HybridTileGraft\s*=\s*\{([\s\S]*?)\n\s*\};/)?.[1] || "";
const apiNames = [];
for (const line of apiBlock.split(/\r?\n/)) {
    const match = line.match(/^\s{8}([A-Za-z_$][\w$]*)(?=\s*[:,(])/);
    if (match) apiNames.push(match[1]);
}

assert.equal(apiManifest.apiVersion, apiPolicy.apiVersion);
assert.equal(new Set(apiNames).size, apiNames.length, "public API names must be unique");
assert.deepEqual(apiManifest.entries.map(item => item.name), apiNames, "generated public API manifest is stale");
for (const item of apiManifest.entries) {
    assert.ok(["stable", "compatibility", "experimental", "deprecated"].includes(item.stability));
    assert.match(declarations, new RegExp(`\\b${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), `declaration for ${item.name} is missing`);
}

for (const relative of [
    "src/runtime/parts/70-smart-fill-and-transforms.js",
    "src/runtime/parts/80-generators.js",
    "src/runtime/parts/100-production-foundation.js",
    "src/runtime/parts/120-live-production.js",
    "src/runtime/parts/130-creator-console.js",
    "src/runtime/parts/140-worldsmith-services.js"
]) {
    assert.doesNotMatch(fs.readFileSync(relative, "utf8"), /\bqueue\.shift\(\)/, `${relative} uses an O(n) queue shift`);
}

const scripts = require("../../package.json").scripts;
assert.ok(scripts.lint, "a lint gate is required");
assert.match(scripts.verify, /npm run lint/, "release verification must include lint");

console.log("Canonical capability, public API, queue, and static-analysis contracts passed.");
