#!/usr/bin/env node
"use strict";

/** Hybrid Tile Studio v18 Worldsmith headless, read-only project validator. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VERSION = "18.1.0";
const BRIDGE_FILES = ["data/HybridTileLiveState.json", "data/HybridTileLiveCommands.json", "data/HybridTileLastRecording.json"];
const REQUIRED_DATABASES = ["MapInfos.json", "Tilesets.json", "System.json"];

function checksum(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function sha256Fingerprint(value) {
  const text = typeof value === "string" ? value : JSON.stringify(canonicalize(value));
  return `sha256-${crypto.createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function readJson(filename, errors, label = filename) {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch (error) { errors.push({ severity: "error", code: "invalid-json", file: label, message: error.message }); return null; }
}

function safeProjectPath(root, relative) {
  const base = path.resolve(root), target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error(`Path escapes project: ${relative}`);
  return target;
}

function commandFindings(list, context, findings) {
  if (!Array.isArray(list)) { findings.push({ severity: "error", code: "command-list", context, message: "Event command list is not an array." }); return; }
  if (!list.length || Number(list[list.length - 1]?.code) !== 0) findings.push({ severity: "error", code: "missing-end", context, message: "Event page must end with command 0." });
  const branches = [];
  list.forEach((command, index) => {
    if (!command || !Number.isInteger(Number(command.code)) || !Array.isArray(command.parameters)) findings.push({ severity: "error", code: "invalid-command", context: `${context} command ${index}`, message: "Command code and parameter array are required." });
    if ([111, 112, 102].includes(Number(command?.code))) branches.push(Number(command.code));
    if (Number(command?.code) === 412 && !branches.includes(111)) findings.push({ severity: "error", code: "orphan-branch-end", context, message: `Command ${index} ends a missing conditional branch.` });
    if (Number(command?.code) === 413 && !branches.includes(112)) findings.push({ severity: "error", code: "orphan-loop-end", context, message: `Command ${index} repeats a missing loop.` });
    if (Number(command?.code) === 201) {
      const mode = Number(command.parameters?.[0]);
      if (mode === 0 && Number(command.parameters?.[1]) <= 0) findings.push({ severity: "error", code: "invalid-transfer", context, message: `Command ${index} transfers to an invalid map ID.` });
    }
  });
}

function validateMap(map, mapId, tilesets, findings) {
  const context = `Map ${String(mapId).padStart(3, "0")}`;
  const width = Number(map?.width), height = Number(map?.height), data = map?.data;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) findings.push({ severity: "error", code: "map-size", context, message: "Map width and height must be positive integers." });
  const expected = Math.max(0, width * height * 6);
  if (!Array.isArray(data) || data.length !== expected) findings.push({ severity: "error", code: "map-data-size", context, message: `Expected ${expected} tile entries; found ${Array.isArray(data) ? data.length : "non-array"}.` });
  if (!tilesets?.[Number(map?.tilesetId)]) findings.push({ severity: "error", code: "tileset-reference", context, message: `Tileset ${map?.tilesetId} does not exist.` });
  const occupied = new Map();
  (Array.isArray(map?.events) ? map.events : []).filter(Boolean).forEach(event => {
    const eventContext = `${context} event ${event.id}`;
    if (Number(event.x) < 0 || Number(event.y) < 0 || Number(event.x) >= width || Number(event.y) >= height) findings.push({ severity: "error", code: "event-position", context: eventContext, message: `Event is outside the ${width}×${height} map.` });
    const key = `${event.x},${event.y}`; occupied.set(key, (occupied.get(key) || 0) + 1);
    if (!Array.isArray(event.pages) || !event.pages.length) findings.push({ severity: "warning", code: "event-pages", context: eventContext, message: "Event has no pages." });
    (event.pages || []).forEach((page, pageIndex) => commandFindings(page?.list, `${eventContext} page ${pageIndex + 1}`, findings));
  });
  occupied.forEach((count, tile) => { if (count > 4) findings.push({ severity: "warning", code: "event-density", context, message: `${count} events share tile ${tile}.` }); });
  if ((map?.events || []).filter(Boolean).reduce((sum, event) => sum + (event.pages || []).filter(page => [3,4].includes(Number(page.trigger))).length, 0) > 18) findings.push({ severity: "warning", code: "parallel-density", context, message: "More than 18 autorun/parallel pages may affect playtest performance." });
  return { id: mapId, width, height, events: (map?.events || []).filter(Boolean).length, checksum: checksum(map) };
}

function validateScenario(scenario, index, findings) {
  const context = `Journey ${scenario?.name || index + 1}`;
  if (!scenario || !["HybridPlaytestScenario", "HybridPlaytestJourney"].includes(scenario.format)) findings.push({ severity: "error", code: "journey-format", context, message: "Journey format is unsupported." });
  if (!Array.isArray(scenario?.steps) || !scenario.steps.length) findings.push({ severity: "error", code: "journey-steps", context, message: "Journey has no steps." });
  if (!scenario?.assertions || typeof scenario.assertions !== "object") findings.push({ severity: "error", code: "journey-assertions", context, message: "Journey has no final assertions." });
  (scenario?.steps || []).forEach((step, stepIndex) => { if (!step?.type) findings.push({ severity: "error", code: "journey-step", context, message: `Step ${stepIndex + 1} has no type.` }); });
}

function validateManifest(root, manifestFile, maps, findings) {
  if (!manifestFile) return null;
  const filename = path.resolve(manifestFile), manifest = readJson(filename, findings, path.basename(filename));
  if (!manifest) return null;
  if (manifest.format !== "HybridHeadlessTestManifest") findings.push({ severity: "error", code: "manifest-format", context: "Test manifest", message: "Expected HybridHeadlessTestManifest." });
  (manifest.scenarios || []).forEach((scenario, index) => validateScenario(scenario, index, findings));
  Object.entries(manifest.goldenMaps || {}).forEach(([mapId, golden]) => {
    const current = maps.find(item => Number(item.id) === Number(mapId));
    if (!current) findings.push({ severity: "error", code: "golden-map-missing", context: `Golden map ${mapId}`, message: "Map is absent from the project." });
    else if (golden.checksum !== current.checksum) findings.push({ severity: "error", code: "golden-map-changed", context: `Golden map ${mapId}`, message: `Expected ${golden.checksum}; found ${current.checksum}.` });
  });
  return { file: filename, scenarios: (manifest.scenarios || []).length, goldenMaps: Object.keys(manifest.goldenMaps || {}).length };
}

function validateWorldsmith(root, findings) {
  const worldsmithRoot = safeProjectPath(root, ".hybrid/worldsmith");
  const result = { recipeGraphs: 0, quests: 0, contentItems: 0, files: [] };
  if (!fs.existsSync(worldsmithRoot)) return result;
  for (const name of ["recipe-graphs.json", "quests.json", "content-library.json"]) {
    const filename = path.join(worldsmithRoot, name); if (!fs.existsSync(filename)) continue;
    const value = readJson(filename, findings, `.hybrid/worldsmith/${name}`); if (!value) continue;
    result.files.push(name);
    if (name === "recipe-graphs.json") {
      const graphs = Array.isArray(value.graphs) ? value.graphs : [];
      result.recipeGraphs = graphs.length;
      graphs.forEach((graph, graphIndex) => {
        const ids = new Set((graph.nodes || []).map(node => String(node.id)));
        if (!ids.size) findings.push({ severity:"error", code:"recipe-graph-empty", context:`Recipe graph ${graphIndex + 1}`, message:"Recipe graph has no stages." });
        (graph.edges || []).forEach(edge => { if (!ids.has(String(edge.from)) || !ids.has(String(edge.to))) findings.push({ severity:"error", code:"recipe-graph-edge", context:graph.name || graph.id, message:`Broken stage connection ${edge.from} → ${edge.to}.` }); });
      });
    } else if (name === "quests.json") {
      const quests = Array.isArray(value.quests) ? value.quests : [];
      result.quests = quests.length;
      quests.forEach(quest => { if (quest.valid === false || (quest.errors || []).length) findings.push({ severity:"error", code:"quest-invalid", context:quest.name || quest.id, message:(quest.errors || ["Quest graph is invalid."]).join(" ") }); });
    } else {
      const items = Array.isArray(value.items) ? value.items : [];
      result.contentItems = items.length;
      const ids = new Set(); items.forEach(item => { if (!item?.id || ids.has(item.id)) findings.push({ severity:"error", code:"content-id", context:"Content library", message:`Content item id ${item?.id || "(missing)"} is missing or duplicated.` }); ids.add(item?.id); });
    }
  }
  return result;
}

function validateProject(root, options = {}) {
  const project = path.resolve(root), findings = [];
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new Error(`Project directory not found: ${project}`);
  const dataRoot = safeProjectPath(project, "data");
  if (!fs.existsSync(dataRoot)) throw new Error(`RPG Maker data directory not found: ${dataRoot}`);
  REQUIRED_DATABASES.forEach(name => { if (!fs.existsSync(path.join(dataRoot, name))) findings.push({ severity: "error", code: "missing-database", file: `data/${name}`, message: "Required RPG Maker database file is missing." }); });
  const mapInfos = readJson(path.join(dataRoot, "MapInfos.json"), findings, "data/MapInfos.json") || [];
  const tilesets = readJson(path.join(dataRoot, "Tilesets.json"), findings, "data/Tilesets.json") || [];
  const maps = [];
  mapInfos.filter(Boolean).forEach(info => {
    const relative = `data/Map${String(info.id).padStart(3, "0")}.json`, filename = safeProjectPath(project, relative);
    if (!fs.existsSync(filename)) { findings.push({ severity: "error", code: "missing-map", file: relative, message: `MapInfos entry ${info.id} has no map file.` }); return; }
    const map = readJson(filename, findings, relative); if (map) maps.push(validateMap(map, Number(info.id), tilesets, findings));
  });
  BRIDGE_FILES.forEach(relative => { if (fs.existsSync(safeProjectPath(project, relative))) findings.push({ severity: "warning", code: "live-artifact", file: relative, message: "Stale Live Production bridge file should be excluded from releases." }); });
  const manifest = validateManifest(project, options.manifest, maps, findings);
  const worldsmith = validateWorldsmith(project, findings);
  const errors = findings.filter(item => item.severity === "error").length, warnings = findings.filter(item => item.severity === "warning").length;
  return { format: "HybridHeadlessValidationReport", version: 2, studioVersion: VERSION, createdAt: new Date().toISOString(), project, maps, manifest, worldsmith, findings, errors, warnings, passed: errors === 0, fingerprint: sha256Fingerprint({ maps, manifest, worldsmith, findings }) };
}

function textReport(report) {
  const lines = [`Hybrid Tile Studio v${VERSION} — ${report.passed ? "PASS" : "FAIL"}`, `${report.maps.length} maps · ${report.errors} errors · ${report.warnings} warnings · ${report.fingerprint}`];
  report.findings.forEach(item => lines.push(`${item.severity.toUpperCase().padEnd(7)} ${item.file || item.context || "Project"}: ${item.message}`));
  return lines.join("\n");
}

function parseArgs(argv) {
  const values = [...argv], command = values.shift() || "help", options = { json: false };
  const positional = [];
  while (values.length) { const value = values.shift(); if (value === "--manifest") options.manifest = values.shift(); else if (value === "--output") options.output = values.shift(); else if (value === "--json") options.json = true; else positional.push(value); }
  return { command, positional, options };
}

function selfTest() {
  const validMap = { width: 2, height: 2, tilesetId: 1, data: new Array(24).fill(0), events: [null, { id: 1, x: 0, y: 0, pages: [{ trigger: 0, list: [{ code: 0, indent: 0, parameters: [] }] }] }] };
  const findings = [], result = validateMap(validMap, 1, [null, { id: 1 }], findings);
  if (findings.length || result.checksum !== checksum(validMap) || checksum("abc") !== "1a47e90b" || sha256Fingerprint("abc") !== "sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") throw new Error("CLI self-test failed.");
  process.stdout.write(`Hybrid Tile Studio CLI v${VERSION} self-test passed.\n`);
}

function main(argv = process.argv.slice(2)) {
  const { command, positional, options } = parseArgs(argv);
  if (command === "--self-test" || command === "self-test") { selfTest(); return 0; }
  if (command === "--version" || command === "version") { process.stdout.write(`${VERSION}\n`); return 0; }
  if (command !== "validate-project") {
    process.stdout.write(`Hybrid Tile Studio CLI v${VERSION}\n\nUsage:\n  node HybridTileStudioCLI.js validate-project <project> [--manifest file] [--json] [--output report.json]\n  node HybridTileStudioCLI.js --self-test\n`);
    return command === "help" || command === "--help" ? 0 : 2;
  }
  if (!positional[0]) throw new Error("validate-project requires an RPG Maker project directory.");
  const report = validateProject(positional[0], options), output = options.json ? JSON.stringify(report, null, 2) : textReport(report);
  process.stdout.write(`${output}\n`);
  if (options.output) fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report.passed ? 0 : 1;
}

if (require.main === module) { try { process.exitCode = main(); } catch (error) { process.stderr.write(`Hybrid Tile Studio CLI: ${error.message}\n`); process.exitCode = 2; } }
module.exports = { VERSION, checksum, canonicalize, sha256Fingerprint, validateMap, validateScenario, validateWorldsmith, validateProject, textReport, parseArgs, main };
