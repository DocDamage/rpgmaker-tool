    // -------------------------------------------------------------------------
    // v13 world intelligence, history, packaging, and extension services
    // -------------------------------------------------------------------------

    function projectMapIds(options = {}) {
        const requested = normalizeList(options.mapIds).map(Number).filter(value => value > 0);
        if (requested.length) return [...new Set(requested)];
        if (typeof $dataMapInfos !== "undefined" && Array.isArray($dataMapInfos)) {
            return $dataMapInfos.filter(Boolean).map(info => positiveInteger(info.id)).filter(Boolean);
        }
        return typeof $gameMap !== "undefined" && $gameMap ? [$gameMap.mapId()] : [];
    }

    function mapInfoRecord(mapId) {
        const info = typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos[integer(mapId)] : null;
        return { id: integer(mapId), name: String(info?.name || `Map ${integer(mapId)}`), parentId: integer(info?.parentId, 0), order: integer(info?.order, integer(mapId)) };
    }

    function eachEventCommand(map, callback) {
        for (const event of map?.events || []) if (event) {
            for (let pageIndex = 0; pageIndex < (event.pages || []).length; pageIndex++) {
                const page = event.pages[pageIndex];
                for (let commandIndex = 0; commandIndex < (page?.list || []).length; commandIndex++) {
                    callback(page.list[commandIndex], event, page, pageIndex, commandIndex);
                }
            }
        }
    }

    function directedCycles(nodes, edges) {
        const graph = new Map(nodes.map(node => [String(node.id), []]));
        for (const edge of edges) if (graph.has(String(edge.from)) && graph.has(String(edge.to))) graph.get(String(edge.from)).push(String(edge.to));
        const visiting = new Set(); const visited = new Set(); const found = new Map();
        const visit = (id, path) => {
            if (visiting.has(id)) {
                const start = path.indexOf(id); const cycle = [...path.slice(Math.max(0, start)), id];
                found.set([...new Set(cycle)].sort().join("|"), cycle); return;
            }
            if (visited.has(id)) return;
            visiting.add(id); path.push(id);
            for (const next of graph.get(id) || []) visit(next, path);
            path.pop(); visiting.delete(id); visited.add(id);
        };
        for (const id of graph.keys()) visit(id, []);
        return [...found.values()];
    }

    async function analyzeWorldAtlas(options = {}) {
        const ids = projectMapIds(options); const nodes = []; const edges = []; const issues = []; const known = new Set(ids);
        for (const mapId of ids) {
            const info = mapInfoRecord(mapId); let map;
            try { map = await mapSnapshotAsync(mapId); }
            catch (error) { issues.push({ severity: "error", type: "map-load", mapId, message: error.message }); continue; }
            nodes.push(Object.assign(info, { width: positiveInteger(map.width), height: positiveInteger(map.height), eventCount: (map.events || []).filter(Boolean).length }));
            eachEventCommand(map, (command, event, _page, pageIndex, commandIndex) => {
                if (integer(command?.code) !== 201 || integer(command.parameters?.[0]) !== 0) return;
                const targetId = integer(command.parameters?.[1]);
                const edge = { id: `transfer:${mapId}:${event.id}:${pageIndex}:${commandIndex}`, from: mapId, to: targetId, eventId: event.id,
                    x: integer(command.parameters?.[2]), y: integer(command.parameters?.[3]), direction: integer(command.parameters?.[4]), type: "transfer" };
                edges.push(edge);
                if (!known.has(targetId)) issues.push({ severity: "error", type: "missing-map", mapId, eventId: event.id, targetMapId: targetId, message: `Transfer targets missing Map ${targetId}.` });
            });
        }
        const connected = new Set(edges.flatMap(edge => [integer(edge.from), integer(edge.to)]));
        const disconnected = nodes.filter(node => nodes.length > 1 && !connected.has(node.id)).map(node => node.id);
        for (const mapId of disconnected) issues.push({ severity: "warning", type: "disconnected-map", mapId, message: `Map ${mapId} has no direct transfer connection.` });
        const cycles = directedCycles(nodes, edges);
        const atlas = { id: String(options.id || `atlas-${Date.now()}`), format: "HybridWorldAtlas", version: 1, pluginVersion: VERSION,
            createdAt: Date.now(), nodes, edges, roots: nodes.filter(node => !node.parentId).map(node => node.id), disconnected, cycles, issues,
            ok: !issues.some(issue => issue.severity === "error") };
        ensureStore().worldAtlases[atlas.id] = deepClone(atlas);
        recordOperation("analyzeWorldAtlas", { maps: nodes.length, transfers: edges.length, issues: issues.length });
        return deepClone(atlas);
    }

    function listWorldAtlases() { return Object.values(ensureStore().worldAtlases || {}).map(item => ({ id: item.id, createdAt: item.createdAt, maps: item.nodes?.length || 0, transfers: item.edges?.length || 0, issues: item.issues?.length || 0, ok: !!item.ok })); }

    function graphNode(store, id, type, label, detail = {}) {
        if (!store.has(id)) store.set(id, Object.assign({ id, type, label: String(label || id) }, deepClone(detail)));
        return store.get(id);
    }

    async function analyzeEventQuestGraph(options = {}) {
        const nodes = new Map(); const edges = []; const issues = []; const mapIds = projectMapIds(options);
        const addEdge = (from, to, kind, detail = {}) => edges.push(Object.assign({ id: `edge:${edges.length + 1}`, from, to, kind }, deepClone(detail)));
        for (const mapId of mapIds) {
            let map; try { map = await mapSnapshotAsync(mapId); } catch (error) { issues.push({ severity: "error", mapId, message: error.message }); continue; }
            const mapNode = `map:${mapId}`; graphNode(nodes, mapNode, "map", mapInfoRecord(mapId).name, { mapId });
            for (const event of map.events || []) if (event) {
                const eventNode = `event:${mapId}:${event.id}`; graphNode(nodes, eventNode, "event", event.name || `Event ${event.id}`, { mapId, eventId: event.id, x: event.x, y: event.y }); addEdge(mapNode, eventNode, "contains");
                for (let pageIndex = 0; pageIndex < (event.pages || []).length; pageIndex++) {
                    const page = event.pages[pageIndex]; const pageNode = `${eventNode}:page:${pageIndex + 1}`; graphNode(nodes, pageNode, "event-page", `Page ${pageIndex + 1}`, { mapId, eventId: event.id, pageIndex }); addEdge(eventNode, pageNode, "has-page");
                    const conditions = page?.conditions || {};
                    const conditionIds = [];
                    if (conditions.switch1Valid) conditionIds.push([`switch:${integer(conditions.switch1Id)}`, "switch", `Switch ${integer(conditions.switch1Id)}`]);
                    if (conditions.switch2Valid) conditionIds.push([`switch:${integer(conditions.switch2Id)}`, "switch", `Switch ${integer(conditions.switch2Id)}`]);
                    if (conditions.variableValid) conditionIds.push([`variable:${integer(conditions.variableId)}`, "variable", `Variable ${integer(conditions.variableId)}`]);
                    if (conditions.selfSwitchValid) conditionIds.push([`self-switch:${mapId}:${event.id}:${conditions.selfSwitchCh}`, "self-switch", `Self Switch ${conditions.selfSwitchCh}`]);
                    for (const [id, type, label] of conditionIds) { graphNode(nodes, id, type, label); addEdge(id, pageNode, "conditions"); }
                    for (let commandIndex = 0; commandIndex < (page?.list || []).length; commandIndex++) {
                        const command = page.list[commandIndex]; const code = integer(command?.code); const detail = { mapId, eventId: event.id, pageIndex, commandIndex };
                        if (code === 121) for (let id = integer(command.parameters?.[0]); id <= integer(command.parameters?.[1]); id++) { const target = `switch:${id}`; graphNode(nodes, target, "switch", `Switch ${id}`); addEdge(pageNode, target, "writes", detail); }
                        else if (code === 122) for (let id = integer(command.parameters?.[0]); id <= integer(command.parameters?.[1]); id++) { const target = `variable:${id}`; graphNode(nodes, target, "variable", `Variable ${id}`); addEdge(pageNode, target, "writes", detail); }
                        else if (code === 123) { const target = `self-switch:${mapId}:${event.id}:${command.parameters?.[0]}`; graphNode(nodes, target, "self-switch", `Self Switch ${command.parameters?.[0]}`); addEdge(pageNode, target, "writes", detail); }
                        else if (code === 117) { const id = integer(command.parameters?.[0]); const target = `common-event:${id}`; graphNode(nodes, target, "common-event", `Common Event ${id}`); addEdge(pageNode, target, "calls", detail); }
                        else if (code === 201 && integer(command.parameters?.[0]) === 0) { const id = integer(command.parameters?.[1]); const target = `map:${id}`; graphNode(nodes, target, "map", mapInfoRecord(id).name, { mapId: id }); addEdge(pageNode, target, "transfers", detail); }
                    }
                }
            }
        }
        const values = [...nodes.values()]; const incoming = new Set(edges.map(edge => edge.to)); const outgoing = new Set(edges.map(edge => edge.from));
        const unused = values.filter(node => ["switch", "variable", "self-switch"].includes(node.type) && (!incoming.has(node.id) || !outgoing.has(node.id))).map(node => node.id);
        for (const id of unused) issues.push({ severity: "warning", type: "one-sided-state", nodeId: id, message: `${nodes.get(id).label} is only read or only written.` });
        const graph = { id: String(options.id || `quest-graph-${Date.now()}`), format: "HybridEventQuestGraph", version: 1, pluginVersion: VERSION,
            createdAt: Date.now(), nodes: values, edges, unused, issues, ok: !issues.some(issue => issue.severity === "error") };
        ensureStore().eventQuestGraphs[graph.id] = deepClone(graph); recordOperation("analyzeEventQuestGraph", { nodes: values.length, edges: edges.length, issues: issues.length }); return deepClone(graph);
    }

    function listEventQuestGraphs() { return Object.values(ensureStore().eventQuestGraphs || {}).map(item => ({ id: item.id, createdAt: item.createdAt, nodes: item.nodes?.length || 0, edges: item.edges?.length || 0, issues: item.issues?.length || 0, ok: !!item.ok })); }

    function analyzeMapIntelligence(snapshot = null, options = {}) {
        const map = snapshot || (typeof $dataMap !== "undefined" ? $dataMap : null); if (!map) return { ok: false, issues: [{ severity: "error", message: "No map is loaded." }], repairs: [] };
        const mapId = integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0); const issues = []; const repairs = [];
        const expected = positiveInteger(map.width) * positiveInteger(map.height) * 6;
        if (!Array.isArray(map.data) || map.data.length !== expected) issues.push({ severity: "error", type: "tile-data-size", message: `Tile data has ${map.data?.length || 0} entries; expected ${expected}.` });
        for (const event of map.events || []) if (event) {
            if (!inBounds(integer(event.x), integer(event.y), map.width, map.height)) {
                const target = { x: Math.max(0, Math.min(map.width - 1, integer(event.x))), y: Math.max(0, Math.min(map.height - 1, integer(event.y))) };
                issues.push({ severity: "error", type: "event-out-of-bounds", eventId: event.id, message: `${event.name || `Event ${event.id}`} is outside the map.` });
                repairs.push({ type: "move-event", eventId: event.id, from: { x: event.x, y: event.y }, to: target, confidence: 1 });
            }
        }
        if (Array.isArray(map.data) && map.data.length >= expected) {
            for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
                const value = readTile(map.data, map.width, map.height, x, y, 0); if (value) continue;
                const adjacent = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].map(([nx, ny]) => readTile(map.data, map.width, map.height, nx, ny, 0)).filter(Boolean);
                const counts = new Map(); for (const tile of adjacent) counts.set(tile, (counts.get(tile) || 0) + 1);
                const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
                if (best?.[1] >= 3) { issues.push({ severity: "warning", type: "ground-hole", x, y, message: `Likely one-tile ground hole at ${x}, ${y}.` }); repairs.push({ type: "set-tile", x, y, layer: "L1", tileId: best[0], confidence: best[1] / 4 }); }
            }
        }
        eachEventCommand(map, (command, event) => {
            if (integer(command?.code) !== 201 || integer(command.parameters?.[0]) !== 0) return;
            const targetId = integer(command.parameters?.[1]); const known = typeof $dataMapInfos === "undefined" || !$dataMapInfos || !!$dataMapInfos[targetId];
            if (!known) issues.push({ severity: "error", type: "broken-transfer", eventId: event.id, targetMapId: targetId, message: `Transfer targets missing Map ${targetId}.` });
        });
        const result = { ok: !issues.some(issue => issue.severity === "error"), mapId, width: map.width, height: map.height, issues, repairs,
            summary: { errors: issues.filter(issue => issue.severity === "error").length, warnings: issues.filter(issue => issue.severity === "warning").length, safeRepairs: repairs.filter(item => item.confidence >= .75).length } };
        return deepClone(result);
    }

    function repairMapIntelligently(options = {}) {
        const analysis = analyzeMapIntelligence(options.snapshot || null, options); const minimum = Math.max(0, Math.min(1, finiteNumber(options.minimumConfidence, .75)));
        const selected = analysis.repairs.filter(repair => repair.confidence >= minimum && (!options.types || normalizeList(options.types).includes(repair.type)));
        if (options.apply === false || !selected.length) return Object.assign(analysis, { applied: false, selected });
        const cells = selected.filter(repair => repair.type === "set-tile").map(repair => ({ x: repair.x, y: repair.y, tiles: { [repair.layer]: repair.tileId } }));
        const source = options.snapshot || $dataMap; const events = selected.filter(repair => repair.type === "move-event").map(repair => { const event = deepClone(source.events?.[repair.eventId]); if (!event) return null; event.x = repair.to.x; event.y = repair.to.y; return event; }).filter(Boolean);
        const patches = []; if (cells.length) patches.push(makeSparsePatch(cells, "autotile", cells)); if (events.length) patches.push(makeEventPatch(events, events.map(event => event.id), "Intelligent event repair", { preserveEventState: true }));
        if (patches.length) { const patch = patches.length === 1 ? patches[0] : makeBatchPatch(patches, "Intelligent map repair"); applyPatchToMap(analysis.mapId || $gameMap.mapId(), patch, "repairMapIntelligently"); }
        ensureStore().mapRepairProfiles[String(analysis.mapId)] = { lastRunAt: Date.now(), selected: deepClone(selected), summary: deepClone(analysis.summary) };
        recordOperation("repairMapIntelligently", { mapId: analysis.mapId, repairs: selected.length }); return Object.assign(analysis, { applied: true, selected });
    }

    function mapVisualChecksum(snapshot) {
        const text = JSON.stringify(canonicalizeWorkspace({ width: snapshot?.width, height: snapshot?.height, tilesetId: snapshot?.tilesetId, data: snapshot?.data || [], events: snapshot?.events || [] }));
        let hash = 2166136261; for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619); return (hash >>> 0).toString(16).padStart(8, "0");
    }

    async function createVisualHistorySnapshot(name = "Map snapshot", mapId = 0, options = {}) {
        const id = integer(mapId) || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0); const map = await mapSnapshotAsync(id);
        const item = { id: String(options.id || `visual-${Date.now()}`), name: String(name || "Map snapshot"), mapId: id, createdAt: Date.now(), checksum: mapVisualChecksum(map), map: deepClone(map), tags: normalizeList(options.tags).map(String) };
        ensureStore().visualHistory.unshift(item); ensureStore().visualHistory = ensureStore().visualHistory.slice(0, Math.max(2, integer(options.retain, 20))); recordOperation("createVisualHistorySnapshot", { mapId: id, snapshotId: item.id });
        return deepClone({ id: item.id, name: item.name, mapId: item.mapId, createdAt: item.createdAt, checksum: item.checksum, tags: item.tags });
    }

    function listVisualHistory(mapId = 0) { return (ensureStore().visualHistory || []).filter(item => !integer(mapId) || item.mapId === integer(mapId)).map(({ map, ...item }) => deepClone(item)); }

    function diffVisualHistory(fromId, toId, options = {}) {
        const history = ensureStore().visualHistory || []; const from = history.find(item => item.id === String(fromId)); const to = history.find(item => item.id === String(toId));
        if (!from || !to) return { ok: false, errors: ["Both visual-history snapshots are required."] };
        const width = Math.max(from.map.width, to.map.width); const height = Math.max(from.map.height, to.map.height); const tiles = [];
        for (let z = 0; z < 6; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const before = readTile(from.map.data, from.map.width, from.map.height, x, y, z); const after = readTile(to.map.data, to.map.width, to.map.height, x, y, z); if (before !== after) tiles.push({ x, y, layer: `L${z + 1}`, before, after }); }
        const beforeEvents = new Map((from.map.events || []).filter(Boolean).map(event => [event.id, event])); const afterEvents = new Map((to.map.events || []).filter(Boolean).map(event => [event.id, event])); const events = [];
        for (const id of new Set([...beforeEvents.keys(), ...afterEvents.keys()])) { const before = beforeEvents.get(id) || null; const after = afterEvents.get(id) || null; if (JSON.stringify(before) !== JSON.stringify(after)) events.push({ eventId: id, before: deepClone(before), after: deepClone(after) }); }
        const limit = Math.max(1, integer(options.limit, 5000)); return { ok: true, from: from.id, to: to.id, mapId: to.mapId, tileChangeCount: tiles.length, eventChangeCount: events.length, tiles: tiles.slice(0, limit), events: events.slice(0, limit), truncated: tiles.length > limit || events.length > limit };
    }

    function versionParts(value) { return String(value || "0.0.0").replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map(part => Math.max(0, integer(part))); }
    function compareVersions(a, b) { const left = versionParts(a); const right = versionParts(b); for (let index = 0; index < 3; index++) { const difference = (left[index] || 0) - (right[index] || 0); if (difference) return difference < 0 ? -1 : 1; } return 0; }
    function satisfiesVersion(version, range = "*") {
        const text = String(range || "*").trim(); if (!text || text === "*") return true;
        if (text.startsWith("^")) { const base = text.slice(1); const parts = versionParts(base); return compareVersions(version, base) >= 0 && compareVersions(version, `${parts[0] + 1}.0.0`) < 0; }
        if (text.startsWith("~")) { const base = text.slice(1); const parts = versionParts(base); return compareVersions(version, base) >= 0 && compareVersions(version, `${parts[0]}.${parts[1] + 1}.0`) < 0; }
        const tests = text.split(/\s+/).filter(Boolean); if (tests.some(test => /^(>=|<=|>|<)/.test(test))) return tests.every(test => { const match = test.match(/^(>=|<=|>|<)(.+)$/); const compared = compareVersions(version, match[2]); return match[1] === ">=" ? compared >= 0 : match[1] === "<=" ? compared <= 0 : match[1] === ">" ? compared > 0 : compared < 0; });
        return compareVersions(version, text) === 0;
    }

    function resolvePackDependencies(requested, available = [], options = {}) {
        const catalog = [...normalizeList(available), ...Object.values(ensureStore().worldRecipePacks || {})].filter(item => item?.id);
        const byId = new Map(); for (const pack of catalog) { const list = byId.get(String(pack.id)) || []; list.push(pack); list.sort((a, b) => compareVersions(b.version, a.version)); byId.set(String(pack.id), list); }
        const queue = normalizeList(requested).map(item => typeof item === "string" ? { id: item, range: "*" } : item); const selected = new Map(); const errors = []; const warnings = []; const visiting = new Set();
        const choose = requirement => {
            const id = String(requirement.id || ""); const range = String(requirement.range || requirement.version || "*"); if (!id) return;
            if (visiting.has(id)) { warnings.push(`Dependency cycle includes ${id}.`); return; }
            const current = selected.get(id); if (current && satisfiesVersion(current.version, range)) return;
            const match = (byId.get(id) || []).find(pack => satisfiesVersion(pack.version, range)); if (!match) { if (!requirement.optional) errors.push(`No compatible ${id} version satisfies ${range}.`); return; }
            selected.set(id, match); visiting.add(id); for (const dependency of normalizeList(match.dependencies)) choose(typeof dependency === "string" ? { id: dependency, range: "*" } : dependency); visiting.delete(id);
        };
        for (const requirement of queue) choose(requirement); const order = []; const permanent = new Set(); const visit = pack => { if (!pack || permanent.has(pack.id)) return; for (const dependency of normalizeList(pack.dependencies)) visit(selected.get(String(typeof dependency === "string" ? dependency : dependency.id))); permanent.add(pack.id); order.push(pack); }; for (const pack of selected.values()) visit(pack);
        return { ok: errors.length === 0, requested: deepClone(queue), selected: order.map(pack => ({ id: pack.id, name: pack.name || pack.id, version: pack.version, permissions: deepClone(pack.permissions || []), capabilities: deepClone(pack.capabilities || []) })), installOrder: order.map(pack => pack.id), errors, warnings, allowPrerelease: !!options.allowPrerelease };
    }

    function registerPackRepository(definition) { if (!definition?.id) throw new Error("Pack repository id is required."); const item = { id: String(definition.id), name: String(definition.name || definition.id), url: String(definition.url || ""), enabled: definition.enabled !== false, priority: integer(definition.priority), trustedPublisherIds: normalizeList(definition.trustedPublisherIds).map(String), updatedAt: Date.now() }; ensureStore().packRepositories[item.id] = item; return deepClone(item); }
    function listPackRepositories() { return Object.values(ensureStore().packRepositories || {}).map(deepClone); }

    function validateExtensionManifest(manifest) {
        const errors = []; const warnings = []; if (!manifest || typeof manifest !== "object") errors.push("Manifest must be an object.");
        const id = safeWorldRecipeId(manifest?.id); if (!id) errors.push("Extension id is invalid.");
        if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(String(manifest?.version || ""))) errors.push("Extension version must use semantic versioning.");
        const permissions = normalizeList(manifest?.permissions).map(String); for (const permission of permissions) if (!EXTENSION_PERMISSIONS.has(permission)) errors.push(`Unknown permission ${permission}.`);
        if (!manifest?.entry && !manifest?.contributes) warnings.push("Extension has no entry point or declarative contributions.");
        return { ok: !errors.length, id, permissions, errors, warnings };
    }

    function installExtensionManifest(manifest, options = {}) {
        const report = validateExtensionManifest(manifest); if (!report.ok) throw new Error(report.errors.join(" "));
        const record = { id: report.id, name: String(manifest.name || report.id), version: String(manifest.version), description: String(manifest.description || ""), publisher: String(manifest.publisher || "local"), entry: String(manifest.entry || ""), permissions: report.permissions, contributes: deepClone(manifest.contributes || {}), installedAt: Date.now(), enabled: options.enabled !== false, trusted: !!options.trusted };
        ensureStore().extensionManifests[record.id] = record; ensureStore().extensionPermissions[record.id] = options.grant === true ? deepClone(record.permissions) : normalizeList(options.permissions).filter(value => record.permissions.includes(value));
        recordOperation("installExtensionManifest", { extensionId: record.id, permissions: ensureStore().extensionPermissions[record.id] }); return deepClone(record);
    }

    function setExtensionPermissions(id, permissions = []) { const record = ensureStore().extensionManifests[String(id)]; if (!record) return false; const granted = normalizeList(permissions).map(String).filter(permission => record.permissions.includes(permission) && EXTENSION_PERMISSIONS.has(permission)); ensureStore().extensionPermissions[String(id)] = granted; return deepClone(granted); }
    function listExtensionManifests() { const store = ensureStore(); return Object.values(store.extensionManifests || {}).map(item => Object.assign({}, deepClone(item), { grantedPermissions: deepClone(store.extensionPermissions[item.id] || []) })); }
    function removeExtensionManifest(id) { const key = String(id); const existed = !!ensureStore().extensionManifests[key]; delete ensureStore().extensionManifests[key]; delete ensureStore().extensionPermissions[key]; return existed; }

    function createExtensionContext(id) {
        const key = String(id); const manifest = ensureStore().extensionManifests[key]; if (!manifest || manifest.enabled === false) return null; const granted = new Set(ensureStore().extensionPermissions[key] || []); const requirePermission = permission => { if (!granted.has(permission)) throw new Error(`Extension ${key} requires ${permission}.`); };
        return Object.freeze({ id: key, version: VERSION, permissions: [...granted],
            readMap: async mapId => { requirePermission("map:read"); return deepClone(await mapSnapshotAsync(mapId)); },
            applyPatch: (mapId, patch) => { requirePermission("map:write"); return applyPatchToMap(mapId, deepClone(patch), `extension:${key}`); },
            worldState: () => { requirePermission("world:read"); return deepClone(ensureStore().worldState); },
            setWorldState: (path, value) => { requirePermission("world:write"); return setWorldState(path, value); },
            validateProject: options => { requirePermission("project:validate"); return runProductionValidation(options); },
            resolvePacks: (requested, available, options) => { requirePermission("pack:manage"); return resolvePackDependencies(requested, available, options); }
        });
    }

    function simulateNpcDirector(options = {}) {
        const store = ensureStore(); const start = integer(options.startMinute, worldClock().minute); const duration = Math.max(1, integer(options.durationMinutes, 1440)); const step = Math.max(1, integer(options.stepMinutes, 15)); const frames = []; const conflicts = [];
        const routes = Object.values(store.worldNpcRoutes || {}).filter(route => route.enabled !== false); const positionsAt = minute => routes.map(route => { const points = route.points || []; if (!points.length) return null; const total = Math.max(1, points.reduce((sum, point) => sum + Math.max(1, integer(point.durationMinutes, point.duration || 1)), 0)); let cursor = ((minute - integer(route.startMinute, 0)) % total + total) % total; let point = points[0]; for (const candidate of points) { const span = Math.max(1, integer(candidate.durationMinutes, candidate.duration || 1)); if (cursor < span) { point = candidate; break; } cursor -= span; } return { npcId: route.npcId, routeId: route.id, mapId: integer(point.mapId), x: integer(point.x), y: integer(point.y), activity: String(point.activity || "travel") }; }).filter(Boolean);
        for (let minute = start; minute <= start + duration; minute += step) { const positions = positionsAt(minute); const cells = new Map(); for (const position of positions) { const key = `${position.mapId}:${position.x},${position.y}`; const bucket = cells.get(key) || []; bucket.push(position); cells.set(key, bucket); } for (const [cell, occupants] of cells) if (occupants.length > 1) conflicts.push({ minute, cell, npcIds: occupants.map(item => item.npcId), severity: occupants.length > 3 ? "error" : "warning" }); frames.push({ minute, positions }); }
        return { startMinute: start, durationMinutes: duration, stepMinutes: step, frames, conflicts, conflictCount: conflicts.length, ok: !conflicts.some(item => item.severity === "error") };
    }

    async function runGoldenMapTest(definition = {}) {
        const mapId = positiveInteger(definition.mapId || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 1)); const map = await mapSnapshotAsync(mapId); const actual = mapVisualChecksum(map); const expected = String(definition.expectedChecksum || definition.checksum || actual); const repair = analyzeMapIntelligence(map, { mapId });
        return { id: String(definition.id || `golden-map-${mapId}`), name: String(definition.name || `Golden Map ${mapId}`), mapId, expectedChecksum: expected, actualChecksum: actual, checksumMatch: actual === expected, structural: repair, passed: actual === expected && repair.ok };
    }

    async function runProductionValidation(options = {}) {
        const mapIds = projectMapIds(options); const startedAt = Date.now(); const mapReports = [];
        for (const mapId of mapIds) { try { const map = await mapSnapshotAsync(mapId); mapReports.push(analyzeMapIntelligence(map, { mapId })); } catch (error) { mapReports.push({ ok: false, mapId, issues: [{ severity: "error", message: error.message }], repairs: [] }); } }
        const [atlas, questGraph] = await Promise.all([analyzeWorldAtlas({ mapIds, id: `validation-atlas-${startedAt}` }), analyzeEventQuestGraph({ mapIds, id: `validation-graph-${startedAt}` })]);
        const packIssues = []; for (const pack of Object.values(ensureStore().worldRecipePacks || {})) { const report = validateWorldPack(pack); if (!report.ok) packIssues.push({ packId: pack.id, errors: report.errors }); }
        const report = { id: `validation-${startedAt}`, format: "HybridProductionValidation", version: 1, pluginVersion: VERSION, startedAt, completedAt: Date.now(), mapReports, atlas, questGraph, packIssues,
            errors: mapReports.reduce((sum, item) => sum + (item.issues || []).filter(issue => issue.severity === "error").length, 0) + atlas.issues.filter(issue => issue.severity === "error").length + questGraph.issues.filter(issue => issue.severity === "error").length + packIssues.length,
            warnings: mapReports.reduce((sum, item) => sum + (item.issues || []).filter(issue => issue.severity === "warning").length, 0) + atlas.issues.filter(issue => issue.severity === "warning").length + questGraph.issues.filter(issue => issue.severity === "warning").length };
        report.ok = report.errors === 0; ensureStore().validationRuns.unshift(deepClone(report)); ensureStore().validationRuns = ensureStore().validationRuns.slice(0, 20); return report;
    }

    function listProductionValidations() { return (ensureStore().validationRuns || []).map(item => ({ id: item.id, startedAt: item.startedAt, completedAt: item.completedAt, maps: item.mapReports?.length || 0, errors: item.errors, warnings: item.warnings, ok: !!item.ok })); }

    async function createProjectDeploymentReport(options = {}) {
        const validation = options.validation || await runProductionValidation(options); const report = { id: `deployment-${Date.now()}`, format: "HybridProjectDeploymentReport", version: 1, pluginVersion: VERSION, createdAt: new Date().toISOString(), project: { title: typeof $dataSystem !== "undefined" && $dataSystem ? String($dataSystem.gameTitle || "") : "", mapCount: validation.mapReports.length }, validation: { id: validation.id, ok: validation.ok, errors: validation.errors, warnings: validation.warnings }, packs: listWorldPacks(), extensions: listExtensionManifests(), runtimeBudget: runtimeBudget(), storeSize: estimateStoreBytes(), compatibility: runCompatibilitySelfTest({ executeRefresh: false }), ready: validation.ok };
        ensureStore().deploymentReports.unshift(deepClone(report)); ensureStore().deploymentReports = ensureStore().deploymentReports.slice(0, 20); return report;
    }

    function listProjectDeploymentReports() { return (ensureStore().deploymentReports || []).map(item => ({ id: item.id, createdAt: item.createdAt, ready: !!item.ready, errors: item.validation?.errors || 0, warnings: item.validation?.warnings || 0 })); }
