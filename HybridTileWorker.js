"use strict";
const hash = text => { let value = 2166136261; for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return value >>> 0; };
const randomFrom = seed => { let value = hash(seed) || 1; return () => { value += 0x6D2B79F5; let next = value; next = Math.imul(next ^ next >>> 15, next | 1); next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; }; };
const DIRECTIONS = [{ key: "N", opposite: "S", dx: 0, dy: -1 }, { key: "E", opposite: "W", dx: 1, dy: 0 }, { key: "S", opposite: "N", dx: 0, dy: 1 }, { key: "W", opposite: "E", dx: -1, dy: 0 }];
function weightedOrder(values, weights, random) { return [...values].map(value => ({ value, score: Math.pow(random() || 1e-9, 1 / Math.max(1, Number(weights?.[value]) || 1)) })).sort((a, b) => b.score - a.score).map(item => item.value); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function tileIndex(width, height, x, y, layer) { return (layer * height + y) * width + x; }
function floodFill(payload) {
  const width = Math.max(1, Math.trunc(Number(payload.width) || 1));
  const height = Math.max(1, Math.trunc(Number(payload.height) || 1));
  const layer = clamp(Math.trunc(Number(payload.layer) || 0), 0, 5);
  const data = Array.isArray(payload.data) ? payload.data : [];
  const x = clamp(Math.trunc(Number(payload.x) || 0), 0, width - 1);
  const y = clamp(Math.trunc(Number(payload.y) || 0), 0, height - 1);
  const start = tileIndex(width, height, x, y, layer);
  const target = Number(payload.target ?? data[start] ?? 0);
  const replacement = Number(payload.replacement ?? 0);
  if (target === replacement) return { indices: [], target, replacement, stats: { cells: 0, complete: true } };
  const maxCells = Math.max(1, Math.trunc(Number(payload.maxCells) || width * height));
  if (maxCells < width * height && payload.requireComplete !== false) throw new Error(`Flood fill maxCells (${maxCells}) is smaller than the map (${width * height}).`);
  // Each cell is queued at most once, so the fixed-size queue remains safe even on the largest supported maps.
  const queue = new Int32Array(width * height);
  const seen = new Uint8Array(width * height);
  const indices = [];
  let head = 0, tail = 0;
  const enqueue = cell => {
    if (cell < 0 || cell >= seen.length || seen[cell]) return;
    seen[cell] = 1;
    queue[tail++] = cell;
  };
  enqueue(y * width + x);
  while (head < tail) {
    const cell = queue[head++], px = cell % width, py = Math.floor(cell / width);
    const index = tileIndex(width, height, px, py, layer);
    if (Number(data[index] ?? 0) !== target) continue;
    indices.push(index);
    if (indices.length > maxCells) throw new Error(`Flood fill exceeded maxCells (${maxCells}).`);
    if (px > 0) enqueue(cell - 1);
    if (px + 1 < width) enqueue(cell + 1);
    if (py > 0) enqueue(cell - width);
    if (py + 1 < height) enqueue(cell + width);
  }
  return { indices, target, replacement, stats: { cells: indices.length, complete: true } };
}
function generateStage(payload) {
  const map = payload.map || {};
  const stage = payload.stage || payload.options || {};
  const width = Math.max(1, Math.trunc(Number(map.width) || 1));
  const height = Math.max(1, Math.trunc(Number(map.height) || 1));
  const layer = clamp(Math.trunc(Number(stage.layer) || 0), 0, 5);
  const tileA = Math.max(0, Math.trunc(Number(stage.tileA) || 0));
  const tileB = Math.max(0, Math.trunc(Number(stage.tileB) || 0));
  const type = String(stage.type || "scatter");
  const random = randomFrom(`${payload.seed || "worldsmith"}:${stage.id || type}`);
  const entries = new Map();
  const set = (x, y, value) => { if (x >= 0 && y >= 0 && x < width && y < height) entries.set(tileIndex(width, height, x, y, layer), Math.max(0, Math.trunc(Number(value) || 0))); };
  if (type === "biome" || type === "terrain" || type === "transitions") {
    const scale = Math.max(2, Math.trunc(Number(stage.scale) || 8));
    const threshold = Number(stage.threshold ?? 0);
    const seed = hash(payload.seed || "worldsmith");
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const climate = (Math.sin((x + seed % 31) / scale) + Math.cos((y + seed % 17) / scale) + (random() - .5) * .9) / 2;
      set(x, y, climate > threshold ? tileB : tileA);
    }
  } else if (type === "dungeon" || type === "maze") {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, tileA);
    const rooms = [];
    const count = Math.max(1, Math.trunc(Number(stage.count) || 8));
    for (let index = 0; index < count; index++) {
      const roomWidth = clamp(3 + Math.floor(random() * 7), 3, Math.max(3, width - 2));
      const roomHeight = clamp(3 + Math.floor(random() * 6), 3, Math.max(3, height - 2));
      const roomX = Math.floor(random() * Math.max(1, width - roomWidth));
      const roomY = Math.floor(random() * Math.max(1, height - roomHeight));
      const room = { x: roomX, y: roomY, w: roomWidth, h: roomHeight, cx: roomX + Math.floor(roomWidth / 2), cy: roomY + Math.floor(roomHeight / 2) };
      rooms.push(room);
      for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) set(x, y, tileB);
      if (rooms.length > 1) {
        const previous = rooms[rooms.length - 2]; let x = previous.cx, y = previous.cy;
        while (x !== room.cx) { set(x, y, tileB); x += Math.sign(room.cx - x); }
        while (y !== room.cy) { set(x, y, tileB); y += Math.sign(room.cy - y); }
      }
    }
  } else if (type === "road" || type === "roads" || type === "river" || type === "riverNetwork") {
    let x = 0, y = Math.floor(height / 2); const endX = width - 1, endY = Math.floor(height / 2);
    let guard = width * height * 4;
    while (guard-- && (x !== endX || y !== endY)) {
      set(x, y, tileA);
      if (type === "river") {
        const candidates = [[x, y + 1], [x - 1, y + 1], [x + 1, y + 1]];
        [x, y] = candidates[Math.floor(random() * candidates.length)];
      } else if (random() < .6 && x !== endX) x += Math.sign(endX - x);
      else if (y !== endY) y += Math.sign(endY - y);
      else x += Math.sign(endX - x);
      x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
    }
    set(endX, endY, tileA);
  } else if (type === "scatter" || type === "decorate" || type === "details") {
    const count = Math.max(0, Math.trunc(Number(stage.count) || Math.floor(width * height * Number(stage.density || .08))));
    for (let index = 0; index < count; index++) set(Math.floor(random() * width), Math.floor(random() * height), random() < .5 ? tileA : tileB);
  } else throw new Error(`Unsupported generation stage: ${type}`);
  return { entries: [...entries], stats: { cells: entries.size, type, layer, complete: true } };
}
function solveWfc(payload) {
  const width = Math.max(1, Math.trunc(Number(payload.width) || 1)); const height = Math.max(1, Math.trunc(Number(payload.height) || 1)); const layer = Math.max(0, Math.min(5, Math.trunc(Number(payload.layer) || 0)));
  const rules = payload.rules || {}; const palette = (rules.palette || payload.palette || [0, 1]).map(Number); const random = randomFrom(payload.seed || "hybrid-wfc");
  const cells = Array.isArray(payload.cells) && payload.cells.length ? payload.cells.map(point => [Math.trunc(Number(point[0])), Math.trunc(Number(point[1]))]).filter(([x, y]) => x >= 0 && y >= 0 && x < width && y < height) : Array.from({ length: width * height }, (_, index) => [index % width, Math.floor(index / width)]);
  const maxCells = Math.max(1, Math.trunc(Number(payload.maxCells) || 20000)); if (cells.length > maxCells) throw new Error("WFC area exceeds maxCells."); if (!palette.length) return { entries: [], stats: { cells: 0, backtracks: 0, solved: false } };
  const keys = cells.map(([x, y]) => `${x},${y}`); let domains = new Map(keys.map(key => [key, new Set(palette)])); let backtracks = 0; const stack = [];
  const allowed = (tile, direction, candidate) => { const values = rules.adjacency?.[tile]?.[direction]; return !Array.isArray(values) || values.map(Number).includes(candidate); };
  const cloneDomains = value => new Map([...value].map(([key, domain]) => [key, new Set(domain)]));
  const propagate = seeds => { const queue = [...seeds]; while (queue.length) { const key = queue.shift(); const domain = domains.get(key); if (!domain?.size) return false; const [x, y] = key.split(",").map(Number); for (const direction of DIRECTIONS) { const neighborKey = `${x + direction.dx},${y + direction.dy}`; const neighbor = domains.get(neighborKey); if (!neighbor) continue; const next = new Set([...neighbor].filter(candidate => [...domain].some(tile => allowed(tile, direction.key, candidate) && allowed(candidate, direction.opposite, tile)))); if (!next.size) return false; if (next.size < neighbor.size) { domains.set(neighborKey, next); queue.push(neighborKey); } } } return true; };
  while (true) { let choiceKey = null; let entropy = Infinity; for (const [key, domain] of domains) if (domain.size > 1 && domain.size < entropy) { choiceKey = key; entropy = domain.size; } if (!choiceKey) break; const candidates = weightedOrder(domains.get(choiceKey), rules.weights, random); const snapshot = cloneDomains(domains); stack.push({ snapshot, key: choiceKey, remaining: candidates.slice(1) }); domains.set(choiceKey, new Set([candidates[0]])); if (propagate([choiceKey])) continue; let recovered = false; while (stack.length && backtracks++ < Math.max(1, Math.trunc(Number(payload.maxBacktracks) || 256))) { const frame = stack.at(-1); if (!frame.remaining.length) { stack.pop(); continue; } const candidate = frame.remaining.shift(); domains = cloneDomains(frame.snapshot); domains.set(frame.key, new Set([candidate])); if (propagate([frame.key])) { recovered = true; break; } } if (!recovered) { domains = snapshot; for (const [key, domain] of domains) if (domain.size > 1) domains.set(key, new Set([weightedOrder(domain, rules.weights, random)[0]])); break; } }
  const entries = [...domains].map(([key, domain]) => { const [x, y] = key.split(",").map(Number); return [((layer * height + y) * width + x), domain.values().next().value ?? palette[0]]; }); return { entries, stats: { cells: cells.length, backtracks, solved: [...domains.values()].every(domain => domain.size === 1) } };
}
self.onmessage = event => {
  const { id, type, payload = {} } = event.data || {};
  try {
    let result;
    if (type === "search") { const query = String(payload.query || "").toLowerCase(); result = (payload.records || []).filter(record => JSON.stringify(record).toLowerCase().includes(query)); }
    else if (type === "projectSearch") { const query = String(payload.query || "").toLowerCase(); const numeric = /^\d+$/.test(query) ? Number(query) : null; result = []; for (const record of payload.records || []) { if (numeric !== null) { let count = 0; for (const value of record.map.data || []) if (Number(value) === numeric) count++; if (count) result.push({ mapId: record.mapId, name: record.name, detail: `${count} tile occurrence(s)` }); } for (const eventData of record.map.events || []) if (eventData && JSON.stringify(eventData).toLowerCase().includes(query)) result.push({ mapId: record.mapId, name: record.name, eventId: eventData.id, detail: `Event ${eventData.id}: ${eventData.name}` }); } }
    else if (type === "noise") { const random = randomFrom(payload.seed); result = Array.from({ length: Math.max(0, Number(payload.length) || 0) }, () => random()); }
    else if (type === "wfc") result = solveWfc(payload);
    else if (type === "flood-fill") result = floodFill(payload);
    else if (type === "generate-stage") result = generateStage(payload);
    else if (type === "canonicalize") { const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value; result = canonical(payload.value); }
    else throw new Error(`Unknown worker job: ${type}`);
    self.postMessage({ id, ok: true, result });
  } catch (error) { self.postMessage({ id, ok: false, error: error.message }); }
};
