#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "src/manifest.json"), "utf8"));
function copy(name, group) {
  const from = path.join(ROOT, name), to = path.join(ROOT, "src", group, name);
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
}
for (const name of manifest.studioFiles) copy(name, "studio");
for (const name of manifest.desktopFiles) copy(name, "desktop");
console.log("Active studio and desktop sources synchronized from release roots.");
console.log("Runtime plugin parts are intentionally edited in src/runtime/parts and assembled with npm run build.");
