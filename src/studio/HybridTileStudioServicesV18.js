/* Hybrid Tile Studio v18 — shared safety, format, and navigation services */
(() => {
    "use strict";

    const VERSION = "18.1.0";
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const list = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
    const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    const safeId = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
    const text = value => String(value ?? "").trim();

    function normalizeRecipe(value = {}) {
        const source = value?.recipe || value?.graph || value;
        const stages = list(source.nodes || source.stages).map((stage, index) => {
            const options = stage.options || stage;
            const rawType = text(stage.type || "scatter");
            const type = ({ roads:"road", decorate:"scatter", settlements:"scatter", interiors:"scatter", terrain:"biome", coast:"biome", stage:"scatter" })[rawType] || rawType;
            return {
                id: safeId(stage.id || `stage-${index + 1}`) || `stage-${index + 1}`,
                type,
                name: text(stage.name || stage.title || `Stage ${index + 1}`),
                layer: Math.max(0, Math.min(5, integer(options.layer))),
                tileA: Math.max(0, integer(options.tileA)),
                tileB: Math.max(0, integer(options.tileB)),
                density: Math.max(0, Math.min(1, Number(options.density ?? .12))),
                count: Math.max(1, integer(options.count, 8)),
                locked: !!stage.locked
            };
        });
        const normalized = {
            id: safeId(source.id || "main-world") || "main-world",
            name: text(source.name || "Main World"),
            seed: text(source.seed || "worldsmith"),
            stages: stages.length ? stages : [{ id: "details", type: "scatter", name: "Add details", layer: 2, tileA: 1, tileB: 2, density: .08, count: 30, locked: false }],
            lockedCells: [...new Set(list(source.lockedCells).map(String).filter(value => /^\d+,\d+$/.test(value)))],
            constraints: list(source.constraints).map(clone)
        };
        return normalized;
    }

    function recipePayload(recipe, checksum = value => String(JSON.stringify(value).length)) {
        const value = normalizeRecipe(recipe);
        const nodes = value.stages.map(stage => ({
            id: stage.id,
            type: stage.type === "road" ? "roads" : stage.type === "scatter" ? "decorate" : stage.type,
            name: stage.name,
            locked: stage.locked,
            options: { layer: stage.layer, tileA: stage.tileA, tileB: stage.tileB, density: stage.density, count: stage.count }
        }));
        const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }));
        const payload = {
            id: value.id,
            format: "HybridWorldRecipeGraph",
            version: 2,
            studioVersion: VERSION,
            name: value.name,
            seed: value.seed,
            nodes,
            edges,
            constraints: clone(value.constraints),
            lockedCells: clone(value.lockedCells),
            order: nodes.map(node => node.id),
            valid: true
        };
        payload.graphHash = checksum(payload);
        return payload;
    }

    function normalizeQuest(value = {}) {
        const source = value?.quest || value;
        const nodes = list(source.nodes).map((node, index) => ({
            id: safeId(node.id || `step-${index + 1}`) || `step-${index + 1}`,
            type: text(node.type || "objective"),
            title: text(node.title || `Step ${index + 1}`),
            description: text(node.description),
            conditions: list(node.conditions).map(clone),
            rewards: list(node.rewards).map(clone),
            rewardGold: Math.max(0, integer(node.rewardGold)),
            targetMapId: Math.max(0, integer(node.targetMapId || node.mapId)),
            targetX: Math.max(0, integer(node.targetX ?? node.x)),
            targetY: Math.max(0, integer(node.targetY ?? node.y))
        }));
        let edges = list(source.edges).map(edge => ({ from: safeId(edge.from), to: safeId(edge.to), label: text(edge.label || edge.choice), condition: clone(edge.condition ?? null) })).filter(edge => edge.from && edge.to);
        if (!edges.length) edges = list(source.nodes).map(node => node?.next ? ({ from: safeId(node.id), to: safeId(node.next), label: "", condition: null }) : null).filter(Boolean);
        return {
            id: safeId(source.id || "first-quest") || "first-quest",
            name: text(source.name || "First Quest"),
            nodes: nodes.length ? nodes : [
                { id: "start", type: "start", title: "Quest begins", description: "The player accepts the quest.", conditions: [], rewards: [], rewardGold: 0, targetMapId: 0, targetX: 0, targetY: 0 },
                { id: "complete", type: "complete", title: "Quest complete", description: "Reward the player.", conditions: [], rewards: [], rewardGold: 0, targetMapId: 0, targetX: 0, targetY: 0 }
            ],
            edges: edges.length ? edges : [{ from: "start", to: "complete", label: "", condition: null }],
            cues: list(source.cues || source.timeline?.cues).map((cue, index) => ({
                id: safeId(cue.id || `cue-${index + 1}`) || `cue-${index + 1}`,
                at: Math.max(0, Number(cue.at || 0)),
                duration: Math.max(0, Number(cue.duration || 0)),
                track: text(cue.track || "dialogue"),
                type: text(cue.type || "message"),
                target: text(cue.target),
                payload: clone(cue.payload || {})
            }))
        };
    }

    function validateQuest(quest) {
        const value = normalizeQuest(quest);
        const issues = [];
        const ids = new Set();
        for (const node of value.nodes) {
            if (ids.has(node.id)) issues.push({ severity: "error", message: `Duplicate node ID “${node.id}”.` });
            ids.add(node.id);
        }
        const starts = value.nodes.filter(node => node.type === "start");
        if (starts.length !== 1) issues.push({ severity: "error", message: "A quest needs exactly one start node." });
        if (!value.nodes.some(node => node.type === "complete")) issues.push({ severity: "error", message: "Add at least one completion node." });
        for (const edge of value.edges) {
            if (!ids.has(edge.from)) issues.push({ severity: "error", message: `Edge starts at missing node “${edge.from}”.` });
            if (!ids.has(edge.to)) issues.push({ severity: "error", message: `Edge points to missing node “${edge.to}”.` });
        }
        const visited = new Set();
        const queue = starts.length ? [starts[0].id] : [];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            for (const edge of value.edges) if (edge.from === id && !visited.has(edge.to)) queue.push(edge.to);
        }
        for (const node of value.nodes) if (!visited.has(node.id)) issues.push({ severity: "warning", message: `${node.id} is unreachable from start.` });
        for (const node of value.nodes.filter(item => !["complete", "fail"].includes(item.type))) if (!value.edges.some(edge => edge.from === node.id)) issues.push({ severity: "warning", message: `${node.id} has no outgoing path.` });
        return { ok: !issues.some(issue => issue.severity === "error"), issues, visited: visited.size, quest: value };
    }

    function questPayload(quest, checksum = value => String(JSON.stringify(value).length)) {
        const report = validateQuest(quest);
        const payload = {
            id: report.quest.id,
            format: "HybridQuestProject",
            version: 2,
            studioVersion: VERSION,
            name: report.quest.name,
            nodes: clone(report.quest.nodes),
            edges: clone(report.quest.edges),
            cues: clone(report.quest.cues),
            unreachable: report.issues.filter(issue => /unreachable/.test(issue.message)).map(issue => issue.message.split(" ")[0]),
            valid: report.ok
        };
        payload.questHash = checksum(payload);
        return payload;
    }

    function normalizeContentItem(item = {}, checksum = value => String(JSON.stringify(value).length)) {
        const type = text(item.type || item.kind || "map");
        const payload = clone(item.payload || (item.map ? { map: item.map, width: item.width, height: item.height, tilesetId: item.tilesetId } : item.recipe ? { recipe: item.recipe } : item.quest ? { quest: item.quest } : {}));
        const id = safeId(item.id || `${type}-${Date.now().toString(36)}`);
        return {
            id,
            name: text(item.name || id || "Untitled content"),
            type,
            version: Math.max(1, integer(item.version, 1)),
            description: text(item.description),
            tags: [...new Set(list(item.tags).map(text).filter(Boolean))],
            dependencies: [...new Set(list(item.dependencies).map(text).filter(Boolean))],
            favorite: !!item.favorite,
            contentHash: text(item.contentHash || item.checksum || checksum(payload)),
            payload,
            capturedAt: Number(item.capturedAt || Date.now())
        };
    }

    function normalizeContentLibrary(value = {}, checksum) {
        const rawItems = list(value?.items || value);
        const seen = new Set();
        const items = [];
        for (const raw of rawItems) {
            const item = normalizeContentItem(raw, checksum);
            if (!item.id || seen.has(item.id)) continue;
            seen.add(item.id);
            items.push(item);
        }
        return items;
    }

    function contentPayload(items, checksum) {
        return { format: "HybridContentLibrary", version: 2, studioVersion: VERSION, exportedAt: new Date().toISOString(), items: normalizeContentLibrary(items, checksum) };
    }

    function validateContentLibrary(value, options = {}) {
        const errors = [];
        if (Number(options.bytes || 0) > Number(options.maxBytes || 10 * 1024 * 1024)) errors.push("Content library exceeds the 10 MB import limit.");
        const items = normalizeContentLibrary(value, options.checksum);
        if (!items.length) errors.push("The file contains no recognized content items.");
        for (const item of items) {
            if (!item.id || !item.name) errors.push("Every content item needs an ID and name.");
            if (!["map", "room", "event", "recipe", "quest", "encounter", "tileset", "map-fragment"].includes(item.type)) errors.push(`${item.name} uses unsupported type “${item.type}”.`);
            if (item.type === "map") {
                const map = item.payload?.map;
                if (!map || !Number.isInteger(map.width) || !Number.isInteger(map.height) || !Array.isArray(map.data) || map.data.length !== map.width * map.height * 6) errors.push(`${item.name} does not contain a structurally valid RPG Maker map.`);
            }
        }
        return { ok: !errors.length, errors: [...new Set(errors)], items };
    }

    function mapDelta(base, draft) {
        if (!base || !draft) return { ok: false, reason: "missing-map", width: 0, height: 0, tilesetId: 0, tiles: [] };
        if (base.width !== draft.width || base.height !== draft.height) return { ok: false, reason: "dimensions-changed", width: integer(draft.width), height: integer(draft.height), tilesetId: integer(draft.tilesetId), tiles: [] };
        const tiles = [];
        const length = Math.max(base.data?.length || 0, draft.data?.length || 0);
        for (let index = 0; index < length; index++) {
            const before = integer(base.data?.[index]);
            const after = integer(draft.data?.[index]);
            if (before !== after) tiles.push({ index, before, after });
        }
        return {
            ok: true,
            format: "HybridMapDelta",
            version: 1,
            width: integer(draft.width),
            height: integer(draft.height),
            tilesetId: integer(draft.tilesetId),
            tiles
        };
    }

    function applyMapDelta(current, delta) {
        if (!current || !delta) return { ok: false, reason: "missing-map", merged: null, applied: 0, conflicts: [] };
        if (integer(current.width) !== integer(delta.width) || integer(current.height) !== integer(delta.height)) {
            return { ok: false, reason: "dimensions-changed", merged: clone(current), applied: 0, conflicts: [{ type: "dimensions", current: { width: current.width, height: current.height }, draft: { width: delta.width, height: delta.height } }] };
        }
        const merged = clone(current);
        let applied = 0;
        for (const change of list(delta.tiles)) {
            const index = integer(change.index, -1);
            if (index < 0 || index >= merged.data.length) continue;
            const after = integer(change.after);
            if (merged.data[index] !== after) applied++;
            merged.data[index] = after;
        }
        merged.events = clone(current.events || []);
        return { ok: true, reason: "applied", merged, applied, conflicts: [] };
    }

    function mergeMapDelta(delta, current) {
        if (!current || !delta) return { ok: false, reason: "missing-map", conflicts: [], merged: current ? clone(current) : null, applied: 0 };
        if (integer(current.width) !== integer(delta.width) || integer(current.height) !== integer(delta.height)) {
            return { ok: false, reason: "dimensions-changed", conflicts: [{ type: "dimensions", current: { width: current.width, height: current.height }, draft: { width: delta.width, height: delta.height } }], merged: clone(current), applied: 0 };
        }
        const merged = clone(current);
        const conflicts = [];
        let applied = 0;
        for (const change of list(delta.tiles)) {
            const index = integer(change.index, -1);
            if (index < 0 || index >= merged.data.length) continue;
            const before = integer(change.before);
            const after = integer(change.after);
            const currentValue = integer(current.data[index]);
            if (currentValue === before || currentValue === after) {
                if (merged.data[index] !== after) applied++;
                merged.data[index] = after;
            } else conflicts.push({ type: "tile", index, base: before, draft: after, current: currentValue });
        }
        merged.events = clone(current.events || []);
        return { ok: conflicts.length === 0, reason: conflicts.length ? "tile-conflicts" : "rebased", conflicts, merged, applied };
    }

    function mergeMapDraft(base, draft, current) {
        if (!base || !draft || !current) return { ok: false, reason: "missing-map", conflicts: [], merged: null, applied: 0 };
        if (base.width !== draft.width || base.height !== draft.height || current.width !== base.width || current.height !== base.height) return { ok: false, reason: "dimensions-changed", conflicts: [{ type: "dimensions" }], merged: clone(current), applied: 0 };
        const merged = clone(current);
        const conflicts = [];
        let applied = 0;
        for (let index = 0; index < Math.max(base.data.length, draft.data.length); index++) {
            if (base.data[index] === draft.data[index]) continue;
            if (current.data[index] === base.data[index] || current.data[index] === draft.data[index]) {
                if (merged.data[index] !== draft.data[index]) applied++;
                merged.data[index] = draft.data[index];
            } else conflicts.push({ type: "tile", index, base: base.data[index], draft: draft.data[index], current: current.data[index] });
        }
        merged.events = clone(current.events || []);
        return { ok: !conflicts.length, reason: conflicts.length ? "tile-conflicts" : "rebased", conflicts, merged, applied };
    }

    function spatialNext(items, active, direction) {
        if (!items.length) return null;
        const origin = active && items.includes(active) ? active : items[0];
        const from = origin.getBoundingClientRect();
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
        const candidates = items.filter(item => item !== origin).map(item => {
            const rect = item.getBoundingClientRect();
            const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
            const dx = x - fx, dy = y - fy;
            const valid = direction === "left" ? dx < -1 : direction === "right" ? dx > 1 : direction === "up" ? dy < -1 : dy > 1;
            if (!valid) return null;
            const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
            const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
            return { item, score: primary + secondary * 2.4 };
        }).filter(Boolean).sort((a, b) => a.score - b.score);
        return candidates[0]?.item || null;
    }

    window.HybridTileStudioServicesV18 = Object.freeze({
        version: VERSION,
        clone,
        list,
        integer,
        safeId,
        normalizeRecipe,
        recipePayload,
        normalizeQuest,
        validateQuest,
        questPayload,
        normalizeContentItem,
        normalizeContentLibrary,
        contentPayload,
        validateContentLibrary,
        mapDelta,
        applyMapDelta,
        mergeMapDelta,
        mergeMapDraft,
        spatialNext
    });
})();
