    // -------------------------------------------------------------------------
    // Spawned events
    // -------------------------------------------------------------------------

    function isHybridEventData(data) {
        return !!(data && (data._hybridTileGraftSpawn || data._hybridSpawnId));
    }

    function isHybridGameEvent(event) {
        if (!event) return false;
        if (event._hybridTileGraftSpawn) return true;
        const data = event.event ? event.event() : null;
        return isHybridEventData(data) || (event.eventId && event.eventId() >= SPAWN_ID_OFFSET);
    }

    function prepareTargetEventSnapshot(sourceEvent) {
        const clone = deepClone(sourceEvent);
        clone.id = nextSpawnId();
        clone._hybridSpawnId = clone.id;
        clone._hybridTileGraftSpawn = true;
        return clone;
    }

    function extractEvents(source, rect, offsetX, offsetY) {
        const found = [];
        for (const event of source.events || []) {
            if (!event || !inRect(event.x, event.y, rect)) continue;
            const clone = prepareTargetEventSnapshot(event);
            clone.x = integer(event.x) + offsetX;
            clone.y = integer(event.y) + offsetY;
            found.push(clone);
        }
        return found;
    }

    function patchAffectsEvents(patch) {
        if (patch && patch.kind === "batch") return flattenPatches(patch.patches).some(patchAffectsEvents);
        return patch.affectEvents === true || Array.isArray(patch.events);
    }

    function composeEvents(baseEvents, patches, mapId) {
        const result = deepClone(baseEvents || []);
        for (const patch of flattenPatches(patches)) {
            if (!patchAffectsEvents(patch)) continue;
            const rect = eventPatchRect(patch);
            for (const id of patch.removeEventIds || []) {
                if (isHybridEventData(result[id])) result[id] = null;
            }
            if (patch.replaceAreaEvents !== false) {
                for (let id = 0; id < result.length; id++) {
                    const event = result[id];
                    if (isHybridEventData(event) && inRect(event.x, event.y, rect)) result[id] = null;
                }
            }
            for (const source of patch.events || []) {
                const event = deepClone(source);
                let id = integer(event._hybridSpawnId || event.id, 0);
                if (id < SPAWN_ID_OFFSET || (result[id] && !isHybridEventData(result[id]))) {
                    id = nextSpawnId();
                    source.id = id;
                    source._hybridSpawnId = id;
                }
                event.id = id;
                event._hybridSpawnId = id;
                event._hybridTileGraftSpawn = true;
                result[id] = event;
            }
        }
        applySavedPositionsToEventData(result, mapId);
        return result;
    }

    function applySavedPositionsToEventData(events, mapId) {
        const states = eventStateBucket(mapId, false);
        if (!states) return;
        for (const event of events || []) {
            if (!isHybridEventData(event)) continue;
            const state = states[String(event.id)];
            if (state) {
                event.x = integer(state.x, event.x);
                event.y = integer(state.y, event.y);
            }
        }
    }

    function captureSpawnedRuntimeStates() {
        if (!$gameMap || !$gameMap.events || $gameMap.mapId() <= 0) return;
        const mapId = $gameMap.mapId();
        const bucket = eventStateBucket(mapId, true);
        for (const event of $gameMap.events()) {
            if (!isHybridGameEvent(event)) continue;
            const id = event.eventId();
            bucket[String(id)] = {
                x: event.x,
                y: event.y,
                direction: event.direction ? event.direction() : 2,
                pattern: event.pattern ? event.pattern() : 1,
                moveSpeed: event.moveSpeed ? event.moveSpeed() : 3,
                opacity: event.opacity ? event.opacity() : 255,
                blendMode: event.blendMode ? event.blendMode() : 0,
                transparent: event.isTransparent ? event.isTransparent() : false,
                through: event.isThrough ? event.isThrough() : false,
                directionFix: event.isDirectionFixed ? event.isDirectionFixed() : false,
                walkAnime: event.hasWalkAnime ? event.hasWalkAnime() : true,
                stepAnime: event.hasStepAnime ? event.hasStepAnime() : false
            };
        }
    }

    function applyRuntimeState(gameEvent) {
        const bucket = eventStateBucket($gameMap.mapId(), false);
        const state = bucket && bucket[String(gameEvent.eventId())];
        if (!state) return;
        if (gameEvent.locate) gameEvent.locate(integer(state.x), integer(state.y));
        if (gameEvent.setDirection) gameEvent.setDirection(integer(state.direction, 2));
        if (gameEvent.setPattern) gameEvent.setPattern(integer(state.pattern, 1));
        if (gameEvent.setMoveSpeed) gameEvent.setMoveSpeed(finiteNumber(state.moveSpeed, 3));
        if (gameEvent.setOpacity) gameEvent.setOpacity(integer(state.opacity, 255));
        if (gameEvent.setBlendMode) gameEvent.setBlendMode(integer(state.blendMode, 0));
        if (gameEvent.setTransparent) gameEvent.setTransparent(!!state.transparent);
        if (gameEvent.setThrough) gameEvent.setThrough(!!state.through);
        if (gameEvent.setDirectionFix) gameEvent.setDirectionFix(!!state.directionFix);
        if (gameEvent.setWalkAnime) gameEvent.setWalkAnime(state.walkAnime !== false);
        if (gameEvent.setStepAnime) gameEvent.setStepAnime(!!state.stepAnime);
    }

    function clearSelfSwitches(mapId, eventId) {
        if (!$gameSelfSwitches || !$gameSelfSwitches._data) return;
        const prefix = `${integer(mapId)},${integer(eventId)},`;
        for (const key of Object.keys($gameSelfSwitches._data)) {
            if (key.startsWith(prefix)) delete $gameSelfSwitches._data[key];
        }
        if ($gameSelfSwitches.onChange) $gameSelfSwitches.onChange();
    }

    function clearEventState(mapId, eventId) {
        const bucket = eventStateBucket(mapId, false);
        if (bucket) delete bucket[String(integer(eventId))];
        clearSelfSwitches(mapId, eventId);
    }

    function addSpawnedEventSprite(gameEvent) {
        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map) || !scene._spriteset || !scene._spriteset._tilemap) return;
        const sprite = new Sprite_Character(gameEvent);
        scene._spriteset._characterSprites.push(sprite);
        scene._spriteset._tilemap.addChild(sprite);
    }

    function removeSpawnedEventSprite(gameEvent) {
        const scene = SceneManager._scene;
        if (!(scene instanceof Scene_Map) || !scene._spriteset || !scene._spriteset._tilemap) return;
        const sprites = scene._spriteset._characterSprites;
        const index = sprites.findIndex(sprite => sprite._character === gameEvent);
        if (index < 0) return;
        const sprite = sprites[index];
        scene._spriteset._tilemap.removeChild(sprite);
        sprites.splice(index, 1);
        if (sprite.destroy) sprite.destroy();
    }

    function spawnEventFromSnapshot(snapshot, addSprite = true) {
        const event = deepClone(snapshot);
        let id = integer(event._hybridSpawnId || event.id, 0);
        if (id < SPAWN_ID_OFFSET || ($dataMap.events[id] && !isHybridEventData($dataMap.events[id]))) {
            id = nextSpawnId();
            snapshot.id = id;
            snapshot._hybridSpawnId = id;
        }
        event.id = id;
        event._hybridSpawnId = id;
        event._hybridTileGraftSpawn = true;
        $dataMap.events[id] = event;
        const gameEvent = new Game_Event($gameMap.mapId(), id);
        gameEvent._hybridTileGraftSpawn = true;
        applyRuntimeState(gameEvent);
        $gameMap._events[id] = gameEvent;
        spawnedIds.add(id);
        spawnedMapId = $gameMap.mapId();
        if (addSprite) addSpawnedEventSprite(gameEvent);
        return id;
    }

    function despawnEvent(id, clearState = false) {
        const gameEvent = $gameMap && $gameMap._events ? $gameMap._events[id] : null;
        if (gameEvent) removeSpawnedEventSprite(gameEvent);
        if ($gameMap && $gameMap._events) $gameMap._events[id] = null;
        if ($dataMap && $dataMap.events && isHybridEventData($dataMap.events[id])) $dataMap.events[id] = null;
        spawnedIds.delete(id);
        if (clearState) clearEventState($gameMap.mapId(), id);
    }

    function despawnEventsInArea(rect, clearState = false) {
        for (const event of $gameMap.events().slice()) {
            if (isHybridGameEvent(event) && inRect(event.x, event.y, rect)) {
                despawnEvent(event.eventId(), clearState);
            }
        }
    }

    function spawnedEventIdsInArea(rect) {
        const ids = [];
        for (const event of $gameMap.events()) {
            if (isHybridGameEvent(event) && inRect(event.x, event.y, rect)) ids.push(event.eventId());
        }
        return ids;
    }

    function despawnAllTrackedEvents(clearState = false) {
        const ids = new Set(spawnedIds);
        if ($gameMap && $gameMap.events) {
            for (const event of $gameMap.events()) {
                if (isHybridGameEvent(event)) ids.add(event.eventId());
            }
        }
        for (const id of ids) despawnEvent(id, clearState);
        spawnedIds.clear();
    }

    function initializeSpawnTracking() {
        spawnedIds.clear();
        spawnedMapId = $gameMap.mapId();
        for (const event of $gameMap.events()) {
            if (!isHybridGameEvent(event)) continue;
            event._hybridTileGraftSpawn = true;
            spawnedIds.add(event.eventId());
            applyRuntimeState(event);
        }
    }

    function syncSpawnedEventsFromData() {
        const desired = [];
        for (const event of $dataMap.events || []) if (isHybridEventData(event)) desired.push(event);
        despawnAllTrackedEvents(false);
        for (const event of desired) spawnEventFromSnapshot(event, false);
    }

