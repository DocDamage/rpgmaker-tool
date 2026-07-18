    // -------------------------------------------------------------------------
    // Engine hooks
    // -------------------------------------------------------------------------

    const aliasSceneMapOnMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function() {
        captureSpawnedRuntimeStates();
        const transferring = !!this._transfer || ($gamePlayer.isTransferring && $gamePlayer.isTransferring());
        const mapId = transferring ? $gamePlayer.newMapId() : $gameMap.mapId();
        prepareDataMapForLoad(mapId);
        if (!transferring) syncSpawnedEventsFromData();
        aliasSceneMapOnMapLoaded.call(this);
        if (!transferring) initializeSpawnTracking();
        if (AUTO_PRELOAD_PREFABS && typeof $gameTemp !== "undefined" && $gameTemp && !$gameTemp._hybridPrefabPreloadStarted) {
            $gameTemp._hybridPrefabPreloadStarted = true;
            Promise.all([preloadPrefabMaps(false), preloadChildMaps(CHILD_MAP_TAG, false)])
                .catch(error => console.warn(`${PLUGIN_NAME}: automatic prefab preload failed.`, error));
        }
    };

    const aliasGameMapSetup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        const previousMapId = this._mapId || 0;
        aliasGameMapSetup.call(this, mapId);
        this._hybridLinkedMapId = null;
        if (runtimeEditorState.active) closeRuntimeEditor();
        initializeSpawnTracking();
        worldRecipeLastPlayerTile = "";
        worldRecipeLastZones = new Set();
        recordPlaytestAction(previousMapId && previousMapId !== integer(mapId) ? "transfer" : "map-enter", { fromMapId: integer(previousMapId), toMapId: integer(mapId) });
        if (AUTO_WORLD_RECIPES) queueWorldRecipeTrigger("mapEnter", { mapId: integer(mapId) });
    };

    const aliasSceneMapWorldRecipeUpdate = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        aliasSceneMapWorldRecipeUpdate.call(this);
        updateWorldRecipeEngine();
        pumpLiveProductionSession();
    };

    if (typeof Game_Switches !== "undefined" && Game_Switches.prototype.setValue) {
        const aliasWorldRecipeSwitchSetValue = Game_Switches.prototype.setValue;
        Game_Switches.prototype.setValue = function(switchId, value) {
            const previous = this.value ? this.value(switchId) : undefined;
            aliasWorldRecipeSwitchSetValue.call(this, switchId, value);
            const next = this.value ? this.value(switchId) : value;
            if (previous !== next) recordPlaytestAction("switch", { id: integer(switchId), previous: deepClone(previous), value: deepClone(next) });
            if (AUTO_WORLD_RECIPES && previous !== next) queueWorldRecipeTrigger("switchChange", { id: integer(switchId), previous, value: next });
        };
    }

    if (typeof Game_Variables !== "undefined" && Game_Variables.prototype.setValue) {
        const aliasWorldRecipeVariableSetValue = Game_Variables.prototype.setValue;
        Game_Variables.prototype.setValue = function(variableId, value) {
            const previous = this.value ? this.value(variableId) : undefined;
            aliasWorldRecipeVariableSetValue.call(this, variableId, value);
            const next = this.value ? this.value(variableId) : value;
            if (JSON.stringify(previous) !== JSON.stringify(next)) recordPlaytestAction("variable", { id: integer(variableId), previous: deepClone(previous), value: deepClone(next) });
            if (AUTO_WORLD_RECIPES && previous !== next) queueWorldRecipeTrigger("variableChange", { id: integer(variableId), previous, value: next });
        };
    }

    if (typeof Game_Player !== "undefined" && Game_Player.prototype.moveStraight) {
        const aliasLiveProductionMoveStraight = Game_Player.prototype.moveStraight;
        Game_Player.prototype.moveStraight = function(direction) {
            const before = { x: integer(this.x), y: integer(this.y) };
            aliasLiveProductionMoveStraight.call(this, direction);
            if (before.x !== integer(this.x) || before.y !== integer(this.y)) recordPlaytestAction("move", { from: before, direction: integer(direction), to: { x: integer(this.x), y: integer(this.y) } });
        };
    }

    if (typeof Game_Player !== "undefined" && Game_Player.prototype.triggerButtonAction) {
        const aliasPlayerTriggerButtonAction = Game_Player.prototype.triggerButtonAction;
        Game_Player.prototype.triggerButtonAction = function() {
            const okTriggered = typeof Input !== "undefined" && Input.isTriggered("ok");
            if (TILE_INFO_ON_OK && okTriggered && Input.isPressed("control")) {
                logTileInfo(this.x, this.y);
            }
            const triggered = aliasPlayerTriggerButtonAction.call(this);
            if (okTriggered) {
                const direction = this.direction ? this.direction() : 2;
                const x = typeof $gameMap?.roundXWithDirection === "function" ? $gameMap.roundXWithDirection(this.x, direction) : this.x;
                const y = typeof $gameMap?.roundYWithDirection === "function" ? $gameMap.roundYWithDirection(this.y, direction) : this.y;
                recordPlaytestAction("interaction", { mapId: $gameMap.mapId(), x, y, direction, triggered: !!triggered });
            }
            if (AUTO_WORLD_RECIPES && okTriggered) {
                const direction = this.direction ? this.direction() : 2;
                const x = typeof $gameMap?.roundXWithDirection === "function" ? $gameMap.roundXWithDirection(this.x, direction) : this.x;
                const y = typeof $gameMap?.roundYWithDirection === "function" ? $gameMap.roundYWithDirection(this.y, direction) : this.y;
                queueWorldRecipeTrigger("interaction", { mapId: $gameMap.mapId(), x, y, direction, triggered: !!triggered });
            }
            if (
                !triggered && okTriggered && COMMON_EVENT_ON_OK > 0 &&
                typeof $gameTemp !== "undefined" && $gameTemp &&
                (!$gameTemp.isCommonEventReserved || !$gameTemp.isCommonEventReserved())
            ) {
                $gameTemp.reserveCommonEvent(COMMON_EVENT_ON_OK);
                return true;
            }
            return triggered;
        };
    }

    const aliasDataManagerMakeSaveContents = DataManager.makeSaveContents;
    const AUTHORING_ONLY_SAVE_KEYS = new Set([
        "authoringLayers", "activeAuthoringLayers", "masks", "modifiers", "changeSets", "projectSnapshots", "mergeHistory",
        "eventTemplates", "recentTiles", "favoriteTiles", "brushPresets", "editorPreferences", "checkpoints", "recovery",
        "bakeBackups", "importHistory", "operationLog", "errorReports", "adapterTestResults", "mapBookmarks", "projectTransactions",
        "activeProjectTransaction", "workspaceBranches", "activeWorkspaceBranch", "reviewComments", "reviewThreads", "wfcDiagnostics",
        "worldRecipeLog", "worldRecipeTests", "worldBiomeCache", "worldDebugger", "worldPackHistory", "recoverySnapshots",
        "contentCatalogs", "catalogSubscriptions", "benchmarkHistory", "worldAtlases", "mapRepairProfiles", "visualHistory",
        "extensionManifests", "extensionPermissions", "packRepositories", "validationRuns", "deploymentReports", "liveProductionSessions",
        "activeLiveProductionSession", "playtestRecordings", "activePlaytestRecordingId", "playtestScenarios", "scenarioRuns",
        "extensionSandboxes", "contentCollections", "collaborationBundles", "releaseFingerprints", "playtestJourneyRuns",
        "productionTestRuns", "universalRecoveryPoints", "projectSearchHistory", "referenceRenamePlans", "passabilityReports",
        "softlockReports", "performanceCenterReports", "extensionSecurityProfiles", "extensionPublishers", "collaborationComparisons",
        "collaborationMergePlans", "compatibilityProfilesV15", "compatibilityProfileRunsV15", "releaseComparisons",
        "releaseManifestsV15", "productionHandoffs", "visualMapDraftsV16", "worldRecipeGraphsV16", "roundTripPlansV16",
        "questProjectsV16", "cutsceneTimelinesV16", "playtestLabRunsV16", "bugReportBundlesV16", "creatorExperienceV16",
        "contentLibraryV16", "projectMergePlansV16", "extensionCapabilityPoliciesV16", "sourceControlSnapshotsV16",
        "productionDashboardsV16", "compatibilityRuns", "assetAuditHistory", "productionPreferences"
    ]);
    function runtimeSavePayload(store = ensureStore()) {
        const payload = deepClone(store);
        for (const key of AUTHORING_ONLY_SAVE_KEYS) delete payload[key];
        payload.version = 18;
        payload.saveProfile = "runtime-lean-v18";
        return payload;
    }
    DataManager.makeSaveContents = function() {
        captureSpawnedRuntimeStates();
        const contents = aliasDataManagerMakeSaveContents.call(this);
        if (contents?.system) {
            const system = Object.assign(Object.create(Object.getPrototypeOf(contents.system)), contents.system);
            system._hybridTileGraft = runtimeSavePayload();
            contents.system = system;
        }
        return contents;
    };

    if (typeof Game_Interpreter !== "undefined" && Game_Interpreter.prototype.executeCommand) {
        const aliasLiveExecuteCommand = Game_Interpreter.prototype.executeCommand;
        Game_Interpreter.prototype.executeCommand = function() {
            const command = this.currentCommand?.();
            if (command && [102, 201, 230, 301, 302, 357].includes(integer(command.code))) recordPlaytestAction("event-command", { eventId: integer(this.eventId?.()), code: integer(command.code), indent: integer(command.indent), parameters: deepClone(command.parameters || []) });
            return aliasLiveExecuteCommand.call(this);
        };
    }

    const aliasTilemapUpdate = Tilemap.prototype.update;
    Tilemap.prototype.update = function() {
        aliasTilemapUpdate.call(this);
        this.animationFrame = Math.floor(this.animationCount / animationFrames());
    };

    const aliasInterpreterUpdateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === "hybridTileGraft") {
            if (this._hybridTileGraftWaiting) return true;
            this._waitMode = "";
            return false;
        }
        return aliasInterpreterUpdateWaitMode.call(this);
    };

    function waitForPromise(interpreter, promise) {
        if (!interpreter || !interpreter.setWaitMode) return promise;
        const context = interpreter._hybridTileGraftCommandContext || null;
        if (context) context.pending = true;
        interpreter._hybridTileGraftWaiting = true;
        interpreter.setWaitMode("hybridTileGraft");
        const handled = Promise.resolve(promise).then(value => {
            if (context) publishPluginCommandResult(context, "succeeded", value);
            return value;
        }).catch(error => {
            const report = captureError(error, { operation: "pluginCommand", command: context?.command || "unknown" });
            if (context) {
                context.errorReportId = report.id;
                publishPluginCommandResult(context, "failed", null, error);
            }
            console.error(error);
            return undefined;
        }).finally(() => {
            interpreter._hybridTileGraftWaiting = false;
            if (interpreter._hybridTileGraftCommandContext === context) delete interpreter._hybridTileGraftCommandContext;
        });
        return handled;
    }

    // -------------------------------------------------------------------------
    // Visual runtime editor
    // -------------------------------------------------------------------------

    const runtimeEditorState = {
        active: false,
        cursorX: 0,
        cursorY: 0,
        layer: "L1",
        tileId: 0,
        mode: "autotile",
        tool: "paint",
        brushSize: 1,
        persist: EDITOR_DEFAULT_PERSIST,
        selectionStart: null,
        selectedPrefab: null,
        selectedEventId: 0,
        rotation: 0,
        mirrorX: false,
        mirrorY: false,
        weightedTiles: [],
        remoteMapId: 0,
        remoteSnapshot: null,
        viewX: 0,
        viewY: 0,
        zoom: 1,
        grid: false,
        overlay: "none",
        layerVisibility: { L1: true, L2: true, L3: true, L4: true, L5: true, L6: true },
        layerLocks: { L1: false, L2: false, L3: false, L4: false, L5: false, L6: false },
        layerOpacity: { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 1 },
        selectionRect: null,
        brushPreset: "",
        studio: false,
        previousDisplayX: 0,
        previousDisplayY: 0,
        lastDragKey: "",
        message: "",
        pending: false
    };

    function runtimeEditorAvailable() {
        return ENABLE_RUNTIME_EDITOR && typeof Window_Base !== "undefined" &&
            typeof Window_Command !== "undefined" && typeof Window_Selectable !== "undefined" &&
            typeof Rectangle !== "undefined" && typeof Sprite !== "undefined" && typeof Bitmap !== "undefined";
    }

    function runtimeEditorAllowed() {
        if (!runtimeEditorAvailable()) return false;
        if (!EDITOR_PLAYTEST_ONLY) return true;
        return typeof Utils !== "undefined" && Utils.isOptionValid && Utils.isOptionValid("test");
    }

    function editorValueLabel(value = runtimeEditorState.tileId, layer = runtimeEditorState.layer) {
        const key = normalizeLayer(layer);
        if (key === "L5") return `shadow ${integer(value)}`;
        if (key === "L6") return `region ${integer(value)}`;
        return `${integer(value)} / ${tileCodeFromId(value) || "n/a"}`;
    }

    function recordRecentTile(tileId, layer = "L1") {
        if (LAYER_INDEX[normalizeLayer(layer)] > 3) return;
        const id = integer(tileId);
        const recent = ensureStore().recentTiles.filter(value => value !== id);
        recent.unshift(id);
        ensureStore().recentTiles = recent.slice(0, 64);
    }

    function favoriteTile(tileId, favorite = true) {
        const key = String(integer(tileId));
        if (favorite !== false) ensureStore().favoriteTiles[key] = true;
        else delete ensureStore().favoriteTiles[key];
        return true;
    }

    function editorPreferences() {
        return deepClone(ensureStore().editorPreferences);
    }

    function setEditorPreference(name, value) {
        const preferences = ensureStore().editorPreferences;
        if (name === "zoom") preferences.zoom = Math.max(0.25, Math.min(4, finiteNumber(value, 1)));
        else if (name === "grid") preferences.grid = toBoolean(value, false);
        else if (name === "overlay") preferences.overlay = String(value || "none").toLowerCase();
        else preferences[String(name)] = deepClone(value);
        return deepClone(preferences[name]);
    }

    function saveBrushPreset(name, settings = {}) {
        const label = String(name || "").trim();
        if (!label) return false;
        ensureStore().brushPresets[label.toLowerCase()] = Object.assign({
            name: label,
            createdAt: Date.now()
        }, deepClone(settings));
        return deepClone(ensureStore().brushPresets[label.toLowerCase()]);
    }

    function captureBrushPreset(name) {
        return saveBrushPreset(name, {
            tool: runtimeEditorState.tool,
            layer: runtimeEditorState.layer,
            tileId: runtimeEditorState.tileId,
            mode: runtimeEditorState.mode,
            brushSize: runtimeEditorState.brushSize,
            weightedTiles: deepClone(runtimeEditorState.weightedTiles),
            rotation: runtimeEditorState.rotation,
            mirrorX: runtimeEditorState.mirrorX,
            mirrorY: runtimeEditorState.mirrorY
        });
    }

    function listBrushPresets() {
        return Object.values(ensureStore().brushPresets || {}).sort((a, b) => a.name.localeCompare(b.name)).map(deepClone);
    }

    function applyBrushPreset(name, scene = SceneManager._scene) {
        const preset = ensureStore().brushPresets[String(name || "").toLowerCase()];
        if (!preset) return false;
        for (const field of ["tool", "layer", "tileId", "mode", "brushSize", "weightedTiles", "rotation", "mirrorX", "mirrorY"]) {
            if (preset[field] !== undefined) runtimeEditorState[field] = deepClone(preset[field]);
        }
        runtimeEditorState.brushPreset = preset.name;
        editorSetMessage(`Brush preset: ${preset.name}.`, scene);
        return true;
    }

    function deleteBrushPreset(name) {
        const key = String(name || "").toLowerCase();
        if (!ensureStore().brushPresets[key]) return false;
        delete ensureStore().brushPresets[key];
        return true;
    }

    function setEditorKeyBinding(symbol, keyCode, gamepadButton = null) {
        const preferences = ensureStore().editorPreferences;
        const key = String(symbol || "").trim();
        if (!key) return false;
        if (keyCode !== null && keyCode !== undefined) {
            const code = integer(keyCode);
            preferences.keyBindings[key] = code;
            if (typeof Input !== "undefined" && Input.keyMapper) Input.keyMapper[code] = key;
        }
        if (gamepadButton !== null && gamepadButton !== undefined) {
            const button = integer(gamepadButton);
            preferences.gamepadBindings[key] = button;
            if (typeof Input !== "undefined" && Input.gamepadMapper) Input.gamepadMapper[button] = key;
        }
        return { symbol: key, keyCode: preferences.keyBindings[key], gamepadButton: preferences.gamepadBindings[key] };
    }

    function addMapBookmark(mapId, x, y, name = "Bookmark") {
        const bookmark = { mapId: positiveInteger(mapId), x: integer(x), y: integer(y), name: String(name), createdAt: Date.now() };
        ensureStore().mapBookmarks.unshift(bookmark);
        ensureStore().mapBookmarks = ensureStore().mapBookmarks.slice(0, 100);
        return deepClone(bookmark);
    }

    function listMapBookmarks(mapId = 0) {
        const id = integer(mapId, 0);
        return deepClone((ensureStore().mapBookmarks || []).filter(item => !id || item.mapId === id));
    }

    function removeMapBookmark(index) {
        const position = integer(index, -1);
        if (position < 0 || position >= ensureStore().mapBookmarks.length) return false;
        return ensureStore().mapBookmarks.splice(position, 1)[0];
    }

    function runtimeEditorSnapshot() {
        return {
            active: runtimeEditorState.active,
            cursorX: runtimeEditorState.cursorX,
            cursorY: runtimeEditorState.cursorY,
            layer: runtimeEditorState.layer,
            tileId: runtimeEditorState.tileId,
            tileCode: LAYER_INDEX[runtimeEditorState.layer] <= 3 ? tileCodeFromId(runtimeEditorState.tileId) : "",
            mode: runtimeEditorState.mode,
            tool: runtimeEditorState.tool,
            brushSize: runtimeEditorState.brushSize,
            persist: runtimeEditorState.persist,
            selectionStart: runtimeEditorState.selectionStart ? Object.assign({}, runtimeEditorState.selectionStart) : null,
            selectedPrefab: runtimeEditorState.selectedPrefab ? deepClone(runtimeEditorState.selectedPrefab) : null,
            selectedEventId: runtimeEditorState.selectedEventId,
            rotation: runtimeEditorState.rotation,
            mirrorX: runtimeEditorState.mirrorX,
            mirrorY: runtimeEditorState.mirrorY,
            remoteMapId: runtimeEditorState.remoteMapId,
            zoom: runtimeEditorState.zoom,
            grid: runtimeEditorState.grid,
            overlay: runtimeEditorState.overlay,
            layerVisibility: deepClone(runtimeEditorState.layerVisibility),
            layerLocks: deepClone(runtimeEditorState.layerLocks),
            layerOpacity: deepClone(runtimeEditorState.layerOpacity),
            selectionRect: deepClone(runtimeEditorState.selectionRect),
            brushPreset: runtimeEditorState.brushPreset,
            studio: runtimeEditorState.studio,
            transaction: editTransactionState(),
            hasClipboard: !!runtimeClipboard,
            pending: runtimeEditorState.pending,
            message: runtimeEditorState.message
        };
    }

    function initializeRuntimeEditorState(options = {}) {
        const preferences = ensureStore().editorPreferences;
        runtimeEditorState.cursorX = Math.max(0, Math.min(editorMapWidth() - 1,
            integer(options.x, $gamePlayer ? $gamePlayer.x : 0)));
        runtimeEditorState.cursorY = Math.max(0, Math.min(editorMapHeight() - 1,
            integer(options.y, $gamePlayer ? $gamePlayer.y : 0)));
        runtimeEditorState.layer = normalizeLayer(options.layer || runtimeEditorState.layer || "L1");
        const requestedTile = options.tileId === undefined ? runtimeEditorState.tileId : parseTileId(options.tileId);
        if (requestedTile !== null && validateLayerValue(requestedTile, runtimeEditorState.layer, editorTilesetId())) {
            runtimeEditorState.tileId = requestedTile;
        }
        runtimeEditorState.mode = normalizeMode(options.mode || runtimeEditorState.mode, "autotile");
        runtimeEditorState.tool = String(options.tool || runtimeEditorState.tool || "paint").toLowerCase();
        runtimeEditorState.brushSize = Math.max(1, Math.min(16, integer(options.brushSize, runtimeEditorState.brushSize || 1)));
        runtimeEditorState.persist = options.persist === undefined
            ? runtimeEditorState.persist
            : toBoolean(options.persist, EDITOR_DEFAULT_PERSIST);
        runtimeEditorState.selectionStart = null;
        runtimeEditorState.selectionRect = null;
        runtimeEditorState.selectedEventId = 0;
        runtimeEditorState.rotation = 0;
        runtimeEditorState.mirrorX = false;
        runtimeEditorState.mirrorY = false;
        runtimeEditorState.zoom = Math.max(0.25, Math.min(4, finiteNumber(options.zoom, preferences.zoom || 1)));
        runtimeEditorState.grid = options.grid === undefined ? !!preferences.grid : toBoolean(options.grid, false);
        runtimeEditorState.overlay = String(options.overlay || preferences.overlay || "none").toLowerCase();
        runtimeEditorState.layerVisibility = Object.assign({}, preferences.layerVisibility);
        runtimeEditorState.layerLocks = Object.assign({}, preferences.layerLocks);
        runtimeEditorState.layerOpacity = Object.assign({}, preferences.layerOpacity);
        runtimeEditorState.studio = toBoolean(options.studio, false);
        const columns = Math.max(1, Math.floor(Graphics.boxWidth / ($gameMap.tileWidth() * runtimeEditorState.zoom)));
        const rows = Math.max(1, Math.floor(Graphics.boxHeight / ($gameMap.tileHeight() * runtimeEditorState.zoom)));
        runtimeEditorState.viewX = Math.max(0, Math.min(runtimeEditorState.cursorX - Math.floor(columns / 2), Math.max(0, editorMapWidth() - columns)));
        runtimeEditorState.viewY = Math.max(0, Math.min(runtimeEditorState.cursorY - Math.floor(rows / 2), Math.max(0, editorMapHeight() - rows)));
        runtimeEditorState.lastDragKey = "";
        runtimeEditorState.message = "Editor ready.";
        runtimeEditorState.pending = false;
    }

    function openRuntimeEditor(options = {}) {
        if (!runtimeEditorAllowed()) {
            console.warn(`${PLUGIN_NAME}: runtime editor is disabled or restricted to playtest mode.`);
            return false;
        }
        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map) || !scene.openHybridTileEditor) return false;
        if (runtimeEditorState.active) closeRuntimeEditor(runtimeEditorState.persist);
        if (activeEditTransaction && activeEditTransaction.mapId !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: another map already has an active edit transaction.`);
            return false;
        }
        runtimeEditorState.remoteMapId = 0;
        runtimeEditorState.remoteSnapshot = null;
        runtimeEditorState.previousDisplayX = $gameMap.displayX ? $gameMap.displayX() : 0;
        runtimeEditorState.previousDisplayY = $gameMap.displayY ? $gameMap.displayY() : 0;
        if (ensureStore().recovery[String($gameMap.mapId())]) recoverEditTransaction($gameMap.mapId());
        if (!activeEditTransaction) beginEditTransaction(options.sessionName || "Runtime Editor", $gameMap.mapId());
        initializeRuntimeEditorState(options);
        const opened = scene.openHybridTileEditor();
        if (opened) editorApplyViewport(scene);
        if (opened && toBoolean(options.openPrefabBrowser, false) && scene.openHybridPrefabBrowser) {
            scene.openHybridPrefabBrowser();
        }
        return opened;
    }

    function editorMapId() {
        return runtimeEditorState.remoteMapId || $gameMap.mapId();
    }

    function editorMapData() {
        return runtimeEditorState.remoteSnapshot || $dataMap;
    }

    function editorLayerData(layer, source = editorMapData()) {
        if (!source || !Array.isArray(source.data)) return [];
        const z = LAYER_INDEX[normalizeLayer(layer)];
        const output = new Array(source.width * source.height * 6).fill(0);
        if (z < 0 || z > 5) return output;
        const area = source.width * source.height;
        const offset = z * area;
        for (let index = 0; index < area; index++) output[offset + index] = source.data[offset + index] || 0;
        return output;
    }

    function editorLayerPreviewRequired() {
        for (const layer of ["L1", "L2", "L3", "L4", "L5"]) {
            if (runtimeEditorState.layerVisibility[layer] === false) return true;
            if (Math.abs(finiteNumber(runtimeEditorState.layerOpacity[layer], 1) - 1) > 0.001) return true;
        }
        return false;
    }

    function snapshotPassable(snapshot, x, y, direction) {
        if (!snapshot) return false;
        const tileset = typeof $dataTilesets !== "undefined" && $dataTilesets ? $dataTilesets[snapshot.tilesetId] : null;
        const flags = tileset && tileset.flags || [];
        const bit = (1 << Math.max(0, integer(direction / 2) - 1)) & 0x0f;
        for (let z = 3; z >= 0; z--) {
            const flag = flags[readTile(snapshot.data, snapshot.width, snapshot.height, x, y, z)] || 0;
            if ((flag & 0x10) !== 0) continue;
            if ((flag & bit) === 0) return true;
            if ((flag & bit) === bit) return false;
        }
        return false;
    }

    function editorMapWidth() {
        const data = editorMapData();
        return data ? data.width : 1;
    }

    function editorMapHeight() {
        const data = editorMapData();
        return data ? data.height : 1;
    }

    function editorTilesetId() {
        const data = editorMapData();
        return data ? data.tilesetId : $dataMap.tilesetId;
    }

    function openRemoteMapEditor(map, options = {}) {
        if (!runtimeEditorAllowed()) return Promise.resolve(false);
        const mapId = resolveMapId(map);
        if (mapId <= 0) return Promise.resolve(false);
        if (mapId === $gameMap.mapId()) return Promise.resolve(openRuntimeEditor(options));
        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map) || !scene.openHybridTileEditor) return Promise.resolve(false);
        if (runtimeEditorState.active) closeRuntimeEditor(runtimeEditorState.persist);
        if (activeEditTransaction && activeEditTransaction.mapId !== mapId) {
            console.warn(`${PLUGIN_NAME}: another map already has an active edit transaction.`);
            return Promise.resolve(false);
        }
        return preloadMap(mapId, toBoolean(options.forceRefresh, false)).then(snapshot => {
            runtimeEditorState.remoteMapId = mapId;
            runtimeEditorState.remoteSnapshot = snapshot;
            runtimeEditorState.previousDisplayX = $gameMap.displayX ? $gameMap.displayX() : 0;
            runtimeEditorState.previousDisplayY = $gameMap.displayY ? $gameMap.displayY() : 0;
            if (ensureStore().recovery[String(mapId)]) recoverEditTransaction(mapId);
            if (!activeEditTransaction) beginEditTransaction(options.sessionName || `Remote Map ${mapId}`, mapId);
            initializeRuntimeEditorState(Object.assign({ x: 0, y: 0 }, options));
            const opened = scene.openHybridTileEditor();
            if (opened && scene.showHybridRemoteMap) scene.showHybridRemoteMap(snapshot);
            if (opened) editorApplyViewport(scene);
            return opened;
        });
    }

    function closeRuntimeEditor(commit = runtimeEditorState.persist) {
        const scene = SceneManager._scene;
        if (scene instanceof Scene_Map && scene.closeHybridTileEditor) return scene.closeHybridTileEditor(commit);
        if (activeEditTransaction) commit ? commitEditTransaction(true) : cancelEditTransaction();
        runtimeEditorState.active = false;
        runtimeEditorState.selectionStart = null;
        runtimeEditorState.remoteMapId = 0;
        runtimeEditorState.remoteSnapshot = null;
        return true;
    }

    function toggleRuntimeEditor(options = {}) {
        return runtimeEditorState.active ? closeRuntimeEditor() : openRuntimeEditor(options);
    }

    function editorSelectionRect() {
        const start = runtimeEditorState.selectionStart;
        if (!start) return null;
        const x1 = Math.min(start.x, runtimeEditorState.cursorX);
        const y1 = Math.min(start.y, runtimeEditorState.cursorY);
        const x2 = Math.max(start.x, runtimeEditorState.cursorX);
        const y2 = Math.max(start.y, runtimeEditorState.cursorY);
        return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
    }

    function editorFootprint() {
        const selection = editorSelectionRect();
        if (selection) return selection;
        if (runtimeEditorState.selectionRect) return runtimeEditorState.selectionRect;
        if (runtimeEditorState.tool === "prefab" && runtimeEditorState.selectedPrefab) {
            const swap = runtimeEditorState.rotation === 90 || runtimeEditorState.rotation === 270;
            return {
                x: runtimeEditorState.cursorX,
                y: runtimeEditorState.cursorY,
                w: swap ? runtimeEditorState.selectedPrefab.h : runtimeEditorState.selectedPrefab.w,
                h: swap ? runtimeEditorState.selectedPrefab.w : runtimeEditorState.selectedPrefab.h
            };
        }
        if (runtimeEditorState.tool === "paste" && runtimeClipboard) {
            const transformed = transformClipboard(runtimeClipboard, runtimeEditorState);
            return {
                x: runtimeEditorState.cursorX,
                y: runtimeEditorState.cursorY,
                w: transformed.width,
                h: transformed.height
            };
        }
        return {
            x: runtimeEditorState.cursorX,
            y: runtimeEditorState.cursorY,
            w: runtimeEditorState.brushSize,
            h: runtimeEditorState.brushSize
        };
    }

    function editorRefresh(scene = SceneManager._scene) {
        if (!(scene instanceof Scene_Map)) return;
        if (scene._hybridEditorStatus) scene._hybridEditorStatus.refresh();
        if (scene._hybridEditorCursor) scene._hybridEditorCursor.refresh();
        if (scene._hybridEditorEventLabels) scene._hybridEditorEventLabels.refresh();
        if (runtimeEditorState.remoteMapId && scene.refreshHybridRemoteMap) scene.refreshHybridRemoteMap();
        if (scene.refreshHybridLayerPreview) scene.refreshHybridLayerPreview();
        if (scene._hybridEditorOverlay) scene._hybridEditorOverlay.refresh();
        if (scene._hybridEditorMinimap) scene._hybridEditorMinimap.refresh();
        if (scene._hybridEditorGhost) scene._hybridEditorGhost.refresh();
    }

    function editorTileWidth() { return $gameMap.tileWidth() * runtimeEditorState.zoom; }
    function editorTileHeight() { return $gameMap.tileHeight() * runtimeEditorState.zoom; }

    function editorScreenX(mapX) {
        if (runtimeEditorState.remoteMapId) return (mapX - runtimeEditorState.viewX) * editorTileWidth();
        return $gameMap.adjustX ? $gameMap.adjustX(mapX) * editorTileWidth()
            : (mapX - runtimeEditorState.viewX) * editorTileWidth();
    }

    function editorScreenY(mapY) {
        if (runtimeEditorState.remoteMapId) return (mapY - runtimeEditorState.viewY) * editorTileHeight();
        return $gameMap.adjustY ? $gameMap.adjustY(mapY) * editorTileHeight()
            : (mapY - runtimeEditorState.viewY) * editorTileHeight();
    }

    function editorApplyViewport(scene = SceneManager._scene) {
        if (!(scene instanceof Scene_Map)) return false;
        if (!runtimeEditorState.remoteMapId && $gameMap.setDisplayPos) {
            $gameMap.setDisplayPos(runtimeEditorState.viewX, runtimeEditorState.viewY);
        }
        if (scene._spriteset && scene._spriteset.scale && !runtimeEditorState.remoteMapId) {
            scene._spriteset.scale.x = runtimeEditorState.zoom;
            scene._spriteset.scale.y = runtimeEditorState.zoom;
        }
        if (scene._hybridRemoteTilemap && scene._hybridRemoteTilemap.scale) {
            scene._hybridRemoteTilemap.scale.x = runtimeEditorState.zoom;
            scene._hybridRemoteTilemap.scale.y = runtimeEditorState.zoom;
        }
        editorRefresh(scene);
        return true;
    }

    function setEditorZoom(value, scene = SceneManager._scene) {
        runtimeEditorState.zoom = Math.max(0.25, Math.min(4, finiteNumber(value, 1)));
        ensureStore().editorPreferences.zoom = runtimeEditorState.zoom;
        const columns = Math.max(1, Math.floor(Graphics.boxWidth / editorTileWidth()));
        const rows = Math.max(1, Math.floor(Graphics.boxHeight / editorTileHeight()));
        runtimeEditorState.viewX = Math.max(0, Math.min(runtimeEditorState.viewX, Math.max(0, editorMapWidth() - columns)));
        runtimeEditorState.viewY = Math.max(0, Math.min(runtimeEditorState.viewY, Math.max(0, editorMapHeight() - rows)));
        editorApplyViewport(scene);
        return runtimeEditorState.zoom;
    }

    function setEditorLayerState(layer, options = {}, scene = SceneManager._scene) {
        const key = normalizeLayer(layer);
        if (options.visible !== undefined) runtimeEditorState.layerVisibility[key] = toBoolean(options.visible, true);
        if (options.locked !== undefined) runtimeEditorState.layerLocks[key] = toBoolean(options.locked, false);
        if (options.opacity !== undefined) runtimeEditorState.layerOpacity[key] = Math.max(0, Math.min(1, finiteNumber(options.opacity, 1)));
        const preferences = ensureStore().editorPreferences;
        preferences.layerVisibility[key] = runtimeEditorState.layerVisibility[key];
        preferences.layerLocks[key] = runtimeEditorState.layerLocks[key];
        preferences.layerOpacity[key] = runtimeEditorState.layerOpacity[key];
        editorRefresh(scene);
        return { layer: key, visible: runtimeEditorState.layerVisibility[key],
            locked: runtimeEditorState.layerLocks[key], opacity: runtimeEditorState.layerOpacity[key] };
    }

    function isolateEditorLayer(layer, scene = SceneManager._scene) {
        const selected = normalizeLayer(layer);
        for (const key of Object.keys(LAYER_INDEX)) runtimeEditorState.layerVisibility[key] = key === selected;
        Object.assign(ensureStore().editorPreferences.layerVisibility, runtimeEditorState.layerVisibility);
        editorRefresh(scene);
        return deepClone(runtimeEditorState.layerVisibility);
    }

    function showAllEditorLayers(scene = SceneManager._scene) {
        for (const key of Object.keys(LAYER_INDEX)) runtimeEditorState.layerVisibility[key] = true;
        Object.assign(ensureStore().editorPreferences.layerVisibility, runtimeEditorState.layerVisibility);
        editorRefresh(scene);
        return true;
    }

    function setEditorOverlay(name, scene = SceneManager._scene) {
        const allowed = ["none", "region", "shadow", "terrain", "collision", "passability", "changes", "grid"];
        const value = String(name || "none").toLowerCase();
        runtimeEditorState.overlay = allowed.includes(value) ? value : "none";
        ensureStore().editorPreferences.overlay = runtimeEditorState.overlay;
        editorRefresh(scene);
        return runtimeEditorState.overlay;
    }

    function refreshRemoteEditorFromHistory(scene = SceneManager._scene) {
        const mapId = runtimeEditorState.remoteMapId;
        const pristine = mapId ? pristineCache.get(mapId) : null;
        if (!mapId || !pristine) return false;
        runtimeEditorState.remoteSnapshot = buildComposedSnapshot(mapId, pristine);
        if (scene && scene.showHybridRemoteMap) scene.showHybridRemoteMap(runtimeEditorState.remoteSnapshot);
        editorRefresh(scene);
        return true;
    }

    function editorUndo(scene = SceneManager._scene) {
        const result = undoTransactionChange();
        if (result && runtimeEditorState.remoteMapId) refreshRemoteEditorFromHistory(scene);
        return result;
    }

    function editorRedo(scene = SceneManager._scene) {
        const result = redoTransactionChange();
        if (result && runtimeEditorState.remoteMapId) refreshRemoteEditorFromHistory(scene);
        return result;
    }

    function editorSetMessage(message, scene = SceneManager._scene) {
        runtimeEditorState.message = String(message || "");
        editorRefresh(scene);
    }

    function editorSetTool(tool, scene = SceneManager._scene) {
        runtimeEditorState.tool = String(tool || "paint").toLowerCase();
        runtimeEditorState.selectionStart = null;
        runtimeEditorState.selectionRect = null;
        runtimeEditorState.selectedEventId = 0;
        if (runtimeEditorState.tool !== "prefab") runtimeEditorState.selectedPrefab = null;
        editorSetMessage(`Tool: ${runtimeEditorState.tool}.`, scene);
    }

    function editorMoveCursor(dx, dy, scene = SceneManager._scene) {
        const step = typeof Input !== "undefined" && Input.isPressed("shift") ? 5 : 1;
        runtimeEditorState.cursorX = Math.max(0, Math.min(editorMapWidth() - 1, runtimeEditorState.cursorX + integer(dx) * step));
        runtimeEditorState.cursorY = Math.max(0, Math.min(editorMapHeight() - 1, runtimeEditorState.cursorY + integer(dy) * step));
        const visibleColumns = Math.max(1, Math.floor(Graphics.boxWidth / editorTileWidth()));
        const visibleRows = Math.max(1, Math.floor(Graphics.boxHeight / editorTileHeight()));
        if (runtimeEditorState.cursorX < runtimeEditorState.viewX) runtimeEditorState.viewX = runtimeEditorState.cursorX;
        if (runtimeEditorState.cursorY < runtimeEditorState.viewY) runtimeEditorState.viewY = runtimeEditorState.cursorY;
        if (runtimeEditorState.cursorX >= runtimeEditorState.viewX + visibleColumns) runtimeEditorState.viewX = runtimeEditorState.cursorX - visibleColumns + 1;
        if (runtimeEditorState.cursorY >= runtimeEditorState.viewY + visibleRows) runtimeEditorState.viewY = runtimeEditorState.cursorY - visibleRows + 1;
        editorApplyViewport(scene);
    }

    function editorEyedropper(scene = SceneManager._scene) {
        const data = editorMapData();
        runtimeEditorState.tileId = readTile(data.data, data.width, data.height,
            runtimeEditorState.cursorX, runtimeEditorState.cursorY, LAYER_INDEX[runtimeEditorState.layer]);
        recordRecentTile(runtimeEditorState.tileId, runtimeEditorState.layer);
        runtimeEditorState.tool = "paint";
        editorSetMessage(`Picked ${editorValueLabel()}.`, scene);
        return runtimeEditorState.tileId;
    }

    function editorPromptTile(scene = SceneManager._scene) {
        if (typeof window === "undefined" || typeof window.prompt !== "function") {
            editorSetMessage("Tile-code prompt is unavailable in this runtime.", scene);
            return false;
        }
        const visualLayer = LAYER_INDEX[runtimeEditorState.layer] <= 3;
        const current = visualLayer
            ? (tileCodeFromId(runtimeEditorState.tileId) || String(runtimeEditorState.tileId))
            : String(runtimeEditorState.tileId);
        const promptText = runtimeEditorState.layer === "L5"
            ? "Shadow bits (0-15)"
            : runtimeEditorState.layer === "L6"
                ? "Region ID (0-255)"
                : "Tile ID or code (examples: A0,0 or B2,1)";
        const value = window.prompt(promptText, current);
        if (value === null) return false;
        const tileId = parseTileId(value);
        if (tileId === null || !validateLayerValue(tileId, runtimeEditorState.layer, editorTilesetId())) {
            editorSetMessage("Invalid tile value for the selected layer.", scene);
            return false;
        }
        runtimeEditorState.tileId = tileId;
        recordRecentTile(tileId, runtimeEditorState.layer);
        runtimeEditorState.tool = "paint";
        editorSetMessage(`Brush value: ${editorValueLabel(tileId, runtimeEditorState.layer)}.`, scene);
        return true;
    }

    function editorPromptBrushSize(scene = SceneManager._scene) {
        if (typeof window === "undefined" || typeof window.prompt !== "function") return false;
        const value = window.prompt("Square brush size (1-16)", String(runtimeEditorState.brushSize));
        if (value === null) return false;
        runtimeEditorState.brushSize = Math.max(1, Math.min(16, integer(value, 1)));
        editorSetMessage(`Brush size: ${runtimeEditorState.brushSize}.`, scene);
        return true;
    }

    function editorPromptWeightedTiles(scene = SceneManager._scene) {
        if (typeof window === "undefined" || typeof window.prompt !== "function") return false;
        const example = JSON.stringify([{ tileId: tileCodeFromId(runtimeEditorState.tileId) || runtimeEditorState.tileId, weight: 1 }]);
        const value = window.prompt("Weighted tile JSON, e.g. [{\"tileId\":\"B2,1\",\"weight\":3}]", example);
        if (value === null) return false;
        const entries = normalizeWeightedTiles(value, runtimeEditorState.layer, editorTilesetId());
        if (!entries.length) {
            editorSetMessage("No valid weighted tiles were supplied.", scene);
            return false;
        }
        runtimeEditorState.weightedTiles = entries;
        runtimeEditorState.tool = "random";
        editorSetMessage(`Random brush: ${entries.length} weighted tiles.`, scene);
        return true;
    }

    function editorApplySelectionTool(scene) {
        if (runtimeEditorState.remoteMapId) return editorApplyRemoteSelectionTool(scene);
        if (!runtimeEditorState.selectionStart) {
            runtimeEditorState.selectionStart = { x: runtimeEditorState.cursorX, y: runtimeEditorState.cursorY };
            editorSetMessage("First corner set. Move and confirm the opposite corner.", scene);
            return true;
        }
        const rect = editorSelectionRect();
        if (runtimeEditorState.tool === "rectangle") {
            fillTiles(rect.x, rect.y, rect.w, rect.h, runtimeEditorState.layer, runtimeEditorState.tileId,
                true, { mode: runtimeEditorState.mode });
            editorSetMessage(`Filled ${rect.w}×${rect.h} rectangle.`, scene);
        } else if (runtimeEditorState.tool === "outline") {
            drawRectangleOutline(rect.x, rect.y, rect.w, rect.h, runtimeEditorState.layer,
                runtimeEditorState.tileId, true, { mode: runtimeEditorState.mode });
            editorSetMessage(`Outlined ${rect.w}×${rect.h} rectangle.`, scene);
        } else if (runtimeEditorState.tool === "line") {
            drawLine(runtimeEditorState.selectionStart.x, runtimeEditorState.selectionStart.y,
                runtimeEditorState.cursorX, runtimeEditorState.cursorY, runtimeEditorState.layer,
                runtimeEditorState.tileId, true, { mode: runtimeEditorState.mode });
            editorSetMessage("Line drawn.", scene);
        } else if (runtimeEditorState.tool === "circle") {
            const dx = Math.abs(runtimeEditorState.cursorX - runtimeEditorState.selectionStart.x);
            const dy = Math.abs(runtimeEditorState.cursorY - runtimeEditorState.selectionStart.y);
            drawCircle(runtimeEditorState.selectionStart.x, runtimeEditorState.selectionStart.y,
                Math.max(dx, dy), runtimeEditorState.layer, runtimeEditorState.tileId, true,
                { mode: runtimeEditorState.mode, filled: false });
            editorSetMessage(`Circle radius ${Math.max(dx, dy)} drawn.`, scene);
        } else if (runtimeEditorState.tool === "randomRectangle") {
            randomFill(rect.x, rect.y, rect.w, rect.h, runtimeEditorState.layer,
                runtimeEditorState.weightedTiles, true, { mode: runtimeEditorState.mode });
            editorSetMessage(`Random-filled ${rect.w}×${rect.h}.`, scene);
        } else if (runtimeEditorState.tool === "select") {
            runtimeEditorState.selectionRect = deepClone(rect);
            editorSetMessage(`Selected ${rect.w}×${rect.h}. Open tools for cut, delete, rotate, or copy.`, scene);
        } else if (runtimeEditorState.tool === "copy") {
            copyArea(rect.x, rect.y, rect.w, rect.h, "L1,L2,L3,L4,L5,L6,L7", true);
            runtimeEditorState.tool = "paste";
            editorSetMessage(`Copied ${rect.w}×${rect.h}; Paste tool selected.`, scene);
        } else if (runtimeEditorState.tool === "capturePrefab") {
            if (typeof window === "undefined" || typeof window.prompt !== "function") return false;
            const name = window.prompt("Prefab name", `Prefab_${Date.now()}`);
            if (!name) return false;
            const category = window.prompt("Prefab category", "General") || "General";
            capturePrefab(name, rect.x, rect.y, rect.w, rect.h, {
                layers: "L1,L2,L3,L4,L5,L6,L7",
                includeEvents: true,
                mode: runtimeEditorState.mode,
                category,
                save: true
            });
            editorSetMessage(`Saved prefab: ${name}.`, scene);
        }
        runtimeEditorState.selectionStart = null;
        editorRefresh(scene);
        return true;
    }

    function editorRemoteApplyPatch(patch, operation, scene = SceneManager._scene) {
        const mapId = runtimeEditorState.remoteMapId;
        const snapshot = runtimeEditorState.remoteSnapshot;
        if (!mapId || !snapshot || !patch) return false;
        applyPatchToMap(mapId, patch, operation);
        applyPatchToBuffer(patch, snapshot.data, snapshot.width, snapshot.height, true);
        if (patchAffectsEvents(patch)) snapshot.events = composeEvents(snapshot.events || [], [patch], mapId);
        if (scene && scene.refreshHybridRemoteMap) scene.refreshHybridRemoteMap();
        editorRefresh(scene);
        return patch;
    }

    function editorRemotePaintPoints(points, tileValue, operation, scene, weightedTiles = null) {
        const snapshot = runtimeEditorState.remoteSnapshot;
        const layer = runtimeEditorState.layer;
        const key = normalizeLayer(layer);
        const targets = [];
        const seen = new Set();
        for (const point of points || []) {
            const x = integer(point.x);
            const y = integer(point.y);
            const pointKey = coordinateKey(x, y);
            if (!seen.has(pointKey) && inBounds(x, y, snapshot.width, snapshot.height)) {
                seen.add(pointKey);
                targets.push({ x, y });
            }
        }
        if (!targets.length) return false;
        let patch;
        if (weightedTiles && weightedTiles.length) {
            const cells = targets.map(point => ({
                x: point.x,
                y: point.y,
                tiles: cellTilesForLayer(key, chooseWeightedTile(weightedTiles), false)
            }));
            const mode = LAYER_INDEX[key] <= 3 ? runtimeEditorState.mode : "exact";
            patch = makeSparsePatch(cells, mode, mode === "autotile" ? targets : null);
        } else {
            const tileId = parseTileId(tileValue);
            if (tileId === null || !validateLayerValue(tileId, key, snapshot.tilesetId)) return false;
            patch = sparseFillPatch(targets, key, tileId, { mode: runtimeEditorState.mode });
        }
        return editorRemoteApplyPatch(patch, operation, scene);
    }

    function editorRemoteRectanglePoints(rect, outline = false) {
        if (outline) return rectangleOutlinePoints(rect.x, rect.y, rect.w, rect.h);
        const points = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) points.push({ x, y });
        }
        return points;
    }

    function editorRemoteCopy(rect, includeEvents = true) {
        const snapshot = runtimeEditorState.remoteSnapshot;
        const layers = ["L1", "L2", "L3", "L4", "L5", "L6"];
        const events = includeEvents ? (snapshot.events || []).filter(event => event && inRect(event.x, event.y, rect)).map(source => {
            const event = deepClone(source);
            event.x -= rect.x;
            event.y -= rect.y;
            return event;
        }) : [];
        runtimeClipboard = {
            version: 1,
            width: rect.w,
            height: rect.h,
            layers,
            tiles: extractRegion(snapshot, rect, layers),
            events,
            includeEvents,
            tilesetId: snapshot.tilesetId,
            sourceMapId: runtimeEditorState.remoteMapId
        };
        return deepClone(runtimeClipboard);
    }

    function editorApplyRemoteSelectionTool(scene) {
        if (!runtimeEditorState.selectionStart) {
            runtimeEditorState.selectionStart = { x: runtimeEditorState.cursorX, y: runtimeEditorState.cursorY };
            editorSetMessage("First corner set. Move and confirm the opposite corner.", scene);
            return true;
        }
        const rect = editorSelectionRect();
        let result = false;
        if (runtimeEditorState.tool === "rectangle") {
            result = editorRemotePaintPoints(editorRemoteRectanglePoints(rect), runtimeEditorState.tileId, "remoteRectangle", scene);
        } else if (runtimeEditorState.tool === "outline") {
            result = editorRemotePaintPoints(editorRemoteRectanglePoints(rect, true), runtimeEditorState.tileId, "remoteOutline", scene);
        } else if (runtimeEditorState.tool === "line") {
            result = editorRemotePaintPoints(linePoints(runtimeEditorState.selectionStart.x, runtimeEditorState.selectionStart.y,
                runtimeEditorState.cursorX, runtimeEditorState.cursorY), runtimeEditorState.tileId, "remoteLine", scene);
        } else if (runtimeEditorState.tool === "circle") {
            const radius = Math.max(Math.abs(runtimeEditorState.cursorX - runtimeEditorState.selectionStart.x),
                Math.abs(runtimeEditorState.cursorY - runtimeEditorState.selectionStart.y));
            result = editorRemotePaintPoints(circlePoints(runtimeEditorState.selectionStart.x,
                runtimeEditorState.selectionStart.y, radius, false), runtimeEditorState.tileId, "remoteCircle", scene);
        } else if (runtimeEditorState.tool === "randomRectangle") {
            result = editorRemotePaintPoints(editorRemoteRectanglePoints(rect), 0, "remoteRandomRectangle", scene,
                runtimeEditorState.weightedTiles);
        } else if (runtimeEditorState.tool === "select") {
            runtimeEditorState.selectionRect = deepClone(rect);
            result = true;
        } else if (runtimeEditorState.tool === "copy") {
            result = editorRemoteCopy(rect, true);
            runtimeEditorState.tool = "paste";
        } else if (runtimeEditorState.tool === "capturePrefab") {
            const name = typeof window !== "undefined" && window.prompt ? window.prompt("Prefab name", `Prefab_${Date.now()}`) : null;
            if (name) {
                const payload = editorRemoteCopy(rect, true);
                result = registerPrefab({
                    name,
                    mapId: runtimeEditorState.remoteMapId,
                    sourceX: rect.x,
                    sourceY: rect.y,
                    width: rect.w,
                    height: rect.h,
                    layers: payload.layers,
                    includeEvents: true,
                    mode: runtimeEditorState.mode,
                    payload
                }, true);
            }
        }
        runtimeEditorState.selectionStart = null;
        editorSetMessage(result ? `${runtimeEditorState.tool} applied on remote map.` : "Remote operation made no change.", scene);
        return !!result;
    }

    function editorRemoteFloodPoints() {
        const snapshot = runtimeEditorState.remoteSnapshot;
        const z = LAYER_INDEX[runtimeEditorState.layer];
        const origin = { x: runtimeEditorState.cursorX, y: runtimeEditorState.cursorY };
        const sourceTile = readTile(snapshot.data, snapshot.width, snapshot.height, origin.x, origin.y, z);
        const queue = [origin];
        let queueHead = 0;
        const visited = new Set();
        const points = [];
        while (queueHead < queue.length) {
            const point = queue[queueHead++];
            const key = coordinateKey(point.x, point.y);
            if (visited.has(key) || !inBounds(point.x, point.y, snapshot.width, snapshot.height)) continue;
            visited.add(key);
            const value = readTile(snapshot.data, snapshot.width, snapshot.height, point.x, point.y, z);
            if (!sameTileType(value, sourceTile)) continue;
            points.push(point);
            queue.push({ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y },
                { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 });
        }
        return points;
    }

    function editorRemoteEventsAt(x, y) {
        return (runtimeEditorState.remoteSnapshot && runtimeEditorState.remoteSnapshot.events || [])
            .filter(event => event && event.x === integer(x) && event.y === integer(y));
    }

    function editorRemoteEventTool(scene) {
        const snapshot = runtimeEditorState.remoteSnapshot;
        if (!snapshot) return false;
        if (runtimeEditorState.selectedEventId > 0) {
            const source = (snapshot.events || []).find(event => event && event.id === runtimeEditorState.selectedEventId);
            if (!source) {
                runtimeEditorState.selectedEventId = 0;
                editorSetMessage("The selected remote event no longer exists.", scene);
                return false;
            }
            let event;
            let removeIds = [];
            let label;
            if (isHybridEventData(source)) {
                event = deepClone(source);
                removeIds = [source.id];
                label = "Move Remote Spawned Event";
            } else {
                event = prepareTargetEventSnapshot(source);
                label = "Duplicate Remote Event";
            }
            event.x = runtimeEditorState.cursorX;
            event.y = runtimeEditorState.cursorY;
            const patch = makeEventPatch([event], removeIds, label, { preserveEventState: true });
            runtimeEditorState.selectedEventId = 0;
            const result = editorRemoteApplyPatch(patch, "remoteEventEdit", scene);
            editorSetMessage(result ? `${label} complete.` : "Remote event operation failed.", scene);
            return !!result;
        }
        const events = editorRemoteEventsAt(runtimeEditorState.cursorX, runtimeEditorState.cursorY);
        if (!events.length) {
            editorSetMessage("No remote event at the cursor.", scene);
            return false;
        }
        runtimeEditorState.selectedEventId = events[0].id;
        editorSetMessage(`Selected remote event ${events[0].id}: ${events[0].name || "Event"}. Move and confirm.`, scene);
        editorRefresh(scene);
        return true;
    }

    function editorDeleteRemoteSpawnedEvent(scene) {
        const event = editorRemoteEventsAt(runtimeEditorState.cursorX, runtimeEditorState.cursorY).find(isHybridEventData);
        if (!event) return false;
        const patch = makeEventPatch([], [event.id], "Delete Remote Spawned Event");
        return !!editorRemoteApplyPatch(patch, "remoteDeleteEvent", scene);
    }

    function editorRemotePaste(scene) {
        if (!runtimeClipboard) return false;
        const transformed = transformClipboard(runtimeClipboard, runtimeEditorState);
        const snapshot = runtimeEditorState.remoteSnapshot;
        const rect = normalizeRect(runtimeEditorState.cursorX, runtimeEditorState.cursorY,
            transformed.width, transformed.height);
        const tiles = {};
        for (const key of transformed.layers) tiles[key] = (transformed.tiles[key] || []).slice();
        const events = transformed.includeEvents ? (transformed.events || []).map(source => {
            const event = prepareTargetEventSnapshot(source);
            event.x = rect.x + integer(source.x);
            event.y = rect.y + integer(source.y);
            return event;
        }) : [];
        const patch = makeRectPatch(rect, transformed.layers, tiles, runtimeEditorState.mode, {
            affectEvents: transformed.includeEvents,
            events,
            removeEventIds: transformed.includeEvents ? spawnedEventIdsInSnapshot(snapshot.events, rect) : []
        });
        return editorRemoteApplyPatch(patch, "remotePaste", scene);
    }

    function editorApplyRemoteCurrent(scene) {
        const x = runtimeEditorState.cursorX;
        const y = runtimeEditorState.cursorY;
        const size = runtimeEditorState.brushSize;
        const square = [];
        for (let py = y; py < y + size; py++) for (let px = x; px < x + size; px++) square.push({ x: px, y: py });
        switch (runtimeEditorState.tool) {
            case "rectangle": case "outline": case "line": case "circle": case "randomRectangle":
            case "select": case "copy": case "capturePrefab":
                return editorApplyRemoteSelectionTool(scene);
            case "eyedropper": return editorEyedropper(scene);
            case "erase": return !!editorRemotePaintPoints(square, 0, "remoteErase", scene);
            case "flood": return !!editorRemotePaintPoints(editorRemoteFloodPoints(), runtimeEditorState.tileId, "remoteFlood", scene);
            case "replace": {
                const snapshot = runtimeEditorState.remoteSnapshot;
                const z = LAYER_INDEX[runtimeEditorState.layer];
                const from = readTile(snapshot.data, snapshot.width, snapshot.height, x, y, z);
                const points = [];
                for (let py = 0; py < snapshot.height; py++) for (let px = 0; px < snapshot.width; px++) {
                    if (sameTileType(readTile(snapshot.data, snapshot.width, snapshot.height, px, py, z), from)) points.push({ x: px, y: py });
                }
                return !!editorRemotePaintPoints(points, runtimeEditorState.tileId, "remoteReplace", scene);
            }
            case "random": return !!editorRemotePaintPoints(square, 0, "remoteRandom", scene, runtimeEditorState.weightedTiles);
            case "paste": return !!editorRemotePaste(scene);
            case "prefab": {
                const prefab = runtimeEditorState.selectedPrefab;
                if (!prefab) { scene.openHybridPrefabBrowser(); return false; }
                const targetMapId = runtimeEditorState.remoteMapId;
                runtimeEditorState.pending = true;
                graftPrefabToMapAsync({
                    targetMapId,
                    name: prefab.name,
                    storageMapId: prefab.mapId,
                    targetX: x,
                    targetY: y,
                    layers: prefab.layers,
                    mode: prefab.mode,
                    includeEvents: prefab.includeEvents,
                    save: true,
                    rotation: runtimeEditorState.rotation,
                    mirrorX: runtimeEditorState.mirrorX,
                    mirrorY: runtimeEditorState.mirrorY
                }).then(() => preloadMap(targetMapId)).then(snapshot => {
                    if (runtimeEditorState.active && runtimeEditorState.remoteMapId === targetMapId) {
                        runtimeEditorState.remoteSnapshot = snapshot;
                        scene.showHybridRemoteMap(snapshot);
                        editorSetMessage(`Placed ${prefab.name} on remote map.`, scene);
                    }
                }).catch(error => {
                    console.error(error);
                    editorSetMessage(`Remote prefab failed: ${error.message}`, scene);
                }).finally(() => { runtimeEditorState.pending = false; editorRefresh(scene); });
                return true;
            }
            case "event":
                return editorRemoteEventTool(scene);
            case "paint":
            default:
                return !!editorRemotePaintPoints(square, runtimeEditorState.tileId, "remotePaint", scene);
        }
    }

    function editorApplyCurrent(scene = SceneManager._scene) {
        if (runtimeEditorState.pending) return false;
        const nonLayerTools = new Set(["select", "copy", "capturePrefab", "event", "prefab", "paste"]);
        if (!nonLayerTools.has(runtimeEditorState.tool) && runtimeEditorState.layerLocks[runtimeEditorState.layer]) {
            editorSetMessage(`${runtimeEditorState.layer} is locked.`, scene);
            return false;
        }
        if (runtimeEditorState.remoteMapId) return editorApplyRemoteCurrent(scene);
        const x = runtimeEditorState.cursorX;
        const y = runtimeEditorState.cursorY;
        const size = runtimeEditorState.brushSize;
        switch (runtimeEditorState.tool) {
            case "rectangle":
            case "outline":
            case "line":
            case "circle":
            case "randomRectangle":
            case "select":
            case "copy":
            case "capturePrefab":
                return editorApplySelectionTool(scene);
            case "eyedropper":
                editorEyedropper(scene);
                return true;
            case "erase":
                fillTiles(x, y, size, size, runtimeEditorState.layer, 0, true, { mode: runtimeEditorState.mode });
                editorSetMessage(`Erased ${size}×${size} on ${runtimeEditorState.layer}.`, scene);
                return true;
            case "flood": {
                const patch = floodFill(x, y, runtimeEditorState.layer, runtimeEditorState.tileId, true, { mode: runtimeEditorState.mode });
                editorSetMessage(patch ? "Flood fill complete." : "Flood fill made no change.", scene);
                return !!patch;
            }
            case "replace": {
                const patch = replaceTiles({
                    x, y,
                    layer: runtimeEditorState.layer,
                    toTileId: runtimeEditorState.tileId,
                    mode: runtimeEditorState.mode,
                    save: true
                });
                editorSetMessage(patch ? "Matching tiles replaced." : "No matching tiles found.", scene);
                return !!patch;
            }
            case "random": {
                if (!runtimeEditorState.weightedTiles.length && !editorPromptWeightedTiles(scene)) return false;
                const patch = randomFill(x, y, size, size, runtimeEditorState.layer,
                    runtimeEditorState.weightedTiles, true, { mode: runtimeEditorState.mode });
                editorSetMessage(patch ? "Random brush applied." : "Random brush failed.", scene);
                return !!patch;
            }
            case "paste": {
                const patch = pasteArea(x, y, {
                    save: true,
                    mode: runtimeEditorState.mode,
                    rotation: runtimeEditorState.rotation,
                    mirrorX: runtimeEditorState.mirrorX,
                    mirrorY: runtimeEditorState.mirrorY
                });
                editorSetMessage(patch ? "Clipboard pasted." : "Clipboard is empty.", scene);
                return !!patch;
            }
            case "event": {
                if (runtimeEditorState.selectedEventId > 0) {
                    const event = $gameMap.event(runtimeEditorState.selectedEventId);
                    const result = isHybridGameEvent(event)
                        ? moveSpawnedEvent(runtimeEditorState.selectedEventId, x, y, true)
                        : duplicateEvent(runtimeEditorState.selectedEventId, x, y, true);
                    editorSetMessage(result ? "Event placed." : "Event operation failed.", scene);
                    runtimeEditorState.selectedEventId = 0;
                    return !!result;
                }
                const events = eventInfoAt(x, y);
                if (!events.length) {
                    editorSetMessage("No event at the cursor.", scene);
                    return false;
                }
                runtimeEditorState.selectedEventId = events[0].id;
                editorSetMessage(`Selected event ${events[0].id}: ${events[0].name}. Move and confirm.`, scene);
                return true;
            }
            case "prefab": {
                const prefab = runtimeEditorState.selectedPrefab;
                if (!prefab) {
                    if (scene && scene.openHybridPrefabBrowser) scene.openHybridPrefabBrowser();
                    return false;
                }
                runtimeEditorState.pending = true;
                editorSetMessage(`Placing ${prefab.name}…`, scene);
                graftPrefabAsync({
                    name: prefab.name,
                    storageMapId: prefab.mapId,
                    targetX: x,
                    targetY: y,
                    layers: prefab.layers,
                    mode: prefab.mode,
                    includeEvents: prefab.includeEvents,
                    save: true,
                    rotation: runtimeEditorState.rotation,
                    mirrorX: runtimeEditorState.mirrorX,
                    mirrorY: runtimeEditorState.mirrorY
                }).then(result => {
                    editorSetMessage(result ? `Placed ${prefab.name}.` : `Could not place ${prefab.name}.`, scene);
                }).catch(error => {
                    console.error(error);
                    editorSetMessage(`Prefab failed: ${error.message}`, scene);
                }).finally(() => {
                    runtimeEditorState.pending = false;
                    editorRefresh(scene);
                });
                return true;
            }
            case "paint":
            default:
                recordRecentTile(runtimeEditorState.tileId, runtimeEditorState.layer);
                fillTiles(x, y, size, size, runtimeEditorState.layer, runtimeEditorState.tileId,
                    true, { mode: runtimeEditorState.mode });
                editorSetMessage(`Painted ${size}×${size} on ${runtimeEditorState.layer}.`, scene);
                return true;
        }
    }

    function paletteTileIds(sheet) {
        const a2 = Tilemap.TILE_ID_A2 || 2816;
        const a3 = Tilemap.TILE_ID_A3 || 4352;
        const a4 = Tilemap.TILE_ID_A4 || 5888;
        const max = Tilemap.TILE_ID_MAX || 8192;
        const ranges = {
            A1: [Tilemap.TILE_ID_A1, a2, 48],
            A2: [a2, a3, 48],
            A3: [a3, a4, 48],
            A4: [a4, max, 48],
            A5: [Tilemap.TILE_ID_A5, Tilemap.TILE_ID_A5 + 128, 1],
            B: [Tilemap.TILE_ID_B, Tilemap.TILE_ID_B + 256, 1],
            C: [Tilemap.TILE_ID_C, Tilemap.TILE_ID_C + 256, 1],
            D: [Tilemap.TILE_ID_D, Tilemap.TILE_ID_D + 256, 1],
            E: [Tilemap.TILE_ID_E, Tilemap.TILE_ID_E + 256, 1]
        };
        if (sheet === "Recent") return ensureStore().recentTiles.slice();
        if (sheet === "Favorites") return Object.keys(ensureStore().favoriteTiles).map(Number);
        const range = ranges[sheet] || ranges.B;
        const output = [];
        for (let id = range[0]; id < range[1]; id += range[2]) output.push(id);
        return output;
    }

    function tilesetBitmapForIndex(index) {
        if (typeof ImageManager === "undefined" || typeof $dataTilesets === "undefined") return null;
        const tileset = $dataTilesets[editorTilesetId()];
        if (!tileset || !tileset.tilesetNames) return null;
        const name = tileset.tilesetNames[index];
        return name ? ImageManager.loadTileset(name) : null;
    }

    function drawAutotileGraphic(target, tileId, dx, dy, refreshCallback, destWidth = $gameMap.tileWidth(), destHeight = $gameMap.tileHeight()) {
        const kind = Tilemap.getAutotileKind(tileId);
        const shape = Tilemap.getAutotileShape ? Tilemap.getAutotileShape(tileId) : 0;
        const tx = kind % 8;
        const ty = Math.floor(kind / 8);
        let setNumber = 0;
        let bx = 0;
        let by = 0;
        let table = Tilemap.FLOOR_AUTOTILE_TABLE;
        if (tileId >= Tilemap.TILE_ID_A1 && tileId < (Tilemap.TILE_ID_A2 || 2816)) {
            if (kind === 0) { bx = 0; by = 0; }
            else if (kind === 1) { bx = 0; by = 3; }
            else if (kind === 2) { bx = 6; by = 0; }
            else if (kind === 3) { bx = 6; by = 3; }
            else {
                bx = Math.floor(tx / 4) * 8;
                by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
                if (kind % 2 === 1) {
                    bx += 6;
                    table = Tilemap.WATERFALL_AUTOTILE_TABLE;
                }
            }
        } else if (tileId < (Tilemap.TILE_ID_A3 || 4352)) {
            setNumber = 1;
            bx = tx * 2;
            by = (ty - 2) * 3;
        } else if (tileId < (Tilemap.TILE_ID_A4 || 5888)) {
            setNumber = 2;
            bx = tx * 2;
            by = (ty - 6) * 2;
            table = Tilemap.WALL_AUTOTILE_TABLE;
        } else {
            setNumber = 3;
            bx = tx * 2;
            by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
            if (ty % 2 === 1) table = Tilemap.WALL_AUTOTILE_TABLE;
        }
        if (!table || !table[shape]) return false;
        const source = tilesetBitmapForIndex(setNumber);
        if (!source) return false;
        if (source.isReady && !source.isReady()) {
            if (source.addLoadListener && refreshCallback) source.addLoadListener(refreshCallback);
            return false;
        }
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const w1 = tw / 2;
        const h1 = th / 2;
        const dw1 = destWidth / 2;
        const dh1 = destHeight / 2;
        for (let index = 0; index < 4; index++) {
            const quarter = table[shape][index];
            const sx = (bx * 2 + quarter[0]) * w1;
            const sy = (by * 2 + quarter[1]) * h1;
            const qx = index % 2;
            const qy = Math.floor(index / 2);
            target.blt(source, sx, sy, w1, h1, dx + qx * dw1, dy + qy * dh1, dw1, dh1);
        }
        return true;
    }

    function drawTileGraphic(target, tileId, dx, dy, refreshCallback, destWidth = $gameMap.tileWidth(), destHeight = $gameMap.tileHeight()) {
        if (!target || typeof target.blt !== "function") return false;
        if (Tilemap.isAutotile(tileId)) return drawAutotileGraphic(target, tileId, dx, dy, refreshCallback, destWidth, destHeight);
        const setNumber = tileSheetIndexForId(tileId);
        const source = tilesetBitmapForIndex(setNumber);
        if (!source) return false;
        if (source.isReady && !source.isReady()) {
            if (source.addLoadListener && refreshCallback) source.addLoadListener(refreshCallback);
            return false;
        }
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        let sx;
        let sy;
        if (setNumber === 4) {
            const local = tileId - Tilemap.TILE_ID_A5;
            sx = (local % 8) * tw;
            sy = Math.floor(local / 8) * th;
        } else {
            const local = tileId % 256;
            sx = ((Math.floor(local / 128) % 2) * 8 + local % 8) * tw;
            sy = (Math.floor(local / 8) % 16) * th;
        }
        target.blt(source, sx, sy, tw, th, dx, dy, destWidth, destHeight);
        return true;
    }

    function prefabThumbnailTile(definition) {
        const payload = prefabPayload(definition);
        if (payload) {
            const index = Math.floor(payload.height / 2) * payload.width + Math.floor(payload.width / 2);
            for (const layer of ["L4", "L3", "L2", "L1"]) {
                const value = payload.tiles[layer] && payload.tiles[layer][index];
                if (value) return value;
            }
        }
        let source = null;
        if (definition.mapId === $gameMap.mapId()) source = getSourceMapData(definition.mapId);
        else source = composedCache.get(definition.mapId) || pristineCache.get(definition.mapId);
        if (!source) return 0;
        const x = definition.x + Math.floor(definition.w / 2);
        const y = definition.y + Math.floor(definition.h / 2);
        for (let z = 3; z >= 0; z--) {
            const value = readTile(source.data, source.width, source.height, x, y, z);
            if (value) return value;
        }
        return 0;
    }

    function prefabTileAt(definition, localX, localY) {
        const payload = prefabPayload(definition);
        if (payload) {
            const x = Math.max(0, Math.min(payload.width - 1, integer(localX)));
            const y = Math.max(0, Math.min(payload.height - 1, integer(localY)));
            const index = y * payload.width + x;
            for (const layer of ["L4", "L3", "L2", "L1"]) {
                const value = payload.tiles[layer] && payload.tiles[layer][index];
                if (value) return value;
            }
            return 0;
        }
        let source = null;
        if (definition.mapId === $gameMap.mapId()) source = getSourceMapData(definition.mapId);
        else source = composedCache.get(definition.mapId) || pristineCache.get(definition.mapId);
        if (!source) return 0;
        const x = definition.x + Math.max(0, Math.min(definition.w - 1, integer(localX)));
        const y = definition.y + Math.max(0, Math.min(definition.h - 1, integer(localY)));
        for (let z = 3; z >= 0; z--) {
            const value = readTile(source.data, source.width, source.height, x, y, z);
            if (value) return value;
        }
        return 0;
    }

    function drawPrefabThumbnail(target, definition, dx, dy, size = 48, refreshCallback = null) {
        if (definition.thumbnail && target && typeof target.blt === "function" &&
            typeof ImageManager !== "undefined" && ImageManager.loadPicture) {
            const picture = ImageManager.loadPicture(definition.thumbnail);
            if (picture && picture.isReady && !picture.isReady()) {
                if (picture.addLoadListener && refreshCallback) picture.addLoadListener(refreshCallback);
                return false;
            }
            if (picture) {
                target.blt(picture, 0, 0, picture.width, picture.height, dx, dy, size, size);
                return true;
            }
        }
        const columns = Math.min(2, definition.w);
        const rows = Math.min(2, definition.h);
        const cellWidth = size / Math.max(1, columns);
        const cellHeight = size / Math.max(1, rows);
        let drew = false;
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const sourceX = columns === 1 ? Math.floor(definition.w / 2) : Math.round(column * (definition.w - 1));
                const sourceY = rows === 1 ? Math.floor(definition.h / 2) : Math.round(row * (definition.h - 1));
                const tileId = prefabTileAt(definition, sourceX, sourceY);
                if (tileId) {
                    drew = drawTileGraphic(target, tileId, dx + column * cellWidth, dy + row * cellHeight,
                        refreshCallback, cellWidth, cellHeight) || drew;
                }
            }
        }
        return drew;
    }

    function editorPromptAutotileShape(scene = SceneManager._scene) {
        if (!Tilemap.isAutotile(runtimeEditorState.tileId)) {
            editorSetMessage("The current brush is not an autotile.", scene);
            return false;
        }
        if (typeof window === "undefined" || typeof window.prompt !== "function") return false;
        const current = Tilemap.getAutotileShape ? Tilemap.getAutotileShape(runtimeEditorState.tileId) : 0;
        const shape = Math.max(0, Math.min(47, integer(window.prompt("Autotile shape (0-47)", String(current)), current)));
        runtimeEditorState.tileId = Tilemap.makeAutotileId(Tilemap.getAutotileKind(runtimeEditorState.tileId), shape);
        recordRecentTile(runtimeEditorState.tileId, runtimeEditorState.layer);
        editorSetMessage(`Autotile shape: ${shape}.`, scene);
        return true;
    }

    function installRuntimeEditor() {
        if (typeof Input !== "undefined" && Input.keyMapper) {
            const mappings = {
                [EDITOR_TOGGLE_KEY_CODE]: "hybridEditor",
                9: "hybridMenu",
                66: "hybridBrush",
                67: "hybridCopy",
                69: "hybridErase",
                70: "hybridMirror",
                71: "hybridPalette",
                72: "hybridRotate",
                73: "hybridPick",
                77: "hybridMode",
                80: "hybridPrefab",
                82: "hybridRectangle",
                83: "hybridPersist",
                84: "hybridTile",
                85: "hybridUndo",
                86: "hybridPaste",
                89: "hybridRedo",
                187: "hybridZoomIn",
                189: "hybridZoomOut"
            };
            for (const [code, symbol] of Object.entries(mappings)) {
                const keyCode = Number(code);
                if (keyCode === EDITOR_TOGGLE_KEY_CODE || !Input.keyMapper[keyCode]) Input.keyMapper[keyCode] = symbol;
            }
            const preferences = ensureStore().editorPreferences;
            for (const [symbol, code] of Object.entries(preferences.keyBindings || {})) {
                if (integer(code) > 0) Input.keyMapper[integer(code)] = symbol;
            }
            if (Input.gamepadMapper) for (const [symbol, button] of Object.entries(preferences.gamepadBindings || {})) {
                if (integer(button, -1) >= 0) Input.gamepadMapper[integer(button)] = symbol;
            }
        }

        class Sprite_HybridEditorCursor extends Sprite {
            constructor() {
                super(new Bitmap(1, 1));
                this._lastKey = "";
                this.visible = false;
            }

            refresh() {
                if (!runtimeEditorState.active || !$dataMap) {
                    this.visible = false;
                    return;
                }
                const rect = editorFootprint();
                const tw = editorTileWidth();
                const th = editorTileHeight();
                const width = Math.max(1, Math.min(editorMapWidth(), rect.w) * tw);
                const height = Math.max(1, Math.min(editorMapHeight(), rect.h) * th);
                const color = runtimeEditorState.selectionStart ? EDITOR_SELECTION_COLOR : EDITOR_CURSOR_COLOR;
                const key = `${width},${height},${color}`;
                if (this._lastKey !== key) {
                    this.bitmap.resize(width, height);
                    this.bitmap.clear();
                    this.bitmap.fillRect(0, 0, width, height, runtimeEditorState.selectionStart
                        ? "rgba(255,209,102,0.18)" : "rgba(102,224,255,0.18)");
                    this.bitmap.fillRect(0, 0, width, 3, color);
                    this.bitmap.fillRect(0, height - 3, width, 3, color);
                    this.bitmap.fillRect(0, 0, 3, height, color);
                    this.bitmap.fillRect(width - 3, 0, 3, height, color);
                    this._lastKey = key;
                }
                this.x = Math.round(editorScreenX(rect.x));
                this.y = Math.round(editorScreenY(rect.y));
                this.visible = true;
            }

            update() {
                super.update();
                this.refresh();
            }
        }

        class Sprite_HybridEditorGhost extends Sprite {
            constructor() {
                super(new Bitmap(1, 1));
                this._lastKey = "";
                this.opacity = 150;
                this.visible = false;
            }

            refresh() {
                if (!runtimeEditorState.active || runtimeEditorState.selectionStart ||
                    !["paint", "erase", "random", "paste", "prefab"].includes(runtimeEditorState.tool)) {
                    this.visible = false;
                    return;
                }
                const rect = editorFootprint();
                const tw = editorTileWidth();
                const th = editorTileHeight();
                const key = JSON.stringify([runtimeEditorState.tool, rect.w, rect.h, runtimeEditorState.tileId,
                    runtimeEditorState.selectedPrefab && runtimeEditorState.selectedPrefab.name,
                    runtimeEditorState.rotation, runtimeEditorState.mirrorX, runtimeEditorState.mirrorY,
                    runtimeClipboard && runtimeClipboard.width, runtimeClipboard && runtimeClipboard.height, runtimeEditorState.zoom]);
                if (key !== this._lastKey) {
                    this._lastKey = key;
                    this.bitmap.resize(Math.max(1, Math.ceil(rect.w * tw)), Math.max(1, Math.ceil(rect.h * th)));
                    this.bitmap.clear();
                    let payload = null;
                    if (runtimeEditorState.tool === "paste" && runtimeClipboard) payload = transformClipboard(runtimeClipboard, runtimeEditorState);
                    if (runtimeEditorState.tool === "prefab" && runtimeEditorState.selectedPrefab) {
                        const source = prefabPayload(runtimeEditorState.selectedPrefab);
                        if (source) payload = transformClipboard(source, runtimeEditorState);
                    }
                    if (payload) {
                        for (let y = 0; y < payload.height; y++) {
                            for (let x = 0; x < payload.width; x++) {
                                let tileId = 0;
                                for (const layer of ["L4", "L3", "L2", "L1"]) {
                                    tileId = payload.tiles[layer] && payload.tiles[layer][y * payload.width + x] || tileId;
                                    if (tileId) break;
                                }
                                if (tileId) drawTileGraphic(this.bitmap, tileId, x * tw, y * th, () => this.refresh(), tw, th);
                            }
                        }
                    } else {
                        const tileId = runtimeEditorState.tool === "erase" ? 0 : runtimeEditorState.tileId;
                        if (tileId) for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
                            drawTileGraphic(this.bitmap, tileId, x * tw, y * th, () => this.refresh(), tw, th);
                        }
                    }
                }
                this.x = Math.round(editorScreenX(rect.x));
                this.y = Math.round(editorScreenY(rect.y));
                this.visible = true;
            }

            update() { super.update(); this.refresh(); }
        }

        class Sprite_HybridEditorOverlay extends Sprite {
            constructor() {
                super(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
                this._lastKey = "";
                this.visible = false;
            }

            refresh() {
                if (!runtimeEditorState.active || (!runtimeEditorState.grid && runtimeEditorState.overlay === "none")) {
                    this.visible = false;
                    return;
                }
                const data = editorMapData();
                const tw = editorTileWidth();
                const th = editorTileHeight();
                const columns = Math.ceil(Graphics.boxWidth / tw) + 1;
                const rows = Math.ceil(Graphics.boxHeight / th) + 1;
                const patchCount = (ensureStore().maps[String(editorMapId())] || []).length;
                const key = [editorMapId(), runtimeEditorState.viewX, runtimeEditorState.viewY, runtimeEditorState.zoom,
                    runtimeEditorState.grid, runtimeEditorState.overlay, patchCount, ensureStore().operationLog.length].join(",");
                if (key === this._lastKey) { this.visible = true; return; }
                this._lastKey = key;
                this.bitmap.clear();
                const tileset = typeof $dataTilesets !== "undefined" && $dataTilesets ? $dataTilesets[data.tilesetId] : null;
                const terrainAt = (x, y) => {
                    for (let z = 3; z >= 0; z--) {
                        const tileId = readTile(data.data, data.width, data.height, x, y, z);
                        const flag = tileset && tileset.flags ? tileset.flags[tileId] || 0 : 0;
                        const terrain = flag >> 12 & 0x0f;
                        if (terrain) return terrain;
                    }
                    return 0;
                };
                for (let row = 0; row < rows; row++) {
                    for (let column = 0; column < columns; column++) {
                        const x = runtimeEditorState.viewX + column;
                        const y = runtimeEditorState.viewY + row;
                        if (!inBounds(x, y, data.width, data.height)) continue;
                        const sx = column * tw;
                        const sy = row * th;
                        let label = "";
                        let color = "";
                        if (runtimeEditorState.overlay === "region") {
                            const value = readTile(data.data, data.width, data.height, x, y, 5);
                            label = String(value);
                            color = `hsla(${(value * 47) % 360},75%,50%,0.28)`;
                        } else if (runtimeEditorState.overlay === "shadow") {
                            const value = readTile(data.data, data.width, data.height, x, y, 4);
                            label = value.toString(2).padStart(4, "0");
                            color = value ? "rgba(30,30,50,0.42)" : "rgba(255,255,255,0.08)";
                        } else if (runtimeEditorState.overlay === "terrain") {
                            const value = terrainAt(x, y);
                            label = `T${value}`;
                            color = `hsla(${(value * 83) % 360},70%,45%,0.30)`;
                        } else if (["collision", "passability"].includes(runtimeEditorState.overlay)) {
                            const passable = runtimeEditorState.remoteMapId
                                ? [2, 4, 6, 8].some(direction => snapshotPassable(data, x, y, direction))
                                : $gameMap.isPassable
                                    ? [2, 4, 6, 8].some(direction => $gameMap.isPassable(x, y, direction))
                                    : true;
                            label = passable ? "PASS" : "BLOCK";
                            color = passable ? "rgba(60,210,120,0.22)" : "rgba(235,70,70,0.35)";
                        } else if (runtimeEditorState.overlay === "changes") {
                            const pristine = pristineCache.get(editorMapId()) || currentPristine;
                            let changed = false;
                            if (pristine) for (let z = 0; z < 6; z++) {
                                if (readTile(data.data, data.width, data.height, x, y, z) !==
                                    readTile(pristine.data, pristine.width, pristine.height, x, y, z)) changed = true;
                            }
                            if (changed) { label = "Δ"; color = "rgba(255,209,102,0.36)"; }
                        }
                        if (color) this.bitmap.fillRect(sx, sy, tw, th, color);
                        if (label && this.bitmap.drawText) this.bitmap.drawText(label, sx, sy - 5, tw, Math.min(36, th), "center");
                        if (runtimeEditorState.grid || runtimeEditorState.overlay === "grid") {
                            this.bitmap.fillRect(sx, sy, Math.max(1, runtimeEditorState.zoom), th, "rgba(255,255,255,0.18)");
                            this.bitmap.fillRect(sx, sy, tw, Math.max(1, runtimeEditorState.zoom), "rgba(255,255,255,0.18)");
                        }
                    }
                }
                this.visible = true;
            }

            update() { super.update(); this.refresh(); }
        }

        class Sprite_HybridEditorMinimap extends Sprite {
            constructor() {
                super(new Bitmap(184, 144));
                this.x = Graphics.boxWidth - 196;
                this.y = 152;
                this._lastKey = "";
                this.visible = false;
            }

            refresh() {
                if (!runtimeEditorState.active) { this.visible = false; return; }
                const data = editorMapData();
                const key = [editorMapId(), data.width, data.height, runtimeEditorState.viewX,
                    runtimeEditorState.viewY, (ensureStore().maps[String(editorMapId())] || []).length].join(",");
                if (key === this._lastKey) { this.visible = true; return; }
                this._lastKey = key;
                this.bitmap.clear();
                this.bitmap.fillRect(0, 0, 184, 144, "rgba(12,15,20,0.86)");
                const scale = Math.min(176 / data.width, 136 / data.height);
                for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
                    let occupied = false;
                    for (let z = 0; z < 4; z++) if (readTile(data.data, data.width, data.height, x, y, z)) occupied = true;
                    if (occupied) this.bitmap.fillRect(4 + x * scale, 4 + y * scale,
                        Math.max(1, scale), Math.max(1, scale), "rgba(100,180,210,0.72)");
                }
                for (const event of data.events || []) if (event) this.bitmap.fillRect(4 + event.x * scale,
                    4 + event.y * scale, Math.max(2, scale), Math.max(2, scale), "#ffd166");
                const visibleColumns = Graphics.boxWidth / editorTileWidth();
                const visibleRows = Graphics.boxHeight / editorTileHeight();
                const vx = 4 + runtimeEditorState.viewX * scale;
                const vy = 4 + runtimeEditorState.viewY * scale;
                const vw = Math.min(176, visibleColumns * scale);
                const vh = Math.min(136, visibleRows * scale);
                this.bitmap.fillRect(vx, vy, vw, 2, "#ffffff");
                this.bitmap.fillRect(vx, vy + vh - 2, vw, 2, "#ffffff");
                this.bitmap.fillRect(vx, vy, 2, vh, "#ffffff");
                this.bitmap.fillRect(vx + vw - 2, vy, 2, vh, "#ffffff");
                this.visible = true;
            }

            update() { super.update(); this.refresh(); }
        }

        class Sprite_HybridEditorEventLabels extends Sprite {
            constructor() {
                super(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
                this._lastKey = "";
                this.visible = false;
            }

            eventData() {
                if (runtimeEditorState.remoteMapId) {
                    return (runtimeEditorState.remoteSnapshot && runtimeEditorState.remoteSnapshot.events || [])
                        .filter(Boolean).map(event => ({
                            id: event.id,
                            name: event.name || "Event",
                            x: event.x,
                            y: event.y,
                            spawned: isHybridEventData(event)
                        }));
                }
                return $gameMap.events().map(event => ({
                    id: event.eventId(),
                    name: event.event() ? event.event().name || "Event" : "Event",
                    x: event.x,
                    y: event.y,
                    spawned: isHybridGameEvent(event)
                }));
            }

            refresh() {
                if (!runtimeEditorState.active || !this.bitmap) {
                    this.visible = false;
                    return;
                }
                const events = this.eventData();
                const key = JSON.stringify([
                    editorMapId(), runtimeEditorState.viewX, runtimeEditorState.viewY,
                    runtimeEditorState.selectedEventId,
                    events.map(event => [event.id, event.x, event.y, event.name, event.spawned])
                ]);
                if (key === this._lastKey) {
                    this.visible = true;
                    return;
                }
                this._lastKey = key;
                this.bitmap.clear();
                if (typeof this.bitmap.drawText !== "function") {
                    this.visible = true;
                    return;
                }
                const tw = editorTileWidth();
                const th = editorTileHeight();
                for (const event of events) {
                    const sx = editorScreenX(event.x);
                    const sy = editorScreenY(event.y);
                    if (sx < -tw || sy < -th || sx >= Graphics.boxWidth || sy >= Graphics.boxHeight) continue;
                    const selected = runtimeEditorState.selectedEventId === event.id;
                    const color = selected ? "rgba(255,209,102,0.88)" : event.spawned
                        ? "rgba(102,224,255,0.82)" : "rgba(20,20,24,0.78)";
                    this.bitmap.fillRect(sx, sy, tw, Math.min(20, th), color);
                    this.bitmap.drawText(`${event.spawned ? "S" : "E"}${event.id} ${event.name}`,
                        sx + 2, sy - 7, Math.max(tw * 3, 160), 36, "left");
                }
                this.visible = true;
            }

            update() {
                super.update();
                this.refresh();
            }
        }

        class Window_HybridEditorStatus extends Window_Base {
            refresh() {
                if (!this.contents) return;
                this.contents.clear();
                const state = runtimeEditorState;
                this.drawText(`HybridTileGraft v${VERSION} — ${state.tool.toUpperCase()}${state.pending ? " (working…)" : ""}`, 0, 0, this.innerWidth);
                this.drawText(`Map ${editorMapId()}${state.remoteMapId ? " (REMOTE)" : ""}  X:${state.cursorX} Y:${state.cursorY}  ${state.layer}  Value:${editorValueLabel()}`, 0, this.lineHeight(), this.innerWidth);
                const transaction = editTransactionState();
                this.drawText(`${state.mode.toUpperCase()}  Brush:${state.brushSize}  Zoom:${Math.round(state.zoom * 100)}%  ${state.layerLocks[state.layer] ? "LOCKED" : "EDIT"}  ${state.persist ? "COMMIT" : "DISCARD"}  Changes:${transaction ? transaction.changeCount : 0}  ${state.message}`, 0, this.lineHeight() * 2, this.innerWidth);
            }
        }

        class Window_HybridEditorHelp extends Window_Base {
            refresh() {
                if (!this.contents) return;
                this.contents.clear();
                this.drawText("Arrows/Mouse: move  OK/Click: apply  PgUp/PgDn: layer  Tab: tools  G: tile palette  I: pick  P: prefabs", 0, 0, this.innerWidth);
                this.drawText("R: rectangle  C/V: copy/paste  E: erase  B: size  +/-: zoom  M: mode  S: commit/discard  F/H: mirror/rotate  U/Y: undo/redo", 0, this.lineHeight(), this.innerWidth);
            }
        }

        class Window_HybridEditorCommand extends Window_Command {
            makeCommandList() {
                this.addCommand("Paint Brush", "paint");
                this.addCommand("Rectangle Fill", "rectangle");
                this.addCommand("Rectangle Outline", "outline");
                this.addCommand("Line", "line");
                this.addCommand("Circle", "circle");
                this.addCommand("Flood Fill", "flood");
                this.addCommand("Replace Matching", "replace");
                this.addCommand("Weighted Random Brush", "random");
                this.addCommand("Weighted Random Rectangle", "randomRectangle");
                this.addCommand("Erase", "erase");
                this.addCommand("Eyedropper", "eyedropper");
                this.addCommand("Graphical Tile Palette", "palette");
                this.addCommand("Autotile Shape (0-47)", "autotileShape", Tilemap.isAutotile(runtimeEditorState.tileId));
                this.addCommand("Prefab Browser", "prefabs");
                this.addCommand("Capture New Prefab", "capturePrefab");
                this.addCommand("Select Area", "select");
                this.addCommand("Copy Area", "copy");
                this.addCommand("Copy Selection", "copySelection", !!editorSelectedRect());
                this.addCommand("Paste Clipboard", "paste", !!runtimeClipboard);
                this.addCommand("Cut Selection", "cutSelection", !!editorSelectedRect());
                this.addCommand("Delete Selection", "deleteSelection", !!editorSelectedRect());
                this.addCommand("Rotate Selection", "rotateSelection", !!editorSelectedRect());
                this.addCommand("Event Select / Move", "event");
                this.addCommand("Delete Spawned Event Here", "deleteEvent");
                this.addCommand("Set Tile ID / Code", "tile");
                this.addCommand("Set Brush Size", "brush");
                this.addCommand(`Mode: ${runtimeEditorState.mode}`, "mode");
                this.addCommand(`Close behavior: ${runtimeEditorState.persist ? "commit" : "discard"}`, "persist");
                this.addCommand(`Rotate stamp: ${runtimeEditorState.rotation}°`, "rotate");
                this.addCommand(`Mirror stamp: ${runtimeEditorState.mirrorX ? "ON" : "OFF"}`, "mirror");
                this.addCommand(`Zoom: ${Math.round(runtimeEditorState.zoom * 100)}%`, "zoom");
                this.addCommand(`Grid: ${runtimeEditorState.grid ? "ON" : "OFF"}`, "grid");
                this.addCommand(`Overlay: ${runtimeEditorState.overlay}`, "overlay");
                this.addCommand(`Layer ${runtimeEditorState.layer}: ${runtimeEditorState.layerVisibility[runtimeEditorState.layer] === false ? "HIDDEN" : "VISIBLE"}`, "layerVisible");
                this.addCommand(`Layer ${runtimeEditorState.layer}: ${runtimeEditorState.layerLocks[runtimeEditorState.layer] ? "LOCKED" : "UNLOCKED"}`, "layerLock");
                this.addCommand(`Layer ${runtimeEditorState.layer} opacity: ${Math.round(finiteNumber(runtimeEditorState.layerOpacity[runtimeEditorState.layer], 1) * 100)}%`, "layerOpacity");
                this.addCommand("Isolate Current Layer", "layerIsolate");
                this.addCommand("Show All Layers", "layerShowAll");
                this.addCommand("Save Brush Preset", "saveBrushPreset");
                this.addCommand("Load Brush Preset", "loadBrushPreset", listBrushPresets().length > 0);
                this.addCommand("Map Browser", "mapBrowser");
                this.addCommand("Change Timeline", "timeline");
                this.addCommand("Checkpoint Manager", "checkpoints");
                this.addCommand("Visual Diff", "diff");
                this.addCommand("Project Exchange", "exchange");
                this.addCommand("Undo", "undo");
                this.addCommand("Redo", "redo");
                this.addCommand("Create Checkpoint", "checkpoint");
                this.addCommand("Commit Session", "commitEditor");
                this.addCommand("Discard Session", "cancelEditor");
                this.addCommand("Close Editor", "closeEditor");
            }
        }

        class Window_HybridPrefabBrowser extends Window_Selectable {
            initialize(rect) {
                super.initialize(rect);
                this._data = [];
                this._filterText = "";
                this.refresh();
            }

            maxItems() { return this._data ? this._data.length : 0; }
            item() { return this._data[this.index()] || null; }
            itemHeight() { return Math.max(64, super.itemHeight()); }

            setFilter(value) {
                this._filterText = String(value || "").trim().toLowerCase();
                this.refresh();
                this.select(this.maxItems() ? 0 : -1);
            }

            refresh() {
                const filter = this._filterText;
                this._data = listPrefabs().filter(item => !filter || [
                    item.name, item.category, item.description, ...(item.tags || [])
                ].some(value => String(value || "").toLowerCase().includes(filter)));
                super.refresh();
            }

            drawItem(index) {
                const item = this._data[index];
                if (!item) return;
                const rect = this.itemRect(index);
                drawPrefabThumbnail(this.contents, item, rect.x + 4, rect.y + 4, 48, () => this.refresh());
                const textX = rect.x + 60;
                const textWidth = rect.width - 64;
                this.drawText(`${item.favorite ? "★ " : ""}${item.name}`, textX, rect.y, Math.floor(textWidth * 0.58));
                this.drawText(`${item.category}  ${item.w}×${item.h}`, textX, rect.y, textWidth, "right");
                this.drawText(`Map ${item.mapId}  ${item.mode}  ${(item.tags || []).join(", ")}`, textX,
                    rect.y + this.lineHeight(), textWidth);
            }

            update() {
                super.update();
                if (!this.active) return;
                const item = this.item();
                if (Input.isTriggered("hybridPersist") && typeof window !== "undefined" && window.prompt) {
                    const value = window.prompt("Search prefab name, category, tag, or description", this._filterText);
                    if (value !== null) this.setFilter(value);
                }
                if (item && Input.isTriggered("hybridMirror")) {
                    favoritePrefab(item.name, item.mapId, !item.favorite);
                    this.refresh();
                }
                if (item && Input.isTriggered("hybridRectangle") && typeof window !== "undefined" && window.prompt) {
                    const value = window.prompt("Rename prefab", item.name);
                    if (value && value !== item.name) renamePrefab(item.name, item.mapId, value, true);
                    this.refresh();
                }
                if (item && Input.isTriggered("hybridCopy") && typeof window !== "undefined" && window.prompt) {
                    const value = window.prompt("Duplicate prefab as", `${item.name}_Copy`);
                    if (value) duplicatePrefab(item.name, item.mapId, value, true);
                    this.refresh();
                }
                if (item && Input.isTriggered("hybridErase")) {
                    const allowed = typeof window === "undefined" || !window.confirm || window.confirm(`Delete runtime prefab ${item.name}?`);
                    if (allowed) removePrefab(item.name, item.mapId);
                    this.refresh();
                }
            }
        }

        class Window_HybridTilePalette extends Window_Selectable {
            initialize(rect) {
                this._sheets = ["Recent", "Favorites", "A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"];
                this._sheetIndex = 7;
                this._data = [];
                this._filterText = "";
                this._terrainFilter = null;
                this._passabilityFilter = null;
                super.initialize(rect);
                this.refresh();
            }

            maxCols() { return 8; }
            itemHeight() { return $gameMap.tileHeight() + 28; }
            maxItems() { return this._data.length; }
            item() { return this._data[this.index()] ?? null; }
            sheet() { return this._sheets[this._sheetIndex]; }

            refresh() {
                const tileset = typeof $dataTilesets !== "undefined" && $dataTilesets ? $dataTilesets[editorTilesetId()] : null;
                const flags = tileset && tileset.flags || [];
                this._data = paletteTileIds(this.sheet()).filter(tileId => {
                    const flag = flags[tileId] || 0;
                    const terrain = flag >> 12 & 0x0f;
                    const passable = (flag & 0x0f) !== 0x0f;
                    const label = `${tileId} ${tileCodeFromId(tileId) || ""} ${Tilemap.isAutotile(tileId) ? `kind${Tilemap.getAutotileKind(tileId)}` : ""}`.toLowerCase();
                    if (this._filterText && !label.includes(this._filterText)) return false;
                    if (this._terrainFilter !== null && terrain !== this._terrainFilter) return false;
                    if (this._passabilityFilter !== null && passable !== this._passabilityFilter) return false;
                    return true;
                });
                super.refresh();
            }

            cycleSheet(delta) {
                this._sheetIndex = (this._sheetIndex + integer(delta) + this._sheets.length) % this._sheets.length;
                this.refresh();
                this.select(this.maxItems() ? 0 : -1);
                editorSetMessage(`Tile palette: ${this.sheet()}. PageUp/PageDown changes sheet.`);
            }

            drawItem(index) {
                const tileId = this._data[index];
                const rect = this.itemRect(index);
                const tw = $gameMap.tileWidth();
                const th = $gameMap.tileHeight();
                const dx = rect.x + Math.floor((rect.width - tw) / 2);
                const dy = rect.y;
                const drawn = drawTileGraphic(this.contents, tileId, dx, dy, () => this.refresh());
                if (!drawn) this.drawText(String(tileId), rect.x, dy, rect.width, "center");
                const label = Tilemap.isAutotile(tileId)
                    ? `K${Tilemap.getAutotileKind(tileId)}`
                    : (tileCodeFromId(tileId) || String(tileId));
                this.drawText(label, rect.x, dy + th, rect.width, "center");
            }

            update() {
                super.update();
                if (!this.active) return;
                if (Input.isTriggered("pageup")) this.cycleSheet(-1);
                if (Input.isTriggered("pagedown")) this.cycleSheet(1);
                if (Input.isTriggered("hybridPersist") && typeof window !== "undefined" && window.prompt) {
                    const value = window.prompt("Tile search (ID, code, or autotile kind; blank clears)", this._filterText);
                    if (value !== null) {
                        this._filterText = String(value).trim().toLowerCase();
                        this.refresh();
                        this.select(this.maxItems() ? 0 : -1);
                    }
                }
                if (Input.isTriggered("hybridPick") && typeof window !== "undefined" && window.prompt) {
                    const value = window.prompt("Filter: terrain 0-15, passable, blocked, or blank to clear", "");
                    if (value !== null) {
                        const text = String(value).trim().toLowerCase();
                        this._terrainFilter = /^\d+$/.test(text) ? Math.max(0, Math.min(15, integer(text))) : null;
                        this._passabilityFilter = text === "passable" ? true : text === "blocked" ? false : null;
                        this.refresh();
                        this.select(this.maxItems() ? 0 : -1);
                    }
                }
            }
        }

        class Window_HybridMapBrowser extends Window_Selectable {
            initialize(rect) {
                this._data = [];
                this._filterText = "";
                super.initialize(rect);
                this.refresh();
            }
            maxItems() { return this._data.length; }
            item() { return this._data[this.index()] || null; }
            setFilter(value) { this._filterText = String(value || "").trim().toLowerCase(); this.refresh(); }
            refresh() {
                const store = ensureStore();
                const query = this._filterText;
                this._data = (typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos : [])
                    .filter(info => info && (!query || String(info.name || "").toLowerCase().includes(query)))
                    .map(info => ({
                        id: info.id,
                        name: info.name || `Map ${info.id}`,
                        parentId: info.parentId || 0,
                        patches: (store.maps[String(info.id)] || []).length,
                        override: !!store.mapOverrides[String(info.id)],
                        checkpoints: Object.keys(store.checkpoints[String(info.id)] || {}).length
                    }));
                super.refresh();
            }
            drawItem(index) {
                const item = this._data[index];
                if (!item) return;
                const rect = this.itemLineRect(index);
                const marker = item.id === editorMapId() ? "▶ " : "  ";
                this.drawText(`${marker}${String(item.id).padStart(3, "0")}  ${item.name}`, rect.x, rect.y, Math.floor(rect.width * 0.62));
                this.drawText(`${item.override ? "FULL" : `${item.patches} patch${item.patches === 1 ? "" : "es"}`}  ${item.checkpoints} CP`,
                    rect.x, rect.y, rect.width, "right");
            }
        }

        class Window_HybridTimeline extends Window_Selectable {
            initialize(rect) { this._data = []; super.initialize(rect); this.refresh(); }
            maxItems() { return this._data.length; }
            item() { return this._data[this.index()] || null; }
            refresh() {
                const mapId = editorMapId();
                this._data = operationLog(300).filter(item => !item.mapId || integer(item.mapId) === mapId);
                super.refresh();
            }
            drawItem(index) {
                const item = this._data[index];
                if (!item) return;
                const rect = this.itemLineRect(index);
                const time = new Date(item.timestamp || 0).toLocaleTimeString();
                const detail = item.label || item.checkpoint || item.name || (item.rect ? `${item.rect.w}×${item.rect.h}` : "");
                this.drawText(`${time}  ${item.operation}${detail ? ` — ${detail}` : ""}`, rect.x, rect.y, rect.width);
            }
        }

        class Window_HybridCheckpoints extends Window_Selectable {
            initialize(rect) { this._data = []; super.initialize(rect); this.refresh(); }
            maxItems() { return this._data.length; }
            item() { return this._data[this.index()] || null; }
            refresh() { this._data = listCheckpoints(editorMapId()); super.refresh(); }
            drawItem(index) {
                const item = this._data[index];
                if (!item) return;
                const rect = this.itemLineRect(index);
                this.drawText(`${item.automatic ? "AUTO" : "SAVE"}  ${item.name}`, rect.x, rect.y, Math.floor(rect.width * 0.72));
                this.drawText(new Date(item.createdAt).toLocaleString(), rect.x, rect.y, rect.width, "right");
            }
        }

        class Window_HybridDiff extends Window_Selectable {
            initialize(rect) { this._data = []; this._report = null; super.initialize(rect); }
            maxItems() { return this._data.length; }
            setReport(report) {
                this._report = report;
                this._data = report ? (report.cells || []).slice(0, 500) : [];
                this.refresh();
            }
            drawItem(index) {
                const item = this._data[index];
                if (!item) return;
                const rect = this.itemLineRect(index);
                const changes = item.changes.map(change => `${change.layer}:${change.before}→${change.after}`).join("  ");
                this.drawText(`(${item.x},${item.y})  ${changes}`, rect.x, rect.y, rect.width);
            }
        }

        class Window_HybridExchange extends Window_Command {
            makeCommandList() {
                this.addCommand("Export Workspace Bundle", "exportWorkspace");
                this.addCommand("Import Workspace JSON", "importWorkspace");
                this.addCommand("Export Patch Pack", "exportPatches");
                this.addCommand("Import Patch Pack JSON", "importPatches");
                this.addCommand("Export Prefab Pack", "exportPrefabs");
                this.addCommand("Export Event Templates", "exportTemplates");
                this.addCommand("Validate Project Data", "validate");
                this.addCommand("Repair Project Data", "repair");
                this.addCommand("Close", "cancel");
            }
        }

        const aliasCreateAllWindows = Scene_Map.prototype.createAllWindows;
        Scene_Map.prototype.createAllWindows = function() {
            aliasCreateAllWindows.call(this);
            const statusHeight = 144;
            const helpHeight = 108;
            this._hybridEditorStatus = new Window_HybridEditorStatus(new Rectangle(0, 0, Math.min(Graphics.boxWidth, 720), statusHeight));
            this._hybridEditorHelp = new Window_HybridEditorHelp(new Rectangle(0, Graphics.boxHeight - helpHeight, Graphics.boxWidth, helpHeight));
            const commandWidth = Math.min(420, Graphics.boxWidth - 40);
            const commandHeight = Math.min(Graphics.boxHeight - 80, 560);
            this._hybridEditorCommand = new Window_HybridEditorCommand(new Rectangle(
                Math.floor((Graphics.boxWidth - commandWidth) / 2),
                Math.floor((Graphics.boxHeight - commandHeight) / 2),
                commandWidth,
                commandHeight
            ));
            const prefabWidth = Math.min(620, Graphics.boxWidth - 40);
            const prefabHeight = Math.min(500, Graphics.boxHeight - 80);
            this._hybridPrefabBrowser = new Window_HybridPrefabBrowser(new Rectangle(
                Math.floor((Graphics.boxWidth - prefabWidth) / 2),
                Math.floor((Graphics.boxHeight - prefabHeight) / 2),
                prefabWidth,
                prefabHeight
            ));
            const paletteWidth = Math.min(720, Graphics.boxWidth - 40);
            const paletteHeight = Math.min(560, Graphics.boxHeight - 60);
            this._hybridTilePalette = new Window_HybridTilePalette(new Rectangle(
                Math.floor((Graphics.boxWidth - paletteWidth) / 2),
                Math.floor((Graphics.boxHeight - paletteHeight) / 2),
                paletteWidth,
                paletteHeight
            ));
            const studioWidth = Math.min(720, Graphics.boxWidth - 40);
            const studioHeight = Math.min(500, Graphics.boxHeight - 80);
            const studioRect = () => new Rectangle(
                Math.floor((Graphics.boxWidth - studioWidth) / 2),
                Math.floor((Graphics.boxHeight - studioHeight) / 2),
                studioWidth,
                studioHeight
            );
            this._hybridMapBrowser = new Window_HybridMapBrowser(studioRect());
            this._hybridTimeline = new Window_HybridTimeline(studioRect());
            this._hybridCheckpoints = new Window_HybridCheckpoints(studioRect());
            this._hybridDiff = new Window_HybridDiff(studioRect());
            this._hybridExchange = new Window_HybridExchange(new Rectangle(
                Math.floor((Graphics.boxWidth - Math.min(480, Graphics.boxWidth - 40)) / 2),
                Math.floor((Graphics.boxHeight - studioHeight) / 2),
                Math.min(480, Graphics.boxWidth - 40),
                studioHeight
            ));
            for (const windowObject of [
                this._hybridEditorStatus, this._hybridEditorHelp, this._hybridEditorCommand,
                this._hybridPrefabBrowser, this._hybridTilePalette, this._hybridMapBrowser,
                this._hybridTimeline, this._hybridCheckpoints, this._hybridDiff, this._hybridExchange
            ]) {
                windowObject.hide();
                windowObject.deactivate();
                this.addWindow(windowObject);
            }
            this._hybridEditorCursor = new Sprite_HybridEditorCursor();
            this._hybridEditorEventLabels = new Sprite_HybridEditorEventLabels();
            this._hybridEditorGhost = new Sprite_HybridEditorGhost();
            this._hybridEditorOverlay = new Sprite_HybridEditorOverlay();
            this._hybridEditorMinimap = new Sprite_HybridEditorMinimap();
            const windowIndex = this.children.indexOf(this._windowLayer);
            for (const sprite of [this._hybridEditorGhost, this._hybridEditorOverlay,
                this._hybridEditorCursor, this._hybridEditorEventLabels, this._hybridEditorMinimap]) {
                this.addChildAt(sprite, Math.max(0, this.children.indexOf(this._windowLayer)));
            }
            this.createHybridEditorHandlers();
        };

        Scene_Map.prototype.ensureHybridRemoteMap = function() {
            const editorOverlayIndex = () => {
                const windowIndex = this.children.indexOf(this._windowLayer);
                const indices = [this._hybridEditorGhost, this._hybridEditorOverlay, this._hybridEditorCursor,
                    this._hybridEditorEventLabels, this._hybridEditorMinimap]
                    .map(sprite => this.children.indexOf(sprite)).filter(index => index >= 0);
                indices.push(windowIndex >= 0 ? windowIndex : this.children.length);
                return Math.max(0, Math.min(...indices));
            };
            if (!this._hybridRemoteBackdrop) {
                this._hybridRemoteBackdrop = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
                if (this._hybridRemoteBackdrop.bitmap && this._hybridRemoteBackdrop.bitmap.fillRect) {
                    this._hybridRemoteBackdrop.bitmap.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight, "#101318");
                }
                this._hybridRemoteBackdrop.visible = false;
                this.addChildAt(this._hybridRemoteBackdrop, editorOverlayIndex());
            }
            if (!this._hybridRemoteTilemap && typeof Tilemap === "function") {
                this._hybridRemoteTilemap = new Tilemap();
                this._hybridRemoteTilemap.visible = false;
                this.addChildAt(this._hybridRemoteTilemap, editorOverlayIndex());
            }
            return this._hybridRemoteTilemap || null;
        };

        Scene_Map.prototype.ensureHybridLayerPreview = function() {
            if (this._hybridLayerTilemaps) return this._hybridLayerTilemaps;
            this._hybridLayerTilemaps = [];
            if (typeof Tilemap !== "function") return this._hybridLayerTilemaps;
            const reference = this._hybridRemoteTilemap || this._hybridEditorGhost || this._windowLayer;
            const baseIndex = Math.max(0, this.children.indexOf(reference));
            for (let z = 0; z < 5; z++) {
                const tilemap = new Tilemap();
                tilemap.visible = false;
                tilemap.alpha = 1;
                tilemap.scale ||= { x: 1, y: 1 };
                this.addChildAt(tilemap, baseIndex + z);
                this._hybridLayerTilemaps.push(tilemap);
            }
            return this._hybridLayerTilemaps;
        };

        Scene_Map.prototype.configureHybridEditorTilemap = function(tilemap, snapshot, data) {
            if (!tilemap || !snapshot) return false;
            if (typeof tilemap.setData === "function") tilemap.setData(snapshot.width, snapshot.height, data || snapshot.data);
            tilemap.tileWidth = $gameMap.tileWidth();
            tilemap.tileHeight = $gameMap.tileHeight();
            tilemap.horizontalWrap = false;
            tilemap.verticalWrap = false;
            const tileset = typeof $dataTilesets !== "undefined" && $dataTilesets ? $dataTilesets[snapshot.tilesetId] : null;
            if (tileset) {
                if (typeof ImageManager !== "undefined" && ImageManager.loadTileset && typeof tilemap.setBitmaps === "function") {
                    tilemap.setBitmaps((tileset.tilesetNames || []).map(name => ImageManager.loadTileset(name)));
                }
                tilemap.flags = tileset.flags || [];
            }
            tilemap.origin ||= { x: 0, y: 0 };
            tilemap.origin.x = runtimeEditorState.viewX * $gameMap.tileWidth();
            tilemap.origin.y = runtimeEditorState.viewY * $gameMap.tileHeight();
            tilemap.scale ||= { x: 1, y: 1 };
            tilemap.scale.x = runtimeEditorState.zoom;
            tilemap.scale.y = runtimeEditorState.zoom;
            if (typeof tilemap.refresh === "function") tilemap.refresh();
            return true;
        };

        Scene_Map.prototype.refreshHybridLayerPreview = function() {
            if (!runtimeEditorState.active) return false;
            const required = editorLayerPreviewRequired();
            const layers = this.ensureHybridLayerPreview();
            const snapshot = editorMapData();
            if (!required || !snapshot) {
                for (const tilemap of layers) tilemap.visible = false;
                if (!runtimeEditorState.remoteMapId && this._spriteset) this._spriteset.visible = true;
                if (runtimeEditorState.remoteMapId && this._hybridRemoteTilemap) this._hybridRemoteTilemap.visible = true;
                return false;
            }
            if (!runtimeEditorState.remoteMapId && this._spriteset) this._spriteset.visible = false;
            if (this._hybridRemoteTilemap) this._hybridRemoteTilemap.visible = false;
            if (this._hybridRemoteBackdrop) this._hybridRemoteBackdrop.visible = !!runtimeEditorState.remoteMapId;
            for (let z = 0; z < layers.length; z++) {
                const layer = `L${z + 1}`;
                const tilemap = layers[z];
                this.configureHybridEditorTilemap(tilemap, snapshot, editorLayerData(layer, snapshot));
                tilemap.alpha = finiteNumber(runtimeEditorState.layerOpacity[layer], 1);
                tilemap.visible = runtimeEditorState.layerVisibility[layer] !== false && tilemap.alpha > 0;
            }
            return true;
        };

        Scene_Map.prototype.showHybridRemoteMap = function(snapshot = runtimeEditorState.remoteSnapshot) {
            if (!snapshot) return false;
            const tilemap = this.ensureHybridRemoteMap();
            if (!tilemap) return false;
            this.configureHybridEditorTilemap(tilemap, snapshot, snapshot.data);
            tilemap.visible = true;
            if (this._hybridRemoteBackdrop) this._hybridRemoteBackdrop.visible = true;
            this.refreshHybridLayerPreview();
            if (this._hybridEditorEventLabels) this._hybridEditorEventLabels.refresh();
            return true;
        };

        Scene_Map.prototype.refreshHybridRemoteMap = function() {
            const snapshot = runtimeEditorState.remoteSnapshot;
            const tilemap = this._hybridRemoteTilemap;
            if (!snapshot || !tilemap) return false;
            this.configureHybridEditorTilemap(tilemap, snapshot, snapshot.data);
            this.refreshHybridLayerPreview();
            return true;
        };

        Scene_Map.prototype.hideHybridRemoteMap = function() {
            if (this._hybridRemoteTilemap) this._hybridRemoteTilemap.visible = false;
            if (this._hybridRemoteBackdrop) this._hybridRemoteBackdrop.visible = false;
            for (const tilemap of this._hybridLayerTilemaps || []) tilemap.visible = false;
        };

        Scene_Map.prototype.createHybridEditorHandlers = function() {
            const command = this._hybridEditorCommand;
            const chooseTool = symbol => {
                editorSetTool(symbol, this);
                this.closeHybridEditorCommand();
            };
            for (const symbol of [
                "paint", "rectangle", "outline", "line", "circle", "flood", "replace",
                "erase", "eyedropper", "select", "copy", "paste", "event", "capturePrefab"
            ]) {
                command.setHandler(symbol, () => chooseTool(symbol));
            }
            command.setHandler("random", () => {
                editorPromptWeightedTiles(this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("randomRectangle", () => {
                if (editorPromptWeightedTiles(this)) editorSetTool("randomRectangle", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("prefabs", () => {
                this.closeHybridEditorCommand();
                this.openHybridPrefabBrowser();
            });
            command.setHandler("palette", () => {
                this.closeHybridEditorCommand();
                this.openHybridTilePalette();
            });
            command.setHandler("autotileShape", () => { editorPromptAutotileShape(this); this.closeHybridEditorCommand(); });
            command.setHandler("tile", () => { editorPromptTile(this); this.closeHybridEditorCommand(); });
            command.setHandler("brush", () => { editorPromptBrushSize(this); this.closeHybridEditorCommand(); });
            command.setHandler("mode", () => {
                runtimeEditorState.mode = runtimeEditorState.mode === "exact" ? "autotile" : "exact";
                editorSetMessage(`Mode: ${runtimeEditorState.mode}.`, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("persist", () => {
                runtimeEditorState.persist = !runtimeEditorState.persist;
                editorSetMessage(runtimeEditorState.persist ? "Session will commit on close." : "Session will be discarded on close.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("rotate", () => {
                runtimeEditorState.rotation = (runtimeEditorState.rotation + 90) % 360;
                editorSetMessage(`Stamp rotation: ${runtimeEditorState.rotation}°.`, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("mirror", () => {
                runtimeEditorState.mirrorX = !runtimeEditorState.mirrorX;
                editorSetMessage(`Horizontal mirror: ${runtimeEditorState.mirrorX ? "on" : "off"}.`, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("cutSelection", () => {
                editorSetMessage(cutEditorSelection({}, this) ? "Selection cut to clipboard." : "Select an area first.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("copySelection", () => {
                const result = copyEditorSelection();
                if (result) runtimeEditorState.tool = "paste";
                editorSetMessage(result ? "Selection copied; Paste tool selected." : "Select an area first.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("deleteSelection", () => {
                editorSetMessage(deleteEditorSelection({}, this) ? "Selection deleted." : "Select an area first.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("rotateSelection", () => {
                editorSetMessage(transformEditorSelection({ rotation: 90, label: "Rotate Selection" }, this)
                    ? "Selection rotated 90°." : "Select an area first.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("zoom", () => {
                const value = typeof window !== "undefined" && window.prompt
                    ? window.prompt("Editor zoom percent (25-400)", String(Math.round(runtimeEditorState.zoom * 100))) : null;
                if (value !== null) setEditorZoom(Math.max(25, Math.min(400, finiteNumber(value, 100))) / 100, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("grid", () => {
                runtimeEditorState.grid = !runtimeEditorState.grid;
                ensureStore().editorPreferences.grid = runtimeEditorState.grid;
                editorSetMessage(`Grid ${runtimeEditorState.grid ? "enabled" : "disabled"}.`, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("overlay", () => {
                const value = typeof window !== "undefined" && window.prompt
                    ? window.prompt("Overlay: none, region, shadow, terrain, collision, passability, changes, grid", runtimeEditorState.overlay) : null;
                if (value !== null) setEditorOverlay(value, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("layerVisible", () => {
                setEditorLayerState(runtimeEditorState.layer,
                    { visible: runtimeEditorState.layerVisibility[runtimeEditorState.layer] === false }, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("layerLock", () => {
                setEditorLayerState(runtimeEditorState.layer,
                    { locked: !runtimeEditorState.layerLocks[runtimeEditorState.layer] }, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("layerOpacity", () => {
                const current = Math.round(finiteNumber(runtimeEditorState.layerOpacity[runtimeEditorState.layer], 1) * 100);
                const value = typeof window !== "undefined" && window.prompt
                    ? window.prompt("Layer opacity percent (0-100)", String(current)) : null;
                if (value !== null) setEditorLayerState(runtimeEditorState.layer,
                    { opacity: Math.max(0, Math.min(100, finiteNumber(value, current))) / 100 }, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("layerIsolate", () => { isolateEditorLayer(runtimeEditorState.layer, this); this.closeHybridEditorCommand(); });
            command.setHandler("layerShowAll", () => { showAllEditorLayers(this); this.closeHybridEditorCommand(); });
            command.setHandler("saveBrushPreset", () => {
                const name = typeof window !== "undefined" && window.prompt ? window.prompt("Brush preset name", runtimeEditorState.brushPreset || "") : null;
                if (name) captureBrushPreset(name);
                editorSetMessage(name ? `Saved brush preset: ${name}.` : "Preset save cancelled.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("loadBrushPreset", () => {
                const names = listBrushPresets().map(item => item.name);
                const name = typeof window !== "undefined" && window.prompt
                    ? window.prompt(`Brush preset (${names.join(", ")})`, names[0] || "") : null;
                if (name) applyBrushPreset(name, this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("mapBrowser", () => { this.closeHybridEditorCommand(); this.openHybridMapBrowser(); });
            command.setHandler("timeline", () => { this.closeHybridEditorCommand(); this.openHybridTimeline(); });
            command.setHandler("checkpoints", () => { this.closeHybridEditorCommand(); this.openHybridCheckpoints(); });
            command.setHandler("diff", () => { this.closeHybridEditorCommand(); this.openHybridDiff(); });
            command.setHandler("exchange", () => { this.closeHybridEditorCommand(); this.openHybridExchange(); });
            command.setHandler("deleteEvent", () => {
                if (runtimeEditorState.remoteMapId) {
                    editorSetMessage(editorDeleteRemoteSpawnedEvent(this)
                        ? "Deleted remote spawned event." : "No remote spawned event here.", this);
                    this.closeHybridEditorCommand();
                    return;
                }
                const event = eventInfoAt(runtimeEditorState.cursorX, runtimeEditorState.cursorY).find(item => item.spawned);
                editorSetMessage(event && deleteSpawnedEvent(event.id, true) ? `Deleted spawned event ${event.id}.` : "No spawned event here.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("checkpoint", () => {
                const name = typeof window !== "undefined" && window.prompt
                    ? window.prompt("Checkpoint name", `Checkpoint ${new Date().toLocaleTimeString()}`)
                    : "Checkpoint";
                if (name) createCheckpoint(name, editorMapId());
                editorSetMessage(name ? `Checkpoint created: ${name}.` : "Checkpoint cancelled.", this);
                this.closeHybridEditorCommand();
            });
            command.setHandler("undo", () => { editorSetMessage(editorUndo(this) ? "Undo complete." : "Session boundary reached.", this); this.closeHybridEditorCommand(); });
            command.setHandler("redo", () => { editorSetMessage(editorRedo(this) ? "Redo complete." : "Nothing to redo.", this); this.closeHybridEditorCommand(); });
            command.setHandler("commitEditor", () => this.closeHybridTileEditor(true));
            command.setHandler("cancelEditor", () => this.closeHybridTileEditor(false));
            command.setHandler("closeEditor", () => this.closeHybridTileEditor(runtimeEditorState.persist));
            command.setHandler("cancel", () => this.closeHybridEditorCommand());
            this._hybridPrefabBrowser.setHandler("ok", () => {
                const prefab = this._hybridPrefabBrowser.item();
                if (prefab) {
                    if (Input.isPressed("shift")) {
                        favoritePrefab(prefab.name, prefab.mapId, !prefab.favorite);
                        this._hybridPrefabBrowser.refresh();
                        editorSetMessage(`${prefab.favorite ? "Removed from" : "Added to"} prefab favorites.`, this);
                        return;
                    }
                    runtimeEditorState.selectedPrefab = prefab;
                    runtimeEditorState.tool = "prefab";
                    runtimeEditorState.selectionStart = null;
                    editorSetMessage(`Prefab selected: ${prefab.name}.`, this);
                }
                this.closeHybridPrefabBrowser();
            });
            this._hybridPrefabBrowser.setHandler("cancel", () => this.closeHybridPrefabBrowser());
            this._hybridTilePalette.setHandler("ok", () => {
                const tileId = this._hybridTilePalette.item();
                if (tileId !== null) {
                    runtimeEditorState.tileId = tileId;
                    if (LAYER_INDEX[runtimeEditorState.layer] > 3) runtimeEditorState.layer = "L1";
                    recordRecentTile(tileId, runtimeEditorState.layer);
                    if (Input.isPressed("shift")) favoriteTile(tileId, !ensureStore().favoriteTiles[String(tileId)]);
                    runtimeEditorState.tool = "paint";
                    editorSetMessage(`Selected ${editorValueLabel()}.`, this);
                }
                this.closeHybridTilePalette();
            });
            this._hybridTilePalette.setHandler("cancel", () => this.closeHybridTilePalette());
            this._hybridMapBrowser.setHandler("ok", () => {
                const map = this._hybridMapBrowser.item();
                if (!map) return;
                this.closeHybridMapBrowser();
                openRemoteMapEditor(map.id, { studio: true, persist: runtimeEditorState.persist })
                    .then(opened => editorSetMessage(opened ? `Opened map ${map.id}: ${map.name}.` : "Map could not be opened.", this))
                    .catch(error => editorSetMessage(error.message, this));
            });
            this._hybridMapBrowser.setHandler("cancel", () => this.closeHybridMapBrowser());
            this._hybridTimeline.setHandler("cancel", () => this.closeHybridTimeline());
            this._hybridCheckpoints.setHandler("ok", () => {
                const checkpoint = this._hybridCheckpoints.item();
                if (!checkpoint) return;
                const allowed = typeof window === "undefined" || !window.confirm || window.confirm(`Restore checkpoint "${checkpoint.name}"?`);
                if (allowed && restoreCheckpoint(checkpoint.name, editorMapId())) {
                    if (runtimeEditorState.remoteMapId) refreshRemoteEditorFromHistory(this);
                    editorSetMessage(`Restored checkpoint: ${checkpoint.name}.`, this);
                }
                this.closeHybridCheckpoints();
            });
            this._hybridCheckpoints.setHandler("cancel", () => this.closeHybridCheckpoints());
            this._hybridDiff.setHandler("cancel", () => this.closeHybridDiff());
            const exchange = this._hybridExchange;
            exchange.setHandler("exportWorkspace", () => {
                downloadJson(`HybridTileGraft_Workspace_${Date.now()}.json`, exportWorkspaceBundle());
                editorSetMessage("Workspace export prepared.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("importWorkspace", () => {
                const text = typeof window !== "undefined" && window.prompt ? window.prompt("Paste HybridTileGraft workspace JSON") : null;
                const result = text ? importWorkspaceBundle(text, { conflictPolicy: "merge", checkpoint: true }) : false;
                editorSetMessage(result ? "Workspace imported." : "Workspace import cancelled or invalid.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("exportPatches", () => {
                downloadJson(`HybridTileGraft_Patches_${Date.now()}.json`, exportPatchPack());
                editorSetMessage("Patch pack export prepared.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("importPatches", () => {
                const text = typeof window !== "undefined" && window.prompt ? window.prompt("Paste HybridTileGraft patch-pack JSON") : null;
                const result = text ? importPatchPack(text, { conflictPolicy: "merge", checkpoint: true }) : false;
                if (result && runtimeEditorState.remoteMapId) refreshRemoteEditorFromHistory(this);
                editorSetMessage(result ? "Patch pack imported." : "Patch import cancelled or invalid.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("exportPrefabs", () => {
                downloadJson(`HybridTileGraft_Prefabs_${Date.now()}.json`, exportPrefabPack());
                editorSetMessage("Prefab pack export prepared.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("exportTemplates", () => {
                downloadJson(`HybridTileGraft_EventTemplates_${Date.now()}.json`, exportEventTemplatePack());
                editorSetMessage("Event-template export prepared.", this);
                this.closeHybridExchange();
            });
            exchange.setHandler("validate", () => {
                const report = validateStore({ repair: false });
                editorSetMessage(report.ok ? "Project data is valid." : `${report.issueCount} validation issue(s) found.`, this);
                this.closeHybridExchange();
            });
            exchange.setHandler("repair", () => {
                const report = validateStore({ repair: true });
                editorSetMessage(`Repair complete: ${report.fixes} fix(es).`, this);
                this.closeHybridExchange();
            });
            exchange.setHandler("cancel", () => this.closeHybridExchange());
        };

        Scene_Map.prototype.openHybridTileEditor = function() {
            runtimeEditorState.active = true;
            if (typeof $gameTemp !== "undefined" && $gameTemp && $gameTemp.clearDestination) $gameTemp.clearDestination();
            this._hybridEditorStatus.show();
            this._hybridEditorHelp.show();
            this._hybridEditorStatus.refresh();
            this._hybridEditorHelp.refresh();
            this._hybridEditorCursor.refresh();
            return true;
        };

        Scene_Map.prototype.closeHybridTileEditor = function(commit = runtimeEditorState.persist, force = false) {
            if (runtimeEditorState.pending && !force) {
                editorSetMessage("Please wait for the active prefab operation to finish.", this);
                return false;
            }
            const wasRemote = runtimeEditorState.remoteMapId;
            if (activeEditTransaction) {
                if (commit) commitEditTransaction(true);
                else cancelEditTransaction();
            }
            runtimeEditorState.active = false;
            runtimeEditorState.selectionStart = null;
            this.closeHybridEditorCommand();
            this.closeHybridPrefabBrowser();
            this.closeHybridTilePalette();
            this.closeHybridMapBrowser();
            this.closeHybridTimeline();
            this.closeHybridCheckpoints();
            this.closeHybridDiff();
            this.closeHybridExchange();
            if (this._hybridEditorStatus) this._hybridEditorStatus.hide();
            if (this._hybridEditorHelp) this._hybridEditorHelp.hide();
            if (this._hybridEditorCursor) this._hybridEditorCursor.visible = false;
            if (this._hybridEditorEventLabels) this._hybridEditorEventLabels.visible = false;
            if (this._hybridEditorGhost) this._hybridEditorGhost.visible = false;
            if (this._hybridEditorOverlay) this._hybridEditorOverlay.visible = false;
            if (this._hybridEditorMinimap) this._hybridEditorMinimap.visible = false;
            for (const tilemap of this._hybridLayerTilemaps || []) tilemap.visible = false;
            if (this._spriteset) {
                this._spriteset.visible = true;
                if (this._spriteset.scale) {
                    this._spriteset.scale.x = 1;
                    this._spriteset.scale.y = 1;
                }
            }
            if (!wasRemote && $gameMap.setDisplayPos) {
                $gameMap.setDisplayPos(runtimeEditorState.previousDisplayX || 0, runtimeEditorState.previousDisplayY || 0);
            }
            if (wasRemote && this.hideHybridRemoteMap) this.hideHybridRemoteMap();
            runtimeEditorState.remoteMapId = 0;
            runtimeEditorState.remoteSnapshot = null;
            return true;
        };

        Scene_Map.prototype.openHybridEditorCommand = function() {
            const command = this._hybridEditorCommand;
            command.refresh();
            command.show();
            command.activate();
            command.select(0);
        };

        Scene_Map.prototype.closeHybridEditorCommand = function() {
            if (!this._hybridEditorCommand) return;
            this._hybridEditorCommand.hide();
            this._hybridEditorCommand.deactivate();
        };

        Scene_Map.prototype.openHybridPrefabBrowser = function() {
            const browser = this._hybridPrefabBrowser;
            browser.refresh();
            browser.show();
            browser.activate();
            browser.select(browser.maxItems() ? 0 : -1);
            editorSetMessage("Prefab browser: S search, F favorite, R rename, C duplicate, E delete.", this);
        };

        Scene_Map.prototype.closeHybridPrefabBrowser = function() {
            if (!this._hybridPrefabBrowser) return;
            this._hybridPrefabBrowser.hide();
            this._hybridPrefabBrowser.deactivate();
        };

        Scene_Map.prototype.openHybridTilePalette = function() {
            const palette = this._hybridTilePalette;
            palette.refresh();
            palette.show();
            palette.activate();
            palette.select(palette.maxItems() ? 0 : -1);
            editorSetMessage(`Tile palette: ${palette.sheet()}. PageUp/PageDown changes sheet.`, this);
        };

        Scene_Map.prototype.closeHybridTilePalette = function() {
            if (!this._hybridTilePalette) return;
            this._hybridTilePalette.hide();
            this._hybridTilePalette.deactivate();
        };

        Scene_Map.prototype.openHybridMapBrowser = function() {
            const windowObject = this._hybridMapBrowser;
            windowObject.refresh();
            windowObject.show();
            windowObject.activate();
            windowObject.select(windowObject.maxItems() ? 0 : -1);
            editorSetMessage("Map browser: choose any project map; Cancel returns to the canvas.", this);
        };
        Scene_Map.prototype.closeHybridMapBrowser = function() {
            if (!this._hybridMapBrowser) return;
            this._hybridMapBrowser.hide();
            this._hybridMapBrowser.deactivate();
        };
        Scene_Map.prototype.openHybridTimeline = function() {
            this._hybridTimeline.refresh();
            this._hybridTimeline.show();
            this._hybridTimeline.activate();
            this._hybridTimeline.select(this._hybridTimeline.maxItems() ? 0 : -1);
            editorSetMessage("Change timeline for the active map.", this);
        };
        Scene_Map.prototype.closeHybridTimeline = function() {
            if (!this._hybridTimeline) return;
            this._hybridTimeline.hide();
            this._hybridTimeline.deactivate();
        };
        Scene_Map.prototype.openHybridCheckpoints = function() {
            this._hybridCheckpoints.refresh();
            this._hybridCheckpoints.show();
            this._hybridCheckpoints.activate();
            this._hybridCheckpoints.select(this._hybridCheckpoints.maxItems() ? 0 : -1);
            editorSetMessage("Checkpoint manager: OK restores the selected checkpoint.", this);
        };
        Scene_Map.prototype.closeHybridCheckpoints = function() {
            if (!this._hybridCheckpoints) return;
            this._hybridCheckpoints.hide();
            this._hybridCheckpoints.deactivate();
        };
        Scene_Map.prototype.openHybridDiff = function() {
            const windowObject = this._hybridDiff;
            runtimeEditorState.pending = true;
            editorSetMessage("Building map diff…", this);
            diffMap(editorMapId()).then(report => {
                runtimeEditorState.pending = false;
                windowObject.setReport(report);
                windowObject.show();
                windowObject.activate();
                windowObject.select(windowObject.maxItems() ? 0 : -1);
                editorSetMessage(`Diff: ${report.changedCells} changed cells, ${report.addedSpawnedEvents.length} added spawned events.`, this);
            }).catch(error => {
                runtimeEditorState.pending = false;
                editorSetMessage(`Diff failed: ${error.message}`, this);
            });
        };
        Scene_Map.prototype.closeHybridDiff = function() {
            if (!this._hybridDiff) return;
            this._hybridDiff.hide();
            this._hybridDiff.deactivate();
        };
        Scene_Map.prototype.openHybridExchange = function() {
            this._hybridExchange.refresh();
            this._hybridExchange.show();
            this._hybridExchange.activate();
            this._hybridExchange.select(0);
            editorSetMessage("Project exchange: export, import, validate, or repair.", this);
        };
        Scene_Map.prototype.closeHybridExchange = function() {
            if (!this._hybridExchange) return;
            this._hybridExchange.hide();
            this._hybridExchange.deactivate();
        };

        Scene_Map.prototype.isHybridEditorModal = function() {
            return !!((this._hybridEditorCommand && this._hybridEditorCommand.visible) ||
                (this._hybridPrefabBrowser && this._hybridPrefabBrowser.visible) ||
                (this._hybridTilePalette && this._hybridTilePalette.visible) ||
                (this._hybridMapBrowser && this._hybridMapBrowser.visible) ||
                (this._hybridTimeline && this._hybridTimeline.visible) ||
                (this._hybridCheckpoints && this._hybridCheckpoints.visible) ||
                (this._hybridDiff && this._hybridDiff.visible) ||
                (this._hybridExchange && this._hybridExchange.visible));
        };

        Scene_Map.prototype.updateHybridTileEditor = function() {
            if (Input.isTriggered("hybridEditor")) {
                this.closeHybridTileEditor();
                return;
            }
            if (this.isHybridEditorModal()) return;
            if (Input.isTriggered("cancel")) {
                if (runtimeEditorState.selectionStart) {
                    runtimeEditorState.selectionStart = null;
                    editorSetMessage("Selection cancelled.", this);
                } else {
                    this.closeHybridTileEditor();
                }
                return;
            }
            if (Input.isTriggered("hybridMenu") || Input.isTriggered("tab")) return this.openHybridEditorCommand();
            if (Input.isRepeated("left")) editorMoveCursor(-1, 0, this);
            if (Input.isRepeated("right")) editorMoveCursor(1, 0, this);
            if (Input.isRepeated("up")) editorMoveCursor(0, -1, this);
            if (Input.isRepeated("down")) editorMoveCursor(0, 1, this);
            if (Input.isTriggered("pageup") || Input.isTriggered("pagedown")) {
                const current = LAYER_INDEX[runtimeEditorState.layer];
                const delta = Input.isTriggered("pageup") ? -1 : 1;
                runtimeEditorState.layer = `L${((current + delta + 6) % 6) + 1}`;
                if (!validateLayerValue(runtimeEditorState.tileId, runtimeEditorState.layer, editorTilesetId())) runtimeEditorState.tileId = 0;
                editorSetMessage(`Layer: ${runtimeEditorState.layer}.`, this);
            }
            if (Input.isTriggered("hybridTile")) editorPromptTile(this);
            if (Input.isTriggered("hybridBrush")) editorPromptBrushSize(this);
            if (Input.isTriggered("hybridPick")) editorEyedropper(this);
            if (Input.isTriggered("hybridPrefab")) this.openHybridPrefabBrowser();
            if (Input.isTriggered("hybridPalette")) this.openHybridTilePalette();
            if (Input.isTriggered("hybridRectangle")) editorSetTool("rectangle", this);
            if (Input.isTriggered("hybridCopy")) editorSetTool("copy", this);
            if (Input.isTriggered("hybridPaste")) editorSetTool("paste", this);
            if (Input.isTriggered("hybridErase")) editorSetTool("erase", this);
            if (Input.isTriggered("hybridZoomIn")) {
                setEditorZoom(runtimeEditorState.zoom * 1.25, this);
                editorSetMessage(`Zoom: ${Math.round(runtimeEditorState.zoom * 100)}%.`, this);
            }
            if (Input.isTriggered("hybridZoomOut")) {
                setEditorZoom(runtimeEditorState.zoom / 1.25, this);
                editorSetMessage(`Zoom: ${Math.round(runtimeEditorState.zoom * 100)}%.`, this);
            }
            if (Input.isTriggered("hybridRotate")) {
                runtimeEditorState.rotation = (runtimeEditorState.rotation + 90) % 360;
                editorSetMessage(`Stamp rotation: ${runtimeEditorState.rotation}°.`, this);
            }
            if (Input.isTriggered("hybridMirror")) {
                runtimeEditorState.mirrorX = !runtimeEditorState.mirrorX;
                editorSetMessage(`Horizontal mirror: ${runtimeEditorState.mirrorX ? "on" : "off"}.`, this);
            }
            if (Input.isTriggered("hybridMode")) {
                runtimeEditorState.mode = runtimeEditorState.mode === "exact" ? "autotile" : "exact";
                editorSetMessage(`Mode: ${runtimeEditorState.mode}.`, this);
            }
            if (Input.isTriggered("hybridPersist")) {
                runtimeEditorState.persist = !runtimeEditorState.persist;
                editorSetMessage(runtimeEditorState.persist ? "Session will commit on close." : "Session will be discarded on close.", this);
            }
            if (Input.isTriggered("hybridUndo")) editorSetMessage(editorUndo(this) ? "Undo complete." : "Session boundary reached.", this);
            if (Input.isTriggered("hybridRedo")) editorSetMessage(editorRedo(this) ? "Redo complete." : "Nothing to redo.", this);
            if (Input.isTriggered("ok")) editorApplyCurrent(this);
        };

        const aliasSceneMapUpdate = Scene_Map.prototype.update;
        Scene_Map.prototype.update = function() {
            aliasSceneMapUpdate.call(this);
            if (!runtimeEditorState.active && runtimeEditorAllowed() && Input.isTriggered("hybridEditor")) {
                openRuntimeEditor();
            } else if (runtimeEditorState.active) {
                this.updateHybridTileEditor();
            }
        };

        const aliasProcessMapTouch = Scene_Map.prototype.processMapTouch;
        Scene_Map.prototype.processMapTouch = function() {
            if (!runtimeEditorState.active) return aliasProcessMapTouch.call(this);
            const triggered = TouchInput.isTriggered && TouchInput.isTriggered();
            const pressed = TouchInput.isPressed && TouchInput.isPressed();
            if (this.isHybridEditorModal() || (!triggered && !pressed)) {
                if (!pressed) runtimeEditorState.lastDragKey = "";
                return;
            }
            if (TouchInput.y < 144 || TouchInput.y >= Graphics.boxHeight - 108) return;
            const x = Math.floor(TouchInput.x / editorTileWidth()) + runtimeEditorState.viewX;
            const y = Math.floor(TouchInput.y / editorTileHeight()) + runtimeEditorState.viewY;
            if (inBounds(x, y, editorMapWidth(), editorMapHeight())) {
                const dragKey = `${x},${y},${runtimeEditorState.tool}`;
                if (!triggered && dragKey === runtimeEditorState.lastDragKey) return;
                runtimeEditorState.lastDragKey = dragKey;
                runtimeEditorState.cursorX = x;
                runtimeEditorState.cursorY = y;
                editorApplyCurrent(this);
                editorRefresh(this);
            }
        };

        if (Scene_Map.prototype.isMenuEnabled) {
            const aliasSceneMapIsMenuEnabled = Scene_Map.prototype.isMenuEnabled;
            Scene_Map.prototype.isMenuEnabled = function() {
                if (runtimeEditorState.active) return false;
                return aliasSceneMapIsMenuEnabled.call(this);
            };
        }

        const aliasSceneMapTerminate = Scene_Map.prototype.terminate;
        Scene_Map.prototype.terminate = function() {
            if (runtimeEditorState.active) this.closeHybridTileEditor(runtimeEditorState.persist, true);
            aliasSceneMapTerminate.call(this);
        };

        if (typeof Game_Player !== "undefined" && Game_Player.prototype.canMove) {
            const aliasGamePlayerCanMove = Game_Player.prototype.canMove;
            Game_Player.prototype.canMove = function() {
                if (runtimeEditorState.active) return false;
                return aliasGamePlayerCanMove.call(this);
            };
        }
    }

    let pendingStudioOptions = {};
    let Scene_HybridTileStudio = null;

    if (runtimeEditorAvailable()) {
        installRuntimeEditor();
        Scene_HybridTileStudio = class extends Scene_Map {
            start() {
                if (Scene_Map.prototype.start) Scene_Map.prototype.start.call(this);
                const options = Object.assign({ studio: true, sessionName: "Tile Studio" }, pendingStudioOptions || {});
                pendingStudioOptions = {};
                this._hybridStudioOpened = openRuntimeEditor(options);
                if (this._hybridStudioOpened && options.openMapBrowser !== false && this.openHybridMapBrowser) {
                    this.openHybridMapBrowser();
                }
            }
        };
        if (typeof window !== "undefined") window.Scene_HybridTileStudio = Scene_HybridTileStudio;
    }

    function openTileStudio(options = {}) {
        if (!runtimeEditorAllowed() || !Scene_HybridTileStudio) return false;
        if (SceneManager && typeof SceneManager.push === "function") {
            pendingStudioOptions = deepClone(options || {});
            SceneManager.push(Scene_HybridTileStudio);
            return true;
        }
        const opened = openRuntimeEditor(Object.assign({ studio: true, sessionName: "Tile Studio" }, options));
        const scene = SceneManager._scene;
        if (opened && options.openMapBrowser !== false && scene && scene.openHybridMapBrowser) scene.openHybridMapBrowser();
        return opened;
    }

    function closeTileStudio(commit = runtimeEditorState.persist) {
        const scene = SceneManager._scene;
        const closed = closeRuntimeEditor(commit);
        if (closed && Scene_HybridTileStudio && scene instanceof Scene_HybridTileStudio && SceneManager && typeof SceneManager.pop === "function") {
            SceneManager.pop();
        }
        return closed;
    }

    // -------------------------------------------------------------------------
    // Game_Map API
    // -------------------------------------------------------------------------

    Game_Map.prototype.hybridGraftArea = function(options) { return graftArea(options); };
    Game_Map.prototype.hybridGraftPrefab = function(options) { return graftPrefab(options); };
    Game_Map.prototype.hybridSetTile = function(x, y, layer, tileId, save, options) { return setTile(x, y, layer, tileId, save, options); };
    Game_Map.prototype.hybridFillTiles = function(x, y, w, h, layer, tileId, save, options) { return fillTiles(x, y, w, h, layer, tileId, save, options); };
    Game_Map.prototype.hybridSmartFill = function(options) { return smartFill(options); };
    Game_Map.prototype.hybridClearArea = function(x, y, w, h, layers, save, events, mode) { return clearArea(x, y, w, h, layers, save, events, mode); };
    Game_Map.prototype.hybridRevertArea = function(x, y, w, h, layers, save, events) { return revertArea(x, y, w, h, layers, save, events); };
    Game_Map.prototype.hybridTileIdAt = function(x, y, layer) { return getTileId(x, y, layer); };
    Game_Map.prototype.hybridTileCodeAt = function(x, y, layer) { return tileCodeAt(x, y, layer); };
    Game_Map.prototype.hybridInspectTile = function(x, y, options) { return inspectTile(x, y, options); };
    Game_Map.prototype.hybridLinkMap = function(map) { return linkMap(map); };
    Game_Map.prototype.hybridUnlinkMap = function() { return unlinkMap(); };
    Game_Map.prototype.hybridEditingMapId = function() { return editingMapId(); };
    Game_Map.prototype.hybridSetTileOnMap = function(mapId, x, y, layer, tileId, options) {
        return setTileOnMapAsync(mapId, x, y, layer, tileId, options);
    };
    Game_Map.prototype.hybridCopyArea = function(x, y, w, h, layers, events, options) {
        return copyArea(x, y, w, h, layers, events, options);
    };
    Game_Map.prototype.hybridPasteArea = function(x, y, options) { return pasteArea(x, y, options); };
    Game_Map.prototype.hybridUndo = function() { return undoLast(this.mapId()); };
    Game_Map.prototype.hybridRedo = function() { return redoLast(this.mapId()); };
    Game_Map.prototype.hybridOpenEditor = function(options) { return openRuntimeEditor(options); };
    Game_Map.prototype.hybridOpenRemoteEditor = function(map, options) { return openRemoteMapEditor(map, options); };
    Game_Map.prototype.hybridFloodFill = function(x, y, layer, tileId, save, options) { return floodFill(x, y, layer, tileId, save, options); };
    Game_Map.prototype.hybridReplaceTiles = function(options) { return replaceTiles(options); };
    Game_Map.prototype.hybridDrawLine = function(x1, y1, x2, y2, layer, tileId, save, options) { return drawLine(x1, y1, x2, y2, layer, tileId, save, options); };
    Game_Map.prototype.hybridDrawCircle = function(x, y, radius, layer, tileId, save, options) { return drawCircle(x, y, radius, layer, tileId, save, options); };
    Game_Map.prototype.hybridRandomFill = function(x, y, w, h, layer, weightedTiles, save, options) { return randomFill(x, y, w, h, layer, weightedTiles, save, options); };

    if (!Game_Map.prototype.tileCodeAt) {
        Game_Map.prototype.tileCodeAt = function(x, y, z = 0) { return tileCodeAt(x, y, z); };
    }
    if (!Game_Map.prototype.tileCode) {
        Game_Map.prototype.tileCode = Game_Map.prototype.tileCodeAt;
    }
    if (!Game_Map.prototype.tileIdInList) {
        Game_Map.prototype.tileIdInList = function(list, x, y, z = 0) { return tileIdInList(list, x, y, z); };
    }
    if (!Game_Map.prototype.tileIdInListAhead) {
        Game_Map.prototype.tileIdInListAhead = function(list, distance = 1, z = 0) { return tileAhead(list, distance, z); };
    }
    if (!Game_Map.prototype.tileAhead) {
        Game_Map.prototype.tileAhead = Game_Map.prototype.tileIdInListAhead;
    }
    if (!Game_Map.prototype.autotileInList) {
        Game_Map.prototype.autotileInList = function(list, x, y, z = 0) { return autotileInList(list, x, y, z); };
    }
    if (!Game_Map.prototype.autotileInListAhead) {
        Game_Map.prototype.autotileInListAhead = function(list, distance = 1, z = 0) { return autotileAhead(list, distance, z); };
    }
    if (!Game_Map.prototype.autotileAhead) {
        Game_Map.prototype.autotileAhead = Game_Map.prototype.autotileInListAhead;
    }
    if (!Game_Map.prototype.setTileId) {
        Game_Map.prototype.setTileId = function(x, y, z, tileId, clearUpperLayers = true, allowAutotiling = true) {
            return setTile(x, y, z, tileId, true, {
                clearUpperLayers,
                mode: toBoolean(allowAutotiling, true) ? "autotile" : "exact"
            });
        };
    }
