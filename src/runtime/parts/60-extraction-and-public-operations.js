    // -------------------------------------------------------------------------
    // Extraction and prefab parsing
    // -------------------------------------------------------------------------

    function normalizePrefabDefinition(value) {
        if (!value || typeof value !== "object") return null;
        const name = String(value.name || "").trim();
        const mapId = positiveInteger(value.mapId || value.storageMapId, 0);
        const width = positiveInteger(value.width || value.w, 0);
        const height = positiveInteger(value.height || value.h, 0);
        if (!name || mapId <= 0 || width <= 0 || height <= 0) return null;
        const selection = parseLayerSelection(value.layers || "L1,L2,L3,L4,L5,L6");
        const parameters = Array.isArray(value.parameters) ? value.parameters : parseJson(value.parameters, []);
        const nestedPrefabs = Array.isArray(value.nestedPrefabs) ? value.nestedPrefabs : parseJson(value.nestedPrefabs, []);
        return {
            name,
            mapId,
            x: integer(value.x || value.sourceX, 0),
            y: integer(value.y || value.sourceY, 0),
            w: width,
            h: height,
            layers: selection.layers,
            mode: normalizeMode(value.mode, "exact"),
            includeEvents: toBoolean(value.includeEvents, false) || selection.events,
            category: String(value.category || "General").trim() || "General",
            tags: normalizeList(value.tags).map(String),
            description: String(value.description || ""),
            variantGroup: String(value.variantGroup || "").trim(),
            weight: Math.max(0.001, finiteNumber(value.weight, 1)),
            thumbnail: String(value.thumbnail || ""),
            version: Math.max(1, integer(value.version || value.revision, 1)),
            dependencies: normalizeList(value.dependencies).map(String),
            anchorX: Math.max(0, Math.min(width - 1, integer(value.anchorX, 0))),
            anchorY: Math.max(0, Math.min(height - 1, integer(value.anchorY, 0))),
            parameters: Array.isArray(parameters) ? parameters.map(item => typeof item === "string" ? { name: item } : item).filter(Boolean) : [],
            nestedPrefabs: Array.isArray(nestedPrefabs) ? nestedPrefabs.filter(Boolean) : [],
            placementRules: parseNestedStruct(value.placementRules, {}),
            createdAt: finiteNumber(value.createdAt, Date.now()),
            updatedAt: Date.now()
        };
    }

    function prefabKey(name, mapId) {
        return `${positiveInteger(mapId, 0)}:${String(name || "").trim().toLowerCase()}`;
    }

    function prefabsFromNote(note, mapId) {
        const definitions = [];
        PREFAB_REGEX.lastIndex = 0;
        let match;
        while ((match = PREFAB_REGEX.exec(String(note || ""))) !== null) {
            const definition = normalizePrefabDefinition({
                name: match[1],
                mapId,
                sourceX: match[2],
                sourceY: match[3],
                width: match[4],
                height: match[5]
            });
            if (definition) definitions.push(definition);
        }
        return definitions;
    }

    function registerPrefab(definition, save = true) {
        const normalized = normalizePrefabDefinition(definition);
        if (!normalized) {
            console.warn(`${PLUGIN_NAME}: invalid prefab definition.`, definition);
            return false;
        }
        const key = prefabKey(normalized.name, normalized.mapId);
        const store = ensureStore();
        const existing = catalogPrefab(normalized.name, normalized.mapId);
        const revision = definition.version || definition.revision || (existing ? Math.max(existing.version || 1, (store.prefabRevisions[key] || {}).revision || 1) + 1 : 1);
        normalized.version = Math.max(1, integer(revision, 1));
        normalized.createdAt = existing ? existing.createdAt || normalized.createdAt : normalized.createdAt;
        normalized.updatedAt = Date.now();
        if (save !== false) ensureStore().prefabs[key] = normalized;
        else sessionPrefabs.set(key, normalized);
        if (definition.payload) {
            if (save !== false) ensureStore().prefabPayloads[key] = deepClone(definition.payload);
            else sessionPrefabPayloads.set(key, deepClone(definition.payload));
        }
        if (save !== false) store.prefabRevisions[key] = {
            revision: normalized.version,
            updatedAt: normalized.updatedAt,
            dependencies: deepClone(normalized.dependencies)
        };
        return deepClone(normalized);
    }

    function prefabPayload(definition) {
        if (!definition) return null;
        const key = prefabKey(definition.name, definition.mapId);
        return deepClone(sessionPrefabPayloads.get(key) || ensureStore().prefabPayloads[key] || null);
    }

    function recordPrefabUse(definition) {
        if (!definition) return;
        const key = prefabKey(definition.name, definition.mapId);
        const recent = ensureStore().prefabRecent;
        const filtered = recent.filter(item => item !== key);
        filtered.unshift(key);
        ensureStore().prefabRecent = filtered.slice(0, 20);
    }

    function favoritePrefab(name, mapId = 0, favorite = true) {
        const definition = catalogPrefab(name, mapId);
        if (!definition) return false;
        const key = prefabKey(definition.name, definition.mapId);
        if (favorite !== false) ensureStore().prefabFavorites[key] = true;
        else delete ensureStore().prefabFavorites[key];
        return true;
    }

    function isPrefabFavorite(definition) {
        return !!(definition && ensureStore().prefabFavorites[prefabKey(definition.name, definition.mapId)]);
    }

    function recentPrefabs() {
        const byKey = new Map(listPrefabs().map(definition => [prefabKey(definition.name, definition.mapId), definition]));
        return ensureStore().prefabRecent.map(key => byKey.get(key)).filter(Boolean).map(deepClone);
    }

    function capturePrefab(name, x, y, width, height, options = {}) {
        const mapId = $gameMap.mapId();
        const layers = options.layers || "L1,L2,L3,L4,L5,L6";
        const includeEvents = toBoolean(options.includeEvents, false) || parseLayerSelection(layers).events;
        const payload = copyArea(x, y, width, height, layers, includeEvents, options);
        return registerPrefab({
            name,
            mapId,
            sourceX: integer(x),
            sourceY: integer(y),
            width,
            height,
            layers,
            mode: options.mode || "exact",
            includeEvents,
            category: options.category,
            tags: options.tags,
            description: options.description,
            variantGroup: options.variantGroup,
            weight: options.weight,
            thumbnail: options.thumbnail,
            version: options.version,
            dependencies: options.dependencies,
            anchorX: options.anchorX,
            anchorY: options.anchorY,
            parameters: options.parameters,
            nestedPrefabs: options.nestedPrefabs,
            placementRules: options.placementRules,
            payload
        }, options.save !== false);
    }

    function duplicatePrefab(name, mapId, newName, save = true) {
        const source = catalogPrefab(name, mapId);
        if (!source) return false;
        const payload = prefabPayload(source);
        return registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
    }

    function renamePrefab(name, mapId, newName, save = true) {
        const source = catalogPrefab(name, mapId);
        if (!source || !String(newName || "").trim()) return false;
        const payload = prefabPayload(source);
        if (source.name.toLowerCase() === String(newName).trim().toLowerCase()) {
            return registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
        }
        const result = registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
        removePrefab(source.name, source.mapId);
        return result;
    }

    function choosePrefabVariant(group, options = {}) {
        const candidates = listPrefabs().filter(definition => definition.variantGroup === String(group || ""));
        if (!candidates.length) return null;
        const entries = candidates.map((definition, index) => ({ tileId: index, weight: definition.weight || 1 }));
        const index = chooseWeightedTile(entries, typeof options.random === "function" ? options.random : Math.random);
        return deepClone(candidates[index]);
    }

    function exportPrefabPack(names = null) {
        const requested = names ? new Set(normalizeList(names).map(value => String(value).toLowerCase())) : null;
        const prefabs = listPrefabs().filter(definition => !requested || requested.has(definition.name.toLowerCase()));
        return {
            format: "HybridTileGraftPrefabPack",
            version: 2,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            prefabs: prefabs.map(definition => ({
                definition: deepClone(definition),
                payload: prefabPayload(definition)
            }))
        };
    }

    function previewPrefabImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Prefab pack exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`], prefabs: [] };
        }
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPrefabPack" || !Array.isArray(pack.prefabs)) {
            return { ok: false, errors: ["Not a HybridTileGraft prefab pack."], prefabs: [] };
        }
        const policy = String(options.conflictPolicy || "newer").toLowerCase();
        const prefabs = pack.prefabs.map(item => {
            const definition = normalizePrefabDefinition(item.definition || item);
            if (!definition) return { ok: false, error: "Invalid prefab definition." };
            const current = catalogPrefab(definition.name, definition.mapId);
            const action = !current ? "create"
                : policy === "replace" ? "replace"
                    : policy === "skip" ? "skip"
                        : (definition.version || 1) > (current.version || 1) ? "replace" : "skip";
            return {
                ok: true,
                name: definition.name,
                mapId: definition.mapId,
                incomingVersion: definition.version || 1,
                currentVersion: current ? current.version || 1 : 0,
                action,
                dependencies: prefabDependencyReport(definition).dependencies,
                embedded: !!item.payload
            };
        });
        return { ok: prefabs.every(item => item.ok), policy, errors: prefabs.filter(item => !item.ok).map(item => item.error), prefabs };
    }

    function importPrefabPack(value, saveOrOptions = true) {
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPrefabPack" || !Array.isArray(pack.prefabs)) return false;
        const options = typeof saveOrOptions === "object" ? saveOrOptions : { save: saveOrOptions };
        const preview = previewPrefabImport(pack, options);
        if (options.dryRun) return preview;
        const imported = [];
        const skipped = [];
        for (let index = 0; index < pack.prefabs.length; index++) {
            const item = pack.prefabs[index];
            const definition = item.definition || item;
            if (preview.prefabs[index] && preview.prefabs[index].action === "skip") {
                skipped.push(definition.name);
                continue;
            }
            const result = registerPrefab(Object.assign({}, definition, { payload: item.payload || definition.payload }), options.save !== false);
            if (result) imported.push(result);
        }
        Object.defineProperty(imported, "skipped", { value: skipped, enumerable: false });
        return imported;
    }

    function listPrefabs() {
        const merged = new Map();
        if (typeof $dataMap !== "undefined" && $dataMap && typeof $gameMap !== "undefined" && $gameMap) {
            for (const definition of prefabsFromNote($dataMap.note, $gameMap.mapId())) {
                merged.set(prefabKey(definition.name, definition.mapId), definition);
            }
        }
        for (const [mapId, entry] of pristineCache) {
            for (const definition of prefabsFromNote(entry.note, mapId)) {
                merged.set(prefabKey(definition.name, definition.mapId), definition);
            }
        }
        for (const definition of PARAMETER_PREFABS) merged.set(prefabKey(definition.name, definition.mapId), definition);
        for (const [key, definition] of Object.entries(ensureStore().prefabs || {})) merged.set(key, definition);
        for (const [key, definition] of sessionPrefabs) merged.set(key, definition);
        return Array.from(merged.values()).map(definition => Object.assign(deepClone(definition), {
            favorite: isPrefabFavorite(definition),
            recent: ensureStore().prefabRecent.indexOf(prefabKey(definition.name, definition.mapId))
        })).sort((a, b) => Number(b.favorite) - Number(a.favorite) ||
            ((a.recent < 0 ? 999 : a.recent) - (b.recent < 0 ? 999 : b.recent)) ||
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.mapId - b.mapId);
    }

    function removePrefab(name, mapId = 0) {
        const targetName = String(name || "").trim().toLowerCase();
        let removed = false;
        const removedKeys = new Set();
        for (const key of Object.keys(ensureStore().prefabs || {})) {
            const definition = ensureStore().prefabs[key];
            if (String(definition.name).toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))) {
                delete ensureStore().prefabs[key];
                delete ensureStore().prefabPayloads[key];
                delete ensureStore().prefabFavorites[key];
                delete ensureStore().prefabRevisions[key];
                removedKeys.add(key);
                removed = true;
            }
        }
        for (const [key, definition] of Array.from(sessionPrefabs.entries())) {
            if (String(definition.name).toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))) {
                sessionPrefabs.delete(key);
                sessionPrefabPayloads.delete(key);
                removedKeys.add(key);
                removed = true;
            }
        }
        if (removed) ensureStore().prefabRecent = ensureStore().prefabRecent.filter(key => !removedKeys.has(key));
        return removed;
    }

    function catalogPrefab(name, mapId = 0) {
        const targetName = String(name || "").trim().toLowerCase();
        return listPrefabs().find(definition =>
            definition.name.toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))
        ) || null;
    }

    function preloadPrefabMaps(forceRefresh = false) {
        const mapIds = [...new Set(listPrefabs().map(definition => definition.mapId))];
        return Promise.all(mapIds.map(mapId => preloadMap(mapId, forceRefresh)));
    }

    function preloadChildMaps(tag = CHILD_MAP_TAG, forceRefresh = false) {
        const mapIds = new Set();
        const label = String(tag || "ChildMap").trim();
        if (label && typeof $dataMap !== "undefined" && $dataMap) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`<${escaped}:\\s*([^>]+)>`, "gi");
            let match;
            while ((match = regex.exec(String($dataMap.note || "")))) {
                for (const raw of match[1].split(",")) {
                    const id = positiveInteger(raw, 0);
                    if (id > 0) mapIds.add(id);
                }
            }
        }
        if (typeof $dataMapInfos !== "undefined" && $dataMapInfos) {
            const marker = label.toLowerCase();
            for (const info of $dataMapInfos) {
                if (!info) continue;
                const name = String(info.name || "").toLowerCase();
                if (integer(info.parentId, 0) === $gameMap.mapId() ||
                    (marker && (name.includes(`[${marker}]`) || name.includes(`<${marker}>`)))) {
                    mapIds.add(info.id);
                }
            }
        }
        return Promise.all(Array.from(mapIds).map(mapId => preloadMap(mapId, forceRefresh)));
    }

    function extractRegion(source, rect, layerKeys) {
        const tiles = {};
        for (const key of layerKeys) {
            const z = LAYER_INDEX[key];
            const values = new Array(rect.w * rect.h).fill(0);
            for (let dy = 0; dy < rect.h; dy++) {
                for (let dx = 0; dx < rect.w; dx++) {
                    values[dy * rect.w + dx] = readTile(
                        source.data,
                        source.width,
                        source.height,
                        rect.x + dx,
                        rect.y + dy,
                        z
                    );
                }
            }
            tiles[key] = values;
        }
        return tiles;
    }

    function findPrefab(note, name) {
        PREFAB_REGEX.lastIndex = 0;
        let match;
        while ((match = PREFAB_REGEX.exec(note || "")) !== null) {
            if (match[1].trim().toLowerCase() === String(name || "").trim().toLowerCase()) {
                return normalizeRect(match[2], match[3], match[4], match[5]);
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Public map operations
    // -------------------------------------------------------------------------

    function graftArea(options = {}) {
        const sourceMapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        const source = getSourceMapData(sourceMapId);
        if (!source) return false;
        if (WARN_MISMATCHED_TILESET && source.tilesetId !== $dataMap.tilesetId) {
            console.warn(`${PLUGIN_NAME}: source tileset ${source.tilesetId} differs from target tileset ${$dataMap.tilesetId}. Tile slots will use the target tileset's graphics.`);
        }
        const sourceRect = normalizeRect(options.sourceX, options.sourceY, options.width, options.height);
        const point = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const targetRect = { x: point.x, y: point.y, w: sourceRect.w, h: sourceRect.h };
        const selection = parseLayerSelection(options.layers || ["L1", "L2", "L3", "L4", "L5", "L6"]);
        const includeEvents = toBoolean(options.includeEvents, false) || selection.events;
        if (!selection.layers.length && !includeEvents) {
            console.warn(`${PLUGIN_NAME}: graft ignored because no valid layers were selected.`);
            return false;
        }
        const tiles = extractRegion(source, sourceRect, selection.layers);
        const events = includeEvents
            ? extractEvents(source, sourceRect, targetRect.x - sourceRect.x, targetRect.y - sourceRect.y)
            : [];
        const patch = makeRectPatch(targetRect, selection.layers, tiles, options.mode, {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInArea(targetRect) : []
        });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "graftArea");
        return patch;
    }

    function graftAreaAsync(options = {}) {
        const mapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        if (mapId === $gameMap.mapId() || composedCache.has(mapId)) return Promise.resolve(graftArea(options));
        return preloadMap(mapId).then(() => graftArea(options));
    }

    function mapSnapshotAsync(mapId) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(getSourceMapData(id));
        return preloadMap(id);
    }

    function applyPatchToMap(mapId, patch, operation) {
        const id = positiveInteger(mapId);
        addPatch(id, patch);
        if (id === $gameMap.mapId()) {
            applyPatchLive(patch, operation);
        } else {
            emitChange({ operation, mapId: id, remote: true, rect: patchRect(patch), layers: patch.layers || [] });
        }
        return patch;
    }

    function spawnedEventIdsInSnapshot(events, rect) {
        const ids = [];
        for (const event of events || []) {
            if (isHybridEventData(event) && inRect(event.x, event.y, rect)) ids.push(event.id);
        }
        return ids;
    }

    function graftAreaToMapAsync(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) return graftAreaAsync(options);
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote graft was skipped.`);
            return Promise.resolve(false);
        }
        const sourceMapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        return Promise.all([mapSnapshotAsync(sourceMapId), mapSnapshotAsync(targetMapId)]).then(([source, target]) => {
            const sourceRect = normalizeRect(options.sourceX, options.sourceY, options.width, options.height);
            const targetPoint = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
            const targetRect = normalizeRect(targetPoint.x, targetPoint.y, sourceRect.w, sourceRect.h);
            const selection = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6");
            const includeEvents = toBoolean(options.includeEvents, false) || selection.events;
            if (!selection.layers.length && !includeEvents) return false;
            if (WARN_MISMATCHED_TILESET && source.tilesetId !== target.tilesetId) {
                console.warn(`${PLUGIN_NAME}: remote graft tileset mismatch (${source.tilesetId} -> ${target.tilesetId}).`);
            }
            const tiles = extractRegion(source, sourceRect, selection.layers);
            const events = includeEvents
                ? extractEvents(source, sourceRect, targetRect.x - sourceRect.x, targetRect.y - sourceRect.y)
                : [];
            const patch = makeRectPatch(targetRect, selection.layers, tiles, options.mode, {
                affectEvents: includeEvents,
                events,
                removeEventIds: includeEvents ? spawnedEventIdsInSnapshot(target.events, targetRect) : []
            });
            return applyPatchToMap(targetMapId, patch, "graftRemoteArea");
        });
    }

    function setTileOnMapAsync(mapId, x, y, layer, tileValue, options = {}) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(setTile(x, y, layer, tileValue, true, options));
        }
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote tile change was skipped.`);
            return Promise.resolve(false);
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const tileId = parseTileId(tileValue);
            const point = resolvePoint(x, y, options, options.interpreter || null);
            if (tileId === null || !inBounds(point.x, point.y, target.width, target.height)) return false;
            const key = normalizeLayer(layer);
            if (!validateLayerValue(tileId, key, target.tilesetId)) return false;
            const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
            const patch = makeSparsePatch([{
                x: point.x,
                y: point.y,
                tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
            }], mode, mode === "autotile" ? [point] : null);
            return applyPatchToMap(targetMapId, patch, "setRemoteTile");
        });
    }

    function fillTilesOnMapAsync(mapId, x, y, width, height, layer, tileValue, options = {}) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(fillTiles(x, y, width, height, layer, tileValue, true, options));
        }
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote fill was skipped.`);
            return Promise.resolve(false);
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const tileId = parseTileId(tileValue);
            const key = normalizeLayer(layer);
            if (tileId === null || !validateLayerValue(tileId, key, target.tilesetId)) return false;
            const point = resolvePoint(x, y, options, options.interpreter || null);
            const rect = normalizeRect(point.x, point.y, width, height);
            const layers = [key];
            const tiles = { [key]: new Array(rect.w * rect.h).fill(tileId) };
            const z = LAYER_INDEX[key];
            if (toBoolean(options.clearUpperLayers, false) && z <= 3) {
                for (let upper = z + 1; upper <= 3; upper++) {
                    const upperKey = `L${upper + 1}`;
                    layers.push(upperKey);
                    tiles[upperKey] = new Array(rect.w * rect.h).fill(0);
                }
            }
            const patchMode = LAYER_INDEX[key] <= 3 ? (options.mode || "autotile") : "exact";
            const patch = makeRectPatch(rect, layers, tiles, patchMode);
            return applyPatchToMap(targetMapId, patch, "fillRemoteTiles");
        });
    }

    function clearAreaOnMapAsync(mapId, x, y, width, height, layersValue, includeEvents = false, mode = "autotile") {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(clearArea(x, y, width, height, layersValue, true, includeEvents, mode));
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const rect = normalizeRect(x, y, width, height);
            const selection = parseLayerSelection(layersValue);
            const affectEvents = includeEvents || selection.events;
            const tiles = {};
            for (const key of selection.layers) tiles[key] = new Array(rect.w * rect.h).fill(0);
            const patch = makeRectPatch(rect, selection.layers, tiles, mode, {
                affectEvents,
                events: [],
                removeEventIds: affectEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
            });
            return applyPatchToMap(targetMapId, patch, "clearRemoteArea");
        });
    }

    function revertAreaOnMapAsync(mapId, x, y, width, height, layersValue, includeEvents = false) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(revertArea(x, y, width, height, layersValue, true, includeEvents));
        }
        return Promise.all([loadPristineMapData(targetMapId), mapSnapshotAsync(targetMapId)]).then(([pristine, target]) => {
            const rect = normalizeRect(x, y, width, height);
            const selection = parseLayerSelection(layersValue);
            const affectEvents = includeEvents || selection.events;
            const tiles = extractRegion(pristine, rect, selection.layers);
            const needsAutotile = selection.layers.some(key => LAYER_INDEX[key] <= 3);
            const patch = makeRectPatch(rect, selection.layers, tiles, needsAutotile ? "autotile" : "exact", {
                affectEvents,
                events: [],
                removeEventIds: affectEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
            });
            return applyPatchToMap(targetMapId, patch, "revertRemoteArea");
        });
    }

    function prefabPayloadFromSource(definition, source) {
        if (!definition || !source) return null;
        const rect = normalizeRect(definition.x, definition.y, definition.w, definition.h);
        const layers = parseLayerSelection(definition.layers || "L1,L2,L3,L4,L5,L6").layers;
        const events = definition.includeEvents ? (source.events || []).filter(event => event && inRect(event.x, event.y, rect)).map(sourceEvent => {
            const event = deepClone(sourceEvent);
            event.x -= rect.x;
            event.y -= rect.y;
            return event;
        }) : [];
        return {
            version: 2,
            width: rect.w,
            height: rect.h,
            layers,
            tiles: extractRegion(source, rect, layers),
            events,
            includeEvents: !!definition.includeEvents,
            tilesetId: source.tilesetId,
            sourceMapId: definition.mapId
        };
    }

    function prefabParameterValues(definition, options = {}) {
        const supplied = typeof options.parameters === "string" ? parseJson(options.parameters, {}) : options.parameters || {};
        const values = {};
        for (const parameter of definition.parameters || []) {
            if (!parameter || !parameter.name) continue;
            values[parameter.name] = supplied[parameter.name] !== undefined ? supplied[parameter.name] : parameter.default;
        }
        Object.assign(values, supplied);
        return values;
    }

    function substitutePrefabValue(value, parameters) {
        if (typeof value === "string") {
            const exact = value.match(/^\{\{([^}]+)\}\}$/);
            if (exact && parameters[exact[1]] !== undefined) return deepClone(parameters[exact[1]]);
            return value.replace(/\{\{([^}]+)\}\}/g, (_match, key) => parameters[key] === undefined ? "" : String(parameters[key]));
        }
        if (Array.isArray(value)) return value.map(item => substitutePrefabValue(item, parameters));
        if (value && typeof value === "object") {
            const output = {};
            for (const [key, item] of Object.entries(value)) output[key] = substitutePrefabValue(item, parameters);
            return output;
        }
        return value;
    }

    function resolvePrefabPayload(definition, payload, options = {}) {
        const output = deepClone(payload);
        const parameters = prefabParameterValues(definition, options);
        output.events = substitutePrefabValue(output.events || [], parameters);
        for (const parameter of definition.parameters || []) {
            if (!parameter || !parameter.name || parameter.sourceTileId === undefined) continue;
            const sourceId = parseTileId(parameter.sourceTileId);
            const replacement = parseTileId(parameters[parameter.name]);
            if (sourceId === null || replacement === null) continue;
            const targetLayers = parameter.layer ? [normalizeLayer(parameter.layer)] : output.layers;
            for (const layer of targetLayers) {
                if (output.tiles[layer]) output.tiles[layer] = output.tiles[layer].map(value => value === sourceId ? replacement : value);
            }
        }
        for (const [sourceValue, replacementValue] of Object.entries(options.tileOverrides || {})) {
            const sourceId = parseTileId(sourceValue);
            const replacement = parseTileId(replacementValue);
            if (sourceId === null || replacement === null) continue;
            for (const layer of output.layers || []) {
                output.tiles[layer] = (output.tiles[layer] || []).map(value => value === sourceId ? replacement : value);
            }
        }
        output.parameters = parameters;
        return output;
    }

    function prefabPlacementOrigin(definition, payload, options = {}) {
        const point = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const rotation = normalizedRotation(options.rotation);
        const anchor = transformedPoint(definition.anchorX || 0, definition.anchorY || 0,
            payload.width, payload.height, rotation, toBoolean(options.mirrorX, false), toBoolean(options.mirrorY, false));
        return { x: point.x - anchor.x, y: point.y - anchor.y };
    }

    function validatePrefabPlacement(definition, target, options = {}, payload = null) {
        if (!definition || !target) return { ok: false, errors: ["Missing prefab or target map."] };
        payload ||= prefabPayload(definition);
        if (!payload) return { ok: false, errors: ["Prefab payload is unavailable."] };
        const transformed = transformClipboard(payload, options);
        const origin = prefabPlacementOrigin(definition, payload, options);
        const rect = normalizeRect(origin.x, origin.y, transformed.width, transformed.height);
        const rules = Object.assign({}, definition.placementRules || {}, options.placementRules || {});
        const errors = [];
        if (rules.withinBounds !== false && (rect.x < 0 || rect.y < 0 || rect.x + rect.w > target.width || rect.y + rect.h > target.height)) {
            errors.push("Prefab footprint is outside the target map.");
        }
        const anchorPoint = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const region = readTile(target.data, target.width, target.height, anchorPoint.x, anchorPoint.y, 5);
        const allowedRegions = normalizeList(rules.allowedRegions).map(Number);
        const forbiddenRegions = normalizeList(rules.forbiddenRegions).map(Number);
        if (allowedRegions.length && !allowedRegions.includes(region)) errors.push(`Anchor region ${region} is not allowed.`);
        if (forbiddenRegions.includes(region)) errors.push(`Anchor region ${region} is forbidden.`);
        if (toBoolean(rules.requireEmptyEvents, false) && (target.events || []).some(event => event && inRect(event.x, event.y, rect))) {
            errors.push("The target footprint contains events.");
        }
        const edgeDistance = Math.max(0, integer(rules.edgeDistance, 0));
        if (edgeDistance && (rect.x < edgeDistance || rect.y < edgeDistance ||
            rect.x + rect.w > target.width - edgeDistance || rect.y + rect.h > target.height - edgeDistance)) {
            errors.push(`Prefab must be at least ${edgeDistance} tile(s) from the map edge.`);
        }
        return { ok: errors.length === 0, errors, rect, origin, region };
    }

    function prefabDependencyReport(definition) {
        const dependencies = [];
        for (const raw of definition && definition.dependencies || []) {
            const match = String(raw).match(/^(.+?)(?:@(\d+))?$/);
            const dependency = catalogPrefab(match ? match[1] : raw, 0);
            const requiredVersion = match && match[2] ? integer(match[2]) : 1;
            dependencies.push({ name: match ? match[1] : String(raw), requiredVersion,
                found: !!dependency, actualVersion: dependency ? dependency.version || 1 : 0,
                ok: !!dependency && (dependency.version || 1) >= requiredVersion });
        }
        return { ok: dependencies.every(item => item.ok), dependencies };
    }

    function resolvePrefabForGraft(options, source = null) {
        const requestedMapId = integer(options.storageMapId, 0);
        let definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const storageMapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        source ||= getSourceMapData(storageMapId);
        if (!definition && source) {
            const rect = findPrefab(source.note, options.name);
            if (rect) definition = normalizePrefabDefinition(Object.assign({
                name: options.name,
                mapId: storageMapId,
                layers: options.layers || "L1,L2,L3,L4,L5,L6",
                mode: options.mode || "exact",
                includeEvents: toBoolean(options.includeEvents, false)
            }, rect));
        }
        if (!definition) return null;
        definition = deepClone(definition);
        if (options.includeEvents !== undefined) definition.includeEvents = toBoolean(options.includeEvents, definition.includeEvents);
        let payload = prefabPayload(definition);
        if (!payload || (definition.includeEvents && !payload.includeEvents)) payload = prefabPayloadFromSource(definition, source);
        if (!payload) return null;
        payload = resolvePrefabPayload(definition, payload, options);
        return { definition, payload, source };
    }

    function graftPrefab(options = {}) {
        const resolved = resolvePrefabForGraft(options);
        if (!resolved) {
            console.warn(`${PLUGIN_NAME}: prefab "${options.name}" is unavailable or its source map is not preloaded.`);
            return false;
        }
        const dependencyReport = prefabDependencyReport(resolved.definition);
        if (!dependencyReport.ok && options.ignoreDependencies !== true) {
            console.warn(`${PLUGIN_NAME}: prefab dependencies are not satisfied.`, dependencyReport);
            return false;
        }
        const placement = validatePrefabPlacement(resolved.definition, getSourceMapData($gameMap.mapId()), options, resolved.payload);
        if (!placement.ok && options.ignorePlacementRules !== true) {
            console.warn(`${PLUGIN_NAME}: prefab placement rejected.`, placement.errors);
            return false;
        }
        const result = pasteArea(placement.origin.x, placement.origin.y, Object.assign({}, options, {
            coordinateMode: "absolute",
            targetX: undefined,
            targetY: undefined,
            layers: options.layers || resolved.definition.layers,
            mode: options.mode || resolved.definition.mode,
            includeEvents: options.includeEvents === undefined ? resolved.definition.includeEvents : options.includeEvents
        }), resolved.payload);
        if (result) recordPrefabUse(resolved.definition);
        return result;
    }

    async function graftNestedPrefabs(definition, payload, options, remote = false) {
        const stack = new Set(options._dependencyStack || []);
        const key = prefabKey(definition.name, definition.mapId);
        if (stack.has(key)) throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${definition.name}.`);
        stack.add(key);
        const origin = prefabPlacementOrigin(definition, payload, options);
        const results = [];
        for (const nested of definition.nestedPrefabs || []) {
            const local = transformedPoint(integer(nested.x), integer(nested.y), payload.width, payload.height,
                normalizedRotation(options.rotation), toBoolean(options.mirrorX, false), toBoolean(options.mirrorY, false));
            const nestedOptions = Object.assign({}, nested, {
                name: nested.name,
                storageMapId: nested.mapId || nested.storageMapId || 0,
                targetX: origin.x + local.x,
                targetY: origin.y + local.y,
                rotation: (normalizedRotation(options.rotation) + normalizedRotation(nested.rotation)) % 360,
                mirrorX: nested.mirrorX === undefined ? options.mirrorX : nested.mirrorX,
                mirrorY: nested.mirrorY === undefined ? options.mirrorY : nested.mirrorY,
                save: options.save,
                _dependencyStack: Array.from(stack),
                parameters: Object.assign({}, options.parameters || {}, nested.parameters || {})
            });
            if (remote) nestedOptions.targetMapId = options.targetMapId;
            results.push(await (remote ? graftPrefabToMapAsync(nestedOptions) : graftPrefabAsync(nestedOptions)));
        }
        return results;
    }

    async function graftPrefabAsync(options = {}) {
        const requestedMapId = integer(options.storageMapId, 0);
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const mapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        if (!(definition && prefabPayload(definition)) && mapId !== $gameMap.mapId() && !composedCache.has(mapId)) await preloadMap(mapId);
        const resolved = resolvePrefabForGraft(options);
        if (!resolved) return false;
        if (new Set(options._dependencyStack || []).has(prefabKey(resolved.definition.name, resolved.definition.mapId))) {
            throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${resolved.definition.name}.`);
        }
        const result = graftPrefab(options);
        if (!result) return false;
        Object.defineProperty(result, "nestedResults", {
            value: await graftNestedPrefabs(resolved.definition, resolved.payload, options, false),
            configurable: true,
            enumerable: false
        });
        return result;
    }

    async function graftPrefabToMapAsync(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) return graftPrefabAsync(options);
        const requestedMapId = integer(options.storageMapId, 0);
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const sourceMapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        const [target, source] = await Promise.all([mapSnapshotAsync(targetMapId), mapSnapshotAsync(sourceMapId)]);
        const resolved = resolvePrefabForGraft(options, source);
        if (!resolved) return false;
        if (new Set(options._dependencyStack || []).has(prefabKey(resolved.definition.name, resolved.definition.mapId))) {
            throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${resolved.definition.name}.`);
        }
        const dependencyReport = prefabDependencyReport(resolved.definition);
        if (!dependencyReport.ok && options.ignoreDependencies !== true) return false;
        const placement = validatePrefabPlacement(resolved.definition, target, options, resolved.payload);
        if (!placement.ok && options.ignorePlacementRules !== true) return false;
        const transformed = transformClipboard(resolved.payload, options);
        const rect = normalizeRect(placement.origin.x, placement.origin.y, transformed.width, transformed.height);
        const requested = options.layers ? parseLayerSelection(options.layers).layers : transformed.layers;
        const layers = requested.filter(layer => transformed.layers.includes(layer));
        const tiles = {};
        for (const layer of layers) tiles[layer] = (transformed.tiles[layer] || []).slice();
        const includeEvents = !!transformed.includeEvents && (options.includeEvents === undefined
            ? resolved.definition.includeEvents : toBoolean(options.includeEvents, false));
        const events = includeEvents ? (transformed.events || []).map(sourceEvent => {
            const event = prepareTargetEventSnapshot(sourceEvent);
            event.x = rect.x + integer(sourceEvent.x);
            event.y = rect.y + integer(sourceEvent.y);
            return event;
        }) : [];
        const patch = makeRectPatch(rect, layers, tiles, options.mode || resolved.definition.mode || "exact", {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
        });
        const result = applyPatchToMap(targetMapId, patch, "graftRemotePrefab");
        recordPrefabUse(resolved.definition);
        Object.defineProperty(result, "nestedResults", {
            value: await graftNestedPrefabs(resolved.definition, resolved.payload,
                Object.assign({}, options, { targetMapId }), true),
            configurable: true,
            enumerable: false
        });
        return result;
    }

    function prefabInstanceBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.prefabInstances[key] ||= [];
        return store.prefabInstances[key] || [];
    }

    async function placePrefabInstance(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, integer(options.storageMapId, 0));
        if (!definition) return false;
        const instanceId = String(options.instanceId || `instance-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
        const store = ensureStore();
        const key = String(targetMapId);
        const start = (store.maps[key] || []).length;
        const placementOptions = Object.assign({}, deepClone(options), { targetMapId });
        delete placementOptions.instanceId;
        const result = await graftPrefabToMapAsync(placementOptions);
        if (!result) return false;
        const patches = (store.maps[key] || []).slice(start);
        for (const patch of patches) patch.prefabInstanceId = instanceId;
        const instance = {
            id: instanceId,
            mapId: targetMapId,
            prefabName: definition.name,
            prefabMapId: definition.mapId,
            prefabVersion: definition.version || 1,
            targetX: integer(options.targetX),
            targetY: integer(options.targetY),
            options: placementOptions,
            patchCount: patches.length,
            linked: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        prefabInstanceBucket(targetMapId, true).push(instance);
        recordOperation("placePrefabInstance", { mapId: targetMapId, instanceId, prefab: definition.name, patchCount: patches.length });
        return deepClone(instance);
    }

    function listPrefabInstances(mapId = $gameMap.mapId()) {
        return prefabInstanceBucket(mapId).map(instance => {
            const definition = catalogPrefab(instance.prefabName, instance.prefabMapId);
            return Object.assign(deepClone(instance), {
                currentPrefabVersion: definition ? definition.version || 1 : 0,
                updateAvailable: !!definition && (definition.version || 1) > (instance.prefabVersion || 1),
                missingPrefab: !definition
            });
        });
    }

    function resolvePrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        return prefabInstanceBucket(mapId).find(item => item.id === String(instanceId)) || null;
    }

    async function refreshPrefabInstance(instanceId, mapId = $gameMap.mapId(), changes = {}) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance || instance.linked === false) return false;
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.prefabInstanceId !== instance.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("preparePrefabInstanceRefresh");
        else await preloadMap(id, true);
        const start = (store.maps[key] || []).length;
        const options = Object.assign({}, deepClone(instance.options || {}), deepClone(changes || {}), {
            targetMapId: id,
            name: changes.prefabName || instance.prefabName,
            storageMapId: changes.prefabMapId || instance.prefabMapId
        });
        const result = await graftPrefabToMapAsync(options);
        if (!result) return false;
        const patches = (store.maps[key] || []).slice(start);
        for (const patch of patches) patch.prefabInstanceId = instance.id;
        const definition = catalogPrefab(options.name, options.storageMapId);
        instance.prefabName = options.name;
        instance.prefabMapId = options.storageMapId;
        instance.prefabVersion = definition ? definition.version || 1 : instance.prefabVersion;
        instance.targetX = integer(options.targetX);
        instance.targetY = integer(options.targetY);
        instance.options = options;
        instance.patchCount = patches.length;
        instance.updatedAt = Date.now();
        recordOperation("refreshPrefabInstance", { mapId: id, instanceId: instance.id, patchCount: patches.length });
        return deepClone(instance);
    }

    async function refreshAllPrefabInstances(mapId = $gameMap.mapId(), options = {}) {
        const results = [];
        const errors = [];
        for (const instance of listPrefabInstances(mapId)) {
            if (options.onlyOutdated !== false && !instance.updateAvailable) continue;
            try { results.push(await refreshPrefabInstance(instance.id, mapId)); }
            catch (error) { errors.push({ instanceId: instance.id, message: error.message }); }
        }
        return { ok: errors.length === 0, results, errors };
    }

    function unlinkPrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance) return false;
        for (const patch of getPatches(id)) if (patch && patch.prefabInstanceId === instance.id) delete patch.prefabInstanceId;
        ensureStore().prefabInstances[String(id)] = prefabInstanceBucket(id).filter(item => item.id !== instance.id);
        return true;
    }

    function deletePrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance) return false;
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.prefabInstanceId !== instance.id);
        store.prefabInstances[key] = prefabInstanceBucket(id).filter(item => item.id !== instance.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("deletePrefabInstance");
        return true;
    }

    function prefabInstanceDiagnostics(mapId = $gameMap.mapId()) {
        const instances = listPrefabInstances(mapId);
        return {
            mapId: integer(mapId),
            total: instances.length,
            outdated: instances.filter(item => item.updateAvailable).length,
            missing: instances.filter(item => item.missingPrefab).length,
            instances
        };
    }

    function cellTilesForLayer(layer, tileId, clearUpperLayers = false) {
        const key = normalizeLayer(layer);
        const z = LAYER_INDEX[key];
        const tiles = { [key]: tileId };
        if (clearUpperLayers && z <= 3) {
            for (let upper = z + 1; upper <= 3; upper++) tiles[`L${upper + 1}`] = 0;
        }
        return tiles;
    }

    function copyArea(x, y, width, height, layersValue = "L1,L2,L3,L4,L5,L6", includeEvents = false, options = {}) {
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const selection = parseLayerSelection(layersValue);
        const copyEvents = toBoolean(includeEvents, false) || selection.events;
        const source = getSourceMapData($gameMap.mapId());
        const events = [];
        if (copyEvents) {
            for (const sourceEvent of source.events || []) {
                if (!sourceEvent || !inRect(sourceEvent.x, sourceEvent.y, rect)) continue;
                const event = deepClone(sourceEvent);
                event.x -= rect.x;
                event.y -= rect.y;
                events.push(event);
            }
        }
        runtimeClipboard = {
            version: 1,
            width: rect.w,
            height: rect.h,
            layers: selection.layers,
            tiles: extractRegion(source, rect, selection.layers),
            events,
            includeEvents: copyEvents,
            tilesetId: source.tilesetId,
            sourceMapId: $gameMap.mapId()
        };
        emitChange({ operation: "copyArea", mapId: $gameMap.mapId(), rect, layers: selection.layers });
        return deepClone(runtimeClipboard);
    }

    function clipboardContents() {
        return runtimeClipboard ? deepClone(runtimeClipboard) : null;
    }

    function clearClipboard() {
        runtimeClipboard = null;
        return true;
    }

    function groupHistorySince(mapId, startIndex, label) {
        const store = ensureStore();
        const key = String(integer(mapId));
        const patches = store.maps[key] || [];
        const changes = patches.slice(startIndex);
        if (changes.length > 1) store.maps[key] = patches.slice(0, startIndex).concat(makeBatchPatch(changes, label));
        else if (changes.length === 1) changes[0].label ||= label;
        composedCache.delete(integer(mapId));
        return changes.length;
    }

    function resizeClipboard(clipboard, width, height, options = {}) {
        if (!clipboard) return null;
        const targetWidth = positiveInteger(width);
        const targetHeight = positiveInteger(height);
        const output = deepClone(clipboard);
        output.width = targetWidth;
        output.height = targetHeight;
        output.tiles = {};
        for (const layer of clipboard.layers || []) {
            const source = clipboard.tiles[layer] || [];
            const target = new Array(targetWidth * targetHeight).fill(0);
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < targetWidth; x++) {
                    const sourceX = Math.min(clipboard.width - 1, Math.floor(x * clipboard.width / targetWidth));
                    const sourceY = Math.min(clipboard.height - 1, Math.floor(y * clipboard.height / targetHeight));
                    target[y * targetWidth + x] = source[sourceY * clipboard.width + sourceX] || 0;
                }
            }
            output.tiles[layer] = target;
        }
        output.events = (clipboard.events || []).map(event => {
            const clone = deepClone(event);
            clone.x = Math.min(targetWidth - 1, Math.floor(clone.x * targetWidth / clipboard.width));
            clone.y = Math.min(targetHeight - 1, Math.floor(clone.y * targetHeight / clipboard.height));
            return clone;
        });
        output.resize = { sourceWidth: clipboard.width, sourceHeight: clipboard.height,
            width: targetWidth, height: targetHeight, method: options.method || "nearest" };
        return output;
    }

    function editorSelectedRect() {
        return runtimeEditorState.selectionRect ? deepClone(runtimeEditorState.selectionRect) : editorSelectionRect();
    }

    function selectEditorArea(x, y, width, height, scene = SceneManager._scene) {
        const rect = normalizeRect(x, y, width, height);
        rect.x = Math.max(0, Math.min(editorMapWidth() - 1, rect.x));
        rect.y = Math.max(0, Math.min(editorMapHeight() - 1, rect.y));
        rect.w = Math.min(rect.w, editorMapWidth() - rect.x);
        rect.h = Math.min(rect.h, editorMapHeight() - rect.y);
        runtimeEditorState.selectionRect = rect;
        runtimeEditorState.selectionStart = null;
        editorSetMessage(`Selected ${rect.w}×${rect.h} area.`, scene);
        return deepClone(rect);
    }

    function copyEditorSelection(options = {}) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        if (runtimeEditorState.remoteMapId) return editorRemoteCopy(rect, options.includeEvents !== false);
        return copyArea(rect.x, rect.y, rect.w, rect.h, options.layers || "L1,L2,L3,L4,L5,L6,L7",
            options.includeEvents !== false);
    }

    function deleteEditorSelection(options = {}, scene = SceneManager._scene) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        let result;
        if (runtimeEditorState.remoteMapId) {
            const snapshot = runtimeEditorState.remoteSnapshot;
            const layers = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6").layers;
            const tiles = {};
            for (const layer of layers) tiles[layer] = new Array(rect.w * rect.h).fill(0);
            const patch = makeRectPatch(rect, layers, tiles, options.mode || "autotile", {
                affectEvents: options.includeEvents !== false,
                events: [],
                removeEventIds: options.includeEvents !== false ? spawnedEventIdsInSnapshot(snapshot.events, rect) : []
            });
            result = editorRemoteApplyPatch(patch, "deleteRemoteSelection", scene);
        } else {
            result = clearArea(rect.x, rect.y, rect.w, rect.h, options.layers || "L1,L2,L3,L4,L5,L6,L7",
                options.save !== false, options.includeEvents !== false, options.mode || "autotile");
        }
        if (result) editorSetMessage(`Deleted ${rect.w}×${rect.h} selection.`, scene);
        return result;
    }

    function pasteClipboardAt(x, y, clipboard, options = {}, scene = SceneManager._scene) {
        const previous = runtimeClipboard;
        const previousTransform = { rotation: runtimeEditorState.rotation,
            mirrorX: runtimeEditorState.mirrorX, mirrorY: runtimeEditorState.mirrorY };
        runtimeClipboard = deepClone(clipboard);
        const oldCursor = { x: runtimeEditorState.cursorX, y: runtimeEditorState.cursorY };
        runtimeEditorState.cursorX = integer(x);
        runtimeEditorState.cursorY = integer(y);
        runtimeEditorState.rotation = 0;
        runtimeEditorState.mirrorX = false;
        runtimeEditorState.mirrorY = false;
        const result = runtimeEditorState.remoteMapId
            ? editorRemotePaste(scene)
            : pasteArea(x, y, Object.assign({ save: true }, options), runtimeClipboard);
        runtimeEditorState.cursorX = oldCursor.x;
        runtimeEditorState.cursorY = oldCursor.y;
        runtimeEditorState.rotation = previousTransform.rotation;
        runtimeEditorState.mirrorX = previousTransform.mirrorX;
        runtimeEditorState.mirrorY = previousTransform.mirrorY;
        runtimeClipboard = previous;
        return result;
    }

    function transformEditorSelection(options = {}, scene = SceneManager._scene) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        const mapId = editorMapId();
        const start = (ensureStore().maps[String(mapId)] || []).length;
        const clipboard = copyEditorSelection({ rect, includeEvents: options.includeEvents !== false,
            layers: options.layers || "L1,L2,L3,L4,L5,L6,L7" });
        if (!clipboard) return false;
        const transformed = options.width || options.height
            ? resizeClipboard(transformClipboard(clipboard, options), options.width || clipboard.width, options.height || clipboard.height, options)
            : transformClipboard(clipboard, options);
        deleteEditorSelection({ rect, includeEvents: options.includeEvents !== false,
            layers: options.layers || "L1,L2,L3,L4,L5,L6,L7", save: true }, scene);
        const targetX = options.targetX === undefined ? rect.x + integer(options.dx, 0) : integer(options.targetX);
        const targetY = options.targetY === undefined ? rect.y + integer(options.dy, 0) : integer(options.targetY);
        const result = pasteClipboardAt(targetX, targetY, transformed,
            { mode: options.mode || "exact", includeEvents: options.includeEvents !== false }, scene);
        if (!result) return false;
        groupHistorySince(mapId, start, options.label || "Transform Selection");
        runtimeEditorState.selectionRect = { x: targetX, y: targetY, w: transformed.width, h: transformed.height };
        editorSetMessage(`Selection transformed to ${transformed.width}×${transformed.height}.`, scene);
        return result;
    }

    function moveEditorSelection(dx, dy, options = {}, scene = SceneManager._scene) {
        return transformEditorSelection(Object.assign({}, options, { dx, dy, label: options.label || "Move Selection" }), scene);
    }

    function cutEditorSelection(options = {}, scene = SceneManager._scene) {
        const copied = copyEditorSelection(options);
        if (!copied) return false;
        const deleted = deleteEditorSelection(options, scene);
        if (deleted) runtimeClipboard = copied;
        return deleted ? copied : false;
    }

    function transformedPoint(x, y, width, height, rotation, mirrorX, mirrorY) {
        let px = integer(x);
        let py = integer(y);
        if (mirrorX) px = width - 1 - px;
        if (mirrorY) py = height - 1 - py;
        if (rotation === 90) return { x: height - 1 - py, y: px };
        if (rotation === 180) return { x: width - 1 - px, y: height - 1 - py };
        if (rotation === 270) return { x: py, y: width - 1 - px };
        return { x: px, y: py };
    }

    function transformedDirection(direction, rotation, mirrorX, mirrorY) {
        let value = integer(direction, 2);
        if (mirrorX) value = ({ 4: 6, 6: 4 })[value] || value;
        if (mirrorY) value = ({ 2: 8, 8: 2 })[value] || value;
        const rotate90 = { 2: 4, 4: 8, 8: 6, 6: 2 };
        for (let step = 0; step < rotation / 90; step++) value = rotate90[value] || value;
        return value;
    }

    function transformClipboard(clipboard = runtimeClipboard, options = {}) {
        if (!clipboard) return null;
        const rotation = ((integer(options.rotation, 0) % 360) + 360) % 360;
        const normalizedRotation = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
        const mirrorX = toBoolean(options.mirrorX, false);
        const mirrorY = toBoolean(options.mirrorY, false);
        const sourceWidth = positiveInteger(clipboard.width);
        const sourceHeight = positiveInteger(clipboard.height);
        const targetWidth = normalizedRotation === 90 || normalizedRotation === 270 ? sourceHeight : sourceWidth;
        const targetHeight = normalizedRotation === 90 || normalizedRotation === 270 ? sourceWidth : sourceHeight;
        const output = deepClone(clipboard);
        output.width = targetWidth;
        output.height = targetHeight;
        output.tiles = {};
        for (const layer of clipboard.layers || []) {
            const source = clipboard.tiles[layer] || [];
            const target = new Array(targetWidth * targetHeight).fill(0);
            for (let y = 0; y < sourceHeight; y++) {
                for (let x = 0; x < sourceWidth; x++) {
                    const point = transformedPoint(x, y, sourceWidth, sourceHeight, normalizedRotation, mirrorX, mirrorY);
                    target[point.y * targetWidth + point.x] = source[y * sourceWidth + x] || 0;
                }
            }
            output.tiles[layer] = target;
        }
        output.events = (clipboard.events || []).map(source => {
            const event = deepClone(source);
            const point = transformedPoint(event.x, event.y, sourceWidth, sourceHeight, normalizedRotation, mirrorX, mirrorY);
            event.x = point.x;
            event.y = point.y;
            if (event.pages) {
                for (const page of event.pages) {
                    if (page && page.image && page.image.direction) {
                        page.image.direction = transformedDirection(page.image.direction, normalizedRotation, mirrorX, mirrorY);
                    }
                }
            }
            return event;
        });
        output.transform = { rotation: normalizedRotation, mirrorX, mirrorY };
        return output;
    }

    function pasteArea(x, y, options = {}, clipboard = runtimeClipboard) {
        if (!clipboard || !clipboard.width || !clipboard.height) return false;
        clipboard = transformClipboard(clipboard, options);
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, clipboard.width, clipboard.height);
        const requested = options.layers ? parseLayerSelection(options.layers).layers : clipboard.layers;
        const layers = requested.filter(key => clipboard.layers.includes(key));
        const tiles = {};
        for (const key of layers) tiles[key] = (clipboard.tiles[key] || []).slice();
        const includeEvents = !!clipboard.includeEvents && (options.includeEvents === undefined
            ? true
            : toBoolean(options.includeEvents, false));
        const events = includeEvents ? (clipboard.events || []).map(source => {
            const event = prepareTargetEventSnapshot(source);
            event.x = rect.x + integer(source.x);
            event.y = rect.y + integer(source.y);
            return event;
        }) : [];
        if (!layers.length && !includeEvents) return false;
        if (WARN_MISMATCHED_TILESET && clipboard.tilesetId !== $dataMap.tilesetId) {
            console.warn(`${PLUGIN_NAME}: clipboard tileset mismatch (${clipboard.tilesetId} -> ${$dataMap.tilesetId}).`);
        }
        const patch = makeRectPatch(rect, layers, tiles, options.mode || "exact", {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "pasteArea");
        return patch;
    }

    function setTile(x, y, layer, tileValue, save = true, options = {}) {
        const tileId = parseTileId(tileValue);
        const key = normalizeLayer(layer);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        if (!inBounds(point.x, point.y)) return false;
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "exact") : "exact";
        const cell = {
            x: point.x,
            y: point.y,
            tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
        };
        const patch = makeSparsePatch([cell], mode, mode === "autotile" ? [point] : null);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "setTile");
        return patch;
    }

    function fillTiles(x, y, width, height, layer, tileValue, save = true, options = {}) {
        const tileId = parseTileId(tileValue);
        const key = normalizeLayer(layer);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const layers = [key];
        const tiles = { [key]: new Array(rect.w * rect.h).fill(tileId) };
        const z = LAYER_INDEX[key];
        if (toBoolean(options.clearUpperLayers, false) && z <= 3) {
            for (let upper = z + 1; upper <= 3; upper++) {
                const upperKey = `L${upper + 1}`;
                layers.push(upperKey);
                tiles[upperKey] = new Array(rect.w * rect.h).fill(0);
            }
        }
        const patchMode = LAYER_INDEX[key] <= 3 ? (options.mode || "exact") : "exact";
        const patch = makeRectPatch(rect, layers, tiles, patchMode);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "fillTiles");
        return patch;
    }

    function clearArea(x, y, width, height, layersValue, save = true, includeEvents = false, mode = "autotile") {
        const rect = normalizeRect(x, y, width, height);
        const selection = parseLayerSelection(layersValue);
        const affectEvents = includeEvents || selection.events;
        const tiles = {};
        for (const key of selection.layers) tiles[key] = new Array(rect.w * rect.h).fill(0);
        const patch = makeRectPatch(rect, selection.layers, tiles, mode, {
            affectEvents,
            events: [],
            removeEventIds: affectEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "clearArea");
        return patch;
    }

    function revertArea(x, y, width, height, layersValue, save = true, includeEvents = false) {
        if (!currentPristine || currentPristine.mapId !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: no pristine snapshot is available for this map.`);
            return false;
        }
        const rect = normalizeRect(x, y, width, height);
        const selection = parseLayerSelection(layersValue);
        const affectEvents = includeEvents || selection.events;
        const tiles = extractRegion(currentPristine, rect, selection.layers);
        const needsAutotile = selection.layers.some(key => LAYER_INDEX[key] <= 3);
        const patch = makeRectPatch(rect, selection.layers, tiles, needsAutotile ? "autotile" : "exact", {
            affectEvents,
            events: [],
            removeEventIds: affectEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "revertArea");
        return patch;
    }

    function undoLast(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const patches = store.maps[key];
        if (!patches || !patches.length) return false;
        store.redo[key] ||= [];
        store.redo[key].push(patches.pop());
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("undoLast");
        else emitChange({ operation: "undoLast", mapId: id, remote: true });
        return true;
    }

    function redoLast(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const redo = store.redo[key];
        if (!redo || !redo.length) return false;
        const patch = redo.pop();
        addPatch(id, patch, true);
        if (!redo.length) delete store.redo[key];
        if (id === $gameMap.mapId()) rebuildCurrentMap("redoLast");
        else emitChange({ operation: "redoLast", mapId: id, remote: true });
        return true;
    }

    function beginEditTransaction(label = "Edit Session", mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if (activeEditTransaction) return false;
        const store = ensureStore();
        const key = String(id);
        const patchesBefore = deepClone(store.maps[key] || []);
        const redoBefore = deepClone(store.redo[key] || []);
        const eventStatesBefore = deepClone(store.eventStates[key] || null);
        const mapOverrideBefore = deepClone(store.mapOverrides[key] || null);
        const snapshot = {
            mapId: id,
            label: String(label || "Edit Session"),
            startedAt: Date.now(),
            basePatchCount: patchesBefore.length,
            patchesBefore,
            redoBefore,
            eventStatesBefore,
            mapOverrideBefore
        };
        activeEditTransaction = snapshot;
        store.recovery[key] = deepClone(snapshot);
        store.redo[key] = [];
        emitChange({ operation: "beginTransaction", mapId: id, label: snapshot.label });
        return deepClone(snapshot);
    }

    function commitEditTransaction(groupChanges = true) {
        if (!activeEditTransaction) return false;
        const transaction = activeEditTransaction;
        const store = ensureStore();
        const key = String(transaction.mapId);
        const current = store.maps[key] || [];
        if (current.length < transaction.basePatchCount) return cancelEditTransaction();
        const before = current.slice(0, transaction.basePatchCount);
        const changes = current.slice(transaction.basePatchCount);
        if (groupChanges && changes.length > 1) {
            store.maps[key] = before.concat(makeBatchPatch(changes, transaction.label));
        } else {
            if (changes.length === 1) changes[0].label ||= transaction.label;
            store.maps[key] = before.concat(changes);
        }
        delete store.redo[key];
        delete store.recovery[key];
        activeEditTransaction = null;
        composedCache.delete(transaction.mapId);
        if (AUTO_CHECKPOINT_EVERY > 0 && store.maps[key] && store.maps[key].length > 0 &&
            store.maps[key].length % AUTO_CHECKPOINT_EVERY === 0) createAutomaticCheckpoint(transaction.mapId);
        emitChange({
            operation: "commitTransaction",
            mapId: transaction.mapId,
            label: transaction.label,
            groupedPatchCount: changes.length,
            historyPatchCount: store.maps[key].length
        });
        return { mapId: transaction.mapId, label: transaction.label, changes: changes.length };
    }

    function restoreHistorySnapshot(snapshot, operation) {
        if (!snapshot) return false;
        const store = ensureStore();
        const id = integer(snapshot.mapId);
        const key = String(id);
        if (snapshot.patchesBefore && snapshot.patchesBefore.length) store.maps[key] = deepClone(snapshot.patchesBefore);
        else delete store.maps[key];
        if (snapshot.redoBefore && snapshot.redoBefore.length) store.redo[key] = deepClone(snapshot.redoBefore);
        else delete store.redo[key];
        if (snapshot.eventStatesBefore) store.eventStates[key] = deepClone(snapshot.eventStatesBefore);
        else delete store.eventStates[key];
        if (snapshot.mapOverrideBefore) store.mapOverrides[key] = deepClone(snapshot.mapOverrideBefore);
        else delete store.mapOverrides[key];
        delete store.recovery[key];
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap(operation);
        else emitChange({ operation, mapId: id, remote: true });
        return true;
    }

    function cancelEditTransaction() {
        if (!activeEditTransaction) return false;
        const transaction = activeEditTransaction;
        activeEditTransaction = null;
        const restored = restoreHistorySnapshot(transaction, "cancelTransaction");
        return restored ? { mapId: transaction.mapId, label: transaction.label } : false;
    }

    function editTransactionState() {
        if (!activeEditTransaction) return null;
        const store = ensureStore();
        const key = String(activeEditTransaction.mapId);
        return Object.assign({}, deepClone(activeEditTransaction), {
            changeCount: Math.max(0, (store.maps[key] || []).length - activeEditTransaction.basePatchCount),
            undoCount: (store.redo[key] || []).length
        });
    }

    function undoTransactionChange() {
        if (!activeEditTransaction) return false;
        const key = String(activeEditTransaction.mapId);
        if ((ensureStore().maps[key] || []).length <= activeEditTransaction.basePatchCount) return false;
        return undoLast(activeEditTransaction.mapId);
    }

    function redoTransactionChange() {
        if (!activeEditTransaction) return false;
        return redoLast(activeEditTransaction.mapId);
    }

    function recoverEditTransaction(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const recovery = ensureStore().recovery[String(id)];
        if (!recovery) return false;
        if (activeEditTransaction && activeEditTransaction.mapId === id) activeEditTransaction = null;
        return restoreHistorySnapshot(recovery, "recoverTransaction");
    }

    function discardEditRecovery(mapId = $gameMap.mapId()) {
        const key = String(integer(mapId));
        const existed = !!ensureStore().recovery[key];
        delete ensureStore().recovery[key];
        return existed;
    }

    function createCheckpoint(name, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const label = String(name || "Checkpoint").trim() || "Checkpoint";
        const store = ensureStore();
        const key = String(id);
        store.checkpoints[key] ||= {};
        store.checkpoints[key][label] = {
            name: label,
            mapId: id,
            createdAt: Date.now(),
            automatic: toBoolean(options.automatic, false),
            patches: deepClone(store.maps[key] || []),
            redo: deepClone(store.redo[key] || []),
            eventStates: deepClone(store.eventStates[key] || null),
            mapOverride: deepClone(store.mapOverrides[key] || null),
            authoringLayers: deepClone(store.authoringLayers[key] || []),
            activeAuthoringLayer: store.activeAuthoringLayers[key] || null,
            masks: deepClone(store.masks[key] || {}),
            modifiers: deepClone(store.modifiers[key] || []),
            prefabInstances: deepClone(store.prefabInstances[key] || [])
        };
        return { name: label, mapId: id, createdAt: store.checkpoints[key][label].createdAt };
    }

    function listCheckpoints(mapId = $gameMap.mapId()) {
        const bucket = ensureStore().checkpoints[String(integer(mapId))] || {};
        return Object.values(bucket).map(item => ({ name: item.name, mapId: item.mapId,
            createdAt: item.createdAt, automatic: !!item.automatic }))
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    function restoreCheckpoint(name, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const key = String(id);
        const checkpoint = (ensureStore().checkpoints[key] || {})[String(name || "")];
        if (!checkpoint) return false;
        const store = ensureStore();
        if (checkpoint.patches && checkpoint.patches.length) store.maps[key] = deepClone(checkpoint.patches);
        else delete store.maps[key];
        if (checkpoint.redo && checkpoint.redo.length) store.redo[key] = deepClone(checkpoint.redo);
        else delete store.redo[key];
        if (checkpoint.eventStates) store.eventStates[key] = deepClone(checkpoint.eventStates);
        else delete store.eventStates[key];
        if (checkpoint.mapOverride) store.mapOverrides[key] = deepClone(checkpoint.mapOverride);
        else delete store.mapOverrides[key];
        if (checkpoint.authoringLayers && checkpoint.authoringLayers.length) store.authoringLayers[key] = deepClone(checkpoint.authoringLayers);
        else delete store.authoringLayers[key];
        if (checkpoint.activeAuthoringLayer) store.activeAuthoringLayers[key] = checkpoint.activeAuthoringLayer;
        else delete store.activeAuthoringLayers[key];
        if (checkpoint.masks && Object.keys(checkpoint.masks).length) store.masks[key] = deepClone(checkpoint.masks);
        else delete store.masks[key];
        if (checkpoint.modifiers && checkpoint.modifiers.length) store.modifiers[key] = deepClone(checkpoint.modifiers);
        else delete store.modifiers[key];
        if (checkpoint.prefabInstances && checkpoint.prefabInstances.length) store.prefabInstances[key] = deepClone(checkpoint.prefabInstances);
        else delete store.prefabInstances[key];
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("restoreCheckpoint");
        else emitChange({ operation: "restoreCheckpoint", mapId: id, remote: true, checkpoint: checkpoint.name });
        return true;
    }

    function deleteCheckpoint(name, mapId = $gameMap.mapId()) {
        const key = String(integer(mapId));
        const bucket = ensureStore().checkpoints[key];
        if (!bucket || !bucket[String(name || "")]) return false;
        delete bucket[String(name || "")];
        if (!Object.keys(bucket).length) delete ensureStore().checkpoints[key];
        return true;
    }

    function resetMap(mapId = $gameMap.mapId(), save = true) {
        const id = integer(mapId);
        if (save !== false) {
            delete ensureStore().maps[String(id)];
            delete ensureStore().redo[String(id)];
            delete ensureStore().recovery[String(id)];
            delete ensureStore().mapOverrides[String(id)];
            delete ensureStore().authoringLayers[String(id)];
            delete ensureStore().activeAuthoringLayers[String(id)];
            delete ensureStore().masks[String(id)];
            delete ensureStore().modifiers[String(id)];
            delete ensureStore().prefabInstances[String(id)];
            composedCache.delete(id);
        }
        if (id === $gameMap.mapId()) {
            if (save === false) {
                const saved = ensureStore().maps[String(id)];
                ensureStore().maps[String(id)] = [];
                rebuildCurrentMap("temporaryReset");
                ensureStore().maps[String(id)] = saved || [];
            } else {
                rebuildCurrentMap("resetMap");
            }
        }
        return true;
    }

    function changeRegionId(x, y, regionId, save = true) {
        return setTile(x, y, "L6", Math.max(0, integer(regionId)), save, { mode: "exact" });
    }

    function changeTile(x, y, z, tileId, save = true, options = {}) {
        return setTile(x, y, z, tileId, save, options);
    }

    function swapArea(mapId, sourceX, sourceY, width, height, targetX, targetY, changeRegion = true, save = true, options = {}) {
        return graftArea(Object.assign({}, options, {
            sourceMapId: mapId,
            sourceX,
            sourceY,
            width,
            height,
            targetX,
            targetY,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

    function swapAreaAsync(mapId, sourceX, sourceY, width, height, targetX, targetY, changeRegion = true, save = true, options = {}) {
        return graftAreaAsync(Object.assign({}, options, {
            sourceMapId: mapId,
            sourceX,
            sourceY,
            width,
            height,
            targetX,
            targetY,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

    function swapTile(mapId, targetX, targetY, sourceX, sourceY, changeRegion = true, save = true, options = {}) {
        return swapArea(mapId, sourceX, sourceY, 1, 1, targetX, targetY, changeRegion, save, options);
    }

    function swapTileAsync(mapId, targetX, targetY, sourceX, sourceY, changeRegion = true, save = true, options = {}) {
        return swapAreaAsync(mapId, sourceX, sourceY, 1, 1, targetX, targetY, changeRegion, save, options);
    }

    function usePrefab(name, x, y, changeRegion = true, save = true, storageMapId = 0, options = {}) {
        return graftPrefab(Object.assign({}, options, {
            name,
            storageMapId,
            targetX: x,
            targetY: y,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

