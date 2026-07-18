    // -------------------------------------------------------------------------
    // General utilities
    // -------------------------------------------------------------------------

    function deepClone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function toBoolean(value, fallback = false) {
        if (value === true || value === false) return value;
        if (value === "true") return true;
        if (value === "false") return false;
        return fallback;
    }

    function finiteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function integer(value, fallback = 0) {
        return Math.round(finiteNumber(value, fallback));
    }

    function positiveInteger(value, fallback = 1) {
        const number = integer(value, fallback);
        return number > 0 ? number : fallback;
    }

    function evalNumber(value, fallback = 0, interpreter = null) {
        if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
        const text = String(value ?? "").trim();
        if (!text) return fallback;
        const direct = Number(text);
        if (Number.isFinite(direct)) return direct;
        try {
            const result = Function(`"use strict"; return (${text});`).call(interpreter);
            return Number.isFinite(Number(result)) ? Number(result) : fallback;
        } catch (error) {
            console.warn(`${PLUGIN_NAME}: could not evaluate numeric argument "${text}".`, error);
            return fallback;
        }
    }

    function parseJson(text, fallback = {}) {
        if (text && typeof text === "object") return text;
        const source = String(text ?? "").trim();
        if (!source) return deepClone(fallback);
        try {
            const parsed = JSON.parse(source);
            return parsed && typeof parsed === "object" ? parsed : deepClone(fallback);
        } catch (error) {
            console.warn(`${PLUGIN_NAME}: invalid JSON; using defaults.`, source, error);
            return deepClone(fallback);
        }
    }

    function parseStructArray(value) {
        let list = value;
        if (typeof list === "string") {
            try {
                list = JSON.parse(list || "[]");
            } catch (error) {
                console.warn(`${PLUGIN_NAME}: invalid struct-array parameter.`, error);
                return [];
            }
        }
        if (!Array.isArray(list)) return [];
        return list.map(item => {
            if (item && typeof item === "object") return item;
            try {
                return JSON.parse(item);
            } catch (_error) {
                return null;
            }
        }).filter(Boolean);
    }

    function parseNestedStruct(value, fallback = {}) {
        if (value && typeof value === "object") return value;
        return parseJson(value, fallback);
    }

    function normalizeMode(mode, fallback = "exact") {
        return String(mode || fallback).toLowerCase() === "autotile" ? "autotile" : "exact";
    }

    function normalizeLayer(layer, fallback = "L1") {
        if (typeof layer === "number") {
            const key = `L${Math.round(layer) + 1}`;
            return LAYER_INDEX[key] !== undefined ? key : fallback;
        }
        const text = String(layer ?? fallback).trim().toUpperCase();
        if (LAYER_INDEX[text] !== undefined) return text;
        if (/^[0-5]$/.test(text)) return `L${Number(text) + 1}`;
        return fallback;
    }

    function parseLayerSelection(value) {
        const input = Array.isArray(value) ? value : String(value ?? "").split(",");
        const layers = [];
        let events = false;
        for (const raw of input) {
            const key = String(raw).trim().toUpperCase();
            if (key === "L7" || key === "EVENT" || key === "EVENTS") {
                events = true;
            } else if (LAYER_INDEX[key] !== undefined && !layers.includes(key)) {
                layers.push(key);
            }
        }
        return { layers, events };
    }

    function normalizeRect(x, y, width, height) {
        return {
            x: integer(x),
            y: integer(y),
            w: positiveInteger(width),
            h: positiveInteger(height)
        };
    }

    function inRect(x, y, rect) {
        return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    }

    function inBounds(x, y, width = $dataMap.width, height = $dataMap.height) {
        return x >= 0 && y >= 0 && x < width && y < height;
    }

    function tileIndex(width, height, x, y, z) {
        return (z * height + y) * width + x;
    }

    function readTile(data, width, height, x, y, z) {
        if (!inBounds(x, y, width, height) || z < 0 || z > 5) return 0;
        return data[tileIndex(width, height, x, y, z)] || 0;
    }

    function writeTile(data, width, height, x, y, z, value) {
        if (!inBounds(x, y, width, height) || z < 0 || z > 5) return false;
        data[tileIndex(width, height, x, y, z)] = integer(value);
        return true;
    }

    function directionShift(direction, forward = 0, right = 0) {
        const f = integer(forward);
        const r = integer(right);
        switch (direction) {
            case 2: return { x: -r, y: f };
            case 4: return { x: -f, y: -r };
            case 6: return { x: f, y: r };
            case 8: return { x: r, y: -f };
            default: return { x: 0, y: 0 };
        }
    }

    function resolvePoint(x, y, options = {}, interpreter = null) {
        let resultX = integer(x);
        let resultY = integer(y);
        const mode = String(options.coordinateMode || options.relativeTo || "absolute").toLowerCase();
        let character = null;
        if (mode === "player" || mode === "relative to player") {
            character = $gamePlayer;
            const followerIndex = integer(options.followerIndex, -1);
            if (followerIndex >= 0 && $gamePlayer.followers) {
                character = $gamePlayer.followers().follower(followerIndex) || $gamePlayer;
            }
        } else if (mode === "event" || mode === "relative to event") {
            let eventId = integer(options.eventId, 0);
            if (eventId <= 0 && interpreter && interpreter.eventId) eventId = interpreter.eventId();
            character = $gameMap.event(eventId);
        }
        if (character) {
            const shift = directionShift(
                character.direction ? character.direction() : 2,
                options.forwardShift,
                options.rightShift
            );
            resultX += character.x + shift.x;
            resultY += character.y + shift.y;
        }
        return { x: resultX, y: resultY };
    }

    function clockNow() {
        return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    }

    function recordPerformance(name, duration, details = {}) {
        const key = String(name || "operation");
        const samples = performanceSamples.get(key) || [];
        samples.push(Math.max(0, finiteNumber(duration)));
        if (samples.length > 120) samples.shift();
        performanceSamples.set(key, samples);
        if (duration >= PERFORMANCE_WARNING_MS) {
            recordOperation("performanceWarning", Object.assign({ name: key, duration }, details));
        }
        return duration;
    }

    function measureSync(name, callback, details = {}) {
        const started = clockNow();
        try { return callback(); }
        finally { recordPerformance(name, clockNow() - started, details); }
    }

    function measureAsync(name, promiseOrFactory, details = {}) {
        const started = clockNow();
        let promise;
        try { promise = typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory; }
        catch (error) {
            recordPerformance(name, clockNow() - started, details);
            return Promise.reject(error);
        }
        return Promise.resolve(promise).finally(() => recordPerformance(name, clockNow() - started, details));
    }

    function performanceDiagnostics() {
        const operations = {};
        for (const [name, samples] of performanceSamples) {
            const total = samples.reduce((sum, value) => sum + value, 0);
            operations[name] = {
                samples: samples.length,
                averageMs: samples.length ? total / samples.length : 0,
                maxMs: samples.length ? Math.max(...samples) : 0,
                lastMs: samples.length ? samples[samples.length - 1] : 0
            };
        }
        return { warningThresholdMs: PERFORMANCE_WARNING_MS, operations };
    }

    function recordOperation(operation, detail = {}) {
        const store = ensureStore();
        store.operationLog ||= [];
        store.operationLog.push(Object.assign({
            operation: String(operation || "operation"),
            timestamp: Date.now()
        }, deepClone(detail || {})));
        if (store.operationLog.length > OPERATION_LOG_LIMIT) {
            store.operationLog.splice(0, store.operationLog.length - OPERATION_LOG_LIMIT);
        }
    }

    function operationLog(limit = 100) {
        const list = ensureStore().operationLog || [];
        return deepClone(list.slice(-Math.max(1, integer(limit, 100))).reverse());
    }

    function captureError(error, context = {}) {
        const report = {
            id: `error-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            timestamp: Date.now(),
            message: String(error && error.message || error || "Unknown error"),
            stack: String(error && error.stack || "").split("\n").slice(0, 20).join("\n"),
            context: deepClone(context || {}),
            pluginVersion: VERSION,
            mapId: typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0
        };
        const store = ensureStore();
        store.errorReports ||= [];
        store.errorReports.unshift(report);
        store.errorReports = store.errorReports.slice(0, ERROR_REPORT_LIMIT);
        return deepClone(report);
    }

    function errorReports(limit = 50) {
        return deepClone((ensureStore().errorReports || []).slice(0, Math.max(1, integer(limit, 50))));
    }

    function clearErrorReports() {
        const count = (ensureStore().errorReports || []).length;
        ensureStore().errorReports = [];
        return count;
    }

    function guardedOperation(name, callback, context = {}) {
        const started = clockNow();
        try {
            const result = callback();
            if (result && typeof result.then === "function") {
                return result.catch(error => {
                    captureError(error, Object.assign({ operation: name }, context));
                    throw error;
                }).finally(() => recordPerformance(name, clockNow() - started, context));
            }
            recordPerformance(name, clockNow() - started, context);
            return result;
        } catch (error) {
            recordPerformance(name, clockNow() - started, context);
            captureError(error, Object.assign({ operation: name }, context));
            throw error;
        }
    }

    function emitJob(job) {
        const snapshot = deepClone(job);
        for (const listener of jobListeners) {
            try { listener(snapshot); }
            catch (error) { captureError(error, { operation: "jobListener", jobId: job.id }); }
        }
        return snapshot;
    }

    function createOperationJob(name, total = 0, options = {}) {
        const job = {
            id: String(options.id || `job-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(name || "Operation"),
            status: "running",
            total: Math.max(0, integer(total, 0)),
            completed: 0,
            progress: 0,
            message: String(options.message || "Starting…"),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cancellable: options.cancellable !== false,
            cancelled: false,
            result: null,
            error: null
        };
        operationJobs.set(job.id, job);
        emitJob(job);
        return deepClone(job);
    }

    function updateOperationJob(jobId, changes = {}) {
        const job = operationJobs.get(String(jobId));
        if (!job) return false;
        Object.assign(job, deepClone(changes));
        job.completed = Math.max(0, integer(job.completed, 0));
        job.total = Math.max(0, integer(job.total, 0));
        job.progress = job.total > 0 ? Math.max(0, Math.min(1, job.completed / job.total))
            : Math.max(0, Math.min(1, finiteNumber(job.progress, 0)));
        job.updatedAt = Date.now();
        emitJob(job);
        return deepClone(job);
    }

    function cancelOperationJob(jobId) {
        const job = operationJobs.get(String(jobId));
        if (!job || !job.cancellable || job.status !== "running") return false;
        job.cancelled = true;
        job.status = "cancelling";
        job.message = "Cancelling…";
        job.updatedAt = Date.now();
        emitJob(job);
        return true;
    }

    function operationJobState(jobId) {
        const job = operationJobs.get(String(jobId));
        return job ? deepClone(job) : null;
    }

    function listOperationJobs(options = {}) {
        const includeFinished = options.includeFinished !== false;
        return Array.from(operationJobs.values()).filter(job => includeFinished || ["running", "cancelling"].includes(job.status))
            .sort((a, b) => b.updatedAt - a.updatedAt).map(deepClone);
    }

    function onJobProgress(callback) {
        if (typeof callback !== "function") return () => {};
        jobListeners.add(callback);
        return () => jobListeners.delete(callback);
    }

    function runChunkedOperation(name, items, worker, options = {}) {
        const list = Array.from(items || []);
        const job = createOperationJob(name, list.length, options);
        const batchSize = Math.max(1, integer(options.batchSize, 250));
        return new Promise((resolve, reject) => {
            const results = [];
            let index = 0;
            const step = () => {
                const current = operationJobs.get(job.id);
                if (!current || current.cancelled) {
                    if (current) updateOperationJob(job.id, { status: "cancelled", message: "Cancelled." });
                    resolve({ cancelled: true, results, job: operationJobState(job.id) });
                    return;
                }
                try {
                    const end = Math.min(list.length, index + batchSize);
                    for (; index < end; index++) results.push(worker(list[index], index, current));
                    updateOperationJob(job.id, { completed: index, message: `${index} / ${list.length}` });
                    if (index < list.length) setTimeout(step, 0);
                    else {
                        updateOperationJob(job.id, { status: "completed", progress: 1, result: results, message: "Complete." });
                        resolve({ cancelled: false, results, job: operationJobState(job.id) });
                    }
                } catch (error) {
                    const report = captureError(error, { operation: name, jobId: job.id, index });
                    updateOperationJob(job.id, { status: "failed", error: report, message: report.message });
                    reject(error);
                }
            };
            step();
        });
    }

    function inputWithinLimit(value, maximumBytes = MAX_IMPORT_BYTES) {
        if (typeof value !== "string") return true;
        const size = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(value).length : value.length * 2;
        return size <= maximumBytes;
    }

    function emitChange(detail) {
        const payload = Object.assign({ plugin: PLUGIN_NAME, version: VERSION }, detail);
        if (!new Set(["copyArea", "diagnoseMap", "beginTransaction"]).has(payload.operation)) {
            recordOperation(payload.operation || "change", payload);
        }
        for (const listener of changeListeners) {
            try {
                listener(payload);
            } catch (error) {
                console.error(`${PLUGIN_NAME}: onChange listener failed.`, error);
            }
        }
        if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent !== "undefined") {
            window.dispatchEvent(new CustomEvent("HybridTileGraft:changed", { detail: payload }));
        }
        runCompatibilityRefresh(payload);
        if (AUTO_WORLD_RECIPES && !["worldRecipeRun", "copyArea", "diagnoseMap", "beginTransaction"].includes(payload.operation)) {
            queueWorldRecipeTrigger("tileChange", payload);
        }
    }

    function callFirstMethod(target, methodNames, payload) {
        if (!target) return false;
        for (const name of methodNames) {
            if (typeof target[name] === "function") {
                try {
                    target[name](payload);
                    return true;
                } catch (error) {
                    console.warn(`${PLUGIN_NAME}: compatibility refresh ${name} failed.`, error);
                }
            }
        }
        return false;
    }

    function registerCompatibilityAdapter(name, adapter) {
        const key = String(name || "").trim();
        if (!key || (!adapter || (typeof adapter !== "function" && typeof adapter.onChange !== "function"))) return false;
        compatibilityAdapters.set(key, typeof adapter === "function" ? { onChange: adapter } : adapter);
        return true;
    }

    function unregisterCompatibilityAdapter(name) {
        return compatibilityAdapters.delete(String(name || "").trim());
    }

    function resolveGlobalPath(path) {
        let value = typeof globalThis !== "undefined" ? globalThis : window;
        for (const part of String(path || "").split(".").filter(Boolean)) {
            value = value && value[part];
        }
        return value || null;
    }

    function registerAdapterProfile(name, profile) {
        const key = String(name || "").trim();
        if (!key || !profile || typeof profile !== "object") return false;
        adapterProfiles.set(key, Object.assign({ name: key, paths: [], methods: [] }, deepClone(profile)));
        return true;
    }

    function activateAdapterProfile(name, active = true) {
        const key = String(name || "").trim();
        if (!adapterProfiles.has(key)) return false;
        const profiles = ensureStore().activeAdapterProfiles;
        if (active !== false && !profiles.includes(key)) profiles.push(key);
        if (active === false) ensureStore().activeAdapterProfiles = profiles.filter(value => value !== key);
        return true;
    }

    function listAdapterProfiles() {
        const active = new Set(ensureStore().activeAdapterProfiles || []);
        return Array.from(adapterProfiles.values()).map(profile => Object.assign(deepClone(profile), {
            active: active.has(profile.name),
            detected: (profile.paths || []).some(path => !!resolveGlobalPath(path))
        }));
    }

    registerAdapterProfile("VisuMZ", {
        paths: ["VisuMZ", "Imported.VisuMZ_1_EventsMoveCore", "Imported.VisuMZ_1_EventsAndMovementCore"],
        methods: ["refreshMap", "refreshCollision", "rebuildCollisionMap", "requestRefresh"]
    });
    registerAdapterProfile("CycloneMovement", {
        paths: ["CycloneMovement"],
        methods: ["refresh", "rebuildCollisionTable", "setupCollision", "requestRefresh"]
    });
    registerAdapterProfile("OcRam", {
        paths: ["OcRam", "Imported.OcRam_Movement", "Imported.OcRam_Lights"],
        methods: ["refreshMap", "refreshCollision", "refreshLights", "requestRefresh"]
    });
    registerAdapterProfile("Lighting", {
        paths: ["Community_Lighting", "TerraxLighting", "Khas", "$gameLighting"],
        methods: ["refresh", "refreshMap", "refreshLighting", "reloadMap", "requestRefresh"]
    });
    registerAdapterProfile("Minimap", {
        paths: ["Minimap", "$gameMinimap", "SceneManager._scene._spriteset._miniMap"],
        methods: ["refresh", "redraw", "refreshMap", "requestRefresh"]
    });

    let lastCompatibilityReport = null;

    function runCompatibilityRefresh(payload = {}) {
        const nonMutating = new Set(["copyArea", "beginTransaction", "commitTransaction", "diagnoseMap", "compactMap"]);
        if (nonMutating.has(payload.operation)) return false;
        const started = clockNow();
        const report = {
            timestamp: Date.now(),
            operation: payload.operation || "change",
            mapId: payload.mapId || 0,
            called: [],
            detectedProfiles: [],
            adapters: [],
            failures: []
        };
        const call = (target, methods, label) => {
            if (!target) return false;
            for (const method of methods) {
                if (typeof target[method] !== "function") continue;
                try {
                    target[method](payload);
                    report.called.push(`${label}.${method}`);
                    return true;
                } catch (error) {
                    report.failures.push(`${label}.${method}: ${error.message}`);
                }
            }
            return false;
        };
        if (typeof $gameMap !== "undefined" && $gameMap && payload.mapId === $gameMap.mapId()) {
            call($gameMap, ["requestRefresh"], "$gameMap");
            call($gameMap, [
                "rebuildCollisionMap", "refreshCollisionMap", "setupCollisionMap",
                "rebuildPathfinding", "refreshPathfinding", "refreshMinimap", "requestMinimapRefresh",
                "refreshLighting", "requestLightingRefresh"
            ], "$gameMap");
            const scene = typeof SceneManager !== "undefined" ? SceneManager._scene : null;
            if (scene && scene._spriteset) {
                call(scene._spriteset, ["refreshTilemap", "refreshCollision", "refreshLighting", "refreshMinimap"], "spriteset");
                call(scene._spriteset._miniMap || scene._spriteset._minimap,
                    ["refresh", "requestRefresh", "redraw"], "minimap");
                call(scene._spriteset._lighting || scene._spriteset._lightLayer,
                    ["refresh", "requestRefresh", "redraw"], "lighting");
            }
        }
        for (const name of ensureStore().activeAdapterProfiles || []) {
            const profile = adapterProfiles.get(name);
            if (!profile) continue;
            for (const path of profile.paths || []) {
                const target = resolveGlobalPath(path);
                if (!target) continue;
                report.detectedProfiles.push(name);
                if (call(target, profile.methods || [], name)) break;
            }
        }
        for (const [name, adapter] of compatibilityAdapters) {
            try {
                adapter.onChange(payload);
                report.adapters.push(name);
            } catch (error) {
                console.warn(`${PLUGIN_NAME}: compatibility adapter "${name}" failed.`, error);
                report.failures.push(`${name}: ${error.message}`);
            }
        }
        report.durationMs = clockNow() - started;
        lastCompatibilityReport = report;
        recordPerformance("compatibilityRefresh", report.durationMs, { operation: payload.operation });
        return true;
    }

    function compatibilityDiagnostics() {
        return {
            lastRefresh: deepClone(lastCompatibilityReport),
            customAdapters: Array.from(compatibilityAdapters.keys()),
            profiles: listAdapterProfiles()
        };
    }

