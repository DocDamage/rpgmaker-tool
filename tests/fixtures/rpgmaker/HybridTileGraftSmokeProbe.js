/*:
 * @target MZ
 * @plugindesc Real-engine smoke probe for HybridTileGraft automated verification.
 * @author DocDamage
 * @help
 * Test-only plugin. Load it immediately after HybridTileGraft in an isolated
 * RPG Maker MZ project. It writes real-engine-smoke.json in the project root
 * and displays a PASS/FAIL banner after Scene_Map starts.
 */

(() => {
    "use strict";

    const MARKER_NAME = "real-engine-smoke.json";
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

    function runSmokeProbe() {
        const errors = [];
        const api = window.HybridTileGraft;
        const commandKeys = Object.keys(PluginManager._commands || {})
            .filter(key => key.startsWith("HybridTileGraft:"));
        let storeValidation = null;
        let diagnosis = null;
        let health = null;
        let tileId = null;

        try {
            if (!api) throw new Error("window.HybridTileGraft is missing.");
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
            healthAvailable: health?.pluginVersion === "18.1.0"
        };
        for (const [name, passed] of Object.entries(checks)) {
            if (!passed) errors.push(`Check failed: ${name}`);
        }

        const result = {
            format: "HybridTileGraftRealEngineSmoke",
            version: 1,
            generatedAt: new Date().toISOString(),
            ok: errors.length === 0,
            rpgMakerVersion: String(Utils.RPGMAKER_VERSION || "unknown"),
            nwVersion: typeof process !== "undefined" ? String(process.versions?.nw || "unknown") : "unavailable",
            pluginName: api?.pluginName || "missing",
            pluginVersion: api?.version || "missing",
            commandCount: commandKeys.length,
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
            setTimeout(runSmokeProbe, 0);
        }
    };
})();
