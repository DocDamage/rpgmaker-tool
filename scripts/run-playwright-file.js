#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

const playwrightCli = require.resolve("@playwright/test/cli");
const result = spawnSync(process.execPath, [playwrightCli, "test"], {
  stdio: "inherit",
  env: { ...process.env, HTG_E2E_FILE: "1" }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
