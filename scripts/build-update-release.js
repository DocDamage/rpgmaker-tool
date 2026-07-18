#!/usr/bin/env node
"use strict";

const { build } = require("electron-builder");

function normalizeUpdateUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("HTG_UPDATE_URL is required for an update-enabled release.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("HTG_UPDATE_URL must use HTTPS.");
  if (parsed.username || parsed.password) throw new Error("HTG_UPDATE_URL must not contain credentials.");
  if (parsed.search || parsed.hash) throw new Error("HTG_UPDATE_URL must not contain a query string or fragment.");
  return parsed.toString().replace(/\/$/, "");
}

function releaseConfig(platform = process.platform, environment = process.env) {
  const config = { publish: [{ provider: "generic", url: normalizeUpdateUrl(environment.HTG_UPDATE_URL) }] };
  if (platform === "win32" || platform === "darwin") config.forceCodeSigning = true;
  if (platform === "win32" && environment.HTG_WIN_CERT_SHA1) {
    config.win = { signtoolOptions: { certificateSha1: String(environment.HTG_WIN_CERT_SHA1).trim() } };
  }
  return config;
}

async function main() {
  await build({ publish: "never", config: releaseConfig() });
}

if (require.main === module) main().catch(error => { console.error(error.message || error); process.exit(1); });

module.exports = { normalizeUpdateUrl, releaseConfig };

