    // ---------------------------------------------------------------------
    // v12 rule painting, procedural graphs, recovery, catalogs, and budgets
    // ---------------------------------------------------------------------

    function normalizeWorldRuleLayer(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Rule layers require a safe stable ID.");
        const cells = {}; for (const [key, value] of Object.entries(definition?.cells || {})) if (/^-?\d+,-?\d+$/.test(key)) cells[key] = deepClone(value);
        return Object.assign({ id, name: definition?.name || id, mapId: Math.max(0, integer(definition?.mapId)), kind: String(definition?.kind || "gameplay"), visible: definition?.visible !== false, opacity: Math.max(0, Math.min(1, finiteNumber(definition?.opacity, .65))), rules: {}, cells, metadata: {}, updatedAt: Date.now() }, deepClone(definition), { id, cells });
    }

    function defineWorldRuleLayer(definition) { const layer = normalizeWorldRuleLayer(definition); ensureStore().worldRuleLayers[layer.id] = layer; return deepClone(layer); }
    function worldRuleLayer(id) { const value = ensureStore().worldRuleLayers[String(id || "")]; return value ? deepClone(value) : null; }
    function listWorldRuleLayers(options = {}) { return Object.values(ensureStore().worldRuleLayers || {}).filter(layer => !options.mapId || !layer.mapId || layer.mapId === integer(options.mapId)).map(layer => Object.assign(deepClone(layer), { cellCount: Object.keys(layer.cells || {}).length })); }
    function removeWorldRuleLayer(id) { const key = String(id || ""); const existed = !!ensureStore().worldRuleLayers[key]; delete ensureStore().worldRuleLayers[key]; return existed; }

    function paintWorldRules(layerId, input, value = true, options = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) throw new Error(`Rule layer "${layerId}" was not found.`);
        const cells = [];
        if (input && !Array.isArray(input) && (input.width !== undefined || input.w !== undefined)) { const rect = normalizeRect(input.x, input.y, input.width ?? input.w, input.height ?? input.h); for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y }); }
        else cells.push(...normalizeList(input));
        const mode = String(options.mode || "paint").toLowerCase(); let changed = 0;
        for (const cell of cells) { const key = coordinateKey(integer(cell?.x ?? cell?.[0]), integer(cell?.y ?? cell?.[1])); const existing = layer.cells[key]; if (mode === "erase" || value === null || value === undefined || value === false) { if (existing !== undefined) { delete layer.cells[key]; changed++; } } else if (mode === "toggle" && existing !== undefined) { delete layer.cells[key]; changed++; } else { layer.cells[key] = deepClone(cell?.value ?? value); changed++; } }
        layer.updatedAt = Date.now(); recordOperation("paintWorldRules", { layerId: layer.id, changed, mode }); return { layerId: layer.id, changed, cellCount: Object.keys(layer.cells).length };
    }

    function saveWorldRuleBrush(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Rule brush presets require a safe stable ID.");
        const brush = Object.assign({ id, name: definition?.name || id, shape: "circle", size: 3, hardness: .75, falloff: "smooth", mode: "paint", value: true, updatedAt: Date.now() }, deepClone(definition), { id });
        brush.size = Math.max(1, Math.min(128, integer(brush.size, 3))); brush.hardness = Math.max(0, Math.min(1, finiteNumber(brush.hardness, .75))); ensureStore().worldRuleBrushes[id] = brush; return deepClone(brush);
    }
    function listWorldRuleBrushes() { return Object.values(ensureStore().worldRuleBrushes || {}).map(deepClone); }
    function removeWorldRuleBrush(id) { const key = String(id || ""); const existed = !!ensureStore().worldRuleBrushes[key]; delete ensureStore().worldRuleBrushes[key]; return existed; }

    function paintWorldRuleBrush(layerId, center, brush = {}, value = true, options = {}) {
        const preset = typeof brush === "string" ? ensureStore().worldRuleBrushes[brush] : brush; if (!preset) throw new Error(`Rule brush "${brush}" was not found.`);
        const shape = String(preset.shape || options.shape || "circle").toLowerCase(); const size = Math.max(1, Math.min(128, integer(preset.size ?? options.size, 3))); const radius = Math.max(.5, size / 2); const origin = { x: integer(center?.x ?? center?.[0]), y: integer(center?.y ?? center?.[1]) }; const target = center?.to || options.to;
        const cells = new Map(); const add = (x, y, distance = 0) => cells.set(coordinateKey(x, y), { x, y, distance });
        if (shape === "line" && target) {
            let x0 = origin.x; let y0 = origin.y; const x1 = integer(target.x ?? target[0]); const y1 = integer(target.y ?? target[1]); const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1; const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1; let error = dx + dy;
            while (true) { add(x0, y0, 0); if (x0 === x1 && y0 === y1) break; const twice = 2 * error; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; } }
        } else {
            for (let y = Math.floor(origin.y - radius); y <= Math.ceil(origin.y + radius); y++) for (let x = Math.floor(origin.x - radius); x <= Math.ceil(origin.x + radius); x++) { const distance = shape === "rectangle" || shape === "square" ? Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) : Math.hypot(x - origin.x, y - origin.y); if (distance <= radius) add(x, y, distance); }
        }
        const hardness = Math.max(0, Math.min(1, finiteNumber(preset.hardness ?? options.hardness, .75))); const falloff = String(preset.falloff || options.falloff || "smooth").toLowerCase(); const gradient = options.gradient !== false && (hardness < 1 || preset.gradient === true); const painted = [];
        for (const cell of cells.values()) { const normalized = Math.max(0, Math.min(1, cell.distance / Math.max(.5, radius))); let weight = normalized <= hardness ? 1 : Math.max(0, 1 - (normalized - hardness) / Math.max(.0001, 1 - hardness)); if (falloff === "smooth") weight = weight * weight * (3 - 2 * weight); else if (falloff === "quadratic") weight *= weight; painted.push({ x: cell.x, y: cell.y, value: gradient ? { value: deepClone(preset.value ?? value), weight: Number(weight.toFixed(4)) } : deepClone(preset.value ?? value) }); }
        const result = paintWorldRules(layerId, painted, preset.value ?? value, { mode: preset.mode || options.mode || "paint" }); return Object.assign(result, { brush: { shape, size, hardness, falloff }, bounds: { x: Math.floor(origin.x - radius), y: Math.floor(origin.y - radius), width: Math.ceil(radius * 2) + 1, height: Math.ceil(radius * 2) + 1 } });
    }

    function filterWorldRuleLayer(layerId, predicate = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return [];
        const minimumWeight = finiteNumber(predicate.minimumWeight, -Infinity); const value = predicate.value; const bounds = predicate.bounds; const results = [];
        for (const [key, raw] of Object.entries(layer.cells || {})) { const [x, y] = key.split(",").map(Number); const weight = finiteNumber(raw?.weight, raw === true ? 1 : 0); const actual = raw?.value === undefined ? raw : raw.value; if (weight < minimumWeight || (value !== undefined && JSON.stringify(actual) !== JSON.stringify(value))) continue; if (bounds && (x < bounds.x || y < bounds.y || x >= bounds.x + (bounds.width ?? bounds.w) || y >= bounds.y + (bounds.height ?? bounds.h))) continue; results.push({ x, y, value: deepClone(actual), weight }); }
        return results;
    }

    function ruleLayerStatistics(layerId) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return false; const values = Object.values(layer.cells || {}); const weights = values.map(value => finiteNumber(value?.weight, value === false ? 0 : 1));
        return { layerId: layer.id, cells: values.length, weightedCells: values.filter(value => value && typeof value === "object" && value.weight !== undefined).length, minimumWeight: weights.length ? Math.min(...weights) : 0, maximumWeight: weights.length ? Math.max(...weights) : 0, averageWeight: weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0, estimatedBytes: JSON.stringify(layer.cells || {}).length * 2 };
    }

    function worldRulesAt(mapId, x, y, options = {}) {
        const key = coordinateKey(integer(x), integer(y)); return Object.values(ensureStore().worldRuleLayers || {}).filter(layer => layer.visible !== false && (!layer.mapId || layer.mapId === integer(mapId)) && layer.cells?.[key] !== undefined && (!options.kind || layer.kind === options.kind)).map(layer => ({ layerId: layer.id, name: layer.name, kind: layer.kind, value: deepClone(layer.cells[key]), rules: deepClone(layer.rules || {}) }));
    }

    function compileWorldRuleLayer(layerId, options = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return false; const points = Object.keys(layer.cells || {}).map(key => key.split(",").map(Number));
        if (!points.length) return { ok: false, errors: ["The rule layer has no painted cells."] };
        const recipeId = safeWorldRecipeId(options.recipeId) || `${layer.id}-rule`; const recipe = { id: recipeId, name: String(options.name || `${layer.name} Rule`), enabled: options.enabled !== false, triggers: [{ type: options.trigger || "playerStep" }], conditions: { all: [{ type: "ruleLayer", id: layer.id, value: options.value }] }, actions: deepClone(options.actions || layer.rules?.actions || []), metadata: { ruleLayerId: layer.id, generatedBy: "HybridTileGraft v12" } };
        const registered = registerWorldRecipe(recipe, options.save !== false); return { ok: true, recipe: registered, cells: points.length };
    }

    const BIOME_NODE_TYPES = new Set(["climate", "biome", "road", "river", "dungeon", "wfc", "scatterprefabs", "rules", "custom"]);
    function validateBiomeGraph(graph) {
        const errors = []; const id = safeWorldRecipeId(graph?.id); if (!id) errors.push("Biome graph requires a safe stable id."); const nodes = normalizeList(graph?.nodes); const byId = new Map();
        for (const node of nodes) { const nodeId = safeWorldRecipeId(node?.id); if (!nodeId) errors.push("Every biome node requires a safe id."); else if (byId.has(nodeId)) errors.push(`Duplicate biome node ${nodeId}.`); else byId.set(nodeId, node); if (!BIOME_NODE_TYPES.has(canonicalWorldRecipeType(node?.type))) errors.push(`Unsupported biome node type ${node?.type}.`); }
        for (const node of nodes) for (const dependency of normalizeList(node.after || node.dependencies)) if (!byId.has(String(dependency))) errors.push(`Node ${node.id} depends on missing node ${dependency}.`);
        const visiting = new Set(); const visited = new Set(); const order = []; const visit = node => { if (visiting.has(node.id)) { errors.push(`Biome graph cycle at ${node.id}.`); return; } if (visited.has(node.id)) return; visiting.add(node.id); for (const dependency of normalizeList(node.after || node.dependencies)) if (byId.has(String(dependency))) visit(byId.get(String(dependency))); visiting.delete(node.id); visited.add(node.id); order.push(node.id); }; for (const node of nodes) visit(node);
        return { ok: errors.length === 0, errors, id, nodeCount: nodes.length, order };
    }
    function defineBiomeGraph(definition) { const report = validateBiomeGraph(definition); if (!report.ok) throw new Error(report.errors.join("; ")); const graph = Object.assign({ id: report.id, name: definition.name || report.id, seed: "world", nodes: [], metadata: {}, updatedAt: Date.now() }, deepClone(definition), { id: report.id }); ensureStore().worldBiomeGraphs[graph.id] = graph; return deepClone(graph); }
    function listBiomeGraphs() { return Object.values(ensureStore().worldBiomeGraphs || {}).map(graph => Object.assign(deepClone(graph), { nodeCount: graph.nodes?.length || 0 })); }
    function removeBiomeGraph(id) { const key = String(id || ""); const existed = !!ensureStore().worldBiomeGraphs[key]; delete ensureStore().worldBiomeGraphs[key]; return existed; }
    function previewBiomeGraph(idOrGraph, options = {}) { const graph = typeof idOrGraph === "string" ? ensureStore().worldBiomeGraphs[idOrGraph] : idOrGraph; if (!graph) return { ok: false, errors: ["Biome graph was not found."] }; const validation = validateBiomeGraph(graph); return Object.assign(validation, { graphId: graph.id, mapId: integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0), seed: String(options.seed || graph.seed || "world"), nodes: validation.order.map(id => { const node = graph.nodes.find(item => item.id === id); return { id, type: node.type, label: node.name || id, options: deepClone(node.options || {}) }; }) }); }

    function biomeCacheKey(graphId, mapId, nodeId, seed, options = {}) { return `${String(graphId)}:${integer(mapId)}:${String(nodeId)}:${worldPackChecksum({ seed: String(seed || "world"), options: canonicalizeWorkspace(options) })}`; }
    function cacheBiomeStage(graphId, mapId, nodeId, seed, result, options = {}) { const key = biomeCacheKey(graphId, mapId, nodeId, seed, options); const record = { key, graphId: String(graphId), mapId: integer(mapId), nodeId: String(nodeId), seed: String(seed || "world"), result: deepClone(result), createdAt: Date.now(), hits: 0 }; ensureStore().worldBiomeCache[key] = record; return deepClone(record); }
    function biomeStageCache(graphId, mapId, nodeId, seed, options = {}) { const key = biomeCacheKey(graphId, mapId, nodeId, seed, options); const record = ensureStore().worldBiomeCache[key]; if (!record) return null; record.hits = integer(record.hits) + 1; record.lastHitAt = Date.now(); return deepClone(record); }
    function clearBiomeCache(options = {}) { const store = ensureStore(); const keys = Object.keys(store.worldBiomeCache || {}); let removed = 0; for (const key of keys) { const record = store.worldBiomeCache[key]; if (options.graphId && record.graphId !== String(options.graphId)) continue; if (options.mapId && record.mapId !== integer(options.mapId)) continue; delete store.worldBiomeCache[key]; removed++; } return removed; }

    function lockBiomeCells(graphId, mapId, cells, options = {}) {
        const id = safeWorldRecipeId(graphId); if (!id) throw new Error("Biome locks require a graph ID."); const key = `${id}:${integer(mapId)}`; const record = ensureStore().worldBiomeLocks[key] ||= { graphId: id, mapId: integer(mapId), cells: {}, updatedAt: Date.now() };
        for (const cell of normalizeList(cells)) { const x = integer(cell?.x ?? cell?.[0]); const y = integer(cell?.y ?? cell?.[1]); record.cells[coordinateKey(x, y)] = { x, y, reason: String(cell?.reason || options.reason || "Protected by author"), stages: normalizeList(cell?.stages || options.stages).map(String) }; }
        record.updatedAt = Date.now(); return deepClone(record);
    }
    function unlockBiomeCells(graphId, mapId, cells = null) { const key = `${String(graphId)}:${integer(mapId)}`; const record = ensureStore().worldBiomeLocks[key]; if (!record) return false; if (!cells) { delete ensureStore().worldBiomeLocks[key]; return true; } let removed = 0; for (const cell of normalizeList(cells)) { const coordinate = coordinateKey(integer(cell?.x ?? cell?.[0]), integer(cell?.y ?? cell?.[1])); if (record.cells[coordinate]) { delete record.cells[coordinate]; removed++; } } if (!Object.keys(record.cells).length) delete ensureStore().worldBiomeLocks[key]; return removed; }
    function listBiomeLocks(options = {}) { return Object.values(ensureStore().worldBiomeLocks || {}).filter(lock => (!options.graphId || lock.graphId === String(options.graphId)) && (!options.mapId || lock.mapId === integer(options.mapId))).map(lock => Object.assign(deepClone(lock), { cellCount: Object.keys(lock.cells || {}).length })); }
    function snapshotLockedBiomeCells(graphId, mapId) { const lock = ensureStore().worldBiomeLocks[`${String(graphId)}:${integer(mapId)}`]; if (!lock || typeof $dataMap === "undefined" || !$dataMap || integer(mapId) !== (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : integer(mapId))) return []; return Object.values(lock.cells || {}).map(cell => ({ x: cell.x, y: cell.y, tiles: ["L1", "L2", "L3", "L4", "L5", "L6"].map(layer => getTileId(cell.x, cell.y, layer)) })); }
    function restoreLockedBiomeCells(snapshot) { for (const cell of snapshot || []) for (let index = 0; index < cell.tiles.length; index++) setTile(cell.x, cell.y, `L${index + 1}`, cell.tiles[index], true, { mode: "exact" }); return (snapshot || []).length; }

    async function runBiomeGraph(idOrGraph, options = {}) {
        const graph = typeof idOrGraph === "string" ? ensureStore().worldBiomeGraphs[idOrGraph] : idOrGraph; const preview = previewBiomeGraph(graph, options); if (!preview.ok) return preview;
        const mapId = preview.mapId; const lockedSnapshot = snapshotLockedBiomeCells(graph.id, mapId); const transactional = options.transactional !== false; if (transactional && !projectTransactionState()) beginProjectTransaction(`Biome graph: ${graph.name || graph.id}`); const results = [];
        try { for (const nodeId of preview.order) {
                const node = graph.nodes.find(item => item.id === nodeId); const type = canonicalWorldRecipeType(node.type); const settings = Object.assign({}, deepClone(node.options || {}), deepClone(options.overrides?.[nodeId] || {}), { seed: `${options.seed || graph.seed || "world"}:${nodeId}` }); const cached = options.cache === false ? null : biomeStageCache(graph.id, mapId, nodeId, settings.seed, settings); let result;
                if (type === "climate") result = generateClimateBiome(settings); else if (type === "biome") result = generateBiome(settings); else if (type === "road") result = generateTerrainRoad(settings); else if (type === "river") result = generateDownhillRiver(settings); else if (type === "dungeon") result = generateValidatedDungeon(settings); else if (type === "wfc") result = settings.ruleSetId ? generateWaveFunctionMapBacktracking(settings) : generateWaveFunctionMap(settings); else if (type === "scatterprefabs") result = await Promise.resolve(scatterPrefabs(settings)); else if (type === "rules") result = compileWorldRuleLayer(settings.layerId, settings); else if (type === "custom") result = await Promise.resolve(runExtensionGenerator(settings.generatorId, settings));
                if (result !== false && options.cache !== false) cacheBiomeStage(graph.id, mapId, nodeId, settings.seed, result, settings); results.push({ id: nodeId, type, ok: result !== false, result, cacheHit: !!cached }); if (result === false && node.required !== false) throw new Error(`Biome node ${nodeId} failed.`);
            }
            const restoredLocks = restoreLockedBiomeCells(lockedSnapshot); if (transactional && projectTransactionState()) commitProjectTransaction(); recordOperation("runBiomeGraph", { graphId: graph.id, nodes: results.length, restoredLocks }); return Object.assign(preview, { executed: true, results, restoredLocks });
        } catch (error) { if (transactional && projectTransactionState()) rollbackProjectTransaction(); captureError(error, { operation: "runBiomeGraph", graphId: graph.id }); throw error; }
    }

    function runtimeBudget(changes = null) { const store = ensureStore(); if (changes && typeof changes === "object") { store.runtimeBudget = Object.assign({}, store.runtimeBudget, { frameBudgetMs: Math.max(1, finiteNumber(changes.frameBudgetMs, store.runtimeBudget.frameBudgetMs)), recipeRunsPerFrame: Math.max(1, integer(changes.recipeRunsPerFrame, store.runtimeBudget.recipeRunsPerFrame)), simulationStepsPerFrame: Math.max(1, integer(changes.simulationStepsPerFrame, store.runtimeBudget.simulationStepsPerFrame)), spatialCellSize: Math.max(4, integer(changes.spatialCellSize, store.runtimeBudget.spatialCellSize)) }); worldZoneSpatialIndex = null; } return deepClone(store.runtimeBudget); }
    function performanceHeatmap(mapId = 0) { const store = ensureStore(); const counts = new Map(); const id = integer(mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0); for (const patch of flattenPatches(store.maps[String(id)] || [])) { if (patch.kind === "sparse") for (const cell of patch.cells || []) { const key = coordinateKey(cell.x, cell.y); counts.set(key, (counts.get(key) || 0) + 1); } else { const rect = patchRect(patch); if (rect) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) { const key = coordinateKey(x, y); counts.set(key, (counts.get(key) || 0) + 1); } } } const cells = [...counts].map(([key, count]) => { const [x, y] = key.split(",").map(Number); return { x, y, count }; }).sort((a, b) => b.count - a.count); return { mapId: id, cells, maximum: cells[0]?.count || 0, operations: performanceDiagnostics(), zones: worldZoneSpatialDiagnostics() }; }
    function optimizeWorldRuntime(options = {}) { const before = estimateStoreBytes(); const pruning = pruneProjectData(options); const zones = rebuildWorldZoneSpatialIndex(); const after = estimateStoreBytes(); return { before, after, freedBytes: Math.max(0, before.estimatedBytes - after.estimatedBytes), pruning, spatialIndex: { cellSize: zones.cellSize, buckets: zones.buckets.size, zones: zones.zoneCount }, budget: runtimeBudget(options.budget) }; }

    function runWorldBenchmark(options = {}) {
        const iterations = Math.max(1, Math.min(500, integer(options.iterations, 25))); const samples = []; const measure = (name, callback) => { const started = clockNow(); for (let index = 0; index < iterations; index++) callback(); const durationMs = Math.max(0, clockNow() - started); samples.push({ name, iterations, durationMs, averageMs: durationMs / iterations }); };
        measure("zone-spatial-query", () => worldZonesAt(integer(options.mapId, 1), integer(options.x), integer(options.y), integer(options.regionId)));
        measure("rule-layer-query", () => worldRulesAt(integer(options.mapId, 1), integer(options.x), integer(options.y)));
        measure("npc-schedule", () => { for (const npc of Object.values(ensureStore().worldNpcs || {})) npcScheduledActivity(npc); });
        measure("recipe-validation", () => validateWorldRecipeCatalog(exportWorldRecipePack()));
        const totalMs = samples.reduce((sum, sample) => sum + sample.durationMs, 0); const record = { id: `benchmark-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION, iterations, totalMs, samples, store: estimateStoreBytes(), budget: runtimeBudget() }; ensureStore().benchmarkHistory.unshift(record); ensureStore().benchmarkHistory = ensureStore().benchmarkHistory.slice(0, 50); return deepClone(record);
    }
    function listWorldBenchmarks() { return deepClone(ensureStore().benchmarkHistory || []); }

    function worldReferenceGraph() {
        const store = ensureStore(); const nodes = new Map(); const edges = []; const addNode = (id, type, name = id, metadata = {}) => { if (!id) return; nodes.set(`${type}:${id}`, { id: String(id), key: `${type}:${id}`, type, name: String(name || id), metadata: deepClone(metadata) }); }; const connect = (fromType, fromId, toType, toId, relation) => { if (!fromId || !toId) return; edges.push({ from: `${fromType}:${fromId}`, to: `${toType}:${toId}`, relation }); };
        for (const recipe of worldRecipeDefinitions()) { addNode(recipe.id, "recipe", recipe.name); for (const action of recipe.actions || []) { const type = canonicalWorldRecipeType(action.type); if (type === "runrecipe") connect("recipe", recipe.id, "recipe", action.recipeId, "runs"); if (type === "runbiomegraph") connect("recipe", recipe.id, "biome", action.id || action.graphId, "generates"); } for (const trigger of recipe.triggers || []) if (trigger.zoneId) connect("recipe", recipe.id, "zone", trigger.zoneId, "triggered-by"); }
        for (const zone of Object.values(store.worldZones || {})) addNode(zone.id, "zone", zone.name, { mapIds: zone.mapIds });
        for (const npc of Object.values(store.worldNpcs || {})) addNode(npc.id, "npc", npc.name); for (const route of Object.values(store.worldNpcRoutes || {})) { addNode(route.id, "route", route.name); connect("route", route.id, "npc", route.npcId, "moves"); }
        for (const graph of Object.values(store.worldBiomeGraphs || {})) { addNode(graph.id, "biome", graph.name); for (const node of graph.nodes || []) if (canonicalWorldRecipeType(node.type) === "rules" && node.options?.layerId) connect("biome", graph.id, "rule-layer", node.options.layerId, "uses"); }
        for (const layer of Object.values(store.worldRuleLayers || {})) addNode(layer.id, "rule-layer", layer.name, { mapId: layer.mapId });
        for (const pack of Object.values(store.worldRecipePacks || {})) { addNode(pack.id, "pack", pack.name, { version: pack.version }); for (const dependency of pack.dependencies || []) connect("pack", pack.id, "pack", dependency.id || dependency, "depends-on"); }
        for (const variant of Object.values(store.worldMapVariants || {})) { addNode(variant.id, "variant", variant.name, { mapId: variant.mapId }); if (variant.recipeId) connect("variant", variant.id, "recipe", variant.recipeId, "applies"); }
        const missing = []; for (const edge of edges) if (!nodes.has(edge.to)) missing.push(edge); return { createdAt: Date.now(), nodes: [...nodes.values()], edges, missing, ok: missing.length === 0, counts: Object.fromEntries([...nodes.values()].reduce((map, node) => map.set(node.type, (map.get(node.type) || 0) + 1), new Map())) };
    }

    function createRecoverySnapshot(name = "Automatic recovery", options = {}) { const store = ensureStore(); const snapshot = { id: safeWorldRecipeId(options.id) || `recovery-${Date.now().toString(36)}`, name: String(name), createdAt: Date.now(), automatic: options.automatic !== false, state: workspaceStateSnapshot() }; if (JSON.stringify(snapshot.state).length * 2 > MAX_IMPORT_BYTES) return false; store.recoverySnapshots.unshift(snapshot); store.recoverySnapshots = store.recoverySnapshots.slice(0, Math.max(1, integer(options.retain, store.recoveryPolicy?.retain || 10))); return { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, automatic: snapshot.automatic };
    }
    function listRecoverySnapshots() { return (ensureStore().recoverySnapshots || []).map(snapshot => ({ id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, automatic: snapshot.automatic, estimatedBytes: JSON.stringify(snapshot.state || {}).length * 2 })); }
    function restoreRecoverySnapshot(id) { const snapshot = ensureStore().recoverySnapshots.find(item => item.id === String(id)); return snapshot ? restoreWorkspaceState(snapshot.state) : false; }
    function deleteRecoverySnapshot(id) { const store = ensureStore(); const before = store.recoverySnapshots.length; store.recoverySnapshots = store.recoverySnapshots.filter(item => item.id !== String(id)); return before !== store.recoverySnapshots.length; }

    function runCompatibilityLab(options = {}) {
        const scripts = normalizeList(typeof PluginManager !== "undefined" ? PluginManager._scripts : []).map(String); const imported = typeof window.Imported === "object" ? Object.keys(window.Imported) : []; const names = [...new Set([...scripts, ...imported])]; const selfIndex = scripts.findIndex(name => name === PLUGIN_NAME || /HybridTileGraft/i.test(name));
        const families = [{ id: "visustella", name: "VisuStella MZ", pattern: /VisuMZ|VisuStella/i, recommendation: "Load core engine plugins first; place HybridTileGraft after map and event cores." }, { id: "ritter", name: "Ritter Map Transform", pattern: /Ritter.*Map.*Transform|MapTransform.*Ritter/i, recommendation: "Use one transform authority per operation and preview transfer repairs before committing." }, { id: "tyruswoo", name: "Tyruswoo Tile Control", pattern: /Tyruswoo.*Tile|TileControl.*Tyruswoo/i, recommendation: "Keep exact tile-code calls isolated from autotile-aware paint operations." }];
        const profiles = families.map(family => { const matches = names.filter(name => family.pattern.test(name)); return { id: family.id, name: family.name, detected: matches.length > 0, plugins: matches, recommendation: family.recommendation }; }); const issues = [];
        if (selfIndex >= 0) for (const profile of profiles.filter(item => item.detected)) for (const plugin of profile.plugins) { const index = scripts.indexOf(plugin); if (index > selfIndex && profile.id === "visustella") issues.push({ severity: "warning", plugin, message: `${plugin} loads after ${PLUGIN_NAME}; a core-first order is usually safer.` }); }
        if (profiles.filter(item => item.detected && ["ritter", "tyruswoo"].includes(item.id)).length > 1) issues.push({ severity: "info", message: "Multiple map/tile authorities are installed. Assign ownership per workflow in Compatibility Profiles." });
        const adapter = runCompatibilitySelfTest({ executeRefresh: !!options.executeRefresh }); const report = { id: `compat-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION, pluginOrder: scripts, detected: profiles, issues, adapters: adapter, safe: !issues.some(issue => issue.severity === "error") }; recordCompatibilityRun(report); return deepClone(report);
    }

    function registerContentCatalog(catalog) { const id = safeWorldRecipeId(catalog?.id); if (!id) throw new Error("Content catalogs require a safe stable id."); const value = { format: "HybridContentCatalog", version: Math.max(1, integer(catalog.version, 1)), id, name: String(catalog.name || id), items: normalizeList(catalog.items).map(deepClone), metadata: deepClone(catalog.metadata || {}), updatedAt: Date.now() }; ensureStore().contentCatalogs[id] = value; return deepClone(value); }
    function listContentCatalogs() { return Object.values(ensureStore().contentCatalogs || {}).map(catalog => ({ id: catalog.id, name: catalog.name, version: catalog.version, items: catalog.items.length, updatedAt: catalog.updatedAt })); }
    function searchContentCatalog(query = "", options = {}) { const text = String(query).toLowerCase(); const results = []; for (const catalog of Object.values(ensureStore().contentCatalogs || {})) for (const item of catalog.items || []) { const haystack = `${item.id} ${item.name || ""} ${item.description || ""} ${normalizeList(item.tags).join(" ")}`.toLowerCase(); if ((!text || haystack.includes(text)) && (!options.type || item.type === options.type)) results.push(Object.assign({ catalogId: catalog.id }, deepClone(item))); } return results.slice(0, Math.max(1, integer(options.limit, 100))); }
    function subscribeContentCatalog(definition) { const id = safeWorldRecipeId(definition?.id || definition?.catalogId); if (!id) throw new Error("Catalog subscriptions require a safe stable ID."); const subscription = Object.assign({ id, catalogId: String(definition?.catalogId || id), name: definition?.name || id, source: String(definition?.source || ""), channel: String(definition?.channel || "stable"), enabled: definition?.enabled !== false, installedVersion: Math.max(0, integer(definition?.installedVersion)), latestVersion: Math.max(0, integer(definition?.latestVersion)), checkedAt: 0, createdAt: Date.now() }, deepClone(definition), { id }); ensureStore().catalogSubscriptions[id] = subscription; return deepClone(subscription); }
    function listCatalogSubscriptions() { return Object.values(ensureStore().catalogSubscriptions || {}).map(subscription => Object.assign(deepClone(subscription), { updateAvailable: integer(subscription.latestVersion) > integer(subscription.installedVersion) })); }
    function removeCatalogSubscription(id) { const key = String(id || ""); const existed = !!ensureStore().catalogSubscriptions[key]; delete ensureStore().catalogSubscriptions[key]; return existed; }
    function checkCatalogUpdates(catalogs = []) { const incoming = new Map(normalizeList(catalogs).map(catalog => [String(catalog.id), catalog])); const results = []; for (const subscription of Object.values(ensureStore().catalogSubscriptions || {})) { if (!subscription.enabled) continue; const catalog = incoming.get(subscription.catalogId) || ensureStore().contentCatalogs[subscription.catalogId]; if (catalog) { subscription.latestVersion = Math.max(subscription.latestVersion || 0, integer(catalog.version)); subscription.checkedAt = Date.now(); } results.push({ id: subscription.id, catalogId: subscription.catalogId, installedVersion: subscription.installedVersion, latestVersion: subscription.latestVersion, updateAvailable: integer(subscription.latestVersion) > integer(subscription.installedVersion), found: !!catalog }); } return results; }
    function installContentCatalogItem(catalogId, itemId, options = {}) { const catalog = ensureStore().contentCatalogs[String(catalogId || "")]; const item = catalog?.items?.find(value => value.id === String(itemId)); if (!item) return false; if (item.type === "world-pack" && item.pack) return installWorldPack(item.pack, options); if (item.type === "prefab-pack" && item.pack) return importPrefabPack(item.pack, options.save !== false); if (item.type === "biome-graph" && item.graph) return defineBiomeGraph(item.graph); return false; }

    function replaceRecipeParameters(value, parameters) { if (Array.isArray(value)) return value.map(item => replaceRecipeParameters(item, parameters)); if (value && typeof value === "object") { if (value.$param !== undefined) return deepClone(parameters[String(value.$param)] ?? value.defaultValue); const output = {}; for (const [key, item] of Object.entries(value)) output[key] = replaceRecipeParameters(item, parameters); return output; } if (typeof value === "string") return value.replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_match, key) => String(parameters[key] ?? "")); return value; }
    function instantiateWorldRecipe(sourceId, parameters = {}, newId = "") { const source = worldRecipe(sourceId); if (!source) throw new Error(`World Recipe "${sourceId}" was not found.`); const recipe = replaceRecipeParameters(source, parameters); recipe.id = safeWorldRecipeId(newId) || `${source.id}-${Date.now().toString(36)}`; recipe.name = replaceRecipeParameters(source.name, parameters); recipe.metadata = Object.assign({}, recipe.metadata, { sourceRecipe: source.id, parameters: deepClone(parameters) }); return registerWorldRecipe(recipe, true); }

    function defineWorldMapVariant(definition) { const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Map variants require a safe stable ID."); const value = Object.assign({ id, name: definition.name || id, mapId: integer(definition.mapId), recipeId: String(definition.recipeId || ""), changeSetId: String(definition.changeSetId || ""), enabled: definition.enabled !== false }, deepClone(definition), { id }); ensureStore().worldMapVariants[id] = value; return deepClone(value); }
    function listWorldMapVariants() { return Object.values(ensureStore().worldMapVariants || {}).map(deepClone); }
    async function applyWorldMapVariant(id, context = {}, options = {}) { const variant = ensureStore().worldMapVariants[String(id || "")]; if (!variant || !variant.enabled) return false; if (variant.recipeId) return runWorldRecipe(variant.recipeId, Object.assign({ mapId: variant.mapId, variantId: variant.id }, context), options); if (variant.changeSetId) return applyChangeSet(variant.changeSetId, options); return false; }

    function worldLineOfSight(x1, y1, x2, y2) {
        let x = integer(x1); let y = integer(y1); const targetX = integer(x2); const targetY = integer(y2);
        const dx = Math.abs(targetX - x); const dy = Math.abs(targetY - y); const sx = x < targetX ? 1 : -1; const sy = y < targetY ? 1 : -1; let error = dx - dy;
        while (x !== targetX || y !== targetY) {
            const previousX = x; const previousY = y; const doubled = error * 2;
            if (doubled > -dy) { error -= dy; x += sx; }
            if (doubled < dx) { error += dx; y += sy; }
            if (x === targetX && y === targetY) return true;
            if (typeof $gameMap !== "undefined" && $gameMap?.isPassable) {
                const direction = x > previousX ? 6 : x < previousX ? 4 : y > previousY ? 2 : 8;
                if (!$gameMap.isPassable(previousX, previousY, direction)) return false;
            }
        }
        return true;
    }

    async function evaluateWorldRecipeCondition(condition, context, recipe, depth = 0) {
        if (depth > 12) return false;
        if (Array.isArray(condition)) {
            for (const item of condition) if (!await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return false;
            return true;
        }
        if (!condition || typeof condition !== "object") return false;
        if (condition.all !== undefined) {
            for (const item of condition.all || []) if (!await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return false;
            return true;
        }
        if (condition.any !== undefined) {
            for (const item of condition.any || []) if (await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return true;
            return !(condition.any || []).length;
        }
        if (condition.not !== undefined) return !await evaluateWorldRecipeCondition(condition.not, context, recipe, depth + 1);
        const type = canonicalWorldRecipeType(condition.type || "always");
        const custom = worldRecipeConditionHandlers.get(type);
        if (custom) return !!await custom({ condition: deepClone(condition), context: worldRecipeContext(context), recipe: deepClone(recipe), api: window.HybridTileGraft });
        const expected = resolveWorldRecipeValue(condition.value, context, recipe);
        switch (type) {
            case "always": return condition.value !== false;
            case "switch": return compareWorldRecipeValues(recipeSwitchValue(condition.id), condition.operator || "===", condition.value === undefined ? true : !!expected);
            case "variable": return compareWorldRecipeValues(recipeVariableValue(condition.id), condition.operator, expected);
            case "state": return compareWorldRecipeValues(getWorldState(condition.key, { scope: condition.scope, mapId: context.mapId, recipeId: recipe.id, defaultValue: condition.defaultValue }), condition.operator, expected);
            case "map": return compareWorldRecipeValues(context.mapId, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "region": return compareWorldRecipeValues(context.regionId, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "terrain": return compareWorldRecipeValues(context.terrainTag, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "tile": return compareWorldRecipeValues(getTileId(integer(condition.x, context.x), integer(condition.y, context.y), condition.layer || "L1"), condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "position": { const xValue = resolveWorldRecipeValue(condition.x, context, recipe); const yValue = resolveWorldRecipeValue(condition.y, context, recipe); const xRange = xValue && typeof xValue === "object" ? xValue : { min: condition.xMin, max: condition.xMax }; const yRange = yValue && typeof yValue === "object" ? yValue : { min: condition.yMin, max: condition.yMax }; const xMatch = xRange.min !== undefined || xRange.max !== undefined ? (xRange.min === undefined || context.x >= finiteNumber(xRange.min)) && (xRange.max === undefined || context.x <= finiteNumber(xRange.max)) : condition.x === undefined || compareWorldRecipeValues(context.x, condition.operator || "===", integer(xValue)); const yMatch = yRange.min !== undefined || yRange.max !== undefined ? (yRange.min === undefined || context.y >= finiteNumber(yRange.min)) && (yRange.max === undefined || context.y <= finiteNumber(yRange.max)) : condition.y === undefined || compareWorldRecipeValues(context.y, condition.operator || "===", integer(yValue)); return xMatch && yMatch; }
            case "direction": return compareWorldRecipeValues(context.direction, condition.operator || "in", resolveWorldRecipeValue(condition.directions || condition.value || [], context, recipe));
            case "gold": return compareWorldRecipeValues(typeof $gameParty !== "undefined" && $gameParty?.gold ? $gameParty.gold() : 0, condition.operator, expected);
            case "item": { const item = typeof $dataItems !== "undefined" ? $dataItems?.[integer(condition.id)] : null; const count = item && typeof $gameParty !== "undefined" && $gameParty?.numItems ? $gameParty.numItems(item) : 0; return compareWorldRecipeValues(count, condition.operator || ">=", expected ?? 1); }
            case "chance": return Math.random() < Math.max(0, Math.min(1, finiteNumber(condition.probability ?? expected, 1)));
            case "context": return compareWorldRecipeValues(context[String(condition.key)], condition.operator, expected);
            case "reciperuns": return compareWorldRecipeValues(worldRecipeStateRecord(condition.recipeId || recipe.id)?.runCount || 0, condition.operator, expected);
            case "time": { const clock = worldClock(); const value = condition.unit === "hour" ? clock.hour : condition.unit === "serial" ? worldClockSerial(clock) : clock.minute; return compareWorldRecipeValues(value, condition.operator || ">=", expected ?? condition.minute ?? 0); }
            case "season": return compareWorldRecipeValues(worldClock().season, condition.operator || "in", resolveWorldRecipeValue(condition.seasons || condition.value || [], context, recipe));
            case "day": return compareWorldRecipeValues(worldClock().day, condition.operator || ">=", expected ?? 1);
            case "fact": return compareWorldRecipeValues(ensureStore().worldFacts[String(condition.name || condition.key || "")], condition.operator || "===", condition.value === undefined ? true : expected);
            case "zone": { const zones = worldZonesAt(context.mapId, context.x, context.y, context.regionId).map(zone => zone.id); return condition.id ? zones.includes(String(condition.id)) : normalizeList(condition.ids || condition.value).some(id => zones.includes(String(id))); }
            case "proximity": { const targetX = integer(resolveWorldRecipeValue(condition.x, context, recipe), context.x); const targetY = integer(resolveWorldRecipeValue(condition.y, context, recipe), context.y); const dx = context.x - targetX; const dy = context.y - targetY; const distance = condition.metric === "euclidean" ? Math.sqrt(dx * dx + dy * dy) : Math.abs(dx) + Math.abs(dy); return compareWorldRecipeValues(distance, condition.operator || "<=", expected ?? condition.distance ?? 1); }
            case "lineofsight": return worldLineOfSight(context.x, context.y, integer(resolveWorldRecipeValue(condition.x, context, recipe), context.x), integer(resolveWorldRecipeValue(condition.y, context, recipe), context.y));
            case "worldentity": { const entity = worldEntity(condition.id); if (!entity) return false; if (condition.state !== undefined && !compareWorldRecipeValues(entity.state, condition.operator || "===", resolveWorldRecipeValue(condition.state, context, recipe))) return false; return !condition.tag || normalizeList(entity.tags).includes(String(condition.tag)); }
            case "resource": { const resource = worldResource(condition.id); return !!resource && compareWorldRecipeValues(resource.quantity, condition.operator || ">=", expected ?? condition.quantity ?? 1); }
            case "packinstalled": { const pack = ensureStore().worldRecipePacks[String(condition.id || condition.packId || "")]; return !!pack && (!condition.minVersion || compareRecipeVersions(pack.version, condition.minVersion) >= 0); }
            case "npc": { const npc = worldNpc(condition.id || condition.npcId); if (!npc) return false; if (condition.activity !== undefined && !compareWorldRecipeValues(npc.activity, condition.operator || "===", resolveWorldRecipeValue(condition.activity, context, recipe))) return false; if (condition.state !== undefined && !compareWorldRecipeValues(npc.state, condition.stateOperator || "===", resolveWorldRecipeValue(condition.state, context, recipe))) return false; return !condition.tag || normalizeList(npc.tags).includes(String(condition.tag)); }
            case "rulelayer": { const matches = worldRulesAt(context.mapId, context.x, context.y, { kind: condition.kind }); const match = matches.find(item => item.layerId === String(condition.id || condition.layerId || "")); if (!match) return false; const weighted = match.value && typeof match.value === "object" && match.value.weight !== undefined; const actual = weighted ? match.value.value : match.value; const weight = weighted ? finiteNumber(match.value.weight) : 1; return (condition.minimumWeight === undefined || weight >= finiteNumber(condition.minimumWeight)) && (condition.value === undefined || compareWorldRecipeValues(actual, condition.operator || "===", expected)); }
            default: return false;
        }
    }

    function worldRecipeTriggerMatches(recipe, triggerName, context) {
        const expected = canonicalWorldRecipeType(triggerName);
        return recipe.triggers.some(trigger => {
            if (trigger.type !== expected && !(trigger.type === "custom" && canonicalWorldRecipeType(trigger.name) === expected)) return false;
            if (["switchchange", "variablechange"].includes(expected) && trigger.id !== undefined && integer(trigger.id) !== integer(context.id)) return false;
            if (expected === "statechange" && trigger.key !== undefined && String(trigger.key) !== String(context.key)) return false;
            if (expected === "tilechange" && trigger.operation && String(trigger.operation) !== String(context.operation)) return false;
            if (["zoneenter", "zoneexit"].includes(expected) && trigger.zoneId && String(trigger.zoneId) !== String(context.zoneId)) return false;
            if (expected === "scheduled" && context.recipeId && recipe.id !== String(context.recipeId)) return false;
            if (expected === "packinstalled" && trigger.packId && String(trigger.packId) !== String(context.packId)) return false;
            if (["resourcerespawn", "resourcedepleted"].includes(expected) && trigger.resourceId && String(trigger.resourceId) !== String(context.resourceId)) return false;
            if (expected === "entitystatechange" && trigger.entityId && String(trigger.entityId) !== String(context.entityId)) return false;
            if (expected === "npcactivitychange" && trigger.npcId && String(trigger.npcId) !== String(context.npcId)) return false;
            if (expected === "interval") {
                const state = worldRecipeStateRecord(recipe.id); const every = Math.max(1, integer(trigger.everyFrames, 60));
                if (state.lastIntervalFrame !== null && worldRecipeFrame >= state.lastIntervalFrame && worldRecipeFrame - state.lastIntervalFrame < every) return false;
                state.lastIntervalFrame = worldRecipeFrame;
            }
            return true;
        });
    }

    function worldRecipeCanRun(recipe, state, options = {}) {
        const enabled = state.enabled === undefined ? recipe.enabled : !!state.enabled;
        if (!enabled && !options.ignoreEnabled) return { ok: false, reason: "disabled" };
        if ((recipe.once || recipe.maxRuns === 1) && state.runCount > 0 && !options.ignoreLimits) return { ok: false, reason: "once" };
        if (recipe.maxRuns > 0 && state.runCount >= recipe.maxRuns && !options.ignoreLimits) return { ok: false, reason: "maxRuns" };
        if (recipe.cooldownFrames > 0 && state.lastRunFrame !== null && worldRecipeFrame >= state.lastRunFrame && worldRecipeFrame - state.lastRunFrame < recipe.cooldownFrames && !options.ignoreLimits) return { ok: false, reason: "cooldown" };
        if (state.running && !options.allowReentry) return { ok: false, reason: "running" };
        return { ok: true };
    }

    function operateWorldRecipeNumber(current, operator, operand) {
        const a = Number(current) || 0; const b = Number(operand) || 0;
        switch (String(operator || "set").toLowerCase()) {
            case "add": case "+": return a + b;
            case "subtract": case "sub": case "-": return a - b;
            case "multiply": case "mul": case "*": return a * b;
            case "divide": case "div": case "/": return b === 0 ? a : a / b;
            case "modulo": case "mod": case "%": return b === 0 ? a : a % b;
            case "min": return Math.min(a, b);
            case "max": return Math.max(a, b);
            default: return operand;
        }
    }

    async function executeWorldRecipeAction(action, context, recipe, options = {}) {
        const type = canonicalWorldRecipeType(action.type);
        const resolved = resolveWorldRecipeValue(action, context, recipe);
        const custom = worldRecipeActionHandlers.get(type);
        if (custom) return custom({ action: resolved, context: worldRecipeContext(context), recipe: deepClone(recipe), options: deepClone(options), api: window.HybridTileGraft });
        const x = integer(resolved.x ?? resolved.targetX, context.x); const y = integer(resolved.y ?? resolved.targetY, context.y); const save = resolved.save !== false;
        switch (type) {
            case "setswitch": if ($gameSwitches?.setValue) { $gameSwitches.setValue(integer(resolved.id), toBoolean(resolved.value, true)); return true; } return false;
            case "setvariable": { const id = integer(resolved.id); const value = operateWorldRecipeNumber(recipeVariableValue(id), resolved.operator, resolved.value); if ($gameVariables?.setValue) $gameVariables.setValue(id, value); return value; }
            case "setselfswitch": { const key = [integer(resolved.mapId, context.mapId), integer(resolved.eventId, context.eventId || 0), String(resolved.letter || "A")]; if ($gameSelfSwitches?.setValue) $gameSelfSwitches.setValue(key, toBoolean(resolved.value, true)); else { $gameSelfSwitches._data[key] = toBoolean(resolved.value, true); $gameSelfSwitches.onChange?.(); } return true; }
            case "setstate": { const previous = getWorldState(resolved.key, { scope: resolved.scope, mapId: context.mapId, recipeId: recipe.id, defaultValue: resolved.defaultValue }); const value = resolved.operator && resolved.operator !== "set" ? operateWorldRecipeNumber(previous, resolved.operator, resolved.value) : resolved.value; return setWorldState(resolved.key, value, { scope: resolved.scope, mapId: context.mapId, recipeId: recipe.id }); }
            case "commonevent": if ($gameTemp?.reserveCommonEvent) { $gameTemp.reserveCommonEvent(integer(resolved.id)); return true; } return false;
            case "settile": return setTile(x, y, resolved.layer || "L1", resolved.tileId, save, resolved.options || {});
            case "filltiles": return fillTiles(x, y, positiveInteger(resolved.width), positiveInteger(resolved.height), resolved.layer || "L1", resolved.tileId, save, resolved.options || {});
            case "setregion": return changeRegionId(x, y, integer(resolved.regionId ?? resolved.value), save);
            case "cleararea": return clearArea(x, y, positiveInteger(resolved.width), positiveInteger(resolved.height), resolved.layers || "L1,L2,L3,L4,L5,L6", save, toBoolean(resolved.includeEvents, false), resolved.mode || "exact");
            case "graftprefab": return graftPrefabAsync(Object.assign({}, resolved.options || {}, resolved, { name: resolved.name || resolved.prefab, targetX: x, targetY: y, save }));
            case "weather": if (typeof $gameScreen !== "undefined" && $gameScreen?.changeWeather) { $gameScreen.changeWeather(String(resolved.weather || resolved.value || "none"), Math.max(0, integer(resolved.power, 5)), Math.max(0, integer(resolved.duration, 60))); return true; } return false;
            case "tint": if (typeof $gameScreen !== "undefined" && $gameScreen?.startTint) { $gameScreen.startTint(Array.isArray(resolved.tone) ? resolved.tone.map(Number).slice(0, 4) : [0, 0, 0, 0], Math.max(0, integer(resolved.duration, 60))); return true; } return false;
            case "checkpoint": return createCheckpoint(String(resolved.name || `${recipe.name} checkpoint`), context.mapId);
            case "enablerecipe": return setWorldRecipeEnabled(resolved.recipeId, toBoolean(resolved.enabled, true));
            case "runrecipe": return runWorldRecipe(resolved.recipeId, Object.assign({}, context, resolved.context || {}), Object.assign({}, options, { depth: integer(options.depth) + 1 }));
            case "plugincommand": if (PluginManager.callCommand) { const interpreter = context.interpreter || (typeof Game_Interpreter !== "undefined" ? new Game_Interpreter() : null); PluginManager.callCommand(interpreter, String(resolved.plugin || PLUGIN_NAME), String(resolved.command || ""), resolved.args || {}); return true; } return false;
            case "message": if (typeof $gameMessage !== "undefined" && $gameMessage?.add) { $gameMessage.add(String(resolved.text || resolved.value || "")); return true; } return false;
            case "log": console.log(`${PLUGIN_NAME} World Recipe ${recipe.id}:`, resolved.value ?? resolved.message ?? resolved); return true;
            case "emit": emitChange(Object.assign({ operation: String(resolved.operation || "worldRecipe"), recipeId: recipe.id }, resolved.detail || {})); return true;
            case "schedule": return scheduleWorldRecipe(resolved.recipeId || recipe.id, { id: resolved.id, frames: resolved.frames, minutes: resolved.minutes, repeatFrames: resolved.repeatFrames, repeatMinutes: resolved.repeatMinutes, context: Object.assign({}, context, resolved.context || {}) });
            case "cancelschedule": return cancelWorldSchedule(resolved.id || resolved.scheduleId);
            case "setclock": return resolved.advanceMinutes !== undefined ? advanceWorldClock(resolved.advanceMinutes) : setWorldClock(resolved);
            case "addfact": return addWorldFact(resolved.name || resolved.key, resolved.value === undefined ? true : resolved.value);
            case "removefact": return removeWorldFact(resolved.name || resolved.key);
            case "definezone": return defineWorldZone(resolved.zone || resolved);
            case "updateentity": return updateWorldEntity(resolved.id || resolved.entityId, resolved.changes || { state: resolved.state, properties: resolved.properties, tags: resolved.tags });
            case "harvestresource": return harvestWorldResource(resolved.id || resolved.resourceId, resolved.amount);
            case "spawnevent": return spawnEventTemplate(resolved.name || resolved.template, x, y, Object.assign({}, resolved.options || {}, { save, mapId: integer(resolved.mapId, context.mapId) }));
            case "moveevent": return moveSpawnedEvent(integer(resolved.eventId), x, y, save);
            case "deleteevent": return deleteSpawnedEvent(integer(resolved.eventId), save);
            case "applyvariant": return applyWorldMapVariant(resolved.id || resolved.variantId, context, options);
            case "updatenpc": return updateWorldNpc(resolved.id || resolved.npcId, resolved.changes || { activity: resolved.activity, state: resolved.state, mapId: resolved.mapId, x, y });
            case "paintworldrule": return paintWorldRules(resolved.id || resolved.layerId, resolved.cells || [{ x, y }], resolved.value === undefined ? true : resolved.value, { mode: resolved.mode });
            case "runbiomegraph": return runBiomeGraph(resolved.id || resolved.graphId, Object.assign({}, resolved.options || {}, { seed: resolved.seed }));
            default: throw new Error(`Unknown World Recipe action type "${action.type}".`);
        }
    }

    function logWorldRecipe(entry) {
        const log = ensureStore().worldRecipeLog;
        log.unshift(Object.assign({ id: `recipe-log-${Date.now()}-${Math.floor(Math.random() * 100000)}`, timestamp: Date.now(), frame: worldRecipeFrame }, deepClone(entry)));
        if (log.length > WORLD_RECIPE_LOG_LIMIT) log.length = WORLD_RECIPE_LOG_LIMIT;
        return deepClone(log[0]);
    }

    async function runWorldRecipe(id, suppliedContext = {}, options = {}) {
        if (integer(options.depth, 0) > 12) throw new Error("World Recipe call depth exceeded 12 levels.");
        const recipe = worldRecipe(id);
        if (!recipe) return { ok: false, recipeId: String(id || ""), reason: "missing" };
        const state = worldRecipeStateRecord(recipe.id); const allowed = worldRecipeCanRun(recipe, state, options);
        if (!allowed.ok) return { ok: false, skipped: true, recipeId: recipe.id, reason: allowed.reason };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id }));
        if (ensureStore().worldRecipeBreakpoints[recipe.id] && !options.resume && !options.dryRun) {
            ensureStore().worldRecipePaused[recipe.id] = { recipeId: recipe.id, context: deepClone(context), options: deepClone(options), pausedAt: Date.now() };
            const paused = { ok: true, paused: true, recipeId: recipe.id, reason: "breakpoint", context: deepClone(context) };
            logWorldRecipe(Object.assign({ trigger: context.trigger || "manual", context: deepClone(context) }, paused));
            return paused;
        }
        const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        let conditionsPassed = true;
        try { conditionsPassed = options.ignoreConditions ? true : await evaluateWorldRecipeCondition(recipe.conditions, context, recipe); }
        catch (error) { captureError(error, { operation: "worldRecipeCondition", recipeId: recipe.id }); return { ok: false, recipeId: recipe.id, reason: "conditionError", error: error.message }; }
        if (!conditionsPassed) return { ok: false, skipped: true, recipeId: recipe.id, reason: "conditions" };
        if (options.dryRun) return { ok: true, dryRun: true, recipeId: recipe.id, context, plannedActions: deepClone(recipe.actions) };
        state.running = true; const results = []; const errors = [];
        try {
            for (let index = 0; index < recipe.actions.length; index++) {
                try { results.push(await executeWorldRecipeAction(recipe.actions[index], context, recipe, options)); }
                catch (error) { errors.push({ index, message: error.message }); captureError(error, { operation: "worldRecipeAction", recipeId: recipe.id, actionIndex: index }); if (recipe.errorPolicy !== "continue") break; }
            }
            const ok = errors.length === 0 || recipe.errorPolicy === "continue";
            if (ok) { state.runCount = (state.runCount || 0) + 1; state.lastRunFrame = worldRecipeFrame; state.lastRunAt = Date.now(); state.lastTrigger = context.trigger || "manual"; }
            state.lastResult = { ok, errors: deepClone(errors), at: Date.now() };
            const endedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
            const durationMs = Math.max(0, endedAt - startedAt); const profile = ensureStore().worldRecipeProfiles[recipe.id] ||= { runs: 0, totalMs: 0, maxMs: 0, lastMs: 0, failures: 0 };
            profile.runs++; profile.totalMs += durationMs; profile.maxMs = Math.max(profile.maxMs, durationMs); profile.lastMs = durationMs; if (!ok) profile.failures++; profile.averageMs = profile.totalMs / Math.max(1, profile.runs);
            const result = { ok, recipeId: recipe.id, runCount: state.runCount || 0, results, errors, durationMs };
            logWorldRecipe(Object.assign({ trigger: context.trigger || "manual", context: deepClone(context) }, result));
            if (ok) emitChange({ operation: "worldRecipeRun", recipeId: recipe.id, trigger: context.trigger || "manual", actionCount: recipe.actions.length });
            return result;
        } finally { state.running = false; }
    }

    function setWorldRecipeBreakpoint(id, enabled = true) { if (!worldRecipe(id)) return false; ensureStore().worldRecipeBreakpoints[String(id)] = !!enabled; if (!enabled) delete ensureStore().worldRecipePaused[String(id)]; return true; }
    function listWorldRecipeBreakpoints() { return Object.entries(ensureStore().worldRecipeBreakpoints || {}).filter(([, enabled]) => enabled).map(([recipeId]) => ({ recipeId, paused: deepClone(ensureStore().worldRecipePaused[recipeId] || null) })); }
    function resumeWorldRecipe(id, options = {}) { const paused = ensureStore().worldRecipePaused[String(id || "")]; if (!paused) return Promise.resolve({ ok: false, reason: "notPaused", recipeId: String(id || "") }); delete ensureStore().worldRecipePaused[String(id)]; return runWorldRecipe(paused.recipeId, paused.context, Object.assign({}, paused.options, options, { resume: true })); }

    function setWorldRecipeWatch(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Debugger watches require a safe stable ID.");
        const watch = Object.assign({ id, name: definition?.name || id, type: "state", key: "", scope: "global", enabled: true, createdAt: Date.now() }, deepClone(definition), { id }); ensureStore().worldDebugger.watches[id] = watch; return deepClone(watch);
    }
    function removeWorldRecipeWatch(id) { const key = String(id || ""); const existed = !!ensureStore().worldDebugger.watches[key]; delete ensureStore().worldDebugger.watches[key]; return existed; }
    function worldRecipeWatchValue(watch) { const type = canonicalWorldRecipeType(watch.type); if (type === "state") return getWorldState(watch.key, watch); if (type === "fact") return deepClone(ensureStore().worldFacts[String(watch.key || watch.name)]); if (type === "npc") return worldNpc(watch.npcId || watch.key); if (type === "resource") return worldResource(watch.resourceId || watch.key); if (type === "recipe") return deepClone(ensureStore().worldRecipeStates[String(watch.recipeId || watch.key)] || null); if (type === "clock") return worldClock(); return undefined; }
    function listWorldRecipeWatches() { return Object.values(ensureStore().worldDebugger.watches || {}).map(watch => Object.assign(deepClone(watch), { value: worldRecipeWatchValue(watch) })); }
    function recordWorldRecipeDebug(entry) { const history = ensureStore().worldDebugger.history; history.unshift(Object.assign({ id: `debug-${Date.now()}-${Math.floor(Math.random() * 100000)}`, at: Date.now() }, deepClone(entry))); history.length = Math.min(history.length, 200); return deepClone(history[0]); }
    function clearWorldRecipeDebugHistory() { const count = ensureStore().worldDebugger.history.length; ensureStore().worldDebugger.history = []; return count; }
    function worldRecipeDebugSnapshot(options = {}) { return { breakpoints: listWorldRecipeBreakpoints(), watches: listWorldRecipeWatches(), paused: deepClone(ensureStore().worldRecipePaused), history: deepClone(ensureStore().worldDebugger.history.slice(0, Math.max(1, integer(options.limit, 50)))) }; }

    async function stepWorldRecipe(id, actionIndex = 0, suppliedContext = {}, options = {}) {
        const recipe = worldRecipe(id); if (!recipe) return { ok: false, reason: "missing", recipeId: String(id || "") }; const index = Math.max(0, integer(actionIndex)); if (!recipe.actions[index]) return { ok: false, reason: "actionMissing", recipeId: recipe.id, actionIndex: index };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id, trigger: suppliedContext.trigger || "debugStep" })); const conditionsPassed = await evaluateWorldRecipeCondition(recipe.conditions, context, recipe); let result = null;
        if (conditionsPassed && options.execute === true) result = await executeWorldRecipeAction(recipe.actions[index], context, recipe, Object.assign({}, options, { resume: true }));
        const record = recordWorldRecipeDebug({ recipeId: recipe.id, actionIndex: index, conditionsPassed, executed: options.execute === true && conditionsPassed, action: deepClone(recipe.actions[index]), result: deepClone(result), context: deepClone(context), watches: listWorldRecipeWatches() }); return Object.assign({ ok: conditionsPassed, planned: options.execute !== true, nextActionIndex: index + 1 < recipe.actions.length ? index + 1 : null }, record);
    }

    async function explainWorldRecipe(id, suppliedContext = {}) {
        const recipe = worldRecipe(id); if (!recipe) return { ok: false, recipeId: String(id || ""), reason: "missing", trace: [] };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id }));
        async function visit(condition, path = "conditions", depth = 0) {
            if (depth > 12) return { path, type: "limit", result: false, summary: "Condition nesting limit exceeded", children: [] };
            if (Array.isArray(condition)) { const children = []; for (let index = 0; index < condition.length; index++) children.push(await visit(condition[index], `${path}[${index}]`, depth + 1)); return { path, type: "all", result: children.every(child => child.result), summary: `All ${children.length} conditions`, children }; }
            if (condition?.all !== undefined || condition?.any !== undefined) { const key = condition.all !== undefined ? "all" : "any"; const values = condition[key] || []; const children = []; for (let index = 0; index < values.length; index++) children.push(await visit(values[index], `${path}.${key}[${index}]`, depth + 1)); return { path, type: key, result: key === "all" ? children.every(child => child.result) : !children.length || children.some(child => child.result), summary: `${key === "all" ? "All" : "Any"} of ${children.length}`, children }; }
            if (condition?.not !== undefined) { const child = await visit(condition.not, `${path}.not`, depth + 1); return { path, type: "not", result: !child.result, summary: "Not", children: [child] }; }
            let result = false; let error = ""; try { result = await evaluateWorldRecipeCondition(condition, context, recipe, depth); } catch (caught) { error = caught.message; }
            return { path, type: canonicalWorldRecipeType(condition?.type || "always"), result: !!result, summary: error || JSON.stringify(condition), children: [], error };
        }
        const tree = await visit(recipe.conditions); const report = { ok: true, recipeId: recipe.id, passes: tree.result, context, tree, plannedActions: deepClone(recipe.actions), canRun: worldRecipeCanRun(recipe, worldRecipeStateRecord(recipe.id)) }; recordWorldRecipeDebug({ recipeId: recipe.id, operation: "explain", passes: tree.result, context, tree, watches: listWorldRecipeWatches() }); return report;
    }

    function worldRecipePerformance(options = {}) { return Object.entries(ensureStore().worldRecipeProfiles || {}).map(([recipeId, value]) => Object.assign({ recipeId }, deepClone(value))).sort((a, b) => options.sort === "average" ? b.averageMs - a.averageMs : b.maxMs - a.maxMs); }
    async function replayWorldRecipeLog(logId, options = {}) { const entry = ensureStore().worldRecipeLog.find(item => item.id === String(logId)); if (!entry) return { ok: false, reason: "missingLog" }; return runWorldRecipe(entry.recipeId, Object.assign({}, entry.context || {}, options.context || {}, { trigger: "replay" }), Object.assign({}, options, { ignoreLimits: options.ignoreLimits !== false, resume: true })); }

    function scenarioAssertionValue(assertion) {
        const type = canonicalWorldRecipeType(assertion.type);
        if (type === "switch") return recipeSwitchValue(assertion.id);
        if (type === "variable") return recipeVariableValue(assertion.id);
        if (type === "state") return getWorldState(assertion.key, assertion);
        if (type === "fact") return ensureStore().worldFacts[String(assertion.name || assertion.key || "")];
        if (type === "resource") return worldResource(assertion.id)?.quantity;
        if (type === "entity") return worldEntity(assertion.id)?.[assertion.property || "state"];
        if (type === "tile") return getTileId(integer(assertion.x), integer(assertion.y), assertion.layer || "L1");
        return undefined;
    }

    async function runWorldRecipeScenario(scenario, options = {}) {
        const definition = deepClone(scenario || {}); const storeSnapshot = deepClone(ensureStore()); const switches = deepClone(typeof $gameSwitches !== "undefined" ? ($gameSwitches._data || $gameSwitches.values || []) : []); const variables = deepClone(typeof $gameVariables !== "undefined" ? ($gameVariables._data || $gameVariables.values || []) : []); const mapSnapshot = typeof $dataMap !== "undefined" && $dataMap ? deepClone($dataMap) : null;
        try {
            for (const [id, value] of Object.entries(definition.initial?.switches || {})) $gameSwitches?.setValue?.(integer(id), !!value);
            for (const [id, value] of Object.entries(definition.initial?.variables || {})) $gameVariables?.setValue?.(integer(id), value);
            for (const [key, value] of Object.entries(definition.initial?.state || {})) setWorldState(key, value);
            for (const [key, value] of Object.entries(definition.initial?.facts || {})) addWorldFact(key, value);
            const execution = options.execute === false ? await runWorldRecipe(definition.recipeId, definition.context || {}, { dryRun: true, ignoreLimits: true }) : await runWorldRecipe(definition.recipeId, definition.context || {}, { ignoreLimits: true, resume: true });
            const assertions = normalizeList(definition.expect).map(assertion => { const actual = scenarioAssertionValue(assertion); const expected = assertion.value; return { description: assertion.description || `${assertion.type} ${assertion.id || assertion.key || assertion.name || ""}`, pass: compareWorldRecipeValues(actual, assertion.operator || "===", expected), actual: deepClone(actual), expected: deepClone(expected) }; });
            if (definition.expectResult !== undefined) assertions.unshift({ description: "Recipe result", pass: execution.ok === !!definition.expectResult, actual: execution.ok, expected: !!definition.expectResult });
            return { id: definition.id || "scenario", name: definition.name || definition.id || "Scenario", ok: execution.ok && assertions.every(item => item.pass), execution, assertions };
        } finally {
            if (!options.commit) {
                if (typeof $gameSystem !== "undefined" && $gameSystem) $gameSystem._hybridTileGraft = storeSnapshot; else fallbackStore = storeSnapshot;
                if (typeof $gameSwitches !== "undefined" && $gameSwitches) { if ($gameSwitches._data) $gameSwitches._data = switches; else $gameSwitches.values = switches; }
                if (typeof $gameVariables !== "undefined" && $gameVariables) { if ($gameVariables._data) $gameVariables._data = variables; else $gameVariables.values = variables; }
                if (mapSnapshot && typeof $dataMap !== "undefined") { for (const key of Object.keys($dataMap)) delete $dataMap[key]; Object.assign($dataMap, mapSnapshot); $gameMap?.requestRefresh?.(); }
            }
        }
    }

    async function runWorldRecipeTestSuite(tests = null, options = {}) { const values = tests ? normalizeList(tests) : deepClone(ensureStore().worldRecipeTests); const results = []; for (const scenario of values) results.push(await runWorldRecipeScenario(scenario, options)); return { ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length, results }; }

    async function triggerWorldRecipes(trigger, suppliedContext = {}, options = {}) {
        const name = canonicalWorldRecipeType(trigger || "manual");
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { trigger: name }));
        const results = [];
        for (const recipe of worldRecipeDefinitions()) {
            if (!worldRecipeTriggerMatches(recipe, name, context)) continue;
            results.push(await runWorldRecipe(recipe.id, context, options));
        }
        return { ok: results.every(result => result.ok || result.skipped), trigger: name, matched: results.length, ran: results.filter(result => result.ok && !result.dryRun && !result.paused).length, results };
    }

    function pumpWorldRecipeQueue() {
        if (worldRecipePumping || !worldRecipeQueue.length) return; worldRecipePumping = true;
        Promise.resolve().then(async () => {
            const started = clockNow(); const budget = runtimeBudget(); let processed = 0;
            try { while (worldRecipeQueue.length && processed < budget.recipeRunsPerFrame && clockNow() - started < budget.frameBudgetMs) { const item = worldRecipeQueue.shift(); await triggerWorldRecipes(item.trigger, item.context); processed++; } }
            catch (error) { captureError(error, { operation: "worldRecipeQueue" }); }
            finally { worldRecipePumping = false; if (worldRecipeQueue.length) setTimeout(pumpWorldRecipeQueue, 0); }
        });
    }

    function queueWorldRecipeTrigger(trigger, context = {}) {
        if (!AUTO_WORLD_RECIPES) return false;
        if (worldRecipeQueue.length >= 100) worldRecipeQueue.shift();
        worldRecipeQueue.push({ trigger, context: deepClone(context) }); pumpWorldRecipeQueue(); return true;
    }

    function updateWorldRecipeEngine() {
        if (!AUTO_WORLD_RECIPES || typeof $gameMap === "undefined" || !$gameMap) return;
        worldRecipeFrame++;
        processWorldSimulation();
        if (worldRecipeFrame % 60 === 0) { const policy = ensureStore().recoveryPolicy || {}; const interval = Math.max(0, integer(policy.snapshotMinutes, 0)) * 60000; if (interval > 0 && Date.now() - integer(policy.lastSnapshotAt, 0) >= interval) { const result = createRecoverySnapshot("Automatic recovery", { automatic: true, retain: policy.retain }); if (result) policy.lastSnapshotAt = Date.now(); } }
        if (worldRecipeFrame % 15 === 0) queueWorldRecipeTrigger("interval", { frame: worldRecipeFrame });
        if (typeof $gamePlayer !== "undefined" && $gamePlayer) {
            const key = `${$gameMap.mapId()}:${$gamePlayer.x},${$gamePlayer.y}`;
            if (worldRecipeLastPlayerTile && key !== worldRecipeLastPlayerTile) {
                const context = { mapId: $gameMap.mapId(), x: $gamePlayer.x, y: $gamePlayer.y, regionId: $gameMap.regionId ? $gameMap.regionId($gamePlayer.x, $gamePlayer.y) : 0 };
                queueWorldRecipeTrigger("playerStep", context);
                const currentZones = new Set(worldZonesAt(context.mapId, context.x, context.y, context.regionId).map(zone => zone.id));
                for (const zoneId of currentZones) if (!worldRecipeLastZones.has(zoneId)) queueWorldRecipeTrigger("zoneEnter", Object.assign({ zoneId }, context));
                for (const zoneId of worldRecipeLastZones) if (!currentZones.has(zoneId)) queueWorldRecipeTrigger("zoneExit", Object.assign({ zoneId }, context));
                worldRecipeLastZones = currentZones;
            }
            worldRecipeLastPlayerTile = key;
        }
    }

    function setWorldRecipeEnabled(id, enabled = true) {
        const recipe = worldRecipe(id); if (!recipe) return false;
        worldRecipeStateRecord(recipe.id).enabled = !!enabled;
        return true;
    }

    function resetWorldRecipeState(id = "") {
        const store = ensureStore(); const key = String(id || "");
        if (!key) { const count = Object.keys(store.worldRecipeStates).length; store.worldRecipeStates = {}; return count; }
        if (!store.worldRecipeStates[key]) return false;
        delete store.worldRecipeStates[key]; return true;
    }

    function worldRecipeDiagnostics(options = {}) {
        const catalog = exportWorldRecipePack();
        const validation = validateWorldRecipeCatalog(catalog);
        return {
            version: 1, pluginVersion: VERSION, automatic: AUTO_WORLD_RECIPES, file: WORLD_RECIPE_FILE,
            recipeCount: catalog.recipes.length, enabledCount: listWorldRecipes().filter(recipe => recipe.enabled).length,
            queued: worldRecipeQueue.length, frame: worldRecipeFrame, validation,
            states: deepClone(ensureStore().worldRecipeStates), worldState: deepClone(ensureStore().worldState),
            clock: worldClock(), facts: deepClone(ensureStore().worldFacts), zones: listWorldZones(),
            schedules: listWorldSchedules(), packs: listWorldPacks(), resources: listWorldResources(),
            entities: listWorldEntities(), npcs: listWorldNpcs(), npcRoutes: listWorldNpcRoutes(), occupancy: worldNpcOccupancy(), ruleLayers: listWorldRuleLayers(), ruleBrushes: listWorldRuleBrushes(), biomeGraphs: listBiomeGraphs(),
            biomeLocks: listBiomeLocks(), biomeCacheEntries: Object.keys(ensureStore().worldBiomeCache || {}).length,
            packLock: worldPackLockfile(), publishers: listTrustedPackPublishers(), catalogSubscriptions: listCatalogSubscriptions(), runtimeBudget: runtimeBudget(), spatialIndex: worldZoneSpatialDiagnostics(),
            debugger: worldRecipeDebugSnapshot({ limit: 10 }), referenceGraph: worldReferenceGraph(), atlases: listWorldAtlases().slice(0, 5), eventQuestGraphs: listEventQuestGraphs().slice(0, 5), visualHistory: listVisualHistory().slice(0, 10), extensions: listExtensionManifests(), validations: listProductionValidations().slice(0, 5), deployments: listProjectDeploymentReports().slice(0, 5), benchmarks: listWorldBenchmarks().slice(0, 5), performance: worldRecipePerformance(),
            log: deepClone(ensureStore().worldRecipeLog.slice(0, Math.max(1, integer(options.logLimit, 25))))
        };
    }

