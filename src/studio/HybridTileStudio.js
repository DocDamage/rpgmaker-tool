/*:
 * Hybrid Tile Studio v18.1.0 core
 * Standalone companion editor for HybridTileGraft.js and RPG Maker MZ.
 * No external dependencies. Chromium/NW.js is recommended for direct project saves.
 */
(() => {
    "use strict";

    const VERSION = "18.1.0";
    const TILE_SIZE = 48;
    const MAX_HISTORY = 100;
    const WORKSPACE_FILE = "HybridTileStudio.workspace.json";
    const JOURNAL_FILE = "HybridTileStudio.journal.json";
    const BACKUP_RETENTION = 10;
    const storage = globalThis.HybridTileStorageV18 || null;
    const $ = id => document.getElementById(id);
    const deepClone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const download = (name, text, type = "application/json") => {
        const url = URL.createObjectURL(new Blob([text], { type }));
        const anchor = Object.assign(document.createElement("a"), { href: url, download: name });
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const readJsonFile = async file => {
        if (file.size > 64 * 1024 * 1024) throw new Error(`${file.name} is larger than the 64 MB safety limit.`);
        return JSON.parse(await file.text());
    };
    const mapFileName = id => `Map${String(integer(id)).padStart(3, "0")}.json`;
    const seedHash = text => {
        let hash = 2166136261;
        for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        return hash >>> 0;
    };
    const seededRandom = seed => {
        let value = seedHash(seed) || 1;
        return () => {
            value += 0x6D2B79F5;
            let next = value;
            next = Math.imul(next ^ next >>> 15, next | 1);
            next ^= next + Math.imul(next ^ next >>> 7, next | 61);
            return ((next ^ next >>> 14) >>> 0) / 4294967296;
        };
    };

    // RPG Maker MZ autotile quadrant tables. Each entry maps one exact shape
    // ID to four source quadrants in the selected A1-A4 sheet.
    const FLOOR_AUTOTILE_TABLE = [
        [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],[[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
        [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],[[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
        [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],[[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
        [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],[[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
        [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],[[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
        [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],[[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
        [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],[[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
        [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],[[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
        [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],[[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
        [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],[[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
        [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],[[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
        [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],[[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]]
    ];
    const WALL_AUTOTILE_TABLE = [
        [[2,2],[1,2],[2,1],[1,1]],[[0,2],[1,2],[0,1],[1,1]],[[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
        [[2,2],[3,2],[2,1],[3,1]],[[0,2],[3,2],[0,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
        [[2,2],[1,2],[2,3],[1,3]],[[0,2],[1,2],[0,3],[1,3]],[[2,0],[1,0],[2,3],[1,3]],[[0,0],[1,0],[0,3],[1,3]],
        [[2,2],[3,2],[2,3],[3,3]],[[0,2],[3,2],[0,3],[3,3]],[[2,0],[3,0],[2,3],[3,3]],[[0,0],[3,0],[0,3],[3,3]]
    ];
    const WATERFALL_AUTOTILE_TABLE = [
        [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]]
    ];

    const state = {
        projectHandle: null,
        dataHandle: null,
        imageHandle: null,
        projectName: "Loose maps",
        mapInfos: [],
        tilesets: [],
        documents: new Map(),
        mapHandles: new Map(),
        tabs: [],
        activeId: null,
        tool: "select",
        tileLayer: 0,
        tileId: 0,
        brushSize: 1,
        zoom: 1,
        panX: 18,
        panY: 18,
        grid: true,
        overlay: "none",
        selection: null,
        selectedEventId: 0,
        pointer: null,
        spacePan: false,
        tileLayerVisibility: [true, true, true, true, true, true],
        tileLayerOpacity: [1, 1, 1, 1, 1, 1],
        tilesetImages: new Map(),
        paletteSheet: "B",
        preview: null,
        diff: null,
        job: null,
        autosaveTimer: 0,
        snapshots: [],
        bookmarks: [],
        toastTimer: 0,
        animationFrame: 0,
        selectionCells: null,
        projectClipboard: null,
        extensions: new Map(),
        brushes: new Map(),
        generators: new Map(),
        validators: new Map(),
        recoveryJournal: null,
        branches: [],
        reviewComments: [],
        activeBranchId: "main",
        selectedReviewId: null,
        selectedEventPage: 0,
        selectedEventCommand: 0,
        transferPick: null,
        learnedWfcRules: null
        ,extensionData: {}
        ,recoveryPolicy: { retain: 10, snapshotMinutes: 0 }
        ,locale: "en"
        ,renderSettings: { adaptive: true, maxTilesPerFrame: 12000, reducedMotion: false, highContrast: false }
    };

    const canvas = $("mapCanvas");
    const context = canvas.getContext("2d", { alpha: false });
    const minimap = $("minimapCanvas");
    const minimapContext = minimap.getContext("2d");

    function activeDocument() { return state.documents.get(state.activeId) || null; }
    function activeLayer(document = activeDocument()) {
        return document?.authoringLayers.find(layer => layer.id === document.activeLayerId) || null;
    }
    function setStatus(message, error = false) {
        $("statusText").textContent = message;
        $("statusText").classList.toggle("error", error);
    }
    function markDirty(document = activeDocument()) {
        if (!document) return;
        document.dirty = true;
        updateChrome();
        if ($("autosaveToggle").checked) {
            clearTimeout(state.autosaveTimer);
            state.autosaveTimer = setTimeout(() => saveDocument(document).catch(reportError), 1500);
        }
    }
    function reportError(error) {
        console.error(error);
        setStatus(error?.message || String(error), true);
    }
    function layerColor(index) { return ["#58a6ff", "#56d364", "#d2a8ff", "#ffa657", "#f778ba", "#79c0ff"][index % 6]; }

    function createDocument(id, name, map, fileHandle = null, fileName = "") {
        if (!map || !Number.isFinite(map.width) || !Number.isFinite(map.height) || !Array.isArray(map.data)) {
            throw new Error(`${fileName || name} is not a valid RPG Maker map.`);
        }
        const base = deepClone(map);
        const layer = { id: uid("layer"), name: "Main edits", visible: true, locked: false, opacity: 1, color: layerColor(0), changes: new Map(), eventChanges: new Map() };
        return {
            id: integer(id), name: name || `Map ${id}`, fileName: fileName || mapFileName(id), fileHandle,
            baseMap: base, authoringLayers: [layer], activeLayerId: layer.id, modifiers: [], masks: [],
            undo: [], redo: [], dirty: false, revision: 0, savedRevision: 0, validation: null
        };
    }

    function normalizedMapData(map) {
        const size = Math.max(0, integer(map.width) * integer(map.height) * 6);
        const data = new Array(size).fill(0);
        for (let index = 0; index < Math.min(size, map.data?.length || 0); index++) data[index] = integer(map.data[index]);
        return data;
    }

    function composeMap(document = activeDocument()) {
        if (!document) return null;
        const result = deepClone(document.baseMap);
        result.data = normalizedMapData(result);
        result.events = deepClone(result.events || []);
        for (const layer of document.authoringLayers) {
            if (!layer.visible) continue;
            for (const [index, value] of layer.changes) if (index >= 0 && index < result.data.length) result.data[index] = value;
            for (const [eventId, value] of layer.eventChanges || []) result.events[eventId] = value === null ? null : deepClone(value);
        }
        return result;
    }

    function tileIndex(map, x, y, z) { return (z * map.height + y) * map.width + x; }
    function inMap(map, x, y) { return x >= 0 && y >= 0 && x < map.width && y < map.height; }
    function tileAt(map, x, y, z) { return inMap(map, x, y) ? integer(map.data[tileIndex(map, x, y, z)]) : 0; }

    function snapshotLayer(layer) {
        return { changes: [...layer.changes], eventChanges: [...(layer.eventChanges || new Map())].map(([id, value]) => [id, deepClone(value)]) };
    }
    function restoreLayer(layer, snapshot) {
        layer.changes = new Map(snapshot.changes || []);
        layer.eventChanges = new Map((snapshot.eventChanges || []).map(([id, value]) => [integer(id), deepClone(value)]));
    }
    function beginAction(label, document = activeDocument()) {
        const layer = activeLayer(document);
        if (!document || !layer || layer.locked) return null;
        return { label, layerId: layer.id, before: snapshotLayer(layer), at: Date.now() };
    }
    function commitAction(action, document = activeDocument()) {
        if (!action || !document) return false;
        const layer = document.authoringLayers.find(item => item.id === action.layerId);
        if (!layer) return false;
        const after = snapshotLayer(layer);
        if (JSON.stringify(action.before) === JSON.stringify(after)) return false;
        document.undo.push({ ...action, after });
        if (document.undo.length > MAX_HISTORY) document.undo.shift();
        document.redo.length = 0;
        document.revision++;
        markDirty(document);
        renderEverything();
        return true;
    }
    function undo() {
        const document = activeDocument();
        const action = document?.undo.pop();
        if (!action) return;
        const layer = document.authoringLayers.find(item => item.id === action.layerId);
        if (!layer) return;
        restoreLayer(layer, action.before);
        document.redo.push(action);
        document.revision++;
        markDirty(document);
        renderEverything();
    }
    function redo() {
        const document = activeDocument();
        const action = document?.redo.pop();
        if (!action) return;
        const layer = document.authoringLayers.find(item => item.id === action.layerId);
        if (!layer) return;
        restoreLayer(layer, action.after);
        document.undo.push(action);
        document.revision++;
        markDirty(document);
        renderEverything();
    }

    async function getDirectory(parent, name, create = false) { return parent.getDirectoryHandle(name, { create }); }
    function nativeDirectoryHandle(root, relative = "") {
        const bridge = window.hybridTileNative; const clean = value => String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""); const join = (...parts) => parts.map(clean).filter(Boolean).join("/");
        return {
            kind: "directory", name: relative ? clean(relative).split("/").at(-1) : String(root).replace(/\\/g, "/").split("/").at(-1), path: relative ? `${root}/${clean(relative)}` : root, root, relative,
            async getDirectoryHandle(name, options = {}) { const next = join(relative, name); if (options.create) await bridge.mkdir(root, next); else { const info = await bridge.stat(root, next); if (!info.directory) throw new Error(`${next} is not a directory.`); } return nativeDirectoryHandle(root, next); },
            async *entries() { for (const [name, kind] of await bridge.list(root, relative)) yield [name, kind === "directory" ? nativeDirectoryHandle(root, join(relative, name)) : await this.getFileHandle(name)]; },
            async removeEntry(name, options = {}) { return bridge.remove(root, join(relative, name), !!options.recursive); },
            async getFileHandle(name, options = {}) { const next = join(relative, name); if (options.create) { try { await bridge.stat(root, next); } catch (_) { await bridge.writeText(root, next, ""); } } else { const info = await bridge.stat(root, next); if (!info.file) throw new Error(`${next} is not a file.`); }
                return { kind: "file", name: clean(name), path: `${root}/${next}`, root, relative: next,
                    async getFile() { const info = await bridge.stat(root, next); const extension = String(name).split(".").at(-1).toLowerCase(); if (["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) { const base64 = await bridge.readBase64(root, next); const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0)); const blob = new Blob([bytes], { type: extension === "jpg" ? "image/jpeg" : `image/${extension}` }); Object.defineProperty(blob, "name", { value: clean(name) }); return blob; } return { name: clean(name), size: info.size, text: () => bridge.readText(root, next) }; },
                    async createWritable() { let buffer = ""; return { async write(value) { buffer = typeof value === "string" ? value : String(value); }, async close() { await bridge.writeText(root, next, buffer); } }; }
                };
            }
        };
    }
    async function readHandleJson(handle) {
        const file = await handle.getFile();
        return readJsonFile(file);
    }
    async function projectHandleAt(relativePath, kind = "file", create = false) {
        if (!state.projectHandle) throw new Error("Open a project directory first.");
        const parts = String(relativePath || "").replace(/\\/g, "/").split("/").filter(part => part && part !== ".");
        if (parts.some(part => part === "..")) throw new Error("Project paths cannot contain '..'.");
        let handle = state.projectHandle;
        for (let index = 0; index < parts.length - (kind === "directory" ? 0 : 1); index++) handle = await handle.getDirectoryHandle(parts[index], { create });
        if (kind === "directory") return handle;
        return handle.getFileHandle(parts.at(-1), { create });
    }
    async function readProjectText(relativePath) { const file = await (await projectHandleAt(relativePath)).getFile(); return file.text(); }
    async function readProjectJson(relativePath) { return JSON.parse(await readProjectText(relativePath)); }
    async function writeProjectText(relativePath, text) { const handle = await projectHandleAt(relativePath, "file", true); const writable = await handle.createWritable(); await writable.write(String(text)); await writable.close(); return true; }
    async function writeProjectJson(relativePath, value, canonical = false) { return writeProjectText(relativePath, canonical ? `${JSON.stringify(canonicalize(value), null, 2)}\n` : JSON.stringify(value)); }
    async function projectFileUrl(relativePath, mimeType = "application/octet-stream") { const file = await (await projectHandleAt(relativePath)).getFile(); const blob = file instanceof Blob ? file : new Blob([await file.text()], { type: mimeType }); return URL.createObjectURL(blob); }
    async function projectEntryExists(relativePath) { try { await projectHandleAt(relativePath); return true; } catch (_) { return false; } }
    async function listProjectDirectory(relativePath = "") {
        const handle = await projectHandleAt(relativePath, "directory"); const values = [];
        if (!handle.entries) return values;
        for await (const [name, child] of handle.entries()) values.push({ name, kind: child.kind, path: [String(relativePath).replace(/\/$/, ""), name].filter(Boolean).join("/") });
        return values.sort((a, b) => a.name.localeCompare(b.name));
    }
    async function renameProjectEntry(fromPath, toPath) {
        if (!state.projectHandle) throw new Error("Open a project directory first.");
        if (window.hybridTileNative?.rename && state.projectHandle.root) return window.hybridTileNative.rename(state.projectHandle.root, fromPath, toPath);
        const source = await projectHandleAt(fromPath); const targetParts = String(toPath).replace(/\\/g, "/").split("/"); const targetName = targetParts.pop(); const targetDirectory = await projectHandleAt(targetParts.join("/"), "directory", true);
        if (source.move) { await source.move(targetDirectory, targetName); return true; }
        throw new Error("Safe asset renaming requires the packaged desktop app or a browser with FileSystemHandle.move().");
    }
    async function removeProjectEntry(relativePath, recursive = false) { const parts = String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean); if (!parts.length || parts.some(part => part === "..")) throw new Error("Choose a specific project entry to remove."); const name = parts.pop(); const directory = await projectHandleAt(parts.join("/"), "directory"); if (!directory.removeEntry) throw new Error("This environment cannot remove project entries."); await directory.removeEntry(name, { recursive: !!recursive }); return true; }
    async function openProjectHandle(handle) {
        if (!handle || handle.kind !== "directory") throw new Error("Choose an RPG Maker project directory.");
        const dirty = [...state.documents.values()].filter(document => document.dirty);
        if (dirty.length && !window.confirm(`${dirty.length} open map${dirty.length === 1 ? " has" : "s have"} unsaved changes. Open another project and leave those edits behind?`)) return false;
        const data = await getDirectory(handle, "data");
        const [mapInfos, tilesets] = await Promise.all([
            readHandleJson(await data.getFileHandle("MapInfos.json")),
            readHandleJson(await data.getFileHandle("Tilesets.json")).catch(() => [])
        ]);
        state.projectHandle = handle;
        state.dataHandle = data;
        state.imageHandle = await getDirectory(await getDirectory(handle, "img"), "tilesets").catch(() => null);
        state.projectName = handle.name;
        state.mapInfos = Array.isArray(mapInfos) ? mapInfos : [];
        state.tilesets = Array.isArray(tilesets) ? tilesets : [];
        state.mapHandles.clear(); state.documents.clear(); state.tabs.length = 0; state.activeId = null;
        await loadWorkspaceMetadata(); await loadRecoveryJournal(); renderMapTree(); updateChrome(); setStatus(`Opened ${handle.name}. Select a map to edit.`);
        document.dispatchEvent(new CustomEvent("HybridTileStudio:project-opened", { detail: { name: handle.name } }));
        return true;
    }
    async function openProject() {
        if (window.hybridTileNative?.chooseProjectPath) { const path = await window.hybridTileNative.chooseProjectPath(); if (path) return openProjectHandle(nativeDirectoryHandle(path)); return false; }
        if (!window.showDirectoryPicker) {
            $("mapFileInput").click();
            setStatus("Direct project access needs Chromium/NW.js; choose map files instead.");
            return;
        }
        const handle = await window.showDirectoryPicker({ mode: "readwrite" });
        return openProjectHandle(handle);
    }
    async function openNativeProject(path) { if (!window.hybridTileNative?.openRecentProject) throw new Error("Recent projects require the packaged desktop app."); const root = await window.hybridTileNative.openRecentProject(path); return root ? openProjectHandle(nativeDirectoryHandle(root)) : false; }
    async function launchPlaytest(options = {}) { if (!window.hybridTileNative?.launchPlaytest || !state.projectHandle?.root) throw new Error("Playtest launching requires the packaged desktop app and an open project."); return window.hybridTileNative.launchPlaytest(state.projectHandle.root, options); }

    async function openMapByInfo(id) {
        id = integer(id);
        if (state.documents.has(id)) return activateDocument(id);
        if (!state.dataHandle) return;
        const handle = await state.dataHandle.getFileHandle(mapFileName(id));
        const map = await readHandleJson(handle);
        const info = state.mapInfos[id];
        const document = createDocument(id, info?.name || `Map ${id}`, map, handle, mapFileName(id));
        state.mapHandles.set(id, handle);
        restoreDocumentMetadata(document);
        state.documents.set(id, document);
        activateDocument(id);
    }

    async function openLooseFiles(files) {
        for (const file of files) {
            try {
                const map = await readJsonFile(file);
                const match = file.name.match(/Map(\d+)\.json/i);
                let id = match ? integer(match[1]) : Math.max(1, ...state.documents.keys(), 0) + 1;
                while (state.documents.has(id)) id++;
                const document = createDocument(id, file.name.replace(/\.json$/i, ""), map, null, file.name);
                state.documents.set(id, document);
                if (!state.mapInfos[id]) state.mapInfos[id] = { id, name: document.name, order: id, parentId: 0 };
                activateDocument(id);
            } catch (error) { reportError(error); }
        }
        renderMapTree();
        updateChrome();
    }

    async function refreshProjectMaps() {
        if (!state.dataHandle) return;
        state.mapInfos = await readHandleJson(await state.dataHandle.getFileHandle("MapInfos.json"));
        state.tilesets = await readHandleJson(await state.dataHandle.getFileHandle("Tilesets.json")).catch(() => state.tilesets);
        renderEverything();
        setStatus("Project map list refreshed.");
    }

    function activateDocument(id) {
        id = integer(id);
        if (!state.documents.has(id)) return openMapByInfo(id).catch(reportError);
        state.activeId = id;
        if (!state.tabs.includes(id)) state.tabs.push(id);
        state.selection = null;
        state.selectionCells = null;
        state.selectedEventId = 0;
        state.preview = null;
        state.diff = null;
        loadTilesetImages(activeDocument()).finally(() => { renderPalette(); renderEverything(); });
        renderEverything();
    }

    async function closeDocument(id) {
        const document = state.documents.get(id);
        if (document?.dirty) {
            const answer = await openTextDialog("Close unsaved map", "Type CLOSE to discard this map's unsaved authoring layers. Saving first is safer.", "Confirmation", "");
            if (answer !== "CLOSE") return;
        }
        state.tabs = state.tabs.filter(value => value !== id);
        state.documents.delete(id);
        if (state.activeId === id) state.activeId = state.tabs.at(-1) ?? null;
        renderEverything();
    }

    async function writeJson(handle, value) {
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(value));
        await writable.close();
    }
    function checksum(value) {
        const text = typeof value === "string" ? value : JSON.stringify(value); let hash = 2166136261;
        for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(16).padStart(8, "0");
    }
    function browserRecordKey(kind) { return `core:${kind}:${state.projectName || "loose"}`; }
    async function browserRecordPut(kind, value) { if (storage) return storage.put(browserRecordKey(kind), value, { kind, project: state.projectName }); return false; }
    async function browserRecordGet(kind) { return storage ? storage.get(browserRecordKey(kind), null) : null; }
    async function browserRecordRemove(kind) { return storage ? storage.remove(browserRecordKey(kind)) : false; }
    async function writeRecoveryJournal(journal) {
        state.recoveryJournal = journal;
        let projectSaved = false;
        if (state.dataHandle) {
            await writeJson(await state.dataHandle.getFileHandle(JOURNAL_FILE, { create: true }), journal);
            projectSaved = true;
        }
        await browserRecordPut("journal", journal).catch(() => false);
        renderJournalReport();
        return { projectSaved, browserSaved: !!storage };
    }
    async function loadRecoveryJournal() {
        let journal = null;
        if (state.dataHandle) try { journal = await readHandleJson(await state.dataHandle.getFileHandle(JOURNAL_FILE)); } catch (_) { /* optional */ }
        if (!journal) journal = await browserRecordGet("journal").catch(() => null);
        if (!journal) {
            // One-way migration from legacy localStorage; large records are removed after import.
            try { journal = JSON.parse(localStorage.getItem(`htg-journal:${state.projectName}`)); localStorage.removeItem(`htg-journal:${state.projectName}`); } catch (_) { /* optional */ }
            if (journal) await browserRecordPut("journal", journal).catch(() => false);
        }
        state.recoveryJournal = journal?.format === "HybridTileStudioJournal" && journal.status !== "committed" ? journal : null;
        renderJournalReport();
    }
    async function clearRecoveryJournal(journal) {
        state.recoveryJournal = null;
        await browserRecordRemove("journal").catch(() => false);
        try { localStorage.removeItem(`htg-journal:${state.projectName}`); } catch (_) { /* optional legacy cleanup */ }
        if (state.dataHandle) await writeJson(await state.dataHandle.getFileHandle(JOURNAL_FILE, { create: true }), { format: "HybridTileStudioJournal", version: 1, id: journal?.id || "", status: "committed", resolvedAt: Date.now() });
        renderJournalReport();
    }
    function renderJournalReport() {
        const target = $("journalReport"); if (!target) return; const journal = state.recoveryJournal;
        target.className = `report padded ${journal ? "warning" : "empty-state"}`;
        target.innerHTML = journal ? `<strong>Pending transaction ${escapeHtml(journal.id)}</strong><p>${escapeHtml(journal.status)} · ${journal.completed?.length || 0}/${journal.targets?.length || 0} map(s) written</p><small>Started ${new Date(journal.startedAt).toLocaleString()}</small>` : "No pending recovery journal.";
        $("recoverJournalButton").disabled = !journal || !state.dataHandle; $("rollbackJournalButton").disabled = !journal || !state.dataHandle;
    }
    async function backupDocument(document) {
        if (!state.dataHandle || !document.fileHandle) return;
        const directory = await getDirectory(state.dataHandle, "htg-backups", true);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const handle = await directory.getFileHandle(`${document.fileName.replace(/\.json$/i, "")}-${stamp}.json`, { create: true });
        await writeJson(handle, document.baseMap);
    }
    async function saveDocument(document = activeDocument()) {
        if (!document) return;
        const output = composeMap(document);
        if (document.fileHandle) {
            await backupDocument(document);
            await writeJson(document.fileHandle, output);
        } else {
            download(document.fileName || mapFileName(document.id), JSON.stringify(output));
        }
        document.baseMap = deepClone(output);
        for (const layer of document.authoringLayers) { layer.changes.clear(); layer.eventChanges.clear(); }
        document.undo.length = 0;
        document.redo.length = 0;
        document.dirty = false;
        document.savedRevision = document.revision;
        await saveWorkspaceMetadata();
        renderEverything();
        setStatus(`Saved ${document.fileName}. A timestamped backup was kept when direct project access was available.`);
    }
    async function saveAll() {
        return saveAllAtomic();
    }
    async function createTransactionBackups(journal) {
        if (!state.dataHandle) return;
        const root = await getDirectory(state.dataHandle, "htg-backups", true); const directory = await getDirectory(root, journal.id, true);
        for (const target of journal.targets) await writeJson(await directory.getFileHandle(target.fileName, { create: true }), target.before);
        journal.backupDirectory = `data/htg-backups/${journal.id}`;
        if (root.entries && root.removeEntry) {
            const transactions = []; for await (const [name, handle] of root.entries()) if (handle.kind === "directory" && /^tx-/.test(name)) transactions.push(name);
            transactions.sort().reverse(); for (const name of transactions.slice(Math.max(1, integer(state.recoveryPolicy?.retain, BACKUP_RETENTION)))) await root.removeEntry(name, { recursive: true });
        }
    }
    async function saveAllAtomic() {
        const dirty = [...state.documents.values()].filter(document => document.dirty);
        if (!dirty.length) { setStatus("No unsaved maps."); return { ok: true, saved: [] }; }
        if (!state.dataHandle || dirty.some(document => !document.fileHandle)) {
            for (const document of dirty) await saveDocument(document);
            return { ok: true, saved: dirty.map(document => document.id), downloaded: true };
        }
        const journal = { format: "HybridTileStudioJournal", version: 1, id: `tx-${new Date().toISOString().replace(/[:.]/g, "-")}`, status: "preparing", startedAt: Date.now(), completed: [], targets: dirty.map(document => { const after = composeMap(document); return { mapId: document.id, fileName: document.fileName, beforeChecksum: checksum(document.baseMap), afterChecksum: checksum(after), before: deepClone(document.baseMap), after }; }) };
        await writeRecoveryJournal(journal); await createTransactionBackups(journal); journal.status = "prepared"; await writeRecoveryJournal(journal);
        try {
            for (const target of journal.targets) {
                const document = state.documents.get(target.mapId); await writeJson(document.fileHandle, target.after); journal.completed.push(target.mapId); journal.status = "writing"; await writeRecoveryJournal(journal);
            }
            for (const target of journal.targets) {
                const document = state.documents.get(target.mapId); document.baseMap = deepClone(target.after); for (const layer of document.authoringLayers) { layer.changes.clear(); layer.eventChanges.clear(); } document.undo.length = 0; document.redo.length = 0; document.dirty = false; document.savedRevision = document.revision;
            }
            journal.status = "committed"; journal.committedAt = Date.now(); await writeRecoveryJournal(journal); await clearRecoveryJournal(journal); await saveWorkspaceMetadata(); renderEverything(); setStatus(`Committed ${journal.targets.length} map(s) with a recoverable transaction.`); return { ok: true, transactionId: journal.id, saved: journal.completed };
        } catch (error) { journal.status = "interrupted"; journal.error = error.message; await writeRecoveryJournal(journal); throw new Error(`Save transaction interrupted after ${journal.completed.length} map(s). Use Recover or Roll back. ${error.message}`); }
    }
    async function resolveRecoveryJournal(mode = "recover") {
        const journal = state.recoveryJournal; if (!journal || !state.dataHandle) return false; const useAfter = mode === "recover";
        journal.status = useAfter ? "recovering" : "rolling-back"; await writeRecoveryJournal(journal);
        for (const target of journal.targets || []) {
            const handle = await state.dataHandle.getFileHandle(target.fileName); await writeJson(handle, useAfter ? target.after : target.before);
            const document = state.documents.get(integer(target.mapId)); if (document) { document.baseMap = deepClone(useAfter ? target.after : target.before); for (const layer of document.authoringLayers) { layer.changes.clear(); layer.eventChanges.clear(); } document.dirty = false; }
        }
        journal.status = "committed"; journal.resolvedAs = mode; journal.resolvedAt = Date.now(); await writeRecoveryJournal(journal); await clearRecoveryJournal(journal); renderEverything(); setStatus(useAfter ? "Interrupted transaction recovered." : "Interrupted transaction rolled back from its journal."); return true;
    }

    function serializeLayer(layer) {
        return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, opacity: layer.opacity,
            color: layer.color, changes: [...layer.changes], eventChanges: [...layer.eventChanges] };
    }
    function retainedSnapshots(values = state.snapshots) {
        const groups = new Map();
        for (const snapshot of values || []) {
            const key = integer(snapshot.mapId);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(snapshot);
        }
        return [...groups.values()].flatMap(group => group.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0, 12)).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
    }
    function retainedBranches(values = state.branches) {
        const current = state.activeBranchId || "main";
        const sorted = [...(values || [])].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
        const keep = sorted.slice(0, 30);
        const active = sorted.find(item => item.id === current);
        if (active && !keep.includes(active)) keep.push(active);
        return keep.sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
    }
    function workspaceMetadata() {
        state.snapshots = retainedSnapshots();
        state.branches = retainedBranches();
        state.reviewComments = [...(state.reviewComments || [])].sort((a,b)=>Number(b.createdAt||b.at||0)-Number(a.createdAt||a.at||0)).slice(0, 200).sort((a,b)=>Number(a.createdAt||a.at||0)-Number(b.createdAt||b.at||0));
        return {
            format: "HybridTileStudioWorkspace", version: 4, pluginVersion: VERSION,
            savedAt: new Date().toISOString(), bookmarks: state.bookmarks, snapshots: state.snapshots, branches: state.branches, activeBranchId: state.activeBranchId || "main", reviewComments: state.reviewComments, learnedWfcRules: state.learnedWfcRules, extensionData: state.extensionData, recoveryPolicy: state.recoveryPolicy, locale: state.locale, renderSettings: state.renderSettings,
            documents: [...state.documents.values()].map(document => ({ id: document.id, activeLayerId: document.activeLayerId,
                authoringLayers: document.authoringLayers.map(serializeLayer), modifiers: document.modifiers, masks: document.masks }))
        };
    }
    async function saveWorkspaceMetadata() {
        const metadata = workspaceMetadata();
        if (state.dataHandle) {
            const handle = await state.dataHandle.getFileHandle(WORKSPACE_FILE, { create: true });
            await writeJson(handle, metadata);
        }
        await browserRecordPut("workspace", metadata).catch(() => false);
    }
    async function loadWorkspaceMetadata() {
        let metadata = null;
        if (state.dataHandle) {
            try { metadata = await readHandleJson(await state.dataHandle.getFileHandle(WORKSPACE_FILE)); } catch (_) { /* optional */ }
        }
        if (!metadata) metadata = await browserRecordGet("workspace").catch(() => null);
        if (!metadata) {
            try { metadata = JSON.parse(localStorage.getItem(`htg-studio:${state.projectName}`)); localStorage.removeItem(`htg-studio:${state.projectName}`); } catch (_) { /* optional */ }
            if (metadata) await browserRecordPut("workspace", metadata).catch(() => false);
        }
        state.workspaceMetadata = metadata?.format === "HybridTileStudioWorkspace" ? metadata : null;
        state.bookmarks = deepClone(state.workspaceMetadata?.bookmarks || []);
        state.snapshots = deepClone(state.workspaceMetadata?.snapshots || []);
        state.branches = deepClone(state.workspaceMetadata?.branches || []); state.activeBranchId = state.workspaceMetadata?.activeBranchId || "main"; state.reviewComments = deepClone(state.workspaceMetadata?.reviewComments || []); state.learnedWfcRules = deepClone(state.workspaceMetadata?.learnedWfcRules || null); state.extensionData = deepClone(state.workspaceMetadata?.extensionData || {}); state.recoveryPolicy = { retain: 10, snapshotMinutes: 0, ...(state.workspaceMetadata?.recoveryPolicy || {}) }; state.locale = state.workspaceMetadata?.locale || "en"; state.renderSettings = { ...state.renderSettings, ...(state.workspaceMetadata?.renderSettings || {}) };
    }
    function restoreDocumentMetadata(document) {
        const saved = state.workspaceMetadata?.documents?.find(item => integer(item.id) === document.id);
        if (!saved) return;
        document.authoringLayers = (saved.authoringLayers || []).map((layer, index) => ({
            id: layer.id || uid("layer"), name: layer.name || `Layer ${index + 1}`, visible: layer.visible !== false,
            locked: !!layer.locked, opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
            color: layer.color || layerColor(index), changes: new Map(layer.changes || []), eventChanges: new Map(layer.eventChanges || [])
        }));
        if (!document.authoringLayers.length) document.authoringLayers.push({ id: uid("layer"), name: "Main edits", visible: true, locked: false, opacity: 1, color: layerColor(0), changes: new Map(), eventChanges: new Map() });
        document.activeLayerId = document.authoringLayers.some(layer => layer.id === saved.activeLayerId) ? saved.activeLayerId : document.authoringLayers[0].id;
        document.modifiers = deepClone(saved.modifiers || []);
        document.masks = deepClone(saved.masks || []);
        document.dirty = document.authoringLayers.some(layer => layer.changes.size || layer.eventChanges.size);
    }

    async function exportWorkspace() { download(`HybridTileStudio-${state.projectName}.json`, JSON.stringify(workspaceMetadata(), null, 2)); }
    async function importWorkspaceFile(file) {
        const data = await readJsonFile(file);
        if (data.format === "HybridTileStudioWorkspace") {
            state.workspaceMetadata = data;
            state.bookmarks = deepClone(data.bookmarks || []);
            state.snapshots = deepClone(data.snapshots || []);
            state.branches = deepClone(data.branches || []); state.activeBranchId = data.activeBranchId || "main"; state.reviewComments = deepClone(data.reviewComments || []); state.learnedWfcRules = deepClone(data.learnedWfcRules || null); state.extensionData = deepClone(data.extensionData || {}); state.recoveryPolicy = { retain: 10, snapshotMinutes: 0, ...(data.recoveryPolicy || {}) }; state.locale = data.locale || "en"; state.renderSettings = { ...state.renderSettings, ...(data.renderSettings || {}) };
            for (const document of state.documents.values()) restoreDocumentMetadata(document);
        } else if (data.format === "HybridTileGraftWorkspace" || data.patchPack) {
            importPluginWorkspace(data);
        } else throw new Error("Unsupported workspace format.");
        renderEverything();
    }
    function importPluginWorkspace(bundle) {
        const pack = bundle.patchPack || bundle;
        const maps = pack.maps || pack.store?.maps || {};
        for (const [mapId, patches] of Object.entries(maps)) {
            const document = state.documents.get(integer(mapId));
            if (!document) continue;
            const layer = activeLayer(document);
            for (const patch of patches || []) applyPluginPatchToLayer(document, layer, patch);
            markDirty(document);
        }
    }
    function applyPluginPatchToLayer(document, layer, patch) {
        if (!patch) return;
        if (patch.kind === "batch") return (patch.patches || []).forEach(child => applyPluginPatchToLayer(document, layer, child));
        const map = composeMap(document);
        if (patch.kind === "sparse") {
            for (const cell of patch.cells || []) for (const [key, value] of Object.entries(cell.tiles || {})) {
                const z = clamp(integer(String(key).replace(/\D/g, "")) - 1, 0, 5);
                if (inMap(map, cell.x, cell.y)) layer.changes.set(tileIndex(map, cell.x, cell.y, z), integer(value));
            }
        } else if (patch.rect && patch.tiles) {
            for (const [key, values] of Object.entries(patch.tiles)) {
                const z = clamp(integer(String(key).replace(/\D/g, "")) - 1, 0, 5);
                for (let y = 0; y < patch.rect.h; y++) for (let x = 0; x < patch.rect.w; x++) {
                    if (inMap(map, patch.rect.x + x, patch.rect.y + y)) layer.changes.set(tileIndex(map, patch.rect.x + x, patch.rect.y + y, z), integer(values[y * patch.rect.w + x]));
                }
            }
        }
    }

    async function loadTilesetImages(document) {
        state.tilesetImages.clear();
        const tileset = state.tilesets[document?.baseMap.tilesetId];
        if (!tileset?.tilesetNames || !state.imageHandle) return;
        await Promise.all(tileset.tilesetNames.map(async (name, index) => {
            if (!name) return;
            try {
                const file = await (await state.imageHandle.getFileHandle(`${name}.png`)).getFile();
                const image = new Image();
                const url = URL.createObjectURL(file);
                await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
                state.tilesetImages.set(index, { image, url });
            } catch (_) { /* missing sheet */ }
        }));
    }

    function resizeCanvas() {
        const rect = $("canvasStage").getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { width: rect.width, height: rect.height, dpr };
    }
    function tileScreenSize() { return TILE_SIZE * state.zoom; }
    function screenToMap(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const size = tileScreenSize();
        return { x: Math.floor((clientX - rect.left - state.panX) / size), y: Math.floor((clientY - rect.top - state.panY) / size) };
    }
    function mapToScreen(x, y) { const size = tileScreenSize(); return { x: state.panX + x * size, y: state.panY + y * size }; }

    function tileSource(tileId) {
        tileId = integer(tileId);
        if (tileId >= 0 && tileId < 1024) {
            const sheet = 5 + Math.floor(tileId / 256);
            return { sheet, sx: ((Math.floor(tileId / 128) % 2) * 8 + tileId % 8) * 48,
                sy: (Math.floor((tileId % 256) / 8) % 16) * 48, sw: 48, sh: 48 };
        }
        if (tileId >= 1536 && tileId < 1664) {
            return { sheet: 4, sx: ((Math.floor(tileId / 128) % 2) * 8 + tileId % 8) * 48,
                sy: (Math.floor((tileId % 256) / 8) % 16) * 48, sw: 48, sh: 48 };
        }
        return null;
    }

    function autotileLayout(tileId) {
        if (tileId < 2048 || tileId >= 8192) return null;
        const kind = Math.floor((tileId - 2048) / 48); const shape = (tileId - 2048) % 48;
        const tx = kind % 8; const ty = Math.floor(kind / 8); let sheet = 0; let bx = 0; let by = 0;
        let table = FLOOR_AUTOTILE_TABLE; let isTable = false;
        if (tileId < 2816) {
            const waterFrame = [0, 1, 2, 1][state.animationFrame % 4]; sheet = 0;
            if (kind === 0) { bx = waterFrame * 2; by = 0; }
            else if (kind === 1) { bx = waterFrame * 2; by = 3; }
            else if (kind === 2) { bx = 6; by = 0; }
            else if (kind === 3) { bx = 6; by = 3; }
            else {
                bx = Math.floor(tx / 4) * 8; by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
                if (kind % 2 === 0) bx += waterFrame * 2;
                else { bx += 6; by += state.animationFrame % 3; table = WATERFALL_AUTOTILE_TABLE; }
            }
        } else if (tileId < 4352) {
            sheet = 1; bx = tx * 2; by = (ty - 2) * 3;
            const flags = state.tilesets[activeDocument()?.baseMap.tilesetId]?.flags || [];
            isTable = !!(flags[tileId] & 0x80);
        } else if (tileId < 5888) {
            sheet = 2; bx = tx * 2; by = (ty - 6) * 2; table = WALL_AUTOTILE_TABLE;
        } else {
            sheet = 3; bx = tx * 2; by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? .5 : 0));
            if (ty % 2 === 1) table = WALL_AUTOTILE_TABLE;
        }
        return { sheet, bx, by, table, shape: shape % table.length, isTable };
    }

    function drawAutotile(target, tileId, dx, dy, size, alpha) {
        const layout = autotileLayout(tileId); const entry = layout && state.tilesetImages.get(layout.sheet);
        if (!layout || !entry) return false;
        const table = layout.table[layout.shape]; const sourceQuarter = TILE_SIZE / 2; const targetQuarter = size / 2;
        target.save(); target.globalAlpha = alpha; target.imageSmoothingEnabled = false;
        for (let index = 0; index < 4; index++) {
            const [qsx, qsy] = table[index]; const sx = (layout.bx * 2 + qsx) * sourceQuarter; const sy = (layout.by * 2 + qsy) * sourceQuarter;
            const tx = dx + index % 2 * targetQuarter; const ty = dy + Math.floor(index / 2) * targetQuarter;
            if (layout.isTable && (qsy === 1 || qsy === 5)) {
                const qsx2 = qsy === 1 ? (4 - qsx) % 4 : qsx; const sx2 = (layout.bx * 2 + qsx2) * sourceQuarter;
                const sy2 = (layout.by * 2 + 3) * sourceQuarter;
                target.drawImage(entry.image, sx2, sy2, sourceQuarter, sourceQuarter, tx, ty, targetQuarter, targetQuarter);
                target.drawImage(entry.image, sx, sy, sourceQuarter, sourceQuarter / 2, tx, ty + targetQuarter / 2, targetQuarter, targetQuarter / 2);
            } else target.drawImage(entry.image, sx, sy, sourceQuarter, sourceQuarter, tx, ty, targetQuarter, targetQuarter);
        }
        target.restore(); return true;
    }

    function drawTile(target, tileId, dx, dy, size, alpha = 1) {
        if (!tileId) return;
        if (tileId >= 2048 && drawAutotile(target, tileId, dx, dy, size, alpha)) return;
        const source = tileSource(tileId);
        const entry = source && state.tilesetImages.get(source.sheet);
        target.save();
        target.globalAlpha = alpha;
        if (entry) {
            target.imageSmoothingEnabled = false;
            target.drawImage(entry.image, source.sx, source.sy, source.sw, source.sh, dx, dy, size, size);
        } else {
            const hue = (integer(tileId) * 47) % 360;
            target.fillStyle = `hsl(${hue} 28% 24%)`;
            target.fillRect(dx, dy, size, size);
            if (size >= 20) { target.fillStyle = "#ffffffbb"; target.font = `${Math.max(8, size * .18)}px monospace`; target.fillText(String(tileId), dx + 2, dy + Math.max(10, size * .3)); }
        }
        target.restore();
    }

    function renderCanvas() {
        const viewport = resizeCanvas();
        context.fillStyle = "#090c11";
        context.fillRect(0, 0, viewport.width, viewport.height);
        const document = activeDocument();
        $("canvasEmpty").classList.toggle("hidden", !!document);
        if (!document) return;
        const map = composeMap(document);
        const size = tileScreenSize();
        const x0 = clamp(Math.floor(-state.panX / size), 0, map.width);
        const y0 = clamp(Math.floor(-state.panY / size), 0, map.height);
        const x1 = clamp(Math.ceil((viewport.width - state.panX) / size), 0, map.width);
        const y1 = clamp(Math.ceil((viewport.height - state.panY) / size), 0, map.height);
        const renderBudget = Math.max(1000, integer(state.renderSettings?.maxTilesPerFrame, 12000)); let exactDraws = 0; let approximatedDraws = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const point = mapToScreen(x, y);
            for (let z = 0; z < 4; z++) if (state.tileLayerVisibility[z]) { const tile = tileAt(map, x, y, z); if (!tile) continue; if (!state.renderSettings?.adaptive || exactDraws < renderBudget || size >= 12) { drawTile(context, tile, point.x, point.y, size, state.tileLayerOpacity[z]); exactDraws++; } else { context.globalAlpha = state.tileLayerOpacity[z]; context.fillStyle = `hsl(${tile * 47 % 360} 30% 32%)`; context.fillRect(point.x, point.y, Math.ceil(size), Math.ceil(size)); context.globalAlpha = 1; approximatedDraws++; } }
            if ((state.overlay === "shadow" || state.tileLayerVisibility[4]) && tileAt(map, x, y, 4)) {
                context.fillStyle = `rgba(0,0,0,${.1 + tileAt(map, x, y, 4) / 30 * state.tileLayerOpacity[4]})`;
                context.fillRect(point.x, point.y, size, size);
            }
            if ((state.overlay === "region" || state.tileLayerVisibility[5]) && tileAt(map, x, y, 5)) {
                context.fillStyle = "#0009"; context.fillRect(point.x, point.y, size * .45, size * .35);
                context.fillStyle = "#ffdf72"; context.font = `${Math.max(8, size * .22)}px monospace`; context.fillText(String(tileAt(map, x, y, 5)), point.x + 2, point.y + size * .26);
            }
        }
        canvas.dataset.renderMode = approximatedDraws ? "adaptive" : "exact"; canvas.title = approximatedDraws ? `Adaptive preview: ${approximatedDraws} distant tile draws simplified. Zoom in for exact rendering.` : "Exact RPG Maker MZ tile rendering";
        if (state.preview?.changes) {
            context.save(); context.globalAlpha = .68;
            for (const [index, value] of state.preview.changes) {
                const z = Math.floor(index / (map.width * map.height));
                const local = index % (map.width * map.height);
                const x = local % map.width; const y = Math.floor(local / map.width);
                if (z < 4) { const point = mapToScreen(x, y); drawTile(context, value, point.x, point.y, size, .75); context.strokeStyle = "#d2a8ff"; context.strokeRect(point.x + 1, point.y + 1, size - 2, size - 2); }
            }
            context.restore();
        }
        if (state.overlay === "changes") {
            for (const layer of document.authoringLayers) {
                if (!layer.visible) continue;
                context.save(); context.globalAlpha = clamp(layer.opacity, 0, 1); context.fillStyle = `${layer.color || "#58a6ff"}66`;
                for (const index of layer.changes.keys()) {
                    const local = index % (map.width * map.height); const x = local % map.width; const y = Math.floor(local / map.width);
                    const point = mapToScreen(x, y); context.fillRect(point.x, point.y, size, size);
                }
                context.restore();
            }
        }
        for (const event of map.events || []) if (event && inMap(map, event.x, event.y)) {
            const point = mapToScreen(event.x, event.y);
            context.fillStyle = event.id === state.selectedEventId ? "#ffa657" : "#56d364";
            context.fillRect(point.x + size * .62, point.y + 2, size * .34, size * .25);
            context.fillStyle = "#071018"; context.font = `${Math.max(8, size * .16)}px sans-serif`; context.fillText(`E${event.id}`, point.x + size * .64, point.y + size * .19);
        }
        for (const mask of document.masks) if (mask.visible !== false) {
            context.strokeStyle = mask.color || "#f778ba"; context.lineWidth = 2;
            for (const [x, y] of mask.points || []) { const point = mapToScreen(x, y); context.strokeRect(point.x + 2, point.y + 2, size - 4, size - 4); }
        }
        if (state.selectionCells?.size) {
            context.fillStyle = "#58a6ff2b"; context.strokeStyle = "#58a6ff"; context.lineWidth = 1;
            for (const key of state.selectionCells) { const [x, y] = key.split(",").map(Number); const point = mapToScreen(x, y); context.fillRect(point.x, point.y, size, size); context.strokeRect(point.x + 1, point.y + 1, size - 2, size - 2); }
        } else if (state.selection) {
            const rect = normalizeSelection(state.selection); const point = mapToScreen(rect.x, rect.y);
            context.fillStyle = "#58a6ff20"; context.fillRect(point.x, point.y, rect.w * size, rect.h * size);
            context.strokeStyle = "#58a6ff"; context.lineWidth = 2; context.setLineDash([6, 4]); context.strokeRect(point.x, point.y, rect.w * size, rect.h * size); context.setLineDash([]);
        }
        if (state.grid && size >= 10) {
            context.strokeStyle = "#ffffff16"; context.lineWidth = 1; context.beginPath();
            for (let x = x0; x <= x1; x++) { const px = state.panX + x * size; context.moveTo(px, state.panY + y0 * size); context.lineTo(px, state.panY + y1 * size); }
            for (let y = y0; y <= y1; y++) { const py = state.panY + y * size; context.moveTo(state.panX + x0 * size, py); context.lineTo(state.panX + x1 * size, py); }
            context.stroke();
        }
        renderMinimap(map);
    }

    function renderMinimap(map) {
        $("minimapFrame").classList.remove("hidden");
        minimapContext.clearRect(0, 0, minimap.width, minimap.height);
        const scale = Math.min(minimap.width / map.width, minimap.height / map.height);
        const budget = Math.max(1000, integer(state.renderSettings?.maxTilesPerFrame, 12000)); const step = state.renderSettings?.adaptive ? Math.max(1, Math.ceil(Math.sqrt(map.width * map.height / budget))) : 1;
        for (let y = 0; y < map.height; y += step) for (let x = 0; x < map.width; x += step) {
            const tile = tileAt(map, x, y, 0) || tileAt(map, x, y, 1);
            minimapContext.fillStyle = tile ? `hsl(${tile * 47 % 360} 32% 42%)` : "#0d1118";
            minimapContext.fillRect(x * scale, y * scale, Math.ceil(scale * step), Math.ceil(scale * step));
        }
        const size = tileScreenSize();
        const view = canvas.getBoundingClientRect();
        minimapContext.strokeStyle = "#fff";
        minimapContext.strokeRect(Math.max(0, -state.panX / size) * scale, Math.max(0, -state.panY / size) * scale, view.width / size * scale, view.height / size * scale);
    }

    function normalizeSelection(selection) {
        const x = Math.min(selection.x1, selection.x2); const y = Math.min(selection.y1, selection.y2);
        return { x, y, w: Math.abs(selection.x2 - selection.x1) + 1, h: Math.abs(selection.y2 - selection.y1) + 1 };
    }
    function selectionPoints(map = composeMap()) {
        if (state.selectionCells?.size) return [...state.selectionCells].map(key => key.split(",").map(Number));
        if (!state.selection || !map) return [];
        const rect = normalizeSelection(state.selection); const points = [];
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (inMap(map, x, y)) points.push([x, y]);
        return points;
    }
    function selectionBounds(points = selectionPoints()) {
        if (!points.length) return null; const xs = points.map(point => point[0]); const ys = points.map(point => point[1]);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
    }
    function selectionContains(x, y) {
        if (state.selectionCells?.size) return state.selectionCells.has(`${x},${y}`);
        if (!state.selection) return true;
        const rect = normalizeSelection(state.selection);
        return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
    }
    function pointInPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i]; const [xj, yj] = points[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) inside = !inside;
        }
        return inside;
    }
    function polygonSelection(points, map = composeMap()) {
        const result = new Set(); if (!map || !points.length) return result;
        const bounds = selectionBounds(points);
        for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) if (inMap(map, x, y) && pointInPolygon(x + .5, y + .5, points)) result.add(`${x},${y}`);
        if (!result.size) for (const [x, y] of points) if (inMap(map, x, y)) result.add(`${x},${y}`);
        return result;
    }
    function connectedSelection(map, x, y, layer, target) {
        const selected = new Set(); const queue = [[x, y]];
        while (queue.length && selected.size < 500000) {
            const [px, py] = queue.shift(); const key = `${px},${py}`;
            if (selected.has(key) || !inMap(map, px, py) || tileAt(map, px, py, layer) !== target) continue;
            selected.add(key); queue.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        return selected;
    }
    function paintCell(document, x, y, tileId = state.tileId, z = state.tileLayer) {
        const map = composeMap(document); const layer = activeLayer(document);
        if (!layer || layer.locked) return;
        for (let dy = 0; dy < state.brushSize; dy++) for (let dx = 0; dx < state.brushSize; dx++) {
            const px = x + dx; const py = y + dy;
            if (inMap(map, px, py) && selectionContains(px, py)) layer.changes.set(tileIndex(map, px, py, z), integer(tileId));
        }
    }
    function fillCell(document, x, y, replacement) {
        const map = composeMap(document); const target = tileAt(map, x, y, state.tileLayer);
        if (target === replacement) return;
        const queue = [[x, y]]; const seen = new Set(); const layer = activeLayer(document);
        while (queue.length && seen.size < 250000) {
            const [px, py] = queue.shift(); const key = `${px},${py}`;
            if (seen.has(key) || !inMap(map, px, py) || !selectionContains(px, py) || tileAt(map, px, py, state.tileLayer) !== target) continue;
            seen.add(key); layer.changes.set(tileIndex(map, px, py, state.tileLayer), replacement);
            queue.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
    }
    function rectanglePaint(document, selection, tileId) {
        const rect = normalizeSelection(selection);
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) paintCell(document, x, y, tileId);
    }
    function linePaint(document, selection, tileId) {
        let x = integer(selection.x1); let y = integer(selection.y1); const x2 = integer(selection.x2); const y2 = integer(selection.y2); const dx = Math.abs(x2 - x); const sx = x < x2 ? 1 : -1; const dy = -Math.abs(y2 - y); const sy = y < y2 ? 1 : -1; let error = dx + dy;
        while (true) { paintCell(document, x, y, tileId); if (x === x2 && y === y2) break; const twice = error * 2; if (twice >= dy) { error += dy; x += sx; } if (twice <= dx) { error += dx; y += sy; } }
    }
    function ellipsePaint(document, selection, tileId) {
        const rect = normalizeSelection(selection); const cx = rect.x + (rect.w - 1) / 2; const cy = rect.y + (rect.h - 1) / 2; const rx = Math.max(.5, rect.w / 2); const ry = Math.max(.5, rect.h / 2); const thickness = Math.max(.15, 1 / Math.max(rx, ry));
        for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) { const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (Math.abs(distance - 1) <= thickness) paintCell(document, x, y, tileId); }
    }
    function scatterBrush(document, x, y) {
        const density = clamp(Number($("generatorDensity").value), 0, 1); const secondary = integer($("generatorTileB").value, state.tileId); const map = composeMap(document); const layer = activeLayer(document); if (!map || !layer || layer.locked) return;
        for (let dy = 0; dy < state.brushSize; dy++) for (let dx = 0; dx < state.brushSize; dx++) { const px = x + dx; const py = y + dy; if (Math.random() <= density && inMap(map, px, py) && selectionContains(px, py)) layer.changes.set(tileIndex(map, px, py, state.tileLayer), Math.random() < .5 ? state.tileId : secondary); }
    }

    function handlePointerDown(event) {
        const document = activeDocument(); if (!document) return;
        const point = screenToMap(event.clientX, event.clientY);
        const map = composeMap(document);
        if (state.tool === "transferPick" && state.transferPick && inMap(map, point.x, point.y)) {
            const target = state.transferPick;
            mutateEventOnDocument(state.documents.get(integer(target.mapId)), target.eventId, "Pick transfer destination", eventData => {
                const command = eventData.pages[target.pageIndex]?.list?.[target.commandIndex];
                if (!command || command.code !== 201) throw new Error("The selected transfer command no longer exists.");
                command.parameters = [0, document.id, point.x, point.y, integer(command.parameters?.[4]), integer(command.parameters?.[5])];
            });
            state.transferPick = null; setTool("event"); setStatus(`Transfer destination set to Map ${document.id} (${point.x},${point.y}).`); return;
        }
        canvas.setPointerCapture(event.pointerId);
        const pan = state.tool === "pan" || state.spacePan || event.button === 1;
        state.pointer = { point, startX: event.clientX, startY: event.clientY, panX: state.panX, panY: state.panY, pan, action: null };
        if (pan) return;
        if (!inMap(map, point.x, point.y)) return;
        if (["select", "rectangle", "line", "ellipse"].includes(state.tool)) { state.selectionCells = null; state.selection = { x1: point.x, y1: point.y, x2: point.x, y2: point.y }; }
        if (state.tool === "lasso") state.pointer.path = [[point.x, point.y]];
        if (state.tool === "polygon") { state.polygonPoints ||= []; state.polygonPoints.push([point.x, point.y]); state.selectionCells = polygonSelection(state.polygonPoints, map); state.selection = state.selectionCells.size ? { x1: selectionBounds().x, y1: selectionBounds().y, x2: selectionBounds().x + selectionBounds().w - 1, y2: selectionBounds().y + selectionBounds().h - 1 } : null; }
        if (state.tool === "wand") { state.selectionCells = connectedSelection(map, point.x, point.y, state.tileLayer, tileAt(map, point.x, point.y, state.tileLayer)); const bounds = selectionBounds(); state.selection = bounds ? { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.w - 1, y2: bounds.y + bounds.h - 1 } : null; }
        if (state.tool === "regionSelect") { const region = tileAt(map, point.x, point.y, 5); state.selectionCells = new Set(); for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(map, x, y, 5) === region) state.selectionCells.add(`${x},${y}`); const bounds = selectionBounds(); state.selection = bounds ? { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.w - 1, y2: bounds.y + bounds.h - 1 } : null; }
        if (state.tool === "paint" || state.tool === "erase") {
            state.pointer.action = beginAction(state.tool === "paint" ? "Paint tiles" : "Erase tiles", document);
            paintCell(document, point.x, point.y, state.tool === "paint" ? state.tileId : 0); renderCanvas();
        } else if (state.tool === "scatterBrush") {
            state.pointer.action = beginAction("Scatter brush", document); scatterBrush(document, point.x, point.y); renderCanvas();
        } else if (state.tool === "fill") {
            const action = beginAction("Flood fill", document); fillCell(document, point.x, point.y, state.tileId); commitAction(action, document);
        } else if (state.tool === "eyedropper") {
            state.tileId = tileAt(map, point.x, point.y, state.tileLayer); $("tileIdInput").value = state.tileId; renderPalette(); setTool("paint");
        } else if (state.tool === "event") {
            const eventAt = (map.events || []).find(item => item && item.x === point.x && item.y === point.y); selectEvent(eventAt?.id || 0);
        }
        renderEverything();
    }
    function handlePointerMove(event) {
        const point = screenToMap(event.clientX, event.clientY);
        $("cursorStatus").textContent = `X:${point.x} Y:${point.y}`;
        const pointer = state.pointer; if (!pointer) return;
        if (pointer.pan) {
            state.panX = pointer.panX + event.clientX - pointer.startX; state.panY = pointer.panY + event.clientY - pointer.startY; renderCanvas(); return;
        }
        const document = activeDocument(); if (!document) return;
        if (["select", "rectangle", "line", "ellipse"].includes(state.tool)) { state.selection.x2 = point.x; state.selection.y2 = point.y; renderEverything(); }
        else if (state.tool === "lasso") { const last = pointer.path.at(-1); if (!last || last[0] !== point.x || last[1] !== point.y) pointer.path.push([point.x, point.y]); state.selectionCells = polygonSelection(pointer.path, composeMap(document)); renderCanvas(); }
        else if (state.tool === "paint" || state.tool === "erase") { paintCell(document, point.x, point.y, state.tool === "paint" ? state.tileId : 0); renderCanvas(); }
        else if (state.tool === "scatterBrush") { scatterBrush(document, point.x, point.y); renderCanvas(); }
    }
    function handlePointerUp() {
        const pointer = state.pointer; const document = activeDocument(); state.pointer = null;
        if (!pointer || !document) return;
        if (state.tool === "lasso" && pointer.path?.length) { state.selectionCells = polygonSelection(pointer.path, composeMap(document)); const bounds = selectionBounds(); state.selection = bounds ? { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.w - 1, y2: bounds.y + bounds.h - 1 } : null; }
        else if (state.tool === "rectangle" && state.selection) {
            const action = beginAction("Rectangle fill", document); rectanglePaint(document, state.selection, state.tileId); commitAction(action, document);
        } else if (state.tool === "line" && state.selection) {
            const action = beginAction("Line brush", document); linePaint(document, state.selection, state.tileId); commitAction(action, document);
        } else if (state.tool === "ellipse" && state.selection) {
            const action = beginAction("Ellipse brush", document); ellipsePaint(document, state.selection, state.tileId); commitAction(action, document);
        } else if (pointer.action) commitAction(pointer.action, document);
        renderEverything();
    }

    function setTool(tool) {
        state.tool = tool;
        if (tool !== "polygon") state.polygonPoints = null;
        document.querySelectorAll("#toolButtons [data-tool]").forEach(button => button.classList.toggle("active", button.dataset.tool === tool));
        setStatus(`${tool[0].toUpperCase()}${tool.slice(1)} tool selected.`);
    }
    function fitMap() {
        const document = activeDocument(); if (!document) return;
        const rect = $("canvasStage").getBoundingClientRect(); const map = document.baseMap;
        state.zoom = clamp(Math.min((rect.width - 40) / (map.width * TILE_SIZE), (rect.height - 40) / (map.height * TILE_SIZE)), .1, 4);
        state.panX = (rect.width - map.width * TILE_SIZE * state.zoom) / 2; state.panY = (rect.height - map.height * TILE_SIZE * state.zoom) / 2;
        renderEverything();
    }

    function renderMapTree() {
        const filter = $("mapSearch").value.trim().toLowerCase();
        const maps = state.mapInfos.filter(Boolean).filter(info => !filter || `${info.id} ${info.name}`.toLowerCase().includes(filter));
        $("mapTree").classList.toggle("empty-state", !maps.length);
        $("mapTree").innerHTML = maps.length ? maps.map(info => `<button class="map-item${state.activeId === info.id ? " active" : ""}" data-map-id="${info.id}" style="padding-left:${10 + mapDepth(info.id) * 12}px"><span>${String(info.id).padStart(3, "0")}</span><strong>${escapeHtml(info.name || `Map ${info.id}`)}</strong>${state.documents.get(info.id)?.dirty ? "<i>●</i>" : ""}</button>`).join("") : "No matching maps.";
    }
    function mapDepth(id) {
        let depth = 0; let info = state.mapInfos[id]; const seen = new Set();
        while (info?.parentId && !seen.has(info.parentId) && depth < 8) { seen.add(info.parentId); info = state.mapInfos[info.parentId]; depth++; }
        return depth;
    }
    function renderTabs() {
        $("tabBar").innerHTML = state.tabs.length ? state.tabs.map(id => { const document = state.documents.get(id); return `<button class="tab${id === state.activeId ? " active" : ""}" data-tab-id="${id}"><span>${escapeHtml(document?.name || `Map ${id}`)}${document?.dirty ? " •" : ""}</span><i data-close-id="${id}">×</i></button>`; }).join("") : '<div class="empty-tab">No maps open</div>';
    }
    function renderLayers() {
        const document = activeDocument(); const list = $("authoringLayerList");
        if (!document) { list.className = "layer-list empty-state"; list.textContent = "Open a map to manage layers."; return; }
        list.className = "layer-list";
        list.innerHTML = [...document.authoringLayers].reverse().map(layer => `<div class="layer-item${layer.id === document.activeLayerId ? " active" : ""}" data-layer-id="${layer.id}" role="button" tabindex="0"><input type="checkbox" data-layer-visible="${layer.id}" ${layer.visible ? "checked" : ""}><span><strong>${escapeHtml(layer.name)}</strong><small>${layer.changes.size} tile · ${layer.eventChanges.size} event</small></span><input type="range" min="0" max="1" step=".05" value="${layer.opacity}" data-layer-opacity="${layer.id}" title="Preview opacity"><input type="checkbox" data-layer-lock="${layer.id}" ${layer.locked ? "checked" : ""} title="Lock"><i class="swatch" style="background:${layer.color}"></i></div>`).join("");
        $("maskList").classList.toggle("empty-state", !document.masks.length);
        $("maskList").innerHTML = document.masks.length ? document.masks.map(mask => `<button class="list-item" data-mask-id="${mask.id}"><span>${escapeHtml(mask.name)}</span><small>${mask.points.length} cells</small></button>`).join("") : "No masks";
    }
    function renderTileLayerControls() {
        $("tileLayerControls").innerHTML = state.tileLayerVisibility.map((visible, z) => `<div class="tile-layer-row"><input type="checkbox" data-tile-visible="${z}" ${visible ? "checked" : ""}><strong>L${z + 1}</strong><span>${z < 4 ? "Tiles" : z === 4 ? "Shadow" : "Region"}</span><input type="range" min="0" max="1" step=".05" value="${state.tileLayerOpacity[z]}" data-tile-opacity="${z}"></div>`).join("");
    }
    function paletteIds(sheet) {
        if (sheet === "A5") return Array.from({ length: 128 }, (_, i) => 1536 + i);
        if (sheet === "A") return Array.from({ length: 128 }, (_, i) => 2048 + i * 48);
        const start = { B: 0, C: 256, D: 512, E: 768 }[sheet] || 0;
        return Array.from({ length: 256 }, (_, i) => start + i);
    }
    function renderPalette() {
        const filter = $("tileFilterInput").value.trim().toLowerCase();
        const ids = paletteIds(state.paletteSheet).filter(id => !filter || String(id).includes(filter));
        $("tilePalette").innerHTML = ids.slice(0, 512).map(id => `<button class="palette-tile${state.tileId === id ? " selected" : ""}" data-tile-id="${id}" title="Tile ${id}"><canvas width="48" height="48"></canvas><span>${id}</span></button>`).join("");
        $("tilePalette").querySelectorAll("[data-tile-id]").forEach(button => drawTile(button.querySelector("canvas").getContext("2d"), integer(button.dataset.tileId), 0, 0, 48));
    }
    function renderEvents() {
        const map = composeMap(); const filter = $("eventSearchInput").value.trim().toLowerCase(); const list = $("eventList");
        if (!map) { list.className = "event-list empty-state"; list.textContent = "Open a map to inspect events."; $("eventForm").classList.add("hidden"); return; }
        const events = (map.events || []).filter(Boolean).filter(event => !filter || JSON.stringify(event).toLowerCase().includes(filter));
        list.className = `event-list${events.length ? "" : " empty-state"}`;
        list.innerHTML = events.length ? events.map(event => `<button class="event-item${event.id === state.selectedEventId ? " active" : ""}" data-event-id="${event.id}"><span>E${event.id}</span><strong>${escapeHtml(event.name || "Unnamed")}</strong><small>${event.x},${event.y}</small></button>`).join("") : "No matching events";
    }
    function selectEvent(id) {
        const nextId = integer(id); if (nextId !== state.selectedEventId) { state.selectedEventPage = 0; state.selectedEventCommand = 0; }
        state.selectedEventId = nextId; const map = composeMap(); const event = map?.events?.[state.selectedEventId];
        $("eventForm").classList.toggle("hidden", !event);
        if (event) {
            $("eventIdField").value = event.id; $("eventNameField").value = event.name || ""; $("eventXField").value = event.x; $("eventYField").value = event.y; $("eventNoteField").value = event.note || ""; $("eventJsonField").value = JSON.stringify(event, null, 2);
        }
        renderVisualEventEditor(event);
        renderEvents(); renderCanvas();
    }
    const EVENT_COMMAND_NAMES = Object.freeze({ 0: "End", 101: "Show text", 102: "Show choices", 111: "Conditional branch", 121: "Control switches", 122: "Control variables", 123: "Control self switch", 201: "Transfer player", 205: "Set move route", 230: "Wait", 301: "Battle processing", 355: "Script", 356: "Plugin command (MV)", 357: "Plugin command (MZ)" });
    function currentEvent() { return composeMap()?.events?.[state.selectedEventId] || null; }
    function currentEventPage(event = currentEvent()) { return event?.pages?.[clamp(state.selectedEventPage, 0, Math.max(0, (event.pages?.length || 1) - 1))] || null; }
    function commandLabel(command, index) {
        const name = EVENT_COMMAND_NAMES[command.code] || `Command ${command.code}`;
        const detail = command.code === 101 ? String(command.parameters?.[0] || command.parameters?.[4] || "") : command.code === 201 ? `Map ${command.parameters?.[1] || 0} (${command.parameters?.[2] || 0},${command.parameters?.[3] || 0})` : "";
        return `${String(index + 1).padStart(2, "0")} · ${"  ".repeat(integer(command.indent))}${name}${detail ? ` — ${detail}` : ""}`;
    }
    function renderVisualEventEditor(event = currentEvent()) {
        const select = $("eventPageSelect"); const list = $("eventCommandList");
        if (!event) { select.innerHTML = ""; list.innerHTML = ""; return; }
        const pages = event.pages?.length ? event.pages : eventTemplate(event.id).pages;
        state.selectedEventPage = clamp(state.selectedEventPage, 0, pages.length - 1);
        select.innerHTML = pages.map((_, index) => `<option value="${index}"${index === state.selectedEventPage ? " selected" : ""}>Page ${index + 1}</option>`).join("");
        const page = pages[state.selectedEventPage];
        $("eventTriggerField").value = String(integer(page.trigger)); $("eventPriorityField").value = String(integer(page.priorityType, 1)); $("eventMoveTypeField").value = String(integer(page.moveType));
        $("eventConditionsField").value = JSON.stringify(page.conditions || {}, null, 2);
        const commands = page.list?.length ? page.list : [{ code: 0, indent: 0, parameters: [] }];
        state.selectedEventCommand = clamp(state.selectedEventCommand, 0, commands.length - 1);
        list.innerHTML = commands.map((command, index) => `<option value="${index}"${index === state.selectedEventCommand ? " selected" : ""}>${escapeHtml(commandLabel(command, index))}</option>`).join("");
        const command = commands[state.selectedEventCommand];
        $("eventCommandType").value = String(command.code || 101); $("eventCommandIndent").value = integer(command.indent); $("eventCommandParameters").value = JSON.stringify(command.parameters || [], null, 2);
        $("eventTransferPickButton").disabled = integer(command.code) !== 201;
    }
    function mutateSelectedEvent(label, callback) {
        const event = deepClone(currentEvent()); if (!event) return false;
        callback(event); writeEvent(event, label); return true;
    }
    function mutateEventOnDocument(document, eventId, label, callback) {
        const event = deepClone(composeMap(document)?.events?.[integer(eventId)]); const layer = activeLayer(document);
        if (!document || !event || !layer || layer.locked) throw new Error("The source event or writable authoring layer is unavailable.");
        const action = beginAction(label, document); callback(event); layer.eventChanges.set(event.id, event); commitAction(action, document); return event;
    }
    function updateEventPageSettings() {
        mutateSelectedEvent("Edit event page", event => {
            const page = event.pages[state.selectedEventPage];
            page.trigger = integer($("eventTriggerField").value); page.priorityType = integer($("eventPriorityField").value, 1); page.moveType = integer($("eventMoveTypeField").value);
            page.conditions = JSON.parse($("eventConditionsField").value || "{}");
        });
    }
    function addEventPage(duplicate = false) {
        mutateSelectedEvent(duplicate ? "Duplicate event page" : "Add event page", event => {
            const source = duplicate ? deepClone(event.pages[state.selectedEventPage]) : deepClone(eventTemplate(event.id).pages[0]);
            event.pages.splice(state.selectedEventPage + 1, 0, source); state.selectedEventPage++;
        });
    }
    function deleteEventPage() {
        mutateSelectedEvent("Delete event page", event => { if (event.pages.length <= 1) throw new Error("An event must keep at least one page."); event.pages.splice(state.selectedEventPage, 1); state.selectedEventPage = Math.max(0, state.selectedEventPage - 1); });
    }
    function addEventCommand() {
        mutateSelectedEvent("Add event command", event => {
            const page = event.pages[state.selectedEventPage]; page.list ||= [{ code: 0, indent: 0, parameters: [] }];
            const endIndex = Math.max(0, page.list.length - (page.list.at(-1)?.code === 0 ? 1 : 0));
            const index = Math.min(state.selectedEventCommand + 1, endIndex);
            page.list.splice(index, 0, { code: integer($("eventCommandType").value), indent: Math.max(0, integer($("eventCommandIndent").value)), parameters: JSON.parse($("eventCommandParameters").value || "[]") }); state.selectedEventCommand = index;
        });
    }
    function updateEventCommand() {
        mutateSelectedEvent("Update event command", event => {
            const command = event.pages[state.selectedEventPage].list[state.selectedEventCommand]; if (!command || command.code === 0) throw new Error("The End command is managed automatically.");
            command.code = integer($("eventCommandType").value); command.indent = Math.max(0, integer($("eventCommandIndent").value)); command.parameters = JSON.parse($("eventCommandParameters").value || "[]");
        });
    }
    function deleteEventCommand() {
        mutateSelectedEvent("Delete event command", event => { const list = event.pages[state.selectedEventPage].list; if (list[state.selectedEventCommand]?.code === 0) throw new Error("The End command cannot be deleted."); list.splice(state.selectedEventCommand, 1); state.selectedEventCommand = Math.max(0, state.selectedEventCommand - 1); });
    }
    function renderHistory() {
        const document = activeDocument(); const actions = document?.undo || [];
        $("historyList").classList.toggle("empty-state", !actions.length);
        $("historyList").innerHTML = actions.length ? [...actions].reverse().map(action => `<div class="history-item"><time>${new Date(action.at).toLocaleTimeString()}</time><span>${escapeHtml(action.label)}</span></div>`).join("") : "No history";
    }
    function renderModifiers() {
        const document = activeDocument(); const modifiers = document?.modifiers || [];
        $("modifierList").classList.toggle("empty-state", !modifiers.length);
        $("modifierList").innerHTML = modifiers.length ? modifiers.map(modifier => `<div class="modifier-item"><input type="checkbox" data-modifier-visible="${modifier.id}" ${modifier.enabled !== false ? "checked" : ""}><span><strong>${escapeHtml(modifier.name)}</strong><small>${escapeHtml(modifier.type)} · ${modifier.changeCount} changes</small></span><span class="button-row"><button data-modifier-regenerate="${modifier.id}" title="Regenerate">↻</button><button data-modifier-remove="${modifier.id}" title="Delete">×</button></span></div>`).join("") : "No modifiers";
    }
    function renderBookmarks() {
        const items = state.bookmarks.filter(item => !state.projectName || item.project === state.projectName);
        $("bookmarkList").classList.toggle("empty-state", !items.length);
        $("bookmarkList").innerHTML = items.length ? items.map(item => `<button class="list-item" data-bookmark-map="${item.mapId}"><span>${escapeHtml(item.name)}</span><small>${item.x},${item.y}</small></button>`).join("") : "No bookmarks";
    }
    function renderSelectionInspector() {
        const document = activeDocument(); const inspector = $("selectionInspector");
        if (!document || !state.selection) { inspector.className = "property-list padded empty-state"; inspector.textContent = "Select a tile or area."; return; }
        const rect = selectionBounds() || normalizeSelection(state.selection); const map = composeMap(document); const count = selectionPoints(map).length;
        inspector.className = "property-list padded";
        inspector.innerHTML = `<dt>Position</dt><dd>${rect.x}, ${rect.y}</dd><dt>Bounds</dt><dd>${rect.w} × ${rect.h}</dd><dt>Selected cells</dt><dd>${count}</dd><dt>L1 at origin</dt><dd>${tileAt(map, rect.x, rect.y, 0)}</dd><dt>Region</dt><dd>${tileAt(map, rect.x, rect.y, 5)}</dd>`;
    }
    function updateChrome() {
        const document = activeDocument(); const has = !!document;
        for (const id of ["saveButton", "saveAllButton", "validateButton", "workspaceButton", "addBookmarkButton", "projectSearchButton", "replaceTilesButton", "addLayerButton", "addEventButton", "createSnapshotButton", "diffBaseButton", "diffFileButton", "threeWayButton"]) $(id).disabled = !has;
        for (const id of ["duplicateLayerButton", "mergeLayerButton", "moveLayerUpButton", "moveLayerDownButton", "exportLayerButton", "deleteLayerButton", "createMaskButton"]) $(id).disabled = !has;
        $("refreshMapsButton").disabled = !state.dataHandle;
        $("undoButton").disabled = !document?.undo.length; $("redoButton").disabled = !document?.redo.length;
        $("copySelectionButton").disabled = !has || !state.selection;
        for (const id of ["pasteSelectionButton", "rotateClipboardButton", "mirrorClipboardButton"]) $(id).disabled = !has || !state.projectClipboard;
        $("clearHistoryButton").disabled = !document?.undo.length;
        $("atomicSaveButton").disabled = !has; $("dependencyAuditButton").disabled = !state.dataHandle;
        for (const id of ["createBranchButton", "switchBranchButton", "mergeBranchButton", "addReviewCommentButton"]) $(id).disabled = !has;
        $("projectBadge").textContent = state.projectHandle ? state.projectName : state.documents.size ? `${state.documents.size} loose map(s)` : "No project open";
        $("mapStatus").textContent = document ? `Map ${document.id} · ${document.baseMap.width}×${document.baseMap.height} · Tileset ${document.baseMap.tilesetId}` : "—";
        $("dirtyStatus").textContent = document?.dirty ? "Unsaved changes" : "";
        $("zoomOutput").textContent = `${Math.round(state.zoom * 100)}%`;
        $("gridButton").classList.toggle("active", state.grid);
        renderJournalReport();
    }
    function renderEverything() {
        renderMapTree(); renderTabs(); renderLayers(); renderTileLayerControls(); renderEvents(); renderHistory(); renderModifiers(); renderBookmarks(); renderSelectionInspector(); renderSnapshotList(); renderCollaboration(); updateChrome(); renderCanvas();
    }

    function addLayer(name = `Layer ${activeDocument()?.authoringLayers.length + 1}`) {
        const document = activeDocument(); if (!document) return;
        const layer = { id: uid("layer"), name, visible: true, locked: false, opacity: 1, color: layerColor(document.authoringLayers.length), changes: new Map(), eventChanges: new Map() };
        document.authoringLayers.push(layer); document.activeLayerId = layer.id; markDirty(document); renderEverything();
    }
    function duplicateLayer() {
        const document = activeDocument(); const source = activeLayer(document); if (!source) return;
        const layer = { ...source, id: uid("layer"), name: `${source.name} copy`, changes: new Map(source.changes), eventChanges: new Map([...source.eventChanges].map(([id, value]) => [id, deepClone(value)])) };
        document.authoringLayers.splice(document.authoringLayers.indexOf(source) + 1, 0, layer); document.activeLayerId = layer.id; markDirty(document); renderEverything();
    }
    function moveLayer(direction) {
        const document = activeDocument(); const layer = activeLayer(document); const index = document?.authoringLayers.indexOf(layer);
        const target = index + direction; if (!document || index < 0 || target < 0 || target >= document.authoringLayers.length) return;
        [document.authoringLayers[index], document.authoringLayers[target]] = [document.authoringLayers[target], document.authoringLayers[index]]; markDirty(document); renderEverything();
    }
    function mergeLayerDown() {
        const document = activeDocument(); const layer = activeLayer(document); const index = document?.authoringLayers.indexOf(layer);
        if (!document || index <= 0) return setStatus("The bottom layer cannot merge down.", true);
        const lower = document.authoringLayers[index - 1]; if (lower.locked) return setStatus("Unlock the lower layer first.", true);
        for (const [key, value] of layer.changes) lower.changes.set(key, value);
        for (const [key, value] of layer.eventChanges) lower.eventChanges.set(key, deepClone(value));
        document.authoringLayers.splice(index, 1); document.activeLayerId = lower.id; markDirty(document); renderEverything();
    }
    async function deleteLayer() {
        const document = activeDocument(); const layer = activeLayer(document); if (!document || !layer) return;
        if (document.authoringLayers.length === 1) return setStatus("A map must keep at least one authoring layer.", true);
        if (layer.changes.size || layer.eventChanges.size) {
            const answer = await openTextDialog("Delete authoring layer", `Type DELETE to remove ${layer.name} and its changes.`, "Confirmation", "");
            if (answer !== "DELETE") return;
        }
        const index = document.authoringLayers.indexOf(layer); document.authoringLayers.splice(index, 1); document.activeLayerId = document.authoringLayers[Math.max(0, index - 1)].id; markDirty(document); renderEverything();
    }
    function exportActiveLayer() {
        const document = activeDocument(); const layer = activeLayer(document); if (!document || !layer) return;
        download(`${document.fileName.replace(/\.json$/i, "")}-${layer.name.replace(/\W+/g, "-")}.htg-changeset.json`, JSON.stringify({ format: "HybridTileStudioChangeSet", version: 1, mapId: document.id, mapWidth: document.baseMap.width, mapHeight: document.baseMap.height, layer: serializeLayer(layer) }, null, 2));
    }
    function createMask() {
        const document = activeDocument(); if (!document || !state.selection) return setStatus("Select an area first.", true);
        const points = selectionPoints(composeMap(document));
        openTextDialog("Create mask", "Name this reusable selection mask.", "Mask name", `Mask ${document.masks.length + 1}`).then(name => {
            if (!name) return; document.masks.push({ id: uid("mask"), name, points, visible: true, color: "#f778ba" }); markDirty(document); renderEverything();
        });
    }

    function copyStudioSelection(includeEvents = true) {
        const document = activeDocument(); const map = composeMap(document); const points = selectionPoints(map); const bounds = selectionBounds(points);
        if (!document || !map || !points.length || !bounds) return false;
        const cells = points.map(([x, y]) => ({ x: x - bounds.x, y: y - bounds.y,
            tiles: [0, 1, 2, 3, 4, 5].map(layer => tileAt(map, x, y, layer)) }));
        const selected = new Set(points.map(point => `${point[0]},${point[1]}`));
        const events = includeEvents ? (map.events || []).filter(event => event && selected.has(`${event.x},${event.y}`)).map(event => {
            const copy = deepClone(event); copy.x -= bounds.x; copy.y -= bounds.y; return copy;
        }) : [];
        state.projectClipboard = { format: "HybridTileStudioClipboard", version: 2, sourceMapId: document.id,
            width: bounds.w, height: bounds.h, cells, events, includeEvents, copiedAt: Date.now() };
        updateChrome(); setStatus(`Copied ${cells.length} cell(s) and ${events.length} event(s).`); return deepClone(state.projectClipboard);
    }

    function transformStudioClipboard(rotation = 0, mirrorX = false) {
        const source = state.projectClipboard; if (!source) return false;
        const normalized = ((integer(rotation) % 360) + 360) % 360; const rotate = [0, 90, 180, 270].includes(normalized) ? normalized : 0;
        const width = rotate === 90 || rotate === 270 ? source.height : source.width;
        const height = rotate === 90 || rotate === 270 ? source.width : source.height;
        const transform = (x, y) => {
            let px = mirrorX ? source.width - 1 - x : x; let py = y;
            if (rotate === 90) return { x: source.height - 1 - py, y: px };
            if (rotate === 180) return { x: source.width - 1 - px, y: source.height - 1 - py };
            if (rotate === 270) return { x: py, y: source.width - 1 - px };
            return { x: px, y: py };
        };
        const transformDirection = direction => {
            let value = integer(direction); if (mirrorX) value = ({ 4: 6, 6: 4 })[value] || value;
            const clockwise = { 8: 6, 6: 2, 2: 4, 4: 8 }; for (let angle = 0; angle < rotate; angle += 90) value = clockwise[value] || value; return value;
        };
        const transformRouteCode = code => {
            const movementToDirection = { 1: 2, 2: 4, 3: 6, 4: 8, 16: 2, 17: 4, 18: 6, 19: 8 }; const directionToMovement = { 2: code >= 16 ? 16 : 1, 4: code >= 16 ? 17 : 2, 6: code >= 16 ? 18 : 3, 8: code >= 16 ? 19 : 4 };
            return movementToDirection[code] ? directionToMovement[transformDirection(movementToDirection[code])] : code;
        };
        source.cells = source.cells.map(cell => Object.assign({}, cell, transform(cell.x, cell.y)));
        source.events = source.events.map(sourceEvent => { const event = Object.assign(sourceEvent, transform(sourceEvent.x, sourceEvent.y)); for (const page of event.pages || []) { if (page.image) page.image.direction = transformDirection(page.image.direction); for (const route of [page.moveRoute, ...(page.list || []).filter(command => command.code === 205).map(command => command.parameters?.[1])]) for (const command of route?.list || []) command.code = transformRouteCode(command.code); } return event; });
        source.width = width; source.height = height; source.transform = { rotation: rotate, mirrorX };
        setStatus(`Clipboard transformed to ${width}×${height}.`); return deepClone(source);
    }

    function pasteStudioClipboard() {
        const document = activeDocument(); const map = composeMap(document); const layer = activeLayer(document); const clipboard = state.projectClipboard;
        if (!document || !map || !layer || !clipboard || layer.locked) return false;
        const origin = selectionBounds() || { x: 0, y: 0 }; const action = beginAction("Paste project clipboard", document);
        for (const cell of clipboard.cells) {
            const x = origin.x + cell.x; const y = origin.y + cell.y; if (!inMap(map, x, y)) continue;
            for (let z = 0; z < 6; z++) layer.changes.set(tileIndex(map, x, y, z), integer(cell.tiles[z]));
        }
        const occupied = new Set((map.events || []).filter(Boolean).map(event => event.id));
        for (const sourceEvent of clipboard.events || []) {
            let id = integer(sourceEvent.id, 1); while (occupied.has(id)) id++; occupied.add(id);
            const event = deepClone(sourceEvent); event.id = id; event.x = origin.x + event.x; event.y = origin.y + event.y;
            if (inMap(map, event.x, event.y)) layer.eventChanges.set(id, event);
        }
        commitAction(action, document); setStatus(`Pasted clipboard at ${origin.x},${origin.y}.`); return true;
    }

    function eventTemplate(id, x = 0, y = 0) {
        return { id, name: `Event ${id}`, note: "", pages: [{ conditions: { actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: "A", selfSwitchValid: false, switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0 }, directionFix: false, image: { characterIndex: 0, characterName: "", direction: 2, pattern: 1, tileId: 0 }, list: [{ code: 0, indent: 0, parameters: [] }], moveFrequency: 3, moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false }, moveSpeed: 3, moveType: 0, priorityType: 1, stepAnime: false, through: false, trigger: 0, walkAnime: true }], x, y };
    }
    function writeEvent(event, label = "Edit event") {
        const document = activeDocument(); const layer = activeLayer(document); if (!document || !layer || layer.locked) return;
        const action = beginAction(label, document); layer.eventChanges.set(integer(event.id), deepClone(event)); commitAction(action, document); selectEvent(event.id);
    }
    function saveEventForm(event) {
        event.preventDefault();
        try {
            const value = JSON.parse($("eventJsonField").value);
            value.id = integer($("eventIdField").value); value.name = $("eventNameField").value; value.x = integer($("eventXField").value); value.y = integer($("eventYField").value); value.note = $("eventNoteField").value;
            writeEvent(value);
        } catch (error) { reportError(new Error(`Event JSON is invalid: ${error.message}`)); }
    }
    function addEvent() {
        const map = composeMap(); if (!map) return;
        let id = 1; while (map.events[id]) id++;
        const position = state.selection ? normalizeSelection(state.selection) : { x: 0, y: 0 };
        writeEvent(eventTemplate(id, position.x, position.y), "Add event");
    }
    function duplicateSelectedEvent() {
        const map = composeMap(); const source = map?.events?.[state.selectedEventId]; if (!source) return;
        let id = 1; while (map.events[id]) id++; const event = deepClone(source); event.id = id; event.name = `${event.name} copy`; event.x = clamp(event.x + 1, 0, map.width - 1); writeEvent(event, "Duplicate event");
    }
    function deleteSelectedEvent() {
        const document = activeDocument(); const layer = activeLayer(document); if (!document || !state.selectedEventId) return;
        const action = beginAction("Delete event", document); layer.eventChanges.set(state.selectedEventId, null); commitAction(action, document); state.selectedEventId = 0; renderEverything();
    }

    function generatorOptions() {
        let advanced = {}; try { advanced = JSON.parse($("generatorOptions").value || "{}"); } catch (error) { throw new Error(`Advanced options JSON is invalid: ${error.message}`); }
        return { type: $("generatorType").value, seed: $("generatorSeed").value, tileA: integer($("generatorTileA").value), tileB: integer($("generatorTileB").value), count: Math.max(1, integer($("generatorCount").value)), density: clamp(Number($("generatorDensity").value), 0, 1), selectionOnly: $("generatorSelectionOnly").checked, ...advanced };
    }
    function generatorBounds(map, options) {
        const bounds = options.selectionOnly && state.selection ? (selectionBounds() || normalizeSelection(state.selection))
            : { x: 0, y: 0, w: map.width, h: map.height };
        if (options.selectionOnly && state.selectionCells?.size) bounds.maskSet = new Set(state.selectionCells);
        const document = activeDocument();
        const resolve = reference => document?.masks.find(mask => mask.id === reference || mask.name.toLowerCase() === String(reference).toLowerCase());
        const mask = options.mask && resolve(options.mask); const exclude = options.excludeMask && resolve(options.excludeMask);
        if (mask) {
            const maskSet = new Set(mask.points.map(point => `${point[0]},${point[1]}`));
            bounds.maskSet = bounds.maskSet ? new Set([...bounds.maskSet].filter(key => maskSet.has(key))) : maskSet;
        }
        if (exclude) bounds.excludeSet = new Set(exclude.points.map(point => `${point[0]},${point[1]}`));
        return bounds;
    }
    function setGenerated(changes, map, x, y, z, value, bounds) {
        const key = `${x},${y}`;
        if (inMap(map, x, y) && x >= bounds.x && y >= bounds.y && x < bounds.x + bounds.w && y < bounds.y + bounds.h &&
            (!bounds.maskSet || bounds.maskSet.has(key)) && (!bounds.excludeSet || !bounds.excludeSet.has(key))) {
            changes.set(tileIndex(map, x, y, z), integer(value));
        }
    }
    const WFC_DIRECTIONS = Object.freeze([{ key: "N", opposite: "S", dx: 0, dy: -1 }, { key: "E", opposite: "W", dx: 1, dy: 0 }, { key: "S", opposite: "N", dx: 0, dy: 1 }, { key: "W", opposite: "E", dx: -1, dy: 0 }]);
    function learnWfcRules(map = composeMap(), layer = state.tileLayer) {
        if (!map) return null; const palette = new Set(); const weights = {}; const adjacency = {};
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const tile = tileAt(map, x, y, layer); palette.add(tile); weights[tile] = (weights[tile] || 0) + 1;
            adjacency[tile] ||= { N: [], E: [], S: [], W: [] };
            for (const direction of WFC_DIRECTIONS) if (inMap(map, x + direction.dx, y + direction.dy)) {
                const next = tileAt(map, x + direction.dx, y + direction.dy, layer); if (!adjacency[tile][direction.key].includes(next)) adjacency[tile][direction.key].push(next);
            }
        }
        state.learnedWfcRules = { format: "HybridTileWfcRules", version: 1, tilesetId: map.tilesetId, layer, palette: [...palette], weights, adjacency, learnedAt: new Date().toISOString() };
        return deepClone(state.learnedWfcRules);
    }
    function weightedOrder(values, weights, random) {
        return [...values].map(value => ({ value, score: Math.pow(random() || 1e-9, 1 / Math.max(1, Number(weights?.[value]) || 1)) })).sort((a, b) => b.score - a.score).map(item => item.value);
    }
    function backtrackingWfc(map, bounds, options, z, random) {
        const rules = options.rules || state.learnedWfcRules || {}; const palette = (rules.palette || options.palette || [options.tileA, options.tileB]).map(integer); const changes = new Map();
        if (!palette.length) return changes;
        const cellKeys = []; const cellSet = new Set();
        for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) { const key = `${x},${y}`; if (inMap(map, x, y) && (!bounds.maskSet || bounds.maskSet.has(key)) && (!bounds.excludeSet || !bounds.excludeSet.has(key))) { cellKeys.push(key); cellSet.add(key); } }
        if (cellKeys.length > Math.max(1, integer(options.maxCells, 20000))) throw new Error("WFC area exceeds maxCells; limit it with a selection or raise maxCells.");
        let domains = new Map(cellKeys.map(key => [key, new Set(palette)])); let backtracks = 0; const stack = [];
        const allowed = (tile, direction, candidate) => {
            const directional = rules.adjacency?.[tile]?.[direction]; if (Array.isArray(directional)) return directional.map(integer).includes(candidate);
            const simple = options.adjacency?.[tile]; return !Array.isArray(simple) || simple.map(integer).includes(candidate);
        };
        const propagate = seeds => {
            const queue = [...seeds];
            while (queue.length) {
                const key = queue.shift(); const domain = domains.get(key); if (!domain?.size) return false; const [x, y] = key.split(",").map(Number);
                for (const direction of WFC_DIRECTIONS) {
                    const neighborKey = `${x + direction.dx},${y + direction.dy}`; const neighbor = domains.get(neighborKey); if (!neighbor) continue;
                    const next = new Set([...neighbor].filter(candidate => [...domain].some(tile => allowed(tile, direction.key, candidate) && allowed(candidate, direction.opposite, tile))));
                    if (!next.size) return false; if (next.size < neighbor.size) { domains.set(neighborKey, next); queue.push(neighborKey); }
                }
            }
            return true;
        };
        while (true) {
            let choiceKey = null; let entropy = Infinity;
            for (const [key, domain] of domains) if (domain.size > 1 && domain.size < entropy) { choiceKey = key; entropy = domain.size; }
            if (!choiceKey) break;
            const candidates = weightedOrder(domains.get(choiceKey), rules.weights, random); const snapshot = new Map([...domains].map(([key, domain]) => [key, new Set(domain)]));
            stack.push({ snapshot, key: choiceKey, remaining: candidates.slice(1) }); domains.set(choiceKey, new Set([candidates[0]]));
            if (propagate([choiceKey])) continue;
            let recovered = false;
            while (stack.length && backtracks++ < Math.max(1, integer(options.maxBacktracks, 128))) {
                const frame = stack.at(-1); if (!frame.remaining.length) { stack.pop(); continue; }
                const candidate = frame.remaining.shift(); domains = new Map([...frame.snapshot].map(([key, domain]) => [key, new Set(domain)])); domains.set(frame.key, new Set([candidate]));
                if (propagate([frame.key])) { recovered = true; break; }
            }
            if (!recovered) { domains = snapshot; for (const [key, domain] of domains) if (domain.size > 1) domains.set(key, new Set([weightedOrder(domain, rules.weights, random)[0]])); break; }
        }
        for (const [key, domain] of domains) { const [x, y] = key.split(",").map(Number); setGenerated(changes, map, x, y, z, domain.values().next().value ?? palette[0], bounds); }
        changes.wfcStats = { cells: cellKeys.length, backtracks, solved: [...domains.values()].every(domain => domain.size === 1) }; return changes;
    }
    function runGenerator(options = generatorOptions()) {
        const map = composeMap(); if (!map) return new Map(); const bounds = generatorBounds(map, options); const random = seededRandom(options.seed); const changes = new Map(); const z = clamp(integer(options.layer, state.tileLayer), 0, 5);
        if (state.generators.has(options.type)) {
            const value = state.generators.get(options.type)({ map: deepClone(map), bounds: deepClone({ ...bounds, maskSet: bounds.maskSet ? [...bounds.maskSet] : null, excludeSet: bounds.excludeSet ? [...bounds.excludeSet] : null }), options: deepClone(options), layer: z, random });
            if (value instanceof Map) return value; for (const item of value || []) if (Array.isArray(item)) changes.set(integer(item[0]), integer(item[1])); else if (item && inMap(map, integer(item.x), integer(item.y))) setGenerated(changes, map, integer(item.x), integer(item.y), integer(item.layer, z), integer(item.tileId), bounds); return changes;
        }
        if (options.type === "biome" || options.type === "transitions") {
            const scale = Math.max(2, integer(options.scale, 8));
            for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
                const climate = (Math.sin((x + seedHash(options.seed) % 31) / scale) + Math.cos((y + seedHash(options.seed) % 17) / scale) + (random() - .5) * .9) / 2;
                setGenerated(changes, map, x, y, z, climate > (options.threshold ?? 0) ? options.tileB : options.tileA, bounds);
            }
            if (options.type === "transitions") {
                const edgeTile = integer(options.transitionTile, options.tileB); const source = new Map(changes);
                for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
                    const value = source.get(tileIndex(map, x, y, z)); if (value === undefined) continue;
                    if (WFC_DIRECTIONS.some(direction => source.get(tileIndex(map, x + direction.dx, y + direction.dy, z)) !== undefined && source.get(tileIndex(map, x + direction.dx, y + direction.dy, z)) !== value)) setGenerated(changes, map, x, y, z, edgeTile, bounds);
                }
            }
        } else if (options.type === "dungeon" || options.type === "progressionDungeon") {
            for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) setGenerated(changes, map, x, y, z, options.tileA, bounds);
            const rooms = [];
            for (let i = 0; i < options.count; i++) {
                const w = clamp(3 + Math.floor(random() * 7), 3, Math.max(3, bounds.w - 2)); const h = clamp(3 + Math.floor(random() * 6), 3, Math.max(3, bounds.h - 2));
                const x = bounds.x + Math.floor(random() * Math.max(1, bounds.w - w)); const y = bounds.y + Math.floor(random() * Math.max(1, bounds.h - h));
                const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) }; rooms.push(room);
                for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) setGenerated(changes, map, px, py, z, options.tileB, bounds);
                if (rooms.length > 1) { const previous = rooms.at(-2); let px = previous.cx; let py = previous.cy; while (px !== room.cx) { setGenerated(changes, map, px, py, z, options.tileB, bounds); px += Math.sign(room.cx - px); } while (py !== room.cy) { setGenerated(changes, map, px, py, z, options.tileB, bounds); py += Math.sign(room.cy - py); } }
            }
            if (options.type === "progressionDungeon" && rooms.length > 2) {
                const doorTile = integer(options.doorTile, options.tileA); const goalTile = integer(options.goalTile, options.tileB);
                rooms.slice(1).forEach(room => setGenerated(changes, map, room.cx, room.cy, z, doorTile, bounds)); const goal = rooms.at(-1); if (goal) setGenerated(changes, map, goal.cx, goal.cy, z, goalTile, bounds);
                changes.progression = rooms.map((room, index) => ({ stage: index, x: room.cx, y: room.cy }));
            }
        } else if (options.type === "road" || options.type === "river" || options.type === "riverNetwork") {
            const start = options.start || [bounds.x, bounds.y + Math.floor(bounds.h / 2)]; const end = options.end || [bounds.x + bounds.w - 1, bounds.y + Math.floor(bounds.h / 2)];
            let [x, y] = start; let guard = bounds.w * bounds.h * 4;
            while (guard-- && (x !== end[0] || y !== end[1])) {
                setGenerated(changes, map, x, y, z, options.tileA, bounds);
                if (options.type === "river" && options.width > 1) setGenerated(changes, map, x + 1, y, z, options.tileA, bounds);
                if (options.type === "river") { const candidates = [[x, y + 1], [x - 1, y + 1], [x + 1, y + 1]]; [x, y] = candidates[Math.floor(random() * candidates.length)]; }
                else if (random() < .6 && x !== end[0]) x += Math.sign(end[0] - x); else if (y !== end[1]) y += Math.sign(end[1] - y); else x += Math.sign(end[0] - x);
                x = clamp(x, bounds.x, bounds.x + bounds.w - 1); y = clamp(y, bounds.y, bounds.y + bounds.h - 1);
            }
            setGenerated(changes, map, end[0], end[1], z, options.tileA, bounds);
            if (options.type === "riverNetwork") {
                const tributaries = Math.max(1, integer(options.tributaries, options.count));
                for (let branch = 0; branch < tributaries; branch++) { let bx = bounds.x + Math.floor(random() * bounds.w); let by = bounds.y; const targetX = bounds.x + Math.floor(bounds.w / 2); while (by < bounds.y + bounds.h) { setGenerated(changes, map, bx, by, z, options.tileA, bounds); by++; if (random() < .55) bx += Math.sign(targetX - bx); bx = clamp(bx, bounds.x, bounds.x + bounds.w - 1); } }
            }
        } else if (options.type === "scatter") {
            const total = options.count || Math.floor(bounds.w * bounds.h * options.density);
            for (let i = 0; i < total; i++) setGenerated(changes, map, bounds.x + Math.floor(random() * bounds.w), bounds.y + Math.floor(random() * bounds.h), z, random() < .5 ? options.tileA : options.tileB, bounds);
        } else if (options.type === "wfc") {
            return backtrackingWfc(map, bounds, options, z, random);
        } else if (options.type === "graph") {
            const graph = options.graph || JSON.parse($("generatorGraphField").value || "{\"nodes\":[]}");
            for (const node of graph.nodes || []) for (const [key, value] of runGenerator({ ...options, ...node.options, type: node.type || node.generator }).entries()) changes.set(key, value);
        }
        return changes;
    }
    function previewGenerator() {
        try { const options = generatorOptions(); const changes = runGenerator(options); state.preview = { options, changes }; setStatus(`Previewed ${changes.size} generated tile changes.`); renderEverything(); } catch (error) { reportError(error); }
    }
    function applyGenerator(event) {
        event?.preventDefault(); const document = activeDocument(); if (!document) return;
        try {
            if (!state.preview) previewGenerator(); if (!state.preview) return;
            const options = state.preview.options; addLayer(`${options.type} · ${options.seed}`); const layer = activeLayer(document); const action = beginAction(`Generate ${options.type}`, document);
            for (const [key, value] of state.preview.changes) layer.changes.set(key, value);
            document.modifiers.push({ id: uid("modifier"), name: `${options.type} ${options.seed}`, type: options.type, enabled: true, options: deepClone(options), layerId: layer.id, changeCount: state.preview.changes.size });
            state.preview = null; commitAction(action, document); renderEverything();
        } catch (error) { reportError(error); }
    }

    function setStudioModifierEnabled(modifierId, enabled) {
        const document = activeDocument();
        const modifier = document?.modifiers.find(item => item.id === modifierId);
        const layer = document?.authoringLayers.find(item => item.id === modifier?.layerId);
        if (!document || !modifier || !layer) return;
        modifier.enabled = enabled;
        layer.visible = enabled;
        markDirty(document);
        renderEverything();
    }

    function regenerateStudioModifier(modifierId) {
        const document = activeDocument();
        const modifier = document?.modifiers.find(item => item.id === modifierId);
        const layer = document?.authoringLayers.find(item => item.id === modifier?.layerId);
        if (!document || !modifier || !layer) return;
        if (layer.locked) return setStatus("Unlock the modifier layer before regenerating it.", true);
        const previousActive = document.activeLayerId;
        document.activeLayerId = layer.id;
        const action = beginAction(`Regenerate ${modifier.name}`, document);
        layer.changes = runGenerator(modifier.options);
        modifier.changeCount = layer.changes.size;
        modifier.updatedAt = Date.now();
        commitAction(action, document);
        document.activeLayerId = previousActive;
        renderEverything();
    }

    function validateMap(document = activeDocument()) {
        if (!document) return null; const map = composeMap(document); const issues = [];
        if (map.data.length !== map.width * map.height * 6) issues.push({ severity: "error", message: `Data length ${map.data.length} does not equal ${map.width * map.height * 6}.` });
        for (let index = 0; index < map.data.length; index++) if (!Number.isInteger(map.data[index]) || map.data[index] < 0) { issues.push({ severity: "error", message: `Invalid tile value at data index ${index}.` }); if (issues.length > 100) break; }
        const ids = new Set(); for (const event of map.events || []) if (event) {
            if (ids.has(event.id)) issues.push({ severity: "error", message: `Duplicate event ID ${event.id}.` }); ids.add(event.id);
            if (!inMap(map, event.x, event.y)) issues.push({ severity: "warning", message: `Event ${event.id} is outside the map.` });
            if (!Array.isArray(event.pages) || !event.pages.length) issues.push({ severity: "warning", message: `Event ${event.id} has no pages.` });
        }
        for (const layer of document.authoringLayers) for (const index of layer.changes.keys()) if (index < 0 || index >= map.data.length) issues.push({ severity: "warning", message: `${layer.name} has out-of-bounds change index ${index}.` });
        for (const [id, validator] of state.validators) try { for (const issue of validator({ map: deepClone(map), document, studio: window.HybridTileStudio }) || []) issues.push({ severity: issue.severity || "warning", message: `[${id}] ${issue.message || issue}` }); } catch (error) { issues.push({ severity: "error", message: `[${id}] Validator failed: ${error.message}` }); }
        document.validation = { ok: !issues.some(item => item.severity === "error"), issues, checkedAt: Date.now() };
        $("validationReport").className = `report padded ${document.validation.ok ? "ok" : "warning"}`;
        $("validationReport").innerHTML = `<strong>${document.validation.ok ? "Map is structurally valid" : "Validation found errors"}</strong><p>${issues.length} issue(s)</p>${issues.slice(0, 100).map(item => `<div>${item.severity.toUpperCase()}: ${escapeHtml(item.message)}</div>`).join("")}`;
        setStatus(`${document.name}: ${issues.length} validation issue(s).`); return document.validation;
    }

    async function readOptionalProjectJson(name, fallback = null) {
        if (!state.dataHandle) return fallback;
        try { return await readHandleJson(await state.dataHandle.getFileHandle(name)); } catch (_) { return fallback; }
    }
    async function projectDependencyAudit() {
        if (!state.dataHandle) throw new Error("Open a full project directory to audit dependencies.");
        const maps = new Map(); const infos = state.mapInfos.filter(Boolean); const issues = [];
        await runJob(`Loading ${infos.length} maps for dependency audit`, infos, async info => {
            try { maps.set(integer(info.id), state.documents.has(integer(info.id)) ? composeMap(state.documents.get(integer(info.id))) : await readHandleJson(await state.dataHandle.getFileHandle(mapFileName(info.id)))); }
            catch (error) { issues.push({ severity: "error", mapId: info.id, message: `Cannot read ${mapFileName(info.id)}: ${error.message}` }); }
        });
        const [commonEvents, system] = await Promise.all([readOptionalProjectJson("CommonEvents.json", []), readOptionalProjectJson("System.json", {})]);
        const mapIds = new Set(maps.keys()); const tilesetIds = new Set(state.tilesets.map((value, id) => value && id).filter(Boolean)); const pluginNames = new Set();
        if (state.projectHandle) try {
            const file = await (await (await getDirectory(state.projectHandle, "js")).getFileHandle("plugins.js")).getFile(); const text = await file.text(); const match = text.match(/\$plugins\s*=\s*(\[[\s\S]*\])\s*;/); if (match) for (const plugin of JSON.parse(match[1])) if (plugin?.status) pluginNames.add(plugin.name);
        } catch (_) { /* plugins.js is optional for loose audits */ }
        for (const [mapId, map] of maps) {
            if (!tilesetIds.has(integer(map.tilesetId))) issues.push({ severity: "error", mapId, message: `Tileset ${map.tilesetId} does not exist.` });
            const seenIds = new Set(); const occupied = new Map();
            for (const event of map.events || []) if (event) {
                if (seenIds.has(event.id)) issues.push({ severity: "error", mapId, eventId: event.id, message: `Duplicate event ID ${event.id}.` }); seenIds.add(event.id);
                if (!inMap(map, event.x, event.y)) issues.push({ severity: "error", mapId, eventId: event.id, message: `Event is outside map bounds at ${event.x},${event.y}.` });
                const key = `${event.x},${event.y}`; const at = occupied.get(key) || []; at.push(event.id); occupied.set(key, at);
                for (const page of event.pages || []) {
                    const condition = page.conditions || {};
                    if (condition.switch1Valid && !system.switches?.[condition.switch1Id]) issues.push({ severity: "warning", mapId, eventId: event.id, message: `Page references missing switch ${condition.switch1Id}.` });
                    if (condition.switch2Valid && !system.switches?.[condition.switch2Id]) issues.push({ severity: "warning", mapId, eventId: event.id, message: `Page references missing switch ${condition.switch2Id}.` });
                    if (condition.variableValid && !system.variables?.[condition.variableId]) issues.push({ severity: "warning", mapId, eventId: event.id, message: `Page references missing variable ${condition.variableId}.` });
                    for (const command of page.list || []) {
                        if (command.code === 201 && integer(command.parameters?.[0]) === 0) {
                            const targetId = integer(command.parameters?.[1]); const target = maps.get(targetId);
                            if (!mapIds.has(targetId)) issues.push({ severity: "error", mapId, eventId: event.id, message: `Transfer targets missing Map ${targetId}.` });
                            else if (target && !inMap(target, integer(command.parameters?.[2]), integer(command.parameters?.[3]))) issues.push({ severity: "error", mapId, eventId: event.id, message: `Transfer destination on Map ${targetId} is outside its bounds.` });
                        }
                        if (command.code === 117 && !commonEvents?.[integer(command.parameters?.[0])]) issues.push({ severity: "error", mapId, eventId: event.id, message: `Calls missing common event ${command.parameters?.[0]}.` });
                        if (command.code === 357 && pluginNames.size && !pluginNames.has(String(command.parameters?.[0]))) issues.push({ severity: "warning", mapId, eventId: event.id, message: `Calls disabled or missing plugin ${command.parameters?.[0]}.` });
                    }
                }
            }
            for (const [position, ids] of occupied) if (ids.length > 1) issues.push({ severity: "info", mapId, message: `Events ${ids.join(", ")} overlap at ${position}.` });
        }
        const errors = issues.filter(issue => issue.severity === "error").length; const warnings = issues.filter(issue => issue.severity === "warning").length;
        const report = { format: "HybridTileStudioDependencyAudit", version: 1, project: state.projectName, checkedAt: new Date().toISOString(), maps: maps.size, errors, warnings, issues };
        $("validationReport").className = `report padded ${errors ? "warning" : "ok"}`; $("validationReport").innerHTML = `<strong>${errors ? "Project dependency errors found" : "Project references are consistent"}</strong><p>${maps.size} maps · ${errors} errors · ${warnings} warnings</p>${issues.slice(0, 250).map(issue => `<div>${issue.severity.toUpperCase()} · Map ${issue.mapId || "—"}${issue.eventId ? ` E${issue.eventId}` : ""}: ${escapeHtml(issue.message)}</div>`).join("")}`;
        state.lastAudit = report; setStatus(`Dependency audit complete: ${errors} errors and ${warnings} warnings.`); return report;
    }

    async function projectSearch() {
        const query = $("projectSearchInput").value.trim(); if (!query) return;
        const records = []; const infos = state.mapInfos.filter(Boolean);
        await runJob(`Loading ${infos.length} maps`, infos, async info => {
            let map = state.documents.has(info.id) ? composeMap(state.documents.get(info.id)) : null;
            if (!map && state.dataHandle) { try { map = await readHandleJson(await state.dataHandle.getFileHandle(mapFileName(info.id))); } catch (_) { return; } }
            if (map) records.push({ mapId: info.id, name: info.name, map });
        });
        const fallback = () => { const results = []; const numeric = /^\d+$/.test(query) ? integer(query) : null; for (const record of records) { if (numeric !== null) { let count = 0; for (const value of record.map.data || []) if (integer(value) === numeric) count++; if (count) results.push({ mapId: record.mapId, name: record.name, detail: `${count} tile occurrence(s)` }); } for (const event of record.map.events || []) if (event && JSON.stringify(event).toLowerCase().includes(query.toLowerCase())) results.push({ mapId: record.mapId, name: record.name, eventId: event.id, detail: `Event ${event.id}: ${event.name}` }); } return results; };
        const results = await runWorkerJob("projectSearch", { query, records }, fallback);
        $("projectSearchResults").innerHTML = results.length ? results.slice(0, 500).map(result => `<button class="list-item" data-search-map="${result.mapId}" data-search-event="${result.eventId || 0}"><span>${escapeHtml(result.name)}</span><small>${escapeHtml(result.detail)}</small></button>`).join("") : '<div class="empty-state">No matches</div>';
        setStatus(`Project search found ${results.length} result(s).`);
    }
    async function replaceTilesProject() {
        const value = await openTextDialog("Replace project tiles", "Enter source and replacement tile IDs separated by a comma. Open maps are edited non-destructively; closed maps will be opened first.", "From, To", "0, 1");
        if (!value) return; const [from, to] = value.split(",").map(integer); let total = 0;
        for (const info of state.mapInfos.filter(Boolean)) {
            if (!state.documents.has(info.id) && state.dataHandle) await openMapByInfo(info.id);
            const document = state.documents.get(info.id); if (!document) continue; const map = composeMap(document); const layer = activeLayer(document); const action = beginAction(`Replace tile ${from} → ${to}`, document);
            for (let index = 0; index < map.data.length; index++) if (map.data[index] === from) { layer.changes.set(index, to); total++; }
            commitAction(action, document);
        }
        setStatus(`Replaced ${total} tile occurrence(s) across openable maps.`);
    }

    function compareMaps(base, incoming) {
        const differences = []; const max = Math.max(base?.data?.length || 0, incoming?.data?.length || 0);
        for (let index = 0; index < max; index++) if (integer(base?.data?.[index]) !== integer(incoming?.data?.[index])) differences.push({ type: "tile", index, current: integer(base?.data?.[index]), incoming: integer(incoming?.data?.[index]) });
        const eventMax = Math.max(base?.events?.length || 0, incoming?.events?.length || 0);
        for (let id = 1; id < eventMax; id++) if (JSON.stringify(base?.events?.[id] || null) !== JSON.stringify(incoming?.events?.[id] || null)) differences.push({ type: "event", eventId: id, current: base?.events?.[id] || null, incoming: incoming?.events?.[id] || null });
        return differences;
    }
    function setDiff(incoming, source) {
        const document = activeDocument(); if (!document) return; const current = composeMap(document); const differences = compareMaps(current, incoming);
        state.diff = { incoming, source, differences, selected: new Set(differences.map((_, index) => index)) };
        $("diffSummary").className = `report padded ${differences.length ? "warning" : "ok"}`; $("diffSummary").innerHTML = `<strong>${differences.length} difference(s)</strong><p>Compared with ${escapeHtml(source)}.</p>`;
        $("diffList").innerHTML = differences.slice(0, 1000).map((difference, index) => `<button class="diff-item selected" data-diff-index="${index}"><input type="checkbox" checked><code>${difference.type === "tile" ? `#${difference.index}: ${difference.current} → ${difference.incoming}` : `Event ${difference.eventId}`}</code></button>`).join("");
        $("acceptCurrentButton").disabled = $("acceptIncomingButton").disabled = $("exportChangeSetButton").disabled = !differences.length; renderCanvas();
    }
    function setThreeWayDiff(incoming, source) {
        const document = activeDocument(); if (!document) return;
        const base = document.baseMap; const ours = composeMap(document); const differences = [];
        const max = Math.max(base.data?.length || 0, ours.data?.length || 0, incoming.data?.length || 0);
        for (let index = 0; index < max; index++) {
            const baseValue = integer(base.data?.[index]); const current = integer(ours.data?.[index]); const next = integer(incoming.data?.[index]);
            if (current === next || next === baseValue) continue;
            differences.push({ type: "tile", index, base: baseValue, current, incoming: next,
                conflict: current !== baseValue && next !== baseValue });
        }
        const eventMax = Math.max(base.events?.length || 0, ours.events?.length || 0, incoming.events?.length || 0);
        for (let eventId = 1; eventId < eventMax; eventId++) {
            const baseValue = base.events?.[eventId] || null; const current = ours.events?.[eventId] || null; const next = incoming.events?.[eventId] || null;
            const [baseJson, currentJson, nextJson] = [baseValue, current, next].map(JSON.stringify);
            if (currentJson === nextJson || nextJson === baseJson) continue;
            differences.push({ type: "event", eventId, base: baseValue, current, incoming: next,
                conflict: currentJson !== baseJson && nextJson !== baseJson });
        }
        const conflicts = differences.filter(item => item.conflict).length;
        state.diff = { incoming, source, threeWay: true, differences, selected: new Set(differences.map((_, index) => index)) };
        $("diffSummary").className = `report padded ${conflicts ? "warning" : "ok"}`;
        $("diffSummary").innerHTML = `<strong>${differences.length} incoming change(s), ${conflicts} conflict(s)</strong><p>Base = opened map; current = authoring layers; incoming = ${escapeHtml(source)}.</p>`;
        $("diffList").innerHTML = differences.slice(0, 1000).map((difference, index) => `<button class="diff-item selected" data-diff-index="${index}"><input type="checkbox" checked><code>${difference.conflict ? "CONFLICT · " : ""}${difference.type === "tile" ? `#${difference.index}: ${difference.current} → ${difference.incoming}` : `Event ${difference.eventId}`}</code></button>`).join("");
        $("acceptCurrentButton").disabled = $("acceptIncomingButton").disabled = $("exportChangeSetButton").disabled = !differences.length;
    }
    function acceptIncomingDiff() {
        const document = activeDocument(); const layer = activeLayer(document); if (!document || !state.diff) return; const action = beginAction("Accept incoming differences", document);
        state.diff.differences.forEach((difference, index) => { if (!state.diff.selected.has(index)) return; if (difference.type === "tile") layer.changes.set(difference.index, difference.incoming); else layer.eventChanges.set(difference.eventId, deepClone(difference.incoming)); });
        commitAction(action, document); state.diff = null; clearDiffUi();
    }
    function clearDiffUi() { $("diffSummary").className = "report padded empty-state"; $("diffSummary").textContent = "Choose a comparison source."; $("diffList").innerHTML = ""; $("acceptCurrentButton").disabled = $("acceptIncomingButton").disabled = $("exportChangeSetButton").disabled = true; }

    function createSnapshot() {
        const document = activeDocument(); if (!document) return;
        state.snapshots.push({ id: uid("snapshot"), mapId: document.id, name: `${document.name} ${new Date().toLocaleString()}`, createdAt: Date.now(), map: composeMap(document) });
        saveWorkspaceMetadata().catch(reportError); renderSnapshotList(); setStatus("Project snapshot created.");
    }
    function renderSnapshotList() {
        const document = activeDocument(); const snapshots = state.snapshots.filter(snapshot => snapshot.mapId === document?.id);
        $("restoreSnapshotButton").disabled = !snapshots.length;
    }
    function restoreLatestSnapshot() {
        const document = activeDocument(); const snapshot = state.snapshots.filter(item => item.mapId === document?.id).at(-1); if (!document || !snapshot) return;
        addLayer(`Restore ${new Date(snapshot.createdAt).toLocaleString()}`); const layer = activeLayer(document); const current = composeMap(document); const action = beginAction("Restore snapshot", document);
        compareMaps(current, snapshot.map).forEach(difference => { if (difference.type === "tile") layer.changes.set(difference.index, difference.incoming); else layer.eventChanges.set(difference.eventId, deepClone(difference.incoming)); }); commitAction(action, document);
    }

    function captureBranchSnapshot() {
        return { capturedAt: Date.now(), documents: [...state.documents.values()].map(document => ({ id: document.id, activeLayerId: document.activeLayerId, authoringLayers: document.authoringLayers.map(serializeLayer), modifiers: deepClone(document.modifiers), masks: deepClone(document.masks) })) };
    }
    function ensureMainBranch() {
        if (!state.branches.some(branch => branch.id === "main")) state.branches.unshift({ id: "main", name: "main", createdAt: Date.now(), parentId: null, snapshot: captureBranchSnapshot() });
        if (!state.branches.some(branch => branch.id === state.activeBranchId)) state.activeBranchId = "main";
    }
    function saveActiveBranchSnapshot() { ensureMainBranch(); const branch = state.branches.find(item => item.id === state.activeBranchId); if (branch) { branch.snapshot = captureBranchSnapshot(); branch.updatedAt = Date.now(); } }
    function restoreBranchSnapshot(snapshot) {
        for (const saved of snapshot?.documents || []) {
            const document = state.documents.get(integer(saved.id)); if (!document) continue;
            document.authoringLayers = (saved.authoringLayers || []).map((layer, index) => ({ ...deepClone(layer), color: layer.color || layerColor(index), changes: new Map(layer.changes || []), eventChanges: new Map(layer.eventChanges || []) }));
            if (!document.authoringLayers.length) document.authoringLayers.push({ id: uid("layer"), name: "Main edits", visible: true, locked: false, opacity: 1, color: layerColor(0), changes: new Map(), eventChanges: new Map() });
            document.activeLayerId = document.authoringLayers.some(layer => layer.id === saved.activeLayerId) ? saved.activeLayerId : document.authoringLayers[0].id; document.modifiers = deepClone(saved.modifiers || []); document.masks = deepClone(saved.masks || []); document.dirty = true; document.revision++;
        }
    }
    async function createBranch() {
        const name = await openTextDialog("Create branch", "Create a workspace branch from the current authoring layers.", "Branch name", `branch-${state.branches.length + 1}`); if (!name) return;
        saveActiveBranchSnapshot(); const id = `${name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}-${Date.now().toString(36)}`; state.branches.push({ id, name, parentId: state.activeBranchId, createdAt: Date.now(), snapshot: captureBranchSnapshot() }); state.activeBranchId = id; await saveWorkspaceMetadata(); renderEverything(); setStatus(`Created and switched to branch ${name}.`);
    }
    async function switchBranch() {
        const id = $("branchSelect").value; const branch = state.branches.find(item => item.id === id); if (!branch || id === state.activeBranchId) return;
        saveActiveBranchSnapshot(); restoreBranchSnapshot(branch.snapshot); state.activeBranchId = id; await saveWorkspaceMetadata(); renderEverything(); setStatus(`Switched to branch ${branch.name}.`);
    }
    async function mergeSelectedBranch() {
        const source = state.branches.find(item => item.id === $("branchSelect").value); if (!source || source.id === state.activeBranchId) return setStatus("Choose another branch to merge.", true);
        let changes = 0; let events = 0;
        for (const saved of source.snapshot?.documents || []) {
            const document = state.documents.get(integer(saved.id)); if (!document) continue;
            const layer = { id: uid("layer"), name: `Merge ${source.name}`, visible: true, locked: false, opacity: 1, color: layerColor(document.authoringLayers.length), changes: new Map(), eventChanges: new Map() };
            for (const incoming of saved.authoringLayers || []) { for (const [index, value] of incoming.changes || []) { layer.changes.set(integer(index), integer(value)); changes++; } for (const [id, value] of incoming.eventChanges || []) { layer.eventChanges.set(integer(id), deepClone(value)); events++; } }
            if (layer.changes.size || layer.eventChanges.size) { document.authoringLayers.push(layer); document.activeLayerId = layer.id; document.dirty = true; document.revision++; }
        }
        await saveWorkspaceMetadata(); renderEverything(); setStatus(`Merged ${source.name}: ${changes} tile changes and ${events} event changes in reviewable layers.`);
    }
    function addReviewComment() {
        const text = $("reviewCommentField").value.trim(); const document = activeDocument(); if (!text || !document) return;
        const bounds = state.selection && (selectionBounds() || normalizeSelection(state.selection)); const comment = { id: uid("review"), branchId: state.activeBranchId, mapId: document.id, eventId: state.selectedEventId || 0, x: bounds?.x ?? null, y: bounds?.y ?? null, text, author: "Local reviewer", createdAt: Date.now(), resolved: false };
        state.reviewComments.push(comment); state.selectedReviewId = comment.id; $("reviewCommentField").value = ""; saveWorkspaceMetadata().catch(reportError); renderCollaboration();
    }
    function renderCollaboration() {
        if (!$("branchSelect")) return; ensureMainBranch();
        $("branchSelect").innerHTML = state.branches.map(branch => `<option value="${escapeHtml(branch.id)}"${branch.id === state.activeBranchId ? " selected" : ""}>${escapeHtml(branch.name)}${branch.id === state.activeBranchId ? " (active)" : ""}</option>`).join("");
        const comments = state.reviewComments.filter(comment => !state.activeId || integer(comment.mapId) === state.activeId);
        $("reviewList").className = `compact-list${comments.length ? "" : " empty-state"}`; $("reviewList").innerHTML = comments.length ? comments.map(comment => `<button class="list-item${comment.id === state.selectedReviewId ? " active" : ""}" data-review-id="${comment.id}"><span>${comment.resolved ? "✓ " : ""}${escapeHtml(comment.text)}</span><small>Map ${comment.mapId}${comment.eventId ? ` · E${comment.eventId}` : comment.x !== null ? ` · ${comment.x},${comment.y}` : ""}</small></button>`).join("") : "No review comments";
        $("resolveReviewButton").disabled = !state.selectedReviewId;
    }
    function selectReview(id) {
        const comment = state.reviewComments.find(item => item.id === id); if (!comment) return; state.selectedReviewId = id; activateDocument(comment.mapId); setTimeout(() => { if (comment.eventId) selectEvent(comment.eventId); else if (comment.x !== null) { state.selectionCells = null; state.selection = { x1: comment.x, y1: comment.y, x2: comment.x, y2: comment.y }; renderEverything(); } }, 50); renderCollaboration();
    }
    function resolveSelectedReview() { const comment = state.reviewComments.find(item => item.id === state.selectedReviewId); if (!comment) return; comment.resolved = !comment.resolved; saveWorkspaceMetadata().catch(reportError); renderCollaboration(); }

    async function runJob(name, items, worker) {
        if (state.job) throw new Error("Another background task is already running.");
        const job = state.job = { name, cancelled: false }; $("jobToast").classList.remove("hidden"); $("jobName").textContent = name; $("jobProgress").value = 0;
        try {
            for (let index = 0; index < items.length; index++) { if (job.cancelled) break; await worker(items[index], index); $("jobProgress").value = (index + 1) / Math.max(1, items.length); if (index % 5 === 0) await new Promise(resolve => requestAnimationFrame(resolve)); }
        } finally { state.job = null; $("jobToast").classList.add("hidden"); }
    }
    function runWorkerJob(type, payload, fallback) {
        if (typeof Worker !== "function" || /HappyDOM/i.test(navigator.userAgent || "")) return Promise.resolve().then(fallback);
        return new Promise(resolve => {
            const worker = new Worker("HybridTileWorker.js"); const id = uid("worker"); let settled = false;
            const finish = value => { if (settled) return; settled = true; worker.terminate(); resolve(value); };
            const timer = setTimeout(() => finish(fallback()), 30000);
            worker.onmessage = event => { if (event.data?.id !== id) return; clearTimeout(timer); finish(event.data.ok ? event.data.result : fallback()); };
            worker.onerror = () => { clearTimeout(timer); finish(fallback()); }; worker.postMessage({ id, type, payload });
        });
    }

    function openTextDialog(title, description, label, initial = "", multiline = false) {
        const dialog = $("textDialog"); $("dialogTitle").textContent = title; $("dialogDescription").textContent = description; $("dialogLabel").childNodes[0].textContent = label;
        $("dialogInput").classList.toggle("hidden", multiline); $("dialogTextarea").classList.toggle("hidden", !multiline); (multiline ? $("dialogTextarea") : $("dialogInput")).value = initial;
        dialog.showModal();
        return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm" ? (multiline ? $("dialogTextarea").value : $("dialogInput").value).trim() : null), { once: true }));
    }
    async function workspaceMenu() {
        const action = await openTextDialog("Workspace", "Choose: export, canonical-export, import, save-metadata, extensions, or git-status", "Action", "export");
        if (action === "export") exportWorkspace();
        else if (action === "canonical-export") exportCanonicalWorkspace();
        else if (action === "import") $("singleMapFileInput").dataset.purpose = "workspace", $("singleMapFileInput").click();
        else if (action === "save-metadata") await saveWorkspaceMetadata(), setStatus("Workspace metadata saved.");
        else if (action === "extensions") setStatus(`${state.extensions.size} extension(s): ${[...state.extensions.keys()].join(", ") || "none"}.`);
        else if (action === "git-status") setStatus(await gitStatus());
    }

    function canonicalize(value) {
        if (Array.isArray(value)) return value.map(canonicalize);
        if (value && typeof value === "object") { const output = {}; for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]); return output; }
        return value;
    }
    function canonicalWorkspaceText() { return `${JSON.stringify(canonicalize(workspaceMetadata()), null, 2)}\n`; }
    function exportCanonicalWorkspace() { download(`HybridTileStudio-${state.projectName}.canonical.json`, canonicalWorkspaceText()); }
    async function gitStatus() {
        if (window.hybridTileNative?.gitStatus && state.projectHandle?.path) return window.hybridTileNative.gitStatus(state.projectHandle.path);
        if (!state.projectHandle?.path || typeof window.require !== "function") return "Git helper needs the packaged desktop app or an NW.js directory handle with a local path.";
        return new Promise((resolve, reject) => window.require("child_process").execFile("git", ["status", "--short"], { cwd: state.projectHandle.path }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim() || "Git working tree is clean.")));
    }
    function registerExtension(manifest, activate = null) {
        if (!manifest || typeof manifest !== "object" || !manifest.id) throw new Error("Extensions need a unique manifest.id.");
        const id = String(manifest.id); if (state.extensions.has(id)) throw new Error(`Extension ${id} is already registered.`);
        const record = { id, name: String(manifest.name || id), version: String(manifest.version || "0.0.0"), description: String(manifest.description || ""), capabilities: deepClone(Array.isArray(manifest.capabilities) ? manifest.capabilities : []), permissions: deepClone(Array.isArray(manifest.permissions) ? manifest.permissions : []), registeredAt: Date.now() };
        state.extensions.set(id, record); const callback = activate || manifest.activate; if (typeof callback === "function") callback(window.HybridTileStudio); document.dispatchEvent(new CustomEvent("HybridTileStudio:extension", { detail: deepClone(record) })); return deepClone(record);
    }
    function registerBrush(id, callback) { if (!id || typeof callback !== "function") throw new Error("registerBrush requires an id and callback."); state.brushes.set(String(id), callback); return () => state.brushes.delete(String(id)); }
    function applyExtensionBrush(id, x, y, options = {}) {
        const callback = state.brushes.get(String(id)); const document = activeDocument(); const map = composeMap(document); if (!callback || !document || !map) return false;
        const action = beginAction(`Extension brush: ${id}`, document); const layer = activeLayer(document); const result = callback({ x: integer(x), y: integer(y), map: deepClone(map), options: deepClone(options), tileId: state.tileId, layer: state.tileLayer }) || [];
        for (const item of result) if (inMap(map, integer(item.x), integer(item.y))) layer.changes.set(tileIndex(map, integer(item.x), integer(item.y), clamp(integer(item.layer, state.tileLayer), 0, 5)), integer(item.tileId));
        return commitAction(action, document);
    }
    function registerGenerator(id, callback) { if (!id || typeof callback !== "function") throw new Error("registerGenerator requires an id and callback."); state.generators.set(String(id), callback); if (![...$("generatorType").options].some(option => option.value === String(id))) { const option = document.createElement("option"); option.value = String(id); option.textContent = `Extension: ${id}`; $("generatorType").append(option); } return () => state.generators.delete(String(id)); }
    function registerValidator(id, callback) { if (!id || typeof callback !== "function") throw new Error("registerValidator requires an id and callback."); state.validators.set(String(id), callback); return () => state.validators.delete(String(id)); }
    function studioStateSnapshot() { return { version: VERSION, projectName: state.projectName, projectOpen: !!state.projectHandle, activeMapId: state.activeId, tool: state.tool, view: { zoom: state.zoom, panX: state.panX, panY: state.panY, overlay: state.overlay, grid: state.grid }, selection: deepClone(state.selection), selectionCells: state.selectionCells ? [...state.selectionCells] : null, clipboard: deepClone(state.projectClipboard), selectedEventId: state.selectedEventId, selectedEventPage: state.selectedEventPage, selectedEventCommand: state.selectedEventCommand, branches: state.branches.map(({ id, name, parentId, createdAt }) => ({ id, name, parentId, createdAt })), activeBranchId: state.activeBranchId, recoveryPolicy: deepClone(state.recoveryPolicy), locale: state.locale, renderSettings: deepClone(state.renderSettings), extensions: [...state.extensions.values()].map(deepClone) }; }
    function extensionData(namespace, fallback = {}) { return deepClone(state.extensionData[String(namespace)] ?? fallback); }
    async function setExtensionData(namespace, value) { state.extensionData[String(namespace)] = deepClone(value); await saveWorkspaceMetadata(); return extensionData(namespace); }
    async function ensureDocument(mapId) { const id = integer(mapId); if (!state.documents.has(id)) await openMapByInfo(id); return state.documents.get(id) || null; }
    async function mapSnapshot(mapId = state.activeId) { const document = await ensureDocument(mapId); return deepClone(composeMap(document)); }
    function activeEventSnapshot() { return deepClone(currentEvent()); }
    async function updateEventSnapshot(event, label = "Edit event", mapId = state.activeId) { const document = await ensureDocument(mapId); const layer = activeLayer(document); if (!document || !layer || layer.locked) throw new Error("A writable authoring layer is required."); const action = beginAction(label, document); layer.eventChanges.set(integer(event.id), deepClone(event)); commitAction(action, document); if (document.id === state.activeId) selectEvent(event.id); return deepClone(event); }
    async function removeEventSnapshot(eventId, label = "Delete event", mapId = state.activeId) { const document = await ensureDocument(mapId); const layer = activeLayer(document); if (!document || !layer || layer.locked) throw new Error("A writable authoring layer is required."); const action = beginAction(label, document); layer.eventChanges.set(integer(eventId), null); commitAction(action, document); return true; }
    function setStudioSelection(rect, cells = null) { state.selectionCells = cells ? new Set(cells.map(value => Array.isArray(value) ? `${value[0]},${value[1]}` : String(value))) : null; state.selection = rect ? { x1: integer(rect.x1 ?? rect.x), y1: integer(rect.y1 ?? rect.y), x2: integer(rect.x2 ?? ((rect.x || 0) + (rect.w || 1) - 1)), y2: integer(rect.y2 ?? ((rect.y || 0) + (rect.h || 1) - 1)) } : null; renderEverything(); return deepClone(state.selection); }
    async function pasteClipboardAt(clipboard, x, y, mapId = state.activeId) { await ensureDocument(mapId); activateDocument(mapId); state.projectClipboard = deepClone(clipboard); setStudioSelection({ x: integer(x), y: integer(y), w: 1, h: 1 }); return pasteStudioClipboard(); }
    async function applyMapSnapshot(snapshot, label = "Restore map snapshot", mapId = state.activeId) { const document = await ensureDocument(mapId); activateDocument(mapId); addLayer(label); const layer = activeLayer(document); const current = composeMap(document); const action = beginAction(label, document); for (const difference of compareMaps(current, snapshot)) if (difference.type === "tile") layer.changes.set(difference.index, difference.incoming); else layer.eventChanges.set(difference.eventId, deepClone(difference.incoming)); commitAction(action, document); return true; }
    function createStudioSnapshot(name = "Project snapshot", mapId = state.activeId) { const document = state.documents.get(integer(mapId)); if (!document) return false; const snapshot = { id: uid("snapshot"), mapId: document.id, name, createdAt: Date.now(), map: composeMap(document), checksum: checksum(composeMap(document)) }; state.snapshots.push(snapshot); saveWorkspaceMetadata().catch(reportError); renderSnapshotList(); return deepClone({ id: snapshot.id, mapId: snapshot.mapId, name: snapshot.name, createdAt: snapshot.createdAt, checksum: snapshot.checksum }); }
    function listStudioSnapshots(mapId = 0) { return state.snapshots.filter(item => !integer(mapId) || item.mapId === integer(mapId)).map(item => ({ id: item.id, mapId: item.mapId, name: item.name, createdAt: item.createdAt, checksum: item.checksum || checksum(item.map) })); }
    function updateRecoveryPolicy(changes = {}) { state.recoveryPolicy = { ...state.recoveryPolicy, ...deepClone(changes), retain: Math.max(1, integer(changes.retain, state.recoveryPolicy.retain)), snapshotMinutes: Math.max(0, integer(changes.snapshotMinutes, state.recoveryPolicy.snapshotMinutes)) }; saveWorkspaceMetadata().catch(reportError); return deepClone(state.recoveryPolicy); }
    function updateStudioSettings(changes = {}) { if (changes.locale) state.locale = String(changes.locale); state.renderSettings = { ...state.renderSettings, ...(changes.renderSettings || {}) }; document.documentElement.classList.toggle("high-contrast", !!state.renderSettings.highContrast); document.documentElement.classList.toggle("reduced-motion", !!state.renderSettings.reducedMotion); saveWorkspaceMetadata().catch(reportError); return { locale: state.locale, renderSettings: deepClone(state.renderSettings) }; }
    async function gitCommand(args) { if (!window.hybridTileNative?.git || !state.projectHandle?.path) throw new Error("Git workspace requires the packaged desktop app."); return window.hybridTileNative.git(state.projectHandle.path, args); }
    function projectInfo() { return { name: state.projectName, open: !!state.projectHandle, maps: state.mapInfos.filter(Boolean).map(info => ({ id: info.id, name: info.name, parentId: info.parentId || 0 })), tilesets: deepClone(state.tilesets.filter(Boolean)), native: !!window.hybridTileNative }; }

    window.HybridTileStudio = Object.freeze({ version: VERSION, openProject, openProjectHandle, openNativeProject, launchPlaytest, openMapFiles: openLooseFiles, activateMap: activateDocument, save: saveDocument, saveAll: saveAllAtomic, recover: () => resolveRecoveryJournal("recover"), rollback: () => resolveRecoveryJournal("rollback"), validate: validateMap, auditProject: projectDependencyAudit, copySelection: copyStudioSelection, pasteSelection: pasteStudioClipboard, pasteClipboardAt, transformClipboard: transformStudioClipboard, setSelection: setStudioSelection, mapSnapshot, activeEvent: activeEventSnapshot, updateEvent: updateEventSnapshot, removeEvent: removeEventSnapshot, applyMapSnapshot, createSnapshot: createStudioSnapshot, listSnapshots: listStudioSnapshots, learnWfcRules, runGenerator, runWorker: (type, payload, fallback = () => null) => runWorkerJob(type, payload, fallback), tileSource: value => deepClone(tileSource(value)), autotileLayout: value => deepClone(autotileLayout(value)), drawTile: (target, tileId, x, y, size = 48, alpha = 1) => drawTile(target, tileId, x, y, size, alpha), masks: () => deepClone(activeDocument()?.masks || []), createBranch, switchBranch, mergeSelectedBranch, exportCanonicalWorkspace, canonicalWorkspaceText, projectInfo, readProjectText, readProjectJson, writeProjectText, writeProjectJson, projectFileUrl, projectEntryExists, listProjectDirectory, renameProjectEntry, removeProjectEntry, checksum, download, status: setStatus, getExtensionData: extensionData, setExtensionData, setRecoveryPolicy: updateRecoveryPolicy, setSettings: updateStudioSettings, saveMetadata: saveWorkspaceMetadata, gitStatus, git: gitCommand, registerExtension, registerBrush, applyBrush: applyExtensionBrush, registerGenerator, registerValidator, state: studioStateSnapshot });

    function wireUi() {
        $("openProjectButton").onclick = () => openProject().catch(reportError);
        $("openMapFilesButton").onclick = () => $("mapFileInput").click();
        $("mapFileInput").onchange = event => openLooseFiles([...event.target.files]);
        $("saveButton").onclick = () => saveDocument().catch(reportError); $("saveAllButton").onclick = () => saveAll().catch(reportError);
        $("undoButton").onclick = undo; $("redoButton").onclick = redo; $("validateButton").onclick = () => validateMap(); $("workspaceButton").onclick = () => workspaceMenu().catch(reportError);
        $("mapSearch").oninput = renderMapTree; $("mapTree").onclick = event => { const button = event.target.closest("[data-map-id]"); if (button) activateDocument(button.dataset.mapId); };
        $("tabBar").onclick = event => { const close = event.target.closest("[data-close-id]"); if (close) return closeDocument(integer(close.dataset.closeId)); const tab = event.target.closest("[data-tab-id]"); if (tab) activateDocument(tab.dataset.tabId); };
        $("toolButtons").onclick = event => { const button = event.target.closest("[data-tool]"); if (button) setTool(button.dataset.tool); };
        $("tileLayerSelect").onchange = event => state.tileLayer = integer(event.target.value); $("tileIdInput").onchange = event => { state.tileId = Math.max(0, integer(event.target.value)); renderPalette(); }; $("brushSizeInput").onchange = event => state.brushSize = clamp(integer(event.target.value), 1, 16);
        $("gridButton").onclick = () => { state.grid = !state.grid; renderEverything(); }; $("overlaySelect").onchange = event => { state.overlay = event.target.value; renderCanvas(); };
        $("zoomInButton").onclick = () => { state.zoom = clamp(state.zoom * 1.25, .1, 4); renderEverything(); }; $("zoomOutButton").onclick = () => { state.zoom = clamp(state.zoom / 1.25, .1, 4); renderEverything(); }; $("fitButton").onclick = fitMap;
        $("copySelectionButton").onclick = () => copyStudioSelection(true);
        $("pasteSelectionButton").onclick = pasteStudioClipboard;
        $("rotateClipboardButton").onclick = () => { transformStudioClipboard(90, false); updateChrome(); renderCanvas(); };
        $("mirrorClipboardButton").onclick = () => { transformStudioClipboard(0, true); updateChrome(); renderCanvas(); };
        canvas.onpointerdown = handlePointerDown; canvas.onpointermove = handlePointerMove; canvas.onpointerup = handlePointerUp; canvas.onpointercancel = handlePointerUp;
        canvas.ondblclick = event => {
            if (state.tool !== "polygon" || !state.polygonPoints?.length) return;
            event.preventDefault();
            const map = composeMap();
            state.selectionCells = polygonSelection(state.polygonPoints, map);
            const bounds = selectionBounds();
            state.selection = bounds ? { x1: bounds.x, y1: bounds.y, x2: bounds.x + bounds.w - 1, y2: bounds.y + bounds.h - 1 } : null;
            state.pointer = null; state.polygonPoints = null;
            renderEverything();
        };
        canvas.onwheel = event => { event.preventDefault(); const before = screenToMap(event.clientX, event.clientY); state.zoom = clamp(state.zoom * (event.deltaY < 0 ? 1.12 : .89), .1, 4); const rect = canvas.getBoundingClientRect(); const size = tileScreenSize(); state.panX = event.clientX - rect.left - before.x * size; state.panY = event.clientY - rect.top - before.y * size; renderEverything(); };
        $("sheetSelect").onchange = event => { state.paletteSheet = event.target.value; renderPalette(); }; $("tileFilterInput").oninput = renderPalette; $("tilePalette").onclick = event => { const button = event.target.closest("[data-tile-id]"); if (button) { state.tileId = integer(button.dataset.tileId); $("tileIdInput").value = state.tileId; setTool("paint"); renderPalette(); } };
        $("inspectorTabs").onclick = event => { const button = event.target.closest("[data-panel]"); if (!button) return; document.querySelectorAll("#inspectorTabs button").forEach(item => item.classList.toggle("active", item === button)); document.querySelectorAll(".inspector-panel").forEach(panel => panel.classList.toggle("active", panel.id === button.dataset.panel)); };
        $("addLayerButton").onclick = async () => { const name = await openTextDialog("New authoring layer", "Layers keep edits non-destructive until you save the map.", "Layer name", `Layer ${activeDocument().authoringLayers.length + 1}`); if (name) addLayer(name); };
        $("duplicateLayerButton").onclick = duplicateLayer; $("mergeLayerButton").onclick = mergeLayerDown; $("moveLayerUpButton").onclick = () => moveLayer(1); $("moveLayerDownButton").onclick = () => moveLayer(-1); $("exportLayerButton").onclick = exportActiveLayer; $("deleteLayerButton").onclick = deleteLayer; $("createMaskButton").onclick = createMask;
        $("authoringLayerList").onclick = event => { const visible = event.target.closest("[data-layer-visible]"); const lock = event.target.closest("[data-layer-lock]"); const item = event.target.closest("[data-layer-id]"); const document = activeDocument(); if (!document) return; if (visible) { const layer = document.authoringLayers.find(value => value.id === visible.dataset.layerVisible); layer.visible = visible.checked; markDirty(document); } else if (lock) { const layer = document.authoringLayers.find(value => value.id === lock.dataset.layerLock); layer.locked = lock.checked; markDirty(document); } else if (item) document.activeLayerId = item.dataset.layerId; renderEverything(); };
        $("authoringLayerList").oninput = event => { const opacity = event.target.closest("[data-layer-opacity]"); const document = activeDocument(); if (!opacity || !document) return; const layer = document.authoringLayers.find(value => value.id === opacity.dataset.layerOpacity); if (layer) { layer.opacity = clamp(Number(opacity.value), 0, 1); markDirty(document); } };
        $("tileLayerControls").oninput = event => { if (event.target.dataset.tileVisible !== undefined) state.tileLayerVisibility[integer(event.target.dataset.tileVisible)] = event.target.checked; if (event.target.dataset.tileOpacity !== undefined) state.tileLayerOpacity[integer(event.target.dataset.tileOpacity)] = Number(event.target.value); renderCanvas(); };
        $("eventSearchInput").oninput = renderEvents; $("eventList").onclick = event => { const item = event.target.closest("[data-event-id]"); if (item) selectEvent(item.dataset.eventId); }; $("eventForm").onsubmit = saveEventForm; $("addEventButton").onclick = addEvent; $("duplicateEventButton").onclick = duplicateSelectedEvent; $("deleteEventButton").onclick = deleteSelectedEvent;
        $("eventPageSelect").onchange = event => { state.selectedEventPage = integer(event.target.value); state.selectedEventCommand = 0; renderVisualEventEditor(); };
        $("eventCommandList").onchange = event => { state.selectedEventCommand = integer(event.target.value); renderVisualEventEditor(); };
        for (const id of ["eventTriggerField", "eventPriorityField", "eventMoveTypeField"]) $(id).onchange = () => { try { updateEventPageSettings(); } catch (error) { reportError(error); } };
        $("eventConditionsField").onchange = () => { try { updateEventPageSettings(); } catch (error) { reportError(new Error(`Page conditions are invalid: ${error.message}`)); } };
        $("eventPageAddButton").onclick = () => addEventPage(false); $("eventPageDuplicateButton").onclick = () => addEventPage(true); $("eventPageDeleteButton").onclick = () => { try { deleteEventPage(); } catch (error) { reportError(error); } };
        $("eventCommandAddButton").onclick = () => { try { addEventCommand(); } catch (error) { reportError(new Error(`Command parameters are invalid: ${error.message}`)); } };
        $("eventCommandUpdateButton").onclick = () => { try { updateEventCommand(); } catch (error) { reportError(new Error(`Command update failed: ${error.message}`)); } };
        $("eventCommandDeleteButton").onclick = () => { try { deleteEventCommand(); } catch (error) { reportError(error); } };
        $("eventTransferPickButton").onclick = () => { const command = currentEventPage()?.list?.[state.selectedEventCommand]; if (command?.code !== 201) return setStatus("Select a Transfer Player command first.", true); state.transferPick = { mapId: state.activeId, eventId: state.selectedEventId, pageIndex: state.selectedEventPage, commandIndex: state.selectedEventCommand }; setTool("transferPick"); setStatus("Open a destination map and click its target tile."); };
        $("previewGeneratorButton").onclick = previewGenerator; $("generatorForm").onsubmit = applyGenerator; $("cancelPreviewButton").onclick = () => { state.preview = null; renderEverything(); };
        $("learnWfcButton").onclick = () => { const rules = learnWfcRules(); if (!rules) return; $("generatorOptions").value = JSON.stringify({ rules, maxBacktracks: 128 }, null, 2); $("generatorType").value = "wfc"; setStatus(`Learned WFC adjacency for ${rules.palette.length} tile(s).`); };
        $("exportRulesButton").onclick = () => { if (!state.learnedWfcRules) return setStatus("Learn WFC rules from the current map first.", true); download(`HybridTileStudio-WFC-Map${state.activeId}.json`, JSON.stringify(state.learnedWfcRules, null, 2)); };
        $("modifierList").onclick = event => {
            const document = activeDocument(); if (!document) return;
            const toggle = event.target.closest("[data-modifier-visible]");
            const regenerate = event.target.closest("[data-modifier-regenerate]");
            const remove = event.target.closest("[data-modifier-remove]");
            if (toggle) setStudioModifierEnabled(toggle.dataset.modifierVisible, toggle.checked);
            else if (regenerate) regenerateStudioModifier(regenerate.dataset.modifierRegenerate);
            else if (remove) {
                const modifier = document.modifiers.find(item => item.id === remove.dataset.modifierRemove);
                const layer = document.authoringLayers.find(item => item.id === modifier?.layerId);
                if (layer) { document.authoringLayers.splice(document.authoringLayers.indexOf(layer), 1); if (document.activeLayerId === layer.id) document.activeLayerId = document.authoringLayers[0]?.id; }
                document.modifiers = document.modifiers.filter(item => item.id !== remove.dataset.modifierRemove);
                markDirty(document); renderEverything();
            }
        };
        $("createSnapshotButton").onclick = createSnapshot; $("restoreSnapshotButton").onclick = restoreLatestSnapshot; $("clearHistoryButton").onclick = () => { const document = activeDocument(); if (document) document.undo.length = document.redo.length = 0; renderEverything(); };
        $("atomicSaveButton").onclick = () => saveAllAtomic().catch(reportError); $("recoverJournalButton").onclick = () => resolveRecoveryJournal("recover").catch(reportError); $("rollbackJournalButton").onclick = () => resolveRecoveryJournal("rollback").catch(reportError); $("dependencyAuditButton").onclick = () => projectDependencyAudit().catch(reportError);
        $("projectSearchButton").onclick = () => projectSearch().catch(reportError); $("projectSearchResults").onclick = event => { const item = event.target.closest("[data-search-map]"); if (item) activateDocument(item.dataset.searchMap), setTimeout(() => selectEvent(item.dataset.searchEvent), 100); }; $("replaceTilesButton").onclick = () => replaceTilesProject().catch(reportError);
        $("addBookmarkButton").onclick = async () => { const document = activeDocument(); if (!document) return; const position = state.selection ? normalizeSelection(state.selection) : { x: 0, y: 0 }; const name = await openTextDialog("Add bookmark", "Save this map position for quick navigation.", "Bookmark name", `${document.name} ${position.x},${position.y}`); if (name) { state.bookmarks.push({ id: uid("bookmark"), project: state.projectName, mapId: document.id, x: position.x, y: position.y, name }); saveWorkspaceMetadata().catch(reportError); renderBookmarks(); } };
        $("maskList").onclick = event => { const item = event.target.closest("[data-mask-id]"); const document = activeDocument(); const mask = document?.masks.find(value => value.id === item?.dataset.maskId); if (mask?.points.length) { const xs = mask.points.map(point => point[0]); const ys = mask.points.map(point => point[1]); state.selection = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }; renderEverything(); } };
        $("bookmarkList").onclick = event => { const item = event.target.closest("[data-bookmark-map]"); if (!item) return; const bookmark = state.bookmarks.find(value => value.mapId === integer(item.dataset.bookmarkMap)); activateDocument(item.dataset.bookmarkMap); if (bookmark) setTimeout(() => { const stage = $("canvasStage").getBoundingClientRect(); const size = tileScreenSize(); state.panX = stage.width / 2 - bookmark.x * size; state.panY = stage.height / 2 - bookmark.y * size; renderCanvas(); }, 50); };
        $("diffBaseButton").onclick = () => { const document = activeDocument(); if (document) setDiff(document.baseMap, "opened base map"); }; $("diffFileButton").onclick = () => { $("singleMapFileInput").dataset.purpose = "diff"; $("singleMapFileInput").click(); }; $("threeWayButton").onclick = () => { $("singleMapFileInput").dataset.purpose = "three-way"; $("singleMapFileInput").click(); };
        $("singleMapFileInput").onchange = async event => { const file = event.target.files[0]; if (!file) return; try { const value = await readJsonFile(file); if (event.target.dataset.purpose === "workspace") await importWorkspaceFile(file); else if (event.target.dataset.purpose === "three-way") setThreeWayDiff(value, file.name); else setDiff(value, file.name); } catch (error) { reportError(error); } event.target.value = ""; };
        $("diffList").onclick = event => { const item = event.target.closest("[data-diff-index]"); if (!item || !state.diff) return; const index = integer(item.dataset.diffIndex); if (state.diff.selected.has(index)) state.diff.selected.delete(index); else state.diff.selected.add(index); item.classList.toggle("selected", state.diff.selected.has(index)); item.querySelector("input").checked = state.diff.selected.has(index); };
        $("acceptIncomingButton").onclick = acceptIncomingDiff; $("acceptCurrentButton").onclick = () => { state.diff = null; clearDiffUi(); }; $("exportChangeSetButton").onclick = () => { if (!state.diff) return; const selected = state.diff.differences.filter((_, index) => state.diff.selected.has(index)); download("HybridTileStudio-diff.htg-changeset.json", JSON.stringify({ format: "HybridTileStudioDiff", version: 1, mapId: state.activeId, differences: selected }, null, 2)); };
        $("createBranchButton").onclick = () => createBranch().catch(reportError); $("switchBranchButton").onclick = () => switchBranch().catch(reportError); $("mergeBranchButton").onclick = () => mergeSelectedBranch().catch(reportError); $("addReviewCommentButton").onclick = addReviewComment; $("resolveReviewButton").onclick = resolveSelectedReview; $("reviewList").onclick = event => { const item = event.target.closest("[data-review-id]"); if (item) selectReview(item.dataset.reviewId); };
        $("cancelJobButton").onclick = () => { if (state.job) state.job.cancelled = true; };
        $("refreshMapsButton").onclick = () => refreshProjectMaps().catch(reportError);
        document.body.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
        document.body.addEventListener("drop", async event => {
            event.preventDefault();
            try {
                const items = [...(event.dataTransfer?.items || [])];
                for (const item of items) if (item.getAsFileSystemHandle) { const handle = await item.getAsFileSystemHandle(); if (handle?.kind === "directory") return openProjectHandle(handle); }
                const files = [...(event.dataTransfer?.files || [])].filter(file => /\.json$/i.test(file.name)); if (files.length) await openLooseFiles(files);
            } catch (error) { reportError(error); }
        });
        window.addEventListener("resize", renderCanvas);
        window.addEventListener("keydown", event => {
            if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
            if (event.ctrlKey && event.key.toLowerCase() === "s") { event.preventDefault(); saveDocument().catch(reportError); }
            else if (event.ctrlKey && event.key.toLowerCase() === "c") { event.preventDefault(); copyStudioSelection(true); }
            else if (event.ctrlKey && event.key.toLowerCase() === "v") { event.preventDefault(); pasteStudioClipboard(); }
            else if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
            else if (event.ctrlKey && (event.key.toLowerCase() === "y" || event.shiftKey && event.key.toLowerCase() === "z")) { event.preventDefault(); redo(); }
            else if (event.key === " ") state.spacePan = true;
            else ({ s: "select", l: "lasso", o: "polygon", w: "wand", q: "regionSelect", p: "paint", e: "erase", r: "rectangle", n: "line", c: "ellipse", g: "scatterBrush", f: "fill", i: "eyedropper", v: "event" })[event.key.toLowerCase()] && setTool(({ s: "select", l: "lasso", o: "polygon", w: "wand", q: "regionSelect", p: "paint", e: "erase", r: "rectangle", n: "line", c: "ellipse", g: "scatterBrush", f: "fill", i: "eyedropper", v: "event" })[event.key.toLowerCase()]);
        });
        window.addEventListener("keyup", event => { if (event.key === " ") state.spacePan = false; });
        window.addEventListener("beforeunload", event => { if ([...state.documents.values()].some(document => document.dirty)) { event.preventDefault(); event.returnValue = ""; } });
    }

    wireUi();
    renderPalette();
    renderEverything();
    if (!/HappyDOM/i.test(navigator.userAgent || "")) {
        const animationTimer = window.setInterval(() => { state.animationFrame++; if (activeDocument() && state.tilesetImages.size) renderCanvas(); }, 500);
        if (animationTimer && typeof animationTimer.unref === "function") animationTimer.unref();
    }
    if (globalThis.HybridTilePwaV18?.register) globalThis.HybridTilePwaV18.register().catch(error => console.warn("Hybrid Tile Studio service worker:", error));
    setStatus(`Hybrid Tile Studio ${VERSION} ready.`);
})();
