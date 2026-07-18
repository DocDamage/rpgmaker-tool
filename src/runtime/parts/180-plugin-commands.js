    // -------------------------------------------------------------------------
    // Plugin commands
    // -------------------------------------------------------------------------

    function commandCoordinateOptions(args, interpreter) {
        return {
            coordinateMode: args.coordinateMode || "absolute",
            eventId: evalNumber(args.eventId, 0, interpreter),
            forwardShift: evalNumber(args.forwardShift, 0, interpreter),
            rightShift: evalNumber(args.rightShift, 0, interpreter),
            interpreter
        };
    }

    function instrumentHybridPluginCommands() {
        const registry = PluginManager._commands || PluginManager.commands;
        if (!registry) return 0;
        let count = 0;
        for (const [key, original] of Object.entries(registry)) {
            if (!key.startsWith(`${PLUGIN_NAME}:`) || typeof original !== "function" || original._hybridTileGraftInstrumented) continue;
            const command = key.slice(PLUGIN_NAME.length + 1);
            const wrapped = function(args = {}) {
                const context = { command, args: deepClone(args || {}), startedAt: Date.now(), startedClock: clockNow(), pending: false, completed: false };
                this._hybridTileGraftCommandContext = context;
                try {
                    const value = original.call(this, args);
                    if (!context.pending) publishPluginCommandResult(context, "succeeded", value);
                    return value;
                } catch (error) {
                    const report = captureError(error, { operation: "pluginCommand", command });
                    context.errorReportId = report.id;
                    publishPluginCommandResult(context, "failed", null, error);
                    throw error;
                } finally {
                    if (!context.pending && this._hybridTileGraftCommandContext === context) delete this._hybridTileGraftCommandContext;
                }
            };
            Object.defineProperty(wrapped, "_hybridTileGraftInstrumented", { value: true });
            registry[key] = wrapped;
            count++;
        }
        return count;
    }

    PluginManager.registerCommand(PLUGIN_NAME, "graftArea", function(args) {
        const options = Object.assign(commandCoordinateOptions(args, this), {
            sourceMapId: evalNumber(args.sourceMapId, 0, this),
            sourceX: evalNumber(args.sourceX, 0, this),
            sourceY: evalNumber(args.sourceY, 0, this),
            width: evalNumber(args.width, 1, this),
            height: evalNumber(args.height, 1, this),
            targetX: evalNumber(args.targetX, 0, this),
            targetY: evalNumber(args.targetY, 0, this),
            layers: args.layers,
            mode: args.mode,
            includeEvents: toBoolean(args.includeEvents, false),
            save: args.save !== "false"
        });
        const targetMapId = editingMapId();
        waitForPromise(this, targetMapId === $gameMap.mapId()
            ? graftAreaAsync(options)
            : graftAreaToMapAsync(Object.assign(options, { targetMapId })));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "graftPrefab", function(args) {
        const options = Object.assign(commandCoordinateOptions(args, this), {
            name: args.name,
            storageMapId: evalNumber(args.storageMapId, 0, this),
            targetX: evalNumber(args.targetX, 0, this),
            targetY: evalNumber(args.targetY, 0, this),
            layers: args.layers,
            mode: args.mode,
            includeEvents: toBoolean(args.includeEvents, false),
            save: args.save !== "false"
        });
        const targetMapId = editingMapId();
        waitForPromise(this, targetMapId === $gameMap.mapId()
            ? graftPrefabAsync(options)
            : graftPrefabToMapAsync(Object.assign(options, { targetMapId })));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "preloadMap", function(args) {
        waitForPromise(this, preloadMap(evalNumber(args.mapId, 1, this), toBoolean(args.forceRefresh, false)));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setTile", function(args) {
        const options = Object.assign(commandCoordinateOptions(args, this), {
            mode: args.mode,
            clearUpperLayers: toBoolean(args.clearUpperLayers, false),
            save: args.save !== "false"
        });
        const x = evalNumber(args.x, 0, this);
        const y = evalNumber(args.y, 0, this);
        const targetMapId = editingMapId();
        if (targetMapId === $gameMap.mapId()) {
            setTile(x, y, args.layer, args.tileId, args.save !== "false", options);
        } else {
            waitForPromise(this, setTileOnMapAsync(targetMapId, x, y, args.layer, args.tileId, options));
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "fillTiles", function(args) {
        const options = Object.assign(commandCoordinateOptions(args, this), {
            mode: args.mode,
            clearUpperLayers: toBoolean(args.clearUpperLayers, false),
            save: args.save !== "false"
        });
        const x = evalNumber(args.x, 0, this);
        const y = evalNumber(args.y, 0, this);
        const width = evalNumber(args.width, 1, this);
        const height = evalNumber(args.height, 1, this);
        const targetMapId = editingMapId();
        if (targetMapId === $gameMap.mapId()) {
            fillTiles(x, y, width, height, args.layer, args.tileId, args.save !== "false", options);
        } else {
            waitForPromise(this, fillTilesOnMapAsync(targetMapId, x, y, width, height, args.layer, args.tileId, options));
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "smartFill", function(args) {
        if (editingMapId() !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: Smart Fill currently requires the active map. Unlink the remote map first.`);
            return;
        }
        smartFill(Object.assign(commandCoordinateOptions(args, this), {
            x: evalNumber(args.x, 0, this),
            y: evalNumber(args.y, 0, this),
            layer: args.layer,
            tileId: args.tileId,
            mode: args.mode,
            clearUpperLayers: toBoolean(args.clearUpperLayers, false),
            filters: args.filters || args.filtersJson,
            creep: args.creep || args.creepJson,
            save: args.save !== "false"
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "clearArea", function(args) {
        const x = evalNumber(args.x, 0, this);
        const y = evalNumber(args.y, 0, this);
        const width = evalNumber(args.width, 1, this);
        const height = evalNumber(args.height, 1, this);
        const targetMapId = editingMapId();
        if (targetMapId === $gameMap.mapId()) {
            clearArea(x, y, width, height, args.layers, args.save !== "false", toBoolean(args.includeEvents, false), args.mode);
        } else if (args.save === "false") {
            console.warn(`${PLUGIN_NAME}: temporary remote clears are not supported.`);
        } else {
            waitForPromise(this, clearAreaOnMapAsync(targetMapId, x, y, width, height, args.layers, toBoolean(args.includeEvents, false), args.mode));
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "revertArea", function(args) {
        const x = evalNumber(args.x, 0, this);
        const y = evalNumber(args.y, 0, this);
        const width = evalNumber(args.width, 1, this);
        const height = evalNumber(args.height, 1, this);
        const targetMapId = editingMapId();
        if (targetMapId === $gameMap.mapId()) {
            revertArea(x, y, width, height, args.layers, args.save !== "false", toBoolean(args.includeEvents, false));
        } else if (args.save === "false") {
            console.warn(`${PLUGIN_NAME}: temporary remote reverts are not supported.`);
        } else {
            waitForPromise(this, revertAreaOnMapAsync(targetMapId, x, y, width, height, args.layers, toBoolean(args.includeEvents, false)));
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "undoLast", function() {
        undoLast(editingMapId());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "redoLast", function() {
        redoLast(editingMapId());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "resetMap", function(args) {
        resetMap(editingMapId(), args.save !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "checkAreaEvents", function(args) {
        const result = checkAreaEvents(
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            evalNumber(args.width, 1, this),
            evalNumber(args.height, 1, this)
        );
        const normalSwitch = integer(args.normalSwitch, 0);
        const spawnedSwitch = integer(args.spawnedSwitch, 0);
        if (normalSwitch > 0) $gameSwitches.setValue(normalSwitch, result.normal.length > 0);
        if (spawnedSwitch > 0) $gameSwitches.setValue(spawnedSwitch, result.spawned.length > 0);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setAnimationFrames", function(args) {
        setAnimationFrames(evalNumber(args.frames, DEFAULT_ANIMATION_FRAMES, this));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "linkMap", function(args) {
        const evaluated = evalNumber(args.map, 0, this);
        waitForPromise(this, linkMap(evaluated > 0 ? evaluated : args.map));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "unlinkMap", function() {
        unlinkMap();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "registerPrefab", function(args) {
        registerPrefab({
            name: args.name,
            mapId: evalNumber(args.mapId, 0, this),
            x: evalNumber(args.sourceX, 0, this),
            y: evalNumber(args.sourceY, 0, this),
            width: evalNumber(args.width, 1, this),
            height: evalNumber(args.height, 1, this),
            layers: args.layers,
            mode: args.mode,
            includeEvents: toBoolean(args.includeEvents, false)
        }, args.save !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "removePrefab", function(args) {
        removePrefab(args.name, evalNumber(args.mapId, 0, this));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "preloadPrefabMaps", function(args) {
        const force = toBoolean(args.forceRefresh, false);
        waitForPromise(this, Promise.all([preloadPrefabMaps(force), preloadChildMaps(args.childMapTag || CHILD_MAP_TAG, force)]));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "inspectTile", function(args) {
        const info = inspectTile(
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            commandCoordinateOptions(args, this)
        );
        if (toBoolean(args.logToConsole, true)) logTileInfo(info.x, info.y);
        const variableValues = [
            [args.layer1Variable, info.layers.L1 ? info.layers.L1.tileId : 0],
            [args.layer2Variable, info.layers.L2 ? info.layers.L2.tileId : 0],
            [args.layer3Variable, info.layers.L3 ? info.layers.L3.tileId : 0],
            [args.layer4Variable, info.layers.L4 ? info.layers.L4.tileId : 0],
            [args.shadowVariable, info.shadowBits],
            [args.regionVariable, info.regionId]
        ];
        for (const [variableId, value] of variableValues) {
            const id = integer(variableId, 0);
            if (id > 0) $gameVariables.setValue(id, value);
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setRegion", function(args) {
        const point = resolvePoint(
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            commandCoordinateOptions(args, this),
            this
        );
        const targetMapId = editingMapId();
        if (targetMapId === $gameMap.mapId()) {
            changeRegionId(point.x, point.y, evalNumber(args.regionId, 0, this), args.save !== "false");
        } else {
            waitForPromise(this, setTileOnMapAsync(targetMapId, point.x, point.y, "L6", evalNumber(args.regionId, 0, this), {
                mode: "exact",
                save: args.save !== "false"
            }));
        }
    });

    PluginManager.registerCommand(PLUGIN_NAME, "compactMap", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || editingMapId();
        waitForPromise(this, compactMap(mapId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "diagnoseMap", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || editingMapId();
        waitForPromise(this, diagnoseMap(mapId).then(result => {
            console.log(`${PLUGIN_NAME} diagnostics:`, result);
            const patchVariable = integer(args.patchCountVariable, 0);
            const writeVariable = integer(args.tileWriteVariable, 0);
            const redoVariable = integer(args.redoCountVariable, 0);
            const warningSwitch = integer(args.warningSwitch, 0);
            if (patchVariable > 0) $gameVariables.setValue(patchVariable, result.patchCount);
            if (writeVariable > 0) $gameVariables.setValue(writeVariable, result.tileWrites);
            if (redoVariable > 0) $gameVariables.setValue(redoVariable, result.redoCount);
            if (warningSwitch > 0) $gameSwitches.setValue(warningSwitch, !result.ok);
            return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setRemoteTile", function(args) {
        waitForPromise(this, setTileOnMapAsync(
            evalNumber(args.mapId, 1, this),
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            args.layer,
            args.tileId,
            {
                mode: args.mode,
                clearUpperLayers: toBoolean(args.clearUpperLayers, false),
                save: true
            }
        ));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "graftRemoteArea", function(args) {
        waitForPromise(this, graftAreaToMapAsync({
            targetMapId: evalNumber(args.targetMapId, 1, this),
            sourceMapId: evalNumber(args.sourceMapId, 1, this),
            sourceX: evalNumber(args.sourceX, 0, this),
            sourceY: evalNumber(args.sourceY, 0, this),
            width: evalNumber(args.width, 1, this),
            height: evalNumber(args.height, 1, this),
            targetX: evalNumber(args.targetX, 0, this),
            targetY: evalNumber(args.targetY, 0, this),
            layers: args.layers,
            mode: args.mode,
            includeEvents: toBoolean(args.includeEvents, false),
            save: true
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "openEditor", function(args) {
        const requestedX = evalNumber(args.x, -1, this);
        const requestedY = evalNumber(args.y, -1, this);
        openRuntimeEditor({
            x: requestedX < 0 ? $gamePlayer.x : requestedX,
            y: requestedY < 0 ? $gamePlayer.y : requestedY,
            layer: args.layer,
            tileId: args.tileId,
            mode: args.mode,
            tool: args.tool,
            brushSize: evalNumber(args.brushSize, 1, this),
            persist: args.persist !== "false",
            openPrefabBrowser: toBoolean(args.openPrefabBrowser, false)
        });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "closeEditor", function() {
        closeRuntimeEditor();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "copyArea", function(args) {
        if (editingMapId() !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: clipboard copy requires the active map.`);
            return;
        }
        const options = commandCoordinateOptions(args, this);
        const point = resolvePoint(
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            options,
            this
        );
        copyArea(
            point.x,
            point.y,
            evalNumber(args.width, 1, this),
            evalNumber(args.height, 1, this),
            args.layers,
            toBoolean(args.includeEvents, false),
            { coordinateMode: "absolute" }
        );
    });

    PluginManager.registerCommand(PLUGIN_NAME, "pasteArea", function(args) {
        if (editingMapId() !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: clipboard paste requires the active map.`);
            return;
        }
        pasteArea(
            evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this),
            Object.assign(commandCoordinateOptions(args, this), {
                mode: args.mode,
                includeEvents: toBoolean(args.includeEvents, true),
                save: args.save !== "false"
            })
        );
    });

    PluginManager.registerCommand(PLUGIN_NAME, "openRemoteEditor", function(args) {
        waitForPromise(this, openRemoteMapEditor(args.map || evalNumber(args.mapId, 0, this), {
            x: evalNumber(args.x, 0, this),
            y: evalNumber(args.y, 0, this),
            layer: args.layer,
            tileId: args.tileId,
            mode: args.mode,
            tool: args.tool,
            brushSize: evalNumber(args.brushSize, 1, this),
            persist: args.persist !== "false"
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "beginEditSession", function(args) {
        beginEditTransaction(args.name || "Plugin Command Session", evalNumber(args.mapId, 0, this) || editingMapId());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "commitEditSession", function(args) {
        commitEditTransaction(args.groupChanges !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "cancelEditSession", function() {
        cancelEditTransaction();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createCheckpoint", function(args) {
        createCheckpoint(args.name || "Checkpoint", evalNumber(args.mapId, 0, this) || editingMapId());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "restoreCheckpoint", function(args) {
        restoreCheckpoint(args.name, evalNumber(args.mapId, 0, this) || editingMapId());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "floodFill", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Flood Fill requires the active map or visual remote editor.`);
        floodFill(evalNumber(args.x, 0, this), evalNumber(args.y, 0, this), args.layer, args.tileId,
            args.save !== "false", { mode: args.mode, maxCells: evalNumber(args.maxCells, 0, this) || undefined });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "replaceTiles", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Replace Tiles requires the active map or visual remote editor.`);
        replaceTiles({
            x: evalNumber(args.x, 0, this),
            y: evalNumber(args.y, 0, this),
            width: evalNumber(args.width, 0, this),
            height: evalNumber(args.height, 0, this),
            layer: args.layer,
            fromTileId: args.fromTileId === "" ? undefined : args.fromTileId,
            toTileId: args.toTileId,
            mode: args.mode,
            sameType: toBoolean(args.sameType, true),
            save: args.save !== "false"
        });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "drawLine", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Draw Line requires the active map or visual remote editor.`);
        drawLine(evalNumber(args.x1, 0, this), evalNumber(args.y1, 0, this),
            evalNumber(args.x2, 0, this), evalNumber(args.y2, 0, this), args.layer,
            args.tileId, args.save !== "false", { mode: args.mode });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "drawCircle", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Draw Circle requires the active map or visual remote editor.`);
        drawCircle(evalNumber(args.x, 0, this), evalNumber(args.y, 0, this),
            evalNumber(args.radius, 1, this), args.layer, args.tileId, args.save !== "false",
            { mode: args.mode, filled: toBoolean(args.filled, false) });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "randomFill", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Random Fill requires the active map or visual remote editor.`);
        randomFill(evalNumber(args.x, 0, this), evalNumber(args.y, 0, this),
            evalNumber(args.width, 1, this), evalNumber(args.height, 1, this), args.layer,
            args.weightedTiles, args.save !== "false", { mode: args.mode });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "capturePrefab", function(args) {
        if (editingMapId() !== $gameMap.mapId()) return console.warn(`${PLUGIN_NAME}: Capture Prefab requires the active map or visual remote editor.`);
        capturePrefab(args.name, evalNumber(args.x, 0, this), evalNumber(args.y, 0, this),
            evalNumber(args.width, 1, this), evalNumber(args.height, 1, this), {
                layers: args.layers,
                includeEvents: toBoolean(args.includeEvents, true),
                mode: args.mode,
                category: args.category,
                tags: args.tags,
                description: args.description,
                save: args.save !== "false"
            });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "duplicateEvent", function(args) {
        duplicateEvent(evalNumber(args.eventId, 0, this), evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this), args.save !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "moveSpawnedEvent", function(args) {
        moveSpawnedEvent(evalNumber(args.eventId, 0, this), evalNumber(args.x, 0, this),
            evalNumber(args.y, 0, this), args.save !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "deleteSpawnedEvent", function(args) {
        deleteSpawnedEvent(evalNumber(args.eventId, 0, this), args.save !== "false");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportPatchPack", function(args) {
        const ids = String(args.mapIds || "").split(",").map(value => integer(value, 0)).filter(value => value > 0);
        const pack = exportPatchPack(ids.length ? ids : null);
        if (toBoolean(args.download, true)) downloadJson(args.filename || "HybridTileGraft-Patches.json", pack);
        console.log(`${PLUGIN_NAME} patch pack:`, pack);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "importPatchPack", function(args) {
        const affected = importPatchPack(args.json, { replace: toBoolean(args.replace, false) });
        console.log(`${PLUGIN_NAME} imported patch maps:`, affected);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportPrefabPack", function(args) {
        const names = String(args.names || "").split(",").map(value => value.trim()).filter(Boolean);
        const pack = exportPrefabPack(names.length ? names : null);
        if (toBoolean(args.download, true)) downloadJson(args.filename || "HybridTileGraft-Prefabs.json", pack);
        console.log(`${PLUGIN_NAME} prefab pack:`, pack);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "importPrefabPack", function(args) {
        console.log(`${PLUGIN_NAME} imported prefabs:`, importPrefabPack(args.json, args.save !== "false"));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportChangeReport", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || editingMapId();
        waitForPromise(this, diffMap(mapId).then(report => {
            if (toBoolean(args.download, true)) downloadJson(args.filename || `HybridTileGraft-Map${mapId}-Diff.json`, report);
            console.log(`${PLUGIN_NAME} change report:`, report);
            return report;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "bakeMap", function(args) {
        waitForPromise(this, bakeMapToFile(evalNumber(args.mapId, 0, this) || editingMapId(), {
            clearHistory: args.clearHistory !== "false",
            makeEventsPermanent: args.makeEventsPermanent !== "false"
        }).then(result => console.log(`${PLUGIN_NAME} baked map:`, result)));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "refreshCompatibility", function() {
        runCompatibilityRefresh({ operation: "manualCompatibilityRefresh", mapId: editingMapId() });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "openStudio", function() {
        openTileStudio({ openMapBrowser: true });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "transformMap", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || editingMapId();
        const options = parseJson(args.optionsJson, {}) || {};
        waitForPromise(this, transformMap(mapId, options).then(result => {
            console.log(`${PLUGIN_NAME} transformed map:`, result);
            return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateDungeon", function(args) {
        generateDungeon(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateBiome", function(args) {
        generateBiome(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generatePath", function(args) {
        const options = parseJson(args.optionsJson, {}) || {};
        const kind = String(args.kind || "path").toLowerCase();
        if (kind === "road") generateRoad(options);
        else if (kind === "river") generateRiver(options);
        else generatePath(options);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateEvent", function(args) {
        generateEvent(args.type, evalNumber(args.x, 0, this), evalNumber(args.y, 0, this),
            parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "spawnEventTemplate", function(args) {
        spawnEventTemplate(args.name, evalNumber(args.x, 0, this), evalNumber(args.y, 0, this), {
            parameters: parseJson(args.parametersJson, {}) || {}, save: true
        });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportWorkspace", function(args) {
        const bundle = exportWorkspaceBundle();
        downloadJson(args.filename || "HybridTileGraft-Workspace.json", bundle);
        console.log(`${PLUGIN_NAME} workspace bundle:`, bundle);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "importWorkspace", function(args) {
        const result = importWorkspaceBundle(args.json, {
            conflictPolicy: args.conflictPolicy || "merge",
            checkpoint: true
        });
        console.log(`${PLUGIN_NAME} workspace import:`, result);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "validateProject", function(args) {
        console.log(`${PLUGIN_NAME} validation report:`, validateStore({ repair: toBoolean(args.repair, false) }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "rollbackBake", function(args) {
        const mapId = evalNumber(args.mapId, 0, this);
        const record = listBakeBackups(mapId)[0];
        console.log(`${PLUGIN_NAME} bake rollback:`, record ? rollbackBake(record) : false);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setEditorView", function(args) {
        const options = parseJson(args.optionsJson, {}) || {};
        if (options.zoom !== undefined) setEditorZoom(options.zoom);
        if (options.grid !== undefined) {
            runtimeEditorState.grid = toBoolean(options.grid, false);
            ensureStore().editorPreferences.grid = runtimeEditorState.grid;
        }
        if (options.overlay !== undefined) setEditorOverlay(options.overlay);
        if (options.layer) setEditorLayerState(options.layer, options);
        editorRefresh();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "startWorkspaceBridge", function(args) {
        console.log(`${PLUGIN_NAME} workspace bridge:`, startWorkspaceBridge(args.directory || "hybrid-workspace", {
            intervalMs: evalNumber(args.intervalMs, 2000, this)
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "stopWorkspaceBridge", function() {
        stopWorkspaceBridge();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createAuthoringLayer", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        console.log(`${PLUGIN_NAME} authoring layer:`, createAuthoringLayer(args.name || "New Layer", mapId,
            parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setActiveAuthoringLayer", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        setActiveAuthoringLayer(args.layerId || "base", mapId);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createMask", function(args) {
        const options = parseJson(args.optionsJson, {}) || {};
        if (options.regionIds) createRegionMask(args.name || "New Mask", options.regionIds, options);
        else createRectMask(args.name || "New Mask", options.x, options.y, options.width, options.height,
            options.mapId || $gameMap.mapId(), options);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "addModifier", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        console.log(`${PLUGIN_NAME} modifier:`, addModifier(args.type, parseJson(args.optionsJson, {}) || {}, mapId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "regenerateModifier", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        console.log(`${PLUGIN_NAME} modifier regeneration:`, regenerateModifier(args.modifierId, mapId,
            parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "placePrefabInstance", function(args) {
        waitForPromise(this, placePrefabInstance(parseJson(args.optionsJson, {}) || {}).then(result => {
            console.log(`${PLUGIN_NAME} linked prefab instance:`, result);
            return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "refreshPrefabInstances", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        waitForPromise(this, refreshAllPrefabInstances(mapId, { onlyOutdated: toBoolean(args.onlyOutdated, true) }).then(result => {
            console.log(`${PLUGIN_NAME} refreshed prefab instances:`, result);
            return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateClimateBiome", function(args) {
        generateClimateBiome(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateTerrainRoad", function(args) {
        generateTerrainRoad(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateDownhillRiver", function(args) {
        generateDownhillRiver(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateWaveFunctionMap", function(args) {
        generateWaveFunctionMap(parseJson(args.optionsJson, {}) || {});
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createChangeSet", function(args) {
        const mapId = evalNumber(args.mapId, 0, this) || $gameMap.mapId();
        waitForPromise(this, createChangeSet(args.name || "Map Changes", mapId,
            parseJson(args.optionsJson, {}) || {}).then(result => {
                console.log(`${PLUGIN_NAME} change set:`, result);
                return result;
            }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "applyChangeSet", function(args) {
        const mapId = evalNumber(args.targetMapId, 0, this) || $gameMap.mapId();
        waitForPromise(this, applyChangeSet(args.changeSetId, mapId, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "validateProjectMaps", function(args) {
        const mapIds = normalizeList(args.mapIds).map(Number).filter(Boolean);
        waitForPromise(this, validateProjectMaps(mapIds.length ? mapIds : null).then(result => {
            console.log(`${PLUGIN_NAME} map-file validation:`, result);
            return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createProjectSnapshot", function(args) {
        console.log(`${PLUGIN_NAME} project snapshot:`, createProjectSnapshot(args.name || "Project Snapshot",
            parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "systemHealth", function() {
        console.log(`${PLUGIN_NAME} system health:`, systemHealthReport());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "pruneProjectData", function(args) {
        console.log(`${PLUGIN_NAME} data pruning:`, pruneProjectData(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runCompatibilitySelfTest", function(args) {
        console.log(`${PLUGIN_NAME} compatibility self-test:`, runCompatibilitySelfTest(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "beginProjectTransaction", function(args) {
        console.log(`${PLUGIN_NAME} project transaction:`, beginProjectTransaction(args.label || "Project transaction"));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "commitProjectTransaction", function() {
        console.log(`${PLUGIN_NAME} project transaction committed:`, commitProjectTransaction());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "rollbackProjectTransaction", function() {
        console.log(`${PLUGIN_NAME} project transaction rolled back:`, rollbackProjectTransaction());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createWorkspaceBranch", function(args) {
        console.log(`${PLUGIN_NAME} workspace branch:`, createWorkspaceBranch(args.name || "feature-map", { activate: toBoolean(args.activate, true) }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "switchWorkspaceBranch", function(args) {
        console.log(`${PLUGIN_NAME} switched branch:`, switchWorkspaceBranch(args.branchId || "main"));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "mergeWorkspaceBranch", function(args) {
        console.log(`${PLUGIN_NAME} branch merge:`, mergeWorkspaceBranch(args.branchId, { resolution: args.resolution || "ours" }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "addReviewComment", function(args) {
        console.log(`${PLUGIN_NAME} review comment:`, addReviewComment(args.text, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "learnWfcRules", function(args) {
        console.log(`${PLUGIN_NAME} learned WFC rules:`, learnWfcRulesFromMap(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "generateBacktrackingWfc", function(args) {
        console.log(`${PLUGIN_NAME} backtracking WFC:`, generateWaveFunctionMapBacktracking(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "dependencyAudit", function(args) {
        waitForPromise(this, projectDependencyAudit(parseJson(args.optionsJson, {}) || {}).then(result => {
            console.log(`${PLUGIN_NAME} dependency audit:`, result); return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportCanonicalWorkspace", function(args) {
        downloadJson(args.filename || "HybridTileGraft-Canonical.json", exportCanonicalWorkspace());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createReviewThread", function(args) {
        console.log(`${PLUGIN_NAME} review thread:`, createReviewThread(args.text, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "replyReviewThread", function(args) {
        console.log(`${PLUGIN_NAME} review reply:`, replyReviewThread(args.threadId, args.text, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "updateReviewThreadStatus", function(args) {
        console.log(`${PLUGIN_NAME} review status:`, updateReviewThreadStatus(args.threadId, args.status));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setRecoveryPolicy", function(args) {
        console.log(`${PLUGIN_NAME} recovery policy:`, setRecoveryPolicy(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setProductionPreferences", function(args) {
        console.log(`${PLUGIN_NAME} production preferences:`, productionPreferences(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "exportProductionHandoff", function(args) {
        downloadJson(args.filename || "HybridTileGraft-Production-Handoff.json", exportProductionHandoff());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runWorldRecipe", function(args) {
        waitForPromise(this, runWorldRecipe(args.recipeId, Object.assign(parseJson(args.contextJson, {}) || {}, { interpreter: this }), { dryRun: toBoolean(args.dryRun, false) }).then(result => {
            console.log(`${PLUGIN_NAME} World Recipe:`, result); return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "triggerWorldRecipes", function(args) {
        waitForPromise(this, triggerWorldRecipes(args.trigger || "manual", Object.assign(parseJson(args.contextJson, {}) || {}, { interpreter: this }), { dryRun: toBoolean(args.dryRun, false) }).then(result => {
            console.log(`${PLUGIN_NAME} World Recipes:`, result); return result;
        }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setWorldRecipeEnabled", function(args) {
        setWorldRecipeEnabled(args.recipeId, toBoolean(args.enabled, true));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "resetWorldRecipeState", function(args) {
        resetWorldRecipeState(args.recipeId || "");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setWorldState", function(args) {
        let value;
        try { value = JSON.parse(String(args.valueJson ?? "true")); } catch (_error) { value = String(args.valueJson ?? ""); }
        setWorldState(args.key, value, { scope: args.scope || "global", mapId: $gameMap.mapId() });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setWorldClock", function(args) {
        console.log(`${PLUGIN_NAME} world clock:`, setWorldClock(parseJson(args.clockJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "advanceWorldClock", function(args) {
        console.log(`${PLUGIN_NAME} world clock:`, advanceWorldClock(integer(args.minutes, 60)));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "scheduleWorldRecipe", function(args) {
        console.log(`${PLUGIN_NAME} scheduled recipe:`, scheduleWorldRecipe(args.recipeId, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "cancelWorldSchedule", function(args) {
        cancelWorldSchedule(args.scheduleId);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "addWorldFact", function(args) {
        let value; try { value = JSON.parse(String(args.valueJson ?? "true")); } catch (_error) { value = String(args.valueJson ?? ""); }
        addWorldFact(args.name, value);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "removeWorldFact", function(args) {
        removeWorldFact(args.name);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "harvestWorldResource", function(args) {
        console.log(`${PLUGIN_NAME} resource:`, harvestWorldResource(args.resourceId, finiteNumber(args.amount, 1)));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "applyWorldMapVariant", function(args) {
        waitForPromise(this, Promise.resolve(applyWorldMapVariant(args.variantId, Object.assign(parseJson(args.contextJson, {}) || {}, { interpreter: this }))));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "defineWorldNpc", function(args) {
        console.log(`${PLUGIN_NAME} world NPC:`, defineWorldNpc(parseJson(args.definitionJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "updateWorldNpc", function(args) {
        console.log(`${PLUGIN_NAME} world NPC:`, updateWorldNpc(args.npcId, parseJson(args.changesJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "simulateWorldTimeline", function(args) {
        console.log(`${PLUGIN_NAME} simulated timeline:`, simulateWorldTimeline(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "defineWorldRuleLayer", function(args) {
        console.log(`${PLUGIN_NAME} rule layer:`, defineWorldRuleLayer(parseJson(args.definitionJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "paintWorldRules", function(args) {
        let value; try { value = JSON.parse(String(args.valueJson ?? "true")); } catch (_error) { value = String(args.valueJson ?? ""); }
        console.log(`${PLUGIN_NAME} painted rules:`, paintWorldRules(args.layerId, parseJson(args.cellsJson, []) || [], value, { mode: args.mode || "paint" }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "compileWorldRuleLayer", function(args) {
        console.log(`${PLUGIN_NAME} compiled rule layer:`, compileWorldRuleLayer(args.layerId, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runBiomeGraph", function(args) {
        waitForPromise(this, Promise.resolve(runBiomeGraph(args.graphId, parseJson(args.optionsJson, {}) || {})).then(result => { console.log(`${PLUGIN_NAME} biome graph:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "installWorldPack", function(args) {
        console.log(`${PLUGIN_NAME} world pack:`, installWorldPack(parseJson(args.packJson, {}) || {}, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "uninstallWorldPack", function(args) {
        console.log(`${PLUGIN_NAME} world pack uninstall:`, uninstallWorldPack(args.packId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "rollbackWorldPack", function(args) {
        console.log(`${PLUGIN_NAME} world pack rollback:`, rollbackWorldPack(args.packId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createRecoverySnapshot", function(args) {
        console.log(`${PLUGIN_NAME} recovery snapshot:`, createRecoverySnapshot(args.name || "Manual recovery snapshot", { automatic: false }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "restoreRecoverySnapshot", function(args) {
        console.log(`${PLUGIN_NAME} recovery restore:`, restoreRecoverySnapshot(args.snapshotId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runCompatibilityLab", function(args) {
        console.log(`${PLUGIN_NAME} compatibility lab:`, runCompatibilityLab(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "setRuntimeBudget", function(args) {
        console.log(`${PLUGIN_NAME} runtime budget:`, runtimeBudget(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "optimizeWorldRuntime", function(args) {
        console.log(`${PLUGIN_NAME} runtime optimization:`, optimizeWorldRuntime(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "analyzeWorldAtlas", function(args) {
        waitForPromise(this, analyzeWorldAtlas(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} world atlas:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "analyzeEventQuestGraph", function(args) {
        waitForPromise(this, analyzeEventQuestGraph(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} event quest graph:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "repairMapIntelligently", function(args) {
        console.log(`${PLUGIN_NAME} intelligent map repair:`, repairMapIntelligently(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createVisualHistorySnapshot", function(args) {
        waitForPromise(this, createVisualHistorySnapshot(args.name || "Map snapshot", integer(args.mapId, 0)).then(result => { console.log(`${PLUGIN_NAME} visual history:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "diffVisualHistory", function(args) {
        console.log(`${PLUGIN_NAME} visual history diff:`, diffVisualHistory(args.fromId, args.toId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "simulateNpcDirector", function(args) {
        console.log(`${PLUGIN_NAME} NPC Director:`, simulateNpcDirector(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "resolvePackDependencies", function(args) {
        console.log(`${PLUGIN_NAME} pack dependency plan:`, resolvePackDependencies(parseJson(args.requestedJson, []) || [], parseJson(args.availableJson, []) || []));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "installExtensionManifest", function(args) {
        console.log(`${PLUGIN_NAME} extension manifest:`, installExtensionManifest(parseJson(args.manifestJson, {}) || {}, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runGoldenMapTest", function(args) {
        waitForPromise(this, runGoldenMapTest(parseJson(args.definitionJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} golden map:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runProductionValidation", function(args) {
        waitForPromise(this, runProductionValidation(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} production validation:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createProjectDeploymentReport", function(args) {
        waitForPromise(this, createProjectDeploymentReport(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} deployment report:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "startLiveProductionSession", function(args) {
        console.log(`${PLUGIN_NAME} live production:`, startLiveProductionSession(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "stopLiveProductionSession", function() {
        console.log(`${PLUGIN_NAME} live production stopped:`, stopLiveProductionSession());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "startPlaytestRecording", function(args) {
        console.log(`${PLUGIN_NAME} playtest recording:`, startPlaytestRecording(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "stopPlaytestRecording", function() {
        console.log(`${PLUGIN_NAME} playtest recording complete:`, stopPlaytestRecording());
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createScenarioFromRecording", function(args) {
        console.log(`${PLUGIN_NAME} recorded scenario:`, createScenarioFromRecording(args.recordingId, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runRecordedScenario", function(args) {
        waitForPromise(this, runRecordedScenario(args.scenarioId, parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} scenario run:`, result); return result; }));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "validateEventCommandList", function(args) {
        console.log(`${PLUGIN_NAME} event command validation:`, validateEventCommandList(parseJson(args.commandsJson, []) || []));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "defineSemanticTileset", function(args) {
        console.log(`${PLUGIN_NAME} semantic tileset:`, defineSemanticTileset(parseJson(args.definitionJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "analyzeSemanticMap", function(args) {
        console.log(`${PLUGIN_NAME} semantic map report:`, analyzeSemanticMap(null, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "configureExtensionSandbox", function(args) {
        console.log(`${PLUGIN_NAME} extension sandbox:`, configureExtensionSandbox(args.extensionId, parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "runSandboxedExtensionContribution", function(args) {
        console.log(`${PLUGIN_NAME} sandboxed extension:`, runSandboxedExtensionContribution(args.extensionId, args.contribution, args.name, parseJson(args.inputJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createContentCollection", function(args) {
        console.log(`${PLUGIN_NAME} content collection:`, createContentCollection(parseJson(args.definitionJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "searchUnifiedContent", function(args) {
        console.log(`${PLUGIN_NAME} content search:`, searchUnifiedContent(args.query || "", parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createCollaborationBundle", function(args) {
        console.log(`${PLUGIN_NAME} collaboration bundle:`, createCollaborationBundle(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "createReleaseFingerprint", function(args) {
        console.log(`${PLUGIN_NAME} release fingerprint:`, createReleaseFingerprint(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "buildCleanProductionBundle", function(args) {
        downloadJson(args.filename || "HybridTileGraft-Clean-Production.json", buildCleanProductionBundle(parseJson(args.optionsJson, {}) || {}));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "negotiateLiveProduction", function(args) { console.log(`${PLUGIN_NAME} Live Production handshake:`, negotiateLiveProduction(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "cleanLiveProductionArtifacts", function(args) { console.log(`${PLUGIN_NAME} Live Production cleanup:`, cleanLiveProductionArtifacts(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "runPlaytestJourney", function(args) { waitForPromise(this, runPlaytestJourney(parseJson(args.scenarioJson, {}) || {}, parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} journey:`, result); return result; })); });
    PluginManager.registerCommand(PLUGIN_NAME, "runProductionTestSuite", function(args) { waitForPromise(this, runProductionTestSuite(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} production tests:`, result); return result; })); });
    PluginManager.registerCommand(PLUGIN_NAME, "createUniversalRecoveryPoint", function(args) { console.log(`${PLUGIN_NAME} recovery point:`, createUniversalRecoveryPoint(args.name || "Production restore point", parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "restoreUniversalRecoveryPoint", function(args) { console.log(`${PLUGIN_NAME} recovery restore:`, restoreUniversalRecoveryPoint(args.recoveryId)); });
    PluginManager.registerCommand(PLUGIN_NAME, "searchProjectReferences", function(args) { console.log(`${PLUGIN_NAME} project search:`, searchProjectReferences(args.query || "", parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "planReferenceRename", function(args) { console.log(`${PLUGIN_NAME} rename plan:`, planReferenceRename(args.from, args.to, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "analyzePassabilityMap", function(args) { console.log(`${PLUGIN_NAME} passability:`, analyzePassabilityMap(null, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "detectMapSoftlocks", function(args) { console.log(`${PLUGIN_NAME} softlocks:`, detectMapSoftlocks(null, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "performanceCenterReport", function(args) { console.log(`${PLUGIN_NAME} performance center:`, performanceCenterReport(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "configureExtensionSecurityProfile", function(args) { console.log(`${PLUGIN_NAME} extension security:`, configureExtensionSecurityProfile(args.extensionId, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "registerExtensionPublisher", function(args) { console.log(`${PLUGIN_NAME} extension publisher:`, registerExtensionPublisher(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "verifyExtensionPublisher", function(args) { console.log(`${PLUGIN_NAME} extension verification:`, verifyExtensionPublisher(args.extensionId)); });
    PluginManager.registerCommand(PLUGIN_NAME, "compareCollaborationBundles", function(args) { console.log(`${PLUGIN_NAME} collaboration comparison:`, compareCollaborationBundles(args.fromId, args.toId)); });
    PluginManager.registerCommand(PLUGIN_NAME, "createCollaborationMergePlan", function(args) { console.log(`${PLUGIN_NAME} collaboration merge plan:`, createCollaborationMergePlan(args.fromId, args.toId, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "registerCompatibilityProfileV15", function(args) { console.log(`${PLUGIN_NAME} compatibility profile:`, registerCompatibilityProfileV15(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "runCompatibilityProfilesV15", function(args) { console.log(`${PLUGIN_NAME} compatibility profiles:`, runCompatibilityProfilesV15(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "compareReleaseFingerprints", function(args) { console.log(`${PLUGIN_NAME} release comparison:`, compareReleaseFingerprints(args.fromId, args.toId)); });
    PluginManager.registerCommand(PLUGIN_NAME, "createReleaseManifestV15", function(args) { console.log(`${PLUGIN_NAME} release manifest:`, createReleaseManifestV15(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "validateProductionHandoff", function(args) { waitForPromise(this, validateProductionHandoff(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} production handoff:`, result); return result; })); });
    PluginManager.registerCommand(PLUGIN_NAME, "createVisualMapDraft", function(args) { console.log(`${PLUGIN_NAME} visual map draft:`, createVisualMapDraft(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "paintVisualMapDraft", function(args) { console.log(`${PLUGIN_NAME} map draft paint:`, paintVisualMapDraft(args.draftId, parseJson(args.operationsJson, []) || [])); });
    PluginManager.registerCommand(PLUGIN_NAME, "undoVisualMapDraft", function(args) { console.log(`${PLUGIN_NAME} map draft undo:`, undoVisualMapDraft(args.draftId)); });
    PluginManager.registerCommand(PLUGIN_NAME, "commitVisualMapDraft", function(args) { console.log(`${PLUGIN_NAME} map draft commit:`, commitVisualMapDraft(args.draftId, parseJson(args.optionsJson, { apply:true }) || { apply:true })); });
    PluginManager.registerCommand(PLUGIN_NAME, "compileWorldRecipeGraph", function(args) { console.log(`${PLUGIN_NAME} recipe graph:`, compileWorldRecipeGraph(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "lockWorldRecipeGraphCells", function(args) { console.log(`${PLUGIN_NAME} recipe cell locks:`, lockWorldRecipeGraphCells(args.graphId, parseJson(args.cellsJson, []) || [], toBoolean(args.locked, true))); });
    PluginManager.registerCommand(PLUGIN_NAME, "regenerateWorldRecipeGraph", function(args) { console.log(`${PLUGIN_NAME} recipe regeneration:`, regenerateWorldRecipeGraph(args.graphId, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "createRoundTripPlan", function(args) { console.log(`${PLUGIN_NAME} round-trip plan:`, createRoundTripPlan($dataMap, parseJson(args.afterJson, {}) || {}, parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "createQuestProject", function(args) { console.log(`${PLUGIN_NAME} quest project:`, createQuestProject(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "createCutsceneTimeline", function(args) { console.log(`${PLUGIN_NAME} cutscene timeline:`, createCutsceneTimeline(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "runPlaytestLab", function(args) { waitForPromise(this, runPlaytestLab(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} playtest lab:`, result); return result; })); });
    PluginManager.registerCommand(PLUGIN_NAME, "createBugReportBundle", function(args) { console.log(`${PLUGIN_NAME} bug report:`, createBugReportBundle(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "setCreatorExperienceV16", function(args) { console.log(`${PLUGIN_NAME} creator experience:`, setCreatorExperienceV16(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "registerContentLibraryItem", function(args) { console.log(`${PLUGIN_NAME} content item:`, registerContentLibraryItem(parseJson(args.definitionJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "searchContentLibraryV16", function(args) { console.log(`${PLUGIN_NAME} content search:`, searchContentLibraryV16(args.query || "", parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "createThreeWayProjectMerge", function(args) { const values=parseJson(args.snapshotsJson,{})||{};console.log(`${PLUGIN_NAME} project merge:`,createThreeWayProjectMerge(values.base||{},values.ours||{},values.theirs||{},parseJson(args.optionsJson,{})||{})); });
    PluginManager.registerCommand(PLUGIN_NAME, "createSourceControlSnapshot", function(args) { console.log(`${PLUGIN_NAME} source snapshot:`, createSourceControlSnapshot(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "setExtensionCapabilityPolicyV16", function(args) { console.log(`${PLUGIN_NAME} extension policy:`, setExtensionCapabilityPolicyV16(args.extensionId, parseJson(args.policyJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "safeModeV16", function(args) { console.log(`${PLUGIN_NAME} Safe Mode:`, safeModeV16(parseJson(args.optionsJson, {}) || {})); });
    PluginManager.registerCommand(PLUGIN_NAME, "productionDashboardV16", function(args) { waitForPromise(this, productionDashboardV16(parseJson(args.optionsJson, {}) || {}).then(result => { console.log(`${PLUGIN_NAME} production dashboard:`, result); return result; })); });

    PluginManager.registerCommand(PLUGIN_NAME, "reloadWorldRecipes", function() {
        waitForPromise(this, loadWorldRecipeCatalog());
    });

    instrumentHybridPluginCommands();
    loadWorldRecipeCatalog().catch(error => captureError(error, { operation: "loadWorldRecipeCatalog" }));

    console.log(`${PLUGIN_NAME} v${VERSION} loaded.`);
})();
