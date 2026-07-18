    // -------------------------------------------------------------------------
    // v14 live production, recorded testing, semantics, and release services
    // -------------------------------------------------------------------------

    let liveProductionBridge = null;
    let liveProductionFrame = 0;

    function stableProductionHash(value) {
        const text = typeof value === "string" ? value : JSON.stringify(canonicalizeWorkspace(value));
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
    }

    function liveProductionSnapshot() {
        const session = ensureStore().activeLiveProductionSession;
        const mapId = typeof $gameMap !== "undefined" && $gameMap ? integer($gameMap.mapId()) : 0;
        const watchedSwitches = normalizeList(session?.watchedSwitches).map(Number).filter(value => value > 0);
        const watchedVariables = normalizeList(session?.watchedVariables).map(Number).filter(value => value > 0);
        const switches = {}; const variables = {};
        if (typeof $gameSwitches !== "undefined" && $gameSwitches) for (const id of watchedSwitches) switches[id] = !!$gameSwitches.value(id);
        if (typeof $gameVariables !== "undefined" && $gameVariables) for (const id of watchedVariables) variables[id] = deepClone($gameVariables.value(id));
        const snapshot = {
            format: "HybridTileLiveState", version: 2, protocolVersion: 2, pluginVersion: VERSION, capturedAt: Date.now(),
            session: session ? { id: session.id, label: session.label, status: session.status, startedAt: session.startedAt, protocolVersion: integer(session.protocolVersion, 2), clientId: session.clientId, sessionToken: session.sessionToken, connectedAt: session.connectedAt, heartbeatAt: session.heartbeatAt, staleAfterMs: session.staleAfterMs } : null,
            mapId,
            player: typeof $gamePlayer !== "undefined" && $gamePlayer ? { x: integer($gamePlayer.x), y: integer($gamePlayer.y), direction: integer($gamePlayer.direction?.(), 2), transferring: !!$gamePlayer.isTransferring?.() } : null,
            switches, variables, worldClock: worldClock(), activeRecipes: Object.values(ensureStore().worldRecipeStates || {}).filter(item => item?.running).length,
            recordingId: ensureStore().activePlaytestRecordingId || null, frame: typeof Graphics !== "undefined" ? integer(Graphics.frameCount) : 0,
            paused: !!session?.paused, sequence: integer(session?.sequence), heartbeatAt: session?.heartbeatAt || null,
            capabilities: deepClone(session?.capabilities || []), logs: deepClone((session?.logs || []).slice(-50)),
            lastAck: deepClone(session?.lastAck || null), errors: deepClone(session?.errors || [])
        };
        snapshot.stateHash = stableProductionHash({ mapId: snapshot.mapId, player: snapshot.player, switches, variables, worldClock: snapshot.worldClock, activeRecipes: snapshot.activeRecipes, paused: snapshot.paused });
        return snapshot;
    }

    function atomicWriteLiveJson(file, value) {
        if (!liveProductionBridge) return false;
        const temporary = `${file}.tmp-${typeof process !== "undefined" ? process.pid : Date.now()}`;
        liveProductionBridge.fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
        liveProductionBridge.fs.renameSync(temporary, file);
        return true;
    }

    function writeLiveProductionState() {
        if (!liveProductionBridge) return false;
        try { atomicWriteLiveJson(liveProductionBridge.stateFile, liveProductionSnapshot()); return true; }
        catch (error) { const session = ensureStore().activeLiveProductionSession; if (session) session.errors = [...(session.errors || []), String(error.message || error)].slice(-10); return false; }
    }

    function startLiveProductionSession(options = {}) {
        if (ensureStore().activeLiveProductionSession) stopLiveProductionSession({ reason: "restarted" });
        const playtest = typeof Utils === "undefined" || !Utils.isOptionValid || Utils.isOptionValid("test");
        if (!playtest && options.allowProduction !== true) throw new Error("Live Production is restricted to playtest unless allowProduction is explicitly enabled.");
        const session = {
            id: String(options.id || `live-${Date.now()}`), label: String(options.label || "Live Production"), status: "active", startedAt: Date.now(),
            intervalFrames: Math.max(5, integer(options.intervalFrames, 30)), watchedSwitches: normalizeList(options.watchedSwitches).map(Number).filter(value => value > 0),
            watchedVariables: normalizeList(options.watchedVariables).map(Number).filter(value => value > 0), handledCommandIds: [], lastAck: null, errors: [],
            protocolVersion: 2, clientId: String(options.clientId || "studio"), sessionToken: stableProductionHash(`${Date.now()}-${Math.random()}-${options.clientId || "studio"}`),
            connectedAt: Date.now(), heartbeatAt: Date.now(), staleAfterMs: Math.max(5000, integer(options.staleAfterMs, 30000)), sequence: 0,
            capabilities: ["handshake","heartbeat","state-diff","ack","recording","journey-replay","recipe-reload","recovery","diagnostics"], logs: [], commandHistory: []
        };
        ensureStore().activeLiveProductionSession = session;
        if (options.bridge !== false && typeof require === "function" && typeof process !== "undefined") {
            try {
                const fs = require("fs"); const path = require("path"); const dataDirectory = path.resolve(String(options.directory || path.join(process.cwd(), "data")));
                if (!fs.existsSync(dataDirectory)) fs.mkdirSync(dataDirectory, { recursive: true });
                liveProductionBridge = { fs, stateFile: path.join(dataDirectory, String(options.stateFile || "HybridTileLiveState.json")), commandFile: path.join(dataDirectory, String(options.commandFile || "HybridTileLiveCommands.json")), recordingFile: path.join(dataDirectory, String(options.recordingFile || "HybridTileLastRecording.json")), lastCommandMtime: 0 };
                writeLiveProductionState();
            } catch (error) { session.errors.push(String(error.message || error)); liveProductionBridge = null; }
        }
        recordOperation("startLiveProductionSession", { id: session.id, bridge: !!liveProductionBridge });
        return liveProductionState();
    }

    function liveProductionState() { return Object.assign(liveProductionSnapshot(), { bridge: liveProductionBridge ? { stateFile: liveProductionBridge.stateFile, commandFile: liveProductionBridge.commandFile } : null }); }

    function stopLiveProductionSession(options = {}) {
        const store = ensureStore(); const session = store.activeLiveProductionSession; if (!session) return false;
        session.status = "stopped"; session.stoppedAt = Date.now(); session.reason = String(options.reason || "manual");
        if (store.activePlaytestRecordingId) stopPlaytestRecording({ reason: "live-session-stopped" });
        if (liveProductionBridge) { try { atomicWriteLiveJson(liveProductionBridge.stateFile, liveProductionSnapshot()); } catch (_) {} }
        store.liveProductionSessions.unshift(deepClone(session)); store.liveProductionSessions = store.liveProductionSessions.slice(0, 30); store.activeLiveProductionSession = null; liveProductionBridge = null;
        recordOperation("stopLiveProductionSession", { id: session.id, durationMs: session.stoppedAt - session.startedAt });
        return deepClone(session);
    }

    function listLiveProductionSessions() { const store = ensureStore(); return [store.activeLiveProductionSession, ...(store.liveProductionSessions || [])].filter(Boolean).map(item => ({ id: item.id, label: item.label, status: item.status, startedAt: item.startedAt, stoppedAt: item.stoppedAt || null, errors: item.errors?.length || 0 })); }

    function applyLiveProductionCommand(command = {}) {
        const type = String(command.type || "").toLowerCase(); const payload = command.payload || {}; let result = true;
        if (type === "handshake" || type === "negotiate") result = negotiateLiveProduction(payload);
        else if (type === "ping") { const session = ensureStore().activeLiveProductionSession; if (!session) throw new Error("No Live Production session is active."); session.heartbeatAt = Date.now(); result = { pong: true, at: session.heartbeatAt, protocolVersion: 2 }; }
        else if (type === "startsession") result = ensureStore().activeLiveProductionSession ? negotiateLiveProduction(payload) : startLiveProductionSession(payload);
        else if (type === "stopsession") result = stopLiveProductionSession(payload);
        else if (type === "setswitch") { if (typeof $gameSwitches === "undefined" || !$gameSwitches) throw new Error("Switch state is unavailable."); $gameSwitches.setValue(positiveInteger(payload.id), !!payload.value); }
        else if (type === "setvariable") { if (typeof $gameVariables === "undefined" || !$gameVariables) throw new Error("Variable state is unavailable."); $gameVariables.setValue(positiveInteger(payload.id), deepClone(payload.value)); }
        else if (type === "transfer") { if (typeof $gamePlayer === "undefined" || !$gamePlayer?.reserveTransfer) throw new Error("Player transfer is unavailable."); $gamePlayer.reserveTransfer(positiveInteger(payload.mapId), integer(payload.x), integer(payload.y), integer(payload.direction, 2), integer(payload.fadeType, 0)); }
        else if (type === "runrecipe") result = runWorldRecipe(String(payload.recipeId || ""), payload.context || {}, { dryRun: !!payload.dryRun });
        else if (type === "reloadrecipes") result = loadWorldRecipeCatalog();
        else if (type === "setworldstate") result = setWorldState(String(payload.key || ""), deepClone(payload.value), payload.options || {});
        else if (type === "startrecording") result = startPlaytestRecording(payload);
        else if (type === "stoprecording") result = stopPlaytestRecording(payload);
        else if (type === "snapshot") result = createRecoverySnapshot(String(payload.name || "Live Production snapshot"), { automatic: false });
        else if (type === "pause") { ensureStore().activeLiveProductionSession.paused = true; result = { paused: true }; }
        else if (type === "resume") { ensureStore().activeLiveProductionSession.paused = false; result = { paused: false }; }
        else if (type === "runjourney") result = runPlaytestJourney(payload.scenario || payload.scenarioId, Object.assign({ execute: true }, payload.options || {}));
        else if (type === "runtestsuite") result = runProductionTestSuite(Object.assign({ execute: true }, payload));
        else if (type === "recoverypoint") result = createUniversalRecoveryPoint(String(payload.name || "Live Production restore point"), payload.options || {});
        else if (type === "diagnostics") result = { live: liveProductionState(), performance: performanceCenterReport(payload), compatibility: runCompatibilityProfilesV15({ execute: false }) };
        else throw new Error(`Unsupported Live Production command: ${type || "(missing)"}.`);
        const session = ensureStore().activeLiveProductionSession; if (session) { session.heartbeatAt = Date.now(); session.sequence = integer(session.sequence) + 1; session.commandHistory.push({ id: command.id || null, type, at: Date.now() }); session.commandHistory = session.commandHistory.slice(-100); session.logs.push({ kind: "command", type, at: Date.now(), sequence: session.sequence }); session.logs = session.logs.slice(-200); }
        recordPlaytestAction("live-command", { commandId: command.id, type, payload });
        return result;
    }

    function pumpLiveProductionSession(force = false) {
        liveProductionFrame++;
        let session = ensureStore().activeLiveProductionSession;
        if (!session && (force || liveProductionFrame % 30 === 0) && typeof require === "function" && typeof process !== "undefined" && (typeof Utils === "undefined" || !Utils.isOptionValid || Utils.isOptionValid("test"))) {
            try {
                const fs = require("fs"); const path = require("path"); const commandFile = path.join(process.cwd(), "data", "HybridTileLiveCommands.json");
                if (fs.existsSync(commandFile)) { const stat = fs.statSync(commandFile); if (stat.isFile() && stat.size > 0 && stat.size <= 1024 * 1024) { const value = parseJson(fs.readFileSync(commandFile, "utf8"), {}); const command = normalizeList(value.commands || value).find(item => String(item?.type || "").toLowerCase() === "startsession"); if (command) { startLiveProductionSession(Object.assign({ bridge: true }, command.payload || {})); session = ensureStore().activeLiveProductionSession; if (session) session.handledCommandIds.push(String(command.id || `command-${stableProductionHash(command)}`)); } } }
            } catch (_) { /* The live bridge is optional until Worldstudio requests it. */ }
        }
        if (!session) return false;
        session.heartbeatAt = Date.now();
        if (!force && liveProductionFrame % session.intervalFrames !== 0) return false;
        if (liveProductionBridge) {
            try {
                const fs = liveProductionBridge.fs;
                if (fs.existsSync(liveProductionBridge.commandFile)) {
                    const stat = fs.statSync(liveProductionBridge.commandFile);
                    if (stat.isFile() && stat.size > 0 && stat.size <= 1024 * 1024 && stat.mtimeMs > liveProductionBridge.lastCommandMtime) {
                        const value = parseJson(fs.readFileSync(liveProductionBridge.commandFile, "utf8"), {}); const commands = normalizeList(value.commands || value);
                        for (const command of commands) {
                            const id = String(command?.id || `command-${stableProductionHash(command)}`); if (session.handledCommandIds.includes(id)) continue;
                            try { const result = applyLiveProductionCommand(Object.assign({}, command, { id })); session.lastAck = { id, ok: true, at: Date.now(), pending: !!result?.then }; if (result?.catch) result.catch(error => { session.lastAck = { id, ok: false, at: Date.now(), error: error.message }; writeLiveProductionState(); }); }
                            catch (error) { session.lastAck = { id, ok: false, at: Date.now(), error: String(error.message || error) }; }
                            session.handledCommandIds.push(id); session.handledCommandIds = session.handledCommandIds.slice(-100);
                        }
                        liveProductionBridge.lastCommandMtime = stat.mtimeMs;
                    }
                }
            } catch (error) { session.errors = [...(session.errors || []), String(error.message || error)].slice(-10); }
        }
        writeLiveProductionState(); return true;
    }

    function startPlaytestRecording(options = {}) {
        const store = ensureStore(); if (store.activePlaytestRecordingId) return deepClone(store.playtestRecordings.find(item => item.id === store.activePlaytestRecordingId));
        const recording = { id: String(options.id || `recording-${Date.now()}`), format: "HybridPlaytestRecording", version: 1, pluginVersion: VERSION, name: String(options.name || "Playtest recording"), status: "recording", startedAt: Date.now(), start: liveProductionSnapshot(), events: [], tags: normalizeList(options.tags).map(String) };
        store.playtestRecordings.unshift(recording); store.playtestRecordings = store.playtestRecordings.slice(0, 30); store.activePlaytestRecordingId = recording.id;
        recordPlaytestAction("recording-start", { name: recording.name }); return deepClone(recording);
    }

    function recordPlaytestAction(type, detail = {}) {
        const store = ensureStore(); const id = store.activePlaytestRecordingId; if (!id) return false; const recording = store.playtestRecordings.find(item => item.id === id); if (!recording || recording.status !== "recording") return false;
        const event = { index: recording.events.length, at: Date.now(), frame: typeof Graphics !== "undefined" ? integer(Graphics.frameCount) : 0, type: String(type), mapId: typeof $gameMap !== "undefined" && $gameMap ? integer($gameMap.mapId()) : 0, player: typeof $gamePlayer !== "undefined" && $gamePlayer ? { x: integer($gamePlayer.x), y: integer($gamePlayer.y), direction: integer($gamePlayer.direction?.(), 2) } : null, detail: deepClone(detail) };
        const previous = recording.events.at(-1); if (event.type === "move" && previous?.type === "move" && previous.mapId === event.mapId && previous.player?.x === event.player?.x && previous.player?.y === event.player?.y) return false;
        recording.events.push(event); if (recording.events.length > 5000) recording.events.splice(0, recording.events.length - 5000); return deepClone(event);
    }

    function stopPlaytestRecording(options = {}) {
        const store = ensureStore(); const id = store.activePlaytestRecordingId; if (!id) return false; const recording = store.playtestRecordings.find(item => item.id === id); if (!recording) { store.activePlaytestRecordingId = null; return false; }
        recording.status = "complete"; recording.stoppedAt = Date.now(); recording.reason = String(options.reason || "manual"); recording.end = liveProductionSnapshot(); recording.durationMs = recording.stoppedAt - recording.startedAt; recording.checksum = stableProductionHash({ start: recording.start, events: recording.events, end: recording.end }); store.activePlaytestRecordingId = null;
        if (liveProductionBridge?.recordingFile) { try { atomicWriteLiveJson(liveProductionBridge.recordingFile, recording); } catch (_) {} }
        return deepClone(recording);
    }

    function listPlaytestRecordings() { return (ensureStore().playtestRecordings || []).map(item => ({ id: item.id, name: item.name, status: item.status, startedAt: item.startedAt, stoppedAt: item.stoppedAt || null, events: item.events?.length || 0, checksum: item.checksum || null })); }

    function createScenarioFromRecording(recordingId, options = {}) {
        const store = ensureStore(); const recording = store.playtestRecordings.find(item => item.id === String(recordingId)); if (!recording) throw new Error(`Unknown playtest recording ${recordingId}.`);
        const supported = new Set(["switch", "variable", "transfer", "interaction", "recipe", "live-command"]);
        const scenario = { id: String(options.id || `scenario-${recording.id}`), format: "HybridPlaytestScenario", version: 1, pluginVersion: VERSION, name: String(options.name || recording.name), sourceRecordingId: recording.id, createdAt: Date.now(), setup: { mapId: recording.start?.mapId || 0, player: deepClone(recording.start?.player || null), switches: deepClone(recording.start?.switches || {}), variables: deepClone(recording.start?.variables || {}) }, steps: recording.events.filter(event => supported.has(event.type)).map(event => ({ type: event.type, mapId: event.mapId, player: event.player, detail: deepClone(event.detail) })), assertions: { mapId: recording.end?.mapId || 0, player: deepClone(recording.end?.player || null), switches: deepClone(recording.end?.switches || {}), variables: deepClone(recording.end?.variables || {}) } };
        store.playtestScenarios[scenario.id] = scenario; return deepClone(scenario);
    }

    function listPlaytestScenarios() { return Object.values(ensureStore().playtestScenarios || {}).map(item => ({ id: item.id, name: item.name, createdAt: item.createdAt, steps: item.steps?.length || 0, sourceRecordingId: item.sourceRecordingId })); }

    async function runRecordedScenario(scenarioId, options = {}) {
        const store = ensureStore(); const scenario = store.playtestScenarios[String(scenarioId)] || (typeof scenarioId === "object" ? scenarioId : null); if (!scenario) throw new Error(`Unknown playtest scenario ${scenarioId}.`);
        const execute = options.execute === true; const failures = []; const before = liveProductionSnapshot();
        if (execute) for (const step of scenario.steps || []) {
            if (step.type === "switch" && typeof $gameSwitches !== "undefined") $gameSwitches.setValue(positiveInteger(step.detail.id), !!step.detail.value);
            else if (step.type === "variable" && typeof $gameVariables !== "undefined") $gameVariables.setValue(positiveInteger(step.detail.id), deepClone(step.detail.value));
            else if (step.type === "recipe" && step.detail.recipeId) await runWorldRecipe(step.detail.recipeId, step.detail.context || {}, {});
            else if (step.type === "live-command") await Promise.resolve(applyLiveProductionCommand({ type: step.detail.type, payload: step.detail.payload || {} }));
        }
        const actual = execute ? liveProductionSnapshot() : deepClone(scenario.assertions); const expected = scenario.assertions || {};
        if (integer(actual.mapId) !== integer(expected.mapId)) failures.push({ field: "mapId", expected: expected.mapId, actual: actual.mapId });
        if (expected.player && (integer(actual.player?.x) !== integer(expected.player.x) || integer(actual.player?.y) !== integer(expected.player.y))) failures.push({ field: "player", expected: expected.player, actual: actual.player });
        for (const [id, value] of Object.entries(expected.switches || {})) if (actual.switches?.[id] !== value) failures.push({ field: `switch:${id}`, expected: value, actual: actual.switches?.[id] });
        for (const [id, value] of Object.entries(expected.variables || {})) if (JSON.stringify(actual.variables?.[id]) !== JSON.stringify(value)) failures.push({ field: `variable:${id}`, expected: value, actual: actual.variables?.[id] });
        const run = { id: `scenario-run-${Date.now()}`, scenarioId: scenario.id, name: scenario.name, execute, startedAt: before.capturedAt, completedAt: Date.now(), failures, passed: failures.length === 0 };
        store.scenarioRuns.unshift(run); store.scenarioRuns = store.scenarioRuns.slice(0, 50); return deepClone(run);
    }

    const STANDARD_EVENT_COMMAND_CODES = new Set([0,101,102,103,104,105,108,111,112,113,115,117,118,119,121,122,123,124,125,126,127,128,129,132,133,134,135,136,137,138,201,202,203,204,205,206,211,212,213,214,216,217,221,222,223,224,225,230,231,232,233,234,235,236,241,242,243,244,245,246,249,250,251,261,281,282,283,284,285,301,302,303,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,331,332,333,334,335,336,337,339,340,342,351,352,353,354,355,356,357,401,402,403,404,405,408,411,412,413,601,602,603,604,605,655,657]);

    function validateEventCommandList(commands = [], options = {}) {
        const list = normalizeList(commands); const errors = []; const warnings = []; const stack = [];
        const openerFor = code => code === 111 ? "condition" : code === 112 ? "loop" : code === 102 ? "choice" : "";
        for (let index = 0; index < list.length; index++) {
            const command = list[index] || {}; const code = integer(command.code, -1); const indent = Math.max(0, integer(command.indent));
            if (!Array.isArray(command.parameters)) errors.push({ index, code, message: "Command parameters must be an array." });
            if (!STANDARD_EVENT_COMMAND_CODES.has(code)) warnings.push({ index, code, message: `Unknown command ${code} is preserved as an opaque plugin command.` });
            if (indent > stack.length + 1) warnings.push({ index, code, message: `Indent ${indent} jumps beyond the current branch depth ${stack.length}.` });
            const opener = openerFor(code); if (opener) stack.push({ type: opener, indent, index });
            if (code === 412) { const item = [...stack].reverse().find(value => value.type === "condition"); if (!item) errors.push({ index, code, message: "End Branch has no matching Conditional Branch." }); else stack.splice(stack.indexOf(item), 1); }
            if (code === 413) { const item = [...stack].reverse().find(value => value.type === "loop"); if (!item) errors.push({ index, code, message: "Repeat Above has no matching Loop." }); else stack.splice(stack.indexOf(item), 1); }
            if (code === 404) { const item = [...stack].reverse().find(value => value.type === "choice"); if (!item) errors.push({ index, code, message: "End Choices has no matching Show Choices command." }); else stack.splice(stack.indexOf(item), 1); }
            if (code === 357 && (!command.parameters?.[0] || !command.parameters?.[1])) warnings.push({ index, code, message: "Plugin Command is missing a plugin or command name." });
        }
        if (!list.length || integer(list.at(-1)?.code, -1) !== 0) errors.push({ index: list.length, code: 0, message: "Event command list must end with code 0." });
        for (const item of stack) warnings.push({ index: item.index, message: `${item.type} block does not have an explicit closing command.` });
        return { ok: errors.length === 0, commands: list.length, errors, warnings, unknownCodes: [...new Set(warnings.filter(item => item.code && !STANDARD_EVENT_COMMAND_CODES.has(item.code)).map(item => item.code))], strict: !!options.strict };
    }

    function defineSemanticTileset(definition = {}) {
        const id = positiveInteger(definition.tilesetId || definition.id); const labels = {}; const ranges = [];
        for (const [tileId, value] of Object.entries(definition.labels || definition.tiles || {})) if (/^\d+$/.test(tileId)) labels[integer(tileId)] = normalizeList(value).map(String);
        for (const range of normalizeList(definition.ranges)) { const from = Math.max(0, integer(range.from)); const to = Math.max(from, integer(range.to, from)); ranges.push({ from, to, labels: normalizeList(range.labels || range.label).map(String), passable: range.passable !== false }); }
        const profile = { id: String(definition.id || `tileset-${id}`), tilesetId: id, name: String(definition.name || `Tileset ${id} semantics`), version: integer(definition.version, 1), labels, ranges, updatedAt: Date.now() };
        ensureStore().semanticTilesets[String(id)] = profile; return deepClone(profile);
    }

    function semanticTile(tileId, tilesetId = 0) {
        const profile = ensureStore().semanticTilesets[String(integer(tilesetId || (typeof $dataMap !== "undefined" ? $dataMap?.tilesetId : 0)))] || {}; const labels = normalizeList(profile.labels?.[String(integer(tileId))]); const ranges = normalizeList(profile.ranges).filter(range => integer(tileId) >= range.from && integer(tileId) <= range.to);
        return { tileId: integer(tileId), tilesetId: integer(profile.tilesetId), labels: [...new Set([...labels, ...ranges.flatMap(range => range.labels || [])])], passable: !ranges.some(range => range.passable === false) };
    }

    function listSemanticTilesets() { return Object.values(ensureStore().semanticTilesets || {}).map(item => ({ id: item.id, tilesetId: item.tilesetId, name: item.name, version: item.version, labels: Object.keys(item.labels || {}).length, ranges: item.ranges?.length || 0, updatedAt: item.updatedAt })); }

    function analyzeSemanticMap(snapshot = null, options = {}) {
        const map = snapshot || (typeof $dataMap !== "undefined" ? $dataMap : null); if (!map) throw new Error("A map snapshot is required.");
        const width = positiveInteger(map.width); const height = positiveInteger(map.height); const categories = {}; const blocked = new Set(); const repeated = []; let last = null; let run = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const tileId = integer(map.data[(0 * height + y) * width + x]); const info = semanticTile(tileId, map.tilesetId); for (const label of info.labels) categories[label] = (categories[label] || 0) + 1;
            if (!info.passable || info.labels.some(label => /wall|cliff|water|blocked|void/i.test(label))) blocked.add(`${x},${y}`);
            if (tileId === last) run++; else { if (run >= 12) repeated.push({ tileId: last, length: run }); last = tileId; run = 1; }
        }
        if (run >= 12) repeated.push({ tileId: last, length: run });
        const landmarks = []; for (const event of map.events || []) if (event) { const name = String(event.name || ""); const kind = /door/i.test(name) ? "door" : /stair|ladder/i.test(name) ? "stairs" : /treasure|chest/i.test(name) ? "treasure" : /shop|merchant/i.test(name) ? "shop" : /exit|transfer/i.test(name) ? "exit" : "event"; landmarks.push({ eventId: event.id, name, kind, x: event.x, y: event.y }); }
        const start = landmarks[0] || { x: 0, y: 0 }; const queue = [[integer(start.x), integer(start.y)]]; let queueHead = 0; const reachable = new Set();
        while (queueHead < queue.length) { const [x, y] = queue[queueHead++]; const key = `${x},${y}`; if (x < 0 || y < 0 || x >= width || y >= height || blocked.has(key) || reachable.has(key)) continue; reachable.add(key); queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
        const unreachable = landmarks.filter(item => !reachable.has(`${item.x},${item.y}`)); const issues = unreachable.map(item => ({ severity: "warning", type: "unreachable-landmark", eventId: item.eventId, message: `${item.name || `Event ${item.eventId}`} is not reachable from the semantic start point.` }));
        for (const item of repeated.slice(0, 20)) issues.push({ severity: "info", type: "visual-repetition", tileId: item.tileId, message: `Tile ${item.tileId} repeats for ${item.length} cells.` });
        return { format: "HybridSemanticMapReport", version: 1, pluginVersion: VERSION, mapId: integer(options.mapId || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0)), width, height, categories, landmarks, unreachable, reachableCells: reachable.size, blockedCells: blocked.size, repeated: repeated.slice(0, 50), issues, ok: !issues.some(item => item.severity === "error") };
    }

    function configureExtensionSandbox(extensionId, options = {}) {
        const id = String(extensionId || ""); if (!id) throw new Error("An extension id is required."); const manifest = ensureStore().extensionManifests[id]; if (!manifest) throw new Error(`Extension ${id} is not installed.`);
        const current = ensureStore().extensionSandboxes[id] || {}; const sandbox = Object.assign({}, current, { extensionId: id, enabled: options.enabled !== false, quarantined: options.quarantined === true ? true : options.clearQuarantine ? false : !!current.quarantined, timeBudgetMs: Math.max(1, Math.min(1000, finiteNumber(options.timeBudgetMs, current.timeBudgetMs || 16))), memoryBudgetKb: Math.max(64, Math.min(10240, integer(options.memoryBudgetKb, current.memoryBudgetKb || 1024))), isolation: "same-process-budget", securityBoundary: false, failures: options.clearFailures ? [] : normalizeList(current.failures), updatedAt: Date.now() }); ensureStore().extensionSandboxes[id] = sandbox; return deepClone(sandbox);
    }

    function extensionSandboxState(extensionId = "") { const values = extensionId ? [ensureStore().extensionSandboxes[String(extensionId)]].filter(Boolean) : Object.values(ensureStore().extensionSandboxes || {}); return values.map(deepClone); }

    function runSandboxedExtensionContribution(extensionId, contribution, name, input = {}) {
        const id = String(extensionId); const sandbox = ensureStore().extensionSandboxes[id] || configureExtensionSandbox(id, {}); if (!sandbox.enabled || sandbox.quarantined) throw new Error(`Extension ${id} is ${sandbox.quarantined ? "quarantined" : "disabled"}.`);
        const payloadBytes = JSON.stringify(input || {}).length * 2; if (payloadBytes > sandbox.memoryBudgetKb * 1024) throw new Error(`Extension ${id} input exceeds its memory budget.`);
        const started = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        try {
            let result; if (contribution === "brush") result = runExtensionBrush(name, deepClone(input)); else if (contribution === "generator") result = runExtensionGenerator(name, deepClone(input)); else if (contribution === "validator") { const validator = extensionValidators.get(String(name)); result = validator ? validator(deepClone(input)) : false; } else throw new Error(`Unsupported contribution type ${contribution}.`);
            const elapsedMs = (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - started; if (elapsedMs > sandbox.timeBudgetMs) throw new Error(`Extension exceeded its ${sandbox.timeBudgetMs}ms execution budget (${elapsedMs.toFixed(1)}ms).`);
            sandbox.lastRun = { contribution, name: String(name), elapsedMs, at: Date.now(), ok: true, isolation: "same-process-budget" }; return { ok: true, elapsedMs, isolation: "same-process-budget", securityBoundary: false, result: deepClone(result) };
        } catch (error) {
            sandbox.failures.push({ at: Date.now(), contribution, name: String(name), error: String(error.message || error) }); sandbox.failures = sandbox.failures.slice(-10); if (sandbox.failures.length >= 3) sandbox.quarantined = true; sandbox.lastRun = { contribution, name: String(name), at: Date.now(), ok: false, error: String(error.message || error) }; throw error;
        }
    }

    function unifiedContentIndex() {
        const store = ensureStore(); const items = [];
        for (const recipe of Object.values(store.worldRecipes || {})) items.push({ id: `recipe:${recipe.id}`, type: "recipe", name: recipe.name || recipe.id, tags: recipe.tags || [], source: "project" });
        for (const prefab of listPrefabs()) items.push({ id: `prefab:${prefab.name}`, type: "prefab", name: prefab.name, tags: prefab.tags || [], source: "project" });
        for (const pack of Object.values(store.worldRecipePacks || {})) items.push({ id: `pack:${pack.id}`, type: "world-pack", name: pack.name || pack.id, version: pack.version, tags: pack.capabilities || [], source: "installed" });
        for (const graph of Object.values(store.worldBiomeGraphs || {})) items.push({ id: `graph:${graph.id}`, type: "biome-graph", name: graph.name || graph.id, tags: graph.tags || [], source: "project" });
        for (const brush of Object.values(store.worldRuleBrushes || {})) items.push({ id: `brush:${brush.id}`, type: "rule-brush", name: brush.name || brush.id, tags: brush.tags || [], source: "project" });
        for (const template of Object.values(store.eventTemplates || {})) items.push({ id: `event-template:${template.id || template.name}`, type: "event-template", name: template.name || template.id, tags: template.tags || [], source: "project" });
        for (const catalog of Object.values(store.contentCatalogs || {})) for (const item of normalizeList(catalog.items)) items.push(Object.assign({ id: `catalog:${catalog.id}:${item.id}`, type: item.type || "content", name: item.name || item.id, tags: item.tags || [], source: catalog.name || catalog.id }, deepClone(item)));
        return items;
    }

    function searchUnifiedContent(query = "", options = {}) { const text = String(query).trim().toLowerCase(); const types = new Set(normalizeList(options.types).map(String)); return unifiedContentIndex().filter(item => (!types.size || types.has(item.type)) && (!text || `${item.id} ${item.name} ${(item.tags || []).join(" ")} ${item.source}`.toLowerCase().includes(text))).slice(0, Math.max(1, Math.min(500, integer(options.limit, 100)))).map(deepClone); }

    function createContentCollection(definition = {}) { const id = safeWorldRecipeId(definition.id) || `collection-${Date.now()}`; const known = new Set(unifiedContentIndex().map(item => item.id)); const collection = { id, name: String(definition.name || "Content collection"), description: String(definition.description || ""), itemIds: [...new Set(normalizeList(definition.itemIds).map(String).filter(item => known.has(item)))], tags: normalizeList(definition.tags).map(String), createdAt: ensureStore().contentCollections[id]?.createdAt || Date.now(), updatedAt: Date.now() }; ensureStore().contentCollections[id] = collection; return deepClone(collection); }

    function listContentCollections() { return Object.values(ensureStore().contentCollections || {}).map(deepClone); }

    function createCollaborationBundle(options = {}) {
        const store = ensureStore(); const bundle = { id: String(options.id || `review-bundle-${Date.now()}`), format: "HybridCollaborationBundle", version: 1, pluginVersion: VERSION, name: String(options.name || "World review"), createdAt: new Date().toISOString(), branch: store.activeWorkspaceBranch || "main", mapIds: projectMapIds(options), reviewThreads: deepClone((store.reviewThreads || []).filter(item => options.includeResolved || item.status !== "resolved")), reviewComments: deepClone(store.reviewComments || []), atlas: listWorldAtlases().at(-1) || null, questGraph: listEventQuestGraphs().at(-1) || null, packLock: worldPackLockfile(), deployment: listProjectDeploymentReports()[0] || null, notes: String(options.notes || "") }; bundle.fingerprint = stableProductionHash(bundle); store.collaborationBundles.unshift(deepClone(bundle)); store.collaborationBundles = store.collaborationBundles.slice(0, 20); return bundle;
    }

    function listCollaborationBundles() { return (ensureStore().collaborationBundles || []).map(item => ({ id: item.id, name: item.name, createdAt: item.createdAt, branch: item.branch, reviews: item.reviewThreads?.length || 0, fingerprint: item.fingerprint })); }

    function createReleaseFingerprint(options = {}) {
        const workspace = exportCanonicalWorkspace({ includeHistory: options.includeHistory === true }); const manifest = { id: String(options.id || `release-${Date.now()}`), format: "HybridReleaseFingerprint", version: 1, pluginVersion: VERSION, channel: String(options.channel || "stable"), createdAt: new Date().toISOString(), workspaceHash: stableProductionHash(workspace), packLockHash: stableProductionHash(worldPackLockfile()), recipeHash: stableProductionHash(Object.values(ensureStore().worldRecipes || {})), extensionHash: stableProductionHash(listExtensionManifests()), mapIds: projectMapIds(options) }; manifest.fingerprint = stableProductionHash(manifest); ensureStore().releaseFingerprints.unshift(deepClone(manifest)); ensureStore().releaseFingerprints = ensureStore().releaseFingerprints.slice(0, 30); return manifest;
    }

    function listReleaseFingerprints() { return (ensureStore().releaseFingerprints || []).map(deepClone); }

    function buildCleanProductionBundle(options = {}) {
        const bundle = exportWorkspaceBundle(options); const editorOnly = ["redo", "visualHistory", "validationRuns", "deploymentReports", "benchmarkHistory", "collaborationBundles", "playtestRecordings", "scenarioRuns", "activeLiveProductionSession", "liveProductionSessions"];
        if (bundle.worldDirector) for (const key of editorOnly) delete bundle.worldDirector[key];
        bundle.format = "HybridCleanProductionBundle"; bundle.version = 1; bundle.pluginVersion = VERSION; bundle.createdAt = new Date().toISOString(); bundle.release = createReleaseFingerprint(options); bundle.stripped = editorOnly; return bundle;
    }
