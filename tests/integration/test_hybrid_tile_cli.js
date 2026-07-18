"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const cli = require("../../HybridTileStudioCLI.js");

const project = path.resolve(__dirname, "../fixtures/cli-project");
const report = cli.validateProject(project);
assert.strictEqual(report.passed, true);
assert.strictEqual(report.errors, 0);
assert.strictEqual(report.maps.length, 1);
assert.match(report.maps[0].checksum, /^[0-9a-f]{8}$/);
assert.match(report.fingerprint, /^sha256-[0-9a-f]{64}$/);
assert.strictEqual(report.studioVersion, "18.1.0");
assert.match(cli.textReport(report), /PASS/);

const invalid = JSON.parse(fs.readFileSync(path.join(project, "data/Map001.json"), "utf8"));
invalid.data.pop();
const findings = [];
cli.validateMap(invalid, 1, [null, { id: 1 }], findings);
assert.ok(findings.some(item => item.code === "map-data-size"));
assert.strictEqual(cli.parseArgs(["validate-project", project, "--json"]).options.json, true);
console.log("Hybrid Tile Studio v18.1 CLI project validation and SHA-256 fingerprint test passed.");
