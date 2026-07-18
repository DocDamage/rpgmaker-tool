    // -------------------------------------------------------------------------
    // Tile codes and queries
    // -------------------------------------------------------------------------

    function tileIdFromCode(value) {
        if (typeof value === "number") return integer(value);
        const text = String(value ?? "").trim();
        if (/^-?\d+$/.test(text)) return integer(text);
        const match = text.match(/^([A-E])\s*(\d+)(?:\s*,\s*(\d+))?$/i);
        if (!match) return NaN;
        const sheet = match[1].toUpperCase();
        const number = match[3] === undefined ? Number(match[2]) : Number(match[3]) * 8 + Number(match[2]);
        if (number < 0 || number > 255) return NaN;
        if (sheet === "A") {
            return number < 128 ? Tilemap.TILE_ID_A1 + number * 48 : Tilemap.TILE_ID_A5 + number - 128;
        }
        const bases = {
            B: Tilemap.TILE_ID_B,
            C: Tilemap.TILE_ID_C,
            D: Tilemap.TILE_ID_D,
            E: Tilemap.TILE_ID_E
        };
        return bases[sheet] + number;
    }

    function tileCodeFromId(value) {
        const tileId = integer(value);
        const maxTileId = Tilemap.TILE_ID_MAX || 8192;
        if (tileId >= Tilemap.TILE_ID_A1 && tileId < maxTileId) {
            const kind = Math.floor((tileId - Tilemap.TILE_ID_A1) / 48);
            return `A${kind % 8},${Math.floor(kind / 8)}`;
        }
        if (tileId >= Tilemap.TILE_ID_A5 && tileId < Tilemap.TILE_ID_A5 + 128) {
            const number = tileId - Tilemap.TILE_ID_A5 + 128;
            return `A${number % 8},${Math.floor(number / 8)}`;
        }
        const ranges = [
            ["E", Tilemap.TILE_ID_E],
            ["D", Tilemap.TILE_ID_D],
            ["C", Tilemap.TILE_ID_C],
            ["B", Tilemap.TILE_ID_B]
        ];
        for (const [sheet, base] of ranges) {
            if (tileId >= base && tileId < base + 256) {
                const number = tileId - base;
                return `${sheet}${number % 8},${Math.floor(number / 8)}`;
            }
        }
        return "";
    }

    function parseTileId(value) {
        const tileId = tileIdFromCode(value);
        if (!Number.isFinite(tileId) || tileId < 0) {
            console.warn(`${PLUGIN_NAME}: invalid tile ID or code:`, value);
            return null;
        }
        return integer(tileId);
    }

    function tileSheetIndexForId(tileId) {
        if (tileId === 0) return -1;
        if (tileId >= Tilemap.TILE_ID_B && tileId < Tilemap.TILE_ID_C) return 5;
        if (tileId >= Tilemap.TILE_ID_C && tileId < Tilemap.TILE_ID_D) return 6;
        if (tileId >= Tilemap.TILE_ID_D && tileId < Tilemap.TILE_ID_E) return 7;
        if (tileId >= Tilemap.TILE_ID_E && tileId < Tilemap.TILE_ID_E + 256) return 8;
        if (tileId >= Tilemap.TILE_ID_A5 && tileId < Tilemap.TILE_ID_A5 + 128) return 4;
        const a2 = Tilemap.TILE_ID_A2 || 2816;
        const a3 = Tilemap.TILE_ID_A3 || 4352;
        const a4 = Tilemap.TILE_ID_A4 || 5888;
        const maxTileId = Tilemap.TILE_ID_MAX || 8192;
        if (tileId >= Tilemap.TILE_ID_A1 && tileId < a2) return 0;
        if (tileId >= a2 && tileId < a3) return 1;
        if (tileId >= a3 && tileId < a4) return 2;
        if (tileId >= a4 && tileId < maxTileId) return 3;
        return null;
    }

    function tileIdExists(tileId, tilesetId = $dataMap.tilesetId) {
        if (!STRICT_TILE_VALIDATION || tileId === 0) return true;
        const index = tileSheetIndexForId(tileId);
        if (index === null) return false;
        if (typeof $dataTilesets === "undefined" || !$dataTilesets || !$dataTilesets[tilesetId]) return true;
        if (index < 0) return true;
        const name = $dataTilesets[tilesetId].tilesetNames[index];
        return !!String(name || "").trim();
    }

    function validateTileId(tileId, tilesetId = $dataMap.tilesetId) {
        if (tileIdExists(tileId, tilesetId)) return true;
        console.warn(`${PLUGIN_NAME}: tile ${tileId} (${tileCodeFromId(tileId)}) belongs to a sheet missing from tileset ${tilesetId}.`);
        return false;
    }

    function validateLayerValue(value, layer, tilesetId = $dataMap.tilesetId) {
        const key = normalizeLayer(layer);
        if (key === "L5") {
            const valid = value >= 0 && value <= 15;
            if (!valid) console.warn(`${PLUGIN_NAME}: shadow bits must be between 0 and 15.`);
            return valid;
        }
        if (key === "L6") {
            const valid = value >= 0 && value <= 255;
            if (!valid) console.warn(`${PLUGIN_NAME}: region IDs must be between 0 and 255.`);
            return valid;
        }
        return validateTileId(value, tilesetId);
    }

    function getTileId(x, y, layer = "L1") {
        const key = normalizeLayer(layer);
        return readTile($dataMap.data, $dataMap.width, $dataMap.height, integer(x), integer(y), LAYER_INDEX[key]);
    }

    function tileCodeAt(x, y, layer = "L1") {
        return tileCodeFromId(getTileId(x, y, layer));
    }

    function inspectTile(x, y, options = {}) {
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const info = {
            mapId: $gameMap.mapId(),
            x: point.x,
            y: point.y,
            valid: inBounds(point.x, point.y),
            layers: {},
            shadowBits: 0,
            regionId: 0,
            terrainTag: 0,
            properties: []
        };
        if (!info.valid) return info;
        for (let z = 0; z <= 3; z++) {
            const key = `L${z + 1}`;
            const tileId = getTileId(point.x, point.y, key);
            info.layers[key] = {
                tileId,
                tileCode: tileCodeFromId(tileId),
                autotileKind: Tilemap.isAutotile(tileId) ? Tilemap.getAutotileKind(tileId) : -1,
                autotileShape: Tilemap.isAutotile(tileId)
                    ? (Tilemap.getAutotileShape ? Tilemap.getAutotileShape(tileId) : (tileId - Tilemap.TILE_ID_A1) % 48)
                    : -1
            };
        }
        info.shadowBits = getTileId(point.x, point.y, "L5");
        info.regionId = getTileId(point.x, point.y, "L6");
        if ($gameMap.terrainTag) info.terrainTag = $gameMap.terrainTag(point.x, point.y);
        const properties = [
            ["ladder", "isLadder"],
            ["bush", "isBush"],
            ["counter", "isCounter"],
            ["damageFloor", "isDamageFloor"]
        ];
        for (const [label, method] of properties) {
            if ($gameMap[method] && $gameMap[method](point.x, point.y)) info.properties.push(label);
        }
        return info;
    }

    function logTileInfo(x = $gamePlayer.x, y = $gamePlayer.y, options = {}) {
        const info = inspectTile(x, y, options);
        if (!info.valid) {
            console.warn(`${PLUGIN_NAME}: tile inspection is outside the current map.`, info);
            return info;
        }
        const lines = [`${PLUGIN_NAME} Tile Info — Map ${info.mapId} (${info.x}, ${info.y})`];
        for (const [layer, data] of Object.entries(info.layers)) {
            lines.push(`${layer}: ID ${data.tileId}, Code ${data.tileCode || "n/a"}, Autotile ${data.autotileKind}, Shape ${data.autotileShape}`);
        }
        lines.push(`Shadow: ${info.shadowBits} (0b${info.shadowBits.toString(2)})`);
        lines.push(`Region: ${info.regionId}; Terrain: ${info.terrainTag}; Properties: ${info.properties.join(", ") || "none"}`);
        console.log(lines.join("\n"));
        return info;
    }

    function tileIdInList(tileValues, x = $gamePlayer.x, y = $gamePlayer.y, layer = "L1") {
        const tileId = getTileId(x, y, layer);
        return normalizeList(tileValues).map(parseTileId).filter(value => value !== null).includes(tileId);
    }

    function autotileInList(tileValues, x = $gamePlayer.x, y = $gamePlayer.y, layer = "L1") {
        const tileId = getTileId(x, y, layer);
        if (!Tilemap.isAutotile(tileId)) return false;
        const kind = Tilemap.getAutotileKind(tileId);
        return normalizeList(tileValues).map(value => {
            const parsed = parseTileId(value);
            return parsed !== null && Tilemap.isAutotile(parsed) ? Tilemap.getAutotileKind(parsed) : integer(value, -1);
        }).includes(kind);
    }

    function pointAhead(distance = 1) {
        let x = $gamePlayer.x;
        let y = $gamePlayer.y;
        const direction = $gamePlayer.direction();
        for (let step = 0; step < Math.max(0, integer(distance, 1)); step++) {
            if ($gameMap.xWithDirection && $gameMap.yWithDirection) {
                x = $gameMap.xWithDirection(x, direction);
                y = $gameMap.yWithDirection(y, direction);
            } else {
                const shift = directionShift(direction, 1, 0);
                x += shift.x;
                y += shift.y;
            }
        }
        return { x, y };
    }

    function tileAhead(tileValues, distance = 1, layer = "L1") {
        const point = pointAhead(distance);
        return tileIdInList(tileValues, point.x, point.y, layer);
    }

    function autotileAhead(tileValues, distance = 1, layer = "L1") {
        const point = pointAhead(distance);
        return autotileInList(tileValues, point.x, point.y, layer);
    }

    function sameTileType(first, second) {
        if (first === second) return true;
        if (!Tilemap.isAutotile(first) || !Tilemap.isAutotile(second)) return false;
        return Tilemap.getAutotileKind(first) === Tilemap.getAutotileKind(second);
    }

    // -------------------------------------------------------------------------
    // Map loading and caches
    // -------------------------------------------------------------------------

    function loadPristineMapData(mapId, forceRefresh = false) {
        const id = positiveInteger(mapId);
        if (forceRefresh) {
            pristineCache.delete(id);
            composedCache.delete(id);
            pendingLoads.delete(id);
        }
        if (pristineCache.has(id)) return Promise.resolve(pristineCache.get(id));
        if (pendingLoads.has(id)) return pendingLoads.get(id);
        const promise = new Promise((resolve, reject) => {
            const url = `data/Map${String(id).padStart(3, "0")}.json`;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.overrideMimeType("application/json");
            xhr.onload = () => {
                if (xhr.status >= 400) {
                    reject(new Error(`${PLUGIN_NAME}: failed to load ${url} (HTTP ${xhr.status}).`));
                    return;
                }
                try {
                    const json = JSON.parse(xhr.responseText);
                    const entry = {
                        width: json.width,
                        height: json.height,
                        data: json.data.slice(),
                        tilesetId: json.tilesetId,
                        note: json.note || "",
                        events: deepClone(json.events || []),
                        raw: deepClone(json)
                    };
                    pristineCache.set(id, entry);
                    resolve(entry);
                } catch (error) {
                    reject(new Error(`${PLUGIN_NAME}: invalid JSON in ${url}: ${error.message}`));
                }
            };
            xhr.onerror = () => reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
            xhr.send();
        }).finally(() => pendingLoads.delete(id));
        pendingLoads.set(id, promise);
        return promise;
    }

    function buildComposedSnapshot(mapId, pristineEntry) {
        const override = ensureStore().mapOverrides[String(integer(mapId))];
        const base = override || pristineEntry;
        const snapshot = {
            width: base.width,
            height: base.height,
            data: base.data.slice(),
            tilesetId: base.tilesetId,
            note: base.note || "",
            events: []
        };
        const patches = composedPatchesForMap(mapId);
        for (const patch of patches) applyPatchToBuffer(patch, snapshot.data, snapshot.width, snapshot.height, true);
        snapshot.events = composeEvents(base.events, patches, mapId);
        applySavedPositionsToEventData(snapshot.events, mapId);
        return snapshot;
    }

    function preloadMap(mapId, forceRefresh = false) {
        const id = positiveInteger(mapId);
        if (!forceRefresh && composedCache.has(id)) return Promise.resolve(composedCache.get(id));
        return loadPristineMapData(id, forceRefresh).then(entry => {
            const snapshot = buildComposedSnapshot(id, entry);
            composedCache.set(id, snapshot);
            return snapshot;
        });
    }

    function currentEventSnapshots() {
        if (!$gameMap || !$gameMap.events) return deepClone($dataMap.events || []);
        const output = [];
        for (const gameEvent of $gameMap.events()) {
            if (!gameEvent || !gameEvent.event) continue;
            const data = deepClone(gameEvent.event());
            if (!data) continue;
            data.x = gameEvent.x;
            data.y = gameEvent.y;
            output[data.id] = data;
        }
        return output;
    }

    function getSourceMapData(mapId) {
        const id = integer(mapId) === 0 ? $gameMap.mapId() : positiveInteger(mapId);
        if (id === $gameMap.mapId()) {
            return {
                width: $dataMap.width,
                height: $dataMap.height,
                data: $dataMap.data,
                tilesetId: $dataMap.tilesetId,
                note: $dataMap.note || "",
                events: currentEventSnapshots()
            };
        }
        if (composedCache.has(id)) return composedCache.get(id);
        console.warn(`${PLUGIN_NAME}: source map ${id} is not preloaded. Use preloadMap() or an async graft call.`);
        return null;
    }

    // -------------------------------------------------------------------------
    // Patch data and autotiles
    // -------------------------------------------------------------------------

    function makeRectPatch(rect, layers, tiles, mode = "exact", eventOptions = {}) {
        return {
            version: 2,
            kind: "rect",
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            layers: layers.slice(),
            tiles,
            mode: normalizeMode(mode),
            affectEvents: !!eventOptions.affectEvents,
            events: eventOptions.affectEvents ? (eventOptions.events || []) : null,
            removeEventIds: eventOptions.affectEvents
                ? (eventOptions.removeEventIds || []).map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET)
                : []
        };
    }

    function makeSparsePatch(cells, mode = "exact", recalcCells = null) {
        const layers = [];
        for (const cell of cells) {
            for (const key of Object.keys(cell.tiles || {})) {
                if (LAYER_INDEX[key] !== undefined && !layers.includes(key)) layers.push(key);
            }
        }
        return {
            version: 2,
            kind: "sparse",
            cells,
            layers,
            mode: normalizeMode(mode),
            recalcCells: recalcCells ? recalcCells.map(p => ({ x: integer(p.x), y: integer(p.y) })) : null,
            affectEvents: false,
            events: null
        };
    }

    function makeBatchPatch(patches, label = "Edit Session") {
        return {
            version: 3,
            kind: "batch",
            label: String(label || "Edit Session"),
            patches: (patches || []).map(deepClone),
            createdAt: Date.now()
        };
    }

    function makeEventPatch(events = [], removeEventIds = [], label = "Event Edit", options = {}) {
        const points = events.map(event => ({ x: integer(event.x), y: integer(event.y) }));
        const rect = points.length
            ? unionRects(points.map(point => ({ x: point.x, y: point.y, w: 1, h: 1 })))
            : { x: 0, y: 0, w: 0, h: 0 };
        return {
            version: 3,
            kind: "events",
            label,
            cells: [],
            layers: [],
            mode: "exact",
            affectEvents: true,
            replaceAreaEvents: false,
            preserveEventState: toBoolean(options.preserveEventState, false),
            eventRect: rect,
            events: events.map(deepClone),
            removeEventIds: removeEventIds.map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET)
        };
    }

    function flattenPatches(patches) {
        const output = [];
        for (const patch of patches || []) {
            if (patch && patch.kind === "batch") output.push(...flattenPatches(patch.patches));
            else if (patch) output.push(patch);
        }
        return output;
    }

    function unionRects(rects) {
        const valid = (rects || []).filter(rect => rect && rect.w > 0 && rect.h > 0);
        if (!valid.length) return { x: 0, y: 0, w: 0, h: 0 };
        const x1 = Math.min(...valid.map(rect => rect.x));
        const y1 = Math.min(...valid.map(rect => rect.y));
        const x2 = Math.max(...valid.map(rect => rect.x + rect.w));
        const y2 = Math.max(...valid.map(rect => rect.y + rect.h));
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }

    function patchRect(patch) {
        if (patch && patch.kind === "batch") return unionRects((patch.patches || []).map(patchRect));
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            const cells = patch.cells || [];
            if (!cells.length) return { x: 0, y: 0, w: 0, h: 0 };
            const xs = cells.map(cell => integer(cell.x));
            const ys = cells.map(cell => integer(cell.y));
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return { x: minX, y: minY, w: Math.max(...xs) - minX + 1, h: Math.max(...ys) - minY + 1 };
        }
        return normalizeRect(patch.x, patch.y, patch.w, patch.h);
    }

    function eventPatchRect(patch) {
        if (patch.eventRect) {
            return normalizeRect(patch.eventRect.x, patch.eventRect.y, patch.eventRect.w, patch.eventRect.h);
        }
        return patchRect(patch);
    }

    function applyPatchTiles(patch, data, width, height) {
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            for (const cell of patch.cells || []) {
                const x = integer(cell.x);
                const y = integer(cell.y);
                for (const [key, value] of Object.entries(cell.tiles || {})) {
                    const z = LAYER_INDEX[key];
                    if (z !== undefined) writeTile(data, width, height, x, y, z, value);
                }
            }
            return;
        }
        const rect = normalizeRect(patch.x, patch.y, patch.w, patch.h);
        const layers = parseLayerSelection(patch.layers || []).layers;
        for (const key of layers) {
            const z = LAYER_INDEX[key];
            const layerData = patch.tiles && patch.tiles[key];
            if (!layerData) continue;
            for (let dy = 0; dy < rect.h; dy++) {
                for (let dx = 0; dx < rect.w; dx++) {
                    writeTile(data, width, height, rect.x + dx, rect.y + dy, z, layerData[dy * rect.w + dx] || 0);
                }
            }
        }
    }

    function autotileSeedCells(patch) {
        if (Array.isArray(patch.recalcCells)) return patch.recalcCells;
        if (normalizeMode(patch.mode) !== "autotile") return [];
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            return (patch.cells || []).map(cell => ({ x: integer(cell.x), y: integer(cell.y) }));
        }
        const rect = normalizeRect(patch.x, patch.y, patch.w, patch.h);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y });
        }
        return cells;
    }

    function applyPatchToBuffer(patch, data, width, height, recalc = true) {
        if (patch && patch.kind === "batch") {
            for (const child of patch.patches || []) applyPatchToBuffer(child, data, width, height, recalc);
            return;
        }
        applyPatchTiles(patch, data, width, height);
        if (recalc) recalcAutotilesAround(data, width, height, autotileSeedCells(patch));
    }

    function recalcAutotilesAround(data, width, height, seeds) {
        if (!seeds || !seeds.length) return;
        const locations = new Set();
        for (const seed of seeds) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const x = integer(seed.x) + dx;
                    const y = integer(seed.y) + dy;
                    if (inBounds(x, y, width, height)) locations.add(`${x},${y}`);
                }
            }
        }
        for (const location of locations) {
            const [x, y] = location.split(",").map(Number);
            for (let z = 0; z <= 3; z++) {
                const tileId = readTile(data, width, height, x, y, z);
                if (!Tilemap.isAutotile(tileId)) continue;
                const kind = Tilemap.getAutotileKind(tileId);
                const baseTileId = Tilemap.makeAutotileId(kind, 0);
                const n = autotileNeighborConnects(data, width, height, x, y - 1, z, kind);
                const e = autotileNeighborConnects(data, width, height, x + 1, y, z, kind);
                const s = autotileNeighborConnects(data, width, height, x, y + 1, z, kind);
                const w = autotileNeighborConnects(data, width, height, x - 1, y, z, kind);
                let shape;
                if (Tilemap.isWaterfallTile(baseTileId)) {
                    shape = waterfallAutotileShape(e, w);
                } else if (Tilemap.isTileA3(baseTileId) || Tilemap.isWallSideTile(baseTileId)) {
                    shape = wallSideAutotileShape(n, e, s, w);
                } else {
                    const nw = autotileNeighborConnects(data, width, height, x - 1, y - 1, z, kind);
                    const ne = autotileNeighborConnects(data, width, height, x + 1, y - 1, z, kind);
                    const se = autotileNeighborConnects(data, width, height, x + 1, y + 1, z, kind);
                    const sw = autotileNeighborConnects(data, width, height, x - 1, y + 1, z, kind);
                    shape = floorAutotileShape(n, e, s, w, nw, ne, se, sw);
                }
                writeTile(data, width, height, x, y, z, Tilemap.makeAutotileId(kind, shape));
            }
        }
    }

    function autotileNeighborConnects(data, width, height, x, y, z, kind) {
        if (!inBounds(x, y, width, height)) return true;
        const tileId = readTile(data, width, height, x, y, z);
        return Tilemap.isAutotile(tileId) && Tilemap.getAutotileKind(tileId) === kind;
    }

    // Shape ordering follows RPG Maker MZ's 48-ID autotile blocks. The same
    // independently exposed algorithm is used by Tyruswoo Tile Control (MIT).
    function floorAutotileShape(n, e, s, w, nw, ne, se, sw) {
        let shape = 0;
        if (n && e && s && w) {
            if (!nw) shape += 1;
            if (!ne) shape += 2;
            if (!se) shape += 4;
            if (!sw) shape += 8;
        } else if (n && e && s && !w) {
            shape = 16 + (!ne ? 1 : 0) + (!se ? 2 : 0);
        } else if (!n && e && s && w) {
            shape = 20 + (!se ? 1 : 0) + (!sw ? 2 : 0);
        } else if (n && !e && s && w) {
            shape = 24 + (!sw ? 1 : 0) + (!nw ? 2 : 0);
        } else if (n && e && !s && w) {
            shape = 28 + (!nw ? 1 : 0) + (!ne ? 2 : 0);
        } else if (n && !e && s && !w) shape = 32;
        else if (!n && e && !s && w) shape = 33;
        else if (!n && e && s && !w) shape = 34 + (!se ? 1 : 0);
        else if (!n && !e && s && w) shape = 36 + (!sw ? 1 : 0);
        else if (n && !e && !s && w) shape = 38 + (!nw ? 1 : 0);
        else if (n && e && !s && !w) shape = 40 + (!ne ? 1 : 0);
        else if (!n && !e && s && !w) shape = 42;
        else if (!n && e && !s && !w) shape = 43;
        else if (n && !e && !s && !w) shape = 44;
        else if (!n && !e && !s && w) shape = 45;
        else shape = 46;
        return shape;
    }

    function wallSideAutotileShape(n, e, s, w) {
        return (!w ? 1 : 0) + (!n ? 2 : 0) + (!e ? 4 : 0) + (!s ? 8 : 0);
    }

    function waterfallAutotileShape(e, w) {
        if (e && !w) return 1;
        if (!e && w) return 2;
        if (!e && !w) return 3;
        return 0;
    }

