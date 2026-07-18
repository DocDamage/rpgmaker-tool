/* Hybrid Tile Studio v17 — First-Party Polish */
(() => {
    "use strict";

    const api = window.HybridTileStudio;
    if (!api) return;

    const VERSION = "17.0.0";
    const $ = id => document.getElementById(id);
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const list = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
    const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const safeId = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
    const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
    const hash = value => api.checksum ? api.checksum(value) : `size-${JSON.stringify(value).length}`;
    const safe = callback => async event => {
        event?.preventDefault?.();
        try { await callback(event); }
        catch (error) { console.error(error); notify(error?.message || String(error), "error"); }
    };

    const VIEWS = [
        ["home", "Home", "⌂", "beginner"],
        ["create", "Create", "▦", "beginner"],
        ["world", "World", "✦", "guided"],
        ["test", "Test", "▶", "beginner"],
        ["release", "Release", "↑", "beginner"],
        ["library", "Library", "▤", "guided"],
        ["settings", "Settings", "⚙", "guided"],
        ["advanced", "Advanced", "◆", "expert"]
    ];

    const defaults = {
        view: "home",
        mode: "guided",
        sound: true,
        controller: true,
        controllerLayout: "auto",
        reducedMotion: false,
        highContrast: false,
        uiScale: 1,
        map: { selectedId: 0, tool: "paint", layer: 0, tileId: 2048, brushSize: 1, overlay: "events", zoom: 1, palette: "A", palettePage: 0, cursorX: 0, cursorY: 0 },
        worldTab: "recipes",
        recipe: {
            id: "main-world",
            name: "Main World",
            seed: "worldsmith",
            stages: [
                { id: "terrain", type: "biome", name: "Shape terrain", layer: 0, tileA: 2048, tileB: 2816, density: .5, count: 8 },
                { id: "roads", type: "road", name: "Connect roads", layer: 1, tileA: 1536, tileB: 0, density: .35, count: 3 },
                { id: "details", type: "scatter", name: "Add details", layer: 2, tileA: 1, tileB: 2, density: .08, count: 30 }
            ],
            lockedCells: []
        },
        quest: {
            id: "first-quest",
            name: "First Quest",
            nodes: [
                { id: "start", type: "start", title: "Quest begins", description: "The player accepts the quest.", next: "objective" },
                { id: "objective", type: "objective", title: "Complete the objective", description: "Describe what the player must do.", next: "complete" },
                { id: "complete", type: "complete", title: "Quest complete", description: "Reward the player.", rewardGold: 0 }
            ]
        },
        testTab: "structural",
        budgets: { maxMapCells: 250000, maxEventsPerMap: 150, maxWarnings: 20, targetFrameMs: 16.67, maxRuntimeSaveKb: 1024 },
        testRuns: [],
        goldenMaps: {},
        realPlaytest: { attested: false, note: "", at: 0, fingerprint: "" },
        migration: { status: "not-run", note: "", at: 0, fingerprint: "" },
        checkpoints: [],
        extensionPolicies: {},
        content: [],
        releases: [],
        milestones: { opened: false, edited: false, generated: false, quest: false, tested: false, released: false },
        notices: []
    };

    const persisted = api.getExtensionData("worldsmith-v17", {});
    const state = Object.assign(clone(defaults), persisted || {});
    state.map = Object.assign(clone(defaults.map), state.map || {});
    state.recipe = Object.assign(clone(defaults.recipe), state.recipe || {});
    state.quest = Object.assign(clone(defaults.quest), state.quest || {});
    state.budgets = Object.assign(clone(defaults.budgets), state.budgets || {});
    state.realPlaytest = Object.assign(clone(defaults.realPlaytest), state.realPlaytest || {});
    state.migration = Object.assign(clone(defaults.migration), state.migration || {});
    state.milestones = Object.assign(clone(defaults.milestones), state.milestones || {});
    for (const key of ["testRuns", "checkpoints", "content", "releases", "notices"]) state[key] = list(state[key]);
    state.extensionPolicies ||= {};

    let persistTimer = 0;
    let mapBase = null;
    let mapDraft = null;
    let mapId = 0;
    let mapDirty = false;
    let mapHistory = [];
    let mapRedo = [];
    let pointerPainting = false;
    let rectangleStart = null;
    let recipePreview = null;
    let labReport = null;
    let productionReport = null;
    let currentFingerprint = "";
    let lastGamepad = {};
    let gamepadLoop = 0;
    let legacyPromise = null;

    function persist() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => api.setExtensionData("worldsmith-v17", state).catch(() => {}), 120);
    }

    function shell() {
        const nav = VIEWS.map(([id, label, icon, level]) => `<button type="button" data-v17-view="${id}" class="v17-${level}" aria-label="${label}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`).join("");
        return `<dialog id="v17Studio" class="v17-studio" aria-label="Hybrid Tile Studio Worldsmith">
          <div class="v17-app">
            <header class="v17-top">
              <div class="v17-brand"><img src="HybridTileGuide.png" alt="Pip, the Worldsmith guide"><span><strong>Hybrid Tile Studio</strong><small>WORLDSMITH · v17</small></span></div>
              <div class="v17-project"><strong id="v17Project">No project open</strong><small id="v17ProjectMeta">A friendly RPG Maker MZ creator suite</small></div>
              <button id="v17Undo" class="v17-icon-button" type="button" aria-label="Undo" title="Undo">↶</button>
              <button id="v17Redo" class="v17-icon-button" type="button" aria-label="Redo" title="Redo">↷</button>
              <button id="v17Mode" class="v17-mode-button" type="button">GUIDED</button>
              <button id="v17Commands" class="v17-command-button" type="button"><b>⌕</b><span>Commands</span><kbd>Ctrl K</kbd></button>
              <button id="v17Help" class="v17-icon-button" type="button" aria-label="Ask Pip for help">?</button>
            </header>
            <nav class="v17-nav" aria-label="Worldsmith areas">${nav}<div class="v17-nav-spacer"></div></nav>
            <main id="v17Main" class="v17-main" tabindex="-1"></main>
            <footer class="v17-footer"><span id="v17Status"><i class="v17-status-dot"></i>Ready</span><span id="v17ControllerPrompt">Keyboard ready</span><span>Move <kbd>↑↓←→</kbd></span><span>Select <kbd id="v17SelectGlyph">A</kbd></span><span>Back <kbd id="v17BackGlyph">B</kbd></span></footer>
            <div id="v17Toasts" class="v17-toasts" aria-live="assertive"></div>
          </div>
        </dialog>
        <dialog id="v17Confirm" class="v17-dialog"><form method="dialog" class="v17-dialog-card"><small class="v17-eyebrow">SAFE CHANGE</small><h2 id="v17ConfirmTitle">Confirm action</h2><p id="v17ConfirmText"></p><div class="v17-dialog-actions"><button value="cancel" class="v17-button">Cancel</button><button id="v17ConfirmAccept" value="confirm" class="v17-button v17-primary">Continue</button></div></form></dialog>
        <dialog id="v17Pip" class="v17-dialog"><div class="v17-dialog-card v17-pip-panel"><img src="HybridTileGuide.png" alt="Pip"><small class="v17-eyebrow">PIP'S WORLDMAKING TIP</small><h2 id="v17PipTitle">What are we making?</h2><p id="v17PipText"></p><div class="v17-dialog-actions"><button id="v17PipShow" class="v17-button v17-primary" type="button">Show me</button><button id="v17PipClose" class="v17-button" type="button">Got it</button></div></div></dialog>
        <dialog id="v17CommandPalette" class="v17-dialog v17-command-dialog"><header><b>⌕</b><input id="v17CommandQuery" type="search" placeholder="Go somewhere or do something…" aria-label="Search commands"><kbd>Esc</kbd></header><div id="v17CommandResults" class="v17-command-results"></div></dialog>
        <input id="v17ContentImport" type="file" accept=".htgcontent,.json,application/json" hidden>`;
    }

    function inject() {
        document.documentElement.classList.add("v17-active");
        document.body.insertAdjacentHTML("beforeend", shell());
        wireShell();
        applyExperience();
        updateChrome();
        $("v17Studio").showModal();
        render(state.view);
        document.addEventListener("HybridTileStudio:project-opened", safe(async () => {
            state.map.selectedId = api.projectInfo().maps[0]?.id || api.state().activeMapId || 0;
            state.milestones.opened = true;
            resetMapDraft();
            await loadProjectData();
            persist();
            await render("home");
            notify("Project connected. Your first safe action is ready.");
        }));
        document.addEventListener("keydown", handleKeys, true);
        if (navigator.getGamepads) gamepadLoop = requestAnimationFrame(pollGamepad);
        document.dispatchEvent(new CustomEvent("HybridTileStudio:v17-ready", { detail: { version: VERSION, startupModules: 2 } }));
    }

    function wireShell() {
        $("v17Studio").addEventListener("click", safe(async event => {
            const view = event.target.closest("[data-v17-view]");
            if (view) return switchView(view.dataset.v17View);
            const action = event.target.closest("[data-v17-action]");
            if (action) return runAction(action.dataset.v17Action, action);
        }));
        $("v17Mode").onclick = cycleMode;
        $("v17Undo").onclick = undo;
        $("v17Redo").onclick = redo;
        $("v17Commands").onclick = openCommands;
        $("v17Help").onclick = openPip;
        $("v17PipClose").onclick = () => $("v17Pip").close();
        $("v17PipShow").onclick = () => { $("v17Pip").close(); runAction("continue"); };
        $("v17CommandQuery").oninput = renderCommands;
        $("v17CommandResults").onclick = safe(async event => {
            const button = event.target.closest("[data-v17-command]");
            if (!button) return;
            $("v17CommandPalette").close();
            await executeCommand(button.dataset.v17Command);
        });
        $("v17ContentImport").onchange = safe(importContentFile);
    }

    function hasMaps() { return api.projectInfo().maps.length > 0 || integer(api.state().activeMapId) > 0; }
    function currentView() { return VIEWS.find(item => item[0] === state.view) || VIEWS[0]; }

    async function switchView(view) {
        const entry = VIEWS.find(item => item[0] === view);
        if (!entry) return;
        if (entry[3] === "expert" && state.mode !== "expert") return notify("Advanced workbenches are available in Expert mode.", "warning");
        if (entry[3] === "guided" && state.mode === "beginner") return notify("Switch to Guided mode when you want that workspace.", "info");
        state.view = view;
        persist();
        await render(view);
        tone("move");
    }

    async function render(view = state.view) {
        state.view = view;
        updateChrome();
        const renderer = { home: renderHome, create: renderCreate, world: renderWorld, test: renderTest, release: renderRelease, library: renderLibrary, settings: renderSettings, advanced: renderAdvanced }[view] || renderHome;
        if (!hasMaps() && !["home", "settings", "advanced"].includes(view)) return renderEmpty();
        await renderer();
        updateChrome();
    }

    function updateChrome() {
        const info = api.projectInfo();
        const view = currentView();
        if ($("v17Project")) $("v17Project").textContent = info.open ? info.name : hasMaps() ? "Loose map workspace" : "No project open";
        if ($("v17ProjectMeta")) $("v17ProjectMeta").textContent = info.open ? `${info.maps.length} maps · ${view[1]}` : "A friendly RPG Maker MZ creator suite";
        document.querySelectorAll("[data-v17-view]").forEach(button => button.classList.toggle("active", button.dataset.v17View === state.view));
        if ($("v17Mode")) $("v17Mode").textContent = state.mode.toUpperCase();
        if ($("v17Undo")) $("v17Undo").disabled = state.view !== "create" || !mapHistory.length;
        if ($("v17Redo")) $("v17Redo").disabled = state.view !== "create" || !mapRedo.length;
        if ($("v17Status")) $("v17Status").innerHTML = `<i class="v17-status-dot${mapDirty ? " dirty" : ""}"></i>${mapDirty ? "Unsaved map experiment" : view[1]}`;
        updateControllerPrompts();
    }

    function renderEmpty() {
        $("v17Main").innerHTML = `<section class="v17-empty"><div><img src="HybridTileGuide.png" alt="Pip holding a map"><small class="v17-eyebrow">WELCOME, WORLDMAKER</small><h1>Open an RPG Maker project</h1><p>Pip will guide you from the first map change through a verified release. Every project write is previewed, reversible, and explicit.</p><button data-v17-action="open-project" class="v17-button v17-primary">Choose Project Folder</button> <button data-v17-action="open-maps" class="v17-button">Open Map Files</button></div></section>`;
    }

    function pageHead(eyebrow, title, copy, actions = "") {
        return `<header class="v17-page-head"><div><small class="v17-eyebrow">${escapeHtml(eyebrow)}</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div><aside class="v17-page-actions">${actions}</aside></header>`;
    }

    function metric(value, label, color = "blue") { return `<article class="v17-metric ${color}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`; }
    function finding(severity, title, copy) { const icon = severity === "error" ? "!" : severity === "warning" ? "△" : severity === "success" ? "✓" : "i"; return `<article class="v17-finding ${severity}"><i>${icon}</i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></span></article>`; }

    async function renderHome() {
        const info = api.projectInfo();
        const run = state.testRuns[0];
        const next = !hasMaps() ? ["open-project", "Open your project", "Connect the project safely"]
            : !state.milestones.edited ? ["home-create", "Make one visible improvement", "Try it, preview it, then keep or revert"]
            : !state.milestones.generated ? ["home-world", "Give the world a system", "Preview a recipe on the current map"]
            : !state.milestones.tested ? ["home-test", "Prove the player path", "Run structural checks and a real playtest"]
            : ["home-release", "Prepare a verified build", "Every required gate must be current"];
        const completed = Object.values(state.milestones).filter(Boolean).length;
        $("v17Main").innerHTML = `${pageHead("YOUR WORLD AT A GLANCE", "Welcome back, worldmaker", "One clear next step, with every advanced tool close when you need it.", `<button data-v17-action="home-health">Project checkup</button>`)}
          <section class="v17-hero"><div><small class="v17-eyebrow">PIP'S RECOMMENDATION</small><h2>${escapeHtml(next[1])}</h2><p>${escapeHtml(next[2])}. Worldsmith will explain the change before writing anything to the project.</p><div class="v17-hero-actions"><button data-v17-action="${next[0]}" class="v17-button v17-primary">Continue</button><button data-v17-action="guide" class="v17-button">Ask Pip why</button></div></div><aside class="v17-hero-pip"><img src="HybridTileGuide.png" alt="Pip points toward the recommended action"><div class="v17-pip-bubble">${run?.passed ? "Your last lab passed. Nice work!" : hasMaps() ? "Let’s make one thing better." : "I’ll help you get started."}</div></aside></section>
          <section class="v17-metrics">${metric(info.maps.length || (hasMaps() ? 1 : 0), "Connected maps", "blue")}${metric(state.content.length, "Reusable creations", "purple")}${metric(run ? run.errors : "—", "Open test errors", run?.errors ? "red" : "mint")}${metric(`${completed}/6`, "Journey milestones", "yellow")}</section>
          <section class="v17-journey"><header><div><small class="v17-eyebrow">THE FRIENDLY CREATOR PATH</small><h2>Make → Shape → Test → Verify → Release</h2></div><b>${completed}/6</b></header><div class="v17-journey-grid">${[
            ["create", "1", "Create", "Paint the first improvement", state.milestones.edited],
            ["world", "2", "Shape", "Generate or connect story", state.milestones.generated || state.milestones.quest],
            ["test", "3", "Test", "Check structure and journeys", state.milestones.tested],
            ["release", "4", "Verify", "Pass every current gate", !!productionReport?.ready],
            ["release", "5", "Release", "Create reproducible metadata", state.milestones.released]
          ].map(([view, icon, title, copy, done]) => `<button data-v17-view="${view}"><i>${done ? "✓" : icon}</i><span><strong>${title}</strong><small>${copy}</small></span><b>${done ? "DONE" : "›"}</b></button>`).join("")}</div></section>
          <section class="v17-action-grid">${[
            ["create", "▦", "Map Studio", "Paint with real tiles and reversible layers", "beginner"],
            ["world", "✦", "World & Story", "Preview generation and build connected quests", "guided"],
            ["test", "▶", "Playtest Laboratory", "Separate verified, failed, skipped, and stale results", "beginner"],
            ["library", "▤", "Content Library", "Capture and safely reuse your best work", "guided"],
            ["settings", "⚙", "Creator Experience", "Real Beginner, Guided, and Expert workspaces", "guided"],
            ["advanced", "◆", "Advanced Workbenches", "Load specialist consoles only when requested", "expert"]
          ].map(([view, icon, title, copy, level]) => `<button data-v17-view="${view}" class="v17-action-card v17-${level}"><i>${icon}</i><span><strong>${title}</strong><small>${copy}</small></span></button>`).join("")}</section>`;
    }

    async function ensureMapDraft(force = false) {
        const requested = integer(state.map.selectedId || api.state().activeMapId);
        if (!requested) throw new Error("Choose a map first.");
        if (!force && mapDraft && mapId === requested) return mapDraft;
        if (mapDirty && !force) {
            const proceed = await confirmChange("Change maps?", "Your uncommitted map experiment will be discarded.", "Discard and change");
            if (!proceed) throw new Error("Map change cancelled.");
        }
        api.activateMap(requested);
        mapBase = await api.mapSnapshot(requested);
        mapDraft = clone(mapBase);
        mapId = requested;
        mapDirty = false;
        mapHistory = [];
        mapRedo = [];
        return mapDraft;
    }

    async function resetMapDraft() {
        mapBase = null;
        mapDraft = null;
        mapId = 0;
        mapDirty = false;
        mapHistory = [];
        mapRedo = [];
    }

    function tileIndex(map, x, y, z = state.map.layer) { return (z * map.height + y) * map.width + x; }
    function inMap(map, x, y) { return x >= 0 && y >= 0 && x < map.width && y < map.height; }
    function mapChanges() {
        if (!mapBase || !mapDraft) return 0;
        let changes = 0;
        const length = Math.max(mapBase.data?.length || 0, mapDraft.data?.length || 0);
        for (let index = 0; index < length; index++) if (mapBase.data[index] !== mapDraft.data[index]) changes++;
        return changes;
    }
    function rememberMap(label) {
        mapHistory.push({ label, map: clone(mapDraft) });
        if (mapHistory.length > 40) mapHistory.shift();
        mapRedo = [];
    }
    function setDraftTile(x, y, tileId = state.map.tileId, remember = false) {
        if (!mapDraft || !inMap(mapDraft, x, y)) return false;
        if (remember) rememberMap("Paint tiles");
        const size = clamp(integer(state.map.brushSize, 1), 1, 8);
        let changed = false;
        for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
            const px = x + dx, py = y + dy;
            if (!inMap(mapDraft, px, py)) continue;
            const index = tileIndex(mapDraft, px, py);
            if (mapDraft.data[index] !== tileId) { mapDraft.data[index] = tileId; changed = true; }
        }
        if (changed) { mapDirty = true; state.map.cursorX = x; state.map.cursorY = y; persist(); }
        return changed;
    }
    function floodDraft(x, y) {
        if (!inMap(mapDraft, x, y)) return;
        const target = mapDraft.data[tileIndex(mapDraft, x, y)];
        const replacement = integer(state.map.tileId);
        if (target === replacement) return;
        rememberMap("Fill area");
        const queue = [[x, y]], seen = new Set(); let head = 0;
        while (head < queue.length && seen.size < 100000) {
            const [px, py] = queue[head++];
            const key = `${px},${py}`;
            if (seen.has(key) || !inMap(mapDraft, px, py) || mapDraft.data[tileIndex(mapDraft, px, py)] !== target) continue;
            seen.add(key); mapDraft.data[tileIndex(mapDraft, px, py)] = replacement;
            queue.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        mapDirty = true; persist(); drawMapCanvas(); updateChrome();
    }
    function canvasPoint(event) {
        const canvas = $("v17MapCanvas"), rect = canvas.getBoundingClientRect();
        return { x: clamp(Math.floor((event.clientX - rect.left) * canvas.width / rect.width / canvas._tileSize), 0, mapDraft.width - 1), y: clamp(Math.floor((event.clientY - rect.top) * canvas.height / rect.height / canvas._tileSize), 0, mapDraft.height - 1) };
    }
    function performMapTool(point, begin = false) {
        if (!mapDraft) return;
        const tool = state.map.tool;
        if (tool === "fill") { if (begin) floodDraft(point.x, point.y); return; }
        if (tool === "select") { state.map.cursorX = point.x; state.map.cursorY = point.y; drawMapCanvas(); return; }
        if (tool === "rectangle") {
            if (begin) rectangleStart = point;
            return;
        }
        const value = tool === "erase" ? 0 : integer(state.map.tileId);
        if (begin) rememberMap(tool === "erase" ? "Erase tiles" : "Paint tiles");
        if (setDraftTile(point.x, point.y, value)) { drawMapCanvas(); updateChrome(); }
    }
    function finishRectangle(point) {
        if (!rectangleStart || !mapDraft) return;
        rememberMap("Draw rectangle");
        const x1 = Math.min(rectangleStart.x, point.x), x2 = Math.max(rectangleStart.x, point.x);
        const y1 = Math.min(rectangleStart.y, point.y), y2 = Math.max(rectangleStart.y, point.y);
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setDraftTile(x, y, state.map.tileId);
        rectangleStart = null; drawMapCanvas(); updateChrome();
    }
    async function renderCreate() {
        await ensureMapDraft();
        const info = api.projectInfo();
        const maps = info.maps.map(item => `<option value="${item.id}" ${item.id === mapId ? "selected" : ""}>${escapeHtml(item.name)} · ${item.id}</option>`).join("");
        const tools = [["paint", "✎", "Paint"], ["erase", "⌫", "Erase"], ["fill", "▧", "Fill"], ["rectangle", "□", "Rectangle"], ["select", "⌖", "Inspect"]];
        $("v17Main").innerHTML = `${pageHead("CREATE · MAP STUDIO", "Make a visible improvement", "Paint directly with project tiles. Nothing reaches the project until you choose Apply.", `<select id="v17MapSelect" aria-label="Active map">${maps}</select><button data-v17-action="discard-map">Discard</button><button data-v17-action="apply-map" class="v17-button v17-primary" ${mapDirty ? "" : "disabled"}>Apply ${mapChanges()} changes</button>`)}
          <section class="v17-create">
            <aside class="v17-tools"><small class="v17-section-label">TOOLS</small><div class="v17-tool-grid">${tools.map(([id, icon, name]) => `<button data-v17-tool="${id}" class="${state.map.tool === id ? "active" : ""}" title="${name}"><i>${icon}</i><span>${name}</span></button>`).join("")}</div><small class="v17-section-label">TILE SHEETS</small><div class="v17-tabs">${["A", "B", "C", "D", "E"].map(name => `<button data-v17-palette="${name}" class="${state.map.palette === name ? "active" : ""}">${name}</button>`).join("")}</div><div id="v17Palette" class="v17-tile-palette" aria-label="Tile palette"></div></aside>
            <article class="v17-canvas-panel"><header><strong>${escapeHtml(info.maps.find(item => item.id === mapId)?.name || `Map ${mapId}`)}</strong><span>${mapDraft.width} × ${mapDraft.height} · layer ${state.map.layer + 1}</span></header><div class="v17-canvas-scroll"><canvas id="v17MapCanvas" aria-label="Editable tile map" tabindex="0"></canvas></div><footer><span>Changes: <b>${mapChanges()}</b></span><span>Cursor: <b id="v17Cursor">${state.map.cursorX}, ${state.map.cursorY}</b></span><span>Zoom <input id="v17Zoom" type="range" min="0.5" max="2" step="0.1" value="${state.map.zoom}"></span></footer></article>
            <aside class="v17-inspector"><small class="v17-section-label">BRUSH</small><label class="v17-field"><span>Tile ID</span><input id="v17TileId" type="number" min="0" value="${state.map.tileId}"></label><label class="v17-field"><span>Layer</span><select id="v17Layer">${[0,1,2,3,4,5].map(value => `<option value="${value}" ${value === state.map.layer ? "selected" : ""}>${value + 1}${value === 4 ? " · shadow" : value === 5 ? " · region" : ""}</option>`).join("")}</select></label><label class="v17-field"><span>Brush size</span><input id="v17Brush" type="range" min="1" max="8" value="${state.map.brushSize}"><b id="v17BrushValue">${state.map.brushSize} × ${state.map.brushSize}</b></label><div class="v17-card"><strong>Safe by design</strong><p>The canvas is a local experiment. Apply creates a named recovery snapshot before one atomic project write.</p></div><button data-v17-action="capture-content" class="v17-button v17-guided">Capture in library</button></aside>
          </section>`;
        wireCreate(); drawPalette(); drawMapCanvas();
    }
    function wireCreate() {
        $("v17MapSelect").onchange = safe(async event => { state.map.selectedId = integer(event.target.value); await ensureMapDraft(true); await renderCreate(); });
        $("v17Main").querySelectorAll("[data-v17-tool]").forEach(button => button.onclick = () => { state.map.tool = button.dataset.v17Tool; persist(); renderCreate(); });
        $("v17Main").querySelectorAll("[data-v17-palette]").forEach(button => button.onclick = () => { state.map.palette = button.dataset.v17Palette; persist(); drawPalette(); });
        $("v17TileId").onchange = event => { state.map.tileId = Math.max(0, integer(event.target.value)); persist(); drawPalette(); };
        $("v17Layer").onchange = event => { state.map.layer = clamp(integer(event.target.value), 0, 5); persist(); drawMapCanvas(); };
        $("v17Brush").oninput = event => { state.map.brushSize = integer(event.target.value); $("v17BrushValue").textContent = `${state.map.brushSize} × ${state.map.brushSize}`; persist(); };
        $("v17Zoom").oninput = event => { state.map.zoom = Number(event.target.value); persist(); drawMapCanvas(); };
        const canvas = $("v17MapCanvas");
        canvas.onpointerdown = event => { pointerPainting = true; canvas.setPointerCapture?.(event.pointerId); performMapTool(canvasPoint(event), true); };
        canvas.onpointermove = event => { const point = canvasPoint(event); state.map.cursorX = point.x; state.map.cursorY = point.y; if ($("v17Cursor")) $("v17Cursor").textContent = `${point.x}, ${point.y}`; if (pointerPainting && !["fill", "select", "rectangle"].includes(state.map.tool)) performMapTool(point); };
        canvas.onpointerup = event => { if (state.map.tool === "rectangle") finishRectangle(canvasPoint(event)); pointerPainting = false; };
        canvas.onpointercancel = () => { pointerPainting = false; rectangleStart = null; };
    }
    function drawPalette() {
        const host = $("v17Palette"); if (!host) return;
        host.innerHTML = "";
        const start = { A: 2048, B: 0, C: 256, D: 512, E: 768 }[state.map.palette] ?? 0;
        for (let offset = 0; offset < 64; offset++) {
            const tileId = start + offset; const button = document.createElement("button"); button.type = "button"; button.title = `Tile ${tileId}`; button.className = tileId === state.map.tileId ? "selected" : "";
            const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32; button.append(canvas); api.drawTile(canvas.getContext("2d"), tileId, 0, 0, 32);
            button.onclick = () => { state.map.tileId = tileId; if ($("v17TileId")) $("v17TileId").value = tileId; persist(); drawPalette(); };
            host.append(button);
        }
    }
    function drawMap(canvas, map, options = {}) {
        if (!canvas || !map) return;
        const maxWidth = options.maxWidth || 900, maxHeight = options.maxHeight || 620;
        const base = Math.max(4, Math.min(32, Math.floor(Math.min(maxWidth / map.width, maxHeight / map.height))));
        const tileSize = Math.max(4, Math.round(base * (options.zoom || 1)));
        canvas._tileSize = tileSize; canvas.width = map.width * tileSize; canvas.height = map.height * tileSize;
        const context = canvas.getContext("2d"); context.fillStyle = "#171a28"; context.fillRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) for (let z = 0; z < 4; z++) {
            const tileId = integer(map.data[tileIndex(map, x, y, z)]); if (tileId) api.drawTile(context, tileId, x * tileSize, y * tileSize, tileSize);
        }
        if (tileSize >= 12 && options.grid !== false) { context.strokeStyle = "rgba(255,255,255,.10)"; context.lineWidth = 1; context.beginPath(); for (let x = 0; x <= map.width; x++) { context.moveTo(x * tileSize + .5, 0); context.lineTo(x * tileSize + .5, canvas.height); } for (let y = 0; y <= map.height; y++) { context.moveTo(0, y * tileSize + .5); context.lineTo(canvas.width, y * tileSize + .5); } context.stroke(); }
        if (options.cursor) { context.strokeStyle = "#ffd75a"; context.lineWidth = 2; context.strokeRect(options.cursor.x * tileSize + 1, options.cursor.y * tileSize + 1, tileSize - 2, tileSize - 2); }
    }
    function drawMapCanvas() { drawMap($("v17MapCanvas"), mapDraft, { zoom: state.map.zoom, cursor: { x: state.map.cursorX, y: state.map.cursorY } }); }
    async function applyMapDraft() {
        if (!mapDirty || !mapDraft) return;
        const changes = mapChanges();
        if (!await confirmChange("Apply map experiment?", `${changes} tile values will be written to Map ${mapId}. A recovery snapshot is created first.`, "Apply safely")) return;
        api.createSnapshot(`Before v17 map edit · ${new Date().toLocaleString()}`, mapId);
        await api.applyMapSnapshot(mapDraft, `Worldsmith map edit · ${changes} changes`, mapId);
        await api.save();
        mapBase = clone(mapDraft); mapDirty = false; mapHistory = []; mapRedo = [];
        state.milestones.edited = true; await invalidateVerification("Map content changed"); persist();
        notify(`${changes} map changes applied. Recovery snapshot kept.`, "success"); await renderCreate();
    }

    async function renderWorld() {
        const tabs = `<div class="v17-tabs"><button data-v17-world-tab="recipes" class="${state.worldTab === "recipes" ? "active" : ""}">World recipe</button><button data-v17-world-tab="quests" class="${state.worldTab === "quests" ? "active" : ""}">Quest flow</button></div>`;
        $("v17Main").innerHTML = `${pageHead("WORLD & STORY", state.worldTab === "recipes" ? "Shape a world with a readable recipe" : "Make every quest path reachable", "Edit the small pieces, preview the outcome, then choose whether to apply it.", tabs)}<div id="v17WorldBody"></div>`;
        $("v17Main").querySelectorAll("[data-v17-world-tab]").forEach(button => button.onclick = () => { state.worldTab = button.dataset.v17WorldTab; persist(); renderWorld(); });
        if (state.worldTab === "quests") renderQuestBuilder(); else await renderRecipeBuilder();
    }
    async function renderRecipeBuilder() {
        const host = $("v17WorldBody"); const recipe = state.recipe;
        const stages = list(recipe.stages);
        host.innerHTML = `<section class="v17-world-layout"><aside class="v17-stage-list"><header><div><small class="v17-section-label">RECIPE</small><h2>${escapeHtml(recipe.name)}</h2></div><button data-v17-action="add-stage" title="Add stage">＋</button></header>${stages.map((stage, index) => `<article class="v17-stage" data-stage-index="${index}"><i>${index + 1}</i><span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.type)} · layer ${integer(stage.layer) + 1}</small></span><button data-v17-action="remove-stage" data-index="${index}" aria-label="Remove ${escapeHtml(stage.name)}">×</button></article>`).join("")}</aside><main class="v17-panel"><small class="v17-eyebrow">LIVE, DETERMINISTIC PREVIEW</small><h2>Before and after</h2><p>The same seed produces the same tile changes. Locked cells are never overwritten.</p><div class="v17-preview-pair"><figure><canvas id="v17RecipeBefore"></canvas><figcaption>Current map</figcaption></figure><figure><canvas id="v17RecipeAfter"></canvas><figcaption>${recipePreview ? `Preview · ${recipePreview.changes} changes` : "Run preview"}</figcaption></figure></div><div class="v17-dialog-actions"><button data-v17-action="preview-recipe" class="v17-button v17-primary">Run real preview</button><button data-v17-action="apply-recipe" class="v17-button" ${recipePreview ? "" : "disabled"}>Apply preview</button></div></main><aside class="v17-inspector"><small class="v17-section-label">RECIPE SETTINGS</small><label class="v17-field"><span>Name</span><input id="v17RecipeName" value="${escapeHtml(recipe.name)}"></label><label class="v17-field"><span>Seed</span><input id="v17RecipeSeed" value="${escapeHtml(recipe.seed)}"></label><p>Stages</p>${stages.map((stage, index) => `<fieldset class="v17-form"><legend>${index + 1}. ${escapeHtml(stage.name)}</legend><label class="v17-field"><span>Name</span><input data-stage-field="name" data-index="${index}" value="${escapeHtml(stage.name)}"></label><label class="v17-field"><span>Generator</span><select data-stage-field="type" data-index="${index}">${["biome","road","river","scatter","dungeon","maze"].map(type => `<option ${stage.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="v17-field"><span>Tile A</span><input type="number" data-stage-field="tileA" data-index="${index}" value="${integer(stage.tileA)}"></label><label class="v17-field"><span>Tile B</span><input type="number" data-stage-field="tileB" data-index="${index}" value="${integer(stage.tileB)}"></label><label class="v17-field"><span>Layer</span><input type="number" min="0" max="5" data-stage-field="layer" data-index="${index}" value="${integer(stage.layer)}"></label></fieldset>`).join("")}</aside></section>`;
        const base = await api.mapSnapshot(); drawMap($("v17RecipeBefore"), base, { maxWidth: 410, maxHeight: 360, grid: false }); drawMap($("v17RecipeAfter"), recipePreview?.map || base, { maxWidth: 410, maxHeight: 360, grid: false });
        $("v17RecipeName").onchange = event => { recipe.name = event.target.value.trim() || "World recipe"; recipePreview = null; persist(); };
        $("v17RecipeSeed").onchange = event => { recipe.seed = event.target.value; recipePreview = null; persist(); };
        host.querySelectorAll("[data-stage-field]").forEach(input => input.onchange = () => { const stage = recipe.stages[integer(input.dataset.index)]; const field = input.dataset.stageField; stage[field] = input.type === "number" ? integer(input.value) : input.value; recipePreview = null; persist(); });
    }
    function generatorOptions(stage, index) {
        const map = mapDraft || mapBase;
        return { type: stage.type, seed: `${state.recipe.seed}:${stage.id || index}`, layer: clamp(integer(stage.layer), 0, 5), tileA: Math.max(0, integer(stage.tileA)), tileB: Math.max(0, integer(stage.tileB)), density: Number(stage.density ?? .12), count: Math.max(1, integer(stage.count, 8)), width: 2, scale: 8, start: [0, Math.floor((map?.height || 10) / 2)], end: [Math.max(0, (map?.width || 10) - 1), Math.floor((map?.height || 10) / 2)] };
    }
    async function previewRecipe() {
        const base = await api.mapSnapshot(); const preview = clone(base); const locked = new Set(list(state.recipe.lockedCells).map(String)); let changes = 0;
        for (let stageIndex = 0; stageIndex < state.recipe.stages.length; stageIndex++) {
            const stage = state.recipe.stages[stageIndex]; const result = api.runGenerator(generatorOptions(stage, stageIndex));
            for (const [index, tileId] of result instanceof Map ? result : []) {
                const cell = index % (preview.width * preview.height), x = cell % preview.width, y = Math.floor(cell / preview.width);
                if (locked.has(`${x},${y}`)) continue;
                if (preview.data[index] !== tileId) { preview.data[index] = tileId; changes++; }
            }
        }
        recipePreview = { map: preview, baseChecksum: hash(base), changes, at: Date.now(), recipeChecksum: hash(state.recipe) };
        notify(`Preview ready: ${changes} deterministic tile changes.`, changes ? "success" : "info"); await renderRecipeBuilder();
    }
    async function applyRecipePreview() {
        if (!recipePreview) return;
        const current = await api.mapSnapshot();
        if (hash(current) !== recipePreview.baseChecksum) { recipePreview = null; notify("The map changed. Run the recipe preview again.", "warning"); return renderRecipeBuilder(); }
        if (!await confirmChange("Apply this generated world?", `${recipePreview.changes} tile values will be written. The current map is captured first.`, "Apply generated map")) return;
        api.createSnapshot(`Before recipe ${state.recipe.name} · ${new Date().toLocaleString()}`);
        await api.applyMapSnapshot(recipePreview.map, `Worldsmith recipe · ${state.recipe.name}`); await api.save();
        state.milestones.generated = true; recipePreview = null; await invalidateVerification("World recipe applied"); persist(); notify("Recipe applied and the previous map was preserved.", "success"); await renderWorld();
    }
    function validateQuest() {
        const nodes = list(state.quest.nodes), ids = new Set(nodes.map(node => safeId(node.id))); const issues = [];
        if (!nodes.some(node => node.type === "start")) issues.push({ severity: "error", message: "Add one start node." });
        if (!nodes.some(node => node.type === "complete")) issues.push({ severity: "error", message: "Add one completion node." });
        for (const node of nodes) {
            if (!safeId(node.id)) issues.push({ severity: "error", message: "Every node needs an ID." });
            if (node.next && !ids.has(safeId(node.next))) issues.push({ severity: "error", message: `${node.id} points to missing node “${node.next}”.` });
        }
        const start = nodes.find(node => node.type === "start"), visited = new Set(); let cursor = start;
        while (cursor && !visited.has(safeId(cursor.id))) { visited.add(safeId(cursor.id)); cursor = nodes.find(node => safeId(node.id) === safeId(cursor.next)); }
        for (const node of nodes) if (!visited.has(safeId(node.id))) issues.push({ severity: "warning", message: `${node.id} is unreachable from start.` });
        return { ok: !issues.some(issue => issue.severity === "error"), issues, visited: visited.size };
    }
    function renderQuestBuilder() {
        const host = $("v17WorldBody"), report = validateQuest(), nodes = state.quest.nodes;
        host.innerHTML = `<section class="v17-world-layout"><aside class="v17-stage-list"><header><div><small class="v17-section-label">QUEST</small><h2>${escapeHtml(state.quest.name)}</h2></div><button data-v17-action="add-quest-node">＋</button></header>${nodes.map((node, index) => `<button class="v17-stage" data-v17-quest-index="${index}"><i>${index + 1}</i><span><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.type)} · ${escapeHtml(node.id)}</small></span></button>`).join("")}</aside><main class="v17-panel"><small class="v17-eyebrow">PLAYER FLOW</small><h2>${report.ok ? "The critical path is valid" : "The path needs attention"}</h2><div class="v17-quest-graph">${nodes.map(node => `<article class="v17-quest-node ${node.type}"><small>${escapeHtml(node.type)}</small><strong>${escapeHtml(node.title)}</strong><p>${escapeHtml(node.description)}</p><b>${node.next ? `→ ${escapeHtml(node.next)}` : "END"}</b></article>`).join("")}</div><div class="v17-findings">${report.issues.length ? report.issues.map(issue => finding(issue.severity, issue.severity === "error" ? "Broken path" : "Flow note", issue.message)).join("") : finding("success", "Every node is reachable", `${report.visited} nodes form one understandable path.`)}</div><div class="v17-dialog-actions"><button data-v17-action="save-quest" class="v17-button v17-primary" ${report.ok ? "" : "disabled"}>Save quest definition</button><button data-v17-action="export-quest" class="v17-button">Export JSON</button></div></main><aside class="v17-inspector"><small class="v17-section-label">QUEST SETTINGS</small><label class="v17-field"><span>Quest name</span><input id="v17QuestName" value="${escapeHtml(state.quest.name)}"></label>${nodes.map((node, index) => `<fieldset class="v17-form"><legend>${index + 1}. ${escapeHtml(node.title)}</legend><label class="v17-field"><span>ID</span><input data-quest-field="id" data-index="${index}" value="${escapeHtml(node.id)}"></label><label class="v17-field"><span>Type</span><select data-quest-field="type" data-index="${index}">${["start","dialogue","objective","choice","complete"].map(type => `<option ${node.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="v17-field"><span>Title</span><input data-quest-field="title" data-index="${index}" value="${escapeHtml(node.title)}"></label><label class="v17-field"><span>Description</span><textarea data-quest-field="description" data-index="${index}">${escapeHtml(node.description)}</textarea></label><label class="v17-field"><span>Next node ID</span><input data-quest-field="next" data-index="${index}" value="${escapeHtml(node.next || "")}"></label><button data-v17-action="remove-quest-node" data-index="${index}" class="v17-button v17-danger">Remove</button></fieldset>`).join("")}</aside></section>`;
        $("v17QuestName").onchange = event => { state.quest.name = event.target.value.trim() || "Quest"; persist(); renderQuestBuilder(); };
        host.querySelectorAll("[data-quest-field]").forEach(input => input.onchange = () => { state.quest.nodes[integer(input.dataset.index)][input.dataset.questField] = input.value; persist(); renderQuestBuilder(); });
    }
    async function saveQuest() {
        const report = validateQuest(); if (!report.ok) throw new Error("Fix broken quest links before saving.");
        const payload = { schema: "hybrid-tile-graft/worldsmith-quest@1", version: VERSION, quest: clone(state.quest), validatedAt: new Date().toISOString() };
        if (api.projectInfo().open) await api.writeProjectJson(`.hybrid/worldsmith/quests/${safeId(state.quest.id || state.quest.name)}.json`, payload, true);
        else api.download(`${safeId(state.quest.name)}.quest.json`, JSON.stringify(payload, null, 2), "application/json");
        state.milestones.quest = true; await invalidateVerification("Quest definition changed"); persist(); notify("Quest definition validated and saved.", "success");
    }

    async function projectFingerprint() {
        const maps = [];
        for (const info of api.projectInfo().maps) {
            try { const map = await api.mapSnapshot(info.id); maps.push([info.id, hash({ width: map.width, height: map.height, tilesetId: map.tilesetId, data: map.data, events: map.events })]); }
            catch (error) { maps.push([info.id, `unreadable:${error.message}`]); }
        }
        if (!maps.length && hasMaps()) { const map = await api.mapSnapshot(); maps.push([integer(api.state().activeMapId), hash(map)]); }
        return hash({ schema: 17, maps, recipe: state.recipe, quest: state.quest, content: state.content.map(item => [item.id, item.checksum]), policies: state.extensionPolicies });
    }
    async function invalidateVerification(reason) {
        currentFingerprint = ""; productionReport = null;
        state.notices.unshift({ id: uid("notice"), at: Date.now(), type: "stale", message: reason });
        state.notices = state.notices.slice(0, 20); persist();
    }
    function tabStatus(tab) {
        if (tab === "structural") return state.testRuns[0] ? state.testRuns[0].fingerprint === currentFingerprint ? state.testRuns[0].status : "stale" : "not-run";
        if (tab === "golden") return Object.keys(state.goldenMaps || {}).length ? "verified" : "not-run";
        if (tab === "journey") return state.realPlaytest.attested ? state.realPlaytest.fingerprint === currentFingerprint ? "verified" : "stale" : "not-run";
        if (tab === "migration") return state.migration.status === "verified" && state.migration.fingerprint !== currentFingerprint ? "stale" : state.migration.status || "not-run";
        if (tab === "performance") return state.testRuns[0]?.performance?.status || "not-run";
        return "not-run";
    }
    async function renderTest() {
        currentFingerprint = await projectFingerprint();
        const tabs = [["structural","Structure"],["golden","Golden maps"],["journey","Real playtest"],["migration","Save migration"],["performance","Performance"]];
        $("v17Main").innerHTML = `${pageHead("TEST · PLAYTEST LAB", "Trust results only while they are current", "Verified, failed, skipped, not-run, and stale are intentionally different states.", `<button data-v17-action="run-lab" class="v17-button v17-primary">Run current lab</button>`)}<section class="v17-test-layout"><aside class="v17-lab-menu">${tabs.map(([id, label]) => `<button data-v17-test-tab="${id}" class="${state.testTab === id ? "active" : ""}"><i class="${tabStatus(id)}"></i><span><strong>${label}</strong><small>${tabStatus(id).replace("-", " ")}</small></span></button>`).join("")}</aside><main id="v17LabStage" class="v17-lab-stage"></main></section>`;
        $("v17Main").querySelectorAll("[data-v17-test-tab]").forEach(button => button.onclick = () => { state.testTab = button.dataset.v17TestTab; persist(); renderTest(); });
        renderLabStage();
    }
    function resultBadge(status) { return `<b class="v17-result ${escapeHtml(status)}">${escapeHtml(status.replace("-", " ").toUpperCase())}</b>`; }
    function renderLabStage() {
        const host = $("v17LabStage"); if (!host) return; const run = state.testRuns[0];
        if (state.testTab === "structural") {
            const current = run && run.fingerprint === currentFingerprint; const status = run ? current ? run.status : "stale" : "not-run";
            host.innerHTML = `<small class="v17-eyebrow">STRUCTURAL SCAN</small><h2>Every connected map, not just the open one</h2><p>Checks data shape, tile values, event bounds, empty event pages, autorun pressure, transfer targets, and creator budgets.</p>${resultBadge(status)}<section class="v17-metrics">${metric(run?.maps ?? "—", "Maps scanned")}${metric(run?.errors ?? "—", "Errors", run?.errors ? "red" : "mint")}${metric(run?.warnings ?? "—", "Warnings", run?.warnings ? "yellow" : "mint")}${metric(run?.durationMs ? `${run.durationMs} ms` : "—", "Scan time")}</section><div class="v17-findings">${run?.findings?.length ? run.findings.slice(0, 100).map(item => finding(item.severity, item.title, item.message)).join("") : finding("info", "No current result", "Run the lab after every material project change.")}</div>`;
        } else if (state.testTab === "golden") {
            const golden = state.goldenMaps || {}; const entries = Object.entries(golden);
            host.innerHTML = `<small class="v17-eyebrow">GOLDEN MAPS</small><h2>Catch unintended map changes</h2><p>A golden map stores a checksum and dimensions—not a duplicate project map. Compare it after generators or bulk edits.</p><div class="v17-dialog-actions"><button data-v17-action="capture-golden" class="v17-button v17-primary">Capture active map baseline</button><button data-v17-action="compare-golden" class="v17-button" ${entries.length ? "" : "disabled"}>Compare all</button></div><div class="v17-findings">${entries.length ? entries.map(([id, item]) => finding(item.status === "changed" ? "error" : item.status === "verified" ? "success" : "info", `Map ${id} · ${item.status || "baseline"}`, `${item.width} × ${item.height} · ${item.checksum}`)).join("") : finding("info", "No baselines yet", "Capture a known-good map when its layout is intentional.")}</div>`;
        } else if (state.testTab === "journey") {
            const play = state.realPlaytest, current = play.fingerprint === currentFingerprint, status = play.attested ? current ? "verified" : "stale" : "not-run";
            host.innerHTML = `<small class="v17-eyebrow">REAL ENGINE PLAYTEST</small><h2>A launch is not a pass</h2><p>Worldsmith can launch the packaged desktop playtest. Only you can attest that the critical player path was actually completed.</p>${resultBadge(status)}<label class="v17-field"><span>What did you verify?</span><textarea id="v17PlaytestNote" placeholder="Example: New game → village → cave → boss → save/reload">${escapeHtml(play.note || "")}</textarea></label><div class="v17-dialog-actions"><button data-v17-action="launch-playtest" class="v17-button v17-primary">Launch real engine</button><button data-v17-action="attest-playtest" class="v17-button">I completed this path</button><button data-v17-action="clear-attestation" class="v17-button v17-danger" ${play.attested ? "" : "disabled"}>Clear</button></div><div class="v17-findings">${play.launchedAt ? finding("info", "Playtest launched—not verified", new Date(play.launchedAt).toLocaleString()) : finding("info", "Not launched from Worldsmith", "Launching and verifying are deliberately separate.")}</div>`;
        } else if (state.testTab === "migration") {
            const migration = state.migration, current = migration.fingerprint === currentFingerprint, status = migration.status === "verified" && !current ? "stale" : migration.status;
            host.innerHTML = `<small class="v17-eyebrow">SAVE MIGRATION</small><h2>Test the save path you actually support</h2><p>Open an older supported save in the real engine, transfer maps, save again, reload, and confirm world state. If the game has never shipped, mark this deliberately skipped.</p>${resultBadge(status)}<label class="v17-field"><span>Observed result or skip reason</span><textarea id="v17MigrationNote" placeholder="Example: Loaded v0.8 save, transferred to Map 12, world clock and spawned events persisted.">${escapeHtml(migration.note || "")}</textarea></label><div class="v17-dialog-actions"><button data-v17-action="verify-migration" class="v17-button v17-primary">Record verified migration</button><button data-v17-action="skip-migration" class="v17-button">Skip with reason</button></div>`;
        } else {
            const performance = run?.performance; const status = performance && run.fingerprint === currentFingerprint ? performance.status : performance ? "stale" : "not-run";
            host.innerHTML = `<small class="v17-eyebrow">PERFORMANCE BUDGETS</small><h2>Make limits explicit</h2><p>These are project budgets, not universal truths. Change them in Settings, then rerun the lab.</p>${resultBadge(status)}<section class="v17-metrics">${metric(performance?.largestCells ?? "—", `Largest map · max ${state.budgets.maxMapCells}`)}${metric(performance?.largestEvents ?? "—", `Most events · max ${state.budgets.maxEventsPerMap}`)}${metric(`${state.budgets.targetFrameMs} ms`, "Target frame budget")}${metric(`${state.budgets.maxRuntimeSaveKb} KB`, "Runtime save budget")}</section><div class="v17-findings">${finding("info", "Runtime frame timing requires playtest telemetry", "Static analysis can flag risky scale, but it cannot claim frame-rate verification.")}${finding("info", "Runtime save size requires a real save", "The v17 plugin strips authoring-only data; verify your complete game save in-engine.")}</div>`;
        }
    }
    function eventCommands(event) { return list(event?.pages).flatMap(page => list(page?.list)); }
    async function runStructuralLab() {
        if (mapDirty) throw new Error("Apply or discard the open map experiment before testing the project.");
        const started = performance.now(), findings = [], maps = api.projectInfo().maps; let largestCells = 0, largestEvents = 0;
        for (const info of maps) {
            try {
                const map = await api.mapSnapshot(info.id), cells = integer(map.width) * integer(map.height), events = list(map.events).filter(Boolean); largestCells = Math.max(largestCells, cells); largestEvents = Math.max(largestEvents, events.length);
                if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width <= 0 || map.height <= 0) findings.push({ severity: "error", title: info.name, message: "Map dimensions are invalid." });
                if (!Array.isArray(map.data) || map.data.length !== cells * 6) findings.push({ severity: "error", title: info.name, message: `Tile data length must be ${cells * 6}; found ${map.data?.length ?? "none"}.` });
                const badTile = list(map.data).findIndex(value => !Number.isInteger(value) || value < 0); if (badTile >= 0) findings.push({ severity: "error", title: info.name, message: `Invalid tile value at data index ${badTile}.` });
                if (cells > state.budgets.maxMapCells) findings.push({ severity: "warning", title: info.name, message: `${cells} cells exceeds the ${state.budgets.maxMapCells} budget.` });
                if (events.length > state.budgets.maxEventsPerMap) findings.push({ severity: "warning", title: info.name, message: `${events.length} events exceeds the ${state.budgets.maxEventsPerMap} budget.` });
                for (const event of events) {
                    if (!inMap(map, integer(event.x), integer(event.y))) findings.push({ severity: "error", title: `${info.name} · Event ${event.id}`, message: "Event is outside the map bounds." });
                    if (!list(event.pages).length) findings.push({ severity: "warning", title: `${info.name} · Event ${event.id}`, message: "Event has no pages." });
                    const autoruns = list(event.pages).filter(page => integer(page.trigger) === 3).length; if (autoruns > 1) findings.push({ severity: "warning", title: `${info.name} · Event ${event.id}`, message: `${autoruns} autorun pages deserve a switch-exit review.` });
                    for (const command of eventCommands(event)) if (integer(command.code) === 201) { const target = integer(command.parameters?.[1]); if (target > 0 && !maps.some(item => item.id === target)) findings.push({ severity: "error", title: `${info.name} · Event ${event.id}`, message: `Transfer points to missing Map ${target}.` }); }
                }
            } catch (error) { findings.push({ severity: "error", title: info.name, message: `Could not scan: ${error.message}` }); }
        }
        if (!maps.length) { const map = await api.mapSnapshot(), cells = map.width * map.height; largestCells = cells; largestEvents = list(map.events).filter(Boolean).length; }
        const errors = findings.filter(item => item.severity === "error").length, warnings = findings.filter(item => item.severity === "warning").length;
        if (!findings.length) findings.push({ severity: "success", title: "Structure is clean", message: "All connected maps passed the current static checks." });
        const fingerprint = await projectFingerprint(); const performanceStatus = largestCells > state.budgets.maxMapCells || largestEvents > state.budgets.maxEventsPerMap ? "failed" : "verified";
        labReport = { id: uid("lab"), at: Date.now(), fingerprint, status: errors ? "failed" : "verified", passed: !errors, errors, warnings, maps: maps.length || 1, findings, durationMs: Math.round(performance.now() - started), performance: { status: performanceStatus, largestCells, largestEvents } };
        state.testRuns.unshift(labReport); state.testRuns = state.testRuns.slice(0, 20); state.milestones.tested = !errors; persist(); notify(errors ? `Lab found ${errors} blocking errors.` : "Structural lab verified the current project.", errors ? "error" : "success"); await renderTest(); return clone(labReport);
    }
    async function captureGolden() {
        const id = integer(api.state().activeMapId), map = await api.mapSnapshot(id); state.goldenMaps ||= {}; state.goldenMaps[id] = { checksum: hash(map), width: map.width, height: map.height, capturedAt: Date.now(), status: "baseline" }; persist(); notify(`Map ${id} baseline captured.`, "success"); renderLabStage();
    }
    async function compareGolden() {
        for (const [id, golden] of Object.entries(state.goldenMaps || {})) { try { const map = await api.mapSnapshot(integer(id)); golden.status = hash(map) === golden.checksum ? "verified" : "changed"; golden.comparedAt = Date.now(); } catch (_) { golden.status = "changed"; } } persist(); renderLabStage();
    }
    async function launchRealPlaytest() {
        await api.launchPlaytest({ source: "worldsmith-v17", fingerprint: currentFingerprint || await projectFingerprint() }); state.realPlaytest.launchedAt = Date.now(); state.realPlaytest.attested = false; state.realPlaytest.fingerprint = ""; persist(); notify("Playtest launched. This is not marked verified yet.", "info"); renderLabStage();
    }
    async function attestPlaytest() {
        const note = $("v17PlaytestNote")?.value.trim(); if (!note || note.length < 10) throw new Error("Describe the player path you actually completed (at least 10 characters).");
        if (!state.realPlaytest.launchedAt) throw new Error("Launch the real engine from this screen before attesting.");
        if (!await confirmChange("Attest this real playtest?", "This records your human verification for the current project fingerprint. It will become stale after content changes.", "Record verification")) return;
        state.realPlaytest = { ...state.realPlaytest, attested: true, note, at: Date.now(), fingerprint: currentFingerprint || await projectFingerprint() }; persist(); notify("Real playtest verification recorded for this exact project state.", "success"); renderTest();
    }
    async function recordMigration(status) {
        const note = $("v17MigrationNote")?.value.trim(); if (!note || note.length < 10) throw new Error("Record a useful observed result or skip reason (at least 10 characters).");
        if (status === "verified" && !await confirmChange("Record migration verification?", "Confirm that this was tested in the real RPG Maker engine with a supported older save.", "Record verified")) return;
        state.migration = { status, note, at: Date.now(), fingerprint: status === "verified" ? currentFingerprint || await projectFingerprint() : "" }; persist(); notify(status === "verified" ? "Save migration verified for this project state." : "Save migration deliberately skipped with a reason.", status === "verified" ? "success" : "info"); renderTest();
    }

    async function releaseAssessment() {
        const fingerprint = await projectFingerprint(), lab = state.testRuns[0];
        const extensions = list(api.state().extensions), unreviewed = extensions.filter(item => state.extensionPolicies[item.id] !== "trusted");
        const brokenContent = state.content.filter(item => item.dependencies?.some(dependency => !state.content.some(candidate => candidate.id === dependency)));
        const gates = [
            { id: "drafts", title: "No uncommitted experiments", required: true, pass: !mapDirty && !recipePreview, detail: mapDirty ? "Map Studio has unapplied changes" : recipePreview ? "A recipe preview is open but unapplied" : "Project state is explicit" },
            { id: "structure", title: "Structural lab", required: true, pass: !!lab?.passed && lab.fingerprint === fingerprint, detail: !lab ? "Not run" : lab.fingerprint !== fingerprint ? "Stale after project changes" : lab.passed ? `${lab.maps} maps verified` : `${lab.errors} errors remain` },
            { id: "playtest", title: "Real player path", required: true, pass: state.realPlaytest.attested && state.realPlaytest.fingerprint === fingerprint, detail: !state.realPlaytest.attested ? "Human verification not recorded" : state.realPlaytest.fingerprint !== fingerprint ? "Attestation is stale" : state.realPlaytest.note },
            { id: "checkpoint", title: "Recovery checkpoint", required: true, pass: state.checkpoints.some(item => item.fingerprint === fingerprint), detail: state.checkpoints.some(item => item.fingerprint === fingerprint) ? "Current state captured" : "Capture the current state" },
            { id: "extensions", title: "Extension trust review", required: true, pass: !unreviewed.length, detail: extensions.length ? unreviewed.length ? `${unreviewed.length} not explicitly trusted` : `${extensions.length} reviewed` : "No extensions loaded" },
            { id: "content", title: "Content dependencies", required: true, pass: !brokenContent.length, detail: brokenContent.length ? `${brokenContent.length} items have missing dependencies` : `${state.content.length} items resolved` },
            { id: "migration", title: "Save migration", required: false, pass: state.migration.status === "verified" && state.migration.fingerprint === fingerprint, detail: state.migration.status === "skipped" ? `Skipped: ${state.migration.note}` : state.migration.status === "verified" && state.migration.fingerprint !== fingerprint ? "Verification is stale" : state.migration.status === "verified" ? "Verified in the real engine" : "Not run; recommended for shipped games" },
            { id: "golden", title: "Golden map comparison", required: false, pass: Object.values(state.goldenMaps || {}).length > 0 && Object.values(state.goldenMaps || {}).every(item => item.status === "verified"), detail: "Recommended regression evidence" }
        ];
        return { fingerprint, gates, ready: gates.filter(gate => gate.required).every(gate => gate.pass), checkedAt: Date.now(), unreviewed, brokenContent };
    }
    async function renderRelease() {
        productionReport = await releaseAssessment(); const passed = productionReport.gates.filter(gate => gate.pass).length;
        $("v17Main").innerHTML = `${pageHead("VERIFY & RELEASE", productionReport.ready ? "This exact project state is ready" : "Close every required gate", "Worldsmith creates reproducible release metadata. It never claims deployment, store approval, or player verification it did not perform.", `<button data-v17-action="refresh-release">Refresh evidence</button><button data-v17-action="create-release" class="v17-button v17-primary" ${productionReport.ready ? "" : "disabled"}>Create release record</button>`)}<section class="v17-release-layout"><main><article class="v17-card"><div class="v17-health-ring" style="--score:${Math.round(passed / productionReport.gates.length * 100)}"><strong>${passed}/${productionReport.gates.length}</strong><small>gates</small></div><div><small class="v17-eyebrow">CURRENT PROJECT FINGERPRINT</small><h2>${productionReport.ready ? "Required evidence is current" : "Verification is incomplete or stale"}</h2><p><code>${productionReport.fingerprint}</code> binds maps, recipes, quests, content, and extension policy.</p></div></article><section class="v17-gates">${productionReport.gates.map(gate => `<article class="v17-gate ${gate.pass ? "pass" : gate.required ? "fail" : "optional"}"><i>${gate.pass ? "✓" : gate.required ? "!" : "○"}</i><span><strong>${escapeHtml(gate.title)}</strong><small>${escapeHtml(gate.detail)}</small></span><b>${gate.pass ? "CURRENT" : gate.required ? "REQUIRED" : "OPTIONAL"}</b></article>`).join("")}</section></main><aside class="v17-inspector"><small class="v17-section-label">RELEASE EVIDENCE</small><button data-v17-action="release-lab" class="v17-button">Run structural lab</button><button data-v17-action="release-playtest" class="v17-button">Verify real playtest</button><button data-v17-action="capture-checkpoint" class="v17-button">Capture checkpoint</button><small class="v17-section-label">EXTENSIONS</small>${productionReport.unreviewed.length ? productionReport.unreviewed.map(extension => `<label class="v17-check-row"><span>${escapeHtml(extension.id)}<small>Same-process code; trust explicitly</small></span><input type="checkbox" data-v17-trust-extension="${escapeHtml(extension.id)}"></label>`).join("") : `<p>No unreviewed extensions.</p>`}<div class="v17-card"><strong>What “release” means here</strong><p>A signed-by-checksum local manifest and evidence summary. Building and distributing the RPG Maker game remain separate actions.</p></div></aside></section>`;
        $("v17Main").querySelectorAll("[data-v17-trust-extension]").forEach(input => input.onchange = async () => { if (input.checked && await confirmChange("Trust this extension?", "Studio extensions execute JavaScript in the same process. Budget monitoring is not security isolation.", "Trust for this project")) { state.extensionPolicies[input.dataset.v17TrustExtension] = "trusted"; persist(); renderRelease(); } else input.checked = false; });
    }
    async function captureCheckpoint() {
        const fingerprint = await projectFingerprint(); const maps = [];
        for (const info of api.projectInfo().maps) { try { const snapshot = api.createSnapshot(`Release checkpoint · ${new Date().toLocaleString()}`, info.id); if (snapshot) maps.push(snapshot); } catch (_) { /* the manifest still records the map checksum */ } }
        state.checkpoints.unshift({ id: uid("checkpoint"), at: Date.now(), fingerprint, maps }); state.checkpoints = state.checkpoints.slice(0, 12); persist(); notify("Recovery checkpoint captured for the current fingerprint.", "success"); await renderRelease();
    }
    async function createReleaseRecord() {
        const assessment = await releaseAssessment(); if (!assessment.ready) throw new Error("Required release evidence is incomplete or stale.");
        const version = prompt("Release version", `0.${state.releases.length + 1}.0`); if (!version) return;
        const release = { schema: "hybrid-tile-graft/worldsmith-release@1", studioVersion: VERSION, version: String(version).trim(), project: api.projectInfo().name, fingerprint: assessment.fingerprint, createdAt: new Date().toISOString(), evidence: assessment.gates.map(({ id, title, required, pass, detail }) => ({ id, title, required, status: pass ? "verified" : "skipped", detail })), realPlaytest: { at: state.realPlaytest.at, note: state.realPlaytest.note }, limitations: ["This record does not assert deployment or platform certification.", "Runtime performance and save size require in-engine measurement."] };
        const name = `worldsmith-release-${safeId(release.version)}.json`; if (api.projectInfo().open) await api.writeProjectJson(`.hybrid/releases/${name}`, release, true); api.download(name, JSON.stringify(release, null, 2), "application/json");
        state.releases.unshift(release); state.milestones.released = true; persist(); notify(`Release ${release.version} recorded for fingerprint ${release.fingerprint}.`, "success"); await renderRelease();
    }

    async function renderLibrary() {
        const query = String(state.libraryQuery || "").toLowerCase(), kind = state.libraryKind || "all";
        const items = state.content.filter(item => (kind === "all" || item.kind === kind) && (!query || `${item.name} ${item.kind} ${list(item.tags).join(" ")}`.toLowerCase().includes(query)));
        $("v17Main").innerHTML = `${pageHead("CONTENT LIBRARY", "Reuse what you made—safely", "Captured content keeps its dimensions, dependencies, checksum, and source. Installation is always previewed and reversible.", `<button data-v17-action="capture-content" class="v17-button v17-primary">Capture active map</button><button data-v17-action="import-content">Import</button><button data-v17-action="export-library">Export library</button>`)}<section class="v17-library-layout"><aside class="v17-library-sidebar"><input id="v17LibrarySearch" type="search" placeholder="Search content…" value="${escapeHtml(state.libraryQuery || "")}">${["all","map","recipe","quest"].map(value => `<button data-v17-library-kind="${value}" class="${kind === value ? "active" : ""}">${value === "all" ? "Everything" : value[0].toUpperCase() + value.slice(1)} <b>${value === "all" ? state.content.length : state.content.filter(item => item.kind === value).length}</b></button>`).join("")}</aside><main><div class="v17-library-grid">${items.map(item => `<article class="v17-content-card"><div class="v17-content-thumb">${item.kind === "map" ? "▦" : item.kind === "recipe" ? "✦" : "◇"}</div><small>${escapeHtml(item.kind.toUpperCase())}</small><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || `${item.width || "—"} × ${item.height || "—"}`)}</p><footer><button data-v17-action="favorite-content" data-id="${item.id}" aria-label="Favorite">${item.favorite ? "★" : "☆"}</button><button data-v17-action="export-content" data-id="${item.id}">Export</button><button data-v17-action="install-content" data-id="${item.id}" class="v17-button v17-primary">Install</button></footer></article>`).join("") || `<div class="v17-empty"><div><h2>No matching content</h2><p>Capture a finished map, recipe, or quest so the good parts become reusable.</p></div></div>`}</div></main></section>`;
        const search = $("v17LibrarySearch"); search.oninput = event => { state.libraryQuery = event.target.value; persist(); const position = event.target.selectionStart; renderLibrary().then(() => { $("v17LibrarySearch")?.focus(); $("v17LibrarySearch")?.setSelectionRange(position, position); }); };
        $("v17Main").querySelectorAll("[data-v17-library-kind]").forEach(button => button.onclick = () => { state.libraryKind = button.dataset.v17LibraryKind; persist(); renderLibrary(); });
    }
    async function captureContent() {
        const map = await api.mapSnapshot(), id = uid("content"), name = prompt("Library item name", `Map ${integer(api.state().activeMapId)} capture`); if (!name) return;
        const item = { schema: "hybrid-tile-graft/content@1", id, kind: "map", name: String(name).trim(), description: `Captured from ${api.projectInfo().name || "loose map"}`, sourceMapId: integer(api.state().activeMapId), width: map.width, height: map.height, tilesetId: map.tilesetId, map: clone(map), dependencies: [], tags: [], checksum: hash(map), capturedAt: Date.now(), favorite: false };
        state.content.unshift(item); persist(); notify(`“${item.name}” added to your library.`, "success"); if (state.view === "library") renderLibrary();
    }
    function contentPayload(items) { return { schema: "hybrid-tile-graft/content-library@1", studioVersion: VERSION, exportedAt: new Date().toISOString(), items: clone(items) }; }
    async function installContent(id) {
        const item = state.content.find(candidate => candidate.id === id); if (!item) throw new Error("Library item not found.");
        if (item.kind === "recipe") { state.recipe = clone(item.recipe); state.worldTab = "recipes"; persist(); notify("Recipe loaded into World & Story for preview.", "success"); return switchView("world"); }
        if (item.kind === "quest") { state.quest = clone(item.quest); state.worldTab = "quests"; persist(); notify("Quest loaded into World & Story for validation.", "success"); return switchView("world"); }
        const current = await api.mapSnapshot(); if (current.width !== item.width || current.height !== item.height) throw new Error(`This capture is ${item.width} × ${item.height}; the active map is ${current.width} × ${current.height}. Resize or choose a matching map first.`);
        if (!await confirmChange("Install this map capture?", `The active ${current.width} × ${current.height} map will be replaced after a recovery snapshot.`, "Install safely")) return;
        api.createSnapshot(`Before library install · ${item.name}`); await api.applyMapSnapshot(item.map, `Library install · ${item.name}`); await api.save(); await invalidateVerification("Library content installed"); notify(`“${item.name}” installed.`, "success");
    }
    async function importContentFile(event) {
        const file = event.target.files?.[0]; if (!file) return; const parsed = JSON.parse(await file.text()); const incoming = list(parsed.items || parsed);
        let added = 0; for (const item of incoming) if (item?.id && item?.kind && !state.content.some(candidate => candidate.id === item.id)) { state.content.push(clone(item)); added++; }
        event.target.value = ""; persist(); notify(`${added} content item${added === 1 ? "" : "s"} imported.`, "success"); if (state.view === "library") renderLibrary();
    }
    async function renderSettings() {
        $("v17Main").innerHTML = `${pageHead("CREATOR EXPERIENCE", "Make the tool fit the player", "Modes change information density and workspace scope. Accessibility preferences remain independent from sound.")}<section class="v17-settings-layout"><main><small class="v17-eyebrow">WORKSPACE MODE</small><div class="v17-mode-cards">${[["beginner","Beginner","Create, Test, Release","One recommended action at a time; specialist areas stay out of the way."],["guided","Guided","The complete creator path","Adds recipes, quests, content reuse, explanations, and budgets."],["expert","Expert","All workbenches","Adds lazy-loaded live, intelligence, extension, atlas, and performance consoles."]].map(([id,title,scope,copy]) => `<button data-v17-mode-choice="${id}" class="v17-mode-card ${state.mode === id ? "active" : ""}"><i>${state.mode === id ? "✓" : id === "beginner" ? "1" : id === "guided" ? "2" : "3"}</i><span><strong>${title}</strong><small>${scope}</small><p>${copy}</p></span></button>`).join("")}</div><small class="v17-eyebrow">ACCESSIBILITY</small>${settingToggle("highContrast", "High contrast", "Strengthen boundaries and text contrast.")}${settingToggle("reducedMotion", "Reduce motion", "Disable nonessential transitions and movement.")}${settingToggle("sound", "Interface sounds", "Short confirmation tones; independent from motion.")}${settingToggle("controller", "Controller navigation", "Navigate major areas and actions by gamepad.")}<label class="v17-setting-row"><span><strong>Interface scale</strong><small>Keep text comfortable from 90% to 130%.</small></span><input id="v17UiScale" type="range" min="0.9" max="1.3" step="0.05" value="${state.uiScale}"><b>${Math.round(state.uiScale * 100)}%</b></label></main><aside class="v17-inspector"><small class="v17-section-label">CONTROLLER GLYPHS</small><label class="v17-field"><span>Button layout</span><select id="v17ControllerLayout"><option value="auto" ${state.controllerLayout === "auto" ? "selected" : ""}>Auto detect</option><option value="xbox" ${state.controllerLayout === "xbox" ? "selected" : ""}>Xbox</option><option value="nintendo" ${state.controllerLayout === "nintendo" ? "selected" : ""}>Nintendo</option><option value="playstation" ${state.controllerLayout === "playstation" ? "selected" : ""}>PlayStation</option></select></label><div class="v17-card"><strong>Nintendo-style principle</strong><p>Readable outcomes, forgiving reversal, delightful feedback, and no false success. The visual design is original and does not copy Nintendo trademarks or assets.</p></div><small class="v17-section-label">PROJECT BUDGETS</small>${[["maxMapCells","Maximum cells per map"],["maxEventsPerMap","Maximum events per map"],["maxWarnings","Warning review budget"],["targetFrameMs","Target frame milliseconds"],["maxRuntimeSaveKb","Runtime save kilobytes"]].map(([id,label]) => `<label class="v17-field"><span>${label}</span><input type="number" min="1" data-v17-budget="${id}" value="${state.budgets[id]}"></label>`).join("")}</aside></section>`;
        $("v17Main").querySelectorAll("[data-v17-mode-choice]").forEach(button => button.onclick = () => setMode(button.dataset.v17ModeChoice));
        $("v17Main").querySelectorAll("[data-v17-setting]").forEach(input => input.onchange = () => { state[input.dataset.v17Setting] = input.checked; persist(); applyExperience(); renderSettings(); });
        $("v17UiScale").oninput = event => { state.uiScale = Number(event.target.value); persist(); applyExperience(); event.target.nextElementSibling.textContent = `${Math.round(state.uiScale * 100)}%`; };
        $("v17ControllerLayout").onchange = event => { state.controllerLayout = event.target.value; persist(); updateControllerPrompts(); };
        $("v17Main").querySelectorAll("[data-v17-budget]").forEach(input => input.onchange = () => { state.budgets[input.dataset.v17Budget] = Number(input.value); persist(); invalidateVerification("Project budgets changed"); });
    }
    function settingToggle(id, title, copy) { return `<label class="v17-setting-row"><span><strong>${title}</strong><small>${copy}</small></span><input type="checkbox" data-v17-setting="${id}" ${state[id] ? "checked" : ""}></label>`; }
    function applyExperience() {
        const root = document.documentElement; root.dataset.v17Mode = state.mode; root.classList.toggle("v17-high-contrast", !!state.highContrast); root.classList.toggle("v17-reduced-motion", !!state.reducedMotion); root.style.setProperty("--v17-scale", String(clamp(Number(state.uiScale), .9, 1.3)));
    }
    function setMode(mode) { if (!['beginner','guided','expert'].includes(mode)) return; state.mode = mode; if (mode === "beginner" && ["world","library","advanced"].includes(state.view)) state.view = "home"; persist(); applyExperience(); render(state.view); notify(`${mode[0].toUpperCase() + mode.slice(1)} workspace active.`, "success"); }
    function cycleMode() { const modes = ["beginner","guided","expert"]; setMode(modes[(modes.indexOf(state.mode) + 1) % modes.length]); }
    async function renderAdvanced() {
        $("v17Main").innerHTML = `${pageHead("EXPERT · ADVANCED WORKBENCHES", "Load specialist consoles only when needed", "The default app starts with two scripts and two stylesheets. Legacy specialist modules remain available on demand.")}<section class="v17-advanced-grid">${[["atlas","◎","World atlas & map doctor","Map topology, logic, repair, and pack workbench."],["live","●","Live event console","Inspect events, tilesets, live state, and scenarios."],["intelligence","✦","Project intelligence","Search, performance, compatibility, and ship diagnostics."],["extensions","⬡","Extension review","Permissions and compatibility. Same-process callbacks are never described as isolated."],["benchmark","⌁","Benchmark laboratory","Focused job and benchmark tools from the specialist suite."]].map(([id,icon,title,copy]) => `<article class="v17-advanced-card"><i>${icon}</i><h2>${title}</h2><p>${copy}</p><button data-v17-action="open-workbench" data-workbench="${id}" class="v17-button v17-primary">Load workbench</button></article>`).join("")}</section><article class="v17-card"><strong>Startup budget</strong><p>v17 shell + core only. The eight historical specialist scripts and seven stylesheets load once, after an explicit Expert action.</p></article>`;
    }
    async function loadLegacyWorkbenches() {
        if (legacyPromise) return legacyPromise;
        legacyPromise = (async () => {
            for (let version = 10; version <= 16; version++) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `HybridTileStudioV${version}.css`; document.head.append(link); }
            for (let version = 9; version <= 16; version++) await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = `HybridTileStudioV${version}.js`; script.onload = resolve; script.onerror = () => reject(new Error(`Could not load specialist module V${version}.`)); document.body.append(script); });
            notify("Expert workbenches loaded for this session.", "success");
        })(); return legacyPromise;
    }
    async function openWorkbench(name) {
        await loadLegacyWorkbenches(); if ($("v17Studio")?.open) $("v17Studio").close();
        if (name === "atlas") window.HybridTileStudioV13?.open("atlas");
        else if (name === "live") window.HybridTileStudioV14?.open("events");
        else if (name === "intelligence") window.HybridTileStudioV15?.open("intelligence");
        else if (name === "extensions") window.HybridTileStudioV15?.open("extensions");
        else window.HybridTileStudioV12?.openFeature("benchmarks");
        setTimeout(() => { const openDialogs = [...document.querySelectorAll("dialog[open]")].filter(dialog => dialog.id !== "v17Studio"); for (const dialog of openDialogs) dialog.addEventListener("close", () => { if (![...document.querySelectorAll("dialog[open]")].some(item => item.id !== "v17Studio")) { $("v17Studio").showModal(); render("advanced"); } }, { once: true }); }, 50);
    }

    async function undo() {
        if (state.view !== "create" || !mapHistory.length || !mapDraft) return;
        mapRedo.push({ label: "Redo map edit", map: clone(mapDraft) }); const item = mapHistory.pop(); mapDraft = clone(item.map); mapDirty = hash(mapDraft) !== hash(mapBase); drawMapCanvas(); updateChrome(); tone("move");
    }
    async function redo() {
        if (state.view !== "create" || !mapRedo.length || !mapDraft) return;
        mapHistory.push({ label: "Undo map edit", map: clone(mapDraft) }); const item = mapRedo.pop(); mapDraft = clone(item.map); mapDirty = hash(mapDraft) !== hash(mapBase); drawMapCanvas(); updateChrome(); tone("move");
    }
    async function runAction(action, element = null) {
        const routes = { "home-create":"create", "home-world":"world", "home-test":"test", "home-release":"release", "release-playtest":"test", "continue": state.view === "home" ? (!state.milestones.edited ? "create" : !state.milestones.generated ? "world" : !state.milestones.tested ? "test" : "release") : state.view };
        if (routes[action]) { if (action === "release-playtest") state.testTab = "journey"; return switchView(routes[action]); }
        if (action === "open-project") return api.openProject();
        if (action === "open-maps") return $("mapFileInput").click();
        if (action === "guide") return openPip();
        if (action === "home-health") { state.testTab = "structural"; await switchView("test"); return runStructuralLab(); }
        if (action === "apply-map") return applyMapDraft();
        if (action === "discard-map") { if (mapDirty && !await confirmChange("Discard this map experiment?", `${mapChanges()} uncommitted tile changes will be forgotten.`, "Discard experiment")) return; await ensureMapDraft(true); return renderCreate(); }
        if (action === "preview-recipe") return previewRecipe();
        if (action === "apply-recipe") return applyRecipePreview();
        if (action === "add-stage") { state.recipe.stages.push({ id: uid("stage"), type: "scatter", name: "New detail stage", layer: 2, tileA: 1, tileB: 0, density: .08, count: 20 }); recipePreview = null; persist(); return renderWorld(); }
        if (action === "remove-stage") { const index = integer(element?.dataset.index); if (state.recipe.stages.length <= 1) throw new Error("A recipe needs at least one stage."); state.recipe.stages.splice(index, 1); recipePreview = null; persist(); return renderWorld(); }
        if (action === "add-quest-node") { const id = `step-${state.quest.nodes.length + 1}`; state.quest.nodes.splice(-1, 0, { id, type: "objective", title: "New objective", description: "Describe the player-visible goal.", next: state.quest.nodes.at(-1)?.id || "" }); const previous = state.quest.nodes.at(-3); if (previous) previous.next = id; persist(); return renderQuestBuilder(); }
        if (action === "remove-quest-node") { state.quest.nodes.splice(integer(element?.dataset.index), 1); persist(); return renderQuestBuilder(); }
        if (action === "save-quest") return saveQuest();
        if (action === "export-quest") return api.download(`${safeId(state.quest.name)}.quest.json`, JSON.stringify({ schema:"hybrid-tile-graft/worldsmith-quest@1", quest:state.quest }, null, 2), "application/json");
        if (action === "run-lab" || action === "release-lab") { if (action === "release-lab") { state.testTab = "structural"; await switchView("test"); } return runStructuralLab(); }
        if (action === "capture-golden") return captureGolden();
        if (action === "compare-golden") return compareGolden();
        if (action === "launch-playtest") return launchRealPlaytest();
        if (action === "attest-playtest") return attestPlaytest();
        if (action === "clear-attestation") { state.realPlaytest.attested = false; state.realPlaytest.fingerprint = ""; persist(); return renderTest(); }
        if (action === "verify-migration") return recordMigration("verified");
        if (action === "skip-migration") return recordMigration("skipped");
        if (action === "refresh-release") return renderRelease();
        if (action === "capture-checkpoint") return captureCheckpoint();
        if (action === "create-release") return createReleaseRecord();
        if (action === "capture-content") return captureContent();
        if (action === "import-content") return $("v17ContentImport").click();
        if (action === "export-library") return api.download("worldsmith-content-library.htgcontent", JSON.stringify(contentPayload(state.content), null, 2), "application/json");
        if (action === "favorite-content") { const item = state.content.find(candidate => candidate.id === element?.dataset.id); if (item) item.favorite = !item.favorite; persist(); return renderLibrary(); }
        if (action === "export-content") { const item = state.content.find(candidate => candidate.id === element?.dataset.id); if (item) api.download(`${safeId(item.name)}.htgcontent`, JSON.stringify(contentPayload([item]), null, 2), "application/json"); return; }
        if (action === "install-content") return installContent(element?.dataset.id);
        if (action === "open-workbench") return openWorkbench(element?.dataset.workbench);
    }
    function guideCopy() {
        return {
            home: ["One clear next step", "Follow the creator path or jump to any workspace your current mode exposes."],
            create: ["Experiment without fear", "Paint locally. Apply only when the preview is right; Worldsmith snapshots the previous map first."],
            world: ["Deterministic, readable systems", "A recipe is a short list of stages. The seed makes its output repeatable; quest validation keeps the critical path connected."],
            test: ["Evidence has a lifetime", "Results bind to a project fingerprint. Any material change makes old evidence stale instead of silently green."],
            release: ["No pretend shipping", "A release record is available only when all required evidence matches the exact current project state."],
            library: ["Reuse with context", "Captured content keeps its size, source, dependencies, and checksum, then installs through a recovery snapshot."],
            settings: ["Different creators need different density", "Beginner, Guided, and Expert genuinely change workspace scope; accessibility options are independent."],
            advanced: ["Power stays close", "Specialist consoles load only after you ask, keeping the everyday startup understandable and quick."]
        }[state.view] || ["Worldsmith", "Make, shape, test, verify, and release."];
    }
    function openPip() { const [title, copy] = guideCopy(); $("v17PipTitle").textContent = title; $("v17PipText").textContent = copy; $("v17Pip").showModal(); tone("open"); }
    function confirmChange(title, textValue, accept = "Continue") {
        const dialog = $("v17Confirm"); $("v17ConfirmTitle").textContent = title; $("v17ConfirmText").textContent = textValue; $("v17ConfirmAccept").textContent = accept;
        return new Promise(resolve => { const close = () => { dialog.removeEventListener("close", close); resolve(dialog.returnValue === "confirm"); }; dialog.addEventListener("close", close); dialog.showModal(); });
    }
    function commands() {
        const entries = VIEWS.filter(item => item[3] !== "expert" || state.mode === "expert").filter(item => item[3] !== "guided" || state.mode !== "beginner").map(item => ({ id:`view:${item[0]}`, icon:item[2], title:`Go to ${item[1]}`, copy:`Open the ${item[1]} workspace` }));
        return entries.concat([{ id:"action:open-project", icon:"＋", title:"Open project", copy:"Choose an RPG Maker MZ project folder" }, { id:"action:run-lab", icon:"✓", title:"Run structural lab", copy:"Scan every connected map" }, { id:"action:guide", icon:"?", title:"Ask Pip", copy:"Explain the current workspace" }]);
    }
    function openCommands() { $("v17CommandQuery").value = ""; renderCommands(); $("v17CommandPalette").showModal(); setTimeout(() => $("v17CommandQuery").focus(), 20); }
    function renderCommands() { const query = $("v17CommandQuery").value.toLowerCase(); const values = commands().filter(item => !query || `${item.title} ${item.copy}`.toLowerCase().includes(query)); $("v17CommandResults").innerHTML = values.map(item => `<button data-v17-command="${item.id}"><i>${item.icon}</i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.copy)}</small></span><kbd>↵</kbd></button>`).join("") || "<p>No matching command.</p>"; }
    async function executeCommand(command) { const [kind, value] = command.split(":"); if (kind === "view") return switchView(value); return runAction(value); }
    function notify(message, type = "info") { const host = $("v17Toasts"); if (!host) return; const toast = document.createElement("div"); toast.className = `v17-toast ${type}`; toast.innerHTML = `<i>${type === "error" ? "!" : type === "success" ? "✓" : type === "warning" ? "△" : "i"}</i><span>${escapeHtml(message)}</span>`; host.append(toast); setTimeout(() => toast.remove(), state.reducedMotion ? 5000 : 4200); tone(type === "error" ? "error" : type === "success" ? "success" : "move"); }
    function tone(kind) {
        if (!state.sound || !window.AudioContext) return; try { const context = tone.context ||= new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), notes = { move: 330, open: 440, success: 660, error: 180 }; oscillator.frequency.value = notes[kind] || 330; gain.gain.setValueAtTime(.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .08); } catch (_) { /* audio is optional */ }
    }
    function handleKeys(event) {
        if (event.ctrlKey && event.key.toLowerCase() === "k") { event.preventDefault(); return openCommands(); }
        if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
        if (event.key === "Escape" && $("v17CommandPalette")?.open) return $("v17CommandPalette").close();
        if (state.view === "create" && mapDraft && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(event.key) && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
            event.preventDefault(); if (event.key === "ArrowUp") state.map.cursorY--; if (event.key === "ArrowDown") state.map.cursorY++; if (event.key === "ArrowLeft") state.map.cursorX--; if (event.key === "ArrowRight") state.map.cursorX++; state.map.cursorX = clamp(state.map.cursorX, 0, mapDraft.width - 1); state.map.cursorY = clamp(state.map.cursorY, 0, mapDraft.height - 1); if (event.key === " ") performMapTool({ x:state.map.cursorX, y:state.map.cursorY }, true); drawMapCanvas();
        }
    }
    function controllerButtons(gamepad) { const nintendo = state.controllerLayout === "nintendo" || (state.controllerLayout === "auto" && /nintendo|switch|joy-con/i.test(gamepad?.id || "")); return { select: nintendo ? 1 : 0, back: nintendo ? 0 : 1, label: nintendo ? "Nintendo" : state.controllerLayout === "playstation" ? "PlayStation" : "Standard" }; }
    function updateControllerPrompts(gamepad = null) { const layout = controllerButtons(gamepad); if ($("v17ControllerPrompt")) $("v17ControllerPrompt").textContent = state.controller && gamepad ? `${layout.label} controller connected` : state.controller ? "Controller ready" : "Controller off"; if ($("v17SelectGlyph")) $("v17SelectGlyph").textContent = layout.select === 1 ? "A" : state.controllerLayout === "playstation" ? "×" : "A"; if ($("v17BackGlyph")) $("v17BackGlyph").textContent = layout.back === 0 && layout.label === "Nintendo" ? "B" : state.controllerLayout === "playstation" ? "○" : "B"; }
    function pollGamepad() {
        if (!state.controller) { gamepadLoop = requestAnimationFrame(pollGamepad); return; }
        const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean); updateControllerPrompts(gamepad);
        if (gamepad) { const layout = controllerButtons(gamepad), pressed = index => !!gamepad.buttons[index]?.pressed, edge = index => pressed(index) && !lastGamepad[index]; if (edge(12) || edge(14)) focusRelative(-1); if (edge(13) || edge(15)) focusRelative(1); if (edge(layout.select)) document.activeElement?.click?.(); if (edge(layout.back)) { const open = [...document.querySelectorAll("dialog[open]")].at(-1); if (open && open.id !== "v17Studio") open.close(); } lastGamepad = Object.fromEntries(gamepad.buttons.map((_, index) => [index, pressed(index)])); }
        gamepadLoop = requestAnimationFrame(pollGamepad);
    }
    function focusRelative(direction) { const items = [...$("v17Studio").querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),canvas[tabindex]")].filter(item => item.offsetParent !== null); if (!items.length) return; const index = items.indexOf(document.activeElement); items[(index + direction + items.length) % items.length].focus(); tone("move"); }
    async function loadProjectData() { currentFingerprint = await projectFingerprint(); }

    window.HybridTileStudioV17 = Object.freeze({ version: VERSION, open: view => { if (!$("v17Studio").open) $("v17Studio").showModal(); return render(view || state.view); }, close: () => $("v17Studio").close(), switchView, runStructuralLab, releaseAssessment, projectFingerprint, previewRecipe, validateQuest, state: () => clone(state), mapDraft: () => clone(mapDraft) });
    inject();
})();
