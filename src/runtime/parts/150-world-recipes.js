    // -------------------------------------------------------------------------
    // World Recipes
    // -------------------------------------------------------------------------

    const WORLD_RECIPE_TRIGGER_TYPES = new Set([
        "manual", "mapenter", "playerstep", "interval", "switchchange", "variablechange",
        "tilechange", "statechange", "zoneenter", "zoneexit", "interaction", "timechange",
        "daychange", "seasonchange", "weatherchange", "resourcerespawn", "resourcedepleted",
        "entitystatechange", "npcactivitychange", "scheduled", "packinstalled", "custom"
    ]);
    const WORLD_RECIPE_CONDITION_TYPES = new Set([
        "always", "switch", "variable", "state", "map", "region", "terrain", "tile",
        "position", "direction", "gold", "item", "chance", "context", "reciperuns", "time",
        "season", "day", "fact", "zone", "proximity", "lineofsight", "worldentity", "resource",
        "packinstalled", "npc", "rulelayer"
    ]);
    const WORLD_RECIPE_ACTION_TYPES = new Set([
        "setswitch", "setvariable", "setselfswitch", "setstate", "commonevent", "settile",
        "filltiles", "setregion", "cleararea", "graftprefab", "weather", "tint", "checkpoint",
        "enablerecipe", "runrecipe", "plugincommand", "message", "log", "emit", "schedule",
        "cancelschedule", "setclock", "addfact", "removefact", "definezone", "updateentity",
        "harvestresource", "spawnevent", "moveevent", "deleteevent", "applyvariant",
        "updatenpc", "paintworldrule", "runbiomegraph"
    ]);
    const WORLD_RECIPE_RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

    function canonicalWorldRecipeType(value) {
        return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    }

    function safeWorldRecipeId(value) {
        const id = String(value || "").trim();
        return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) && !WORLD_RECIPE_RESERVED_KEYS.has(id) ? id : "";
    }

    function normalizeWorldRecipeTrigger(value) {
        const trigger = typeof value === "string" ? { type: value } : Object.assign({}, value || {});
        trigger.type = canonicalWorldRecipeType(trigger.type || "manual");
        return trigger;
    }

    function normalizeWorldRecipe(definition) {
        if (!definition || typeof definition !== "object") return null;
        const id = safeWorldRecipeId(definition.id);
        if (!id) return null;
        const triggers = (Array.isArray(definition.triggers) ? definition.triggers : [definition.trigger || "manual"])
            .map(normalizeWorldRecipeTrigger).filter(trigger => trigger.type);
        return {
            id,
            name: String(definition.name || id),
            description: String(definition.description || ""),
            enabled: definition.enabled !== false,
            priority: integer(definition.priority, 0),
            tags: normalizeList(definition.tags).map(String).slice(0, 50),
            triggers: triggers.length ? triggers : [{ type: "manual" }],
            conditions: deepClone(definition.conditions === undefined ? { all: [] } : definition.conditions),
            actions: Array.isArray(definition.actions) ? deepClone(definition.actions).slice(0, 500) : [],
            once: toBoolean(definition.once, false),
            maxRuns: Math.max(0, integer(definition.maxRuns, 0)),
            cooldownFrames: Math.max(0, integer(definition.cooldownFrames, 0)),
            errorPolicy: String(definition.errorPolicy || "stop").toLowerCase() === "continue" ? "continue" : "stop",
            version: Math.max(1, integer(definition.version, 1)),
            metadata: definition.metadata && typeof definition.metadata === "object" ? deepClone(definition.metadata) : {}
        };
    }

    function worldRecipeDefinitions() {
        const merged = new Map();
        for (const raw of projectWorldRecipeCatalog.recipes || []) {
            const recipe = normalizeWorldRecipe(raw);
            if (recipe) merged.set(recipe.id, Object.assign(recipe, { source: "project" }));
        }
        for (const raw of Object.values(ensureStore().worldRecipes || {})) {
            const recipe = normalizeWorldRecipe(raw);
            if (recipe) merged.set(recipe.id, Object.assign(recipe, { source: "save" }));
        }
        return [...merged.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    }

    function worldRecipe(id) {
        const key = String(id || "");
        const recipe = worldRecipeDefinitions().find(item => item.id === key);
        return recipe ? deepClone(recipe) : null;
    }

    function worldRecipeStateRecord(id) {
        const key = safeWorldRecipeId(id);
        if (!key) return null;
        const states = ensureStore().worldRecipeStates;
        states[key] ||= { runCount: 0, lastRunFrame: null, lastRunAt: null, lastTrigger: null, lastResult: null };
        return states[key];
    }

    function listWorldRecipes() {
        return worldRecipeDefinitions().map(recipe => {
            const state = worldRecipeStateRecord(recipe.id);
            return {
                id: recipe.id, name: recipe.name, description: recipe.description, enabled: state.enabled === undefined ? recipe.enabled : !!state.enabled,
                priority: recipe.priority, tags: recipe.tags, triggers: recipe.triggers, actionCount: recipe.actions.length,
                runCount: state.runCount || 0, lastRunAt: state.lastRunAt, source: recipe.source, valid: validateWorldRecipe(recipe).ok
            };
        });
    }

    function registerWorldRecipe(definition, save = true) {
        const recipe = normalizeWorldRecipe(definition);
        if (!recipe) throw new Error("World Recipe IDs must use 1-128 letters, numbers, dots, colons, underscores, or hyphens.");
        const report = validateWorldRecipe(recipe);
        if (!report.ok) throw new Error(`Invalid World Recipe ${recipe.id}: ${report.errors.join("; ")}`);
        if (save) ensureStore().worldRecipes[recipe.id] = deepClone(recipe);
        else {
            const recipes = projectWorldRecipeCatalog.recipes ||= [];
            const index = recipes.findIndex(item => item.id === recipe.id);
            if (index >= 0) recipes[index] = deepClone(recipe); else recipes.push(deepClone(recipe));
        }
        recordOperation("registerWorldRecipe", { recipeId: recipe.id, save: !!save });
        return deepClone(recipe);
    }

    function removeWorldRecipe(id, options = {}) {
        const key = String(id || "");
        let removed = false;
        if (ensureStore().worldRecipes[key]) { delete ensureStore().worldRecipes[key]; removed = true; }
        if (options.project !== false) {
            const before = (projectWorldRecipeCatalog.recipes || []).length;
            projectWorldRecipeCatalog.recipes = (projectWorldRecipeCatalog.recipes || []).filter(item => item.id !== key);
            removed = removed || projectWorldRecipeCatalog.recipes.length !== before;
        }
        if (options.keepState !== true) delete ensureStore().worldRecipeStates[key];
        return removed;
    }

    function registerWorldRecipeCondition(type, handler) {
        const key = canonicalWorldRecipeType(type);
        if (!key || typeof handler !== "function") return false;
        worldRecipeConditionHandlers.set(key, handler);
        return true;
    }

    function registerWorldRecipeAction(type, handler) {
        const key = canonicalWorldRecipeType(type);
        if (!key || typeof handler !== "function") return false;
        worldRecipeActionHandlers.set(key, handler);
        return true;
    }

    function validateWorldRecipeCondition(condition, path, report, depth = 0) {
        if (depth > 12) { report.errors.push(`${path}: condition nesting exceeds 12 levels.`); return; }
        if (Array.isArray(condition)) {
            condition.forEach((item, index) => validateWorldRecipeCondition(item, `${path}[${index}]`, report, depth + 1));
            return;
        }
        if (!condition || typeof condition !== "object") { report.errors.push(`${path}: condition must be an object or array.`); return; }
        for (const logical of ["all", "any"]) if (condition[logical] !== undefined) {
            if (!Array.isArray(condition[logical])) report.errors.push(`${path}.${logical}: expected an array.`);
            else condition[logical].forEach((item, index) => validateWorldRecipeCondition(item, `${path}.${logical}[${index}]`, report, depth + 1));
            return;
        }
        if (condition.not !== undefined) { validateWorldRecipeCondition(condition.not, `${path}.not`, report, depth + 1); return; }
        const type = canonicalWorldRecipeType(condition.type || "always");
        if (!WORLD_RECIPE_CONDITION_TYPES.has(type) && !worldRecipeConditionHandlers.has(type)) {
            if (/[.:]/.test(String(condition.type || ""))) report.warnings.push(`${path}: namespaced extension condition "${condition.type}" must be registered before it runs.`);
            else report.errors.push(`${path}: unknown condition type "${condition.type}".`);
        }
    }

    function validateWorldRecipe(definition) {
        const report = { ok: true, errors: [], warnings: [] };
        const recipe = normalizeWorldRecipe(definition);
        if (!recipe) { report.errors.push("Recipe has an invalid or missing ID."); report.ok = false; return report; }
        if (!recipe.triggers.length) report.errors.push("Recipe needs at least one trigger.");
        recipe.triggers.forEach((trigger, index) => {
            if (!WORLD_RECIPE_TRIGGER_TYPES.has(trigger.type) && trigger.type !== canonicalWorldRecipeType(trigger.name)) report.warnings.push(`triggers[${index}]: custom trigger "${trigger.type}".`);
            if (trigger.type === "interval" && integer(trigger.everyFrames, 0) < 1) report.errors.push(`triggers[${index}]: interval requires everyFrames >= 1.`);
        });
        validateWorldRecipeCondition(recipe.conditions, "conditions", report);
        recipe.actions.forEach((action, index) => {
            if (!action || typeof action !== "object") report.errors.push(`actions[${index}]: expected an object.`);
            else {
                const type = canonicalWorldRecipeType(action.type);
                if (!WORLD_RECIPE_ACTION_TYPES.has(type) && !worldRecipeActionHandlers.has(type)) {
                    if (/[.:]/.test(String(action.type || ""))) report.warnings.push(`actions[${index}]: namespaced extension action "${action.type}" must be registered before it runs.`);
                    else report.errors.push(`actions[${index}]: unknown action type "${action.type}".`);
                }
            }
        });
        if (!recipe.actions.length) report.warnings.push("Recipe has no actions.");
        report.ok = report.errors.length === 0;
        report.recipe = recipe;
        return report;
    }

    function validateWorldRecipeCatalog(catalog = projectWorldRecipeCatalog) {
        const report = { ok: true, errors: [], warnings: [], recipes: [] };
        if (!catalog || catalog.format !== "HybridWorldRecipes" || !Array.isArray(catalog.recipes)) {
            return { ok: false, errors: ["Expected a HybridWorldRecipes catalog with a recipes array."], warnings: [], recipes: [] };
        }
        const ids = new Set();
        const graph = new Map();
        catalog.recipes.forEach((raw, index) => {
            const child = validateWorldRecipe(raw);
            report.recipes.push({ index, id: raw?.id || null, ok: child.ok, errors: child.errors, warnings: child.warnings });
            report.errors.push(...child.errors.map(message => `recipes[${index}]: ${message}`));
            report.warnings.push(...child.warnings.map(message => `recipes[${index}]: ${message}`));
            if (raw?.id && ids.has(raw.id)) report.errors.push(`recipes[${index}]: duplicate ID "${raw.id}".`);
            ids.add(raw?.id);
            graph.set(raw?.id, (raw?.actions || []).filter(action => canonicalWorldRecipeType(action?.type) === "runrecipe").map(action => String(action.recipeId || "")));
        });
        const visiting = new Set(); const visited = new Set();
        const visit = id => {
            if (!id || visited.has(id)) return;
            if (visiting.has(id)) { report.errors.push(`Recipe cycle detected at "${id}".`); return; }
            visiting.add(id); for (const next of graph.get(id) || []) if (graph.has(next)) visit(next); visiting.delete(id); visited.add(id);
        };
        for (const id of graph.keys()) visit(id);
        report.ok = report.errors.length === 0;
        return report;
    }

    function loadWorldRecipeCatalog(source = null) {
        if (source && typeof source === "object") {
            const report = validateWorldRecipeCatalog(source);
            if (!report.ok) throw new Error(`World Recipe catalog rejected: ${report.errors.join("; ")}`);
            projectWorldRecipeCatalog = { format: "HybridWorldRecipes", version: Math.max(1, integer(source.version, 1)), recipes: source.recipes.map(recipe => normalizeWorldRecipe(recipe)), world: deepClone(source.world || {}), packs: deepClone(source.packs || []) };
            const world = source.world || {};
            if (world.clock) setWorldClock(Object.assign({}, world.clock, { frameCarry: 0 }));
            for (const zone of normalizeList(world.zones)) defineWorldZone(zone);
            for (const entity of normalizeList(world.entities)) defineWorldEntity(entity);
            for (const resource of normalizeList(world.resources)) defineWorldResource(resource);
            for (const variant of normalizeList(world.variants)) defineWorldMapVariant(variant);
            for (const npc of normalizeList(world.npcs)) defineWorldNpc(npc);
            for (const route of normalizeList(world.npcRoutes)) defineWorldNpcRoute(route);
            for (const layer of normalizeList(world.ruleLayers)) defineWorldRuleLayer(layer);
            for (const brush of normalizeList(world.ruleBrushes)) saveWorldRuleBrush(brush);
            for (const graph of normalizeList(world.biomeGraphs)) defineBiomeGraph(graph);
            if (Array.isArray(world.schedules)) ensureStore().worldSchedules = deepClone(world.schedules);
            if (world.runtimeBudget) runtimeBudget(world.runtimeBudget);
            if (Array.isArray(world.tests)) ensureStore().worldRecipeTests = deepClone(world.tests);
            for (const [key, value] of Object.entries(world.stateDefaults || {})) if (ensureStore().worldState[worldStateStorageKey(key)] === undefined) setWorldState(key, value);
            for (const pack of normalizeList(source.packs)) if (pack?.id) ensureStore().worldRecipePacks[pack.id] ||= { id: pack.id, name: pack.name || pack.id, version: pack.version || "1.0.0", bundled: true, dependencies: deepClone(pack.dependencies || []), capabilities: deepClone(pack.capabilities || []), contents: deepClone(pack.contents || {}) };
            if (source.packLock?.format === "HybridWorldPackLock") ensureStore().worldPackLock = deepClone(source.packLock);
            rebuildWorldZoneSpatialIndex();
            recordOperation("loadWorldRecipeCatalog", { recipes: projectWorldRecipeCatalog.recipes.length, source: "object" });
            if (AUTO_WORLD_RECIPES && typeof $gameMap !== "undefined" && $gameMap?.mapId?.() > 0) {
                queueWorldRecipeTrigger("mapEnter", { mapId: $gameMap.mapId(), catalogLoaded: true });
            }
            return Promise.resolve(deepClone(projectWorldRecipeCatalog));
        }
        if (!WORLD_RECIPE_FILE || typeof XMLHttpRequest === "undefined") return Promise.resolve(false);
        return new Promise(resolve => {
            const request = new XMLHttpRequest();
            request.open("GET", `data/${WORLD_RECIPE_FILE}`);
            if (request.overrideMimeType) request.overrideMimeType("application/json");
            request.onload = () => {
                if (request.status >= 400 || !request.responseText) return resolve(false);
                if (!inputWithinLimit(request.responseText)) { console.warn(`${PLUGIN_NAME}: World Recipe catalog exceeds the import limit.`); return resolve(false); }
                try { resolve(loadWorldRecipeCatalog(JSON.parse(request.responseText))); }
                catch (error) { captureError(error, { operation: "loadWorldRecipeCatalog", file: WORLD_RECIPE_FILE }); console.warn(`${PLUGIN_NAME}: ${error.message}`); resolve(false); }
            };
            request.onerror = () => resolve(false);
            try { request.send(); } catch (_error) { resolve(false); }
        });
    }

    function exportWorldRecipePack(ids = null) {
        const selected = normalizeList(ids).map(String);
        const recipes = worldRecipeDefinitions().filter(recipe => !selected.length || selected.includes(recipe.id)).map(recipe => {
            const copy = deepClone(recipe); delete copy.source; return copy;
        });
        return { format: "HybridWorldRecipes", version: 1, pluginVersion: VERSION, createdAt: new Date().toISOString(), recipes };
    }

    function importWorldRecipePack(pack, options = {}) {
        const report = validateWorldRecipeCatalog(pack);
        if (!report.ok) return report;
        let imported = 0;
        for (const recipe of pack.recipes) { registerWorldRecipe(recipe, options.save !== false); imported++; }
        return Object.assign(report, { imported });
    }

    function recipeVariableValue(id) {
        if (typeof $gameVariables === "undefined" || !$gameVariables) return 0;
        if (typeof $gameVariables.value === "function") return $gameVariables.value(integer(id));
        return $gameVariables.values?.[integer(id)] ?? $gameVariables._data?.[integer(id)] ?? 0;
    }

    function recipeSwitchValue(id) {
        if (typeof $gameSwitches === "undefined" || !$gameSwitches) return false;
        if (typeof $gameSwitches.value === "function") return !!$gameSwitches.value(integer(id));
        return !!($gameSwitches.values?.[integer(id)] ?? $gameSwitches._data?.[integer(id)]);
    }

    function worldStateStorageKey(key, options = {}) {
        const value = String(key || "").trim();
        if (!value || WORLD_RECIPE_RESERVED_KEYS.has(value)) throw new Error("World state keys cannot be empty or reserved JavaScript object names.");
        const scope = String(options.scope || "global").toLowerCase();
        const mapId = integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0);
        const recipeId = String(options.recipeId || "");
        if (scope === "map") return `map:${mapId}:${value}`;
        if (scope === "recipe") return `recipe:${recipeId}:${value}`;
        return `global:${value}`;
    }

    function getWorldState(key, options = {}) {
        const storageKey = worldStateStorageKey(key, options);
        const value = ensureStore().worldState[storageKey];
        return value === undefined ? deepClone(options.defaultValue) : deepClone(value);
    }

    function setWorldState(key, value, options = {}) {
        const storageKey = worldStateStorageKey(key, options);
        const previous = ensureStore().worldState[storageKey];
        ensureStore().worldState[storageKey] = deepClone(value);
        if (AUTO_WORLD_RECIPES && JSON.stringify(previous) !== JSON.stringify(value)) queueWorldRecipeTrigger("stateChange", { key: String(key), storageKey, previous: deepClone(previous), value: deepClone(value), scope: options.scope || "global" });
        return deepClone(value);
    }

    function deleteWorldState(key, options = {}) {
        const storageKey = worldStateStorageKey(key, options);
        const existed = Object.prototype.hasOwnProperty.call(ensureStore().worldState, storageKey);
        if (existed) delete ensureStore().worldState[storageKey];
        return existed;
    }

    function worldRecipeContext(context = {}) {
        const x = integer(context.x, typeof $gamePlayer !== "undefined" && $gamePlayer ? $gamePlayer.x : 0);
        const y = integer(context.y, typeof $gamePlayer !== "undefined" && $gamePlayer ? $gamePlayer.y : 0);
        const mapId = integer(context.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0);
        const regionId = context.regionId === undefined
            ? (typeof $gameMap !== "undefined" && $gameMap?.regionId ? $gameMap.regionId(x, y) : (typeof $dataMap !== "undefined" && $dataMap ? getTileId(x, y, "L6") : 0))
            : integer(context.regionId);
        const terrainTag = context.terrainTag === undefined
            ? (typeof $gameMap !== "undefined" && $gameMap?.terrainTag ? $gameMap.terrainTag(x, y) : 0)
            : integer(context.terrainTag);
        const direction = integer(context.direction, typeof $gamePlayer !== "undefined" && $gamePlayer?.direction ? $gamePlayer.direction() : 2);
        const serializable = {};
        for (const [key, value] of Object.entries(context || {})) {
            if (key === "interpreter") continue;
            try { serializable[key] = deepClone(value); } catch (_error) { serializable[key] = String(value); }
        }
        const output = Object.assign({ mapId, x, y, regionId, terrainTag, direction, frame: worldRecipeFrame }, serializable);
        if (context.interpreter) output.interpreter = context.interpreter;
        return output;
    }

    function resolveWorldRecipeValue(value, context = {}, recipe = null) {
        if (Array.isArray(value)) return value.map(item => resolveWorldRecipeValue(item, context, recipe));
        if (!value || typeof value !== "object") return value;
        if (value.context !== undefined) return deepClone(context[String(value.context)]);
        if (value.variable !== undefined) return recipeVariableValue(value.variable);
        if (value.switch !== undefined) return recipeSwitchValue(value.switch);
        if (value.state !== undefined) return getWorldState(value.state, { scope: value.scope, mapId: context.mapId, recipeId: recipe?.id, defaultValue: value.defaultValue });
        const output = {};
        for (const [key, item] of Object.entries(value)) output[key] = resolveWorldRecipeValue(item, context, recipe);
        return output;
    }

    function compareWorldRecipeValues(left, operator, right) {
        switch (String(operator || "==").toLowerCase()) {
            case "=": case "==": case "eq": return left == right; // Intentional author-friendly coercion.
            case "===": return left === right;
            case "!=": case "ne": return left != right;
            case "!==": return left !== right;
            case ">": case "gt": return Number(left) > Number(right);
            case ">=": case "gte": return Number(left) >= Number(right);
            case "<": case "lt": return Number(left) < Number(right);
            case "<=": case "lte": return Number(left) <= Number(right);
            case "includes": return Array.isArray(left) ? left.includes(right) : String(left ?? "").includes(String(right ?? ""));
            case "in": return Array.isArray(right) && right.includes(left);
            case "notin": return Array.isArray(right) && !right.includes(left);
            default: return false;
        }
    }

    // ---------------------------------------------------------------------
    // World Director: clock, zones, facts, resources, entities, and schedules
    // ---------------------------------------------------------------------

    let worldRecipeLastZones = new Set();
    let worldZoneSpatialIndex = null;

    function worldClockSerial(clock = ensureStore().worldClock) {
        return (Math.max(1, integer(clock.day, 1)) - 1) * 1440 + Math.max(0, integer(clock.minute, 0));
    }

    function normalizeWorldClock(clock) {
        const value = Object.assign({ enabled: true, minute: 480, day: 1, season: "spring", framesPerMinute: 60, daysPerSeason: 30, seasons: ["spring", "summer", "autumn", "winter"], frameCarry: 0 }, clock || {});
        value.seasons = normalizeList(value.seasons).map(String).filter(Boolean).slice(0, 24);
        if (!value.seasons.length) value.seasons = ["spring", "summer", "autumn", "winter"];
        value.framesPerMinute = Math.max(1, integer(value.framesPerMinute, 60));
        value.daysPerSeason = Math.max(1, integer(value.daysPerSeason, 30));
        let serial = (Math.max(1, integer(value.day, 1)) - 1) * 1440 + integer(value.minute, 0);
        serial = Math.max(0, serial);
        value.day = Math.floor(serial / 1440) + 1;
        value.minute = serial % 1440;
        value.hour = Math.floor(value.minute / 60);
        value.minuteOfHour = value.minute % 60;
        const seasonIndex = Math.floor((value.day - 1) / value.daysPerSeason) % value.seasons.length;
        value.season = value.seasons[seasonIndex];
        value.frameCarry = Math.max(0, integer(value.frameCarry, 0));
        return value;
    }

    function worldClock() {
        const store = ensureStore();
        store.worldClock = normalizeWorldClock(store.worldClock);
        return deepClone(store.worldClock);
    }

    function setWorldClock(changes = {}) {
        const store = ensureStore(); const previous = normalizeWorldClock(store.worldClock);
        const next = Object.assign({}, previous, deepClone(changes));
        if (changes.hour !== undefined || changes.minuteOfHour !== undefined) {
            const hour = Math.max(0, Math.min(23, integer(changes.hour, previous.hour)));
            const minute = Math.max(0, Math.min(59, integer(changes.minuteOfHour, previous.minuteOfHour)));
            next.minute = hour * 60 + minute;
        }
        store.worldClock = normalizeWorldClock(next);
        const current = store.worldClock;
        if (previous.minute !== current.minute || previous.day !== current.day) queueWorldRecipeTrigger("timeChange", { previous: deepClone(previous), clock: deepClone(current), minute: current.minute, hour: current.hour, day: current.day, season: current.season });
        if (previous.day !== current.day) queueWorldRecipeTrigger("dayChange", { previousDay: previous.day, day: current.day, clock: deepClone(current) });
        if (previous.season !== current.season) queueWorldRecipeTrigger("seasonChange", { previousSeason: previous.season, season: current.season, clock: deepClone(current) });
        if (previous.minute !== current.minute || previous.day !== current.day) refreshWorldNpcActivities(current);
        return deepClone(current);
    }

    function advanceWorldClock(minutes = 1) {
        const clock = worldClock();
        const serial = worldClockSerial(clock) + integer(minutes, 1);
        return setWorldClock({ day: Math.floor(Math.max(0, serial) / 1440) + 1, minute: Math.max(0, serial) % 1440 });
    }

    function addWorldFact(name, value = true) {
        const key = safeWorldRecipeId(name); if (!key) throw new Error("World Fact names use the same safe characters as recipe IDs.");
        ensureStore().worldFacts[key] = deepClone(value);
        queueWorldRecipeTrigger("stateChange", { key: `fact:${key}`, value: deepClone(value), fact: key });
        return deepClone(value);
    }

    function removeWorldFact(name) {
        const key = String(name || ""); const existed = Object.prototype.hasOwnProperty.call(ensureStore().worldFacts, key);
        if (existed) { delete ensureStore().worldFacts[key]; queueWorldRecipeTrigger("stateChange", { key: `fact:${key}`, value: undefined, fact: key }); }
        return existed;
    }

    function hasWorldFact(name, expected = true) {
        const value = ensureStore().worldFacts[String(name || "")];
        return expected === undefined ? value !== undefined : compareWorldRecipeValues(value, "===", expected);
    }

    function normalizeWorldZone(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("World Zones require a safe stable ID.");
        const rect = definition.rect || definition.bounds || null;
        return { id, name: String(definition.name || id), mapIds: normalizeList(definition.mapIds ?? definition.mapId).map(integer).filter(value => value > 0), regions: normalizeList(definition.regions).map(integer), rect: rect ? { x: integer(rect.x), y: integer(rect.y), width: positiveInteger(rect.width ?? rect.w), height: positiveInteger(rect.height ?? rect.h) } : null, points: normalizeList(definition.points).map(point => ({ x: integer(point?.x ?? point?.[0]), y: integer(point?.y ?? point?.[1]) })), tags: normalizeList(definition.tags).map(String), metadata: deepClone(definition.metadata || {}) };
    }

    function defineWorldZone(definition) {
        const zone = normalizeWorldZone(definition); ensureStore().worldZones[zone.id] = deepClone(zone); worldZoneSpatialIndex = null; return deepClone(zone);
    }

    function removeWorldZone(id) { const key = String(id || ""); const existed = !!ensureStore().worldZones[key]; delete ensureStore().worldZones[key]; worldRecipeLastZones.delete(key); worldZoneSpatialIndex = null; return existed; }
    function listWorldZones() { return Object.values(ensureStore().worldZones || {}).map(deepClone).sort((a, b) => a.name.localeCompare(b.name)); }

    function rebuildWorldZoneSpatialIndex() {
        const cellSize = Math.max(4, integer(ensureStore().runtimeBudget?.spatialCellSize, 16));
        const buckets = new Map();
        const add = (key, id) => { const bucket = buckets.get(key) || new Set(); bucket.add(id); buckets.set(key, bucket); };
        for (const zone of Object.values(ensureStore().worldZones || {})) {
            const mapIds = zone.mapIds?.length ? zone.mapIds : [0];
            let bounds = null;
            if (zone.rect) bounds = { x: zone.rect.x, y: zone.rect.y, width: zone.rect.width, height: zone.rect.height };
            else if (zone.points?.length >= 3) {
                const xs = zone.points.map(point => point.x); const ys = zone.points.map(point => point.y);
                bounds = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 };
            }
            for (const mapId of mapIds) {
                const prefix = mapId > 0 ? String(mapId) : "*";
                if (!bounds || zone.regions?.length) add(`${prefix}:*`, zone.id);
                if (!bounds) continue;
                const startX = Math.floor(bounds.x / cellSize); const startY = Math.floor(bounds.y / cellSize);
                const endX = Math.floor((bounds.x + Math.max(1, bounds.width) - 1) / cellSize); const endY = Math.floor((bounds.y + Math.max(1, bounds.height) - 1) / cellSize);
                for (let gy = startY; gy <= endY; gy++) for (let gx = startX; gx <= endX; gx++) add(`${prefix}:${gx}:${gy}`, zone.id);
            }
        }
        worldZoneSpatialIndex = { cellSize, buckets, builtAt: Date.now(), zoneCount: Object.keys(ensureStore().worldZones || {}).length };
        return worldZoneSpatialIndex;
    }

    function worldZoneSpatialDiagnostics() {
        const index = worldZoneSpatialIndex || rebuildWorldZoneSpatialIndex();
        return { cellSize: index.cellSize, buckets: index.buckets.size, zones: index.zoneCount, builtAt: index.builtAt };
    }

    function pointInWorldPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i]; const b = points[j];
            if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || 1) + a.x) inside = !inside;
        }
        return inside;
    }

    function worldZoneContains(zone, mapId, x, y, regionId = null) {
        if (!zone || (zone.mapIds?.length && !zone.mapIds.includes(integer(mapId)))) return false;
        if (zone.regions?.length && !zone.regions.includes(integer(regionId, typeof $gameMap !== "undefined" && $gameMap?.regionId ? $gameMap.regionId(x, y) : 0))) return false;
        if (zone.rect && !(x >= zone.rect.x && y >= zone.rect.y && x < zone.rect.x + zone.rect.width && y < zone.rect.y + zone.rect.height)) return false;
        if (zone.points?.length >= 3 && !pointInWorldPolygon(x + 0.5, y + 0.5, zone.points)) return false;
        return !!(zone.rect || zone.points?.length >= 3 || zone.regions?.length);
    }

    function worldZonesAt(mapId, x, y, regionId = null) {
        const index = worldZoneSpatialIndex || rebuildWorldZoneSpatialIndex();
        const gx = Math.floor(integer(x) / index.cellSize); const gy = Math.floor(integer(y) / index.cellSize); const id = integer(mapId);
        const candidates = new Set();
        for (const key of [`${id}:${gx}:${gy}`, `*:${gx}:${gy}`, `${id}:*`, `*:*`]) for (const zoneId of index.buckets.get(key) || []) candidates.add(zoneId);
        return [...candidates].map(zoneId => ensureStore().worldZones[zoneId]).filter(zone => worldZoneContains(zone, id, integer(x), integer(y), regionId)).map(deepClone);
    }

    function defineWorldEntity(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("World Entities require a safe stable ID.");
        const entity = Object.assign({ id, type: "region", state: "default", tags: [], properties: {}, updatedAt: Date.now() }, deepClone(definition), { id, tags: normalizeList(definition.tags).map(String) });
        ensureStore().worldEntities[id] = entity; return deepClone(entity);
    }

    function worldEntity(id) { const value = ensureStore().worldEntities[String(id || "")]; return value ? deepClone(value) : null; }
    function listWorldEntities(options = {}) { return Object.values(ensureStore().worldEntities || {}).filter(entity => !options.type || entity.type === options.type).map(deepClone); }
    function updateWorldEntity(id, changes = {}) { const entity = ensureStore().worldEntities[String(id || "")]; if (!entity) return false; const previousState = entity.state; Object.assign(entity, deepClone(changes), { id: entity.id, updatedAt: Date.now() }); if (previousState !== entity.state) queueWorldRecipeTrigger("entityStateChange", { entityId: entity.id, previousState, state: entity.state, entity: deepClone(entity) }); return deepClone(entity); }
    function removeWorldEntity(id) { const key = String(id || ""); const existed = !!ensureStore().worldEntities[key]; delete ensureStore().worldEntities[key]; return existed; }

    function worldMinuteOfDay(value, fallback = 0) {
        if (typeof value === "number") return Math.max(0, Math.min(1439, integer(value, fallback)));
        const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
        return match ? Math.max(0, Math.min(23, integer(match[1]))) * 60 + Math.max(0, Math.min(59, integer(match[2]))) : fallback;
    }

    function normalizeWorldNpc(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("World NPCs require a safe stable ID.");
        const schedule = normalizeList(definition.schedule || definition.activities).map((entry, index) => ({
            id: safeWorldRecipeId(entry?.id) || `${id}-activity-${index + 1}`,
            activity: String(entry?.activity || entry?.name || "idle"),
            start: worldMinuteOfDay(entry?.start, 0),
            end: worldMinuteOfDay(entry?.end, 1439),
            days: normalizeList(entry?.days).map(integer).filter(day => day > 0),
            seasons: normalizeList(entry?.seasons).map(String),
            mapId: Math.max(0, integer(entry?.mapId)), x: integer(entry?.x), y: integer(entry?.y),
            zoneId: String(entry?.zoneId || ""), entityId: String(entry?.entityId || ""),
            state: String(entry?.state || ""), priority: integer(entry?.priority, index),
            metadata: deepClone(entry?.metadata || {})
        })).sort((a, b) => b.priority - a.priority || a.start - b.start);
        return Object.assign({ id, name: definition?.name || id, home: {}, job: {}, relationships: {}, tags: [], enabled: true, activity: "idle", mapId: 0, x: 0, y: 0, state: "normal", updatedAt: Date.now() }, deepClone(definition), { id, schedule, tags: normalizeList(definition?.tags).map(String) });
    }

    function defineWorldNpc(definition) { const npc = normalizeWorldNpc(definition); ensureStore().worldNpcs[npc.id] = npc; return deepClone(npc); }
    function worldNpc(id) { const npc = ensureStore().worldNpcs[String(id || "")]; return npc ? deepClone(npc) : null; }
    function listWorldNpcs(options = {}) { return Object.values(ensureStore().worldNpcs || {}).filter(npc => (!options.tag || npc.tags?.includes(options.tag)) && (!options.activity || npc.activity === options.activity)).map(deepClone); }
    function removeWorldNpc(id) { const key = String(id || ""); const existed = !!ensureStore().worldNpcs[key]; delete ensureStore().worldNpcs[key]; return existed; }

    function npcScheduledActivity(npcOrId, clockValue = worldClock()) {
        const npc = typeof npcOrId === "string" ? ensureStore().worldNpcs[npcOrId] : npcOrId; if (!npc) return null;
        const clock = normalizeWorldClock(clockValue); const minute = clock.minute; const dayOfWeek = ((clock.day - 1) % 7) + 1;
        const matches = (npc.schedule || []).filter(entry => {
            const timeMatch = entry.start <= entry.end ? minute >= entry.start && minute <= entry.end : minute >= entry.start || minute <= entry.end;
            return timeMatch && (!entry.days?.length || entry.days.includes(dayOfWeek) || entry.days.includes(clock.day)) && (!entry.seasons?.length || entry.seasons.includes(clock.season));
        });
        return matches.length ? deepClone(matches.sort((a, b) => b.priority - a.priority)[0]) : null;
    }

    function updateWorldNpc(id, changes = {}) {
        const current = ensureStore().worldNpcs[String(id || "")]; if (!current) return false;
        const previousActivity = current.activity; const normalized = normalizeWorldNpc(Object.assign({}, current, deepClone(changes), { id: current.id }));
        normalized.updatedAt = Date.now(); ensureStore().worldNpcs[current.id] = normalized;
        if (previousActivity !== normalized.activity) queueWorldRecipeTrigger("npcActivityChange", { npcId: normalized.id, previousActivity, activity: normalized.activity, npc: deepClone(normalized) });
        return deepClone(normalized);
    }

    function normalizeWorldNpcRoute(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("NPC routes require a safe stable ID.");
        const npcId = String(definition?.npcId || ""); if (!ensureStore().worldNpcs[npcId]) throw new Error(`NPC route ${id} references missing NPC "${npcId}".`);
        const points = normalizeList(definition?.points || definition?.waypoints).map((point, index) => ({
            id: safeWorldRecipeId(point?.id) || `${id}-stop-${index + 1}`,
            mapId: Math.max(0, integer(point?.mapId)), x: integer(point?.x), y: integer(point?.y),
            waitMinutes: Math.max(0, integer(point?.waitMinutes)), label: String(point?.label || ""), metadata: deepClone(point?.metadata || {})
        }));
        if (points.length < 2) throw new Error("NPC routes require at least two waypoints.");
        return Object.assign({ id, npcId, name: definition?.name || id, minutes: Math.max(1, integer(definition?.minutes, points.length - 1)), loop: !!definition?.loop, enabled: definition?.enabled !== false, points, metadata: {}, updatedAt: Date.now() }, deepClone(definition), { id, npcId, points });
    }

    function defineWorldNpcRoute(definition) { const route = normalizeWorldNpcRoute(definition); ensureStore().worldNpcRoutes[route.id] = route; return deepClone(route); }
    function listWorldNpcRoutes(options = {}) { return Object.values(ensureStore().worldNpcRoutes || {}).filter(route => !options.npcId || route.npcId === String(options.npcId)).map(deepClone); }
    function removeWorldNpcRoute(id) { const key = String(id || ""); const existed = !!ensureStore().worldNpcRoutes[key]; delete ensureStore().worldNpcRoutes[key]; for (const [npcId, journey] of Object.entries(ensureStore().worldNpcOccupancy || {})) if (journey.routeId === key) delete ensureStore().worldNpcOccupancy[npcId]; return existed; }

    function npcJourneyPosition(route, progress) {
        const points = route.points || []; const segmentLengths = [];
        let total = 0;
        for (let index = 1; index < points.length; index++) { const previous = points[index - 1]; const point = points[index]; const length = previous.mapId === point.mapId ? Math.max(1, Math.hypot(point.x - previous.x, point.y - previous.y)) : 1; segmentLengths.push(length); total += length; }
        let remaining = Math.max(0, Math.min(1, finiteNumber(progress))) * Math.max(1, total);
        for (let index = 0; index < segmentLengths.length; index++) {
            const from = points[index]; const to = points[index + 1]; const length = segmentLengths[index];
            if (remaining > length && index < segmentLengths.length - 1) { remaining -= length; continue; }
            const ratio = Math.max(0, Math.min(1, remaining / length));
            return { mapId: ratio < 1 ? from.mapId : to.mapId, x: Math.round(from.x + (to.x - from.x) * ratio), y: Math.round(from.y + (to.y - from.y) * ratio), from: from.id, to: to.id, segment: index, segmentProgress: ratio };
        }
        const last = points.at(-1); return { mapId: last.mapId, x: last.x, y: last.y, from: last.id, to: last.id, segment: Math.max(0, points.length - 2), segmentProgress: 1 };
    }

    function previewNpcJourney(routeId, options = {}) {
        const route = ensureStore().worldNpcRoutes[String(routeId || "")]; if (!route) return { ok: false, errors: ["NPC route was not found."] };
        const steps = Math.max(2, Math.min(240, integer(options.steps, 12))); const samples = [];
        for (let index = 0; index <= steps; index++) samples.push(Object.assign({ progress: index / steps, minute: Math.round(route.minutes * index / steps) }, npcJourneyPosition(route, index / steps)));
        return { ok: true, route: deepClone(route), durationMinutes: route.minutes, samples };
    }

    function startNpcJourney(routeId, options = {}) {
        const route = ensureStore().worldNpcRoutes[String(routeId || "")]; if (!route || route.enabled === false) return false;
        const npc = ensureStore().worldNpcs[route.npcId]; if (!npc) return false; const start = worldClockSerial();
        const journey = { id: safeWorldRecipeId(options.id) || `journey-${route.id}-${Date.now().toString(36)}`, routeId: route.id, npcId: route.npcId, startedAt: start, durationMinutes: Math.max(1, integer(options.minutes, route.minutes)), progress: 0, status: "travelling", loop: options.loop === undefined ? !!route.loop : !!options.loop, updatedAt: Date.now() };
        ensureStore().worldNpcOccupancy[route.npcId] = journey; npc.activity = String(options.activity || "travelling"); Object.assign(npc, npcJourneyPosition(route, 0));
        queueWorldRecipeTrigger("npcActivityChange", { npcId: npc.id, activity: npc.activity, journey: deepClone(journey) }); return deepClone(journey);
    }

    function advanceNpcJourneys(clockValue = worldClock()) {
        const store = ensureStore(); const serial = worldClockSerial(normalizeWorldClock(clockValue)); const changes = [];
        for (const [npcId, journey] of Object.entries(store.worldNpcOccupancy || {})) {
            const route = store.worldNpcRoutes[journey.routeId]; const npc = store.worldNpcs[npcId]; if (!route || !npc) { delete store.worldNpcOccupancy[npcId]; continue; }
            let progress = Math.max(0, (serial - journey.startedAt) / Math.max(1, journey.durationMinutes));
            if (progress >= 1 && journey.loop) { journey.startedAt = serial; progress %= 1; }
            journey.progress = Math.min(1, progress); journey.updatedAt = Date.now(); Object.assign(npc, npcJourneyPosition(route, journey.progress), { updatedAt: Date.now() });
            if (progress >= 1 && !journey.loop) { journey.status = "arrived"; npc.activity = "arrived"; changes.push({ npcId, routeId: route.id, status: "arrived", position: { mapId: npc.mapId, x: npc.x, y: npc.y } }); delete store.worldNpcOccupancy[npcId]; queueWorldRecipeTrigger("npcActivityChange", { npcId, activity: "arrived", routeId: route.id }); }
            else changes.push({ npcId, routeId: route.id, status: journey.status, progress: journey.progress, position: { mapId: npc.mapId, x: npc.x, y: npc.y } });
        }
        return changes;
    }

    function worldNpcOccupancy(options = {}) { const values = Object.values(ensureStore().worldNpcOccupancy || {}); return values.filter(value => !options.mapId || ensureStore().worldNpcs[value.npcId]?.mapId === integer(options.mapId)).map(value => Object.assign(deepClone(value), { npc: worldNpc(value.npcId) })); }

    function refreshWorldNpcActivities(clockValue = worldClock()) {
        const changes = [];
        for (const npc of Object.values(ensureStore().worldNpcs || {})) {
            if (npc.enabled === false) continue; const scheduled = npcScheduledActivity(npc, clockValue); if (!scheduled) continue;
            if (ensureStore().worldNpcOccupancy[npc.id]?.status === "travelling") continue;
            const previousActivity = npc.activity; npc.activity = scheduled.activity; npc.mapId = scheduled.mapId || npc.mapId; npc.x = scheduled.x; npc.y = scheduled.y;
            if (scheduled.state) npc.state = scheduled.state; npc.currentScheduleId = scheduled.id; npc.updatedAt = Date.now();
            if (previousActivity !== npc.activity) { const change = { npcId: npc.id, previousActivity, activity: npc.activity, scheduleId: scheduled.id, npc: deepClone(npc) }; changes.push(change); queueWorldRecipeTrigger("npcActivityChange", change); }
        }
        return changes;
    }

    function simulateWorldTimeline(options = {}) {
        const start = normalizeWorldClock(options.clock || worldClock()); const minutes = Math.max(0, integer(options.minutes, 1440));
        const stepMinutes = Math.max(1, integer(options.stepMinutes, 60)); const maxSteps = Math.max(1, integer(options.maxSteps, ensureStore().runtimeBudget?.simulationStepsPerFrame || 60) * 20);
        const resources = deepClone(ensureStore().worldResources || {}); const npcs = deepClone(ensureStore().worldNpcs || {}); const schedules = deepClone(ensureStore().worldSchedules || []);
        const timeline = []; const snapshots = []; const end = worldClockSerial(start) + minutes;
        for (let serial = worldClockSerial(start), step = 0; serial <= end && step < maxSteps; serial += stepMinutes, step++) {
            const clock = normalizeWorldClock(Object.assign({}, start, { day: Math.floor(serial / 1440) + 1, minute: serial % 1440 }));
            const events = [];
            for (const resource of Object.values(resources)) if (resource.respawnAt !== null && serial >= resource.respawnAt) { resource.quantity = resource.capacity; resource.respawnAt = null; events.push({ type: "resourceRespawn", resourceId: resource.id }); }
            for (const npc of Object.values(npcs)) { const activity = npcScheduledActivity(npc, clock); if (activity && npc.activity !== activity.activity) { events.push({ type: "npcActivityChange", npcId: npc.id, from: npc.activity, to: activity.activity, scheduleId: activity.id }); npc.activity = activity.activity; npc.mapId = activity.mapId || npc.mapId; npc.x = activity.x; npc.y = activity.y; } }
            for (const task of schedules) if (task.enabled !== false && task.dueWorldMinute !== null && task.dueWorldMinute >= serial && task.dueWorldMinute < serial + stepMinutes) events.push({ type: "scheduledRecipe", scheduleId: task.id, recipeId: task.recipeId });
            if (events.length || options.includeEveryStep) snapshots.push({ clock: deepClone(clock), events, npcs: options.includeState ? deepClone(npcs) : undefined, resources: options.includeState ? deepClone(resources) : undefined });
            timeline.push(...events.map(event => Object.assign({ worldMinute: serial, day: clock.day, minute: clock.minute, season: clock.season }, event)));
        }
        return { ok: true, start, end: normalizeWorldClock(Object.assign({}, start, { day: Math.floor(end / 1440) + 1, minute: end % 1440 })), minutes, stepMinutes, timeline, snapshots, truncated: Math.ceil(minutes / stepMinutes) + 1 > maxSteps };
    }

    function defineWorldResource(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("World Resources require a safe stable ID.");
        const resource = Object.assign({ id, quantity: 1, capacity: 1, respawnMinutes: 0, respawnAt: null, tags: [], metadata: {} }, deepClone(definition), { id });
        resource.quantity = Math.max(0, finiteNumber(resource.quantity, 1)); resource.capacity = Math.max(resource.quantity, finiteNumber(resource.capacity, 1)); resource.respawnMinutes = Math.max(0, integer(resource.respawnMinutes));
        ensureStore().worldResources[id] = resource; return deepClone(resource);
    }

    function worldResource(id) { const value = ensureStore().worldResources[String(id || "")]; return value ? deepClone(value) : null; }
    function listWorldResources() { return Object.values(ensureStore().worldResources || {}).map(deepClone); }
    function harvestWorldResource(id, amount = 1) { const resource = ensureStore().worldResources[String(id || "")]; if (!resource) return false; const taken = Math.min(resource.quantity, Math.max(0, finiteNumber(amount, 1))); resource.quantity -= taken; if (resource.quantity <= 0) { resource.quantity = 0; resource.respawnAt = resource.respawnMinutes > 0 ? worldClockSerial() + resource.respawnMinutes : null; queueWorldRecipeTrigger("resourceDepleted", { resourceId: resource.id, resource: deepClone(resource) }); } return { taken, resource: deepClone(resource) }; }

    function scheduleWorldRecipe(recipeId, options = {}) {
        if (!worldRecipe(recipeId)) throw new Error(`World Recipe "${recipeId}" was not found.`);
        const record = { id: safeWorldRecipeId(options.id) || `schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, recipeId: String(recipeId), remainingFrames: Math.max(0, integer(options.frames, 0)), dueWorldMinute: options.minutes === undefined ? null : worldClockSerial() + Math.max(0, integer(options.minutes)), context: deepClone(options.context || {}), repeatFrames: Math.max(0, integer(options.repeatFrames, 0)), repeatMinutes: Math.max(0, integer(options.repeatMinutes, 0)), enabled: options.enabled !== false, createdAt: Date.now() };
        ensureStore().worldSchedules.push(record); return deepClone(record);
    }

    function cancelWorldSchedule(id) { const schedules = ensureStore().worldSchedules; const before = schedules.length; ensureStore().worldSchedules = schedules.filter(item => item.id !== String(id)); return before !== ensureStore().worldSchedules.length; }
    function listWorldSchedules() { return ensureStore().worldSchedules.map(deepClone); }

    function processWorldSimulation() {
        const store = ensureStore(); const clock = normalizeWorldClock(store.worldClock); store.worldClock = clock;
        if (clock.enabled) { clock.frameCarry++; if (clock.frameCarry >= clock.framesPerMinute) { clock.frameCarry = 0; advanceWorldClock(1); } }
        const serial = worldClockSerial(store.worldClock);
        advanceNpcJourneys(store.worldClock);
        for (const resource of Object.values(store.worldResources || {})) if (resource.respawnAt !== null && serial >= resource.respawnAt) { resource.quantity = resource.capacity; resource.respawnAt = null; queueWorldRecipeTrigger("resourceRespawn", { resourceId: resource.id, resource: deepClone(resource) }); }
        const keep = [];
        for (const task of store.worldSchedules || []) {
            if (!task.enabled) { keep.push(task); continue; }
            if (task.remainingFrames > 0) task.remainingFrames--;
            const due = task.remainingFrames <= 0 && (task.dueWorldMinute === null || serial >= task.dueWorldMinute);
            if (!due) { keep.push(task); continue; }
            Promise.resolve(runWorldRecipe(task.recipeId, Object.assign({ trigger: "scheduled", scheduleId: task.id }, task.context || {}))).catch(error => captureError(error, { operation: "worldSchedule", scheduleId: task.id }));
            if (task.repeatFrames > 0 || task.repeatMinutes > 0) { task.remainingFrames = task.repeatFrames; task.dueWorldMinute = task.repeatMinutes > 0 ? serial + task.repeatMinutes : null; keep.push(task); }
        }
        store.worldSchedules = keep;
    }

    function recipeVersionParts(value) { return String(value || "0").split(/[.+-]/).slice(0, 3).map(part => Math.max(0, integer(part))); }
    function compareRecipeVersions(a, b) { const left = recipeVersionParts(a); const right = recipeVersionParts(b); for (let index = 0; index < 3; index++) if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0); return 0; }

    function validateWorldPack(pack) {
        const errors = []; const warnings = [];
        if (!pack || pack.format !== "HybridWorldPack") errors.push("Expected format HybridWorldPack.");
        const id = safeWorldRecipeId(pack?.id); if (!id) errors.push("Pack requires a safe stable id.");
        for (const dependency of normalizeList(pack?.dependencies)) { const requirement = typeof dependency === "string" ? { id: dependency, range: "*" } : dependency; const installed = ensureStore().worldRecipePacks[String(requirement.id)]; if (!installed && !requirement.optional) errors.push(`Missing dependency ${requirement.id}.`); else if (installed && requirement.range && !satisfiesVersion(installed.version, requirement.range)) errors.push(`Dependency ${requirement.id} ${installed.version} does not satisfy ${requirement.range}.`); else if (installed && requirement.minVersion && compareRecipeVersions(installed.version, requirement.minVersion) < 0) errors.push(`Dependency ${requirement.id} requires ${requirement.minVersion} or newer.`); }
        if (pack?.recipes) { const report = validateWorldRecipeCatalog({ format: "HybridWorldRecipes", version: 1, recipes: pack.recipes }); errors.push(...report.errors); warnings.push(...report.warnings); }
        const capabilities = normalizeList(pack?.capabilities).map(String); const knownCapabilities = new Set(["recipes", "prefabs", "events", "world-state", "zones", "entities", "resources", "variants", "npc-lives", "npc-travel", "rule-layers", "advanced-rule-brushes", "procedural-generation", "graph-caching", "atlas-layouts", "quest-graphs", "map-repair", "extension-contributions"]);
        for (const capability of capabilities) if (!knownCapabilities.has(capability)) warnings.push(`Unknown capability ${capability}.`);
        return { ok: errors.length === 0, errors, warnings, id, version: String(pack?.version || "1.0.0"), capabilities };
    }

    function previewWorldPackInstall(pack) {
        const validation = validateWorldPack(pack); const recipeIds = new Set(worldRecipeDefinitions().map(recipe => recipe.id)); const prefabNames = new Set(listPrefabs().map(prefab => prefab.name));
        const installed = validation.id && ensureStore().worldRecipePacks[validation.id];
        return Object.assign(validation, { installed: installed ? deepClone(installed) : null, operation: installed ? (compareRecipeVersions(validation.version, installed.version) >= 0 ? "upgrade" : "downgrade") : "install", recipeConflicts: normalizeList(pack?.recipes).filter(recipe => recipeIds.has(recipe.id)).map(recipe => recipe.id), prefabConflicts: normalizeList(pack?.prefabs).filter(prefab => prefabNames.has(prefab.name)).map(prefab => prefab.name), counts: { recipes: normalizeList(pack?.recipes).length, prefabs: normalizeList(pack?.prefabs).length, eventTemplates: normalizeList(pack?.eventTemplates).length, zones: normalizeList(pack?.zones).length, entities: normalizeList(pack?.entities).length, resources: normalizeList(pack?.resources).length, variants: normalizeList(pack?.variants).length, npcs: normalizeList(pack?.npcs).length, npcRoutes: normalizeList(pack?.npcRoutes).length, ruleLayers: normalizeList(pack?.ruleLayers).length, ruleBrushes: normalizeList(pack?.ruleBrushes).length, biomeGraphs: normalizeList(pack?.biomeGraphs).length, atlasLayouts: normalizeList(pack?.atlasLayouts).length, questGraphs: normalizeList(pack?.questGraphs).length, extensionContributions: normalizeList(pack?.extensionContributions).length, tests: normalizeList(pack?.tests).length } });
    }

    function worldPackContents(pack) {
        return {
            recipes: normalizeList(pack?.recipes).map(item => String(item.id || "")).filter(Boolean),
            prefabs: normalizeList(pack?.prefabs).map(item => String(item.name || "")).filter(Boolean),
            eventTemplates: normalizeList(pack?.eventTemplates).map(item => String(item.name || "")).filter(Boolean),
            zones: normalizeList(pack?.zones).map(item => String(item.id || "")).filter(Boolean),
            entities: normalizeList(pack?.entities).map(item => String(item.id || "")).filter(Boolean),
            resources: normalizeList(pack?.resources).map(item => String(item.id || "")).filter(Boolean),
            variants: normalizeList(pack?.variants).map(item => String(item.id || "")).filter(Boolean),
            npcs: normalizeList(pack?.npcs).map(item => String(item.id || "")).filter(Boolean),
            npcRoutes: normalizeList(pack?.npcRoutes).map(item => String(item.id || "")).filter(Boolean),
            ruleLayers: normalizeList(pack?.ruleLayers).map(item => String(item.id || "")).filter(Boolean),
            ruleBrushes: normalizeList(pack?.ruleBrushes).map(item => String(item.id || "")).filter(Boolean),
            biomeGraphs: normalizeList(pack?.biomeGraphs).map(item => String(item.id || "")).filter(Boolean),
            atlasLayouts: normalizeList(pack?.atlasLayouts).map(item => String(item.id || "")).filter(Boolean),
            questGraphs: normalizeList(pack?.questGraphs).map(item => String(item.id || "")).filter(Boolean),
            extensionContributions: normalizeList(pack?.extensionContributions).map(item => String(item.id || "")).filter(Boolean),
            tests: normalizeList(pack?.tests).map(item => String(item.id || "")).filter(Boolean),
            stateDefaults: Object.keys(pack?.stateDefaults || {})
        };
    }

    function captureWorldPackTargets(contents) {
        const store = ensureStore(); const capture = (bucket, ids) => Object.fromEntries(ids.map(id => [id, store[bucket]?.[id] === undefined ? null : deepClone(store[bucket][id])]));
        return {
            contents: deepClone(contents), recipes: capture("worldRecipes", contents.recipes), prefabs: capture("prefabs", contents.prefabs),
            prefabPayloads: capture("prefabPayloads", contents.prefabs), prefabRevisions: capture("prefabRevisions", contents.prefabs),
            eventTemplates: capture("eventTemplates", contents.eventTemplates), zones: capture("worldZones", contents.zones), entities: capture("worldEntities", contents.entities),
            resources: capture("worldResources", contents.resources), variants: capture("worldMapVariants", contents.variants), npcs: capture("worldNpcs", contents.npcs), npcRoutes: capture("worldNpcRoutes", contents.npcRoutes),
            ruleLayers: capture("worldRuleLayers", contents.ruleLayers), ruleBrushes: capture("worldRuleBrushes", contents.ruleBrushes), biomeGraphs: capture("worldBiomeGraphs", contents.biomeGraphs),
            atlasLayouts: capture("worldAtlases", contents.atlasLayouts), questGraphs: capture("eventQuestGraphs", contents.questGraphs), extensionContributions: capture("extensionManifests", contents.extensionContributions), extensionPermissions: capture("extensionPermissions", contents.extensionContributions),
            tests: Object.fromEntries(contents.tests.map(id => [id, deepClone((store.worldRecipeTests || []).find(test => test.id === id) || null)])),
            stateDefaults: Object.fromEntries(contents.stateDefaults.map(key => [key, getWorldState(key) === undefined ? null : deepClone(getWorldState(key))]))
        };
    }

    function restoreWorldPackTargets(snapshot) {
        if (!snapshot?.contents) return false; const store = ensureStore();
        const restore = (bucket, values) => { store[bucket] ||= {}; for (const [id, value] of Object.entries(values || {})) { if (value === null) delete store[bucket][id]; else store[bucket][id] = deepClone(value); } };
        restore("worldRecipes", snapshot.recipes); restore("prefabs", snapshot.prefabs); restore("prefabPayloads", snapshot.prefabPayloads); restore("prefabRevisions", snapshot.prefabRevisions);
        restore("eventTemplates", snapshot.eventTemplates); restore("worldZones", snapshot.zones); restore("worldEntities", snapshot.entities); restore("worldResources", snapshot.resources);
        restore("worldMapVariants", snapshot.variants); restore("worldNpcs", snapshot.npcs); restore("worldNpcRoutes", snapshot.npcRoutes); restore("worldRuleLayers", snapshot.ruleLayers); restore("worldRuleBrushes", snapshot.ruleBrushes); restore("worldBiomeGraphs", snapshot.biomeGraphs); restore("worldAtlases", snapshot.atlasLayouts); restore("eventQuestGraphs", snapshot.questGraphs); restore("extensionManifests", snapshot.extensionContributions); restore("extensionPermissions", snapshot.extensionPermissions);
        const testIds = new Set(snapshot.contents.tests || []); store.worldRecipeTests = (store.worldRecipeTests || []).filter(test => !testIds.has(test.id));
        for (const value of Object.values(snapshot.tests || {})) if (value) store.worldRecipeTests.push(deepClone(value));
        for (const [key, value] of Object.entries(snapshot.stateDefaults || {})) { if (value === null) deleteWorldState(key); else setWorldState(key, value); }
        worldZoneSpatialIndex = null; return true;
    }

    function worldPackChecksum(pack) {
        const text = JSON.stringify(canonicalizeWorkspace(pack || {})); let hash = 2166136261;
        for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
        return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }

    function utf8BytesV18(text) {
        if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(text));
        const encoded = unescape(encodeURIComponent(String(text)));
        return Uint8Array.from(encoded, character => character.charCodeAt(0));
    }
    function sha256TextV18(text) {
        const bytes = text instanceof Uint8Array ? text : utf8BytesV18(text), bitLength = bytes.length * 8;
        const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6, message = new Uint8Array(paddedLength);
        message.set(bytes); message[bytes.length] = 0x80;
        const view = new DataView(message.buffer);
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
        view.setUint32(paddedLength - 4, bitLength >>> 0, false);
        const constants = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
        const words = new Uint32Array(64), rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));
        let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
        for (let offset = 0; offset < message.length; offset += 64) {
            for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4, false);
            for (let index = 16; index < 64; index++) { const a = rotr(words[index-15],7)^rotr(words[index-15],18)^(words[index-15]>>>3), b=rotr(words[index-2],17)^rotr(words[index-2],19)^(words[index-2]>>>10); words[index]=(words[index-16]+a+words[index-7]+b)>>>0; }
            let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
            for (let index=0;index<64;index++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),choose=(e&f)^(~e&g),t1=(h+s1+choose+constants[index]+words[index])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),majority=(a&b)^(a&c)^(b&c),t2=(s0+majority)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
            h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
        }
        return [h0,h1,h2,h3,h4,h5,h6,h7].map(value => value.toString(16).padStart(8,"0")).join("");
    }
    function canonicalWorldPackPayload(pack) { const copy = deepClone(pack || {}); delete copy.integrity; delete copy.signature; return canonicalizeWorkspace(copy); }
    function packIntegrityDigest(pack, algorithm = "sha256") {
        const payload = canonicalWorldPackPayload(pack);
        return String(algorithm).toLowerCase().includes("fnv") ? worldPackChecksum(payload) : `sha256-${sha256TextV18(JSON.stringify(payload))}`;
    }
    function base64BytesV18(value) {
        const text = String(value || "").replace(/^base64:/, "");
        if (typeof atob === "function") return Uint8Array.from(atob(text), character => character.charCodeAt(0));
        if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(text, "base64"));
        throw new Error("Base64 decoding is unavailable.");
    }
    function registerPackPublisher(definition) { const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Pack publishers require a safe stable ID."); const publisher = Object.assign({ id, name: definition?.name || id, fingerprint: String(definition?.fingerprint || ""), website: String(definition?.website || ""), trusted: false, addedAt: Date.now() }, deepClone(definition), { id }); ensureStore().packPublishers[id] = publisher; if (publisher.trusted) ensureStore().signedPackTrust[id] = { trusted: true, fingerprint: publisher.fingerprint, trustedAt: Date.now() }; return deepClone(publisher); }
    function trustPackPublisher(id, trusted = true, options = {}) { const key = String(id || ""); const publisher = ensureStore().packPublishers[key]; if (!publisher) return false; publisher.trusted = !!trusted; if (trusted) ensureStore().signedPackTrust[key] = { trusted: true, fingerprint: String(options.fingerprint || publisher.fingerprint || ""), trustedAt: Date.now(), note: String(options.note || "") }; else delete ensureStore().signedPackTrust[key]; return deepClone(publisher); }
    function listTrustedPackPublishers() { return Object.values(ensureStore().packPublishers || {}).map(publisher => Object.assign(deepClone(publisher), { trust: deepClone(ensureStore().signedPackTrust[publisher.id] || null) })); }
    function worldPackTrustReport(pack, integrity) {
        const publisherId = String(integrity?.publisherId || ""), publisher = ensureStore().packPublishers[publisherId], trust = ensureStore().signedPackTrust[publisherId];
        const declaredFingerprint = String(integrity?.fingerprint || integrity?.keyId || "");
        const fingerprintMatches = !trust?.fingerprint || !declaredFingerprint || trust.fingerprint === declaredFingerprint;
        return { publisherId, publisher, trust, fingerprintMatches, trusted: !!(publisher && trust?.trusted && fingerprintMatches) };
    }
    function verifyWorldPackSignature(pack, options = {}) {
        const integrity = pack?.integrity || pack?.signature;
        if (!integrity) { const digest = packIntegrityDigest(pack); return { ok:false, signed:false, trusted:false, digest, errors:["Pack does not include integrity metadata."] }; }
        const algorithm = String(integrity.algorithm || (integrity.signature ? "ed25519" : "fnv1a32")).toLowerCase();
        const digest = packIntegrityDigest(pack, algorithm.includes("fnv") ? "fnv1a32" : "sha256");
        const expected = String(integrity.digest || integrity.checksum || ""), matches = !expected || expected === digest;
        const trust = worldPackTrustReport(pack, integrity), errors = [];
        if (!matches) errors.push("Pack contents do not match the published integrity digest.");
        if (algorithm === "ed25519") errors.push("Ed25519 signatures require verifyWorldPackSignatureAsync().");
        if (options.requireTrusted && !trust.trusted) errors.push("The pack publisher is not trusted on this device.");
        return { ok:matches && algorithm !== "ed25519" && (!options.requireTrusted || trust.trusted), signed:true, verified:algorithm !== "ed25519" && matches, trusted:trust.trusted, publisherId:trust.publisherId, publisher:trust.publisher ? deepClone(trust.publisher) : null, digest, expected, algorithm, fingerprintMatches:trust.fingerprintMatches, errors };
    }
    async function verifyWorldPackSignatureAsync(pack, options = {}) {
        const integrity = pack?.integrity || pack?.signature;
        if (!integrity) return verifyWorldPackSignature(pack, options);
        const algorithm = String(integrity.algorithm || (integrity.signature ? "ed25519" : "sha256")).toLowerCase();
        if (algorithm !== "ed25519") return verifyWorldPackSignature(pack, options);
        const trust = worldPackTrustReport(pack, integrity), digest = packIntegrityDigest(pack, "sha256"), expected = String(integrity.digest || ""), errors = [];
        if (expected && expected !== digest) errors.push("Pack contents do not match the published SHA-256 digest.");
        const subtle = globalThis.crypto?.subtle;
        if (!subtle) errors.push("Web Crypto Ed25519 verification is unavailable in this runtime.");
        let signatureValid = false, keyFingerprint = "";
        if (!errors.length) try {
            const publicKey = base64BytesV18(integrity.publicKey || integrity.key), signature = base64BytesV18(integrity.signature || integrity.value);
            keyFingerprint = `sha256-${sha256TextV18(publicKey)}`;
            const key = await subtle.importKey("raw", publicKey, { name:"Ed25519" }, false, ["verify"]);
            signatureValid = await subtle.verify({ name:"Ed25519" }, key, signature, utf8BytesV18(JSON.stringify(canonicalWorldPackPayload(pack))));
            if (!signatureValid) errors.push("The Ed25519 signature is invalid.");
            const declaredKey = String(integrity.keyId || integrity.fingerprint || "");
            if (declaredKey && declaredKey !== keyFingerprint && declaredKey !== keyFingerprint.slice(7)) errors.push("The signing key fingerprint does not match the declared key ID.");
        } catch (error) { errors.push(`Ed25519 verification failed: ${error.message}`); }
        if (options.requireTrusted && !trust.trusted) errors.push("The pack publisher is not trusted on this device.");
        return { ok:errors.length===0 && signatureValid && (!options.requireTrusted || trust.trusted), signed:true, verified:signatureValid, signatureValid, trusted:trust.trusted, publisherId:trust.publisherId, publisher:trust.publisher ? deepClone(trust.publisher) : null, digest, expected, algorithm:"ed25519", keyFingerprint, fingerprintMatches:trust.fingerprintMatches, errors };
    }


    function installWorldPack(pack, options = {}) {
        const preview = previewWorldPackInstall(pack); if (!preview.ok) return preview;
        const integrity = options.integrityReport || verifyWorldPackSignature(pack, { requireTrusted: !!options.requireTrusted });
        if ((String(pack?.integrity?.algorithm || "").toLowerCase() === "ed25519" && !options.integrityReport) || (options.requireTrusted && !integrity.ok)) return Object.assign(preview, { ok: false, errors: [...preview.errors, ...integrity.errors], integrity });
        const store = ensureStore(); const existing = store.worldRecipePacks[preview.id];
        if (existing && compareRecipeVersions(preview.version, existing.version) < 0 && !options.allowDowngrade) return Object.assign(preview, { ok: false, errors: [...preview.errors, `Downgrading ${preview.id} from ${existing.version} to ${preview.version} requires allowDowngrade.`] });
        const allowed = new Set(normalizeList(options.allowedCapabilities || preview.capabilities)); const denied = preview.capabilities.filter(capability => !allowed.has(capability));
        if (denied.length) return Object.assign(preview, { ok: false, errors: [...preview.errors, `Capabilities were not approved: ${denied.join(", ")}.`] });
        const contents = worldPackContents(pack); const beforeState = captureWorldPackTargets(contents); const beforeRecord = existing ? deepClone(existing) : null; const beforeLock = deepClone(store.worldPackLock.packs[preview.id] || null);
        try {
            for (const recipe of normalizeList(pack.recipes)) registerWorldRecipe(recipe, options.save !== false);
            for (const prefab of normalizeList(pack.prefabs)) registerPrefab(prefab, options.save !== false);
            for (const template of normalizeList(pack.eventTemplates)) registerEventTemplate(template.name, template.event || template.eventData, Object.assign({}, template.options || {}, { save: options.save !== false }));
            for (const zone of normalizeList(pack.zones)) defineWorldZone(zone);
            for (const entity of normalizeList(pack.entities)) defineWorldEntity(entity);
            for (const resource of normalizeList(pack.resources)) defineWorldResource(resource);
            for (const npc of normalizeList(pack.npcs)) defineWorldNpc(npc);
            for (const route of normalizeList(pack.npcRoutes)) defineWorldNpcRoute(route);
            for (const layer of normalizeList(pack.ruleLayers)) defineWorldRuleLayer(layer);
            for (const brush of normalizeList(pack.ruleBrushes)) saveWorldRuleBrush(brush);
            for (const graph of normalizeList(pack.biomeGraphs)) defineBiomeGraph(graph);
            for (const atlas of normalizeList(pack.atlasLayouts)) if (atlas?.id) store.worldAtlases[String(atlas.id)] = deepClone(atlas);
            for (const graph of normalizeList(pack.questGraphs)) if (graph?.id) store.eventQuestGraphs[String(graph.id)] = deepClone(graph);
            for (const manifest of normalizeList(pack.extensionContributions)) installExtensionManifest(manifest, { enabled: true, grant: false });
            const testIds = new Set(contents.tests); store.worldRecipeTests = store.worldRecipeTests.filter(test => !testIds.has(test.id)); for (const test of normalizeList(pack.tests)) store.worldRecipeTests.push(deepClone(test));
            for (const variant of normalizeList(pack.variants)) defineWorldMapVariant(variant);
            for (const [key, value] of Object.entries(pack.stateDefaults || {})) if (getWorldState(key) === undefined || options.replaceStateDefaults) setWorldState(key, value);
            const record = { id: preview.id, name: String(pack.name || preview.id), version: preview.version, installedAt: existing?.installedAt || Date.now(), updatedAt: Date.now(), dependencies: deepClone(pack.dependencies || []), capabilities: deepClone(preview.capabilities), contents, baseline: existing?.baseline || beforeState, checksum: worldPackChecksum(pack), integrity: integrity.signed ? deepClone(integrity) : null, metadata: deepClone(pack.metadata || {}) };
            store.worldRecipePacks[preview.id] = record; store.worldPackLock.packs[preview.id] = { version: record.version, checksum: record.checksum, dependencies: deepClone(record.dependencies), installedAt: record.updatedAt };
            store.worldPackHistory.unshift({ id: `pack-change-${Date.now()}-${Math.floor(Math.random() * 100000)}`, packId: preview.id, operation: existing ? (compareRecipeVersions(preview.version, existing.version) >= 0 ? "upgrade" : "downgrade") : "install", at: Date.now(), beforeState, beforeRecord, beforeLock, afterRecord: deepClone(record) });
            store.worldPackHistory = store.worldPackHistory.slice(0, 50); queueWorldRecipeTrigger("packInstalled", { packId: preview.id, version: preview.version, operation: preview.operation });
            return Object.assign(preview, { installed: true, integrity: integrity.signed ? deepClone(integrity) : null, record: deepClone(record), lockfile: worldPackLockfile() });
        } catch (error) { restoreWorldPackTargets(beforeState); if (beforeRecord) store.worldRecipePacks[preview.id] = beforeRecord; else delete store.worldRecipePacks[preview.id]; if (beforeLock) store.worldPackLock.packs[preview.id] = beforeLock; else delete store.worldPackLock.packs[preview.id]; throw error; }
    }

    async function installWorldPackAsync(pack, options = {}) {
        const integrityReport = await verifyWorldPackSignatureAsync(pack, { requireTrusted: !!options.requireTrusted });
        if (!integrityReport.ok) return Object.assign(previewWorldPackInstall(pack), { ok:false, errors:integrityReport.errors, integrity:integrityReport });
        return installWorldPack(pack, Object.assign({}, options, { integrityReport }));
    }

    function listWorldPacks() { return Object.values(ensureStore().worldRecipePacks || {}).map(deepClone); }
    function listWorldPackHistory(id = "") { return (ensureStore().worldPackHistory || []).filter(entry => !id || entry.packId === String(id)).map(deepClone); }
    function worldPackLockfile() { const store = ensureStore(); store.worldPackLock.generatedAt = new Date().toISOString(); store.worldPackLock.pluginVersion = VERSION; return deepClone(store.worldPackLock); }
    function uninstallWorldPack(id, options = {}) {
        const key = String(id || ""); const store = ensureStore(); const record = store.worldRecipePacks[key]; if (!record) return false;
        const beforeState = captureWorldPackTargets(record.contents); const beforeRecord = deepClone(record); const beforeLock = deepClone(store.worldPackLock.packs[key] || null);
        if (options.restoreBaseline !== false && record.baseline) restoreWorldPackTargets(record.baseline);
        delete store.worldRecipePacks[key]; delete store.worldPackLock.packs[key];
        store.worldPackHistory.unshift({ id: `pack-change-${Date.now()}-${Math.floor(Math.random() * 100000)}`, packId: key, operation: "uninstall", at: Date.now(), beforeState, beforeRecord, beforeLock, afterRecord: null });
        store.worldPackHistory = store.worldPackHistory.slice(0, 50); return { removed: true, id: key, restoredBaseline: options.restoreBaseline !== false };
    }
    function removeWorldPack(id) { return !!uninstallWorldPack(id); }
    function rollbackWorldPack(id) {
        const key = String(id || ""); const store = ensureStore(); const index = store.worldPackHistory.findIndex(entry => entry.packId === key && !entry.rolledBackAt); if (index < 0) return false;
        const entry = store.worldPackHistory[index]; restoreWorldPackTargets(entry.beforeState); if (entry.beforeRecord) store.worldRecipePacks[key] = deepClone(entry.beforeRecord); else delete store.worldRecipePacks[key]; if (entry.beforeLock) store.worldPackLock.packs[key] = deepClone(entry.beforeLock); else delete store.worldPackLock.packs[key]; entry.rolledBackAt = Date.now(); return { rolledBack: true, operation: entry.operation, packId: key, record: deepClone(store.worldRecipePacks[key] || null) };
    }
    function exportWorldPack(options = {}) { const ids = normalizeList(options.recipeIds).map(String); return { format: "HybridWorldPack", schemaVersion: 4, id: safeWorldRecipeId(options.id) || "world-pack", name: String(options.name || "World Pack"), version: String(options.version || "1.0.0"), pluginVersion: VERSION, dependencies: deepClone(options.dependencies || []), permissions: deepClone(options.permissions || []), capabilities: deepClone(options.capabilities || ["recipes", "zones", "entities", "resources", "variants", "npc-lives", "npc-travel", "rule-layers", "advanced-rule-brushes", "procedural-generation", "graph-caching", "atlas-layouts", "quest-graphs", "map-repair"]), recipes: exportWorldRecipePack(ids).recipes, prefabs: options.includePrefabs ? listPrefabs().map(prefab => Object.assign({}, deepClone(prefab), { payload: prefabPayload(prefab.name, prefab.mapId) })).filter(prefab => prefab.payload) : [], zones: options.includeZones === false ? [] : listWorldZones(), entities: options.includeEntities === false ? [] : listWorldEntities(), resources: options.includeResources === false ? [] : listWorldResources(), npcs: options.includeNpcs === false ? [] : listWorldNpcs(), npcRoutes: options.includeNpcRoutes === false ? [] : listWorldNpcRoutes(), ruleLayers: options.includeRuleLayers === false ? [] : listWorldRuleLayers(), ruleBrushes: options.includeRuleBrushes === false ? [] : listWorldRuleBrushes(), biomeGraphs: options.includeBiomeGraphs === false ? [] : listBiomeGraphs(), atlasLayouts: options.includeAtlasLayouts === false ? [] : Object.values(ensureStore().worldAtlases || {}).map(deepClone), questGraphs: options.includeQuestGraphs === false ? [] : Object.values(ensureStore().eventQuestGraphs || {}).map(deepClone), extensionContributions: options.includeExtensionContributions === false ? [] : listExtensionManifests().map(item => ({ id: item.id, name: item.name, version: item.version, permissions: item.permissions, contributes: item.contributes })), tests: options.includeTests === false ? [] : deepClone(ensureStore().worldRecipeTests), variants: Object.values(ensureStore().worldMapVariants || {}).map(deepClone), metadata: deepClone(options.metadata || {}) }; }

