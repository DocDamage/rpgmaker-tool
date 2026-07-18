//=============================================================================
// HybridTileGraft.js
//=============================================================================
/*
 * Portions of the autotile-shape and tile-code logic are adapted from
 * Tyruswoo Tile Control for RPG Maker MZ under the following license:
 *
 * MIT License
 *
 * Copyright (c) 2023 Kathy Bunn and Scott Tyrus Washburn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/*:
 * @target MZ
 * @plugindesc v18.1.0 Worldsmith runtime with recoverable authoring, canonical recipe/quest/content formats, conflict-safe maps, honest release gates, grafting, transforms, and tile control.
 * @author DocDamage
 * @license MIT
 * @url
 *
 * @help HybridTileGraft.js
 * ============================================================================
 * OVERVIEW
 * ============================================================================
 * HybridTileGraft is an independent RPG Maker MZ implementation inspired by
 * the documented workflows of map-grafting, map-transform, and tile-control
 * plugins. It does not contain code from proprietary plugins and is not a
 * drop-in replacement for their command names.
 *
 * Main features:
 * - Graft exact tiles or reconnecting autotiles from another map.
 * - Select L1-L4 tile layers, L5 shadows, L6 regions, and L7 events.
 * - Save changes across transfers and save files, or make them temporary.
 * - Define prefabs in plugin parameters, map Notes, or at runtime.
 * - Visually edit current or unloaded remote maps without transferring maps.
 * - Set tiles by exact ID or tile code (A0,0 / B10 / C2,3 / etc.).
 * - Paint, flood, replace, outline, line, circle, and weighted-random brushes.
 * - Use absolute, player-relative, or event-relative target coordinates.
 * - Use transactional edit sessions, undo/redo, checkpoints, and recovery.
 * - Inspect/query tile IDs, codes, regions, terrain, and properties.
 * - Compact long patch histories and run map diagnostics.
 * - Author reusable embedded prefabs with metadata, variants, transforms, and thumbnails.
 * - Select, duplicate, move, update, or remove spawned events with visible labels.
 * - Export/import patch and prefab packs; inspect diffs; safely bake MapXXX.json.
 * - Refresh collision, pathfinding, minimap, and lighting plugins through adapters.
 * - Preserve stable spawned-event IDs, self switches, position, and direction.
 * - Resize, crop, expand, rotate, and mirror whole maps without losing metadata.
 * - Generate deterministic biomes, rooms, dungeons, roads, rivers, and rule tiles.
 * - Use versioned prefab parameters, anchors, dependencies, placement rules, and nesting.
 * - Build/search/bulk-edit events and reuse parameterized event templates.
 * - Browse every project map in Tile Studio with zoom, grids, overlays, layer controls,
 *   checkpoint/timeline panels, visual diffs, minimap navigation, and brush presets.
 * - Validate/repair project data, auto-checkpoint, preview imports, and roll back bakes.
 * - Exchange complete workspace bundles or synchronize them through an optional NW.js bridge.
 * - Organize changes with non-destructive authoring layers, masks, modifiers, and linked prefab instances.
 * - Generate climate biomes, terrain-aware roads, downhill rivers, validated dungeons, and WFC layouts.
 * - Create change sets, project snapshots, three-way merges, project-wide searches, audits, and health reports.
 * - Use the included Hybrid Tile Studio desktop companion for a prompt-free, multi-map workflow.
 *
 * ============================================================================
 * LAYERS
 * ============================================================================
 * L1-L4 = map tile layers 1-4
 * L5    = shadow bits
 * L6    = region ID
 * L7    = spawned events
 *
 * ============================================================================
 * PREFABS
 * ============================================================================
 * The easiest setup is the Prefab Catalog plugin parameter. You can also put
 * one or more tags in a storage map's Note field:
 *
 *   <Prefab: HouseSmall, 0, 0, 8, 6>
 *   <Prefab: HouseLarge, 10, 0, 14, 10>
 *
 * Format: <Prefab: name, sourceX, sourceY, width, height>
 *
 * ============================================================================
 * TILE CODES
 * ============================================================================
 * Exact IDs and the following codes are accepted by set/fill calls:
 *
 *   A0,0   A11   B2,1   B10   C0,0   D0,0   E0,0
 *
 * A codes use RPG Maker's 8-column tile selector layout. An A code points to
 * an autotile kind (shape 0 initially) or an A5 tile. Exact autotile IDs can
 * still be used with Exact mode to preserve a specific shift-click shape.
 *
 * ============================================================================
 * VISUAL RUNTIME EDITOR
 * ============================================================================
 * In playtest, press F7 by default or use Open Runtime Editor. The editor
 * freezes player movement and displays a map cursor, event labels, footprint
 * preview, command palette, graphical tileset palette, and prefab browser.
 *
 * Default controls:
 *   Arrows / Mouse  Move cursor
 *   OK / Click      Apply tool
 *   PageUp/Down     Change L1-L6 layer
 *   Tab             Command palette
 *   T / I / G       Enter tile code / eyedropper / graphical palette
 *   P               Prefab browser
 *   R / E           Rectangle / erase
 *   C / V           Copy area / paste clipboard
 *   B               Brush size
 *   F / H           Mirror / rotate clipboard or prefab stamp
 *   M / S           Exact-autotile mode / commit-discard on close
 *   U / Y           Undo / redo
 *   + / -           Zoom in / out
 *   Cancel / F7     Cancel selection or close editor
 *
 * Copy Area captures L1-L6 plus optional events. Pasted events receive fresh,
 * stable spawned-event IDs. Prefab footprints and rectangle selections are
 * previewed directly on the map before placement. Every visual editor session
 * is transactional: choose Commit Session to group it into one history item,
 * or Discard Session to restore the exact pre-session state.
 *
 * ============================================================================
 * EXTERNAL MAP LOADING
 * ============================================================================
 * Preload, graft, link, remote-edit, compact, and diagnostic commands wait for
 * asynchronous map loading before the event continues. A map can be addressed
 * by ID, or by exact display name when using Link Map.
 *
 * ============================================================================
 * SMART FILL
 * ============================================================================
 * Smart Fill has structured Filter and Creep fields in the plugin manager.
 * The legacy JSON fields remain accepted for old projects and script calls.
 *
 * Filter example:
 *   {"distance":4,"regions":[1,2],"hollow":false}
 *
 * Area example (relative to the resolved origin by default):
 *   {"area":{"x1":-3,"y1":-2,"x2":3,"y2":2},"hollow":true}
 *
 * Tile filter example:
 *   {"tileIds":["A0,0",2048],"tileLayers":["L1","L2"]}
 *
 * Creep example:
 *   {"distance":2,"tileId":"A1,0","layer":"L1","mode":"autotile",
 *    "regions":[3],"hollow":false}
 *
 * Empty Smart Fill filters affect only the origin tile as a safety measure.
 * Add "scope":"map" to intentionally target the whole map before filters.
 *
 * ============================================================================
 * SCRIPT CALLS
 * ============================================================================
 * HybridTileGraft.graftArea(options)
 * HybridTileGraft.graftAreaAsync(options)
 * HybridTileGraft.graftPrefab(options)
 * HybridTileGraft.graftPrefabAsync(options)
 * HybridTileGraft.graftAreaToMapAsync(options)
 * HybridTileGraft.graftPrefabToMapAsync(options)
 * HybridTileGraft.preloadMap(mapId, forceRefresh)
 * HybridTileGraft.preloadPrefabMaps(forceRefresh)
 * HybridTileGraft.registerPrefab(definition, save)
 * HybridTileGraft.removePrefab(name, mapId)
 * HybridTileGraft.listPrefabs()
 * HybridTileGraft.setTile(x, y, layer, tileId, save, options)
 * HybridTileGraft.setTileOnMapAsync(mapId, x, y, layer, tileId, options)
 * HybridTileGraft.fillTiles(x, y, w, h, layer, tileId, save, options)
 * HybridTileGraft.fillTilesOnMapAsync(mapId, x, y, w, h, layer, id, options)
 * HybridTileGraft.smartFill(options)
 * HybridTileGraft.clearArea(x, y, w, h, layers, save, includeEvents, mode)
 * HybridTileGraft.revertArea(x, y, w, h, layers, save, includeEvents)
 * HybridTileGraft.undoLast(mapId)
 * HybridTileGraft.redoLast(mapId)
 * HybridTileGraft.resetMap(mapId, save)
 * HybridTileGraft.compactMap(mapId)
 * HybridTileGraft.diagnoseMap(mapId)
 * HybridTileGraft.linkMap(mapIdOrName)
 * HybridTileGraft.unlinkMap()
 * HybridTileGraft.changeRegionId(x, y, regionId, save)
 * HybridTileGraft.getTileId(x, y, layer)
 * HybridTileGraft.tileCodeAt(x, y, layer)
 * HybridTileGraft.tileIdFromCode(code)
 * HybridTileGraft.tileCodeFromId(tileId)
 * HybridTileGraft.checkAreaEvents(x, y, w, h)
 * HybridTileGraft.copyArea(x, y, w, h, layers, includeEvents, options)
 * HybridTileGraft.pasteArea(x, y, options)
 * HybridTileGraft.clipboardContents()
 * HybridTileGraft.openRemoteMapEditor(mapIdOrName, options)
 * HybridTileGraft.floodFill(x, y, layer, tileId, save, options)
 * HybridTileGraft.replaceTiles(options)
 * HybridTileGraft.drawLine(x1, y1, x2, y2, layer, tileId, save, options)
 * HybridTileGraft.drawCircle(x, y, radius, layer, tileId, save, options)
 * HybridTileGraft.randomFill(x, y, w, h, layer, weightedTiles, save, options)
 * HybridTileGraft.capturePrefab(name, x, y, w, h, options)
 * HybridTileGraft.exportPrefabPack(names)
 * HybridTileGraft.importPrefabPack(pack, save)
 * HybridTileGraft.beginEditTransaction(label, mapId)
 * HybridTileGraft.commitEditTransaction(groupChanges)
 * HybridTileGraft.cancelEditTransaction()
 * HybridTileGraft.createCheckpoint(name, mapId)
 * HybridTileGraft.restoreCheckpoint(name, mapId)
 * HybridTileGraft.exportPatchPack(mapIds)
 * HybridTileGraft.importPatchPack(pack, options)
 * HybridTileGraft.diffMap(mapId)
 * HybridTileGraft.bakeMapToFile(mapId, options)
 * HybridTileGraft.registerCompatibilityAdapter(name, callback)
 * HybridTileGraft.openRuntimeEditor(options)
 * HybridTileGraft.closeRuntimeEditor()
 * HybridTileGraft.inspectTile(x, y, options)
 * HybridTileGraft.tileIdInList(values, x, y, layer)
 * HybridTileGraft.autotileInList(values, x, y, layer)
 * HybridTileGraft.tileAhead(values, distance, layer)
 * HybridTileGraft.autotileAhead(values, distance, layer)
 * HybridTileGraft.setAnimationFrames(frames)
 * HybridTileGraft.openTileStudio(options)
 * HybridTileGraft.transformMap(mapId, options)
 * HybridTileGraft.generateDungeon(options)
 * HybridTileGraft.generateBiome(options)
 * HybridTileGraft.generateRoad(options)
 * HybridTileGraft.registerEventTemplate(name, eventData, options)
 * HybridTileGraft.spawnEventTemplate(name, x, y, options)
 * HybridTileGraft.exportWorkspaceBundle(options)
 * HybridTileGraft.importWorkspaceBundle(bundle, options)
 * HybridTileGraft.validateStore({repair:false})
 * HybridTileGraft.rollbackBake(backupOrIndex, options)
 * HybridTileGraft.createAuthoringLayer(name, mapId, options)
 * HybridTileGraft.createMask(name, points, mapId, options)
 * HybridTileGraft.addModifier(type, options, mapId)
 * HybridTileGraft.placePrefabInstance(options)
 * HybridTileGraft.generateClimateBiome(options)
 * HybridTileGraft.generateTerrainRoad(options)
 * HybridTileGraft.generateDownhillRiver(options)
 * HybridTileGraft.generateWaveFunctionMap(options)
 * HybridTileGraft.createChangeSet(name, mapId, options)
 * HybridTileGraft.threeWayMergeSnapshots(base, ours, theirs, options)
 * HybridTileGraft.searchProject(options)
 * HybridTileGraft.validateProjectMaps(mapIds, options)
 * HybridTileGraft.systemHealthReport()
 * HybridTileGraft.beginProjectTransaction(label, options)
 * HybridTileGraft.commitProjectTransaction(options)
 * HybridTileGraft.rollbackProjectTransaction()
 * HybridTileGraft.createWorkspaceBranch(name, options)
 * HybridTileGraft.switchWorkspaceBranch(branchId)
 * HybridTileGraft.mergeWorkspaceBranch(branchId, options)
 * HybridTileGraft.addReviewComment(text, options)
 * HybridTileGraft.learnWfcRulesFromMap(options)
 * HybridTileGraft.generateWaveFunctionMapBacktracking(options)
 * HybridTileGraft.projectDependencyAudit(options)
 * HybridTileGraft.registerStudioExtension(manifest, activate)
 * HybridTileGraft.registerWorldRecipe(definition, save)
 * HybridTileGraft.removeWorldRecipe(id, options)
 * HybridTileGraft.listWorldRecipes()
 * HybridTileGraft.loadWorldRecipeCatalog(catalog)
 * HybridTileGraft.validateWorldRecipeCatalog(catalog)
 * HybridTileGraft.runWorldRecipe(id, context, options)
 * HybridTileGraft.triggerWorldRecipes(trigger, context, options)
 * HybridTileGraft.setWorldRecipeEnabled(id, enabled)
 * HybridTileGraft.resetWorldRecipeState(id)
 * HybridTileGraft.getWorldState(key, options)
 * HybridTileGraft.setWorldState(key, value, options)
 * HybridTileGraft.worldRecipeDiagnostics(options)
 * HybridTileGraft.registerWorldRecipeCondition(type, handler)
 * HybridTileGraft.registerWorldRecipeAction(type, handler)
 *
 * setTile/fillTiles options:
 *   { mode:"autotile", clearUpperLayers:true }
 *
 * Coordinate options accepted by graft/set/fill/smartFill:
 *   { coordinateMode:"player", forwardShift:1, rightShift:0 }
 *   { coordinateMode:"event", eventId:3, forwardShift:0, rightShift:1 }
 *
 * Compatibility aliases are also supplied on $gameMap with a "hybrid"
 * prefix. Common unprefixed query methods are only added when another plugin
 * has not already defined them.
 *
 * ============================================================================
 * NOTES
 * ============================================================================
 * - Source and target maps should normally use equivalent tileset layouts.
 *   Tile IDs refer to slots, so a different target tileset displays whatever
 *   graphic occupies the corresponding slot in that tileset.
 * - Normal target events are never removed. L7 operations only replace or
 *   remove events spawned by this plugin.
 * - Remote-map edits are persistent. Temporary edits only work on the active
 *   map because an unloaded map has no live runtime state to modify.
 * - Automatic compaction preserves the final result but intentionally folds
 *   older undo steps into one compact patch.
 * - Hold Control and press OK to log the player's current tile when Tile Info
 *   on Ctrl+OK is enabled. A configured common event runs instead if supplied.
 * - Tiled/alternate map-renderer plugins are not supported automatically.
 * - Pixel-movement collision meshes may need their own rebuild command after
 *   a tile change. Listen for the "HybridTileGraft:changed" window event or
 *   register HybridTileGraft.onChange(callback) for integration code.
 * - World Recipes are optional declarative WHEN/IF/THEN automation. Author
 *   data/HybridWorldRecipes.json in Hybrid Tile Studio or register recipes by
 *   script. Missing recipe files are ignored safely.
 *
 * @param warnMismatchedTileset
 * @text Warn on Tileset Mismatch
 * @type boolean
 * @default true
 *
 * @param tileAnimationFrames
 * @text Tile Animation Frames
 * @type number
 * @min 1
 * @default 30
 * @desc Lower is faster. This can be changed at runtime.
 *
 * @param maxSavedPatches
 * @text Auto-Compact After
 * @type number
 * @min 0
 * @default 250
 * @desc Maximum saved patches per map before they are folded into one. 0 disables automatic compaction.
 *
 * @param autoCheckpointEvery
 * @text Auto-Checkpoint Every
 * @type number
 * @min 0
 * @default 25
 * @desc Create a retained safety checkpoint after this many saved changes. 0 disables it.
 *
 * @param maxAutoCheckpoints
 * @text Retained Auto-Checkpoints
 * @type number
 * @min 1
 * @default 8
 *
 * @param performanceWarningMs
 * @text Performance Warning (ms)
 * @type number
 * @min 1
 * @default 16
 *
 * @param operationLogLimit
 * @text Timeline Entry Limit
 * @type number
 * @min 20
 * @default 250
 *
 * @param errorReportLimit
 * @text Retained Error Reports
 * @type number
 * @min 10
 * @default 100
 * @desc Maximum structured errors retained for the health report.
 *
 * @param commandResultVariableId
 * @text Command Result JSON Variable
 * @type variable
 * @default 0
 * @desc Optional variable that receives the latest structured plugin-command result as JSON. 0 disables it.
 *
 * @param commandSuccessSwitchId
 * @text Command Success Switch
 * @type switch
 * @default 0
 * @desc Optional switch set ON after success and OFF after failure. 0 disables it.
 *
 * @param commandFailureSwitchId
 * @text Command Failure Switch
 * @type switch
 * @default 0
 * @desc Optional switch set ON after failure and OFF after success. 0 disables it.
 *
 * @param commandFailureCommonEventId
 * @text Command Failure Common Event
 * @type common_event
 * @default 0
 * @desc Optional common event reserved after a plugin command fails. 0 disables it.
 *
 * @param maxImportBytes
 * @text Import Size Limit (Bytes)
 * @type number
 * @min 1048576
 * @default 20971520
 * @desc Reject patch/workspace/prefab/event imports above this approximate size.
 *
 * @param strictTileValidation
 * @text Validate Tile IDs
 * @type boolean
 * @default true
 * @desc Reject tile IDs that do not exist in the active tileset sheet layout.
 *
 * @param prefabCatalog
 * @text Prefab Catalog
 * @type struct<HTGPrefab>[]
 * @default []
 * @desc Named source rectangles available to Graft Prefab and preload commands.
 *
 * @param worldRecipeFile
 * @text World Recipe Data File
 * @type string
 * @default HybridWorldRecipes.json
 * @desc Optional JSON catalog in the project's data folder. Missing files are ignored safely.
 *
 * @param autoWorldRecipes
 * @text Enable Automatic World Recipes
 * @type boolean
 * @default true
 * @desc Evaluate map-enter, player-step, interval, switch, variable, tile, and state triggers.
 *
 * @param worldRecipeLogLimit
 * @text World Recipe Log Limit
 * @type number
 * @min 10
 * @max 1000
 * @default 100
 * @desc Maximum retained recipe execution and failure records.
 *
 * @param autoPreloadPrefabs
 * @text Auto-Preload Prefabs
 * @type boolean
 * @default false
 * @desc Preload catalog and child-map sources once after entering a map.
 *
 * @param childMapTag
 * @text Child Map Note Tag
 * @type string
 * @default ChildMap
 * @desc Map Note tag used by Preload Prefab Maps, for example <ChildMap: 12>.
 *
 * @param tileInfoOnOk
 * @text Tile Info on Ctrl+OK
 * @type boolean
 * @default true
 * @desc In playtest/development, hold Control and press OK to inspect the player's tile.
 *
 * @param commonEventOnOk
 * @text Ctrl+OK Common Event
 * @type common_event
 * @default 0
 * @desc If set, Ctrl+OK reserves this common event instead of only logging tile information.
 *
 * @param enableRuntimeEditor
 * @text Enable Runtime Editor
 * @type boolean
 * @default true
 * @desc Enable the visual on-map brush, tool palette, clipboard, and prefab browser.
 *
 * @param editorPlaytestOnly
 * @text Editor: Playtest Only
 * @type boolean
 * @default true
 * @desc Recommended. Turn OFF only if players should be allowed to edit maps in deployed builds.
 *
 * @param editorToggleKeyCode
 * @text Editor: Toggle Key Code
 * @type number
 * @min 1
 * @default 118
 * @desc JavaScript key code. 118 is F7.
 *
 * @param editorDefaultPersist
 * @text Editor: Persist by Default
 * @type boolean
 * @default true
 * @desc Whether editor brush actions are saved by default. Press S to toggle at runtime.
 *
 * @param editorCursorColor
 * @text Editor: Cursor Color
 * @type string
 * @default #66e0ff
 * @desc CSS color used for the brush and prefab footprint.
 *
 * @param editorSelectionColor
 * @text Editor: Selection Color
 * @type string
 * @default #ffd166
 * @desc CSS color used while selecting rectangle and copy areas.
 *
 * @command graftArea
 * @text Graft: Area
 * @desc Copy a rectangular region from a source map to the current map. Uncached source maps auto-load.
 *
 * @arg sourceMapId
 * @text Source Map ID
 * @type text
 * @default 0
 * @desc 0 = current map. JavaScript expressions allowed.
 *
 * @arg sourceX
 * @type text
 * @default 0
 * @arg sourceY
 * @type text
 * @default 0
 * @arg width
 * @type text
 * @default 1
 * @arg height
 * @type text
 * @default 1
 * @arg targetX
 * @type text
 * @default 0
 * @arg targetY
 * @type text
 * @default 0
 *
 * @arg coordinateMode
 * @text Target Coordinate Mode
 * @type select
 * @option Absolute
 * @value absolute
 * @option Relative to Player
 * @value player
 * @option Relative to Event
 * @value event
 * @default absolute
 *
 * @arg eventId
 * @text Relative Event ID
 * @type text
 * @default 0
 * @desc 0 = the event running this command.
 *
 * @arg forwardShift
 * @type text
 * @default 0
 * @arg rightShift
 * @type text
 * @default 0
 *
 * @arg layers
 * @type text
 * @default L1,L2,L3,L4,L5,L6
 * @desc Comma-separated L1-L7. L7 enables event grafting.
 *
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default exact
 *
 * @arg includeEvents
 * @type boolean
 * @default false
 * @desc Also enables L7 even when L7 is omitted from Layers.
 *
 * @arg save
 * @text Persist
 * @type boolean
 * @default true
 *
 * @command graftPrefab
 * @text Graft: Prefab
 *
 * @arg name
 * @type text
 * @arg storageMapId
 * @type text
 * @default 0
 * @arg targetX
 * @type text
 * @default 0
 * @arg targetY
 * @type text
 * @default 0
 * @arg coordinateMode
 * @type select
 * @option Absolute
 * @value absolute
 * @option Relative to Player
 * @value player
 * @option Relative to Event
 * @value event
 * @default absolute
 * @arg eventId
 * @type text
 * @default 0
 * @arg forwardShift
 * @type text
 * @default 0
 * @arg rightShift
 * @type text
 * @default 0
 * @arg layers
 * @type text
 * @default L1,L2,L3,L4,L5,L6
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default exact
 * @arg includeEvents
 * @type boolean
 * @default false
 * @arg save
 * @type boolean
 * @default true
 *
 * @command setTile
 * @text Tile: Set Single
 *
 * @arg x
 * @type text
 * @default 0
 * @arg y
 * @type text
 * @default 0
 * @arg layer
 * @type select
 * @option L1
 * @option L2
 * @option L3
 * @option L4
 * @option L5
 * @option L6
 * @default L1
 * @arg tileId
 * @text Tile ID or Code
 * @type text
 * @default 0
 * @arg coordinateMode
 * @type select
 * @option Absolute
 * @value absolute
 * @option Relative to Player
 * @value player
 * @option Relative to Event
 * @value event
 * @default absolute
 * @arg eventId
 * @type text
 * @default 0
 * @arg forwardShift
 * @type text
 * @default 0
 * @arg rightShift
 * @type text
 * @default 0
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 * @arg clearUpperLayers
 * @type boolean
 * @default false
 * @arg save
 * @type boolean
 * @default true
 *
 * @command fillTiles
 * @text Tile: Fill Rectangle
 *
 * @arg x
 * @type text
 * @default 0
 * @arg y
 * @type text
 * @default 0
 * @arg width
 * @type text
 * @default 1
 * @arg height
 * @type text
 * @default 1
 * @arg layer
 * @type select
 * @option L1
 * @option L2
 * @option L3
 * @option L4
 * @option L5
 * @option L6
 * @default L1
 * @arg tileId
 * @text Tile ID or Code
 * @type text
 * @default 0
 * @arg coordinateMode
 * @type select
 * @option Absolute
 * @value absolute
 * @option Relative to Player
 * @value player
 * @option Relative to Event
 * @value event
 * @default absolute
 * @arg eventId
 * @type text
 * @default 0
 * @arg forwardShift
 * @type text
 * @default 0
 * @arg rightShift
 * @type text
 * @default 0
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 * @arg clearUpperLayers
 * @type boolean
 * @default false
 * @arg save
 * @type boolean
 * @default true
 *
 * @command smartFill
 * @text Tile: Smart Fill
 * @desc Filtered fill with optional hollow and creep/spread behavior. See Help for JSON examples.
 *
 * @arg x
 * @type text
 * @default 0
 * @arg y
 * @type text
 * @default 0
 * @arg layer
 * @type select
 * @option L1
 * @option L2
 * @option L3
 * @option L4
 * @default L1
 * @arg tileId
 * @text Tile ID or Code
 * @type text
 * @default 0
 * @arg coordinateMode
 * @type select
 * @option Absolute
 * @value absolute
 * @option Relative to Player
 * @value player
 * @option Relative to Event
 * @value event
 * @default absolute
 * @arg eventId
 * @type text
 * @default 0
 * @arg forwardShift
 * @type text
 * @default 0
 * @arg rightShift
 * @type text
 * @default 0
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 * @arg clearUpperLayers
 * @type boolean
 * @default false
 * @arg filters
 * @text Filters
 * @type struct<HTGFillFilters>
 * @default {"scope":"origin","distance":"0","regions":"[]","tileIds":"[]","tileLayers":"[\"L1\",\"L2\",\"L3\",\"L4\"]","area":"","hollow":"false"}
 * @desc Empty filters safely affect only the origin. Choose Map scope for a whole-map filter.
 * @arg creep
 * @text Creep / Spread
 * @type struct<HTGCreep>
 * @default {"distance":"0","tileId":"","layer":"L1","mode":"autotile","regions":"[]","tileIds":"[]","tileLayers":"[\"L1\",\"L2\",\"L3\",\"L4\"]","area":"","hollow":"false","clearUpperLayers":"false"}
 * @arg filtersJson
 * @text Legacy Filters JSON
 * @type multiline_string
 * @default
 * @desc Optional compatibility field. The structured Filters field takes priority.
 * @arg creepJson
 * @text Legacy Creep JSON
 * @type multiline_string
 * @default
 * @desc Optional compatibility field. The structured Creep field takes priority.
 * @arg save
 * @type boolean
 * @default true
 *
 * @command clearArea
 * @text Restore: Clear Area
 *
 * @arg x
 * @type text
 * @default 0
 * @arg y
 * @type text
 * @default 0
 * @arg width
 * @type text
 * @default 1
 * @arg height
 * @type text
 * @default 1
 * @arg layers
 * @type text
 * @default L1,L2,L3,L4,L5,L6
 * @arg includeEvents
 * @type boolean
 * @default false
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 * @arg save
 * @type boolean
 * @default true
 *
 * @command revertArea
 * @text Restore: Revert Area
 *
 * @arg x
 * @type text
 * @default 0
 * @arg y
 * @type text
 * @default 0
 * @arg width
 * @type text
 * @default 1
 * @arg height
 * @type text
 * @default 1
 * @arg layers
 * @type text
 * @default L1,L2,L3,L4,L5,L6
 * @arg includeEvents
 * @type boolean
 * @default false
 * @arg save
 * @type boolean
 * @default true
 *
 * @command undoLast
 * @text Restore: Undo Last Change
 *
 * @command redoLast
 * @text Restore: Redo Last Change
 * @desc Reapply the last undone saved patch on the current or linked map.
 *
 * @command diagnoseMap
 * @text Maintenance: Diagnose Map
 * @desc Log patch/cache/event statistics and optionally store key results.
 *
 * @arg mapId
 * @text Map ID
 * @type text
 * @default 0
 * @arg patchCountVariable
 * @text Patch Count Variable
 * @type variable
 * @default 0
 * @arg tileWriteVariable
 * @text Tile Write Variable
 * @type variable
 * @default 0
 * @arg redoCountVariable
 * @text Redo Count Variable
 * @type variable
 * @default 0
 * @arg warningSwitch
 * @text Warning Switch
 * @type switch
 * @default 0
 * @desc Turned ON when diagnostics find a warning.
 *
 * @command openEditor
 * @text Editor: Open Runtime Editor
 * @desc Open the visual map brush and optionally jump straight to the prefab browser.
 *
 * @arg x
 * @text Start X
 * @type text
 * @default -1
 * @desc -1 = player X.
 * @arg y
 * @text Start Y
 * @type text
 * @default -1
 * @desc -1 = player Y.
 * @arg layer
 * @type select
 * @option L1
 * @option L2
 * @option L3
 * @option L4
 * @option L5
 * @option L6
 * @default L1
 * @arg tileId
 * @text Initial Tile ID/Code
 * @type text
 * @default 0
 * @arg mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 * @arg tool
 * @text Initial Tool
 * @type select
 * @option Paint
 * @value paint
 * @option Rectangle
 * @value rectangle
 * @option Erase
 * @value erase
 * @option Eyedropper
 * @value eyedropper
 * @option Copy Area
 * @value copy
 * @option Paste
 * @value paste
 * @option Prefab
 * @value prefab
 * @default paint
 * @arg brushSize
 * @type number
 * @min 1
 * @max 16
 * @default 1
 * @arg persist
 * @text Persistent Changes
 * @type boolean
 * @default true
 * @arg openPrefabBrowser
 * @text Open Prefab Browser
 * @type boolean
 * @default false
 *
 * @command createCheckpoint
 * @text History: Create Checkpoint
 * @arg name
 * @type string
 * @default Checkpoint
 * @arg mapId
 * @type number
 * @min 0
 * @default 0
 *
 * @command restoreCheckpoint
 * @text History: Restore Checkpoint
 * @arg name
 * @type string
 * @default Checkpoint
 * @arg mapId
 * @type number
 * @min 0
 * @default 0
 *
 * @command openStudio
 * @text Studio: Open Full Tile Studio
 * @desc Open the standalone project-map browser and visual editor scene.
 *
 * @command systemHealth
 * @text Maintenance: System Health Report
 *
 * @command runWorldRecipe
 * @text Run World Recipe
 * @desc Run one recipe by ID. This bypasses its trigger but still checks conditions and limits.
 * @arg recipeId
 * @text Recipe ID
 * @type string
 * @arg contextJson
 * @text Context JSON
 * @type multiline_string
 * @default {}
 * @arg dryRun
 * @text Dry Run
 * @type boolean
 * @default false
 *
 * @command setWorldState
 * @text Set World State
 * @arg key
 * @type string
 * @arg valueJson
 * @text Value (JSON)
 * @type multiline_string
 * @default true
 * @arg scope
 * @type select
 * @option Global
 * @value global
 * @option Current Map
 * @value map
 * @default global
 *
 * @command advanceWorldClock
 * @text World: Advance Clock
 * @arg minutes
 * @type number
 * @default 60
 *
 * @command applyWorldMapVariant
 * @text World: Apply Map Variant
 * @arg variantId
 * @type string
 * @arg contextJson
 * @type multiline_string
 * @default {}
 *
 * @command createRecoverySnapshot
 * @text Recovery: Create Snapshot
 * @arg name
 * @type string
 * @default Manual recovery snapshot
 *
 * @command restoreRecoverySnapshot
 * @text Recovery: Restore Snapshot
 * @arg snapshotId
 * @type string
 *
 * @command reloadWorldRecipes
 * @text Reload World Recipe File
 * @desc Reload the optional data/HybridWorldRecipes.json catalog.
 *
 * @command startLiveProductionSession
 * @text Live Production: Start Session
 * @arg optionsJson
 * @type multiline_string
 * @default {"label":"Live Production","bridge":true,"watchedSwitches":[],"watchedVariables":[]}
 *
 * @command stopLiveProductionSession
 * @text Live Production: Stop Session
 *
 * @command safeModeV16
 * @text Worldsmith: Configure Safe Mode
 * @arg optionsJson
 * @type multiline_string
 * @default {"enabled":true,"requireRecoveryPoint":true}
 *
 * @command productionDashboardV16
 * @text Worldsmith: Build Production Dashboard
 * @arg optionsJson
 * @type multiline_string
 * @default {}
 */

/*~struct~HTGPrefab:
 * @param name
 * @text Name
 * @type string
 * @default NewPrefab
 *
 * @param mapId
 * @text Storage Map ID
 * @type number
 * @min 1
 * @default 1
 *
 * @param sourceX
 * @type number
 * @min 0
 * @default 0
 *
 * @param sourceY
 * @type number
 * @min 0
 * @default 0
 *
 * @param width
 * @type number
 * @min 1
 * @default 1
 *
 * @param height
 * @type number
 * @min 1
 * @default 1
 *
 * @param layers
 * @type string
 * @default L1,L2,L3,L4,L5,L6
 *
 * @param mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default exact
 *
 * @param includeEvents
 * @type boolean
 * @default false
 *
 * @param category
 * @type string
 * @default General
 *
 * @param tags
 * @text Tags (comma-separated)
 * @type string
 * @default
 *
 * @param description
 * @type multiline_string
 * @default
 *
 * @param variantGroup
 * @text Variant Group
 * @type string
 * @default
 *
 * @param weight
 * @text Variant Weight
 * @type number
 * @decimals 2
 * @min 0.01
 * @default 1
 *
 * @param thumbnail
 * @text Custom Thumbnail Name
 * @type file
 * @dir img/pictures
 * @default
 *
 * @param version
 * @text Prefab Version
 * @type number
 * @min 1
 * @default 1
 *
 * @param dependencies
 * @text Dependencies (Name or Name@Version)
 * @type string[]
 * @default []
 *
 * @param anchorX
 * @text Anchor X
 * @type number
 * @min 0
 * @default 0
 *
 * @param anchorY
 * @text Anchor Y
 * @type number
 * @min 0
 * @default 0
 *
 * @param parameters
 * @text Parameters JSON
 * @type multiline_string
 * @default []
 * @desc [{"name":"roof","default":"A1,0","sourceTileId":"A0,0","layer":"L1"}]
 *
 * @param nestedPrefabs
 * @text Nested Prefabs JSON
 * @type multiline_string
 * @default []
 * @desc [{"name":"Door","x":2,"y":4}]
 *
 * @param placementRules
 * @text Placement Rules JSON
 * @type multiline_string
 * @default {}
 * @desc allowedRegions, forbiddenRegions, requireEmptyEvents, edgeDistance, withinBounds.
 */

/*~struct~HTGFillFilters:
 * @param scope
 * @text Search Scope
 * @type select
 * @option Origin Only
 * @value origin
 * @option Entire Map
 * @value map
 * @default origin
 *
 * @param distance
 * @text Distance from Origin
 * @type number
 * @min 0
 * @default 0
 * @desc 0 disables distance limiting unless other filters broaden the scope.
 *
 * @param regions
 * @text Allowed Regions
 * @type number[]
 * @default []
 *
 * @param tileIds
 * @text Matching Tile IDs/Codes
 * @type string[]
 * @default []
 *
 * @param tileLayers
 * @text Layers to Match
 * @type string[]
 * @default ["L1","L2","L3","L4"]
 *
 * @param area
 * @text Limit Area
 * @type struct<HTGArea>
 * @default
 *
 * @param hollow
 * @text Outline Only
 * @type boolean
 * @default false
 *
 * @param origin
 * @text Origin Rule
 * @type select
 * @option Normal
 * @value normal
 * @option Always Fill
 * @value always
 * @option Never Fill
 * @value never
 * @default normal
 */

/*~struct~HTGCreep:
 * @param distance
 * @text Spread Distance
 * @type number
 * @min 0
 * @default 0
 * @desc 0 disables creep/spread.
 *
 * @param tileId
 * @text Creep Tile ID/Code
 * @type string
 * @default 0
 * @desc Blank uses the primary fill tile.
 *
 * @param layer
 * @type select
 * @option L1
 * @option L2
 * @option L3
 * @option L4
 * @default L1
 *
 * @param mode
 * @type select
 * @option Exact
 * @value exact
 * @option Autotile
 * @value autotile
 * @default autotile
 *
 * @param regions
 * @text Allowed Regions
 * @type number[]
 * @default []
 *
 * @param tileIds
 * @text Matching Tile IDs/Codes
 * @type string[]
 * @default []
 *
 * @param tileLayers
 * @text Layers to Match
 * @type string[]
 * @default ["L1","L2","L3","L4"]
 *
 * @param area
 * @text Limit Area
 * @type struct<HTGArea>
 * @default
 *
 * @param hollow
 * @text Outline Only
 * @type boolean
 * @default false
 *
 * @param clearUpperLayers
 * @type boolean
 * @default false
 */

/*~struct~HTGArea:
 * @param x1
 * @type number
 * @default -1
 * @param y1
 * @type number
 * @default -1
 * @param x2
 * @type number
 * @default 1
 * @param y2
 * @type number
 * @default 1
 * @param absolute
 * @text Absolute Coordinates
 * @type boolean
 * @default false
 * @desc False makes the area relative to the resolved fill origin.
 */

(() => {
    "use strict";

    const FALLBACK_PLUGIN_NAME = "HybridTileGraft";
    const PLUGIN_NAME = (() => {
        if (typeof document === "undefined" || !document.currentScript) return FALLBACK_PLUGIN_NAME;
        const source = decodeURIComponent(document.currentScript.src || "");
        const match = source.match(/([^/\\]+)\.js(?:\?.*)?$/i);
        return match ? match[1] : FALLBACK_PLUGIN_NAME;
    })();
    const VERSION = "18.1.0";
    const params = PluginManager.parameters(PLUGIN_NAME);
    const WARN_MISMATCHED_TILESET = String(params.warnMismatchedTileset ?? "true") === "true";
    const DEFAULT_ANIMATION_FRAMES = Math.max(1, Number(params.tileAnimationFrames) || 30);
    const MAX_SAVED_PATCHES = params.maxSavedPatches === undefined
        ? 250
        : Math.max(0, integer(params.maxSavedPatches, 250));
    const TILE_INFO_ON_OK = String(params.tileInfoOnOk ?? "true") === "true";
    const COMMON_EVENT_ON_OK = Math.max(0, Number(params.commonEventOnOk) || 0);
    const AUTO_PRELOAD_PREFABS = String(params.autoPreloadPrefabs ?? "false") === "true";
    const CHILD_MAP_TAG = String(params.childMapTag || "ChildMap");
    const STRICT_TILE_VALIDATION = String(params.strictTileValidation ?? "true") === "true";
    const ENABLE_RUNTIME_EDITOR = String(params.enableRuntimeEditor ?? "true") === "true";
    const EDITOR_PLAYTEST_ONLY = String(params.editorPlaytestOnly ?? "true") === "true";
    const EDITOR_TOGGLE_KEY_CODE = Math.max(1, integer(params.editorToggleKeyCode, 118));
    const EDITOR_DEFAULT_PERSIST = String(params.editorDefaultPersist ?? "true") === "true";
    const EDITOR_CURSOR_COLOR = String(params.editorCursorColor || "#66e0ff");
    const EDITOR_SELECTION_COLOR = String(params.editorSelectionColor || "#ffd166");
    const AUTO_CHECKPOINT_EVERY = Math.max(0, integer(params.autoCheckpointEvery, 25));
    const MAX_AUTO_CHECKPOINTS = Math.max(1, integer(params.maxAutoCheckpoints, 8));
    const PERFORMANCE_WARNING_MS = Math.max(1, finiteNumber(params.performanceWarningMs, 16));
    const OPERATION_LOG_LIMIT = Math.max(20, integer(params.operationLogLimit, 250));
    const ERROR_REPORT_LIMIT = Math.max(10, integer(params.errorReportLimit, 100));
    const COMMAND_RESULT_VARIABLE_ID = Math.max(0, integer(params.commandResultVariableId, 0));
    const COMMAND_SUCCESS_SWITCH_ID = Math.max(0, integer(params.commandSuccessSwitchId, 0));
    const COMMAND_FAILURE_SWITCH_ID = Math.max(0, integer(params.commandFailureSwitchId, 0));
    const COMMAND_FAILURE_COMMON_EVENT_ID = Math.max(0, integer(params.commandFailureCommonEventId, 0));
    const MAX_IMPORT_BYTES = Math.max(1024 * 1024, integer(params.maxImportBytes, 20 * 1024 * 1024));
    const WORLD_RECIPE_FILE = String(params.worldRecipeFile ?? "HybridWorldRecipes.json").trim();
    const AUTO_WORLD_RECIPES = String(params.autoWorldRecipes ?? "true") === "true";
    const WORLD_RECIPE_LOG_LIMIT = Math.max(10, integer(params.worldRecipeLogLimit, 100));
    const LAYER_INDEX = Object.freeze({ L1: 0, L2: 1, L3: 2, L4: 3, L5: 4, L6: 5 });
    const SPAWN_ID_OFFSET = 10000;
    const PREFAB_REGEX = /<Prefab:\s*([^,>]+),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)>/gi;
    const PARAMETER_PREFABS = parseStructArray(params.prefabCatalog).map(normalizePrefabDefinition).filter(Boolean);
    const changeListeners = new Set();
    const commandResultListeners = new Set();
    const compatibilityAdapters = new Map();
    const adapterProfiles = new Map();
    const performanceSamples = new Map();
    const operationJobs = new Map();
    const jobListeners = new Set();
    const extensionRegistry = new Map();
    const extensionBrushes = new Map();
    const extensionGenerators = new Map();
    const extensionValidators = new Map();
    const worldRecipeConditionHandlers = new Map();
    const worldRecipeActionHandlers = new Map();

    let fallbackStore = null;
    let currentPristine = null;
    let spawnedMapId = 0;
    const spawnedIds = new Set();
    const pristineCache = new Map();
    const composedCache = new Map();
    const pendingLoads = new Map();
    const sessionPrefabs = new Map();
    const sessionPrefabPayloads = new Map();
    let runtimeClipboard = null;
    let activeEditTransaction = null;
    let workspaceBridge = null;
    let suppressAutomaticCheckpoint = false;
    let projectWorldRecipeCatalog = { format: "HybridWorldRecipes", version: 1, recipes: [] };
    let worldRecipeFrame = 0;
    let worldRecipeLastPlayerTile = "";
    let worldRecipePumping = false;
    const worldRecipeQueue = [];
    /* Generated by scripts/build-release.js from src/contracts/extension-capabilities.json */
    const EXTENSION_CAPABILITY_DEFINITIONS = Object.freeze([{"id":"map:read","description":"Read composed map snapshots.","risk":"read"},{"id":"map:write","description":"Create reversible map changes.","risk":"write"},{"id":"world:read","description":"Read World Recipe state and catalogs.","risk":"read"},{"id":"world:write","description":"Change explicit world state.","risk":"write"},{"id":"project:read","description":"Read project-scoped files through an approved boundary.","risk":"read"},{"id":"project:write","description":"Write project-scoped files through an approved boundary.","risk":"write"},{"id":"project:validate","description":"Contribute to project validation.","risk":"read"},{"id":"recipes:read","description":"Read World Recipe definitions.","risk":"read"},{"id":"recipes:write","description":"Create or update World Recipe definitions.","risk":"write"},{"id":"pack:manage","description":"Resolve or install content packs.","risk":"write"},{"id":"ui:contribute","description":"Add declared Studio tools or panels.","risk":"write"},{"id":"network","description":"Access explicitly approved network endpoints.","risk":"privileged"},{"id":"process","description":"Launch an explicitly approved child process.","risk":"privileged"},{"id":"clipboard","description":"Read or write the system clipboard.","risk":"privileged"}].map(Object.freeze));
    const EXTENSION_CAPABILITIES = Object.freeze(EXTENSION_CAPABILITY_DEFINITIONS.map(item => item.id));
    const EXTENSION_PERMISSIONS = new Set(EXTENSION_CAPABILITIES);

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

    let latestPluginCommandResult = null;
    let pluginCommandSequence = 0;

    function serializableCommandValue(value) {
        if (value === undefined) return null;
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_error) { return String(value); }
    }

    function commandOutputId(args, key, fallback) {
        return Math.max(0, integer(args && args[key], fallback));
    }

    function applyPluginCommandOutputs(result, args = {}) {
        const resultVariableId = commandOutputId(args, "resultVariableId", COMMAND_RESULT_VARIABLE_ID);
        const successSwitchId = commandOutputId(args, "successSwitchId", COMMAND_SUCCESS_SWITCH_ID);
        const failureSwitchId = commandOutputId(args, "failureSwitchId", COMMAND_FAILURE_SWITCH_ID);
        const failureCommonEventId = commandOutputId(args, "failureCommonEventId", COMMAND_FAILURE_COMMON_EVENT_ID);
        if (resultVariableId > 0 && typeof $gameVariables !== "undefined" && $gameVariables?.setValue) {
            $gameVariables.setValue(resultVariableId, JSON.stringify(result));
        }
        if (successSwitchId > 0 && typeof $gameSwitches !== "undefined" && $gameSwitches?.setValue) {
            $gameSwitches.setValue(successSwitchId, result.ok);
        }
        if (failureSwitchId > 0 && typeof $gameSwitches !== "undefined" && $gameSwitches?.setValue) {
            $gameSwitches.setValue(failureSwitchId, !result.ok);
        }
        if (!result.ok && failureCommonEventId > 0 && typeof $gameTemp !== "undefined" && $gameTemp?.reserveCommonEvent) {
            if (!$gameTemp.isCommonEventReserved || !$gameTemp.isCommonEventReserved()) {
                $gameTemp.reserveCommonEvent(failureCommonEventId);
            }
        }
    }

    function publishPluginCommandResult(context, status, value = null, error = null) {
        if (!context || context.completed) return latestPluginCommandResult ? deepClone(latestPluginCommandResult) : null;
        context.completed = true;
        const completedAt = Date.now();
        const result = {
            format: "HybridTileGraftCommandResult",
            version: 1,
            pluginVersion: VERSION,
            sequence: ++pluginCommandSequence,
            command: String(context.command || "unknown"),
            status: String(status),
            ok: status === "succeeded",
            startedAt: context.startedAt,
            completedAt,
            durationMs: Math.max(0, clockNow() - context.startedClock),
            value: status === "succeeded" ? serializableCommandValue(value) : null,
            error: error ? {
                name: String(error.name || "Error"),
                message: String(error.message || error),
                reportId: context.errorReportId || null
            } : null
        };
        latestPluginCommandResult = result;
        applyPluginCommandOutputs(result, context.args || {});
        for (const listener of commandResultListeners) {
            try { listener(deepClone(result)); }
            catch (listenerError) { console.error(`${PLUGIN_NAME}: command-result listener failed.`, listenerError); }
        }
        return deepClone(result);
    }

    function lastCommandResult() {
        return latestPluginCommandResult ? deepClone(latestPluginCommandResult) : null;
    }

    function clearCommandResult() {
        const previous = lastCommandResult();
        latestPluginCommandResult = null;
        return previous;
    }

    function onCommandResult(callback) {
        if (typeof callback !== "function") return () => false;
        commandResultListeners.add(callback);
        return () => commandResultListeners.delete(callback);
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

    // -------------------------------------------------------------------------
    // Tile codes and queries
    // -------------------------------------------------------------------------

    function tileIdFromCode(value) {
        if (typeof value === "number") return integer(value);
        const text = String(value ?? "").trim();
        if (/^-?\d+$/.test(text)) return integer(text);
        const match = text.match(/^([A-E])\s*(\d+)(?:\s*,\s*(\d+))?$/i);
        if (!match) return NaN;
        const sheet = match[1].toUpperCase();
        const number = match[3] === undefined ? Number(match[2]) : Number(match[3]) * 8 + Number(match[2]);
        if (number < 0 || number > 255) return NaN;
        if (sheet === "A") {
            return number < 128 ? Tilemap.TILE_ID_A1 + number * 48 : Tilemap.TILE_ID_A5 + number - 128;
        }
        const bases = {
            B: Tilemap.TILE_ID_B,
            C: Tilemap.TILE_ID_C,
            D: Tilemap.TILE_ID_D,
            E: Tilemap.TILE_ID_E
        };
        return bases[sheet] + number;
    }

    function tileCodeFromId(value) {
        const tileId = integer(value);
        const maxTileId = Tilemap.TILE_ID_MAX || 8192;
        if (tileId >= Tilemap.TILE_ID_A1 && tileId < maxTileId) {
            const kind = Math.floor((tileId - Tilemap.TILE_ID_A1) / 48);
            return `A${kind % 8},${Math.floor(kind / 8)}`;
        }
        if (tileId >= Tilemap.TILE_ID_A5 && tileId < Tilemap.TILE_ID_A5 + 128) {
            const number = tileId - Tilemap.TILE_ID_A5 + 128;
            return `A${number % 8},${Math.floor(number / 8)}`;
        }
        const ranges = [
            ["E", Tilemap.TILE_ID_E],
            ["D", Tilemap.TILE_ID_D],
            ["C", Tilemap.TILE_ID_C],
            ["B", Tilemap.TILE_ID_B]
        ];
        for (const [sheet, base] of ranges) {
            if (tileId >= base && tileId < base + 256) {
                const number = tileId - base;
                return `${sheet}${number % 8},${Math.floor(number / 8)}`;
            }
        }
        return "";
    }

    function parseTileId(value) {
        const tileId = tileIdFromCode(value);
        if (!Number.isFinite(tileId) || tileId < 0) {
            console.warn(`${PLUGIN_NAME}: invalid tile ID or code:`, value);
            return null;
        }
        return integer(tileId);
    }

    function tileSheetIndexForId(tileId) {
        if (tileId === 0) return -1;
        if (tileId >= Tilemap.TILE_ID_B && tileId < Tilemap.TILE_ID_C) return 5;
        if (tileId >= Tilemap.TILE_ID_C && tileId < Tilemap.TILE_ID_D) return 6;
        if (tileId >= Tilemap.TILE_ID_D && tileId < Tilemap.TILE_ID_E) return 7;
        if (tileId >= Tilemap.TILE_ID_E && tileId < Tilemap.TILE_ID_E + 256) return 8;
        if (tileId >= Tilemap.TILE_ID_A5 && tileId < Tilemap.TILE_ID_A5 + 128) return 4;
        const a2 = Tilemap.TILE_ID_A2 || 2816;
        const a3 = Tilemap.TILE_ID_A3 || 4352;
        const a4 = Tilemap.TILE_ID_A4 || 5888;
        const maxTileId = Tilemap.TILE_ID_MAX || 8192;
        if (tileId >= Tilemap.TILE_ID_A1 && tileId < a2) return 0;
        if (tileId >= a2 && tileId < a3) return 1;
        if (tileId >= a3 && tileId < a4) return 2;
        if (tileId >= a4 && tileId < maxTileId) return 3;
        return null;
    }

    function tileIdExists(tileId, tilesetId = $dataMap.tilesetId) {
        if (!STRICT_TILE_VALIDATION || tileId === 0) return true;
        const index = tileSheetIndexForId(tileId);
        if (index === null) return false;
        if (typeof $dataTilesets === "undefined" || !$dataTilesets || !$dataTilesets[tilesetId]) return true;
        if (index < 0) return true;
        const name = $dataTilesets[tilesetId].tilesetNames[index];
        return !!String(name || "").trim();
    }

    function validateTileId(tileId, tilesetId = $dataMap.tilesetId) {
        if (tileIdExists(tileId, tilesetId)) return true;
        console.warn(`${PLUGIN_NAME}: tile ${tileId} (${tileCodeFromId(tileId)}) belongs to a sheet missing from tileset ${tilesetId}.`);
        return false;
    }

    function validateLayerValue(value, layer, tilesetId = $dataMap.tilesetId) {
        const key = normalizeLayer(layer);
        if (key === "L5") {
            const valid = value >= 0 && value <= 15;
            if (!valid) console.warn(`${PLUGIN_NAME}: shadow bits must be between 0 and 15.`);
            return valid;
        }
        if (key === "L6") {
            const valid = value >= 0 && value <= 255;
            if (!valid) console.warn(`${PLUGIN_NAME}: region IDs must be between 0 and 255.`);
            return valid;
        }
        return validateTileId(value, tilesetId);
    }

    function getTileId(x, y, layer = "L1") {
        const key = normalizeLayer(layer);
        return readTile($dataMap.data, $dataMap.width, $dataMap.height, integer(x), integer(y), LAYER_INDEX[key]);
    }

    function tileCodeAt(x, y, layer = "L1") {
        return tileCodeFromId(getTileId(x, y, layer));
    }

    function inspectTile(x, y, options = {}) {
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const info = {
            mapId: $gameMap.mapId(),
            x: point.x,
            y: point.y,
            valid: inBounds(point.x, point.y),
            layers: {},
            shadowBits: 0,
            regionId: 0,
            terrainTag: 0,
            properties: []
        };
        if (!info.valid) return info;
        for (let z = 0; z <= 3; z++) {
            const key = `L${z + 1}`;
            const tileId = getTileId(point.x, point.y, key);
            info.layers[key] = {
                tileId,
                tileCode: tileCodeFromId(tileId),
                autotileKind: Tilemap.isAutotile(tileId) ? Tilemap.getAutotileKind(tileId) : -1,
                autotileShape: Tilemap.isAutotile(tileId)
                    ? (Tilemap.getAutotileShape ? Tilemap.getAutotileShape(tileId) : (tileId - Tilemap.TILE_ID_A1) % 48)
                    : -1
            };
        }
        info.shadowBits = getTileId(point.x, point.y, "L5");
        info.regionId = getTileId(point.x, point.y, "L6");
        if ($gameMap.terrainTag) info.terrainTag = $gameMap.terrainTag(point.x, point.y);
        const properties = [
            ["ladder", "isLadder"],
            ["bush", "isBush"],
            ["counter", "isCounter"],
            ["damageFloor", "isDamageFloor"]
        ];
        for (const [label, method] of properties) {
            if ($gameMap[method] && $gameMap[method](point.x, point.y)) info.properties.push(label);
        }
        return info;
    }

    function logTileInfo(x = $gamePlayer.x, y = $gamePlayer.y, options = {}) {
        const info = inspectTile(x, y, options);
        if (!info.valid) {
            console.warn(`${PLUGIN_NAME}: tile inspection is outside the current map.`, info);
            return info;
        }
        const lines = [`${PLUGIN_NAME} Tile Info — Map ${info.mapId} (${info.x}, ${info.y})`];
        for (const [layer, data] of Object.entries(info.layers)) {
            lines.push(`${layer}: ID ${data.tileId}, Code ${data.tileCode || "n/a"}, Autotile ${data.autotileKind}, Shape ${data.autotileShape}`);
        }
        lines.push(`Shadow: ${info.shadowBits} (0b${info.shadowBits.toString(2)})`);
        lines.push(`Region: ${info.regionId}; Terrain: ${info.terrainTag}; Properties: ${info.properties.join(", ") || "none"}`);
        console.log(lines.join("\n"));
        return info;
    }

    function tileIdInList(tileValues, x = $gamePlayer.x, y = $gamePlayer.y, layer = "L1") {
        const tileId = getTileId(x, y, layer);
        return normalizeList(tileValues).map(parseTileId).filter(value => value !== null).includes(tileId);
    }

    function autotileInList(tileValues, x = $gamePlayer.x, y = $gamePlayer.y, layer = "L1") {
        const tileId = getTileId(x, y, layer);
        if (!Tilemap.isAutotile(tileId)) return false;
        const kind = Tilemap.getAutotileKind(tileId);
        return normalizeList(tileValues).map(value => {
            const parsed = parseTileId(value);
            return parsed !== null && Tilemap.isAutotile(parsed) ? Tilemap.getAutotileKind(parsed) : integer(value, -1);
        }).includes(kind);
    }

    function pointAhead(distance = 1) {
        let x = $gamePlayer.x;
        let y = $gamePlayer.y;
        const direction = $gamePlayer.direction();
        for (let step = 0; step < Math.max(0, integer(distance, 1)); step++) {
            if ($gameMap.xWithDirection && $gameMap.yWithDirection) {
                x = $gameMap.xWithDirection(x, direction);
                y = $gameMap.yWithDirection(y, direction);
            } else {
                const shift = directionShift(direction, 1, 0);
                x += shift.x;
                y += shift.y;
            }
        }
        return { x, y };
    }

    function tileAhead(tileValues, distance = 1, layer = "L1") {
        const point = pointAhead(distance);
        return tileIdInList(tileValues, point.x, point.y, layer);
    }

    function autotileAhead(tileValues, distance = 1, layer = "L1") {
        const point = pointAhead(distance);
        return autotileInList(tileValues, point.x, point.y, layer);
    }

    function sameTileType(first, second) {
        if (first === second) return true;
        if (!Tilemap.isAutotile(first) || !Tilemap.isAutotile(second)) return false;
        return Tilemap.getAutotileKind(first) === Tilemap.getAutotileKind(second);
    }

    // -------------------------------------------------------------------------
    // Map loading and caches
    // -------------------------------------------------------------------------

    function loadPristineMapData(mapId, forceRefresh = false) {
        const id = positiveInteger(mapId);
        if (forceRefresh) {
            pristineCache.delete(id);
            composedCache.delete(id);
            pendingLoads.delete(id);
        }
        if (pristineCache.has(id)) return Promise.resolve(pristineCache.get(id));
        if (pendingLoads.has(id)) return pendingLoads.get(id);
        const promise = new Promise((resolve, reject) => {
            const url = `data/Map${String(id).padStart(3, "0")}.json`;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.overrideMimeType("application/json");
            xhr.onload = () => {
                if (xhr.status >= 400) {
                    reject(new Error(`${PLUGIN_NAME}: failed to load ${url} (HTTP ${xhr.status}).`));
                    return;
                }
                try {
                    const json = JSON.parse(xhr.responseText);
                    const entry = {
                        width: json.width,
                        height: json.height,
                        data: json.data.slice(),
                        tilesetId: json.tilesetId,
                        note: json.note || "",
                        events: deepClone(json.events || []),
                        raw: deepClone(json)
                    };
                    pristineCache.set(id, entry);
                    resolve(entry);
                } catch (error) {
                    reject(new Error(`${PLUGIN_NAME}: invalid JSON in ${url}: ${error.message}`));
                }
            };
            xhr.onerror = () => reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
            xhr.send();
        }).finally(() => pendingLoads.delete(id));
        pendingLoads.set(id, promise);
        return promise;
    }

    function buildComposedSnapshot(mapId, pristineEntry) {
        const override = ensureStore().mapOverrides[String(integer(mapId))];
        const base = override || pristineEntry;
        const snapshot = {
            width: base.width,
            height: base.height,
            data: base.data.slice(),
            tilesetId: base.tilesetId,
            note: base.note || "",
            events: []
        };
        const patches = composedPatchesForMap(mapId);
        for (const patch of patches) applyPatchToBuffer(patch, snapshot.data, snapshot.width, snapshot.height, true);
        snapshot.events = composeEvents(base.events, patches, mapId);
        applySavedPositionsToEventData(snapshot.events, mapId);
        return snapshot;
    }

    function preloadMap(mapId, forceRefresh = false) {
        const id = positiveInteger(mapId);
        if (!forceRefresh && composedCache.has(id)) return Promise.resolve(composedCache.get(id));
        return loadPristineMapData(id, forceRefresh).then(entry => {
            const snapshot = buildComposedSnapshot(id, entry);
            composedCache.set(id, snapshot);
            return snapshot;
        });
    }

    function currentEventSnapshots() {
        if (!$gameMap || !$gameMap.events) return deepClone($dataMap.events || []);
        const output = [];
        for (const gameEvent of $gameMap.events()) {
            if (!gameEvent || !gameEvent.event) continue;
            const data = deepClone(gameEvent.event());
            if (!data) continue;
            data.x = gameEvent.x;
            data.y = gameEvent.y;
            output[data.id] = data;
        }
        return output;
    }

    function getSourceMapData(mapId) {
        const id = integer(mapId) === 0 ? $gameMap.mapId() : positiveInteger(mapId);
        if (id === $gameMap.mapId()) {
            return {
                width: $dataMap.width,
                height: $dataMap.height,
                data: $dataMap.data,
                tilesetId: $dataMap.tilesetId,
                note: $dataMap.note || "",
                events: currentEventSnapshots()
            };
        }
        if (composedCache.has(id)) return composedCache.get(id);
        console.warn(`${PLUGIN_NAME}: source map ${id} is not preloaded. Use preloadMap() or an async graft call.`);
        return null;
    }

    // -------------------------------------------------------------------------
    // Patch data and autotiles
    // -------------------------------------------------------------------------

    function makeRectPatch(rect, layers, tiles, mode = "exact", eventOptions = {}) {
        return {
            version: 2,
            kind: "rect",
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            layers: layers.slice(),
            tiles,
            mode: normalizeMode(mode),
            affectEvents: !!eventOptions.affectEvents,
            events: eventOptions.affectEvents ? (eventOptions.events || []) : null,
            removeEventIds: eventOptions.affectEvents
                ? (eventOptions.removeEventIds || []).map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET)
                : []
        };
    }

    function makeSparsePatch(cells, mode = "exact", recalcCells = null) {
        const layers = [];
        for (const cell of cells) {
            for (const key of Object.keys(cell.tiles || {})) {
                if (LAYER_INDEX[key] !== undefined && !layers.includes(key)) layers.push(key);
            }
        }
        return {
            version: 2,
            kind: "sparse",
            cells,
            layers,
            mode: normalizeMode(mode),
            recalcCells: recalcCells ? recalcCells.map(p => ({ x: integer(p.x), y: integer(p.y) })) : null,
            affectEvents: false,
            events: null
        };
    }

    function makeBatchPatch(patches, label = "Edit Session") {
        return {
            version: 3,
            kind: "batch",
            label: String(label || "Edit Session"),
            patches: (patches || []).map(deepClone),
            createdAt: Date.now()
        };
    }

    function makeEventPatch(events = [], removeEventIds = [], label = "Event Edit", options = {}) {
        const points = events.map(event => ({ x: integer(event.x), y: integer(event.y) }));
        const rect = points.length
            ? unionRects(points.map(point => ({ x: point.x, y: point.y, w: 1, h: 1 })))
            : { x: 0, y: 0, w: 0, h: 0 };
        return {
            version: 3,
            kind: "events",
            label,
            cells: [],
            layers: [],
            mode: "exact",
            affectEvents: true,
            replaceAreaEvents: false,
            preserveEventState: toBoolean(options.preserveEventState, false),
            eventRect: rect,
            events: events.map(deepClone),
            removeEventIds: removeEventIds.map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET)
        };
    }

    function flattenPatches(patches) {
        const output = [];
        for (const patch of patches || []) {
            if (patch && patch.kind === "batch") output.push(...flattenPatches(patch.patches));
            else if (patch) output.push(patch);
        }
        return output;
    }

    function unionRects(rects) {
        const valid = (rects || []).filter(rect => rect && rect.w > 0 && rect.h > 0);
        if (!valid.length) return { x: 0, y: 0, w: 0, h: 0 };
        const x1 = Math.min(...valid.map(rect => rect.x));
        const y1 = Math.min(...valid.map(rect => rect.y));
        const x2 = Math.max(...valid.map(rect => rect.x + rect.w));
        const y2 = Math.max(...valid.map(rect => rect.y + rect.h));
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }

    function patchRect(patch) {
        if (patch && patch.kind === "batch") return unionRects((patch.patches || []).map(patchRect));
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            const cells = patch.cells || [];
            if (!cells.length) return { x: 0, y: 0, w: 0, h: 0 };
            const xs = cells.map(cell => integer(cell.x));
            const ys = cells.map(cell => integer(cell.y));
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return { x: minX, y: minY, w: Math.max(...xs) - minX + 1, h: Math.max(...ys) - minY + 1 };
        }
        return normalizeRect(patch.x, patch.y, patch.w, patch.h);
    }

    function eventPatchRect(patch) {
        if (patch.eventRect) {
            return normalizeRect(patch.eventRect.x, patch.eventRect.y, patch.eventRect.w, patch.eventRect.h);
        }
        return patchRect(patch);
    }

    function applyPatchTiles(patch, data, width, height) {
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            for (const cell of patch.cells || []) {
                const x = integer(cell.x);
                const y = integer(cell.y);
                for (const [key, value] of Object.entries(cell.tiles || {})) {
                    const z = LAYER_INDEX[key];
                    if (z !== undefined) writeTile(data, width, height, x, y, z, value);
                }
            }
            return;
        }
        const rect = normalizeRect(patch.x, patch.y, patch.w, patch.h);
        const layers = parseLayerSelection(patch.layers || []).layers;
        for (const key of layers) {
            const z = LAYER_INDEX[key];
            const layerData = patch.tiles && patch.tiles[key];
            if (!layerData) continue;
            for (let dy = 0; dy < rect.h; dy++) {
                for (let dx = 0; dx < rect.w; dx++) {
                    writeTile(data, width, height, rect.x + dx, rect.y + dy, z, layerData[dy * rect.w + dx] || 0);
                }
            }
        }
    }

    function autotileSeedCells(patch) {
        if (Array.isArray(patch.recalcCells)) return patch.recalcCells;
        if (normalizeMode(patch.mode) !== "autotile") return [];
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            return (patch.cells || []).map(cell => ({ x: integer(cell.x), y: integer(cell.y) }));
        }
        const rect = normalizeRect(patch.x, patch.y, patch.w, patch.h);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y });
        }
        return cells;
    }

    function applyPatchToBuffer(patch, data, width, height, recalc = true) {
        if (patch && patch.kind === "batch") {
            for (const child of patch.patches || []) applyPatchToBuffer(child, data, width, height, recalc);
            return;
        }
        applyPatchTiles(patch, data, width, height);
        if (recalc) recalcAutotilesAround(data, width, height, autotileSeedCells(patch));
    }

    function recalcAutotilesAround(data, width, height, seeds) {
        if (!seeds || !seeds.length) return;
        const locations = new Set();
        for (const seed of seeds) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const x = integer(seed.x) + dx;
                    const y = integer(seed.y) + dy;
                    if (inBounds(x, y, width, height)) locations.add(`${x},${y}`);
                }
            }
        }
        for (const location of locations) {
            const [x, y] = location.split(",").map(Number);
            for (let z = 0; z <= 3; z++) {
                const tileId = readTile(data, width, height, x, y, z);
                if (!Tilemap.isAutotile(tileId)) continue;
                const kind = Tilemap.getAutotileKind(tileId);
                const baseTileId = Tilemap.makeAutotileId(kind, 0);
                const n = autotileNeighborConnects(data, width, height, x, y - 1, z, kind);
                const e = autotileNeighborConnects(data, width, height, x + 1, y, z, kind);
                const s = autotileNeighborConnects(data, width, height, x, y + 1, z, kind);
                const w = autotileNeighborConnects(data, width, height, x - 1, y, z, kind);
                let shape;
                if (Tilemap.isWaterfallTile(baseTileId)) {
                    shape = waterfallAutotileShape(e, w);
                } else if (Tilemap.isTileA3(baseTileId) || Tilemap.isWallSideTile(baseTileId)) {
                    shape = wallSideAutotileShape(n, e, s, w);
                } else {
                    const nw = autotileNeighborConnects(data, width, height, x - 1, y - 1, z, kind);
                    const ne = autotileNeighborConnects(data, width, height, x + 1, y - 1, z, kind);
                    const se = autotileNeighborConnects(data, width, height, x + 1, y + 1, z, kind);
                    const sw = autotileNeighborConnects(data, width, height, x - 1, y + 1, z, kind);
                    shape = floorAutotileShape(n, e, s, w, nw, ne, se, sw);
                }
                writeTile(data, width, height, x, y, z, Tilemap.makeAutotileId(kind, shape));
            }
        }
    }

    function autotileNeighborConnects(data, width, height, x, y, z, kind) {
        if (!inBounds(x, y, width, height)) return true;
        const tileId = readTile(data, width, height, x, y, z);
        return Tilemap.isAutotile(tileId) && Tilemap.getAutotileKind(tileId) === kind;
    }

    // Shape ordering follows RPG Maker MZ's 48-ID autotile blocks. The same
    // independently exposed algorithm is used by Tyruswoo Tile Control (MIT).
    function floorAutotileShape(n, e, s, w, nw, ne, se, sw) {
        let shape = 0;
        if (n && e && s && w) {
            if (!nw) shape += 1;
            if (!ne) shape += 2;
            if (!se) shape += 4;
            if (!sw) shape += 8;
        } else if (n && e && s && !w) {
            shape = 16 + (!ne ? 1 : 0) + (!se ? 2 : 0);
        } else if (!n && e && s && w) {
            shape = 20 + (!se ? 1 : 0) + (!sw ? 2 : 0);
        } else if (n && !e && s && w) {
            shape = 24 + (!sw ? 1 : 0) + (!nw ? 2 : 0);
        } else if (n && e && !s && w) {
            shape = 28 + (!nw ? 1 : 0) + (!ne ? 2 : 0);
        } else if (n && !e && s && !w) shape = 32;
        else if (!n && e && !s && w) shape = 33;
        else if (!n && e && s && !w) shape = 34 + (!se ? 1 : 0);
        else if (!n && !e && s && w) shape = 36 + (!sw ? 1 : 0);
        else if (n && !e && !s && w) shape = 38 + (!nw ? 1 : 0);
        else if (n && e && !s && !w) shape = 40 + (!ne ? 1 : 0);
        else if (!n && !e && s && !w) shape = 42;
        else if (!n && e && !s && !w) shape = 43;
        else if (n && !e && !s && !w) shape = 44;
        else if (!n && !e && !s && w) shape = 45;
        else shape = 46;
        return shape;
    }

    function wallSideAutotileShape(n, e, s, w) {
        return (!w ? 1 : 0) + (!n ? 2 : 0) + (!e ? 4 : 0) + (!s ? 8 : 0);
    }

    function waterfallAutotileShape(e, w) {
        if (e && !w) return 1;
        if (!e && w) return 2;
        if (!e && !w) return 3;
        return 0;
    }

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

    // -------------------------------------------------------------------------
    // Live patch application and map reconstruction
    // -------------------------------------------------------------------------

    function requestTilemapRefresh() {
        const scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset._tilemap && scene._spriteset._tilemap.refresh) {
            scene._spriteset._tilemap.refresh();
        }
    }

    function applyPatchLive(patch, operation = "change") {
        if (patch && patch.kind === "batch") {
            for (const child of patch.patches || []) applyPatchLive(child, operation);
            return true;
        }
        applyPatchToBuffer(patch, $dataMap.data, $dataMap.width, $dataMap.height, true);
        if (patchAffectsEvents(patch)) {
            const rect = eventPatchRect(patch);
            for (const id of patch.removeEventIds || []) {
                if (spawnedIds.has(id) || isHybridGameEvent($gameMap.event(id))) despawnEvent(id, !patch.preserveEventState);
            }
            if (patch.replaceAreaEvents !== false) despawnEventsInArea(rect, true);
            for (const event of patch.events || []) spawnEventFromSnapshot(event, true);
        }
        requestTilemapRefresh();
        emitChange({ operation, mapId: $gameMap.mapId(), rect: patchRect(patch), layers: patch.layers || [] });
    }

    function captureCurrentPristine(mapId) {
        currentPristine = {
            mapId,
            width: $dataMap.width,
            height: $dataMap.height,
            data: $dataMap.data.slice(),
            tilesetId: $dataMap.tilesetId,
            note: $dataMap.note || "",
            events: deepClone($dataMap.events || [])
        };
    }

    function prepareDataMapForLoad(mapId) {
        captureCurrentPristine(mapId);
        const snapshot = buildComposedSnapshot(mapId, currentPristine);
        $dataMap.width = snapshot.width;
        $dataMap.height = snapshot.height;
        $dataMap.tilesetId = snapshot.tilesetId;
        $dataMap.note = snapshot.note;
        $dataMap.data = snapshot.data;
        $dataMap.events = snapshot.events;
    }

    function rebuildCurrentMap(operation = "rebuild") {
        if (!currentPristine || currentPristine.mapId !== $gameMap.mapId()) return false;
        captureSpawnedRuntimeStates();
        const previousIds = new Set(spawnedIds);
        despawnAllTrackedEvents(false);
        const snapshot = buildComposedSnapshot($gameMap.mapId(), currentPristine);
        $dataMap.width = snapshot.width;
        $dataMap.height = snapshot.height;
        $dataMap.tilesetId = snapshot.tilesetId;
        $dataMap.note = snapshot.note;
        $dataMap.data = snapshot.data;
        $dataMap.events = snapshot.events;
        const desiredEvents = snapshot.events;
        const desiredOrdinaryIds = new Set();
        if ($gameMap && $gameMap._events) {
            for (const eventData of desiredEvents || []) {
                if (!eventData || isHybridEventData(eventData)) continue;
                desiredOrdinaryIds.add(eventData.id);
                let gameEvent = $gameMap.event(eventData.id);
                if (!gameEvent && typeof Game_Event !== "undefined") {
                    gameEvent = new Game_Event($gameMap.mapId(), eventData.id);
                    $gameMap._events[eventData.id] = gameEvent;
                }
                if (gameEvent && gameEvent.locate) gameEvent.locate(eventData.x, eventData.y);
            }
            for (let eventId = 1; eventId < $gameMap._events.length; eventId++) {
                const gameEvent = $gameMap._events[eventId];
                if (gameEvent && !isHybridGameEvent(gameEvent) && !desiredOrdinaryIds.has(eventId)) $gameMap._events[eventId] = null;
            }
        }
        const desiredIds = new Set();
        for (const event of desiredEvents) {
            if (!isHybridEventData(event)) continue;
            desiredIds.add(event.id);
            spawnEventFromSnapshot(event, true);
        }
        for (const id of previousIds) if (!desiredIds.has(id)) clearEventState($gameMap.mapId(), id);
        requestTilemapRefresh();
        emitChange({ operation, mapId: $gameMap.mapId(), rect: { x: 0, y: 0, w: $dataMap.width, h: $dataMap.height }, layers: Object.keys(LAYER_INDEX) });
        return true;
    }

    function makeCompactedPatch(pristine, composed) {
        const cells = [];
        for (let y = 0; y < pristine.height; y++) {
            for (let x = 0; x < pristine.width; x++) {
                const tiles = {};
                for (const [key, z] of Object.entries(LAYER_INDEX)) {
                    const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                    const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                    if (before !== after) tiles[key] = after;
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
        }
        const events = (composed.events || []).filter(isHybridEventData).map(deepClone);
        if (!cells.length && !events.length) return null;
        const patch = makeSparsePatch(cells, "exact", null);
        patch.compacted = true;
        patch.affectEvents = true;
        patch.events = events;
        patch.removeEventIds = [];
        patch.eventRect = { x: 0, y: 0, w: pristine.width, h: pristine.height };
        return patch;
    }

    function compactMapSync(mapId = $gameMap.mapId(), announce = true) {
        const id = integer(mapId);
        if (activeEditTransaction && activeEditTransaction.mapId === id) {
            if (announce) console.warn(`${PLUGIN_NAME}: commit or cancel the active edit transaction before compacting.`);
            return false;
        }
        const pristine = currentPristine && currentPristine.mapId === id
            ? currentPristine
            : pristineCache.get(id);
        if (!pristine) return false;
        const store = ensureStore();
        const beforeCount = (store.maps[String(id)] || []).length;
        const composed = buildComposedSnapshot(id, pristine);
        if (store.mapOverrides[String(id)]) {
            const previous = store.mapOverrides[String(id)];
            store.mapOverrides[String(id)] = Object.assign({}, previous, {
                width: composed.width,
                height: composed.height,
                data: composed.data.slice(),
                tilesetId: composed.tilesetId,
                note: composed.note || "",
                events: deepClone(composed.events || [])
            });
            delete store.maps[String(id)];
            delete store.redo[String(id)];
            composedCache.set(id, composed);
            if (announce) emitChange({ operation: "compactMap", mapId: id,
                beforePatchCount: beforeCount, afterPatchCount: 0, transformed: true });
            return { mapId: id, beforePatchCount: beforeCount, afterPatchCount: 0,
                changedCells: composed.width * composed.height, spawnedEvents: (composed.events || []).filter(isHybridEventData).length,
                transformed: true };
        }
        const compacted = makeCompactedPatch(pristine, composed);
        if (compacted) store.maps[String(id)] = [compacted];
        else delete store.maps[String(id)];
        delete store.redo[String(id)];
        composedCache.set(id, composed);
        if (announce) {
            emitChange({
                operation: "compactMap",
                mapId: id,
                beforePatchCount: beforeCount,
                afterPatchCount: compacted ? 1 : 0,
                changedCells: compacted ? compacted.cells.length : 0
            });
        }
        return {
            mapId: id,
            beforePatchCount: beforeCount,
            afterPatchCount: compacted ? 1 : 0,
            changedCells: compacted ? compacted.cells.length : 0,
            spawnedEvents: compacted ? compacted.events.length : 0
        };
    }

    function compactMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const immediate = compactMapSync(id, true);
        if (immediate) return Promise.resolve(immediate);
        return loadPristineMapData(id).then(() => compactMapSync(id, true));
    }

    function patchWriteCount(patch) {
        if (!patch || typeof patch !== "object") return 0;
        if (patch && patch.kind === "batch") {
            return (patch.patches || []).reduce((total, child) => total + patchWriteCount(child), 0);
        }
        if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            return (patch.cells || []).reduce((total, cell) => total + Object.keys(cell.tiles || {}).length, 0);
        }
        const rect = patchRect(patch);
        return rect.w * rect.h * parseLayerSelection(patch.layers || []).layers.length;
    }

    function diagnoseMapSync(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const patches = getPatches(id);
        const pristine = currentPristine && currentPristine.mapId === id
            ? currentPristine
            : pristineCache.get(id);
        const warnings = [];
        let tileWrites = 0;
        let spawnedEvents = 0;
        for (let index = 0; index < patches.length; index++) {
            const patch = patches[index];
            tileWrites += patchWriteCount(patch);
            spawnedEvents += flattenPatches([patch]).reduce((total, child) => total + (child.events || []).length, 0);
            const rect = patchRect(patch);
            if (pristine && rect.w > 0 && rect.h > 0 && (
                rect.x >= pristine.width || rect.y >= pristine.height ||
                rect.x + rect.w <= 0 || rect.y + rect.h <= 0
            )) warnings.push(`Patch ${index + 1} is completely outside the map.`);
            for (const event of flattenPatches([patch]).flatMap(child => child.events || [])) {
                if (!isHybridEventData(event) || event.id < SPAWN_ID_OFFSET) {
                    warnings.push(`Patch ${index + 1} has an invalid spawned-event identity.`);
                }
            }
        }
        if (MAX_SAVED_PATCHES > 0 && patches.length > Math.floor(MAX_SAVED_PATCHES * 0.8)) {
            warnings.push(`Patch count is approaching the automatic compaction threshold (${MAX_SAVED_PATCHES}).`);
        }
        const storeValidation = validateStore({ repair: false });
        const override = ensureStore().mapOverrides[String(id)] || null;
        if (storeValidation.issueCount) warnings.push(`Save-store validation found ${storeValidation.issueCount} structural issue(s).`);
        return {
            version: VERSION,
            mapId: id,
            patchCount: patches.length,
            redoCount: (ensureStore().redo[String(id)] || []).length,
            tileWrites,
            spawnedEventSnapshots: spawnedEvents,
            cached: composedCache.has(id),
            transformed: !!override,
            dimensions: override ? { width: override.width, height: override.height } : pristine
                ? { width: pristine.width, height: pristine.height } : null,
            prefabCount: listPrefabs().length,
            checkpointCount: listCheckpoints(id).length,
            historyBytes: JSON.stringify({ patches, redo: ensureStore().redo[String(id)] || [] }).length,
            validation: storeValidation,
            performance: performanceDiagnostics(),
            compatibility: compatibilityDiagnostics(),
            warnings,
            ok: warnings.length === 0
        };
    }

    function diagnoseMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if ((currentPristine && currentPristine.mapId === id) || pristineCache.has(id)) {
            return Promise.resolve(diagnoseMapSync(id));
        }
        return loadPristineMapData(id).then(() => diagnoseMapSync(id));
    }

    function exportPatchPack(mapIds = null) {
        const store = ensureStore();
        const ids = mapIds === null || mapIds === undefined
            ? [...new Set([...Object.keys(store.maps), ...Object.keys(store.mapOverrides)])].map(Number)
            : normalizeList(mapIds).map(Number).filter(id => id > 0);
        const maps = {};
        const redo = {};
        const eventStates = {};
        const checkpoints = {};
        const mapOverrides = {};
        const authoringLayers = {};
        const activeAuthoringLayers = {};
        const masks = {};
        const modifiers = {};
        const prefabInstances = {};
        for (const id of ids) {
            const key = String(id);
            if (store.maps[key]) maps[key] = deepClone(store.maps[key]);
            if (store.redo[key]) redo[key] = deepClone(store.redo[key]);
            if (store.eventStates[key]) eventStates[key] = deepClone(store.eventStates[key]);
            if (store.checkpoints[key]) checkpoints[key] = deepClone(store.checkpoints[key]);
            if (store.mapOverrides[key]) mapOverrides[key] = deepClone(store.mapOverrides[key]);
            if (store.authoringLayers[key]) authoringLayers[key] = deepClone(store.authoringLayers[key]);
            if (store.activeAuthoringLayers[key]) activeAuthoringLayers[key] = store.activeAuthoringLayers[key];
            if (store.masks[key]) masks[key] = deepClone(store.masks[key]);
            if (store.modifiers[key]) modifiers[key] = deepClone(store.modifiers[key]);
            if (store.prefabInstances[key]) prefabInstances[key] = deepClone(store.prefabInstances[key]);
        }
        return {
            format: "HybridTileGraftPatchPack",
            version: 3,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            maps,
            redo,
            eventStates,
            checkpoints,
            mapOverrides,
            authoringLayers,
            activeAuthoringLayers,
            masks,
            modifiers,
            prefabInstances,
            changeSets: deepClone(store.changeSets),
            prefabs: deepClone(store.prefabs),
            prefabPayloads: deepClone(store.prefabPayloads),
            prefabRevisions: deepClone(store.prefabRevisions),
            eventTemplates: deepClone(store.eventTemplates),
            brushPresets: deepClone(store.brushPresets),
            editorPreferences: deepClone(store.editorPreferences)
        };
    }

    function validatePatchRecord(patch, path, issues, repair = false) {
        const issue = (message, fixed = false) => issues.push({ path, message, fixed });
        if (!patch || typeof patch !== "object") {
            issue("Patch is not an object.", repair);
            return false;
        }
        if (patch.kind === "batch") {
            if (!Array.isArray(patch.patches)) {
                issue("Batch patch has no patch array.", repair);
                if (repair) patch.patches = [];
                return false;
            }
            if (repair) patch.patches = patch.patches.filter((child, index) =>
                validatePatchRecord(child, `${path}.patches[${index}]`, issues, true));
            else patch.patches.forEach((child, index) => validatePatchRecord(child, `${path}.patches[${index}]`, issues, false));
            return true;
        }
        if (patch.kind === "rect") {
            const width = positiveInteger(patch.w, 0);
            const height = positiveInteger(patch.h, 0);
            if (width <= 0 || height <= 0) {
                issue("Rectangle patch has invalid dimensions.", false);
                return false;
            }
            const layers = parseLayerSelection(patch.layers || []).layers;
            if (!layers.length && !patchAffectsEvents(patch)) issue("Rectangle patch has no valid layers or events.", false);
            if (repair) patch.layers = layers;
            patch.tiles ||= {};
            for (const layer of layers) {
                if (!Array.isArray(patch.tiles[layer])) {
                    issue(`Missing ${layer} tile array.`, repair);
                    if (repair) patch.tiles[layer] = new Array(width * height).fill(0);
                } else if (patch.tiles[layer].length !== width * height) {
                    issue(`${layer} tile array length does not match the rectangle.`, repair);
                    if (repair) patch.tiles[layer] = patch.tiles[layer].slice(0, width * height)
                        .concat(new Array(Math.max(0, width * height - patch.tiles[layer].length)).fill(0));
                }
            }
        } else if (patch.kind === "sparse" || Array.isArray(patch.cells)) {
            if (!Array.isArray(patch.cells)) {
                issue("Sparse patch has no cells array.", repair);
                if (repair) patch.cells = [];
                return false;
            }
            const clean = [];
            for (let index = 0; index < patch.cells.length; index++) {
                const cell = patch.cells[index];
                if (!cell || typeof cell !== "object" || !cell.tiles || typeof cell.tiles !== "object") {
                    issue(`Sparse cell ${index} is invalid.`, repair);
                    continue;
                }
                const tiles = {};
                for (const [layer, value] of Object.entries(cell.tiles)) {
                    if (LAYER_INDEX[layer] === undefined || !Number.isFinite(Number(value))) {
                        issue(`Sparse cell ${index} has invalid ${layer} data.`, repair);
                        continue;
                    }
                    tiles[layer] = integer(value);
                }
                if (Object.keys(tiles).length || patchAffectsEvents(patch)) clean.push({ x: integer(cell.x), y: integer(cell.y), tiles });
            }
            if (repair) patch.cells = clean;
        } else if (patch.kind !== "events") {
            issue(`Unknown patch kind "${patch.kind}".`, false);
            return false;
        }
        if (patch.events !== null && patch.events !== undefined && !Array.isArray(patch.events)) {
            issue("Patch event collection is not an array.", repair);
            if (repair) patch.events = [];
        }
        if (repair && Array.isArray(patch.removeEventIds)) {
            patch.removeEventIds = [...new Set(patch.removeEventIds.map(id => integer(id)).filter(id => id >= SPAWN_ID_OFFSET))];
        }
        if (repair) patch.mode = normalizeMode(patch.mode, "exact");
        return true;
    }

    function validateStore(options = {}) {
        const repair = toBoolean(options.repair, false);
        const store = ensureStore();
        const issues = [];
        let fixes = 0;
        const inspectBucket = (bucketName) => {
            const bucket = store[bucketName] || {};
            for (const [key, patches] of Object.entries(bucket)) {
                if (!/^\d+$/.test(key) || !Array.isArray(patches)) {
                    issues.push({ path: `${bucketName}.${key}`, message: "Invalid map history bucket.", fixed: repair });
                    if (repair) delete bucket[key];
                    continue;
                }
                if (repair) bucket[key] = patches.filter((patch, index) =>
                    validatePatchRecord(patch, `${bucketName}.${key}[${index}]`, issues, true));
                else patches.forEach((patch, index) => validatePatchRecord(patch, `${bucketName}.${key}[${index}]`, issues, false));
            }
        };
        inspectBucket("maps");
        inspectBucket("redo");
        for (const [key, override] of Object.entries(store.mapOverrides || {})) {
            const expected = positiveInteger(override && override.width, 0) * positiveInteger(override && override.height, 0) * 6;
            if (!override || expected <= 0 || !Array.isArray(override.data) || override.data.length !== expected) {
                issues.push({ path: `mapOverrides.${key}`, message: "Invalid full-map override.", fixed: repair });
                if (repair) delete store.mapOverrides[key];
            }
        }
        for (const [key, payload] of Object.entries(store.prefabPayloads || {})) {
            const expected = positiveInteger(payload && payload.width, 0) * positiveInteger(payload && payload.height, 0);
            const valid = payload && expected > 0 && payload.tiles && Object.values(payload.tiles).every(values => Array.isArray(values) && values.length === expected);
            if (!valid) {
                issues.push({ path: `prefabPayloads.${key}`, message: "Invalid embedded prefab payload.", fixed: repair });
                if (repair) delete store.prefabPayloads[key];
            }
        }
        for (const [key, layers] of Object.entries(store.authoringLayers || {})) {
            if (!Array.isArray(layers)) {
                issues.push({ path: `authoringLayers.${key}`, message: "Authoring layer bucket is not an array.", fixed: repair });
                if (repair) store.authoringLayers[key] = [];
                continue;
            }
            const ids = new Set();
            store.authoringLayers[key] = layers.filter((layer, index) => {
                const valid = layer && layer.id && !ids.has(layer.id);
                if (!valid) issues.push({ path: `authoringLayers.${key}[${index}]`, message: "Invalid or duplicate authoring layer.", fixed: repair });
                if (valid) ids.add(layer.id);
                return valid || !repair;
            });
            for (const patch of store.maps[key] || []) if (patch && patch.authoringLayerId && !ids.has(patch.authoringLayerId)) {
                issues.push({ path: `maps.${key}`, message: `Patch references missing authoring layer ${patch.authoringLayerId}.`, fixed: repair });
                if (repair) delete patch.authoringLayerId;
            }
        }
        for (const [key, masks] of Object.entries(store.masks || {})) {
            if (!masks || typeof masks !== "object" || Array.isArray(masks)) {
                issues.push({ path: `masks.${key}`, message: "Mask bucket is invalid.", fixed: repair });
                if (repair) store.masks[key] = {};
                continue;
            }
            for (const [maskId, mask] of Object.entries(masks)) if (!mask || !Array.isArray(mask.points)) {
                issues.push({ path: `masks.${key}.${maskId}`, message: "Mask has no point array.", fixed: repair });
                if (repair) delete masks[maskId];
            }
        }
        for (const field of ["modifiers", "prefabInstances"]) for (const [key, entries] of Object.entries(store[field] || {})) {
            if (!Array.isArray(entries)) {
                issues.push({ path: `${field}.${key}`, message: `${field} bucket is not an array.`, fixed: repair });
                if (repair) store[field][key] = [];
            }
        }
        for (const [recipeId, recipe] of Object.entries(store.worldRecipes || {})) {
            const report = validateWorldRecipe(recipe);
            if (recipeId !== recipe?.id || !report.ok) {
                issues.push({ path: `worldRecipes.${recipeId}`, message: report.errors.join("; ") || "World Recipe key does not match its ID.", fixed: repair });
                if (repair) delete store.worldRecipes[recipeId];
            }
        }
        if (!store.worldState || typeof store.worldState !== "object" || Array.isArray(store.worldState)) {
            issues.push({ path: "worldState", message: "World state must be an object.", fixed: repair });
            if (repair) store.worldState = {};
        }
        for (const zone of Object.values(store.worldZones || {})) try { normalizeWorldZone(zone); } catch (error) { issues.push({ path: `worldZones.${zone?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && zone?.id) delete store.worldZones[zone.id]; }
        for (const field of ["worldEntities", "worldResources", "worldRecipePacks", "worldRecipeProfiles", "worldRecipeBreakpoints", "worldRecipePaused", "worldMapVariants", "worldNpcs", "worldRuleLayers", "worldBiomeGraphs", "contentCatalogs"]) if (!store[field] || typeof store[field] !== "object" || Array.isArray(store[field])) { issues.push({ path: field, message: `${field} must be an object.`, fixed: repair }); if (repair) store[field] = {}; }
        for (const field of ["worldSchedules", "worldRecipeTests", "worldPackHistory", "recoverySnapshots"]) if (!Array.isArray(store[field])) { issues.push({ path: field, message: `${field} must be an array.`, fixed: repair }); if (repair) store[field] = []; }
        for (const npc of Object.values(store.worldNpcs || {})) try { normalizeWorldNpc(npc); } catch (error) { issues.push({ path: `worldNpcs.${npc?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && npc?.id) delete store.worldNpcs[npc.id]; }
        for (const layer of Object.values(store.worldRuleLayers || {})) try { normalizeWorldRuleLayer(layer); } catch (error) { issues.push({ path: `worldRuleLayers.${layer?.id || "unknown"}`, message: error.message, fixed: repair }); if (repair && layer?.id) delete store.worldRuleLayers[layer.id]; }
        for (const graph of Object.values(store.worldBiomeGraphs || {})) { const report = validateBiomeGraph(graph); if (!report.ok) { issues.push({ path: `worldBiomeGraphs.${graph?.id || "unknown"}`, message: report.errors.join("; "), fixed: repair }); if (repair && graph?.id) delete store.worldBiomeGraphs[graph.id]; } }
        if (!Array.isArray(store.worldClock?.seasons) || !store.worldClock.seasons.length) { issues.push({ path: "worldClock.seasons", message: "World Clock requires at least one season.", fixed: repair }); if (repair) store.worldClock = normalizeWorldClock(store.worldClock); }
        fixes = issues.filter(item => item.fixed).length;
        if (repair) {
            store.version = 18;
            composedCache.clear();
            if (currentPristine && $gameMap && currentPristine.mapId === $gameMap.mapId()) rebuildCurrentMap("repairStore");
            recordOperation("repairStore", { issues: issues.length, fixes });
        }
        return { version: VERSION, ok: issues.length === 0, repaired: repair, issueCount: issues.length, fixes, issues };
    }

    function previewPatchImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Patch pack exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`], maps: [], prefabConflicts: [] };
        }
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPatchPack" || (!pack.maps && !pack.mapOverrides)) {
            return { ok: false, errors: ["Not a HybridTileGraft patch pack."], maps: [], prefabConflicts: [] };
        }
        const store = ensureStore();
        const policy = String(options.conflictPolicy || (toBoolean(options.replace, false) ? "replace" : "merge")).toLowerCase();
        const ids = [...new Set([...Object.keys(pack.maps || {}), ...Object.keys(pack.mapOverrides || {})])]
            .filter(key => /^\d+$/.test(key));
        const errors = [];
        const maps = ids.map(key => {
            const incoming = Array.isArray((pack.maps || {})[key]) ? pack.maps[key] : [];
            const patchIssues = [];
            incoming.forEach((patch, index) => validatePatchRecord(patch, `maps.${key}[${index}]`, patchIssues, false));
            errors.push(...patchIssues.map(item => `${item.path}: ${item.message}`));
            const currentOverride = store.mapOverrides[key];
            const incomingOverride = pack.mapOverrides && pack.mapOverrides[key];
            return {
                mapId: Number(key),
                policy,
                skipped: policy === "skip" && ((store.maps[key] || []).length > 0 || !!currentOverride),
                existingPatches: (store.maps[key] || []).length,
                incomingPatches: incoming.length,
                estimatedTileWrites: incoming.reduce((sum, patch) => sum + patchWriteCount(patch), 0),
                checkpointConflicts: Object.keys(pack.checkpoints && pack.checkpoints[key] || {})
                    .filter(name => !!(store.checkpoints[key] || {})[name]),
                dimensionChange: incomingOverride ? {
                    from: currentOverride ? [currentOverride.width, currentOverride.height] : null,
                    to: [incomingOverride.width, incomingOverride.height]
                } : null
            };
        });
        const prefabConflicts = Object.entries(pack.prefabs || {}).filter(([key]) => !!store.prefabs[key]).map(([key, incoming]) => ({
            key,
            currentVersion: (store.prefabRevisions[key] || {}).revision || 1,
            incomingVersion: incoming.version || incoming.revision || (pack.prefabRevisions && pack.prefabRevisions[key] && pack.prefabRevisions[key].revision) || 1
        }));
        return { ok: errors.length === 0, formatVersion: pack.version || 1, policy, errors, maps, prefabConflicts };
    }

    function importPatchPack(value, options = {}) {
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        const preview = previewPatchImport(pack, options);
        if (toBoolean(options.dryRun, false)) return preview;
        if (!preview.ok || !pack) return false;
        const store = ensureStore();
        const policy = preview.policy;
        const affected = [];
        suppressAutomaticCheckpoint = true;
        try {
            for (const [key, patches] of Object.entries(pack.maps || {})) {
                if (!Array.isArray(patches) || !/^\d+$/.test(key)) continue;
                if (policy === "skip" && ((store.maps[key] || []).length || store.mapOverrides[key])) continue;
                if (options.checkpoint !== false && ((store.maps[key] || []).length || store.mapOverrides[key])) {
                    createCheckpoint(`[Import] ${new Date().toISOString()}`, Number(key));
                }
                store.maps[key] = policy === "replace" ? deepClone(patches) : (store.maps[key] || []).concat(deepClone(patches));
                if (pack.redo && pack.redo[key]) store.redo[key] = deepClone(pack.redo[key]);
                if (pack.eventStates && pack.eventStates[key]) {
                    store.eventStates[key] = Object.assign(store.eventStates[key] || {}, deepClone(pack.eventStates[key]));
                }
                if (pack.checkpoints && pack.checkpoints[key]) {
                    store.checkpoints[key] = Object.assign(store.checkpoints[key] || {}, deepClone(pack.checkpoints[key]));
                }
                affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            for (const [key, override] of Object.entries(pack.mapOverrides || {})) {
                if (!/^\d+$/.test(key)) continue;
                if (policy === "skip" && store.mapOverrides[key]) continue;
                if (policy === "replace" || !store.mapOverrides[key]) store.mapOverrides[key] = deepClone(override);
                else if (policy === "merge") store.mapOverrides[key] = deepClone(override);
                if (!affected.includes(Number(key))) affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            for (const key of [...new Set([
                ...Object.keys(pack.authoringLayers || {}), ...Object.keys(pack.masks || {}),
                ...Object.keys(pack.modifiers || {}), ...Object.keys(pack.prefabInstances || {})
            ])]) {
                if (!/^\d+$/.test(key)) continue;
                if (pack.authoringLayers && pack.authoringLayers[key]) {
                    if (policy === "replace") store.authoringLayers[key] = deepClone(pack.authoringLayers[key]);
                    else {
                        const byId = new Map((store.authoringLayers[key] || []).map(item => [item.id, item]));
                        for (const item of pack.authoringLayers[key]) if (!byId.has(item.id)) byId.set(item.id, deepClone(item));
                        store.authoringLayers[key] = Array.from(byId.values());
                    }
                }
                if (pack.activeAuthoringLayers && pack.activeAuthoringLayers[key]) store.activeAuthoringLayers[key] = pack.activeAuthoringLayers[key];
                if (pack.masks && pack.masks[key]) store.masks[key] = policy === "replace"
                    ? deepClone(pack.masks[key]) : Object.assign(store.masks[key] || {}, deepClone(pack.masks[key]));
                for (const field of ["modifiers", "prefabInstances"]) if (pack[field] && pack[field][key]) {
                    if (policy === "replace") store[field][key] = deepClone(pack[field][key]);
                    else {
                        const byId = new Map((store[field][key] || []).map(item => [item.id, item]));
                        for (const item of pack[field][key]) if (!byId.has(item.id)) byId.set(item.id, deepClone(item));
                        store[field][key] = Array.from(byId.values());
                    }
                }
                if (!affected.includes(Number(key))) affected.push(Number(key));
                composedCache.delete(Number(key));
            }
            if (pack.prefabs) Object.assign(store.prefabs, deepClone(pack.prefabs));
            if (pack.prefabPayloads) Object.assign(store.prefabPayloads, deepClone(pack.prefabPayloads));
            if (pack.prefabRevisions) Object.assign(store.prefabRevisions, deepClone(pack.prefabRevisions));
            if (pack.eventTemplates) Object.assign(store.eventTemplates, deepClone(pack.eventTemplates));
            if (pack.brushPresets) Object.assign(store.brushPresets, deepClone(pack.brushPresets));
            if (pack.changeSets) Object.assign(store.changeSets, deepClone(pack.changeSets));
            if (pack.editorPreferences && toBoolean(options.importEditorPreferences, false)) {
                store.editorPreferences = Object.assign(store.editorPreferences, deepClone(pack.editorPreferences));
            }
        } finally {
            suppressAutomaticCheckpoint = false;
        }
        store.importHistory.unshift({ timestamp: Date.now(), affected: affected.slice(), policy, pluginVersion: pack.pluginVersion || "unknown" });
        store.importHistory = store.importHistory.slice(0, 50);
        if (affected.includes($gameMap.mapId())) rebuildCurrentMap("importPatchPack");
        recordOperation("importPatchPack", { affected, policy });
        return affected;
    }

    function diffMap(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        return Promise.all([loadPristineMapData(id), preloadMap(id)]).then(([pristine, composed]) => {
            const layers = {};
            const cells = [];
            for (const key of Object.keys(LAYER_INDEX)) layers[key] = 0;
            const width = Math.max(pristine.width, composed.width);
            const height = Math.max(pristine.height, composed.height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const changedLayers = [];
                    for (const [key, z] of Object.entries(LAYER_INDEX)) {
                        const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                        const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                        if (before !== after) {
                            layers[key]++;
                            changedLayers.push({ layer: key, before, after });
                        }
                    }
                    if (changedLayers.length) cells.push({ x, y, changes: changedLayers });
                }
            }
            const baseHybridIds = new Set((pristine.events || []).filter(isHybridEventData).map(event => event.id));
            const currentHybrid = (composed.events || []).filter(isHybridEventData);
            return {
                format: "HybridTileGraftChangeReport",
                version: VERSION,
                mapId: id,
                width: composed.width,
                height: composed.height,
                originalWidth: pristine.width,
                originalHeight: pristine.height,
                dimensionsChanged: pristine.width !== composed.width || pristine.height !== composed.height,
                changedCells: cells.length,
                layerChanges: layers,
                addedSpawnedEvents: currentHybrid.filter(event => !baseHybridIds.has(event.id)).map(event => ({
                    id: event.id, name: event.name, x: event.x, y: event.y
                })),
                removedSpawnedEventIds: Array.from(baseHybridIds).filter(eventId => !currentHybrid.some(event => event.id === eventId)),
                patchCount: getPatches(id).length,
                cells
            };
        });
    }

    async function createChangeSet(name, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const [pristine, composed] = await Promise.all([loadPristineMapData(id), preloadMap(id)]);
        const rect = options.rect ? normalizeRect(options.rect.x, options.rect.y,
            options.rect.w || options.rect.width, options.rect.h || options.rect.height)
            : normalizeRect(0, 0, Math.max(pristine.width, composed.width), Math.max(pristine.height, composed.height));
        const layers = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6").layers;
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            const changes = {};
            for (const layer of layers) {
                const z = LAYER_INDEX[layer];
                const before = readTile(pristine.data, pristine.width, pristine.height, x, y, z);
                const after = readTile(composed.data, composed.width, composed.height, x, y, z);
                if (before !== after) changes[layer] = { before, after };
            }
            if (Object.keys(changes).length) cells.push({ x, y, changes });
        }
        const baseEvents = new Map((pristine.events || []).filter(Boolean).map(event => [event.id, event]));
        const currentEvents = new Map((composed.events || []).filter(Boolean).map(event => [event.id, event]));
        const eventIds = new Set([...baseEvents.keys(), ...currentEvents.keys()]);
        const events = [];
        for (const eventId of eventIds) {
            const before = baseEvents.get(eventId) || null;
            const after = currentEvents.get(eventId) || null;
            if (JSON.stringify(before) !== JSON.stringify(after)) events.push({ eventId, before: deepClone(before), after: deepClone(after) });
        }
        const changeSet = {
            format: "HybridTileGraftChangeSet",
            version: 1,
            id: String(options.id || `changeset-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(name || `Map ${id} Changes`),
            mapId: id,
            createdAt: Date.now(),
            pluginVersion: VERSION,
            rect,
            layers,
            cells,
            events,
            dimensions: {
                before: [pristine.width, pristine.height],
                after: [composed.width, composed.height]
            },
            author: String(options.author || ""),
            description: String(options.description || ""),
            tags: normalizeList(options.tags).map(String),
            sourceOperationRange: deepClone(options.sourceOperationRange || null)
        };
        ensureStore().changeSets[changeSet.id] = changeSet;
        recordOperation("createChangeSet", { mapId: id, changeSetId: changeSet.id, cells: cells.length, events: events.length });
        return deepClone(changeSet);
    }

    function listChangeSets(mapId = 0) {
        const id = integer(mapId, 0);
        return Object.values(ensureStore().changeSets || {}).filter(item => !id || item.mapId === id)
            .sort((a, b) => b.createdAt - a.createdAt).map(item => Object.assign(deepClone(item), {
                cellCount: (item.cells || []).length,
                eventCount: (item.events || []).length
            }));
    }

    function exportChangeSet(changeSetId) {
        const item = ensureStore().changeSets[String(changeSetId)];
        return item ? deepClone(item) : false;
    }

    function importChangeSet(value) {
        const item = typeof value === "string" ? parseJson(value, null) : value;
        if (!item || item.format !== "HybridTileGraftChangeSet" || !Array.isArray(item.cells)) return false;
        const clone = deepClone(item);
        clone.id = String(clone.id || `changeset-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
        ensureStore().changeSets[clone.id] = clone;
        return deepClone(clone);
    }

    function deleteChangeSet(changeSetId) {
        const key = String(changeSetId);
        if (!ensureStore().changeSets[key]) return false;
        delete ensureStore().changeSets[key];
        return true;
    }

    async function applyChangeSet(changeSetOrId, targetMapId = 0, options = {}) {
        const changeSet = typeof changeSetOrId === "object" ? changeSetOrId : ensureStore().changeSets[String(changeSetOrId)];
        if (!changeSet) return false;
        const mapId = integer(targetMapId, 0) || changeSet.mapId || $gameMap.mapId();
        await preloadMap(mapId);
        const selectedCells = options.cellIndices ? new Set(normalizeList(options.cellIndices).map(Number)) : null;
        const direction = String(options.direction || "after").toLowerCase();
        const cells = [];
        for (let index = 0; index < (changeSet.cells || []).length; index++) {
            if (selectedCells && !selectedCells.has(index)) continue;
            const source = changeSet.cells[index];
            const tiles = {};
            for (const [layer, values] of Object.entries(source.changes || {})) tiles[layer] = direction === "before" ? values.before : values.after;
            if (Object.keys(tiles).length) cells.push({ x: source.x + integer(options.offsetX), y: source.y + integer(options.offsetY), tiles });
        }
        const eventChanges = options.includeEvents === false ? [] : changeSet.events || [];
        const events = [];
        const removeEventIds = [];
        for (const change of eventChanges) {
            const event = deepClone(direction === "before" ? change.before : change.after);
            if (event) {
                event.x += integer(options.offsetX);
                event.y += integer(options.offsetY);
                events.push(event);
            } else removeEventIds.push(change.eventId);
        }
        const tilePatch = cells.length ? makeSparsePatch(cells, options.mode || "exact", options.mode === "autotile" ? cells : null) : null;
        const eventPatch = eventChanges.length ? makeEventPatch(events, removeEventIds, `Change Set: ${changeSet.name}`) : null;
        const patch = tilePatch && eventPatch ? makeBatchPatch([tilePatch, eventPatch], `Change Set: ${changeSet.name}`) : tilePatch || eventPatch;
        if (!patch) return false;
        patch.changeSetId = changeSet.id;
        return applyPatchToMap(mapId, patch, "applyChangeSet");
    }

    function threeWayMergeSnapshots(base, ours, theirs, options = {}) {
        if (!base || !ours || !theirs) return { ok: false, errors: ["Three snapshots are required."], conflicts: [] };
        const width = Math.max(base.width, ours.width, theirs.width);
        const height = Math.max(base.height, ours.height, theirs.height);
        const merged = {
            width,
            height,
            tilesetId: options.tilesetId || ours.tilesetId || theirs.tilesetId || base.tilesetId,
            note: options.note === undefined ? ours.note || theirs.note || base.note || "" : String(options.note),
            data: new Array(width * height * 6).fill(0),
            events: []
        };
        const conflicts = [];
        const resolution = String(options.resolution || "ours").toLowerCase();
        for (let z = 0; z < 6; z++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const baseValue = readTile(base.data, base.width, base.height, x, y, z);
            const ourValue = readTile(ours.data, ours.width, ours.height, x, y, z);
            const theirValue = readTile(theirs.data, theirs.width, theirs.height, x, y, z);
            let value;
            if (ourValue === theirValue) value = ourValue;
            else if (ourValue === baseValue) value = theirValue;
            else if (theirValue === baseValue) value = ourValue;
            else {
                conflicts.push({ type: "tile", x, y, layer: `L${z + 1}`, base: baseValue, ours: ourValue, theirs: theirValue });
                value = resolution === "theirs" ? theirValue : resolution === "base" ? baseValue : ourValue;
            }
            writeTile(merged.data, width, height, x, y, z, value);
        }
        const eventMaps = [base, ours, theirs].map(snapshot => new Map((snapshot.events || []).filter(Boolean).map(event => [event.id, event])));
        const ids = new Set([...eventMaps[0].keys(), ...eventMaps[1].keys(), ...eventMaps[2].keys()]);
        for (const id of ids) {
            const [baseEvent, ourEvent, theirEvent] = eventMaps.map(map => map.get(id) || null);
            const [baseJson, ourJson, theirJson] = [baseEvent, ourEvent, theirEvent].map(value => JSON.stringify(value));
            let event;
            if (ourJson === theirJson) event = ourEvent;
            else if (ourJson === baseJson) event = theirEvent;
            else if (theirJson === baseJson) event = ourEvent;
            else {
                conflicts.push({ type: "event", eventId: id, base: deepClone(baseEvent), ours: deepClone(ourEvent), theirs: deepClone(theirEvent) });
                event = resolution === "theirs" ? theirEvent : resolution === "base" ? baseEvent : ourEvent;
            }
            if (event) merged.events[event.id] = deepClone(event);
        }
        return { ok: true, merged, conflicts, conflictCount: conflicts.length, resolution };
    }

    function resolveMergeConflicts(mergeResult, resolutions = {}) {
        if (!mergeResult || !mergeResult.merged) return false;
        const output = deepClone(mergeResult);
        for (let index = 0; index < (output.conflicts || []).length; index++) {
            const conflict = output.conflicts[index];
            const choice = resolutions[index] || resolutions[`${conflict.type}:${conflict.x ?? conflict.eventId}:${conflict.y ?? ""}:${conflict.layer || ""}`];
            if (!choice) continue;
            const value = conflict[choice];
            if (conflict.type === "tile") writeTile(output.merged.data, output.merged.width, output.merged.height,
                conflict.x, conflict.y, LAYER_INDEX[conflict.layer], value);
            else if (conflict.type === "event") {
                if (value) output.merged.events[conflict.eventId] = deepClone(value);
                else output.merged.events[conflict.eventId] = null;
            }
            conflict.resolved = choice;
        }
        output.unresolvedConflicts = output.conflicts.filter(conflict => !conflict.resolved).length;
        return output;
    }

    function applyMergeResult(mapId, mergeResult, options = {}) {
        if (!mergeResult || !mergeResult.merged) return false;
        const id = integer(mapId);
        const snapshot = deepClone(mergeResult.merged);
        snapshot._hybridTransform = { createdAt: Date.now(), sourceWidth: snapshot.width,
            sourceHeight: snapshot.height, configuration: { merge: true } };
        const result = saveMapOverride(id, snapshot, Object.assign({ checkpointName: `[Merge] ${new Date().toISOString()}` }, options));
        ensureStore().mergeHistory.unshift({ mapId: id, timestamp: Date.now(), conflicts: mergeResult.conflictCount || 0,
            unresolved: mergeResult.unresolvedConflicts || 0, resolution: mergeResult.resolution || "mixed" });
        ensureStore().mergeHistory = ensureStore().mergeHistory.slice(0, 100);
        return result;
    }

    async function searchProject(options = {}) {
        const mapIds = normalizeList(options.mapIds).map(Number).filter(Boolean);
        const ids = mapIds.length ? mapIds : (typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos.filter(Boolean).map(info => info.id) : [$gameMap.mapId()]);
        const tileIds = new Set(normalizeList(options.tileIds).map(parseTileId).filter(value => value !== null));
        const query = String(options.query || "").toLowerCase();
        const commandCodes = new Set(normalizeList(options.commandCodes).map(Number));
        const switchIds = new Set(normalizeList(options.switchIds).map(Number));
        const variableIds = new Set(normalizeList(options.variableIds).map(Number));
        const results = [];
        for (const mapId of ids) {
            const map = await preloadMap(mapId);
            const info = typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos[mapId] : null;
            const mapResult = { mapId, name: info ? info.name || `Map ${mapId}` : `Map ${mapId}`, tiles: [], events: [] };
            if (tileIds.size) for (let z = 0; z < 6; z++) for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
                const tileId = readTile(map.data, map.width, map.height, x, y, z);
                if (tileIds.has(tileId)) mapResult.tiles.push({ x, y, layer: `L${z + 1}`, tileId });
            }
            for (const event of map.events || []) {
                if (!event) continue;
                const text = `${event.name || ""}\n${event.note || ""}\n${JSON.stringify(event.pages || [])}`.toLowerCase();
                const commands = (event.pages || []).flatMap(page => page.list || []);
                const commandMatch = commandCodes.size && commands.some(command => commandCodes.has(command.code));
                const switchMatch = switchIds.size && commands.some(command => JSON.stringify(command.parameters || []).match(/\d+/g)?.some(value => switchIds.has(Number(value))));
                const variableMatch = variableIds.size && commands.some(command => [111, 122].includes(command.code) && JSON.stringify(command.parameters || []).match(/\d+/g)?.some(value => variableIds.has(Number(value))));
                if ((query && text.includes(query)) || commandMatch || switchMatch || variableMatch) {
                    mapResult.events.push({ id: event.id, name: event.name || "", x: event.x, y: event.y,
                        spawned: isHybridEventData(event), commandCodes: [...new Set(commands.map(command => command.code))] });
                }
            }
            if (mapResult.tiles.length || mapResult.events.length) results.push(mapResult);
        }
        return { query: deepClone(options), mapCount: ids.length, matchedMaps: results.length,
            tileMatches: results.reduce((sum, item) => sum + item.tiles.length, 0),
            eventMatches: results.reduce((sum, item) => sum + item.events.length, 0), results };
    }

    async function replaceProjectTiles(replacements, options = {}) {
        const mapping = new Map(Object.entries(replacements || {}).map(([from, to]) => [parseTileId(from), parseTileId(to)]).filter(([from, to]) => from !== null && to !== null));
        if (!mapping.size) return { ok: false, maps: [], writes: 0 };
        const ids = normalizeList(options.mapIds).map(Number).filter(Boolean);
        const mapIds = ids.length ? ids : $dataMapInfos.filter(Boolean).map(info => info.id);
        const results = [];
        let writes = 0;
        for (const mapId of mapIds) {
            const map = await preloadMap(mapId);
            const cells = [];
            for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
                const tiles = {};
                for (let z = 0; z < 4; z++) {
                    const current = readTile(map.data, map.width, map.height, x, y, z);
                    if (mapping.has(current)) tiles[`L${z + 1}`] = mapping.get(current);
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
            if (!cells.length) continue;
            const patch = makeSparsePatch(cells, options.mode || "autotile", options.mode === "exact" ? null : cells);
            patch.label = String(options.label || "Project Tile Replacement");
            applyPatchToMap(mapId, patch, "replaceProjectTiles");
            writes += patchWriteCount(patch);
            results.push({ mapId, writes: patchWriteCount(patch) });
        }
        return { ok: true, maps: results, writes };
    }

    function validateMapSnapshot(snapshot, mapId = 0) {
        const issues = [];
        if (!snapshot || !positiveInteger(snapshot.width, 0) || !positiveInteger(snapshot.height, 0)) issues.push("Invalid dimensions.");
        const expected = snapshot ? integer(snapshot.width) * integer(snapshot.height) * 6 : 0;
        if (!snapshot || !Array.isArray(snapshot.data) || snapshot.data.length !== expected) issues.push(`Tile data length must be ${expected}.`);
        const ids = new Set();
        for (const event of snapshot && snapshot.events || []) if (event) {
            if (ids.has(event.id)) issues.push(`Duplicate event ID ${event.id}.`);
            ids.add(event.id);
            if (!inBounds(event.x, event.y, snapshot.width, snapshot.height)) issues.push(`Event ${event.id} is outside map bounds.`);
            if (!Array.isArray(event.pages)) issues.push(`Event ${event.id} has no page array.`);
        }
        return { ok: issues.length === 0, mapId: integer(mapId), width: snapshot && snapshot.width,
            height: snapshot && snapshot.height, eventCount: ids.size, issues };
    }

    async function validateProjectMaps(mapIds = null, options = {}) {
        const ids = mapIds ? normalizeList(mapIds).map(Number).filter(Boolean)
            : $dataMapInfos.filter(Boolean).map(info => info.id);
        const reports = [];
        for (const mapId of ids) {
            try { reports.push(validateMapSnapshot(await preloadMap(mapId, options.forceRefresh), mapId)); }
            catch (error) { reports.push({ ok: false, mapId, issues: [error.message] }); }
        }
        return { ok: reports.every(report => report.ok), checked: reports.length,
            issueCount: reports.reduce((sum, report) => sum + report.issues.length, 0), reports };
    }

    function createProjectSnapshot(name, options = {}) {
        const snapshot = {
            id: String(options.id || `snapshot-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(name || "Project Snapshot"),
            createdAt: Date.now(),
            bundle: exportWorkspaceBundle(options)
        };
        const size = JSON.stringify(snapshot.bundle).length * 2;
        if (size > MAX_IMPORT_BYTES) return false;
        ensureStore().projectSnapshots.unshift(snapshot);
        ensureStore().projectSnapshots = ensureStore().projectSnapshots.slice(0, Math.max(1, integer(options.retain, 5)));
        return { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, estimatedBytes: size };
    }

    function listProjectSnapshots() {
        return (ensureStore().projectSnapshots || []).map(snapshot => ({ id: snapshot.id, name: snapshot.name,
            createdAt: snapshot.createdAt, estimatedBytes: JSON.stringify(snapshot.bundle || {}).length * 2 }));
    }

    function restoreProjectSnapshot(snapshotId, options = {}) {
        const snapshot = (ensureStore().projectSnapshots || []).find(item => item.id === String(snapshotId));
        return snapshot ? importWorkspaceBundle(snapshot.bundle, Object.assign({ conflictPolicy: "replace", checkpoint: true }, options)) : false;
    }

    function deleteProjectSnapshot(snapshotId) {
        const store = ensureStore();
        const before = store.projectSnapshots.length;
        store.projectSnapshots = store.projectSnapshots.filter(item => item.id !== String(snapshotId));
        return store.projectSnapshots.length !== before;
    }

    function projectAuditReport() {
        const store = ensureStore();
        return {
            pluginVersion: VERSION,
            generatedAt: new Date().toISOString(),
            validation: validateStore({ repair: false }),
            operations: operationLog(OPERATION_LOG_LIMIT),
            imports: deepClone(store.importHistory || []),
            merges: deepClone(store.mergeHistory || []),
            errors: errorReports(ERROR_REPORT_LIMIT),
            authoringLayers: deepClone(store.authoringLayers || {}),
            modifiers: deepClone(store.modifiers || {}),
            prefabInstances: deepClone(store.prefabInstances || {}),
            changeSets: Object.values(store.changeSets || {}).map(item => ({ id: item.id, name: item.name, mapId: item.mapId,
                createdAt: item.createdAt, cells: (item.cells || []).length, events: (item.events || []).length }))
        };
    }

    function fuzzValidate(iterations = 250, seed = "HybridTileGraft", options = {}) {
        const random = seededRandom(seed);
        const failures = [];
        const count = Math.max(1, Math.min(10000, integer(iterations, 250)));
        for (let index = 0; index < count; index++) {
            const width = 1 + Math.floor(random() * 20);
            const height = 1 + Math.floor(random() * 20);
            const kind = Math.floor(random() * 4);
            let patch;
            if (kind === 0) patch = makeSparsePatch([{ x: Math.floor(random() * width), y: Math.floor(random() * height),
                tiles: { L1: Math.floor(random() * 8192) } }], "exact");
            else if (kind === 1) patch = makeRectPatch({ x: 0, y: 0, w: width, h: height }, ["L1"],
                { L1: new Array(width * height).fill(Math.floor(random() * 8192)) }, "exact");
            else if (kind === 2) patch = { kind: "rect", x: 0, y: 0, w: width, h: height, layers: ["L1"], tiles: { L1: [] } };
            else patch = { kind: "unknown", value: random() };
            const issues = [];
            try { validatePatchRecord(deepClone(patch), `fuzz[${index}]`, issues, toBoolean(options.repair, false)); }
            catch (error) { failures.push({ index, message: error.message, patch }); }
        }
        const result = { ok: failures.length === 0, iterations: count, seed, failures };
        recordOperation("fuzzValidate", { iterations: count, failures: failures.length });
        return result;
    }

    function estimateStoreBytes() {
        const store = ensureStore();
        const text = JSON.stringify(store);
        return {
            estimatedBytes: text.length * 2,
            maps: Object.fromEntries(Object.entries(store.maps || {}).map(([key, patches]) =>
                [key, JSON.stringify(patches).length * 2])),
            snapshots: JSON.stringify(store.projectSnapshots || []).length * 2,
            operationLog: JSON.stringify(store.operationLog || []).length * 2,
            errors: JSON.stringify(store.errorReports || []).length * 2
        };
    }

    function pruneProjectData(options = {}) {
        const store = ensureStore();
        const before = estimateStoreBytes();
        store.operationLog = (store.operationLog || []).slice(-Math.max(20,
            integer(options.operationLimit ?? options.operationLog, OPERATION_LOG_LIMIT)));
        store.errorReports = (store.errorReports || []).slice(0, Math.max(10,
            integer(options.errorLimit ?? options.errors, ERROR_REPORT_LIMIT)));
        store.importHistory = (store.importHistory || []).slice(0, Math.max(5,
            integer(options.importLimit ?? options.imports, 50)));
        store.mergeHistory = (store.mergeHistory || []).slice(0, Math.max(5,
            integer(options.mergeLimit ?? options.merges, 50)));
        store.projectSnapshots = (store.projectSnapshots || []).slice(0, Math.max(0,
            integer(options.snapshotLimit ?? options.snapshots, 5)));
        for (const [key, bucket] of Object.entries(store.checkpoints || {})) {
            const automatic = Object.values(bucket).filter(item => item.automatic).sort((a, b) => b.createdAt - a.createdAt);
            for (const item of automatic.slice(Math.max(1, integer(options.autoCheckpointLimit, MAX_AUTO_CHECKPOINTS)))) delete store.checkpoints[key][item.name];
        }
        const after = estimateStoreBytes();
        return { before, after, freedBytes: Math.max(0, before.estimatedBytes - after.estimatedBytes) };
    }

    function runCompatibilitySelfTest(options = {}) {
        const store = ensureStore();
        const results = {};
        for (const profile of listAdapterProfiles()) {
            const paths = [];
            for (const path of profile.paths || []) {
                const target = resolveGlobalPath(path);
                if (!target) continue;
                paths.push({ path, methods: (profile.methods || []).filter(method => typeof target[method] === "function") });
            }
            results[profile.name] = { detected: paths.length > 0, active: profile.active, paths,
                ready: paths.some(item => item.methods.length > 0) };
        }
        const report = { timestamp: Date.now(), pluginVersion: VERSION, profiles: results,
            customAdapters: Array.from(compatibilityAdapters.keys()), executeRefresh: toBoolean(options.executeRefresh, false) };
        if (report.executeRefresh) runCompatibilityRefresh({ operation: "compatibilitySelfTest", mapId: $gameMap.mapId() });
        store.adapterTestResults = report;
        return deepClone(report);
    }

    function systemHealthReport() {
        const storeValidation = validateStore({ repair: false });
        const currentMap = typeof $dataMap !== "undefined" && $dataMap ? validateMapSnapshot($dataMap, $gameMap.mapId()) : null;
        const memory = estimateStoreBytes();
        const jobs = listOperationJobs({ includeFinished: false });
        const errors = errorReports(20);
        const warnings = [];
        if (!storeValidation.ok) warnings.push(`${storeValidation.issueCount} store issue(s).`);
        if (currentMap && !currentMap.ok) warnings.push(`${currentMap.issues.length} current-map issue(s).`);
        if (memory.estimatedBytes > 25 * 1024 * 1024) warnings.push("Save data is larger than 25 MiB.");
        if (errors.length) warnings.push(`${errors.length} recent captured error(s).`);
        return {
            ok: warnings.length === 0,
            pluginVersion: VERSION,
            generatedAt: new Date().toISOString(),
            warnings,
            storeValidation,
            currentMap,
            memory,
            jobs,
            errors,
            compatibility: compatibilityDiagnostics(),
            performance: performanceDiagnostics(),
            worldRecipes: worldRecipeDiagnostics({ logLimit: 10 }),
            worldstudio: {
                atlases: listWorldAtlases().slice(0, 5),
                eventQuestGraphs: listEventQuestGraphs().slice(0, 5),
                extensions: listExtensionManifests(),
                validations: listProductionValidations().slice(0, 5),
                deployments: listProjectDeploymentReports().slice(0, 5)
            },
            bridge: workspaceBridgeState()
        };
    }

    function downloadJson(filename, value) {
        const text = JSON.stringify(value, null, 2);
        if (typeof document !== "undefined" && typeof document.createElement === "function" &&
            typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            const blob = new Blob([text], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = String(filename || "HybridTileGraft.json");
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return true;
        }
        return false;
    }

    function exportWorkspaceBundle(options = {}) {
        const mapIds = Array.isArray(options.mapIds) ? options.mapIds : null;
        const store = ensureStore();
        return {
            format: "HybridTileGraftWorkspace",
            version: 1,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            project: {
                title: typeof $dataSystem !== "undefined" && $dataSystem ? $dataSystem.gameTitle || "" : "",
                maps: (typeof $dataMapInfos !== "undefined" && $dataMapInfos ? $dataMapInfos : [])
                    .filter(Boolean).map(info => ({ id: info.id, name: info.name, parentId: info.parentId || 0 }))
            },
            patchPack: exportPatchPack(mapIds),
            prefabPack: exportPrefabPack(options.prefabNames || null),
            eventTemplatePack: exportEventTemplatePack(options.eventTemplateNames || null),
            worldRecipePack: exportWorldRecipePack(options.worldRecipeIds || null),
            worldDirector: {
                clock: worldClock(), facts: deepClone(store.worldFacts || {}), zones: listWorldZones(),
                entities: listWorldEntities(), resources: listWorldResources(), schedules: listWorldSchedules(),
                variants: listWorldMapVariants(), packs: listWorldPacks(), packLock: worldPackLockfile(),
                npcs: listWorldNpcs(), npcRoutes: listWorldNpcRoutes(), ruleLayers: listWorldRuleLayers(), ruleBrushes: listWorldRuleBrushes(), biomeGraphs: listBiomeGraphs(),
                atlases: Object.values(store.worldAtlases || {}).map(deepClone), eventQuestGraphs: Object.values(store.eventQuestGraphs || {}).map(deepClone),
                extensions: listExtensionManifests(), packRepositories: listPackRepositories(), visualHistory: listVisualHistory(),
                validationRuns: listProductionValidations(), deploymentReports: listProjectDeploymentReports(), runtimeBudget: runtimeBudget(), tests: deepClone(store.worldRecipeTests || [])
            },
            bookmarks: deepClone(store.mapBookmarks || []),
            adapterProfiles: deepClone(store.activeAdapterProfiles || []),
            diagnostics: {
                validation: validateStore({ repair: false }),
                performance: performanceDiagnostics(),
                compatibility: compatibilityDiagnostics()
            }
        };
    }

    function previewWorkspaceImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Workspace exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`] };
        }
        const bundle = typeof value === "string" ? parseJson(value, null) : value;
        if (!bundle || bundle.format !== "HybridTileGraftWorkspace" || !bundle.patchPack) {
            return { ok: false, errors: ["Not a HybridTileGraft workspace bundle."] };
        }
        const patchPreview = previewPatchImport(bundle.patchPack, Object.assign({}, options, { dryRun: true }));
        const prefabPreview = bundle.prefabPack ? previewPrefabImport(bundle.prefabPack, options) : { ok: true, entries: [] };
        return {
            ok: patchPreview.ok && prefabPreview.ok,
            pluginVersion: bundle.pluginVersion || "unknown",
            patchPreview,
            prefabPreview,
            eventTemplates: Object.keys(bundle.eventTemplatePack && bundle.eventTemplatePack.templates || {}).length,
            worldRecipes: bundle.worldRecipePack?.recipes?.length || 0,
            worldZones: bundle.worldDirector?.zones?.length || 0,
            worldResources: bundle.worldDirector?.resources?.length || 0,
            worldNpcs: bundle.worldDirector?.npcs?.length || 0,
            worldRuleLayers: bundle.worldDirector?.ruleLayers?.length || 0,
            biomeGraphs: bundle.worldDirector?.biomeGraphs?.length || 0,
            bookmarks: Array.isArray(bundle.bookmarks) ? bundle.bookmarks.length : 0
        };
    }

    function importWorkspaceBundle(value, options = {}) {
        const bundle = typeof value === "string" ? parseJson(value, null) : value;
        const preview = previewWorkspaceImport(bundle, options);
        if (toBoolean(options.dryRun, false)) return preview;
        if (!preview.ok || !bundle) return false;
        const affectedMaps = importPatchPack(bundle.patchPack, options);
        const importedPrefabs = bundle.prefabPack ? importPrefabPack(bundle.prefabPack, options) : [];
        const importedTemplates = bundle.eventTemplatePack ? importEventTemplatePack(bundle.eventTemplatePack, options) : [];
        const importedWorldRecipes = bundle.worldRecipePack ? importWorldRecipePack(bundle.worldRecipePack, options) : { imported: 0 };
        if (bundle.worldDirector) {
            if (bundle.worldDirector.clock) setWorldClock(bundle.worldDirector.clock);
            for (const zone of normalizeList(bundle.worldDirector.zones)) defineWorldZone(zone);
            for (const entity of normalizeList(bundle.worldDirector.entities)) defineWorldEntity(entity);
            for (const resource of normalizeList(bundle.worldDirector.resources)) defineWorldResource(resource);
            for (const variant of normalizeList(bundle.worldDirector.variants)) defineWorldMapVariant(variant);
            for (const npc of normalizeList(bundle.worldDirector.npcs)) defineWorldNpc(npc);
            for (const route of normalizeList(bundle.worldDirector.npcRoutes)) defineWorldNpcRoute(route);
            for (const layer of normalizeList(bundle.worldDirector.ruleLayers)) defineWorldRuleLayer(layer);
            for (const brush of normalizeList(bundle.worldDirector.ruleBrushes)) saveWorldRuleBrush(brush);
            for (const graph of normalizeList(bundle.worldDirector.biomeGraphs)) defineBiomeGraph(graph);
            for (const atlas of normalizeList(bundle.worldDirector.atlases)) if (atlas?.id) ensureStore().worldAtlases[String(atlas.id)] = deepClone(atlas);
            for (const graph of normalizeList(bundle.worldDirector.eventQuestGraphs)) if (graph?.id) ensureStore().eventQuestGraphs[String(graph.id)] = deepClone(graph);
            for (const manifest of normalizeList(bundle.worldDirector.extensions)) installExtensionManifest(manifest, { enabled: manifest.enabled !== false, permissions: manifest.grantedPermissions || [] });
            for (const repository of normalizeList(bundle.worldDirector.packRepositories)) registerPackRepository(repository);
            if (bundle.worldDirector.runtimeBudget) runtimeBudget(bundle.worldDirector.runtimeBudget);
            if (bundle.worldDirector.packLock && toBoolean(options.importPackLock, false)) ensureStore().worldPackLock = deepClone(bundle.worldDirector.packLock);
            if (Array.isArray(bundle.worldDirector.tests)) ensureStore().worldRecipeTests = deepClone(bundle.worldDirector.tests);
            if (toBoolean(options.importWorldFacts, false)) ensureStore().worldFacts = deepClone(bundle.worldDirector.facts || {});
        }
        if (toBoolean(options.importBookmarks, true) && Array.isArray(bundle.bookmarks)) {
            const existing = new Set((ensureStore().mapBookmarks || []).map(item => `${item.mapId}:${item.x}:${item.y}:${item.name}`));
            for (const bookmark of bundle.bookmarks) {
                const key = `${integer(bookmark.mapId)}:${integer(bookmark.x)}:${integer(bookmark.y)}:${String(bookmark.name || "Bookmark")}`;
                if (!existing.has(key)) ensureStore().mapBookmarks.push(deepClone(bookmark));
            }
        }
        if (toBoolean(options.importAdapterProfiles, false) && Array.isArray(bundle.adapterProfiles)) {
            ensureStore().activeAdapterProfiles = bundle.adapterProfiles.filter(name => adapterProfiles.has(String(name)));
        }
        const result = { affectedMaps, importedPrefabs, importedTemplates, importedWorldRecipes: importedWorldRecipes.imported || 0 };
        recordOperation("importWorkspace", result);
        return result;
    }

    function workspaceBridgeState() {
        if (!workspaceBridge) return { active: false };
        return {
            active: true,
            directory: workspaceBridge.directory,
            outgoingFile: workspaceBridge.outgoingFile,
            incomingFile: workspaceBridge.incomingFile,
            intervalMs: workspaceBridge.intervalMs,
            lastExportAt: workspaceBridge.lastExportAt || 0,
            lastImportAt: workspaceBridge.lastImportAt || 0,
            lastError: workspaceBridge.lastError || ""
        };
    }

    function writeWorkspaceBridgeSnapshot() {
        if (!workspaceBridge) return false;
        try {
            const fs = workspaceBridge.fs;
            const temporary = `${workspaceBridge.outgoingFile}.tmp`;
            fs.writeFileSync(temporary, JSON.stringify(exportWorkspaceBundle(), null, 2), "utf8");
            fs.renameSync(temporary, workspaceBridge.outgoingFile);
            workspaceBridge.lastExportAt = Date.now();
            workspaceBridge.lastError = "";
            return true;
        } catch (error) {
            workspaceBridge.lastError = String(error && error.message || error);
            return false;
        }
    }

    function pollWorkspaceBridge() {
        if (!workspaceBridge) return false;
        try {
            const fs = workspaceBridge.fs;
            if (!fs.existsSync(workspaceBridge.incomingFile)) return false;
            const stat = fs.statSync(workspaceBridge.incomingFile);
            if (!stat.isFile() || stat.size <= 0 || stat.size > 20 * 1024 * 1024 || stat.mtimeMs <= workspaceBridge.lastIncomingMtime) return false;
            const text = fs.readFileSync(workspaceBridge.incomingFile, "utf8");
            const value = parseJson(text, null);
            const imported = value && value.format === "HybridTileGraftWorkspace"
                ? importWorkspaceBundle(value, workspaceBridge.importOptions)
                : value && value.format === "HybridWorldRecipes"
                    ? (loadWorldRecipeCatalog(value), true)
                    : value && value.format === "HybridWorldPack"
                        ? installWorldPack(value, workspaceBridge.importOptions)
                        : importPatchPack(value, workspaceBridge.importOptions);
            if (!imported) throw new Error("Incoming bridge file did not pass validation.");
            workspaceBridge.lastIncomingMtime = stat.mtimeMs;
            workspaceBridge.lastImportAt = Date.now();
            workspaceBridge.lastError = "";
            writeWorkspaceBridgeSnapshot();
            return true;
        } catch (error) {
            if (workspaceBridge) workspaceBridge.lastError = String(error && error.message || error);
            return false;
        }
    }

    function startWorkspaceBridge(directory, options = {}) {
        stopWorkspaceBridge();
        if (typeof require !== "function") return false;
        try {
            const fs = require("fs");
            const path = require("path");
            const target = path.resolve(String(directory || "."));
            if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
            if (!fs.statSync(target).isDirectory()) return false;
            const intervalMs = Math.max(500, integer(options.intervalMs, 2000));
            workspaceBridge = {
                fs,
                directory: target,
                outgoingFile: path.join(target, String(options.outgoingName || "HybridTileGraft.workspace.json")),
                incomingFile: path.join(target, String(options.incomingName || "HybridTileGraft.incoming.json")),
                intervalMs,
                importOptions: Object.assign({ conflictPolicy: "merge", checkpoint: true }, options.importOptions || {}),
                lastIncomingMtime: 0,
                lastExportAt: 0,
                lastImportAt: 0,
                lastError: "",
                timer: null
            };
            writeWorkspaceBridgeSnapshot();
            workspaceBridge.timer = setInterval(pollWorkspaceBridge, intervalMs);
            recordOperation("startWorkspaceBridge", { directory: target, intervalMs });
            return workspaceBridgeState();
        } catch (error) {
            workspaceBridge = null;
            console.warn(`${PLUGIN_NAME}: workspace bridge could not start.`, error);
            return false;
        }
    }

    function stopWorkspaceBridge() {
        if (!workspaceBridge) return false;
        if (workspaceBridge.timer) clearInterval(workspaceBridge.timer);
        const directory = workspaceBridge.directory;
        workspaceBridge = null;
        recordOperation("stopWorkspaceBridge", { directory });
        return true;
    }

    function loadRawMapJson(mapId) {
        const id = positiveInteger(mapId);
        const cached = pristineCache.get(id);
        if (cached && cached.raw) return Promise.resolve(deepClone(cached.raw));
        return new Promise((resolve, reject) => {
            const url = `data/Map${String(id).padStart(3, "0")}.json`;
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            xhr.overrideMimeType("application/json");
            xhr.onload = () => {
                if (xhr.status >= 400) return reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
                try { resolve(JSON.parse(xhr.responseText)); }
                catch (error) { reject(new Error(`${PLUGIN_NAME}: invalid JSON in ${url}: ${error.message}`)); }
            };
            xhr.onerror = () => reject(new Error(`${PLUGIN_NAME}: failed to load ${url}.`));
            xhr.send();
        });
    }

    function makeBakedEventList(events) {
        const output = [null];
        const spawned = [];
        let nextId = 0;
        for (const source of events || []) {
            if (!source) continue;
            if (isHybridEventData(source)) {
                spawned.push(source);
                continue;
            }
            const event = deepClone(source);
            const id = Math.max(1, integer(event.id, output.length));
            event.id = id;
            output[id] = event;
            nextId = Math.max(nextId, id);
        }
        const idMap = {};
        for (const source of spawned) {
            const event = deepClone(source);
            const oldId = integer(event.id, 0);
            const id = ++nextId;
            event.id = id;
            delete event._hybridSpawnId;
            delete event._hybridTileGraftSpawn;
            output[id] = event;
            if (oldId > 0) idMap[oldId] = id;
        }
        repairEventReferences(output, idMap);
        return { events: output, idMap };
    }

    function repairEventReferences(events, idMap) {
        const remap = value => Object.prototype.hasOwnProperty.call(idMap, integer(value))
            ? idMap[integer(value)] : value;
        for (const event of events || []) {
            if (!event || !Array.isArray(event.pages)) continue;
            for (const page of event.pages) {
                if (!page || !Array.isArray(page.list)) continue;
                for (const command of page.list) {
                    if (!command || !Array.isArray(command.parameters)) continue;
                    if (command.code === 111 && command.parameters[0] === 6) command.parameters[1] = remap(command.parameters[1]);
                    else if ([203, 205, 212, 213].includes(command.code)) command.parameters[0] = remap(command.parameters[0]);
                }
            }
        }
        return events;
    }

    function bakeMapToFile(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        if (typeof Utils !== "undefined" && Utils.isOptionValid && !Utils.isOptionValid("test") && !toBoolean(options.allowDeployed, false)) {
            return Promise.reject(new Error(`${PLUGIN_NAME}: map baking is restricted to playtest unless allowDeployed is true.`));
        }
        return Promise.all([loadRawMapJson(id), loadPristineMapData(id), preloadMap(id)]).then(([raw, pristine, composed]) => {
            raw.width = composed.width;
            raw.height = composed.height;
            raw.data = composed.data.slice();
            raw.tilesetId = composed.tilesetId;
            raw.note = composed.note || raw.note || "";
            raw.events = deepClone(composed.events || []);
            let bakedEventIds = {};
            if (options.makeEventsPermanent !== false) {
                const bakedEvents = makeBakedEventList(raw.events);
                raw.events = bakedEvents.events;
                bakedEventIds = bakedEvents.idMap;
            }
            const fileName = `Map${String(id).padStart(3, "0")}.json`;
            if (typeof require !== "function" || typeof process === "undefined") {
                const downloaded = downloadJson(fileName, raw);
                return { mapId: id, downloaded, fileName, backup: null, bakedEventIds };
            }
            const fs = require("fs");
            const path = require("path");
            const target = options.path || path.join(process.cwd(), "data", fileName);
            const existed = fs.existsSync(target);
            const backup = existed ? `${target}.htg-backup-${Date.now()}` : null;
            const historySnapshot = options.clearHistory !== false ? {
                patches: deepClone(ensureStore().maps[String(id)] || []),
                redo: deepClone(ensureStore().redo[String(id)] || []),
                eventStates: deepClone(ensureStore().eventStates[String(id)] || null),
                mapOverride: deepClone(ensureStore().mapOverrides[String(id)] || null)
            } : null;
            const temporary = `${target}.htg-tmp-${typeof process.pid === "number" ? process.pid : Date.now()}`;
            fs.writeFileSync(temporary, JSON.stringify(raw));
            if (existed) fs.renameSync(target, backup);
            try {
                fs.renameSync(temporary, target);
            } catch (error) {
                if (backup && fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
                throw error;
            }
            if (options.clearHistory !== false) {
                const store = ensureStore();
                delete store.maps[String(id)];
                delete store.redo[String(id)];
                delete store.recovery[String(id)];
                delete store.mapOverrides[String(id)];
                if (options.makeEventsPermanent !== false) delete store.eventStates[String(id)];
                const bakedEntry = {
                    width: raw.width,
                    height: raw.height,
                    data: raw.data.slice(),
                    tilesetId: raw.tilesetId,
                    note: raw.note || "",
                    events: deepClone(raw.events || []),
                    raw: deepClone(raw)
                };
                pristineCache.set(id, bakedEntry);
                composedCache.set(id, buildComposedSnapshot(id, bakedEntry));
                if (id === $gameMap.mapId()) {
                    currentPristine = {
                        mapId: id,
                        width: raw.width,
                        height: raw.height,
                        data: raw.data.slice(),
                        tilesetId: raw.tilesetId,
                        note: raw.note || "",
                        events: deepClone(raw.events || [])
                    };
                }
            }
            if (backup) {
                const store = ensureStore();
                store.bakeBackups.unshift({
                    mapId: id,
                    target,
                    backup,
                    createdAt: Date.now(),
                    historySnapshot,
                    bakedEventIds: deepClone(bakedEventIds)
                });
                store.bakeBackups = store.bakeBackups.slice(0, 30);
            }
            emitChange({ operation: "bakeMap", mapId: id, target, backup });
            return { mapId: id, downloaded: false, fileName, target, backup,
                bakedEventIds, clearedHistory: options.clearHistory !== false };
        });
    }

    function listBakeBackups(mapId = 0) {
        const id = integer(mapId, 0);
        return deepClone((ensureStore().bakeBackups || []).filter(item => !id || item.mapId === id));
    }

    function rollbackBake(backupOrIndex = 0, options = {}) {
        if (typeof require !== "function") return false;
        const fs = require("fs");
        const backups = ensureStore().bakeBackups || [];
        const record = typeof backupOrIndex === "object"
            ? backupOrIndex
            : typeof backupOrIndex === "string" && !/^\d+$/.test(backupOrIndex)
                ? backups.find(item => item.backup === backupOrIndex)
                : backups[Math.max(0, integer(backupOrIndex, 0))];
        if (!record || !record.target || !record.backup || !fs.existsSync(record.backup)) return false;
        const rollbackCopy = fs.existsSync(record.target) ? `${record.target}.htg-before-rollback-${Date.now()}` : null;
        if (rollbackCopy) fs.copyFileSync(record.target, rollbackCopy);
        fs.copyFileSync(record.backup, record.target);
        if (options.restoreHistory !== false && record.historySnapshot) {
            const store = ensureStore();
            const key = String(record.mapId);
            if (record.historySnapshot.patches && record.historySnapshot.patches.length) store.maps[key] = deepClone(record.historySnapshot.patches);
            else delete store.maps[key];
            if (record.historySnapshot.redo && record.historySnapshot.redo.length) store.redo[key] = deepClone(record.historySnapshot.redo);
            else delete store.redo[key];
            if (record.historySnapshot.eventStates) store.eventStates[key] = deepClone(record.historySnapshot.eventStates);
            else delete store.eventStates[key];
            if (record.historySnapshot.mapOverride) store.mapOverrides[key] = deepClone(record.historySnapshot.mapOverride);
            else delete store.mapOverrides[key];
        }
        pristineCache.delete(record.mapId);
        composedCache.delete(record.mapId);
        pendingLoads.delete(record.mapId);
        recordOperation("rollbackBake", { mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy });
        emitChange({ operation: "rollbackBake", mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy });
        return { mapId: record.mapId, target: record.target, backup: record.backup, rollbackCopy, reloadRequired: record.mapId === $gameMap.mapId() };
    }

    // -------------------------------------------------------------------------
    // Extraction and prefab parsing
    // -------------------------------------------------------------------------

    function normalizePrefabDefinition(value) {
        if (!value || typeof value !== "object") return null;
        const name = String(value.name || "").trim();
        const mapId = positiveInteger(value.mapId || value.storageMapId, 0);
        const width = positiveInteger(value.width || value.w, 0);
        const height = positiveInteger(value.height || value.h, 0);
        if (!name || mapId <= 0 || width <= 0 || height <= 0) return null;
        const selection = parseLayerSelection(value.layers || "L1,L2,L3,L4,L5,L6");
        const parameters = Array.isArray(value.parameters) ? value.parameters : parseJson(value.parameters, []);
        const nestedPrefabs = Array.isArray(value.nestedPrefabs) ? value.nestedPrefabs : parseJson(value.nestedPrefabs, []);
        return {
            name,
            mapId,
            x: integer(value.x || value.sourceX, 0),
            y: integer(value.y || value.sourceY, 0),
            w: width,
            h: height,
            layers: selection.layers,
            mode: normalizeMode(value.mode, "exact"),
            includeEvents: toBoolean(value.includeEvents, false) || selection.events,
            category: String(value.category || "General").trim() || "General",
            tags: normalizeList(value.tags).map(String),
            description: String(value.description || ""),
            variantGroup: String(value.variantGroup || "").trim(),
            weight: Math.max(0.001, finiteNumber(value.weight, 1)),
            thumbnail: String(value.thumbnail || ""),
            version: Math.max(1, integer(value.version || value.revision, 1)),
            dependencies: normalizeList(value.dependencies).map(String),
            anchorX: Math.max(0, Math.min(width - 1, integer(value.anchorX, 0))),
            anchorY: Math.max(0, Math.min(height - 1, integer(value.anchorY, 0))),
            parameters: Array.isArray(parameters) ? parameters.map(item => typeof item === "string" ? { name: item } : item).filter(Boolean) : [],
            nestedPrefabs: Array.isArray(nestedPrefabs) ? nestedPrefabs.filter(Boolean) : [],
            placementRules: parseNestedStruct(value.placementRules, {}),
            createdAt: finiteNumber(value.createdAt, Date.now()),
            updatedAt: Date.now()
        };
    }

    function prefabKey(name, mapId) {
        return `${positiveInteger(mapId, 0)}:${String(name || "").trim().toLowerCase()}`;
    }

    function prefabsFromNote(note, mapId) {
        const definitions = [];
        PREFAB_REGEX.lastIndex = 0;
        let match;
        while ((match = PREFAB_REGEX.exec(String(note || ""))) !== null) {
            const definition = normalizePrefabDefinition({
                name: match[1],
                mapId,
                sourceX: match[2],
                sourceY: match[3],
                width: match[4],
                height: match[5]
            });
            if (definition) definitions.push(definition);
        }
        return definitions;
    }

    function registerPrefab(definition, save = true) {
        const normalized = normalizePrefabDefinition(definition);
        if (!normalized) {
            console.warn(`${PLUGIN_NAME}: invalid prefab definition.`, definition);
            return false;
        }
        const key = prefabKey(normalized.name, normalized.mapId);
        const store = ensureStore();
        const existing = catalogPrefab(normalized.name, normalized.mapId);
        const revision = definition.version || definition.revision || (existing ? Math.max(existing.version || 1, (store.prefabRevisions[key] || {}).revision || 1) + 1 : 1);
        normalized.version = Math.max(1, integer(revision, 1));
        normalized.createdAt = existing ? existing.createdAt || normalized.createdAt : normalized.createdAt;
        normalized.updatedAt = Date.now();
        if (save !== false) ensureStore().prefabs[key] = normalized;
        else sessionPrefabs.set(key, normalized);
        if (definition.payload) {
            if (save !== false) ensureStore().prefabPayloads[key] = deepClone(definition.payload);
            else sessionPrefabPayloads.set(key, deepClone(definition.payload));
        }
        if (save !== false) store.prefabRevisions[key] = {
            revision: normalized.version,
            updatedAt: normalized.updatedAt,
            dependencies: deepClone(normalized.dependencies)
        };
        return deepClone(normalized);
    }

    function prefabPayload(definition) {
        if (!definition) return null;
        const key = prefabKey(definition.name, definition.mapId);
        return deepClone(sessionPrefabPayloads.get(key) || ensureStore().prefabPayloads[key] || null);
    }

    function recordPrefabUse(definition) {
        if (!definition) return;
        const key = prefabKey(definition.name, definition.mapId);
        const recent = ensureStore().prefabRecent;
        const filtered = recent.filter(item => item !== key);
        filtered.unshift(key);
        ensureStore().prefabRecent = filtered.slice(0, 20);
    }

    function favoritePrefab(name, mapId = 0, favorite = true) {
        const definition = catalogPrefab(name, mapId);
        if (!definition) return false;
        const key = prefabKey(definition.name, definition.mapId);
        if (favorite !== false) ensureStore().prefabFavorites[key] = true;
        else delete ensureStore().prefabFavorites[key];
        return true;
    }

    function isPrefabFavorite(definition) {
        return !!(definition && ensureStore().prefabFavorites[prefabKey(definition.name, definition.mapId)]);
    }

    function recentPrefabs() {
        const byKey = new Map(listPrefabs().map(definition => [prefabKey(definition.name, definition.mapId), definition]));
        return ensureStore().prefabRecent.map(key => byKey.get(key)).filter(Boolean).map(deepClone);
    }

    function capturePrefab(name, x, y, width, height, options = {}) {
        const mapId = $gameMap.mapId();
        const layers = options.layers || "L1,L2,L3,L4,L5,L6";
        const includeEvents = toBoolean(options.includeEvents, false) || parseLayerSelection(layers).events;
        const payload = copyArea(x, y, width, height, layers, includeEvents, options);
        return registerPrefab({
            name,
            mapId,
            sourceX: integer(x),
            sourceY: integer(y),
            width,
            height,
            layers,
            mode: options.mode || "exact",
            includeEvents,
            category: options.category,
            tags: options.tags,
            description: options.description,
            variantGroup: options.variantGroup,
            weight: options.weight,
            thumbnail: options.thumbnail,
            version: options.version,
            dependencies: options.dependencies,
            anchorX: options.anchorX,
            anchorY: options.anchorY,
            parameters: options.parameters,
            nestedPrefabs: options.nestedPrefabs,
            placementRules: options.placementRules,
            payload
        }, options.save !== false);
    }

    function duplicatePrefab(name, mapId, newName, save = true) {
        const source = catalogPrefab(name, mapId);
        if (!source) return false;
        const payload = prefabPayload(source);
        return registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
    }

    function renamePrefab(name, mapId, newName, save = true) {
        const source = catalogPrefab(name, mapId);
        if (!source || !String(newName || "").trim()) return false;
        const payload = prefabPayload(source);
        if (source.name.toLowerCase() === String(newName).trim().toLowerCase()) {
            return registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
        }
        const result = registerPrefab(Object.assign({}, source, { name: newName, payload }), save);
        removePrefab(source.name, source.mapId);
        return result;
    }

    function choosePrefabVariant(group, options = {}) {
        const candidates = listPrefabs().filter(definition => definition.variantGroup === String(group || ""));
        if (!candidates.length) return null;
        const entries = candidates.map((definition, index) => ({ tileId: index, weight: definition.weight || 1 }));
        const index = chooseWeightedTile(entries, typeof options.random === "function" ? options.random : Math.random);
        return deepClone(candidates[index]);
    }

    function exportPrefabPack(names = null) {
        const requested = names ? new Set(normalizeList(names).map(value => String(value).toLowerCase())) : null;
        const prefabs = listPrefabs().filter(definition => !requested || requested.has(definition.name.toLowerCase()));
        return {
            format: "HybridTileGraftPrefabPack",
            version: 2,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            prefabs: prefabs.map(definition => ({
                definition: deepClone(definition),
                payload: prefabPayload(definition)
            }))
        };
    }

    function previewPrefabImport(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) {
            return { ok: false, errors: [`Prefab pack exceeds the ${MAX_IMPORT_BYTES}-byte safety limit.`], prefabs: [] };
        }
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPrefabPack" || !Array.isArray(pack.prefabs)) {
            return { ok: false, errors: ["Not a HybridTileGraft prefab pack."], prefabs: [] };
        }
        const policy = String(options.conflictPolicy || "newer").toLowerCase();
        const prefabs = pack.prefabs.map(item => {
            const definition = normalizePrefabDefinition(item.definition || item);
            if (!definition) return { ok: false, error: "Invalid prefab definition." };
            const current = catalogPrefab(definition.name, definition.mapId);
            const action = !current ? "create"
                : policy === "replace" ? "replace"
                    : policy === "skip" ? "skip"
                        : (definition.version || 1) > (current.version || 1) ? "replace" : "skip";
            return {
                ok: true,
                name: definition.name,
                mapId: definition.mapId,
                incomingVersion: definition.version || 1,
                currentVersion: current ? current.version || 1 : 0,
                action,
                dependencies: prefabDependencyReport(definition).dependencies,
                embedded: !!item.payload
            };
        });
        return { ok: prefabs.every(item => item.ok), policy, errors: prefabs.filter(item => !item.ok).map(item => item.error), prefabs };
    }

    function importPrefabPack(value, saveOrOptions = true) {
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftPrefabPack" || !Array.isArray(pack.prefabs)) return false;
        const options = typeof saveOrOptions === "object" ? saveOrOptions : { save: saveOrOptions };
        const preview = previewPrefabImport(pack, options);
        if (options.dryRun) return preview;
        const imported = [];
        const skipped = [];
        for (let index = 0; index < pack.prefabs.length; index++) {
            const item = pack.prefabs[index];
            const definition = item.definition || item;
            if (preview.prefabs[index] && preview.prefabs[index].action === "skip") {
                skipped.push(definition.name);
                continue;
            }
            const result = registerPrefab(Object.assign({}, definition, { payload: item.payload || definition.payload }), options.save !== false);
            if (result) imported.push(result);
        }
        Object.defineProperty(imported, "skipped", { value: skipped, enumerable: false });
        return imported;
    }

    function listPrefabs() {
        const merged = new Map();
        if (typeof $dataMap !== "undefined" && $dataMap && typeof $gameMap !== "undefined" && $gameMap) {
            for (const definition of prefabsFromNote($dataMap.note, $gameMap.mapId())) {
                merged.set(prefabKey(definition.name, definition.mapId), definition);
            }
        }
        for (const [mapId, entry] of pristineCache) {
            for (const definition of prefabsFromNote(entry.note, mapId)) {
                merged.set(prefabKey(definition.name, definition.mapId), definition);
            }
        }
        for (const definition of PARAMETER_PREFABS) merged.set(prefabKey(definition.name, definition.mapId), definition);
        for (const [key, definition] of Object.entries(ensureStore().prefabs || {})) merged.set(key, definition);
        for (const [key, definition] of sessionPrefabs) merged.set(key, definition);
        return Array.from(merged.values()).map(definition => Object.assign(deepClone(definition), {
            favorite: isPrefabFavorite(definition),
            recent: ensureStore().prefabRecent.indexOf(prefabKey(definition.name, definition.mapId))
        })).sort((a, b) => Number(b.favorite) - Number(a.favorite) ||
            ((a.recent < 0 ? 999 : a.recent) - (b.recent < 0 ? 999 : b.recent)) ||
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.mapId - b.mapId);
    }

    function removePrefab(name, mapId = 0) {
        const targetName = String(name || "").trim().toLowerCase();
        let removed = false;
        const removedKeys = new Set();
        for (const key of Object.keys(ensureStore().prefabs || {})) {
            const definition = ensureStore().prefabs[key];
            if (String(definition.name).toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))) {
                delete ensureStore().prefabs[key];
                delete ensureStore().prefabPayloads[key];
                delete ensureStore().prefabFavorites[key];
                delete ensureStore().prefabRevisions[key];
                removedKeys.add(key);
                removed = true;
            }
        }
        for (const [key, definition] of Array.from(sessionPrefabs.entries())) {
            if (String(definition.name).toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))) {
                sessionPrefabs.delete(key);
                sessionPrefabPayloads.delete(key);
                removedKeys.add(key);
                removed = true;
            }
        }
        if (removed) ensureStore().prefabRecent = ensureStore().prefabRecent.filter(key => !removedKeys.has(key));
        return removed;
    }

    function catalogPrefab(name, mapId = 0) {
        const targetName = String(name || "").trim().toLowerCase();
        return listPrefabs().find(definition =>
            definition.name.toLowerCase() === targetName && (!mapId || definition.mapId === integer(mapId))
        ) || null;
    }

    function preloadPrefabMaps(forceRefresh = false) {
        const mapIds = [...new Set(listPrefabs().map(definition => definition.mapId))];
        return Promise.all(mapIds.map(mapId => preloadMap(mapId, forceRefresh)));
    }

    function preloadChildMaps(tag = CHILD_MAP_TAG, forceRefresh = false) {
        const mapIds = new Set();
        const label = String(tag || "ChildMap").trim();
        if (label && typeof $dataMap !== "undefined" && $dataMap) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`<${escaped}:\\s*([^>]+)>`, "gi");
            let match;
            while ((match = regex.exec(String($dataMap.note || "")))) {
                for (const raw of match[1].split(",")) {
                    const id = positiveInteger(raw, 0);
                    if (id > 0) mapIds.add(id);
                }
            }
        }
        if (typeof $dataMapInfos !== "undefined" && $dataMapInfos) {
            const marker = label.toLowerCase();
            for (const info of $dataMapInfos) {
                if (!info) continue;
                const name = String(info.name || "").toLowerCase();
                if (integer(info.parentId, 0) === $gameMap.mapId() ||
                    (marker && (name.includes(`[${marker}]`) || name.includes(`<${marker}>`)))) {
                    mapIds.add(info.id);
                }
            }
        }
        return Promise.all(Array.from(mapIds).map(mapId => preloadMap(mapId, forceRefresh)));
    }

    function extractRegion(source, rect, layerKeys) {
        const tiles = {};
        for (const key of layerKeys) {
            const z = LAYER_INDEX[key];
            const values = new Array(rect.w * rect.h).fill(0);
            for (let dy = 0; dy < rect.h; dy++) {
                for (let dx = 0; dx < rect.w; dx++) {
                    values[dy * rect.w + dx] = readTile(
                        source.data,
                        source.width,
                        source.height,
                        rect.x + dx,
                        rect.y + dy,
                        z
                    );
                }
            }
            tiles[key] = values;
        }
        return tiles;
    }

    function findPrefab(note, name) {
        PREFAB_REGEX.lastIndex = 0;
        let match;
        while ((match = PREFAB_REGEX.exec(note || "")) !== null) {
            if (match[1].trim().toLowerCase() === String(name || "").trim().toLowerCase()) {
                return normalizeRect(match[2], match[3], match[4], match[5]);
            }
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Public map operations
    // -------------------------------------------------------------------------

    function graftArea(options = {}) {
        const sourceMapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        const source = getSourceMapData(sourceMapId);
        if (!source) return false;
        if (WARN_MISMATCHED_TILESET && source.tilesetId !== $dataMap.tilesetId) {
            console.warn(`${PLUGIN_NAME}: source tileset ${source.tilesetId} differs from target tileset ${$dataMap.tilesetId}. Tile slots will use the target tileset's graphics.`);
        }
        const sourceRect = normalizeRect(options.sourceX, options.sourceY, options.width, options.height);
        const point = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const targetRect = { x: point.x, y: point.y, w: sourceRect.w, h: sourceRect.h };
        const selection = parseLayerSelection(options.layers || ["L1", "L2", "L3", "L4", "L5", "L6"]);
        const includeEvents = toBoolean(options.includeEvents, false) || selection.events;
        if (!selection.layers.length && !includeEvents) {
            console.warn(`${PLUGIN_NAME}: graft ignored because no valid layers were selected.`);
            return false;
        }
        const tiles = extractRegion(source, sourceRect, selection.layers);
        const events = includeEvents
            ? extractEvents(source, sourceRect, targetRect.x - sourceRect.x, targetRect.y - sourceRect.y)
            : [];
        const patch = makeRectPatch(targetRect, selection.layers, tiles, options.mode, {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInArea(targetRect) : []
        });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "graftArea");
        return patch;
    }

    function graftAreaAsync(options = {}) {
        const mapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        if (mapId === $gameMap.mapId() || composedCache.has(mapId)) return Promise.resolve(graftArea(options));
        return preloadMap(mapId).then(() => graftArea(options));
    }

    function mapSnapshotAsync(mapId) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(getSourceMapData(id));
        return preloadMap(id);
    }

    function applyPatchToMap(mapId, patch, operation) {
        const id = positiveInteger(mapId);
        addPatch(id, patch);
        if (id === $gameMap.mapId()) {
            applyPatchLive(patch, operation);
        } else {
            emitChange({ operation, mapId: id, remote: true, rect: patchRect(patch), layers: patch.layers || [] });
        }
        return patch;
    }

    function spawnedEventIdsInSnapshot(events, rect) {
        const ids = [];
        for (const event of events || []) {
            if (isHybridEventData(event) && inRect(event.x, event.y, rect)) ids.push(event.id);
        }
        return ids;
    }

    function graftAreaToMapAsync(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) return graftAreaAsync(options);
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote graft was skipped.`);
            return Promise.resolve(false);
        }
        const sourceMapId = integer(options.sourceMapId, 0) || $gameMap.mapId();
        return Promise.all([mapSnapshotAsync(sourceMapId), mapSnapshotAsync(targetMapId)]).then(([source, target]) => {
            const sourceRect = normalizeRect(options.sourceX, options.sourceY, options.width, options.height);
            const targetPoint = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
            const targetRect = normalizeRect(targetPoint.x, targetPoint.y, sourceRect.w, sourceRect.h);
            const selection = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6");
            const includeEvents = toBoolean(options.includeEvents, false) || selection.events;
            if (!selection.layers.length && !includeEvents) return false;
            if (WARN_MISMATCHED_TILESET && source.tilesetId !== target.tilesetId) {
                console.warn(`${PLUGIN_NAME}: remote graft tileset mismatch (${source.tilesetId} -> ${target.tilesetId}).`);
            }
            const tiles = extractRegion(source, sourceRect, selection.layers);
            const events = includeEvents
                ? extractEvents(source, sourceRect, targetRect.x - sourceRect.x, targetRect.y - sourceRect.y)
                : [];
            const patch = makeRectPatch(targetRect, selection.layers, tiles, options.mode, {
                affectEvents: includeEvents,
                events,
                removeEventIds: includeEvents ? spawnedEventIdsInSnapshot(target.events, targetRect) : []
            });
            return applyPatchToMap(targetMapId, patch, "graftRemoteArea");
        });
    }

    function setTileOnMapAsync(mapId, x, y, layer, tileValue, options = {}) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(setTile(x, y, layer, tileValue, true, options));
        }
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote tile change was skipped.`);
            return Promise.resolve(false);
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const tileId = parseTileId(tileValue);
            const point = resolvePoint(x, y, options, options.interpreter || null);
            if (tileId === null || !inBounds(point.x, point.y, target.width, target.height)) return false;
            const key = normalizeLayer(layer);
            if (!validateLayerValue(tileId, key, target.tilesetId)) return false;
            const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
            const patch = makeSparsePatch([{
                x: point.x,
                y: point.y,
                tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
            }], mode, mode === "autotile" ? [point] : null);
            return applyPatchToMap(targetMapId, patch, "setRemoteTile");
        });
    }

    function fillTilesOnMapAsync(mapId, x, y, width, height, layer, tileValue, options = {}) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(fillTiles(x, y, width, height, layer, tileValue, true, options));
        }
        if (options.save === false) {
            console.warn(`${PLUGIN_NAME}: temporary changes cannot target an unloaded remote map; remote fill was skipped.`);
            return Promise.resolve(false);
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const tileId = parseTileId(tileValue);
            const key = normalizeLayer(layer);
            if (tileId === null || !validateLayerValue(tileId, key, target.tilesetId)) return false;
            const point = resolvePoint(x, y, options, options.interpreter || null);
            const rect = normalizeRect(point.x, point.y, width, height);
            const layers = [key];
            const tiles = { [key]: new Array(rect.w * rect.h).fill(tileId) };
            const z = LAYER_INDEX[key];
            if (toBoolean(options.clearUpperLayers, false) && z <= 3) {
                for (let upper = z + 1; upper <= 3; upper++) {
                    const upperKey = `L${upper + 1}`;
                    layers.push(upperKey);
                    tiles[upperKey] = new Array(rect.w * rect.h).fill(0);
                }
            }
            const patchMode = LAYER_INDEX[key] <= 3 ? (options.mode || "autotile") : "exact";
            const patch = makeRectPatch(rect, layers, tiles, patchMode);
            return applyPatchToMap(targetMapId, patch, "fillRemoteTiles");
        });
    }

    function clearAreaOnMapAsync(mapId, x, y, width, height, layersValue, includeEvents = false, mode = "autotile") {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(clearArea(x, y, width, height, layersValue, true, includeEvents, mode));
        }
        return mapSnapshotAsync(targetMapId).then(target => {
            const rect = normalizeRect(x, y, width, height);
            const selection = parseLayerSelection(layersValue);
            const affectEvents = includeEvents || selection.events;
            const tiles = {};
            for (const key of selection.layers) tiles[key] = new Array(rect.w * rect.h).fill(0);
            const patch = makeRectPatch(rect, selection.layers, tiles, mode, {
                affectEvents,
                events: [],
                removeEventIds: affectEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
            });
            return applyPatchToMap(targetMapId, patch, "clearRemoteArea");
        });
    }

    function revertAreaOnMapAsync(mapId, x, y, width, height, layersValue, includeEvents = false) {
        const targetMapId = integer(mapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) {
            return Promise.resolve(revertArea(x, y, width, height, layersValue, true, includeEvents));
        }
        return Promise.all([loadPristineMapData(targetMapId), mapSnapshotAsync(targetMapId)]).then(([pristine, target]) => {
            const rect = normalizeRect(x, y, width, height);
            const selection = parseLayerSelection(layersValue);
            const affectEvents = includeEvents || selection.events;
            const tiles = extractRegion(pristine, rect, selection.layers);
            const needsAutotile = selection.layers.some(key => LAYER_INDEX[key] <= 3);
            const patch = makeRectPatch(rect, selection.layers, tiles, needsAutotile ? "autotile" : "exact", {
                affectEvents,
                events: [],
                removeEventIds: affectEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
            });
            return applyPatchToMap(targetMapId, patch, "revertRemoteArea");
        });
    }

    function prefabPayloadFromSource(definition, source) {
        if (!definition || !source) return null;
        const rect = normalizeRect(definition.x, definition.y, definition.w, definition.h);
        const layers = parseLayerSelection(definition.layers || "L1,L2,L3,L4,L5,L6").layers;
        const events = definition.includeEvents ? (source.events || []).filter(event => event && inRect(event.x, event.y, rect)).map(sourceEvent => {
            const event = deepClone(sourceEvent);
            event.x -= rect.x;
            event.y -= rect.y;
            return event;
        }) : [];
        return {
            version: 2,
            width: rect.w,
            height: rect.h,
            layers,
            tiles: extractRegion(source, rect, layers),
            events,
            includeEvents: !!definition.includeEvents,
            tilesetId: source.tilesetId,
            sourceMapId: definition.mapId
        };
    }

    function prefabParameterValues(definition, options = {}) {
        const supplied = typeof options.parameters === "string" ? parseJson(options.parameters, {}) : options.parameters || {};
        const values = {};
        for (const parameter of definition.parameters || []) {
            if (!parameter || !parameter.name) continue;
            values[parameter.name] = supplied[parameter.name] !== undefined ? supplied[parameter.name] : parameter.default;
        }
        Object.assign(values, supplied);
        return values;
    }

    function substitutePrefabValue(value, parameters) {
        if (typeof value === "string") {
            const exact = value.match(/^\{\{([^}]+)\}\}$/);
            if (exact && parameters[exact[1]] !== undefined) return deepClone(parameters[exact[1]]);
            return value.replace(/\{\{([^}]+)\}\}/g, (_match, key) => parameters[key] === undefined ? "" : String(parameters[key]));
        }
        if (Array.isArray(value)) return value.map(item => substitutePrefabValue(item, parameters));
        if (value && typeof value === "object") {
            const output = {};
            for (const [key, item] of Object.entries(value)) output[key] = substitutePrefabValue(item, parameters);
            return output;
        }
        return value;
    }

    function resolvePrefabPayload(definition, payload, options = {}) {
        const output = deepClone(payload);
        const parameters = prefabParameterValues(definition, options);
        output.events = substitutePrefabValue(output.events || [], parameters);
        for (const parameter of definition.parameters || []) {
            if (!parameter || !parameter.name || parameter.sourceTileId === undefined) continue;
            const sourceId = parseTileId(parameter.sourceTileId);
            const replacement = parseTileId(parameters[parameter.name]);
            if (sourceId === null || replacement === null) continue;
            const targetLayers = parameter.layer ? [normalizeLayer(parameter.layer)] : output.layers;
            for (const layer of targetLayers) {
                if (output.tiles[layer]) output.tiles[layer] = output.tiles[layer].map(value => value === sourceId ? replacement : value);
            }
        }
        for (const [sourceValue, replacementValue] of Object.entries(options.tileOverrides || {})) {
            const sourceId = parseTileId(sourceValue);
            const replacement = parseTileId(replacementValue);
            if (sourceId === null || replacement === null) continue;
            for (const layer of output.layers || []) {
                output.tiles[layer] = (output.tiles[layer] || []).map(value => value === sourceId ? replacement : value);
            }
        }
        output.parameters = parameters;
        return output;
    }

    function prefabPlacementOrigin(definition, payload, options = {}) {
        const point = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const rotation = normalizedRotation(options.rotation);
        const anchor = transformedPoint(definition.anchorX || 0, definition.anchorY || 0,
            payload.width, payload.height, rotation, toBoolean(options.mirrorX, false), toBoolean(options.mirrorY, false));
        return { x: point.x - anchor.x, y: point.y - anchor.y };
    }

    function validatePrefabPlacement(definition, target, options = {}, payload = null) {
        if (!definition || !target) return { ok: false, errors: ["Missing prefab or target map."] };
        payload ||= prefabPayload(definition);
        if (!payload) return { ok: false, errors: ["Prefab payload is unavailable."] };
        const transformed = transformClipboard(payload, options);
        const origin = prefabPlacementOrigin(definition, payload, options);
        const rect = normalizeRect(origin.x, origin.y, transformed.width, transformed.height);
        const rules = Object.assign({}, definition.placementRules || {}, options.placementRules || {});
        const errors = [];
        if (rules.withinBounds !== false && (rect.x < 0 || rect.y < 0 || rect.x + rect.w > target.width || rect.y + rect.h > target.height)) {
            errors.push("Prefab footprint is outside the target map.");
        }
        const anchorPoint = resolvePoint(options.targetX, options.targetY, options, options.interpreter || null);
        const region = readTile(target.data, target.width, target.height, anchorPoint.x, anchorPoint.y, 5);
        const allowedRegions = normalizeList(rules.allowedRegions).map(Number);
        const forbiddenRegions = normalizeList(rules.forbiddenRegions).map(Number);
        if (allowedRegions.length && !allowedRegions.includes(region)) errors.push(`Anchor region ${region} is not allowed.`);
        if (forbiddenRegions.includes(region)) errors.push(`Anchor region ${region} is forbidden.`);
        if (toBoolean(rules.requireEmptyEvents, false) && (target.events || []).some(event => event && inRect(event.x, event.y, rect))) {
            errors.push("The target footprint contains events.");
        }
        const edgeDistance = Math.max(0, integer(rules.edgeDistance, 0));
        if (edgeDistance && (rect.x < edgeDistance || rect.y < edgeDistance ||
            rect.x + rect.w > target.width - edgeDistance || rect.y + rect.h > target.height - edgeDistance)) {
            errors.push(`Prefab must be at least ${edgeDistance} tile(s) from the map edge.`);
        }
        return { ok: errors.length === 0, errors, rect, origin, region };
    }

    function prefabDependencyReport(definition) {
        const dependencies = [];
        for (const raw of definition && definition.dependencies || []) {
            const match = String(raw).match(/^(.+?)(?:@(\d+))?$/);
            const dependency = catalogPrefab(match ? match[1] : raw, 0);
            const requiredVersion = match && match[2] ? integer(match[2]) : 1;
            dependencies.push({ name: match ? match[1] : String(raw), requiredVersion,
                found: !!dependency, actualVersion: dependency ? dependency.version || 1 : 0,
                ok: !!dependency && (dependency.version || 1) >= requiredVersion });
        }
        return { ok: dependencies.every(item => item.ok), dependencies };
    }

    function resolvePrefabForGraft(options, source = null) {
        const requestedMapId = integer(options.storageMapId, 0);
        let definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const storageMapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        source ||= getSourceMapData(storageMapId);
        if (!definition && source) {
            const rect = findPrefab(source.note, options.name);
            if (rect) definition = normalizePrefabDefinition(Object.assign({
                name: options.name,
                mapId: storageMapId,
                layers: options.layers || "L1,L2,L3,L4,L5,L6",
                mode: options.mode || "exact",
                includeEvents: toBoolean(options.includeEvents, false)
            }, rect));
        }
        if (!definition) return null;
        definition = deepClone(definition);
        if (options.includeEvents !== undefined) definition.includeEvents = toBoolean(options.includeEvents, definition.includeEvents);
        let payload = prefabPayload(definition);
        if (!payload || (definition.includeEvents && !payload.includeEvents)) payload = prefabPayloadFromSource(definition, source);
        if (!payload) return null;
        payload = resolvePrefabPayload(definition, payload, options);
        return { definition, payload, source };
    }

    function graftPrefab(options = {}) {
        const resolved = resolvePrefabForGraft(options);
        if (!resolved) {
            console.warn(`${PLUGIN_NAME}: prefab "${options.name}" is unavailable or its source map is not preloaded.`);
            return false;
        }
        const dependencyReport = prefabDependencyReport(resolved.definition);
        if (!dependencyReport.ok && options.ignoreDependencies !== true) {
            console.warn(`${PLUGIN_NAME}: prefab dependencies are not satisfied.`, dependencyReport);
            return false;
        }
        const placement = validatePrefabPlacement(resolved.definition, getSourceMapData($gameMap.mapId()), options, resolved.payload);
        if (!placement.ok && options.ignorePlacementRules !== true) {
            console.warn(`${PLUGIN_NAME}: prefab placement rejected.`, placement.errors);
            return false;
        }
        const result = pasteArea(placement.origin.x, placement.origin.y, Object.assign({}, options, {
            coordinateMode: "absolute",
            targetX: undefined,
            targetY: undefined,
            layers: options.layers || resolved.definition.layers,
            mode: options.mode || resolved.definition.mode,
            includeEvents: options.includeEvents === undefined ? resolved.definition.includeEvents : options.includeEvents
        }), resolved.payload);
        if (result) recordPrefabUse(resolved.definition);
        return result;
    }

    async function graftNestedPrefabs(definition, payload, options, remote = false) {
        const stack = new Set(options._dependencyStack || []);
        const key = prefabKey(definition.name, definition.mapId);
        if (stack.has(key)) throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${definition.name}.`);
        stack.add(key);
        const origin = prefabPlacementOrigin(definition, payload, options);
        const results = [];
        for (const nested of definition.nestedPrefabs || []) {
            const local = transformedPoint(integer(nested.x), integer(nested.y), payload.width, payload.height,
                normalizedRotation(options.rotation), toBoolean(options.mirrorX, false), toBoolean(options.mirrorY, false));
            const nestedOptions = Object.assign({}, nested, {
                name: nested.name,
                storageMapId: nested.mapId || nested.storageMapId || 0,
                targetX: origin.x + local.x,
                targetY: origin.y + local.y,
                rotation: (normalizedRotation(options.rotation) + normalizedRotation(nested.rotation)) % 360,
                mirrorX: nested.mirrorX === undefined ? options.mirrorX : nested.mirrorX,
                mirrorY: nested.mirrorY === undefined ? options.mirrorY : nested.mirrorY,
                save: options.save,
                _dependencyStack: Array.from(stack),
                parameters: Object.assign({}, options.parameters || {}, nested.parameters || {})
            });
            if (remote) nestedOptions.targetMapId = options.targetMapId;
            results.push(await (remote ? graftPrefabToMapAsync(nestedOptions) : graftPrefabAsync(nestedOptions)));
        }
        return results;
    }

    async function graftPrefabAsync(options = {}) {
        const requestedMapId = integer(options.storageMapId, 0);
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const mapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        if (!(definition && prefabPayload(definition)) && mapId !== $gameMap.mapId() && !composedCache.has(mapId)) await preloadMap(mapId);
        const resolved = resolvePrefabForGraft(options);
        if (!resolved) return false;
        if (new Set(options._dependencyStack || []).has(prefabKey(resolved.definition.name, resolved.definition.mapId))) {
            throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${resolved.definition.name}.`);
        }
        const result = graftPrefab(options);
        if (!result) return false;
        Object.defineProperty(result, "nestedResults", {
            value: await graftNestedPrefabs(resolved.definition, resolved.payload, options, false),
            configurable: true,
            enumerable: false
        });
        return result;
    }

    async function graftPrefabToMapAsync(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        if (targetMapId === $gameMap.mapId()) return graftPrefabAsync(options);
        const requestedMapId = integer(options.storageMapId, 0);
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, requestedMapId);
        const sourceMapId = definition ? definition.mapId : (requestedMapId || $gameMap.mapId());
        const [target, source] = await Promise.all([mapSnapshotAsync(targetMapId), mapSnapshotAsync(sourceMapId)]);
        const resolved = resolvePrefabForGraft(options, source);
        if (!resolved) return false;
        if (new Set(options._dependencyStack || []).has(prefabKey(resolved.definition.name, resolved.definition.mapId))) {
            throw new Error(`${PLUGIN_NAME}: nested prefab cycle detected at ${resolved.definition.name}.`);
        }
        const dependencyReport = prefabDependencyReport(resolved.definition);
        if (!dependencyReport.ok && options.ignoreDependencies !== true) return false;
        const placement = validatePrefabPlacement(resolved.definition, target, options, resolved.payload);
        if (!placement.ok && options.ignorePlacementRules !== true) return false;
        const transformed = transformClipboard(resolved.payload, options);
        const rect = normalizeRect(placement.origin.x, placement.origin.y, transformed.width, transformed.height);
        const requested = options.layers ? parseLayerSelection(options.layers).layers : transformed.layers;
        const layers = requested.filter(layer => transformed.layers.includes(layer));
        const tiles = {};
        for (const layer of layers) tiles[layer] = (transformed.tiles[layer] || []).slice();
        const includeEvents = !!transformed.includeEvents && (options.includeEvents === undefined
            ? resolved.definition.includeEvents : toBoolean(options.includeEvents, false));
        const events = includeEvents ? (transformed.events || []).map(sourceEvent => {
            const event = prepareTargetEventSnapshot(sourceEvent);
            event.x = rect.x + integer(sourceEvent.x);
            event.y = rect.y + integer(sourceEvent.y);
            return event;
        }) : [];
        const patch = makeRectPatch(rect, layers, tiles, options.mode || resolved.definition.mode || "exact", {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInSnapshot(target.events, rect) : []
        });
        const result = applyPatchToMap(targetMapId, patch, "graftRemotePrefab");
        recordPrefabUse(resolved.definition);
        Object.defineProperty(result, "nestedResults", {
            value: await graftNestedPrefabs(resolved.definition, resolved.payload,
                Object.assign({}, options, { targetMapId }), true),
            configurable: true,
            enumerable: false
        });
        return result;
    }

    function prefabInstanceBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.prefabInstances[key] ||= [];
        return store.prefabInstances[key] || [];
    }

    async function placePrefabInstance(options = {}) {
        const targetMapId = integer(options.targetMapId, 0) || $gameMap.mapId();
        const definition = options.variantGroup ? choosePrefabVariant(options.variantGroup, options)
            : catalogPrefab(options.name, integer(options.storageMapId, 0));
        if (!definition) return false;
        const instanceId = String(options.instanceId || `instance-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
        const store = ensureStore();
        const key = String(targetMapId);
        const start = (store.maps[key] || []).length;
        const placementOptions = Object.assign({}, deepClone(options), { targetMapId });
        delete placementOptions.instanceId;
        const result = await graftPrefabToMapAsync(placementOptions);
        if (!result) return false;
        const patches = (store.maps[key] || []).slice(start);
        for (const patch of patches) patch.prefabInstanceId = instanceId;
        const instance = {
            id: instanceId,
            mapId: targetMapId,
            prefabName: definition.name,
            prefabMapId: definition.mapId,
            prefabVersion: definition.version || 1,
            targetX: integer(options.targetX),
            targetY: integer(options.targetY),
            options: placementOptions,
            patchCount: patches.length,
            linked: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        prefabInstanceBucket(targetMapId, true).push(instance);
        recordOperation("placePrefabInstance", { mapId: targetMapId, instanceId, prefab: definition.name, patchCount: patches.length });
        return deepClone(instance);
    }

    function listPrefabInstances(mapId = $gameMap.mapId()) {
        return prefabInstanceBucket(mapId).map(instance => {
            const definition = catalogPrefab(instance.prefabName, instance.prefabMapId);
            return Object.assign(deepClone(instance), {
                currentPrefabVersion: definition ? definition.version || 1 : 0,
                updateAvailable: !!definition && (definition.version || 1) > (instance.prefabVersion || 1),
                missingPrefab: !definition
            });
        });
    }

    function resolvePrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        return prefabInstanceBucket(mapId).find(item => item.id === String(instanceId)) || null;
    }

    async function refreshPrefabInstance(instanceId, mapId = $gameMap.mapId(), changes = {}) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance || instance.linked === false) return false;
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.prefabInstanceId !== instance.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("preparePrefabInstanceRefresh");
        else await preloadMap(id, true);
        const start = (store.maps[key] || []).length;
        const options = Object.assign({}, deepClone(instance.options || {}), deepClone(changes || {}), {
            targetMapId: id,
            name: changes.prefabName || instance.prefabName,
            storageMapId: changes.prefabMapId || instance.prefabMapId
        });
        const result = await graftPrefabToMapAsync(options);
        if (!result) return false;
        const patches = (store.maps[key] || []).slice(start);
        for (const patch of patches) patch.prefabInstanceId = instance.id;
        const definition = catalogPrefab(options.name, options.storageMapId);
        instance.prefabName = options.name;
        instance.prefabMapId = options.storageMapId;
        instance.prefabVersion = definition ? definition.version || 1 : instance.prefabVersion;
        instance.targetX = integer(options.targetX);
        instance.targetY = integer(options.targetY);
        instance.options = options;
        instance.patchCount = patches.length;
        instance.updatedAt = Date.now();
        recordOperation("refreshPrefabInstance", { mapId: id, instanceId: instance.id, patchCount: patches.length });
        return deepClone(instance);
    }

    async function refreshAllPrefabInstances(mapId = $gameMap.mapId(), options = {}) {
        const results = [];
        const errors = [];
        for (const instance of listPrefabInstances(mapId)) {
            if (options.onlyOutdated !== false && !instance.updateAvailable) continue;
            try { results.push(await refreshPrefabInstance(instance.id, mapId)); }
            catch (error) { errors.push({ instanceId: instance.id, message: error.message }); }
        }
        return { ok: errors.length === 0, results, errors };
    }

    function unlinkPrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance) return false;
        for (const patch of getPatches(id)) if (patch && patch.prefabInstanceId === instance.id) delete patch.prefabInstanceId;
        ensureStore().prefabInstances[String(id)] = prefabInstanceBucket(id).filter(item => item.id !== instance.id);
        return true;
    }

    function deletePrefabInstance(instanceId, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const instance = resolvePrefabInstance(instanceId, id);
        if (!instance) return false;
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.prefabInstanceId !== instance.id);
        store.prefabInstances[key] = prefabInstanceBucket(id).filter(item => item.id !== instance.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("deletePrefabInstance");
        return true;
    }

    function prefabInstanceDiagnostics(mapId = $gameMap.mapId()) {
        const instances = listPrefabInstances(mapId);
        return {
            mapId: integer(mapId),
            total: instances.length,
            outdated: instances.filter(item => item.updateAvailable).length,
            missing: instances.filter(item => item.missingPrefab).length,
            instances
        };
    }

    function cellTilesForLayer(layer, tileId, clearUpperLayers = false) {
        const key = normalizeLayer(layer);
        const z = LAYER_INDEX[key];
        const tiles = { [key]: tileId };
        if (clearUpperLayers && z <= 3) {
            for (let upper = z + 1; upper <= 3; upper++) tiles[`L${upper + 1}`] = 0;
        }
        return tiles;
    }

    function copyArea(x, y, width, height, layersValue = "L1,L2,L3,L4,L5,L6", includeEvents = false, options = {}) {
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const selection = parseLayerSelection(layersValue);
        const copyEvents = toBoolean(includeEvents, false) || selection.events;
        const source = getSourceMapData($gameMap.mapId());
        const events = [];
        if (copyEvents) {
            for (const sourceEvent of source.events || []) {
                if (!sourceEvent || !inRect(sourceEvent.x, sourceEvent.y, rect)) continue;
                const event = deepClone(sourceEvent);
                event.x -= rect.x;
                event.y -= rect.y;
                events.push(event);
            }
        }
        runtimeClipboard = {
            version: 1,
            width: rect.w,
            height: rect.h,
            layers: selection.layers,
            tiles: extractRegion(source, rect, selection.layers),
            events,
            includeEvents: copyEvents,
            tilesetId: source.tilesetId,
            sourceMapId: $gameMap.mapId()
        };
        emitChange({ operation: "copyArea", mapId: $gameMap.mapId(), rect, layers: selection.layers });
        return deepClone(runtimeClipboard);
    }

    function clipboardContents() {
        return runtimeClipboard ? deepClone(runtimeClipboard) : null;
    }

    function clearClipboard() {
        runtimeClipboard = null;
        return true;
    }

    function groupHistorySince(mapId, startIndex, label) {
        const store = ensureStore();
        const key = String(integer(mapId));
        const patches = store.maps[key] || [];
        const changes = patches.slice(startIndex);
        if (changes.length > 1) store.maps[key] = patches.slice(0, startIndex).concat(makeBatchPatch(changes, label));
        else if (changes.length === 1) changes[0].label ||= label;
        composedCache.delete(integer(mapId));
        return changes.length;
    }

    function resizeClipboard(clipboard, width, height, options = {}) {
        if (!clipboard) return null;
        const targetWidth = positiveInteger(width);
        const targetHeight = positiveInteger(height);
        const output = deepClone(clipboard);
        output.width = targetWidth;
        output.height = targetHeight;
        output.tiles = {};
        for (const layer of clipboard.layers || []) {
            const source = clipboard.tiles[layer] || [];
            const target = new Array(targetWidth * targetHeight).fill(0);
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < targetWidth; x++) {
                    const sourceX = Math.min(clipboard.width - 1, Math.floor(x * clipboard.width / targetWidth));
                    const sourceY = Math.min(clipboard.height - 1, Math.floor(y * clipboard.height / targetHeight));
                    target[y * targetWidth + x] = source[sourceY * clipboard.width + sourceX] || 0;
                }
            }
            output.tiles[layer] = target;
        }
        output.events = (clipboard.events || []).map(event => {
            const clone = deepClone(event);
            clone.x = Math.min(targetWidth - 1, Math.floor(clone.x * targetWidth / clipboard.width));
            clone.y = Math.min(targetHeight - 1, Math.floor(clone.y * targetHeight / clipboard.height));
            return clone;
        });
        output.resize = { sourceWidth: clipboard.width, sourceHeight: clipboard.height,
            width: targetWidth, height: targetHeight, method: options.method || "nearest" };
        return output;
    }

    function editorSelectedRect() {
        return runtimeEditorState.selectionRect ? deepClone(runtimeEditorState.selectionRect) : editorSelectionRect();
    }

    function selectEditorArea(x, y, width, height, scene = SceneManager._scene) {
        const rect = normalizeRect(x, y, width, height);
        rect.x = Math.max(0, Math.min(editorMapWidth() - 1, rect.x));
        rect.y = Math.max(0, Math.min(editorMapHeight() - 1, rect.y));
        rect.w = Math.min(rect.w, editorMapWidth() - rect.x);
        rect.h = Math.min(rect.h, editorMapHeight() - rect.y);
        runtimeEditorState.selectionRect = rect;
        runtimeEditorState.selectionStart = null;
        editorSetMessage(`Selected ${rect.w}×${rect.h} area.`, scene);
        return deepClone(rect);
    }

    function copyEditorSelection(options = {}) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        if (runtimeEditorState.remoteMapId) return editorRemoteCopy(rect, options.includeEvents !== false);
        return copyArea(rect.x, rect.y, rect.w, rect.h, options.layers || "L1,L2,L3,L4,L5,L6,L7",
            options.includeEvents !== false);
    }

    function deleteEditorSelection(options = {}, scene = SceneManager._scene) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        let result;
        if (runtimeEditorState.remoteMapId) {
            const snapshot = runtimeEditorState.remoteSnapshot;
            const layers = parseLayerSelection(options.layers || "L1,L2,L3,L4,L5,L6").layers;
            const tiles = {};
            for (const layer of layers) tiles[layer] = new Array(rect.w * rect.h).fill(0);
            const patch = makeRectPatch(rect, layers, tiles, options.mode || "autotile", {
                affectEvents: options.includeEvents !== false,
                events: [],
                removeEventIds: options.includeEvents !== false ? spawnedEventIdsInSnapshot(snapshot.events, rect) : []
            });
            result = editorRemoteApplyPatch(patch, "deleteRemoteSelection", scene);
        } else {
            result = clearArea(rect.x, rect.y, rect.w, rect.h, options.layers || "L1,L2,L3,L4,L5,L6,L7",
                options.save !== false, options.includeEvents !== false, options.mode || "autotile");
        }
        if (result) editorSetMessage(`Deleted ${rect.w}×${rect.h} selection.`, scene);
        return result;
    }

    function pasteClipboardAt(x, y, clipboard, options = {}, scene = SceneManager._scene) {
        const previous = runtimeClipboard;
        const previousTransform = { rotation: runtimeEditorState.rotation,
            mirrorX: runtimeEditorState.mirrorX, mirrorY: runtimeEditorState.mirrorY };
        runtimeClipboard = deepClone(clipboard);
        const oldCursor = { x: runtimeEditorState.cursorX, y: runtimeEditorState.cursorY };
        runtimeEditorState.cursorX = integer(x);
        runtimeEditorState.cursorY = integer(y);
        runtimeEditorState.rotation = 0;
        runtimeEditorState.mirrorX = false;
        runtimeEditorState.mirrorY = false;
        const result = runtimeEditorState.remoteMapId
            ? editorRemotePaste(scene)
            : pasteArea(x, y, Object.assign({ save: true }, options), runtimeClipboard);
        runtimeEditorState.cursorX = oldCursor.x;
        runtimeEditorState.cursorY = oldCursor.y;
        runtimeEditorState.rotation = previousTransform.rotation;
        runtimeEditorState.mirrorX = previousTransform.mirrorX;
        runtimeEditorState.mirrorY = previousTransform.mirrorY;
        runtimeClipboard = previous;
        return result;
    }

    function transformEditorSelection(options = {}, scene = SceneManager._scene) {
        const rect = options.rect || editorSelectedRect();
        if (!rect) return false;
        const mapId = editorMapId();
        const start = (ensureStore().maps[String(mapId)] || []).length;
        const clipboard = copyEditorSelection({ rect, includeEvents: options.includeEvents !== false,
            layers: options.layers || "L1,L2,L3,L4,L5,L6,L7" });
        if (!clipboard) return false;
        const transformed = options.width || options.height
            ? resizeClipboard(transformClipboard(clipboard, options), options.width || clipboard.width, options.height || clipboard.height, options)
            : transformClipboard(clipboard, options);
        deleteEditorSelection({ rect, includeEvents: options.includeEvents !== false,
            layers: options.layers || "L1,L2,L3,L4,L5,L6,L7", save: true }, scene);
        const targetX = options.targetX === undefined ? rect.x + integer(options.dx, 0) : integer(options.targetX);
        const targetY = options.targetY === undefined ? rect.y + integer(options.dy, 0) : integer(options.targetY);
        const result = pasteClipboardAt(targetX, targetY, transformed,
            { mode: options.mode || "exact", includeEvents: options.includeEvents !== false }, scene);
        if (!result) return false;
        groupHistorySince(mapId, start, options.label || "Transform Selection");
        runtimeEditorState.selectionRect = { x: targetX, y: targetY, w: transformed.width, h: transformed.height };
        editorSetMessage(`Selection transformed to ${transformed.width}×${transformed.height}.`, scene);
        return result;
    }

    function moveEditorSelection(dx, dy, options = {}, scene = SceneManager._scene) {
        return transformEditorSelection(Object.assign({}, options, { dx, dy, label: options.label || "Move Selection" }), scene);
    }

    function cutEditorSelection(options = {}, scene = SceneManager._scene) {
        const copied = copyEditorSelection(options);
        if (!copied) return false;
        const deleted = deleteEditorSelection(options, scene);
        if (deleted) runtimeClipboard = copied;
        return deleted ? copied : false;
    }

    function transformedPoint(x, y, width, height, rotation, mirrorX, mirrorY) {
        let px = integer(x);
        let py = integer(y);
        if (mirrorX) px = width - 1 - px;
        if (mirrorY) py = height - 1 - py;
        if (rotation === 90) return { x: height - 1 - py, y: px };
        if (rotation === 180) return { x: width - 1 - px, y: height - 1 - py };
        if (rotation === 270) return { x: py, y: width - 1 - px };
        return { x: px, y: py };
    }

    function transformedDirection(direction, rotation, mirrorX, mirrorY) {
        let value = integer(direction, 2);
        if (mirrorX) value = ({ 4: 6, 6: 4 })[value] || value;
        if (mirrorY) value = ({ 2: 8, 8: 2 })[value] || value;
        const rotate90 = { 2: 4, 4: 8, 8: 6, 6: 2 };
        for (let step = 0; step < rotation / 90; step++) value = rotate90[value] || value;
        return value;
    }

    function transformClipboard(clipboard = runtimeClipboard, options = {}) {
        if (!clipboard) return null;
        const rotation = ((integer(options.rotation, 0) % 360) + 360) % 360;
        const normalizedRotation = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
        const mirrorX = toBoolean(options.mirrorX, false);
        const mirrorY = toBoolean(options.mirrorY, false);
        const sourceWidth = positiveInteger(clipboard.width);
        const sourceHeight = positiveInteger(clipboard.height);
        const targetWidth = normalizedRotation === 90 || normalizedRotation === 270 ? sourceHeight : sourceWidth;
        const targetHeight = normalizedRotation === 90 || normalizedRotation === 270 ? sourceWidth : sourceHeight;
        const output = deepClone(clipboard);
        output.width = targetWidth;
        output.height = targetHeight;
        output.tiles = {};
        for (const layer of clipboard.layers || []) {
            const source = clipboard.tiles[layer] || [];
            const target = new Array(targetWidth * targetHeight).fill(0);
            for (let y = 0; y < sourceHeight; y++) {
                for (let x = 0; x < sourceWidth; x++) {
                    const point = transformedPoint(x, y, sourceWidth, sourceHeight, normalizedRotation, mirrorX, mirrorY);
                    target[point.y * targetWidth + point.x] = source[y * sourceWidth + x] || 0;
                }
            }
            output.tiles[layer] = target;
        }
        output.events = (clipboard.events || []).map(source => {
            const event = deepClone(source);
            const point = transformedPoint(event.x, event.y, sourceWidth, sourceHeight, normalizedRotation, mirrorX, mirrorY);
            event.x = point.x;
            event.y = point.y;
            if (event.pages) {
                for (const page of event.pages) {
                    if (page && page.image && page.image.direction) {
                        page.image.direction = transformedDirection(page.image.direction, normalizedRotation, mirrorX, mirrorY);
                    }
                }
            }
            return event;
        });
        output.transform = { rotation: normalizedRotation, mirrorX, mirrorY };
        return output;
    }

    function pasteArea(x, y, options = {}, clipboard = runtimeClipboard) {
        if (!clipboard || !clipboard.width || !clipboard.height) return false;
        clipboard = transformClipboard(clipboard, options);
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, clipboard.width, clipboard.height);
        const requested = options.layers ? parseLayerSelection(options.layers).layers : clipboard.layers;
        const layers = requested.filter(key => clipboard.layers.includes(key));
        const tiles = {};
        for (const key of layers) tiles[key] = (clipboard.tiles[key] || []).slice();
        const includeEvents = !!clipboard.includeEvents && (options.includeEvents === undefined
            ? true
            : toBoolean(options.includeEvents, false));
        const events = includeEvents ? (clipboard.events || []).map(source => {
            const event = prepareTargetEventSnapshot(source);
            event.x = rect.x + integer(source.x);
            event.y = rect.y + integer(source.y);
            return event;
        }) : [];
        if (!layers.length && !includeEvents) return false;
        if (WARN_MISMATCHED_TILESET && clipboard.tilesetId !== $dataMap.tilesetId) {
            console.warn(`${PLUGIN_NAME}: clipboard tileset mismatch (${clipboard.tilesetId} -> ${$dataMap.tilesetId}).`);
        }
        const patch = makeRectPatch(rect, layers, tiles, options.mode || "exact", {
            affectEvents: includeEvents,
            events,
            removeEventIds: includeEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "pasteArea");
        return patch;
    }

    function setTile(x, y, layer, tileValue, save = true, options = {}) {
        const tileId = parseTileId(tileValue);
        const key = normalizeLayer(layer);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        if (!inBounds(point.x, point.y)) return false;
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "exact") : "exact";
        const cell = {
            x: point.x,
            y: point.y,
            tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
        };
        const patch = makeSparsePatch([cell], mode, mode === "autotile" ? [point] : null);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "setTile");
        return patch;
    }

    function fillTiles(x, y, width, height, layer, tileValue, save = true, options = {}) {
        const tileId = parseTileId(tileValue);
        const key = normalizeLayer(layer);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const layers = [key];
        const tiles = { [key]: new Array(rect.w * rect.h).fill(tileId) };
        const z = LAYER_INDEX[key];
        if (toBoolean(options.clearUpperLayers, false) && z <= 3) {
            for (let upper = z + 1; upper <= 3; upper++) {
                const upperKey = `L${upper + 1}`;
                layers.push(upperKey);
                tiles[upperKey] = new Array(rect.w * rect.h).fill(0);
            }
        }
        const patchMode = LAYER_INDEX[key] <= 3 ? (options.mode || "exact") : "exact";
        const patch = makeRectPatch(rect, layers, tiles, patchMode);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "fillTiles");
        return patch;
    }

    function clearArea(x, y, width, height, layersValue, save = true, includeEvents = false, mode = "autotile") {
        const rect = normalizeRect(x, y, width, height);
        const selection = parseLayerSelection(layersValue);
        const affectEvents = includeEvents || selection.events;
        const tiles = {};
        for (const key of selection.layers) tiles[key] = new Array(rect.w * rect.h).fill(0);
        const patch = makeRectPatch(rect, selection.layers, tiles, mode, {
            affectEvents,
            events: [],
            removeEventIds: affectEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "clearArea");
        return patch;
    }

    function revertArea(x, y, width, height, layersValue, save = true, includeEvents = false) {
        if (!currentPristine || currentPristine.mapId !== $gameMap.mapId()) {
            console.warn(`${PLUGIN_NAME}: no pristine snapshot is available for this map.`);
            return false;
        }
        const rect = normalizeRect(x, y, width, height);
        const selection = parseLayerSelection(layersValue);
        const affectEvents = includeEvents || selection.events;
        const tiles = extractRegion(currentPristine, rect, selection.layers);
        const needsAutotile = selection.layers.some(key => LAYER_INDEX[key] <= 3);
        const patch = makeRectPatch(rect, selection.layers, tiles, needsAutotile ? "autotile" : "exact", {
            affectEvents,
            events: [],
            removeEventIds: affectEvents ? spawnedEventIdsInArea(rect) : []
        });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "revertArea");
        return patch;
    }

    function undoLast(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const patches = store.maps[key];
        if (!patches || !patches.length) return false;
        store.redo[key] ||= [];
        store.redo[key].push(patches.pop());
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("undoLast");
        else emitChange({ operation: "undoLast", mapId: id, remote: true });
        return true;
    }

    function redoLast(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const redo = store.redo[key];
        if (!redo || !redo.length) return false;
        const patch = redo.pop();
        addPatch(id, patch, true);
        if (!redo.length) delete store.redo[key];
        if (id === $gameMap.mapId()) rebuildCurrentMap("redoLast");
        else emitChange({ operation: "redoLast", mapId: id, remote: true });
        return true;
    }

    function beginEditTransaction(label = "Edit Session", mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if (activeEditTransaction) return false;
        const store = ensureStore();
        const key = String(id);
        const patchesBefore = deepClone(store.maps[key] || []);
        const redoBefore = deepClone(store.redo[key] || []);
        const eventStatesBefore = deepClone(store.eventStates[key] || null);
        const mapOverrideBefore = deepClone(store.mapOverrides[key] || null);
        const snapshot = {
            mapId: id,
            label: String(label || "Edit Session"),
            startedAt: Date.now(),
            basePatchCount: patchesBefore.length,
            patchesBefore,
            redoBefore,
            eventStatesBefore,
            mapOverrideBefore
        };
        activeEditTransaction = snapshot;
        store.recovery[key] = deepClone(snapshot);
        store.redo[key] = [];
        emitChange({ operation: "beginTransaction", mapId: id, label: snapshot.label });
        return deepClone(snapshot);
    }

    function commitEditTransaction(groupChanges = true) {
        if (!activeEditTransaction) return false;
        const transaction = activeEditTransaction;
        const store = ensureStore();
        const key = String(transaction.mapId);
        const current = store.maps[key] || [];
        if (current.length < transaction.basePatchCount) return cancelEditTransaction();
        const before = current.slice(0, transaction.basePatchCount);
        const changes = current.slice(transaction.basePatchCount);
        if (groupChanges && changes.length > 1) {
            store.maps[key] = before.concat(makeBatchPatch(changes, transaction.label));
        } else {
            if (changes.length === 1) changes[0].label ||= transaction.label;
            store.maps[key] = before.concat(changes);
        }
        delete store.redo[key];
        delete store.recovery[key];
        activeEditTransaction = null;
        composedCache.delete(transaction.mapId);
        if (AUTO_CHECKPOINT_EVERY > 0 && store.maps[key] && store.maps[key].length > 0 &&
            store.maps[key].length % AUTO_CHECKPOINT_EVERY === 0) createAutomaticCheckpoint(transaction.mapId);
        emitChange({
            operation: "commitTransaction",
            mapId: transaction.mapId,
            label: transaction.label,
            groupedPatchCount: changes.length,
            historyPatchCount: store.maps[key].length
        });
        return { mapId: transaction.mapId, label: transaction.label, changes: changes.length };
    }

    function restoreHistorySnapshot(snapshot, operation) {
        if (!snapshot) return false;
        const store = ensureStore();
        const id = integer(snapshot.mapId);
        const key = String(id);
        if (snapshot.patchesBefore && snapshot.patchesBefore.length) store.maps[key] = deepClone(snapshot.patchesBefore);
        else delete store.maps[key];
        if (snapshot.redoBefore && snapshot.redoBefore.length) store.redo[key] = deepClone(snapshot.redoBefore);
        else delete store.redo[key];
        if (snapshot.eventStatesBefore) store.eventStates[key] = deepClone(snapshot.eventStatesBefore);
        else delete store.eventStates[key];
        if (snapshot.mapOverrideBefore) store.mapOverrides[key] = deepClone(snapshot.mapOverrideBefore);
        else delete store.mapOverrides[key];
        delete store.recovery[key];
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap(operation);
        else emitChange({ operation, mapId: id, remote: true });
        return true;
    }

    function cancelEditTransaction() {
        if (!activeEditTransaction) return false;
        const transaction = activeEditTransaction;
        activeEditTransaction = null;
        const restored = restoreHistorySnapshot(transaction, "cancelTransaction");
        return restored ? { mapId: transaction.mapId, label: transaction.label } : false;
    }

    function editTransactionState() {
        if (!activeEditTransaction) return null;
        const store = ensureStore();
        const key = String(activeEditTransaction.mapId);
        return Object.assign({}, deepClone(activeEditTransaction), {
            changeCount: Math.max(0, (store.maps[key] || []).length - activeEditTransaction.basePatchCount),
            undoCount: (store.redo[key] || []).length
        });
    }

    function undoTransactionChange() {
        if (!activeEditTransaction) return false;
        const key = String(activeEditTransaction.mapId);
        if ((ensureStore().maps[key] || []).length <= activeEditTransaction.basePatchCount) return false;
        return undoLast(activeEditTransaction.mapId);
    }

    function redoTransactionChange() {
        if (!activeEditTransaction) return false;
        return redoLast(activeEditTransaction.mapId);
    }

    function recoverEditTransaction(mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const recovery = ensureStore().recovery[String(id)];
        if (!recovery) return false;
        if (activeEditTransaction && activeEditTransaction.mapId === id) activeEditTransaction = null;
        return restoreHistorySnapshot(recovery, "recoverTransaction");
    }

    function discardEditRecovery(mapId = $gameMap.mapId()) {
        const key = String(integer(mapId));
        const existed = !!ensureStore().recovery[key];
        delete ensureStore().recovery[key];
        return existed;
    }

    function createCheckpoint(name, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const label = String(name || "Checkpoint").trim() || "Checkpoint";
        const store = ensureStore();
        const key = String(id);
        store.checkpoints[key] ||= {};
        store.checkpoints[key][label] = {
            name: label,
            mapId: id,
            createdAt: Date.now(),
            automatic: toBoolean(options.automatic, false),
            patches: deepClone(store.maps[key] || []),
            redo: deepClone(store.redo[key] || []),
            eventStates: deepClone(store.eventStates[key] || null),
            mapOverride: deepClone(store.mapOverrides[key] || null),
            authoringLayers: deepClone(store.authoringLayers[key] || []),
            activeAuthoringLayer: store.activeAuthoringLayers[key] || null,
            masks: deepClone(store.masks[key] || {}),
            modifiers: deepClone(store.modifiers[key] || []),
            prefabInstances: deepClone(store.prefabInstances[key] || [])
        };
        return { name: label, mapId: id, createdAt: store.checkpoints[key][label].createdAt };
    }

    function listCheckpoints(mapId = $gameMap.mapId()) {
        const bucket = ensureStore().checkpoints[String(integer(mapId))] || {};
        return Object.values(bucket).map(item => ({ name: item.name, mapId: item.mapId,
            createdAt: item.createdAt, automatic: !!item.automatic }))
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    function restoreCheckpoint(name, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const key = String(id);
        const checkpoint = (ensureStore().checkpoints[key] || {})[String(name || "")];
        if (!checkpoint) return false;
        const store = ensureStore();
        if (checkpoint.patches && checkpoint.patches.length) store.maps[key] = deepClone(checkpoint.patches);
        else delete store.maps[key];
        if (checkpoint.redo && checkpoint.redo.length) store.redo[key] = deepClone(checkpoint.redo);
        else delete store.redo[key];
        if (checkpoint.eventStates) store.eventStates[key] = deepClone(checkpoint.eventStates);
        else delete store.eventStates[key];
        if (checkpoint.mapOverride) store.mapOverrides[key] = deepClone(checkpoint.mapOverride);
        else delete store.mapOverrides[key];
        if (checkpoint.authoringLayers && checkpoint.authoringLayers.length) store.authoringLayers[key] = deepClone(checkpoint.authoringLayers);
        else delete store.authoringLayers[key];
        if (checkpoint.activeAuthoringLayer) store.activeAuthoringLayers[key] = checkpoint.activeAuthoringLayer;
        else delete store.activeAuthoringLayers[key];
        if (checkpoint.masks && Object.keys(checkpoint.masks).length) store.masks[key] = deepClone(checkpoint.masks);
        else delete store.masks[key];
        if (checkpoint.modifiers && checkpoint.modifiers.length) store.modifiers[key] = deepClone(checkpoint.modifiers);
        else delete store.modifiers[key];
        if (checkpoint.prefabInstances && checkpoint.prefabInstances.length) store.prefabInstances[key] = deepClone(checkpoint.prefabInstances);
        else delete store.prefabInstances[key];
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("restoreCheckpoint");
        else emitChange({ operation: "restoreCheckpoint", mapId: id, remote: true, checkpoint: checkpoint.name });
        return true;
    }

    function deleteCheckpoint(name, mapId = $gameMap.mapId()) {
        const key = String(integer(mapId));
        const bucket = ensureStore().checkpoints[key];
        if (!bucket || !bucket[String(name || "")]) return false;
        delete bucket[String(name || "")];
        if (!Object.keys(bucket).length) delete ensureStore().checkpoints[key];
        return true;
    }

    function resetMap(mapId = $gameMap.mapId(), save = true) {
        const id = integer(mapId);
        if (save !== false) {
            delete ensureStore().maps[String(id)];
            delete ensureStore().redo[String(id)];
            delete ensureStore().recovery[String(id)];
            delete ensureStore().mapOverrides[String(id)];
            delete ensureStore().authoringLayers[String(id)];
            delete ensureStore().activeAuthoringLayers[String(id)];
            delete ensureStore().masks[String(id)];
            delete ensureStore().modifiers[String(id)];
            delete ensureStore().prefabInstances[String(id)];
            composedCache.delete(id);
        }
        if (id === $gameMap.mapId()) {
            if (save === false) {
                const saved = ensureStore().maps[String(id)];
                ensureStore().maps[String(id)] = [];
                rebuildCurrentMap("temporaryReset");
                ensureStore().maps[String(id)] = saved || [];
            } else {
                rebuildCurrentMap("resetMap");
            }
        }
        return true;
    }

    function changeRegionId(x, y, regionId, save = true) {
        return setTile(x, y, "L6", Math.max(0, integer(regionId)), save, { mode: "exact" });
    }

    function changeTile(x, y, z, tileId, save = true, options = {}) {
        return setTile(x, y, z, tileId, save, options);
    }

    function swapArea(mapId, sourceX, sourceY, width, height, targetX, targetY, changeRegion = true, save = true, options = {}) {
        return graftArea(Object.assign({}, options, {
            sourceMapId: mapId,
            sourceX,
            sourceY,
            width,
            height,
            targetX,
            targetY,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

    function swapAreaAsync(mapId, sourceX, sourceY, width, height, targetX, targetY, changeRegion = true, save = true, options = {}) {
        return graftAreaAsync(Object.assign({}, options, {
            sourceMapId: mapId,
            sourceX,
            sourceY,
            width,
            height,
            targetX,
            targetY,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

    function swapTile(mapId, targetX, targetY, sourceX, sourceY, changeRegion = true, save = true, options = {}) {
        return swapArea(mapId, sourceX, sourceY, 1, 1, targetX, targetY, changeRegion, save, options);
    }

    function swapTileAsync(mapId, targetX, targetY, sourceX, sourceY, changeRegion = true, save = true, options = {}) {
        return swapAreaAsync(mapId, sourceX, sourceY, 1, 1, targetX, targetY, changeRegion, save, options);
    }

    function usePrefab(name, x, y, changeRegion = true, save = true, storageMapId = 0, options = {}) {
        return graftPrefab(Object.assign({}, options, {
            name,
            storageMapId,
            targetX: x,
            targetY: y,
            layers: changeRegion ? "L1,L2,L3,L4,L5,L6" : "L1,L2,L3,L4,L5",
            save
        }));
    }

    // -------------------------------------------------------------------------
    // Smart fill
    // -------------------------------------------------------------------------

    function coordinateKey(x, y) {
        return `${integer(x)},${integer(y)}`;
    }

    function allMapCoordinates(width = $dataMap.width, height = $dataMap.height) {
        const output = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) output.push({ x, y });
        return output;
    }

    function normalizeList(value) {
        if (Array.isArray(value)) return value;
        if (value === null || value === undefined || value === "") return [];
        const text = String(value).trim();
        if (text.startsWith("[")) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) return parsed.map(item => {
                    if (typeof item !== "string") return item;
                    try { return JSON.parse(item); } catch (_error) { return item; }
                });
            } catch (_error) {
                // Fall through to comma-separated parsing.
            }
        }
        return String(value).split(",").map(item => item.trim()).filter(Boolean);
    }

    function normalizeFillFilters(value) {
        const filters = Object.assign({}, parseNestedStruct(value, {}));
        filters.regions = normalizeList(filters.regions);
        filters.tileIds = normalizeList(filters.tileIds);
        filters.tileLayers = normalizeList(filters.tileLayers);
        filters.area = filters.area ? parseNestedStruct(filters.area, null) : null;
        filters.distance = Math.max(0, integer(filters.distance, 0));
        filters.hollow = toBoolean(filters.hollow, false);
        filters.scope = String(filters.scope || "origin").toLowerCase();
        filters.origin = String(filters.origin || "normal");
        return filters;
    }

    function normalizeCreepOptions(value) {
        const creep = Object.assign({}, parseNestedStruct(value, {}));
        creep.regions = normalizeList(creep.regions);
        creep.tileIds = normalizeList(creep.tileIds);
        creep.tileLayers = normalizeList(creep.tileLayers);
        creep.area = creep.area ? parseNestedStruct(creep.area, null) : null;
        creep.distance = Math.max(0, integer(creep.distance, 0));
        creep.hollow = toBoolean(creep.hollow, false);
        return creep;
    }

    function areaContains(point, area, origin) {
        if (!area) return true;
        const absolute = toBoolean(area.absolute, false);
        const baseX = absolute ? 0 : origin.x;
        const baseY = absolute ? 0 : origin.y;
        const x1 = baseX + integer(area.x1, 0);
        const y1 = baseY + integer(area.y1, 0);
        const x2 = baseX + integer(area.x2, 0);
        const y2 = baseY + integer(area.y2, 0);
        return point.x >= Math.min(x1, x2) && point.x <= Math.max(x1, x2) &&
            point.y >= Math.min(y1, y2) && point.y <= Math.max(y1, y2);
    }

    function filterCoordinates(candidates, filters, origin, data = $dataMap.data) {
        let output = candidates;
        const regions = normalizeList(filters.regions).map(Number);
        if (regions.length) {
            output = output.filter(point => regions.includes(readTile(data, $dataMap.width, $dataMap.height, point.x, point.y, 5)));
        }
        const tileIds = normalizeList(filters.tileIds).map(parseTileId).filter(id => id !== null);
        if (tileIds.length) {
            const layers = parseLayerSelection(filters.tileLayers || ["L1", "L2", "L3", "L4"]).layers;
            output = output.filter(point => layers.some(layer => {
                const current = readTile(data, $dataMap.width, $dataMap.height, point.x, point.y, LAYER_INDEX[layer]);
                return tileIds.some(tileId => sameTileType(current, tileId));
            }));
        }
        if (filters.area) output = output.filter(point => areaContains(point, filters.area, origin));
        return output;
    }

    function distanceSelection(candidates, origins, distance, excludeOrigins = false) {
        const allowed = new Set(candidates.map(point => coordinateKey(point.x, point.y)));
        const originKeys = new Set(origins.map(point => coordinateKey(point.x, point.y)));
        const visited = new Set();
        const queue = origins.map(point => ({ x: point.x, y: point.y, d: 0 }));
        let queueHead = 0;
        const output = [];
        while (queueHead < queue.length) {
            const current = queue[queueHead++];
            const key = coordinateKey(current.x, current.y);
            if (visited.has(key) || current.d > distance) continue;
            visited.add(key);
            if (!allowed.has(key)) continue;
            if (!excludeOrigins || !originKeys.has(key)) output.push({ x: current.x, y: current.y });
            if (current.d === distance) continue;
            queue.push(
                { x: current.x + 1, y: current.y, d: current.d + 1 },
                { x: current.x - 1, y: current.y, d: current.d + 1 },
                { x: current.x, y: current.y + 1, d: current.d + 1 },
                { x: current.x, y: current.y - 1, d: current.d + 1 }
            );
        }
        return output;
    }

    function hollowSelection(points) {
        const set = new Set(points.map(point => coordinateKey(point.x, point.y)));
        return points.filter(point => {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (!set.has(coordinateKey(point.x + dx, point.y + dy))) return true;
                }
            }
            return false;
        });
    }

    function selectSmartFillCoordinates(origin, filters, data = $dataMap.data) {
        const hasBroadFilter = filters.scope === "map" || filters.area || normalizeList(filters.regions).length ||
            normalizeList(filters.tileIds).length || positiveInteger(filters.distance, 0) > 0;
        let candidates = hasBroadFilter ? allMapCoordinates() : [{ x: origin.x, y: origin.y }];
        candidates = filterCoordinates(candidates, filters, origin, data);
        const distance = Math.max(0, integer(filters.distance, 0));
        if (distance > 0) candidates = distanceSelection(candidates, [origin], distance, false);
        if (toBoolean(filters.hollow, false)) candidates = hollowSelection(candidates);
        const originRule = String(filters.origin || "normal").toLowerCase();
        if (originRule === "never" || originRule === "never fill") {
            candidates = candidates.filter(point => point.x !== origin.x || point.y !== origin.y);
        } else if (originRule.includes("always") && inBounds(origin.x, origin.y)) {
            if (!candidates.some(point => point.x === origin.x && point.y === origin.y)) candidates.push(origin);
        }
        return candidates;
    }

    function sparseFillPatch(points, layer, tileId, options = {}) {
        const key = normalizeLayer(layer);
        const cells = points.map(point => ({
            x: point.x,
            y: point.y,
            tiles: cellTilesForLayer(key, tileId, toBoolean(options.clearUpperLayers, false))
        }));
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        return makeSparsePatch(cells, mode, mode === "autotile" ? points : null);
    }

    function smartFill(options = {}) {
        const tileId = parseTileId(options.tileId);
        const primaryLayer = normalizeLayer(options.layer || "L1");
        if (tileId === null || !validateLayerValue(tileId, primaryLayer)) return false;
        const origin = resolvePoint(options.x, options.y, options, options.interpreter || null);
        if (!inBounds(origin.x, origin.y)) return false;
        const filters = normalizeFillFilters(options.filters || options.filtersJson);
        const creep = normalizeCreepOptions(options.creep || options.creepJson);
        const primaryPoints = selectSmartFillCoordinates(origin, filters);
        const primaryPatch = sparseFillPatch(primaryPoints, primaryLayer, tileId, options);
        const patches = [primaryPatch];

        const creepDistance = Math.max(0, integer(creep.distance, 0));
        if (creepDistance > 0 && primaryPoints.length) {
            const simulated = $dataMap.data.slice();
            applyPatchToBuffer(primaryPatch, simulated, $dataMap.width, $dataMap.height, true);
            let creepCandidates = filterCoordinates(allMapCoordinates(), creep, origin, simulated);
            const primaryKeys = new Set(primaryPoints.map(point => coordinateKey(point.x, point.y)));
            creepCandidates = creepCandidates.filter(point => !primaryKeys.has(coordinateKey(point.x, point.y)));
            let creepPoints = distanceSelection(creepCandidates.concat(primaryPoints), primaryPoints, creepDistance, true)
                .filter(point => !primaryKeys.has(coordinateKey(point.x, point.y)));
            if (toBoolean(creep.hollow, false)) creepPoints = hollowSelection(creepPoints);
            const creepTileId = parseTileId(creep.tileId === undefined || creep.tileId === "" ? tileId : creep.tileId);
            const creepLayer = normalizeLayer(creep.layer || primaryLayer);
            if (creepTileId !== null && validateLayerValue(creepTileId, creepLayer) && creepPoints.length) {
                patches.push(sparseFillPatch(creepPoints, creepLayer, creepTileId, {
                    mode: creep.mode || options.mode || "autotile",
                    clearUpperLayers: creep.clearUpperLayers ?? options.clearUpperLayers
                }));
            }
        }

        for (const patch of patches) {
            if (options.save !== false) addPatch($gameMap.mapId(), patch);
            applyPatchLive(patch, "smartFill");
        }
        return {
            patches,
            filled: primaryPatch.cells.length,
            creeped: patches.length > 1 ? patches[1].cells.length : 0
        };
    }

    function uniqueInBoundsPoints(points) {
        const seen = new Set();
        const output = [];
        for (const point of points || []) {
            const x = integer(point.x);
            const y = integer(point.y);
            const key = coordinateKey(x, y);
            if (!seen.has(key) && inBounds(x, y)) {
                seen.add(key);
                output.push({ x, y });
            }
        }
        return output;
    }

    function paintPoints(points, layer, tileValue, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const tileId = parseTileId(tileValue);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const targets = uniqueInBoundsPoints(points);
        if (!targets.length) return false;
        const patch = sparseFillPatch(targets, key, tileId, options);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, options.operation || "paintPoints");
        return patch;
    }

    function floodFill(x, y, layer, tileValue, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const z = LAYER_INDEX[key];
        const tileId = parseTileId(tileValue);
        if (tileId === null || !validateLayerValue(tileId, key)) return false;
        const origin = resolvePoint(x, y, options, options.interpreter || null);
        if (!inBounds(origin.x, origin.y)) return false;
        const sourceTile = readTile($dataMap.data, $dataMap.width, $dataMap.height, origin.x, origin.y, z);
        const exactMatch = toBoolean(options.exactMatch, key === "L5" || key === "L6");
        const maxCells = Math.max(1, integer(options.maxCells, $dataMap.width * $dataMap.height));
        const regions = normalizeList(options.regions).map(Number);
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        const visited = new Set();
        const queue = [origin];
        let queueHead = 0;
        const points = [];
        while (queueHead < queue.length && points.length < maxCells) {
            const point = queue[queueHead++];
            const pointKey = coordinateKey(point.x, point.y);
            if (visited.has(pointKey) || !inBounds(point.x, point.y)) continue;
            visited.add(pointKey);
            const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, point.x, point.y, z);
            if (exactMatch ? current !== sourceTile : !sameTileType(current, sourceTile)) continue;
            const region = readTile($dataMap.data, $dataMap.width, $dataMap.height, point.x, point.y, 5);
            if (regions.length && !regions.includes(region)) continue;
            if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(point.x, point.y))) continue;
            points.push(point);
            queue.push(
                { x: point.x + 1, y: point.y },
                { x: point.x - 1, y: point.y },
                { x: point.x, y: point.y + 1 },
                { x: point.x, y: point.y - 1 }
            );
        }
        return paintPoints(points, key, tileId, save, Object.assign({}, options, { operation: "floodFill" }));
    }

    function replaceTiles(options = {}) {
        const key = normalizeLayer(options.layer || "L1");
        const z = LAYER_INDEX[key];
        const fromId = options.fromTileId === undefined
            ? getTileId(integer(options.x, 0), integer(options.y, 0), key)
            : parseTileId(options.fromTileId);
        const toId = parseTileId(options.toTileId ?? options.tileId);
        if (fromId === null || toId === null || !validateLayerValue(toId, key)) return false;
        const area = options.area ? parseNestedStruct(options.area, null) : null;
        const rect = area
            ? normalizeRect(area.x, area.y, area.width || area.w, area.height || area.h)
            : positiveInteger(options.width, 0) > 0 && positiveInteger(options.height, 0) > 0
                ? normalizeRect(options.x, options.y, options.width, options.height)
            : { x: 0, y: 0, w: $dataMap.width, h: $dataMap.height };
        const exactMatch = options.exactMatch !== undefined
            ? toBoolean(options.exactMatch, false)
            : options.sameType !== undefined
                ? !toBoolean(options.sameType, true)
                : key === "L5" || key === "L6";
        const regions = normalizeList(options.regions).map(Number);
        const points = [];
        for (let py = rect.y; py < rect.y + rect.h; py++) {
            for (let px = rect.x; px < rect.x + rect.w; px++) {
                if (!inBounds(px, py)) continue;
                const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, px, py, z);
                if (exactMatch ? current !== fromId : !sameTileType(current, fromId)) continue;
                if (regions.length && !regions.includes(readTile($dataMap.data, $dataMap.width, $dataMap.height, px, py, 5))) continue;
                points.push({ x: px, y: py });
            }
        }
        return paintPoints(points, key, toId, options.save !== false, Object.assign({}, options, { operation: "replaceTiles" }));
    }

    function linePoints(x1, y1, x2, y2) {
        let x = integer(x1);
        let y = integer(y1);
        const targetX = integer(x2);
        const targetY = integer(y2);
        const dx = Math.abs(targetX - x);
        const sx = x < targetX ? 1 : -1;
        const dy = -Math.abs(targetY - y);
        const sy = y < targetY ? 1 : -1;
        let error = dx + dy;
        const points = [];
        while (true) {
            points.push({ x, y });
            if (x === targetX && y === targetY) break;
            const twice = 2 * error;
            if (twice >= dy) { error += dy; x += sx; }
            if (twice <= dx) { error += dx; y += sy; }
        }
        return points;
    }

    function drawLine(x1, y1, x2, y2, layer, tileValue, save = true, options = {}) {
        return paintPoints(linePoints(x1, y1, x2, y2), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawLine" }));
    }

    function rectangleOutlinePoints(x, y, width, height) {
        const rect = normalizeRect(x, y, width, height);
        const points = [];
        for (let px = rect.x; px < rect.x + rect.w; px++) {
            points.push({ x: px, y: rect.y }, { x: px, y: rect.y + rect.h - 1 });
        }
        for (let py = rect.y + 1; py < rect.y + rect.h - 1; py++) {
            points.push({ x: rect.x, y: py }, { x: rect.x + rect.w - 1, y: py });
        }
        return uniqueInBoundsPoints(points);
    }

    function drawRectangleOutline(x, y, width, height, layer, tileValue, save = true, options = {}) {
        return paintPoints(rectangleOutlinePoints(x, y, width, height), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawRectangleOutline" }));
    }

    function circlePoints(cx, cy, radius, filled = false) {
        const r = Math.max(0, integer(radius));
        const points = [];
        for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
                const distance = Math.sqrt(x * x + y * y);
                if (filled ? distance <= r + 0.25 : Math.abs(distance - r) <= 0.55) {
                    points.push({ x: integer(cx) + x, y: integer(cy) + y });
                }
            }
        }
        return uniqueInBoundsPoints(points);
    }

    function drawCircle(cx, cy, radius, layer, tileValue, save = true, options = {}) {
        return paintPoints(circlePoints(cx, cy, radius, toBoolean(options.filled, false)), layer, tileValue, save,
            Object.assign({}, options, { operation: "drawCircle" }));
    }

    function normalizeWeightedTiles(value, layer = "L1", tilesetId = $dataMap.tilesetId) {
        let entries = value;
        if (typeof entries === "string") {
            const parsed = parseJson(entries, null);
            entries = Array.isArray(parsed) ? parsed : entries.split(",");
        }
        if (!Array.isArray(entries)) entries = [entries];
        const output = [];
        for (const entry of entries) {
            let tileValue = entry;
            let weight = 1;
            if (entry && typeof entry === "object") {
                tileValue = entry.tileId ?? entry.code ?? entry.value;
                weight = finiteNumber(entry.weight, 1);
            } else if (typeof entry === "string" && entry.includes("*")) {
                const parts = entry.split("*");
                tileValue = parts[0].trim();
                weight = finiteNumber(parts[1], 1);
            }
            const tileId = parseTileId(tileValue);
            if (tileId !== null && weight > 0 && validateLayerValue(tileId, layer, tilesetId)) output.push({ tileId, weight });
        }
        return output;
    }

    function chooseWeightedTile(entries, random = Math.random) {
        const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
        let value = random() * total;
        for (const entry of entries) {
            value -= entry.weight;
            if (value <= 0) return entry.tileId;
        }
        return entries.length ? entries[entries.length - 1].tileId : 0;
    }

    function randomFill(x, y, width, height, layer, weightedTiles, save = true, options = {}) {
        const key = normalizeLayer(layer);
        const entries = normalizeWeightedTiles(weightedTiles, key);
        if (!entries.length) return false;
        const point = resolvePoint(x, y, options, options.interpreter || null);
        const rect = normalizeRect(point.x, point.y, width, height);
        const cells = [];
        const random = typeof options.random === "function" ? options.random : Math.random;
        for (let py = rect.y; py < rect.y + rect.h; py++) {
            for (let px = rect.x; px < rect.x + rect.w; px++) {
                if (!inBounds(px, py)) continue;
                cells.push({ x: px, y: py, tiles: cellTilesForLayer(key, chooseWeightedTile(entries, random), false) });
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[key] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "randomFill");
        return patch;
    }

    // -------------------------------------------------------------------------
    // Whole-map transforms and project-wide authoring
    // -------------------------------------------------------------------------

    function normalizedRotation(value) {
        const rotation = ((integer(value, 0) % 360) + 360) % 360;
        return [0, 90, 180, 270].includes(rotation) ? rotation : 0;
    }

    function clampRectToMap(rect, width, height) {
        const x1 = Math.max(0, Math.min(width, integer(rect.x)));
        const y1 = Math.max(0, Math.min(height, integer(rect.y)));
        const x2 = Math.max(x1, Math.min(width, integer(rect.x) + positiveInteger(rect.w || rect.width, width)));
        const y2 = Math.max(y1, Math.min(height, integer(rect.y) + positiveInteger(rect.h || rect.height, height)));
        return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
    }

    function transformMapCoordinate(x, y, configuration) {
        const localX = integer(x) - configuration.crop.x;
        const localY = integer(y) - configuration.crop.y;
        const point = transformedPoint(localX, localY, configuration.crop.w, configuration.crop.h,
            configuration.rotation, configuration.mirrorX, configuration.mirrorY);
        return { x: point.x + configuration.offsetX, y: point.y + configuration.offsetY };
    }

    function transformEventCommandCoordinates(event, configuration, mapId) {
        if (!event || !Array.isArray(event.pages)) return event;
        const transformPair = (parameters, xIndex, yIndex) => {
            const point = transformMapCoordinate(parameters[xIndex], parameters[yIndex], configuration);
            parameters[xIndex] = point.x;
            parameters[yIndex] = point.y;
        };
        for (const page of event.pages) {
            if (page && page.image && page.image.direction) {
                page.image.direction = transformedDirection(page.image.direction, configuration.rotation,
                    configuration.mirrorX, configuration.mirrorY);
            }
            for (const command of page && page.list || []) {
                if (!command || !Array.isArray(command.parameters)) continue;
                const p = command.parameters;
                if (command.code === 201 && p[0] === 0 && integer(p[1]) === mapId) transformPair(p, 2, 3);
                else if (command.code === 202 && p[1] === 0 && integer(p[2]) === mapId) transformPair(p, 3, 4);
                else if (command.code === 203 && p[1] === 0) transformPair(p, 2, 3);
                else if (command.code === 285 && p[2] === 0) transformPair(p, 3, 4);
            }
        }
        return event;
    }

    function mapTransformConfiguration(snapshot, options = {}) {
        const cropValue = options.crop ? parseNestedStruct(options.crop, {}) : {
            x: 0, y: 0, w: snapshot.width, h: snapshot.height
        };
        const crop = clampRectToMap({
            x: cropValue.x || 0,
            y: cropValue.y || 0,
            w: cropValue.w || cropValue.width || snapshot.width,
            h: cropValue.h || cropValue.height || snapshot.height
        }, snapshot.width, snapshot.height);
        const rotation = normalizedRotation(options.rotation);
        const rotatedWidth = rotation === 90 || rotation === 270 ? crop.h : crop.w;
        const rotatedHeight = rotation === 90 || rotation === 270 ? crop.w : crop.h;
        const expand = parseNestedStruct(options.expand, {});
        const left = Math.max(0, integer(expand.left, 0));
        const right = Math.max(0, integer(expand.right, 0));
        const top = Math.max(0, integer(expand.top, 0));
        const bottom = Math.max(0, integer(expand.bottom, 0));
        const width = positiveInteger(options.targetWidth || options.width, rotatedWidth + left + right);
        const height = positiveInteger(options.targetHeight || options.height, rotatedHeight + top + bottom);
        let offsetX = integer(options.offsetX, left);
        let offsetY = integer(options.offsetY, top);
        const anchor = String(options.anchor || "custom").toLowerCase();
        if (anchor === "center") {
            offsetX = Math.floor((width - rotatedWidth) / 2);
            offsetY = Math.floor((height - rotatedHeight) / 2);
        } else if (anchor === "topright") offsetX = width - rotatedWidth;
        else if (anchor === "bottomleft") offsetY = height - rotatedHeight;
        else if (anchor === "bottomright") {
            offsetX = width - rotatedWidth;
            offsetY = height - rotatedHeight;
        }
        return {
            crop,
            rotation,
            mirrorX: toBoolean(options.mirrorX, false),
            mirrorY: toBoolean(options.mirrorY, false),
            rotatedWidth,
            rotatedHeight,
            width,
            height,
            offsetX,
            offsetY
        };
    }

    function transformMapSnapshot(snapshot, options = {}, mapId = 0, raw = null) {
        const config = mapTransformConfiguration(snapshot, options);
        const output = raw ? deepClone(raw) : {};
        output.width = config.width;
        output.height = config.height;
        output.tilesetId = integer(options.tilesetId, snapshot.tilesetId);
        output.note = options.note === undefined ? snapshot.note || "" : String(options.note);
        output.data = new Array(config.width * config.height * 6).fill(0);
        const fill = options.fillLayers || options.fill || {};
        for (const [layer, z] of Object.entries(LAYER_INDEX)) {
            const value = parseTileId(fill[layer] ?? 0);
            if (!value) continue;
            for (let y = 0; y < config.height; y++) {
                for (let x = 0; x < config.width; x++) writeTile(output.data, config.width, config.height, x, y, z, value);
            }
        }
        for (let sy = config.crop.y; sy < config.crop.y + config.crop.h; sy++) {
            for (let sx = config.crop.x; sx < config.crop.x + config.crop.w; sx++) {
                const target = transformMapCoordinate(sx, sy, config);
                if (!inBounds(target.x, target.y, config.width, config.height)) continue;
                for (let z = 0; z < 6; z++) {
                    writeTile(output.data, config.width, config.height, target.x, target.y, z,
                        readTile(snapshot.data, snapshot.width, snapshot.height, sx, sy, z));
                }
            }
        }
        output.events = [];
        for (const source of snapshot.events || []) {
            if (!source || !inRect(source.x, source.y, config.crop)) continue;
            const event = deepClone(source);
            const target = transformMapCoordinate(event.x, event.y, config);
            if (!inBounds(target.x, target.y, config.width, config.height)) continue;
            event.x = target.x;
            event.y = target.y;
            if (options.transformEventCommands !== false) transformEventCommandCoordinates(event, config, mapId);
            output.events[event.id] = event;
        }
        output._hybridTransform = {
            createdAt: Date.now(),
            sourceWidth: snapshot.width,
            sourceHeight: snapshot.height,
            configuration: deepClone(config)
        };
        return output;
    }

    function saveMapOverride(mapId, snapshot, options = {}) {
        const id = positiveInteger(mapId);
        const store = ensureStore();
        const key = String(id);
        if (options.checkpoint !== false) createCheckpoint(options.checkpointName || `[Transform] ${new Date().toISOString()}`, id);
        store.mapOverrides[key] = {
            width: snapshot.width,
            height: snapshot.height,
            data: snapshot.data.slice(),
            tilesetId: snapshot.tilesetId,
            note: snapshot.note || "",
            events: deepClone(snapshot.events || []),
            raw: deepClone(snapshot),
            transform: deepClone(snapshot._hybridTransform || null)
        };
        if (options.clearHistory !== false) {
            delete store.maps[key];
            delete store.redo[key];
        }
        composedCache.delete(id);
        if (id === $gameMap.mapId()) {
            rebuildCurrentMap("transformMap");
            const config = snapshot._hybridTransform && snapshot._hybridTransform.configuration;
            if (config && options.transformPlayer !== false && $gamePlayer) {
                const target = inRect($gamePlayer.x, $gamePlayer.y, config.crop)
                    ? transformMapCoordinate($gamePlayer.x, $gamePlayer.y, config)
                    : { x: Math.max(0, Math.min(snapshot.width - 1, $gamePlayer.x)),
                        y: Math.max(0, Math.min(snapshot.height - 1, $gamePlayer.y)) };
                if ($gamePlayer.locate) $gamePlayer.locate(target.x, target.y);
                else { $gamePlayer.x = target.x; $gamePlayer.y = target.y; }
            }
            if (config && options.transformVehicles !== false) {
                for (const name of ["boat", "ship", "airship"]) {
                    const vehicle = $gameMap[name] && $gameMap[name]();
                    if (!vehicle || (vehicle._mapId && vehicle._mapId !== id) || !inRect(vehicle.x, vehicle.y, config.crop)) continue;
                    const target = transformMapCoordinate(vehicle.x, vehicle.y, config);
                    if (vehicle.setLocation) vehicle.setLocation(id, target.x, target.y);
                    else if (vehicle.locate) vehicle.locate(target.x, target.y);
                }
            }
        }
        else emitChange({ operation: "transformMap", mapId: id, remote: true,
            dimensions: { width: snapshot.width, height: snapshot.height } });
        return deepClone(store.mapOverrides[key]);
    }

    function previewMapTransform(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        return Promise.all([preloadMap(id), loadRawMapJson(id)]).then(([snapshot, raw]) => {
            const config = mapTransformConfiguration(snapshot, options);
            return {
                mapId: id,
                from: { width: snapshot.width, height: snapshot.height, events: (snapshot.events || []).filter(Boolean).length },
                to: { width: config.width, height: config.height,
                    events: (snapshot.events || []).filter(event => event && inRect(event.x, event.y, config.crop)).length },
                configuration: config,
                estimatedTileWrites: config.width * config.height * 6,
                rawMetadataPreserved: !!raw
            };
        });
    }

    function transformMap(mapId = $gameMap.mapId(), options = {}) {
        const id = positiveInteger(mapId);
        if (activeEditTransaction && activeEditTransaction.mapId === id) {
            return Promise.reject(new Error(`${PLUGIN_NAME}: commit or cancel the active editor transaction before transforming the map.`));
        }
        return measureAsync("transformMap", () => Promise.all([preloadMap(id), loadRawMapJson(id)]).then(([snapshot, raw]) => {
            const transformed = transformMapSnapshot(snapshot, options, id, raw);
            const saved = saveMapOverride(id, transformed, options);
            recordOperation("transformMap", { mapId: id, width: saved.width, height: saved.height,
                configuration: transformed._hybridTransform.configuration });
            return saved;
        }), { mapId: id });
    }

    function resizeMap(mapId, width, height, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { targetWidth: width, targetHeight: height }));
    }

    function rotateMap(mapId, rotation = 90, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { rotation }));
    }

    function mirrorMap(mapId, mirrorX = true, mirrorY = false, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { mirrorX, mirrorY }));
    }

    function cropMap(mapId, x, y, width, height, options = {}) {
        return transformMap(mapId, Object.assign({}, options, { crop: { x, y, width, height } }));
    }

    async function batchTransformMaps(mapIds, options = {}) {
        const results = [];
        const errors = [];
        for (const rawId of normalizeList(mapIds)) {
            const mapId = positiveInteger(rawId, 0);
            if (!mapId) continue;
            try { results.push({ mapId, result: await transformMap(mapId, options) }); }
            catch (error) {
                errors.push({ mapId, message: error.message });
                if (options.stopOnError) break;
            }
        }
        return { results, errors, ok: errors.length === 0 };
    }
    // -------------------------------------------------------------------------
    // Procedural brushes and generators
    // -------------------------------------------------------------------------

    function seededRandom(seed = Date.now()) {
        let value = 2166136261 >>> 0;
        for (const character of String(seed)) {
            value ^= character.charCodeAt(0);
            value = Math.imul(value, 16777619);
        }
        return () => {
            value += 0x6D2B79F5;
            let result = value;
            result = Math.imul(result ^ result >>> 15, result | 1);
            result ^= result + Math.imul(result ^ result >>> 7, result | 61);
            return ((result ^ result >>> 14) >>> 0) / 4294967296;
        };
    }

    function coordinateNoise(x, y, seed = 0, scale = 1) {
        const sx = Math.floor(finiteNumber(x) / Math.max(0.001, finiteNumber(scale, 1)));
        const sy = Math.floor(finiteNumber(y) / Math.max(0.001, finiteNumber(scale, 1)));
        let hash = Math.imul(sx ^ integer(seed), 374761393) + Math.imul(sy, 668265263);
        hash = (hash ^ hash >>> 13) >>> 0;
        hash = Math.imul(hash, 1274126177) >>> 0;
        return ((hash ^ hash >>> 16) >>> 0) / 4294967295;
    }

    function maskBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.masks[key] ||= {};
        return store.masks[key] || {};
    }

    function normalizeMaskPoints(points, width = $dataMap.width, height = $dataMap.height) {
        const output = [];
        const seen = new Set();
        for (const point of points || []) {
            const x = integer(Array.isArray(point) ? point[0] : point.x);
            const y = integer(Array.isArray(point) ? point[1] : point.y);
            const key = coordinateKey(x, y);
            if (!seen.has(key) && inBounds(x, y, width, height)) {
                seen.add(key);
                output.push([x, y]);
            }
        }
        return output;
    }

    function createMask(name, points, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const label = String(name || "Mask").trim() || "Mask";
        const source = id === $gameMap.mapId() ? $dataMap : pristineCache.get(id) || composedCache.get(id);
        const width = source ? source.width : positiveInteger(options.width, 1);
        const height = source ? source.height : positiveInteger(options.height, 1);
        const mask = {
            id: String(options.id || `mask-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: label,
            mapId: id,
            width,
            height,
            points: normalizeMaskPoints(points, width, height),
            inverted: toBoolean(options.inverted, false),
            color: String(options.color || "#ffd166"),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        maskBucket(id, true)[mask.id] = mask;
        return deepClone(mask);
    }

    function createRectMask(name, x, y, width, height, mapId = $gameMap.mapId(), options = {}) {
        const rect = normalizeRect(x, y, width, height);
        const points = [];
        for (let py = rect.y; py < rect.y + rect.h; py++) for (let px = rect.x; px < rect.x + rect.w; px++) points.push([px, py]);
        return createMask(name, points, mapId, options);
    }

    function createRegionMask(name, regionIds, options = {}) {
        const mapId = integer(options.mapId, $gameMap.mapId());
        const source = mapId === $gameMap.mapId() ? getSourceMapData(mapId) : composedCache.get(mapId);
        if (!source) return false;
        const regions = new Set(normalizeList(regionIds).map(Number));
        const points = [];
        for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
            if (regions.has(readTile(source.data, source.width, source.height, x, y, 5))) points.push([x, y]);
        }
        return createMask(name, points, mapId, options);
    }

    function listMasks(mapId = $gameMap.mapId()) {
        return Object.values(maskBucket(mapId)).map(mask => Object.assign(deepClone(mask), { cellCount: (mask.points || []).length }));
    }

    function resolveMask(maskOrName, mapId = $gameMap.mapId()) {
        if (!maskOrName) return null;
        if (typeof maskOrName === "object" && Array.isArray(maskOrName.points)) return maskOrName;
        const query = String(maskOrName).toLowerCase();
        return Object.values(maskBucket(mapId)).find(mask => mask.id === String(maskOrName) || mask.name.toLowerCase() === query) || null;
    }

    function maskContains(maskOrName, x, y, mapId = $gameMap.mapId()) {
        const mask = resolveMask(maskOrName, mapId);
        if (!mask) return false;
        if (!mask._pointSet) Object.defineProperty(mask, "_pointSet", {
            value: new Set((mask.points || []).map(point => coordinateKey(point[0], point[1]))),
            writable: true,
            configurable: true,
            enumerable: false
        });
        const contains = mask._pointSet.has(coordinateKey(integer(x), integer(y)));
        return mask.inverted ? !contains : contains;
    }

    function updateMask(maskId, changes = {}, mapId = $gameMap.mapId()) {
        const mask = resolveMask(maskId, mapId);
        if (!mask) return false;
        if (changes.name !== undefined) mask.name = String(changes.name || mask.name);
        if (changes.color !== undefined) mask.color = String(changes.color || mask.color);
        if (changes.inverted !== undefined) mask.inverted = toBoolean(changes.inverted, false);
        if (changes.points !== undefined) {
            mask.points = normalizeMaskPoints(changes.points, mask.width, mask.height);
            if (mask._pointSet) mask._pointSet = new Set(mask.points.map(point => coordinateKey(point[0], point[1])));
        }
        mask.updatedAt = Date.now();
        return deepClone(mask);
    }

    function combineMasks(name, firstMask, secondMask, operation = "union", mapId = $gameMap.mapId()) {
        const first = resolveMask(firstMask, mapId);
        const second = resolveMask(secondMask, mapId);
        if (!first || !second) return false;
        const a = new Set((first.points || []).map(point => coordinateKey(point[0], point[1])));
        const b = new Set((second.points || []).map(point => coordinateKey(point[0], point[1])));
        const keys = operation === "intersect" ? [...a].filter(key => b.has(key))
            : operation === "subtract" ? [...a].filter(key => !b.has(key))
                : [...new Set([...a, ...b])];
        return createMask(name, keys.map(key => key.split(",").map(Number)), mapId, { color: first.color });
    }

    function deleteMask(maskId, mapId = $gameMap.mapId()) {
        const bucket = maskBucket(mapId);
        const mask = resolveMask(maskId, mapId);
        if (!mask) return false;
        delete bucket[mask.id];
        return true;
    }

    function proceduralPointAllowed(x, y, options, randomValue) {
        if (options.mask && !maskContains(options.mask, x, y, options.mapId || $gameMap.mapId())) return false;
        if (options.excludeMask && maskContains(options.excludeMask, x, y, options.mapId || $gameMap.mapId())) return false;
        const regions = normalizeList(options.regions).map(Number);
        if (regions.length && !regions.includes(readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, 5))) return false;
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(x, y))) return false;
        if (options.passable !== undefined && $gameMap.isPassable) {
            const passable = [2, 4, 6, 8].some(direction => $gameMap.isPassable(x, y, direction));
            if (passable !== toBoolean(options.passable, true)) return false;
        }
        const density = Math.max(0, Math.min(1, finiteNumber(options.density, 1)));
        if (randomValue > density) return false;
        if (options.falloff) {
            const falloff = parseNestedStruct(options.falloff, {});
            const centerX = finiteNumber(falloff.x, integer(options.x) + finiteNumber(options.width, $dataMap.width) / 2);
            const centerY = finiteNumber(falloff.y, integer(options.y) + finiteNumber(options.height, $dataMap.height) / 2);
            const radius = Math.max(0.001, finiteNumber(falloff.radius, Math.max(options.width || $dataMap.width, options.height || $dataMap.height) / 2));
            const distance = Math.hypot(x - centerX, y - centerY) / radius;
            const strength = Math.pow(Math.max(0, 1 - distance), Math.max(0.01, finiteNumber(falloff.power, 1)));
            if (randomValue > density * strength) return false;
        }
        return true;
    }

    function proceduralFill(options = {}) {
        const layer = normalizeLayer(options.layer || "L1");
        const entries = normalizeWeightedTiles(options.weightedTiles || options.tiles || options.tileId, layer);
        if (!entries.length) return false;
        const rect = options.area ? normalizeRect(options.area.x, options.area.y,
            options.area.w || options.area.width, options.area.h || options.area.height)
            : normalizeRect(options.x || 0, options.y || 0,
                options.width || $dataMap.width, options.height || $dataMap.height);
        const random = typeof options.random === "function" ? options.random : seededRandom(options.seed ?? Date.now());
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const noise = options.noiseScale
                    ? coordinateNoise(x, y, options.seed || 0, options.noiseScale)
                    : random();
                if (!proceduralPointAllowed(x, y, options, noise)) continue;
                cells.push({ x, y, tiles: cellTilesForLayer(layer, chooseWeightedTile(entries, random), false) });
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Procedural Fill");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "proceduralFill");
        return patch;
    }

    function scatterTiles(options = {}) {
        return proceduralFill(Object.assign({ density: 0.2, label: "Scatter Tiles" }, options));
    }

    function generateBiome(options = {}) {
        const bands = (Array.isArray(options.bands) ? options.bands : parseJson(options.bands, []))
            .map(band => ({ threshold: finiteNumber(band.threshold, 1), tileId: parseTileId(band.tileId), weight: finiteNumber(band.weight, 1) }))
            .filter(band => band.tileId !== null).sort((a, b) => a.threshold - b.threshold);
        if (!bands.length) return false;
        const layer = normalizeLayer(options.layer || "L1");
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const value = coordinateNoise(x, y, options.seed || 0, options.scale || 4);
                const band = bands.find(item => value <= item.threshold) || bands[bands.length - 1];
                cells.push({ x, y, tiles: cellTilesForLayer(layer, band.tileId, false) });
            }
        }
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Biome");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateBiome");
        return patch;
    }

    function paintPattern(x, y, pattern, options = {}) {
        const source = typeof pattern === "string" ? parseJson(pattern, null) : pattern;
        if (!source) return false;
        const layers = source.layers || { [normalizeLayer(options.layer || "L1")]: source.tiles || source.data || source };
        const width = positiveInteger(source.width || source.w, Array.isArray(source[0]) ? source[0].length : 1);
        const height = positiveInteger(source.height || source.h, Array.isArray(source) ? source.length : 1);
        const repeatX = Math.max(1, integer(options.repeatX, 1));
        const repeatY = Math.max(1, integer(options.repeatY, 1));
        const cells = [];
        for (let ry = 0; ry < repeatY; ry++) {
            for (let rx = 0; rx < repeatX; rx++) {
                for (let py = 0; py < height; py++) {
                    for (let px = 0; px < width; px++) {
                        const tx = integer(x) + rx * width + px;
                        const ty = integer(y) + ry * height + py;
                        if (!inBounds(tx, ty)) continue;
                        const tiles = {};
                        for (const [layer, values] of Object.entries(layers)) {
                            const key = normalizeLayer(layer);
                            const flat = Array.isArray(values[0]) ? values.flat() : values;
                            const tileId = parseTileId(flat[py * width + px]);
                            if (tileId !== null && validateLayerValue(tileId, key)) tiles[key] = tileId;
                        }
                        if (Object.keys(tiles).length) cells.push({ x: tx, y: ty, tiles });
                    }
                }
            }
        }
        if (!cells.length) return false;
        const patch = makeSparsePatch(cells, normalizeMode(options.mode, "exact"), options.mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Pattern Brush");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "paintPattern");
        return patch;
    }

    function neighborTile(data, width, height, x, y, z, direction) {
        const shifts = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
            northwest: [-1, -1], northeast: [1, -1], southwest: [-1, 1], southeast: [1, 1] };
        const shift = shifts[direction] || [0, 0];
        return readTile(data, width, height, x + shift[0], y + shift[1], z);
    }

    function applyRuleTiles(options = {}) {
        const rules = Array.isArray(options.rules) ? options.rules : parseJson(options.rules, []);
        const layer = normalizeLayer(options.layer || "L1");
        const z = LAYER_INDEX[layer];
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const source = $dataMap.data.slice();
        const random = seededRandom(options.seed || 0);
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                for (const rule of rules) {
                    const when = rule.when || {};
                    const center = readTile(source, $dataMap.width, $dataMap.height, x, y, z);
                    if (when.center !== undefined && !sameTileType(center, parseTileId(when.center))) continue;
                    let matches = true;
                    for (const direction of ["north", "south", "west", "east", "northwest", "northeast", "southwest", "southeast"]) {
                        if (when[direction] === undefined) continue;
                        const expected = parseTileId(when[direction]);
                        if (!sameTileType(neighborTile(source, $dataMap.width, $dataMap.height, x, y, z, direction), expected)) matches = false;
                    }
                    if (!matches) continue;
                    if (when.region !== undefined && readTile(source, $dataMap.width, $dataMap.height, x, y, 5) !== integer(when.region)) continue;
                    if (finiteNumber(rule.chance, 1) < random()) continue;
                    const tileId = parseTileId(rule.tileId ?? rule.output);
                    if (tileId !== null) cells.push({ x, y, tiles: cellTilesForLayer(layer, tileId, false) });
                    break;
                }
            }
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Rule Tiles");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "applyRuleTiles");
        return patch;
    }

    function pathBrushPoints(points, width = 1) {
        const radius = Math.max(0, Math.floor((positiveInteger(width) - 1) / 2));
        const output = [];
        for (const point of points) {
            for (let y = -radius; y <= radius; y++) {
                for (let x = -radius; x <= radius; x++) output.push({ x: point.x + x, y: point.y + y });
            }
        }
        return uniqueInBoundsPoints(output);
    }

    function generatePath(options = {}) {
        const waypoints = Array.isArray(options.points) ? options.points : parseJson(options.points, []);
        if (waypoints.length < 2) return false;
        const random = seededRandom(options.seed || 0);
        const center = [];
        for (let index = 1; index < waypoints.length; index++) {
            const segment = linePoints(waypoints[index - 1].x, waypoints[index - 1].y, waypoints[index].x, waypoints[index].y);
            for (let step = 0; step < segment.length; step++) {
                const point = Object.assign({}, segment[step]);
                const meander = Math.max(0, integer(options.meander, 0));
                if (meander && step > 0 && step < segment.length - 1) {
                    point.x += Math.round((random() - 0.5) * meander * 2);
                    point.y += Math.round((random() - 0.5) * meander * 2);
                }
                center.push(point);
            }
        }
        const layer = normalizeLayer(options.layer || "L1");
        const tileId = parseTileId(options.tileId);
        if (tileId === null) return false;
        const cellsByPoint = new Map();
        const borderTileId = options.borderTileId === undefined ? null : parseTileId(options.borderTileId);
        if (borderTileId !== null) {
            for (const point of pathBrushPoints(center, positiveInteger(options.width, 1) + positiveInteger(options.borderWidth, 1) * 2)) {
                cellsByPoint.set(coordinateKey(point.x, point.y), { x: point.x, y: point.y,
                    tiles: cellTilesForLayer(layer, borderTileId, false) });
            }
        }
        for (const point of pathBrushPoints(center, options.width || 1)) {
            cellsByPoint.set(coordinateKey(point.x, point.y), { x: point.x, y: point.y,
                tiles: cellTilesForLayer(layer, tileId, false) });
        }
        const cells = Array.from(cellsByPoint.values());
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Path");
        patch.seed = options.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, options.operation || "generatePath");
        return patch;
    }

    function generateRoad(options = {}) {
        return generatePath(Object.assign({ label: "Generate Road", operation: "generateRoad" }, options));
    }

    function generateRiver(options = {}) {
        return generatePath(Object.assign({ label: "Generate River", operation: "generateRiver", meander: 1 }, options));
    }

    function generateRoom(options = {}) {
        const rect = normalizeRect(options.x, options.y, options.width, options.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        const wallTile = parseTileId(options.wallTileId);
        if (floorTile === null || wallTile === null) return false;
        const doors = new Set((Array.isArray(options.doors) ? options.doors : parseJson(options.doors, []))
            .map(point => coordinateKey(integer(point.x), integer(point.y))));
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const border = x === rect.x || y === rect.y || x === rect.x + rect.w - 1 || y === rect.y + rect.h - 1;
                const value = border && !doors.has(coordinateKey(x, y)) ? wallTile : floorTile;
                cells.push({ x, y, tiles: cellTilesForLayer(layer, value, false) });
            }
        }
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Room");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateRoom");
        return patch;
    }

    function generateDungeon(options = {}) {
        const area = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        const wallTile = parseTileId(options.wallTileId);
        if (floorTile === null || wallTile === null || area.w < 5 || area.h < 5) return false;
        const random = seededRandom(options.seed ?? Date.now());
        const roomTarget = Math.max(1, integer(options.roomCount, Math.max(3, Math.floor(area.w * area.h / 160))));
        const minWidth = Math.max(3, integer(options.minRoomWidth, 4));
        const minHeight = Math.max(3, integer(options.minRoomHeight, 4));
        const maxWidth = Math.max(minWidth, integer(options.maxRoomWidth, Math.min(10, area.w - 2)));
        const maxHeight = Math.max(minHeight, integer(options.maxRoomHeight, Math.min(8, area.h - 2)));
        const padding = Math.max(0, integer(options.roomPadding, 1));
        const rooms = [];
        const attempts = Math.max(roomTarget * 12, integer(options.attempts, 40));
        for (let attempt = 0; attempt < attempts && rooms.length < roomTarget; attempt++) {
            const w = Math.min(area.w - 2, minWidth + Math.floor(random() * (maxWidth - minWidth + 1)));
            const h = Math.min(area.h - 2, minHeight + Math.floor(random() * (maxHeight - minHeight + 1)));
            if (w < 3 || h < 3) continue;
            const x = area.x + 1 + Math.floor(random() * Math.max(1, area.w - w - 1));
            const y = area.y + 1 + Math.floor(random() * Math.max(1, area.h - h - 1));
            const candidate = { x, y, w, h, centerX: x + Math.floor(w / 2), centerY: y + Math.floor(h / 2) };
            if (rooms.some(room => candidate.x - padding < room.x + room.w && candidate.x + candidate.w + padding > room.x &&
                candidate.y - padding < room.y + room.h && candidate.y + candidate.h + padding > room.y)) continue;
            rooms.push(candidate);
        }
        if (!rooms.length) return false;
        const values = new Map();
        const put = (x, y, tileId) => {
            if (inBounds(x, y) && inRect(x, y, area)) values.set(coordinateKey(x, y), { x, y, tiles: cellTilesForLayer(layer, tileId, false) });
        };
        if (options.fillWalls !== false) for (let y = area.y; y < area.y + area.h; y++) {
            for (let x = area.x; x < area.x + area.w; x++) put(x, y, wallTile);
        }
        for (const room of rooms) for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
            for (let x = room.x + 1; x < room.x + room.w - 1; x++) put(x, y, floorTile);
        }
        const corridorWidth = Math.max(1, integer(options.corridorWidth, 1));
        for (let index = 1; index < rooms.length; index++) {
            const previous = rooms[index - 1];
            const current = rooms[index];
            const horizontalFirst = random() < 0.5;
            const waypoints = horizontalFirst
                ? [{ x: previous.centerX, y: previous.centerY }, { x: current.centerX, y: previous.centerY }, { x: current.centerX, y: current.centerY }]
                : [{ x: previous.centerX, y: previous.centerY }, { x: previous.centerX, y: current.centerY }, { x: current.centerX, y: current.centerY }];
            const points = [];
            for (let pointIndex = 1; pointIndex < waypoints.length; pointIndex++) {
                points.push(...linePoints(waypoints[pointIndex - 1].x, waypoints[pointIndex - 1].y,
                    waypoints[pointIndex].x, waypoints[pointIndex].y));
            }
            for (const point of pathBrushPoints(points, corridorWidth)) put(point.x, point.y, floorTile);
        }
        const regionId = integer(options.regionId, 0);
        if (regionId > 0) for (const cell of values.values()) {
            if (cell.tiles[layer] === floorTile) cell.tiles.L6 = Math.min(255, regionId);
        }
        const cells = Array.from(values.values());
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Dungeon");
        patch.seed = options.seed;
        patch.rooms = rooms.map(deepClone);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateDungeon");
        return patch;
    }

    function replaceByProperties(options = {}) {
        const layers = parseLayerSelection(options.layers || options.layer || "L1").layers;
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const regions = normalizeList(options.regions).map(Number);
        const terrainTags = normalizeList(options.terrainTags).map(Number);
        const tileIds = normalizeList(options.tileIds).map(parseTileId).filter(value => value !== null);
        const replacements = options.replacements || {};
        const cells = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) {
            for (let x = rect.x; x < rect.x + rect.w; x++) {
                if (!inBounds(x, y)) continue;
                const region = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, 5);
                if (regions.length && !regions.includes(region)) continue;
                if (terrainTags.length && $gameMap.terrainTag && !terrainTags.includes($gameMap.terrainTag(x, y))) continue;
                if (options.passable !== undefined && $gameMap.isPassable) {
                    const passable = [2, 4, 6, 8].some(direction => $gameMap.isPassable(x, y, direction));
                    if (passable !== toBoolean(options.passable, true)) continue;
                }
                const tiles = {};
                for (const layer of layers) {
                    const current = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, LAYER_INDEX[layer]);
                    if (tileIds.length && !tileIds.some(value => sameTileType(current, value))) continue;
                    const replacement = parseTileId(replacements[layer] ?? options.tileId ?? options.toTileId);
                    if (replacement !== null) tiles[layer] = replacement;
                }
                if (Object.keys(tiles).length) cells.push({ x, y, tiles });
            }
        }
        if (!cells.length) return false;
        const patch = makeSparsePatch(cells, normalizeMode(options.mode, "autotile"), options.mode === "exact" ? null : cells);
        patch.label = String(options.label || "Replace By Properties");
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "replaceByProperties");
        return patch;
    }

    function modifierBucket(mapId, create = false) {
        const store = ensureStore();
        const key = String(integer(mapId));
        if (create) store.modifiers[key] ||= [];
        return store.modifiers[key] || [];
    }

    function executeModifier(type, options = {}) {
        const kind = String(type || "").toLowerCase();
        if (kind === "fill" || kind === "proceduralfill") return proceduralFill(options);
        if (kind === "scatter" || kind === "scattertiles") return scatterTiles(options);
        if (kind === "biome" || kind === "generatebiome") return generateBiome(options);
        if (kind === "climate" || kind === "climatebiome" || kind === "generateclimatebiome") return generateClimateBiome(options);
        if (kind === "rules" || kind === "applyruletiles") return applyRuleTiles(options);
        if (kind === "path" || kind === "generatepath") return generatePath(options);
        if (kind === "road" || kind === "generateroad") return generateRoad(options);
        if (kind === "terrainroad" || kind === "generateterrainroad") return generateTerrainRoad(options);
        if (kind === "river" || kind === "generateriver") return generateRiver(options);
        if (kind === "downhillriver" || kind === "generatedownhillriver") return generateDownhillRiver(options);
        if (kind === "room" || kind === "generateroom") return generateRoom(options);
        if (kind === "dungeon" || kind === "generatedungeon") return generateDungeon(options);
        if (kind === "validateddungeon" || kind === "generatevalidateddungeon") return generateValidatedDungeon(options);
        if (kind === "replace" || kind === "replacebyproperties") return replaceByProperties(options);
        if (kind === "wfc" || kind === "wavefunctioncollapse" || kind === "generatewavefunctionmap") return generateWaveFunctionMap(options);
        return false;
    }

    function addModifier(type, options = {}, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        if (id !== $gameMap.mapId()) return false;
        const modifier = {
            id: String(options.id || `modifier-${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            name: String(options.name || type || "Modifier"),
            type: String(type || "proceduralFill"),
            options: deepClone(options),
            enabled: options.enabled !== false,
            authoringLayerId: options.authoringLayerId || (activeAuthoringLayer(id) || {}).id || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastRunAt: 0,
            lastResult: null
        };
        delete modifier.options.id;
        delete modifier.options.name;
        modifierBucket(id, true).push(modifier);
        const result = regenerateModifier(modifier.id, id);
        return result ? deepClone(modifier) : false;
    }

    function listModifiers(mapId = $gameMap.mapId()) {
        const patches = getPatches(mapId);
        return modifierBucket(mapId).map(modifier => Object.assign(deepClone(modifier), {
            patchCount: patches.filter(patch => patch && patch.modifierId === modifier.id).length
        }));
    }

    function resolveModifier(modifierId, mapId = $gameMap.mapId()) {
        const query = String(modifierId || "").toLowerCase();
        return modifierBucket(mapId).find(item => item.id === String(modifierId) || item.name.toLowerCase() === query) || null;
    }

    function regenerateModifier(modifierId, mapId = $gameMap.mapId(), optionChanges = null) {
        const id = integer(mapId);
        if (id !== $gameMap.mapId()) return false;
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        if (optionChanges) modifier.options = Object.assign(modifier.options || {}, deepClone(optionChanges));
        const store = ensureStore();
        const key = String(id);
        store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.modifierId !== modifier.id);
        composedCache.delete(id);
        rebuildCurrentMap("prepareModifierRegeneration");
        if (modifier.enabled === false) {
            modifier.updatedAt = Date.now();
            return deepClone(modifier);
        }
        const previousLayer = store.activeAuthoringLayers[key] || null;
        if (modifier.authoringLayerId) store.activeAuthoringLayers[key] = modifier.authoringLayerId;
        else delete store.activeAuthoringLayers[key];
        let result;
        try {
            result = guardedOperation(`modifier:${modifier.type}`, () => executeModifier(modifier.type,
                Object.assign({}, deepClone(modifier.options), { save: true })), { mapId: id, modifierId: modifier.id });
        } finally {
            if (previousLayer) store.activeAuthoringLayers[key] = previousLayer;
            else delete store.activeAuthoringLayers[key];
        }
        if (!result || (result && typeof result.then === "function")) return false;
        result.modifierId = modifier.id;
        modifier.lastRunAt = Date.now();
        modifier.updatedAt = Date.now();
        modifier.lastResult = { kind: result.kind || "patch", writes: patchWriteCount(result), seed: modifier.options.seed };
        recordOperation("regenerateModifier", { mapId: id, modifierId: modifier.id, type: modifier.type });
        return deepClone(modifier);
    }

    function setModifierEnabled(modifierId, enabled, mapId = $gameMap.mapId()) {
        const id = integer(mapId);
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        modifier.enabled = enabled !== false;
        modifier.updatedAt = Date.now();
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap("setModifierEnabled");
        return deepClone(modifier);
    }

    function updateModifier(modifierId, changes = {}, mapId = $gameMap.mapId(), regenerate = true) {
        const modifier = resolveModifier(modifierId, mapId);
        if (!modifier) return false;
        if (changes.name !== undefined) modifier.name = String(changes.name || modifier.name);
        if (changes.options) modifier.options = Object.assign(modifier.options || {}, deepClone(changes.options));
        if (changes.authoringLayerId !== undefined) modifier.authoringLayerId = changes.authoringLayerId || null;
        if (changes.enabled !== undefined) modifier.enabled = changes.enabled !== false;
        modifier.updatedAt = Date.now();
        return regenerate && integer(mapId) === $gameMap.mapId()
            ? regenerateModifier(modifier.id, mapId)
            : deepClone(modifier);
    }

    function deleteModifier(modifierId, mapId = $gameMap.mapId(), options = {}) {
        const id = integer(mapId);
        const store = ensureStore();
        const key = String(id);
        const modifier = resolveModifier(modifierId, id);
        if (!modifier) return false;
        let affected = 0;
        for (const patch of store.maps[key] || []) if (patch && patch.modifierId === modifier.id) {
            if (options.bake === true) delete patch.modifierId;
            affected++;
        }
        if (options.bake !== true) store.maps[key] = (store.maps[key] || []).filter(patch => !patch || patch.modifierId !== modifier.id);
        store.modifiers[key] = modifierBucket(id).filter(item => item.id !== modifier.id);
        composedCache.delete(id);
        if (id === $gameMap.mapId()) rebuildCurrentMap(options.bake === true ? "bakeModifier" : "deleteModifier");
        return { mapId: id, modifierId: modifier.id, affectedPatches: affected, baked: options.bake === true };
    }

    function previewModifier(type, options = {}, mapId = $gameMap.mapId()) {
        const width = integer(options.width, $dataMap.width);
        const height = integer(options.height, $dataMap.height);
        return {
            type: String(type),
            mapId: integer(mapId),
            bounds: normalizeRect(options.x || 0, options.y || 0, width, height),
            estimatedCells: Math.max(0, width * height * finiteNumber(options.density, 1)),
            seed: options.seed,
            mask: options.mask || null,
            valid: !!String(type || "").trim()
        };
    }

    function generateTerrainFields(options = {}) {
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const seed = options.seed ?? 0;
        const octaves = Math.max(1, Math.min(8, integer(options.octaves, 4)));
        const persistence = Math.max(0.05, Math.min(1, finiteNumber(options.persistence, 0.5)));
        const field = (name, scale, offset) => {
            const values = new Array(rect.w * rect.h).fill(0);
            let minimum = Infinity;
            let maximum = -Infinity;
            for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
                let value = 0;
                let amplitude = 1;
                let totalAmplitude = 0;
                let frequency = 1;
                for (let octave = 0; octave < octaves; octave++) {
                    value += coordinateNoise(rect.x + x + offset, rect.y + y - offset,
                        `${seed}:${name}:${octave}`.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0),
                        Math.max(0.25, scale / frequency)) * amplitude;
                    totalAmplitude += amplitude;
                    amplitude *= persistence;
                    frequency *= 2;
                }
                value /= totalAmplitude || 1;
                values[y * rect.w + x] = value;
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
            return { values, min: minimum, max: maximum };
        };
        return {
            format: "HybridTileGraftTerrainFields",
            version: 1,
            rect,
            seed,
            height: field("height", finiteNumber(options.heightScale, 12), 0),
            moisture: field("moisture", finiteNumber(options.moistureScale, 9), 173),
            temperature: field("temperature", finiteNumber(options.temperatureScale, 18), 719)
        };
    }

    function generateClimateBiome(options = {}) {
        const fields = options.fields || generateTerrainFields(options);
        const zones = (Array.isArray(options.zones) ? options.zones : parseJson(options.zones, []))
            .map(zone => Object.assign({}, zone, { tileId: parseTileId(zone.tileId) })).filter(zone => zone.tileId !== null);
        if (!zones.length) return false;
        const layer = normalizeLayer(options.layer || "L1");
        const cells = [];
        for (let y = 0; y < fields.rect.h; y++) for (let x = 0; x < fields.rect.w; x++) {
            const index = y * fields.rect.w + x;
            const sample = {
                height: fields.height.values[index],
                moisture: fields.moisture.values[index],
                temperature: fields.temperature.values[index]
            };
            const zone = zones.find(item =>
                (item.minHeight === undefined || sample.height >= finiteNumber(item.minHeight)) &&
                (item.maxHeight === undefined || sample.height <= finiteNumber(item.maxHeight)) &&
                (item.minMoisture === undefined || sample.moisture >= finiteNumber(item.minMoisture)) &&
                (item.maxMoisture === undefined || sample.moisture <= finiteNumber(item.maxMoisture)) &&
                (item.minTemperature === undefined || sample.temperature >= finiteNumber(item.minTemperature)) &&
                (item.maxTemperature === undefined || sample.temperature <= finiteNumber(item.maxTemperature))) || zones[zones.length - 1];
            const tx = fields.rect.x + x;
            const ty = fields.rect.y + y;
            if (proceduralPointAllowed(tx, ty, options, 0)) cells.push({ x: tx, y: ty, tiles: cellTilesForLayer(layer, zone.tileId, false) });
        }
        if (!cells.length) return false;
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Generate Climate Biome");
        patch.seed = fields.seed;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateClimateBiome");
        return patch;
    }

    function findTerrainPath(start, goal, options = {}) {
        const source = options.mapData || $dataMap;
        const startPoint = { x: integer(start.x), y: integer(start.y) };
        const goalPoint = { x: integer(goal.x), y: integer(goal.y) };
        if (!inBounds(startPoint.x, startPoint.y, source.width, source.height) ||
            !inBounds(goalPoint.x, goalPoint.y, source.width, source.height)) return [];
        const open = [{ point: startPoint, f: 0 }];
        const cameFrom = new Map();
        const g = new Map([[coordinateKey(startPoint.x, startPoint.y), 0]]);
        const closed = new Set();
        const heightField = options.heightField;
        const heightAt = (x, y) => {
            if (!heightField || !heightField.rect || !inRect(x, y, heightField.rect)) return 0;
            return heightField.height.values[(y - heightField.rect.y) * heightField.rect.w + (x - heightField.rect.x)] || 0;
        };
        const allowedRegions = new Set(normalizeList(options.allowedRegions).map(Number));
        const blockedRegions = new Set(normalizeList(options.blockedRegions).map(Number));
        const maximum = Math.max(100, integer(options.maxIterations, source.width * source.height * 8));
        let iterations = 0;
        while (open.length && iterations++ < maximum) {
            open.sort((a, b) => a.f - b.f);
            const current = open.shift().point;
            const currentKey = coordinateKey(current.x, current.y);
            if (closed.has(currentKey)) continue;
            if (current.x === goalPoint.x && current.y === goalPoint.y) {
                const path = [current];
                let key = currentKey;
                while (cameFrom.has(key)) {
                    const previous = cameFrom.get(key);
                    path.push(previous);
                    key = coordinateKey(previous.x, previous.y);
                }
                return path.reverse();
            }
            closed.add(currentKey);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const next = { x: current.x + dx, y: current.y + dy };
                if (!inBounds(next.x, next.y, source.width, source.height)) continue;
                if (options.mask && !maskContains(options.mask, next.x, next.y, options.mapId || $gameMap.mapId())) continue;
                const region = readTile(source.data, source.width, source.height, next.x, next.y, 5);
                if (allowedRegions.size && !allowedRegions.has(region)) continue;
                if (blockedRegions.has(region)) continue;
                const terrainPenalty = normalizeList(options.avoidTerrainTags).map(Number)
                    .includes($gameMap.terrainTag ? $gameMap.terrainTag(next.x, next.y) : 0) ? finiteNumber(options.avoidPenalty, 20) : 0;
                const slopePenalty = Math.abs(heightAt(next.x, next.y) - heightAt(current.x, current.y)) * finiteNumber(options.slopeCost, 10);
                const tentative = (g.get(currentKey) || 0) + 1 + terrainPenalty + slopePenalty;
                const nextKey = coordinateKey(next.x, next.y);
                if (tentative >= (g.get(nextKey) ?? Infinity)) continue;
                cameFrom.set(nextKey, current);
                g.set(nextKey, tentative);
                const heuristic = Math.abs(goalPoint.x - next.x) + Math.abs(goalPoint.y - next.y);
                open.push({ point: next, f: tentative + heuristic });
            }
        }
        return [];
    }

    function generateTerrainRoad(options = {}) {
        const start = options.start || { x: options.x1, y: options.y1 };
        const goal = options.goal || { x: options.x2, y: options.y2 };
        const fields = options.fields || (options.useHeight ? generateTerrainFields(options) : null);
        const points = findTerrainPath(start, goal, Object.assign({}, options, { heightField: fields }));
        if (points.length < 2) return false;
        return generateRoad(Object.assign({}, options, { points, label: options.label || "Generate Terrain Road" }));
    }

    function generateDownhillRiver(options = {}) {
        const fields = options.fields || generateTerrainFields(options);
        let current = options.start ? { x: integer(options.start.x), y: integer(options.start.y) } : null;
        if (!current) {
            let best = -Infinity;
            for (let y = 0; y < fields.rect.h; y++) for (let x = 0; x < fields.rect.w; x++) {
                const value = fields.height.values[y * fields.rect.w + x];
                if (value > best) { best = value; current = { x: fields.rect.x + x, y: fields.rect.y + y }; }
            }
        }
        if (!current) return false;
        const random = seededRandom(options.seed || fields.seed);
        const points = [current];
        const visited = new Set([coordinateKey(current.x, current.y)]);
        const heightAt = point => {
            if (!inRect(point.x, point.y, fields.rect)) return -1;
            return fields.height.values[(point.y - fields.rect.y) * fields.rect.w + point.x - fields.rect.x];
        };
        const maxLength = Math.max(2, integer(options.maxLength, fields.rect.w + fields.rect.h));
        for (let step = 1; step < maxLength; step++) {
            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
                .map(([dx, dy]) => ({ x: current.x + dx, y: current.y + dy }))
                .filter(point => inRect(point.x, point.y, fields.rect) && !visited.has(coordinateKey(point.x, point.y)));
            if (!neighbors.length) break;
            neighbors.sort((a, b) => (heightAt(a) + random() * finiteNumber(options.jitter, 0.03)) -
                (heightAt(b) + random() * finiteNumber(options.jitter, 0.03)));
            current = neighbors[0];
            visited.add(coordinateKey(current.x, current.y));
            points.push(current);
            if (heightAt(current) <= finiteNumber(options.seaLevel, 0.25)) break;
        }
        if (points.length < 2) return false;
        return generateRiver(Object.assign({}, options, { points, label: options.label || "Generate Downhill River" }));
    }

    function generateWaveFunctionMap(options = {}) {
        const rules = (Array.isArray(options.rules) ? options.rules : parseJson(options.rules, []))
            .map(rule => ({
                tileId: parseTileId(rule.tileId),
                weight: Math.max(0.001, finiteNumber(rule.weight, 1)),
                allowed: rule.allowed || {}
            })).filter(rule => rule.tileId !== null);
        if (!rules.length) return false;
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const random = seededRandom(options.seed || 0);
        const ruleById = new Map(rules.map(rule => [rule.tileId, rule]));
        const possibilities = new Map();
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            if (inBounds(x, y) && (!options.mask || maskContains(options.mask, x, y))) possibilities.set(coordinateKey(x, y), new Set(rules.map(rule => rule.tileId)));
        }
        const directions = { north: [0, -1, "south"], south: [0, 1, "north"], west: [-1, 0, "east"], east: [1, 0, "west"] };
        const weightedChoice = values => {
            const entries = values.map(id => ({ tileId: id, weight: (ruleById.get(id) || {}).weight || 1 }));
            return chooseWeightedTile(entries, random);
        };
        const propagationLimit = Math.max(1000, integer(options.propagationLimit, possibilities.size * rules.length * 16));
        const propagate = queue => {
            let steps = 0;
            let queueHead = 0;
            while (queueHead < queue.length && steps++ < propagationLimit) {
                const point = queue[queueHead++];
                const sourceSet = possibilities.get(coordinateKey(point.x, point.y));
                if (!sourceSet) continue;
                for (const [direction, [dx, dy, opposite]] of Object.entries(directions)) {
                    const neighborKey = coordinateKey(point.x + dx, point.y + dy);
                    const targetSet = possibilities.get(neighborKey);
                    if (!targetSet) continue;
                    const permitted = new Set();
                    for (const sourceId of sourceSet) {
                        const allowed = normalizeList((ruleById.get(sourceId).allowed || {})[direction]).map(parseTileId).filter(value => value !== null);
                        if (!allowed.length) for (const id of targetSet) permitted.add(id);
                        else for (const id of allowed) permitted.add(id);
                    }
                    let changed = false;
                    for (const id of [...targetSet]) if (!permitted.has(id)) { targetSet.delete(id); changed = true; }
                    if (!targetSet.size) {
                        const fallback = rules.filter(rule => {
                            const allowed = normalizeList((rule.allowed || {})[opposite]).map(parseTileId);
                            return [...sourceSet].some(id => !allowed.length || allowed.includes(id));
                        });
                        targetSet.add((fallback[0] || rules[0]).tileId);
                        changed = true;
                    }
                    if (changed) queue.push({ x: point.x + dx, y: point.y + dy });
                }
            }
            return !queue.length;
        };
        let collapseSteps = 0;
        const collapseLimit = Math.max(1, integer(options.collapseLimit, possibilities.size * 2));
        while ([...possibilities.values()].some(set => set.size > 1) && collapseSteps++ < collapseLimit) {
            const candidates = [...possibilities.entries()].filter(([, set]) => set.size > 1)
                .sort((a, b) => a[1].size - b[1].size);
            const minimum = candidates[0][1].size;
            const tied = candidates.filter(([, set]) => set.size === minimum);
            const [key, set] = tied[Math.floor(random() * tied.length)];
            const chosen = weightedChoice([...set]);
            possibilities.set(key, new Set([chosen]));
            const [x, y] = key.split(",").map(Number);
            if (!propagate([{ x, y }])) {
                captureError(new Error("WFC propagation reached its safety limit."), {
                    operation: "generateWaveFunctionMap", propagationLimit, collapseSteps
                });
                break;
            }
        }
        const layer = normalizeLayer(options.layer || "L1");
        const cells = [...possibilities.entries()].map(([key, set]) => {
            const [x, y] = key.split(",").map(Number);
            return { x, y, tiles: cellTilesForLayer(layer, [...set][0], false) };
        });
        const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact";
        const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null);
        patch.label = String(options.label || "Wave Function Collapse");
        patch.seed = options.seed;
        patch.collapseSteps = collapseSteps;
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateWaveFunctionMap");
        return patch;
    }

    function validateDungeonConnectivity(options = {}) {
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const layer = normalizeLayer(options.layer || "L1");
        const floorTile = parseTileId(options.floorTileId);
        if (floorTile === null) return { ok: false, reason: "Missing floor tile." };
        const walkable = new Set();
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
            const value = readTile($dataMap.data, $dataMap.width, $dataMap.height, x, y, LAYER_INDEX[layer]);
            if (sameTileType(value, floorTile)) walkable.add(coordinateKey(x, y));
        }
        if (!walkable.size) return { ok: false, reason: "No floor cells.", reachable: 0, total: 0 };
        const queue = [[...walkable][0].split(",").map(Number)];
        let queueHead = 0;
        const visited = new Set();
        while (queueHead < queue.length) {
            const [x, y] = queue[queueHead++];
            const key = coordinateKey(x, y);
            if (visited.has(key) || !walkable.has(key)) continue;
            visited.add(key);
            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        return { ok: visited.size === walkable.size, reachable: visited.size, total: walkable.size,
            disconnected: [...walkable].filter(key => !visited.has(key)).map(key => key.split(",").map(Number)) };
    }

    function generateValidatedDungeon(options = {}) {
        const attempts = Math.max(1, integer(options.validationAttempts, 3));
        const mapId = $gameMap.mapId();
        const key = String(mapId);
        const store = ensureStore();
        for (let attempt = 0; attempt < attempts; attempt++) {
            const before = (store.maps[key] || []).length;
            const patch = generateDungeon(Object.assign({}, options, { seed: `${options.seed || "dungeon"}:${attempt}` }));
            if (!patch) continue;
            const validation = validateDungeonConnectivity(options);
            if (validation.ok) {
                patch.validation = validation;
                return patch;
            }
            store.maps[key] = (store.maps[key] || []).slice(0, before);
            composedCache.delete(mapId);
            rebuildCurrentMap("retryDungeonGeneration");
        }
        return false;
    }

    async function scatterPrefabs(options = {}) {
        const definitions = normalizeList(options.prefabs || options.names).map(value => typeof value === "string"
            ? catalogPrefab(value, 0) : value).filter(Boolean);
        if (!definitions.length) return { ok: false, placements: [], errors: ["No prefabs supplied."] };
        const rect = normalizeRect(options.x || 0, options.y || 0,
            options.width || $dataMap.width, options.height || $dataMap.height);
        const random = seededRandom(options.seed || 0);
        const minimumSpacing = Math.max(0, integer(options.minimumSpacing, 1));
        const targetCount = Math.max(1, integer(options.count, 10));
        const attempts = Math.max(targetCount, integer(options.attempts, targetCount * 20));
        const placements = [];
        const errors = [];
        for (let attempt = 0; attempt < attempts && placements.length < targetCount; attempt++) {
            const definition = definitions[Math.floor(random() * definitions.length)];
            const x = rect.x + Math.floor(random() * rect.w);
            const y = rect.y + Math.floor(random() * rect.h);
            if (!proceduralPointAllowed(x, y, options, 0)) continue;
            if (placements.some(item => Math.hypot(item.targetX - x, item.targetY - y) < minimumSpacing)) continue;
            const placementOptions = Object.assign({}, options.prefabOptions || {}, {
                name: definition.name,
                storageMapId: definition.mapId,
                targetX: x,
                targetY: y,
                parameters: options.parameters,
                ignorePlacementRules: options.ignorePlacementRules,
                save: options.save !== false
            });
            try {
                const result = options.linked === false ? await graftPrefabAsync(placementOptions) : await placePrefabInstance(placementOptions);
                if (result) placements.push({ prefab: definition.name, targetX: x, targetY: y, result });
            } catch (error) { errors.push({ prefab: definition.name, x, y, message: error.message }); }
        }
        return { ok: errors.length === 0 && placements.length > 0, placements, errors, seed: options.seed };
    }

    async function runGeneratorGraph(graph, context = {}) {
        const nodes = Array.isArray(graph) ? graph : graph && graph.nodes || [];
        const pending = new Map(nodes.map(node => [String(node.id), deepClone(node)]));
        const results = {};
        const errors = [];
        while (pending.size) {
            const ready = [...pending.values()].filter(node => normalizeList(node.dependsOn).every(id => results[String(id)] !== undefined));
            if (!ready.length) {
                errors.push({ message: "Generator graph contains a cycle or missing dependency.", nodes: [...pending.keys()] });
                break;
            }
            for (const node of ready) {
                pending.delete(String(node.id));
                try {
                    const options = substitutePrefabValue(node.options || {}, Object.assign({}, context, results));
                    let result;
                    if (String(node.type).toLowerCase() === "scatterprefabs") result = await scatterPrefabs(options);
                    else result = executeModifier(node.type, options);
                    results[String(node.id)] = result;
                } catch (error) {
                    errors.push({ nodeId: node.id, message: error.message });
                    if (node.stopOnError !== false) return { ok: false, results, errors };
                    results[String(node.id)] = false;
                }
            }
        }
        return { ok: errors.length === 0, results, errors };
    }

    function checkAreaEvents(x, y, width, height) {
        const rect = normalizeRect(x, y, width, height);
        const result = { normal: [], spawned: [] };
        for (const event of $gameMap.events()) {
            if (!inRect(event.x, event.y, rect)) continue;
            (isHybridGameEvent(event) ? result.spawned : result.normal).push(event.eventId());
        }
        return result;
    }

    function eventInfoAt(x, y) {
        return $gameMap.events().filter(event => event.x === integer(x) && event.y === integer(y)).map(event => ({
            id: event.eventId(),
            name: event.event() ? event.event().name : "",
            x: event.x,
            y: event.y,
            direction: event.direction ? event.direction() : 2,
            spawned: isHybridGameEvent(event),
            note: event.event() ? event.event().note || "" : ""
        }));
    }

    function currentEventSnapshot(eventId) {
        const event = $gameMap.event(integer(eventId));
        if (!event || !event.event) return null;
        const data = deepClone(event.event());
        data.x = event.x;
        data.y = event.y;
        return data;
    }

    function moveSpawnedEvent(eventId, x, y, save = true) {
        const id = integer(eventId);
        const event = $gameMap.event(id);
        if (!isHybridGameEvent(event)) return false;
        captureSpawnedRuntimeStates();
        const snapshot = currentEventSnapshot(id);
        snapshot.x = integer(x);
        snapshot.y = integer(y);
        const bucket = eventStateBucket($gameMap.mapId(), true);
        if (bucket[String(id)]) {
            bucket[String(id)].x = snapshot.x;
            bucket[String(id)].y = snapshot.y;
        }
        const patch = makeEventPatch([snapshot], [id], "Move Spawned Event", { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "moveSpawnedEvent");
        return patch;
    }

    function duplicateEvent(eventId, x, y, save = true) {
        const source = currentEventSnapshot(eventId);
        if (!source) return false;
        const snapshot = prepareTargetEventSnapshot(source);
        snapshot.x = integer(x, source.x);
        snapshot.y = integer(y, source.y);
        const patch = makeEventPatch([snapshot], [], "Duplicate Event");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "duplicateEvent");
        return snapshot.id;
    }

    function deleteSpawnedEvent(eventId, save = true) {
        const id = integer(eventId);
        if (!isHybridGameEvent($gameMap.event(id))) return false;
        const patch = makeEventPatch([], [id], "Delete Spawned Event");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "deleteSpawnedEvent");
        return true;
    }

    function updateSpawnedEvent(eventId, changes = {}, save = true) {
        const id = integer(eventId);
        const gameEvent = $gameMap.event(id);
        if (!isHybridGameEvent(gameEvent)) return false;
        captureSpawnedRuntimeStates();
        const snapshot = currentEventSnapshot(id);
        for (const field of ["name", "note", "pages", "meta"]) {
            if (changes[field] !== undefined) snapshot[field] = deepClone(changes[field]);
        }
        if (changes.x !== undefined) snapshot.x = integer(changes.x, snapshot.x);
        if (changes.y !== undefined) snapshot.y = integer(changes.y, snapshot.y);
        const bucket = eventStateBucket($gameMap.mapId(), true);
        bucket[String(id)] ||= {};
        if (changes.x !== undefined) bucket[String(id)].x = snapshot.x;
        if (changes.y !== undefined) bucket[String(id)].y = snapshot.y;
        if (changes.direction !== undefined) bucket[String(id)].direction = integer(changes.direction, 2);
        if (changes.moveSpeed !== undefined) bucket[String(id)].moveSpeed = finiteNumber(changes.moveSpeed, 3);
        if (changes.through !== undefined) bucket[String(id)].through = toBoolean(changes.through, false);
        if (changes.transparent !== undefined) bucket[String(id)].transparent = toBoolean(changes.transparent, false);
        const patch = makeEventPatch([snapshot], [id], "Update Spawned Event", { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "updateSpawnedEvent");
        return patch;
    }

    function bulkUpdateSpawnedEvents(eventIds, changes = {}, save = true) {
        const ids = [...new Set(normalizeList(eventIds).map(Number).filter(id => isHybridGameEvent($gameMap.event(id))))];
        if (!ids.length) return false;
        captureSpawnedRuntimeStates();
        const events = [];
        for (const id of ids) {
            const snapshot = currentEventSnapshot(id);
            for (const field of ["name", "note", "pages", "meta"]) {
                if (changes[field] !== undefined) snapshot[field] = deepClone(changes[field]);
            }
            if (changes.offsetX !== undefined) snapshot.x += integer(changes.offsetX);
            else if (changes.x !== undefined) snapshot.x = integer(changes.x, snapshot.x);
            if (changes.offsetY !== undefined) snapshot.y += integer(changes.offsetY);
            else if (changes.y !== undefined) snapshot.y = integer(changes.y, snapshot.y);
            const bucket = eventStateBucket($gameMap.mapId(), true);
            bucket[String(id)] ||= {};
            for (const field of ["direction", "moveSpeed", "through", "transparent"]) {
                if (changes[field] !== undefined) bucket[String(id)][field] = deepClone(changes[field]);
            }
            bucket[String(id)].x = snapshot.x;
            bucket[String(id)].y = snapshot.y;
            events.push(snapshot);
        }
        const patch = makeEventPatch(events, ids, String(changes.label || "Bulk Update Spawned Events"), { preserveEventState: true });
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkUpdateSpawnedEvents");
        return patch;
    }

    function editEventPage(eventId, pageIndex, changes = {}, save = true) {
        const snapshot = currentEventSnapshot(eventId);
        if (!snapshot || !isHybridGameEvent($gameMap.event(integer(eventId)))) return false;
        const index = Math.max(0, integer(pageIndex, 0));
        snapshot.pages ||= [];
        snapshot.pages[index] = Object.assign(defaultEventPage(), snapshot.pages[index] || {}, deepClone(changes));
        return updateSpawnedEvent(eventId, { pages: snapshot.pages }, save);
    }

    function defaultEventPage() {
        return {
            conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false,
                selfSwitchCh: "A", selfSwitchValid: false, switch1Id: 1, switch1Valid: false,
                switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 },
            directionFix: false,
            image: { tileId: 0, characterName: "", direction: 2, pattern: 1, characterIndex: 0 },
            list: [{ code: 0, indent: 0, parameters: [] }],
            moveFrequency: 3,
            moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
            moveSpeed: 3,
            moveType: 0,
            priorityType: 1,
            stepAnime: false,
            through: false,
            trigger: 0,
            walkAnime: true
        };
    }

    function normalizeEventTemplate(name, eventData, options = {}) {
        const label = String(name || options.name || "").trim();
        if (!label || !eventData) return null;
        const event = deepClone(eventData.event ? eventData.event() : eventData);
        if (!event.pages || !event.pages.length) event.pages = [defaultEventPage()];
        event.x = 0;
        event.y = 0;
        delete event.id;
        delete event._hybridSpawnId;
        delete event._hybridTileGraftSpawn;
        return {
            name: label,
            category: String(options.category || "General"),
            tags: normalizeList(options.tags).map(String),
            description: String(options.description || ""),
            version: Math.max(1, integer(options.version, 1)),
            parameters: Array.isArray(options.parameters) ? deepClone(options.parameters) : parseJson(options.parameters, []),
            event,
            updatedAt: Date.now()
        };
    }

    function registerEventTemplate(name, eventData, options = {}) {
        const template = normalizeEventTemplate(name, eventData, options);
        if (!template) return false;
        const key = template.name.toLowerCase();
        const existing = ensureStore().eventTemplates[key];
        if (existing && options.version === undefined) template.version = Math.max(1, existing.version || 1) + 1;
        ensureStore().eventTemplates[key] = template;
        return deepClone(template);
    }

    function captureEventTemplate(name, eventId, options = {}) {
        const snapshot = currentEventSnapshot(eventId);
        return snapshot ? registerEventTemplate(name, snapshot, options) : false;
    }

    function listEventTemplates(filter = "") {
        const query = String(filter || "").toLowerCase();
        return Object.values(ensureStore().eventTemplates || {}).filter(template => !query || [
            template.name, template.category, template.description, ...(template.tags || [])
        ].some(value => String(value || "").toLowerCase().includes(query)))
            .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map(deepClone);
    }

    function removeEventTemplate(name) {
        const key = String(name || "").trim().toLowerCase();
        if (!ensureStore().eventTemplates[key]) return false;
        delete ensureStore().eventTemplates[key];
        return true;
    }

    function resolveEventTemplate(name, parameters = {}) {
        const template = ensureStore().eventTemplates[String(name || "").trim().toLowerCase()];
        if (!template) return null;
        const defaults = {};
        for (const parameter of template.parameters || []) if (parameter && parameter.name) defaults[parameter.name] = parameter.default;
        const values = Object.assign(defaults, typeof parameters === "string" ? parseJson(parameters, {}) : parameters || {});
        return { template: deepClone(template), event: substitutePrefabValue(template.event, values), parameters: values };
    }

    function spawnEventTemplate(name, x, y, options = {}) {
        const resolved = resolveEventTemplate(name, options.parameters);
        if (!resolved) return false;
        const event = prepareTargetEventSnapshot(resolved.event);
        event.name = options.eventName || event.name || resolved.template.name;
        event.x = integer(x);
        event.y = integer(y);
        const patch = makeEventPatch([event], [], `Spawn Template: ${resolved.template.name}`);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "spawnEventTemplate");
        return event.id;
    }

    function spawnEventTemplateOnMapAsync(mapId, name, x, y, options = {}) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(spawnEventTemplate(name, x, y, options));
        const resolved = resolveEventTemplate(name, options.parameters);
        if (!resolved) return Promise.resolve(false);
        return preloadMap(id).then(() => {
            const event = prepareTargetEventSnapshot(resolved.event);
            event.name = options.eventName || event.name || resolved.template.name;
            event.x = integer(x);
            event.y = integer(y);
            return applyPatchToMap(id, makeEventPatch([event], [], `Spawn Template: ${resolved.template.name}`), "spawnRemoteEventTemplate");
        });
    }

    function exportEventTemplatePack(names = null) {
        const requested = names ? new Set(normalizeList(names).map(name => String(name).toLowerCase())) : null;
        return {
            format: "HybridTileGraftEventTemplatePack",
            version: 1,
            pluginVersion: VERSION,
            createdAt: new Date().toISOString(),
            templates: listEventTemplates().filter(template => !requested || requested.has(template.name.toLowerCase()))
        };
    }

    function importEventTemplatePack(value, options = {}) {
        if (!inputWithinLimit(value, options.maxBytes || MAX_IMPORT_BYTES)) return false;
        const pack = typeof value === "string" ? parseJson(value, null) : value;
        if (!pack || pack.format !== "HybridTileGraftEventTemplatePack" || !Array.isArray(pack.templates)) return false;
        const policy = String(options.conflictPolicy || "newer").toLowerCase();
        const imported = [];
        const skipped = [];
        for (const template of pack.templates) {
            const current = ensureStore().eventTemplates[String(template.name || "").toLowerCase()];
            if (current && (policy === "skip" || (policy === "newer" && (current.version || 1) >= (template.version || 1)))) {
                skipped.push(template.name);
                continue;
            }
            ensureStore().eventTemplates[String(template.name).toLowerCase()] = deepClone(template);
            imported.push(template.name);
        }
        return { imported, skipped };
    }

    function eventMatchesSearch(event, options = {}, mapData = $dataMap) {
        if (!event) return false;
        const query = String(options.query || options.text || "").toLowerCase();
        if (query && ![event.name, event.note, JSON.stringify(event.pages || [])]
            .some(value => String(value || "").toLowerCase().includes(query))) return false;
        if (options.spawned !== undefined && isHybridEventData(event) !== toBoolean(options.spawned, true)) return false;
        if (options.rect && !inRect(event.x, event.y, options.rect)) return false;
        if (options.region !== undefined && readTile(mapData.data, mapData.width, mapData.height, event.x, event.y, 5) !== integer(options.region)) return false;
        const commandCodes = normalizeList(options.commandCodes).map(Number);
        if (commandCodes.length && !(event.pages || []).some(page => (page.list || []).some(command => commandCodes.includes(command.code)))) return false;
        return true;
    }

    function searchEvents(options = {}) {
        return ($dataMap.events || []).filter(event => eventMatchesSearch(event, options, $dataMap)).map(event => ({
            id: event.id,
            name: event.name || "",
            note: event.note || "",
            x: event.x,
            y: event.y,
            spawned: isHybridEventData(event),
            pageCount: (event.pages || []).length
        }));
    }

    function searchEventsOnMapAsync(mapId, options = {}) {
        const id = positiveInteger(mapId);
        if (id === $gameMap.mapId()) return Promise.resolve(searchEvents(options));
        return preloadMap(id).then(map => (map.events || []).filter(event => eventMatchesSearch(event, options, map)).map(event => ({
            id: event.id, name: event.name || "", note: event.note || "", x: event.x, y: event.y,
            spawned: isHybridEventData(event), pageCount: (event.pages || []).length
        })));
    }

    function bulkMoveSpawnedEvents(eventIds, dx, dy, options = {}) {
        const events = [];
        const removeIds = [];
        for (const eventId of normalizeList(eventIds).map(Number)) {
            const source = currentEventSnapshot(eventId);
            if (!source || !isHybridGameEvent($gameMap.event(eventId))) continue;
            source.x += integer(dx);
            source.y += integer(dy);
            if (!inBounds(source.x, source.y) && options.allowOutOfBounds !== true) continue;
            events.push(source);
            removeIds.push(eventId);
            const bucket = eventStateBucket($gameMap.mapId(), true);
            bucket[String(eventId)] ||= {};
            bucket[String(eventId)].x = source.x;
            bucket[String(eventId)].y = source.y;
        }
        if (!events.length) return false;
        const patch = makeEventPatch(events, removeIds, "Bulk Move Spawned Events", { preserveEventState: true });
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkMoveSpawnedEvents");
        return patch;
    }

    function bulkDeleteSpawnedEvents(eventIds, save = true) {
        const ids = normalizeList(eventIds).map(Number).filter(id => isHybridGameEvent($gameMap.event(id)));
        if (!ids.length) return false;
        const patch = makeEventPatch([], ids, "Bulk Delete Spawned Events");
        if (save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "bulkDeleteSpawnedEvents");
        return patch;
    }

    function generatedEventData(type, options = {}) {
        const page = defaultEventPage();
        page.image.characterName = String(options.characterName || "");
        page.image.characterIndex = Math.max(0, integer(options.characterIndex, 0));
        page.image.direction = integer(options.direction, 2);
        page.priorityType = integer(options.priorityType, 1);
        page.trigger = integer(options.trigger, 0);
        const commands = [];
        const kind = String(type || "event").toLowerCase();
        if (kind === "door") {
            commands.push({ code: 250, indent: 0, parameters: [{ name: options.sound || "Open1", volume: 90, pitch: 100, pan: 0 }] });
            if (options.targetMapId) commands.push({ code: 201, indent: 0, parameters: [0, integer(options.targetMapId), integer(options.targetX), integer(options.targetY), integer(options.targetDirection, 2), integer(options.fadeType, 0)] });
        } else if (kind === "transfer") {
            commands.push({ code: 201, indent: 0, parameters: [0, integer(options.targetMapId), integer(options.targetX), integer(options.targetY), integer(options.targetDirection, 2), integer(options.fadeType, 0)] });
        } else if (kind === "chest") {
            if (options.gold) commands.push({ code: 125, indent: 0, parameters: [0, 0, integer(options.gold)] });
            if (options.itemId) commands.push({ code: 126, indent: 0, parameters: [integer(options.itemId), 0, 0, integer(options.amount, 1)] });
            commands.push({ code: 123, indent: 0, parameters: [String(options.selfSwitch || "A"), 0] });
        } else if (kind === "harvest") {
            if (options.commonEventId) commands.push({ code: 117, indent: 0, parameters: [integer(options.commonEventId)] });
            commands.push({ code: 123, indent: 0, parameters: [String(options.selfSwitch || "A"), 0] });
        } else if (options.commonEventId) {
            commands.push({ code: 117, indent: 0, parameters: [integer(options.commonEventId)] });
        }
        commands.push({ code: 0, indent: 0, parameters: [] });
        page.list = commands;
        const pages = [page];
        if (kind === "chest" || kind === "harvest") {
            const finished = defaultEventPage();
            finished.conditions.selfSwitchCh = String(options.selfSwitch || "A");
            finished.conditions.selfSwitchValid = true;
            finished.image.characterName = String(options.finishedCharacterName || options.characterName || "");
            finished.image.characterIndex = Math.max(0, integer(options.finishedCharacterIndex, options.characterIndex || 0));
            finished.image.direction = integer(options.finishedDirection, options.direction || 2);
            pages.push(finished);
        }
        return { name: String(options.name || kind), note: String(options.note || ""), x: 0, y: 0, pages };
    }

    function generateEvent(type, x, y, options = {}) {
        const event = prepareTargetEventSnapshot(generatedEventData(type, options));
        event.x = integer(x);
        event.y = integer(y);
        const patch = makeEventPatch([event], [], `Generate ${type} Event`);
        if (options.save !== false) addPatch($gameMap.mapId(), patch);
        applyPatchLive(patch, "generateEvent");
        return event.id;
    }

    function resolveMapId(value) {
        const direct = integer(value, 0);
        if (direct > 0) return direct;
        const name = String(value || "").trim().toLowerCase();
        if (!name || typeof $dataMapInfos === "undefined" || !$dataMapInfos) return 0;
        const match = $dataMapInfos.find(info => info && String(info.name || "").trim().toLowerCase() === name);
        return match ? match.id : 0;
    }

    function linkMap(value) {
        const mapId = resolveMapId(value);
        if (mapId <= 0) {
            console.warn(`${PLUGIN_NAME}: cannot link unknown map "${value}".`);
            return Promise.resolve(false);
        }
        if (mapId === $gameMap.mapId()) return Promise.resolve(unlinkMap());
        $gameMap._hybridLinkedMapId = mapId;
        return preloadMap(mapId).then(() => mapId);
    }

    function unlinkMap() {
        if ($gameMap) $gameMap._hybridLinkedMapId = null;
        return true;
    }

    function editingMapId() {
        return ($gameMap && $gameMap._hybridLinkedMapId) || $gameMap.mapId();
    }
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
    // -------------------------------------------------------------------------
    // v9 production transactions, branches, reviews, learned WFC, and extensions
    // -------------------------------------------------------------------------

    const WORKSPACE_STATE_FIELDS = Object.freeze(["maps", "redo", "mapOverrides", "authoringLayers", "activeAuthoringLayers", "masks", "modifiers", "prefabInstances", "changeSets", "eventStates", "prefabs", "prefabPayloads", "prefabRevisions", "eventTemplates", "checkpoints", "mapBookmarks", "worldRecipes", "worldRecipeStates", "worldState", "worldClock", "worldFacts", "worldZones", "worldEntities", "worldResources", "worldSchedules", "worldRecipePacks", "worldRecipeProfiles", "worldRecipeBreakpoints", "worldRecipePaused", "worldRecipeTests", "worldMapVariants", "worldNpcs", "worldNpcRoutes", "worldNpcOccupancy", "worldRuleLayers", "worldRuleBrushes", "worldBiomeGraphs", "worldBiomeCache", "worldBiomeLocks", "worldDebugger", "worldPackLock", "packPublishers", "signedPackTrust", "contentCatalogs", "catalogSubscriptions", "benchmarkHistory", "worldAtlases", "eventQuestGraphs", "mapRepairProfiles", "visualHistory", "extensionManifests", "extensionPermissions", "packRepositories", "validationRuns", "deploymentReports", "liveProductionSessions", "activeLiveProductionSession", "playtestRecordings", "activePlaytestRecordingId", "playtestScenarios", "scenarioRuns", "semanticTilesets", "extensionSandboxes", "contentCollections", "collaborationBundles", "releaseFingerprints", "extensionSecurityProfiles", "extensionPublishers", "compatibilityProfilesV15", "releaseManifestsV15", "runtimeBudget"]);
    function workspaceStateSnapshot() {
        const store = ensureStore(); const snapshot = {};
        for (const key of WORKSPACE_STATE_FIELDS) snapshot[key] = deepClone(store[key]);
        return snapshot;
    }
    function restoreWorkspaceState(snapshot) {
        if (!snapshot || typeof snapshot !== "object") return false; const store = ensureStore();
        for (const key of WORKSPACE_STATE_FIELDS) if (snapshot[key] !== undefined) store[key] = deepClone(snapshot[key]);
        composedCache.clear(); pristineCache.clear(); if (typeof $dataMap !== "undefined" && $dataMap) rebuildCurrentMap("restoreWorkspaceState"); return true;
    }
    function beginProjectTransaction(label = "Project transaction", options = {}) {
        const store = ensureStore(); if (store.activeProjectTransaction) return false;
        const transaction = { id: String(options.id || `project-tx-${Date.now()}-${Math.floor(Math.random() * 100000)}`), label: String(label), status: "active", startedAt: Date.now(), before: workspaceStateSnapshot(), notes: String(options.notes || "") };
        if (JSON.stringify(transaction.before).length * 2 > MAX_IMPORT_BYTES) return false;
        store.activeProjectTransaction = transaction; recordOperation("beginProjectTransaction", { transactionId: transaction.id, label: transaction.label }); return { id: transaction.id, label: transaction.label, startedAt: transaction.startedAt };
    }
    function projectTransactionState() { const item = ensureStore().activeProjectTransaction; return item ? { id: item.id, label: item.label, status: item.status, startedAt: item.startedAt } : null; }
    function commitProjectTransaction(options = {}) {
        const store = ensureStore(); const transaction = store.activeProjectTransaction; if (!transaction) return false;
        transaction.after = workspaceStateSnapshot(); transaction.status = "committed"; transaction.committedAt = Date.now(); transaction.changed = JSON.stringify(transaction.before) !== JSON.stringify(transaction.after);
        store.projectTransactions.unshift(transaction); store.projectTransactions = store.projectTransactions.slice(0, Math.max(1, integer(options.retain, store.backupPolicy?.retain || 10))); store.activeProjectTransaction = null; recordOperation("commitProjectTransaction", { transactionId: transaction.id, changed: transaction.changed }); return { id: transaction.id, changed: transaction.changed, committedAt: transaction.committedAt };
    }
    function rollbackProjectTransaction() {
        const store = ensureStore(); const transaction = store.activeProjectTransaction; if (!transaction) return false;
        store.activeProjectTransaction = null; const restored = restoreWorkspaceState(transaction.before); transaction.status = "rolledBack"; transaction.rolledBackAt = Date.now(); store.projectTransactions.unshift(transaction); recordOperation("rollbackProjectTransaction", { transactionId: transaction.id }); return restored;
    }
    function recoverProjectTransaction(mode = "rollback") {
        const transaction = ensureStore().activeProjectTransaction; if (!transaction) return false;
        return String(mode).toLowerCase() === "commit" ? commitProjectTransaction() : rollbackProjectTransaction();
    }
    function listProjectTransactions() { return (ensureStore().projectTransactions || []).map(item => ({ id: item.id, label: item.label, status: item.status, startedAt: item.startedAt, committedAt: item.committedAt, rolledBackAt: item.rolledBackAt, changed: item.changed })); }

    function ensureMainWorkspaceBranch() {
        const store = ensureStore(); store.workspaceBranches ||= {};
        store.workspaceBranches.main ||= { id: "main", name: "main", parentId: null, createdAt: Date.now(), snapshot: workspaceStateSnapshot() };
        if (!store.workspaceBranches[store.activeWorkspaceBranch]) store.activeWorkspaceBranch = "main"; return store.workspaceBranches.main;
    }
    function saveActiveWorkspaceBranch() { ensureMainWorkspaceBranch(); const store = ensureStore(); const branch = store.workspaceBranches[store.activeWorkspaceBranch]; branch.snapshot = workspaceStateSnapshot(); branch.updatedAt = Date.now(); return branch; }
    function createWorkspaceBranch(name, options = {}) {
        const store = ensureStore(); saveActiveWorkspaceBranch(); const id = String(options.id || `${String(name || "branch").toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}-${Date.now().toString(36)}`);
        if (store.workspaceBranches[id]) return false; store.workspaceBranches[id] = { id, name: String(name || id), parentId: store.activeWorkspaceBranch, createdAt: Date.now(), snapshot: workspaceStateSnapshot(), description: String(options.description || "") }; if (options.activate !== false) store.activeWorkspaceBranch = id; recordOperation("createWorkspaceBranch", { branchId: id }); return deepClone(store.workspaceBranches[id]);
    }
    function listWorkspaceBranches() { ensureMainWorkspaceBranch(); const store = ensureStore(); return Object.values(store.workspaceBranches).map(branch => ({ id: branch.id, name: branch.name, parentId: branch.parentId, createdAt: branch.createdAt, updatedAt: branch.updatedAt, active: branch.id === store.activeWorkspaceBranch })); }
    function switchWorkspaceBranch(id) { const store = ensureStore(); ensureMainWorkspaceBranch(); const target = store.workspaceBranches[String(id)]; if (!target) return false; saveActiveWorkspaceBranch(); restoreWorkspaceState(target.snapshot); store.activeWorkspaceBranch = target.id; recordOperation("switchWorkspaceBranch", { branchId: target.id }); return deepClone(target); }
    function mergeWorkspaceBranch(sourceId, options = {}) {
        const store = ensureStore(); ensureMainWorkspaceBranch(); const source = store.workspaceBranches[String(sourceId)]; if (!source) return false; const current = workspaceStateSnapshot(); const incoming = source.snapshot || {}; let patches = 0; let conflicts = 0;
        for (const [mapId, list] of Object.entries(incoming.maps || {})) { const target = current.maps[mapId] ||= []; const known = new Set(target.map(item => JSON.stringify(item))); for (const patch of list || []) { const key = JSON.stringify(patch); if (!known.has(key)) { target.push(deepClone(patch)); known.add(key); patches++; } } }
        for (const [mapId, override] of Object.entries(incoming.mapOverrides || {})) { if (current.mapOverrides[mapId] && JSON.stringify(current.mapOverrides[mapId]) !== JSON.stringify(override)) { conflicts++; if (options.resolution !== "theirs") continue; } current.mapOverrides[mapId] = deepClone(override); }
        restoreWorkspaceState(current); saveActiveWorkspaceBranch(); recordOperation("mergeWorkspaceBranch", { sourceId: source.id, patches, conflicts }); return { ok: true, sourceId: source.id, targetId: store.activeWorkspaceBranch, patches, conflicts };
    }
    function deleteWorkspaceBranch(id) { const store = ensureStore(); const key = String(id); if (key === "main" || key === store.activeWorkspaceBranch || !store.workspaceBranches[key]) return false; delete store.workspaceBranches[key]; return true; }

    function addReviewComment(text, options = {}) {
        const store = ensureStore(); const item = { id: String(options.id || `review-${Date.now()}-${Math.floor(Math.random() * 100000)}`), branchId: options.branchId || store.activeWorkspaceBranch || "main", mapId: integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0), eventId: integer(options.eventId), x: options.x === undefined ? null : integer(options.x), y: options.y === undefined ? null : integer(options.y), text: String(text || "").trim(), author: String(options.author || "Local reviewer"), createdAt: Date.now(), resolved: false };
        if (!item.text) return false; store.reviewComments.push(item); return deepClone(item);
    }
    function listReviewComments(options = {}) { return (ensureStore().reviewComments || []).filter(item => (!options.mapId || item.mapId === integer(options.mapId)) && (options.resolved === undefined || item.resolved === toBoolean(options.resolved, false))).map(deepClone); }
    function updateReviewComment(id, changes = {}) { const item = ensureStore().reviewComments.find(value => value.id === String(id)); if (!item) return false; for (const key of ["text", "author", "resolved", "x", "y", "eventId"]) if (changes[key] !== undefined) item[key] = key === "resolved" ? toBoolean(changes[key], false) : key === "text" || key === "author" ? String(changes[key]) : integer(changes[key]); item.updatedAt = Date.now(); return deepClone(item); }
    function deleteReviewComment(id) { const store = ensureStore(); const before = store.reviewComments.length; store.reviewComments = store.reviewComments.filter(item => item.id !== String(id)); return store.reviewComments.length !== before; }

    function createReviewThread(text, options = {}) {
        const store = ensureStore(); const now = Date.now(); const status = ["open", "in-progress", "resolved"].includes(String(options.status)) ? String(options.status) : "open";
        const thread = { id: String(options.id || `thread-${now}-${Math.floor(Math.random() * 100000)}`), branchId: String(options.branchId || store.activeWorkspaceBranch || "main"), mapId: integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0), eventId: integer(options.eventId), x: options.x === undefined ? null : integer(options.x), y: options.y === undefined ? null : integer(options.y), author: String(options.author || "Local reviewer"), text: String(text || "").trim(), status, createdAt: now, updatedAt: now, replies: [], attachments: Array.isArray(options.attachments) ? deepClone(options.attachments).slice(0, 20) : [], history: [{ status, at: now, author: String(options.author || "Local reviewer") }] };
        if (!thread.text) return false; store.reviewThreads.push(thread); recordOperation("createReviewThread", { threadId: thread.id, mapId: thread.mapId }); return deepClone(thread);
    }
    function listReviewThreads(options = {}) { return (ensureStore().reviewThreads || []).filter(item => (!options.mapId || item.mapId === integer(options.mapId)) && (!options.branchId || item.branchId === String(options.branchId)) && (!options.status || item.status === String(options.status))).map(deepClone); }
    function replyReviewThread(id, text, options = {}) { const thread = ensureStore().reviewThreads.find(item => item.id === String(id)); const value = String(text || "").trim(); if (!thread || !value) return false; const reply = { id: String(options.id || `reply-${Date.now()}-${Math.floor(Math.random() * 100000)}`), author: String(options.author || "Local reviewer"), text: value, createdAt: Date.now() }; thread.replies.push(reply); thread.updatedAt = reply.createdAt; return deepClone(reply); }
    function updateReviewThreadStatus(id, status, options = {}) { const thread = ensureStore().reviewThreads.find(item => item.id === String(id)); const value = String(status || ""); if (!thread || !["open", "in-progress", "resolved"].includes(value)) return false; thread.status = value; thread.updatedAt = Date.now(); thread.history.push({ status: value, at: thread.updatedAt, author: String(options.author || "Local reviewer") }); return deepClone(thread); }
    function deleteReviewThread(id) { const store = ensureStore(); const before = store.reviewThreads.length; store.reviewThreads = store.reviewThreads.filter(item => item.id !== String(id)); return store.reviewThreads.length !== before; }
    function recordCompatibilityRun(report = {}) { const store = ensureStore(); const value = Object.assign({ id: `compat-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION }, deepClone(report)); store.compatibilityRuns.unshift(value); store.compatibilityRuns = store.compatibilityRuns.slice(0, 25); return deepClone(value); }
    function listCompatibilityRuns() { return (ensureStore().compatibilityRuns || []).map(deepClone); }
    function recordAssetAudit(report = {}) { const store = ensureStore(); const value = Object.assign({ id: `assets-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION }, deepClone(report)); store.assetAuditHistory.unshift(value); store.assetAuditHistory = store.assetAuditHistory.slice(0, 25); return deepClone(value); }
    function listAssetAudits() { return (ensureStore().assetAuditHistory || []).map(deepClone); }
    function setRecoveryPolicy(changes = {}) { const store = ensureStore(); store.recoveryPolicy = Object.assign({}, store.recoveryPolicy, { retain: Math.max(1, integer(changes.retain, store.recoveryPolicy?.retain || 10)), snapshotMinutes: Math.max(0, integer(changes.snapshotMinutes, store.recoveryPolicy?.snapshotMinutes || 0)) }); store.backupPolicy.retain = store.recoveryPolicy.retain; return deepClone(store.recoveryPolicy); }
    function productionPreferences(changes = null) { const store = ensureStore(); if (changes && typeof changes === "object") store.productionPreferences = Object.assign({}, store.productionPreferences, { locale: changes.locale === undefined ? store.productionPreferences.locale : String(changes.locale), highContrast: changes.highContrast === undefined ? store.productionPreferences.highContrast : toBoolean(changes.highContrast, false), reducedMotion: changes.reducedMotion === undefined ? store.productionPreferences.reducedMotion : toBoolean(changes.reducedMotion, false), renderBudget: Math.max(1000, integer(changes.renderBudget, store.productionPreferences.renderBudget || 12000)) }); return deepClone(store.productionPreferences); }
    function exportProductionHandoff(options = {}) { const store = ensureStore(); return canonicalizeWorkspace({ format: "HybridTileGraftProductionHandoff", version: 1, pluginVersion: VERSION, createdAt: new Date().toISOString(), workspace: exportWorkspaceBundle(options), reviewThreads: store.reviewThreads, compatibilityRuns: store.compatibilityRuns, assetAuditHistory: store.assetAuditHistory, recoveryPolicy: store.recoveryPolicy, preferences: store.productionPreferences, health: systemHealthReport() }); }

    function learnWfcRulesFromMap(options = {}) {
        const source = options.map || $dataMap; if (!source) return false; const layer = normalizeLayer(options.layer || "L1"); const z = LAYER_INDEX[layer]; const directions = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }; const rules = new Map();
        const rect = normalizeRect(options.x || 0, options.y || 0, options.width || source.width, options.height || source.height);
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (inBounds(x, y, source.width, source.height)) {
            const tileId = readTile(source.data, source.width, source.height, x, y, z); const rule = rules.get(tileId) || { tileId, weight: 0, allowed: { north: [], east: [], south: [], west: [] } }; rule.weight++;
            for (const [name, [dx, dy]] of Object.entries(directions)) if (inBounds(x + dx, y + dy, source.width, source.height)) { const adjacent = readTile(source.data, source.width, source.height, x + dx, y + dy, z); if (!rule.allowed[name].includes(adjacent)) rule.allowed[name].push(adjacent); }
            rules.set(tileId, rule);
        }
        const result = { format: "HybridTileGraftWfcRules", version: 1, id: String(options.id || `rules-${Date.now()}`), name: String(options.name || `Map ${typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0} ${layer}`), layer, tilesetId: source.tilesetId, learnedAt: Date.now(), rules: [...rules.values()] }; if (options.save !== false) ensureStore().wfcRuleSets[result.id] = deepClone(result); return result;
    }
    function listWfcRuleSets() { return Object.values(ensureStore().wfcRuleSets || {}).map(item => ({ id: item.id, name: item.name, layer: item.layer, tilesetId: item.tilesetId, learnedAt: item.learnedAt, ruleCount: item.rules?.length || 0 })); }
    function generateWaveFunctionMapBacktracking(options = {}) {
        const saved = options.ruleSetId && ensureStore().wfcRuleSets[String(options.ruleSetId)]; const rawRules = saved?.rules || (Array.isArray(options.rules) ? options.rules : parseJson(options.rules, []));
        const rules = rawRules.map(rule => ({ tileId: parseTileId(rule.tileId), weight: Math.max(.001, finiteNumber(rule.weight, 1)), allowed: rule.allowed || {} })).filter(rule => rule.tileId !== null); if (!rules.length) return false;
        const rect = normalizeRect(options.x || 0, options.y || 0, options.width || $dataMap.width, options.height || $dataMap.height); const random = seededRandom(options.seed || 0); const ids = rules.map(rule => rule.tileId); const byId = new Map(rules.map(rule => [rule.tileId, rule])); const domains = new Map();
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (inBounds(x, y) && (!options.mask || maskContains(options.mask, x, y))) domains.set(coordinateKey(x, y), new Set(ids));
        const directions = { north: [0, -1, "south"], east: [1, 0, "west"], south: [0, 1, "north"], west: [-1, 0, "east"] }; let working = domains; let backtracks = 0; const stack = [];
        const weightedOrder = values => values.map(value => ({ value, score: Math.pow(random() || 1e-9, 1 / byId.get(value).weight) })).sort((a, b) => b.score - a.score).map(item => item.value);
        const allowed = (a, direction, b) => { const list = normalizeList(byId.get(a)?.allowed?.[direction]).map(parseTileId).filter(value => value !== null); return !list.length || list.includes(b); };
        const propagate = seeds => { const queue = [...seeds]; let queueHead = 0; while (queueHead < queue.length) { const key = queue[queueHead++]; const domain = working.get(key); if (!domain?.size) return false; const [x, y] = key.split(",").map(Number); for (const [name, [dx, dy, opposite]] of Object.entries(directions)) { const nextKey = coordinateKey(x + dx, y + dy); const next = working.get(nextKey); if (!next) continue; const reduced = new Set([...next].filter(candidate => [...domain].some(value => allowed(value, name, candidate) && allowed(candidate, opposite, value)))); if (!reduced.size) return false; if (reduced.size < next.size) { working.set(nextKey, reduced); queue.push(nextKey); } } } return true; };
        while (true) {
            const choices = [...working.entries()].filter(([, domain]) => domain.size > 1).sort((a, b) => a[1].size - b[1].size); if (!choices.length) break; const [key, domain] = choices[0]; const candidates = weightedOrder([...domain]); const snapshot = new Map([...working].map(([cell, values]) => [cell, new Set(values)])); stack.push({ snapshot, key, remaining: candidates.slice(1) }); working.set(key, new Set([candidates[0]])); if (propagate([key])) continue;
            let recovered = false; while (stack.length && backtracks++ < Math.max(1, integer(options.maxBacktracks, 128))) { const frame = stack.at(-1); if (!frame.remaining.length) { stack.pop(); continue; } const candidate = frame.remaining.shift(); working = new Map([...frame.snapshot].map(([cell, values]) => [cell, new Set(values)])); working.set(frame.key, new Set([candidate])); if (propagate([frame.key])) { recovered = true; break; } } if (!recovered) { captureError(new Error("WFC could not satisfy all learned constraints."), { operation: "generateWaveFunctionMapBacktracking", backtracks }); return false; }
        }
        const layer = normalizeLayer(options.layer || saved?.layer || "L1"); const cells = [...working].map(([key, domain]) => { const [x, y] = key.split(",").map(Number); return { x, y, tiles: cellTilesForLayer(layer, [...domain][0], false) }; }); const mode = LAYER_INDEX[layer] <= 3 ? normalizeMode(options.mode, "autotile") : "exact"; const patch = makeSparsePatch(cells, mode, mode === "autotile" ? cells : null); patch.label = String(options.label || "Backtracking Wave Function Collapse"); patch.seed = options.seed; patch.backtracks = backtracks; patch.ruleSetId = saved?.id || null; const diagnostic = { createdAt: Date.now(), mapId: $gameMap.mapId(), layer, cells: cells.length, backtracks, solved: true, seed: options.seed, ruleSetId: patch.ruleSetId }; ensureStore().wfcDiagnostics.unshift(diagnostic); ensureStore().wfcDiagnostics = ensureStore().wfcDiagnostics.slice(0, 50); if (options.save !== false) addPatch($gameMap.mapId(), patch); applyPatchLive(patch, "generateWaveFunctionMapBacktracking"); return patch;
    }

    async function projectDependencyAudit(options = {}) {
        const ids = normalizeList(options.mapIds).map(Number).filter(Boolean); const mapIds = ids.length ? ids : $dataMapInfos.filter(Boolean).map(info => info.id); const known = new Set(mapIds); const maps = new Map(); const issues = [];
        for (const mapId of mapIds) try { maps.set(mapId, await preloadMap(mapId)); } catch (error) { issues.push({ severity: "error", mapId, message: error.message }); }
        for (const [mapId, map] of maps) for (const event of map.events || []) if (event) for (const page of event.pages || []) for (const command of page.list || []) {
            if (command.code === 201 && integer(command.parameters?.[0]) === 0) { const targetId = integer(command.parameters?.[1]); const target = maps.get(targetId); if (!known.has(targetId)) issues.push({ severity: "error", mapId, eventId: event.id, message: `Transfer targets missing Map ${targetId}.` }); else if (target && !inBounds(integer(command.parameters?.[2]), integer(command.parameters?.[3]), target.width, target.height)) issues.push({ severity: "error", mapId, eventId: event.id, message: `Transfer destination on Map ${targetId} is out of bounds.` }); }
            if (command.code === 117 && typeof $dataCommonEvents !== "undefined" && !$dataCommonEvents[integer(command.parameters?.[0])]) issues.push({ severity: "error", mapId, eventId: event.id, message: `Missing common event ${command.parameters?.[0]}.` });
        }
        for (const [id, validator] of extensionValidators) try { for (const issue of await Promise.resolve(validator({ maps, options })) || []) issues.push(Object.assign({ severity: "warning", extension: id }, issue)); } catch (error) { issues.push({ severity: "error", extension: id, message: error.message }); }
        return { ok: !issues.some(issue => issue.severity === "error"), checked: maps.size, errors: issues.filter(issue => issue.severity === "error").length, warnings: issues.filter(issue => issue.severity === "warning").length, issues };
    }
    function canonicalizeWorkspace(value) { if (Array.isArray(value)) return value.map(canonicalizeWorkspace); if (value && typeof value === "object") { const output = {}; for (const key of Object.keys(value).sort()) output[key] = canonicalizeWorkspace(value[key]); return output; } return value; }
    function exportCanonicalWorkspace(options = {}) { return canonicalizeWorkspace(exportWorkspaceBundle(options)); }
    function registerStudioExtension(manifest, activate = null) { if (!manifest?.id) throw new Error("Extension manifest.id is required."); const id = String(manifest.id); if (extensionRegistry.has(id)) return false; const record = { id, name: String(manifest.name || id), version: String(manifest.version || "0.0.0"), description: String(manifest.description || "") }; extensionRegistry.set(id, record); const callback = activate || manifest.activate; if (typeof callback === "function") callback(window.HybridTileGraft); return deepClone(record); }
    function registerExtensionBrush(id, callback) { if (!id || typeof callback !== "function") return false; extensionBrushes.set(String(id), callback); return true; }
    function runExtensionBrush(id, context = {}) { const callback = extensionBrushes.get(String(id)); if (!callback) return false; const result = callback(Object.assign({ mapId: $gameMap.mapId(), map: $dataMap }, context)); if (!Array.isArray(result)) return result; const cells = result.filter(item => item && inBounds(integer(item.x), integer(item.y))).map(item => ({ x: integer(item.x), y: integer(item.y), tiles: cellTilesForLayer(normalizeLayer(item.layer || context.layer || "L1"), parseTileId(item.tileId) || 0, false) })); const patch = makeSparsePatch(cells, context.mode || "exact", null); if (context.save !== false) addPatch($gameMap.mapId(), patch); applyPatchLive(patch, `extensionBrush:${id}`); return patch; }
    function registerExtensionGenerator(id, callback) { if (!id || typeof callback !== "function") return false; extensionGenerators.set(String(id), callback); return true; }
    function runExtensionGenerator(id, options = {}) { const callback = extensionGenerators.get(String(id)); return callback ? callback(Object.assign({ mapId: $gameMap.mapId(), map: $dataMap, api: window.HybridTileGraft }, options)) : false; }
    function registerExtensionValidator(id, callback) { if (!id || typeof callback !== "function") return false; extensionValidators.set(String(id), callback); return true; }
    function listStudioExtensions() { return [...extensionRegistry.values()].map(deepClone); }
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
    // -------------------------------------------------------------------------
    // v15 Creator Console production services
    // -------------------------------------------------------------------------

    const LIVE_PROTOCOL_CAPABILITIES = Object.freeze(["handshake", "heartbeat", "state-diff", "ack", "recording", "journey-replay", "recipe-reload", "universal-recovery", "diagnostics", "stale-cleanup"]);

    function negotiateLiveProduction(options = {}) {
        const requested = Math.max(1, integer(options.protocolVersion, 2));
        const session = ensureStore().activeLiveProductionSession;
        if (requested > 2) return { ok: false, format: "HybridLiveHandshake", protocolVersion: 2, requestedVersion: requested, error: `Protocol ${requested} is newer than this runtime supports.`, pluginVersion: VERSION };
        if (session) {
            session.protocolVersion = Math.min(2, requested);
            session.clientId = String(options.clientId || session.clientId || "studio");
            session.heartbeatAt = Date.now();
            session.capabilities = [...LIVE_PROTOCOL_CAPABILITIES];
            session.logs ||= [];
            session.logs.push({ kind: "handshake", clientId: session.clientId, at: Date.now(), protocolVersion: session.protocolVersion });
            session.logs = session.logs.slice(-200);
        }
        const response = { ok: true, format: "HybridLiveHandshake", version: 1, protocolVersion: Math.min(2, requested), pluginVersion: VERSION, runtime: typeof Utils !== "undefined" ? { name: Utils.RPGMAKER_NAME || "RPG Maker MZ", version: Utils.RPGMAKER_VERSION || "unknown", playtest: !Utils.isOptionValid || Utils.isOptionValid("test") } : { name: "RPG Maker MZ", version: "unknown", playtest: true }, clientId: String(options.clientId || session?.clientId || "studio"), sessionId: session?.id || null, sessionToken: session?.sessionToken || null, capabilities: [...LIVE_PROTOCOL_CAPABILITIES], heartbeatIntervalMs: 1000, staleAfterMs: session?.staleAfterMs || 30000, state: session ? liveProductionSnapshot() : null };
        ensureStore().liveProtocol = { version: response.protocolVersion, lastSequence: integer(session?.sequence), capabilities: [...response.capabilities], lastNegotiatedAt: Date.now(), clientId: response.clientId };
        return response;
    }

    function cleanLiveProductionArtifacts(options = {}) {
        const session = ensureStore().activeLiveProductionSession;
        if (session && options.force !== true) throw new Error("Stop Live Production before cleaning bridge artifacts.");
        if (typeof require !== "function" || typeof process === "undefined") return { supported: false, removed: [], retained: [] };
        const fs = require("fs"); const path = require("path"); const directory = path.resolve(String(options.directory || path.join(process.cwd(), "data"))); const staleMs = Math.max(0, integer(options.staleMs, 24 * 60 * 60 * 1000)); const now = Date.now(); const removed = []; const retained = [];
        for (const name of ["HybridTileLiveState.json", "HybridTileLiveCommands.json", "HybridTileLastRecording.json"]) {
            const target = path.join(directory, name); if (!fs.existsSync(target)) continue; const stat = fs.statSync(target); const stale = now - stat.mtimeMs >= staleMs;
            if (options.force === true || stale) { fs.unlinkSync(target); removed.push(name); } else retained.push({ name, ageMs: Math.max(0, now - stat.mtimeMs) });
        }
        recordOperation("cleanLiveProductionArtifacts", { removed: removed.length, retained: retained.length }); return { supported: true, directory, removed, retained };
    }

    function scenarioValue(source, key) { if (source && Object.prototype.hasOwnProperty.call(source, String(key))) return source[String(key)]; return source?.[key]; }
    function journeyAssertionSnapshot(assertions = {}) {
        const switches = {}; const variables = {};
        for (const id of Object.keys(assertions.switches || {})) switches[id] = typeof $gameSwitches !== "undefined" && $gameSwitches ? !!$gameSwitches.value(Number(id)) : undefined;
        for (const id of Object.keys(assertions.variables || {})) variables[id] = typeof $gameVariables !== "undefined" && $gameVariables ? deepClone($gameVariables.value(Number(id))) : undefined;
        return { mapId: typeof $gameMap !== "undefined" && $gameMap ? integer($gameMap.mapId()) : 0, player: typeof $gamePlayer !== "undefined" && $gamePlayer ? { x: integer($gamePlayer.x), y: integer($gamePlayer.y), direction: integer($gamePlayer.direction?.(), 2) } : null, switches, variables };
    }
    function evaluateJourneyAssertions(actual, expected = {}) {
        const failures = [];
        if (expected.mapId !== undefined && integer(actual.mapId) !== integer(expected.mapId)) failures.push({ field: "mapId", expected: expected.mapId, actual: actual.mapId });
        if (expected.player) for (const field of ["x", "y", "direction"]) if (expected.player[field] !== undefined && integer(actual.player?.[field]) !== integer(expected.player[field])) failures.push({ field: `player.${field}`, expected: expected.player[field], actual: actual.player?.[field] });
        for (const [id, value] of Object.entries(expected.switches || {})) if (scenarioValue(actual.switches, id) !== value) failures.push({ field: `switch:${id}`, expected: value, actual: scenarioValue(actual.switches, id) });
        for (const [id, value] of Object.entries(expected.variables || {})) if (JSON.stringify(scenarioValue(actual.variables, id)) !== JSON.stringify(value)) failures.push({ field: `variable:${id}`, expected: value, actual: scenarioValue(actual.variables, id) });
        return failures;
    }
    async function waitForJourneyCondition(condition = {}, timeoutMs = 3000) {
        const started = Date.now(); const matches = () => {
            const type = String(condition.type || "").toLowerCase();
            if (type === "switch") return typeof $gameSwitches !== "undefined" && $gameSwitches && $gameSwitches.value(positiveInteger(condition.id)) === !!condition.value;
            if (type === "variable") return typeof $gameVariables !== "undefined" && $gameVariables && JSON.stringify($gameVariables.value(positiveInteger(condition.id))) === JSON.stringify(condition.value);
            if (type === "map") return typeof $gameMap !== "undefined" && $gameMap && integer($gameMap.mapId()) === integer(condition.mapId);
            if (type === "position") return typeof $gamePlayer !== "undefined" && $gamePlayer && integer($gamePlayer.x) === integer(condition.x) && integer($gamePlayer.y) === integer(condition.y);
            if (type === "event-idle") return typeof $gameMap === "undefined" || !$gameMap?.isEventRunning?.();
            return true;
        };
        while (!matches() && Date.now() - started < timeoutMs) await new Promise(resolve => setTimeout(resolve, 16));
        return { passed: matches(), elapsedMs: Date.now() - started };
    }
    async function runPlaytestJourney(scenarioId, options = {}) {
        const store = ensureStore(); const scenario = typeof scenarioId === "object" ? deepClone(scenarioId) : deepClone(store.playtestScenarios[String(scenarioId)]); if (!scenario) throw new Error(`Unknown playtest journey ${scenarioId}.`);
        const execute = options.execute === true; const timeline = []; const failures = []; const warnings = []; const startedAt = Date.now(); const maximumSteps = Math.max(1, Math.min(10000, integer(options.maximumSteps, 5000))); const steps = normalizeList(scenario.steps).slice(0, maximumSteps);
        for (let index = 0; index < steps.length; index++) {
            const step = steps[index] || {}; const type = String(step.type || "").toLowerCase(); const entry = { index, type, startedAt: Date.now(), status: execute ? "running" : "planned" };
            try {
                if (execute) {
                    if (type === "move") { const direction = integer(step.detail?.direction ?? step.direction, 2); const count = Math.max(1, Math.min(999, integer(step.detail?.count ?? step.count, 1))); for (let move = 0; move < count; move++) $gamePlayer?.moveStraight?.(direction); }
                    else if (type === "transfer") { const mapId = positiveInteger(step.detail?.toMapId ?? step.detail?.mapId ?? step.mapId); $gamePlayer?.reserveTransfer?.(mapId, integer(step.player?.x ?? step.detail?.x), integer(step.player?.y ?? step.detail?.y), integer(step.player?.direction ?? step.detail?.direction, 2), integer(step.detail?.fadeType)); $gamePlayer?.performTransfer?.(); }
                    else if (type === "interaction") $gamePlayer?.triggerButtonAction?.();
                    else if (type === "switch") $gameSwitches?.setValue?.(positiveInteger(step.detail?.id), !!step.detail?.value);
                    else if (type === "variable") $gameVariables?.setValue?.(positiveInteger(step.detail?.id), deepClone(step.detail?.value));
                    else if (type === "recipe") await runWorldRecipe(step.detail?.recipeId, step.detail?.context || {}, {});
                    else if (type === "live-command") await Promise.resolve(applyLiveProductionCommand({ type: step.detail?.type, payload: step.detail?.payload || {} }));
                    else if (type === "choice") { if (typeof $gameMessage !== "undefined" && $gameMessage?.onChoice) $gameMessage.onChoice(integer(step.detail?.index)); else warnings.push({ index, message: "Choice replay is unavailable in this engine state." }); }
                    else if (type === "wait") await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(10000, integer(step.detail?.ms ?? step.ms, 16)))));
                    else if (type === "waituntil") { const wait = await waitForJourneyCondition(step.detail || step.condition, Math.max(16, integer(step.timeoutMs, options.timeoutMs || 3000))); if (!wait.passed) failures.push({ index, field: "waitUntil", expected: step.detail || step.condition, actual: "timeout" }); }
                    else if (type === "assert") failures.push(...evaluateJourneyAssertions(journeyAssertionSnapshot(step.detail || {}), step.detail || {}).map(item => Object.assign({ index }, item)));
                    else if (!["event-command", "recording-start", "map-enter"].includes(type)) warnings.push({ index, message: `Journey step ${type || "(missing)"} was preserved but has no executor.` });
                }
                entry.status = execute ? "completed" : "planned";
            } catch (error) { entry.status = "failed"; entry.error = String(error.message || error); failures.push({ index, field: "step", expected: type, actual: entry.error }); if (options.continueOnFailure !== true) { timeline.push(entry); break; } }
            entry.completedAt = Date.now(); timeline.push(entry);
        }
        const expected = scenario.assertions || {}; const actual = execute ? journeyAssertionSnapshot(expected) : deepClone(expected); failures.push(...evaluateJourneyAssertions(actual, expected));
        const run = { id: String(options.id || `journey-run-${Date.now()}`), format: "HybridPlaytestJourneyRun", version: 1, pluginVersion: VERSION, scenarioId: scenario.id || String(scenarioId), name: scenario.name || "Playtest journey", execute, startedAt, completedAt: Date.now(), timeline, assertions: deepClone(expected), actual, failures, warnings, passed: failures.length === 0 };
        store.playtestJourneyRuns.unshift(deepClone(run)); store.playtestJourneyRuns = store.playtestJourneyRuns.slice(0, 100); return run;
    }
    function listPlaytestJourneyRuns() { return (ensureStore().playtestJourneyRuns || []).map(item => ({ id: item.id, scenarioId: item.scenarioId, name: item.name, execute: item.execute, startedAt: item.startedAt, completedAt: item.completedAt, passed: item.passed, failures: item.failures?.length || 0, warnings: item.warnings?.length || 0 })); }

    async function runProductionTestSuite(options = {}) {
        const store = ensureStore(); const selected = normalizeList(options.scenarioIds).length ? normalizeList(options.scenarioIds) : Object.keys(store.playtestScenarios || {}); const scenarios = [];
        for (const id of selected) scenarios.push(await runPlaytestJourney(id, { execute: options.execute === true, continueOnFailure: options.continueOnFailure === true, timeoutMs: options.timeoutMs }));
        const goldenMaps = [];
        if (options.includeGoldenMaps !== false) for (const definition of normalizeList(options.goldenMaps)) goldenMaps.push(await runGoldenMapTest(definition));
        const failures = scenarios.reduce((sum, item) => sum + (item.passed ? 0 : 1), 0) + goldenMaps.filter(item => !item.checksumMatch).length; const run = { id: String(options.id || `production-tests-${Date.now()}`), format: "HybridProductionTestRun", version: 1, pluginVersion: VERSION, startedAt: scenarios[0]?.startedAt || Date.now(), completedAt: Date.now(), execute: options.execute === true, scenarios, goldenMaps, failures, passed: failures === 0 };
        store.productionTestRuns.unshift(deepClone(run)); store.productionTestRuns = store.productionTestRuns.slice(0, 50); return run;
    }
    function listProductionTestRuns() { return (ensureStore().productionTestRuns || []).map(item => ({ id: item.id, startedAt: item.startedAt, completedAt: item.completedAt, execute: item.execute, scenarios: item.scenarios?.length || 0, goldenMaps: item.goldenMaps?.length || 0, failures: item.failures, passed: item.passed })); }

    function createUniversalRecoveryPoint(name = "Production restore point", options = {}) {
        const base = createRecoverySnapshot(name, { automatic: options.automatic === true, retain: options.retain, id: options.id }); if (!base) return false;
        const point = { id: base.id, format: "HybridUniversalRecoveryPoint", version: 1, pluginVersion: VERSION, name: base.name, createdAt: base.createdAt, reason: String(options.reason || "manual"), scope: normalizeList(options.scope).length ? normalizeList(options.scope).map(String) : ["maps","events","tilesets","recipes","world","extensions"], mapId: typeof $gameMap !== "undefined" && $gameMap ? integer($gameMap.mapId()) : 0, stateHash: stableProductionHash(workspaceStateSnapshot()) };
        ensureStore().universalRecoveryPoints.unshift(point); ensureStore().universalRecoveryPoints = ensureStore().universalRecoveryPoints.slice(0, Math.max(1, integer(options.retain, 20))); return deepClone(point);
    }
    function restoreUniversalRecoveryPoint(id) { const point = ensureStore().universalRecoveryPoints.find(item => item.id === String(id)); if (!point) return false; const restored = restoreRecoverySnapshot(point.id); if (restored) { point.lastRestoredAt = Date.now(); recordOperation("restoreUniversalRecoveryPoint", { id: point.id }); } return restored; }
    function listUniversalRecoveryPoints() { return (ensureStore().universalRecoveryPoints || []).map(deepClone); }

    function searchProjectReferences(query = "", options = {}) {
        const text = String(query || "").trim().toLowerCase(); if (!text) return [];
        const maximum = Math.max(1, Math.min(5000, integer(options.limit, 500))); const results = []; const visited = new Set(); const root = exportCanonicalWorkspace({ includeHistory: false });
        const walk = (value, path = "workspace", depth = 0) => { if (results.length >= maximum || depth > 24 || value === null || value === undefined) return; if (typeof value === "object") { if (visited.has(value)) return; visited.add(value); if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1)); else for (const [key, item] of Object.entries(value)) { if (`${key}`.toLowerCase().includes(text)) results.push({ type: "key", path: `${path}.${key}`, value: typeof item === "object" ? "" : String(item).slice(0, 240) }); walk(item, `${path}.${key}`, depth + 1); } } else { const rendered = String(value); if (rendered.toLowerCase().includes(text)) results.push({ type: typeof value, path, value: rendered.slice(0, 240) }); } };
        walk(root); const record = { query: String(query), at: Date.now(), results: results.length }; ensureStore().projectSearchHistory.unshift(record); ensureStore().projectSearchHistory = ensureStore().projectSearchHistory.slice(0, 50); return results.slice(0, maximum);
    }
    function planReferenceRename(from, to, options = {}) {
        const source = String(from || ""); const target = String(to || ""); if (!source || !target || source === target) throw new Error("Safe rename requires different non-empty source and target values."); const matches = searchProjectReferences(source, { limit: options.limit || 2000 }).filter(item => options.exact === false ? item.value.includes(source) : item.value === source || item.path.split(".").at(-1) === source); const plan = { id: String(options.id || `rename-plan-${Date.now()}`), format: "HybridReferenceRenamePlan", version: 1, pluginVersion: VERSION, from: source, to: target, createdAt: Date.now(), matches, count: matches.length, applySupported: false, reason: "Runtime plans are preview-only; apply project-file renames from Studio with backups." }; ensureStore().referenceRenamePlans.unshift(deepClone(plan)); ensureStore().referenceRenamePlans = ensureStore().referenceRenamePlans.slice(0, 30); return plan;
    }

    function mapTransferLandmarks(map) {
        const results = [];
        for (const event of map.events || []) if (event) for (let pageIndex = 0; pageIndex < (event.pages || []).length; pageIndex++) for (const command of event.pages[pageIndex].list || []) if (integer(command.code) === 201) { const parameters = command.parameters || []; results.push({ eventId: event.id, eventName: event.name || `Event ${event.id}`, pageIndex, x: integer(event.x), y: integer(event.y), targetMapId: integer(parameters[1]), targetX: integer(parameters[2]), targetY: integer(parameters[3]) }); }
        return results;
    }
    function analyzePassabilityMap(snapshot = null, options = {}) {
        const map = snapshot || (typeof $dataMap !== "undefined" ? $dataMap : null); if (!map) throw new Error("A map snapshot is required."); const width = positiveInteger(map.width); const height = positiveInteger(map.height); const flags = typeof $dataTilesets !== "undefined" ? ($dataTilesets?.[integer(map.tilesetId)]?.flags || []) : []; const directions = [{ d: 2, dx: 0, dy: 1, bit: 1, opposite: 8, oppositeBit: 8 },{ d: 4, dx: -1, dy: 0, bit: 2, opposite: 6, oppositeBit: 4 },{ d: 6, dx: 1, dy: 0, bit: 4, opposite: 4, oppositeBit: 2 },{ d: 8, dx: 0, dy: -1, bit: 8, opposite: 2, oppositeBit: 1 }];
        const semanticPassable = (x, y) => { for (let z = 3; z >= 0; z--) { const tileId = integer(map.data[(z * height + y) * width + x]); const semantic = semanticTile(tileId, map.tilesetId); if (!semantic.passable || semantic.labels.some(label => /wall|cliff|blocked|void/i.test(label))) return false; } return true; };
        const canLeave = (x, y, bit) => { if (x < 0 || y < 0 || x >= width || y >= height) return false; if (!flags.length) return semanticPassable(x, y); for (let z = 3; z >= 0; z--) { const tileId = integer(map.data[(z * height + y) * width + x]); const flag = integer(flags[tileId]); if (flag & 0x10) continue; return (flag & bit) === 0; } return semanticPassable(x, y); };
        const cells = []; const adjacency = new Map(); const oneWay = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const key = `${x},${y}`; const exits = []; for (const direction of directions) { const nx = x + direction.dx; const ny = y + direction.dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue; const forward = canLeave(x, y, direction.bit); const backward = canLeave(nx, ny, direction.oppositeBit); if (forward) exits.push(direction.d); if (forward && backward) { const target = `${nx},${ny}`; (adjacency.get(key) || adjacency.set(key, []).get(key)).push(target); } else if (forward !== backward) oneWay.push({ x, y, direction: direction.d, to: { x: nx, y: ny }, forward, backward }); } cells.push({ x, y, passable: exits.length > 0, exits }); }
        const components = []; const visited = new Set(); for (const cell of cells.filter(item => item.passable)) { const start = `${cell.x},${cell.y}`; if (visited.has(start)) continue; const queue = [start]; let queueHead = 0; const members = []; while (queueHead < queue.length) { const key = queue[queueHead++]; if (visited.has(key)) continue; visited.add(key); members.push(key); queue.push(...(adjacency.get(key) || [])); } components.push(members); } components.sort((a,b)=>b.length-a.length);
        const transfers = mapTransferLandmarks(map); const componentFor = (x,y) => components.findIndex(group => group.includes(`${integer(x)},${integer(y)}`)); const isolatedTransfers = transfers.filter(item => componentFor(item.x,item.y) < 0 || componentFor(item.x,item.y) > 0); const report = { format: "HybridPassabilityReport", version: 1, pluginVersion: VERSION, mapId: integer(options.mapId || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0)), width, height, tilesetId: integer(map.tilesetId), usedTilesetFlags: flags.length > 0, cells, components: components.map((members,index)=>({ id:index, cells:members.length, sample:members.slice(0,12) })), oneWay: oneWay.slice(0,1000), transfers, isolatedTransfers, reachableCells: components[0]?.length || 0, blockedCells: cells.filter(item=>!item.passable).length, ok: isolatedTransfers.length === 0 };
        ensureStore().passabilityReports.unshift(deepClone(Object.assign({}, report, { cells: undefined }))); ensureStore().passabilityReports = ensureStore().passabilityReports.slice(0,30); return report;
    }
    function detectMapSoftlocks(snapshot = null, options = {}) {
        const map = snapshot || (typeof $dataMap !== "undefined" ? $dataMap : null); const passage = analyzePassabilityMap(map, options); const issues = [];
        for (const transfer of passage.isolatedTransfers) issues.push({ severity: "error", type: "isolated-transfer", eventId: transfer.eventId, x: transfer.x, y: transfer.y, message: `${transfer.eventName} is outside the primary reachable area.` });
        if (passage.components.length > 1) issues.push({ severity: "warning", type: "disconnected-areas", message: `${passage.components.length} disconnected passable areas were detected.` });
        for (const edge of passage.oneWay.slice(0,50)) issues.push({ severity: "warning", type: "one-way-passage", x: edge.x, y: edge.y, message: `One-way passage at ${edge.x}, ${edge.y} toward direction ${edge.direction}.` });
        for (const event of map?.events || []) if (event) for (const page of event.pages || []) if (integer(page.trigger) === 3 && (page.list || []).some(command => integer(command.code) === 0) && !(page.list || []).some(command => [121,123,115,201].includes(integer(command.code)))) issues.push({ severity: "warning", type: "autorun-loop", eventId: event.id, message: `${event.name || `Event ${event.id}`} may autorun without a visible exit condition.` });
        const report = { format: "HybridSoftlockReport", version: 1, pluginVersion: VERSION, mapId: passage.mapId, createdAt: Date.now(), issues, errors: issues.filter(item=>item.severity==="error").length, warnings: issues.filter(item=>item.severity==="warning").length, passability: { components: passage.components, reachableCells: passage.reachableCells, blockedCells: passage.blockedCells }, ok: !issues.some(item=>item.severity==="error") }; ensureStore().softlockReports.unshift(deepClone(report)); ensureStore().softlockReports = ensureStore().softlockReports.slice(0,30); return report;
    }

    function performanceCenterReport(options = {}) {
        const store = ensureStore(); const map = options.snapshot || (typeof $dataMap !== "undefined" ? $dataMap : null); const events = (map?.events || []).filter(Boolean); const parallel = events.flatMap(event => (event.pages || []).map((page,index)=>({event,index,page}))).filter(item=>integer(item.page.trigger)===4); const autorun = events.flatMap(event => (event.pages || []).map((page,index)=>({event,index,page}))).filter(item=>integer(item.page.trigger)===3); const recipes = worldRecipePerformance({ sort: "average" }); const operations = performanceDiagnostics(); const storeSize = estimateStoreBytes(); const recommendations = [];
        if (parallel.length > Math.max(10, integer(options.parallelWarning, 10))) recommendations.push({ severity:"warning", type:"parallel-events", message:`${parallel.length} parallel event pages can compete for frame time.` });
        if (autorun.length > 4) recommendations.push({ severity:"warning", type:"autorun-events", message:`${autorun.length} autorun pages deserve explicit termination checks.` });
        if (storeSize.estimatedBytes > Math.max(1024*1024, integer(options.storeWarningBytes, 8*1024*1024))) recommendations.push({ severity:"warning", type:"save-size", message:`Hybrid authoring state is approximately ${(storeSize.estimatedBytes/1024/1024).toFixed(1)} MiB.` });
        for (const item of recipes.slice(0,10)) if (finiteNumber(item.maxMs) > runtimeBudget().frameBudgetMs) recommendations.push({ severity:"warning", type:"recipe-budget", recipeId:item.recipeId, message:`Recipe ${item.recipeId} peaked at ${finiteNumber(item.maxMs).toFixed(2)}ms.` });
        for (const [name,value] of Object.entries(operations.operations || {})) if (value.maxMs > PERFORMANCE_WARNING_MS) recommendations.push({ severity:"info", type:"operation-budget", operation:name, message:`${name} peaked at ${value.maxMs.toFixed(2)}ms.` });
        const report = { format:"HybridPerformanceCenterReport", version:1, pluginVersion:VERSION, createdAt:Date.now(), mapId:typeof $gameMap!=="undefined"&&$gameMap?integer($gameMap.mapId()):0, eventDensity:{events:events.length,parallel:parallel.length,autorun:autorun.length,cells:map?positiveInteger(map.width)*positiveInteger(map.height):0}, operations, recipes, store:storeSize, runtimeBudget:runtimeBudget(), recommendations:recommendations.slice(0,100), score:Math.max(0,100-recommendations.filter(item=>item.severity==="warning").length*8), ok:!recommendations.some(item=>item.severity==="error") }; store.performanceCenterReports.unshift(deepClone(report)); store.performanceCenterReports=store.performanceCenterReports.slice(0,30); return report;
    }

    function configureExtensionSecurityProfile(extensionId, options = {}) {
        const id=String(extensionId||""); const manifest=ensureStore().extensionManifests[id]; if(!id||!manifest) throw new Error(`Extension ${id||"(missing)"} is not installed.`); const current=ensureStore().extensionSecurityProfiles[id]||{}; const profile=Object.assign({},current,{extensionId:id,isolation:["worker","process","trusted"].includes(String(options.isolation))?String(options.isolation):(current.isolation||"worker"),network:options.network===true,fileRead:normalizeList(options.fileRead??current.fileRead).map(String),fileWrite:normalizeList(options.fileWrite??current.fileWrite).map(String),payloadBudgetKb:Math.max(64,Math.min(10240,integer(options.payloadBudgetKb,current.payloadBudgetKb||1024))),timeBudgetMs:Math.max(1,Math.min(5000,integer(options.timeBudgetMs,current.timeBudgetMs||16))),publisherId:String(options.publisherId||current.publisherId||manifest.publisher||""),manifestHash:stableProductionHash(manifest),enabled:options.enabled!==false,quarantined:options.clearQuarantine?false:options.quarantined===true||!!current.quarantined,updatedAt:Date.now()}); ensureStore().extensionSecurityProfiles[id]=profile; configureExtensionSandbox(id,{enabled:profile.enabled,quarantined:profile.quarantined,timeBudgetMs:profile.timeBudgetMs,memoryBudgetKb:profile.payloadBudgetKb,clearQuarantine:options.clearQuarantine}); return deepClone(profile);
    }
    function listExtensionSecurityProfiles(){return Object.values(ensureStore().extensionSecurityProfiles||{}).map(item=>Object.assign(deepClone(item),{publisherVerification:verifyExtensionPublisher(item.extensionId)}));}
    function registerExtensionPublisher(definition={}){const id=safeWorldRecipeId(definition.id);if(!id)throw new Error("Extension publisher requires a safe id.");const publisher={id,name:String(definition.name||id),fingerprint:String(definition.fingerprint||""),trusted:definition.trusted===true,homepage:String(definition.homepage||""),registeredAt:ensureStore().extensionPublishers[id]?.registeredAt||Date.now(),updatedAt:Date.now()};ensureStore().extensionPublishers[id]=publisher;return deepClone(publisher);}
    function verifyExtensionPublisher(extensionId){const id=String(extensionId||"");const manifest=ensureStore().extensionManifests[id];if(!manifest)return{ok:false,extensionId:id,error:"Extension manifest is not installed."};const profile=ensureStore().extensionSecurityProfiles[id]||{};const publisherId=String(profile.publisherId||manifest.publisher||"");const publisher=ensureStore().extensionPublishers[publisherId];const manifestHash=stableProductionHash(manifest);const declared=String(manifest.publisherFingerprint||manifest.fingerprint||"");return{ok:!!publisher&&publisher.trusted===true&&(!declared||declared===publisher.fingerprint),extensionId:id,publisherId,publisher:publisher?deepClone(publisher):null,trusted:!!publisher?.trusted,fingerprintMatch:!declared||declared===publisher?.fingerprint,manifestHash,warning:!publisher?"Publisher is not registered.":!publisher.trusted?"Publisher is not trusted locally.":declared&&declared!==publisher.fingerprint?"Publisher fingerprint does not match.":""};}

    function collaborationBundleValue(idOrBundle){return typeof idOrBundle==="object"?idOrBundle:ensureStore().collaborationBundles.find(item=>item.id===String(idOrBundle));}
    function compareCollaborationBundles(fromId,toId){const from=collaborationBundleValue(fromId),to=collaborationBundleValue(toId);if(!from||!to)throw new Error("Both collaboration bundles are required.");const keySet=(items,key="id")=>new Map(normalizeList(items).map(item=>[String(item?.[key]??stableProductionHash(item)),item]));const compare=(left,right)=>{const a=keySet(left),b=keySet(right),added=[],removed=[],changed=[];for(const[key,value]of b)if(!a.has(key))added.push(deepClone(value));else if(stableProductionHash(a.get(key))!==stableProductionHash(value))changed.push({id:key,from:deepClone(a.get(key)),to:deepClone(value)});for(const[key,value]of a)if(!b.has(key))removed.push(deepClone(value));return{added,removed,changed};};const result={id:`collaboration-diff-${Date.now()}`,format:"HybridCollaborationComparison",version:1,pluginVersion:VERSION,createdAt:new Date().toISOString(),from:{id:from.id,fingerprint:from.fingerprint},to:{id:to.id,fingerprint:to.fingerprint},maps:compare(from.mapIds||from.maps,to.mapIds||to.maps),reviews:compare(from.reviewThreads||from.reviews,to.reviewThreads||to.reviews),comments:compare(from.reviewComments,to.reviewComments),changed:from.fingerprint!==to.fingerprint};ensureStore().collaborationComparisons.unshift(deepClone(result));ensureStore().collaborationComparisons=ensureStore().collaborationComparisons.slice(0,30);return result;}
    function createCollaborationMergePlan(fromId,toId,options={}){const comparison=compareCollaborationBundles(fromId,toId);const conflicts=[...comparison.reviews.changed.map(item=>({type:"review",id:item.id,ours:item.from,theirs:item.to})),...comparison.comments.changed.map(item=>({type:"comment",id:item.id,ours:item.from,theirs:item.to}))];const plan={id:String(options.id||`merge-plan-${Date.now()}`),format:"HybridCollaborationMergePlan",version:1,pluginVersion:VERSION,createdAt:new Date().toISOString(),from:comparison.from,to:comparison.to,strategy:String(options.strategy||"manual"),changes:{maps:comparison.maps,reviews:comparison.reviews,comments:comparison.comments},conflicts,resolved:false,applySupported:false,reason:"Portable review merges are previewed here; map/event application remains an explicit Studio transaction."};ensureStore().collaborationMergePlans.unshift(deepClone(plan));ensureStore().collaborationMergePlans=ensureStore().collaborationMergePlans.slice(0,30);return plan;}

    function registerCompatibilityProfileV15(definition={}){const id=safeWorldRecipeId(definition.id);if(!id)throw new Error("Compatibility profiles require a safe id.");const profile={id,name:String(definition.name||id),description:String(definition.description||""),pluginNames:normalizeList(definition.pluginNames).map(String),checks:normalizeList(definition.checks).map(deepClone),suppressions:normalizeList(definition.suppressions).map(String),updatedAt:Date.now()};ensureStore().compatibilityProfilesV15[id]=profile;return deepClone(profile);}
    function runCompatibilityProfilesV15(options={}){const store=ensureStore();const scripts=normalizeList(typeof PluginManager!=="undefined"?PluginManager._scripts:[]).map(String);const results=[];for(const profile of Object.values(store.compatibilityProfilesV15||{})){const detected=!profile.pluginNames.length||profile.pluginNames.some(name=>scripts.some(script=>script.toLowerCase().includes(name.toLowerCase())));const checks=[];if(detected)for(const check of profile.checks||[]){const type=String(check.type||"global").toLowerCase();let passed=true;let actual=null;if(type==="global"){actual=!!resolveGlobalPath(String(check.path||""));passed=check.exists===false?!actual:actual;}else if(type==="pluginorder"){const before=scripts.findIndex(item=>item.toLowerCase().includes(String(check.before||"").toLowerCase())),after=scripts.findIndex(item=>item.toLowerCase().includes(String(check.after||"").toLowerCase()));actual={before,after};passed=before>=0&&after>=0&&before<after;}else if(type==="method"){const value=resolveGlobalPath(String(check.path||""));actual=typeof value;passed=actual===(check.expected||"function");}checks.push({id:String(check.id||`${profile.id}-${checks.length}`),type,passed,actual,message:String(check.message||"")});}results.push({profileId:profile.id,name:profile.name,detected,checks,passed:!detected||checks.every(item=>item.passed),suppressions:deepClone(profile.suppressions)});}const report={id:`compatibility-profiles-${Date.now()}`,format:"HybridCompatibilityProfileRun",version:1,pluginVersion:VERSION,createdAt:Date.now(),scripts,results,passed:results.every(item=>item.passed)};store.compatibilityProfileRunsV15.unshift(deepClone(report));store.compatibilityProfileRunsV15=store.compatibilityProfileRunsV15.slice(0,30);return report;}
    function listCompatibilityProfilesV15(){return Object.values(ensureStore().compatibilityProfilesV15||{}).map(deepClone);}

    function releaseFingerprintValue(idOrValue){return typeof idOrValue==="object"?idOrValue:ensureStore().releaseFingerprints.find(item=>item.id===String(idOrValue));}
    function compareReleaseFingerprints(fromId,toId){const from=releaseFingerprintValue(fromId),to=releaseFingerprintValue(toId);if(!from||!to)throw new Error("Both release fingerprints are required.");const fields=["workspaceHash","packLockHash","recipeHash","extensionHash","channel"];const changes=fields.filter(field=>JSON.stringify(from[field])!==JSON.stringify(to[field])).map(field=>({field,from:deepClone(from[field]),to:deepClone(to[field])}));const maps={added:normalizeList(to.mapIds).filter(id=>!normalizeList(from.mapIds).includes(id)),removed:normalizeList(from.mapIds).filter(id=>!normalizeList(to.mapIds).includes(id))};const comparison={id:`release-comparison-${Date.now()}`,format:"HybridReleaseComparison",version:1,pluginVersion:VERSION,createdAt:new Date().toISOString(),from:{id:from.id,fingerprint:from.fingerprint},to:{id:to.id,fingerprint:to.fingerprint},changes,maps,identical:from.fingerprint===to.fingerprint};ensureStore().releaseComparisons.unshift(deepClone(comparison));ensureStore().releaseComparisons=ensureStore().releaseComparisons.slice(0,30);return comparison;}
    function createReleaseManifestV15(options={}){const fingerprint=options.fingerprint?releaseFingerprintValue(options.fingerprint):createReleaseFingerprint(options);const manifest={id:String(options.id||`release-manifest-${Date.now()}`),format:"HybridReleaseManifest",version:1,pluginVersion:VERSION,createdAt:new Date().toISOString(),channel:String(options.channel||fingerprint.channel||"stable"),fingerprint:deepClone(fingerprint),targets:normalizeList(options.targets).length?normalizeList(options.targets).map(String):["windows","macos","linux"],artifacts:{productionBundle:String(options.productionBundle||"project-production.htgrelease"),report:String(options.report||"release-report.json"),fingerprint:String(options.fingerprintFile||"release.htgfingerprint")},signing:{windows:!!options.windowsSigned,macos:!!options.macosSigned,linux:!!options.linuxSigned},updateChannel:String(options.updateChannel||options.channel||"stable"),sourceRevision:String(options.sourceRevision||""),checksums:deepClone(options.checksums||{}),notes:String(options.notes||"")};manifest.manifestHash=stableProductionHash(manifest);ensureStore().releaseManifestsV15.unshift(deepClone(manifest));ensureStore().releaseManifestsV15=ensureStore().releaseManifestsV15.slice(0,30);return manifest;}
    async function validateProductionHandoff(options={}){const validation=await runProductionValidation(options);const tests=options.skipTests?null:await runProductionTestSuite({scenarioIds:options.scenarioIds,execute:false,includeGoldenMaps:false});const performance=performanceCenterReport(options);const compatibility=runCompatibilityProfilesV15({execute:false});const extensions=listExtensionSecurityProfiles();const liveStopped=!ensureStore().activeLiveProductionSession;const errors=integer(validation.errors)+(tests&&!tests.passed?tests.failures:0)+extensions.filter(item=>item.quarantined||item.publisherVerification?.ok===false&&item.publisherId).length+(liveStopped?0:1);const warnings=integer(validation.warnings)+performance.recommendations.filter(item=>item.severity==="warning").length+extensions.filter(item=>!item.publisherVerification?.trusted).length;const handoff={id:String(options.id||`handoff-${Date.now()}`),format:"HybridProductionHandoff",version:1,pluginVersion:VERSION,createdAt:new Date().toISOString(),validation,tests,performance,compatibility,extensions,liveStopped,errors,warnings,ready:errors===0,fingerprint:createReleaseFingerprint(options)};ensureStore().productionHandoffs.unshift(deepClone(handoff));ensureStore().productionHandoffs=ensureStore().productionHandoffs.slice(0,20);return handoff;}
    // -------------------------------------------------------------------------
    // v16 Worldsmith production systems
    // -------------------------------------------------------------------------

    function mapSnapshotV16(value = null) {
        const map = value || (typeof $dataMap !== "undefined" ? $dataMap : null);
        if (!map || !positiveInteger(map.width) || !positiveInteger(map.height) || !Array.isArray(map.data)) throw new Error("A valid RPG Maker map snapshot is required.");
        const expected = positiveInteger(map.width) * positiveInteger(map.height) * 6;
        if (map.data.length < expected) throw new Error(`Map data has ${map.data.length} cells; expected at least ${expected}.`);
        return deepClone(map);
    }

    function createVisualMapDraft(options = {}) {
        const map = mapSnapshotV16(options.map);
        const id = String(options.id || `map-draft-${Date.now()}`);
        const draft = {
            id, format: "HybridVisualMapDraft", version: 1, pluginVersion: VERSION,
            name: String(options.name || `Map ${integer(options.mapId || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0))} draft`),
            mapId: integer(options.mapId || (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0)),
            createdAt: Date.now(), updatedAt: Date.now(), map, changes: {}, history: [], redo: [],
            lockedCells: normalizeList(options.lockedCells).map(String), layers: normalizeList(options.layers).length ? normalizeList(options.layers).map(integer) : [0,1,2,3,4,5]
        };
        draft.baseHash = stableProductionHash(map); draft.draftHash = draft.baseHash;
        ensureStore().visualMapDraftsV16[id] = draft;
        return deepClone(draft);
    }

    function visualMapDraft(id) {
        const draft = ensureStore().visualMapDraftsV16[String(id)];
        if (!draft) throw new Error(`Visual map draft ${id} was not found.`);
        return draft;
    }

    function mapDraftPointsV16(draft, operation) {
        const map = draft.map, width = positiveInteger(map.width), height = positiveInteger(map.height);
        const layer = Math.max(0, Math.min(5, integer(operation.layer, 0)));
        const x0 = Math.max(0, Math.min(width - 1, integer(operation.x, 0)));
        const y0 = Math.max(0, Math.min(height - 1, integer(operation.y, 0)));
        const tool = String(operation.tool || "paint").toLowerCase();
        const points = [];
        const add = (x,y) => { if (x >= 0 && y >= 0 && x < width && y < height) points.push({ x, y, layer, tileId: Math.max(0, integer(operation.tileId, 0)) }); };
        if (tool === "rectangle" || tool === "box") {
            const w = Math.max(1, integer(operation.width, 1)), h = Math.max(1, integer(operation.height, 1));
            for (let y = y0; y < Math.min(height, y0 + h); y++) for (let x = x0; x < Math.min(width, x0 + w); x++) add(x,y);
        } else if (tool === "replace") {
            const from = integer(operation.fromTileId, map.data[(layer * height + y0) * width + x0]);
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (integer(map.data[(layer * height + y) * width + x]) === from) add(x,y);
        } else if (tool === "fill") {
            const from = integer(map.data[(layer * height + y0) * width + x0]);
            const queue = [[x0,y0]], visited = new Set(); let queueHead = 0;
            while (queueHead < queue.length && visited.size < width * height) { const [x,y] = queue[queueHead++], key = `${x},${y}`; if (visited.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue; visited.add(key); if (integer(map.data[(layer * height + y) * width + x]) !== from) continue; add(x,y); queue.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
        } else if (tool === "line") {
            let x1=x0,y1=y0,x2=Math.max(0,Math.min(width-1,integer(operation.x2,x0))),y2=Math.max(0,Math.min(height-1,integer(operation.y2,y0))); const dx=Math.abs(x2-x1),sx=x1<x2?1:-1,dy=-Math.abs(y2-y1),sy=y1<y2?1:-1;let error=dx+dy;
            while(true){add(x1,y1);if(x1===x2&&y1===y2)break;const twice=2*error;if(twice>=dy){error+=dy;x1+=sx;}if(twice<=dx){error+=dx;y1+=sy;}}
        } else add(x0,y0);
        return points;
    }

    function paintVisualMapDraft(id, operations = []) {
        const draft = visualMapDraft(id), map = draft.map, width = positiveInteger(map.width), height = positiveInteger(map.height);
        const before = [], points = normalizeList(operations).flatMap(operation => mapDraftPointsV16(draft, operation));
        for (const point of points) {
            const lockKey = `${point.x},${point.y}`; if (draft.lockedCells.includes(lockKey)) continue;
            if (!draft.layers.includes(point.layer)) continue;
            const index = (point.layer * height + point.y) * width + point.x, oldTileId = integer(map.data[index]);
            if (oldTileId === point.tileId) continue;
            before.push({ index, x: point.x, y: point.y, layer: point.layer, tileId: oldTileId });
            map.data[index] = point.tileId; draft.changes[index] = { index, x:point.x, y:point.y, layer:point.layer, fromTileId:draft.changes[index]?.fromTileId ?? oldTileId, tileId:point.tileId };
        }
        if (before.length) { draft.history.push({ at:Date.now(), before, label:String(normalizeList(operations)[0]?.label || "Paint map draft") }); draft.history = draft.history.slice(-100); draft.redo = []; }
        draft.updatedAt = Date.now(); draft.draftHash = stableProductionHash(map);
        return { id:draft.id, changed:before.length, totalChanges:Object.keys(draft.changes).length, draftHash:draft.draftHash };
    }

    function undoVisualMapDraft(id) {
        const draft=visualMapDraft(id), action=draft.history.pop(); if(!action)return false; const after=[];
        for(const item of action.before){after.push({index:item.index,tileId:integer(draft.map.data[item.index])});draft.map.data[item.index]=item.tileId;const original=draft.changes[item.index]?.fromTileId;if(original===item.tileId)delete draft.changes[item.index];else if(draft.changes[item.index])draft.changes[item.index].tileId=item.tileId;}
        draft.redo.push({at:Date.now(),after,label:action.label});draft.draftHash=stableProductionHash(draft.map);draft.updatedAt=Date.now();return true;
    }

    function commitVisualMapDraft(id, options = {}) {
        const draft=visualMapDraft(id), changes=Object.values(draft.changes), safe=ensureStore().safeModeV16;
        if(safe.enabled && changes.length > positiveInteger(safe.maximumWrites,100000))throw new Error(`Safe Mode stopped ${changes.length} writes; the limit is ${safe.maximumWrites}.`);
        const preview={id:draft.id,format:"HybridVisualMapCommit",version:1,pluginVersion:VERSION,mapId:draft.mapId,writes:changes.length,baseHash:draft.baseHash,draftHash:draft.draftHash,previewOnly:options.apply!==true};
        if(options.apply!==true)return preview;
        if(typeof $gameMap==="undefined"||!$gameMap||integer($gameMap.mapId())!==draft.mapId)throw new Error("Open the draft's map before applying it in the runtime.");
        const recovery=safe.requireRecoveryPoint?createUniversalRecoveryPoint(`Before ${draft.name}`,{reason:"visual-map-commit",scope:["maps","events"]}):null;
        for(const change of changes)setTile(change.x,change.y,`L${change.layer+1}`,change.tileId,options.save!==false,{mode:"exact"});
        preview.previewOnly=false;preview.applied=true;preview.recoveryId=recovery?.id||null;preview.appliedAt=Date.now();draft.committedAt=preview.appliedAt;return preview;
    }

    function compileWorldRecipeGraph(definition = {}) {
        const id=safeWorldRecipeId(definition.id||`graph-${Date.now()}`);if(!id)throw new Error("Recipe graphs require a safe id.");
        const nodes=normalizeList(definition.nodes).map((node,index)=>({id:safeWorldRecipeId(node.id||`node-${index+1}`),type:String(node.type||"stage"),name:String(node.name||node.id||`Stage ${index+1}`),options:deepClone(node.options||{}),locked:node.locked===true}));
        const nodeIds=new Set(nodes.map(node=>node.id)),edges=normalizeList(definition.edges).map(edge=>({from:String(edge.from||""),to:String(edge.to||""),condition:deepClone(edge.condition||null)}));const errors=[];
        if(!nodes.length)errors.push("Add at least one recipe node.");if(nodeIds.size!==nodes.length)errors.push("Recipe node ids must be unique.");for(const edge of edges)if(!nodeIds.has(edge.from)||!nodeIds.has(edge.to))errors.push(`Edge ${edge.from} → ${edge.to} references a missing node.`);
        const incoming=new Map(nodes.map(node=>[node.id,0])),outgoing=new Map(nodes.map(node=>[node.id,[]]));for(const edge of edges)if(nodeIds.has(edge.from)&&nodeIds.has(edge.to)){incoming.set(edge.to,incoming.get(edge.to)+1);outgoing.get(edge.from).push(edge.to);}
        const queue=nodes.filter(node=>incoming.get(node.id)===0).map(node=>node.id),order=[];let queueHead=0;while(queueHead<queue.length){const current=queue[queueHead++];order.push(current);for(const target of outgoing.get(current)||[]){incoming.set(target,incoming.get(target)-1);if(incoming.get(target)===0)queue.push(target);}}
        if(order.length!==nodes.length)errors.push("Recipe graph contains a cycle.");
        const graph={id,format:"HybridWorldRecipeGraph",version:1,pluginVersion:VERSION,name:String(definition.name||id),seed:String(definition.seed||"worldsmith"),nodes,edges,constraints:normalizeList(definition.constraints).map(deepClone),lockedCells:normalizeList(definition.lockedCells).map(String),order,errors,warnings:[],valid:errors.length===0,updatedAt:Date.now()};graph.graphHash=stableProductionHash(graph);ensureStore().worldRecipeGraphsV16[id]=graph;return deepClone(graph);
    }

    function lockWorldRecipeGraphCells(graphId, cells = [], locked = true) { const graph=ensureStore().worldRecipeGraphsV16[String(graphId)];if(!graph)throw new Error(`Recipe graph ${graphId} was not found.`);const values=new Set(graph.lockedCells||[]);for(const cell of normalizeList(cells))locked?values.add(String(cell)):values.delete(String(cell));graph.lockedCells=[...values].sort();graph.updatedAt=Date.now();graph.graphHash=stableProductionHash(graph);return deepClone(graph.lockedCells); }
    function regenerateWorldRecipeGraph(graphId, options = {}) { const graph=ensureStore().worldRecipeGraphsV16[String(graphId)];if(!graph)throw new Error(`Recipe graph ${graphId} was not found.`);if(!graph.valid)throw new Error(graph.errors.join(" "));const selected=normalizeList(options.stageIds).length?new Set(normalizeList(options.stageIds).map(String)):null;const stages=graph.order.filter(id=>!selected||selected.has(id)).map((id,index)=>{const node=graph.nodes.find(item=>item.id===id);return{id,type:node.type,locked:node.locked===true,seed:stableProductionHash(`${graph.seed}:${id}:${options.seed||""}`),order:index};});const result={id:`generation-${Date.now()}`,format:"HybridWorldRecipeGeneration",version:1,pluginVersion:VERSION,graphId:graph.id,graphHash:graph.graphHash,seed:String(options.seed||graph.seed),lockedCells:deepClone(graph.lockedCells),stages,previewOnly:options.apply!==true,createdAt:Date.now()};graph.lastGeneration=deepClone(result);return result; }

    function mapDiffV16(before, after) { const max=Math.max(before.data.length,after.data.length),tiles=[];for(let index=0;index<max;index++)if(integer(before.data[index])!==integer(after.data[index]))tiles.push({index,from:integer(before.data[index]),to:integer(after.data[index])});const a=before.events||[],b=after.events||[],events=[];for(let id=1;id<Math.max(a.length,b.length);id++)if(stableProductionHash(a[id]||null)!==stableProductionHash(b[id]||null))events.push({id,change:!a[id]?"added":!b[id]?"removed":"changed",from:deepClone(a[id]||null),to:deepClone(b[id]||null)});const metadata={};for(const key of ["width","height","tilesetId","scrollType","parallaxName","battleback1Name","battleback2Name","displayName","note"])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))metadata[key]={from:deepClone(before[key]),to:deepClone(after[key])};return{tiles,events,metadata}; }
    function createRoundTripPlan(beforeValue, afterValue, options = {}) { const before=mapSnapshotV16(beforeValue),after=mapSnapshotV16(afterValue),diff=mapDiffV16(before,after),errors=[];if(before.width!==after.width||before.height!==after.height)errors.push("Map dimensions changed; verify transfers and event positions before writing.");for(const event of (after.events||[]).filter(Boolean))if(event.x<0||event.y<0||event.x>=after.width||event.y>=after.height)errors.push(`Event ${event.id} is outside map bounds.`);const plan={id:String(options.id||`round-trip-${Date.now()}`),format:"HybridRoundTripPlan",version:1,pluginVersion:VERSION,mapId:integer(options.mapId),createdAt:Date.now(),beforeHash:stableProductionHash(before),afterHash:stableProductionHash(after),diff:{tileChanges:diff.tiles.length,eventChanges:diff.events.length,metadataChanges:Object.keys(diff.metadata).length,tiles:options.includeTiles===false?undefined:diff.tiles.slice(0,Math.max(1,integer(options.limit,10000))),events:diff.events,metadata:diff.metadata},backupRequired:true,atomicWrite:true,errors,warnings:diff.tiles.length>before.width*before.height*3?["More than half of all tile-layer cells changed."]:[],safe:errors.length===0};ensureStore().roundTripPlansV16.unshift(deepClone(plan));ensureStore().roundTripPlansV16=ensureStore().roundTripPlansV16.slice(0,50);return plan; }

    function createQuestProject(definition = {}) { const id=safeWorldRecipeId(definition.id||`quest-${Date.now()}`);if(!id)throw new Error("Quest projects require a safe id.");const nodes=normalizeList(definition.nodes).map((node,index)=>({id:safeWorldRecipeId(node.id||`step-${index+1}`),type:String(node.type||"objective"),title:String(node.title||node.name||`Objective ${index+1}`),description:String(node.description||""),conditions:deepClone(node.conditions||[]),rewards:deepClone(node.rewards||[])})),edges=normalizeList(definition.edges).map(edge=>({from:String(edge.from||""),to:String(edge.to||""),choice:String(edge.choice||""),conditions:deepClone(edge.conditions||[])})),ids=new Set(nodes.map(node=>node.id)),errors=[];if(!nodes.length)errors.push("Add at least one quest node.");for(const edge of edges)if(!ids.has(edge.from)||!ids.has(edge.to))errors.push(`Quest edge ${edge.from} → ${edge.to} is broken.`);const starts=normalizeList(definition.startIds).length?normalizeList(definition.startIds).map(String):nodes.slice(0,1).map(node=>node.id),reachable=new Set(),queue=[...starts];let queueHead=0;while(queueHead<queue.length){const id=queue[queueHead++];if(reachable.has(id)||!ids.has(id))continue;reachable.add(id);queue.push(...edges.filter(edge=>edge.from===id).map(edge=>edge.to));}const unreachable=nodes.filter(node=>!reachable.has(node.id)).map(node=>node.id);if(unreachable.length)errors.push(`Unreachable quest nodes: ${unreachable.join(", ")}.`);const project={id,format:"HybridQuestProject",version:1,pluginVersion:VERSION,name:String(definition.name||id),nodes,edges,startIds:starts,variables:deepClone(definition.variables||{}),switches:deepClone(definition.switches||{}),unreachable,errors,valid:errors.length===0,updatedAt:Date.now()};project.questHash=stableProductionHash(project);ensureStore().questProjectsV16[id]=project;return deepClone(project); }
    function createCutsceneTimeline(definition = {}) { const id=safeWorldRecipeId(definition.id||`cutscene-${Date.now()}`);const cues=normalizeList(definition.cues).map((cue,index)=>({id:String(cue.id||`cue-${index+1}`),at:Math.max(0,finiteNumber(cue.at,0)),duration:Math.max(0,finiteNumber(cue.duration,0)),track:String(cue.track||"event"),type:String(cue.type||"command"),target:String(cue.target||""),payload:deepClone(cue.payload||{})})).sort((a,b)=>a.at-b.at);const cuesDuration=Math.max(0,...cues.map(cue=>cue.at+cue.duration));const timeline={id,format:"HybridCutsceneTimeline",version:1,pluginVersion:VERSION,name:String(definition.name||id),cues,duration:cuesDuration,tracks:[...new Set(cues.map(cue=>cue.track))],updatedAt:Date.now()};timeline.timelineHash=stableProductionHash(timeline);ensureStore().cutsceneTimelinesV16[id]=timeline;return deepClone(timeline); }

    async function runPlaytestLab(options = {}) { const startedAt=Date.now(),tests=await runProductionTestSuite({scenarioIds:options.scenarioIds,execute:options.execute===true,includeGoldenMaps:options.includeGoldenMaps===true}),map=options.map||(typeof $dataMap!=="undefined"?$dataMap:null),softlocks=map?detectMapSoftlocks(map,options):null,performance=performanceCenterReport({snapshot:map,...options}),budgets={maxWarnings:Math.max(0,integer(options.maxWarnings,20)),minPerformanceScore:Math.max(0,integer(options.minPerformanceScore,70))};const failures=integer(tests.failures)+(softlocks&&!softlocks.ok?softlocks.errors:0)+(performance.score<budgets.minPerformanceScore?1:0),run={id:String(options.id||`playtest-lab-${Date.now()}`),format:"HybridPlaytestLabRun",version:1,pluginVersion:VERSION,startedAt,completedAt:Date.now(),tests,softlocks,performance,budgets,failures,passed:failures===0};ensureStore().playtestLabRunsV16.unshift(deepClone(run));ensureStore().playtestLabRunsV16=ensureStore().playtestLabRunsV16.slice(0,30);return run; }
    function createBugReportBundle(options = {}) { const bundle={id:String(options.id||`bug-${Date.now()}`),format:"HybridBugReportBundle",version:1,pluginVersion:VERSION,title:String(options.title||"Playtest issue"),description:String(options.description||""),createdAt:new Date().toISOString(),runtime:typeof Utils!=="undefined"?{name:Utils.RPGMAKER_NAME,version:Utils.RPGMAKER_VERSION}:{name:"RPG Maker MZ",version:"unknown"},mapId:integer(options.mapId||(typeof $gameMap!=="undefined"&&$gameMap?$gameMap.mapId():0)),player:typeof $gamePlayer!=="undefined"&&$gamePlayer?{x:$gamePlayer.x,y:$gamePlayer.y,direction:$gamePlayer.direction()}:null,steps:normalizeList(options.steps).map(deepClone),expected:String(options.expected||""),actual:String(options.actual||""),logs:deepClone(ensureStore().worldRecipeLog.slice(0,50)),health:systemHealthReport(),includeSaveData:options.includeSaveData===true};bundle.fingerprint=stableProductionHash(bundle);ensureStore().bugReportBundlesV16.unshift(deepClone(bundle));ensureStore().bugReportBundlesV16=ensureStore().bugReportBundlesV16.slice(0,30);return bundle; }

    function setCreatorExperienceV16(changes = {}) { const allowed=new Set(["beginner","guided","expert"]),current=ensureStore().creatorExperienceV16;const next=Object.assign({},current,deepClone(changes));next.mode=allowed.has(String(next.mode))?String(next.mode):"guided";for(const key of ["largeText","highContrast","reducedMotion","sound","controller"])next[key]=next[key]!==false;ensureStore().creatorExperienceV16=next;return deepClone(next); }
    function registerContentLibraryItem(definition = {}) { const id=safeWorldRecipeId(definition.id||`content-${Date.now()}`);if(!id)throw new Error("Content items require a safe id.");const previous=ensureStore().contentLibraryV16[id],item={id,format:"HybridContentLibraryItem",version:Math.max(1,integer(definition.version,previous?.version||1)),name:String(definition.name||id),type:String(definition.type||"map-fragment"),description:String(definition.description||""),tags:normalizeList(definition.tags).map(String),dependencies:normalizeList(definition.dependencies).map(String),thumbnail:String(definition.thumbnail||""),payload:deepClone(definition.payload||{}),favorite:definition.favorite===true||previous?.favorite===true,createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now()};item.contentHash=stableProductionHash(item.payload);ensureStore().contentLibraryV16[id]=item;return deepClone(item); }
    function searchContentLibraryV16(query = "", options = {}) { const terms=String(query).toLowerCase().split(/\s+/).filter(Boolean),types=new Set(normalizeList(options.types).map(String));return Object.values(ensureStore().contentLibraryV16).filter(item=>(!types.size||types.has(item.type))&&(!options.favoritesOnly||item.favorite)&&terms.every(term=>`${item.id} ${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(term))).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt-a.updatedAt).map(deepClone); }

    function mergeValuesV16(base, ours, theirs, path, conflicts, strategy) { const a=stableProductionHash(base),b=stableProductionHash(ours),c=stableProductionHash(theirs);if(b===c)return deepClone(ours);if(a===b)return deepClone(theirs);if(a===c)return deepClone(ours);const plain=value=>value&&typeof value==="object"&&!Array.isArray(value);if(plain(base)&&plain(ours)&&plain(theirs)){const result={};for(const key of new Set([...Object.keys(base),...Object.keys(ours),...Object.keys(theirs)]))result[key]=mergeValuesV16(base[key],ours[key],theirs[key],path?`${path}.${key}`:key,conflicts,strategy);return result;}conflicts.push({path:path||"$",base:deepClone(base),ours:deepClone(ours),theirs:deepClone(theirs)});return deepClone(strategy==="theirs"?theirs:strategy==="base"?base:ours); }
    function createThreeWayProjectMerge(base = {}, ours = {}, theirs = {}, options = {}) { const conflicts=[],strategy=["ours","theirs","base","manual"].includes(String(options.strategy))?String(options.strategy):"manual",merged=mergeValuesV16(base,ours,theirs,"",conflicts,strategy==="manual"?"ours":strategy),plan={id:String(options.id||`project-merge-${Date.now()}`),format:"HybridProjectMergePlan",version:1,pluginVersion:VERSION,createdAt:Date.now(),strategy,baseHash:stableProductionHash(base),oursHash:stableProductionHash(ours),theirsHash:stableProductionHash(theirs),mergedHash:stableProductionHash(merged),conflicts,resolved:conflicts.length===0||strategy!=="manual",merged};ensureStore().projectMergePlansV16.unshift(deepClone(plan));ensureStore().projectMergePlansV16=ensureStore().projectMergePlansV16.slice(0,30);return plan; }
    function createSourceControlSnapshot(options = {}) { const canonical=exportCanonicalWorkspace({includeHistory:options.includeHistory===true}),snapshot={id:String(options.id||`source-${Date.now()}`),format:"HybridSourceControlSnapshot",version:1,pluginVersion:VERSION,branch:String(options.branch||ensureStore().activeWorkspaceBranch||"main"),message:String(options.message||"Worldsmith checkpoint"),createdAt:new Date().toISOString(),workspaceHash:stableProductionHash(canonical),mapIds:projectMapIds(options),canonical};ensureStore().sourceControlSnapshotsV16.unshift(deepClone(snapshot));ensureStore().sourceControlSnapshotsV16=ensureStore().sourceControlSnapshotsV16.slice(0,20);return snapshot; }

    function setExtensionCapabilityPolicyV16(extensionId, policy = {}) { const id=String(extensionId||"");if(!id)throw new Error("An extension id is required.");const requested=normalizeList(policy.capabilities).map(String),denied=requested.filter(item=>!EXTENSION_PERMISSIONS.has(item)),record={extensionId:id,capabilities:requested.filter(item=>EXTENSION_PERMISSIONS.has(item)),denied,isolation:["worker","process","trusted"].includes(String(policy.isolation))?String(policy.isolation):"worker",payloadBudgetKb:Math.max(64,Math.min(10240,integer(policy.payloadBudgetKb,1024))),timeBudgetMs:Math.max(1,Math.min(5000,integer(policy.timeBudgetMs,16))),enabled:policy.enabled!==false,updatedAt:Date.now()};ensureStore().extensionCapabilityPoliciesV16[id]=record;return deepClone(record); }
    function safeModeV16(changes = null) { if(changes&&typeof changes==="object"){const current=ensureStore().safeModeV16;ensureStore().safeModeV16=Object.assign({},current,{enabled:changes.enabled??current.enabled,requireRecoveryPoint:changes.requireRecoveryPoint??current.requireRecoveryPoint,maximumWrites:Math.max(1,integer(changes.maximumWrites,current.maximumWrites))});}return deepClone(ensureStore().safeModeV16); }

    async function productionDashboardV16(options = {}) { const startedAt=Date.now(),health=systemHealthReport(),performance=performanceCenterReport(options),extensions=listExtensionSecurityProfiles(),compatibility=runCompatibilityProfilesV15(),tests=options.runTests===true?await runProductionTestSuite({execute:false,includeGoldenMaps:options.includeGoldenMaps===true}):null,openReviews=(ensureStore().reviewThreads||[]).filter(item=>item.status!=="resolved").length,issues=[];if(!health.ok)issues.push({severity:"error",type:"system-health",message:"System health checks reported errors."});if(performance.score<70)issues.push({severity:"warning",type:"performance",message:`Performance score is ${performance.score}.`});if(extensions.some(item=>item.quarantined))issues.push({severity:"error",type:"extension-quarantine",message:"One or more extensions are quarantined."});if(tests&&!tests.passed)issues.push({severity:"error",type:"tests",message:`${tests.failures} production tests failed.`});if(openReviews)issues.push({severity:"info",type:"reviews",message:`${openReviews} review threads remain open.`});const errors=issues.filter(item=>item.severity==="error").length,warnings=issues.filter(item=>item.severity==="warning").length,report={id:String(options.id||`dashboard-${Date.now()}`),format:"HybridProductionDashboard",version:1,pluginVersion:VERSION,startedAt,completedAt:Date.now(),health,performance,extensions,compatibility,tests,openReviews,issues,score:Math.max(0,100-errors*20-warnings*8-Math.min(20,openReviews*2)),ready:errors===0,fingerprint:createReleaseFingerprint(options)};ensureStore().productionDashboardsV16.unshift(deepClone(report));ensureStore().productionDashboardsV16=ensureStore().productionDashboardsV16.slice(0,30);return report; }
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

    // ---------------------------------------------------------------------
    // v12 rule painting, procedural graphs, recovery, catalogs, and budgets
    // ---------------------------------------------------------------------

    function normalizeWorldRuleLayer(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Rule layers require a safe stable ID.");
        const cells = {}; for (const [key, value] of Object.entries(definition?.cells || {})) if (/^-?\d+,-?\d+$/.test(key)) cells[key] = deepClone(value);
        return Object.assign({ id, name: definition?.name || id, mapId: Math.max(0, integer(definition?.mapId)), kind: String(definition?.kind || "gameplay"), visible: definition?.visible !== false, opacity: Math.max(0, Math.min(1, finiteNumber(definition?.opacity, .65))), rules: {}, cells, metadata: {}, updatedAt: Date.now() }, deepClone(definition), { id, cells });
    }

    function defineWorldRuleLayer(definition) { const layer = normalizeWorldRuleLayer(definition); ensureStore().worldRuleLayers[layer.id] = layer; return deepClone(layer); }
    function worldRuleLayer(id) { const value = ensureStore().worldRuleLayers[String(id || "")]; return value ? deepClone(value) : null; }
    function listWorldRuleLayers(options = {}) { return Object.values(ensureStore().worldRuleLayers || {}).filter(layer => !options.mapId || !layer.mapId || layer.mapId === integer(options.mapId)).map(layer => Object.assign(deepClone(layer), { cellCount: Object.keys(layer.cells || {}).length })); }
    function removeWorldRuleLayer(id) { const key = String(id || ""); const existed = !!ensureStore().worldRuleLayers[key]; delete ensureStore().worldRuleLayers[key]; return existed; }

    function paintWorldRules(layerId, input, value = true, options = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) throw new Error(`Rule layer "${layerId}" was not found.`);
        const cells = [];
        if (input && !Array.isArray(input) && (input.width !== undefined || input.w !== undefined)) { const rect = normalizeRect(input.x, input.y, input.width ?? input.w, input.height ?? input.h); for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.push({ x, y }); }
        else cells.push(...normalizeList(input));
        const mode = String(options.mode || "paint").toLowerCase(); let changed = 0;
        for (const cell of cells) { const key = coordinateKey(integer(cell?.x ?? cell?.[0]), integer(cell?.y ?? cell?.[1])); const existing = layer.cells[key]; if (mode === "erase" || value === null || value === undefined || value === false) { if (existing !== undefined) { delete layer.cells[key]; changed++; } } else if (mode === "toggle" && existing !== undefined) { delete layer.cells[key]; changed++; } else { layer.cells[key] = deepClone(cell?.value ?? value); changed++; } }
        layer.updatedAt = Date.now(); recordOperation("paintWorldRules", { layerId: layer.id, changed, mode }); return { layerId: layer.id, changed, cellCount: Object.keys(layer.cells).length };
    }

    function saveWorldRuleBrush(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Rule brush presets require a safe stable ID.");
        const brush = Object.assign({ id, name: definition?.name || id, shape: "circle", size: 3, hardness: .75, falloff: "smooth", mode: "paint", value: true, updatedAt: Date.now() }, deepClone(definition), { id });
        brush.size = Math.max(1, Math.min(128, integer(brush.size, 3))); brush.hardness = Math.max(0, Math.min(1, finiteNumber(brush.hardness, .75))); ensureStore().worldRuleBrushes[id] = brush; return deepClone(brush);
    }
    function listWorldRuleBrushes() { return Object.values(ensureStore().worldRuleBrushes || {}).map(deepClone); }
    function removeWorldRuleBrush(id) { const key = String(id || ""); const existed = !!ensureStore().worldRuleBrushes[key]; delete ensureStore().worldRuleBrushes[key]; return existed; }

    function paintWorldRuleBrush(layerId, center, brush = {}, value = true, options = {}) {
        const preset = typeof brush === "string" ? ensureStore().worldRuleBrushes[brush] : brush; if (!preset) throw new Error(`Rule brush "${brush}" was not found.`);
        const shape = String(preset.shape || options.shape || "circle").toLowerCase(); const size = Math.max(1, Math.min(128, integer(preset.size ?? options.size, 3))); const radius = Math.max(.5, size / 2); const origin = { x: integer(center?.x ?? center?.[0]), y: integer(center?.y ?? center?.[1]) }; const target = center?.to || options.to;
        const cells = new Map(); const add = (x, y, distance = 0) => cells.set(coordinateKey(x, y), { x, y, distance });
        if (shape === "line" && target) {
            let x0 = origin.x; let y0 = origin.y; const x1 = integer(target.x ?? target[0]); const y1 = integer(target.y ?? target[1]); const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1; const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1; let error = dx + dy;
            while (true) { add(x0, y0, 0); if (x0 === x1 && y0 === y1) break; const twice = 2 * error; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; } }
        } else {
            for (let y = Math.floor(origin.y - radius); y <= Math.ceil(origin.y + radius); y++) for (let x = Math.floor(origin.x - radius); x <= Math.ceil(origin.x + radius); x++) { const distance = shape === "rectangle" || shape === "square" ? Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) : Math.hypot(x - origin.x, y - origin.y); if (distance <= radius) add(x, y, distance); }
        }
        const hardness = Math.max(0, Math.min(1, finiteNumber(preset.hardness ?? options.hardness, .75))); const falloff = String(preset.falloff || options.falloff || "smooth").toLowerCase(); const gradient = options.gradient !== false && (hardness < 1 || preset.gradient === true); const painted = [];
        for (const cell of cells.values()) { const normalized = Math.max(0, Math.min(1, cell.distance / Math.max(.5, radius))); let weight = normalized <= hardness ? 1 : Math.max(0, 1 - (normalized - hardness) / Math.max(.0001, 1 - hardness)); if (falloff === "smooth") weight = weight * weight * (3 - 2 * weight); else if (falloff === "quadratic") weight *= weight; painted.push({ x: cell.x, y: cell.y, value: gradient ? { value: deepClone(preset.value ?? value), weight: Number(weight.toFixed(4)) } : deepClone(preset.value ?? value) }); }
        const result = paintWorldRules(layerId, painted, preset.value ?? value, { mode: preset.mode || options.mode || "paint" }); return Object.assign(result, { brush: { shape, size, hardness, falloff }, bounds: { x: Math.floor(origin.x - radius), y: Math.floor(origin.y - radius), width: Math.ceil(radius * 2) + 1, height: Math.ceil(radius * 2) + 1 } });
    }

    function filterWorldRuleLayer(layerId, predicate = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return [];
        const minimumWeight = finiteNumber(predicate.minimumWeight, -Infinity); const value = predicate.value; const bounds = predicate.bounds; const results = [];
        for (const [key, raw] of Object.entries(layer.cells || {})) { const [x, y] = key.split(",").map(Number); const weight = finiteNumber(raw?.weight, raw === true ? 1 : 0); const actual = raw?.value === undefined ? raw : raw.value; if (weight < minimumWeight || (value !== undefined && JSON.stringify(actual) !== JSON.stringify(value))) continue; if (bounds && (x < bounds.x || y < bounds.y || x >= bounds.x + (bounds.width ?? bounds.w) || y >= bounds.y + (bounds.height ?? bounds.h))) continue; results.push({ x, y, value: deepClone(actual), weight }); }
        return results;
    }

    function ruleLayerStatistics(layerId) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return false; const values = Object.values(layer.cells || {}); const weights = values.map(value => finiteNumber(value?.weight, value === false ? 0 : 1));
        return { layerId: layer.id, cells: values.length, weightedCells: values.filter(value => value && typeof value === "object" && value.weight !== undefined).length, minimumWeight: weights.length ? Math.min(...weights) : 0, maximumWeight: weights.length ? Math.max(...weights) : 0, averageWeight: weights.length ? weights.reduce((sum, value) => sum + value, 0) / weights.length : 0, estimatedBytes: JSON.stringify(layer.cells || {}).length * 2 };
    }

    function worldRulesAt(mapId, x, y, options = {}) {
        const key = coordinateKey(integer(x), integer(y)); return Object.values(ensureStore().worldRuleLayers || {}).filter(layer => layer.visible !== false && (!layer.mapId || layer.mapId === integer(mapId)) && layer.cells?.[key] !== undefined && (!options.kind || layer.kind === options.kind)).map(layer => ({ layerId: layer.id, name: layer.name, kind: layer.kind, value: deepClone(layer.cells[key]), rules: deepClone(layer.rules || {}) }));
    }

    function compileWorldRuleLayer(layerId, options = {}) {
        const layer = ensureStore().worldRuleLayers[String(layerId || "")]; if (!layer) return false; const points = Object.keys(layer.cells || {}).map(key => key.split(",").map(Number));
        if (!points.length) return { ok: false, errors: ["The rule layer has no painted cells."] };
        const recipeId = safeWorldRecipeId(options.recipeId) || `${layer.id}-rule`; const recipe = { id: recipeId, name: String(options.name || `${layer.name} Rule`), enabled: options.enabled !== false, triggers: [{ type: options.trigger || "playerStep" }], conditions: { all: [{ type: "ruleLayer", id: layer.id, value: options.value }] }, actions: deepClone(options.actions || layer.rules?.actions || []), metadata: { ruleLayerId: layer.id, generatedBy: "HybridTileGraft v12" } };
        const registered = registerWorldRecipe(recipe, options.save !== false); return { ok: true, recipe: registered, cells: points.length };
    }

    const BIOME_NODE_TYPES = new Set(["climate", "biome", "road", "river", "dungeon", "wfc", "scatterprefabs", "rules", "custom"]);
    function validateBiomeGraph(graph) {
        const errors = []; const id = safeWorldRecipeId(graph?.id); if (!id) errors.push("Biome graph requires a safe stable id."); const nodes = normalizeList(graph?.nodes); const byId = new Map();
        for (const node of nodes) { const nodeId = safeWorldRecipeId(node?.id); if (!nodeId) errors.push("Every biome node requires a safe id."); else if (byId.has(nodeId)) errors.push(`Duplicate biome node ${nodeId}.`); else byId.set(nodeId, node); if (!BIOME_NODE_TYPES.has(canonicalWorldRecipeType(node?.type))) errors.push(`Unsupported biome node type ${node?.type}.`); }
        for (const node of nodes) for (const dependency of normalizeList(node.after || node.dependencies)) if (!byId.has(String(dependency))) errors.push(`Node ${node.id} depends on missing node ${dependency}.`);
        const visiting = new Set(); const visited = new Set(); const order = []; const visit = node => { if (visiting.has(node.id)) { errors.push(`Biome graph cycle at ${node.id}.`); return; } if (visited.has(node.id)) return; visiting.add(node.id); for (const dependency of normalizeList(node.after || node.dependencies)) if (byId.has(String(dependency))) visit(byId.get(String(dependency))); visiting.delete(node.id); visited.add(node.id); order.push(node.id); }; for (const node of nodes) visit(node);
        return { ok: errors.length === 0, errors, id, nodeCount: nodes.length, order };
    }
    function defineBiomeGraph(definition) { const report = validateBiomeGraph(definition); if (!report.ok) throw new Error(report.errors.join("; ")); const graph = Object.assign({ id: report.id, name: definition.name || report.id, seed: "world", nodes: [], metadata: {}, updatedAt: Date.now() }, deepClone(definition), { id: report.id }); ensureStore().worldBiomeGraphs[graph.id] = graph; return deepClone(graph); }
    function listBiomeGraphs() { return Object.values(ensureStore().worldBiomeGraphs || {}).map(graph => Object.assign(deepClone(graph), { nodeCount: graph.nodes?.length || 0 })); }
    function removeBiomeGraph(id) { const key = String(id || ""); const existed = !!ensureStore().worldBiomeGraphs[key]; delete ensureStore().worldBiomeGraphs[key]; return existed; }
    function previewBiomeGraph(idOrGraph, options = {}) { const graph = typeof idOrGraph === "string" ? ensureStore().worldBiomeGraphs[idOrGraph] : idOrGraph; if (!graph) return { ok: false, errors: ["Biome graph was not found."] }; const validation = validateBiomeGraph(graph); return Object.assign(validation, { graphId: graph.id, mapId: integer(options.mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0), seed: String(options.seed || graph.seed || "world"), nodes: validation.order.map(id => { const node = graph.nodes.find(item => item.id === id); return { id, type: node.type, label: node.name || id, options: deepClone(node.options || {}) }; }) }); }

    function biomeCacheKey(graphId, mapId, nodeId, seed, options = {}) { return `${String(graphId)}:${integer(mapId)}:${String(nodeId)}:${worldPackChecksum({ seed: String(seed || "world"), options: canonicalizeWorkspace(options) })}`; }
    function cacheBiomeStage(graphId, mapId, nodeId, seed, result, options = {}) { const key = biomeCacheKey(graphId, mapId, nodeId, seed, options); const record = { key, graphId: String(graphId), mapId: integer(mapId), nodeId: String(nodeId), seed: String(seed || "world"), result: deepClone(result), createdAt: Date.now(), hits: 0 }; ensureStore().worldBiomeCache[key] = record; return deepClone(record); }
    function biomeStageCache(graphId, mapId, nodeId, seed, options = {}) { const key = biomeCacheKey(graphId, mapId, nodeId, seed, options); const record = ensureStore().worldBiomeCache[key]; if (!record) return null; record.hits = integer(record.hits) + 1; record.lastHitAt = Date.now(); return deepClone(record); }
    function clearBiomeCache(options = {}) { const store = ensureStore(); const keys = Object.keys(store.worldBiomeCache || {}); let removed = 0; for (const key of keys) { const record = store.worldBiomeCache[key]; if (options.graphId && record.graphId !== String(options.graphId)) continue; if (options.mapId && record.mapId !== integer(options.mapId)) continue; delete store.worldBiomeCache[key]; removed++; } return removed; }

    function lockBiomeCells(graphId, mapId, cells, options = {}) {
        const id = safeWorldRecipeId(graphId); if (!id) throw new Error("Biome locks require a graph ID."); const key = `${id}:${integer(mapId)}`; const record = ensureStore().worldBiomeLocks[key] ||= { graphId: id, mapId: integer(mapId), cells: {}, updatedAt: Date.now() };
        for (const cell of normalizeList(cells)) { const x = integer(cell?.x ?? cell?.[0]); const y = integer(cell?.y ?? cell?.[1]); record.cells[coordinateKey(x, y)] = { x, y, reason: String(cell?.reason || options.reason || "Protected by author"), stages: normalizeList(cell?.stages || options.stages).map(String) }; }
        record.updatedAt = Date.now(); return deepClone(record);
    }
    function unlockBiomeCells(graphId, mapId, cells = null) { const key = `${String(graphId)}:${integer(mapId)}`; const record = ensureStore().worldBiomeLocks[key]; if (!record) return false; if (!cells) { delete ensureStore().worldBiomeLocks[key]; return true; } let removed = 0; for (const cell of normalizeList(cells)) { const coordinate = coordinateKey(integer(cell?.x ?? cell?.[0]), integer(cell?.y ?? cell?.[1])); if (record.cells[coordinate]) { delete record.cells[coordinate]; removed++; } } if (!Object.keys(record.cells).length) delete ensureStore().worldBiomeLocks[key]; return removed; }
    function listBiomeLocks(options = {}) { return Object.values(ensureStore().worldBiomeLocks || {}).filter(lock => (!options.graphId || lock.graphId === String(options.graphId)) && (!options.mapId || lock.mapId === integer(options.mapId))).map(lock => Object.assign(deepClone(lock), { cellCount: Object.keys(lock.cells || {}).length })); }
    function snapshotLockedBiomeCells(graphId, mapId) { const lock = ensureStore().worldBiomeLocks[`${String(graphId)}:${integer(mapId)}`]; if (!lock || typeof $dataMap === "undefined" || !$dataMap || integer(mapId) !== (typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : integer(mapId))) return []; return Object.values(lock.cells || {}).map(cell => ({ x: cell.x, y: cell.y, tiles: ["L1", "L2", "L3", "L4", "L5", "L6"].map(layer => getTileId(cell.x, cell.y, layer)) })); }
    function restoreLockedBiomeCells(snapshot) { for (const cell of snapshot || []) for (let index = 0; index < cell.tiles.length; index++) setTile(cell.x, cell.y, `L${index + 1}`, cell.tiles[index], true, { mode: "exact" }); return (snapshot || []).length; }

    async function runBiomeGraph(idOrGraph, options = {}) {
        const graph = typeof idOrGraph === "string" ? ensureStore().worldBiomeGraphs[idOrGraph] : idOrGraph; const preview = previewBiomeGraph(graph, options); if (!preview.ok) return preview;
        const mapId = preview.mapId; const lockedSnapshot = snapshotLockedBiomeCells(graph.id, mapId); const transactional = options.transactional !== false; if (transactional && !projectTransactionState()) beginProjectTransaction(`Biome graph: ${graph.name || graph.id}`); const results = [];
        try { for (const nodeId of preview.order) {
                const node = graph.nodes.find(item => item.id === nodeId); const type = canonicalWorldRecipeType(node.type); const settings = Object.assign({}, deepClone(node.options || {}), deepClone(options.overrides?.[nodeId] || {}), { seed: `${options.seed || graph.seed || "world"}:${nodeId}` }); const cached = options.cache === false ? null : biomeStageCache(graph.id, mapId, nodeId, settings.seed, settings); let result;
                if (type === "climate") result = generateClimateBiome(settings); else if (type === "biome") result = generateBiome(settings); else if (type === "road") result = generateTerrainRoad(settings); else if (type === "river") result = generateDownhillRiver(settings); else if (type === "dungeon") result = generateValidatedDungeon(settings); else if (type === "wfc") result = settings.ruleSetId ? generateWaveFunctionMapBacktracking(settings) : generateWaveFunctionMap(settings); else if (type === "scatterprefabs") result = await Promise.resolve(scatterPrefabs(settings)); else if (type === "rules") result = compileWorldRuleLayer(settings.layerId, settings); else if (type === "custom") result = await Promise.resolve(runExtensionGenerator(settings.generatorId, settings));
                if (result !== false && options.cache !== false) cacheBiomeStage(graph.id, mapId, nodeId, settings.seed, result, settings); results.push({ id: nodeId, type, ok: result !== false, result, cacheHit: !!cached }); if (result === false && node.required !== false) throw new Error(`Biome node ${nodeId} failed.`);
            }
            const restoredLocks = restoreLockedBiomeCells(lockedSnapshot); if (transactional && projectTransactionState()) commitProjectTransaction(); recordOperation("runBiomeGraph", { graphId: graph.id, nodes: results.length, restoredLocks }); return Object.assign(preview, { executed: true, results, restoredLocks });
        } catch (error) { if (transactional && projectTransactionState()) rollbackProjectTransaction(); captureError(error, { operation: "runBiomeGraph", graphId: graph.id }); throw error; }
    }

    function runtimeBudget(changes = null) { const store = ensureStore(); if (changes && typeof changes === "object") { store.runtimeBudget = Object.assign({}, store.runtimeBudget, { frameBudgetMs: Math.max(1, finiteNumber(changes.frameBudgetMs, store.runtimeBudget.frameBudgetMs)), recipeRunsPerFrame: Math.max(1, integer(changes.recipeRunsPerFrame, store.runtimeBudget.recipeRunsPerFrame)), simulationStepsPerFrame: Math.max(1, integer(changes.simulationStepsPerFrame, store.runtimeBudget.simulationStepsPerFrame)), spatialCellSize: Math.max(4, integer(changes.spatialCellSize, store.runtimeBudget.spatialCellSize)) }); worldZoneSpatialIndex = null; } return deepClone(store.runtimeBudget); }
    function performanceHeatmap(mapId = 0) { const store = ensureStore(); const counts = new Map(); const id = integer(mapId, typeof $gameMap !== "undefined" && $gameMap ? $gameMap.mapId() : 0); for (const patch of flattenPatches(store.maps[String(id)] || [])) { if (patch.kind === "sparse") for (const cell of patch.cells || []) { const key = coordinateKey(cell.x, cell.y); counts.set(key, (counts.get(key) || 0) + 1); } else { const rect = patchRect(patch); if (rect) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) { const key = coordinateKey(x, y); counts.set(key, (counts.get(key) || 0) + 1); } } } const cells = [...counts].map(([key, count]) => { const [x, y] = key.split(",").map(Number); return { x, y, count }; }).sort((a, b) => b.count - a.count); return { mapId: id, cells, maximum: cells[0]?.count || 0, operations: performanceDiagnostics(), zones: worldZoneSpatialDiagnostics() }; }
    function optimizeWorldRuntime(options = {}) { const before = estimateStoreBytes(); const pruning = pruneProjectData(options); const zones = rebuildWorldZoneSpatialIndex(); const after = estimateStoreBytes(); return { before, after, freedBytes: Math.max(0, before.estimatedBytes - after.estimatedBytes), pruning, spatialIndex: { cellSize: zones.cellSize, buckets: zones.buckets.size, zones: zones.zoneCount }, budget: runtimeBudget(options.budget) }; }

    function runWorldBenchmark(options = {}) {
        const iterations = Math.max(1, Math.min(500, integer(options.iterations, 25))); const samples = []; const measure = (name, callback) => { const started = clockNow(); for (let index = 0; index < iterations; index++) callback(); const durationMs = Math.max(0, clockNow() - started); samples.push({ name, iterations, durationMs, averageMs: durationMs / iterations }); };
        measure("zone-spatial-query", () => worldZonesAt(integer(options.mapId, 1), integer(options.x), integer(options.y), integer(options.regionId)));
        measure("rule-layer-query", () => worldRulesAt(integer(options.mapId, 1), integer(options.x), integer(options.y)));
        measure("npc-schedule", () => { for (const npc of Object.values(ensureStore().worldNpcs || {})) npcScheduledActivity(npc); });
        measure("recipe-validation", () => validateWorldRecipeCatalog(exportWorldRecipePack()));
        const totalMs = samples.reduce((sum, sample) => sum + sample.durationMs, 0); const record = { id: `benchmark-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION, iterations, totalMs, samples, store: estimateStoreBytes(), budget: runtimeBudget() }; ensureStore().benchmarkHistory.unshift(record); ensureStore().benchmarkHistory = ensureStore().benchmarkHistory.slice(0, 50); return deepClone(record);
    }
    function listWorldBenchmarks() { return deepClone(ensureStore().benchmarkHistory || []); }

    function worldReferenceGraph() {
        const store = ensureStore(); const nodes = new Map(); const edges = []; const addNode = (id, type, name = id, metadata = {}) => { if (!id) return; nodes.set(`${type}:${id}`, { id: String(id), key: `${type}:${id}`, type, name: String(name || id), metadata: deepClone(metadata) }); }; const connect = (fromType, fromId, toType, toId, relation) => { if (!fromId || !toId) return; edges.push({ from: `${fromType}:${fromId}`, to: `${toType}:${toId}`, relation }); };
        for (const recipe of worldRecipeDefinitions()) { addNode(recipe.id, "recipe", recipe.name); for (const action of recipe.actions || []) { const type = canonicalWorldRecipeType(action.type); if (type === "runrecipe") connect("recipe", recipe.id, "recipe", action.recipeId, "runs"); if (type === "runbiomegraph") connect("recipe", recipe.id, "biome", action.id || action.graphId, "generates"); } for (const trigger of recipe.triggers || []) if (trigger.zoneId) connect("recipe", recipe.id, "zone", trigger.zoneId, "triggered-by"); }
        for (const zone of Object.values(store.worldZones || {})) addNode(zone.id, "zone", zone.name, { mapIds: zone.mapIds });
        for (const npc of Object.values(store.worldNpcs || {})) addNode(npc.id, "npc", npc.name); for (const route of Object.values(store.worldNpcRoutes || {})) { addNode(route.id, "route", route.name); connect("route", route.id, "npc", route.npcId, "moves"); }
        for (const graph of Object.values(store.worldBiomeGraphs || {})) { addNode(graph.id, "biome", graph.name); for (const node of graph.nodes || []) if (canonicalWorldRecipeType(node.type) === "rules" && node.options?.layerId) connect("biome", graph.id, "rule-layer", node.options.layerId, "uses"); }
        for (const layer of Object.values(store.worldRuleLayers || {})) addNode(layer.id, "rule-layer", layer.name, { mapId: layer.mapId });
        for (const pack of Object.values(store.worldRecipePacks || {})) { addNode(pack.id, "pack", pack.name, { version: pack.version }); for (const dependency of pack.dependencies || []) connect("pack", pack.id, "pack", dependency.id || dependency, "depends-on"); }
        for (const variant of Object.values(store.worldMapVariants || {})) { addNode(variant.id, "variant", variant.name, { mapId: variant.mapId }); if (variant.recipeId) connect("variant", variant.id, "recipe", variant.recipeId, "applies"); }
        const missing = []; for (const edge of edges) if (!nodes.has(edge.to)) missing.push(edge); return { createdAt: Date.now(), nodes: [...nodes.values()], edges, missing, ok: missing.length === 0, counts: Object.fromEntries([...nodes.values()].reduce((map, node) => map.set(node.type, (map.get(node.type) || 0) + 1), new Map())) };
    }

    function createRecoverySnapshot(name = "Automatic recovery", options = {}) { const store = ensureStore(); const snapshot = { id: safeWorldRecipeId(options.id) || `recovery-${Date.now().toString(36)}`, name: String(name), createdAt: Date.now(), automatic: options.automatic !== false, state: workspaceStateSnapshot() }; if (JSON.stringify(snapshot.state).length * 2 > MAX_IMPORT_BYTES) return false; store.recoverySnapshots.unshift(snapshot); store.recoverySnapshots = store.recoverySnapshots.slice(0, Math.max(1, integer(options.retain, store.recoveryPolicy?.retain || 10))); return { id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, automatic: snapshot.automatic };
    }
    function listRecoverySnapshots() { return (ensureStore().recoverySnapshots || []).map(snapshot => ({ id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt, automatic: snapshot.automatic, estimatedBytes: JSON.stringify(snapshot.state || {}).length * 2 })); }
    function restoreRecoverySnapshot(id) { const snapshot = ensureStore().recoverySnapshots.find(item => item.id === String(id)); return snapshot ? restoreWorkspaceState(snapshot.state) : false; }
    function deleteRecoverySnapshot(id) { const store = ensureStore(); const before = store.recoverySnapshots.length; store.recoverySnapshots = store.recoverySnapshots.filter(item => item.id !== String(id)); return before !== store.recoverySnapshots.length; }

    function runCompatibilityLab(options = {}) {
        const scripts = normalizeList(typeof PluginManager !== "undefined" ? PluginManager._scripts : []).map(String); const imported = typeof window.Imported === "object" ? Object.keys(window.Imported) : []; const names = [...new Set([...scripts, ...imported])]; const selfIndex = scripts.findIndex(name => name === PLUGIN_NAME || /HybridTileGraft/i.test(name));
        const families = [{ id: "visustella", name: "VisuStella MZ", pattern: /VisuMZ|VisuStella/i, recommendation: "Load core engine plugins first; place HybridTileGraft after map and event cores." }, { id: "ritter", name: "Ritter Map Transform", pattern: /Ritter.*Map.*Transform|MapTransform.*Ritter/i, recommendation: "Use one transform authority per operation and preview transfer repairs before committing." }, { id: "tyruswoo", name: "Tyruswoo Tile Control", pattern: /Tyruswoo.*Tile|TileControl.*Tyruswoo/i, recommendation: "Keep exact tile-code calls isolated from autotile-aware paint operations." }];
        const profiles = families.map(family => { const matches = names.filter(name => family.pattern.test(name)); return { id: family.id, name: family.name, detected: matches.length > 0, plugins: matches, recommendation: family.recommendation }; }); const issues = [];
        if (selfIndex >= 0) for (const profile of profiles.filter(item => item.detected)) for (const plugin of profile.plugins) { const index = scripts.indexOf(plugin); if (index > selfIndex && profile.id === "visustella") issues.push({ severity: "warning", plugin, message: `${plugin} loads after ${PLUGIN_NAME}; a core-first order is usually safer.` }); }
        if (profiles.filter(item => item.detected && ["ritter", "tyruswoo"].includes(item.id)).length > 1) issues.push({ severity: "info", message: "Multiple map/tile authorities are installed. Assign ownership per workflow in Compatibility Profiles." });
        const adapter = runCompatibilitySelfTest({ executeRefresh: !!options.executeRefresh }); const report = { id: `compat-${Date.now()}`, createdAt: Date.now(), pluginVersion: VERSION, pluginOrder: scripts, detected: profiles, issues, adapters: adapter, safe: !issues.some(issue => issue.severity === "error") }; recordCompatibilityRun(report); return deepClone(report);
    }

    function registerContentCatalog(catalog) { const id = safeWorldRecipeId(catalog?.id); if (!id) throw new Error("Content catalogs require a safe stable id."); const value = { format: "HybridContentCatalog", version: Math.max(1, integer(catalog.version, 1)), id, name: String(catalog.name || id), items: normalizeList(catalog.items).map(deepClone), metadata: deepClone(catalog.metadata || {}), updatedAt: Date.now() }; ensureStore().contentCatalogs[id] = value; return deepClone(value); }
    function listContentCatalogs() { return Object.values(ensureStore().contentCatalogs || {}).map(catalog => ({ id: catalog.id, name: catalog.name, version: catalog.version, items: catalog.items.length, updatedAt: catalog.updatedAt })); }
    function searchContentCatalog(query = "", options = {}) { const text = String(query).toLowerCase(); const results = []; for (const catalog of Object.values(ensureStore().contentCatalogs || {})) for (const item of catalog.items || []) { const haystack = `${item.id} ${item.name || ""} ${item.description || ""} ${normalizeList(item.tags).join(" ")}`.toLowerCase(); if ((!text || haystack.includes(text)) && (!options.type || item.type === options.type)) results.push(Object.assign({ catalogId: catalog.id }, deepClone(item))); } return results.slice(0, Math.max(1, integer(options.limit, 100))); }
    function subscribeContentCatalog(definition) { const id = safeWorldRecipeId(definition?.id || definition?.catalogId); if (!id) throw new Error("Catalog subscriptions require a safe stable ID."); const subscription = Object.assign({ id, catalogId: String(definition?.catalogId || id), name: definition?.name || id, source: String(definition?.source || ""), channel: String(definition?.channel || "stable"), enabled: definition?.enabled !== false, installedVersion: Math.max(0, integer(definition?.installedVersion)), latestVersion: Math.max(0, integer(definition?.latestVersion)), checkedAt: 0, createdAt: Date.now() }, deepClone(definition), { id }); ensureStore().catalogSubscriptions[id] = subscription; return deepClone(subscription); }
    function listCatalogSubscriptions() { return Object.values(ensureStore().catalogSubscriptions || {}).map(subscription => Object.assign(deepClone(subscription), { updateAvailable: integer(subscription.latestVersion) > integer(subscription.installedVersion) })); }
    function removeCatalogSubscription(id) { const key = String(id || ""); const existed = !!ensureStore().catalogSubscriptions[key]; delete ensureStore().catalogSubscriptions[key]; return existed; }
    function checkCatalogUpdates(catalogs = []) { const incoming = new Map(normalizeList(catalogs).map(catalog => [String(catalog.id), catalog])); const results = []; for (const subscription of Object.values(ensureStore().catalogSubscriptions || {})) { if (!subscription.enabled) continue; const catalog = incoming.get(subscription.catalogId) || ensureStore().contentCatalogs[subscription.catalogId]; if (catalog) { subscription.latestVersion = Math.max(subscription.latestVersion || 0, integer(catalog.version)); subscription.checkedAt = Date.now(); } results.push({ id: subscription.id, catalogId: subscription.catalogId, installedVersion: subscription.installedVersion, latestVersion: subscription.latestVersion, updateAvailable: integer(subscription.latestVersion) > integer(subscription.installedVersion), found: !!catalog }); } return results; }
    function installContentCatalogItem(catalogId, itemId, options = {}) { const catalog = ensureStore().contentCatalogs[String(catalogId || "")]; const item = catalog?.items?.find(value => value.id === String(itemId)); if (!item) return false; if (item.type === "world-pack" && item.pack) return installWorldPack(item.pack, options); if (item.type === "prefab-pack" && item.pack) return importPrefabPack(item.pack, options.save !== false); if (item.type === "biome-graph" && item.graph) return defineBiomeGraph(item.graph); return false; }

    function replaceRecipeParameters(value, parameters) { if (Array.isArray(value)) return value.map(item => replaceRecipeParameters(item, parameters)); if (value && typeof value === "object") { if (value.$param !== undefined) return deepClone(parameters[String(value.$param)] ?? value.defaultValue); const output = {}; for (const [key, item] of Object.entries(value)) output[key] = replaceRecipeParameters(item, parameters); return output; } if (typeof value === "string") return value.replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_match, key) => String(parameters[key] ?? "")); return value; }
    function instantiateWorldRecipe(sourceId, parameters = {}, newId = "") { const source = worldRecipe(sourceId); if (!source) throw new Error(`World Recipe "${sourceId}" was not found.`); const recipe = replaceRecipeParameters(source, parameters); recipe.id = safeWorldRecipeId(newId) || `${source.id}-${Date.now().toString(36)}`; recipe.name = replaceRecipeParameters(source.name, parameters); recipe.metadata = Object.assign({}, recipe.metadata, { sourceRecipe: source.id, parameters: deepClone(parameters) }); return registerWorldRecipe(recipe, true); }

    function defineWorldMapVariant(definition) { const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Map variants require a safe stable ID."); const value = Object.assign({ id, name: definition.name || id, mapId: integer(definition.mapId), recipeId: String(definition.recipeId || ""), changeSetId: String(definition.changeSetId || ""), enabled: definition.enabled !== false }, deepClone(definition), { id }); ensureStore().worldMapVariants[id] = value; return deepClone(value); }
    function listWorldMapVariants() { return Object.values(ensureStore().worldMapVariants || {}).map(deepClone); }
    async function applyWorldMapVariant(id, context = {}, options = {}) { const variant = ensureStore().worldMapVariants[String(id || "")]; if (!variant || !variant.enabled) return false; if (variant.recipeId) return runWorldRecipe(variant.recipeId, Object.assign({ mapId: variant.mapId, variantId: variant.id }, context), options); if (variant.changeSetId) return applyChangeSet(variant.changeSetId, options); return false; }

    function worldLineOfSight(x1, y1, x2, y2) {
        let x = integer(x1); let y = integer(y1); const targetX = integer(x2); const targetY = integer(y2);
        const dx = Math.abs(targetX - x); const dy = Math.abs(targetY - y); const sx = x < targetX ? 1 : -1; const sy = y < targetY ? 1 : -1; let error = dx - dy;
        while (x !== targetX || y !== targetY) {
            const previousX = x; const previousY = y; const doubled = error * 2;
            if (doubled > -dy) { error -= dy; x += sx; }
            if (doubled < dx) { error += dx; y += sy; }
            if (x === targetX && y === targetY) return true;
            if (typeof $gameMap !== "undefined" && $gameMap?.isPassable) {
                const direction = x > previousX ? 6 : x < previousX ? 4 : y > previousY ? 2 : 8;
                if (!$gameMap.isPassable(previousX, previousY, direction)) return false;
            }
        }
        return true;
    }

    async function evaluateWorldRecipeCondition(condition, context, recipe, depth = 0) {
        if (depth > 12) return false;
        if (Array.isArray(condition)) {
            for (const item of condition) if (!await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return false;
            return true;
        }
        if (!condition || typeof condition !== "object") return false;
        if (condition.all !== undefined) {
            for (const item of condition.all || []) if (!await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return false;
            return true;
        }
        if (condition.any !== undefined) {
            for (const item of condition.any || []) if (await evaluateWorldRecipeCondition(item, context, recipe, depth + 1)) return true;
            return !(condition.any || []).length;
        }
        if (condition.not !== undefined) return !await evaluateWorldRecipeCondition(condition.not, context, recipe, depth + 1);
        const type = canonicalWorldRecipeType(condition.type || "always");
        const custom = worldRecipeConditionHandlers.get(type);
        if (custom) return !!await custom({ condition: deepClone(condition), context: worldRecipeContext(context), recipe: deepClone(recipe), api: window.HybridTileGraft });
        const expected = resolveWorldRecipeValue(condition.value, context, recipe);
        switch (type) {
            case "always": return condition.value !== false;
            case "switch": return compareWorldRecipeValues(recipeSwitchValue(condition.id), condition.operator || "===", condition.value === undefined ? true : !!expected);
            case "variable": return compareWorldRecipeValues(recipeVariableValue(condition.id), condition.operator, expected);
            case "state": return compareWorldRecipeValues(getWorldState(condition.key, { scope: condition.scope, mapId: context.mapId, recipeId: recipe.id, defaultValue: condition.defaultValue }), condition.operator, expected);
            case "map": return compareWorldRecipeValues(context.mapId, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "region": return compareWorldRecipeValues(context.regionId, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "terrain": return compareWorldRecipeValues(context.terrainTag, condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "tile": return compareWorldRecipeValues(getTileId(integer(condition.x, context.x), integer(condition.y, context.y), condition.layer || "L1"), condition.operator || "in", resolveWorldRecipeValue(condition.ids || condition.value || [], context, recipe));
            case "position": { const xValue = resolveWorldRecipeValue(condition.x, context, recipe); const yValue = resolveWorldRecipeValue(condition.y, context, recipe); const xRange = xValue && typeof xValue === "object" ? xValue : { min: condition.xMin, max: condition.xMax }; const yRange = yValue && typeof yValue === "object" ? yValue : { min: condition.yMin, max: condition.yMax }; const xMatch = xRange.min !== undefined || xRange.max !== undefined ? (xRange.min === undefined || context.x >= finiteNumber(xRange.min)) && (xRange.max === undefined || context.x <= finiteNumber(xRange.max)) : condition.x === undefined || compareWorldRecipeValues(context.x, condition.operator || "===", integer(xValue)); const yMatch = yRange.min !== undefined || yRange.max !== undefined ? (yRange.min === undefined || context.y >= finiteNumber(yRange.min)) && (yRange.max === undefined || context.y <= finiteNumber(yRange.max)) : condition.y === undefined || compareWorldRecipeValues(context.y, condition.operator || "===", integer(yValue)); return xMatch && yMatch; }
            case "direction": return compareWorldRecipeValues(context.direction, condition.operator || "in", resolveWorldRecipeValue(condition.directions || condition.value || [], context, recipe));
            case "gold": return compareWorldRecipeValues(typeof $gameParty !== "undefined" && $gameParty?.gold ? $gameParty.gold() : 0, condition.operator, expected);
            case "item": { const item = typeof $dataItems !== "undefined" ? $dataItems?.[integer(condition.id)] : null; const count = item && typeof $gameParty !== "undefined" && $gameParty?.numItems ? $gameParty.numItems(item) : 0; return compareWorldRecipeValues(count, condition.operator || ">=", expected ?? 1); }
            case "chance": return Math.random() < Math.max(0, Math.min(1, finiteNumber(condition.probability ?? expected, 1)));
            case "context": return compareWorldRecipeValues(context[String(condition.key)], condition.operator, expected);
            case "reciperuns": return compareWorldRecipeValues(worldRecipeStateRecord(condition.recipeId || recipe.id)?.runCount || 0, condition.operator, expected);
            case "time": { const clock = worldClock(); const value = condition.unit === "hour" ? clock.hour : condition.unit === "serial" ? worldClockSerial(clock) : clock.minute; return compareWorldRecipeValues(value, condition.operator || ">=", expected ?? condition.minute ?? 0); }
            case "season": return compareWorldRecipeValues(worldClock().season, condition.operator || "in", resolveWorldRecipeValue(condition.seasons || condition.value || [], context, recipe));
            case "day": return compareWorldRecipeValues(worldClock().day, condition.operator || ">=", expected ?? 1);
            case "fact": return compareWorldRecipeValues(ensureStore().worldFacts[String(condition.name || condition.key || "")], condition.operator || "===", condition.value === undefined ? true : expected);
            case "zone": { const zones = worldZonesAt(context.mapId, context.x, context.y, context.regionId).map(zone => zone.id); return condition.id ? zones.includes(String(condition.id)) : normalizeList(condition.ids || condition.value).some(id => zones.includes(String(id))); }
            case "proximity": { const targetX = integer(resolveWorldRecipeValue(condition.x, context, recipe), context.x); const targetY = integer(resolveWorldRecipeValue(condition.y, context, recipe), context.y); const dx = context.x - targetX; const dy = context.y - targetY; const distance = condition.metric === "euclidean" ? Math.sqrt(dx * dx + dy * dy) : Math.abs(dx) + Math.abs(dy); return compareWorldRecipeValues(distance, condition.operator || "<=", expected ?? condition.distance ?? 1); }
            case "lineofsight": return worldLineOfSight(context.x, context.y, integer(resolveWorldRecipeValue(condition.x, context, recipe), context.x), integer(resolveWorldRecipeValue(condition.y, context, recipe), context.y));
            case "worldentity": { const entity = worldEntity(condition.id); if (!entity) return false; if (condition.state !== undefined && !compareWorldRecipeValues(entity.state, condition.operator || "===", resolveWorldRecipeValue(condition.state, context, recipe))) return false; return !condition.tag || normalizeList(entity.tags).includes(String(condition.tag)); }
            case "resource": { const resource = worldResource(condition.id); return !!resource && compareWorldRecipeValues(resource.quantity, condition.operator || ">=", expected ?? condition.quantity ?? 1); }
            case "packinstalled": { const pack = ensureStore().worldRecipePacks[String(condition.id || condition.packId || "")]; return !!pack && (!condition.minVersion || compareRecipeVersions(pack.version, condition.minVersion) >= 0); }
            case "npc": { const npc = worldNpc(condition.id || condition.npcId); if (!npc) return false; if (condition.activity !== undefined && !compareWorldRecipeValues(npc.activity, condition.operator || "===", resolveWorldRecipeValue(condition.activity, context, recipe))) return false; if (condition.state !== undefined && !compareWorldRecipeValues(npc.state, condition.stateOperator || "===", resolveWorldRecipeValue(condition.state, context, recipe))) return false; return !condition.tag || normalizeList(npc.tags).includes(String(condition.tag)); }
            case "rulelayer": { const matches = worldRulesAt(context.mapId, context.x, context.y, { kind: condition.kind }); const match = matches.find(item => item.layerId === String(condition.id || condition.layerId || "")); if (!match) return false; const weighted = match.value && typeof match.value === "object" && match.value.weight !== undefined; const actual = weighted ? match.value.value : match.value; const weight = weighted ? finiteNumber(match.value.weight) : 1; return (condition.minimumWeight === undefined || weight >= finiteNumber(condition.minimumWeight)) && (condition.value === undefined || compareWorldRecipeValues(actual, condition.operator || "===", expected)); }
            default: return false;
        }
    }

    function worldRecipeTriggerMatches(recipe, triggerName, context) {
        const expected = canonicalWorldRecipeType(triggerName);
        return recipe.triggers.some(trigger => {
            if (trigger.type !== expected && !(trigger.type === "custom" && canonicalWorldRecipeType(trigger.name) === expected)) return false;
            if (["switchchange", "variablechange"].includes(expected) && trigger.id !== undefined && integer(trigger.id) !== integer(context.id)) return false;
            if (expected === "statechange" && trigger.key !== undefined && String(trigger.key) !== String(context.key)) return false;
            if (expected === "tilechange" && trigger.operation && String(trigger.operation) !== String(context.operation)) return false;
            if (["zoneenter", "zoneexit"].includes(expected) && trigger.zoneId && String(trigger.zoneId) !== String(context.zoneId)) return false;
            if (expected === "scheduled" && context.recipeId && recipe.id !== String(context.recipeId)) return false;
            if (expected === "packinstalled" && trigger.packId && String(trigger.packId) !== String(context.packId)) return false;
            if (["resourcerespawn", "resourcedepleted"].includes(expected) && trigger.resourceId && String(trigger.resourceId) !== String(context.resourceId)) return false;
            if (expected === "entitystatechange" && trigger.entityId && String(trigger.entityId) !== String(context.entityId)) return false;
            if (expected === "npcactivitychange" && trigger.npcId && String(trigger.npcId) !== String(context.npcId)) return false;
            if (expected === "interval") {
                const state = worldRecipeStateRecord(recipe.id); const every = Math.max(1, integer(trigger.everyFrames, 60));
                if (state.lastIntervalFrame !== null && worldRecipeFrame >= state.lastIntervalFrame && worldRecipeFrame - state.lastIntervalFrame < every) return false;
                state.lastIntervalFrame = worldRecipeFrame;
            }
            return true;
        });
    }

    function worldRecipeCanRun(recipe, state, options = {}) {
        const enabled = state.enabled === undefined ? recipe.enabled : !!state.enabled;
        if (!enabled && !options.ignoreEnabled) return { ok: false, reason: "disabled" };
        if ((recipe.once || recipe.maxRuns === 1) && state.runCount > 0 && !options.ignoreLimits) return { ok: false, reason: "once" };
        if (recipe.maxRuns > 0 && state.runCount >= recipe.maxRuns && !options.ignoreLimits) return { ok: false, reason: "maxRuns" };
        if (recipe.cooldownFrames > 0 && state.lastRunFrame !== null && worldRecipeFrame >= state.lastRunFrame && worldRecipeFrame - state.lastRunFrame < recipe.cooldownFrames && !options.ignoreLimits) return { ok: false, reason: "cooldown" };
        if (state.running && !options.allowReentry) return { ok: false, reason: "running" };
        return { ok: true };
    }

    function operateWorldRecipeNumber(current, operator, operand) {
        const a = Number(current) || 0; const b = Number(operand) || 0;
        switch (String(operator || "set").toLowerCase()) {
            case "add": case "+": return a + b;
            case "subtract": case "sub": case "-": return a - b;
            case "multiply": case "mul": case "*": return a * b;
            case "divide": case "div": case "/": return b === 0 ? a : a / b;
            case "modulo": case "mod": case "%": return b === 0 ? a : a % b;
            case "min": return Math.min(a, b);
            case "max": return Math.max(a, b);
            default: return operand;
        }
    }

    async function executeWorldRecipeAction(action, context, recipe, options = {}) {
        const type = canonicalWorldRecipeType(action.type);
        const resolved = resolveWorldRecipeValue(action, context, recipe);
        const custom = worldRecipeActionHandlers.get(type);
        if (custom) return custom({ action: resolved, context: worldRecipeContext(context), recipe: deepClone(recipe), options: deepClone(options), api: window.HybridTileGraft });
        const x = integer(resolved.x ?? resolved.targetX, context.x); const y = integer(resolved.y ?? resolved.targetY, context.y); const save = resolved.save !== false;
        switch (type) {
            case "setswitch": if ($gameSwitches?.setValue) { $gameSwitches.setValue(integer(resolved.id), toBoolean(resolved.value, true)); return true; } return false;
            case "setvariable": { const id = integer(resolved.id); const value = operateWorldRecipeNumber(recipeVariableValue(id), resolved.operator, resolved.value); if ($gameVariables?.setValue) $gameVariables.setValue(id, value); return value; }
            case "setselfswitch": { const key = [integer(resolved.mapId, context.mapId), integer(resolved.eventId, context.eventId || 0), String(resolved.letter || "A")]; if ($gameSelfSwitches?.setValue) $gameSelfSwitches.setValue(key, toBoolean(resolved.value, true)); else { $gameSelfSwitches._data[key] = toBoolean(resolved.value, true); $gameSelfSwitches.onChange?.(); } return true; }
            case "setstate": { const previous = getWorldState(resolved.key, { scope: resolved.scope, mapId: context.mapId, recipeId: recipe.id, defaultValue: resolved.defaultValue }); const value = resolved.operator && resolved.operator !== "set" ? operateWorldRecipeNumber(previous, resolved.operator, resolved.value) : resolved.value; return setWorldState(resolved.key, value, { scope: resolved.scope, mapId: context.mapId, recipeId: recipe.id }); }
            case "commonevent": if ($gameTemp?.reserveCommonEvent) { $gameTemp.reserveCommonEvent(integer(resolved.id)); return true; } return false;
            case "settile": return setTile(x, y, resolved.layer || "L1", resolved.tileId, save, resolved.options || {});
            case "filltiles": return fillTiles(x, y, positiveInteger(resolved.width), positiveInteger(resolved.height), resolved.layer || "L1", resolved.tileId, save, resolved.options || {});
            case "setregion": return changeRegionId(x, y, integer(resolved.regionId ?? resolved.value), save);
            case "cleararea": return clearArea(x, y, positiveInteger(resolved.width), positiveInteger(resolved.height), resolved.layers || "L1,L2,L3,L4,L5,L6", save, toBoolean(resolved.includeEvents, false), resolved.mode || "exact");
            case "graftprefab": return graftPrefabAsync(Object.assign({}, resolved.options || {}, resolved, { name: resolved.name || resolved.prefab, targetX: x, targetY: y, save }));
            case "weather": if (typeof $gameScreen !== "undefined" && $gameScreen?.changeWeather) { $gameScreen.changeWeather(String(resolved.weather || resolved.value || "none"), Math.max(0, integer(resolved.power, 5)), Math.max(0, integer(resolved.duration, 60))); return true; } return false;
            case "tint": if (typeof $gameScreen !== "undefined" && $gameScreen?.startTint) { $gameScreen.startTint(Array.isArray(resolved.tone) ? resolved.tone.map(Number).slice(0, 4) : [0, 0, 0, 0], Math.max(0, integer(resolved.duration, 60))); return true; } return false;
            case "checkpoint": return createCheckpoint(String(resolved.name || `${recipe.name} checkpoint`), context.mapId);
            case "enablerecipe": return setWorldRecipeEnabled(resolved.recipeId, toBoolean(resolved.enabled, true));
            case "runrecipe": return runWorldRecipe(resolved.recipeId, Object.assign({}, context, resolved.context || {}), Object.assign({}, options, { depth: integer(options.depth) + 1 }));
            case "plugincommand": if (PluginManager.callCommand) { const interpreter = context.interpreter || (typeof Game_Interpreter !== "undefined" ? new Game_Interpreter() : null); PluginManager.callCommand(interpreter, String(resolved.plugin || PLUGIN_NAME), String(resolved.command || ""), resolved.args || {}); return true; } return false;
            case "message": if (typeof $gameMessage !== "undefined" && $gameMessage?.add) { $gameMessage.add(String(resolved.text || resolved.value || "")); return true; } return false;
            case "log": console.log(`${PLUGIN_NAME} World Recipe ${recipe.id}:`, resolved.value ?? resolved.message ?? resolved); return true;
            case "emit": emitChange(Object.assign({ operation: String(resolved.operation || "worldRecipe"), recipeId: recipe.id }, resolved.detail || {})); return true;
            case "schedule": return scheduleWorldRecipe(resolved.recipeId || recipe.id, { id: resolved.id, frames: resolved.frames, minutes: resolved.minutes, repeatFrames: resolved.repeatFrames, repeatMinutes: resolved.repeatMinutes, context: Object.assign({}, context, resolved.context || {}) });
            case "cancelschedule": return cancelWorldSchedule(resolved.id || resolved.scheduleId);
            case "setclock": return resolved.advanceMinutes !== undefined ? advanceWorldClock(resolved.advanceMinutes) : setWorldClock(resolved);
            case "addfact": return addWorldFact(resolved.name || resolved.key, resolved.value === undefined ? true : resolved.value);
            case "removefact": return removeWorldFact(resolved.name || resolved.key);
            case "definezone": return defineWorldZone(resolved.zone || resolved);
            case "updateentity": return updateWorldEntity(resolved.id || resolved.entityId, resolved.changes || { state: resolved.state, properties: resolved.properties, tags: resolved.tags });
            case "harvestresource": return harvestWorldResource(resolved.id || resolved.resourceId, resolved.amount);
            case "spawnevent": return spawnEventTemplate(resolved.name || resolved.template, x, y, Object.assign({}, resolved.options || {}, { save, mapId: integer(resolved.mapId, context.mapId) }));
            case "moveevent": return moveSpawnedEvent(integer(resolved.eventId), x, y, save);
            case "deleteevent": return deleteSpawnedEvent(integer(resolved.eventId), save);
            case "applyvariant": return applyWorldMapVariant(resolved.id || resolved.variantId, context, options);
            case "updatenpc": return updateWorldNpc(resolved.id || resolved.npcId, resolved.changes || { activity: resolved.activity, state: resolved.state, mapId: resolved.mapId, x, y });
            case "paintworldrule": return paintWorldRules(resolved.id || resolved.layerId, resolved.cells || [{ x, y }], resolved.value === undefined ? true : resolved.value, { mode: resolved.mode });
            case "runbiomegraph": return runBiomeGraph(resolved.id || resolved.graphId, Object.assign({}, resolved.options || {}, { seed: resolved.seed }));
            default: throw new Error(`Unknown World Recipe action type "${action.type}".`);
        }
    }

    function logWorldRecipe(entry) {
        const log = ensureStore().worldRecipeLog;
        log.unshift(Object.assign({ id: `recipe-log-${Date.now()}-${Math.floor(Math.random() * 100000)}`, timestamp: Date.now(), frame: worldRecipeFrame }, deepClone(entry)));
        if (log.length > WORLD_RECIPE_LOG_LIMIT) log.length = WORLD_RECIPE_LOG_LIMIT;
        return deepClone(log[0]);
    }

    async function runWorldRecipe(id, suppliedContext = {}, options = {}) {
        if (integer(options.depth, 0) > 12) throw new Error("World Recipe call depth exceeded 12 levels.");
        const recipe = worldRecipe(id);
        if (!recipe) return { ok: false, recipeId: String(id || ""), reason: "missing" };
        const state = worldRecipeStateRecord(recipe.id); const allowed = worldRecipeCanRun(recipe, state, options);
        if (!allowed.ok) return { ok: false, skipped: true, recipeId: recipe.id, reason: allowed.reason };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id }));
        if (ensureStore().worldRecipeBreakpoints[recipe.id] && !options.resume && !options.dryRun) {
            ensureStore().worldRecipePaused[recipe.id] = { recipeId: recipe.id, context: deepClone(context), options: deepClone(options), pausedAt: Date.now() };
            const paused = { ok: true, paused: true, recipeId: recipe.id, reason: "breakpoint", context: deepClone(context) };
            logWorldRecipe(Object.assign({ trigger: context.trigger || "manual", context: deepClone(context) }, paused));
            return paused;
        }
        const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        let conditionsPassed = true;
        try { conditionsPassed = options.ignoreConditions ? true : await evaluateWorldRecipeCondition(recipe.conditions, context, recipe); }
        catch (error) { captureError(error, { operation: "worldRecipeCondition", recipeId: recipe.id }); return { ok: false, recipeId: recipe.id, reason: "conditionError", error: error.message }; }
        if (!conditionsPassed) return { ok: false, skipped: true, recipeId: recipe.id, reason: "conditions" };
        if (options.dryRun) return { ok: true, dryRun: true, recipeId: recipe.id, context, plannedActions: deepClone(recipe.actions) };
        state.running = true; const results = []; const errors = [];
        try {
            for (let index = 0; index < recipe.actions.length; index++) {
                try { results.push(await executeWorldRecipeAction(recipe.actions[index], context, recipe, options)); }
                catch (error) { errors.push({ index, message: error.message }); captureError(error, { operation: "worldRecipeAction", recipeId: recipe.id, actionIndex: index }); if (recipe.errorPolicy !== "continue") break; }
            }
            const ok = errors.length === 0 || recipe.errorPolicy === "continue";
            if (ok) { state.runCount = (state.runCount || 0) + 1; state.lastRunFrame = worldRecipeFrame; state.lastRunAt = Date.now(); state.lastTrigger = context.trigger || "manual"; }
            state.lastResult = { ok, errors: deepClone(errors), at: Date.now() };
            const endedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
            const durationMs = Math.max(0, endedAt - startedAt); const profile = ensureStore().worldRecipeProfiles[recipe.id] ||= { runs: 0, totalMs: 0, maxMs: 0, lastMs: 0, failures: 0 };
            profile.runs++; profile.totalMs += durationMs; profile.maxMs = Math.max(profile.maxMs, durationMs); profile.lastMs = durationMs; if (!ok) profile.failures++; profile.averageMs = profile.totalMs / Math.max(1, profile.runs);
            const result = { ok, recipeId: recipe.id, runCount: state.runCount || 0, results, errors, durationMs };
            logWorldRecipe(Object.assign({ trigger: context.trigger || "manual", context: deepClone(context) }, result));
            if (ok) emitChange({ operation: "worldRecipeRun", recipeId: recipe.id, trigger: context.trigger || "manual", actionCount: recipe.actions.length });
            return result;
        } finally { state.running = false; }
    }

    function setWorldRecipeBreakpoint(id, enabled = true) { if (!worldRecipe(id)) return false; ensureStore().worldRecipeBreakpoints[String(id)] = !!enabled; if (!enabled) delete ensureStore().worldRecipePaused[String(id)]; return true; }
    function listWorldRecipeBreakpoints() { return Object.entries(ensureStore().worldRecipeBreakpoints || {}).filter(([, enabled]) => enabled).map(([recipeId]) => ({ recipeId, paused: deepClone(ensureStore().worldRecipePaused[recipeId] || null) })); }
    function resumeWorldRecipe(id, options = {}) { const paused = ensureStore().worldRecipePaused[String(id || "")]; if (!paused) return Promise.resolve({ ok: false, reason: "notPaused", recipeId: String(id || "") }); delete ensureStore().worldRecipePaused[String(id)]; return runWorldRecipe(paused.recipeId, paused.context, Object.assign({}, paused.options, options, { resume: true })); }

    function setWorldRecipeWatch(definition) {
        const id = safeWorldRecipeId(definition?.id); if (!id) throw new Error("Debugger watches require a safe stable ID.");
        const watch = Object.assign({ id, name: definition?.name || id, type: "state", key: "", scope: "global", enabled: true, createdAt: Date.now() }, deepClone(definition), { id }); ensureStore().worldDebugger.watches[id] = watch; return deepClone(watch);
    }
    function removeWorldRecipeWatch(id) { const key = String(id || ""); const existed = !!ensureStore().worldDebugger.watches[key]; delete ensureStore().worldDebugger.watches[key]; return existed; }
    function worldRecipeWatchValue(watch) { const type = canonicalWorldRecipeType(watch.type); if (type === "state") return getWorldState(watch.key, watch); if (type === "fact") return deepClone(ensureStore().worldFacts[String(watch.key || watch.name)]); if (type === "npc") return worldNpc(watch.npcId || watch.key); if (type === "resource") return worldResource(watch.resourceId || watch.key); if (type === "recipe") return deepClone(ensureStore().worldRecipeStates[String(watch.recipeId || watch.key)] || null); if (type === "clock") return worldClock(); return undefined; }
    function listWorldRecipeWatches() { return Object.values(ensureStore().worldDebugger.watches || {}).map(watch => Object.assign(deepClone(watch), { value: worldRecipeWatchValue(watch) })); }
    function recordWorldRecipeDebug(entry) { const history = ensureStore().worldDebugger.history; history.unshift(Object.assign({ id: `debug-${Date.now()}-${Math.floor(Math.random() * 100000)}`, at: Date.now() }, deepClone(entry))); history.length = Math.min(history.length, 200); return deepClone(history[0]); }
    function clearWorldRecipeDebugHistory() { const count = ensureStore().worldDebugger.history.length; ensureStore().worldDebugger.history = []; return count; }
    function worldRecipeDebugSnapshot(options = {}) { return { breakpoints: listWorldRecipeBreakpoints(), watches: listWorldRecipeWatches(), paused: deepClone(ensureStore().worldRecipePaused), history: deepClone(ensureStore().worldDebugger.history.slice(0, Math.max(1, integer(options.limit, 50)))) }; }

    async function stepWorldRecipe(id, actionIndex = 0, suppliedContext = {}, options = {}) {
        const recipe = worldRecipe(id); if (!recipe) return { ok: false, reason: "missing", recipeId: String(id || "") }; const index = Math.max(0, integer(actionIndex)); if (!recipe.actions[index]) return { ok: false, reason: "actionMissing", recipeId: recipe.id, actionIndex: index };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id, trigger: suppliedContext.trigger || "debugStep" })); const conditionsPassed = await evaluateWorldRecipeCondition(recipe.conditions, context, recipe); let result = null;
        if (conditionsPassed && options.execute === true) result = await executeWorldRecipeAction(recipe.actions[index], context, recipe, Object.assign({}, options, { resume: true }));
        const record = recordWorldRecipeDebug({ recipeId: recipe.id, actionIndex: index, conditionsPassed, executed: options.execute === true && conditionsPassed, action: deepClone(recipe.actions[index]), result: deepClone(result), context: deepClone(context), watches: listWorldRecipeWatches() }); return Object.assign({ ok: conditionsPassed, planned: options.execute !== true, nextActionIndex: index + 1 < recipe.actions.length ? index + 1 : null }, record);
    }

    async function explainWorldRecipe(id, suppliedContext = {}) {
        const recipe = worldRecipe(id); if (!recipe) return { ok: false, recipeId: String(id || ""), reason: "missing", trace: [] };
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { recipeId: recipe.id }));
        async function visit(condition, path = "conditions", depth = 0) {
            if (depth > 12) return { path, type: "limit", result: false, summary: "Condition nesting limit exceeded", children: [] };
            if (Array.isArray(condition)) { const children = []; for (let index = 0; index < condition.length; index++) children.push(await visit(condition[index], `${path}[${index}]`, depth + 1)); return { path, type: "all", result: children.every(child => child.result), summary: `All ${children.length} conditions`, children }; }
            if (condition?.all !== undefined || condition?.any !== undefined) { const key = condition.all !== undefined ? "all" : "any"; const values = condition[key] || []; const children = []; for (let index = 0; index < values.length; index++) children.push(await visit(values[index], `${path}.${key}[${index}]`, depth + 1)); return { path, type: key, result: key === "all" ? children.every(child => child.result) : !children.length || children.some(child => child.result), summary: `${key === "all" ? "All" : "Any"} of ${children.length}`, children }; }
            if (condition?.not !== undefined) { const child = await visit(condition.not, `${path}.not`, depth + 1); return { path, type: "not", result: !child.result, summary: "Not", children: [child] }; }
            let result = false; let error = ""; try { result = await evaluateWorldRecipeCondition(condition, context, recipe, depth); } catch (caught) { error = caught.message; }
            return { path, type: canonicalWorldRecipeType(condition?.type || "always"), result: !!result, summary: error || JSON.stringify(condition), children: [], error };
        }
        const tree = await visit(recipe.conditions); const report = { ok: true, recipeId: recipe.id, passes: tree.result, context, tree, plannedActions: deepClone(recipe.actions), canRun: worldRecipeCanRun(recipe, worldRecipeStateRecord(recipe.id)) }; recordWorldRecipeDebug({ recipeId: recipe.id, operation: "explain", passes: tree.result, context, tree, watches: listWorldRecipeWatches() }); return report;
    }

    function worldRecipePerformance(options = {}) { return Object.entries(ensureStore().worldRecipeProfiles || {}).map(([recipeId, value]) => Object.assign({ recipeId }, deepClone(value))).sort((a, b) => options.sort === "average" ? b.averageMs - a.averageMs : b.maxMs - a.maxMs); }
    async function replayWorldRecipeLog(logId, options = {}) { const entry = ensureStore().worldRecipeLog.find(item => item.id === String(logId)); if (!entry) return { ok: false, reason: "missingLog" }; return runWorldRecipe(entry.recipeId, Object.assign({}, entry.context || {}, options.context || {}, { trigger: "replay" }), Object.assign({}, options, { ignoreLimits: options.ignoreLimits !== false, resume: true })); }

    function scenarioAssertionValue(assertion) {
        const type = canonicalWorldRecipeType(assertion.type);
        if (type === "switch") return recipeSwitchValue(assertion.id);
        if (type === "variable") return recipeVariableValue(assertion.id);
        if (type === "state") return getWorldState(assertion.key, assertion);
        if (type === "fact") return ensureStore().worldFacts[String(assertion.name || assertion.key || "")];
        if (type === "resource") return worldResource(assertion.id)?.quantity;
        if (type === "entity") return worldEntity(assertion.id)?.[assertion.property || "state"];
        if (type === "tile") return getTileId(integer(assertion.x), integer(assertion.y), assertion.layer || "L1");
        return undefined;
    }

    async function runWorldRecipeScenario(scenario, options = {}) {
        const definition = deepClone(scenario || {}); const storeSnapshot = deepClone(ensureStore()); const switches = deepClone(typeof $gameSwitches !== "undefined" ? ($gameSwitches._data || $gameSwitches.values || []) : []); const variables = deepClone(typeof $gameVariables !== "undefined" ? ($gameVariables._data || $gameVariables.values || []) : []); const mapSnapshot = typeof $dataMap !== "undefined" && $dataMap ? deepClone($dataMap) : null;
        try {
            for (const [id, value] of Object.entries(definition.initial?.switches || {})) $gameSwitches?.setValue?.(integer(id), !!value);
            for (const [id, value] of Object.entries(definition.initial?.variables || {})) $gameVariables?.setValue?.(integer(id), value);
            for (const [key, value] of Object.entries(definition.initial?.state || {})) setWorldState(key, value);
            for (const [key, value] of Object.entries(definition.initial?.facts || {})) addWorldFact(key, value);
            const execution = options.execute === false ? await runWorldRecipe(definition.recipeId, definition.context || {}, { dryRun: true, ignoreLimits: true }) : await runWorldRecipe(definition.recipeId, definition.context || {}, { ignoreLimits: true, resume: true });
            const assertions = normalizeList(definition.expect).map(assertion => { const actual = scenarioAssertionValue(assertion); const expected = assertion.value; return { description: assertion.description || `${assertion.type} ${assertion.id || assertion.key || assertion.name || ""}`, pass: compareWorldRecipeValues(actual, assertion.operator || "===", expected), actual: deepClone(actual), expected: deepClone(expected) }; });
            if (definition.expectResult !== undefined) assertions.unshift({ description: "Recipe result", pass: execution.ok === !!definition.expectResult, actual: execution.ok, expected: !!definition.expectResult });
            return { id: definition.id || "scenario", name: definition.name || definition.id || "Scenario", ok: execution.ok && assertions.every(item => item.pass), execution, assertions };
        } finally {
            if (!options.commit) {
                if (typeof $gameSystem !== "undefined" && $gameSystem) $gameSystem._hybridTileGraft = storeSnapshot; else fallbackStore = storeSnapshot;
                if (typeof $gameSwitches !== "undefined" && $gameSwitches) { if ($gameSwitches._data) $gameSwitches._data = switches; else $gameSwitches.values = switches; }
                if (typeof $gameVariables !== "undefined" && $gameVariables) { if ($gameVariables._data) $gameVariables._data = variables; else $gameVariables.values = variables; }
                if (mapSnapshot && typeof $dataMap !== "undefined") { for (const key of Object.keys($dataMap)) delete $dataMap[key]; Object.assign($dataMap, mapSnapshot); $gameMap?.requestRefresh?.(); }
            }
        }
    }

    async function runWorldRecipeTestSuite(tests = null, options = {}) { const values = tests ? normalizeList(tests) : deepClone(ensureStore().worldRecipeTests); const results = []; for (const scenario of values) results.push(await runWorldRecipeScenario(scenario, options)); return { ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length, failed: results.filter(result => !result.ok).length, results }; }

    async function triggerWorldRecipes(trigger, suppliedContext = {}, options = {}) {
        const name = canonicalWorldRecipeType(trigger || "manual");
        const context = worldRecipeContext(Object.assign({}, suppliedContext, { trigger: name }));
        const results = [];
        for (const recipe of worldRecipeDefinitions()) {
            if (!worldRecipeTriggerMatches(recipe, name, context)) continue;
            results.push(await runWorldRecipe(recipe.id, context, options));
        }
        return { ok: results.every(result => result.ok || result.skipped), trigger: name, matched: results.length, ran: results.filter(result => result.ok && !result.dryRun && !result.paused).length, results };
    }

    function pumpWorldRecipeQueue() {
        if (worldRecipePumping || !worldRecipeQueue.length) return; worldRecipePumping = true;
        Promise.resolve().then(async () => {
            const started = clockNow(); const budget = runtimeBudget(); let processed = 0;
            try { while (worldRecipeQueue.length && processed < budget.recipeRunsPerFrame && clockNow() - started < budget.frameBudgetMs) { const item = worldRecipeQueue.shift(); await triggerWorldRecipes(item.trigger, item.context); processed++; } }
            catch (error) { captureError(error, { operation: "worldRecipeQueue" }); }
            finally { worldRecipePumping = false; if (worldRecipeQueue.length) setTimeout(pumpWorldRecipeQueue, 0); }
        });
    }

    function queueWorldRecipeTrigger(trigger, context = {}) {
        if (!AUTO_WORLD_RECIPES) return false;
        if (worldRecipeQueue.length >= 100) worldRecipeQueue.shift();
        worldRecipeQueue.push({ trigger, context: deepClone(context) }); pumpWorldRecipeQueue(); return true;
    }

    function updateWorldRecipeEngine() {
        if (!AUTO_WORLD_RECIPES || typeof $gameMap === "undefined" || !$gameMap) return;
        worldRecipeFrame++;
        processWorldSimulation();
        if (worldRecipeFrame % 60 === 0) { const policy = ensureStore().recoveryPolicy || {}; const interval = Math.max(0, integer(policy.snapshotMinutes, 0)) * 60000; if (interval > 0 && Date.now() - integer(policy.lastSnapshotAt, 0) >= interval) { const result = createRecoverySnapshot("Automatic recovery", { automatic: true, retain: policy.retain }); if (result) policy.lastSnapshotAt = Date.now(); } }
        if (worldRecipeFrame % 15 === 0) queueWorldRecipeTrigger("interval", { frame: worldRecipeFrame });
        if (typeof $gamePlayer !== "undefined" && $gamePlayer) {
            const key = `${$gameMap.mapId()}:${$gamePlayer.x},${$gamePlayer.y}`;
            if (worldRecipeLastPlayerTile && key !== worldRecipeLastPlayerTile) {
                const context = { mapId: $gameMap.mapId(), x: $gamePlayer.x, y: $gamePlayer.y, regionId: $gameMap.regionId ? $gameMap.regionId($gamePlayer.x, $gamePlayer.y) : 0 };
                queueWorldRecipeTrigger("playerStep", context);
                const currentZones = new Set(worldZonesAt(context.mapId, context.x, context.y, context.regionId).map(zone => zone.id));
                for (const zoneId of currentZones) if (!worldRecipeLastZones.has(zoneId)) queueWorldRecipeTrigger("zoneEnter", Object.assign({ zoneId }, context));
                for (const zoneId of worldRecipeLastZones) if (!currentZones.has(zoneId)) queueWorldRecipeTrigger("zoneExit", Object.assign({ zoneId }, context));
                worldRecipeLastZones = currentZones;
            }
            worldRecipeLastPlayerTile = key;
        }
    }

    function setWorldRecipeEnabled(id, enabled = true) {
        const recipe = worldRecipe(id); if (!recipe) return false;
        worldRecipeStateRecord(recipe.id).enabled = !!enabled;
        return true;
    }

    function resetWorldRecipeState(id = "") {
        const store = ensureStore(); const key = String(id || "");
        if (!key) { const count = Object.keys(store.worldRecipeStates).length; store.worldRecipeStates = {}; return count; }
        if (!store.worldRecipeStates[key]) return false;
        delete store.worldRecipeStates[key]; return true;
    }

    function worldRecipeDiagnostics(options = {}) {
        const catalog = exportWorldRecipePack();
        const validation = validateWorldRecipeCatalog(catalog);
        return {
            version: 1, pluginVersion: VERSION, automatic: AUTO_WORLD_RECIPES, file: WORLD_RECIPE_FILE,
            recipeCount: catalog.recipes.length, enabledCount: listWorldRecipes().filter(recipe => recipe.enabled).length,
            queued: worldRecipeQueue.length, frame: worldRecipeFrame, validation,
            states: deepClone(ensureStore().worldRecipeStates), worldState: deepClone(ensureStore().worldState),
            clock: worldClock(), facts: deepClone(ensureStore().worldFacts), zones: listWorldZones(),
            schedules: listWorldSchedules(), packs: listWorldPacks(), resources: listWorldResources(),
            entities: listWorldEntities(), npcs: listWorldNpcs(), npcRoutes: listWorldNpcRoutes(), occupancy: worldNpcOccupancy(), ruleLayers: listWorldRuleLayers(), ruleBrushes: listWorldRuleBrushes(), biomeGraphs: listBiomeGraphs(),
            biomeLocks: listBiomeLocks(), biomeCacheEntries: Object.keys(ensureStore().worldBiomeCache || {}).length,
            packLock: worldPackLockfile(), publishers: listTrustedPackPublishers(), catalogSubscriptions: listCatalogSubscriptions(), runtimeBudget: runtimeBudget(), spatialIndex: worldZoneSpatialDiagnostics(),
            debugger: worldRecipeDebugSnapshot({ limit: 10 }), referenceGraph: worldReferenceGraph(), atlases: listWorldAtlases().slice(0, 5), eventQuestGraphs: listEventQuestGraphs().slice(0, 5), visualHistory: listVisualHistory().slice(0, 10), extensions: listExtensionManifests(), validations: listProductionValidations().slice(0, 5), deployments: listProjectDeploymentReports().slice(0, 5), benchmarks: listWorldBenchmarks().slice(0, 5), performance: worldRecipePerformance(),
            log: deepClone(ensureStore().worldRecipeLog.slice(0, Math.max(1, integer(options.logLimit, 25))))
        };
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    window.HybridTileGraft = {
        version: VERSION,
        pluginName: PLUGIN_NAME,
        graftArea,
        graftAreaAsync,
        graftAreaToMapAsync,
        graftPrefab,
        graftPrefabAsync,
        graftPrefabToMapAsync,
        preloadMap,
        preloadPrefabMaps,
        preloadChildMaps,
        registerPrefab,
        removePrefab,
        listPrefabs,
        prefabPayload,
        capturePrefab,
        duplicatePrefab,
        renamePrefab,
        previewPrefabImport,
        prefabDependencyReport,
        choosePrefabVariant,
        favoritePrefab,
        isPrefabFavorite,
        recentPrefabs,
        exportPrefabPack,
        importPrefabPack,
        setTile,
        setTileOnMapAsync,
        fillTiles,
        fillTilesOnMapAsync,
        smartFill,
        paintPoints,
        floodFill,
        replaceTiles,
        drawLine,
        drawRectangleOutline,
        drawCircle,
        randomFill,
        proceduralFill,
        scatterTiles,
        generateBiome,
        paintPattern,
        applyRuleTiles,
        generatePath,
        generateRoad,
        generateRiver,
        generateRoom,
        generateDungeon,
        replaceByProperties,
        clearArea,
        clearAreaOnMapAsync,
        revertArea,
        revertAreaOnMapAsync,
        undoLast,
        redoLast,
        resetMap,
        compactMap,
        diagnoseMap,
        diagnoseMapSync,
        changeRegionId,
        changeTile,
        swapTile,
        swapTileAsync,
        swapArea,
        swapAreaAsync,
        usePrefab,
        getTileId,
        tileCodeAt,
        tileIdFromCode,
        tileCodeFromId,
        inspectTile,
        logTileInfo,
        tileIdInList,
        autotileInList,
        tileAhead,
        autotileAhead,
        checkAreaEvents,
        copyArea,
        pasteArea,
        transformClipboard,
        clipboardContents,
        clearClipboard,
        eventInfoAt,
        moveSpawnedEvent,
        duplicateEvent,
        deleteSpawnedEvent,
        updateSpawnedEvent,
        bulkUpdateSpawnedEvents,
        bulkMoveSpawnedEvents,
        bulkDeleteSpawnedEvents,
        editEventPage,
        registerEventTemplate,
        captureEventTemplate,
        listEventTemplates,
        removeEventTemplate,
        resolveEventTemplate,
        spawnEventTemplate,
        spawnEventTemplateOnMapAsync,
        exportEventTemplatePack,
        importEventTemplatePack,
        searchEvents,
        searchEventsOnMapAsync,
        generateEvent,
        beginEditTransaction,
        commitEditTransaction,
        cancelEditTransaction,
        editTransactionState,
        undoTransactionChange,
        redoTransactionChange,
        recoverEditTransaction,
        discardEditRecovery,
        createCheckpoint,
        listCheckpoints,
        restoreCheckpoint,
        deleteCheckpoint,
        exportPatchPack,
        importPatchPack,
        previewPatchImport,
        validateStore,
        diffMap,
        downloadJson,
        bakeMapToFile,
        listBakeBackups,
        rollbackBake,
        previewMapTransform,
        transformMap,
        resizeMap,
        rotateMap,
        mirrorMap,
        cropMap,
        batchTransformMaps,
        registerCompatibilityAdapter,
        unregisterCompatibilityAdapter,
        registerAdapterProfile,
        activateAdapterProfile,
        listAdapterProfiles,
        compatibilityDiagnostics,
        refreshCompatibility: runCompatibilityRefresh,
        performanceDiagnostics,
        operationLog,
        linkMap,
        unlinkMap,
        editingMapId,
        openRuntimeEditor,
        openRemoteMapEditor,
        openTileStudio,
        closeTileStudio,
        closeRuntimeEditor,
        toggleRuntimeEditor,
        runtimeEditorState: runtimeEditorSnapshot,
        editorPreferences,
        setEditorPreference,
        setEditorZoom,
        setEditorLayerState,
        isolateEditorLayer,
        showAllEditorLayers,
        setEditorOverlay,
        setEditorKeyBinding,
        saveBrushPreset,
        captureBrushPreset,
        listBrushPresets,
        applyBrushPreset,
        deleteBrushPreset,
        selectEditorArea,
        copyEditorSelection,
        cutEditorSelection,
        deleteEditorSelection,
        transformEditorSelection,
        moveEditorSelection,
        resizeClipboard,
        addMapBookmark,
        listMapBookmarks,
        removeMapBookmark,
        exportWorkspaceBundle,
        previewWorkspaceImport,
        importWorkspaceBundle,
        startWorkspaceBridge,
        stopWorkspaceBridge,
        workspaceBridgeState,
        favoriteTile,
        setAnimationFrames,
        createAuthoringLayer,
        listAuthoringLayers,
        activeAuthoringLayer,
        setActiveAuthoringLayer,
        updateAuthoringLayer,
        reorderAuthoringLayer,
        duplicateAuthoringLayer,
        mergeAuthoringLayer,
        deleteAuthoringLayer,
        createMask,
        createRectMask,
        createRegionMask,
        listMasks,
        resolveMask,
        updateMask,
        combineMasks,
        deleteMask,
        addModifier,
        listModifiers,
        resolveModifier,
        regenerateModifier,
        setModifierEnabled,
        updateModifier,
        deleteModifier,
        previewModifier,
        placePrefabInstance,
        listPrefabInstances,
        refreshPrefabInstance,
        refreshAllPrefabInstances,
        unlinkPrefabInstance,
        deletePrefabInstance,
        prefabInstanceDiagnostics,
        generateTerrainFields,
        generateClimateBiome,
        findTerrainPath,
        generateTerrainRoad,
        generateDownhillRiver,
        generateWaveFunctionMap,
        learnWfcRulesFromMap,
        listWfcRuleSets,
        generateWaveFunctionMapBacktracking,
        validateDungeonConnectivity,
        generateValidatedDungeon,
        scatterPrefabs,
        runGeneratorGraph,
        createChangeSet,
        listChangeSets,
        exportChangeSet,
        importChangeSet,
        deleteChangeSet,
        applyChangeSet,
        threeWayMergeSnapshots,
        resolveMergeConflicts,
        applyMergeResult,
        searchProject,
        replaceProjectTiles,
        validateMapSnapshot,
        validateProjectMaps,
        createProjectSnapshot,
        listProjectSnapshots,
        restoreProjectSnapshot,
        deleteProjectSnapshot,
        projectAuditReport,
        projectDependencyAudit,
        beginProjectTransaction,
        projectTransactionState,
        commitProjectTransaction,
        rollbackProjectTransaction,
        recoverProjectTransaction,
        listProjectTransactions,
        createWorkspaceBranch,
        listWorkspaceBranches,
        switchWorkspaceBranch,
        mergeWorkspaceBranch,
        deleteWorkspaceBranch,
        addReviewComment,
        listReviewComments,
        updateReviewComment,
        deleteReviewComment,
        createReviewThread,
        listReviewThreads,
        replyReviewThread,
        updateReviewThreadStatus,
        deleteReviewThread,
        recordCompatibilityRun,
        listCompatibilityRuns,
        recordAssetAudit,
        listAssetAudits,
        setRecoveryPolicy,
        productionPreferences,
        exportProductionHandoff,
        worldRecipe,
        listWorldRecipes,
        registerWorldRecipe,
        removeWorldRecipe,
        validateWorldRecipe,
        validateWorldRecipeCatalog,
        loadWorldRecipeCatalog,
        exportWorldRecipePack,
        importWorldRecipePack,
        runWorldRecipe,
        triggerWorldRecipes,
        queueWorldRecipeTrigger,
        setWorldRecipeEnabled,
        resetWorldRecipeState,
        worldRecipeDiagnostics,
        getWorldState,
        setWorldState,
        deleteWorldState,
        registerWorldRecipeCondition,
        registerWorldRecipeAction,
        explainWorldRecipe,
        replayWorldRecipeLog,
        setWorldRecipeBreakpoint,
        listWorldRecipeBreakpoints,
        resumeWorldRecipe,
        setWorldRecipeWatch,
        removeWorldRecipeWatch,
        listWorldRecipeWatches,
        clearWorldRecipeDebugHistory,
        worldRecipeDebugSnapshot,
        stepWorldRecipe,
        worldRecipePerformance,
        runWorldRecipeScenario,
        runWorldRecipeTestSuite,
        worldClock,
        setWorldClock,
        advanceWorldClock,
        addWorldFact,
        removeWorldFact,
        hasWorldFact,
        defineWorldZone,
        removeWorldZone,
        listWorldZones,
        worldZonesAt,
        defineWorldEntity,
        worldEntity,
        listWorldEntities,
        updateWorldEntity,
        removeWorldEntity,
        defineWorldResource,
        worldResource,
        listWorldResources,
        harvestWorldResource,
        scheduleWorldRecipe,
        cancelWorldSchedule,
        listWorldSchedules,
        validateWorldPack,
        previewWorldPackInstall,
        installWorldPack,
        listWorldPacks,
        removeWorldPack,
        uninstallWorldPack,
        rollbackWorldPack,
        listWorldPackHistory,
        worldPackLockfile,
        exportWorldPack,
        packIntegrityDigest,
        registerPackPublisher,
        trustPackPublisher,
        listTrustedPackPublishers,
        verifyWorldPackSignature,
        verifyWorldPackSignatureAsync,
        installWorldPackAsync,
        defineWorldNpc,
        worldNpc,
        listWorldNpcs,
        updateWorldNpc,
        removeWorldNpc,
        npcScheduledActivity,
        refreshWorldNpcActivities,
        simulateWorldTimeline,
        defineWorldNpcRoute,
        listWorldNpcRoutes,
        removeWorldNpcRoute,
        previewNpcJourney,
        startNpcJourney,
        advanceNpcJourneys,
        worldNpcOccupancy,
        defineWorldRuleLayer,
        worldRuleLayer,
        listWorldRuleLayers,
        removeWorldRuleLayer,
        paintWorldRules,
        saveWorldRuleBrush,
        listWorldRuleBrushes,
        removeWorldRuleBrush,
        paintWorldRuleBrush,
        filterWorldRuleLayer,
        ruleLayerStatistics,
        worldRulesAt,
        compileWorldRuleLayer,
        validateBiomeGraph,
        defineBiomeGraph,
        listBiomeGraphs,
        removeBiomeGraph,
        previewBiomeGraph,
        runBiomeGraph,
        cacheBiomeStage,
        biomeStageCache,
        clearBiomeCache,
        lockBiomeCells,
        unlockBiomeCells,
        listBiomeLocks,
        runtimeBudget,
        performanceHeatmap,
        optimizeWorldRuntime,
        runWorldBenchmark,
        listWorldBenchmarks,
        worldReferenceGraph,
        worldZoneSpatialDiagnostics,
        createRecoverySnapshot,
        listRecoverySnapshots,
        restoreRecoverySnapshot,
        deleteRecoverySnapshot,
        runCompatibilityLab,
        registerContentCatalog,
        listContentCatalogs,
        searchContentCatalog,
        subscribeContentCatalog,
        listCatalogSubscriptions,
        removeCatalogSubscription,
        checkCatalogUpdates,
        installContentCatalogItem,
        instantiateWorldRecipe,
        defineWorldMapVariant,
        listWorldMapVariants,
        applyWorldMapVariant,
        exportCanonicalWorkspace,
        registerStudioExtension,
        registerExtensionBrush,
        runExtensionBrush,
        registerExtensionGenerator,
        runExtensionGenerator,
        registerExtensionValidator,
        listStudioExtensions,
        analyzeWorldAtlas,
        listWorldAtlases,
        analyzeEventQuestGraph,
        listEventQuestGraphs,
        analyzeMapIntelligence,
        repairMapIntelligently,
        createVisualHistorySnapshot,
        listVisualHistory,
        diffVisualHistory,
        compareVersions,
        satisfiesVersion,
        resolvePackDependencies,
        registerPackRepository,
        listPackRepositories,
        validateExtensionManifest,
        installExtensionManifest,
        setExtensionPermissions,
        listExtensionManifests,
        removeExtensionManifest,
        createExtensionContext,
        simulateNpcDirector,
        runGoldenMapTest,
        runProductionValidation,
        listProductionValidations,
        createProjectDeploymentReport,
        listProjectDeploymentReports,
        startLiveProductionSession,
        liveProductionState,
        stopLiveProductionSession,
        listLiveProductionSessions,
        pumpLiveProductionSession,
        applyLiveProductionCommand,
        startPlaytestRecording,
        recordPlaytestAction,
        stopPlaytestRecording,
        listPlaytestRecordings,
        createScenarioFromRecording,
        listPlaytestScenarios,
        runRecordedScenario,
        validateEventCommandList,
        defineSemanticTileset,
        semanticTile,
        listSemanticTilesets,
        analyzeSemanticMap,
        configureExtensionSandbox,
        extensionSandboxState,
        runSandboxedExtensionContribution,
        runBudgetedExtensionContribution: runSandboxedExtensionContribution,
        searchUnifiedContent,
        createContentCollection,
        listContentCollections,
        createCollaborationBundle,
        listCollaborationBundles,
        createReleaseFingerprint,
        listReleaseFingerprints,
        buildCleanProductionBundle,
        negotiateLiveProduction,
        cleanLiveProductionArtifacts,
        runPlaytestJourney,
        listPlaytestJourneyRuns,
        runProductionTestSuite,
        listProductionTestRuns,
        createUniversalRecoveryPoint,
        restoreUniversalRecoveryPoint,
        listUniversalRecoveryPoints,
        searchProjectReferences,
        planReferenceRename,
        analyzePassabilityMap,
        detectMapSoftlocks,
        performanceCenterReport,
        configureExtensionSecurityProfile,
        listExtensionSecurityProfiles,
        registerExtensionPublisher,
        verifyExtensionPublisher,
        compareCollaborationBundles,
        createCollaborationMergePlan,
        registerCompatibilityProfileV15,
        runCompatibilityProfilesV15,
        listCompatibilityProfilesV15,
        compareReleaseFingerprints,
        createReleaseManifestV15,
        validateProductionHandoff,
        createVisualMapDraft,
        paintVisualMapDraft,
        undoVisualMapDraft,
        commitVisualMapDraft,
        compileWorldRecipeGraph,
        lockWorldRecipeGraphCells,
        regenerateWorldRecipeGraph,
        createRoundTripPlan,
        createQuestProject,
        createCutsceneTimeline,
        runPlaytestLab,
        createBugReportBundle,
        setCreatorExperienceV16,
        registerContentLibraryItem,
        searchContentLibraryV16,
        createThreeWayProjectMerge,
        createSourceControlSnapshot,
        setExtensionCapabilityPolicyV16,
        safeModeV16,
        productionDashboardV16,
        captureError,
        errorReports,
        clearErrorReports,
        guardedOperation,
        createOperationJob,
        updateOperationJob,
        cancelOperationJob,
        operationJobState,
        listOperationJobs,
        onJobProgress,
        runChunkedOperation,
        fuzzValidate,
        estimateStoreBytes,
        pruneProjectData,
        runtimeSavePayload,
        runCompatibilitySelfTest,
        systemHealthReport,
        lastCommandResult,
        clearCommandResult,
        onCommandResult,
        onChange(callback) {
            if (typeof callback === "function") changeListeners.add(callback);
            return () => changeListeners.delete(callback);
        }
    };
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
