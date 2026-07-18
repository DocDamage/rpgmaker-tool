/* Hybrid Tile Studio v18.1 — project-adjacent browser persistence */
(() => {
  "use strict";

  const VERSION = "18.1.0";
  const DB_NAME = "HybridTileStudio";
  const DB_VERSION = 1;
  const STORE = "records";
  const memory = new Map();
  let databasePromise = null;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    databasePromise = new Promise(resolve => {
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (_) { resolve(null); return; }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return databasePromise;
  }

  async function transact(mode, operation) {
    const database = await openDatabase();
    if (!database) return operation(null);
    return new Promise((resolve, reject) => {
      let result;
      try {
        const transaction = database.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        result = operation(store);
        transaction.oncomplete = () => resolve(result?.result ?? result);
        transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
      } catch (error) { reject(error); }
    });
  }

  async function put(key, value, metadata = {}) {
    const record = { key: String(key), value: clone(value), updatedAt: Date.now(), ...clone(metadata) };
    const database = await openDatabase();
    if (!database) { memory.set(record.key, record); return clone(record.value); }
    await transact("readwrite", store => store.put(record));
    return clone(record.value);
  }

  async function get(key, fallback = null) {
    const normalized = String(key);
    const database = await openDatabase();
    if (!database) return clone(memory.get(normalized)?.value ?? fallback);
    const record = await transact("readonly", store => store.get(normalized));
    return clone(record?.value ?? fallback);
  }

  async function remove(key) {
    const normalized = String(key);
    memory.delete(normalized);
    const database = await openDatabase();
    if (!database) return true;
    await transact("readwrite", store => store.delete(normalized));
    return true;
  }

  async function list(prefix = "") {
    const normalized = String(prefix);
    const database = await openDatabase();
    if (!database) return [...memory.values()].filter(record => record.key.startsWith(normalized)).map(clone).sort((a,b)=>b.updatedAt-a.updatedAt);
    const records = await transact("readonly", store => store.getAll());
    return (records || []).filter(record => record.key.startsWith(normalized)).map(clone).sort((a,b)=>b.updatedAt-a.updatedAt);
  }

  async function prune(prefix = "", options = {}) {
    const maxEntries = Math.max(0, Number(options.maxEntries ?? 24));
    const maxAgeMs = Math.max(0, Number(options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000));
    const now = Date.now();
    const records = await list(prefix);
    const removeKeys = records.filter((record, index) => (maxEntries && index >= maxEntries) || (maxAgeMs && now - Number(record.updatedAt || 0) > maxAgeMs)).map(record => record.key);
    await Promise.all(removeKeys.map(remove));
    return removeKeys;
  }

  async function estimate() {
    try {
      const storage = globalThis.navigator?.storage;
      if (storage?.estimate) {
        const value = await storage.estimate();
        return { usage: Number(value.usage || 0), quota: Number(value.quota || 0), persisted: storage.persisted ? await storage.persisted() : false, backend: "indexeddb" };
      }
    } catch (_) { /* optional */ }
    const text = JSON.stringify([...memory.values()]);
    return { usage: text.length * 2, quota: 0, persisted: false, backend: typeof indexedDB === "undefined" ? "memory" : "indexeddb" };
  }

  const api = Object.freeze({ version: VERSION, put, get, remove, list, prune, estimate, _resetForTests: () => { memory.clear(); databasePromise = null; } });
  globalThis.HybridTileStorageV18 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
