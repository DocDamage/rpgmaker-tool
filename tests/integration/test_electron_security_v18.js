"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("electron-main.js", "utf8");

// Filesystem boundary and destructive-operation safeguards.
assert.match(source, /function resolveDestructive\(/);
assert.match(source, /target === base/);
assert.match(source, /force: false/);
assert.match(source, /target !== applicationUrl/);
assert.match(source, /will-attach-webview/);
assert.match(source, /const temporary = `\$\{target\}\.htg-tmp-/);
assert.match(source, /await fs\.writeFile\(temporary, String\(value\), "utf8"\)/);
assert.match(source, /await fs\.rename\(temporary, target\)/);

// Recent-project health must distinguish unavailable folders and recovery state.
assert.match(source, /async function recoveryHealth\(/);
assert.match(source, /recoveryCount: names\.length/);
assert.match(source, /lastRecoveryAt:/);
assert.match(source, /available: true/);
assert.match(source, /available: false/);
assert.match(source, /Project is not in the recent-project list/);
assert.match(source, /Recent project directory is unavailable/);

// Git is constrained to a small command surface and path-escape flags are denied.
const commands = source.match(/const SAFE_GIT_COMMANDS = new Set\(\[([^\]]+)/)?.[1] || "";
assert.doesNotMatch(commands, /checkout/);
assert.match(source, /git-dir\|work-tree/);
assert.match(source, /Only git lfs status/);

// Renderer isolation, navigation control, and permission denial remain explicit.
assert.match(source, /contextIsolation: true/);
assert.match(source, /nodeIntegration: false/);
assert.match(source, /sandbox: true/);
assert.match(source, /webSecurity: true/);
assert.match(source, /allowRunningInsecureContent: false/);
assert.match(source, /setPermissionRequestHandler\([\s\S]*callback\(false\)/);

console.log("Hybrid Tile Studio v18.1 Electron boundary, atomic-write, and recent-project assertions passed.");
