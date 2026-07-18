"use strict";
const VERSION = "18.1.0";
const CACHE_PREFIX = "hybrid-tile-studio-v";
const LEGACY_CACHE_PREFIX = "hybrid-tile-studio-";
const CACHE = `${CACHE_PREFIX}${VERSION}`;
let assetManifestPromise = null;

function assetKey(request) {
  const url = new URL(request.url || request, self.location.href);
  const scope = new URL(self.registration.scope);
  return decodeURIComponent(url.pathname.startsWith(scope.pathname) ? url.pathname.slice(scope.pathname.length) : url.pathname.replace(/^\//, ""));
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function loadAssetManifest() {
  if (!assetManifestPromise) assetManifestPromise = (async () => {
    const response = await fetch("./asset-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load the asset manifest (${response.status}).`);
    const manifest = await response.json();
    if (manifest?.format !== "HybridTileAssetManifest" || manifest.appVersion !== VERSION || !Array.isArray(manifest.core)) {
      throw new Error("The asset manifest does not match this Worldsmith version.");
    }
    return manifest;
  })();
  return assetManifestPromise;
}

async function verifyResponse(request, response, manifest) {
  const key = assetKey(request);
  const expected = manifest.assets?.[key];
  if (!expected) return response;
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== expected.bytes) throw new Error(`Asset size mismatch for ${key}.`);
  const digest = await sha256Hex(bytes);
  if (digest !== expected.sha256) throw new Error(`Asset digest mismatch for ${key}.`);
  return response;
}

async function fetchAndCache(cache, request, manifest) {
  const response = await fetch(request, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not cache ${new URL(request.url || request, self.location.href).pathname} (${response.status}).`);
  await verifyResponse(request, response, manifest);
  if (response.type === "basic" || response.type === "default") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const manifest = await loadAssetManifest();
    const cache = await caches.open(CACHE);
    await Promise.all(manifest.core.map(path => fetchAndCache(cache, new Request(path, { cache: "reload" }), manifest)));
    // The running editor keeps its current version until the creator explicitly
    // saves the current draft and accepts the update banner.
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX)) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) return response;
    const manifest = await loadAssetManifest();
    await verifyResponse(new Request("./HybridTileStudio.html"), response, manifest);
    if (response.type === "basic" || response.type === "default") {
      const cache = await caches.open(CACHE);
      await cache.put("./HybridTileStudio.html", response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match("./HybridTileStudio.html")) || Response.error();
  }
}

async function staticResponse(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const manifest = await loadAssetManifest();
  const response = await fetch(request);
  if (!response.ok) return response;
  await verifyResponse(request, response, manifest);
  if (response.type === "basic" || response.type === "default") {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === "navigate" ? navigationResponse(request) : staticResponse(request));
});
