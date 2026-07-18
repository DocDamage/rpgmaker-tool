/* Hybrid Tile Studio v18.1 — Stability, Scale, and Recovery */
(() => {
    "use strict";

    const api = window.HybridTileStudio;
    const services = window.HybridTileStudioServicesV18;
    const cryptoService = window.HybridTileCryptoV18;
    const storageService = window.HybridTileStorageV18;
    const schemaService = window.HybridTileSchemaV18;
    const pwaService = window.HybridTilePwaV18;
    if (!api || !services) return;

    const VERSION = "18.1.0";
    const $ = id => document.getElementById(id);
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const list = value => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
    const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const safeId = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
    const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
    const fingerprintDetails = value => {
        if (!cryptoService?.fingerprint) throw new Error("Canonical SHA-256 support is unavailable; release evidence cannot be created safely.");
        return cryptoService.fingerprint(value);
    };
    const hash = value => fingerprintDetails(value).id;
    const safe = callback => async event => {
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
        ["settings", "Settings", "⚙", "beginner"],
        ["advanced", "Advanced", "◆", "expert"]
    ];

    const defaults = {
        view: "home",
        mode: "guided",
        sound: true,
        soundVolume: .45,
        controller: true,
        controllerLayout: "auto",
        controllerBindings: { select: 0, back: 1, undo: 2, redo: 3, previousArea: 4, nextArea: 5 },
        reducedMotion: false,
        highContrast: false,
        colorBlind: false,
        largeText: false,
        locale: "en",
        pipMode: "contextual",
        pipSeen: false,
        recoveryRetentionDays: 30,
        uiScale: 1,
        map: { selectedId: 0, tool: "paint", layer: 0, tileId: 2048, brushSize: 1, overlay: "events", zoom: 1, palette: "A1", palettePage: 0, paletteQuery: "", cursorX: 0, cursorY: 0, layerVisibility: [true,true,true,true,true,true], favorites: [], recent: [] },
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
        quest: services.normalizeQuest({ id: "first-quest", name: "First Quest", nodes: [
            { id: "start", type: "start", title: "Quest begins", description: "The player accepts the quest.", next: "objective" },
            { id: "objective", type: "objective", title: "Complete the objective", description: "Describe what the player must do.", next: "complete" },
            { id: "complete", type: "complete", title: "Quest complete", description: "Reward the player." }
        ] }),
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
        notices: [],
        draftManifest: {},
        verificationPolicyVersion: 2
    };

    function normalizedState(raw = {}) {
        const value = Object.assign(clone(defaults), clone(raw || {}));
        value.map = Object.assign(clone(defaults.map), value.map || {});
        value.map.layerVisibility = list(value.map.layerVisibility).length === 6 ? value.map.layerVisibility.map(Boolean) : clone(defaults.map.layerVisibility);
        value.map.favorites = [...new Set(list(value.map.favorites).map(integer).filter(id => id >= 0))];
        value.map.recent = [...new Set(list(value.map.recent).map(integer).filter(id => id >= 0))].slice(0, 16);
        value.recipe = services.normalizeRecipe(value.recipe);
        value.quest = services.normalizeQuest(value.quest);
        value.budgets = Object.assign(clone(defaults.budgets), value.budgets || {});
        value.realPlaytest = Object.assign(clone(defaults.realPlaytest), value.realPlaytest || {});
        value.migration = Object.assign(clone(defaults.migration), value.migration || {});
        value.milestones = Object.assign(clone(defaults.milestones), value.milestones || {});
        value.controllerBindings = Object.assign(clone(defaults.controllerBindings), value.controllerBindings || {});
        for (const key of ["testRuns", "checkpoints", "releases", "notices"]) value[key] = list(value[key]);
        value.content = services.normalizeContentLibrary(value.content, hash);
        value.extensionPolicies ||= {};
        value.goldenMaps ||= {};
        value.draftManifest ||= {};
        value.uiScale = clamp(Number(value.uiScale || 1), .9, 1.75);
        value.soundVolume = clamp(Number(value.soundVolume ?? .45), 0, 1);
        value.pipMode = ["contextual", "first-run", "hidden"].includes(value.pipMode) ? value.pipMode : "contextual";
        value.recoveryRetentionDays = clamp(integer(value.recoveryRetentionDays, 30), 1, 365);
        return value;
    }

    function persistedProjectState() {
        const v18 = api.getExtensionData("worldsmith-v18", null);
        if (v18 && Object.keys(v18).length) return v18;
        return api.getExtensionData("worldsmith-v17", {});
    }

    let state = normalizedState(persistedProjectState());

    let persistTimer = 0;
    let mapBase = null;
    let mapDraft = null;
    let mapBaseChecksum = "";
    let mapId = 0;
    let mapDirty = false;
    let mapDirtyIndices = new Set();
    let activeMapTransaction = null;
    let mapConflicts = null;
    let mapSelection = null;
    let selectionStart = null;
    let mapClipboard = null;
    let panStart = null;
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
    let draftPersistTimer = 0;
    let canonicalPersistTimer = 0;
    let selectedQuestNode = "start";
    let mapDrawFrame = 0;
    let minimapDrawTimer = 0;
    let lastMinimapDraw = 0;
    let recentProjects = [];
    let browserStorageEstimate = { usage: 0, quota: 0, persisted: false, backend: "unavailable" };
    let recoveryStatus = { state: "idle", backend: "none", at: 0, message: "No draft changes yet." };
    const mapPerformance = { lastDrawMs: 0, lastTilesDrawn: 0, lastFillMs: 0, lastFillCells: 0, frames: 0 };

    function persist() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => api.setExtensionData("worldsmith-v18", state).catch(error => notify(`Could not save workspace preferences: ${error.message}`, "error")), 120);
        scheduleCanonicalStateWrite();
    }

    function scheduleCanonicalStateWrite() {
        if (!api.projectInfo().open) return;
        clearTimeout(canonicalPersistTimer);
        canonicalPersistTimer = setTimeout(() => api.writeProjectJson(".hybrid/worldsmith/WorldsmithState.json", {
            format: "HybridWorldsmithState", version: 2, studioVersion: VERSION, savedAt: new Date().toISOString(),
            recipe: services.recipePayload(state.recipe, hash), quest: services.questPayload(state.quest, hash),
            content: services.contentPayload(state.content, hash), budgets: clone(state.budgets), extensionPolicies: clone(state.extensionPolicies)
        }, true).catch(error => notify(`Could not write canonical Worldsmith state: ${error.message}`, "error")), 600);
    }

    function shell() {
        const nav = VIEWS.map(([id, label, icon, level]) => `<button type="button" data-v18-view="${id}" class="v18-${level}" aria-label="${label}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`).join("");
        return `<dialog id="v18Studio" class="v18-studio" aria-label="Hybrid Tile Studio Worldsmith">
          <div class="v18-app">
            <header class="v18-top">
              <div class="v18-brand"><img src="HybridTileGuide.png" alt="Pip, the Worldsmith guide"><span><strong>Hybrid Tile Studio</strong><small>WORLDSMITH · v18.1</small></span></div>
              <div class="v18-project"><strong id="v18Project">No project open</strong><small id="v18ProjectMeta">A friendly RPG Maker MZ creator suite</small></div>
              <button id="v18Undo" class="v18-icon-button" type="button" aria-label="Undo" title="Undo">↶</button>
              <button id="v18Redo" class="v18-icon-button" type="button" aria-label="Redo" title="Redo">↷</button>
              <button id="v18Mode" class="v18-mode-button" type="button">GUIDED</button>
              <button id="v18Commands" class="v18-command-button" type="button"><b>⌕</b><span>Commands</span><kbd>Ctrl K</kbd></button>
              <button id="v18Help" class="v18-icon-button" type="button" aria-label="Ask Pip for help">?</button>
            </header>
            <nav class="v18-nav" aria-label="Worldsmith areas">${nav}<div class="v18-nav-spacer"></div></nav>
            <div id="v18UpdateBanner" class="v18-update-banner" hidden><span><strong>Worldsmith update ready</strong><small>Reload when your current draft is safely saved.</small></span><button data-v18-action="activate-update" type="button">Reload into update</button></div>
            <main id="v18Main" class="v18-main" tabindex="-1"></main>
            <footer class="v18-footer"><span id="v18Status"><i class="v18-status-dot"></i>Ready</span><span id="v18ControllerPrompt">Keyboard ready</span><span>Move <kbd>↑↓←→</kbd></span><span>Select <kbd id="v18SelectGlyph">A</kbd></span><span>Back <kbd id="v18BackGlyph">B</kbd></span></footer>
            <div id="v18Toasts" class="v18-toasts" aria-live="polite" aria-atomic="true"></div>
          </div>
        </dialog>
        <dialog id="v18Confirm" class="v18-dialog"><form method="dialog" class="v18-dialog-card"><small class="v18-eyebrow">SAFE CHANGE</small><h2 id="v18ConfirmTitle">Confirm action</h2><p id="v18ConfirmText"></p><div class="v18-dialog-actions"><button value="cancel" class="v18-button">Cancel</button><button id="v18ConfirmAccept" value="confirm" class="v18-button v18-primary">Continue</button></div></form></dialog>
        <dialog id="v18Pip" class="v18-dialog"><div class="v18-dialog-card v18-pip-panel"><img src="HybridTileGuide.png" alt="Pip"><small class="v18-eyebrow">PIP'S WORLDMAKING TIP</small><h2 id="v18PipTitle">What are we making?</h2><p id="v18PipText"></p><div class="v18-dialog-actions"><button id="v18PipShow" class="v18-button v18-primary" type="button">Show me</button><button id="v18PipClose" class="v18-button" type="button">Got it</button></div></div></dialog>
        <dialog id="v18CommandPalette" class="v18-dialog v18-command-dialog"><header><b>⌕</b><input id="v18CommandQuery" type="search" placeholder="Go somewhere or do something…" aria-label="Search commands"><kbd>Esc</kbd></header><div id="v18CommandResults" class="v18-command-results"></div></dialog>
        <dialog id="v18InputDialog" class="v18-dialog"><form method="dialog" class="v18-dialog-card"><small class="v18-eyebrow">WORLDMAKER INPUT</small><h2 id="v18InputTitle">Enter a value</h2><p id="v18InputText"></p><label class="v18-field"><span id="v18InputLabel">Value</span><input id="v18InputValue" type="text" autocomplete="off"></label><div class="v18-dialog-actions"><button value="cancel" class="v18-button">Cancel</button><button value="confirm" class="v18-button v18-primary">Continue</button></div></form></dialog>
        <input id="v18ContentImport" type="file" accept=".htgcontent,.json,application/json" hidden>
        <input id="v18QuestImport" type="file" accept=".htgquest,.json,application/json" hidden>
        <input id="v18RecipeImport" type="file" accept=".htggraph,.json,application/json" hidden>`;
    }

    function inject() {
        document.documentElement.classList.add("v18-active");
        document.body.insertAdjacentHTML("beforeend", shell());
        wireShell();
        applyExperience();
        updateChrome();
        $("v18Studio").showModal();
        render(state.view);
        document.addEventListener("HybridTileStudio:project-opened", safe(async () => {
            state = normalizedState(persistedProjectState());
            const ids=api.projectInfo().maps.map(item=>item.id);
            state.map.selectedId = ids.includes(integer(state.map.selectedId)) ? integer(state.map.selectedId) : ids[0] || api.state().activeMapId || 0;
            state.milestones.opened = true;
            resetMapDraft();
            await loadProjectData();
            persist();
            await render("home");
            notify("Project connected. Your first safe action is ready.");
        }));
        document.addEventListener("keydown", handleKeys, true);
        window.addEventListener("beforeunload", event => { if (mapDirty) { event.preventDefault(); event.returnValue = ""; } });
        document.addEventListener("dragover", event => { if ($("v18Studio")?.open && mapDirty) event.preventDefault(); }, true);
        document.addEventListener("drop", event => { if ($("v18Studio")?.open && mapDirty) { event.preventDefault(); event.stopImmediatePropagation(); notify("Apply or discard the current map experiment before opening another project.", "warning"); } }, true);
        if (navigator.getGamepads) gamepadLoop = requestAnimationFrame(pollGamepad);
        document.addEventListener("HybridTileStudio:update-available", () => { const banner = $("v18UpdateBanner"); if (banner) banner.hidden = false; });
        document.dispatchEvent(new CustomEvent("HybridTileStudio:v18-ready", { detail: { version: VERSION, startupModules: 7 } }));
    }

    function wireShell() {
        $("v18Studio").addEventListener("click", safe(async event => {
            const view = event.target.closest("[data-v18-view]");
            if (view) return switchView(view.dataset.v18View);
            const action = event.target.closest("[data-v18-action]");
            if (action) return runAction(action.dataset.v18Action, action);
        }));
        $("v18Mode").onclick = cycleMode;
        $("v18Undo").onclick = undo;
        $("v18Redo").onclick = redo;
        $("v18Commands").onclick = openCommands;
        $("v18Help").onclick = openPip;
        $("v18PipClose").onclick = () => $("v18Pip").close();
        $("v18PipShow").onclick = () => { $("v18Pip").close(); runAction("continue"); };
        $("v18CommandQuery").oninput = renderCommands;
        $("v18CommandResults").onclick = safe(async event => {
            const button = event.target.closest("[data-v18-command]");
            if (!button) return;
            $("v18CommandPalette").close();
            await executeCommand(button.dataset.v18Command);
        });
        $("v18ContentImport").onchange = safe(importContentFile);
        $("v18QuestImport").onchange = safe(importQuestFile);
        $("v18RecipeImport").onchange = safe(importRecipeFile);
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
        if (state.pipMode === "first-run" && !state.pipSeen && !document.querySelector("dialog[open]:not(#v18Studio)")) {
            state.pipSeen = true;
            persist();
            setTimeout(() => openPip(true), 0);
        }
    }

    function updateChrome() {
        const info = api.projectInfo();
        const view = currentView();
        if ($("v18Project")) $("v18Project").textContent = info.open ? info.name : hasMaps() ? "Loose map workspace" : "No project open";
        if ($("v18ProjectMeta")) $("v18ProjectMeta").textContent = info.open ? `${info.maps.length} maps · ${view[1]}` : "A friendly RPG Maker MZ creator suite";
        document.querySelectorAll("[data-v18-view]").forEach(button => {
            const active = button.dataset.v18View === state.view;
            button.classList.toggle("active", active);
            if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
        });
        if ($("v18Mode")) $("v18Mode").textContent = state.mode.toUpperCase();
        updateMapActions();
        updateControllerPrompts();
    }

    function setRecoveryStatus(status, backend = "none", message = "") {
        recoveryStatus = { state: status, backend, message, at: Date.now() };
        updateMapActions();
    }
    function recoveryStatusText() {
        if (recoveryStatus.state === "pending") return "Saving recovery draft…";
        if (recoveryStatus.state === "saved") return `Draft saved to ${recoveryStatus.backend === "project" ? "project" : "browser recovery"} at ${new Date(recoveryStatus.at).toLocaleTimeString()}`;
        if (recoveryStatus.state === "fallback") return `Project write failed; draft preserved in browser recovery at ${new Date(recoveryStatus.at).toLocaleTimeString()}`;
        if (recoveryStatus.state === "failed") return `Recovery failed: ${recoveryStatus.message || "storage unavailable"}`;
        if (recoveryStatus.state === "applied") return `Applied to the project at ${new Date(recoveryStatus.at).toLocaleTimeString()}`;
        if (recoveryStatus.state === "recovered") return `Recovered draft from ${recoveryStatus.backend === "project" ? "the project" : "browser storage"}`;
        return recoveryStatus.message || "No draft changes yet.";
    }
    function updateMapActions() {
        const count = mapChanges();
        mapDirty = count > 0 || !!mapConflicts?.length;
        const apply = $("v18ApplyMap") || document.querySelector('[data-v18-action="apply-map"]');
        if (apply) {
            apply.disabled = !mapDirty || !!mapConflicts?.length;
            apply.textContent = mapConflicts?.length ? `Resolve ${mapConflicts.length} conflicts` : `Apply ${count} change${count === 1 ? "" : "s"}`;
        }
        const countTarget = $("v18ChangeCount");
        if (countTarget) countTarget.textContent = String(count);
        const recovery = $("v18RecoveryStatus");
        if (recovery) recovery.textContent = recoveryStatusText();
        if ($("v18Undo")) $("v18Undo").disabled = state.view !== "create" || !mapHistory.length;
        if ($("v18Redo")) $("v18Redo").disabled = state.view !== "create" || !mapRedo.length;
        if ($("v18Status")) {
            const label = mapDirty ? `${count} recoverable map change${count === 1 ? "" : "s"}` : currentView()[1];
            $("v18Status").innerHTML = `<i class="v18-status-dot${mapDirty ? " dirty" : ""}"></i>${escapeHtml(label)}`;
        }
    }
    async function assertSchema(value, name) {
        if (!schemaService?.assertNamed) return value;
        return schemaService.assertNamed(value, name);
    }
    async function loadRecentProjects() {
        if (!window.hybridTileNative?.recentProjects) { recentProjects = []; return recentProjects; }
        try { recentProjects = list(await window.hybridTileNative.recentProjects()).slice(0, 6); }
        catch (_) { recentProjects = []; }
        return recentProjects;
    }
    function renderEmpty() {
        $("v18Main").innerHTML = `<section class="v18-empty"><div><img src="HybridTileGuide.png" alt="Pip holding a map"><small class="v18-eyebrow">WELCOME, WORLDMAKER</small><h1>Open an RPG Maker project</h1><p>Connect a project, reopen a recent one, or learn in the bundled practice map. Project writes remain previewed, reversible, and explicit.</p><div class="v18-empty-actions"><button data-v18-action="open-project" class="v18-button v18-primary">Choose Project Folder</button><button data-v18-action="practice-project" class="v18-button">Open Practice Project</button><button data-v18-action="open-maps" class="v18-button">Open Map Files</button></div></div></section>`;
    }

    function pageHead(eyebrow, title, copy, actions = "") {
        return `<header class="v18-page-head"><div><small class="v18-eyebrow">${escapeHtml(eyebrow)}</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div><aside class="v18-page-actions">${actions}</aside></header>`;
    }

    function metric(value, label, color = "blue") { return `<article class="v18-metric ${color}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`; }
    function finding(severity, title, copy) { const icon = severity === "error" ? "!" : severity === "warning" ? "△" : severity === "success" ? "✓" : "i"; return `<article class="v18-finding ${severity}"><i>${icon}</i><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></span></article>`; }

    async function renderHome() {
        const info = api.projectInfo();
        await loadRecentProjects();
        const run = state.testRuns[0];
        const next = !hasMaps() ? ["open-project", "Open your project", "Connect the project safely"]
            : !state.milestones.edited ? ["home-create", "Make one visible improvement", "Try it, preview it, then keep or revert"]
            : !state.milestones.generated ? ["home-world", "Give the world a system", "Preview a recipe on the current map"]
            : !state.milestones.tested ? ["home-test", "Prove the player path", "Run structural checks and a real playtest"]
            : ["home-release", "Prepare a verified build", "Every required gate must be current"];
        const completed = Object.values(state.milestones).filter(Boolean).length;
        const recents = recentProjects.length ? `<section class="v18-recent"><header><div><small class="v18-eyebrow">RECENT PROJECTS</small><h2>Continue where you left off</h2></div></header><div class="v18-recent-grid">${recentProjects.map(item => `<button data-v18-action="open-recent" data-path="${escapeHtml(item.path)}" ${item.available === false ? "disabled" : ""}><span><strong>${escapeHtml(item.name || item.path)}</strong><small>${item.available === false ? "Folder unavailable" : `${item.recoveryCount || 0} recovery file${item.recoveryCount === 1 ? "" : "s"} · ${item.openedAt ? new Date(item.openedAt).toLocaleDateString() : "recent"}`}</small></span><b>${item.available === false ? "!" : "›"}</b></button>`).join("")}</div></section>` : "";
        $("v18Main").innerHTML = `${pageHead("YOUR WORLD AT A GLANCE", "Welcome back, worldmaker", "One clear next step, with every advanced tool close when you need it.", `<button data-v18-action="open-project">Open Project</button><button data-v18-action="practice-project">Practice Project</button><button data-v18-action="home-health">Project checkup</button>`)}
          <section class="v18-hero"><div><small class="v18-eyebrow">PIP'S RECOMMENDATION</small><h2>${escapeHtml(next[1])}</h2><p>${escapeHtml(next[2])}. Worldsmith explains the change before writing anything to the project.</p><div class="v18-hero-actions"><button data-v18-action="${next[0]}" class="v18-button v18-primary">Continue</button><button data-v18-action="guide" class="v18-button">Ask Pip why</button></div></div><aside class="v18-hero-pip"><img src="HybridTileGuide.png" alt="Pip points toward the recommended action"><div class="v18-pip-bubble">${run?.passed ? "Your last lab passed. Nice work!" : hasMaps() ? "Let’s make one thing better." : "I’ll help you get started."}</div></aside></section>
          <section class="v18-metrics">${metric(info.maps.length || (hasMaps() ? 1 : 0), "Connected maps", "blue")}${metric(state.content.length, "Reusable creations", "purple")}${metric(run ? run.errors : "—", "Open test errors", run?.errors ? "red" : "mint")}${metric(`${completed}/6`, "Journey milestones", "yellow")}</section>
          <section class="v18-journey"><header><div><small class="v18-eyebrow">THE FRIENDLY CREATOR PATH</small><h2>Connect → Create → Shape → Test → Verify → Release</h2></div><b>${completed}/6</b></header><div class="v18-journey-grid">${[
            ["home", "1", "Connect", "Open the project safely", state.milestones.opened],
            ["create", "2", "Create", "Paint the first improvement", state.milestones.edited],
            ["world", "3", "Shape", "Generate or connect story", state.milestones.generated || state.milestones.quest],
            ["test", "4", "Test", "Check structure and journeys", state.milestones.tested],
            ["release", "5", "Verify", "Pass every current gate", !!productionReport?.ready],
            ["release", "6", "Release", "Create reproducible metadata", state.milestones.released]
          ].map(([view, icon, title, copy, done]) => `<button data-v18-view="${view}"><i>${done ? "✓" : icon}</i><span><strong>${title}</strong><small>${copy}</small></span><b>${done ? "DONE" : "›"}</b></button>`).join("")}</div></section>
          ${recents}
          <section class="v18-action-grid">${[
            ["create", "▦", "Map Studio", "Paint with real tiles and reversible layers", "beginner"],
            ["world", "✦", "World & Story", "Preview generation and build connected quests", "guided"],
            ["test", "▶", "Playtest Laboratory", "Separate verified, failed, skipped, and stale results", "beginner"],
            ["library", "▤", "Content Library", "Capture and safely reuse your best work", "guided"],
            ["settings", "⚙", "Creator Experience", "Real Beginner, Guided, and Expert workspaces", "guided"],
            ["advanced", "◆", "Advanced Workbenches", "Load specialist consoles only when requested", "expert"]
          ].map(([view, icon, title, copy, level]) => `<button data-v18-view="${view}" class="v18-action-card v18-${level}"><i>${icon}</i><span><strong>${title}</strong><small>${copy}</small></span></button>`).join("")}</section>`;
    }

    function draftPath(id) { return `.hybrid/worldsmith/drafts/Map${String(integer(id)).padStart(3, "0")}.htgmapdraft`; }
    function draftStorageKey(id) { return `htg-v18-draft:${api.projectInfo().name || "loose"}:${integer(id)}`; }
    function draftPayload() {
        if (!mapBase || !mapDraft || !mapId) return null;
        const delta = services.mapDelta(mapBase, mapDraft);
        return {
            id: `map-${mapId}-working-draft`, format: "HybridVisualMapDraft", version: 3, studioVersion: VERSION,
            mapId, name: `Recoverable Map ${mapId} experiment`, savedAt: new Date().toISOString(),
            width: mapDraft.width, height: mapDraft.height, tilesetId: mapDraft.tilesetId,
            baseHash: mapBaseChecksum || hash(mapBase), draftHash: hash(mapDraft),
            layers: [0,1,2,3,4,5], lockedCells: [],
            changes: { count: delta.tiles.length, tiles: delta.tiles },
            history: mapHistory.slice(-20).map(item => ({ label: item.label, changes: item.changes.length }))
        };
    }
    async function saveDraftRecoveryNow() {
        clearTimeout(draftPersistTimer);
        const payload = draftPayload();
        if (!payload || !mapDirty) return false;
        await assertSchema(payload, "HybridVisualMapDraft");
        const projectOpen = api.projectInfo().open;
        let projectSaved = false, browserSaved = false, projectError = null;
        if (projectOpen) {
            try { await api.writeProjectJson(draftPath(mapId), payload, true); projectSaved = true; }
            catch (error) { projectError = error; }
        }
        if (storageService) {
            try { await storageService.put(draftStorageKey(mapId), payload, { kind: "map-draft", project: api.projectInfo().name || "loose", mapId }); browserSaved = true; }
            catch (_) { browserSaved = false; }
        }
        if (!projectSaved && !browserSaved) {
            setRecoveryStatus("failed", "none", projectError?.message || "Recovery storage is unavailable.");
            throw projectError || new Error("Draft recovery could not be saved.");
        }
        state.draftManifest[String(mapId)] = { baseHash: payload.baseHash, draftHash: payload.draftHash, savedAt: payload.savedAt, changes: payload.changes.count, backend: projectSaved ? "project" : "browser" };
        setRecoveryStatus(projectSaved || !projectOpen ? "saved" : "fallback", projectSaved ? "project" : "browser", projectError?.message || "");
        persist();
        await storageService?.prune?.(`htg-v18-draft:${api.projectInfo().name || "loose"}:`, { maxEntries: 24, maxAgeMs: state.recoveryRetentionDays * 86400000 }).catch(() => []);
        return true;
    }
    function scheduleDraftRecovery() {
        if (!mapDirty) return;
        clearTimeout(draftPersistTimer);
        recoveryStatus = { state: "pending", backend: "none", at: Date.now(), message: "Draft save pending…" };
        updateMapActions();
        draftPersistTimer = setTimeout(() => saveDraftRecoveryNow().catch(error => { setRecoveryStatus("failed", "none", error.message); notify(`Draft recovery failed: ${error.message}`, "error"); }), 280);
    }
    async function readDraftRecovery(id) {
        let payload = null, backend = "none";
        if (api.projectInfo().open) try { payload = await api.readProjectJson(draftPath(id)); backend = "project"; } catch (_) { /* browser recovery is the fallback */ }
        if (!payload && storageService) try { payload = await storageService.get(draftStorageKey(id), null); backend = payload ? "browser" : "none"; } catch (_) { /* no recovery */ }
        if (!payload) {
            try {
                const legacy = JSON.parse(localStorage.getItem(`htg-v18-draft:${api.projectInfo().name || "loose"}:${integer(id)}`));
                if (legacy) { payload = legacy; backend = "browser"; await storageService?.put?.(draftStorageKey(id), legacy); }
                localStorage.removeItem(`htg-v18-draft:${api.projectInfo().name || "loose"}:${integer(id)}`);
            } catch (_) { /* optional one-way migration */ }
        }
        if (payload?.format !== "HybridVisualMapDraft" || integer(payload.mapId) !== integer(id)) return null;
        payload._recoveryBackend = backend;
        return payload;
    }
    async function clearDraftRecovery(id = mapId) {
        clearTimeout(draftPersistTimer);
        await storageService?.remove?.(draftStorageKey(id)).catch(() => false);
        try { localStorage.removeItem(`htg-v18-draft:${api.projectInfo().name || "loose"}:${integer(id)}`); } catch (_) { /* legacy cleanup */ }
        delete state.draftManifest[String(id)];
        if (api.projectInfo().open) try { await api.removeProjectEntry(draftPath(id)); } catch (_) { /* an absent recovery file is already clear */ }
        persist();
    }
    async function restoreDraftRecovery(current, stored) {
        if (!stored) return { base: current, draft: clone(current), dirty: false, conflicts: null, backend: "none" };
        if (stored.draftHash === hash(current)) { await clearDraftRecovery(stored.mapId); return { base: current, draft: clone(current), dirty: false, conflicts: null, backend: "none" }; }
        if (integer(stored.version) >= 3 && Array.isArray(stored.changes?.tiles)) {
            const delta = { width: stored.width, height: stored.height, tilesetId: stored.tilesetId, tiles: stored.changes.tiles };
            if (stored.baseHash === hash(current)) {
                const applied = services.applyMapDelta(current, delta);
                return { base: clone(current), draft: applied.merged, dirty: applied.applied > 0, conflicts: null, backend: stored._recoveryBackend || "browser" };
            }
            const merge = services.mergeMapDelta(delta, current);
            if (merge.reason === "dimensions-changed") {
                state.notices.unshift({ id: uid("notice"), at: Date.now(), type: "stale", message: `Map ${stored.mapId} recovery was kept, but dimensions changed and require manual review.` });
                return { base: current, draft: clone(current), dirty: true, conflicts: merge.conflicts, backend: stored._recoveryBackend || "browser" };
            }
            return { base: current, draft: merge.merged, dirty: merge.applied > 0 || merge.conflicts.length > 0, conflicts: merge.conflicts.length ? merge.conflicts : null, backend: stored._recoveryBackend || "browser" };
        }
        if (!stored.map || !stored.baseMap) return { base: current, draft: clone(current), dirty: false, conflicts: null, backend: "none" };
        if (stored.baseHash === hash(current)) return { base: clone(stored.baseMap), draft: clone(stored.map), dirty: true, conflicts: null, backend: stored._recoveryBackend || "browser" };
        const merge = services.mergeMapDraft(stored.baseMap, stored.map, current);
        if (merge.reason === "dimensions-changed") return { base: current, draft: clone(current), dirty: true, conflicts: merge.conflicts, backend: stored._recoveryBackend || "browser" };
        return { base: current, draft: merge.merged, dirty: merge.applied > 0 || merge.conflicts.length > 0, conflicts: merge.conflicts.length ? merge.conflicts : null, backend: stored._recoveryBackend || "browser" };
    }

    async function pruneDraftRecoveries() {
        if (!api.projectInfo().open) return [];
        let entries;
        try { entries = await api.listProjectDirectory(".hybrid/worldsmith/drafts"); } catch (_) { return []; }
        const records = [];
        for (const entry of entries.filter(item => item.kind === "file" && /\.htgmapdraft$/i.test(item.name))) {
            try { const value = await api.readProjectJson(entry.path); records.push({ entry, at: Date.parse(value.savedAt || 0) || 0, mapId: integer(value.mapId) }); }
            catch (_) { records.push({ entry, at: 0, mapId: 0 }); }
        }
        records.sort((a,b)=>b.at-a.at);
        const cutoff = Date.now() - state.recoveryRetentionDays * 86400000;
        const removable = records.filter((record,index) => record.mapId !== mapId && (index >= 24 || (record.at && record.at < cutoff)));
        for (const record of removable) await api.removeProjectEntry(record.entry.path).catch(() => false);
        return removable.map(item => item.entry.path);
    }
    async function ensureMapDraft(force = false) {
        const requested = integer(state.map.selectedId || api.state().activeMapId);
        if (!requested) throw new Error("Choose a map first.");
        if (!force && mapDraft && mapId === requested) return mapDraft;
        if (mapDirty && mapId && mapId !== requested) {
            const proceed = await confirmChange("Keep this draft and change maps?", "Your experiment will remain in recovery so you can continue it when you return.", "Keep draft and change");
            if (!proceed) { state.map.selectedId = mapId; return mapDraft; }
            await saveDraftRecoveryNow();
        }
        api.activateMap(requested);
        const current = await api.mapSnapshot(requested);
        const recovered = await restoreDraftRecovery(current, await readDraftRecovery(requested));
        mapBase = recovered.base;
        mapDraft = recovered.draft;
        mapBaseChecksum = hash(mapBase);
        mapId = requested;
        mapConflicts = recovered.conflicts;
        mapSelection = null;
        mapHistory = [];
        mapRedo = [];
        activeMapTransaction = null;
        rebuildDirtyIndices();
        if (mapDirty) {
            setRecoveryStatus("recovered", recovered.backend || "browser", "");
            notify(`Recovered the Map ${mapId} experiment.`, "success");
        } else setRecoveryStatus("idle", "none", "No draft changes yet.");
        if (mapConflicts) notify(`Map ${mapId} changed outside this draft. Conflicting cells are preserved for review.`, "warning");
        pruneDraftRecoveries().catch(() => []);
        updateMapActions();
        return mapDraft;
    }

    async function resetMapDraft() {
        mapBase = null;
        mapDraft = null;
        mapBaseChecksum = "";
        mapId = 0;
        mapDirty = false;
        mapDirtyIndices = new Set();
        activeMapTransaction = null;
        mapConflicts = null;
        mapSelection = null;
        mapHistory = [];
        mapRedo = [];
        recoveryStatus = { state: "idle", backend: "none", at: 0, message: "No draft changes yet." };
        updateMapActions();
    }

    function tileIndex(map, x, y, z = state.map.layer) { return (z * map.height + y) * map.width + x; }
    function inMap(map, x, y) { return x >= 0 && y >= 0 && x < map.width && y < map.height; }
    function rebuildDirtyIndices() {
        mapDirtyIndices = new Set();
        if (mapBase && mapDraft) {
            const length = Math.max(mapBase.data?.length || 0, mapDraft.data?.length || 0);
            for (let index = 0; index < length; index++) if (mapBase.data[index] !== mapDraft.data[index]) mapDirtyIndices.add(index);
        }
        mapDirty = mapDirtyIndices.size > 0 || !!mapConflicts?.length;
        return mapDirtyIndices;
    }
    function refreshDirtyIndex(index) {
        if (!mapBase || !mapDraft) return;
        if (mapBase.data[index] === mapDraft.data[index]) mapDirtyIndices.delete(index); else mapDirtyIndices.add(index);
        mapDirty = mapDirtyIndices.size > 0 || !!mapConflicts?.length;
    }
    function beginMapTransaction(label = "Map edit") {
        if (!activeMapTransaction) activeMapTransaction = { label, changes: new Map(), startedAt: performance.now?.() || Date.now() };
        return activeMapTransaction;
    }
    function recordMapChange(index, before, after) {
        const transaction = activeMapTransaction || beginMapTransaction("Map edit");
        const existing = transaction.changes.get(index);
        const initial = existing ? existing.before : before;
        if (initial === after) transaction.changes.delete(index); else transaction.changes.set(index, { index, before: initial, after });
    }
    function writeDraftIndex(index, value) {
        if (!mapDraft || index < 0 || index >= mapDraft.data.length) return false;
        const before = integer(mapDraft.data[index]);
        const after = integer(value);
        if (before === after) return false;
        recordMapChange(index, before, after);
        mapDraft.data[index] = after;
        refreshDirtyIndex(index);
        return true;
    }
    function commitMapTransaction() {
        const transaction = activeMapTransaction;
        activeMapTransaction = null;
        if (!transaction?.changes.size) { updateMapActions(); return false; }
        const entry = { label: transaction.label, changes: [...transaction.changes.values()], at: Date.now() };
        mapHistory.push(entry);
        if (mapHistory.length > 100) mapHistory.shift();
        mapRedo = [];
        state.map.cursorX = clamp(state.map.cursorX, 0, Math.max(0, mapDraft.width - 1));
        state.map.cursorY = clamp(state.map.cursorY, 0, Math.max(0, mapDraft.height - 1));
        persist();
        scheduleDraftRecovery();
        updateMapActions();
        return true;
    }
    function cancelMapTransaction() { activeMapTransaction = null; }
    function performOneShotMapTool(point) {
        const result = performMapTool(point, true);
        if (result?.then) return result.then(() => { if (activeMapTransaction) commitMapTransaction(); });
        if (activeMapTransaction) commitMapTransaction();
        return result;
    }
    function mapChanges() { return mapDirtyIndices.size; }
    function rememberMap(label) { return beginMapTransaction(label); }
    function setDraftTile(x, y, tileId = state.map.tileId, remember = false) {
        if (!mapDraft || !inMap(mapDraft, x, y)) return false;
        if (remember) beginMapTransaction("Paint tiles");
        const size = clamp(integer(state.map.brushSize, 1), 1, 8);
        let changed = false;
        for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
            const px = x + dx, py = y + dy;
            if (!inMap(mapDraft, px, py)) continue;
            changed = writeDraftIndex(tileIndex(mapDraft, px, py), tileId) || changed;
        }
        if (changed) { state.map.cursorX = x; state.map.cursorY = y; updateMapActions(); }
        return changed;
    }
    async function floodDraft(x, y) {
        if (!inMap(mapDraft, x, y)) return;
        const target = integer(mapDraft.data[tileIndex(mapDraft, x, y)]);
        const replacement = integer(state.map.tileId);
        if (target === replacement) return;
        const started = performance.now?.() || Date.now();
        const fallback = () => {
            const queue = [[x, y]], seen = new Uint8Array(mapDraft.width * mapDraft.height), indices = []; let head = 0;
            while (head < queue.length) {
                const [px, py] = queue[head++];
                if (!inMap(mapDraft, px, py)) continue;
                const cell = py * mapDraft.width + px;
                if (seen[cell]) continue;
                seen[cell] = 1;
                const index = tileIndex(mapDraft, px, py);
                if (integer(mapDraft.data[index]) !== target) continue;
                indices.push(index);
                queue.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
            }
            return { indices, target, replacement, stats: { cells: indices.length, complete: true } };
        };
        const result = await api.runWorker("flood-fill", { width: mapDraft.width, height: mapDraft.height, layer: state.map.layer, data: mapDraft.data, x, y, target, replacement, maxCells: mapDraft.width * mapDraft.height, requireComplete: true }, fallback);
        beginMapTransaction("Fill area");
        for (const index of result?.indices || []) writeDraftIndex(integer(index), replacement);
        commitMapTransaction();
        mapPerformance.lastFillMs = (performance.now?.() || Date.now()) - started;
        mapPerformance.lastFillCells = result?.indices?.length || 0;
        scheduleMapDraw({ minimap: true });
    }
    function canvasPoint(event) {
        const canvas = $("v18MapCanvas"), rect = canvas.getBoundingClientRect();
        return { x: clamp(Math.floor((event.clientX - rect.left) * canvas.width / rect.width / canvas._tileSize), 0, mapDraft.width - 1), y: clamp(Math.floor((event.clientY - rect.top) * canvas.height / rect.height / canvas._tileSize), 0, mapDraft.height - 1) };
    }
    function performMapTool(point, begin = false) {
        if (!mapDraft) return;
        const tool = state.map.tool;
        if (tool === "fill") { if (begin) return floodDraft(point.x, point.y); return; }
        if (tool === "select") { if (begin) selectionStart = point; state.map.cursorX = point.x; state.map.cursorY = point.y; scheduleMapDraw(); return; }
        if (tool === "pick") {
            if (begin) { state.map.tileId = integer(mapDraft.data[tileIndex(mapDraft, point.x, point.y)]); state.map.tool = "paint"; rememberRecentTile(state.map.tileId); persist(); renderCreate(); }
            return;
        }
        if (tool === "pan") return;
        if (tool === "rectangle") { if (begin) rectangleStart = point; return; }
        const value = tool === "erase" ? 0 : integer(state.map.tileId);
        if (begin) beginMapTransaction(tool === "erase" ? "Erase tiles" : "Paint tiles");
        if (setDraftTile(point.x, point.y, value)) scheduleMapDraw({ minimap: true });
    }
    function finishRectangle(point) {
        if (!rectangleStart || !mapDraft) return;
        beginMapTransaction("Draw rectangle");
        const x1 = Math.min(rectangleStart.x, point.x), x2 = Math.max(rectangleStart.x, point.x);
        const y1 = Math.min(rectangleStart.y, point.y), y2 = Math.max(rectangleStart.y, point.y);
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setDraftTile(x, y, state.map.tileId);
        rectangleStart = null;
        commitMapTransaction();
        scheduleMapDraw({ minimap: true });
    }

    function finishSelection(point) {
        if (!selectionStart) return;
        mapSelection = { x1: Math.min(selectionStart.x, point.x), y1: Math.min(selectionStart.y, point.y), x2: Math.max(selectionStart.x, point.x), y2: Math.max(selectionStart.y, point.y) };
        selectionStart = null; scheduleMapDraw();
    }
    function rememberRecentTile(tileId) { state.map.recent = [integer(tileId), ...state.map.recent.filter(value => value !== integer(tileId))].slice(0, 16); }
    function copyMapSelection() {
        if (!mapSelection || !mapDraft) throw new Error("Drag a selection on the map first.");
        const width = mapSelection.x2 - mapSelection.x1 + 1, height = mapSelection.y2 - mapSelection.y1 + 1, values = [];
        for (let y = mapSelection.y1; y <= mapSelection.y2; y++) for (let x = mapSelection.x1; x <= mapSelection.x2; x++) values.push(mapDraft.data[tileIndex(mapDraft, x, y)]);
        mapClipboard = { width, height, layer: state.map.layer, values }; notify(`${width} × ${height} selection copied.`, "success");
    }
    function pasteMapSelection() {
        if (!mapClipboard || !mapDraft) throw new Error("Copy a map selection first.");
        beginMapTransaction("Paste selection");
        let offset = 0;
        for (let y = 0; y < mapClipboard.height; y++) for (let x = 0; x < mapClipboard.width; x++, offset++) {
            const px = state.map.cursorX + x, py = state.map.cursorY + y;
            if (inMap(mapDraft, px, py)) writeDraftIndex(tileIndex(mapDraft, px, py), mapClipboard.values[offset]);
        }
        commitMapTransaction(); scheduleMapDraw({ minimap: true });
    }
    const PALETTE_RANGES = Object.freeze({
        B: [0, 255], C: [256, 511], D: [512, 767], E: [768, 1023], A5: [1536, 1663],
        A1: [2048, 2815], A2: [2816, 4351], A3: [4352, 5887], A4: [5888, 8191]
    });
    function tileDescriptor(tileId) {
        const id = clamp(integer(tileId), 0, 8191);
        let sheet = "Unknown", kind = "tile", source = api.tileSource(id);
        if (id === 0) { sheet = "Empty"; kind = "transparent empty tile"; }
        else if (id < 1024) { sheet = ["B","C","D","E"][Math.floor(id / 256)] || "B"; kind = "object decoration character prop"; }
        else if (id >= 1536 && id < 1664) { sheet = "A5"; kind = "ground floor static terrain"; }
        else if (id >= 2048 && id < 2816) { sheet = "A1"; kind = "water waterfall animated terrain coast"; }
        else if (id >= 2816 && id < 4352) { sheet = "A2"; kind = "ground floor grass dirt terrain"; }
        else if (id >= 4352 && id < 5888) { sheet = "A3"; kind = "building wall roof exterior"; }
        else if (id >= 5888 && id < 8192) { sheet = "A4"; kind = "wall roof interior dungeon"; }
        const auto = api.autotileLayout?.(id);
        if (!source && auto) source = { sheet: auto.sheet, sx: auto.bx * 48, sy: auto.by * 48, sw: 48, sh: 48 };
        const position = source ? `${Math.round(source.sx / 48)}, ${Math.round(source.sy / 48)}` : "autotile shape";
        return { id, sheet, kind, position, search: `${id} ${sheet} ${kind} ${position}`.toLowerCase(), label: `${sheet} · ${kind.split(" ").slice(0,3).join(" ")} · source ${position}` };
    }
    function paletteIds() {
        const [first, last] = PALETTE_RANGES[state.map.palette] || PALETTE_RANGES.A1;
        const query = String(state.map.paletteQuery || "").trim().toLowerCase();
        let ids = Array.from({ length: last - first + 1 }, (_, index) => first + index);
        if (/^\d+$/.test(query)) ids = ids.filter(id => id === integer(query));
        else if (/^\d+\s*-\s*\d+$/.test(query)) { const [a, b] = query.split("-").map(integer); ids = ids.filter(id => id >= Math.min(a, b) && id <= Math.max(a, b)); }
        else if (query) ids = ids.filter(id => tileDescriptor(id).search.includes(query));
        return ids;
    }
    async function renderCreate() {
        await ensureMapDraft();
        const info = api.projectInfo();
        const maps = info.maps.map(item => `<option value="${item.id}" ${item.id === mapId ? "selected" : ""}>${escapeHtml(item.name)} · ${item.id}</option>`).join("");
        const tools = [["paint", "✎", "Paint"], ["erase", "⌫", "Erase"], ["pick", "⌾", "Pick"], ["fill", "▧", "Fill"], ["rectangle", "□", "Rectangle"], ["select", "⌖", "Select"], ["pan", "✥", "Pan"]];
        const layers = state.map.layerVisibility;
        const descriptor = tileDescriptor(state.map.tileId);
        const conflictPanel = mapConflicts?.length ? `<section class="v18-conflict-panel" role="alert"><strong>${mapConflicts.length} overlapping tile edit${mapConflicts.length === 1 ? "" : "s"}</strong><p>The project changed outside this experiment. Choose which value wins for the overlaps; unrelated edits are already preserved.</p><button data-v18-action="resolve-conflicts-current">Keep project values</button><button data-v18-action="resolve-conflicts-draft" class="v18-button v18-primary">Keep experiment values</button></section>` : "";
        $("v18Main").innerHTML = `${pageHead("CREATE · MAP STUDIO", "Make a visible improvement", "Paint directly with project tiles. Draft saved, applied to project, and release verified are separate states.", `<button data-v18-action="toggle-tools" class="v18-pane-toggle">Tools</button><select id="v18MapSelect" aria-label="Active map">${maps}</select><button data-v18-action="toggle-inspector" class="v18-pane-toggle">Inspector</button><button data-v18-action="discard-map">Discard</button><button id="v18ApplyMap" data-v18-action="apply-map" class="v18-button v18-primary">Apply 0 changes</button>`)}
          <section id="v18CreateWorkspace" class="v18-create">
            <aside class="v18-tools"><button data-v18-action="close-panes" class="v18-drawer-close" aria-label="Close tools">×</button><small class="v18-section-label">TOOLS</small><div class="v18-tool-grid">${tools.map(([id, icon, name]) => `<button data-v18-tool="${id}" class="${state.map.tool === id ? "active" : ""}" aria-pressed="${state.map.tool === id}" title="${name}"><i>${icon}</i><span>${name}</span></button>`).join("")}</div><small class="v18-section-label">QUICK TILES</small><div class="v18-tile-shortcuts">${state.map.favorites.slice(0,8).map(id=>`<button data-v18-tile-shortcut="${id}" title="Favorite ${escapeHtml(tileDescriptor(id).label)}">★ ${id}</button>`).join("")}${state.map.recent.slice(0,8).filter(id=>!state.map.favorites.includes(id)).map(id=>`<button data-v18-tile-shortcut="${id}" title="Recent ${escapeHtml(tileDescriptor(id).label)}">${id}</button>`).join("")||"<small>Pick or paint a tile to build recents.</small>"}</div><small class="v18-section-label">TILE SHEETS</small><div class="v18-tabs v18-palette-tabs">${Object.keys(PALETTE_RANGES).map(name => `<button data-v18-palette="${name}" class="${state.map.palette === name ? "active" : ""}" aria-pressed="${state.map.palette === name}">${name}</button>`).join("")}</div><input id="v18PaletteQuery" type="search" placeholder="ID, range, water, wall…" aria-label="Filter tiles by ID or semantic label" value="${escapeHtml(state.map.paletteQuery)}"><div id="v18Palette" class="v18-tile-palette" role="grid" aria-label="Tile palette"></div><footer class="v18-palette-pages"><button data-v18-action="palette-prev">‹ Prev</button><span id="v18PalettePage"></span><button data-v18-action="palette-next">Next ›</button></footer></aside>
            <article class="v18-canvas-panel">${conflictPanel}<header><strong>${escapeHtml(info.maps.find(item => item.id === mapId)?.name || `Map ${mapId}`)}</strong><span>${mapDraft.width} × ${mapDraft.height} · layer ${state.map.layer + 1}</span></header><div class="v18-canvas-scroll"><canvas id="v18MapCanvas" aria-label="Editable tile map. Arrow keys move the cursor; Space uses the current tool." tabindex="0"></canvas></div><footer><span>Draft changes: <b id="v18ChangeCount">0</b></span><span>Cursor: <b id="v18Cursor">${state.map.cursorX}, ${state.map.cursorY}</b></span><button data-v18-action="copy-selection" ${mapSelection ? "" : "disabled"}>Copy</button><button data-v18-action="paste-selection" ${mapClipboard ? "" : "disabled"}>Paste</button><span>Zoom <input id="v18Zoom" aria-label="Map zoom" type="range" min="0.5" max="2" step="0.1" value="${state.map.zoom}"></span></footer></article>
            <aside class="v18-inspector"><button data-v18-action="close-panes" class="v18-drawer-close" aria-label="Close inspector">×</button><small class="v18-section-label">BRUSH</small><label class="v18-field"><span>Tile ID</span><input id="v18TileId" type="number" min="0" max="8191" value="${state.map.tileId}"></label><p id="v18TileDescriptor" class="v18-tile-descriptor">${escapeHtml(descriptor.label)}</p><button data-v18-action="favorite-tile">${state.map.favorites.includes(state.map.tileId) ? "★ Favorited" : "☆ Favorite tile"}</button><label class="v18-field"><span>Layer</span><select id="v18Layer">${[0,1,2,3,4,5].map(value => `<option value="${value}" ${value === state.map.layer ? "selected" : ""}>${value + 1}${value === 4 ? " · shadow" : value === 5 ? " · region" : ""}</option>`).join("")}</select></label><label class="v18-field"><span>Brush size</span><input id="v18Brush" type="range" min="1" max="8" value="${state.map.brushSize}"><b id="v18BrushValue">${state.map.brushSize} × ${state.map.brushSize}</b></label><small class="v18-section-label">VISIBILITY</small>${["Ground","Upper 1","Upper 2","Upper 3","Shadow","Region"].map((name, index) => `<label class="v18-check-row"><span>${name}</span><input type="checkbox" data-v18-layer-visible="${index}" ${layers[index] ? "checked" : ""}></label>`).join("")}<label class="v18-field"><span>Overlay</span><select id="v18Overlay">${["none","events","regions","shadows","collision","changes"].map(value => `<option value="${value}" ${state.map.overlay === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><canvas id="v18Minimap" class="v18-minimap" aria-label="Map overview"></canvas><div class="v18-card v18-recovery-card"><strong>Recovery health</strong><p id="v18RecoveryStatus">${escapeHtml(recoveryStatusText())}</p><small>Draft recovery is separate from applying to the project.</small></div><div class="v18-card"><strong>Renderer</strong><p id="v18MapPerformance">${mapPerformance.lastTilesDrawn} visible tile draws · ${mapPerformance.lastDrawMs.toFixed(1)} ms</p></div><button data-v18-action="capture-content" class="v18-button v18-guided">Capture in library</button></aside>
          </section>`;
        wireCreate(); drawPalette(); scheduleMapDraw({ minimap: true }); updateMapActions();
    }
    function wireCreate() {
        $("v18MapSelect").onchange = safe(async event => { state.map.selectedId = integer(event.target.value); await ensureMapDraft(false); await renderCreate(); });
        $("v18Main").querySelectorAll("[data-v18-tool]").forEach(button => button.onclick = () => { state.map.tool = button.dataset.v18Tool; persist(); $("v18Main").querySelectorAll("[data-v18-tool]").forEach(item => { const active=item===button; item.classList.toggle("active",active); item.setAttribute("aria-pressed",String(active)); }); });
        $("v18Main").querySelectorAll("[data-v18-palette]").forEach(button => button.onclick = () => { state.map.palette = button.dataset.v18Palette; state.map.palettePage = 0; persist(); renderCreate(); });
        $("v18Main").querySelectorAll("[data-v18-tile-shortcut]").forEach(button=>button.onclick=()=>{state.map.tileId=integer(button.dataset.v18TileShortcut);rememberRecentTile(state.map.tileId);persist();if($("v18TileId"))$("v18TileId").value=state.map.tileId;if($("v18TileDescriptor"))$("v18TileDescriptor").textContent=tileDescriptor(state.map.tileId).label;drawPalette();});
        $("v18PaletteQuery").oninput = event => { state.map.paletteQuery = event.target.value; state.map.palettePage = 0; persist(); drawPalette(); };
        $("v18TileId").onchange = event => { state.map.tileId = clamp(integer(event.target.value), 0, 8191); rememberRecentTile(state.map.tileId); persist(); if($("v18TileDescriptor"))$("v18TileDescriptor").textContent=tileDescriptor(state.map.tileId).label; drawPalette(); };
        $("v18Layer").onchange = event => { state.map.layer = clamp(integer(event.target.value), 0, 5); persist(); scheduleMapDraw(); };
        $("v18Brush").oninput = event => { state.map.brushSize = integer(event.target.value); $("v18BrushValue").textContent = `${state.map.brushSize} × ${state.map.brushSize}`; persist(); };
        $("v18Zoom").oninput = event => { state.map.zoom = Number(event.target.value); persist(); scheduleMapDraw({ minimap: true }); };
        $("v18Overlay").onchange = event => { state.map.overlay = event.target.value; persist(); scheduleMapDraw(); };
        $("v18Main").querySelectorAll("[data-v18-layer-visible]").forEach(input => input.onchange = () => { state.map.layerVisibility[integer(input.dataset.v18LayerVisible)] = input.checked; persist(); scheduleMapDraw({ minimap: true }); });
        const canvas = $("v18MapCanvas"), scroll = canvas.parentElement;
        canvas.onpointerdown = event => {
            pointerPainting = true; canvas.setPointerCapture?.(event.pointerId);
            if (state.map.tool === "pan") panStart = { x:event.clientX, y:event.clientY, left:scroll.scrollLeft, top:scroll.scrollTop };
            else { const result=performMapTool(canvasPoint(event), true); result?.catch?.(error=>notify(error.message,"error")); }
        };
        canvas.onpointermove = event => {
            const point = canvasPoint(event); state.map.cursorX = point.x; state.map.cursorY = point.y;
            if ($("v18Cursor")) $("v18Cursor").textContent = `${point.x}, ${point.y}`;
            if (pointerPainting && state.map.tool === "pan" && panStart) { scroll.scrollLeft = panStart.left - (event.clientX - panStart.x); scroll.scrollTop = panStart.top - (event.clientY - panStart.y); scheduleMapDraw(); }
            else if (pointerPainting && !["fill", "select", "rectangle", "pick"].includes(state.map.tool)) performMapTool(point);
            else scheduleMapDraw();
        };
        canvas.onpointerup = event => {
            const point = canvasPoint(event);
            if (state.map.tool === "rectangle") finishRectangle(point);
            else if (state.map.tool === "select") finishSelection(point);
            else if (["paint","erase"].includes(state.map.tool)) commitMapTransaction();
            pointerPainting = false; panStart = null; scheduleMapDraw({ minimap: true });
        };
        canvas.onpointercancel = () => { if(activeMapTransaction)commitMapTransaction(); pointerPainting = false; rectangleStart = null; selectionStart = null; panStart = null; };
        scroll.addEventListener("scroll", () => scheduleMapDraw(), { passive: true });
        if (typeof ResizeObserver === "function") { const observer = new ResizeObserver(() => scheduleMapDraw()); observer.observe(scroll); }
    }
    function drawPalette() {
        const host = $("v18Palette"); if (!host) return;
        host.innerHTML = "";
        const ids = paletteIds(), pages = Math.max(1, Math.ceil(ids.length / 64)); state.map.palettePage = clamp(integer(state.map.palettePage), 0, pages - 1);
        const visible = ids.slice(state.map.palettePage * 64, state.map.palettePage * 64 + 64);
        for (const tileId of visible) {
            const descriptor = tileDescriptor(tileId);
            const button = document.createElement("button"); button.type = "button"; button.title = `Tile ${tileId} · ${descriptor.label}`; button.setAttribute("role", "gridcell"); button.setAttribute("aria-label", `Tile ${tileId}, ${descriptor.label}`); button.setAttribute("aria-selected", String(tileId === state.map.tileId)); button.className = tileId === state.map.tileId ? "selected" : "";
            const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32; button.append(canvas); api.drawTile(canvas.getContext("2d"), tileId, 0, 0, 32);
            const label=document.createElement("small");label.textContent=`${descriptor.sheet} ${tileId}`;button.append(label);
            button.onclick = () => { state.map.tileId = tileId; rememberRecentTile(tileId); if ($("v18TileId")) $("v18TileId").value = tileId; if($("v18TileDescriptor"))$("v18TileDescriptor").textContent=descriptor.label; persist(); drawPalette(); };
            host.append(button);
        }
        if ($("v18PalettePage")) $("v18PalettePage").textContent = `${state.map.palettePage + 1} / ${pages} · ${ids.length} tiles`;
    }
    function drawMap(canvas, map, options = {}) {
        if (!canvas || !map) return { tiles: 0, durationMs: 0 };
        const started = performance.now?.() || Date.now();
        const maxWidth = options.maxWidth || 900, maxHeight = options.maxHeight || 620;
        const base = Math.max(options.minTile || 4, Math.min(32, Math.floor(Math.min(maxWidth / map.width, maxHeight / map.height))));
        const tileSize = Math.max(1, Math.round(base * (options.zoom || 1)));
        const targetWidth = map.width * tileSize, targetHeight = map.height * tileSize;
        if (canvas.width !== targetWidth) canvas.width = targetWidth;
        if (canvas.height !== targetHeight) canvas.height = targetHeight;
        canvas._tileSize = tileSize;
        const context = canvas.getContext("2d");
        const scroll = options.editor ? canvas.parentElement : null;
        const viewportWidth = scroll?.clientWidth || targetWidth, viewportHeight = scroll?.clientHeight || targetHeight;
        const startX = options.editor ? clamp(Math.floor((scroll.scrollLeft || 0) / tileSize) - 1, 0, map.width - 1) : 0;
        const startY = options.editor ? clamp(Math.floor((scroll.scrollTop || 0) / tileSize) - 1, 0, map.height - 1) : 0;
        const endX = options.editor ? clamp(Math.ceil(((scroll.scrollLeft || 0) + viewportWidth) / tileSize) + 1, 1, map.width) : map.width;
        const endY = options.editor ? clamp(Math.ceil(((scroll.scrollTop || 0) + viewportHeight) / tileSize) + 1, 1, map.height) : map.height;
        const clearX=startX*tileSize,clearY=startY*tileSize,clearW=(endX-startX)*tileSize,clearH=(endY-startY)*tileSize;
        context.clearRect(clearX, clearY, clearW, clearH); context.fillStyle = "#171a28"; context.fillRect(clearX, clearY, clearW, clearH);
        const visibility = options.visibility || [true,true,true,true,true,true]; let tiles = 0;
        for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) for (let z = 0; z < 4; z++) {
            if (!visibility[z]) continue;
            const tileId = integer(map.data[tileIndex(map, x, y, z)]); if (tileId) { api.drawTile(context, tileId, x * tileSize, y * tileSize, tileSize); tiles++; }
        }
        const overlay = options.overlay || "none";
        if (overlay === "regions" && visibility[5]) for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) { const id = integer(map.data[tileIndex(map,x,y,5)]); if (id) { context.fillStyle = `hsla(${id * 47 % 360},80%,55%,.38)`; context.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); if (tileSize >= 18) { context.fillStyle="#fff"; context.font=`bold ${Math.max(9,tileSize*.4)}px sans-serif`; context.fillText(id,x*tileSize+2,y*tileSize+tileSize-3); } } }
        if (overlay === "shadows" && visibility[4]) for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) { const bits = integer(map.data[tileIndex(map,x,y,4)]); context.fillStyle="rgba(0,0,0,.42)"; for (let bit=0;bit<4;bit++) if (bits & (1<<bit)) context.fillRect(x*tileSize+(bit%2)*tileSize/2,y*tileSize+Math.floor(bit/2)*tileSize/2,tileSize/2,tileSize/2); }
        if (overlay === "events") for (const event of list(map.events).filter(Boolean)) { if(event.x<startX||event.x>=endX||event.y<startY||event.y>=endY)continue; context.fillStyle="#ff5f8f"; context.strokeStyle="#fff"; context.lineWidth=1; context.beginPath(); context.arc((event.x+.5)*tileSize,(event.y+.5)*tileSize,Math.max(3,tileSize*.28),0,Math.PI*2); context.fill(); context.stroke(); if (tileSize>=16) { context.fillStyle="#fff"; context.font=`bold ${Math.max(8,tileSize*.35)}px sans-serif`; context.fillText(event.id,event.x*tileSize+2,(event.y+1)*tileSize-2); } }
        if (overlay === "changes" && mapBase) for (const index of mapDirtyIndices) { const cell=index%(map.width*map.height), x=cell%map.width, y=Math.floor(cell/map.width); if(x<startX||x>=endX||y<startY||y>=endY)continue; context.fillStyle="rgba(255,215,90,.32)"; context.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); }
        if (overlay === "collision") { const tileset = api.projectInfo().tilesets.find(item => item?.id === map.tilesetId) || api.projectInfo().tilesets[map.tilesetId-1]; const flags=list(tileset?.flags); for(let y=startY;y<endY;y++) for(let x=startX;x<endX;x++){ let blocked=false; for(let z=3;z>=0;z--){ const id=integer(map.data[tileIndex(map,x,y,z)]); if(id && (integer(flags[id]) & 0x0f)){blocked=true;break;} } if(blocked){context.fillStyle="rgba(255,65,90,.28)";context.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);context.strokeStyle="rgba(255,120,135,.8)";context.beginPath();context.moveTo(x*tileSize,y*tileSize);context.lineTo((x+1)*tileSize,(y+1)*tileSize);context.stroke();} } }
        if (tileSize >= 12 && options.grid !== false) { context.strokeStyle = "rgba(255,255,255,.10)"; context.lineWidth = 1; context.beginPath(); for (let x = startX; x <= endX; x++) { context.moveTo(x * tileSize + .5, startY*tileSize); context.lineTo(x * tileSize + .5, endY*tileSize); } for (let y = startY; y <= endY; y++) { context.moveTo(startX*tileSize, y * tileSize + .5); context.lineTo(endX*tileSize, y * tileSize + .5); } context.stroke(); }
        if (options.cursor) { context.strokeStyle = "#ffd75a"; context.lineWidth = 2; context.strokeRect(options.cursor.x * tileSize + 1, options.cursor.y * tileSize + 1, tileSize - 2, tileSize - 2); }
        if (mapSelection) { context.strokeStyle="#6df7ce"; context.lineWidth=2; context.strokeRect(mapSelection.x1*tileSize+1,mapSelection.y1*tileSize+1,(mapSelection.x2-mapSelection.x1+1)*tileSize-2,(mapSelection.y2-mapSelection.y1+1)*tileSize-2); }
        if (mapConflicts?.length) for (const conflict of mapConflicts.filter(item => item.type === "tile")) { const cell=conflict.index%(map.width*map.height), x=cell%map.width, y=Math.floor(cell/map.width); if(x<startX||x>=endX||y<startY||y>=endY)continue; context.strokeStyle="#ff536f";context.lineWidth=3;context.strokeRect(x*tileSize+2,y*tileSize+2,tileSize-4,tileSize-4); }
        return { tiles, durationMs:(performance.now?.() || Date.now())-started, bounds:{startX,startY,endX,endY}, tileSize };
    }
    function drawMapCanvas() { return scheduleMapDraw({ minimap: true }); }
    function drawMapCanvasNow(options = {}) {
        if (!mapDraft) return;
        const metrics = drawMap($("v18MapCanvas"), mapDraft, { editor: true, zoom: state.map.zoom, cursor: { x: state.map.cursorX, y: state.map.cursorY }, visibility:state.map.layerVisibility, overlay:state.map.overlay });
        mapPerformance.lastDrawMs = metrics.durationMs; mapPerformance.lastTilesDrawn = metrics.tiles; mapPerformance.frames++;
        if ($("v18MapPerformance")) $("v18MapPerformance").textContent = `${metrics.tiles} visible tile draws · ${metrics.durationMs.toFixed(1)} ms`;
        const now = performance.now?.() || Date.now();
        const drawMini = () => { const mini=$("v18Minimap"); if(mini&&mapDraft) drawMap(mini,mapDraft,{maxWidth:220,maxHeight:120,minTile:1,grid:false,visibility:state.map.layerVisibility,overlay:state.map.overlay}); lastMinimapDraw=performance.now?.()||Date.now(); minimapDrawTimer=0; };
        if (options.minimap || now-lastMinimapDraw > 150) {
            if (/HappyDOM/i.test(navigator.userAgent || "") || now-lastMinimapDraw > 150) drawMini();
            else if (!minimapDrawTimer) minimapDrawTimer=setTimeout(drawMini,Math.max(0,150-(now-lastMinimapDraw)));
        }
    }
    function scheduleMapDraw(options = {}) {
        if (mapDrawFrame) return mapDrawFrame;
        const run = () => { mapDrawFrame=0; drawMapCanvasNow(options); };
        if (/HappyDOM/i.test(navigator.userAgent || "") || typeof requestAnimationFrame !== "function") { run(); return 0; }
        mapDrawFrame=requestAnimationFrame(run); return mapDrawFrame;
    }
    async function applyMapDraft() {
        if (!mapDirty || !mapDraft || mapConflicts?.length) return;
        const current = await api.mapSnapshot(mapId);
        if (hash(current) !== mapBaseChecksum) {
            const delta = services.mapDelta(mapBase, mapDraft);
            const merge = services.mergeMapDelta(delta, current);
            mapBase = clone(current); mapBaseChecksum = hash(current); mapDraft = merge.merged; mapConflicts = merge.conflicts.length ? merge.conflicts : null; rebuildDirtyIndices();
            if (!merge.ok) { scheduleDraftRecovery(); notify("The project changed outside Map Studio. Resolve the highlighted overlaps before applying.", "warning"); return renderCreate(); }
            scheduleDraftRecovery(); notify(`Outside changes preserved; ${merge.applied} draft values rebased.`, "success");
        }
        const changes = mapChanges();
        if (!changes) return;
        if (!await confirmChange("Apply map experiment?", `${changes} tile values will be written to Map ${mapId}. A recovery snapshot is created first.`, "Apply safely")) return;
        api.createSnapshot(`Before v18.1 map edit · ${new Date().toLocaleString()}`, mapId);
        await api.applyMapSnapshot(mapDraft, `Worldsmith map edit · ${changes} changes`, mapId);
        await api.save();
        mapBase = clone(mapDraft); mapBaseChecksum = hash(mapBase); mapHistory = []; mapRedo = []; mapConflicts = null; rebuildDirtyIndices(); await clearDraftRecovery(mapId);
        setRecoveryStatus("applied", "project", "");
        state.milestones.edited = true; await invalidateVerification("Map content changed"); persist();
        notify(`${changes} map changes applied. Recovery snapshot kept.`, "success"); await renderCreate();
    }

    async function renderWorld() {
        const tabs = `<div class="v18-tabs"><button data-v18-world-tab="recipes" class="${state.worldTab === "recipes" ? "active" : ""}">World recipe</button><button data-v18-world-tab="quests" class="${state.worldTab === "quests" ? "active" : ""}">Quest flow</button></div>`;
        $("v18Main").innerHTML = `${pageHead("WORLD & STORY", state.worldTab === "recipes" ? "Shape a world with a readable recipe" : "Make every quest path reachable", "Edit the small pieces, preview the outcome, then choose whether to apply it.", tabs)}<div id="v18WorldBody"></div>`;
        $("v18Main").querySelectorAll("[data-v18-world-tab]").forEach(button => button.onclick = () => { state.worldTab = button.dataset.v18WorldTab; persist(); renderWorld(); });
        if (state.worldTab === "quests") renderQuestBuilder(); else await renderRecipeBuilder();
    }
    async function renderRecipeBuilder() {
        const host = $("v18WorldBody"); const recipe = state.recipe;
        const stages = list(recipe.stages);
        host.innerHTML = `<section class="v18-world-layout"><aside class="v18-stage-list"><header><div><small class="v18-section-label">RECIPE</small><h2>${escapeHtml(recipe.name)}</h2></div><button data-v18-action="add-stage" title="Add stage">＋</button></header>${stages.map((stage, index) => `<article class="v18-stage" data-stage-index="${index}"><i>${stage.locked ? "◆" : index + 1}</i><span><strong>${escapeHtml(stage.name)}</strong><small>${escapeHtml(stage.type)} · layer ${integer(stage.layer) + 1}</small></span><button data-v18-action="remove-stage" data-index="${index}" aria-label="Remove ${escapeHtml(stage.name)}">×</button></article>`).join("")}<div class="v18-dialog-actions"><button data-v18-action="recipe-template">Use template</button><button data-v18-action="import-recipe">Import</button></div></aside><main class="v18-panel"><small class="v18-eyebrow">LIVE, DETERMINISTIC PREVIEW</small><h2>Before and after</h2><p>The same seed produces the same tile changes. Locked cells are never overwritten.</p><div class="v18-preview-pair"><figure><canvas id="v18RecipeBefore"></canvas><figcaption>Current map</figcaption></figure><figure><canvas id="v18RecipeAfter"></canvas><figcaption>${recipePreview ? `Preview · ${recipePreview.changes} changes` : "Run preview"}</figcaption></figure></div><div class="v18-dialog-actions"><button data-v18-action="preview-recipe" class="v18-button v18-primary">Run real preview</button><button data-v18-action="apply-recipe" class="v18-button" ${recipePreview ? "" : "disabled"}>Apply preview</button><button data-v18-action="save-recipe">Save graph</button><button data-v18-action="export-recipe">Export</button><button data-v18-action="capture-recipe">Capture</button></div></main><aside class="v18-inspector"><small class="v18-section-label">RECIPE SETTINGS</small><label class="v18-field"><span>Name</span><input id="v18RecipeName" value="${escapeHtml(recipe.name)}"></label><label class="v18-field"><span>Seed</span><input id="v18RecipeSeed" value="${escapeHtml(recipe.seed)}"></label><p>Stages</p>${stages.map((stage, index) => `<fieldset class="v18-form"><legend>${index + 1}. ${escapeHtml(stage.name)}</legend><label class="v18-field"><span>Name</span><input data-stage-field="name" data-index="${index}" value="${escapeHtml(stage.name)}"></label><label class="v18-field"><span>Generator</span><select data-stage-field="type" data-index="${index}">${["biome","road","river","scatter","dungeon","maze"].map(type => `<option ${stage.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="v18-field"><span>Tile A</span><input type="number" min="0" max="8191" data-stage-field="tileA" data-index="${index}" value="${integer(stage.tileA)}"></label><label class="v18-field"><span>Tile B</span><input type="number" min="0" max="8191" data-stage-field="tileB" data-index="${index}" value="${integer(stage.tileB)}"></label><label class="v18-field"><span>Layer</span><input type="number" min="0" max="5" data-stage-field="layer" data-index="${index}" value="${integer(stage.layer)}"></label><label class="v18-field"><span>Density</span><input type="number" min="0" max="1" step="0.01" data-stage-field="density" data-index="${index}" value="${Number(stage.density ?? .12)}"></label><label class="v18-field"><span>Count</span><input type="number" min="1" data-stage-field="count" data-index="${index}" value="${integer(stage.count,8)}"></label><label class="v18-check-row"><span>Lock stage settings</span><input type="checkbox" data-stage-field="locked" data-index="${index}" ${stage.locked ? "checked" : ""}></label></fieldset>`).join("")}</aside></section>`;
        const base = await api.mapSnapshot(); drawMap($("v18RecipeBefore"), base, { maxWidth: 410, maxHeight: 360, grid: false }); drawMap($("v18RecipeAfter"), recipePreview?.map || base, { maxWidth: 410, maxHeight: 360, grid: false });
        $("v18RecipeName").onchange = event => { recipe.name = event.target.value.trim() || "World recipe"; recipePreview = null; persist(); };
        $("v18RecipeSeed").onchange = event => { recipe.seed = event.target.value; recipePreview = null; persist(); };
        host.querySelectorAll("[data-stage-field]").forEach(input => input.onchange = () => { const stage = recipe.stages[integer(input.dataset.index)]; const field = input.dataset.stageField; stage[field] = input.type === "checkbox" ? input.checked : input.type === "number" ? (field === "density" ? Number(input.value) : integer(input.value)) : input.value; recipePreview = null; persist(); });
    }
    function generatorOptions(stage, index) {
        const map = mapDraft || mapBase;
        return { type: stage.type, seed: `${state.recipe.seed}:${stage.id || index}`, layer: clamp(integer(stage.layer), 0, 5), tileA: Math.max(0, integer(stage.tileA)), tileB: Math.max(0, integer(stage.tileB)), density: Number(stage.density ?? .12), count: Math.max(1, integer(stage.count, 8)), width: 2, scale: 8, start: [0, Math.floor((map?.height || 10) / 2)], end: [Math.max(0, (map?.width || 10) - 1), Math.floor((map?.height || 10) / 2)] };
    }
    async function previewRecipe() {
        const base = await api.mapSnapshot(); const preview = clone(base); const locked = new Set(list(state.recipe.lockedCells).map(String)); let changes = 0;
        for (let stageIndex = 0; stageIndex < state.recipe.stages.length; stageIndex++) {
            const stage = state.recipe.stages[stageIndex], options = generatorOptions(stage, stageIndex);
            const fallback = () => { const value=api.runGenerator(options); return { entries:[...(value instanceof Map ? value : [])], stats:{ cells:value?.size||0, type:stage.type, complete:true } }; };
            const result = await api.runWorker("generate-stage", { map: { width: preview.width, height: preview.height, tilesetId: preview.tilesetId }, stage: options, seed: state.recipe.seed }, fallback);
            for (const [index, tileId] of result?.entries || []) {
                const cell = index % (preview.width * preview.height), x = cell % preview.width, y = Math.floor(cell / preview.width);
                if (locked.has(`${x},${y}`)) continue;
                if (preview.data[index] !== tileId) { preview.data[index] = tileId; changes++; }
            }
        }
        recipePreview = { map: preview, baseChecksum: hash(base), changes, at: Date.now(), recipeChecksum: hash(state.recipe), workerBacked: true };
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
    function recipePayload() { return services.recipePayload(state.recipe, hash); }
    async function saveRecipe() {
        const payload=recipePayload(); await assertSchema(payload,"HybridWorldRecipeGraph"); const name=`${safeId(state.recipe.id || state.recipe.name)}.htggraph`;
        if(api.projectInfo().open) await api.writeProjectJson(`.hybrid/worldsmith/recipe-graphs/${name}`,payload,true); else api.download(name,JSON.stringify(payload,null,2),"application/json");
        await invalidateVerification("World recipe graph changed"); persist(); notify("Canonical recipe graph validated and saved.","success");
    }
    function exportRecipe() { const payload=recipePayload(); api.download(`${safeId(state.recipe.name)}.htggraph`,JSON.stringify(payload,null,2),"application/json"); }
    async function importRecipeFile(event) {
        const file=event.target.files?.[0]; if(!file)return; const parsed=JSON.parse(await file.text()); await assertSchema(parsed,"HybridWorldRecipeGraph");
        state.recipe=services.normalizeRecipe(parsed); recipePreview=null; event.target.value=""; await invalidateVerification("World recipe imported"); persist(); notify("Recipe imported and schema-validated.","success"); if(state.view==="world") renderWorld();
    }
    async function applyRecipeTemplate() { const choice=await inputValue("Choose a recipe template","Enter: overworld, dungeon, or islands","Template","overworld"); if(!choice)return; const templates={overworld:[{id:"terrain",type:"biome",name:"Shape terrain",layer:0,tileA:2048,tileB:2816,density:.5,count:8},{id:"roads",type:"road",name:"Connect roads",layer:1,tileA:1536,tileB:0,density:.3,count:3},{id:"details",type:"scatter",name:"Add landmarks",layer:2,tileA:1,tileB:2,density:.08,count:24}],dungeon:[{id:"rooms",type:"dungeon",name:"Carve rooms",layer:0,tileA:4352,tileB:0,density:.45,count:10},{id:"details",type:"scatter",name:"Place props",layer:2,tileA:10,tileB:11,density:.06,count:18}],islands:[{id:"water",type:"biome",name:"Fill ocean",layer:0,tileA:2048,tileB:2816,density:.72,count:8},{id:"islands",type:"scatter",name:"Raise islands",layer:0,tileA:2816,tileB:2048,density:.22,count:12} ]}; const stages=templates[safeId(choice)]; if(!stages)throw new Error("Choose overworld, dungeon, or islands."); state.recipe=services.normalizeRecipe({...state.recipe,name:`${choice[0].toUpperCase()+choice.slice(1)} recipe`,stages}); recipePreview=null; persist(); renderWorld(); }
    function validateQuest() {
        return services.validateQuest(state.quest);
    }
    function renderQuestBuilder() {
        state.quest=services.normalizeQuest(state.quest); const host = $("v18WorldBody"), report = validateQuest(), nodes = state.quest.nodes, edges=state.quest.edges;
        if(!nodes.some(node=>node.id===selectedQuestNode)) selectedQuestNode=nodes[0]?.id; const selected=nodes.find(node=>node.id===selectedQuestNode) || nodes[0], selectedIndex=nodes.indexOf(selected);
        host.innerHTML = `<section class="v18-world-layout"><aside class="v18-stage-list"><header><div><small class="v18-section-label">QUEST</small><h2>${escapeHtml(state.quest.name)}</h2></div><button data-v18-action="add-quest-node">＋</button></header>${nodes.map((node, index) => `<button class="v18-stage ${node.id===selectedQuestNode?"active":""}" data-v18-quest-index="${index}" aria-pressed="${node.id===selectedQuestNode}"><i>${index + 1}</i><span><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.type)} · ${escapeHtml(node.id)}</small></span></button>`).join("")}<button data-v18-action="import-quest">Import quest</button></aside><main class="v18-panel"><small class="v18-eyebrow">PLAYER FLOW</small><h2>${report.ok ? "Every route has a readable start" : "The flow needs attention"}</h2><div class="v18-quest-graph">${nodes.map(node => `<article class="v18-quest-node ${escapeHtml(node.type)}"><small>${escapeHtml(node.type)}</small><strong>${escapeHtml(node.title)}</strong><p>${escapeHtml(node.description)}</p><b>${edges.filter(edge=>edge.from===node.id).map(edge=>`→ ${escapeHtml(edge.to)}${edge.label?` · ${escapeHtml(edge.label)}`:""}`).join("<br>") || "END"}</b></article>`).join("")}</div><div class="v18-findings">${report.issues.length ? report.issues.map(issue => finding(issue.severity, issue.severity === "error" ? "Broken path" : "Flow note", issue.message)).join("") : finding("success", "Every node is reachable", `${report.visited} nodes are connected; choices and failure paths are preserved.`)}</div><div class="v18-dialog-actions"><button data-v18-action="save-quest" class="v18-button v18-primary" ${report.ok ? "" : "disabled"}>Save quest</button><button data-v18-action="export-quest">Export</button><button data-v18-action="capture-quest">Capture</button></div><h3>Connections</h3>${edges.map((edge,index)=>`<label class="v18-edge-row"><select data-edge-field="from" data-index="${index}">${nodes.map(node=>`<option ${node.id===edge.from?"selected":""}>${escapeHtml(node.id)}</option>`).join("")}</select><span>→</span><select data-edge-field="to" data-index="${index}">${nodes.map(node=>`<option ${node.id===edge.to?"selected":""}>${escapeHtml(node.id)}</option>`).join("")}</select><input data-edge-field="label" data-index="${index}" placeholder="Choice label" value="${escapeHtml(edge.label)}"><button data-v18-action="remove-quest-edge" data-index="${index}" aria-label="Remove connection">×</button></label>`).join("")}<button data-v18-action="add-quest-edge">Add connection</button><h3>Cutscene cues</h3>${state.quest.cues.map((cue,index)=>`<fieldset class="v18-form"><legend>${escapeHtml(cue.id)}</legend><input data-cue-field="at" data-index="${index}" type="number" min="0" step="0.1" value="${cue.at}" aria-label="Cue start"><input data-cue-field="duration" data-index="${index}" type="number" min="0" step="0.1" value="${cue.duration}" aria-label="Cue duration"><select data-cue-field="track" data-index="${index}">${["dialogue","camera","audio","movement","screen"].map(value=>`<option ${value===cue.track?"selected":""}>${value}</option>`).join("")}</select><input data-cue-field="target" data-index="${index}" value="${escapeHtml(cue.target)}" placeholder="Target"><button data-v18-action="remove-quest-cue" data-index="${index}">Remove cue</button></fieldset>`).join("")}<button data-v18-action="add-quest-cue">Add cue</button></main><aside class="v18-inspector"><small class="v18-section-label">QUEST SETTINGS</small><label class="v18-field"><span>Quest name</span><input id="v18QuestName" value="${escapeHtml(state.quest.name)}"></label>${selected?`<fieldset class="v18-form"><legend>${escapeHtml(selected.title)}</legend><label class="v18-field"><span>ID</span><input data-quest-field="id" data-index="${selectedIndex}" value="${escapeHtml(selected.id)}"></label><label class="v18-field"><span>Type</span><select data-quest-field="type" data-index="${selectedIndex}">${["start","dialogue","objective","choice","reward","transfer","complete","fail"].map(type => `<option ${selected.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="v18-field"><span>Title</span><input data-quest-field="title" data-index="${selectedIndex}" value="${escapeHtml(selected.title)}"></label><label class="v18-field"><span>Description</span><textarea data-quest-field="description" data-index="${selectedIndex}">${escapeHtml(selected.description)}</textarea></label><label class="v18-field"><span>Gold reward</span><input type="number" min="0" data-quest-field="rewardGold" data-index="${selectedIndex}" value="${integer(selected.rewardGold)}"></label><label class="v18-field"><span>Transfer map</span><input type="number" min="0" data-quest-field="targetMapId" data-index="${selectedIndex}" value="${integer(selected.targetMapId)}"></label><div class="v18-coordinate-row"><input type="number" min="0" data-quest-field="targetX" data-index="${selectedIndex}" value="${integer(selected.targetX)}" aria-label="Transfer X"><input type="number" min="0" data-quest-field="targetY" data-index="${selectedIndex}" value="${integer(selected.targetY)}" aria-label="Transfer Y"></div><button data-v18-action="remove-quest-node" data-index="${selectedIndex}" class="v18-button v18-danger">Remove node</button></fieldset>`:""}</aside></section>`;
        $("v18QuestName").onchange = event => { state.quest.name = event.target.value.trim() || "Quest"; persist(); renderQuestBuilder(); };
        host.querySelectorAll("[data-v18-quest-index]").forEach(button=>button.onclick=()=>{selectedQuestNode=nodes[integer(button.dataset.v18QuestIndex)].id;renderQuestBuilder();});
        host.querySelectorAll("[data-quest-field]").forEach(input => input.onchange = () => { const node=state.quest.nodes[integer(input.dataset.index)], field=input.dataset.questField, oldId=node.id; node[field]=input.type==="number"?Math.max(0,integer(input.value)):input.value; if(field==="id"){node.id=safeId(node.id)||oldId; for(const edge of state.quest.edges){if(edge.from===oldId)edge.from=node.id;if(edge.to===oldId)edge.to=node.id;} selectedQuestNode=node.id;} persist(); renderQuestBuilder(); });
        host.querySelectorAll("[data-edge-field]").forEach(input=>input.onchange=()=>{state.quest.edges[integer(input.dataset.index)][input.dataset.edgeField]=input.value;persist();renderQuestBuilder();});
        host.querySelectorAll("[data-cue-field]").forEach(input=>input.onchange=()=>{const field=input.dataset.cueField;state.quest.cues[integer(input.dataset.index)][field]=input.type==="number"?Math.max(0,Number(input.value)):input.value;persist();renderQuestBuilder();});
    }
    async function saveQuest() {
        const report = validateQuest(); if (!report.ok) throw new Error("Fix broken quest links before saving.");
        const payload = services.questPayload(state.quest,hash); await assertSchema(payload,"HybridQuestProject"); const name=`${safeId(state.quest.id || state.quest.name)}.htgquest`;
        if (api.projectInfo().open) await api.writeProjectJson(`.hybrid/worldsmith/quests/${name}`, payload, true);
        else api.download(name, JSON.stringify(payload, null, 2), "application/json");
        state.milestones.quest = true; await invalidateVerification("Quest definition changed"); persist(); notify("Quest definition validated against its schema and saved.", "success");
    }
    async function importQuestFile(event) {
        const file=event.target.files?.[0];if(!file)return; const parsed=JSON.parse(await file.text()); await assertSchema(parsed,"HybridQuestProject");
        state.quest=services.normalizeQuest(parsed);selectedQuestNode=state.quest.nodes[0]?.id;event.target.value="";await invalidateVerification("Quest imported");persist();notify("Quest imported and schema-validated.","success");if(state.view==="world")renderWorld();
    }

    async function projectFingerprintDetails() {
        const maps = [];
        for (const info of api.projectInfo().maps) {
            try { const map = await api.mapSnapshot(info.id); maps.push([info.id, hash({ width: map.width, height: map.height, tilesetId: map.tilesetId, data: map.data, events: map.events })]); }
            catch (error) { maps.push([info.id, `unreadable:${error.message}`]); }
        }
        if (!maps.length && hasMaps()) { const map = await api.mapSnapshot(); maps.push([integer(api.state().activeMapId), hash(map)]); }
        const extensions=list(api.state().extensions).map(item=>({id:item.id,version:item.version||"0.0.0",capabilities:list(item.capabilities),permissions:list(item.permissions)})).sort((a,b)=>a.id.localeCompare(b.id));
        return fingerprintDetails({ schema: 18, canonicalizationVersion:cryptoService?.canonicalizationVersion||0, policyVersion:state.verificationPolicyVersion, maps, recipe: services.recipePayload(state.recipe,hash), quest:services.questPayload(state.quest,hash), content: state.content.map(item => [item.id, item.version, item.contentHash]), budgets:state.budgets, extensions, policies: state.extensionPolicies });
    }
    async function projectFingerprint() { return (await projectFingerprintDetails()).id; }
    async function invalidateVerification(reason) {
        currentFingerprint = ""; productionReport = null;
        state.notices.unshift({ id: uid("notice"), at: Date.now(), type: "stale", message: reason });
        state.notices = state.notices.slice(0, 20); persist();
    }
    function tabStatus(tab) {
        if (tab === "structural") return state.testRuns[0] ? state.testRuns[0].fingerprint === currentFingerprint ? state.testRuns[0].status : "stale" : "not-run";
        if (tab === "golden") { const values=Object.values(state.goldenMaps||{}); if(!values.length)return "not-run"; if(values.some(item=>item.status==="changed"||item.status==="failed"))return "failed"; if(values.every(item=>item.status==="verified")&&values.every(item=>item.comparisonFingerprint===currentFingerprint))return "verified"; if(values.some(item=>item.status==="verified"))return "stale"; return "baseline"; }
        if (tab === "journey") return state.realPlaytest.attested ? state.realPlaytest.fingerprint === currentFingerprint ? "verified" : "stale" : "not-run";
        if (tab === "migration") return state.migration.status === "verified" && state.migration.fingerprint !== currentFingerprint ? "stale" : state.migration.status || "not-run";
        if (tab === "performance") return state.testRuns[0]?.performance?.status || "not-run";
        return "not-run";
    }
    async function renderTest() {
        currentFingerprint = await projectFingerprint();
        const tabs = [["structural","Structure"],["golden","Golden maps"],["journey","Real playtest"],["migration","Save migration"],["performance","Performance"]];
        $("v18Main").innerHTML = `${pageHead("TEST · PLAYTEST LAB", "Trust results only while they are current", "Verified, failed, skipped, not-run, and stale are intentionally different states.", `<button data-v18-action="run-lab" class="v18-button v18-primary">Run current lab</button>`)}<section class="v18-test-layout"><aside class="v18-lab-menu">${tabs.map(([id, label]) => `<button data-v18-test-tab="${id}" class="${state.testTab === id ? "active" : ""}"><i class="${tabStatus(id)}"></i><span><strong>${label}</strong><small>${tabStatus(id).replace("-", " ")}</small></span></button>`).join("")}</aside><main id="v18LabStage" class="v18-lab-stage"></main></section>`;
        $("v18Main").querySelectorAll("[data-v18-test-tab]").forEach(button => button.onclick = () => { state.testTab = button.dataset.v18TestTab; persist(); renderTest(); });
        renderLabStage();
    }
    function resultBadge(status) { return `<b class="v18-result ${escapeHtml(status)}">${escapeHtml(status.replace("-", " ").toUpperCase())}</b>`; }
    function renderLabStage() {
        const host = $("v18LabStage"); if (!host) return; const run = state.testRuns[0];
        if (state.testTab === "structural") {
            const current = run && run.fingerprint === currentFingerprint; const status = run ? current ? run.status : "stale" : "not-run";
            host.innerHTML = `<small class="v18-eyebrow">STRUCTURAL SCAN</small><h2>Every connected map, not just the open one</h2><p>Checks data shape, tile values, event bounds, empty event pages, autorun pressure, transfer targets, and creator budgets.</p>${resultBadge(status)}<section class="v18-metrics">${metric(run?.maps ?? "—", "Maps scanned")}${metric(run?.errors ?? "—", "Errors", run?.errors ? "red" : "mint")}${metric(run?.warnings ?? "—", "Warnings", run?.warnings ? "yellow" : "mint")}${metric(run?.durationMs ? `${run.durationMs} ms` : "—", "Scan time")}</section><div class="v18-findings">${run?.findings?.length ? run.findings.slice(0, 100).map(item => finding(item.severity, item.title, item.message)).join("") : finding("info", "No current result", "Run the lab after every material project change.")}</div>`;
        } else if (state.testTab === "golden") {
            const golden = state.goldenMaps || {}; const entries = Object.entries(golden);
            host.innerHTML = `<small class="v18-eyebrow">GOLDEN MAPS</small><h2>Catch unintended map changes</h2><p>A golden map stores a checksum and dimensions—not a duplicate project map. Compare it after generators or bulk edits.</p><div class="v18-dialog-actions"><button data-v18-action="capture-golden" class="v18-button v18-primary">Capture active map baseline</button><button data-v18-action="compare-golden" class="v18-button" ${entries.length ? "" : "disabled"}>Compare all</button></div><div class="v18-findings">${entries.length ? entries.map(([id, item]) => {const status=item.status==="verified"&&item.comparisonFingerprint!==currentFingerprint?"stale":item.status||"baseline";return finding(status === "changed" ? "error" : status === "verified" ? "success" : status==="stale"?"warning":"info", `Map ${id} · ${status}`, `${item.width} × ${item.height} · ${item.checksum}`);}).join("") : finding("info", "No baselines yet", "Capture a known-good map when its layout is intentional.")}</div>`;
        } else if (state.testTab === "journey") {
            const play = state.realPlaytest, current = play.fingerprint === currentFingerprint, status = play.attested ? current ? "verified" : "stale" : "not-run";
            host.innerHTML = `<small class="v18-eyebrow">REAL ENGINE PLAYTEST</small><h2>A launch is not a pass</h2><p>Worldsmith can launch the packaged desktop playtest. Only you can attest that the critical player path was actually completed.</p>${resultBadge(status)}<label class="v18-field"><span>What did you verify?</span><textarea id="v18PlaytestNote" placeholder="Example: New game → village → cave → boss → save/reload">${escapeHtml(play.note || "")}</textarea></label><div class="v18-dialog-actions"><button data-v18-action="launch-playtest" class="v18-button v18-primary">Launch real engine</button><button data-v18-action="attest-playtest" class="v18-button">I completed this path</button><button data-v18-action="clear-attestation" class="v18-button v18-danger" ${play.attested ? "" : "disabled"}>Clear</button></div><div class="v18-findings">${play.launchedAt ? finding("info", "Playtest launched—not verified", new Date(play.launchedAt).toLocaleString()) : finding("info", "Not launched from Worldsmith", "Launching and verifying are deliberately separate.")}</div>`;
        } else if (state.testTab === "migration") {
            const migration = state.migration, current = migration.fingerprint === currentFingerprint, status = migration.status === "verified" && !current ? "stale" : migration.status;
            host.innerHTML = `<small class="v18-eyebrow">SAVE MIGRATION</small><h2>Test the save path you actually support</h2><p>Open an older supported save in the real engine, transfer maps, save again, reload, and confirm world state. If the game has never shipped, mark this deliberately skipped.</p>${resultBadge(status)}<label class="v18-field"><span>Observed result or skip reason</span><textarea id="v18MigrationNote" placeholder="Example: Loaded v0.8 save, transferred to Map 12, world clock and spawned events persisted.">${escapeHtml(migration.note || "")}</textarea></label><div class="v18-dialog-actions"><button data-v18-action="verify-migration" class="v18-button v18-primary">Record verified migration</button><button data-v18-action="skip-migration" class="v18-button">Skip with reason</button></div>`;
        } else {
            const performance = run?.performance; const status = performance && run.fingerprint === currentFingerprint ? performance.status : performance ? "stale" : "not-run";
            host.innerHTML = `<small class="v18-eyebrow">PERFORMANCE BUDGETS</small><h2>Make limits explicit</h2><p>These are project budgets, not universal truths. Change them in Settings, then rerun the lab.</p>${resultBadge(status)}<section class="v18-metrics">${metric(performance?.largestCells ?? "—", `Largest map · max ${state.budgets.maxMapCells}`)}${metric(performance?.largestEvents ?? "—", `Most events · max ${state.budgets.maxEventsPerMap}`)}${metric(`${state.budgets.targetFrameMs} ms`, "Target frame budget")}${metric(`${state.budgets.maxRuntimeSaveKb} KB`, "Runtime save budget")}</section><div class="v18-findings">${finding("info", "Runtime frame timing requires playtest telemetry", "Static analysis can flag risky scale, but it cannot claim frame-rate verification.")}${finding("info", "Runtime save size requires a real save", "The v18 plugin strips authoring-only data; verify your complete game save in-engine.")}</div>`;
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
        const warningBudgetPassed=warnings<=state.budgets.maxWarnings, passed=!errors&&warningBudgetPassed&&performanceStatus==="verified";
        if(!warningBudgetPassed)findings.unshift({severity:"error",title:"Warning review budget exceeded",message:`${warnings} warnings exceed the configured limit of ${state.budgets.maxWarnings}. Review or raise the explicit project budget.`});
        labReport = { id: uid("lab"), at: Date.now(), fingerprint, status: passed ? "verified" : "failed", passed, errors:errors+(warningBudgetPassed?0:1), warnings, warningBudgetPassed, maps: maps.length || 1, findings, durationMs: Math.round(performance.now() - started), performance: { status: performanceStatus, largestCells, largestEvents } };
        state.testRuns.unshift(labReport); state.testRuns = state.testRuns.slice(0, 20); state.milestones.tested = passed; persist(); notify(passed ? "Structural and static performance budgets verified." : "The lab found blocking errors or budget failures.", passed ? "success" : "error"); await renderTest(); return clone(labReport);
    }
    async function captureGolden() {
        const id = integer(api.state().activeMapId), map = await api.mapSnapshot(id); state.goldenMaps ||= {}; state.goldenMaps[id] = { checksum: hash(map), width: map.width, height: map.height, capturedAt: Date.now(), baselineFingerprint:await projectFingerprint(), comparisonFingerprint:"", status: "baseline" }; persist(); notify(`Map ${id} baseline captured.`, "success"); renderLabStage();
    }
    async function compareGolden() {
        const fingerprint=await projectFingerprint();for (const [id, golden] of Object.entries(state.goldenMaps || {})) { try { const map = await api.mapSnapshot(integer(id)); golden.status = hash(map) === golden.checksum ? "verified" : "changed"; golden.comparedAt = Date.now();golden.comparisonFingerprint=fingerprint; } catch (_) { golden.status = "changed";golden.comparisonFingerprint=fingerprint; } } persist(); renderLabStage();
    }
    async function launchRealPlaytest() {
        await api.launchPlaytest({ source: "worldsmith-v18", fingerprint: currentFingerprint || await projectFingerprint() }); state.realPlaytest.launchedAt = Date.now(); state.realPlaytest.attested = false; state.realPlaytest.fingerprint = ""; persist(); notify("Playtest launched. This is not marked verified yet.", "info"); renderLabStage();
    }
    async function attestPlaytest() {
        const note = $("v18PlaytestNote")?.value.trim(); if (!note || note.length < 10) throw new Error("Describe the player path you actually completed (at least 10 characters).");
        if (!state.realPlaytest.launchedAt) throw new Error("Launch the real engine from this screen before attesting.");
        if (!await confirmChange("Attest this real playtest?", "This records your human verification for the current project fingerprint. It will become stale after content changes.", "Record verification")) return;
        state.realPlaytest = { ...state.realPlaytest, attested: true, note, at: Date.now(), fingerprint: currentFingerprint || await projectFingerprint() }; persist(); notify("Real playtest verification recorded for this exact project state.", "success"); renderTest();
    }
    async function recordMigration(status) {
        const note = $("v18MigrationNote")?.value.trim(); if (!note || note.length < 10) throw new Error("Record a useful observed result or skip reason (at least 10 characters).");
        if (status === "verified" && !await confirmChange("Record migration verification?", "Confirm that this was tested in the real RPG Maker engine with a supported older save.", "Record verified")) return;
        state.migration = { status, note, at: Date.now(), fingerprint: status === "verified" ? currentFingerprint || await projectFingerprint() : "" }; persist(); notify(status === "verified" ? "Save migration verified for this project state." : "Save migration deliberately skipped with a reason.", status === "verified" ? "success" : "info"); renderTest();
    }

    async function releaseAssessment() {
        const fingerprintInfo = await projectFingerprintDetails(), fingerprint = fingerprintInfo.id, lab = state.testRuns[0];
        const extensions = list(api.state().extensions), unreviewed = extensions.filter(item => state.extensionPolicies[item.id] !== "trusted");
        const brokenContent = state.content.filter(item => item.dependencies?.some(dependency => !state.content.some(candidate => candidate.id === dependency)));
        const checkpoint=state.checkpoints.find(item=>item.fingerprint===fingerprint), mapCount=api.projectInfo().maps.length || 1;
        const gates = [
            { id: "drafts", title: "No uncommitted experiments", required: true, pass: !mapDirty && !recipePreview, detail: mapDirty ? "Map Studio has unapplied changes" : recipePreview ? "A recipe preview is open but unapplied" : "Project state is explicit" },
            { id: "structure", title: "Structural lab", required: true, pass: !!lab?.passed && lab.fingerprint === fingerprint, detail: !lab ? "Not run" : lab.fingerprint !== fingerprint ? "Stale after project changes" : lab.passed ? `${lab.maps} maps verified` : `${lab.errors} errors remain` },
            { id: "playtest", title: "Real player path", required: true, pass: state.realPlaytest.attested && state.realPlaytest.fingerprint === fingerprint, detail: !state.realPlaytest.attested ? "Human verification not recorded" : state.realPlaytest.fingerprint !== fingerprint ? "Attestation is stale" : state.realPlaytest.note },
            { id: "budgets", title: "Static performance budgets", required: true, pass: lab?.fingerprint===fingerprint&&lab?.performance?.status==="verified"&&lab?.warningBudgetPassed!==false, detail:lab?.fingerprint!==fingerprint?"Current lab required":lab?.performance?.status!=="verified"?"Map scale budget failed":lab?.warningBudgetPassed===false?"Warning review budget failed":"Static budgets verified" },
            { id: "checkpoint", title: "Recovery checkpoint", required: true, pass: !!checkpoint&&integer(checkpoint.mapCount)===mapCount, detail: checkpoint ? integer(checkpoint.mapCount)===mapCount ? `${mapCount} map${mapCount===1?"":"s"} captured` : "Checkpoint does not cover every map" : "Capture the current state" },
            { id: "extensions", title: "Extension trust review", required: true, pass: !unreviewed.length, detail: extensions.length ? unreviewed.length ? `${unreviewed.length} not explicitly trusted` : `${extensions.length} reviewed` : "No extensions loaded" },
            { id: "content", title: "Content dependencies", required: true, pass: !brokenContent.length, detail: brokenContent.length ? `${brokenContent.length} items have missing dependencies` : `${state.content.length} items resolved` },
            { id: "migration", title: "Save migration", required: false, pass: state.migration.status === "verified" && state.migration.fingerprint === fingerprint, status:state.migration.status==="skipped"?"skipped":state.migration.status==="verified"&&state.migration.fingerprint!==fingerprint?"stale":state.migration.status, detail: state.migration.status === "skipped" ? `Skipped: ${state.migration.note}` : state.migration.status === "verified" && state.migration.fingerprint !== fingerprint ? "Verification is stale" : state.migration.status === "verified" ? "Verified in the real engine" : "Not run; recommended for shipped games" },
            { id: "golden", title: "Golden map comparison", required: false, pass: Object.values(state.goldenMaps || {}).length > 0 && Object.values(state.goldenMaps || {}).every(item => item.status === "verified"&&item.comparisonFingerprint===fingerprint), status:Object.values(state.goldenMaps||{}).some(item=>item.status==="verified"&&item.comparisonFingerprint!==fingerprint)?"stale":"not-run", detail: "Recommended regression evidence for this exact fingerprint" }
        ];
        return { fingerprint, fingerprintInfo, gates, ready: gates.filter(gate => gate.required).every(gate => gate.pass), checkedAt: Date.now(), unreviewed, brokenContent };
    }
    async function renderRelease() {
        productionReport = await releaseAssessment(); const passed = productionReport.gates.filter(gate => gate.pass).length;
        $("v18Main").innerHTML = `${pageHead("VERIFY & RELEASE", productionReport.ready ? "This exact project state is ready" : "Close every required gate", "Worldsmith creates reproducible release metadata. It never claims deployment, store approval, or player verification it did not perform.", `<button data-v18-action="refresh-release">Refresh evidence</button><button data-v18-action="create-release" class="v18-button v18-primary" ${productionReport.ready ? "" : "disabled"}>Create release record</button>`)}<section class="v18-release-layout"><main><article class="v18-card"><div class="v18-health-ring" style="--score:${Math.round(passed / productionReport.gates.length * 100)}"><span><strong>${passed}/${productionReport.gates.length}</strong><small>gates</small></span></div><div><small class="v18-eyebrow">CURRENT PROJECT FINGERPRINT</small><h2>${productionReport.ready ? "Required evidence is current" : "Verification is incomplete or stale"}</h2><p><code>${productionReport.fingerprint}</code> binds maps, recipes, quests, content, budgets, extension manifests, trust policy, and verification policy.</p></div></article><section class="v18-gates">${productionReport.gates.map(gate => `<article class="v18-gate ${gate.pass ? "pass" : gate.required ? "fail" : gate.status==="stale"?"stale":"optional"}"><i>${gate.pass ? "✓" : gate.required ? "!" : gate.status==="skipped"?"—":"○"}</i><span><strong>${escapeHtml(gate.title)}</strong><small>${escapeHtml(gate.detail)}</small></span><b>${gate.pass ? "CURRENT" : gate.required ? "REQUIRED" : (gate.status||"OPTIONAL").toUpperCase()}</b></article>`).join("")}</section></main><aside class="v18-inspector"><small class="v18-section-label">RELEASE EVIDENCE</small><button data-v18-action="release-lab" class="v18-button">Run structural lab</button><button data-v18-action="release-playtest" class="v18-button">Verify real playtest</button><button data-v18-action="capture-checkpoint" class="v18-button">Capture checkpoint</button><small class="v18-section-label">EXTENSIONS</small>${productionReport.unreviewed.length ? productionReport.unreviewed.map(extension => `<label class="v18-check-row"><span>${escapeHtml(extension.id)}<small>Same-process code; trust explicitly</small></span><input type="checkbox" data-v18-trust-extension="${escapeHtml(extension.id)}"></label>`).join("") : `<p>No unreviewed extensions.</p>`}<div class="v18-card"><strong>What “release” means here</strong><p>A checksum-bound local manifest and evidence summary. Building and distributing the RPG Maker game remain separate actions.</p></div></aside></section>`;
        $("v18Main").querySelectorAll("[data-v18-trust-extension]").forEach(input => input.onchange = async () => { if (input.checked && await confirmChange("Trust this extension?", "Studio extensions execute JavaScript in the same process. Budget monitoring is not security isolation.", "Trust for this project")) { state.extensionPolicies[input.dataset.v18TrustExtension] = "trusted"; persist(); renderRelease(); } else input.checked = false; });
    }
    async function captureCheckpoint() {
        const fingerprint = await projectFingerprint(); const maps = [];
        for (const info of api.projectInfo().maps) { try { const snapshot = api.createSnapshot(`Release checkpoint · ${new Date().toLocaleString()}`, info.id); if (snapshot) maps.push(snapshot); } catch (_) { /* the manifest still records the map checksum */ } }
        state.checkpoints.unshift({ id: uid("checkpoint"), at: Date.now(), fingerprint, maps, mapCount:api.projectInfo().maps.length||1 }); state.checkpoints = state.checkpoints.slice(0, 12); persist(); notify("Recovery checkpoint captured for every connected map.", "success"); await renderRelease();
    }
    async function createReleaseRecord() {
        const assessment = await releaseAssessment(); if (!assessment.ready) throw new Error("Required release gates are not current.");
        const version = await inputValue("Create release record", "Enter the game or build version this evidence describes.", "Release version", `0.${state.releases.length + 1}.0`); if (!version) return;
        const release = { format:"HybridReleaseManifest", version:2, studioVersion:VERSION, releaseVersion:version, project: api.projectInfo().name, fingerprint: assessment.fingerprint, fingerprintInfo:assessment.fingerprintInfo, verificationPolicyVersion:state.verificationPolicyVersion, budgets:clone(state.budgets), createdAt: new Date().toISOString(), evidence: assessment.gates.map(({ id, title, required, pass, status, detail }) => ({ id, title, required, status: pass ? "verified" : status||"not-run", detail })), realPlaytest: { at: state.realPlaytest.at, note: state.realPlaytest.note }, limitations: ["This record does not assert deployment, store approval, or platform certification.", "Runtime frame timing and complete save size require in-engine measurement."] };
        await assertSchema(release,"HybridReleaseManifest");
        if(api.projectInfo().open)await api.writeProjectJson(`.hybrid/worldsmith/releases/${safeId(version)}.htgrelease`,release,true);else api.download(`${safeId(api.projectInfo().name||"project")}-${safeId(version)}.htgrelease`,JSON.stringify(release,null,2),"application/json");
        state.releases.unshift(release);state.milestones.released=true;persist();notify(`Release record ${version} created with SHA-256 evidence.`,"success");renderRelease();
    }

    async function renderLibrary() {
        const query = String(state.libraryQuery || "").toLowerCase(), kind = state.libraryKind || "all";
        const items = state.content.filter(item => (kind === "all" || item.type === kind) && (!query || `${item.name} ${item.type} ${list(item.tags).join(" ")}`.toLowerCase().includes(query)));
        $("v18Main").innerHTML = `${pageHead("CONTENT LIBRARY", "Reuse what you made—safely", "Captured content keeps its dimensions, dependencies, checksum, and source. Installation is always previewed and reversible.", `<button data-v18-action="capture-content" class="v18-button v18-primary">Capture active map</button><button data-v18-action="capture-recipe">Capture recipe</button><button data-v18-action="capture-quest">Capture quest</button><button data-v18-action="import-content">Import</button><button data-v18-action="export-library">Export library</button>`)}<section class="v18-library-layout"><aside class="v18-library-sidebar"><input id="v18LibrarySearch" type="search" placeholder="Search content…" value="${escapeHtml(state.libraryQuery || "")}">${["all","map","recipe","quest"].map(value => `<button data-v18-library-kind="${value}" class="${kind === value ? "active" : ""}">${value === "all" ? "Everything" : value[0].toUpperCase() + value.slice(1)} <b>${value === "all" ? state.content.length : state.content.filter(item => item.type === value).length}</b></button>`).join("")}</aside><main><div class="v18-library-grid">${items.map(item => {const map=item.payload?.map;return `<article class="v18-content-card"><div class="v18-content-thumb">${item.type === "map" ? "▦" : item.type === "recipe" ? "✦" : "◇"}</div><small>${escapeHtml(item.type.toUpperCase())} · v${item.version}</small><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || (map?`${map.width} × ${map.height}`:"Reusable project content"))}</p><footer><button data-v18-action="favorite-content" data-id="${item.id}" aria-label="Favorite">${item.favorite ? "★" : "☆"}</button><button data-v18-action="export-content" data-id="${item.id}">Export</button><button data-v18-action="install-content" data-id="${item.id}" class="v18-button v18-primary">Install</button></footer></article>`;}).join("") || `<div class="v18-empty"><div><h2>No matching content</h2><p>Capture a finished map, recipe, or quest so the good parts become reusable.</p></div></div>`}</div></main></section>`;
        const search = $("v18LibrarySearch"); search.oninput = event => { state.libraryQuery = event.target.value; persist(); const position = event.target.selectionStart; renderLibrary().then(() => { $("v18LibrarySearch")?.focus(); $("v18LibrarySearch")?.setSelectionRange(position, position); }); };
        $("v18Main").querySelectorAll("[data-v18-library-kind]").forEach(button => button.onclick = () => { state.libraryKind = button.dataset.v18LibraryKind; persist(); renderLibrary(); });
    }
    async function captureContent() {
        const map = await api.mapSnapshot(), id = uid("content"), name = await inputValue("Capture active map","Give this reusable map a clear name.","Library item name",`Map ${integer(api.state().activeMapId)} capture`); if (!name) return;
        const item = services.normalizeContentItem({ id, type:"map", version:2, name, description: `Captured from ${api.projectInfo().name || "loose map"}`, payload:{sourceMapId:integer(api.state().activeMapId),map:clone(map)}, dependencies: [], tags: [], favorite: false },hash);
        state.content.unshift(item); persist(); notify(`“${item.name}” added to your library.`, "success"); if (state.view === "library") renderLibrary();
    }
    function contentPayload(items) { return services.contentPayload(items,hash); }
    async function captureStructuredContent(type){const source=type==="recipe"?services.recipePayload(state.recipe,hash):services.questPayload(state.quest,hash), defaultName=type==="recipe"?state.recipe.name:state.quest.name, name=await inputValue(`Capture ${type}`,"Store the canonical definition as reusable content.","Library item name",defaultName);if(!name)return;state.content.unshift(services.normalizeContentItem({id:uid("content"),type,version:2,name,description:`${type} captured from ${api.projectInfo().name||"loose workspace"}`,payload:{[type]:source}},hash));persist();notify(`“${name}” added to your library.`,"success");if(state.view==="library")renderLibrary();}
    async function installContent(id) {
        const item = state.content.find(candidate => candidate.id === id); if (!item) throw new Error("Library item not found.");
        if (item.type === "recipe") { state.recipe = services.normalizeRecipe(item.payload?.recipe); state.worldTab = "recipes"; persist(); notify("Recipe loaded into World & Story for preview.", "success"); return switchView("world"); }
        if (item.type === "quest") { state.quest = services.normalizeQuest(item.payload?.quest); state.worldTab = "quests"; persist(); notify("Quest loaded into World & Story for validation.", "success"); return switchView("world"); }
        const source=item.payload?.map, current = await api.mapSnapshot(); if (!source)throw new Error("This content item has no map payload."); if (current.width !== source.width || current.height !== source.height) throw new Error(`This capture is ${source.width} × ${source.height}; the active map is ${current.width} × ${current.height}. Resize or choose a matching map first.`);
        if (!await confirmChange("Install this map capture?", `The active ${current.width} × ${current.height} map will be replaced after a recovery snapshot.`, "Install safely")) return;
        api.createSnapshot(`Before library install · ${item.name}`); await api.applyMapSnapshot(source, `Library install · ${item.name}`); await api.save(); await invalidateVerification("Library content installed"); notify(`“${item.name}” installed.`, "success");
    }
    async function importContentFile(event) {
        const file = event.target.files?.[0]; if (!file) return; const textValue=await file.text(), parsed = JSON.parse(textValue); await assertSchema(parsed,"HybridContentLibrary");
        const report=services.validateContentLibrary(parsed,{bytes:file.size||new Blob([textValue]).size,maxBytes:10*1024*1024,checksum:hash}); if(!report.ok)throw new Error(report.errors.join(" "));
        let added = 0; for (const item of report.items) if (!state.content.some(candidate => candidate.id === item.id)) { state.content.push(item); added++; }
        event.target.value = ""; persist(); notify(`${added} content item${added === 1 ? "" : "s"} imported and schema-validated.`, "success"); if (state.view === "library") renderLibrary();
    }
    async function loadPracticeProjectText() {
        const source = "examples/PracticeMap001.json";
        if (location.protocol === "file:") {
            return new Promise((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.open("GET", source, true);
                request.onload = () => request.responseText ? resolve(request.responseText) : reject(new Error("The bundled practice map is empty."));
                request.onerror = () => reject(new Error("The bundled practice map could not be read from this folder."));
                request.send();
            });
        }
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load the practice map (${response.status}).`);
        return response.text();
    }
    async function renderSettings() {
        browserStorageEstimate = storageService?.estimate ? await storageService.estimate() : browserStorageEstimate;
        const usageMb = (browserStorageEstimate.usage / 1048576).toFixed(browserStorageEstimate.usage >= 10485760 ? 0 : 1);
        const quotaMb = browserStorageEstimate.quota ? (browserStorageEstimate.quota / 1048576).toFixed(0) : "unknown";
        const storagePercent = browserStorageEstimate.quota ? Math.round(browserStorageEstimate.usage / browserStorageEstimate.quota * 100) : 0;
        $("v18Main").innerHTML = `${pageHead("CREATOR EXPERIENCE", "Make the tool fit the creator", "Modes change information density and workspace scope. Accessibility, guidance, recovery, sound, language, and controls remain independent.")}
        <section class="v18-settings-layout"><main>
          <small class="v18-eyebrow">WORKSPACE MODE</small>
          <div class="v18-mode-cards">${[["beginner","Beginner","Create, Test, Release","One recommended action at a time; specialist areas stay out of the way."],["guided","Guided","The complete creator path","Adds recipes, quests, content reuse, explanations, and budgets."],["expert","Expert","All workbenches","Adds lazy-loaded live, intelligence, extension, atlas, and performance consoles."]].map(([id,title,scope,copy]) => `<button data-v18-mode-choice="${id}" class="v18-mode-card ${state.mode === id ? "active" : ""}" aria-pressed="${state.mode===id}"><i>${state.mode === id ? "✓" : id === "beginner" ? "1" : id === "guided" ? "2" : "3"}</i><span><strong>${title}</strong><small>${scope}</small><p>${copy}</p></span></button>`).join("")}</div>
          <small class="v18-eyebrow">ACCESSIBILITY</small>
          ${settingToggle("highContrast", "High contrast", "Strengthen boundaries and text contrast.")}${settingToggle("colorBlind", "Color-independent status", "Add patterns and labels so status never relies on color alone.")}${settingToggle("largeText", "Large text", "Increase essential labels independently from workspace scale.")}${settingToggle("reducedMotion", "Reduce motion", "Disable nonessential transitions and movement.")}${settingToggle("sound", "Interface sounds", "Short confirmation tones; independent from motion.")}${settingToggle("controller", "Controller navigation", "Navigate and edit the map by gamepad.")}
          <label class="v18-setting-row"><span><strong>Interface scale</strong><small>Keep text comfortable from 90% to 175%.</small></span><input id="v18UiScale" type="range" min="0.9" max="1.75" step="0.05" value="${state.uiScale}"><b>${Math.round(state.uiScale * 100)}%</b></label>
          <label class="v18-setting-row"><span><strong>Sound volume</strong><small>Confirmation feedback from silent to full.</small></span><input id="v18SoundVolume" type="range" min="0" max="1" step="0.05" value="${state.soundVolume}"><b>${Math.round(state.soundVolume*100)}%</b></label>
          <label class="v18-setting-row"><span><strong>Language</strong><small>Locale-ready preference; English copy ships in this package.</small></span><select id="v18Locale"><option value="en" ${state.locale==="en"?"selected":""}>English</option></select></label>
          <small class="v18-eyebrow">GUIDANCE & RECOVERY</small>
          <label class="v18-setting-row"><span><strong>Pip guidance</strong><small>Show contextual help, only the first onboarding guide, or hide guide entry points.</small></span><select id="v18PipMode"><option value="contextual" ${state.pipMode==="contextual"?"selected":""}>Contextual</option><option value="first-run" ${state.pipMode==="first-run"?"selected":""}>First run only</option><option value="hidden" ${state.pipMode==="hidden"?"selected":""}>Hidden</option></select></label>
          <label class="v18-setting-row"><span><strong>Recovery retention</strong><small>Prune inactive project and browser drafts after this many days.</small></span><input id="v18RecoveryRetention" type="number" min="1" max="365" value="${state.recoveryRetentionDays}"><b>days</b></label>
          <article class="v18-storage-health"><span><strong>Browser recovery storage</strong><small>${usageMb} MB used of ${quotaMb} MB · ${browserStorageEstimate.persisted ? "persistent" : "best effort"} · ${escapeHtml(browserStorageEstimate.backend)}</small></span><b>${browserStorageEstimate.quota ? `${storagePercent}%` : "—"}</b></article>
        </main><aside class="v18-inspector">
          <small class="v18-section-label">CONTROLLER GLYPHS</small>
          <label class="v18-field"><span>Button layout</span><select id="v18ControllerLayout"><option value="auto" ${state.controllerLayout === "auto" ? "selected" : ""}>Auto detect</option><option value="xbox" ${state.controllerLayout === "xbox" ? "selected" : ""}>Xbox</option><option value="nintendo" ${state.controllerLayout === "nintendo" ? "selected" : ""}>Nintendo</option><option value="playstation" ${state.controllerLayout === "playstation" ? "selected" : ""}>PlayStation</option></select></label>
          <small class="v18-section-label">BUTTON MAPPING</small>${[["select","Select / paint"],["back","Back"],["undo","Undo"],["redo","Redo"],["previousArea","Previous area"],["nextArea","Next area"]].map(([id,label])=>`<label class="v18-field"><span>${label}</span><input type="number" min="0" max="31" data-v18-binding="${id}" value="${integer(state.controllerBindings[id])}"></label>`).join("")}
          <div class="v18-card"><strong>Creator-first principle</strong><p>Readable outcomes, forgiving reversal, useful feedback, and no false success. The interface uses original visual design and neutral product language.</p></div>
          <small class="v18-section-label">PROJECT BUDGETS</small>${[["maxMapCells","Maximum cells per map"],["maxEventsPerMap","Maximum events per map"],["maxWarnings","Warning review budget"],["targetFrameMs","Target frame milliseconds"],["maxRuntimeSaveKb","Runtime save kilobytes"]].map(([id,label]) => `<label class="v18-field"><span>${label}</span><input type="number" min="1" data-v18-budget="${id}" value="${state.budgets[id]}"></label>`).join("")}
        </aside></section>`;
        $("v18Main").querySelectorAll("[data-v18-mode-choice]").forEach(button => button.onclick = () => setMode(button.dataset.v18ModeChoice));
        $("v18Main").querySelectorAll("[data-v18-setting]").forEach(input => input.onchange = () => { state[input.dataset.v18Setting] = input.checked; persist(); applyExperience(); });
        $("v18UiScale").oninput = event => { state.uiScale = Number(event.target.value); persist(); applyExperience(); event.target.nextElementSibling.textContent = `${Math.round(state.uiScale * 100)}%`; };
        $("v18SoundVolume").oninput=event=>{state.soundVolume=Number(event.target.value);persist();event.target.nextElementSibling.textContent=`${Math.round(state.soundVolume*100)}%`;};
        $("v18Locale").onchange=event=>{state.locale=event.target.value;persist();applyExperience();};
        $("v18PipMode").onchange=event=>{state.pipMode=event.target.value;if(state.pipMode==="first-run")state.pipSeen=false;persist();applyExperience();};
        $("v18RecoveryRetention").onchange=event=>{state.recoveryRetentionDays=clamp(integer(event.target.value,30),1,365);event.target.value=state.recoveryRetentionDays;persist();pruneDraftRecoveries().catch(()=>[]);storageService?.prune?.("draft:",{maxEntries:24,maxAgeMs:state.recoveryRetentionDays*86400000}).catch(()=>[]);};
        $("v18ControllerLayout").onchange = event => { state.controllerLayout = event.target.value; persist(); updateControllerPrompts(); };
        $("v18Main").querySelectorAll("[data-v18-binding]").forEach(input=>input.onchange=()=>{state.controllerBindings[input.dataset.v18Binding]=clamp(integer(input.value),0,31);persist();});
        $("v18Main").querySelectorAll("[data-v18-budget]").forEach(input => input.onchange = () => { state.budgets[input.dataset.v18Budget] = Number(input.value); persist(); invalidateVerification("Project budgets changed"); });
    }
    function settingToggle(id, title, copy) { return `<label class="v18-setting-row"><span><strong>${title}</strong><small>${copy}</small></span><input type="checkbox" data-v18-setting="${id}" ${state[id] ? "checked" : ""}></label>`; }
    function applyExperience() {
        const root = document.documentElement;
        root.dataset.v18Mode = state.mode;
        root.dataset.v18Pip = state.pipMode;
        root.lang = state.locale || "en";
        root.classList.toggle("v18-high-contrast", !!state.highContrast);
        root.classList.toggle("v18-color-blind", !!state.colorBlind);
        root.classList.toggle("v18-large-text", !!state.largeText);
        root.classList.toggle("v18-reduced-motion", !!state.reducedMotion);
        root.style.setProperty("--v18-scale", String(clamp(Number(state.uiScale), .9, 1.75)));
        if ($("v18Help")) { $("v18Help").hidden = state.pipMode === "hidden"; $("v18Help").setAttribute("aria-hidden", String(state.pipMode === "hidden")); }
    }
    function setMode(mode) {
        if (!["beginner", "guided", "expert"].includes(mode)) return;
        state.mode = mode;
        if (mode === "beginner" && ["world", "library", "advanced"].includes(state.view)) state.view = "home";
        persist();
        applyExperience();
        if (state.view === "settings") {
            $("v18Main").querySelectorAll("[data-v18-mode-choice]").forEach(button => {
                const active = button.dataset.v18ModeChoice === mode;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
                const icon = button.querySelector("i");
                if (icon) icon.textContent = active ? "✓" : button.dataset.v18ModeChoice === "beginner" ? "1" : button.dataset.v18ModeChoice === "guided" ? "2" : "3";
            });
        } else render(state.view);
        notify(`${mode[0].toUpperCase() + mode.slice(1)} workspace active.`, "success");
    }
    function cycleMode() { const modes = ["beginner","guided","expert"]; setMode(modes[(modes.indexOf(state.mode) + 1) % modes.length]); }
    async function renderAdvanced() {
        $("v18Main").innerHTML = `${pageHead("EXPERT · ADVANCED WORKBENCHES", "Load specialist consoles only when needed", "The default app starts with a small modular shell. Legacy specialist modules remain available on demand.")}<section class="v18-advanced-grid">${[["atlas","◎","World atlas & map doctor","Map topology, logic, repair, and pack workbench."],["live","●","Live event console","Inspect events, tilesets, live state, and scenarios."],["intelligence","✦","Project intelligence","Search, performance, compatibility, and ship diagnostics."],["extensions","⬡","Extension review","Permissions and compatibility. Same-process callbacks are never described as isolated."],["benchmark","⌁","Benchmark laboratory","Focused job and benchmark tools from the specialist suite."]].map(([id,icon,title,copy]) => `<article class="v18-advanced-card"><i>${icon}</i><h2>${title}</h2><p>${copy}</p><button data-v18-action="open-workbench" data-workbench="${id}" class="v18-button v18-primary">Load workbench</button></article>`).join("")}</section><article class="v18-card"><strong>Startup budget</strong><p>v18 shell, core services, validation, recovery, and update services load first. Historical specialist scripts and stylesheets load only after an explicit Expert action.</p></article>`;
    }
    async function loadLegacyWorkbenches() {
        if (pwaService?.registration?.()?.waiting) throw new Error("A Worldsmith update is ready. Save the current draft and reload before loading specialist workbenches so versions cannot mix.");
        if (legacyPromise) return legacyPromise;
        legacyPromise = (async () => {
            await api.setExtensionData("product-v10", { ...api.getExtensionData("product-v10", {}), onboardingComplete:true });
            await api.setExtensionData("worldsmith-v13", { ...api.getExtensionData("worldsmith-v13", {}), onboarded:true });
            for (let version = 10; version <= 16; version++) { const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `HybridTileStudioV${version}.css`; document.head.append(link); }
            for (let version = 9; version <= 16; version++) await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = `HybridTileStudioV${version}.js`; script.onload = resolve; script.onerror = () => reject(new Error(`Could not load specialist module V${version}.`)); document.body.append(script); });
            for(const dialog of [...document.querySelectorAll("dialog[open]")].filter(item=>item.id!=="v18Studio"))dialog.close();
            notify("Expert workbenches loaded for this session.", "success");
        })(); return legacyPromise;
    }
    async function openWorkbench(name) {
        await loadLegacyWorkbenches(); if ($("v18Studio")?.open) $("v18Studio").close();
        if (name === "atlas") window.HybridTileStudioV13?.open("atlas");
        else if (name === "live") window.HybridTileStudioV14?.open("events");
        else if (name === "intelligence") window.HybridTileStudioV15?.open("intelligence");
        else if (name === "extensions") window.HybridTileStudioV15?.open("extensions");
        else window.HybridTileStudioV12?.openFeature("benchmarks");
        setTimeout(() => { const openDialogs = [...document.querySelectorAll("dialog[open]")].filter(dialog => dialog.id !== "v18Studio"); for (const dialog of openDialogs) dialog.addEventListener("close", () => { if (![...document.querySelectorAll("dialog[open]")].some(item => item.id !== "v18Studio")) { $("v18Studio").showModal(); render("advanced"); } }, { once: true }); }, 50);
    }

    async function undo() {
        if (state.view !== "create" || !mapHistory.length || !mapDraft) return;
        const item = mapHistory.pop();
        for (const change of item.changes) { mapDraft.data[change.index] = change.before; refreshDirtyIndex(change.index); }
        mapRedo.push(item);
        scheduleDraftRecovery(); scheduleMapDraw({ minimap: true }); updateMapActions(); tone("move");
    }
    async function redo() {
        if (state.view !== "create" || !mapRedo.length || !mapDraft) return;
        const item = mapRedo.pop();
        for (const change of item.changes) { mapDraft.data[change.index] = change.after; refreshDirtyIndex(change.index); }
        mapHistory.push(item);
        scheduleDraftRecovery(); scheduleMapDraw({ minimap: true }); updateMapActions(); tone("move");
    }
    async function runAction(action, element = null) {
        const routes = { "home-create":"create", "home-world":"world", "home-test":"test", "home-release":"release", "release-playtest":"test", "continue": state.view === "home" ? (!state.milestones.edited ? "create" : !state.milestones.generated ? "world" : !state.milestones.tested ? "test" : "release") : state.view };
        if (routes[action]) { if (action === "release-playtest") state.testTab = "journey"; return switchView(routes[action]); }
        if (action === "open-project") { if(mapDirty){if(!await confirmChange("Keep this draft and open another project?","The current map experiment will be written to recovery before the project picker opens.","Keep draft and continue"))return;await saveDraftRecoveryNow();} return api.openProject(); }
        if (action === "open-recent") { if(mapDirty){if(!await confirmChange("Keep this draft and open a recent project?","The current experiment will be written to recovery first.","Keep draft and continue"))return;await saveDraftRecoveryNow();} const path=element?.dataset.path;if(!path)throw new Error("Recent project path is unavailable.");return api.openNativeProject(path); }
        if (action === "practice-project") { if(mapDirty)await saveDraftRecoveryNow(); const textValue=await loadPracticeProjectText(); const file=new File([textValue],"Map001.json",{type:"application/json"}); await api.openMapFiles([file]); state.map.selectedId=api.state().activeMapId||1; state.milestones.opened=true; persist(); await resetMapDraft(); await render("home"); notify("Practice map opened. Nothing here can overwrite your project.","success"); return; }
        if (action === "toggle-tools" || action === "toggle-inspector") { const app=$("v18Main").querySelector(".v18-create"); if(!app)return; const name=action==="toggle-tools"?"tools-open":"inspector-open"; app.classList.toggle(name); app.classList.remove(name==="tools-open"?"inspector-open":"tools-open"); return; }
        if (action === "close-panes") { $("v18Main").querySelector(".v18-create")?.classList.remove("tools-open","inspector-open"); return; }
        if (action === "activate-update") { if(mapDirty)await saveDraftRecoveryNow(); const activated=await pwaService?.activateUpdate?.(); if(!activated)notify("The update is no longer waiting; refresh later to check again.","info"); return; }
        if (action === "open-maps") { if(mapDirty){if(!await confirmChange("Keep this draft and open map files?","The current map experiment will be written to recovery first.","Keep draft and continue"))return;await saveDraftRecoveryNow();} return $("mapFileInput").click(); }
        if (action === "guide") return openPip();
        if (action === "home-health") { state.testTab = "structural"; await switchView("test"); return runStructuralLab(); }
        if (action === "apply-map") return applyMapDraft();
        if (action === "discard-map") { if (mapDirty && !await confirmChange("Discard this map experiment?", `${mapChanges()} uncommitted tile changes and its recovery draft will be forgotten.`, "Discard experiment")) return; await clearDraftRecovery(mapId); mapDirty=false; mapDirtyIndices.clear(); await ensureMapDraft(true); return renderCreate(); }
        if(action==="palette-prev"||action==="palette-next"){const pages=Math.max(1,Math.ceil(paletteIds().length/64));state.map.palettePage=clamp(state.map.palettePage+(action==="palette-next"?1:-1),0,pages-1);persist();drawPalette();return;}
        if(action==="favorite-tile"){const id=state.map.tileId,index=state.map.favorites.indexOf(id);if(index>=0)state.map.favorites.splice(index,1);else state.map.favorites.unshift(id);persist();return renderCreate();}
        if(action==="copy-selection")return copyMapSelection();
        if(action==="paste-selection")return pasteMapSelection();
        if(action==="resolve-conflicts-current"){if(!mapConflicts)return;mapConflicts=null;rebuildDirtyIndices();scheduleDraftRecovery();notify("Project values kept for overlapping edits.","success");return renderCreate();}
        if(action==="resolve-conflicts-draft"){if(!mapConflicts)return;const dimension=mapConflicts.some(item=>item.type==="dimensions");if(dimension)throw new Error("The map dimensions changed. This draft cannot be safely overlaid; export or discard it.");for(const conflict of mapConflicts)if(conflict.type==="tile")mapDraft.data[conflict.index]=conflict.draft;mapConflicts=null;rebuildDirtyIndices();scheduleDraftRecovery();notify("Experiment values kept for overlapping edits.","success");return renderCreate();}
        if (action === "preview-recipe") return previewRecipe();
        if (action === "apply-recipe") return applyRecipePreview();
        if(action==="save-recipe")return saveRecipe();
        if(action==="export-recipe")return exportRecipe();
        if(action==="import-recipe")return $("v18RecipeImport").click();
        if(action==="recipe-template")return applyRecipeTemplate();
        if(action==="capture-recipe")return captureStructuredContent("recipe");
        if(action==="capture-quest")return captureStructuredContent("quest");
        if (action === "add-stage") { state.recipe.stages.push({ id: uid("stage"), type: "scatter", name: "New detail stage", layer: 2, tileA: 1, tileB: 0, density: .08, count: 20 }); recipePreview = null; persist(); return renderWorld(); }
        if (action === "remove-stage") { const index = integer(element?.dataset.index); if (state.recipe.stages.length <= 1) throw new Error("A recipe needs at least one stage."); state.recipe.stages.splice(index, 1); recipePreview = null; persist(); return renderWorld(); }
        if (action === "add-quest-node") { const id = `step-${state.quest.nodes.length + 1}`; state.quest.nodes.push({ id, type: "objective", title: "New objective", description: "Describe the player-visible goal.",conditions:[],rewards:[],rewardGold:0,targetMapId:0,targetX:0,targetY:0 }); selectedQuestNode=id; persist(); return renderQuestBuilder(); }
        if (action === "remove-quest-node") { const index=integer(element?.dataset.index), node=state.quest.nodes[index];if(!node)return;if(state.quest.nodes.length<=2)throw new Error("A quest needs at least a start and completion node.");state.quest.nodes.splice(index, 1);state.quest.edges=state.quest.edges.filter(edge=>edge.from!==node.id&&edge.to!==node.id);selectedQuestNode=state.quest.nodes[0]?.id; persist(); return renderQuestBuilder(); }
        if(action==="add-quest-edge"){const from=selectedQuestNode||state.quest.nodes[0]?.id,to=state.quest.nodes.find(node=>node.id!==from)?.id;if(from&&to)state.quest.edges.push({from,to,label:"",condition:null});persist();return renderQuestBuilder();}
        if(action==="remove-quest-edge"){state.quest.edges.splice(integer(element?.dataset.index),1);persist();return renderQuestBuilder();}
        if(action==="add-quest-cue"){state.quest.cues.push({id:uid("cue"),at:0,duration:1,track:"dialogue",type:"message",target:"",payload:{}});persist();return renderQuestBuilder();}
        if(action==="remove-quest-cue"){state.quest.cues.splice(integer(element?.dataset.index),1);persist();return renderQuestBuilder();}
        if (action === "save-quest") return saveQuest();
        if(action==="import-quest")return $("v18QuestImport").click();
        if (action === "export-quest") return api.download(`${safeId(state.quest.name)}.htgquest`, JSON.stringify(services.questPayload(state.quest,hash), null, 2), "application/json");
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
        if (action === "import-content") return $("v18ContentImport").click();
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
    function openPip(force = false) { if (state.pipMode === "hidden" && !force) return; const [title, copy] = guideCopy(); state.pipSeen = true; persist(); $("v18PipTitle").textContent = title; $("v18PipText").textContent = copy; $("v18Pip").showModal(); tone("open"); }
    function confirmChange(title, textValue, accept = "Continue") {
        const dialog = $("v18Confirm"); $("v18ConfirmTitle").textContent = title; $("v18ConfirmText").textContent = textValue; $("v18ConfirmAccept").textContent = accept;
        return new Promise(resolve => { const close = () => { dialog.removeEventListener("close", close); resolve(dialog.returnValue === "confirm"); }; dialog.addEventListener("close", close); dialog.showModal(); });
    }
    function inputValue(title,textValue,label,initial="") { const dialog=$("v18InputDialog"),input=$("v18InputValue");$("v18InputTitle").textContent=title;$("v18InputText").textContent=textValue;$("v18InputLabel").textContent=label;input.value=initial;return new Promise(resolve=>{const close=()=>{dialog.removeEventListener("close",close);resolve(dialog.returnValue==="confirm"?input.value.trim():"");};dialog.addEventListener("close",close);dialog.showModal();setTimeout(()=>{input.focus();input.select();},20);}); }
    function commands() {
        const entries = VIEWS.filter(item => item[3] !== "expert" || state.mode === "expert").filter(item => item[3] !== "guided" || state.mode !== "beginner").map(item => ({ id:`view:${item[0]}`, icon:item[2], title:`Go to ${item[1]}`, copy:`Open the ${item[1]} workspace` }));
        const actions=[{ id:"action:open-project", icon:"＋", title:"Open project", copy:"Choose an RPG Maker MZ project folder" },{ id:"action:practice-project", icon:"▦", title:"Open practice project", copy:"Learn without changing a real project" },{ id:"action:run-lab", icon:"✓", title:"Run structural lab", copy:"Scan every connected map" }];
        if(state.pipMode!=="hidden")actions.push({ id:"action:guide", icon:"?", title:"Ask Pip", copy:"Explain the current workspace" });
        return entries.concat(actions);
    }
    function openCommands() { $("v18CommandQuery").value = ""; renderCommands(); $("v18CommandPalette").showModal(); setTimeout(() => $("v18CommandQuery").focus(), 20); }
    function renderCommands() { const query = $("v18CommandQuery").value.toLowerCase(); const values = commands().filter(item => !query || `${item.title} ${item.copy}`.toLowerCase().includes(query)); $("v18CommandResults").innerHTML = values.map(item => `<button data-v18-command="${item.id}"><i>${item.icon}</i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.copy)}</small></span><kbd>↵</kbd></button>`).join("") || "<p>No matching command.</p>"; }
    async function executeCommand(command) { const [kind, value] = command.split(":"); if (kind === "view") return switchView(value); return runAction(value); }
    function notify(message, type = "info") { const host = $("v18Toasts"); if (!host) return; const toast = document.createElement("div"); toast.className = `v18-toast ${type}`; toast.innerHTML = `<i>${type === "error" ? "!" : type === "success" ? "✓" : type === "warning" ? "△" : "i"}</i><span>${escapeHtml(message)}</span>`; host.append(toast); setTimeout(() => toast.remove(), state.reducedMotion ? 5000 : 4200); tone(type === "error" ? "error" : type === "success" ? "success" : "move"); }
    function tone(kind) {
        if (!state.sound || !state.soundVolume || !window.AudioContext) return; try { const context = tone.context ||= new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(), notes = { move: 330, open: 440, success: 660, error: 180 }; oscillator.frequency.value = notes[kind] || 330; gain.gain.setValueAtTime(.05*state.soundVolume, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .08); } catch (_) { /* audio is optional */ }
    }
    function handleKeys(event) {
        if(!$("v18Studio")?.open)return;
        if (event.ctrlKey && event.key.toLowerCase() === "k") { event.preventDefault(); return openCommands(); }
        if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
        if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault();event.stopImmediatePropagation();return redo(); }
        if (event.key === "Escape" && $("v18CommandPalette")?.open) return $("v18CommandPalette").close();
        if (state.view === "create" && mapDraft && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(event.key) && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
            event.preventDefault();event.stopImmediatePropagation(); if (event.key === "ArrowUp") state.map.cursorY--; if (event.key === "ArrowDown") state.map.cursorY++; if (event.key === "ArrowLeft") state.map.cursorX--; if (event.key === "ArrowRight") state.map.cursorX++; state.map.cursorX = clamp(state.map.cursorX, 0, mapDraft.width - 1); state.map.cursorY = clamp(state.map.cursorY, 0, mapDraft.height - 1); if (event.key === " ") performOneShotMapTool({ x:state.map.cursorX, y:state.map.cursorY }); drawMapCanvas();
        }
    }
    function controllerButtons(gamepad) { const nintendo = state.controllerLayout === "nintendo" || (state.controllerLayout === "auto" && /nintendo|switch|joy-con/i.test(gamepad?.id || "")); return { select: nintendo ? 1 : 0, back: nintendo ? 0 : 1, label: nintendo ? "Nintendo" : state.controllerLayout === "playstation" ? "PlayStation" : "Standard" }; }
    function updateControllerPrompts(gamepad = null) { const layout = controllerButtons(gamepad); if ($("v18ControllerPrompt")) $("v18ControllerPrompt").textContent = state.controller && gamepad ? `${layout.label} controller connected` : state.controller ? "Controller ready" : "Controller off"; if ($("v18SelectGlyph")) $("v18SelectGlyph").textContent = layout.select === 1 ? "A" : state.controllerLayout === "playstation" ? "×" : "A"; if ($("v18BackGlyph")) $("v18BackGlyph").textContent = layout.back === 0 && layout.label === "Nintendo" ? "B" : state.controllerLayout === "playstation" ? "○" : "B"; }
    function pollGamepad() {
        if (!state.controller) { gamepadLoop = requestAnimationFrame(pollGamepad); return; }
        const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean); updateControllerPrompts(gamepad);
        if (gamepad) { const layout = controllerButtons(gamepad), bindings=state.controllerBindings, pressed = index => !!gamepad.buttons[index]?.pressed, edge = index => pressed(index) && !lastGamepad[index], canvasActive=state.view==="create"&&mapDraft&&document.activeElement?.id==="v18MapCanvas"; if(canvasActive){if(edge(12))state.map.cursorY--;if(edge(13))state.map.cursorY++;if(edge(14))state.map.cursorX--;if(edge(15))state.map.cursorX++;state.map.cursorX=clamp(state.map.cursorX,0,mapDraft.width-1);state.map.cursorY=clamp(state.map.cursorY,0,mapDraft.height-1);if(edge(bindings.select??layout.select))performOneShotMapTool({x:state.map.cursorX,y:state.map.cursorY});if(edge(12)||edge(13)||edge(14)||edge(15))drawMapCanvas();}else{if(edge(12))focusRelative("up");if(edge(13))focusRelative("down");if(edge(14))focusRelative("left");if(edge(15))focusRelative("right");if(edge(bindings.select??layout.select))document.activeElement?.click?.();}if(edge(bindings.undo))undo();if(edge(bindings.redo))redo();if(edge(bindings.previousArea))cycleArea(-1);if(edge(bindings.nextArea))cycleArea(1); if (edge(bindings.back??layout.back)) { const open = [...document.querySelectorAll("dialog[open]")].at(-1); if (open && open.id !== "v18Studio") open.close(); } lastGamepad = Object.fromEntries(gamepad.buttons.map((_, index) => [index, pressed(index)])); }
        gamepadLoop = requestAnimationFrame(pollGamepad);
    }
    function focusRelative(direction) { const items = [...$("v18Studio").querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),canvas[tabindex]")].filter(item => item.offsetParent !== null); if (!items.length) return; const target=services.spatialNext(items,document.activeElement,direction)||items[0];target.focus();tone("move"); }
    function cycleArea(delta){const visible=VIEWS.filter(item=>item[3]==="beginner"||item[3]==="guided"&&state.mode!=="beginner"||item[3]==="expert"&&state.mode==="expert"),index=Math.max(0,visible.findIndex(item=>item[0]===state.view));switchView(visible[(index+delta+visible.length)%visible.length][0]);}
    async function loadProjectData() {
        currentFingerprint = await projectFingerprint();
        await Promise.all([loadRecentProjects(), storageService?.estimate?.().then(value => { browserStorageEstimate=value; }).catch(()=>null), pruneDraftRecoveries().catch(()=>[])]);
    }

    window.HybridTileStudioV18 = Object.freeze({
        version: VERSION,
        open: view => { if (!$("v18Studio").open) $("v18Studio").showModal(); return render(view || state.view); },
        close: () => $("v18Studio").close(), switchView, runStructuralLab, releaseAssessment, projectFingerprint, projectFingerprintDetails,
        previewRecipe, validateQuest, applyMapDraft, saveDraftRecoveryNow, undo, redo,
        state: () => clone(state), mapDraft: () => clone(mapDraft), mapHistory: () => clone(mapHistory),
        recoveryStatus: () => clone(recoveryStatus), performanceMetrics: () => clone(mapPerformance)
    });
    inject();
})();
