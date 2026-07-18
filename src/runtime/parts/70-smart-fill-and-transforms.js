    // -------------------------------------------------------------------------
    // Smart fill
    // -------------------------------------------------------------------------

    function coordinateKey(x, y) {
        return `${integer(x)},${integer(y)}`;
    }

    function allMapCoordinates(width = $dataMap.width, height = $dataMap.height) {
        const output = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) output.push({ x, y });
        return output;
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined || value === "") return [];
        const text = String(value).trim();
        if (text.startsWith("[")) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) return parsed.map(item => {
                    if (typeof item !== "string") return item;
                    try { return JSON.parse(item); } catch (_error) { return item; }
                });
            } catch (_error) {
                // Fall through to comma-separated parsing.
            }
        }
        return String(value).split(",").map(item => item.trim()).filter(Boolean);
    }

    function normalizeFillFilters(value) {
        const filters = Object.assign({}, parseNestedStruct(value, {}));
        filters.regions = normalizeList(filters.regions);
        filters.tileIds = normalizeList(filters.tileIds);
        filters.tileLayers = normalizeList(filters.tileLayers);
        filters.area = filters.area ? parseNestedStruct(filters.area, null) : null;
        filters.distance = Math.max(0, integer(filters.distance, 0));
        filters.hollow = toBoolean(filters.hollow, false);
        filters.scope = String(filters.scope || "origin").toLowerCase();
        filters.origin = String(filters.origin || "normal");
        return filters;
    }

    function normalizeCreepOptions(value) {
        const creep = Object.assign({}, parseNestedStruct(value, {}));
        creep.regions = normalizeList(creep.regions);
        creep.tileIds = normalizeList(creep.tileIds);
        creep.tileLayers = normalizeList(creep.tileLayers);
        creep.area = creep.area ? parseNestedStruct(creep.area, null) : null;
        creep.distance = Math.max(0, integer(creep.distance, 0));
        creep.hollow = toBoolean(creep.hollow, false);
        return creep;
    }

    function areaContains(point, area, origin) {
        if (!area) return true;
        const absolute = toBoolean(area.absolute, false);
        const baseX = absolute ? 0 : origin.x;
        const baseY = absolute ? 0 : origin.y;
        const x1 = baseX + integer(area.x1, 0);
        const y1 = baseY + integer(area.y1, 0);
        const x2 = baseX + integer(area.x2, 0);
        const y2 = baseY + integer(area.y2, 0);
        return point.x >= Math.min(x1, x2) && point.x <= Math.max(x1, x2) &&
            point.y >= Math.min(y1, y2) && point.y <= Math.max(y1, y2);
    }

    function filterCoordinates(candidates, filters, origin, data = $dataMap.data) {
        let output = candidates;
        const regions = normalizeList(filters.regions).map(Number);
        if (regions.length) {
            output = output.filter(point => regions.includes(readTile(data, $dataMap.width, $dataMap.height, point.x, point.y, 5)));
        }
        const tileIds = normalizeList(filters.tileIds).map(parseTileId).filter(id => id !== null);
        if (tileIds.length) {
            const layers = parseLayerSelection(filters.tileLayers || ["L1", "L2", "L3", "L4"]).layers;
            output = output.filter(point => layers.some(layer => {
                const current = readTile(data, $dataMap.width, $dataMap.height, point.x, point.y, LAYER_INDEX[layer]);
                return tileIds.some(tileId => sameTileType(current, tileId));
            }));
        }
        if (filters.area) output = output.filter(point => areaContains(point, filters.area, origin));
        return output;
    }

    function distanceSelection(candidates, origins, distance, excludeOrigins = false) {
        const allowed = new Set(candidates.map(point => coordinateKey(point.x, point.y)));
        const originKeys = new Set(origins.map(point => coordinateKey(point.x, point.y)));
        const visited = new Set();
        const queue = origins.map(point => ({ x: point.x, y: point.y, d: 0 }));
        let queueHead = 0;
        const output = [];
        while (queueHead < queue.length) {
            const current = queue[queueHead++];
            const key = coordinateKey(current.x, current.y);
            if (visited.has(key) || current.d > distance) continue;
            visited.add(key);
            if (!allowed.has(key)) continue;
            if (!excludeOrigins || !originKeys.has(key)) output.push({ x: current.x, y: current.y });
            if (current.d === distance) continue;
            queue.push(
                { x: current.x + 1, y: current.y, d: current.d + 1 },
                { x: current.x - 1, y: current.y, d: current.d + 1 },
                { x: current.x, y: current.y + 1, d: current.d + 1 },
                { x: current.x, y: current.y - 1, d: current.d + 1 }
            );
        }
        return output;
    }

    function hollowSelection(points) {
        const set = new Set(points.map(point => coordinateKey(point.x, point.y)));
        return points.filter(point => {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (!set.has(coordinateKey(point.x + dx, point.y + dy))) return true;
                }
            }
            return false;
        });
    }

    function selectSmartFillCoordinates(origin, filters, data = $dataMap.data) {
        const hasBroadFilter = filters.scope === "map" || filters.area || normalizeList(filters.regions).length ||
            normalizeList(filters.tileIds).length || positiveInteger(filters.distance, 0) > 0;
        let candidates = hasBroadFilter ? allMapCoordinates() : [{ x: origin.x, y: origin.y }];
        candidates = filterCoordinates(candidates, filters, origin, data);
        const distance = Math.max(0, integer(filters.distance, 0));
        if (distance > 0) candidates = distanceSelection(candidates, [origin], distance, false);
        if (toBoolean(filters.hollow, false)) candidates = hollowSelection(candidates);
        const originRule = String(filters.origin || "normal").toLowerCase();
        if (originRule === "never" || originRule === "never fill") {
            candidates = candidates.filter(point => point.x !== origin.x || point.y !== origin.y);
        } else if (originRule.includes("always") && inBounds(origin.x, origin.y)) {
            if (!candidates.some(point => point.x === origin.x && point.y === origin.y)) candidates.push(origin);
        }
        return candidates;
    }

    function sparseFillPatch(points, layer, tileId, options = {}) {
        const key = normalizeLayer(layer);
        const cells = points.map(point => ({
            x: point.x,
            y: point.y,
            tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
        }));
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        return makeSparsePatch(cells, mode, mode === "autotile" ? points : null);
    }

    function smartFill(options = {}) {
        const tileId = parseTileId(options.tileId);
        const primaryLayer = normalizeLayer(options.layer || "L1");
        if (tileId === null || !validateLayerValue(tileId, primaryLayer)) return false;
        const origin = resolvePoint(options.x, options.y, options, options.interpreter || null);
        if (!inBounds(origin.x, origin.y)) return false;
        const filters = normalizeFillFilters(options.filters || options.filtersJson);
        const creep = normalizeCreepOptions(options.creep || options.creepJson);
        const primaryPoints = selectSmartFillCoordinates(origin, filters);
        const primaryPatch = sparseFillPatch(primaryPoints, primaryLayer, tileId, options);
        const patches = [primaryPatch];

        const creepDistance = Math.max(0, integer(creep.distance, 0));
        if (creepDistance > 0 && primaryPoints.length) {
            const simulated = $dataMap.data.slice();
            applyPatchToBuffer(primaryPatch, simulated, $dataMap.width, $dataMap.height, true);
            let creepCandidates = filterCoordinates(allMapCoordinates(), creep, origin, simulated);
            const primaryKeys = new Set(primaryPoints.map(point => coordinateKey(point.x, point.y)));
            creepCandidates = creepCandidates.filter(point => !primaryKeys.has(coordinateKey(point.x, point.y)));
            let creepPoints = distanceSelection(creepCandidates.concat(primaryPoints), primaryPoints, creepDistance, true)
                .filter(point => !primaryKeys.has(coordinateKey(point.x, point.y)));
            if (toBoolean(creep.hollow, false)) creepPoints = hollowSelection(creepPoints);
            const creepTileId = parseTileId(creep.tileId === undefined || creep.tileId === "" ? tileId : creep.tileId);
            const creepLayer = normalizeLayer(creep.layer || primaryLayer);
            if (creepTileId !== null && validateLayerValue(creepTileId, creepLayer) && creepPoints.length) {
                patches.push(sparseFillPatch(creepPoints, creepLayer, creepTileId, {
                    mode: creep.mode || options.mode || "autotile",
                    clearUpperLayers: creep.clearUpperLayers ?? options.clearUpperLayers
                }));
            }
        }

        for (const patch of patches) {
            if (options.save !== false) addPatch($gameMap.mapId(), patch);
            applyPatchLive(patch, "smartFill");
        }
        return {
            patches,
            filled: primaryPatch.cells.length,
            creeped: patches.length > 1 ? patches[1].cells.length : 0
        };
    }

    function uniqueInBoundsPoints(points) {
        const seen = new Set();
        const output = [];
        for (const point of points || []) {
            const x = integer(point.x);
            const y = integer(point.y);
            const key = coordinateKey(x, y);
            if (!seen.has(key) && inBounds(x, y)) {
                seen.add(key);
                output.push({ x, y });
            }
        }
        return output;
    }

    function paintPoints(points, layer, tileValue, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const tileId = parseTileId(tileValue);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const targets = uniqueInBoundsPoints(points);
        if (!targets.length) return false;
        const patch = sparseFillPatch(targets, key, tileId, options);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, options.operation || "paintPoints");
        return patch;
    }

    function floodFill(x, y, layer, tileValue, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const z = LAYER_INDEX[key];
        const tileId = parseTileId(tileValue);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const origin = resolvePoint(x, y, options, options.interpreter || null);
        if (!inBounds(origin.x, origin.y)) return false;
        const sourceTile = readTile($dataMap.data, $dataMap.width, $dataMap.height, origin.x, origin.y, z);
        const exactMatch = toBoolean(options.exactMatch, key === "L5" || key === "L6");
        const maxCells = Math.max(1, integer(options.maxCells, $dataMap.width * $dataMap.height));
        const regions = normalizeList(options.regions).map(Number);
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        const visited = new Set();
        const queue = [origin];
        let queueHead = 0;
        const points = [];
        while (queueHead < queue.length && points.length < maxCells) {
            const point = queue[queueHead++];
            const pointKey = coordinateKey(point.x, point.y);
            if (visited.has(pointKey) || !inBounds(point.x, point.y)) continue;
            visited.add(pointKey);
            const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, point.x, point.y, z);
            if (exactMatch ? current !== sourceTile : !sameTileType(current, sourceTile)) continue;
            const region = readTile($dataMap.data, $dataMap.width, $dataMap.height, point.x, point.y, 5);
            if (regions.length && !regions.includes(region)) continue;
            if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(point.x, point.y))) continue;
            points.push(point);
            queue.push(
                { x: point.x + 1, y: point.y },
                { x: point.x - 1, y: point.y },
                { x: point.x, y: point.y + 1 },
                { x: point.x, y: point.y - 1 }
            );
        }
        return paintPoints(points, key, tileId, save, Object.assign({}, options, { operation: "floodFill" }));
    }

    function replaceTiles(options = {}) {
        const key = normalizeLayer(options.layer || "L1");
        const z = LAYER_INDEX[key];
        const fromId = options.fromTileId === undefined
            ? getTileId(integer(options.x, 0), integer(options.y, 0), key)
            : parseTileId(options.fromTileId);
        const toId = parseTileId(options.toTileId ?? options.tileId);
        if (fromId === null || toId === null || !validateLayerValue(toId, key)) return false;
        const area = options.area ? parseNestedStruct(options.area, null) : null;
        const rect = area
            ? normalizeRect(area.x, area.y, area.width || area.w, area.height || area.h)
            : positiveInteger(options.width, 0) > 0 && positiveInteger(options.height, 0) > 0
                ? normalizeRect(options.x, options.y, options.width, options.height)
            : { x: 0, y: 0, w: $dataMap.width, h: $dataMap.height };
        const exactMatch = options.exactMatch !== undefined
            ? toBoolean(options.exactMatch, false)
            : options.sameType !== undefined
                ? !toBoolean(options.sameType, true)
                : key === "L5" || key === "L6";
        const regions = normalizeList(options.regions).map(Number);
        const points = [];
        for (let py = rect.y; py < rect.y + rect.h; py++) {
            for (let px = rect.x; px < rect.x + rect.w; px++) {
                if (!inBounds(px, py)) continue;
                const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, px, py, z);
                if (exactMatch ? current !== fromId : !sameTileType(current, fromId)) continue;
                if (regions.length && !regions.includes(readTile($dataMap.data, $dataMap.width, $dataMap.height, px, py, 5))) continue;
                points.push({ x: px, y: py });
            }
        }
        return paintPoints(points, key, toId, options.save !== false, Object.assign({}, options, { operation: "replaceTiles" }));
    }

    function linePoints(x1, y1, x2, y2) {
        let x = integer(x1);
        let y = integer(y1);
        const targetX = integer(x2);
        const targetY = integer(y2);
        const dx = Math.abs(targetX - x);
        const sx = x < targetX ? 1 : -1;
        const dy = -Math.abs(targetY - y);
        const sy = y < targetY ? 1 : -1;
        let error = dx + dy;
        const points = [];
        while (true) {
            points.push({ x, y });
            if (x === targetX && y === targetY) break;
            const twice = 2 * error;
            if (twice >= dy) { error += dy; x += sx; }
            if (twice <= dx) { error += dx; y += sy; }
        }
        return points;
    }

    function drawLine(x1, y1, x2, y2, layer, tileValue, save = true, options = {}) {
        return paintPoints(linePoints(x1, y1, x2, y2), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawLine" }));
    }

    function rectangleOutlinePoints(x, y, width, height) {
        const rect = normalizeRect(x, y, width, height);
        const points = [];
        for (let px = rect.x; px < rect.x + rect.w; px++) {
            points.push({ x: px, y: rect.y }, { x: px, y: rect.y + rect.h - 1 });
        }
        for (let py = rect.y + 1; py < rect.y + rect.h - 1; py++) {
            points.push({ x: rect.x, y: py }, { x: rect.x + rect.w - 1, y: py });
        }
        return uniqueInBoundsPoints(points);
    }

    function drawRectangleOutline(x, y, width, height, layer, tileValue, save = true, options = {}) {
        return paintPoints(rectangleOutlinePoints(x, y, width, height), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawRectangleOutline" }));
    }

    function circlePoints(cx, cy, radius, filled = false) {
        const r = Math.max(0, integer(radius));
        const points = [];
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                const distance = Math.sqrt(x * x + y * y);
                if (filled ? distance <= r + 0.25 : Math.abs(distance - r) <= 0.55) {
                    points.push({ x: integer(cx) + x, y: integer(cy) + y });
                }
            }
        }
        return uniqueInBoundsPoints(points);
    }

    function drawCircle(cx, cy, radius, layer, tileValue, save = true, options = {}) {
        return paintPoints(circlePoints(cx, cy, radius, toBoolean(options.filled, false)), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawCircle" }));
    }

    function normalizeWeightedTiles(value, layer = "L1", tilesetId = $dataMap.tilesetId) {
        let entries = value;
        if (typeof entries === "string") {
            const parsed = parseJson(entries, null);
            entries = Array.isArray(parsed) ? parsed : entries.split(",");
        }
        if (!Array.isArray(entries)) entries = [entries];
        const output = [];
        for (const entry of entries) {
            let tileValue = entry;
            let weight = 1;
            if (entry && typeof entry === "object") {
                tileValue = entry.tileId ?? entry.code ?? entry.value;
                weight = finiteNumber(entry.weight, 1);
            } else if (typeof entry === "string" && entry.includes("*")) {
                const parts = entry.split("*");
                tileValue = parts[0].trim();
                weight = finiteNumber(parts[1], 1);
            }
            const tileId = parseTileId(tileValue);
            if (tileId !== null && weight > 0 && validateLayerValue(tileId, layer, tilesetId)) output.push({ tileId, weight });
        }
        return output;
    }

    function chooseWeightedTile(entries, random = Math.random) {
        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        let value = random() * total;
        for (const entry of entries) {
            value -= entry.weight;
            if (value <= 0) return entry.tileId;
        }
        return entries.length ? entries[entries.length - 1].tileId : 0;
    }

    function randomFill(x, y, width, height, layer, weightedTiles, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const entries = normalizeWeightedTiles(weightedTiles, key);
        if (!entries.length) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const cells = [];
        const random = typeof options.random === "function" ? options.random : Math.random;
        for (let py = rect.y; py < rect.y + rect.h; py++) {
            for (let px = rect.x; px < rect.x + rect.w; px++) {
                if (!inBounds(px, py)) continue;
                cells.push({ x: px, y: py, tiles: cellTilesForLayer(key, chooseWeightedTile(entries, random), false) });
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "randomFill");
        return patch;
    }

    // -------------------------------------------------------------------------
    // Whole-map transforms and project-wide authoring
    // -------------------------------------------------------------------------

    function normalizedRotation(value) {
        const rotation = ((integer(value, 0) % 360) + 360) % 360;
        return [0, 90, 180, 270].includes(rotation) ? rotation : 0;
    }

    function clampRectToMap(rect, width, height) {
        const x1 = Math.max(0, Math.min(width, integer(rect.x)));
        const y1 = Math.max(0, Math.min(height, integer(rect.y)));
        const x2 = Math.max(x1, Math.min(width, integer(rect.x) + positiveInteger(rect.w || rect.width, width)));
        const y2 = Math.max(y1, Math.min(height, integer(rect.y) + positiveInteger(rect.h || rect.height, height)));
        return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
    }

    function transformMapCoordinate(x, y, configuration) {
        const localX = integer(x) - configuration.crop.x;
        const localY = integer(y) - configuration.crop.y;
        const point = transformedPoint(localX, localY, configuration.crop.w, configuration.crop.h,
            configuration.rotation, configuration.mirrorX, configuration.mirrorY);
        return { x: point.x + configuration.offsetX, y: point.y + configuration.offsetY };
    }

    function transformEventCommandCoordinates(event, configuration, mapId) {
        if (!event || !Array.isArray(event.pages)) return event;
        const transformPair = (parameters, xIndex, yIndex) => {
            const point = transformMapCoordinate(parameters[xIndex], parameters[yIndex], configuration);
            parameters[xIndex] = point.x;
            parameters[yIndex] = point.y;
        };
        for (const page of event.pages) {
            if (page && page.image && page.image.direction) {
                page.image.direction = transformedDirection(page.image.direction, configuration.rotation,
                    configuration.mirrorX, configuration.mirrorY);
            }
            for (const command of page && page.list || []) {
                if (!command || !Array.isArray(command.parameters)) continue;
                const p = command.parameters;
                if (command.code === 201 && p[0] === 0 && integer(p[1]) === mapId) transformPair(p, 2, 3);
                else if (command.code === 202 && p[1] === 0 && integer(p[2]) === mapId) transformPair(p, 3, 4);
                else if (command.code === 203 && p[1] === 0) transformPair(p, 2, 3);
                else if (command.code === 285 && p[2] === 0) transformPair(p, 3, 4);
            }
        }
        return event;
    }

    function mapTransformConfiguration(snapshot, options = {}) {
        const cropValue = options.crop ? parseNestedStruct(options.crop, {}) : {
            x: 0, y: 0, w: snapshot.width, h: snapshot.height
        };
        const crop = clampRectToMap({
            x: cropValue.x || 0,
            y: cropValue.y || 0,
            w: cropValue.w || cropValue.width || snapshot.width,
            h: cropValue.h || cropValue.height || snapshot.height
        }, snapshot.width, snapshot.height);
        const rotation = normalizedRotation(options.rotation);
        const rotatedWidth = rotation === 90 || rotation === 270 ? crop.h : crop.w;
        const rotatedHeight = rotation === 90 || rotation === 270 ? crop.w : crop.h;
        const expand = parseNestedStruct(options.expand, {});
        const left = Math.max(0, integer(expand.left, 0));
        const right = Math.max(0, integer(expand.right, 0));
        const top = Math.max(0, integer(expand.top, 0));
        const bottom = Math.max(0, integer(expand.bottom, 0));
        const width = positiveInteger(options.targetWidth || options.width, rotatedWidth + left + right);
        const height = positiveInteger(options.targetHeight || options.height, rotatedHeight + top + bottom);
        let offsetX = integer(options.offsetX, left);
        let offsetY = integer(options.offsetY, top);
        const anchor = String(options.anchor || "custom").toLowerCase();
        if (anchor === "center") {
            offsetX = Math.floor((width - rotatedWidth) / 2);
            offsetY = Math.floor((height - rotatedHeight) / 2);
        } else if (anchor === "topright") offsetX = width - rotatedWidth;
        else if (anchor === "bottomleft") offsetY = height - rotatedHeight;
        else if (anchor === "bottomright") {
            offsetX = width - rotatedWidth;
            offsetY = height - rotatedHeight;
        }
        return {
            crop,
            rotation,
            mirrorX: toBoolean(options.mirrorX, false),
            mirrorY: toBoolean(options.mirrorY, false),
            rotatedWidth,
            rotatedHeight,
            width,
            height,
            offsetX,
            offsetY
        };
    }

    function transformMapSnapshot(snapshot, options = {}, mapId = 0, raw = null) {
        const config = mapTransformConfiguration(snapshot, options);
        const output = raw ? deepClone(raw) : {};
        output.width = config.width;
        output.height = config.height;
        output.tilesetId = integer(options.tilesetId, snapshot.tilesetId);
        output.note = options.note === undefined ? snapshot.note || "" : String(options.note);
        output.data = new Array(config.width * config.height * 6).fill(0);
        const fill = options.fillLayers || options.fill || {};
        for (const [layer, z] of Object.entries(LAYER_INDEX)) {
            const value = parseTileId(fill[layer] ?? 0);
            if (!value) continue;
            for (let y = 0; y < config.height; y++) {
                for (let x = 0; x < config.width; x++) writeTile(output.data, config.width, config.height, x, y, z, value);
            }
        }
        for (let sy = config.crop.y; sy < config.crop.y + config.crop.h; sy++) {
            for (let sx = config.crop.x; sx < config.crop.x + config.crop.w; sx++) {
                const target = transformMapCoordinate(sx, sy, config);
                if (!inBounds(target.x, target.y, config.width, config.height)) continue;
                for (let z = 0; z < 6; z++) {
                    writeTile(output.data, config.width, config.height, target.x, target.y, z,
                        readTile(snapshot.data, snapshot.width, snapshot.height, sx, sy, z));
                }
            }
        }
        output.events = [];
        for (const source of snapshot.events || []) {
            if (!source || !inRect(source.x, source.y, config.crop)) continue;
            const event = deepClone(source);
            const target = transformMapCoordinate(event.x, event.y, config);
            if (!inBounds(target.x, target.y, config.width, config.height)) continue;
            event.x = target.x;
            event.y = target.y;
            if (options.transformEventCommands !== false) transformEventCommandCoordinates(event, config, mapId);
            output.events[event.id] = event;
        }
        output._hybridTransform = {
            createdAt: Date.now(),
            sourceWidth: snapshot.width,
            sourceHeight: snapshot.height,
            configuration: deepClone(config)
        };
        return output;
    }

    function saveMapOverride(mapId, snapshot, options = {}) {
        const id = positiveInteger(mapId);
        const store = ensureStore();
        const key = String(id);
        if (options.checkpoint !== false) createCheckpoint(options.checkpointName || `[Transform] ${new Date().toISOString()}`, id);
        store.mapOverrides[key] = {
            width: snapshot.width,
            height: snapshot.height,
            data: snapshot.data.slice(),
            tilesetId: snapshot.tilesetId,
            note: snapshot.note || "",
            events: deepClone(snapshot.events || []),
            raw: deepClone(snapshot),
            transform: deepClone(snapshot._hybridTransform || null)
        };
        if (options.clearHistory !== false) {
            delete store.maps[key];
            delete store.redo[key];
        }
        composedCache.delete(id);
        if (id === $gameMap.mapId()) {
            rebuildCurrentMap("transformMap");
            const config = snapshot._hybridTransform && snapshot._hybridTransform.configuration;
            if (config && options.transformPlayer !== false && $gamePlayer) {
                const target = inRect($gamePlayer.x, $gamePlayer.y, config.crop)
                    ? transformMapCoordinate($gamePlayer.x, $gamePlayer.y, config)
                    : { x: Math.max(0, Math.min(snapshot.width - 1, $gamePlayer.x)),
                        y: Math.max(0, Math.min(snapshot.height - 1, $gamePlayer.y)) };
                if ($gamePlayer.locate) $gamePlayer.locate(target.x, target.y);
                else { $gamePlayer.x = target.x; $gamePlayer.y = target.y; }
            }
            if (config && options.transformVehicles !== false) {
                for (const name of ["boat", "ship", "airship"]) {
                    const vehicle = $gameMap[name] && $gameMap[name]();
                    if (!vehicle || (vehicle._mapId && vehicle._mapId !== id) || !inRect(vehicle.x, vehicle.y, config.crop)) continue;
                    const target = transformMapCoordinate(vehicle.x, vehicle.y, config);
                    if (vehicle.setLocation) vehicle.setLocation(id, target.x, target.y);
                    else if (vehicle.locate) vehicle.locate(target.x, target.y);
                }
            }
        }
        else emitChange({ operation: "transformMap", mapId: id, remote: true,
            dimensions: { width: snapshot.width, height: snapshot.height } });
        return deepClone(store.mapOverrides[key]);
    }

    function previewMapTransform(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        return Promise.all([preloadMap(id), loadRawMapJson(id)]).then(([snapshot, raw]) => {
            const config = mapTransformConfiguration(snapshot, options);
            return {
                mapId: id,
                from: { width: snapshot.width, height: snapshot.height, events: (snapshot.events || []).filter(Boolean).length },
                to: { width: config.width, height: config.height,
                    events: (snapshot.events || []).filter(event => event && inRect(event.x, event.y, config.crop)).length },
                configuration: config,
                estimatedTileWrites: config.width * config.height * 6,
                rawMetadataPreserved: !!raw
            };
        });
    }

    function transformMap(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        if (activeEditTransaction && activeEditTransaction.mapId === id) {
            return Promise.reject(new Error(`${PLUGIN_NAME}: commit or cancel the active editor transaction before transforming the map.`));
        }
        return measureAsync("transformMap", () => Promise.all([preloadMap(id), loadRawMapJson(id)]).then(([snapshot, raw]) => {
            const transformed = transformMapSnapshot(snapshot, options, id, raw);
            const saved = saveMapOverride(id, transformed, options);
            recordOperation("transformMap", { mapId: id, width: saved.width, height: saved.height,
                configuration: transformed._hybridTransform.configuration });
            return saved;
        }), { mapId: id });
    }

    function resizeMap(mapId, width, height, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { targetWidth: width, targetHeight: height }));
    }

    function rotateMap(mapId, rotation = 90, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { rotation }));
    }

    function mirrorMap(mapId, mirrorX = true, mirrorY = false, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { mirrorX, mirrorY }));
    }

    function cropMap(mapId, x, y, width, height, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { crop: { x, y, width, height } }));
    }

    async function batchTransformMaps(mapIds, options = {}) {
        const results = [];
        const errors = [];
        for (const rawId of normalizeList(mapIds)) {
            const mapId = positiveInteger(rawId, 0);
            if (!mapId) continue;
            try { results.push({ mapId, result: await transformMap(mapId, options) }); }
            catch (error) {
                errors.push({ mapId, message: error.message });
                if (options.stopOnError) break;
            }
        }
        return { results, errors, ok: errors.length === 0 };
    }
