    // -------------------------------------------------------------------------
    // Live patch application and map reconstruction
    // -------------------------------------------------------------------------

    function requestTilemapRefresh() {
        const scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset._tilemap && scene._spriteset._tilemap.refresh) {
            scene._spriteset._tilemap.refresh();
        }
    }

    function applyPatchLive(patch, operation = "change") {
        if (patch && patch.kind === "batch") {
            for (const child of patch.patches || []) applyPatchLive(child, operation);
            return true;
        }
        applyPatchToBuffer(patch, $dataMap.data, $dataMap.width, $dataMap.height, true);
        if (patchAffectsEvents(patch)) {
            const rect = eventPatchRect(patch);
            for (const id of patch.removeEventIds || []) {
                if (spawnedIds.has(id) || isHybridGameEvent($gameMap.event(id))) despawnEvent(id, !patch.preserveEventState);
            }
            if (patch.replaceAreaEvents !== false) despawnEventsInArea(rect, true);
            for (const event of patch.events || []) spawnEventFromSnapshot(event, true);
        }
        requestTilemapRefresh();
        emitChange({ operation, mapId: $gameMap.mapId(), rect: patchRect(patch), layers: patch.layers || [] });
    }

    function captureCurrentPristine(mapId) {
        currentPristine = {
            mapId,
            width: $dataMap.width,
            height: $dataMap.height,
            data: $dataMap.data.slice(),
            tilesetId: $dataMap.tilesetId,
            note: $dataMap.note || "",
            events: deepClone($dataMap.events || [])
        };
    }

    function prepareDataMapForLoad(mapId) {
        captureCurrentPristine(mapId);
        const snapshot = buildComposedSnapshot(mapId, currentPristine);
        $dataMap.width = snapshot.width;
        $dataMap.height = snapshot.height;
        $dataMap.tilesetId = snapshot.tilesetId;
        $dataMap.note = snapshot.note;
        $dataMap.data = snapshot.data;
        $dataMap.events = snapshot.events;
    }

    function rebuildCurrentMap(operation = "rebuild") {
        if (!currentPristine || currentPristine.mapId !== $gameMap.mapId()) return false;
        captureSpawnedRuntimeStates();
        const previousIds = new Set(spawnedIds);
        despawnAllTrackedEvents(false);
        const snapshot = buildComposedSnapshot($gameMap.mapId(), currentPristine);
        $dataMap.width = snapshot.width;
        $dataMap.height = snapshot.height;
        $dataMap.tilesetId = snapshot.tilesetId;
        $dataMap.note = snapshot.note;
        $dataMap.data = snapshot.data;
        $dataMap.events = snapshot.events;
        const desiredEvents = snapshot.events;
        const desiredOrdinaryIds = new Set();
        if ($gameMap && $gameMap._events) {
            for (const eventData of desiredEvents || []) {
                if (!eventData || isHybridEventData(eventData)) continue;
                desiredOrdinaryIds.add(eventData.id);
                let gameEvent = $gameMap.event(eventData.id);
                if (!gameEvent && typeof Game_Event !== "undefined") {
                    gameEvent = new Game_Event($gameMap.mapId(), eventData.id);
                    $gameMap._events[eventData.id] = gameEvent;
                }
                if (gameEvent && gameEvent.locate) gameEvent.locate(eventData.x, eventData.y);
            }
            for (let eventId = 1; eventId < $gameMap._events.length; eventId++) {
                const gameEvent = $gameMap._events[eventId];
                if (gameEvent && !isHybridGameEvent(gameEvent) && !desiredOrdinaryIds.has(eventId)) $gameMap._events[eventId] = null;
            }
        }
        const desiredIds = new Set();
        for (const event of desiredEvents) {
            if (!isHybridEventData(event)) continue;
            desiredIds.add(event.id);
            spawnEventFromSnapshot(event, true);
        }
        for (const id of previousIds) if (!desiredIds.has(id)) clearEventState($gameMap.mapId(), id);
        requestTilemapRefresh();
        emitChange({ operation, mapId: $gameMap.mapId(), rect: { x: 0, y: 0, w: $dataMap.width, h: $dataMap.height }, layers: Object.keys(LAYER_INDEX) });
        return true;
    }

    function makeCompactedPatch(pristine, composed) {
        const cells = [];
        for (let y = 0; y < pristine.height; y++) {
            for (let x = 0; x < pristine.width; x++) {
                const tiles = {};
                for (const [key, z] of Object.entries(LAYER_INDEX)) {
                    const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                    const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                    if (before !== after) tiles[key] = after;
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
        }
        const events = (composed.events || []).filter(isHybridEventData).map(deepClone);
        if (!cells.length && !events.length) return null;
        const patch = makeSparsePatch(cells, "exact", null);
        patch.compacted = true;
        patch.affectEvents = true;
        patch.events = events;
        patch.removeEventIds = [];
        patch.eventRect = { x: 0, y: 0, w: pristine.width, h: pristine.height };
        return patch;
    }

    function compactMapSync(mapId = $gameMap.mapId(), announce = true) {
        const id = integer(mapId);
        if (activeEditTransaction && activeEditTransaction.mapId === id) {
            if (announce) console.warn(`${PLUGIN_NAME}: commit or cancel the active edit transaction before compacting.`);
            return false;
        }
        const pristine = currentPristine && currentPristine.mapId === id
            ? currentPristine
            : pristineCache.get(id);
        if (!pristine) return false;
        const store = ensureStore();
        const beforeCount = (store.maps[String(id)] || []).length;
        const composed = buildComposedSnapshot(id, pristine);
        if (store.mapOverrides[String(id)]) {
            const previous = store.mapOverrides[String(id)];
            store.mapOverrides[String(id)] = Object.assign({}, previous, {
                width: composed.width,
                height: composed.height,
                data: composed.data.slice(),
                tilesetId: composed.tilesetId,
                note: composed.note || "",
                events: deepClone(composed.events || [])
            });
            delete store.maps[String(id)];
            delete store.redo[String(id)];
            composedCache.set(id, composed);
            if (announce) emitChange({ operation: "compactMap", mapId: id,
                beforePatchCount: beforeCount, afterPatchCount: 0, transformed: true });
            return { mapId: id, beforePatchCount: beforeCount, afterPatchCount: 0,
                changedCells: composed.width * composed.height, spawnedEvents: (composed.events || []).filter(isHybridEventData).length,
                transformed: true };
        }
        const compacted = makeCompactedPatch(pristine, composed);
        if (compacted) store.maps[String(id)] = [compacted];
        else delete store.maps[String(id)];
        delete store.redo[String(id)];
        composedCache.set(id, composed);
        if (announce) {
            emitChange({
                operation: "compactMap",
                mapId: id,
                beforePatchCount: beforeCount,
                afterPatchCount: compacted ? 1 : 0,
                changedCells: compacted ? compacted.cells.length : 0
            });
        }
        return {
            mapId: id,
            beforePatchCount: beforeCount,
            afterPatchCount: compacted ? 1 : 0,
            changedCells: compacted ? compacted.cells.length : 0,
            spawnedEvents: compacted ? compacted.events.length : 0
        };
    }

    function compactMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const immediate = compactMapSync(id, true);
        if (immediate) return Promise.resolve(immediate);
        return loadPristineMapData(id).then(() => compactMapSync(id, true));
    }

    function patchWriteCount(patch) {
        if (!patch || typeof patch !== "object") return 0;
        if (patch && patch.kind === "batch") {
            return (patch.patches || []).reduce((total, child) => total + patchWriteCount(child), 0);
        }
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            return (patch.cells || []).reduce((total, cell) => total + Object.keys(cell.tiles || {}).length, 0);
        }
        const rect = patchRect(patch);
        return rect.w * rect.h * parseLayerSelection(patch.layers || []).layers.length;
    }

    function diagnoseMapSync(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const patches = getPatches(id);
        const pristine = currentPristine && currentPristine.mapId === id
            ? currentPristine
            : pristineCache.get(id);
        const warnings = [];
        let tileWrites = 0;
        let spawnedEvents = 0;
        for (let index = 0; index < patches.length; index++) {
            const patch = patches[index];
            tileWrites += patchWriteCount(patch);
            spawnedEvents += flattenPatches([patch]).reduce((total, child) => total + (child.events || []).length, 0);
            const rect = patchRect(patch);
            if (pristine && rect.w > 0 && rect.h > 0 && (
                rect.x >= pristine.width || rect.y >= pristine.height ||
                rect.x + rect.w <= 0 || rect.y + rect.h <= 0
            )) warnings.push(`Patch ${index + 1} is completely outside the map.`);
            for (const event of flattenPatches([patch]).flatMap(child => child.events || [])) {
                if (!isHybridEventData(event) || event.id < SPAWN_ID_OFFSET) {
                    warnings.push(`Patch ${index + 1} has an invalid spawned-event identity.`);
                }
            }
        }
        if (MAX_SAVED_PATCHES > 0 && patches.length > Math.floor(MAX_SAVED_PATCHES * 0.8)) {
            warnings.push(`Patch count is approaching the automatic compaction threshold (${MAX_SAVED_PATCHES}).`);
        }
        const storeValidation = validateStore({ repair: false });
        const override = ensureStore().mapOverrides[String(id)] || null;
        if (storeValidation.issueCount) warnings.push(`Save-store validation found ${storeValidation.issueCount} structural issue(s).`);
        return {
            version: VERSION,
            mapId: id,
            patchCount: patches.length,
            redoCount: (ensureStore().redo[String(id)] || []).length,
            tileWrites,
            spawnedEventSnapshots: spawnedEvents,
            cached: composedCache.has(id),
            transformed: !!override,
            dimensions: override ? { width: override.width, height: override.height } : pristine
                ? { width: pristine.width, height: pristine.height } : null,
            prefabCount: listPrefabs().length,
            checkpointCount: listCheckpoints(id).length,
            historyBytes: JSON.stringify({ patches, redo: ensureStore().redo[String(id)] || [] }).length,
            validation: storeValidation,
            performance: performanceDiagnostics(),
            compatibility: compatibilityDiagnostics(),
            warnings,
            ok: warnings.length === 0
        };
    }

    function diagnoseMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if ((currentPristine && currentPristine.mapId === id) || pristineCache.has(id)) {
            return Promise.resolve(diagnoseMapSync(id));
        }
        return loadPristineMapData(id).then(() => diagnoseMapSync(id));
    }

    function exportPatchPack(mapIds = null) {
        const store = ensureStore();
        const ids = mapIds === null || mapIds === undefined
            ? [...new Set([...Object.keys(store.maps), ...Object.keys(store.mapOverrides)])].map(Number)
            : normalizeList(mapIds).map(Number).filter(id => id > 0);
        const maps = {};
        const redo = {};
        const eventStates = {};
        const checkpoints = {};
        const mapOverrides = {};
        const authoringLayers = {};
        const activeAuthoringLayers = {};
        const masks = {};
        const modifiers = {};
        const prefabInstances = {};
        for (const id of ids) {
            const key = String(id);
            if (store.maps[key]) maps[key] = deepClone(store.maps[key]);
            if (store.redo[key]) redo[key] = deepClone(store.redo[key]);
            if (store.eventStates[key]) eventStates[key] = deepClone(store.eventStates[key]);
            if (store.checkpoints[key]) checkpoints[key] = deepClone(store.checkpoints[key]);
            if (store.mapOverrides[key]) mapOverrides[key] = deepClone(store.mapOverrides[key]);
            if (store.authoringLayers[key]) authoringLayers[key] = deepClone(store.authoringLayers[key]);
            if (store.activeAuthoringLayers[key]) activeAuthoringLayers[key] = store.activeAuthoringLayers[key];
            if (store.masks[key]) masks[key] = deepClone(store.masks[key]);
            if (store.modifiers[key]) modifiers[key] = deepClone(store.modifiers[key]);
            if (store.prefabInstances[key]) prefabInstances[key] = deepClone(store.prefabInstances[key]);
        }
        return {
            format: "HybridTileGraftPatchPack",
            version: 3,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            maps,
            redo,
            eventStates,
            checkpoints,
            mapOverrides,
            authoringLayers,
            activeAuthoringLayers,
            masks,
            modifiers,
            prefabInstances,
            changeSets: deepClone(store.changeSets),
            prefabs: deepClone(store.prefabs),
            prefabPayloads: deepClone(store.prefabPayloads),
            prefabRevisions: deepClone(store.prefabRevisions),
            eventTemplates: deepClone(store.eventTemplates),
            brushPresets: deepClone(store.brushPresets),
            editorPreferences: deepClone(store.editorPreferences)
        };
    }

    function validatePatchRecord(patch, path, issues, repair = false) {
        const issue = (message, fixed = false) => issues.push({ path, message, fixed });
        if (!patch || typeof patch !== "object") {
            issue("Patch is not an object.", repair);
            return false;
        }
        if (patch.kind === "batch") {
            if (!Array.isArray(patch.patches)) {
                issue("Batch patch has no patch array.", repair);
                if (repair) patch.patches = [];
                return false;
            }
            if (repair) patch.patches = patch.patches.filter((child, index) =>
                validatePatchRecord(child, `${path}.patches[${index}]`, issues, true));
            else patch.patches.forEach((child, index) => validatePatchRecord(child, `${path}.patches[${index}]`, issues, false));
            return true;
        }
        if (patch.kind === "rect") {
            const width = positiveInteger(patch.w, 0);
            const height = positiveInteger(patch.h, 0);
            if (width <= 0 || height <= 0) {
                issue("Rectangle patch has invalid dimensions.", false);
                return false;
            }
            const layers = parseLayerSelection(patch.layers || []).layers;
            if (!layers.length && !patchAffectsEvents(patch)) issue("Rectangle patch has no valid layers or events.", false);
            if (repair) patch.layers = layers;
            patch.tiles ||= {};
            for (const layer of layers) {
                if (!Array.isArray(patch.tiles[layer])) {
                    issue(`Missing ${layer} tile array.`, repair);
                    if (repair) patch.tiles[layer] = new Array(width * height).fill(0);
                } else if (patch.tiles[layer].length !== width * height) {
                    issue(`${layer} tile array length does not match the rectangle.`, repair);
                    if (repair) patch.tiles[layer] = patch.tiles[layer].slice(0, width * height)
                        .concat(new Array(Math.max(0, width * height - patch.tiles[layer].length)).fill(0));
                }
            }
        } else if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            if (!Array.isArray(patch.cells)) {
                issue("Sparse patch has no cells array.", repair);
                if (repair) patch.cells = [];
                return false;
            }
            const clean = [];
            for (let index = 0; index < patch.cells.length; index++) {
                const cell = patch.cells[index];
                if (!cell || typeof cell !== "object" || !cell.tiles || typeof cell.tiles !== "object") {
                    issue(`Sparse cell ${index} is invalid.`, repair);
                    continue;
                }
                const tiles = {};
                for (const [layer, value] of Object.entries(cell.tiles)) {
                    if (LAYER_INDEX[layer] === undefined || !Number.isFinite(Number(value))) {
                        issue(`Sparse cell ${index} has invalid ${layer} data.`, repair);
                        continue;
                    }
                    tiles[layer] = integer(value);
                }
                if (Object.keys(tiles).length || patchAffectsEvents(patch)) clean.push({ x: integer(cell.x), y: integer(cell.y), tiles });
            }
            if (repair) patch.cells = clean;
        } else if (patch.kind !== "events") {
            issue(`Unknown patch kind "${patch.kind}".`, false);
            return false;
        }
        if (patch.events !== null && patch.events !== undefined && !Array.isArray(patch.events)) {
            issue("Patch event collection is not an array.", repair);
            if (repair) patch.events = [];
        }
        if (repair && Array.isArray(patch.removeEventIds)) {
            patch.removeEventIds = [...new Set(patch.removeEventIds.map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET))];
        }
        if (repair) patch.mode = normalizeMode(patch.mode, "exact");
        return true;
    }

    function validateStore(options = {}) {
        const repair = toBoolean(options.repair, false);
        const store = ensureStore();
        const issues = [];
        let fixes = 0;
        const inspectBucket = (bucketName) => {
            const bucket = store[bucketName] || {};
            for (const [key, patches] of Object.entries(bucket)) {
                if (!/^\d+$/.test(key) || !Array.isArray(patches)) {
                    issues.push({ path: `${bucketName}.${key}`, message: "Invalid map history bucket.", fixed: repair });
                    if (repair) delete bucket[key];
                    continue;
                }
                if (repair) bucket[key] = patches.filter((patch, index) =>
                    validatePatchRecord(patch, `${bucketName}.${key}[${index}]`, issues, true));
                else patches.forEach((patch, index) => validatePatchRecord(patch, `${bucketName}.${key}[${index}]`, issues, false));
            }
        };
        inspectBucket("maps");
        inspectBucket("redo");
        for (const [key, override] of Object.entries(store.mapOverrides || {})) {
            const expected = positiveInteger(override && override.width, 0) * positiveInteger(override && override.height, 0) * 6;
            if (!override || expected <= 0 || !Array.isArray(override.data) || override.data.length !== expected) {
                issues.push({ path: `mapOverrides.${key}`, message: "Invalid full-map override.", fixed: repair });
                if (repair) delete store.mapOverrides[key];
            }
        }
        for (const [key, payload] of Object.entries(store.prefabPayloads || {})) {
            const expected = positiveInteger(payload && payload.width, 0) * positiveInteger(payload && payload.height, 0);
            const valid = payload && expected > 0 && payload.tiles && Object.values(payload.tiles).every(values => Array.isArray(values) && values.length === expected);
            if (!valid) {
                issues.push({ path: `prefabPayloads.${key}`, message: "Invalid embedded prefab payload.", fixed: repair });
                if (repair) delete store.prefabPayloads[key];
            }
        }
        for (const [key, layers] of Object.entries(store.authoringLayers || {})) {
            if (!Array.isArray(layers)) {
                issues.push({ path: `authoringLayers.${key}`, message: "Authoring layer bucket is not an array.", fixed: repair });
                if (repair) store.authoringLayers[key] = [];
                continue;
            }
            const ids = new Set();
            store.authoringLayers[key] = layers.filter((layer, index) => {
                const valid = layer && layer.id && !ids.has(layer.id);
                if (!valid) issues.push({ path: `authoringLayers.${key}[${index}]`, message: "Invalid or duplicate authoring layer.", fixed: repair });
                if (valid) ids.add(layer.id);
                return valid || !repair;
            });
            for (const patch of store.maps[key] || []) if (patch && patch.authoringLayerId && !ids.has(patch.authoringLayerId)) {
                issues.push({ path: `maps.${key}`, message: `Patch references missing authoring layer ${patch.authoringLayerId}.`, fixed: repair });
                if (repair) delete patch.authoringLayerId;
            }
        }
        for (const [key, masks] of Object.entries(store.masks || {})) {
            if (!masks || typeof masks !== "object" || Array.isArray(masks)) {
                issues.push({ path: `masks.${key}`, message: "Mask bucket is invalid.", fixed: repair });
                if (repair) store.masks[key] = {};
                continue;
            }
            for (const [maskId, mask] of Object.entries(masks)) if (!mask || !Array.isArray(mask.points)) {
                issues.push({ path: `masks.${key}.${maskId}`, message: "Mask has no point array.", fixed: repair });
                if (repair) delete masks[maskId];
            }
        }
        for (const field of ["modifiers", "prefabInstances"]) for (const [key, entries] of Object.entries(store[field] || {})) {
            if (!Array.isArray(entries)) {
                issues.push({ path: `${field}.${key}`, message: `${field} bucket is not an array.`, fixed: repair });
                if (repair) store[field][key] = [];
            }
        }
        for (const [recipeId, recipe] of Object.entries(store.worldRecipes || {})) {
            const report = validateWorldRecipe(recipe);
            if (recipeId !== recipe?.id || !report.ok) {
                issues.push({ path: `worldRecipes.${recipeId}`, message: report.errors.join("; ") || "World Recipe key does not match its ID.", fixed: repair });
                if (repair) delete store.worldRecipes[recipeId];
            }
        }
        if (!store.worldState || typeof store.worldState !== "object" || Array.isArray(store.worldState)) {
            issues.push({ path: "worldState", message: "World state must be an object.", fixed: repair });
            if (repair) store.worldState = {};
        }
        for (const zone of Object.values(store.worldZones || {})) try { normalizeWorldZone(zone); } catch (error) { issues.push({ path: `worldZones.${zone?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && zone?.id) delete store.worldZones[zone.id]; }
        for (const field of ["worldEntities", "worldResources", "worldRecipePacks", "worldRecipeProfiles", "worldRecipeBreakpoints", "worldRecipePaused", "worldMapVariants", "worldNpcs", "worldRuleLayers", "worldBiomeGraphs", "contentCatalogs"]) if (!store[field] || typeof store[field] !== "object" || Array.isArray(store[field])) { issues.push({ path: field, message: `${field} must be an object.`, fixed: repair }); if (repair) store[field] = {}; }
        for (const field of ["worldSchedules", "worldRecipeTests", "worldPackHistory", "recoverySnapshots"]) if (!Array.isArray(store[field])) { issues.push({ path: field, message: `${field} must be an array.`, fixed: repair }); if (repair) store[field] = []; }
        for (const npc of Object.values(store.worldNpcs || {})) try { normalizeWorldNpc(npc); } catch (error) { issues.push({ path: `worldNpcs.${npc?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && npc?.id) delete store.worldNpcs[npc.id]; }
        for (const layer of Object.values(store.worldRuleLayers || {})) try { normalizeWorldRuleLayer(layer); } catch (error) { issues.push({ path: `worldRuleLayers.${layer?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && layer?.id) delete store.worldRuleLayers[layer.id]; }
        for (const graph of Object.values(store.worldBiomeGraphs || {})) { const report = validateBiomeGraph(graph); if (!report.ok) { issues.push({ path: `worldBiomeGraphs.${graph?.id || "unknown"}`, message: report.errors.join("; "), fixed: repair }); if (repair && graph?.id) delete store.worldBiomeGraphs[graph.id]; } }
        if (!Array.isArray(store.worldClock?.seasons) || !store.worldClock.seasons.length) { issues.push({ path: "worldClock.seasons", message: "World Clock requires at least one season.", fixed: repair }); if (repair) store.worldClock = normalizeWorldClock(store.worldClock); }
        fixes = issues.filter(item => item.fixed).length;
        if (repair) {
            store.version = 18;
            composedCache.clear();
            if (currentPristine && $gameMap && currentPristine.mapId === $gameMap.mapId()) rebuildCurrentMap("repairStore");
            recordOperation("repairStore", { issues: issues.length, fixes });
        }
        return { version: VERSION, ok: issues.length === 0, repaired: repair, issueCount: issues.length, fixes, issues };
    }

    function previewPatchImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Patch pack exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`], maps: [], prefabConflicts: [] };
        }
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPatchPack" || (!pack.maps && !pack.mapOverrides)) {
            return { ok: false, errors: ["Not a HybridTileGraft patch pack."], maps: [], prefabConflicts: [] };
        }
        const store = ensureStore();
        const policy = String(options.conflictPolicy || (toBoolean(options.replace, false) ? "replace" : "merge")).toLowerCase();
        const ids = [...new Set([...Object.keys(pack.maps || {}), ...Object.keys(pack.mapOverrides || {})])]
            .filter(key => /^\d+$/.test(key));
        const errors = [];
        const maps = ids.map(key => {
            const incoming = Array.isArray((pack.maps || {})[key]) ? pack.maps[key] : [];
            const patchIssues = [];
            incoming.forEach((patch, index) => validatePatchRecord(patch, `maps.${key}[${index}]`, patchIssues, false));
            errors.push(...patchIssues.map(item => `${item.path}: ${item.message}`));
            const currentOverride = store.mapOverrides[key];
            const incomingOverride = pack.mapOverrides && pack.mapOverrides[key];
            return {
                mapId: Number(key),
                policy,
                skipped: policy === "skip" && ((store.maps[key] || []).length > 0 || !!currentOverride),
                existingPatches: (store.maps[key] || []).length,
                incomingPatches: incoming.length,
                estimatedTileWrites: incoming.reduce((sum, patch) => sum + patchWriteCount(patch), 0),
                checkpointConflicts: Object.keys(pack.checkpoints && pack.checkpoints[key] || {})
                    .filter(name => !!(store.checkpoints[key] || {})[name]),
                dimensionChange: incomingOverride ? {
                    from: currentOverride ? [currentOverride.width, currentOverride.height] : null,
                    to: [incomingOverride.width, incomingOverride.height]
                } : null
            };
        });
        const prefabConflicts = Object.entries(pack.prefabs || {}).filter(([key]) => !!store.prefabs[key]).map(([key, incoming]) => ({
            key,
            currentVersion: (store.prefabRevisions[key] || {}).revision || 1,
            incomingVersion: incoming.version || incoming.revision || (pack.prefabRevisions && pack.prefabRevisions[key] && pack.prefabRevisions[key].revision) || 1
        }));
        return { ok: errors.length === 0, formatVersion: pack.version || 1, policy, errors, maps, prefabConflicts };
    }

    function importPatchPack(value, options = {}) {
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        const preview = previewPatchImport(pack, options);
        if (toBoolean(options.dryRun, false)) return preview;
        if (!preview.ok || !pack) return false;
        const store = ensureStore();
        const policy = preview.policy;
        const affected = [];
        suppressAutomaticCheckpoint = true;
        try {
            for (const [key, patches] of Object.entries(pack.maps || {})) {
                if (!Array.isArray(patches) || !/^\d+$/.test(key)) continue;
                if (policy === "skip" && ((store.maps[key] || []).length || store.mapOverrides[key])) continue;
                if (options.checkpoint !== false && ((store.maps[key] || []).length || store.mapOverrides[key])) {
                    createCheckpoint(`[Import] ${new Date().toISOString()}`, Number(key));
                }
                store.maps[key] = policy === "replace" ? deepClone(patches) : (store.maps[key] || []).concat(deepClone(patches));
                if (pack.redo && pack.redo[key]) store.redo[key] = deepClone(pack.redo[key]);
                if (pack.eventStates && pack.eventStates[key]) {
                    store.eventStates[key] = Object.assign(store.eventStates[key] || {}, deepClone(pack.eventStates[key]));
                }
                if (pack.checkpoints && pack.checkpoints[key]) {
                    store.checkpoints[key] = Object.assign(store.checkpoints[key] || {}, deepClone(pack.checkpoints[key]));
                }
                affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            for (const [key, override] of Object.entries(pack.mapOverrides || {})) {
                if (!/^\d+$/.test(key)) continue;
                if (policy === "skip" && store.mapOverrides[key]) continue;
                if (policy === "replace" || !store.mapOverrides[key]) store.mapOverrides[key] = deepClone(override);
                else if (policy === "merge") store.mapOverrides[key] = deepClone(override);
                if (!affected.includes(Number(key))) affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            for (const key of [...new Set([
                ...Object.keys(pack.authoringLayers || {}), ...Object.keys(pack.masks || {}),
                ...Object.keys(pack.modifiers || {}), ...Object.keys(pack.prefabInstances || {})
            ])]) {
                if (!/^\d+$/.test(key)) continue;
                if (pack.authoringLayers && pack.authoringLayers[key]) {
                    if (policy === "replace") store.authoringLayers[key] = deepClone(pack.authoringLayers[key]);
                    else {
                        const byId = new Map((store.authoringLayers[key] || []).map(item => [item.id, item]));
                        for (const item of pack.authoringLayers[key]) if (!byId.has(item.id)) byId.set(item.id, deepClone(item));
                        store.authoringLayers[key] = Array.from(byId.values());
                    }
                }
                if (pack.activeAuthoringLayers && pack.activeAuthoringLayers[key]) store.activeAuthoringLayers[key] = pack.activeAuthoringLayers[key];
                if (pack.masks && pack.masks[key]) store.masks[key] = policy === "replace"
                    ? deepClone(pack.masks[key]) : Object.assign(store.masks[key] || {}, deepClone(pack.masks[key]));
                for (const field of ["modifiers", "prefabInstances"]) if (pack[field] && pack[field][key]) {
                    if (policy === "replace") store[field][key] = deepClone(pack[field][key]);
                    else {
                        const byId = new Map((store[field][key] || []).map(item => [item.id, item]));
                        for (const item of pack[field][key]) if (!byId.has(item.id)) byId.set(item.id, deepClone(item));
                        store[field][key] = Array.from(byId.values());
                    }
                }
                if (!affected.includes(Number(key))) affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            if (pack.prefabs) Object.assign(store.prefabs, deepClone(pack.prefabs));
            if (pack.prefabPayloads) Object.assign(store.prefabPayloads, deepClone(pack.prefabPayloads));
            if (pack.prefabRevisions) Object.assign(store.prefabRevisions, deepClone(pack.prefabRevisions));
            if (pack.eventTemplates) Object.assign(store.eventTemplates, deepClone(pack.eventTemplates));
            if (pack.brushPresets) Object.assign(store.brushPresets, deepClone(pack.brushPresets));
            if (pack.changeSets) Object.assign(store.changeSets, deepClone(pack.changeSets));
            if (pack.editorPreferences && toBoolean(options.importEditorPreferences, false)) {
                store.editorPreferences = Object.assign(store.editorPreferences, deepClone(pack.editorPreferences));
            }
        } finally {
            suppressAutomaticCheckpoint = false;
        }
        store.importHistory.unshift({ timestamp: Date.now(), affected: affected.slice(), policy, pluginVersion: pack.pluginVersion || "unknown" });
        store.importHistory = store.importHistory.slice(0, 50);
        if (affected.includes($gameMap.mapId())) rebuildCurrentMap("importPatchPack");
        recordOperation("importPatchPack", { affected, policy });
        return affected;
    }

    function diffMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        return Promise.all([loadPristineMapData(id), preloadMap(id)]).then(([pristine, composed]) => {
            const layers = {};
            const cells = [];
            for (const key of Object.keys(LAYER_INDEX)) layers[key] = 0;
            const width = Math.max(pristine.width, composed.width);
            const height = Math.max(pristine.height, composed.height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const changedLayers = [];
                    for (const [key, z] of Object.entries(LAYER_INDEX)) {
                        const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                        const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                        if (before !== after) {
                            layers[key]++;
                            changedLayers.push({ layer: key, before, after });
                        }
                    }
                    if (changedLayers.length) cells.push({ x, y, changes: changedLayers });
                }
            }
            const baseHybridIds = new Set((pristine.events || []).filter(isHybridEventData).map(event => event.id));
            const currentHybrid = (composed.events || []).filter(isHybridEventData);
            return {
                format: "HybridTileGraftChangeReport",
                version: VERSION,
                mapId: id,
                width: composed.width,
                height: composed.height,
                originalWidth: pristine.width,
                originalHeight: pristine.height,
                dimensionsChanged: pristine.width !== composed.width || pristine.height !== composed.height,
                changedCells: cells.length,
                layerChanges: layers,
                addedSpawnedEvents: currentHybrid.filter(event => !baseHybridIds.has(event.id)).map(event => ({
                    id: event.id, name: event.name, x: event.x, y: event.y
                })),
                removedSpawnedEventIds: Array.from(baseHybridIds).filter(eventId => !currentHybrid.some(event => event.id === eventId)),
                patchCount: getPatches(id).length,
                cells
            };
        });
    }

    async function createChangeSet(name, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const [pristine, composed] = await Promise.all([loadPristineMapData(id), preloadMap(id)]);
        const rect = options.rect ? normalizeRect(options.rect.x, options.rect.y,
            options.rect.w || options.rect.width, options.rect.h || options.rect.height)
            : normalizeRect(0, 0, Math.max(pristine.width, composed.width), Math.max(pristine.height, composed.height));
        const layers = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6").layers;
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            const changes = {};
            for (const layer of layers) {
                const z = LAYER_INDEX[layer];
                const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                if (before !== after) changes[layer] = { before, after };
            }
            if (Object.keys(changes).length) cells.push({ x, y, changes });
        }
        const baseEvents = new Map((pristine.events || []).filter(Boolean).map(event => [event.id, event]));
        const currentEvents = new Map((composed.events || []).filter(Boolean).map(event => [event.id, event]));
        const eventIds = new Set([...baseEvents.keys(), ...currentEvents.keys()]);
        const events = [];
        for (const eventId of eventIds) {
            const before = baseEvents.get(eventId) || null;
            const after = currentEvents.get(eventId) || null;
            if (JSON.stringify(before) !== JSON.stringify(after)) events.push({ eventId, before: deepClone(before), after: deepClone(after) });
        }
        const changeSet = {
            format: "HybridTileGraftChangeSet",
            version: 1,
            id: String(options.id || `changeset-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(name || `Map ${id} Changes`),
            mapId: id,
            createdAt: Date.now(),
            pluginVersion: VERSION,
            rect,
            layers,
            cells,
            events,
            dimensions: {
                before: [pristine.width, pristine.height],
                after: [composed.width, composed.height]
            },
            author: String(options.author || ""),
            description: String(options.description || ""),
            tags: normalizeList(options.tags).map(String),
            sourceOperationRange: deepClone(options.sourceOperationRange || null)
        };
        ensureStore().changeSets[changeSet.id] = changeSet;
        recordOperation("createChangeSet", { mapId: id, changeSetId: changeSet.id, cells: cells.length, events: events.length });
        return deepClone(changeSet);
    }

    function listChangeSets(mapId = 0) {
        const id = integer(mapId, 0);
        return Object.values(ensureStore().changeSets || {}).filter(item => !id || item.mapId === id)
            .sort((a, b) => b.createdAt - a.createdAt).map(item => Object.assign(deepClone(item), {
                cellCount: (item.cells || []).length,
                eventCount: (item.events || []).length
            }));
    }

    function exportChangeSet(changeSetId) {
        const item = ensureStore().changeSets[String(changeSetId)];
        return item ? deepClone(item) : false;
    }

    function importChangeSet(value) {
        const item = typeof value === "string" ? parseJson(value, null) : value;
        if (!item || item.format !== "HybridTileGraftChangeSet" || !Array.isArray(item.cells)) return false;
        const clone = deepClone(item);
        clone.id = String(clone.id || `changeset-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
        ensureStore().changeSets[clone.id] = clone;
        return deepClone(clone);
    }

    function deleteChangeSet(changeSetId) {
        const key = String(changeSetId);
        if (!ensureStore().changeSets[key]) return false;
        delete ensureStore().changeSets[key];
        return true;
    }

    async function applyChangeSet(changeSetOrId, targetMapId = 0, options = {}) {
        const changeSet = typeof changeSetOrId === "object" ? changeSetOrId : ensureStore().changeSets[String(changeSetOrId)];
        if (!changeSet) return false;
        const mapId = integer(targetMapId, 0) || changeSet.mapId || $gameMap.mapId();
        await preloadMap(mapId);
        const selectedCells = options.cellIndices ? new Set(normalizeList(options.cellIndices).map(Number)) : null;
        const direction = String(options.direction || "after").toLowerCase();
        const cells = [];
        for (let index = 0; index < (changeSet.cells || []).length; index++) {
            if (selectedCells && !selectedCells.has(index)) continue;
            const source = changeSet.cells[index];
            const tiles = {};
            for (const [layer, values] of Object.entries(source.changes || {})) tiles[layer] = direction === "before" ? values.before : values.after;
            if (Object.keys(tiles).length) cells.push({ x: source.x + integer(options.offsetX), y: source.y + integer(options.offsetY), tiles });
        }
        const eventChanges = options.includeEvents === false ? [] : changeSet.events || [];
        const events = [];
        const removeEventIds = [];
        for (const change of eventChanges) {
            const event = deepClone(direction === "before" ? change.before : change.after);
            if (event) {
                event.x += integer(options.offsetX);
                event.y += integer(options.offsetY);
                events.push(event);
            } else removeEventIds.push(change.eventId);
        }
        const tilePatch = cells.length ? makeSparsePatch(cells, options.mode || "exact", options.mode === "autotile" ? cells : null) : null;
        const eventPatch = eventChanges.length ? makeEventPatch(events, removeEventIds, `Change Set: ${changeSet.name}`) : null;
        const patch = tilePatch && eventPatch ? makeBatchPatch([tilePatch, eventPatch], `Change Set: ${changeSet.name}`) : tilePatch || eventPatch;
        if (!patch) return false;
        patch.changeSetId = changeSet.id;
        return applyPatchToMap(mapId, patch, "applyChangeSet");
    }

    function threeWayMergeSnapshots(base, ours, theirs, options = {}) {
        if (!base || !ours || !theirs) return { ok: false, errors: ["Three snapshots are required."], conflicts: [] };
        const width = Math.max(base.width, ours.width, theirs.width);
        const height = Math.max(base.height, ours.height, theirs.height);
        const merged = {
            width,
            height,
            tilesetId: options.tilesetId || ours.tilesetId || theirs.tilesetId || base.tilesetId,
            note: options.note === undefined ? ours.note || theirs.note || base.note || "" : String(options.note),
            data: new Array(width * height * 6).fill(0),
            events: []
        };
        const conflicts = [];
        const resolution = String(options.resolution || "ours").toLowerCase();
        for (let z = 0; z < 6; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const baseValue = readTile(base.data, base.width, base.height, x, y, z);
            const ourValue = readTile(ours.data, ours.width, ours.height, x, y, z);
            const theirValue = readTile(theirs.data, theirs.width, theirs.height, x, y, z);
            let value;
            if (ourValue === theirValue) value = ourValue;
            else if (ourValue === baseValue) value = theirValue;
            else if (theirValue === baseValue) value = ourValue;
            else {
                conflicts.push({ type: "tile", x, y, layer: `L${z + 1}`, base: baseValue, ours: ourValue, theirs: theirValue });
                value = resolution === "theirs" ? theirValue : resolution === "base" ? baseValue : ourValue;
            }
            writeTile(merged.data, width, height, x, y, z, value);
        }
        const eventMaps = [base, ours, theirs].map(snapshot => new Map((snapshot.events || []).filter(Boolean).map(event => [event.id, event])));
        const ids = new Set([...eventMaps[0].keys(), ...eventMaps[1].keys(), ...eventMaps[2].keys()]);
        for (const id of ids) {
            const [baseEvent, ourEvent, theirEvent] = eventMaps.map(map => map.get(id) || null);
            const [baseJson, ourJson, theirJson] = [baseEvent, ourEvent, theirEvent].map(value => JSON.stringify(value));
            let event;
            if (ourJson === theirJson) event = ourEvent;
            else if (ourJson === baseJson) event = theirEvent;
            else if (theirJson === baseJson) event = ourEvent;
            else {
                conflicts.push({ type: "event", eventId: id, base: deepClone(baseEvent), ours: deepClone(ourEvent), theirs: deepClone(theirEvent) });
                event = resolution === "theirs" ? theirEvent : resolution === "base" ? baseEvent : ourEvent;
            }
            if (event) merged.events[event.id] = deepClone(event);
        }
        return { ok: true, merged, conflicts, conflictCount: conflicts.length, resolution };
    }

    function resolveMergeConflicts(mergeResult, resolutions = {}) {
        if (!mergeResult || !mergeResult.merged) return false;
        const output = deepClone(mergeResult);
        for (let index = 0; index < (output.conflicts || []).length; index++) {
            const conflict = output.conflicts[index];
            const choice = resolutions[index] || resolutions[`${conflict.type}:${conflict.x ?? conflict.eventId}:${conflict.y ?? ""}:${conflict.layer || ""}`];
            if (!choice) continue;
            const value = conflict[choice];
            if (conflict.type === "tile") writeTile(output.merged.data, output.merged.width, output.merged.height,
                conflict.x, conflict.y, LAYER_INDEX[conflict.layer], value);
            else if (conflict.type === "event") {
                if (value) output.merged.events[conflict.eventId] = deepClone(value);
                else output.merged.events[conflict.eventId] = null;
            }
            conflict.resolved = choice;
        }
        output.unresolvedConflicts = output.conflicts.filter(conflict => !conflict.resolved).length;
        return output;
    }

    function applyMergeResult(mapId, mergeResult, options = {}) {
        if (!mergeResult || !mergeResult.merged) return false;
        const id = integer(mapId);
        const snapshot = deepClone(mergeResult.merged);
        snapshot._hybridTransform = { createdAt: Date.now(), sourceWidth: snapshot.width,
            sourceHeight: snapshot.height, configuration: { merge: true } };
        const result = saveMapOverride(id, snapshot, Object.assign({ checkpointName: `[Merge] ${new Date().toISOString()}` }, options));
        ensureStore().mergeHistory.unshift({ mapId: id, timestamp: Date.now(), conflicts: mergeResult.conflictCount || 0,
            unresolved: mergeResult.unresolvedConflicts || 0, resolution: mergeResult.resolution || "mixed" });
        ensureStore().mergeHistory = ensureStore().mergeHistory.slice(0, 100);
        return result;
    }

    async function searchProject(options = {}) {
        const mapIds = normalizeList(options.mapIds).map(Number).filter(Boolean);
        const ids = mapIds.length ? mapIds : (typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos.filter(Boolean).map(info => info.id) : [$gameMap.mapId()]);
        const tileIds = new Set(normalizeList(options.tileIds).map(parseTileId).filter(value => value !== null));
        const query = String(options.query || "").toLowerCase();
        const commandCodes = new Set(normalizeList(options.commandCodes).map(Number));
        const switchIds = new Set(normalizeList(options.switchIds).map(Number));
        const variableIds = new Set(normalizeList(options.variableIds).map(Number));
        const results = [];
        for (const mapId of ids) {
            const map = await preloadMap(mapId);
            const info = typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos[mapId] : null;
            const mapResult = { mapId, name: info ? info.name || `Map ${mapId}` : `Map ${mapId}`, tiles: [], events: [] };
            if (tileIds.size) for (let z = 0; z < 6; z++) for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
                const tileId = readTile(map.data, map.width, map.height, x, y, z);
                if (tileIds.has(tileId)) mapResult.tiles.push({ x, y, layer: `L${z + 1}`, tileId });
            }
            for (const event of map.events || []) {
                if (!event) continue;
                const text = `${event.name || ""}\n${event.note || ""}\n${JSON.stringify(event.pages || [])}`.toLowerCase();
                const commands = (event.pages || []).flatMap(page => page.list || []);
                const commandMatch = commandCodes.size && commands.some(command => commandCodes.has(command.code));
                const switchMatch = switchIds.size && commands.some(command => JSON.stringify(command.parameters || []).match(/\d+/g)?.some(value => switchIds.has(Number(value))));
                const variableMatch = variableIds.size && commands.some(command => [111, 122].includes(command.code) && JSON.stringify(command.parameters || []).match(/\d+/g)?.some(value => variableIds.has(Number(value))));
                if ((query && text.includes(query)) || commandMatch || switchMatch || variableMatch) {
                    mapResult.events.push({ id: event.id, name: event.name || "", x: event.x, y: event.y,
                        spawned: isHybridEventData(event), commandCodes: [...new Set(commands.map(command => command.code))] });
                }
            }
            if (mapResult.tiles.length || mapResult.events.length) results.push(mapResult);
        }
        return { query: deepClone(options), mapCount: ids.length, matchedMaps: results.length,
            tileMatches: results.reduce((sum, item) => sum + item.tiles.length, 0),
            eventMatches: results.reduce((sum, item) => sum + item.events.length, 0), results };
    }

    async function replaceProjectTiles(replacements, options = {}) {
        const mapping = new Map(Object.entries(replacements || {}).map(([from, to]) => [parseTileId(from), parseTileId(to)]).filter(([from, to]) => from !== null && to !== null));
        if (!mapping.size) return { ok: false, maps: [], writes: 0 };
        const ids = normalizeList(options.mapIds).map(Number).filter(Boolean);
        const mapIds = ids.length ? ids : $dataMapInfos.filter(Boolean).map(info => info.id);
        const results = [];
        let writes = 0;
        for (const mapId of mapIds) {
            const map = await preloadMap(mapId);
            const cells = [];
            for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
                const tiles = {};
                for (let z = 0; z < 4; z++) {
                    const current = readTile(map.data, map.width, map.height, x, y, z);
                    if (mapping.has(current)) tiles[`L${z + 1}`] = mapping.get(current);
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
            if (!cells.length) continue;
            const patch = makeSparsePatch(cells, options.mode || "autotile", options.mode === "exact" ? null : cells);
            patch.label = String(options.label || "Project Tile Replacement");
            applyPatchToMap(mapId, patch, "replaceProjectTiles");
            writes += patchWriteCount(patch);
            results.push({ mapId, writes: patchWriteCount(patch) });
        }
        return { ok: true, maps: results, writes };
    }

    function validateMapSnapshot(snapshot, mapId = 0) {
        const issues = [];
        if (!snapshot || !positiveInteger(snapshot.width, 0) || !positiveInteger(snapshot.height, 0)) issues.push("Invalid dimensions.");
        const expected = snapshot ? integer(snapshot.width) * integer(snapshot.height) * 6 : 0;
        if (!snapshot || !Array.isArray(snapshot.data) || snapshot.data.length !== expected) issues.push(`Tile data length must be ${expected}.`);
        const ids = new Set();
        for (const event of snapshot && snapshot.events || []) if (event) {
            if (ids.has(event.id)) issues.push(`Duplicate event ID ${event.id}.`);
            ids.add(event.id);
            if (!inBounds(event.x, event.y, snapshot.width, snapshot.height)) issues.push(`Event ${event.id} is outside map bounds.`);
            if (!Array.isArray(event.pages)) issues.push(`Event ${event.id} has no page array.`);
        }
        return { ok: issues.length === 0, mapId: integer(mapId), width: snapshot && snapshot.width,
            height: snapshot && snapshot.height, eventCount: ids.size, issues };
    }

    async function validateProjectMaps(mapIds = null, options = {}) {
        const ids = mapIds ? normalizeList(mapIds).map(Number).filter(Boolean)
            : $dataMapInfos.filter(Boolean).map(info => info.id);
        const reports = [];
        for (const mapId of ids) {
            try { reports.push(validateMapSnapshot(await preloadMap(mapId, options.forceRefresh), mapId)); }
            catch (error) { reports.push({ ok: false, mapId, issues: [error.message] }); }
        }
        return { ok: reports.every(report => report.ok), checked: reports.length,
            issueCount: reports.reduce((sum, report) => sum + report.issues.length, 0), reports };
    }

    function createProjectSnapshot(name, options = {}) {
        const snapshot = {
            id: String(options.id || `snapshot-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(name || "Project Snapshot"),
            createdAt: Date.now(),
            bundle: exportWorkspaceBundle(options)
        };
        const size = JSON.stringify(snapshot.bundle).length * 2;
        if (size > MAX_IMPORT_BYTES) return false;
        ensureStore().projectSnapshots.unshift(snapshot);
        ensureStore().projectSnapshots = ensureStore().projectSnapshots.slice(0, Math.max(1, integer(options.retain, 5)));
        return { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, estimatedBytes: size };
    }

    function listProjectSnapshots() {
        return (ensureStore().projectSnapshots || []).map(snapshot => ({ id: snapshot.id, name: snapshot.name,
            createdAt: snapshot.createdAt, estimatedBytes: JSON.stringify(snapshot.bundle || {}).length * 2 }));
    }

    function restoreProjectSnapshot(snapshotId, options = {}) {
        const snapshot = (ensureStore().projectSnapshots || []).find(item => item.id === String(snapshotId));
        return snapshot ? importWorkspaceBundle(snapshot.bundle, Object.assign({ conflictPolicy: "replace", checkpoint: true }, options)) : false;
    }

    function deleteProjectSnapshot(snapshotId) {
        const store = ensureStore();
        const before = store.projectSnapshots.length;
        store.projectSnapshots = store.projectSnapshots.filter(item => item.id !== String(snapshotId));
        return store.projectSnapshots.length !== before;
    }

    function projectAuditReport() {
        const store = ensureStore();
        return {
            pluginVersion: VERSION,
            generatedAt: new Date().toISOString(),
            validation: validateStore({ repair: false }),
            operations: operationLog(OPERATION_LOG_LIMIT),
            imports: deepClone(store.importHistory || []),
            merges: deepClone(store.mergeHistory || []),
            errors: errorReports(ERROR_REPORT_LIMIT),
            authoringLayers: deepClone(store.authoringLayers || {}),
            modifiers: deepClone(store.modifiers || {}),
            prefabInstances: deepClone(store.prefabInstances || {}),
            changeSets: Object.values(store.changeSets || {}).map(item => ({ id: item.id, name: item.name, mapId: item.mapId,
                createdAt: item.createdAt, cells: (item.cells || []).length, events: (item.events || []).length }))
        };
    }

    function fuzzValidate(iterations = 250, seed = "HybridTileGraft", options = {}) {
        const random = seededRandom(seed);
        const failures = [];
        const count = Math.max(1, Math.min(10000, integer(iterations, 250)));
        for (let index = 0; index < count; index++) {
            const width = 1 + Math.floor(random() * 20);
            const height = 1 + Math.floor(random() * 20);
            const kind = Math.floor(random() * 4);
            let patch;
            if (kind === 0) patch = makeSparsePatch([{ x: Math.floor(random() * width), y: Math.floor(random() * height),
                tiles: { L1: Math.floor(random() * 8192) } }], "exact");
            else if (kind === 1) patch = makeRectPatch({ x: 0, y: 0, w: width, h: height }, ["L1"],
                { L1: new Array(width * height).fill(Math.floor(random() * 8192)) }, "exact");
            else if (kind === 2) patch = { kind: "rect", x: 0, y: 0, w: width, h: height, layers: ["L1"], tiles: { L1: [] } };
            else patch = { kind: "unknown", value: random() };
            const issues = [];
            try { validatePatchRecord(deepClone(patch), `fuzz[${index}]`, issues, toBoolean(options.repair, false)); }
            catch (error) { failures.push({ index, message: error.message, patch }); }
        }
        const result = { ok: failures.length === 0, iterations: count, seed, failures };
        recordOperation("fuzzValidate", { iterations: count, failures: failures.length });
        return result;
    }

    function estimateStoreBytes() {
        const store = ensureStore();
        const text = JSON.stringify(store);
        return {
            estimatedBytes: text.length * 2,
            maps: Object.fromEntries(Object.entries(store.maps || {}).map(([key, patches]) =>
                [key, JSON.stringify(patches).length * 2])),
            snapshots: JSON.stringify(store.projectSnapshots || []).length * 2,
            operationLog: JSON.stringify(store.operationLog || []).length * 2,
            errors: JSON.stringify(store.errorReports || []).length * 2
        };
    }

    function pruneProjectData(options = {}) {
        const store = ensureStore();
        const before = estimateStoreBytes();
        store.operationLog = (store.operationLog || []).slice(-Math.max(20,
            integer(options.operationLimit ?? options.operationLog, OPERATION_LOG_LIMIT)));
        store.errorReports = (store.errorReports || []).slice(0, Math.max(10,
            integer(options.errorLimit ?? options.errors, ERROR_REPORT_LIMIT)));
        store.importHistory = (store.importHistory || []).slice(0, Math.max(5,
            integer(options.importLimit ?? options.imports, 50)));
        store.mergeHistory = (store.mergeHistory || []).slice(0, Math.max(5,
            integer(options.mergeLimit ?? options.merges, 50)));
        store.projectSnapshots = (store.projectSnapshots || []).slice(0, Math.max(0,
            integer(options.snapshotLimit ?? options.snapshots, 5)));
        for (const [key, bucket] of Object.entries(store.checkpoints || {})) {
            const automatic = Object.values(bucket).filter(item => item.automatic).sort((a, b) => b.createdAt - a.createdAt);
            for (const item of automatic.slice(Math.max(1, integer(options.autoCheckpointLimit, MAX_AUTO_CHECKPOINTS)))) delete store.checkpoints[key][item.name];
        }
        const after = estimateStoreBytes();
        return { before, after, freedBytes: Math.max(0, before.estimatedBytes - after.estimatedBytes) };
    }

    function runCompatibilitySelfTest(options = {}) {
        const store = ensureStore();
        const results = {};
        for (const profile of listAdapterProfiles()) {
            const paths = [];
            for (const path of profile.paths || []) {
                const target = resolveGlobalPath(path);
                if (!target) continue;
                paths.push({ path, methods: (profile.methods || []).filter(method => typeof target[method] === "function") });
            }
            results[profile.name] = { detected: paths.length > 0, active: profile.active, paths,
                ready: paths.some(item => item.methods.length > 0) };
        }
        const report = { timestamp: Date.now(), pluginVersion: VERSION, profiles: results,
            customAdapters: Array.from(compatibilityAdapters.keys()), executeRefresh: toBoolean(options.executeRefresh, false) };
        if (report.executeRefresh) runCompatibilityRefresh({ operation: "compatibilitySelfTest", mapId: $gameMap.mapId() });
        store.adapterTestResults = report;
        return deepClone(report);
    }

    function systemHealthReport() {
        const storeValidation = validateStore({ repair: false });
        const currentMap = typeof $dataMap !== "undefined" && $dataMap ? validateMapSnapshot($dataMap, $gameMap.mapId()) : null;
        const memory = estimateStoreBytes();
        const jobs = listOperationJobs({ includeFinished: false });
        const errors = errorReports(20);
        const warnings = [];
        if (!storeValidation.ok) warnings.push(`${storeValidation.issueCount} store issue(s).`);
        if (currentMap && !currentMap.ok) warnings.push(`${currentMap.issues.length} current-map issue(s).`);
        if (memory.estimatedBytes > 25 * 1024 * 1024) warnings.push("Save data is larger than 25 MiB.");
        if (errors.length) warnings.push(`${errors.length} recent captured error(s).`);
        return {
            ok: warnings.length === 0,
            pluginVersion: VERSION,
            generatedAt: new Date().toISOString(),
            warnings,
            storeValidation,
            currentMap,
            memory,
            jobs,
            errors,
            compatibility: compatibilityDiagnostics(),
            performance: performanceDiagnostics(),
            worldRecipes: worldRecipeDiagnostics({ logLimit: 10 }),
            worldstudio: {
                atlases: listWorldAtlases().slice(0, 5),
                eventQuestGraphs: listEventQuestGraphs().slice(0, 5),
                extensions: listExtensionManifests(),
                validations: listProductionValidations().slice(0, 5),
                deployments: listProjectDeploymentReports().slice(0, 5)
            },
            bridge: workspaceBridgeState()
        };
    }

    function downloadJson(filename, value) {
        const text = JSON.stringify(value, null, 2);
        if (typeof document !== "undefined" && typeof document.createElement === "function" &&
            typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            const blob = new Blob([text], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = String(filename || "HybridTileGraft.json");
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return true;
        }
        return false;
    }

    function exportWorkspaceBundle(options = {}) {
        const mapIds = Array.isArray(options.mapIds) ? options.mapIds : null;
        const store = ensureStore();
        return {
            format: "HybridTileGraftWorkspace",
            version: 1,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            project: {
                title: typeof $dataSystem !== "undefined" && $dataSystem ? $dataSystem.gameTitle || "" : "",
                maps: (typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos : [])
                    .filter(Boolean).map(info => ({ id: info.id, name: info.name, parentId: info.parentId || 0 }))
            },
            patchPack: exportPatchPack(mapIds),
            prefabPack: exportPrefabPack(options.prefabNames || null),
            eventTemplatePack: exportEventTemplatePack(options.eventTemplateNames || null),
            worldRecipePack: exportWorldRecipePack(options.worldRecipeIds || null),
            worldDirector: {
                clock: worldClock(), facts: deepClone(store.worldFacts || {}), zones: listWorldZones(),
                entities: listWorldEntities(), resources: listWorldResources(), schedules: listWorldSchedules(),
                variants: listWorldMapVariants(), packs: listWorldPacks(), packLock: worldPackLockfile(),
                npcs: listWorldNpcs(), npcRoutes: listWorldNpcRoutes(), ruleLayers: listWorldRuleLayers(), ruleBrushes: listWorldRuleBrushes(), biomeGraphs: listBiomeGraphs(),
                atlases: Object.values(store.worldAtlases || {}).map(deepClone), eventQuestGraphs: Object.values(store.eventQuestGraphs || {}).map(deepClone),
                extensions: listExtensionManifests(), packRepositories: listPackRepositories(), visualHistory: listVisualHistory(),
                validationRuns: listProductionValidations(), deploymentReports: listProjectDeploymentReports(), runtimeBudget: runtimeBudget(), tests: deepClone(store.worldRecipeTests || [])
            },
            bookmarks: deepClone(store.mapBookmarks || []),
            adapterProfiles: deepClone(store.activeAdapterProfiles || []),
            diagnostics: {
                validation: validateStore({ repair: false }),
                performance: performanceDiagnostics(),
                compatibility: compatibilityDiagnostics()
            }
        };
    }

    function previewWorkspaceImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Workspace exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`] };
        }
        const bundle = typeof value === "string" ? parseJson(value, null) : value;
        if (!bundle || bundle.format !== "HybridTileGraftWorkspace" || !bundle.patchPack) {
            return { ok: false, errors: ["Not a HybridTileGraft workspace bundle."] };
        }
        const patchPreview = previewPatchImport(bundle.patchPack, Object.assign({}, options, { dryRun: true }));
        const prefabPreview = bundle.prefabPack ? previewPrefabImport(bundle.prefabPack, options) : { ok: true, entries: [] };
        return {
            ok: patchPreview.ok && prefabPreview.ok,
            pluginVersion: bundle.pluginVersion || "unknown",
            patchPreview,
            prefabPreview,
            eventTemplates: Object.keys(bundle.eventTemplatePack && bundle.eventTemplatePack.templates || {}).length,
            worldRecipes: bundle.worldRecipePack?.recipes?.length || 0,
            worldZones: bundle.worldDirector?.zones?.length || 0,
            worldResources: bundle.worldDirector?.resources?.length || 0,
            worldNpcs: bundle.worldDirector?.npcs?.length || 0,
            worldRuleLayers: bundle.worldDirector?.ruleLayers?.length || 0,
            biomeGraphs: bundle.worldDirector?.biomeGraphs?.length || 0,
            bookmarks: Array.isArray(bundle.bookmarks) ? bundle.bookmarks.length : 0
        };
    }

    function importWorkspaceBundle(value, options = {}) {
        const bundle = typeof value === "string" ? parseJson(value, null) : value;
        const preview = previewWorkspaceImport(bundle, options);
        if (toBoolean(options.dryRun, false)) return preview;
        if (!preview.ok || !bundle) return false;
        const affectedMaps = importPatchPack(bundle.patchPack, options);
        const importedPrefabs = bundle.prefabPack ? importPrefabPack(bundle.prefabPack, options) : [];
        const importedTemplates = bundle.eventTemplatePack ? importEventTemplatePack(bundle.eventTemplatePack, options) : [];
        const importedWorldRecipes = bundle.worldRecipePack ? importWorldRecipePack(bundle.worldRecipePack, options) : { imported: 0 };
        if (bundle.worldDirector) {
            if (bundle.worldDirector.clock) setWorldClock(bundle.worldDirector.clock);
            for (const zone of normalizeList(bundle.worldDirector.zones)) defineWorldZone(zone);
            for (const entity of normalizeList(bundle.worldDirector.entities)) defineWorldEntity(entity);
            for (const resource of normalizeList(bundle.worldDirector.resources)) defineWorldResource(resource);
            for (const variant of normalizeList(bundle.worldDirector.variants)) defineWorldMapVariant(variant);
            for (const npc of normalizeList(bundle.worldDirector.npcs)) defineWorldNpc(npc);
            for (const route of normalizeList(bundle.worldDirector.npcRoutes)) defineWorldNpcRoute(route);
            for (const layer of normalizeList(bundle.worldDirector.ruleLayers)) defineWorldRuleLayer(layer);
            for (const brush of normalizeList(bundle.worldDirector.ruleBrushes)) saveWorldRuleBrush(brush);
            for (const graph of normalizeList(bundle.worldDirector.biomeGraphs)) defineBiomeGraph(graph);
            for (const atlas of normalizeList(bundle.worldDirector.atlases)) if (atlas?.id) ensureStore().worldAtlases[String(atlas.id)] = deepClone(atlas);
            for (const graph of normalizeList(bundle.worldDirector.eventQuestGraphs)) if (graph?.id) ensureStore().eventQuestGraphs[String(graph.id)] = deepClone(graph);
            for (const manifest of normalizeList(bundle.worldDirector.extensions)) installExtensionManifest(manifest, { enabled: manifest.enabled !== false, permissions: manifest.grantedPermissions || [] });
            for (const repository of normalizeList(bundle.worldDirector.packRepositories)) registerPackRepository(repository);
            if (bundle.worldDirector.runtimeBudget) runtimeBudget(bundle.worldDirector.runtimeBudget);
            if (bundle.worldDirector.packLock && toBoolean(options.importPackLock, false)) ensureStore().worldPackLock = deepClone(bundle.worldDirector.packLock);
            if (Array.isArray(bundle.worldDirector.tests)) ensureStore().worldRecipeTests = deepClone(bundle.worldDirector.tests);
            if (toBoolean(options.importWorldFacts, false)) ensureStore().worldFacts = deepClone(bundle.worldDirector.facts || {});
        }
        if (toBoolean(options.importBookmarks, true) && Array.isArray(bundle.bookmarks)) {
            const existing = new Set((ensureStore().mapBookmarks || []).map(item => `${item.mapId}:${item.x}:${item.y}:${item.name}`));
            for (const bookmark of bundle.bookmarks) {
                const key = `${integer(bookmark.mapId)}:${integer(bookmark.x)}:${integer(bookmark.y)}:${String(bookmark.name || "Bookmark")}`;
                if (!existing.has(key)) ensureStore().mapBookmarks.push(deepClone(bookmark));
            }
        }
        if (toBoolean(options.importAdapterProfiles, false) && Array.isArray(bundle.adapterProfiles)) {
            ensureStore().activeAdapterProfiles = bundle.adapterProfiles.filter(name => adapterProfiles.has(String(name)));
        }
        const result = { affectedMaps, importedPrefabs, importedTemplates, importedWorldRecipes: importedWorldRecipes.imported || 0 };
        recordOperation("importWorkspace", result);
        return result;
    }

    function workspaceBridgeState() {
        if (!workspaceBridge) return { active: false };
        return {
            active: true,
            directory: workspaceBridge.directory,
            outgoingFile: workspaceBridge.outgoingFile,
            incomingFile: workspaceBridge.incomingFile,
            intervalMs: workspaceBridge.intervalMs,
            lastExportAt: workspaceBridge.lastExportAt || 0,
            lastImportAt: workspaceBridge.lastImportAt || 0,
            lastError: workspaceBridge.lastError || ""
        };
    }

    function writeWorkspaceBridgeSnapshot() {
        if (!workspaceBridge) return false;
        try {
            const fs = workspaceBridge.fs;
            const temporary = `${workspaceBridge.outgoingFile}.tmp`;
            fs.writeFileSync(temporary, JSON.stringify(exportWorkspaceBundle(), null, 2), "utf8");
            fs.renameSync(temporary, workspaceBridge.outgoingFile);
            workspaceBridge.lastExportAt = Date.now();
            workspaceBridge.lastError = "";
            return true;
        } catch (error) {
            workspaceBridge.lastError = String(error && error.message || error);
            return false;
        }
    }

    function pollWorkspaceBridge() {
        if (!workspaceBridge) return false;
        try {
            const fs = workspaceBridge.fs;
            if (!fs.existsSync(workspaceBridge.incomingFile)) return false;
            const stat = fs.statSync(workspaceBridge.incomingFile);
            if (!stat.isFile() || stat.size <= 0 || stat.size > 20 * 1024 * 1024 || stat.mtimeMs <= workspaceBridge.lastIncomingMtime) return false;
            const text = fs.readFileSync(workspaceBridge.incomingFile, "utf8");
            const value = parseJson(text, null);
            const imported = value && value.format === "HybridTileGraftWorkspace"
                ? importWorkspaceBundle(value, workspaceBridge.importOptions)
                : value && value.format === "HybridWorldRecipes"
                    ? (loadWorldRecipeCatalog(value), true)
                    : value && value.format === "HybridWorldPack"
                        ? installWorldPack(value, workspaceBridge.importOptions)
                        : importPatchPack(value, workspaceBridge.importOptions);
            if (!imported) throw new Error("Incoming bridge file did not pass validation.");
            workspaceBridge.lastIncomingMtime = stat.mtimeMs;
            workspaceBridge.lastImportAt = Date.now();
            workspaceBridge.lastError = "";
            writeWorkspaceBridgeSnapshot();
            return true;
        } catch (error) {
            if (workspaceBridge) workspaceBridge.lastError = String(error && error.message || error);
            return false;
        }
    }

    function startWorkspaceBridge(directory, options = {}) {
        stopWorkspaceBridge();
        if (typeof require !== "function") return false;
        try {
            const fs = require("fs");
            const path = require("path");
            const target = path.resolve(String(directory || "."));
            if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
            if (!fs.statSync(target).isDirectory()) return false;
            const intervalMs = Math.max(500, integer(options.intervalMs, 2000));
            workspaceBridge = {
                fs,
                directory: target,
                outgoingFile: path.join(target, String(options.outgoingName || "HybridTileGraft.workspace.json")),
                incomingFile: path.join(target, String(options.incomingName || "HybridTileGraft.incoming.json")),
                intervalMs,
                importOptions: Object.assign({ conflictPolicy: "merge", checkpoint: true }, options.importOptions || {}),
                lastIncomingMtime: 0,
                lastExportAt: 0,
                lastImportAt: 0,
                lastError: "",
                timer: null
            };
            writeWorkspaceBridgeSnapshot();
            workspaceBridge.timer = setInterval(pollWorkspaceBridge, intervalMs);
            recordOperation("startWorkspaceBridge", { directory: target, intervalMs });
            return workspaceBridgeState();
        } catch (error) {
            workspaceBridge = null;
            console.warn(`${PLUGIN_NAME}: workspace bridge could not start.`, error);
            return false;
        }
    }

    function stopWorkspaceBridge() {
        if (!workspaceBridge) return false;
        if (workspaceBridge.timer) clearInterval(workspaceBridge.timer);
        const directory = workspaceBridge.directory;
        workspaceBridge = null;
        recordOperation("stopWorkspaceBridge", { directory });
        return true;
    }

    function loadRawMapJson(mapId) {
        const id = positiveInteger(mapId);
        const cached = pristineCache.get(id);
        if (cached && cached.raw) return Promise.resolve(deepClone(cached.raw));
        return new Promise((resolve, reject) => {
            const url = `data/Map${String(id).padStart(3, "0")}.json`;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.overrideMimeType("application/json");
            xhr.onload = () => {
                if (xhr.status >= 400) return reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (error) { reject(new Error(`${PLUGIN_NAME}: invalid JSON in ${url}: ${error.message}`)); }
            };
            xhr.onerror = () => reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
            xhr.send();
        });
    }

    function makeBakedEventList(events) {
        const output = [null];
        const spawned = [];
        let nextId = 0;
        for (const source of events || []) {
            if (!source) continue;
            if (isHybridEventData(source)) {
                spawned.push(source);
                continue;
            }
            const event = deepClone(source);
            const id = Math.max(1, integer(event.id, output.length));
            event.id = id;
            output[id] = event;
            nextId = Math.max(nextId, id);
        }
        const idMap = {};
        for (const source of spawned) {
            const event = deepClone(source);
            const oldId = integer(event.id, 0);
            const id = ++nextId;
            event.id = id;
            delete event._hybridSpawnId;
            delete event._hybridTileGraftSpawn;
            output[id] = event;
            if (oldId > 0) idMap[oldId] = id;
        }
        repairEventReferences(output, idMap);
        return { events: output, idMap };
    }

    function repairEventReferences(events, idMap) {
        const remap = value => Object.prototype.hasOwnProperty.call(idMap, integer(value))
            ? idMap[integer(value)] : value;
        for (const event of events || []) {
            if (!event || !Array.isArray(event.pages)) continue;
            for (const page of event.pages) {
                if (!page || !Array.isArray(page.list)) continue;
                for (const command of page.list) {
                    if (!command || !Array.isArray(command.parameters)) continue;
                    if (command.code === 111 && command.parameters[0] === 6) command.parameters[1] = remap(command.parameters[1]);
                    else if ([203, 205, 212, 213].includes(command.code)) command.parameters[0] = remap(command.parameters[0]);
                }
            }
        }
        return events;
    }

    function bakeMapToFile(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        if (typeof Utils !== "undefined" && Utils.isOptionValid && !Utils.isOptionValid("test") && !toBoolean(options.allowDeployed, false)) {
            return Promise.reject(new Error(`${PLUGIN_NAME}: map baking is restricted to playtest unless allowDeployed is true.`));
        }
        return Promise.all([loadRawMapJson(id), loadPristineMapData(id), preloadMap(id)]).then(([raw, pristine, composed]) => {
            raw.width = composed.width;
            raw.height = composed.height;
            raw.data = composed.data.slice();
            raw.tilesetId = composed.tilesetId;
            raw.note = composed.note || raw.note || "";
            raw.events = deepClone(composed.events || []);
            let bakedEventIds = {};
            if (options.makeEventsPermanent !== false) {
                const bakedEvents = makeBakedEventList(raw.events);
                raw.events = bakedEvents.events;
                bakedEventIds = bakedEvents.idMap;
            }
            const fileName = `Map${String(id).padStart(3, "0")}.json`;
            if (typeof require !== "function" || typeof process === "undefined") {
                const downloaded = downloadJson(fileName, raw);
                return { mapId: id, downloaded, fileName, backup: null, bakedEventIds };
            }
            const fs = require("fs");
            const path = require("path");
            const target = options.path || path.join(process.cwd(), "data", fileName);
            const existed = fs.existsSync(target);
            const backup = existed ? `${target}.htg-backup-${Date.now()}` : null;
            const historySnapshot = options.clearHistory !== false ? {
                patches: deepClone(ensureStore().maps[String(id)] || []),
                redo: deepClone(ensureStore().redo[String(id)] || []),
                eventStates: deepClone(ensureStore().eventStates[String(id)] || null),
                mapOverride: deepClone(ensureStore().mapOverrides[String(id)] || null)
            } : null;
            const temporary = `${target}.htg-tmp-${typeof process.pid === "number" ? process.pid : Date.now()}`;
            fs.writeFileSync(temporary, JSON.stringify(raw));
            if (existed) fs.renameSync(target, backup);
            try {
                fs.renameSync(temporary, target);
            } catch (error) {
                if (backup && fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
                throw error;
            }
            if (options.clearHistory !== false) {
                const store = ensureStore();
                delete store.maps[String(id)];
                delete store.redo[String(id)];
                delete store.recovery[String(id)];
                delete store.mapOverrides[String(id)];
                if (options.makeEventsPermanent !== false) delete store.eventStates[String(id)];
                const bakedEntry = {
                    width: raw.width,
                    height: raw.height,
                    data: raw.data.slice(),
                    tilesetId: raw.tilesetId,
                    note: raw.note || "",
                    events: deepClone(raw.events || []),
                    raw: deepClone(raw)
                };
                pristineCache.set(id, bakedEntry);
                composedCache.set(id, buildComposedSnapshot(id, bakedEntry));
                if (id === $gameMap.mapId()) {
                    currentPristine = {
                        mapId: id,
                        width: raw.width,
                        height: raw.height,
                        data: raw.data.slice(),
                        tilesetId: raw.tilesetId,
                        note: raw.note || "",
                        events: deepClone(raw.events || [])
                    };
                }
            }
            if (backup) {
                const store = ensureStore();
                store.bakeBackups.unshift({
                    mapId: id,
                    target,
                    backup,
                    createdAt: Date.now(),
                    historySnapshot,
                    bakedEventIds: deepClone(bakedEventIds)
                });
                store.bakeBackups = store.bakeBackups.slice(0, 30);
            }
            emitChange({ operation: "bakeMap", mapId: id, target, backup });
            return { mapId: id, downloaded: false, fileName, target, backup,
                bakedEventIds, clearedHistory: options.clearHistory !== false };
        });
    }

    function listBakeBackups(mapId = 0) {
        const id = integer(mapId, 0);
        return deepClone((ensureStore().bakeBackups || []).filter(item => !id || item.mapId === id));
    }

    function rollbackBake(backupOrIndex = 0, options = {}) {
        if (typeof require !== "function") return false;
        const fs = require("fs");
        const backups = ensureStore().bakeBackups || [];
        const record = typeof backupOrIndex === "object"
            ? backupOrIndex
            : typeof backupOrIndex === "string" && !/^\d+$/.test(backupOrIndex)
                ? backups.find(item => item.backup === backupOrIndex)
                : backups[Math.max(0, integer(backupOrIndex, 0))];
        if (!record || !record.target || !record.backup || !fs.existsSync(record.backup)) return false;
        const rollbackCopy = fs.existsSync(record.target) ? `${record.target}.htg-before-rollback-${Date.now()}` : null;
        if (rollbackCopy) fs.copyFileSync(record.target, rollbackCopy);
        fs.copyFileSync(record.backup, record.target);
        if (options.restoreHistory !== false && record.historySnapshot) {
            const store = ensureStore();
            const key = String(record.mapId);
            if (record.historySnapshot.patches && record.historySnapshot.patches.length) store.maps[key] = deepClone(record.historySnapshot.patches);
            else delete store.maps[key];
            if (record.historySnapshot.redo && record.historySnapshot.redo.length) store.redo[key] = deepClone(record.historySnapshot.redo);
            else delete store.redo[key];
            if (record.historySnapshot.eventStates) store.eventStates[key] = deepClone(record.historySnapshot.eventStates);
            else delete store.eventStates[key];
            if (record.historySnapshot.mapOverride) store.mapOverrides[key] = deepClone(record.historySnapshot.mapOverride);
            else delete store.mapOverrides[key];
        }
        pristineCache.delete(record.mapId);
        composedCache.delete(record.mapId);
        pendingLoads.delete(record.mapId);
        recordOperation("rollbackBake", { mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy });
        emitChange({ operation: "rollbackBake", mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy });
        return { mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy, reloadRequired: record.mapId === $gameMap.mapId() };
    }

