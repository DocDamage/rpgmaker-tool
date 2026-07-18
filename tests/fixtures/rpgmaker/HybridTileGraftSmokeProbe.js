/*:
 * @target MZ
 * @plugindesc Real-engine smoke probe for HybridTileGraft automated verification.
 * @author DocDamage
 * @help
 * Test-only plugin. Load it immediately after HybridTileGraft in an isolated
 * RPG Maker MZ project. It applies a reversible region patch, performs an
 * actual save/reset/load cycle, samples live frame timing, cleans its save,
 * writes real-engine-smoke.json, and displays a PASS/FAIL banner.
 */

(() => {
    "use strict";

    const MARKER_NAME = "real-engine-smoke.json";
    const SAVEFILE_ID = 20;
    const STATE_KEY = "hybridTileGraft.realEngineSmoke";
    const PROBE_LOADED_AT = typeof performance !== "undefined" ? performance.now() : Date.now();
    let finished = false;

    function projectRoot() {
        if (typeof require !== "function") {
            throw new Error("NW.js Node integration is unavailable.");
        }
        const fs = require("fs");
        const path = require("path");
        const pathname = decodeURIComponent(window.location.pathname)
            .replace(/^\/([A-Za-z]:)/, "$1");
        const candidates = [
            ...(globalThis.nw?.App?.fullArgv || []),
            ...(globalThis.nw?.App?.argv || []),
            ...(typeof process !== "undefined" ? process.argv || [] : []),
            globalThis.nw?.App?.startPath,
            typeof process !== "undefined" && process.mainModule?.filename
                ? path.dirname(process.mainModule.filename)
                : "",
            typeof process !== "undefined" ? process.cwd() : "",
            /^[A-Za-z]:[\\/]/.test(pathname) ? path.dirname(pathname) : ""
        ];
        for (const candidate of candidates) {
            if (!candidate || String(candidate).startsWith("--")) continue;
            const resolved = path.resolve(String(candidate).replace(/^"|"$/g, ""));
            if (fs.existsSync(path.join(resolved, "game.rmmzproject"))) {
                return resolved;
            }
        }
        throw new Error("Could not resolve the RPG Maker project root.");
    }

    function writeMarker(result) {
        if (typeof require !== "function") return false;
        const fs = require("fs");
        const path = require("path");
        fs.writeFileSync(
            path.join(projectRoot(), MARKER_NAME),
            `${JSON.stringify(result, null, 2)}\n`,
            "utf8"
        );
        return true;
    }

    async function removeProbeSave(saveName) {
        try { await Promise.resolve(StorageManager.remove(saveName)); } catch (_error) {}
        if (Array.isArray(DataManager._globalInfo)) {
            DataManager._globalInfo[SAVEFILE_ID] = null;
            await Promise.resolve(DataManager.saveGlobalInfo());
        }
    }

    function localSaveBytes(saveName) {
        if (typeof require !== "function" || typeof StorageManager.filePath !== "function") return null;
        const fs = require("fs");
        const filePath = StorageManager.filePath(saveName);
        return fs.existsSync(filePath) ? fs.statSync(filePath).size : null;
    }

    function localSaveExists(saveName) {
        if (typeof require !== "function" || typeof StorageManager.filePath !== "function") return null;
        return require("fs").existsSync(StorageManager.filePath(saveName));
    }

    async function sampleFrameTiming(frameCount = 30) {
        const timestamps = [];
        await new Promise(resolve => {
            const step = timestamp => {
                timestamps.push(Number(timestamp));
                if (timestamps.length >= frameCount + 1) resolve();
                else requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
        const samples = timestamps.slice(1).map((value, index) => value - timestamps[index]).filter(Number.isFinite);
        const sorted = [...samples].sort((a, b) => a - b);
        const total = samples.reduce((sum, value) => sum + value, 0);
        return {
            frames: samples.length,
            averageMs: samples.length ? total / samples.length : null,
            maximumMs: samples.length ? Math.max(...samples) : null,
            p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null
        };
    }

    async function runPersistenceProbe(api, mapId, x, y) {
        const saveName = DataManager.makeSavename(SAVEFILE_ID);
        const originalRegionId = api.getTileId(x, y, "L6");
        const testRegionId = originalRegionId >= 255 ? 254 : originalRegionId + 1;
        const token = `save-reload-${Date.now()}`;
        let result = null;
        await removeProbeSave(saveName);
        try {
            const patch = api.setTile(x, y, "L6", testRegionId, true, { mode: "exact" });
            api.setWorldState(STATE_KEY, token);
            const beforeSave = api.runtimeSavePayload();
            await DataManager.saveGame(SAVEFILE_ID);
            const saveBytes = localSaveBytes(saveName);

            api.resetMap(mapId, true);
            api.deleteWorldState(STATE_KEY);
            const resetStateMissing = api.getWorldState(STATE_KEY) === undefined;
            const resetRegionRestored = api.getTileId(x, y, "L6") === originalRegionId;

            await DataManager.loadGame(SAVEFILE_ID);
            const afterLoad = api.runtimeSavePayload();
            const loadedPatches = afterLoad.maps?.[String(mapId)] || [];
            const loadedState = api.getWorldState(STATE_KEY);
            const diagnosis = api.diagnoseMapSync(mapId);
            result = {
                ok: !!patch && beforeSave.maps?.[String(mapId)]?.length > 0 && resetStateMissing && resetRegionRestored && loadedState === token && loadedPatches.length > 0 && diagnosis.patchCount > 0 && Number(saveBytes) > 0,
                savefileId: SAVEFILE_ID,
                saveBytes,
                originalRegionId,
                testRegionId,
                patchCreated: !!patch,
                resetStateMissing,
                resetRegionRestored,
                loadedStateMatched: loadedState === token,
                loadedPatchCount: loadedPatches.length,
                diagnosedPatchCount: diagnosis.patchCount
            };
        } finally {
            try { api.resetMap(mapId, true); } catch (_error) {}
            try { api.deleteWorldState(STATE_KEY); } catch (_error) {}
            await removeProbeSave(saveName);
        }
        result.temporarySaveRemoved = localSaveExists(saveName) === false;
        result.ok = result.ok && result.temporarySaveRemoved;
        return result;
    }

    function showBanner(result) {
        document.title = result.ok
            ? "HybridTileGraft Real Engine PASS"
            : "HybridTileGraft Real Engine FAIL";
        const banner = document.createElement("div");
        banner.id = "htg-real-engine-smoke-banner";
        banner.textContent = result.ok
            ? `PASS — HybridTileGraft v${result.pluginVersion} on RPG Maker MZ ${result.rpgMakerVersion}`
            : `FAIL — ${result.errors.join(" | ")}`;
        Object.assign(banner.style, {
            position: "fixed",
            zIndex: "999999",
            left: "16px",
            right: "16px",
            top: "16px",
            padding: "14px 18px",
            color: "#ffffff",
            background: result.ok ? "#136f3a" : "#9c1c1c",
            border: "2px solid #ffffff",
            borderRadius: "8px",
            font: "bold 18px sans-serif",
            textAlign: "center",
            boxShadow: "0 3px 14px rgba(0, 0, 0, 0.45)"
        });
        document.body.appendChild(banner);
    }

    async function runSmokeProbe() {
        const errors = [];
        const api = window.HybridTileGraft;
        const commandKeys = Object.keys(PluginManager._commands || {})
            .filter(key => key.startsWith("HybridTileGraft:"));
        let storeValidation = null;
        let diagnosis = null;
        let health = null;
        let tileId = null;
        let persistence = null;
        let frameTiming = null;
        let benchmark = null;

        try {
            if (!api) throw new Error("window.HybridTileGraft is missing.");
            persistence = await runPersistenceProbe(api, $gameMap.mapId(), $gamePlayer.x, $gamePlayer.y);
            frameTiming = await sampleFrameTiming(30);
            benchmark = api.runWorldBenchmark({ iterations: 2, mapId: $gameMap.mapId() });
            storeValidation = api.validateStore({ repair: false });
            diagnosis = api.diagnoseMapSync($gameMap.mapId());
            health = api.systemHealthReport();
            tileId = api.getTileId($gamePlayer.x, $gamePlayer.y, 0);
        } catch (error) {
            errors.push(error && error.stack ? error.stack : String(error));
        }

        const checks = {
            apiPresent: !!api,
            pluginVersion: api?.version === "18.1.0",
            pluginName: api?.pluginName === "HybridTileGraft",
            registeredCommands: commandKeys.length === 196,
            mapStarted: typeof $gameMap?.mapId === "function" && $gameMap.mapId() > 0,
            tileReadable: Number.isInteger(tileId) && tileId >= 0,
            storeValid: storeValidation?.ok === true,
            mapDiagnosis: diagnosis?.mapId === $gameMap?.mapId(),
            healthAvailable: health?.pluginVersion === "18.1.0",
            saveReloadPersistence: persistence?.ok === true,
            saveFileMeasured: Number(persistence?.saveBytes) > 0,
            frameTimingMeasured: frameTiming?.frames === 30 && Number.isFinite(frameTiming?.p95Ms),
            frameTimingWithinSmokeBudget: Number(frameTiming?.p95Ms) <= 100,
            benchmarkCompleted: Array.isArray(benchmark?.samples) && benchmark.samples.length > 0,
            commandResultsAvailable: typeof api?.lastCommandResult === "function" && typeof api?.onCommandResult === "function"
        };
        for (const [name, passed] of Object.entries(checks)) {
            if (!passed) errors.push(`Check failed: ${name}`);
        }

        const result = {
            format: "HybridTileGraftRealEngineSmoke",
            version: 2,
            generatedAt: new Date().toISOString(),
            ok: errors.length === 0,
            rpgMakerVersion: String(Utils.RPGMAKER_VERSION || "unknown"),
            nwVersion: typeof process !== "undefined" ? String(process.versions?.nw || "unknown") : "unavailable",
            pluginName: api?.pluginName || "missing",
            pluginVersion: api?.version || "missing",
            commandCount: commandKeys.length,
            publicApiEntryCount: api ? Object.keys(api).length : 0,
            mapReadyMs: Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - PROBE_LOADED_AT),
            mapId: typeof $gameMap?.mapId === "function" ? $gameMap.mapId() : 0,
            player: {
                x: Number($gamePlayer?.x || 0),
                y: Number($gamePlayer?.y || 0),
                layer0TileId: tileId
            },
            storeValidation: storeValidation ? {
                ok: storeValidation.ok,
                issueCount: storeValidation.issueCount,
                repaired: storeValidation.repaired
            } : null,
            diagnosis: diagnosis ? {
                mapId: diagnosis.mapId,
                patchCount: diagnosis.patchCount,
                tileWrites: diagnosis.tileWrites,
                warningCount: Array.isArray(diagnosis.warnings) ? diagnosis.warnings.length : 0
            } : null,
            health: health ? {
                ok: health.ok,
                warningCount: Array.isArray(health.warnings) ? health.warnings.length : 0,
                errorCount: Array.isArray(health.errors) ? health.errors.length : 0
            } : null,
            persistence,
            frameTiming,
            benchmark: benchmark ? {
                iterations: benchmark.iterations,
                totalMs: benchmark.totalMs,
                sampleCount: Array.isArray(benchmark.samples) ? benchmark.samples.length : 0
            } : null,
            checks,
            errors
        };

        window.__HTG_REAL_ENGINE_SMOKE__ = result;
        try {
            result.markerWritten = true;
            writeMarker(result);
        } catch (error) {
            result.markerWritten = false;
            result.ok = false;
            result.errors.push(error && error.stack ? error.stack : String(error));
        }
        showBanner(result);
        console.log("[HybridTileGraft Real Engine Smoke]", result);
    }

    const sceneMapStart = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        sceneMapStart.call(this);
        if (!finished) {
            finished = true;
            setTimeout(() => runSmokeProbe().catch(error => {
                const result = {
                    format: "HybridTileGraftRealEngineSmoke",
                    version: 2,
                    generatedAt: new Date().toISOString(),
                    ok: false,
                    rpgMakerVersion: String(Utils.RPGMAKER_VERSION || "unknown"),
                    pluginName: window.HybridTileGraft?.pluginName || "missing",
                    pluginVersion: window.HybridTileGraft?.version || "missing",
                    errors: [error && error.stack ? error.stack : String(error)],
                    markerWritten: false
                };
                try { result.markerWritten = true; writeMarker(result); } catch (markerError) { result.errors.push(String(markerError)); }
                window.__HTG_REAL_ENGINE_SMOKE__ = result;
                showBanner(result);
                console.error("[HybridTileGraft Real Engine Smoke]", result);
            }), 0);
        }
    };
})();
