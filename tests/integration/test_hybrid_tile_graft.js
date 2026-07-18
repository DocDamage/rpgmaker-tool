"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const nodeCrypto = require("node:crypto");
const assetRoot = fs.existsSync("HybridTileGraft.js") ? "." : "upload";

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function tileIndex(map, x, y, z) {
    return (z * map.height + y) * map.width + x;
}

function makeMap(width = 6, height = 6, note = "") {
    const events = [];
    events[1] = { id: 1, name: "Source Event", note: "", x: 1, y: 1, pages: [] };
    return {
        width,
        height,
        data: new Array(width * height * 6).fill(0),
        tilesetId: 1,
        note,
        events
    };
}

const maps = {
    1: makeMap(6, 6, "<Prefab: One, 1, 1, 1, 1><ChildMap: 4>"),
    2: makeMap(2, 2),
    3: makeMap(4, 4),
    4: makeMap(3, 3)
};
maps[2].data[tileIndex(maps[2], 0, 0, 0)] = 7;
maps[2].events[1].x = 0;
maps[2].events[1].y = 0;
maps[4].data[tileIndex(maps[4], 1, 1, 0)] = 42;

const parameterPrefab = JSON.stringify([JSON.stringify({
    name: "CatalogRock",
    mapId: "4",
    sourceX: "1",
    sourceY: "1",
    width: "1",
    height: "1",
    layers: "L1",
    mode: "exact",
    includeEvents: "false"
})]);

global.document = { currentScript: { src: "/game/js/plugins/HybridTileGraft.js" } };
global.window = { dispatchEvent() {} };
global.require = require;
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };

global.PluginManager = {
    commands: {},
    parameters() {
        return {
            warnMismatchedTileset: "true",
            tileAnimationFrames: "30",
            maxSavedPatches: "250",
            strictTileValidation: "true",
            prefabCatalog: parameterPrefab,
            autoPreloadPrefabs: "false",
            childMapTag: "ChildMap",
            tileInfoOnOk: "true",
            commonEventOnOk: "0"
        };
    },
    registerCommand(plugin, name, fn) { this.commands[`${plugin}:${name}`] = fn; }
};

class Tilemap {
    constructor() { this.animationCount = 0; this.animationFrame = 0; this.origin = { x: 0, y: 0 }; }
    update() { this.animationCount++; }
    refresh() {}
    setData(width, height, data) { this.width = width; this.height = height; this.data = data; }
    setBitmaps(bitmaps) { this.bitmaps = bitmaps; }
    static isAutotile(id) { return id >= 2048; }
    static getAutotileKind(id) { return Math.floor((id - 2048) / 48); }
    static getAutotileShape(id) { return (id - 2048) % 48; }
    static makeAutotileId(kind, shape) { return 2048 + kind * 48 + shape; }
    static isWaterfallTile() { return false; }
    static isTileA3() { return false; }
    static isWallSideTile() { return false; }
}
Tilemap.TILE_ID_B = 0;
Tilemap.TILE_ID_C = 256;
Tilemap.TILE_ID_D = 512;
Tilemap.TILE_ID_E = 768;
Tilemap.TILE_ID_A5 = 1536;
Tilemap.TILE_ID_A1 = 2048;
global.Tilemap = Tilemap;

global.Rectangle = class Rectangle {
    constructor(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height; }
};

global.Bitmap = class Bitmap {
    constructor(width, height) { this._blits = 0; this._texts = 0; this.resize(width, height); }
    resize(width, height) { this.width = width; this.height = height; }
    clear() {}
    fillRect() {}
    blt() { this._blits++; }
    drawText() { this._texts++; }
    isReady() { return true; }
    addLoadListener(callback) { if (callback) callback(); }
};

global.ImageManager = {
    loadTileset() { return new Bitmap(768, 768); },
    loadPicture() { return new Bitmap(96, 96); }
};
global.$dataTilesets = [null, { id: 1, tilesetNames: new Array(9).fill("MockTiles"), flags: [] }];

global.Sprite = class Sprite {
    constructor(bitmap = null) { this.bitmap = bitmap; this.visible = true; this.x = 0; this.y = 0; }
    update() {}
};

class Window_Base {
    constructor(rect) { this.initialize(rect); }
    initialize(rect) {
        this.x = rect.x;
        this.y = rect.y;
        this.width = rect.width;
        this.height = rect.height;
        this.innerWidth = Math.max(0, rect.width - 24);
        this.contents = new Bitmap(this.innerWidth, Math.max(0, rect.height - 24));
        this.visible = true;
        this.active = false;
    }
    lineHeight() { return 36; }
    drawText() {}
    show() { this.visible = true; }
    hide() { this.visible = false; }
    activate() { this.active = true; }
    deactivate() { this.active = false; }
}
global.Window_Base = Window_Base;

class Window_Selectable extends Window_Base {
    initialize(rect) { super.initialize(rect); this._index = -1; this._handlers = {}; }
    maxItems() { return 0; }
    refresh() {}
    select(index) { this._index = index; }
    index() { return this._index; }
    setHandler(symbol, handler) { this._handlers[symbol] = handler; }
    itemLineRect(index) { return { x: 0, y: index * 36, width: this.innerWidth, height: 36 }; }
    itemHeight() { return 36; }
    itemRect(index) {
        const columns = this.maxCols ? this.maxCols() : 1;
        const width = Math.floor(this.innerWidth / Math.max(1, columns));
        const height = this.itemHeight();
        return { x: (index % columns) * width, y: Math.floor(index / columns) * height, width, height };
    }
}
global.Window_Selectable = Window_Selectable;

class Window_Command extends Window_Selectable {
    initialize(rect) { this._list = []; super.initialize(rect); this.refresh(); }
    clearCommandList() { this._list = []; }
    makeCommandList() {}
    refresh() { this.clearCommandList(); this.makeCommandList(); }
    addCommand(name, symbol, enabled = true) { this._list.push({ name, symbol, enabled }); }
}
global.Window_Command = Window_Command;

global.Graphics = { boxWidth: 816, boxHeight: 624 };
global.Input = {
    keyMapper: {},
    _triggered: new Set(),
    _repeated: new Set(),
    _pressed: new Set(),
    isTriggered(symbol) { return this._triggered.has(symbol); },
    isRepeated(symbol) { return this._repeated.has(symbol); },
    isPressed(symbol) { return this._pressed.has(symbol); },
    trigger(...symbols) { this._triggered = new Set(symbols); },
    clear() { this._triggered.clear(); this._repeated.clear(); this._pressed.clear(); }
};
global.TouchInput = {
    x: 0,
    y: 0,
    _triggered: false,
    isTriggered() { return this._triggered; }
};
global.Utils = { isOptionValid(option) { return option === "test"; } };

class Game_Event {
    constructor(mapId, eventId) {
        this._mapId = mapId;
        this._eventId = eventId;
        const data = global.$dataMap.events[eventId];
        this.x = data.x;
        this.y = data.y;
        this._direction = 2;
        this._pattern = 1;
        this._moveSpeed = 3;
        this._opacity = 255;
        this._blendMode = 0;
        this._transparent = false;
        this._through = false;
        this._directionFix = false;
        this._walkAnime = true;
        this._stepAnime = false;
    }
    eventId() { return this._eventId; }
    event() { return global.$dataMap.events[this._eventId]; }
    locate(x, y) { this.x = x; this.y = y; }
    direction() { return this._direction; }
    setDirection(v) { this._direction = v; }
    pattern() { return this._pattern; }
    setPattern(v) { this._pattern = v; }
    moveSpeed() { return this._moveSpeed; }
    setMoveSpeed(v) { this._moveSpeed = v; }
    opacity() { return this._opacity; }
    setOpacity(v) { this._opacity = v; }
    blendMode() { return this._blendMode; }
    setBlendMode(v) { this._blendMode = v; }
    isTransparent() { return this._transparent; }
    setTransparent(v) { this._transparent = v; }
    isThrough() { return this._through; }
    setThrough(v) { this._through = v; }
    isDirectionFixed() { return this._directionFix; }
    setDirectionFix(v) { this._directionFix = v; }
    hasWalkAnime() { return this._walkAnime; }
    setWalkAnime(v) { this._walkAnime = v; }
    hasStepAnime() { return this._stepAnime; }
    setStepAnime(v) { this._stepAnime = v; }
}
global.Game_Event = Game_Event;

class Game_Map {
    constructor() { this._mapId = 1; this._events = []; }
    setup(mapId) {
        this._mapId = mapId;
        this._events = [];
        for (const event of global.$dataMap.events) {
            if (event) this._events[event.id] = new Game_Event(mapId, event.id);
        }
    }
    mapId() { return this._mapId; }
    events() { return this._events.filter(Boolean); }
    event(id) { return this._events[id] || null; }
    terrainTag() { return 0; }
    isLadder() { return false; }
    isBush() { return false; }
    isCounter() { return false; }
    isDamageFloor() { return false; }
    xWithDirection(x, direction) { return x + (direction === 6 ? 1 : direction === 4 ? -1 : 0); }
    yWithDirection(y, direction) { return y + (direction === 2 ? 1 : direction === 8 ? -1 : 0); }
    tileWidth() { return 48; }
    tileHeight() { return 48; }
    adjustX(x) { return x; }
    adjustY(y) { return y; }
    canvasToMapX(x) { return Math.floor(x / 48); }
    canvasToMapY(y) { return Math.floor(y / 48); }
}
global.Game_Map = Game_Map;

class Game_Interpreter {
    constructor() { this._waitMode = ""; }
    eventId() { return 1; }
    setWaitMode(mode) { this._waitMode = mode; }
    updateWaitMode() { return false; }
}
global.Game_Interpreter = Game_Interpreter;

class Scene_Map {
    constructor() {
        this._transfer = false;
        this.children = [];
        this._windowLayer = {};
        this.children.push(this._windowLayer);
    }
    onMapLoaded() {}
    createAllWindows() {}
    update() {}
    processMapTouch() {}
    terminate() {}
    addWindow(windowObject) { this.children.push(windowObject); }
    addChildAt(child, index) { this.children.splice(index, 0, child); }
}
global.Scene_Map = Scene_Map;
global.SceneManager = { _scene: null };
global.Sprite_Character = class {};
global.DataManager = { makeSaveContents() { return {}; } };

global.$dataMap = clone(maps[1]);
global.$dataMapInfos = [null,
    { id: 1, name: "Main", parentId: 0 },
    { id: 2, name: "Source", parentId: 0 },
    { id: 3, name: "Remote Yard", parentId: 0 },
    { id: 4, name: "Prefab Storage", parentId: 1 }
];
global.$gameSystem = {
    _hybridTileGraft: {
        version: 2,
        maps: {},
        eventStates: {},
        nextSpawnId: 10000,
        animationFrames: 30
    }
};
global.$gameSelfSwitches = { _data: {}, setValue(key, value) { this._data[key] = value; }, onChange() {} };
global.$gameSwitches = { values: {}, value(id) { return !!this.values[id]; }, setValue(id, value) { this.values[id] = !!value; } };
global.$gameVariables = { values: {}, value(id) { return this.values[id] ?? 0; }, setValue(id, value) { this.values[id] = value; } };
global.$gameTemp = {
    reserved: 0,
    reserveCommonEvent(id) { this.reserved = id; },
    isCommonEventReserved() { return false; }
};
class Game_Player {
    constructor() { this.x = 0; this.y = 0; }
    direction() { return 6; }
    followers() { return { follower() { return null; } }; }
    isTransferring() { return false; }
    newMapId() { return 1; }
    canMove() { return true; }
    triggerButtonAction() { return false; }
}
global.Game_Player = Game_Player;
global.$gamePlayer = new Game_Player();
global.$gameMap = new Game_Map();
global.$gameMap.setup(1);

