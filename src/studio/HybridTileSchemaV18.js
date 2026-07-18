/* Hybrid Tile Studio v18.1 — executable JSON Schema subset */
(() => {
  "use strict";

  const VERSION = "18.1.0";
  const cache = new Map();

  function typeMatches(value, type) {
    if (Array.isArray(type)) return type.some(candidate => typeMatches(value, candidate));
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return !!value && typeof value === "object" && !Array.isArray(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
  }

  function schemaDocuments() { return globalThis.HybridTileSchemaDocumentsV18 || {}; }
  function resolvePointer(root, pointer) {
    if (!pointer.startsWith("#/")) return null;
    return pointer.slice(2).split("/").reduce((value, part) => value?.[part.replace(/~1/g,"/").replace(/~0/g,"~")], root);
  }
  function resolveReference(root, reference) {
    if (reference.startsWith("#")) return { schema: resolvePointer(root, reference), root };
    const [name, fragment = ""] = reference.split("#");
    const filename = name.split("/").at(-1);
    const external = cache.get(filename) || schemaDocuments()[filename];
    if (!external) return null;
    return { schema: fragment ? resolvePointer(external, `#${fragment}`) : external, root: external };
  }

  function validate(value, schema, options = {}) {
    const errors = [];
    const root = options.root || schema;
    const path = options.path || "$";
    const push = (at, message, keyword) => errors.push({ path: at, message, keyword });

    function visit(current, rule, at) {
      if (!rule || typeof rule !== "object") return;
      if (rule.$ref) {
        const target = resolveReference(root, rule.$ref);
        if (target?.schema) {
          const nested = validate(current, target.schema, { root: target.root, path: at });
          errors.push(...nested.errors);
        } else push(at, `Unresolved schema reference ${rule.$ref}.`, "$ref");
        return;
      }
      if (rule.const !== undefined && JSON.stringify(current) !== JSON.stringify(rule.const)) push(at, `Must equal ${JSON.stringify(rule.const)}.`, "const");
      if (rule.enum && !rule.enum.some(item => JSON.stringify(item) === JSON.stringify(current))) push(at, `Must be one of ${rule.enum.map(String).join(", ")}.`, "enum");
      if (rule.type && !typeMatches(current, rule.type)) { push(at, `Expected ${Array.isArray(rule.type) ? rule.type.join(" or ") : rule.type}.`, "type"); return; }
      if (rule.oneOf) {
        const matches = rule.oneOf.filter(candidate => !validate(current, candidate, { root, path: at }).errors.length);
        if (matches.length !== 1) push(at, "Must match exactly one allowed shape.", "oneOf");
      }
      if (rule.anyOf && !rule.anyOf.some(candidate => !validate(current, candidate, { root, path: at }).errors.length)) push(at, "Must match at least one allowed shape.", "anyOf");
      if (rule.not && !validate(current, rule.not, { root, path: at }).errors.length) push(at, "Must not match the forbidden shape.", "not");
      if (rule.allOf) for (const candidate of rule.allOf) visit(current, candidate, at);
      if (rule.if) {
        const condition = validate(current, rule.if, { root, path: at }).errors.length === 0;
        if (condition && rule.then) visit(current, rule.then, at);
        if (!condition && rule.else) visit(current, rule.else, at);
      }
      if (typeof current === "string") {
        if (rule.minLength !== undefined && current.length < rule.minLength) push(at, `Must contain at least ${rule.minLength} characters.`, "minLength");
        if (rule.maxLength !== undefined && current.length > rule.maxLength) push(at, `Must contain at most ${rule.maxLength} characters.`, "maxLength");
        if (rule.pattern) { try { if (!new RegExp(rule.pattern).test(current)) push(at, `Does not match ${rule.pattern}.`, "pattern"); } catch (_) { push(at, `Schema contains an invalid pattern.`, "pattern"); } }
        if (rule.format === "date-time" && Number.isNaN(Date.parse(current))) push(at, "Must be an ISO date-time.", "format");
      }
      if (typeof current === "number") {
        if (rule.minimum !== undefined && current < rule.minimum) push(at, `Must be at least ${rule.minimum}.`, "minimum");
        if (rule.maximum !== undefined && current > rule.maximum) push(at, `Must be at most ${rule.maximum}.`, "maximum");
      }
      if (Array.isArray(current)) {
        if (rule.minItems !== undefined && current.length < rule.minItems) push(at, `Must contain at least ${rule.minItems} items.`, "minItems");
        if (rule.maxItems !== undefined && current.length > rule.maxItems) push(at, `Must contain at most ${rule.maxItems} items.`, "maxItems");
        if (rule.uniqueItems) {
          const keys = current.map(item => JSON.stringify(item));
          if (new Set(keys).size !== keys.length) push(at, "Items must be unique.", "uniqueItems");
        }
        if (rule.items) current.forEach((item, index) => visit(item, rule.items, `${at}[${index}]`));
      }
      if (current && typeof current === "object" && !Array.isArray(current)) {
        const keys = Object.keys(current);
        if (rule.minProperties !== undefined && keys.length < rule.minProperties) push(at, `Must contain at least ${rule.minProperties} properties.`, "minProperties");
        if (rule.maxProperties !== undefined && keys.length > rule.maxProperties) push(at, `Must contain at most ${rule.maxProperties} properties.`, "maxProperties");
        if (rule.propertyNames) for (const key of keys) visit(key, rule.propertyNames, `${at}.${key}`);
        for (const key of rule.required || []) if (!(key in current)) push(`${at}.${key}`, "Required property is missing.", "required");
        for (const [key, child] of Object.entries(rule.properties || {})) if (key in current) visit(current[key], child, `${at}.${key}`);
        if (rule.additionalProperties === false) for (const key of Object.keys(current)) if (!(key in (rule.properties || {}))) push(`${at}.${key}`, "Additional property is not allowed.", "additionalProperties");
        if (rule.additionalProperties && typeof rule.additionalProperties === "object") for (const key of Object.keys(current)) if (!(key in (rule.properties || {}))) visit(current[key], rule.additionalProperties, `${at}.${key}`);
      }
    }

    visit(value, schema, path);
    return { ok: errors.length === 0, errors };
  }

  function register(name, schema) {
    const filename = String(name).endsWith(".json") ? String(name).split("/").at(-1) : `${name}.schema.json`;
    cache.set(filename, schema);
    return schema;
  }

  async function load(name) {
    const filename = String(name).endsWith(".json") ? String(name).split("/").at(-1) : `${name}.schema.json`;
    if (cache.has(filename)) return cache.get(filename);
    const embedded = schemaDocuments()[filename];
    if (embedded) return register(filename, embedded);
    if (typeof fetch !== "function") throw new Error("Schema loading requires fetch or embedded schemas in this environment.");
    const response = await fetch(`schemas/${filename}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load schema ${filename} (${response.status}).`);
    const schema = await response.json();
    cache.set(filename, schema);
    return schema;
  }

  async function validateNamed(value, name) {
    const schema = await load(name);
    return validate(value, schema);
  }

  async function assertNamed(value, name) {
    const report = await validateNamed(value, name);
    if (!report.ok) {
      const detail = report.errors.slice(0, 6).map(error => `${error.path}: ${error.message}`).join("; ");
      const error = new Error(`${name} validation failed: ${detail}`);
      error.validation = report;
      throw error;
    }
    return value;
  }

  for (const [name, schema] of Object.entries(schemaDocuments())) register(name, schema);
  const api = Object.freeze({ version: VERSION, validate, load, register, validateNamed, assertNamed, clearCache: () => cache.clear() });
  globalThis.HybridTileSchemaV18 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
