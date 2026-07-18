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
    const MAX_IMPORT_BYTES = Math.max(1024 * 1024, integer(params.maxImportBytes, 20 * 1024 * 1024));
    const WORLD_RECIPE_FILE = String(params.worldRecipeFile ?? "HybridWorldRecipes.json").trim();
    const AUTO_WORLD_RECIPES = String(params.autoWorldRecipes ?? "true") === "true";
    const WORLD_RECIPE_LOG_LIMIT = Math.max(10, integer(params.worldRecipeLogLimit, 100));
    const LAYER_INDEX = Object.freeze({ L1: 0, L2: 1, L3: 2, L4: 3, L5: 4, L6: 5 });
    const SPAWN_ID_OFFSET = 10000;
    const PREFAB_REGEX = /<Prefab:\s*([^,>]+),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)>/gi;
    const PARAMETER_PREFABS = parseStructArray(params.prefabCatalog).map(normalizePrefabDefinition).filter(Boolean);
    const changeListeners = new Set();
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

