    // -------------------------------------------------------------------------
    // Procedural brushes and generators
    // -------------------------------------------------------------------------

    function seededRandom(seed = Date.now()) {
        let value = 2166136261 >>> 0;
        for (const character of String(seed)) {
            value ^= character.charCodeAt(0);
            value = Math.imul(value, 16777619);
        }
        return () => {
            value += 0x6D2B79F5;
            let result = value;
            result = Math.imul(result ^ result >>> 15, result | 1);
            result ^= result + Math.imul(result ^ result >>> 7, result | 61);
            return ((result ^ result >>> 14) >>> 0) / 4294967296;
        };
    }

    function coordinateNoise(x, y, seed = 0, scale = 1) {
        const sx = Math.floor(finiteNumber(x) / Math.max(0.001, finiteNumber(scale, 1)));
        const sy = Math.floor(finiteNumber(y) / Math.max(0.001, finiteNumber(scale, 1)));
        let hash = Math.imul(sx ^ integer(seed), 374761393) + Math.imul(sy, 668265263);
        hash = (hash ^ hash >>> 13) >>> 0;
        hash = Math.imul(hash, 1274126177) >>> 0;
        return ((hash ^ hash >>> 16) >>> 0) / 4294967295;
    }

    function maskBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.masks[key] ||= {};
        return store.masks[key] || {};
    }

    function normalizeMaskPoints(points, width = $dataMap.width, height = $dataMap.height) {
        const output = [];
        const seen = new Set();
        for (const point of points || []) {
            const x = integer(Array.isArray(point) ? point[0] : point.x);
            const y = integer(Array.isArray(point) ? point[1] : point.y);
            const key = coordinateKey(x, y);
            if (!seen.has(key) && inBounds(x, y, width, height)) {
                seen.add(key);
                output.push([x, y]);
            }
        }
        return output;
    }

    function createMask(name, points, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const label = String(name || "Mask").trim() || "Mask";
        const source = id === $gameMap.mapId() ? $dataMap : pristineCache.get(id) || composedCache.get(id);
        const width = source ? source.width : positiveInteger(options.width, 1);
        const height = source ? source.height : positiveInteger(options.height, 1);
        const mask = {
            id: String(options.id || `mask-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: label,
            mapId: id,
            width,
            height,
            points: normalizeMaskPoints(points, width, height),
            inverted: toBoolean(options.inverted, false),
            color: String(options.color || "#ffd166"),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        maskBucket(id, true)[mask.id] = mask;
        return deepClone(mask);
    }

    function createRectMask(name, x, y, width, height, mapId = $gameMap.mapId(), options = {}) {
        const rect = normalizeRect(x, y, width, height);
        const points = [];
        for (let py = rect.y; py < rect.y + rect.h; py++) for (let px = rect.x; px < rect.x + rect.w; px++) points.push([px, py]);
        return createMask(name, points, mapId, options);
    }

    function createRegionMask(name, regionIds, options = {}) {
        const mapId = integer(options.mapId, $gameMap.mapId());
        const source = mapId === $gameMap.mapId() ? getSourceMapData(mapId) : composedCache.get(mapId);
        if (!source) return false;
        const regions = new Set(normalizeList(regionIds).map(Number));
        const points = [];
        for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
            if (regions.has(readTile(source.data, source.width, source.height, x, y, 5))) points.push([x, y]);
        }
        return createMask(name, points, mapId, options);
    }

    function listMasks(mapId = $gameMap.mapId()) {
        return Object.values(maskBucket(mapId)).map(mask => Object.assign(deepClone(mask), { cellCount: (mask.points || []).length }));
    }

    function resolveMask(maskOrName, mapId = $gameMap.mapId()) {
        if (!maskOrName) return null;
        if (typeof maskOrName === "object" && Array.isArray(maskOrName.points)) return maskOrName;
        const query = String(maskOrName).toLowerCase();
        return Object.values(maskBucket(mapId)).find(mask => mask.id === String(maskOrName) || mask.name.toLowerCase() === query) || null;
    }

    function maskContains(maskOrName, x, y, mapId = $gameMap.mapId()) {
        const mask = resolveMask(maskOrName, mapId);
        if (!mask) return false;
        if (!mask._pointSet) Object.defineProperty(mask, "_pointSet", {
            value: new Set((mask.points || []).map(point => coordinateKey(point[0], point[1]))),
            writable: true,
            configurable: true,
            enumerable: false
        });
        const contains = mask._pointSet.has(coordinateKey(integer(x), integer(y)));
        return mask.inverted ? !contains : contains;
    }

    function updateMask(maskId, changes = {}, mapId = $gameMap.mapId()) {
        const mask = resolveMask(maskId, mapId);
        if (!mask) return false;
        if (changes.name !== undefined) mask.name = String(changes.name || mask.name);
        if (changes.color !== undefined) mask.color = String(changes.color || mask.color);
        if (changes.inverted !== undefined) mask.inverted = toBoolean(changes.inverted, false);
        if (changes.points !== undefined) {
            mask.points = normalizeMaskPoints(changes.points, mask.width, mask.height);
            if (mask._pointSet) mask._pointSet = new Set(mask.points.map(point => coordinateKey(point[0], point[1])));
        }
        mask.updatedAt = Date.now();
        return deepClone(mask);
    }

    function combineMasks(name, firstMask, secondMask, operation = "union", mapId = $gameMap.mapId()) {
        const first = resolveMask(firstMask, mapId);
        const second = resolveMask(secondMask, mapId);
        if (!first || !second) return false;
        const a = new Set((first.points || []).map(point => coordinateKey(point[0], point[1])));
        const b = new Set((second.points || []).map(point => coordinateKey(point[0], point[1])));
        const keys = operation === "intersect" ? [...a].filter(key => b.has(key))
            : operation === "subtract" ? [...a].filter(key => !b.has(key))
                : [...new Set([...a, ...b])];
        return createMask(name, keys.map(key => key.split(",").map(Number)), mapId, { color: first.color });
    }

    function deleteMask(maskId, mapId = $gameMap.mapId()) {
        const bucket = maskBucket(mapId);
        const mask = resolveMask(maskId, mapId);
        if (!mask) return false;
        delete bucket[mask.id];
        return true;
    }

    function proceduralPointAllowed(x, y, options, randomValue) {
        if (options.mask && !maskContains(options.mask, x, y, options.mapId || $gameMap.mapId())) return false;
        if (options.excludeMask && maskContains(options.excludeMask, x, y, options.mapId || $gameMap.mapId())) return false;
        const regions = normalizeList(options.regions).map(Number);
        if (regions.length && !regions.includes(readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, 5))) return false;
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(x, y))) return false;
        if (options.passable !== undefined && $gameMap.isPassable) {
            const passable = [2, 4, 6, 8].some(direction => $gameMap.isPassable(x, y, direction));
            if (passable !== toBoolean(options.passable, true)) return false;
        }
        const density = Math.max(0, Math.min(1, finiteNumber(options.density, 1)));
        if (randomValue > density) return false;
        if (options.falloff) {
            const falloff = parseNestedStruct(options.falloff, {});
            const centerX = finiteNumber(falloff.x, integer(options.x) + finiteNumber(options.width, $dataMap.width) / 2);
            const centerY = finiteNumber(falloff.y, integer(options.y) + finiteNumber(options.height, $dataMap.height) / 2);
            const radius = Math.max(0.001, finiteNumber(falloff.radius, Math.max(options.width || $dataMap.width, options.height || $dataMap.height) / 2));
            const distance = Math.hypot(x - centerX, y - centerY) / radius;
            const strength = Math.pow(Math.max(0, 1 - distance), Math.max(0.01, finiteNumber(falloff.power, 1)));
            if (randomValue > density * strength) return false;
        }
        return true;
    }

    function proceduralFill(options = {}) {
        const layer = normalizeLayer(options.layer || "L1");
        const entries = normalizeWeightedTiles(options.weightedTiles || options.tiles || options.tileId, layer);
        if (!entries.length) return false;
        const rect = options.area ? normalizeRect(options.area.x, options.area.y,
            options.area.w || options.area.width, options.area.h || options.area.height)
            : normalizeRect(options.x || 0, options.y || 0,
                options.width || $dataMap.width, options.height || $dataMap.height);
        const random = typeof options.random === "function" ? options.random : seededRandom(options.seed ?? Date.now());
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const noise = options.noiseScale
                    ? coordinateNoise(x, y, options.seed || 0, options.noiseScale)
                    : random();
                if (!proceduralPointAllowed(x, y, options, noise)) continue;
                cells.push({ x, y, tiles: cellTilesForLayer(layer, chooseWeightedTile(entries, random), false) });
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Procedural Fill");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "proceduralFill");
        return patch;
    }

    function scatterTiles(options = {}) {
        return proceduralFill(Object.assign({ density: 0.2, label: "Scatter Tiles" }, options));
    }

    function generateBiome(options = {}) {
        const bands = (Array.isArray(options.bands) ? options.bands : parseJson(options.bands, []))
            .map(band => ({ threshold: finiteNumber(band.threshold, 1), tileId: parseTileId(band.tileId), weight: finiteNumber(band.weight, 1) }))
            .filter(band => band.tileId !== null).sort((a, b) => a.threshold - b.threshold);
        if (!bands.length) return false;
        const layer = normalizeLayer(options.layer || "L1");
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const value = coordinateNoise(x, y, options.seed || 0, options.scale || 4);
                const band = bands.find(item => value <= item.threshold) || bands[bands.length - 1];
                cells.push({ x, y, tiles: cellTilesForLayer(layer, band.tileId, false) });
            }
        }
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Biome");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateBiome");
        return patch;
    }

    function paintPattern(x, y, pattern, options = {}) {
        const source = typeof pattern === "string" ? parseJson(pattern, null) : pattern;
        if (!source) return false;
        const layers = source.layers || { [normalizeLayer(options.layer || "L1")]: source.tiles || source.data || source };
        const width = positiveInteger(source.width || source.w, Array.isArray(source[0]) ? source[0].length : 1);
        const height = positiveInteger(source.height || source.h, Array.isArray(source) ? source.length : 1);
        const repeatX = Math.max(1, integer(options.repeatX, 1));
        const repeatY = Math.max(1, integer(options.repeatY, 1));
        const cells = [];
        for (let ry = 0; ry < repeatY; ry++) {
            for (let rx = 0; rx < repeatX; rx++) {
                for (let py = 0; py < height; py++) {
                    for (let px = 0; px < width; px++) {
                        const tx = integer(x) + rx * width + px;
                        const ty = integer(y) + ry * height + py;
                        if (!inBounds(tx, ty)) continue;
                        const tiles = {};
                        for (const [layer, values] of Object.entries(layers)) {
                            const key = normalizeLayer(layer);
                            const flat = Array.isArray(values[0]) ? values.flat() : values;
                            const tileId = parseTileId(flat[py * width + px]);
                            if (tileId !== null && validateLayerValue(tileId, key)) tiles[key] = tileId;
                        }
                        if (Object.keys(tiles).length) cells.push({ x: tx, y: ty, tiles });
                    }
                }
            }
        }
        if (!cells.length) return false;
        const patch = makeSparsePatch(cells, normalizeMode(options.mode, "exact"), options.mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Pattern Brush");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "paintPattern");
        return patch;
    }

    function neighborTile(data, width, height, x, y, z, direction) {
        const shifts = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
            northwest: [-1, -1], northeast: [1, -1], southwest: [-1, 1], southeast: [1, 1] };
        const shift = shifts[direction] || [0, 0];
        return readTile(data, width, height, x + shift[0], y + shift[1], z);
    }

    function applyRuleTiles(options = {}) {
        const rules = Array.isArray(options.rules) ? options.rules : parseJson(options.rules, []);
        const layer = normalizeLayer(options.layer || "L1");
        const z = LAYER_INDEX[layer];
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const source = $dataMap.data.slice();
        const random = seededRandom(options.seed || 0);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                for (const rule of rules) {
                    const when = rule.when || {};
                    const center = readTile(source, $dataMap.width, $dataMap.height, x, y, z);
                    if (when.center !== undefined && !sameTileType(center, parseTileId(when.center))) continue;
                    let matches = true;
                    for (const direction of ["north", "south", "west", "east", "northwest", "northeast", "southwest", "southeast"]) {
                        if (when[direction] === undefined) continue;
                        const expected = parseTileId(when[direction]);
                        if (!sameTileType(neighborTile(source, $dataMap.width, $dataMap.height, x, y, z, direction), expected)) matches = false;
                    }
                    if (!matches) continue;
                    if (when.region !== undefined && readTile(source, $dataMap.width, $dataMap.height, x, y, 5) !== integer(when.region)) continue;
                    if (finiteNumber(rule.chance, 1) < random()) continue;
                    const tileId = parseTileId(rule.tileId ?? rule.output);
                    if (tileId !== null) cells.push({ x, y, tiles: cellTilesForLayer(layer, tileId, false) });
                    break;
                }
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Rule Tiles");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "applyRuleTiles");
        return patch;
    }

    function pathBrushPoints(points, width = 1) {
        const radius = Math.max(0, Math.floor((positiveInteger(width) - 1) / 2));
        const output = [];
        for (const point of points) {
            for (let y = -radius; y <= radius; y++) {
                for (let x = -radius; x <= radius; x++) output.push({ x: point.x + x, y: point.y + y });
            }
        }
        return uniqueInBoundsPoints(output);
    }

    function generatePath(options = {}) {
        const waypoints = Array.isArray(options.points) ? options.points : parseJson(options.points, []);
        if (waypoints.length < 2) return false;
        const random = seededRandom(options.seed || 0);
        const center = [];
        for (let index = 1; index < waypoints.length; index++) {
            const segment = linePoints(waypoints[index - 1].x, waypoints[index - 1].y, waypoints[index].x, waypoints[index].y);
            for (let step = 0; step < segment.length; step++) {
                const point = Object.assign({}, segment[step]);
                const meander = Math.max(0, integer(options.meander, 0));
                if (meander && step > 0 && step < segment.length - 1) {
                    point.x += Math.round((random() - 0.5) * meander * 2);
                    point.y += Math.round((random() - 0.5) * meander * 2);
                }
                center.push(point);
            }
        }
        const layer = normalizeLayer(options.layer || "L1");
        const tileId = parseTileId(options.tileId);
        if (tileId === null) return false;
        const cellsByPoint = new Map();
        const borderTileId = options.borderTileId === undefined ? null : parseTileId(options.borderTileId);
        if (borderTileId !== null) {
            for (const point of pathBrushPoints(center, positiveInteger(options.width, 1) + positiveInteger(options.borderWidth, 1) * 2)) {
                cellsByPoint.set(coordinateKey(point.x, point.y), { x: point.x, y: point.y,
                    tiles: cellTilesForLayer(layer, borderTileId, false) });
            }
        }
        for (const point of pathBrushPoints(center, options.width || 1)) {
            cellsByPoint.set(coordinateKey(point.x, point.y), { x: point.x, y: point.y,
                tiles: cellTilesForLayer(layer, tileId, false) });
        }
        const cells = Array.from(cellsByPoint.values());
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Path");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, options.operation || "generatePath");
        return patch;
    }

    function generateRoad(options = {}) {
        return generatePath(Object.assign({ label: "Generate Road", operation: "generateRoad" }, options));
    }

    function generateRiver(options = {}) {
        return generatePath(Object.assign({ label: "Generate River", operation: "generateRiver", meander: 1 }, options));
    }

    function generateRoom(options = {}) {
        const rect = normalizeRect(options.x, options.y, options.width, options.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        const wallTile = parseTileId(options.wallTileId);
        if (floorTile === null || wallTile === null) return false;
        const doors = new Set((Array.isArray(options.doors) ? options.doors : parseJson(options.doors, []))
            .map(point => coordinateKey(integer(point.x), integer(point.y))));
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const border = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
                const value = border && !doors.has(coordinateKey(x, y)) ? wallTile : floorTile;
                cells.push({ x, y, tiles: cellTilesForLayer(layer, value, false) });
            }
        }
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Room");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateRoom");
        return patch;
    }

    function generateDungeon(options = {}) {
        const area = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        const wallTile = parseTileId(options.wallTileId);
        if (floorTile === null || wallTile === null || area.w < 5 || area.h < 5) return false;
        const random = seededRandom(options.seed ?? Date.now());
        const roomTarget = Math.max(1, integer(options.roomCount, Math.max(3, Math.floor(area.w * area.h / 160))));
        const minWidth = Math.max(3, integer(options.minRoomWidth, 4));
        const minHeight = Math.max(3, integer(options.minRoomHeight, 4));
        const maxWidth = Math.max(minWidth, integer(options.maxRoomWidth, Math.min(10, area.w - 2)));
        const maxHeight = Math.max(minHeight, integer(options.maxRoomHeight, Math.min(8, area.h - 2)));
        const padding = Math.max(0, integer(options.roomPadding, 1));
        const rooms = [];
        const attempts = Math.max(roomTarget * 12, integer(options.attempts, 40));
        for (let attempt = 0; attempt < attempts && rooms.length < roomTarget; attempt++) {
            const w = Math.min(area.w - 2, minWidth + Math.floor(random() * (maxWidth - minWidth + 1)));
            const h = Math.min(area.h - 2, minHeight + Math.floor(random() * (maxHeight - minHeight + 1)));
            if (w < 3 || h < 3) continue;
            const x = area.x + 1 + Math.floor(random() * Math.max(1, area.w - w - 1));
            const y = area.y + 1 + Math.floor(random() * Math.max(1, area.h - h - 1));
            const candidate = { x, y, w, h, centerX: x + Math.floor(w / 2), centerY: y + Math.floor(h / 2) };
            if (rooms.some(room => candidate.x - padding < room.x + room.w && candidate.x + candidate.w + padding > room.x &&
                candidate.y - padding < room.y + room.h && candidate.y + candidate.h + padding > room.y)) continue;
            rooms.push(candidate);
        }
        if (!rooms.length) return false;
        const values = new Map();
        const put = (x, y, tileId) => {
            if (inBounds(x, y) && inRect(x, y, area)) values.set(coordinateKey(x, y), { x, y, tiles: cellTilesForLayer(layer, tileId, false) });
        };
        if (options.fillWalls !== false) for (let y = area.y; y < area.y + area.h; y++) {
            for (let x = area.x; x < area.x + area.w; x++) put(x, y, wallTile);
        }
        for (const room of rooms) for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
            for (let x = room.x + 1; x < room.x + room.w - 1; x++) put(x, y, floorTile);
        }
        const corridorWidth = Math.max(1, integer(options.corridorWidth, 1));
        for (let index = 1; index < rooms.length; index++) {
            const previous = rooms[index - 1];
            const current = rooms[index];
            const horizontalFirst = random() < 0.5;
            const waypoints = horizontalFirst
                ? [{ x: previous.centerX, y: previous.centerY }, { x: current.centerX, y: previous.centerY }, { x: current.centerX, y: current.centerY }]
                : [{ x: previous.centerX, y: previous.centerY }, { x: previous.centerX, y: current.centerY }, { x: current.centerX, y: current.centerY }];
            const points = [];
            for (let pointIndex = 1; pointIndex < waypoints.length; pointIndex++) {
                points.push(...linePoints(waypoints[pointIndex - 1].x, waypoints[pointIndex - 1].y,
                    waypoints[pointIndex].x, waypoints[pointIndex].y));
            }
            for (const point of pathBrushPoints(points, corridorWidth)) put(point.x, point.y, floorTile);
        }
        const regionId = integer(options.regionId, 0);
        if (regionId > 0) for (const cell of values.values()) {
            if (cell.tiles[layer] === floorTile) cell.tiles.L6 = Math.min(255, regionId);
        }
        const cells = Array.from(values.values());
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Dungeon");
        patch.seed = options.seed;
        patch.rooms = rooms.map(deepClone);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateDungeon");
        return patch;
    }

    function replaceByProperties(options = {}) {
        const layers = parseLayerSelection(options.layers || options.layer || "L1").layers;
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const regions = normalizeList(options.regions).map(Number);
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        const tileIds = normalizeList(options.tileIds).map(parseTileId).filter(value => value !== null);
        const replacements = options.replacements || {};
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const region = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, 5);
                if (regions.length && !regions.includes(region)) continue;
                if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(x, y))) continue;
                if (options.passable !== undefined && $gameMap.isPassable) {
                    const passable = [2, 4, 6, 8].some(direction => $gameMap.isPassable(x, y, direction));
                    if (passable !== toBoolean(options.passable, true)) continue;
                }
                const tiles = {};
                for (const layer of layers) {
                    const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, LAYER_INDEX[layer]);
                    if (tileIds.length && !tileIds.some(value => sameTileType(current, value))) continue;
                    const replacement = parseTileId(replacements[layer] ?? options.tileId ?? options.toTileId);
                    if (replacement !== null) tiles[layer] = replacement;
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
        }
        if (!cells.length) return false;
        const patch = makeSparsePatch(cells, normalizeMode(options.mode, "autotile"), options.mode === "exact" ? null : cells);
        patch.label = String(options.label || "Replace By Properties");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "replaceByProperties");
        return patch;
    }

    function modifierBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.modifiers[key] ||= [];
        return store.modifiers[key] || [];
    }

    function executeModifier(type, options = {}) {
        const kind = String(type || "").toLowerCase();
        if (kind === "fill" || kind === "proceduralfill") return proceduralFill(options);
        if (kind === "scatter" || kind === "scattertiles") return scatterTiles(options);
        if (kind === "biome" || kind === "generatebiome") return generateBiome(options);
        if (kind === "climate" || kind === "climatebiome" || kind === "generateclimatebiome") return generateClimateBiome(options);
        if (kind === "rules" || kind === "applyruletiles") return applyRuleTiles(options);
        if (kind === "path" || kind === "generatepath") return generatePath(options);
        if (kind === "road" || kind === "generateroad") return generateRoad(options);
        if (kind === "terrainroad" || kind === "generateterrainroad") return generateTerrainRoad(options);
        if (kind === "river" || kind === "generateriver") return generateRiver(options);
        if (kind === "downhillriver" || kind === "generatedownhillriver") return generateDownhillRiver(options);
        if (kind === "room" || kind === "generateroom") return generateRoom(options);
        if (kind === "dungeon" || kind === "generatedungeon") return generateDungeon(options);
        if (kind === "validateddungeon" || kind === "generatevalidateddungeon") return generateValidatedDungeon(options);
        if (kind === "replace" || kind === "replacebyproperties") return replaceByProperties(options);
        if (kind === "wfc" || kind === "wavefunctioncollapse" || kind === "generatewavefunctionmap") return generateWaveFunctionMap(options);
        return false;
    }

    function addModifier(type, options = {}, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if (id !== $gameMap.mapId()) return false;
        const modifier = {
            id: String(options.id || `modifier-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(options.name || type || "Modifier"),
            type: String(type || "proceduralFill"),
            options: deepClone(options),
            enabled: options.enabled !== false,
            authoringLayerId: options.authoringLayerId || (activeAuthoringLayer(id) || {}).id || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastRunAt: 0,
            lastResult: null
        };
        delete modifier.options.id;
        delete modifier.options.name;
        modifierBucket(id, true).push(modifier);
        const result = regenerateModifier(modifier.id, id);
        return result ? deepClone(modifier) : false;
    }

    function listModifiers(mapId = $gameMap.mapId()) {
        const patches = getPatches(mapId);
        return modifierBucket(mapId).map(modifier => Object.assign(deepClone(modifier), {
            patchCount: patches.filter(patch => patch && patch.modifierId === modifier.id).length
        }));
    }

    function resolveModifier(modifierId, mapId = $gameMap.mapId()) {
        const query = String(modifierId || "").toLowerCase();
        return modifierBucket(mapId).find(item => item.id === String(modifierId) || item.name.toLowerCase() === query) || null;
    }

    function regenerateModifier(modifierId, mapId = $gameMap.mapId(), optionChanges = null) {
        const id = integer(mapId);
        if (id !== $gameMap.mapId()) return false;
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        if (optionChanges) modifier.options = Object.assign(modifier.options || {}, deepClone(optionChanges));
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.modifierId !== modifier.id);
        composedCache.delete(id);
        rebuildCurrentMap("prepareModifierRegeneration");
        if (modifier.enabled === false) {
            modifier.updatedAt = Date.now();
            return deepClone(modifier);
        }
        const previousLayer = store.activeAuthoringLayers[key] || null;
        if (modifier.authoringLayerId) store.activeAuthoringLayers[key] = modifier.authoringLayerId;
        else delete store.activeAuthoringLayers[key];
        let result;
        try {
            result = guardedOperation(`modifier:${modifier.type}`, () => executeModifier(modifier.type,
                Object.assign({}, deepClone(modifier.options), { save: true })), { mapId: id, modifierId: modifier.id });
        } finally {
            if (previousLayer) store.activeAuthoringLayers[key] = previousLayer;
            else delete store.activeAuthoringLayers[key];
        }
        if (!result || (result && typeof result.then === "function")) return false;
        result.modifierId = modifier.id;
        modifier.lastRunAt = Date.now();
        modifier.updatedAt = Date.now();
        modifier.lastResult = { kind: result.kind || "patch", writes: patchWriteCount(result), seed: modifier.options.seed };
        recordOperation("regenerateModifier", { mapId: id, modifierId: modifier.id, type: modifier.type });
        return deepClone(modifier);
    }

    function setModifierEnabled(modifierId, enabled, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        modifier.enabled = enabled !== false;
        modifier.updatedAt = Date.now();
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("setModifierEnabled");
        return deepClone(modifier);
    }

    function updateModifier(modifierId, changes = {}, mapId = $gameMap.mapId(), regenerate = true) {
        const modifier = resolveModifier(modifierId, mapId);
        if (!modifier) return false;
        if (changes.name !== undefined) modifier.name = String(changes.name || modifier.name);
        if (changes.options) modifier.options = Object.assign(modifier.options || {}, deepClone(changes.options));
        if (changes.authoringLayerId !== undefined) modifier.authoringLayerId = changes.authoringLayerId || null;
        if (changes.enabled !== undefined) modifier.enabled = changes.enabled !== false;
        modifier.updatedAt = Date.now();
        return regenerate && integer(mapId) === $gameMap.mapId()
            ? regenerateModifier(modifier.id, mapId)
            : deepClone(modifier);
    }

    function deleteModifier(modifierId, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        let affected = 0;
        for (const patch of store.maps[key] || []) if (patch && patch.modifierId === modifier.id) {
            if (options.bake === true) delete patch.modifierId;
            affected++;
        }
        if (options.bake !== true) store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.modifierId !== modifier.id);
        store.modifiers[key] = modifierBucket(id).filter(item => item.id !== modifier.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap(options.bake === true ? "bakeModifier" : "deleteModifier");
        return { mapId: id, modifierId: modifier.id, affectedPatches: affected, baked: options.bake === true };
    }

    function previewModifier(type, options = {}, mapId = $gameMap.mapId()) {
        const width = integer(options.width, $dataMap.width);
        const height = integer(options.height, $dataMap.height);
        return {
            type: String(type),
            mapId: integer(mapId),
            bounds: normalizeRect(options.x || 0, options.y || 0, width, height),
            estimatedCells: Math.max(0, width * height * finiteNumber(options.density, 1)),
            seed: options.seed,
            mask: options.mask || null,
            valid: !!String(type || "").trim()
        };
    }

    function generateTerrainFields(options = {}) {
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const seed = options.seed ?? 0;
        const octaves = Math.max(1, Math.min(8, integer(options.octaves, 4)));
        const persistence = Math.max(0.05, Math.min(1, finiteNumber(options.persistence, 0.5)));
        const field = (name, scale, offset) => {
            const values = new Array(rect.w * rect.h).fill(0);
            let minimum = Infinity;
            let maximum = -Infinity;
            for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
                let value = 0;
                let amplitude = 1;
                let totalAmplitude = 0;
                let frequency = 1;
                for (let octave = 0; octave < octaves; octave++) {
                    value += coordinateNoise(rect.x + x + offset, rect.y + y - offset,
                        `${seed}:${name}:${octave}`.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0),
                        Math.max(0.25, scale / frequency)) * amplitude;
                    totalAmplitude += amplitude;
                    amplitude *= persistence;
                    frequency *= 2;
                }
                value /= totalAmplitude || 1;
                values[y * rect.w + x] = value;
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
            return { values, min: minimum, max: maximum };
        };
        return {
            format: "HybridTileGraftTerrainFields",
            version: 1,
            rect,
            seed,
            height: field("height", finiteNumber(options.heightScale, 12), 0),
            moisture: field("moisture", finiteNumber(options.moistureScale, 9), 173),
            temperature: field("temperature", finiteNumber(options.temperatureScale, 18), 719)
        };
    }

    function generateClimateBiome(options = {}) {
        const fields = options.fields || generateTerrainFields(options);
        const zones = (Array.isArray(options.zones) ? options.zones : parseJson(options.zones, []))
            .map(zone => Object.assign({}, zone, { tileId: parseTileId(zone.tileId) })).filter(zone => zone.tileId !== null);
        if (!zones.length) return false;
        const layer = normalizeLayer(options.layer || "L1");
        const cells = [];
        for (let y = 0; y < fields.rect.h; y++) for (let x = 0; x < fields.rect.w; x++) {
            const index = y * fields.rect.w + x;
            const sample = {
                height: fields.height.values[index],
                moisture: fields.moisture.values[index],
                temperature: fields.temperature.values[index]
            };
            const zone = zones.find(item =>
                (item.minHeight === undefined || sample.height >= finiteNumber(item.minHeight)) &&
                (item.maxHeight === undefined || sample.height <= finiteNumber(item.maxHeight)) &&
                (item.minMoisture === undefined || sample.moisture >= finiteNumber(item.minMoisture)) &&
                (item.maxMoisture === undefined || sample.moisture <= finiteNumber(item.maxMoisture)) &&
                (item.minTemperature === undefined || sample.temperature >= finiteNumber(item.minTemperature)) &&
                (item.maxTemperature === undefined || sample.temperature <= finiteNumber(item.maxTemperature))) || zones[zones.length - 1];
            const tx = fields.rect.x + x;
            const ty = fields.rect.y + y;
            if (proceduralPointAllowed(tx, ty, options, 0)) cells.push({ x: tx, y: ty, tiles: cellTilesForLayer(layer, zone.tileId, false) });
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Climate Biome");
        patch.seed = fields.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateClimateBiome");
        return patch;
    }

    function findTerrainPath(start, goal, options = {}) {
        const source = options.mapData || $dataMap;
        const startPoint = { x: integer(start.x), y: integer(start.y) };
        const goalPoint = { x: integer(goal.x), y: integer(goal.y) };
        if (!inBounds(startPoint.x, startPoint.y, source.width, source.height) ||
            !inBounds(goalPoint.x, goalPoint.y, source.width, source.height)) return [];
        const open = [{ point: startPoint, f: 0 }];
        const cameFrom = new Map();
        const g = new Map([[coordinateKey(startPoint.x, startPoint.y), 0]]);
        const closed = new Set();
        const heightField = options.heightField;
        const heightAt = (x, y) => {
            if (!heightField || !heightField.rect || !inRect(x, y, heightField.rect)) return 0;
            return heightField.height.values[(y - heightField.rect.y) * heightField.rect.w + (x - heightField.rect.x)] || 0;
        };
        const allowedRegions = new Set(normalizeList(options.allowedRegions).map(Number));
        const blockedRegions = new Set(normalizeList(options.blockedRegions).map(Number));
        const maximum = Math.max(100, integer(options.maxIterations, source.width * source.height * 8));
        let iterations = 0;
        while (open.length && iterations++ < maximum) {
            open.sort((a, b) => a.f - b.f);
            const current = open.shift().point;
            const currentKey = coordinateKey(current.x, current.y);
            if (closed.has(currentKey)) continue;
            if (current.x === goalPoint.x && current.y === goalPoint.y) {
                const path = [current];
                let key = currentKey;
                while (cameFrom.has(key)) {
                    const previous = cameFrom.get(key);
                    path.push(previous);
                    key = coordinateKey(previous.x, previous.y);
                }
                return path.reverse();
            }
            closed.add(currentKey);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const next = { x: current.x + dx, y: current.y + dy };
                if (!inBounds(next.x, next.y, source.width, source.height)) continue;
                if (options.mask && !maskContains(options.mask, next.x, next.y, options.mapId || $gameMap.mapId())) continue;
                const region = readTile(source.data, source.width, source.height, next.x, next.y, 5);
                if (allowedRegions.size && !allowedRegions.has(region)) continue;
                if (blockedRegions.has(region)) continue;
                const terrainPenalty = normalizeList(options.avoidTerrainTags).map(Number)
                    .includes($gameMap.terrainTag ? $gameMap.terrainTag(next.x, next.y) : 0) ? finiteNumber(options.avoidPenalty, 20) : 0;
                const slopePenalty = Math.abs(heightAt(next.x, next.y) - heightAt(current.x, current.y)) * finiteNumber(options.slopeCost, 10);
                const tentative = (g.get(currentKey) || 0) + 1 + terrainPenalty + slopePenalty;
                const nextKey = coordinateKey(next.x, next.y);
                if (tentative >= (g.get(nextKey) ?? Infinity)) continue;
                cameFrom.set(nextKey, current);
                g.set(nextKey, tentative);
                const heuristic = Math.abs(goalPoint.x - next.x) + Math.abs(goalPoint.y - next.y);
                open.push({ point: next, f: tentative + heuristic });
            }
        }
        return [];
    }

    function generateTerrainRoad(options = {}) {
        const start = options.start || { x: options.x1, y: options.y1 };
        const goal = options.goal || { x: options.x2, y: options.y2 };
        const fields = options.fields || (options.useHeight ? generateTerrainFields(options) : null);
        const points = findTerrainPath(start, goal, Object.assign({}, options, { heightField: fields }));
        if (points.length < 2) return false;
        return generateRoad(Object.assign({}, options, { points, label: options.label || "Generate Terrain Road" }));
    }

    function generateDownhillRiver(options = {}) {
        const fields = options.fields || generateTerrainFields(options);
        let current = options.start ? { x: integer(options.start.x), y: integer(options.start.y) } : null;
        if (!current) {
            let best = -Infinity;
            for (let y = 0; y < fields.rect.h; y++) for (let x = 0; x < fields.rect.w; x++) {
                const value = fields.height.values[y * fields.rect.w + x];
                if (value > best) { best = value; current = { x: fields.rect.x + x, y: fields.rect.y + y }; }
            }
        }
        if (!current) return false;
        const random = seededRandom(options.seed || fields.seed);
        const points = [current];
        const visited = new Set([coordinateKey(current.x, current.y)]);
        const heightAt = point => {
            if (!inRect(point.x, point.y, fields.rect)) return -1;
            return fields.height.values[(point.y - fields.rect.y) * fields.rect.w + point.x - fields.rect.x];
        };
        const maxLength = Math.max(2, integer(options.maxLength, fields.rect.w + fields.rect.h));
        for (let step = 1; step < maxLength; step++) {
            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
                .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy }))
                .filter(point => inRect(point.x, point.y, fields.rect) && !visited.has(coordinateKey(point.x, point.y)));
            if (!neighbors.length) break;
            neighbors.sort((a, b) => (heightAt(a) + random() * finiteNumber(options.jitter, 0.03)) -
                (heightAt(b) + random() * finiteNumber(options.jitter, 0.03)));
            current = neighbors[0];
            visited.add(coordinateKey(current.x, current.y));
            points.push(current);
            if (heightAt(current) <= finiteNumber(options.seaLevel, 0.25)) break;
        }
        if (points.length < 2) return false;
        return generateRiver(Object.assign({}, options, { points, label: options.label || "Generate Downhill River" }));
    }

    function generateWaveFunctionMap(options = {}) {
        const rules = (Array.isArray(options.rules) ? options.rules : parseJson(options.rules, []))
            .map(rule => ({
                tileId: parseTileId(rule.tileId),
                weight: Math.max(0.001, finiteNumber(rule.weight, 1)),
                allowed: rule.allowed || {}
            })).filter(rule => rule.tileId !== null);
        if (!rules.length) return false;
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const random = seededRandom(options.seed || 0);
        const ruleById = new Map(rules.map(rule => [rule.tileId, rule]));
        const possibilities = new Map();
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            if (inBounds(x, y) && (!options.mask || maskContains(options.mask, x, y))) possibilities.set(coordinateKey(x, y), new Set(rules.map(rule => rule.tileId)));
        }
        const directions = { north: [0, -1, "south"], south: [0, 1, "north"], west: [-1, 0, "east"], east: [1, 0, "west"] };
        const weightedChoice = values => {
            const entries = values.map(id => ({ tileId: id, weight: (ruleById.get(id) || {}).weight || 1 }));
            return chooseWeightedTile(entries, random);
        };
        const propagationLimit = Math.max(1000, integer(options.propagationLimit, possibilities.size * rules.length * 16));
        const propagate = queue => {
            let steps = 0;
            while (queue.length && steps++ < propagationLimit) {
                const point = queue.shift();
                const sourceSet = possibilities.get(coordinateKey(point.x, point.y));
                if (!sourceSet) continue;
                for (const [direction, [dx, dy, opposite]] of Object.entries(directions)) {
                    const neighborKey = coordinateKey(point.x + dx, point.y + dy);
                    const targetSet = possibilities.get(neighborKey);
                    if (!targetSet) continue;
                    const permitted = new Set();
                    for (const sourceId of sourceSet) {
                        const allowed = normalizeList((ruleById.get(sourceId).allowed || {})[direction]).map(parseTileId).filter(value => value !== null);
                        if (!allowed.length) for (const id of targetSet) permitted.add(id);
                        else for (const id of allowed) permitted.add(id);
                    }
                    let changed = false;
                    for (const id of [...targetSet]) if (!permitted.has(id)) { targetSet.delete(id); changed = true; }
                    if (!targetSet.size) {
                        const fallback = rules.filter(rule => {
                            const allowed = normalizeList((rule.allowed || {})[opposite]).map(parseTileId);
                            return [...sourceSet].some(id => !allowed.length || allowed.includes(id));
                        });
                        targetSet.add((fallback[0] || rules[0]).tileId);
                        changed = true;
                    }
                    if (changed) queue.push({ x: point.x + dx, y: point.y + dy });
                }
            }
            return !queue.length;
        };
        let collapseSteps = 0;
        const collapseLimit = Math.max(1, integer(options.collapseLimit, possibilities.size * 2));
        while ([...possibilities.values()].some(set => set.size > 1) && collapseSteps++ < collapseLimit) {
            const candidates = [...possibilities.entries()].filter(([, set]) => set.size > 1)
                .sort((a, b) => a[1].size - b[1].size);
            const minimum = candidates[0][1].size;
            const tied = candidates.filter(([, set]) => set.size === minimum);
            const [key, set] = tied[Math.floor(random() * tied.length)];
            const chosen = weightedChoice([...set]);
            possibilities.set(key, new Set([chosen]));
            const [x, y] = key.split(",").map(Number);
            if (!propagate([{ x, y }])) {
                captureError(new Error("WFC propagation reached its safety limit."), {
                    operation: "generateWaveFunctionMap", propagationLimit, collapseSteps
                });
                break;
            }
        }
        const layer = normalizeLayer(options.layer || "L1");
        const cells = [...possibilities.entries()].map(([key, set]) => {
            const [x, y] = key.split(",").map(Number);
            return { x, y, tiles: cellTilesForLayer(layer, [...set][0], false) };
        });
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Wave Function Collapse");
        patch.seed = options.seed;
        patch.collapseSteps = collapseSteps;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateWaveFunctionMap");
        return patch;
    }

    function validateDungeonConnectivity(options = {}) {
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        if (floorTile === null) return { ok: false, reason: "Missing floor tile." };
        const walkable = new Set();
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            const value = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, LAYER_INDEX[layer]);
            if (sameTileType(value, floorTile)) walkable.add(coordinateKey(x, y));
        }
        if (!walkable.size) return { ok: false, reason: "No floor cells.", reachable: 0, total: 0 };
        const queue = [[...walkable][0].split(",").map(Number)];
        const visited = new Set();
        while (queue.length) {
            const [x, y] = queue.shift();
            const key = coordinateKey(x, y);
            if (visited.has(key) || !walkable.has(key)) continue;
            visited.add(key);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        return { ok: visited.size === walkable.size, reachable: visited.size, total: walkable.size,
            disconnected: [...walkable].filter(key => !visited.has(key)).map(key => key.split(",").map(Number)) };
    }

    function generateValidatedDungeon(options = {}) {
        const attempts = Math.max(1, integer(options.validationAttempts, 3));
        const mapId = $gameMap.mapId();
        const key = String(mapId);
        const store = ensureStore();
        for (let attempt = 0; attempt < attempts; attempt++) {
            const before = (store.maps[key] || []).length;
            const patch = generateDungeon(Object.assign({}, options, { seed: `${options.seed || "dungeon"}:${attempt}` }));
            if (!patch) continue;
            const validation = validateDungeonConnectivity(options);
            if (validation.ok) {
                patch.validation = validation;
                return patch;
            }
            store.maps[key] = (store.maps[key] || []).slice(0, before);
            composedCache.delete(mapId);
            rebuildCurrentMap("retryDungeonGeneration");
        }
        return false;
    }

    async function scatterPrefabs(options = {}) {
        const definitions = normalizeList(options.prefabs || options.names).map(value => typeof value === "string"
            ? catalogPrefab(value, 0) : value).filter(Boolean);
        if (!definitions.length) return { ok: false, placements: [], errors: ["No prefabs supplied."] };
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const random = seededRandom(options.seed || 0);
        const minimumSpacing = Math.max(0, integer(options.minimumSpacing, 1));
        const targetCount = Math.max(1, integer(options.count, 10));
        const attempts = Math.max(targetCount, integer(options.attempts, targetCount * 20));
        const placements = [];
        const errors = [];
        for (let attempt = 0; attempt < attempts && placements.length < targetCount; attempt++) {
            const definition = definitions[Math.floor(random() * definitions.length)];
            const x = rect.x + Math.floor(random() * rect.w);
            const y = rect.y + Math.floor(random() * rect.h);
            if (!proceduralPointAllowed(x, y, options, 0)) continue;
            if (placements.some(item => Math.hypot(item.targetX - x, item.targetY - y) < minimumSpacing)) continue;
            const placementOptions = Object.assign({}, options.prefabOptions || {}, {
                name: definition.name,
                storageMapId: definition.mapId,
                targetX: x,
                targetY: y,
                parameters: options.parameters,
                ignorePlacementRules: options.ignorePlacementRules,
                save: options.save !== false
            });
            try {
                const result = options.linked === false ? await graftPrefabAsync(placementOptions) : await placePrefabInstance(placementOptions);
                if (result) placements.push({ prefab: definition.name, targetX: x, targetY: y, result });
            } catch (error) { errors.push({ prefab: definition.name, x, y, message: error.message }); }
        }
        return { ok: errors.length === 0 && placements.length > 0, placements, errors, seed: options.seed };
    }

    async function runGeneratorGraph(graph, context = {}) {
        const nodes = Array.isArray(graph) ? graph : graph && graph.nodes || [];
        const pending = new Map(nodes.map(node => [String(node.id), deepClone(node)]));
        const results = {};
        const errors = [];
        while (pending.size) {
            const ready = [...pending.values()].filter(node => normalizeList(node.dependsOn).every(id => results[String(id)] !== undefined));
            if (!ready.length) {
                errors.push({ message: "Generator graph contains a cycle or missing dependency.", nodes: [...pending.keys()] });
                break;
            }
            for (const node of ready) {
                pending.delete(String(node.id));
                try {
                    const options = substitutePrefabValue(node.options || {}, Object.assign({}, context, results));
                    let result;
                    if (String(node.type).toLowerCase() === "scatterprefabs") result = await scatterPrefabs(options);
                    else result = executeModifier(node.type, options);
                    results[String(node.id)] = result;
                } catch (error) {
                    errors.push({ nodeId: node.id, message: error.message });
                    if (node.stopOnError !== false) return { ok: false, results, errors };
                    results[String(node.id)] = false;
                }
            }
        }
        return { ok: errors.length === 0, results, errors };
    }

    function checkAreaEvents(x, y, width, height) {
        const rect = normalizeRect(x, y, width, height);
        const result = { normal: [], spawned: [] };
        for (const event of $gameMap.events()) {
            if (!inRect(event.x, event.y, rect)) continue;
            (isHybridGameEvent(event) ? result.spawned : result.normal).push(event.eventId());
        }
        return result;
    }

    function eventInfoAt(x, y) {
        return $gameMap.events().filter(event => event.x === integer(x) && event.y === integer(y)).map(event => ({
            id: event.eventId(),
            name: event.event() ? event.event().name : "",
            x: event.x,
            y: event.y,
            direction: event.direction ? event.direction() : 2,
            spawned: isHybridGameEvent(event),
            note: event.event() ? event.event().note || "" : ""
        }));
    }

    function currentEventSnapshot(eventId) {
        const event = $gameMap.event(integer(eventId));
        if (!event || !event.event) return null;
        const data = deepClone(event.event());
        data.x = event.x;
        data.y = event.y;
        return data;
    }

    function moveSpawnedEvent(eventId, x, y, save = true) {
        const id = integer(eventId);
        const event = $gameMap.event(id);
        if (!isHybridGameEvent(event)) return false;
        captureSpawnedRuntimeStates();
        const snapshot = currentEventSnapshot(id);
        snapshot.x = integer(x);
        snapshot.y = integer(y);
        const bucket = eventStateBucket($gameMap.mapId(), true);
        if (bucket[String(id)]) {
            bucket[String(id)].x = snapshot.x;
            bucket[String(id)].y = snapshot.y;
        }
        const patch = makeEventPatch([snapshot], [id], "Move Spawned Event", { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "moveSpawnedEvent");
        return patch;
    }

    function duplicateEvent(eventId, x, y, save = true) {
        const source = currentEventSnapshot(eventId);
        if (!source) return false;
        const snapshot = prepareTargetEventSnapshot(source);
        snapshot.x = integer(x, source.x);
        snapshot.y = integer(y, source.y);
        const patch = makeEventPatch([snapshot], [], "Duplicate Event");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "duplicateEvent");
        return snapshot.id;
    }

    function deleteSpawnedEvent(eventId, save = true) {
        const id = integer(eventId);
        if (!isHybridGameEvent($gameMap.event(id))) return false;
        const patch = makeEventPatch([], [id], "Delete Spawned Event");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "deleteSpawnedEvent");
        return true;
    }

    function updateSpawnedEvent(eventId, changes = {}, save = true) {
        const id = integer(eventId);
        const gameEvent = $gameMap.event(id);
        if (!isHybridGameEvent(gameEvent)) return false;
        captureSpawnedRuntimeStates();
        const snapshot = currentEventSnapshot(id);
        for (const field of ["name", "note", "pages", "meta"]) {
            if (changes[field] !== undefined) snapshot[field] = deepClone(changes[field]);
        }
        if (changes.x !== undefined) snapshot.x = integer(changes.x, snapshot.x);
        if (changes.y !== undefined) snapshot.y = integer(changes.y, snapshot.y);
        const bucket = eventStateBucket($gameMap.mapId(), true);
        bucket[String(id)] ||= {};
        if (changes.x !== undefined) bucket[String(id)].x = snapshot.x;
        if (changes.y !== undefined) bucket[String(id)].y = snapshot.y;
        if (changes.direction !== undefined) bucket[String(id)].direction = integer(changes.direction, 2);
        if (changes.moveSpeed !== undefined) bucket[String(id)].moveSpeed = finiteNumber(changes.moveSpeed, 3);
        if (changes.through !== undefined) bucket[String(id)].through = toBoolean(changes.through, false);
        if (changes.transparent !== undefined) bucket[String(id)].transparent = toBoolean(changes.transparent, false);
        const patch = makeEventPatch([snapshot], [id], "Update Spawned Event", { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "updateSpawnedEvent");
        return patch;
    }

    function bulkUpdateSpawnedEvents(eventIds, changes = {}, save = true) {
        const ids = [...new Set(normalizeList(eventIds).map(Number).filter(id => isHybridGameEvent($gameMap.event(id))))];
        if (!ids.length) return false;
        captureSpawnedRuntimeStates();
        const events = [];
        for (const id of ids) {
            const snapshot = currentEventSnapshot(id);
            for (const field of ["name", "note", "pages", "meta"]) {
                if (changes[field] !== undefined) snapshot[field] = deepClone(changes[field]);
            }
            if (changes.offsetX !== undefined) snapshot.x += integer(changes.offsetX);
            else if (changes.x !== undefined) snapshot.x = integer(changes.x, snapshot.x);
            if (changes.offsetY !== undefined) snapshot.y += integer(changes.offsetY);
            else if (changes.y !== undefined) snapshot.y = integer(changes.y, snapshot.y);
            const bucket = eventStateBucket($gameMap.mapId(), true);
            bucket[String(id)] ||= {};
            for (const field of ["direction", "moveSpeed", "through", "transparent"]) {
                if (changes[field] !== undefined) bucket[String(id)][field] = deepClone(changes[field]);
            }
            bucket[String(id)].x = snapshot.x;
            bucket[String(id)].y = snapshot.y;
            events.push(snapshot);
        }
        const patch = makeEventPatch(events, ids, String(changes.label || "Bulk Update Spawned Events"), { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkUpdateSpawnedEvents");
        return patch;
    }

    function editEventPage(eventId, pageIndex, changes = {}, save = true) {
        const snapshot = currentEventSnapshot(eventId);
        if (!snapshot || !isHybridGameEvent($gameMap.event(integer(eventId)))) return false;
        const index = Math.max(0, integer(pageIndex, 0));
        snapshot.pages ||= [];
        snapshot.pages[index] = Object.assign(defaultEventPage(), snapshot.pages[index] || {}, deepClone(changes));
        return updateSpawnedEvent(eventId, { pages: snapshot.pages }, save);
    }

    function defaultEventPage() {
        return {
            conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                selfSwitchCh: "A", selfSwitchValid: false, switch1Id: 1, switch1Valid: false,
                switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 },
            directionFix: false,
            image: { tileId: 0, characterName: "", direction: 2, pattern: 1, characterIndex: 0 },
            list: [{ code: 0, indent: 0, parameters: [] }],
            moveFrequency: 3,
            moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
            moveSpeed: 3,
            moveType: 0,
            priorityType: 1,
            stepAnime: false,
            through: false,
            trigger: 0,
            walkAnime: true
        };
    }

    function normalizeEventTemplate(name, eventData, options = {}) {
        const label = String(name || options.name || "").trim();
        if (!label || !eventData) return null;
        const event = deepClone(eventData.event ? eventData.event() : eventData);
        if (!event.pages || !event.pages.length) event.pages = [defaultEventPage()];
        event.x = 0;
        event.y = 0;
        delete event.id;
        delete event._hybridSpawnId;
        delete event._hybridTileGraftSpawn;
        return {
            name: label,
            category: String(options.category || "General"),
            tags: normalizeList(options.tags).map(String),
            description: String(options.description || ""),
            version: Math.max(1, integer(options.version, 1)),
            parameters: Array.isArray(options.parameters) ? deepClone(options.parameters) : parseJson(options.parameters, []),
            event,
            updatedAt: Date.now()
        };
    }

    function registerEventTemplate(name, eventData, options = {}) {
        const template = normalizeEventTemplate(name, eventData, options);
        if (!template) return false;
        const key = template.name.toLowerCase();
        const existing = ensureStore().eventTemplates[key];
        if (existing && options.version === undefined) template.version = Math.max(1, existing.version || 1) + 1;
        ensureStore().eventTemplates[key] = template;
        return deepClone(template);
    }

    function captureEventTemplate(name, eventId, options = {}) {
        const snapshot = currentEventSnapshot(eventId);
        return snapshot ? registerEventTemplate(name, snapshot, options) : false;
    }

    function listEventTemplates(filter = "") {
        const query = String(filter || "").toLowerCase();
        return Object.values(ensureStore().eventTemplates || {}).filter(template => !query || [
            template.name, template.category, template.description, ...(template.tags || [])
        ].some(value => String(value || "").toLowerCase().includes(query)))
            .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map(deepClone);
    }

    function removeEventTemplate(name) {
        const key = String(name || "").trim().toLowerCase();
        if (!ensureStore().eventTemplates[key]) return false;
        delete ensureStore().eventTemplates[key];
        return true;
    }

    function resolveEventTemplate(name, parameters = {}) {
        const template = ensureStore().eventTemplates[String(name || "").trim().toLowerCase()];
        if (!template) return null;
        const defaults = {};
        for (const parameter of template.parameters || []) if (parameter && parameter.name) defaults[parameter.name] = parameter.default;
        const values = Object.assign(defaults, typeof parameters === "string" ? parseJson(parameters, {}) : parameters || {});
        return { template: deepClone(template), event: substitutePrefabValue(template.event, values), parameters: values };
    }

    function spawnEventTemplate(name, x, y, options = {}) {
        const resolved = resolveEventTemplate(name, options.parameters);
        if (!resolved) return false;
        const event = prepareTargetEventSnapshot(resolved.event);
        event.name = options.eventName || event.name || resolved.template.name;
        event.x = integer(x);
        event.y = integer(y);
        const patch = makeEventPatch([event], [], `Spawn Template: ${resolved.template.name}`);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "spawnEventTemplate");
        return event.id;
    }

    function spawnEventTemplateOnMapAsync(mapId, name, x, y, options = {}) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(spawnEventTemplate(name, x, y, options));
        const resolved = resolveEventTemplate(name, options.parameters);
        if (!resolved) return Promise.resolve(false);
        return preloadMap(id).then(() => {
            const event = prepareTargetEventSnapshot(resolved.event);
            event.name = options.eventName || event.name || resolved.template.name;
            event.x = integer(x);
            event.y = integer(y);
            return applyPatchToMap(id, makeEventPatch([event], [], `Spawn Template: ${resolved.template.name}`), "spawnRemoteEventTemplate");
        });
    }

    function exportEventTemplatePack(names = null) {
        const requested = names ? new Set(normalizeList(names).map(name => String(name).toLowerCase())) : null;
        return {
            format: "HybridTileGraftEventTemplatePack",
            version: 1,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            templates: listEventTemplates().filter(template => !requested || requested.has(template.name.toLowerCase()))
        };
    }

    function importEventTemplatePack(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) return false;
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftEventTemplatePack" || !Array.isArray(pack.templates)) return false;
        const policy = String(options.conflictPolicy || "newer").toLowerCase();
        const imported = [];
        const skipped = [];
        for (const template of pack.templates) {
            const current = ensureStore().eventTemplates[String(template.name || "").toLowerCase()];
            if (current && (policy === "skip" || (policy === "newer" && (current.version || 1) >= (template.version || 1)))) {
                skipped.push(template.name);
                continue;
            }
            ensureStore().eventTemplates[String(template.name).toLowerCase()] = deepClone(template);
            imported.push(template.name);
        }
        return { imported, skipped };
    }

    function eventMatchesSearch(event, options = {}, mapData = $dataMap) {
        if (!event) return false;
        const query = String(options.query || options.text || "").toLowerCase();
        if (query && ![event.name, event.note, JSON.stringify(event.pages || [])]
            .some(value => String(value || "").toLowerCase().includes(query))) return false;
        if (options.spawned !== undefined && isHybridEventData(event) !== toBoolean(options.spawned, true)) return false;
        if (options.rect && !inRect(event.x, event.y, options.rect)) return false;
        if (options.region !== undefined && readTile(mapData.data, mapData.width, mapData.height, event.x, event.y, 5) !== integer(options.region)) return false;
        const commandCodes = normalizeList(options.commandCodes).map(Number);
        if (commandCodes.length && !(event.pages || []).some(page => (page.list || []).some(command => commandCodes.includes(command.code)))) return false;
        return true;
    }

    function searchEvents(options = {}) {
        return ($dataMap.events || []).filter(event => eventMatchesSearch(event, options, $dataMap)).map(event => ({
            id: event.id,
            name: event.name || "",
            note: event.note || "",
            x: event.x,
            y: event.y,
            spawned: isHybridEventData(event),
            pageCount: (event.pages || []).length
        }));
    }

    function searchEventsOnMapAsync(mapId, options = {}) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(searchEvents(options));
        return preloadMap(id).then(map => (map.events || []).filter(event => eventMatchesSearch(event, options, map)).map(event => ({
            id: event.id, name: event.name || "", note: event.note || "", x: event.x, y: event.y,
            spawned: isHybridEventData(event), pageCount: (event.pages || []).length
        })));
    }

    function bulkMoveSpawnedEvents(eventIds, dx, dy, options = {}) {
        const events = [];
        const removeIds = [];
        for (const eventId of normalizeList(eventIds).map(Number)) {
            const source = currentEventSnapshot(eventId);
            if (!source || !isHybridGameEvent($gameMap.event(eventId))) continue;
            source.x += integer(dx);
            source.y += integer(dy);
            if (!inBounds(source.x, source.y) && options.allowOutOfBounds !== true) continue;
            events.push(source);
            removeIds.push(eventId);
            const bucket = eventStateBucket($gameMap.mapId(), true);
            bucket[String(eventId)] ||= {};
            bucket[String(eventId)].x = source.x;
            bucket[String(eventId)].y = source.y;
        }
        if (!events.length) return false;
        const patch = makeEventPatch(events, removeIds, "Bulk Move Spawned Events", { preserveEventState: true });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkMoveSpawnedEvents");
        return patch;
    }

    function bulkDeleteSpawnedEvents(eventIds, save = true) {
        const ids = normalizeList(eventIds).map(Number).filter(id => isHybridGameEvent($gameMap.event(id)));
        if (!ids.length) return false;
        const patch = makeEventPatch([], ids, "Bulk Delete Spawned Events");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkDeleteSpawnedEvents");
        return patch;
    }

    function generatedEventData(type, options = {}) {
        const page = defaultEventPage();
        page.image.characterName = String(options.characterName || "");
        page.image.characterIndex = Math.max(0, integer(options.characterIndex, 0));
        page.image.direction = integer(options.direction, 2);
        page.priorityType = integer(options.priorityType, 1);
        page.trigger = integer(options.trigger, 0);
        const commands = [];
        const kind = String(type || "event").toLowerCase();
        if (kind === "door") {
            commands.push({ code: 250, indent: 0, parameters: [{ name: options.sound || "Open1", volume: 90, pitch: 100, pan: 0 }] });
            if (options.targetMapId) commands.push({ code: 201, indent: 0, parameters: [0, integer(options.targetMapId), integer(options.targetX), integer(options.targetY), integer(options.targetDirection, 2), integer(options.fadeType, 0)] });
        } else if (kind === "transfer") {
            commands.push({ code: 201, indent: 0, parameters: [0, integer(options.targetMapId), integer(options.targetX), integer(options.targetY), integer(options.targetDirection, 2), integer(options.fadeType, 0)] });
        } else if (kind === "chest") {
            if (options.gold) commands.push({ code: 125, indent: 0, parameters: [0, 0, integer(options.gold)] });
            if (options.itemId) commands.push({ code: 126, indent: 0, parameters: [integer(options.itemId), 0, 0, integer(options.amount, 1)] });
            commands.push({ code: 123, indent: 0, parameters: [String(options.selfSwitch || "A"), 0] });
        } else if (kind === "harvest") {
            if (options.commonEventId) commands.push({ code: 117, indent: 0, parameters: [integer(options.commonEventId)] });
            commands.push({ code: 123, indent: 0, parameters: [String(options.selfSwitch || "A"), 0] });
        } else if (options.commonEventId) {
            commands.push({ code: 117, indent: 0, parameters: [integer(options.commonEventId)] });
        }
        commands.push({ code: 0, indent: 0, parameters: [] });
        page.list = commands;
        const pages = [page];
        if (kind === "chest" || kind === "harvest") {
            const finished = defaultEventPage();
            finished.conditions.selfSwitchCh = String(options.selfSwitch || "A");
            finished.conditions.selfSwitchValid = true;
            finished.image.characterName = String(options.finishedCharacterName || options.characterName || "");
            finished.image.characterIndex = Math.max(0, integer(options.finishedCharacterIndex, options.characterIndex || 0));
            finished.image.direction = integer(options.finishedDirection, options.direction || 2);
            pages.push(finished);
        }
        return { name: String(options.name || kind), note: String(options.note || ""), x: 0, y: 0, pages };
    }

    function generateEvent(type, x, y, options = {}) {
        const event = prepareTargetEventSnapshot(generatedEventData(type, options));
        event.x = integer(x);
        event.y = integer(y);
        const patch = makeEventPatch([event], [], `Generate ${type} Event`);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateEvent");
        return event.id;
    }

    function resolveMapId(value) {
        const direct = integer(value, 0);
        if (direct > 0) return direct;
        const name = String(value || "").trim().toLowerCase();
        if (!name || typeof $dataMapInfos === "undefined" || !$dataMapInfos) return 0;
        const match = $dataMapInfos.find(info => info && String(info.name || "").trim().toLowerCase() === name);
        return match ? match.id : 0;
    }

    function linkMap(value) {
        const mapId = resolveMapId(value);
        if (mapId <= 0) {
            console.warn(`${PLUGIN_NAME}: cannot link unknown map "${value}".`);
            return Promise.resolve(false);
        }
        if (mapId === $gameMap.mapId()) return Promise.resolve(unlinkMap());
        $gameMap._hybridLinkedMapId = mapId;
        return preloadMap(mapId).then(() => mapId);
    }

    function unlinkMap() {
        if ($gameMap) $gameMap._hybridLinkedMapId = null;
        return true;
    }

    function editingMapId() {
        return ($gameMap && $gameMap._hybridLinkedMapId) || $gameMap.mapId();
    }