global.XMLHttpRequest = class {
    open(method, url) { this.url = url; }
    overrideMimeType() {}
    send() {
        const match = this.url.match(/Map(\d+)\.json/);
        const mapId = match ? Number(match[1]) : 0;
        const source = maps[mapId];
        if (!source) {
            this.status = 404;
            this.responseText = "";
        } else {
            this.status = 200;
            this.responseText = JSON.stringify(source);
        }
        this.onload();
    }
};

const pluginCode = fs.readFileSync(`${assetRoot}/HybridTileGraft.js`, "utf8");
vm.runInThisContext(pluginCode, { filename: "HybridTileGraft.js" });

(async () => {
    const api = global.window.HybridTileGraft;
    assert.strictEqual(api.version, "18.1.0");
    api.listPrefabs();
    assert.strictEqual(global.$gameSystem._hybridTileGraft.version, 18, "older stores must migrate to v18");
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.prefabs, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.redo, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.checkpoints, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.prefabPayloads, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.authoringLayers, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.masks, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.modifiers, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.prefabInstances, {});
    assert.deepStrictEqual(global.$gameSystem._hybridTileGraft.changeSets, {});
    assert.strictEqual(api.tileIdFromCode("A0,0"), 2048);
    assert.strictEqual(api.tileIdFromCode("B2,1"), 10);
    assert.strictEqual(api.tileCodeFromId(10), "B2,1");
    assert.ok(Number.isNaN(api.tileIdFromCode("B0,40")));
    assert.ok(PluginManager.commands["HybridTileGraft:linkMap"]);
    assert.ok(PluginManager.commands["HybridTileGraft:diagnoseMap"]);
    assert.ok(PluginManager.commands["HybridTileGraft:openEditor"]);
    assert.ok(PluginManager.commands["HybridTileGraft:redoLast"]);
    assert.ok(PluginManager.commands["HybridTileGraft:openRemoteEditor"]);
    assert.ok(PluginManager.commands["HybridTileGraft:floodFill"]);
    assert.ok(PluginManager.commands["HybridTileGraft:exportPatchPack"]);
    assert.ok(PluginManager.commands["HybridTileGraft:bakeMap"]);

    const scene = new Scene_Map();
    global.SceneManager._scene = scene;
    scene.createAllWindows();
    scene.onMapLoaded();

    assert.strictEqual(api.openRuntimeEditor({ x: 1, y: 1, layer: "L1", tileId: 12, mode: "exact", persist: false }), true);
    assert.strictEqual(api.runtimeEditorState().active, true);
    assert.strictEqual(global.$gamePlayer.canMove(), false, "runtime editor must freeze player movement");
    assert.strictEqual(scene._hybridEditorStatus.visible, true);
    assert.strictEqual(scene._hybridEditorCursor.visible, true);
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    assert.strictEqual(api.getTileId(1, 1, "L1"), 12, "editor paint tool must apply the brush");
    global.Input.trigger("pagedown");
    scene.update();
    global.Input.clear();
    assert.strictEqual(api.runtimeEditorState().layer, "L2");
    scene.openHybridEditorCommand();
    assert.strictEqual(scene._hybridEditorCommand.visible, true);
    scene.closeHybridEditorCommand();
    scene.openHybridPrefabBrowser();
    assert.ok(scene._hybridPrefabBrowser.maxItems() >= 2);
    scene.closeHybridPrefabBrowser();
    scene.openHybridTilePalette();
    assert.ok(scene._hybridTilePalette.maxItems() > 0, "graphical tile palette must expose tiles");
    scene.closeHybridTilePalette();
    global.TouchInput.x = 48;
    global.TouchInput.y = 200;
    global.TouchInput._triggered = true;
    scene.processMapTouch();
    global.TouchInput._triggered = false;
    assert.strictEqual(api.getTileId(1, 4, "L2"), 12, "mouse click must place the visual brush");
    api.closeRuntimeEditor();
    assert.strictEqual(global.$gamePlayer.canMove(), true);
    api.resetMap(1, false);

    api.setTile(2, 2, "L1", "A0,0", true, { mode: "autotile" });
    assert.ok(api.getTileId(2, 2, "L1") >= 2048);
    assert.strictEqual(api.setTile(0, 0, "L1", 999999, false), false);
    assert.ok(api.changeRegionId(1, 1, 255, false));
    assert.strictEqual(api.getTileId(1, 1, "L6"), 255);
    assert.strictEqual(api.changeRegionId(1, 1, 256, false), false);
    let info = api.inspectTile(2, 2);
    assert.strictEqual(info.valid, true);
    assert.strictEqual(info.layers.L1.autotileKind, 0);
    assert.strictEqual(api.autotileInList(["A0,0"], 2, 2, "L1"), true);
    assert.strictEqual(api.tileIdInList([info.layers.L1.tileId], 2, 2, "L1"), true);

    api.graftArea({
        sourceMapId: 0,
        sourceX: 1,
        sourceY: 1,
        width: 1,
        height: 1,
        targetX: 3,
        targetY: 3,
        layers: "L1,L7",
        includeEvents: true,
        save: true
    });
    assert.strictEqual(api.checkAreaEvents(3, 3, 1, 1).spawned.length, 1);
    api.clearArea(3, 3, 1, 1, "L1,L7", true, true, "autotile");
    assert.strictEqual(api.checkAreaEvents(3, 3, 1, 1).spawned.length, 0);

    global.$dataMap = clone(maps[1]);
    scene.onMapLoaded();
    assert.strictEqual(api.checkAreaEvents(3, 3, 1, 1).spawned.length, 0, "cleared events must stay cleared after reload");

    api.graftPrefab({ name: "One", storageMapId: 0, targetX: 4, targetY: 4, layers: "L7", includeEvents: true, save: true });
    let spawned = api.checkAreaEvents(4, 4, 1, 1).spawned;
    assert.strictEqual(spawned.length, 1);
    global.$gameMap.event(spawned[0]).locate(5, 5);
    global.DataManager.makeSaveContents();
    global.$dataMap = clone(maps[1]);
    scene.onMapLoaded();
    spawned = api.checkAreaEvents(5, 5, 1, 1).spawned;
    assert.strictEqual(spawned.length, 1, "spawned event position must survive reload");

    api.clearArea(5, 5, 1, 1, "L7", true, true, "autotile");
    assert.strictEqual(api.checkAreaEvents(5, 5, 1, 1).spawned.length, 0);
    global.$dataMap = clone(maps[1]);
    scene.onMapLoaded();
    assert.strictEqual(api.checkAreaEvents(0, 0, 6, 6).spawned.length, 0, "a moved event cleared at its runtime position must stay removed");

    api.resetMap(1, true);
    assert.strictEqual(api.getTileId(2, 2, "L1"), 0);

    const fill = api.smartFill({
        x: 2,
        y: 2,
        layer: "L1",
        tileId: 1,
        mode: "exact",
        filters: JSON.stringify({ distance: "1", regions: "[]", tileIds: "[]", tileLayers: "[\"L1\"]" }),
        creep: JSON.stringify({ distance: "1", tileId: "2", layer: "L2", mode: "exact", regions: "[]" }),
        save: true
    });
    assert.strictEqual(fill.filled, 5);
    assert.ok(fill.creeped > 0);
    assert.strictEqual(api.getTileId(2, 2, "L1"), 1);
    assert.strictEqual(api.getTileId(2, 0, "L2"), 2);
    api.undoLast(1);
    assert.strictEqual(api.getTileId(2, 0, "L2"), 0, "creep patch must be independently undoable");
    assert.strictEqual(api.redoLast(1), true);
    assert.strictEqual(api.getTileId(2, 0, "L2"), 2, "redo must restore the last patch");
    api.undoLast(1);
    api.undoLast(1);
    assert.strictEqual(api.getTileId(2, 2, "L1"), 0);

    await api.graftAreaAsync({ sourceMapId: 2, sourceX: 0, sourceY: 0, width: 1, height: 1, targetX: 0, targetY: 0, layers: "L1", save: false });
    assert.strictEqual(api.getTileId(0, 0, "L1"), 7);
    api.resetMap(1, false);

    assert.ok(api.listPrefabs().some(prefab => prefab.name === "CatalogRock"));
    assert.ok(api.listPrefabs().some(prefab => prefab.name === "One"), "map-note prefabs must appear in the browser catalog");
    await api.graftPrefabAsync({ name: "CatalogRock", targetX: 4, targetY: 4, save: false });
    assert.strictEqual(api.getTileId(4, 4, "L1"), 42);
    assert.ok(api.registerPrefab({ name: "RuntimeRock", mapId: 4, x: 1, y: 1, width: 1, height: 1, layers: "L1" }, true));
    assert.ok(api.listPrefabs().some(prefab => prefab.name === "RuntimeRock"));
    assert.strictEqual(api.removePrefab("RuntimeRock", 4), true);

    await api.setTileOnMapAsync(3, 1, 1, "L1", 9, { mode: "exact" });
    await api.fillTilesOnMapAsync(3, 2, 1, 2, 1, "L2", 10, { mode: "exact" });
    await api.graftAreaToMapAsync({ targetMapId: 3, sourceMapId: 2, sourceX: 0, sourceY: 0, width: 1, height: 1, targetX: 0, targetY: 0, layers: "L1", save: true });
    let remote = await api.preloadMap(3);
    assert.strictEqual(remote.data[tileIndex(remote, 0, 0, 0)], 7);
    assert.strictEqual(remote.data[tileIndex(remote, 1, 1, 0)], 9);
    assert.strictEqual(remote.data[tileIndex(remote, 2, 1, 1)], 10);
    await api.clearAreaOnMapAsync(3, 1, 1, 1, 1, "L1", false, "exact");
    remote = await api.preloadMap(3);
    assert.strictEqual(remote.data[tileIndex(remote, 1, 1, 0)], 0);
    await api.revertAreaOnMapAsync(3, 0, 0, 1, 1, "L1", false);
    remote = await api.preloadMap(3);
    assert.strictEqual(remote.data[tileIndex(remote, 0, 0, 0)], 0);
    assert.strictEqual(await api.linkMap("Remote Yard"), 3);
    assert.strictEqual(api.editingMapId(), 3);
    api.unlinkMap();
    assert.strictEqual(api.editingMapId(), 1);

    api.resetMap(1, true);
    api.setTile(0, 0, "L1", 33, true, { mode: "exact" });
    const clipboard = api.copyArea(0, 0, 1, 1, "L1", false);
    assert.strictEqual(clipboard.tiles.L1[0], 33);
    assert.ok(api.clipboardContents());
    assert.ok(api.pasteArea(5, 5, { save: true, mode: "exact" }));
    assert.strictEqual(api.getTileId(5, 5, "L1"), 33);
    api.undoLast(1);
    assert.strictEqual(api.getTileId(5, 5, "L1"), 0);
    api.redoLast(1);
    assert.strictEqual(api.getTileId(5, 5, "L1"), 33);
    api.copyArea(1, 1, 1, 1, "L1,L7", true);
    assert.ok(api.pasteArea(4, 4, { save: true, mode: "exact", includeEvents: true }));
    assert.strictEqual(api.checkAreaEvents(4, 4, 1, 1).spawned.length, 1, "clipboard events must paste with fresh spawned IDs");
    api.undoLast(1);
    assert.strictEqual(api.checkAreaEvents(4, 4, 1, 1).spawned.length, 0);
    api.redoLast(1);
    assert.strictEqual(api.checkAreaEvents(4, 4, 1, 1).spawned.length, 1, "redo must restore pasted events");
    api.clearClipboard();
    assert.strictEqual(api.clipboardContents(), null);

    api.resetMap(1, true);
    api.setTile(5, 0, "L1", 77, true, { mode: "exact" });
    api.undoLast(1);
    global.$dataMap = clone(maps[1]);
    scene.onMapLoaded();
    assert.strictEqual(api.redoLast(1), true, "redo history must survive a map reload");
    assert.strictEqual(api.getTileId(5, 0, "L1"), 77);

    api.resetMap(1, true);
    api.setTile(0, 0, "L1", 3, true, { mode: "exact" });
    api.setTile(1, 0, "L1", 4, true, { mode: "exact" });
    api.setTile(2, 0, "L1", 5, true, { mode: "exact" });
    api.graftArea({
        sourceMapId: 0,
        sourceX: 1,
        sourceY: 1,
        width: 1,
        height: 1,
        targetX: 3,
        targetY: 3,
        layers: "L7",
        includeEvents: true,
        save: true
    });
    const beforeCompact = await api.diagnoseMap(1);
    assert.strictEqual(beforeCompact.patchCount, 4);
    const compacted = await api.compactMap(1);
    assert.strictEqual(compacted.afterPatchCount, 1);
    assert.strictEqual(compacted.spawnedEvents, 1);
    assert.strictEqual(api.getTileId(0, 0, "L1"), 3);
    const afterCompact = await api.diagnoseMap(1);
    assert.strictEqual(afterCompact.patchCount, 1);
    assert.strictEqual(afterCompact.ok, true);
    global.$dataMap = clone(maps[1]);
    scene.onMapLoaded();
    assert.strictEqual(api.getTileId(2, 0, "L1"), 5, "compacted tiles must survive reload");
    assert.strictEqual(api.checkAreaEvents(3, 3, 1, 1).spawned.length, 1, "compacted events must survive reload");

    // v5 advanced brush primitives.
    api.resetMap(1, true);
    assert.ok(api.drawLine(0, 0, 3, 3, "L1", 11, true, { mode: "exact" }));
    for (let n = 0; n <= 3; n++) assert.strictEqual(api.getTileId(n, n, "L1"), 11);
    assert.ok(api.drawRectangleOutline(0, 0, 3, 3, "L2", 12, true, { mode: "exact" }));
    assert.strictEqual(api.getTileId(0, 0, "L2"), 12);
    assert.strictEqual(api.getTileId(1, 1, "L2"), 0);
    assert.ok(api.drawCircle(3, 3, 1, "L3", 13, true, { mode: "exact" }));
    assert.strictEqual(api.getTileId(3, 2, "L3"), 13);
    assert.ok(api.randomFill(4, 0, 2, 2, "L4", [{ tileId: 14, weight: 1 }], true, {
        mode: "exact", random: () => 0
    }));
    assert.strictEqual(api.getTileId(5, 1, "L4"), 14);
    api.resetMap(1, true);
    api.fillTiles(0, 0, 6, 6, "L1", 1, true, { mode: "exact" });
    api.fillTiles(0, 3, 6, 1, "L1", 2, true, { mode: "exact" });
    assert.ok(api.floodFill(0, 0, "L1", 3, true, { mode: "exact" }));
    assert.strictEqual(api.getTileId(5, 2, "L1"), 3);
    assert.strictEqual(api.getTileId(5, 4, "L1"), 1, "flood fill must stop at a boundary");
    assert.ok(api.replaceTiles({ fromTileId: 3, toTileId: 4, layer: "L1", x: 0, y: 0, width: 3, height: 3, mode: "exact" }));
    assert.strictEqual(api.getTileId(2, 2, "L1"), 4);
    assert.strictEqual(api.getTileId(5, 2, "L1"), 3, "bounded replace must stay inside its rectangle");

    // v5 transactions, checkpoints, recovery, and grouped undo.
    api.resetMap(1, true);
    assert.ok(api.beginEditTransaction("Grouped Terrain", 1));
    api.setTile(0, 0, "L1", 21, true, { mode: "exact" });
    api.setTile(1, 0, "L1", 22, true, { mode: "exact" });
    assert.strictEqual(api.editTransactionState().changeCount, 2);
    assert.strictEqual(api.undoTransactionChange(), true);
    assert.strictEqual(api.getTileId(1, 0, "L1"), 0);
    assert.strictEqual(api.redoTransactionChange(), true);
    assert.strictEqual(api.commitEditTransaction(true).changes, 2);
    assert.strictEqual((await api.diagnoseMap(1)).patchCount, 1, "committed transaction must be one undo unit");
    api.undoLast(1);
    assert.strictEqual(api.getTileId(0, 0, "L1"), 0);
    assert.strictEqual(api.getTileId(1, 0, "L1"), 0);
    api.redoLast(1);
    assert.strictEqual(api.getTileId(1, 0, "L1"), 22);
    assert.ok(api.beginEditTransaction("Discard Me", 1));
    api.setTile(2, 0, "L1", 23, true, { mode: "exact" });
    assert.ok(api.cancelEditTransaction());
    assert.strictEqual(api.getTileId(2, 0, "L1"), 0);
    api.createCheckpoint("Stable", 1);
    api.setTile(3, 0, "L1", 24, true, { mode: "exact" });
    assert.strictEqual(api.restoreCheckpoint("Stable", 1), true);
    assert.strictEqual(api.getTileId(3, 0, "L1"), 0);
    assert.ok(api.listCheckpoints(1).some(item => item.name === "Stable"));
    assert.strictEqual(api.deleteCheckpoint("Stable", 1), true);
    assert.ok(api.beginEditTransaction("Recovery", 1));
    api.setTile(4, 0, "L1", 25, true, { mode: "exact" });
    assert.strictEqual(api.recoverEditTransaction(1), true);
    assert.strictEqual(api.getTileId(4, 0, "L1"), 0, "recovery must roll back an interrupted transaction");

    // Embedded prefab authoring, metadata, transforms, favorites, and exchange.
    api.resetMap(1, true);
    api.setTile(0, 0, "L1", 31, true, { mode: "exact" });
    api.setTile(1, 0, "L1", 32, true, { mode: "exact" });
    const captured = api.capturePrefab("EmbeddedPair", 0, 0, 2, 1, {
        layers: "L1", mode: "exact", category: "Structures", tags: "test,pair",
        description: "Two-tile test prefab", variantGroup: "pair", weight: 2, save: true
    });
    assert.ok(captured);
    assert.strictEqual(api.prefabPayload(captured).width, 2);
    assert.strictEqual(api.favoritePrefab("EmbeddedPair", 1, true), true);
    assert.strictEqual(api.listPrefabs().find(item => item.name === "EmbeddedPair").favorite, true);
    assert.strictEqual(api.choosePrefabVariant("pair", { random: () => 0 }).name, "EmbeddedPair");
    const prefabPack = api.exportPrefabPack(["EmbeddedPair"]);
    assert.strictEqual(prefabPack.prefabs.length, 1);
    assert.strictEqual(api.removePrefab("EmbeddedPair", 1), true);
    assert.strictEqual(api.importPrefabPack(prefabPack, true).length, 1);
    assert.ok(api.duplicatePrefab("EmbeddedPair", 1, "EmbeddedPairCopy", true));
    assert.ok(api.renamePrefab("EmbeddedPairCopy", 1, "EmbeddedPairRenamed", true));
    api.resetMap(1, true);
    assert.ok(await api.graftPrefabAsync({ name: "EmbeddedPair", storageMapId: 1, targetX: 2, targetY: 2,
        rotation: 90, mode: "exact", save: true }));
    assert.strictEqual(api.getTileId(2, 2, "L1"), 31);
    assert.strictEqual(api.getTileId(2, 3, "L1"), 32, "90-degree prefab rotation must rotate its payload");

    // Spawned-event authoring APIs.
    api.resetMap(1, true);
    const duplicatedId = api.duplicateEvent(1, 2, 2, true);
    assert.ok(duplicatedId >= 10000);
    assert.strictEqual(api.eventInfoAt(2, 2).find(item => item.id === duplicatedId).spawned, true);
    assert.ok(api.moveSpawnedEvent(duplicatedId, 3, 2, true));
    assert.strictEqual(api.eventInfoAt(3, 2).some(item => item.id === duplicatedId), true);
    assert.ok(api.updateSpawnedEvent(duplicatedId, { name: "Edited Spawn", note: "<Edited>", direction: 4 }, true));
    assert.strictEqual(global.$gameMap.event(duplicatedId).event().name, "Edited Spawn");
    assert.strictEqual(api.deleteSpawnedEvent(duplicatedId, true), true);
    assert.strictEqual(global.$gameMap.event(duplicatedId), null);

    // Compatibility callbacks, patch exchange, and change reports.
    let compatibilityCalls = 0;
    assert.strictEqual(api.registerCompatibilityAdapter("test", payload => {
        if (payload.operation === "setTile") compatibilityCalls++;
    }), true);
    api.resetMap(1, true);
    api.setTile(5, 5, "L1", 41, true, { mode: "exact" });
    assert.strictEqual(compatibilityCalls, 1);
    assert.strictEqual(api.unregisterCompatibilityAdapter("test"), true);
    const report = await api.diffMap(1);
    assert.strictEqual(report.changedCells, 1);
    assert.strictEqual(report.layerChanges.L1, 1);
    const patchPack = api.exportPatchPack([1]);
    api.resetMap(1, true);
    assert.strictEqual(api.getTileId(5, 5, "L1"), 0);
    assert.deepStrictEqual(api.importPatchPack(patchPack, { replace: true }), [1]);
    assert.strictEqual(api.getTileId(5, 5, "L1"), 41);

    // v6 procedural authoring, advanced prefabs, event templates, and workspace exchange.
    api.resetMap(1, true);
    const dungeon = api.generateDungeon({
        x: 0, y: 0, width: 6, height: 6, floorTileId: 31, wallTileId: 32,
        roomCount: 1, minRoomWidth: 4, maxRoomWidth: 4, minRoomHeight: 4, maxRoomHeight: 4,
        seed: "test-dungeon", mode: "exact"
    });
    assert.ok(dungeon && dungeon.rooms.length === 1);
    assert.ok(api.generateBiome({ x: 0, y: 0, width: 2, height: 2, layer: "L2",
        seed: "test-biome", bands: [{ threshold: 1, tileId: 33 }], mode: "exact" }));
    assert.strictEqual(api.getTileId(1, 1, "L2"), 33);
    assert.ok(api.generateRoad({ tileId: 34, layer: "L3", width: 1,
        points: [{ x: 0, y: 5 }, { x: 5, y: 5 }], seed: "road", mode: "exact" }));
    assert.strictEqual(api.getTileId(4, 5, "L3"), 34);

    api.resetMap(1, true);
    api.setTile(0, 0, "L1", 31, true, { mode: "exact" });
    assert.ok(api.capturePrefab("Parameterized", 0, 0, 1, 1, {
        layers: "L1", parameters: [{ name: "surface", sourceTileId: 31, default: 32 }], save: true
    }));
    assert.ok(await api.graftPrefabAsync({ name: "Parameterized", storageMapId: 1,
        targetX: 2, targetY: 2, parameters: { surface: 35 }, mode: "exact", save: true }));
    assert.strictEqual(api.getTileId(2, 2, "L1"), 35, "prefab parameters must substitute tile slots");
    assert.strictEqual(api.prefabDependencyReport(api.listPrefabs().find(item => item.name === "Parameterized")).ok, true);

    assert.ok(api.captureEventTemplate("SourceNpc", 1, { category: "NPC" }));
    const templateEventId = api.spawnEventTemplate("SourceNpc", 2, 3, { eventName: "Template NPC", save: true });
    assert.ok(templateEventId >= 10000);
    assert.ok(api.bulkUpdateSpawnedEvents([templateEventId], { note: "<BulkEdited>", offsetX: 1 }, true));
    assert.strictEqual(global.$gameMap.event(templateEventId).x, 3);
    assert.strictEqual(api.searchEvents({ query: "BulkEdited", spawned: true }).length, 1);
    const chestId = api.generateEvent("chest", 4, 4, { gold: 25, save: true });
    assert.strictEqual(global.$gameMap.event(chestId).event().pages.length, 2);
    const templatePack = api.exportEventTemplatePack(["SourceNpc"]);
    assert.strictEqual(templatePack.templates.length, 1);

    api.setTile(5, 5, "L1", 41, true, { mode: "exact" });
    const workspace = api.exportWorkspaceBundle({ mapIds: [1] });
    assert.strictEqual(workspace.format, "HybridTileGraftWorkspace");
    assert.strictEqual(api.previewWorkspaceImport(workspace, { conflictPolicy: "replace" }).ok, true);
    api.resetMap(1, true);
    assert.ok(api.importWorkspaceBundle(workspace, { conflictPolicy: "replace", checkpoint: false }));
    assert.strictEqual(api.getTileId(5, 5, "L1"), 41);
    assert.strictEqual(api.validateStore({ repair: false }).ok, true);
    assert.ok(api.operationLog(20).length > 0);

    // v7 non-destructive authoring layers, masks, modifiers, and intelligent generation.
    api.resetMap(1, true);
    const terrainLayer = api.createAuthoringLayer("Terrain Pass", 1, { color: "#55aaee" });
    assert.strictEqual(api.activeAuthoringLayer(1).id, terrainLayer.id);
    api.setTile(0, 0, "L1", 51, true, { mode: "exact" });
    assert.strictEqual(api.listAuthoringLayers(1)[0].patchCount, 1);
    assert.strictEqual(api.getTileId(0, 0, "L1"), 51);
    api.updateAuthoringLayer(terrainLayer.id, { visible: false }, 1);
    assert.strictEqual(api.getTileId(0, 0, "L1"), 0, "hidden authoring layers must not compose");
    api.updateAuthoringLayer(terrainLayer.id, { visible: true }, 1);
    assert.strictEqual(api.getTileId(0, 0, "L1"), 51);
    api.updateAuthoringLayer(terrainLayer.id, { locked: true }, 1);
    assert.strictEqual(api.activeAuthoringLayer(1), null, "locking the active layer must deactivate it");
    api.updateAuthoringLayer(terrainLayer.id, { locked: false }, 1);
    assert.ok(api.setActiveAuthoringLayer(terrainLayer.id, 1));
    const layerCopy = api.duplicateAuthoringLayer(terrainLayer.id, "Terrain Copy", 1);
    assert.strictEqual(layerCopy.copiedPatches, 1);
    assert.strictEqual(api.deleteAuthoringLayer(layerCopy.id, 1, { discardPatches: true }).discardedPatches, 1);

    const maskA = api.createRectMask("Northwest", 0, 0, 2, 2, 1);
    const maskB = api.createRectMask("Center", 1, 1, 2, 2, 1);
    assert.strictEqual(api.listMasks(1).find(mask => mask.id === maskA.id).cellCount, 4);
    const maskUnion = api.combineMasks("Combined", maskA.id, maskB.id, "union", 1);
    assert.strictEqual(maskUnion.points.length, 7);
    assert.ok(api.generateClimateBiome({ x: 0, y: 0, width: 4, height: 4, layer: "L2", seed: "climate-test",
        zones: [{ tileId: 52 }], mask: maskA.id, mode: "exact" }));
    assert.strictEqual(api.getTileId(1, 1, "L2"), 52);
    assert.strictEqual(api.getTileId(3, 3, "L2"), 0, "generator masks must constrain writes");

    const modifier = api.addModifier("climateBiome", { name: "Moisture", x: 0, y: 0, width: 2, height: 2,
        layer: "L3", seed: "modifier-test", zones: [{ tileId: 53 }], mode: "exact" }, 1);
    assert.ok(modifier && api.listModifiers(1).some(item => item.id === modifier.id));
    assert.strictEqual(api.getTileId(1, 1, "L3"), 53);
    api.setModifierEnabled(modifier.id, false, 1);
    assert.strictEqual(api.getTileId(1, 1, "L3"), 0, "disabled modifiers must be non-destructively hidden");
    api.setModifierEnabled(modifier.id, true, 1);
    assert.strictEqual(api.getTileId(1, 1, "L3"), 53);
    assert.ok(api.generateWaveFunctionMap({ x: 2, y: 0, width: 2, height: 2, layer: "L4", seed: "wfc-test",
        rules: [{ tileId: 54, weight: 1, allowed: {} }], mode: "exact" }));
    assert.strictEqual(api.getTileId(3, 1, "L4"), 54);
    assert.ok(api.generateTerrainRoad({ start: { x: 0, y: 5 }, goal: { x: 5, y: 5 }, layer: "L1",
        tileId: 55, width: 1, mode: "exact" }));
    assert.strictEqual(api.getTileId(5, 5, "L1"), 55);

    // v7 linked prefabs, change sets, merges, project search, jobs, and health tooling.
    const instance = await api.placePrefabInstance({ name: "CatalogRock", targetX: 4, targetY: 4, mode: "exact" });
    assert.ok(instance && api.listPrefabInstances(1).some(item => item.id === instance.id));
    assert.strictEqual(api.prefabInstanceDiagnostics(1).total, 1);
    assert.strictEqual(api.unlinkPrefabInstance(instance.id, 1), true);
    assert.strictEqual(api.listPrefabInstances(1).length, 0);
    assert.strictEqual(api.getTileId(4, 4, "L1"), 42, "unlinking must retain the placed prefab patches");

    const changeSet = await api.createChangeSet("v7 Review", 1, { author: "test" });
    assert.ok(changeSet.cells.length > 0 && api.listChangeSets(1).some(item => item.id === changeSet.id));
    assert.strictEqual(api.exportChangeSet(changeSet.id).name, "v7 Review");
    assert.strictEqual(api.deleteChangeSet(changeSet.id), true);

    const mergeBase = makeMap(2, 2);
    const mergeOurs = clone(mergeBase);
    const mergeTheirs = clone(mergeBase);
    mergeOurs.data[0] = 60;
    mergeTheirs.data[0] = 61;
    const merge = api.threeWayMergeSnapshots(mergeBase, mergeOurs, mergeTheirs, { resolution: "ours" });
    assert.strictEqual(merge.conflictCount, 1);
    const resolvedMerge = api.resolveMergeConflicts(merge, { 0: "theirs" });
    assert.strictEqual(resolvedMerge.merged.data[0], 61);
    assert.strictEqual(resolvedMerge.unresolvedConflicts, 0);

    const projectSearch = await api.searchProject({ mapIds: [2], tileIds: [7] });
    assert.strictEqual(projectSearch.tileMatches, 1);
    const mapValidation = await api.validateProjectMaps([1, 2]);
    assert.strictEqual(mapValidation.checked, 2);
    assert.strictEqual(mapValidation.ok, true);
    const jobEvents = [];
    const stopJobEvents = api.onJobProgress(job => jobEvents.push(job.status));
    const jobResult = await api.runChunkedOperation("Double", [1, 2, 3], value => value * 2, { batchSize: 1 });
    stopJobEvents();
    assert.deepStrictEqual(jobResult.results, [2, 4, 6]);
    assert.ok(jobEvents.includes("completed"));
    assert.strictEqual(api.fuzzValidate(50, "v7-fuzz").ok, true);
    const capturedError = api.captureError(new Error("expected test error"), { operation: "test" });
    assert.strictEqual(api.errorReports(1)[0].id, capturedError.id);
    assert.strictEqual(api.clearErrorReports() >= 1, true);
    assert.strictEqual(api.systemHealthReport().pluginVersion, "18.1.0");
    assert.ok(api.estimateStoreBytes().estimatedBytes > 0);
    const runtimeSave = api.runtimeSavePayload();
    assert.strictEqual(runtimeSave.version, 18);
    assert.strictEqual(runtimeSave.saveProfile, "runtime-lean-v18");
    assert.ok(runtimeSave.maps, "runtime tile patches must remain saveable");
    assert.strictEqual(runtimeSave.authoringLayers, undefined, "authoring drafts must not inflate game saves");
    assert.strictEqual(runtimeSave.productionDashboardsV16, undefined, "production reports belong in project metadata, not game saves");
    const projectSnapshot = api.createProjectSnapshot("v7 Snapshot", { mapIds: [1], retain: 2 });
    assert.ok(projectSnapshot && api.listProjectSnapshots().some(item => item.id === projectSnapshot.id));
    assert.strictEqual(api.deleteProjectSnapshot(projectSnapshot.id), true);
    assert.strictEqual(api.projectAuditReport().pluginVersion, "18.1.0");

    // Full-map transforms preserve metadata through a reversible runtime override.
    api.resetMap(3, true);
    const transformPreview = await api.previewMapTransform(3, { targetWidth: 6, targetHeight: 5 });
    assert.deepStrictEqual([transformPreview.to.width, transformPreview.to.height], [6, 5]);
    await api.resizeMap(3, 6, 5, { checkpoint: false });
    let transformedRemote = await api.preloadMap(3);
    assert.deepStrictEqual([transformedRemote.width, transformedRemote.height], [6, 5]);
    api.resetMap(3, true);
    transformedRemote = await api.preloadMap(3);
    assert.deepStrictEqual([transformedRemote.width, transformedRemote.height], [4, 4]);

    // Professional editor state: zoom, real layer previews, overlays, presets, and studio browser.
    assert.strictEqual(api.openRuntimeEditor({ x: 1, y: 1, persist: false }), true);
    assert.strictEqual(api.setEditorZoom(1.5), 1.5);
    api.setEditorLayerState("L2", { visible: true, locked: true, opacity: 0.5 });
    assert.strictEqual(api.runtimeEditorState().layerLocks.L2, true);
    assert.strictEqual(scene._hybridLayerTilemaps[1].alpha, 0.5);
    assert.strictEqual(api.setEditorOverlay("changes"), "changes");
    assert.ok(api.captureBrushPreset("Test Brush"));
    assert.strictEqual(api.applyBrushPreset("Test Brush"), true);
    api.setEditorLayerState("L2", { locked: false, opacity: 1 });
    api.closeRuntimeEditor(false);
    assert.strictEqual(api.openTileStudio({ openMapBrowser: true, persist: false }), true);
    assert.strictEqual(scene._hybridMapBrowser.visible, true);
    api.closeTileStudio(false);

    for (const commandName of ["openStudio", "transformMap", "generateDungeon", "generateBiome",
        "generatePath", "generateEvent", "spawnEventTemplate", "exportWorkspace", "importWorkspace",
        "validateProject", "rollbackBake", "setEditorView", "startWorkspaceBridge", "stopWorkspaceBridge",
        "createAuthoringLayer", "setActiveAuthoringLayer", "createMask", "addModifier", "regenerateModifier",
        "placePrefabInstance", "refreshPrefabInstances", "generateClimateBiome", "generateTerrainRoad",
        "generateDownhillRiver", "generateWaveFunctionMap", "createChangeSet", "applyChangeSet",
        "validateProjectMaps", "createProjectSnapshot", "systemHealth", "pruneProjectData", "runCompatibilitySelfTest",
        "beginProjectTransaction", "commitProjectTransaction", "rollbackProjectTransaction", "createWorkspaceBranch",
        "switchWorkspaceBranch", "mergeWorkspaceBranch", "addReviewComment", "learnWfcRules", "generateBacktrackingWfc",
        "dependencyAudit", "exportCanonicalWorkspace", "createReviewThread", "replyReviewThread",
        "updateReviewThreadStatus", "setRecoveryPolicy", "setProductionPreferences", "exportProductionHandoff",
        "runWorldRecipe", "triggerWorldRecipes", "setWorldRecipeEnabled", "resetWorldRecipeState", "setWorldState",
        "setWorldClock", "advanceWorldClock", "scheduleWorldRecipe", "cancelWorldSchedule", "addWorldFact",
        "removeWorldFact", "harvestWorldResource", "applyWorldMapVariant", "reloadWorldRecipes"]) {
        assert.ok(PluginManager.commands[`HybridTileGraft:${commandName}`], `missing v10 command ${commandName}`);
    }

    // v8 durable transactions, collaboration records, learned rules, dependency audit, and extensions.
    const transactionBefore = api.getTileId(0, 0, "L1");
    assert.ok(api.beginProjectTransaction("v8 rollback test"));
    api.setTile(0, 0, "L1", 77, true, { mode: "exact" });
    assert.strictEqual(api.getTileId(0, 0, "L1"), 77);
    assert.strictEqual(api.rollbackProjectTransaction(), true);
    assert.strictEqual(api.getTileId(0, 0, "L1"), transactionBefore);
    assert.ok(api.beginProjectTransaction("v8 commit test"));
    assert.ok(api.commitProjectTransaction());
    assert.ok(api.listProjectTransactions().length >= 2);

    const branch = api.createWorkspaceBranch("test-branch", { activate: false });
    assert.ok(branch && api.listWorkspaceBranches().some(item => item.id === branch.id));
    const review = api.addReviewComment("Check the entrance", { mapId: 1, x: 1, y: 1 });
    assert.ok(review && api.listReviewComments({ mapId: 1 }).some(item => item.id === review.id));
    assert.ok(api.updateReviewComment(review.id, { resolved: true }).resolved);
    assert.strictEqual(api.deleteReviewComment(review.id), true);

    const learned = api.learnWfcRulesFromMap({ name: "test rules", layer: "L1", save: true });
    assert.ok(learned.rules.length && api.listWfcRuleSets().some(item => item.id === learned.id));
    assert.ok(api.generateWaveFunctionMapBacktracking({ x: 0, y: 0, width: 2, height: 2, layer: "L4", seed: "v8-wfc", rules: [
        { tileId: 3, weight: 1, allowed: { north: [3, 4], east: [3, 4], south: [3, 4], west: [3, 4] } },
        { tileId: 4, weight: 1, allowed: { north: [3, 4], east: [3, 4], south: [3, 4], west: [3, 4] } }
    ] }));
    const dependencyReport = await api.projectDependencyAudit({ mapIds: [1, 2, 3] });
    assert.strictEqual(dependencyReport.checked, 3);
    assert.ok(api.registerStudioExtension({ id: "test.extension", name: "Test", version: "1.0.0" }));
    assert.strictEqual(api.registerExtensionBrush("test.dot", ({ x, y }) => [{ x, y, tileId: 9, layer: "L1" }]), true);
    assert.ok(api.runExtensionBrush("test.dot", { x: 1, y: 1, save: false }));
    assert.strictEqual(api.getTileId(1, 1, "L1"), 9);
    assert.strictEqual(api.exportCanonicalWorkspace().format, "HybridTileGraftWorkspace");

    // v9 production reviews, diagnostics, recovery policy, and handoff data.
    const thread = api.createReviewThread("Polish the town gate", { mapId: 1, x: 2, y: 2, author: "Lead" });
    assert.ok(thread && api.listReviewThreads({ mapId: 1 }).some(item => item.id === thread.id));
    assert.ok(api.replyReviewThread(thread.id, "Added a second pass", { author: "Mapper" }));
    assert.strictEqual(api.updateReviewThreadStatus(thread.id, "resolved").status, "resolved");
    assert.strictEqual(api.listReviewThreads({ status: "resolved" })[0].replies.length, 1);
    assert.strictEqual(api.setRecoveryPolicy({ retain: 14, snapshotMinutes: 20 }).retain, 14);
    assert.strictEqual(api.productionPreferences({ locale: "ja", highContrast: true, renderBudget: 18000 }).locale, "ja");
    assert.ok(api.recordCompatibilityRun({ profile: "vanilla", ok: true }));
    assert.ok(api.recordAssetAudit({ missing: [], unused: [] }));
    assert.strictEqual(api.exportProductionHandoff().format, "HybridTileGraftProductionHandoff");
    assert.strictEqual(api.deleteReviewThread(thread.id), true);

    // v9.1 World Recipes: declarative automation, dry runs, state, run limits, and map actions.
    const recipeCatalog = {
        format: "HybridWorldRecipes", version: 1, recipes: [{
            id: "test.world-change", name: "Test World Change", enabled: true,
            triggers: [{ type: "manual" }, { type: "switchChange", id: 8 }],
            conditions: { all: [
                { type: "switch", id: 8, value: true },
                { type: "variable", id: 4, operator: ">=", value: 2 }
            ] },
            actions: [
                { type: "setVariable", id: 4, operator: "add", value: 3 },
                { type: "setState", key: "bridge.repaired", value: true },
                { type: "setTile", x: 1, y: 2, layer: "L2", tileId: 88, save: true },
                { type: "setRegion", x: 1, y: 2, regionId: 9, save: true },
                { type: "commonEvent", id: 7 }
            ], once: true
        }]
    };
    assert.strictEqual(api.validateWorldRecipeCatalog(recipeCatalog).ok, true);
    await api.loadWorldRecipeCatalog(recipeCatalog);
    assert.strictEqual(api.listWorldRecipes().length, 1);
    global.$gameSwitches.setValue(8, true); global.$gameVariables.setValue(4, 2);
    const recipeDryRun = await api.runWorldRecipe("test.world-change", { x: 1, y: 2 }, { dryRun: true });
    assert.strictEqual(recipeDryRun.ok, true); assert.strictEqual(global.$gameVariables.value(4), 2, "dry runs must not mutate game state");
    const recipeRun = await api.runWorldRecipe("test.world-change", { x: 1, y: 2 });
    assert.strictEqual(recipeRun.ok, true); assert.strictEqual(global.$gameVariables.value(4), 5);
    assert.strictEqual(api.getWorldState("bridge.repaired"), true); assert.strictEqual(api.getTileId(1, 2, "L2"), 88); assert.strictEqual(api.getTileId(1, 2, "L6"), 9); assert.strictEqual(global.$gameTemp.reserved, 7);
    assert.strictEqual((await api.runWorldRecipe("test.world-change")).reason, "once");
    assert.strictEqual(api.worldRecipeDiagnostics().log[0].recipeId, "test.world-change");
    assert.strictEqual(api.exportWorldRecipePack().recipes.length, 1);
    assert.strictEqual(api.setWorldRecipeEnabled("test.world-change", false), true); assert.strictEqual(api.listWorldRecipes()[0].enabled, false);
    assert.strictEqual(api.resetWorldRecipeState("test.world-change"), true);
    assert.strictEqual(api.registerWorldRecipeCondition("testCondition", () => true), true);
    assert.strictEqual(api.registerWorldRecipeAction("testAction", () => "custom-action-ran"), true);
    assert.ok(api.registerWorldRecipe({ id: "custom.recipe", triggers: ["manual"], conditions: { type: "testCondition" }, actions: [{ type: "testAction" }] }));
    assert.strictEqual((await api.runWorldRecipe("custom.recipe")).results[0], "custom-action-ran");
    assert.strictEqual(api.validateWorldRecipeCatalog({ format: "HybridWorldRecipes", recipes: [{ id: "a", triggers: ["manual"], actions: [{ type: "runRecipe", recipeId: "b" }] }, { id: "b", triggers: ["manual"], actions: [{ type: "runRecipe", recipeId: "a" }] }] }).ok, false);

    // v10 World Director: time, zones, places, resources, schedules, packs, traces, and tests.
    const clock = api.setWorldClock({ day: 2, hour: 6, minuteOfHour: 30, framesPerMinute: 120, daysPerSeason: 2, seasons: ["spring", "winter"] });
    assert.deepStrictEqual([clock.day, clock.hour, clock.minuteOfHour, clock.season], [2, 6, 30, "spring"]);
    assert.strictEqual(api.advanceWorldClock(1440).day, 3); assert.strictEqual(api.worldClock().season, "winter");
    assert.strictEqual(api.addWorldFact("bridge.open", true), true); assert.strictEqual(api.hasWorldFact("bridge.open"), true); assert.strictEqual(api.removeWorldFact("bridge.open"), true);
    api.defineWorldZone({ id: "town.square", mapIds: [1], rect: { x: 1, y: 1, width: 3, height: 2 }, tags: ["town"] });
    assert.strictEqual(api.worldZonesAt(1, 2, 2).map(zone => zone.id).includes("town.square"), true);
    assert.strictEqual(api.worldZonesAt(1, 5, 5).length, 0);
    api.defineWorldEntity({ id: "town", type: "settlement", state: "damaged", tags: ["friendly"] });
    assert.strictEqual(api.updateWorldEntity("town", { state: "repaired" }).state, "repaired");
    api.defineWorldResource({ id: "iron.node", quantity: 2, capacity: 2, respawnMinutes: 10 });
    assert.strictEqual(api.harvestWorldResource("iron.node", 2).taken, 2); assert.strictEqual(api.worldResource("iron.node").quantity, 0);
    api.advanceWorldClock(10); scene.update(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.strictEqual(api.worldResource("iron.node").quantity, 2, "depleted resources must respawn on world time");

    global.$gameVariables.setValue(9, 0);
    api.registerWorldRecipe({ id: "director.test", triggers: ["manual", "scheduled"], conditions: { all: [{ type: "fact", name: "director.ready", value: true }] }, actions: [{ type: "setVariable", id: 9, operator: "add", value: 2 }] });
    api.addWorldFact("director.ready", true);
    const explanation = await api.explainWorldRecipe("director.test", { mapId: 1, x: 2, y: 2 });
    assert.strictEqual(explanation.passes, true); assert.strictEqual(explanation.tree.children[0].type, "fact");
    assert.strictEqual(api.setWorldRecipeBreakpoint("director.test", true), true);
    const pausedRecipe = await api.runWorldRecipe("director.test"); assert.strictEqual(pausedRecipe.paused, true); assert.strictEqual(api.listWorldRecipeBreakpoints()[0].recipeId, "director.test");
    const resumedRecipe = await api.resumeWorldRecipe("director.test"); assert.strictEqual(resumedRecipe.ok, true); assert.strictEqual(global.$gameVariables.value(9), 2);
    api.setWorldRecipeBreakpoint("director.test", false);
    const scheduled = api.scheduleWorldRecipe("director.test", { frames: 1 }); assert.ok(scheduled.id); scene.update(); await new Promise(resolve => setTimeout(resolve, 0)); assert.strictEqual(global.$gameVariables.value(9), 4);
    const scenario = await api.runWorldRecipeScenario({ id: "director-scenario", recipeId: "director.test", initial: { variables: { 9: 10 }, facts: { "director.ready": true } }, expect: [{ type: "variable", id: 9, value: 12 }] });
    assert.strictEqual(scenario.ok, true); assert.strictEqual(global.$gameVariables.value(9), 4, "scenario runs must roll back by default");
    assert.strictEqual((await api.runWorldRecipeTestSuite([{ id: "suite-scenario", recipeId: "director.test", initial: { variables: { 9: 1 }, facts: { "director.ready": true } }, expect: [{ type: "variable", id: 9, value: 3 }] }])).passed, 1);
    assert.ok(api.worldRecipePerformance().some(item => item.recipeId === "director.test"));
    api.defineWorldMapVariant({ id: "town.repaired", mapId: 1, recipeId: "director.test" });
    assert.strictEqual((await api.applyWorldMapVariant("town.repaired")).ok, true); assert.strictEqual(global.$gameVariables.value(9), 6);
    const worldPack = { format: "HybridWorldPack", id: "test.pack", name: "Test Pack", version: "1.2.0", recipes: [{ id: "pack.recipe", triggers: ["manual"], conditions: { type: "always" }, actions: [{ type: "addFact", name: "pack.ran", value: true }] }], zones: [{ id: "pack.zone", mapIds: [1], regions: [9] }], resources: [], entities: [], variants: [], tests: [] };
    assert.strictEqual(api.previewWorldPackInstall(worldPack).ok, true); assert.strictEqual(api.installWorldPack(worldPack).installed, true); assert.ok(api.listWorldPacks().some(pack => pack.id === "test.pack")); assert.strictEqual((await api.runWorldRecipe("pack.recipe")).ok, true); assert.strictEqual(api.hasWorldFact("pack.ran"), true);
    assert.strictEqual(api.exportWorldPack({ id: "export.pack", recipeIds: ["pack.recipe"] }).format, "HybridWorldPack");
    assert.ok(api.worldRecipeDiagnostics().clock); assert.ok(Array.isArray(api.worldRecipeDiagnostics().performance));

    // v11 production platform: NPC lives, simulation, spatial rules, lifecycle packs, graphs, recovery, and budgets.
    api.defineWorldNpc({ id: "ada", name: "Ada", activity: "idle", schedule: [{ id: "ada-work", activity: "working", start: 480, end: 1020, mapId: 1, x: 4, y: 5 }] });
    api.setWorldClock({ day: 4, hour: 9, minuteOfHour: 0 });
    assert.strictEqual(api.worldNpc("ada").activity, "working");
    assert.strictEqual(api.npcScheduledActivity("ada").id, "ada-work");
    const simulatedWorld = api.simulateWorldTimeline({ minutes: 1440, stepMinutes: 60, includeEveryStep: true });
    assert.strictEqual(simulatedWorld.ok, true); assert.ok(simulatedWorld.snapshots.length >= 24);
    assert.ok(api.worldZoneSpatialDiagnostics().buckets > 0);
    api.defineWorldRuleLayer({ id: "encounter.rules", name: "Encounter Rules", mapId: 1, kind: "encounter", cells: {} });
    assert.strictEqual(api.paintWorldRules("encounter.rules", { x: 2, y: 2, width: 2, height: 2 }, "danger").changed, 4);
    assert.strictEqual(api.worldRulesAt(1, 2, 2)[0].value, "danger");
    assert.strictEqual(api.compileWorldRuleLayer("encounter.rules", { recipeId: "encounter.rule.recipe", actions: [{ type: "setState", key: "encounter.active", value: true }] }).ok, true);
    assert.strictEqual((await api.explainWorldRecipe("encounter.rule.recipe", { mapId: 1, x: 2, y: 2 })).passes, true);
    const graph = api.defineBiomeGraph({ id: "world.graph", name: "World Graph", seed: "world", nodes: [{ id: "climate", type: "climate", options: {} }, { id: "roads", type: "road", after: ["climate"], options: {} }] });
    assert.strictEqual(graph.nodes.length, 2); assert.deepStrictEqual(api.previewBiomeGraph("world.graph").order, ["climate", "roads"]);
    assert.strictEqual(api.runtimeBudget({ frameBudgetMs: 6, recipeRunsPerFrame: 4, spatialCellSize: 8 }).recipeRunsPerFrame, 4);
    assert.strictEqual(api.performanceHeatmap(1).mapId, 1); assert.ok(api.optimizeWorldRuntime().spatialIndex.buckets > 0);
    api.addWorldFact("recovery.fact", true); const recovery = api.createRecoverySnapshot("v11 test", { automatic: false }); api.removeWorldFact("recovery.fact"); assert.strictEqual(api.restoreRecoverySnapshot(recovery.id), true); assert.strictEqual(api.hasWorldFact("recovery.fact"), true);
    const compatibility = api.runCompatibilityLab(); assert.strictEqual(compatibility.pluginVersion, "18.1.0"); assert.ok(Array.isArray(compatibility.detected));
    api.registerContentCatalog({ id: "starter.catalog", name: "Starter Catalog", items: [{ id: "graph.item", type: "biome-graph", name: "Graph", graph }] });
    assert.strictEqual(api.searchContentCatalog("graph").length, 1);
    const upgradedPack = { ...worldPack, version: "1.3.0", npcs: [{ id: "pack.npc", name: "Pack NPC", schedule: [] }], ruleLayers: [], biomeGraphs: [] };
    assert.strictEqual(api.installWorldPack(upgradedPack).operation, "upgrade"); assert.strictEqual(api.listWorldPacks().find(pack => pack.id === "test.pack").version, "1.3.0");
    assert.strictEqual(api.rollbackWorldPack("test.pack").rolledBack, true); assert.strictEqual(api.listWorldPacks().find(pack => pack.id === "test.pack").version, "1.2.0");
    assert.strictEqual(api.uninstallWorldPack("test.pack").removed, true); assert.strictEqual(api.listWorldPacks().some(pack => pack.id === "test.pack"), false);
    assert.strictEqual(api.rollbackWorldPack("test.pack").rolledBack, true); assert.strictEqual(api.listWorldPacks().some(pack => pack.id === "test.pack"), true);
    assert.strictEqual(api.worldPackLockfile().format, "HybridWorldPackLock");
    await api.loadWorldRecipeCatalog({
        format: "HybridWorldRecipes", version: 3, recipes: [],
        world: {
            npcs: [{ id: "catalog.npc", name: "Catalog NPC", schedule: [] }],
            ruleLayers: [{ id: "catalog.rules", mapId: 1, cells: { "3,3": "safe" } }],
            biomeGraphs: [{ id: "catalog.graph", nodes: [{ id: "biome", type: "biome", options: {} }] }],
            schedules: [{ id: "catalog.schedule", recipeId: "director.test", dueWorldMinute: 999999, enabled: true }],
            runtimeBudget: { frameBudgetMs: 7, recipeRunsPerFrame: 5, simulationStepsPerFrame: 40, spatialCellSize: 12 }
        },
        packs: [{ id: "catalog.pack", name: "Catalog Pack", version: "2.0.0", capabilities: ["npc-lives"], contents: { npcs: ["catalog.npc"] } }],
        packLock: { format: "HybridWorldPackLock", version: 1, packs: { "catalog.pack": { version: "2.0.0" } } }
    });
    assert.strictEqual(api.worldNpc("catalog.npc").name, "Catalog NPC");
    assert.strictEqual(api.worldRulesAt(1, 3, 3).find(item => item.layerId === "catalog.rules").value, "safe");
    assert.strictEqual(api.previewBiomeGraph("catalog.graph").ok, true);
    assert.ok(api.listWorldSchedules().some(item => item.id === "catalog.schedule"));
    assert.strictEqual(api.runtimeBudget().recipeRunsPerFrame, 5);
    assert.strictEqual(api.listWorldPacks().find(pack => pack.id === "catalog.pack").capabilities[0], "npc-lives");
    assert.strictEqual(api.worldPackLockfile().packs["catalog.pack"].version, "2.0.0");

    // v12 guided-runtime systems: travel, advanced brushes, graph locks/cache, debugger, trust, subscriptions, and project graph.
    const route = api.defineWorldNpcRoute({ id: "ada.route", npcId: "ada", name: "Ada to Market", minutes: 30, points: [{ id: "home", mapId: 1, x: 4, y: 5 }, { id: "market", mapId: 1, x: 10, y: 5 }] });
    assert.strictEqual(route.points.length, 2); assert.strictEqual(api.previewNpcJourney("ada.route", { steps: 3 }).samples.length, 4);
    assert.strictEqual(api.startNpcJourney("ada.route").status, "travelling"); api.advanceWorldClock(15); const journeyHalf = api.advanceNpcJourneys()[0]; assert.ok(journeyHalf.progress >= .5); api.advanceWorldClock(15); api.advanceNpcJourneys(); assert.strictEqual(api.worldNpc("ada").activity, "arrived"); assert.strictEqual(api.worldNpcOccupancy().length, 0);
    const brush = api.saveWorldRuleBrush({ id: "soft.encounter", name: "Soft Encounter", shape: "circle", size: 5, hardness: .5, falloff: "smooth", value: "danger" }); assert.strictEqual(brush.shape, "circle");
    const brushPaint = api.paintWorldRuleBrush("encounter.rules", { x: 8, y: 8 }, "soft.encounter"); assert.ok(brushPaint.changed > 1); assert.ok(api.ruleLayerStatistics("encounter.rules").weightedCells > 0); assert.ok(api.filterWorldRuleLayer("encounter.rules", { minimumWeight: .5 }).length > 0);
    assert.strictEqual(api.lockBiomeCells("world.graph", 1, [{ x: 1, y: 1 }]).cells["1,1"].reason, "Protected by author"); assert.strictEqual(api.listBiomeLocks({ graphId: "world.graph" })[0].cellCount, 1);
    api.cacheBiomeStage("world.graph", 1, "climate", "seed", { ok: true }, { density: .5 }); assert.strictEqual(api.biomeStageCache("world.graph", 1, "climate", "seed", { density: .5 }).result.ok, true); assert.strictEqual(api.clearBiomeCache({ graphId: "world.graph" }), 1);
    api.setWorldRecipeWatch({ id: "watch.ready", type: "fact", key: "director.ready" }); assert.strictEqual(api.listWorldRecipeWatches()[0].value, true); const stepped = await api.stepWorldRecipe("director.test", 0, {}, { execute: false }); assert.strictEqual(stepped.planned, true); assert.ok(api.worldRecipeDebugSnapshot().history.length > 0);
    api.registerPackPublisher({ id: "test.publisher", name: "Test Publisher", fingerprint: "TEST-KEY", trusted: true }); const trustedPack = { ...worldPack, id: "trusted.pack", version: "1.0.0" }; trustedPack.integrity = { publisherId: "test.publisher", fingerprint: "TEST-KEY", algorithm: "fnv1a-32", digest: api.packIntegrityDigest(trustedPack, "fnv1a32") }; const verification = api.verifyWorldPackSignature(trustedPack, { requireTrusted: true }); assert.strictEqual(verification.ok, true); assert.strictEqual(verification.trusted, true);
    const shaPack = { ...worldPack, id: "sha.pack", version: "1.0.0" };
    const shaDigest = api.packIntegrityDigest(shaPack);
    assert.match(shaDigest, /^sha256-[0-9a-f]{64}$/);
    shaPack.integrity = { publisherId: "test.publisher", fingerprint: "TEST-KEY", algorithm: "sha256", digest: shaDigest };
    const shaVerification = api.verifyWorldPackSignature(shaPack, { requireTrusted: true });
    assert.strictEqual(shaVerification.ok, true); assert.strictEqual(shaVerification.verified, true);
    shaPack.metadata = { tampered: true };
    assert.strictEqual(api.verifyWorldPackSignature(shaPack, { requireTrusted: true }).ok, false);

    const canonicalize = value => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonicalize(value[key])])) : value;
    const keyPair = await nodeCrypto.webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const publicKeyBytes = new Uint8Array(await nodeCrypto.webcrypto.subtle.exportKey("raw", keyPair.publicKey));
    const keyId = `sha256-${nodeCrypto.createHash("sha256").update(publicKeyBytes).digest("hex")}`;
    api.registerPackPublisher({ id: "signed.publisher", name: "Signed Publisher", fingerprint: keyId, trusted: true });
    const signedPack = { ...worldPack, id: "signed.pack", version: "1.0.0", metadata: { purpose: "integration" } };
    const signedPayload = new TextEncoder().encode(JSON.stringify(canonicalize(signedPack)));
    const signatureBytes = new Uint8Array(await nodeCrypto.webcrypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, signedPayload));
    signedPack.integrity = {
        publisherId: "signed.publisher", algorithm: "ed25519", canonicalizationVersion: 1,
        digest: api.packIntegrityDigest(signedPack), keyId,
        publicKey: Buffer.from(publicKeyBytes).toString("base64"),
        signature: Buffer.from(signatureBytes).toString("base64")
    };
    const signedVerification = await api.verifyWorldPackSignatureAsync(signedPack, { requireTrusted: true });
    assert.strictEqual(signedVerification.ok, true); assert.strictEqual(signedVerification.signatureValid, true); assert.strictEqual(signedVerification.keyFingerprint, keyId);
    const installedSignedPack = await api.installWorldPackAsync(signedPack, { requireTrusted: true });
    assert.strictEqual(installedSignedPack.installed, true); assert.strictEqual(installedSignedPack.integrity.signatureValid, true);
    const tamperedSignedPack = clone(signedPack); tamperedSignedPack.metadata.purpose = "tampered";
    assert.strictEqual((await api.verifyWorldPackSignatureAsync(tamperedSignedPack, { requireTrusted: true })).ok, false);
    api.subscribeContentCatalog({ id: "starter.subscription", catalogId: "starter.catalog", installedVersion: 0, source: "local" }); assert.strictEqual(api.checkCatalogUpdates()[0].updateAvailable, true); assert.strictEqual(api.listCatalogSubscriptions().length, 1);
    const referenceGraph = api.worldReferenceGraph(); assert.ok(referenceGraph.nodes.some(node => node.key === "route:ada.route")); assert.ok(referenceGraph.edges.some(edge => edge.relation === "moves")); const benchmark = api.runWorldBenchmark({ iterations: 2, mapId: 1 }); assert.strictEqual(benchmark.samples.length, 4); assert.ok(api.listWorldBenchmarks().length > 0);

    // v13 Worldstudio services: atlases, logic graphs, repair, history, dependencies, extensions, NPC direction, and production validation.
    const atlas = await api.analyzeWorldAtlas({ mapIds: [1, 2, 3], id: "test.atlas" }); assert.strictEqual(atlas.nodes.length, 3); assert.ok(Array.isArray(atlas.edges)); assert.strictEqual(api.listWorldAtlases()[0].id, "test.atlas");
    const questGraph = await api.analyzeEventQuestGraph({ mapIds: [1], id: "test.quest-graph" }); assert.ok(questGraph.nodes.some(node => node.type === "event")); assert.strictEqual(api.listEventQuestGraphs()[0].id, "test.quest-graph");
    const damagedMap = clone(global.$dataMap); damagedMap.events[1].x = damagedMap.width + 2; const repairPreview = api.repairMapIntelligently({ snapshot: damagedMap, mapId: 1, apply: false }); assert.ok(repairPreview.repairs.some(item => item.type === "move-event"));
    const historyBefore = await api.createVisualHistorySnapshot("Before v13 edit", 1, { id: "history.before" }); api.setTile(2, 2, "L1", 99, true); const historyAfter = await api.createVisualHistorySnapshot("After v13 edit", 1, { id: "history.after" }); const historyDiff = api.diffVisualHistory(historyBefore.id, historyAfter.id); assert.strictEqual(historyDiff.ok, true); assert.ok(historyDiff.tileChangeCount > 0);
    const dependencyPlan = api.resolvePackDependencies([{ id: "world.main", range: "^1.0.0" }], [{ id: "world.base", name: "Base", version: "1.2.0", dependencies: [] }, { id: "world.main", name: "Main", version: "1.1.0", dependencies: [{ id: "world.base", range: "~1.2.0" }] }]); assert.strictEqual(dependencyPlan.ok, true); assert.deepStrictEqual(dependencyPlan.installOrder, ["world.base", "world.main"]);
    const extension = api.installExtensionManifest({ id: "test.worldstudio", name: "Worldstudio Test", version: "1.0.0", permissions: ["map:read", "project:validate"], contributes: { validators: [{ id: "test.validator" }] } }, { permissions: ["map:read"] }); assert.strictEqual(extension.id, "test.worldstudio"); assert.deepStrictEqual(api.createExtensionContext("test.worldstudio").permissions, ["map:read"]);
    const npcDirection = api.simulateNpcDirector({ durationMinutes: 60, stepMinutes: 15 }); assert.ok(npcDirection.frames.length >= 4); assert.ok(Array.isArray(npcDirection.conflicts));
    const golden = await api.runGoldenMapTest({ mapId: 1 }); assert.strictEqual(golden.checksumMatch, true); const production = await api.runProductionValidation({ mapIds: [1] }); assert.ok(Array.isArray(production.mapReports)); const deployment = await api.createProjectDeploymentReport({ validation: { id: "test.validation", ok: true, errors: 0, warnings: 0, mapReports: [] } }); assert.strictEqual(deployment.ready, true);

    // v14 Live Production: deterministic recordings, semantic maps, sandboxed extensions, unified content, collaboration, and release artifacts.
    const live = api.startLiveProductionSession({ id: "live.test", label: "Automated test", bridge: false, watchedSwitches: [1], watchedVariables: [1] }); assert.strictEqual(live.session.id, "live.test"); assert.strictEqual(live.bridge, null);
    const startedRecording = api.startPlaytestRecording({ id: "recording.test", name: "Golden path" }); assert.strictEqual(startedRecording.status, "recording");
    global.$gameSwitches.setValue(1, true); global.$gameVariables.setValue(1, 42); api.recordPlaytestAction("interaction", { eventId: 1 });
    const recording = api.stopPlaytestRecording(); assert.strictEqual(recording.status, "complete"); assert.ok(recording.events.some(event => event.type === "interaction")); assert.match(recording.checksum, /^fnv1a-/);
    const recordedScenario = api.createScenarioFromRecording(recording.id, { id: "scenario.test" }); assert.strictEqual(recordedScenario.format, "HybridPlaytestScenario"); const scenarioRun = await api.runRecordedScenario(recordedScenario.id, { execute: false }); assert.strictEqual(scenarioRun.passed, true);
    assert.strictEqual(api.validateEventCommandList([{ code: 111, indent: 0, parameters: [] }, { code: 412, indent: 0, parameters: [] }, { code: 0, indent: 0, parameters: [] }]).ok, true);
    assert.strictEqual(api.validateEventCommandList([{ code: 101, indent: 0, parameters: [] }]).ok, false);
    api.defineSemanticTileset({ id: "test-semantics", tilesetId: 1, labels: { 0: ["floor"], 2048: ["water"] }, ranges: [{ from: 3000, to: 3010, labels: ["wall"], passable: false }] });
    assert.deepStrictEqual(api.semanticTile(2048, 1).labels, ["water"]); const semantic = api.analyzeSemanticMap(global.$dataMap, { mapId: 1 }); assert.strictEqual(semantic.format, "HybridSemanticMapReport"); assert.ok(semantic.reachableCells > 0);
    const sandbox = api.configureExtensionSandbox("test.worldstudio", { timeBudgetMs: 100, memoryBudgetKb: 256 }); assert.strictEqual(sandbox.quarantined, false); assert.strictEqual(sandbox.isolation, "same-process-budget"); assert.strictEqual(sandbox.securityBoundary, false); assert.strictEqual(api.extensionSandboxState("test.worldstudio").length, 1);
    assert.strictEqual(api.runBudgetedExtensionContribution, api.runSandboxedExtensionContribution, "the explicit reliability-budget alias must remain available");
    const unified = api.searchUnifiedContent("graph"); assert.ok(unified.some(item => item.type === "biome-graph")); const collection = api.createContentCollection({ id: "test.collection", name: "Test collection", itemIds: unified.slice(0, 1).map(item => item.id) }); assert.strictEqual(collection.id, "test.collection");
    const collaboration = api.createCollaborationBundle({ id: "review.test", mapIds: [1], notes: "Ready for review" }); assert.strictEqual(collaboration.format, "HybridCollaborationBundle"); assert.match(collaboration.fingerprint, /^fnv1a-/);
    const releaseFingerprint = api.createReleaseFingerprint({ id: "release.test", mapIds: [1] }); assert.strictEqual(releaseFingerprint.pluginVersion, "18.1.0"); assert.match(releaseFingerprint.fingerprint, /^fnv1a-/);
    const cleanBundle = api.buildCleanProductionBundle({ mapIds: [1] }); assert.strictEqual(cleanBundle.format, "HybridCleanProductionBundle"); assert.strictEqual(cleanBundle.pluginVersion, "18.1.0");
    const stoppedLive = api.stopLiveProductionSession({ reason: "test-complete" }); assert.strictEqual(stoppedLive.status, "stopped"); assert.strictEqual(api.liveProductionState().session, null);
    for (const commandName of ["startLiveProductionSession", "stopLiveProductionSession", "startPlaytestRecording", "stopPlaytestRecording", "createScenarioFromRecording", "runRecordedScenario", "defineSemanticTileset", "analyzeSemanticMap", "configureExtensionSandbox", "runSandboxedExtensionContribution", "createContentCollection", "createCollaborationBundle", "createReleaseFingerprint", "buildCleanProductionBundle"]) assert.ok(PluginManager.commands[`HybridTileGraft:${commandName}`], `missing v14 command ${commandName}`);

    // v15 Creator Console services: Live Production 2.0, journeys, recovery, intelligence, security, collaboration, compatibility, and release manifests.
    const liveV15 = api.startLiveProductionSession({ id: "live.v15", bridge: false });
    assert.strictEqual(liveV15.session.protocolVersion, 2);
    const handshake = api.negotiateLiveProduction({ clientId: "integration-test", protocolVersion: 2 });
    assert.strictEqual(handshake.ok, true); assert.strictEqual(handshake.protocolVersion, 2); assert.ok(handshake.capabilities.includes("journey-replay"));
    const journey = await api.runPlaytestJourney(recordedScenario, { id: "journey.v15", execute: false });
    assert.strictEqual(journey.passed, true); assert.strictEqual(journey.pluginVersion, "18.1.0"); assert.ok(api.listPlaytestJourneyRuns().some(item => item.id === "journey.v15"));
    const productionSuite = await api.runProductionTestSuite({ id: "suite.v15", scenarioIds: [recordedScenario.id], execute: false, includeGoldenMaps: false });
    assert.strictEqual(productionSuite.passed, true); assert.ok(api.listProductionTestRuns().some(item => item.id === "suite.v15"));

    api.addWorldFact("v15.recovery.fact", true);
    const recoveryV15 = api.createUniversalRecoveryPoint("v15 integration point", { id: "recovery.v15", retain: 5 });
    assert.strictEqual(recoveryV15.format, "HybridUniversalRecoveryPoint");
    api.removeWorldFact("v15.recovery.fact"); assert.strictEqual(api.restoreUniversalRecoveryPoint(recoveryV15.id), true); assert.strictEqual(api.hasWorldFact("v15.recovery.fact"), true);
    assert.ok(api.listUniversalRecoveryPoints().some(item => item.id === recoveryV15.id));

    const projectReferences = api.searchProjectReferences("director.test", { limit: 100 });
    assert.ok(projectReferences.length > 0);
    const renamePlan = api.planReferenceRename("director.test", "director.renamed", { id: "rename.v15", exact: false });
    assert.strictEqual(renamePlan.applySupported, false); assert.ok(renamePlan.count > 0);
    const passability = api.analyzePassabilityMap(global.$dataMap, { mapId: 1 });
    assert.strictEqual(passability.format, "HybridPassabilityReport"); assert.strictEqual(passability.width, global.$dataMap.width);
    const softlocks = api.detectMapSoftlocks(global.$dataMap, { mapId: 1 });
    assert.strictEqual(softlocks.format, "HybridSoftlockReport"); assert.ok(Array.isArray(softlocks.issues));
    const performanceV15 = api.performanceCenterReport({ snapshot: global.$dataMap });
    assert.strictEqual(performanceV15.format, "HybridPerformanceCenterReport"); assert.ok(performanceV15.score >= 0);

    api.registerExtensionPublisher({ id: "test.publisher", name: "Test Publisher", fingerprint: "PUB-15", trusted: true });
    const securityV15 = api.configureExtensionSecurityProfile("test.worldstudio", { isolation: "worker", publisherId: "test.publisher", network: false, fileRead: ["data/*.json"], timeBudgetMs: 50, payloadBudgetKb: 512 });
    assert.strictEqual(securityV15.isolation, "worker"); assert.strictEqual(securityV15.network, false);
    const publisherV15 = api.verifyExtensionPublisher("test.worldstudio"); assert.strictEqual(publisherV15.ok, true); assert.strictEqual(publisherV15.trusted, true);
    assert.ok(api.listExtensionSecurityProfiles().some(item => item.extensionId === "test.worldstudio"));

    const reviewA = api.createCollaborationBundle({ id: "review.v15.a", mapIds: [1], notes: "Before" });
    const reviewB = api.createCollaborationBundle({ id: "review.v15.b", mapIds: [1, 2], notes: "After" });
    const collaborationV15 = api.compareCollaborationBundles(reviewA.id, reviewB.id); assert.strictEqual(collaborationV15.changed, true);
    const mergePlanV15 = api.createCollaborationMergePlan(reviewA.id, reviewB.id, { id: "merge.v15" }); assert.strictEqual(mergePlanV15.applySupported, false);

    api.registerCompatibilityProfileV15({ id: "hybrid.self", name: "Hybrid public API", checks: [{ id: "api", type: "global", path: "window.HybridTileGraft" }] });
    const compatibilityV15 = api.runCompatibilityProfilesV15(); assert.strictEqual(compatibilityV15.passed, true); assert.ok(api.listCompatibilityProfilesV15().some(item => item.id === "hybrid.self"));
    const releaseA = api.createReleaseFingerprint({ id: "release.v15.a", channel: "preview", mapIds: [1] });
    const releaseB = api.createReleaseFingerprint({ id: "release.v15.b", channel: "stable", mapIds: [1, 2] });
    const releaseComparisonV15 = api.compareReleaseFingerprints(releaseA.id, releaseB.id); assert.strictEqual(releaseComparisonV15.identical, false);
    const releaseManifestV15 = api.createReleaseManifestV15({ id: "manifest.v15", fingerprint: releaseB.id, channel: "stable" });
    assert.strictEqual(releaseManifestV15.format, "HybridReleaseManifest"); assert.match(releaseManifestV15.manifestHash, /^fnv1a-/);
    api.stopLiveProductionSession({ reason: "v15-tests-complete" });
    const productionHandoffV15 = await api.validateProductionHandoff({ id: "handoff.v15", mapIds: [1], scenarioIds: [recordedScenario.id] });
    assert.strictEqual(productionHandoffV15.format, "HybridProductionHandoff"); assert.strictEqual(productionHandoffV15.liveStopped, true);
    for (const commandName of ["negotiateLiveProduction", "cleanLiveProductionArtifacts", "runPlaytestJourney", "runProductionTestSuite", "createUniversalRecoveryPoint", "restoreUniversalRecoveryPoint", "searchProjectReferences", "planReferenceRename", "analyzePassabilityMap", "detectMapSoftlocks", "performanceCenterReport", "configureExtensionSecurityProfile", "registerExtensionPublisher", "verifyExtensionPublisher", "compareCollaborationBundles", "createCollaborationMergePlan", "registerCompatibilityProfileV15", "runCompatibilityProfilesV15", "compareReleaseFingerprints", "createReleaseManifestV15", "validateProductionHandoff"]) assert.ok(PluginManager.commands[`HybridTileGraft:${commandName}`], `missing v15 command ${commandName}`);
    // v16 Worldsmith: visual drafts, recipe graphs, round-trip safety, story tools, test labs, content, merges, policies, and dashboards.
    const visualDraft = api.createVisualMapDraft({ id: "draft.v16", map: global.$dataMap, mapId: 1, name: "Integration draft" });
    assert.strictEqual(visualDraft.format, "HybridVisualMapDraft");
    const paintedDraft = api.paintVisualMapDraft(visualDraft.id, [{ tool: "rectangle", x: 0, y: 0, width: 2, height: 2, layer: 0, tileId: 77 }]);
    assert.ok(paintedDraft.changed > 0); assert.ok(paintedDraft.totalChanges > 0);
    assert.strictEqual(api.undoVisualMapDraft(visualDraft.id), true);
    const visualPreview = api.commitVisualMapDraft(visualDraft.id, { apply: false }); assert.strictEqual(visualPreview.previewOnly, true);

    const recipeGraphV16 = api.compileWorldRecipeGraph({ id: "graph.v16", name: "Integration world", seed: "v16", nodes: [{ id: "terrain", type: "terrain" }, { id: "roads", type: "roads" }, { id: "validate", type: "validate" }], edges: [{ from: "terrain", to: "roads" }, { from: "roads", to: "validate" }] });
    assert.strictEqual(recipeGraphV16.valid, true); assert.deepStrictEqual(recipeGraphV16.order, ["terrain", "roads", "validate"]);
    assert.deepStrictEqual(api.lockWorldRecipeGraphCells(recipeGraphV16.id, ["1,1", "2,1"]), ["1,1", "2,1"]);
    const regenerationV16 = api.regenerateWorldRecipeGraph(recipeGraphV16.id, { seed: "test-seed" }); assert.strictEqual(regenerationV16.stages.length, 3); assert.strictEqual(regenerationV16.previewOnly, true);

    const changedMapV16 = JSON.parse(JSON.stringify(global.$dataMap)); changedMapV16.data[0] = 88;
    const roundTripV16 = api.createRoundTripPlan(global.$dataMap, changedMapV16, { id: "roundtrip.v16", mapId: 1 });
    assert.strictEqual(roundTripV16.safe, true); assert.strictEqual(roundTripV16.diff.tileChanges, 1);
    const questV16 = api.createQuestProject({ id: "quest.v16", name: "Integration quest", nodes: [{ id: "start", type: "start", title: "Start" }, { id: "complete", type: "complete", title: "Complete" }], edges: [{ from: "start", to: "complete" }] });
    assert.strictEqual(questV16.valid, true); assert.deepStrictEqual(questV16.unreachable, []);
    const timelineV16 = api.createCutsceneTimeline({ id: "scene.v16", cues: [{ id: "camera", at: 0, duration: 2, track: "camera", type: "focus" }, { id: "dialogue", at: 2, duration: 3, track: "dialogue", type: "message" }] });
    assert.strictEqual(timelineV16.duration, 5); assert.deepStrictEqual(timelineV16.tracks, ["camera", "dialogue"]);
    const labV16 = await api.runPlaytestLab({ id: "lab.v16", map: global.$dataMap, scenarioIds: [recordedScenario.id], includeGoldenMaps: false }); assert.strictEqual(labV16.format, "HybridPlaytestLabRun");
    const bugV16 = api.createBugReportBundle({ id: "bug.v16", title: "Integration issue", expected: "A", actual: "B" }); assert.match(bugV16.fingerprint, /^fnv1a-/);
    assert.strictEqual(api.setCreatorExperienceV16({ mode: "expert", sound: false }).mode, "expert");
    const contentV16 = api.registerContentLibraryItem({ id: "content.v16", name: "Test room", type: "room", tags: ["test"], payload: { width: 4, height: 4 } }); assert.strictEqual(contentV16.type, "room"); assert.strictEqual(api.searchContentLibraryV16("test").length, 1);
    const mergeV16 = api.createThreeWayProjectMerge({ value: 1 }, { value: 2 }, { value: 3 }, { id: "merge.v16" }); assert.strictEqual(mergeV16.conflicts.length, 1); assert.strictEqual(mergeV16.resolved, false);
    const sourceV16 = api.createSourceControlSnapshot({ id: "source.v16", mapIds: [1] }); assert.strictEqual(sourceV16.format, "HybridSourceControlSnapshot");
    const policyV16 = api.setExtensionCapabilityPolicyV16("test.worldstudio", { capabilities: ["map:read", "map:write", "unknown"], isolation: "worker" }); assert.deepStrictEqual(policyV16.denied, ["unknown"]);
    assert.strictEqual(api.safeModeV16({ enabled: true, maximumWrites: 500 }).maximumWrites, 500);
    const dashboardV16 = await api.productionDashboardV16({ id: "dashboard.v16", runTests: false, snapshot: global.$dataMap, mapIds: [1] }); assert.strictEqual(dashboardV16.format, "HybridProductionDashboard"); assert.ok(dashboardV16.score >= 0);
    for (const commandName of ["createVisualMapDraft", "paintVisualMapDraft", "undoVisualMapDraft", "commitVisualMapDraft", "compileWorldRecipeGraph", "lockWorldRecipeGraphCells", "regenerateWorldRecipeGraph", "createRoundTripPlan", "createQuestProject", "createCutsceneTimeline", "runPlaytestLab", "createBugReportBundle", "setCreatorExperienceV16", "registerContentLibraryItem", "searchContentLibraryV16", "createThreeWayProjectMerge", "createSourceControlSnapshot", "setExtensionCapabilityPolicyV16", "safeModeV16", "productionDashboardV16"]) assert.ok(PluginManager.commands[`HybridTileGraft:${commandName}`], `missing v16 command ${commandName}`);
    assert.strictEqual(Object.keys(PluginManager.commands).length, 196);

    // Visual remote-map editing, including normal-event duplication and spawned-event movement/deletion.
    api.resetMap(3, true);
    assert.strictEqual(await api.openRemoteMapEditor("Remote Yard", {
        x: 0, y: 0, layer: "L1", tileId: 44, mode: "exact", tool: "paint", persist: true
    }), true);
    assert.strictEqual(api.runtimeEditorState().remoteMapId, 3);
    assert.strictEqual(scene._hybridRemoteTilemap.visible, true);
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    api.closeRuntimeEditor(true);
    assert.strictEqual(scene._hybridRemoteTilemap.visible, false);
    remote = await api.preloadMap(3);
    assert.strictEqual(remote.data[tileIndex(remote, 0, 0, 0)], 44);

    assert.strictEqual(await api.openRemoteMapEditor(3, {
        x: 1, y: 1, layer: "L1", tileId: 0, mode: "exact", tool: "event", persist: true
    }), true);
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    assert.strictEqual(api.runtimeEditorState().selectedEventId, 1);
    global.Input._repeated = new Set(["right", "down"]);
    scene.update();
    global.Input.clear();
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    api.closeRuntimeEditor(true);
    remote = await api.preloadMap(3);
    let remoteSpawn = remote.events.find(event => event && event._hybridTileGraftSpawn);
    assert.ok(remoteSpawn && remoteSpawn.x === 2 && remoteSpawn.y === 2, "remote editor must duplicate a normal event as a spawned event");

    assert.strictEqual(await api.openRemoteMapEditor(3, {
        x: 2, y: 2, layer: "L1", tileId: 0, mode: "exact", tool: "event", persist: true
    }), true);
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    global.Input._repeated = new Set(["right"]);
    scene.update();
    global.Input.clear();
    global.Input.trigger("ok");
    scene.update();
    global.Input.clear();
    api.closeRuntimeEditor(true);
    remote = await api.preloadMap(3);
    remoteSpawn = remote.events.find(event => event && event._hybridTileGraftSpawn);
    assert.ok(remoteSpawn && remoteSpawn.x === 3 && remoteSpawn.y === 2, "remote editor must move spawned events");

    assert.strictEqual(await api.openRemoteMapEditor(3, {
        x: 3, y: 2, layer: "L1", tileId: 0, mode: "exact", tool: "event", persist: true
    }), true);
    scene._hybridEditorCommand._handlers.deleteEvent();
    api.closeRuntimeEditor(true);
    remote = await api.preloadMap(3);
    assert.strictEqual(remote.events.some(event => event && event._hybridTileGraftSpawn), false,
        "remote editor must delete spawned events");

    // Bake to an isolated temporary file to verify export without touching project data.
    const bakeSpawnId = api.duplicateEvent(1, 4, 4, true);
    const bakeTarget = `/tmp/HybridTileGraft-v9-${process.pid}-${Date.now()}.json`;
    const bakeResult = await api.bakeMapToFile(1, { path: bakeTarget, clearHistory: false, makeEventsPermanent: true });
    assert.strictEqual(bakeResult.target, bakeTarget);
    const baked = JSON.parse(fs.readFileSync(bakeTarget, "utf8"));
    assert.strictEqual(baked.data[tileIndex(baked, 5, 5, 0)], 55);
    const permanentBakeId = bakeResult.bakedEventIds[bakeSpawnId];
    assert.ok(permanentBakeId >= 2);
    assert.strictEqual(baked.events[permanentBakeId].id, permanentBakeId, "baked spawned events must be densely renumbered");
    assert.strictEqual(baked.events[permanentBakeId]._hybridTileGraftSpawn, undefined);
    assert.strictEqual(baked.events.filter(Boolean).length, baked.events.length - 1, "baked event array must not contain ID gaps");
    fs.unlinkSync(bakeTarget);

    await api.preloadChildMaps("ChildMap", false);

    console.log("HybridTileGraft v18 mock integration tests passed.");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
