    // -------------------------------------------------------------------------
    // Save data and migration
    // -------------------------------------------------------------------------

    function newStore() {
        return {
            version: 18,
            maps: {},
            redo: {},
            mapOverrides: {},
            authoringLayers: {},
            activeAuthoringLayers: {},
            masks: {},
            modifiers: {},
            prefabInstances: {},
            changeSets: {},
            projectSnapshots: [],
            mergeHistory: [],
            eventStates: {},
            prefabs: {},
            prefabPayloads: {},
            prefabRevisions: {},
            prefabFavorites: {},
            prefabRecent: [],
            eventTemplates: {},
            recentTiles: [],
            favoriteTiles: {},
            brushPresets: {},
            editorPreferences: {
                zoom: 1,
                grid: false,
                overlay: "none",
                layerVisibility: { L1: true, L2: true, L3: true, L4: true, L5: true, L6: true },
                layerLocks: { L1: false, L2: false, L3: false, L4: false, L5: false, L6: false },
                layerOpacity: { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 1 },
                keyBindings: {},
                gamepadBindings: {},
                dockLayout: {},
                promptFree: true
            },
            activeAdapterProfiles: [],
            checkpoints: {},
            recovery: {},
            bakeBackups: [],
            importHistory: [],
            operationLog: [],
            errorReports: [],
            adapterTestResults: {},
            mapBookmarks: [],
            projectTransactions: [],
            activeProjectTransaction: null,
            workspaceBranches: {},
            activeWorkspaceBranch: "main",
            reviewComments: [],
            reviewThreads: [],
            wfcRuleSets: {},
            wfcDiagnostics: [],
            extensionData: {},
            worldRecipes: {},
            worldRecipeStates: {},
            worldState: {},
            worldRecipeLog: [],
            worldClock: { enabled: true, minute: 480, day: 1, season: "spring", framesPerMinute: 60, daysPerSeason: 30, seasons: ["spring", "summer", "autumn", "winter"], frameCarry: 0 },
            worldFacts: {},
            worldZones: {},
            worldEntities: {},
            worldResources: {},
            worldSchedules: [],
            worldRecipePacks: {},
            worldRecipeProfiles: {},
            worldRecipeBreakpoints: {},
            worldRecipePaused: {},
            worldRecipeTests: [],
            worldMapVariants: {},
            worldNpcs: {},
            worldNpcRoutes: {},
            worldNpcOccupancy: {},
            worldRuleLayers: {},
            worldRuleBrushes: {},
            worldBiomeGraphs: {},
            worldBiomeCache: {},
            worldBiomeLocks: {},
            worldDebugger: { watches: {}, history: [] },
            worldPackHistory: [],
            worldPackLock: { format: "HybridWorldPackLock", version: 1, packs: {} },
            packPublishers: {},
            signedPackTrust: {},
            recoverySnapshots: [],
            contentCatalogs: {},
            catalogSubscriptions: {},
            benchmarkHistory: [],
            worldAtlases: {},
            eventQuestGraphs: {},
            mapRepairProfiles: {},
            visualHistory: [],
            extensionManifests: {},
            extensionPermissions: {},
            packRepositories: {},
            validationRuns: [],
            deploymentReports: [],
            liveProductionSessions: [],
            activeLiveProductionSession: null,
            playtestRecordings: [],
            activePlaytestRecordingId: null,
            playtestScenarios: {},
            scenarioRuns: [],
            semanticTilesets: {},
            extensionSandboxes: {},
            contentCollections: {},
            collaborationBundles: [],
            releaseFingerprints: [],
            liveProtocol: { version: 2, lastSequence: 0, capabilities: [] },
            playtestJourneyRuns: [],
            productionTestRuns: [],
            universalRecoveryPoints: [],
            projectSearchHistory: [],
            referenceRenamePlans: [],
            passabilityReports: [],
            softlockReports: [],
            performanceCenterReports: [],
            extensionSecurityProfiles: {},
            extensionPublishers: {},
            collaborationComparisons: [],
            collaborationMergePlans: [],
            compatibilityProfilesV15: {},
            compatibilityProfileRunsV15: [],
            releaseComparisons: [],
            releaseManifestsV15: [],
            productionHandoffs: [],
            visualMapDraftsV16: {},
            worldRecipeGraphsV16: {},
            roundTripPlansV16: [],
            questProjectsV16: {},
            cutsceneTimelinesV16: {},
            playtestLabRunsV16: [],
            bugReportBundlesV16: [],
            creatorExperienceV16: { mode: "guided", largeText: false, highContrast: false, reducedMotion: false, sound: true, controller: true },
            contentLibraryV16: {},
            projectMergePlansV16: [],
            extensionCapabilityPoliciesV16: {},
            sourceControlSnapshotsV16: [],
            productionDashboardsV16: [],
            safeModeV16: { enabled: true, requireRecoveryPoint: true, maximumWrites: 100000 },
            runtimeBudget: { frameBudgetMs: 8, recipeRunsPerFrame: 8, simulationStepsPerFrame: 60, spatialCellSize: 16 },
            backupPolicy: { retain: 10 },
            recoveryPolicy: { retain: 10, snapshotMinutes: 0 },
            compatibilityRuns: [],
            assetAuditHistory: [],
            productionPreferences: { locale: "en", highContrast: false, reducedMotion: false, renderBudget: 12000 },
            nextSpawnId: SPAWN_ID_OFFSET,
            animationFrames: DEFAULT_ANIMATION_FRAMES
        };
    }

    function migrateStore(raw) {
        if (!raw || typeof raw !== "object") return newStore();
        if (raw.version >= 2 && raw.maps) {
            raw.version = 18;
            raw.redo ||= {};
            raw.mapOverrides ||= {};
            raw.authoringLayers ||= {};
            raw.activeAuthoringLayers ||= {};
            raw.masks ||= {};
            raw.modifiers ||= {};
            raw.prefabInstances ||= {};
            raw.changeSets ||= {};
            raw.projectSnapshots ||= [];
            raw.mergeHistory ||= [];
            raw.eventStates ||= {};
            raw.prefabs ||= {};
            raw.prefabPayloads ||= {};
            raw.prefabRevisions ||= {};
            raw.prefabFavorites ||= {};
            raw.prefabRecent ||= [];
            raw.eventTemplates ||= {};
            raw.recentTiles ||= [];
            raw.favoriteTiles ||= {};
            raw.brushPresets ||= {};
            raw.editorPreferences ||= {};
            raw.editorPreferences.zoom = Math.max(0.25, Math.min(4, finiteNumber(raw.editorPreferences.zoom, 1)));
            raw.editorPreferences.grid = toBoolean(raw.editorPreferences.grid, false);
            raw.editorPreferences.overlay ||= "none";
            raw.editorPreferences.layerVisibility = Object.assign({ L1: true, L2: true, L3: true, L4: true, L5: true, L6: true }, raw.editorPreferences.layerVisibility || {});
            raw.editorPreferences.layerLocks = Object.assign({ L1: false, L2: false, L3: false, L4: false, L5: false, L6: false }, raw.editorPreferences.layerLocks || {});
            raw.editorPreferences.layerOpacity = Object.assign({ L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 1 }, raw.editorPreferences.layerOpacity || {});
            raw.editorPreferences.keyBindings ||= {};
            raw.editorPreferences.gamepadBindings ||= {};
            raw.editorPreferences.dockLayout ||= {};
            raw.editorPreferences.promptFree = raw.editorPreferences.promptFree !== false;
            raw.activeAdapterProfiles ||= [];
            raw.checkpoints ||= {};
            raw.recovery ||= {};
            raw.bakeBackups ||= [];
            raw.importHistory ||= [];
            raw.operationLog ||= [];
            raw.errorReports ||= [];
            raw.adapterTestResults ||= {};
            raw.mapBookmarks ||= [];
            raw.projectTransactions ||= [];
            raw.activeProjectTransaction ||= null;
            raw.workspaceBranches ||= {};
            raw.activeWorkspaceBranch ||= "main";
            raw.reviewComments ||= [];
            raw.reviewThreads ||= [];
            raw.wfcRuleSets ||= {};
            raw.wfcDiagnostics ||= [];
            raw.extensionData ||= {};
            raw.worldRecipes ||= {};
            raw.worldRecipeStates ||= {};
            raw.worldState ||= {};
            raw.worldRecipeLog ||= [];
            raw.worldClock = Object.assign({ enabled: true, minute: 480, day: 1, season: "spring", framesPerMinute: 60, daysPerSeason: 30, seasons: ["spring", "summer", "autumn", "winter"], frameCarry: 0 }, raw.worldClock || {});
            raw.worldFacts ||= {};
            raw.worldZones ||= {};
            raw.worldEntities ||= {};
            raw.worldResources ||= {};
            raw.worldSchedules ||= [];
            raw.worldRecipePacks ||= {};
            raw.worldRecipeProfiles ||= {};
            raw.worldRecipeBreakpoints ||= {};
            raw.worldRecipePaused ||= {};
            raw.worldRecipeTests ||= [];
            raw.worldMapVariants ||= {};
            raw.worldNpcs ||= {};
            raw.worldNpcRoutes ||= {};
            raw.worldNpcOccupancy ||= {};
            raw.worldRuleLayers ||= {};
            raw.worldRuleBrushes ||= {};
            raw.worldBiomeGraphs ||= {};
            raw.worldBiomeCache ||= {};
            raw.worldBiomeLocks ||= {};
            raw.worldDebugger ||= { watches: {}, history: [] };
            raw.worldDebugger.watches ||= {};
            raw.worldDebugger.history ||= [];
            raw.worldPackHistory ||= [];
            raw.worldPackLock ||= { format: "HybridWorldPackLock", version: 1, packs: {} };
            raw.worldPackLock.packs ||= {};
            raw.packPublishers ||= {};
            raw.signedPackTrust ||= {};
            raw.recoverySnapshots ||= [];
            raw.contentCatalogs ||= {};
            raw.catalogSubscriptions ||= {};
            raw.benchmarkHistory ||= [];
            raw.worldAtlases ||= {};
            raw.eventQuestGraphs ||= {};
            raw.mapRepairProfiles ||= {};
            raw.visualHistory ||= [];
            raw.extensionManifests ||= {};
            raw.extensionPermissions ||= {};
            raw.packRepositories ||= {};
            raw.validationRuns ||= [];
            raw.deploymentReports ||= [];
            raw.liveProductionSessions ||= [];
            raw.activeLiveProductionSession ||= null;
            raw.playtestRecordings ||= [];
            raw.activePlaytestRecordingId ||= null;
            raw.playtestScenarios ||= {};
            raw.scenarioRuns ||= [];
            raw.semanticTilesets ||= {};
            raw.extensionSandboxes ||= {};
            raw.contentCollections ||= {};
            raw.collaborationBundles ||= [];
            raw.releaseFingerprints ||= [];
            raw.liveProtocol = Object.assign({ version: 2, lastSequence: 0, capabilities: [] }, raw.liveProtocol || {});
            raw.playtestJourneyRuns ||= [];
            raw.productionTestRuns ||= [];
            raw.universalRecoveryPoints ||= [];
            raw.projectSearchHistory ||= [];
            raw.referenceRenamePlans ||= [];
            raw.passabilityReports ||= [];
            raw.softlockReports ||= [];
            raw.performanceCenterReports ||= [];
            raw.extensionSecurityProfiles ||= {};
            raw.extensionPublishers ||= {};
            raw.collaborationComparisons ||= [];
            raw.collaborationMergePlans ||= [];
            raw.compatibilityProfilesV15 ||= {};
            raw.compatibilityProfileRunsV15 ||= [];
            raw.releaseComparisons ||= [];
            raw.releaseManifestsV15 ||= [];
            raw.productionHandoffs ||= [];
            raw.visualMapDraftsV16 ||= {};
            raw.worldRecipeGraphsV16 ||= {};
            raw.roundTripPlansV16 ||= [];
            raw.questProjectsV16 ||= {};
            raw.cutsceneTimelinesV16 ||= {};
            raw.playtestLabRunsV16 ||= [];
            raw.bugReportBundlesV16 ||= [];
            raw.creatorExperienceV16 = Object.assign({ mode: "guided", largeText: false, highContrast: false, reducedMotion: false, sound: true, controller: true }, raw.creatorExperienceV16 || {});
            raw.contentLibraryV16 ||= {};
            raw.projectMergePlansV16 ||= [];
            raw.extensionCapabilityPoliciesV16 ||= {};
            raw.sourceControlSnapshotsV16 ||= [];
            raw.productionDashboardsV16 ||= [];
            raw.safeModeV16 = Object.assign({ enabled: true, requireRecoveryPoint: true, maximumWrites: 100000 }, raw.safeModeV16 || {});
            raw.runtimeBudget = Object.assign({ frameBudgetMs: 8, recipeRunsPerFrame: 8, simulationStepsPerFrame: 60, spatialCellSize: 16 }, raw.runtimeBudget || {});
            raw.backupPolicy ||= { retain: 10 };
            raw.recoveryPolicy ||= { retain: raw.backupPolicy.retain || 10, snapshotMinutes: 0 };
            raw.compatibilityRuns ||= [];
            raw.assetAuditHistory ||= [];
            raw.productionPreferences = Object.assign({ locale: "en", highContrast: false, reducedMotion: false, renderBudget: 12000 }, raw.productionPreferences || {});
            raw.nextSpawnId = Math.max(SPAWN_ID_OFFSET, integer(raw.nextSpawnId, SPAWN_ID_OFFSET));
            raw.animationFrames = Math.max(1, integer(raw.animationFrames, DEFAULT_ANIMATION_FRAMES));
            return raw;
        }
        const migrated = newStore();
        for (const [key, value] of Object.entries(raw)) {
            if (/^\d+$/.test(key) && Array.isArray(value)) migrated.maps[key] = value;
        }
        if (typeof $gameSystem !== "undefined" && $gameSystem._hybridSpawnCounter) {
            migrated.nextSpawnId = Math.max(SPAWN_ID_OFFSET, integer($gameSystem._hybridSpawnCounter));
        }
        return migrated;
    }

    function ensureStore() {
        if (typeof $gameSystem === "undefined" || !$gameSystem) {
            fallbackStore ||= newStore();
            return fallbackStore;
        }
        $gameSystem._hybridTileGraft = migrateStore($gameSystem._hybridTileGraft);
        return $gameSystem._hybridTileGraft;
    }

    function getPatches(mapId) {
        return ensureStore().maps[String(integer(mapId))] || [];
    }

    function authoringLayerBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.authoringLayers[key] ||= [];
        return store.authoringLayers[key] || [];
    }

    function createAuthoringLayer(name, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const bucket = authoringLayerBucket(id, true);
        const label = String(name || `Layer ${bucket.length + 1}`).trim() || `Layer ${bucket.length + 1}`;
        const layer = {
            id: String(options.id || `layer-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: label,
            visible: options.visible !== false,
            locked: toBoolean(options.locked, false),
            opacity: Math.max(0, Math.min(1, finiteNumber(options.opacity, 1))),
            color: String(options.color || "#66e0ff"),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        bucket.push(layer);
        if (options.activate !== false && !layer.locked) ensureStore().activeAuthoringLayers[String(id)] = layer.id;
        composedCache.delete(id);
        recordOperation("createAuthoringLayer", { mapId: id, layerId: layer.id, name: layer.name });
        return deepClone(layer);
    }

    function listAuthoringLayers(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const patches = getPatches(id);
        const active = ensureStore().activeAuthoringLayers[String(id)] || null;
        return authoringLayerBucket(id).map((layer, order) => Object.assign(deepClone(layer), {
            order,
            active: layer.id === active,
            patchCount: patches.filter(patch => patch && patch.authoringLayerId === layer.id).length,
            estimatedWrites: patches.filter(patch => patch && patch.authoringLayerId === layer.id)
                .reduce((sum, patch) => sum + patchWriteCount(patch), 0)
        }));
    }

    function activeAuthoringLayer(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const activeId = ensureStore().activeAuthoringLayers[String(id)];
        const layer = authoringLayerBucket(id).find(item => item.id === activeId);
        return layer ? deepClone(layer) : null;
    }

    function setActiveAuthoringLayer(layerId, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const key = String(id);
        if (layerId === null || layerId === undefined || layerId === "" || layerId === "base") {
            delete ensureStore().activeAuthoringLayers[key];
            return null;
        }
        const layer = authoringLayerBucket(id).find(item => item.id === String(layerId) || item.name.toLowerCase() === String(layerId).toLowerCase());
        if (!layer || layer.locked) return false;
        ensureStore().activeAuthoringLayers[key] = layer.id;
        return deepClone(layer);
    }

    function updateAuthoringLayer(layerId, changes = {}, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const layer = authoringLayerBucket(id).find(item => item.id === String(layerId));
        if (!layer) return false;
        if (changes.name !== undefined) layer.name = String(changes.name || layer.name).trim() || layer.name;
        if (changes.visible !== undefined) layer.visible = toBoolean(changes.visible, true);
        if (changes.opacity !== undefined) layer.opacity = Math.max(0, Math.min(1, finiteNumber(changes.opacity, 1)));
        if (changes.color !== undefined) layer.color = String(changes.color || layer.color);
        if (changes.locked !== undefined) {
            layer.locked = toBoolean(changes.locked, false);
            if (layer.locked && ensureStore().activeAuthoringLayers[String(id)] === layer.id) delete ensureStore().activeAuthoringLayers[String(id)];
        }
        layer.updatedAt = Date.now();
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("updateAuthoringLayer");
        else emitChange({ operation: "updateAuthoringLayer", mapId: id, remote: true, layerId: layer.id });
        return deepClone(layer);
    }

    function reorderAuthoringLayer(layerId, newIndex, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const bucket = authoringLayerBucket(id);
        const index = bucket.findIndex(item => item.id === String(layerId));
        if (index < 0) return false;
        const [layer] = bucket.splice(index, 1);
        bucket.splice(Math.max(0, Math.min(bucket.length, integer(newIndex))), 0, layer);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("reorderAuthoringLayer");
        return listAuthoringLayers(id);
    }

    function duplicateAuthoringLayer(layerId, newName, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const source = authoringLayerBucket(id).find(item => item.id === String(layerId));
        if (!source) return false;
        const copy = createAuthoringLayer(newName || `${source.name} Copy`, id, {
            visible: source.visible, opacity: source.opacity, color: source.color, activate: true
        });
        const store = ensureStore();
        const key = String(id);
        const clones = (store.maps[key] || []).filter(patch => patch && patch.authoringLayerId === source.id).map(patch => {
            const clone = deepClone(patch);
            clone.authoringLayerId = copy.id;
            clone.label = `${clone.label || "Change"} (Copy)`;
            return clone;
        });
        store.maps[key].push(...clones);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("duplicateAuthoringLayer");
        return Object.assign(copy, { copiedPatches: clones.length });
    }

    function mergeAuthoringLayer(layerId, targetLayerId = "base", mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const source = authoringLayerBucket(id).find(item => item.id === String(layerId));
        if (!source || source.locked) return false;
        let target = null;
        if (targetLayerId && targetLayerId !== "base") {
            target = authoringLayerBucket(id).find(item => item.id === String(targetLayerId));
            if (!target || target.locked) return false;
        }
        let count = 0;
        for (const patch of store.maps[key] || []) if (patch && patch.authoringLayerId === source.id) {
            if (target) patch.authoringLayerId = target.id;
            else delete patch.authoringLayerId;
            count++;
        }
        store.authoringLayers[key] = authoringLayerBucket(id).filter(item => item.id !== source.id);
        if (store.activeAuthoringLayers[key] === source.id) {
            if (target) store.activeAuthoringLayers[key] = target.id;
            else delete store.activeAuthoringLayers[key];
        }
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("mergeAuthoringLayer");
        return { mapId: id, sourceLayerId: source.id, targetLayerId: target ? target.id : null, mergedPatches: count };
    }

    function deleteAuthoringLayer(layerId, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        if (options.discardPatches !== true) return mergeAuthoringLayer(layerId, options.targetLayerId || "base", id);
        const store = ensureStore();
        const key = String(id);
        const source = authoringLayerBucket(id).find(item => item.id === String(layerId));
        if (!source || source.locked) return false;
        const before = (store.maps[key] || []).length;
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.authoringLayerId !== source.id);
        store.authoringLayers[key] = authoringLayerBucket(id).filter(item => item.id !== source.id);
        if (store.activeAuthoringLayers[key] === source.id) delete store.activeAuthoringLayers[key];
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("deleteAuthoringLayer");
        return { mapId: id, layerId: source.id, discardedPatches: before - store.maps[key].length };
    }

    function composedPatchesForMap(mapId) {
        const id = integer(mapId);
        const disabledModifiers = new Set((ensureStore().modifiers[String(id)] || [])
            .filter(modifier => modifier.enabled === false).map(modifier => modifier.id));
        const raw = getPatches(id).filter(patch => !patch || !patch.modifierId || !disabledModifiers.has(patch.modifierId));
        const layers = authoringLayerBucket(id);
        if (!layers.length) return raw;
        const known = new Set(layers.map(layer => layer.id));
        const output = raw.filter(patch => !patch || !patch.authoringLayerId || !known.has(patch.authoringLayerId));
        for (const layer of layers) if (layer.visible !== false) {
            output.push(...raw.filter(patch => patch && patch.authoringLayerId === layer.id));
        }
        return output;
    }

    function addPatch(mapId, patch, preserveRedo = false) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        store.maps[key] ||= [];
        const activeLayerId = store.activeAuthoringLayers[key];
        if (activeLayerId && !patch.authoringLayerId) patch.authoringLayerId = activeLayerId;
        store.maps[key].push(patch);
        if (!preserveRedo) delete store.redo[key];
        composedCache.delete(id);
        if (
            MAX_SAVED_PATCHES > 0 &&
            store.maps[key].length > MAX_SAVED_PATCHES &&
            currentPristine &&
            currentPristine.mapId === id &&
            !(activeEditTransaction && activeEditTransaction.mapId === id)
        ) {
            compactMapSync(id, false);
        }
        if (!suppressAutomaticCheckpoint && !activeEditTransaction && AUTO_CHECKPOINT_EVERY > 0 &&
            store.maps[key].length > 0 && store.maps[key].length % AUTO_CHECKPOINT_EVERY === 0) {
            createAutomaticCheckpoint(id);
        }
        return patch;
    }

    function createAutomaticCheckpoint(mapId) {
        const id = integer(mapId);
        const store = ensureStore();
        const name = `[Auto] ${new Date().toISOString()}`;
        createCheckpoint(name, id, { automatic: true });
        const bucket = store.checkpoints[String(id)] || {};
        const automatic = Object.values(bucket).filter(item => item.automatic)
            .sort((a, b) => b.createdAt - a.createdAt);
        for (const item of automatic.slice(MAX_AUTO_CHECKPOINTS)) delete bucket[item.name];
        return name;
    }

    function eventStateBucket(mapId, create = false) {
        const states = ensureStore().eventStates;
        const key = String(integer(mapId));
        if (create) states[key] ||= {};
        return states[key] || null;
    }

    function nextSpawnId() {
        const store = ensureStore();
        let id = Math.max(SPAWN_ID_OFFSET, integer(store.nextSpawnId, SPAWN_ID_OFFSET));
        const occupied = $dataMap && $dataMap.events ? $dataMap.events : [];
        while (occupied[id] && !isHybridEventData(occupied[id])) id++;
        store.nextSpawnId = id + 1;
        if ($gameSystem) $gameSystem._hybridSpawnCounter = store.nextSpawnId;
        return id;
    }

    function setAnimationFrames(frames) {
        const value = Math.max(1, integer(frames, DEFAULT_ANIMATION_FRAMES));
        ensureStore().animationFrames = value;
        return value;
    }

    function animationFrames() {
        return Math.max(1, integer(ensureStore().animationFrames, DEFAULT_ANIMATION_FRAMES));
    }

