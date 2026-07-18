/* Hybrid Tile Studio v18.1 — safe service-worker update lifecycle */
(() => {
  "use strict";
  const VERSION = "18.1.0";
  let registration = null;

  function announce(worker) {
    if (!worker) return;
    document.dispatchEvent(new CustomEvent("HybridTileStudio:update-available", { detail: { version: VERSION } }));
  }

  async function register() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return null;
    registration = await navigator.serviceWorker.register("service-worker.js");
    if (registration.waiting) announce(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) announce(worker);
      });
    });
    return registration;
  }

  async function activateUpdate() {
    const worker = registration?.waiting;
    if (!worker) return false;
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    worker.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  const api = Object.freeze({ version: VERSION, register, activateUpdate, registration: () => registration });
  globalThis.HybridTilePwaV18 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
