#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const matrix = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/rpgmaker/engine-matrix.json"), "utf8"));
const versions = matrix.engines.map(item => item.version);

assert.equal(matrix.format, "HybridTileGraftRpgMakerEngineMatrix");
assert.deepEqual(versions, ["1.8.0", "1.10.0"]);
for (const engine of matrix.engines) {
  assert.ok(fs.existsSync(path.join(root, engine.marker)), `Missing retained RPG Maker ${engine.version} marker.`);
  assert.ok(fs.existsSync(path.join(root, engine.attestation)), `Missing RPG Maker ${engine.version} attestation.`);
}

const configuredInstall = process.env.RPGMZ_ROOT;
const defaultInstall = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\RPG Maker MZ";
const install = configuredInstall || defaultInstall;
if (fs.existsSync(install)) {
  const engineSources = new Map([
    ["1.8.0", path.join(install, "corescript", "v1.8.0", "rmmz_core.js")],
    ["1.10.0", path.join(install, "newdata", "js", "rmmz_core.js")]
  ]);
  for (const [version, source] of engineSources) {
    assert.ok(fs.existsSync(source), `Official RPG Maker ${version} core script is unavailable at ${source}.`);
    assert.match(fs.readFileSync(source, "utf8"), new RegExp(`RPGMAKER_VERSION\\s*=\\s*["']${version.replace(/\./g, "\\.")}["']`));
  }
  console.log(`Official RPG Maker corescript matrix verified at ${install}.`);
} else {
  console.log("Official RPG Maker installation not present; retained source-bound engine evidence was verified instead.");
}
