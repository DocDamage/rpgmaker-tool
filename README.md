# HybridTileGraft + Hybrid Tile Studio v18.1.0

This package contains an RPG Maker MZ plugin and a connected multi-map desktop editor. It independently combines exact/reconnecting tile grafting, whole-map transforms, Tile Control-style tile codes, runtime editing, visual event authoring, procedural generation, non-destructive layers, recovery, collaboration, and declarative World Recipes.

It is not affiliated with VisuStella or Ritter and contains no proprietary code from their plugins. The Tyruswoo-derived tile-code/autotile portions retain their MIT notice in `HybridTileGraft.js`.

## Install the plugin

1. Back up the RPG Maker project.
2. Copy `HybridTileGraft.js` into `PROJECT/js/plugins/`.
3. Add or replace it in RPG Maker MZ's Plugin Manager.
4. Reopen the entry so all v18 parameters and the curated command list are loaded.
5. Test a new game and a migrated save in playtest.

The v18 save schema migrates prior HybridTileGraft data in place and writes a lean runtime payload that omits authoring drafts, reports, history, and UI state. Keep a backup and test both a new game and a migrated save.

World Recipes are optional. Create them in the Studio's **Recipes** panel; saving writes `data/HybridWorldRecipes.json`, which the runtime plugin loads automatically when present. See `WORLD_RECIPES.md` and `examples/HybridWorldRecipes.json`. Reusable content can be distributed as `.htgworld` World Packs or searchable `.htgcatalog` catalogs; validated starters for both are under `examples/`.

## Run Hybrid Tile Studio

- Browser/PWA: serve this directory over localhost and open `HybridTileStudio.html` in current Chrome or Edge.
- Electron desktop: run `npm install`, then `npm start`.
- NW.js: rename/copy `package.nw.json` to `package.json` in an NW.js copy of this folder, then run `nw .`.

The packaged Electron bridge uses atomic temporary-file replacement for project writes and records recent-project/recovery health. Project-backed recovery is written before the browser mirror. The browser build uses IndexedDB for map payloads and retains `localStorage` only for small preferences and one-time legacy migration.

## v18.1 stabilization and scale

- **Reliable Apply state:** paint, erase, fill, rectangle, paste, undo, redo, generation, merge, and recovery all update the Apply/Revert controls from one authoritative dirty-tile set.
- **Delta-only history and recovery:** strokes store changed tile indices instead of cloning whole maps. Project recovery is attempted first, IndexedDB mirrors it for browser resilience, and quota/write failures are reported rather than silently ignored.
- **Large-map editing:** viewport culling, animation-frame batching, throttled minimaps, worker-backed complete flood fill, and deterministic worker generation keep 250,000-cell budgets practical.
- **Responsive workspaces:** Create uses Tool and Inspector drawers below 1180 px; Test, Release, and Settings use purpose-built two-column layouts and collapse cleanly at 960 px.
- **Stronger integrity:** canonical SHA-256 fingerprints, Ed25519 pack verification, executable JSON Schemas, content-hashed PWA assets, and explicit legacy-FNV compatibility replace ambiguous trust signals.
- **Safer updates and releases:** the PWA no longer activates a new shell in the middle of an editing session, and release evidence remains bound to the exact canonical project fingerprint.
- **Maintainable source:** the shipped RPG Maker plugin is still one file, but it is generated from named runtime parts; active Studio and desktop adapters live under `src/`, while v17 is retained only as a migration fixture.
- **Contracted integrations:** one generated capability catalog now drives the runtime, extension schema, and SDK documentation; the generated public-API inventory and TypeScript declarations classify every exported name by stability.
- **Observable plugin commands:** every Plugin Manager command publishes a structured success or failure result. Projects may read it through the public API or configure a result variable, success/failure switches, and a failure common event.
- **Measured engine compatibility:** retained official-core evidence covers the minimum supported MZ 1.8.0 core and current 1.10.0 core, including an actual save/reset/load cycle, temporary-save cleanup, frame timing, and a bounded world benchmark.
- **Complete first-run flow:** Open Project, Open Recent, and Practice Project are visible from Home; the six-step journey, Pip behavior, recovery retention, storage health, and semantic tile search are configurable and inspectable.

See `V18_1_STABILITY_AND_SCALE.md` and `IMPLEMENTATION_REPORT.md` for the implementation map. Generated integration contracts are in `PUBLIC_API.md`, `HybridTileGraft.api.json`, `HybridTileGraft.d.ts`, `EXTENSION_CAPABILITIES.md`, and `ENGINE_COMPATIBILITY.md`.

## v18 product foundation

- **One default product surface:** startup loads the core, v18 format services, and the v18 Worldsmith shell. Historical specialist consoles load only after an explicit Expert action.
- **Recoverable creation:** map experiments persist as `.htgmapdraft`, rebase over outside changes, preserve events, and expose tile conflicts before applying.
- **Complete MZ palette:** B–E plus A1–A5 ranges, paging, ID filtering, eyedropper, selection copy/paste, pan, minimap, and diagnostic overlays.
- **Canonical creative formats:** recipe graphs, branching quests/cutscene cues, content libraries, and release manifests use documented version-2 payloads.
- **Honest release policy:** fingerprints bind maps, content, budgets, extension manifests, trust decisions, and policy version. Warning and static performance failures block release.
- **Accessible control:** 90–175% scaling, large text, high contrast, color-independent status, volume control, spatial gamepad focus, remapping, and canvas editing.
- **Real creator modes:** Beginner exposes Create, Test, Release, and Settings; Guided adds recipes, quests, and reusable content; Expert adds specialist workbenches.
- **Honest preview-first creation:** map painting and deterministic recipe generation operate on local drafts. Apply creates a named recovery snapshot and performs one explicit save.
- **Connected story work:** the quest builder validates missing targets and unreachable nodes before saving a portable definition.
- **Fingerprint-bound evidence:** lab results, real-playtest attestations, checkpoints, extension review, content dependencies, and release records all bind to the exact current project state. Old evidence becomes `STALE`.
- **No pretend automation:** launching a game is not recorded as a playtest pass; static analysis does not claim runtime frame-rate or save-size verification; a release record does not claim deployment.
- **Smaller everyday surface:** RPG Maker's Plugin Manager shows 26 high-value commands while all existing command registrations and public APIs remain compatible for established projects.
- **Lean saves and clearer trust:** runtime saves exclude authoring-only bulk. Legacy same-process extension callbacks are explicitly labeled a reliability budget—not a security sandbox.
- **Desktop hardening:** Electron now uses renderer sandboxing, denied popup/navigation/permission requests, context isolation, and a restrictive content security policy.

See `V18_FIRST_PARTY_RELEASE.md` for the product contract, upgrade notes, and verification model. See `AUTOMATED_TESTING.md` for the generated-source, integration, migration, and real-browser verification commands.

## v16 foundation

- **Worldsmith** is the new complete creator surface: Dashboard, Map Studio, World Recipes, Quests & Cutscenes, Playtest Lab, Experience, Content Library, Team & Git, Extensions, and Production.
- **Map Studio** paints real six-layer RPG Maker map snapshots with paint, erase, fill, rectangle, selection, zoom, regions, events, undo/redo, structural round-trip analysis, pre-commit snapshots, and reversible authoring-layer application.
- **Node-based World Recipes** compile seeded terrain, biome, coast, river, road, settlement, dungeon, interior, decoration, and validation stages. Placement constraints and locked authored cells survive regeneration.
- **Quest and cutscene authoring** adds connected objectives, choices, dialogue, rewards, transfers, completion/failure paths, unreachable-node checks, and timed camera/dialogue/movement/audio/screen cues.
- **Playtest Laboratory** combines real-game launch, all-map structural scans, journeys, golden states, event fuzz checks, save-migration intent, performance budgets, CI manifests, and reproducible `.htgbug` reports.
- **Creator Experience** provides Beginner, Guided, and Expert modes plus high contrast, large text, reduced motion, original interface tones, controller navigation, responsive layouts, and visible focus.
- **Content Library** captures and versions maps and other creator content, tracks dependencies/tags/favorites/checksums, exports `.htgcontent`, and installs map content through reversible layers.
- **Team and extension systems** add canonical source snapshots, path-aware three-way merge, review bundles, project-scoped Git, explicit extension capabilities, isolation, budgets, policy review, and quarantine-compatible runtime controls.
- **Production Dashboard** scores project integrity, references, density, tests, checkpoints, content, and extensions before generating a reproducible v2 release manifest.
- Runtime save schema is v16 with 196 matched Plugin Manager commands. Eight new portable schemas, three starter examples, CLI Worldsmith validation, desktop file associations, offline caching, and expanded tests are included.

Start with `WORLDSMITH.md`, then see `CREATOR_CONSOLE.md`, `WORLD_RECIPES.md`, `AUTOMATED_TESTING.md`, `LIVE_PRODUCTION.md`, and `RELEASE_ENGINEERING.md`.

## v15 foundation

- **Creator Console** is the new default production surface: eleven focused areas, a clear guided/expert switch, global command search, controller and keyboard parity, three themes, scalable UI, reduced motion, visible focus, notifications, and an original contextual creator guide.
- **No-JSON Visual Event Designer** covers the full RPG Maker MZ event-command catalog, structured movement routes, plugin-command metadata, page conditions, drag ordering, direct parameter controls, validation, opaque third-party preservation, and reversible map-layer application.
- **Visual Tileset Workshop** renders the actual tile banks, paints native passage/special/terrain flags, inspects project sheets, adds semantic meaning, audits suspicious combinations, keeps unsaved working copies stable, and writes `Tilesets.json` through a backup transaction.
- **Live Production 2.0** adds a versioned handshake, session token, heartbeat, sequence and acknowledgements, bounded logs, capability negotiation, deterministic commands, diagnostics, recording, recovery requests, and deliberate stale-artifact cleanup.
- **Automated Player Journeys** record/replay movement, interaction, transfer, choice, wait, state, recipe, and assertion steps. Golden maps and project validation can run together from the Studio or the bundled read-only `HybridTileStudioCLI.js` runner.
- **Universal safety** combines reversible event layers, atomic project writes, interrupted-write journals, universal multi-file restore points, session undo/redo, explicit two-step restore, and recovery manifests.
- **Project intelligence** searches maps/events/commands/content, previews exact reference renames, analyzes native passage flags and semantic tiles, detects disconnected transfers, one-way passage and autorun risks, and profiles map/event/command/save complexity.
- **Extension security and compatibility** add manifest Worker probes, explicit project-path/network budgets, failure history, quarantine, local publisher trust, compatibility profiles, and public-API/plugin-order checks.
- **Team and release engineering** compare review bundles, export non-applying merge plans, show canonical Git diffs, compare release fingerprints, gate production handoffs, export signing/update manifests, and produce clean bundles with authoring-only artifacts excluded.
- Runtime save schema is v15 with 176 matched Plugin Manager command registrations. Portable v15 schemas, a practice map, CI manifest support, and expanded runtime/DOM/CLI tests are included.

The v15 Creator Console remains available as the detailed event, tileset, Live Production, intelligence, performance, compatibility, and release workbench beneath Worldsmith.

## v14 foundation

- **Live Production Console** adds a nine-area, controller-friendly workflow for Home, Live, Events, Tilesets, Tests, Intelligence, Library, Team, and Ship. Guided and Expert modes, spatial focus, responsive layouts, a command palette, an activity center, and contextual guidance keep advanced tools approachable.
- **Live playtest bridge** launches or attaches to a local RPG Maker playtest, watches chosen switches and variables, sends state/transfer/recipe commands, requests runtime restore points, and hot-reloads World Recipes through bounded project-local JSON files.
- **Visual Event Designer** round-trips every standard RPG Maker MZ event-command code, edits pages and commands as a tree, validates branch structure, and preserves unknown third-party commands as opaque data.
- **Tileset Studio and Map Intelligence** audit tileset assets/flags, save with timestamped backups, attach reusable semantic labels to tiles, detect world features and unreachable landmarks, and visualize reachability without replacing RPG Maker's native formats.
- **Playtest Recorder and Scenario Lab** capture meaningful runtime actions, convert recordings into deterministic `.htgscenario` tests, compare golden-map baselines, and export portable `.htgrecording` artifacts.
- **Unified Content Library and Extension Sandbox** search recipes, prefabs, graphs, packs, brushes, templates, and catalogs together. Extension contributions receive explicit time/payload budgets, failure history, and quarantine controls.
- **Team and Ship** add portable `.htgreview` bundles, visual branch/review status, clean `.htgrelease` exports, reproducible `.htgfingerprint` release identities, and cross-platform desktop build manifests.
- The runtime now exposes 155 matched Plugin Manager commands and public APIs, with save schema v14, live-session history, recordings/scenarios, semantic tilesets, sandbox policy, collections, collaboration bundles, and release fingerprints.

See `LIVE_PRODUCTION.md`, `RELEASE_ENGINEERING.md`, and the schemas/examples folders for the new portable formats.

## v13 foundation

- **Worldstudio** is a new original full-screen authoring suite with nine focused tools and Beginner/Expert modes. It builds on the friendly five-hub shell without copying another company’s branding or product assets.
- **World Canvas** directly renders and edits RPG Maker MZ tile layers, shadows, regions, events, collision overlays, selections, fills, lines, rectangles, zoom, minimap navigation, and baseline comparison. Each stroke is committed as a reversible authoring layer.
- **World Atlas** scans every map and Transfer Player command, draws connected maps, identifies missing and disconnected destinations, opens maps directly, and exports a portable atlas report.
- **Logic & Quest Graph** traces event pages, conditions, switches, variables, self switches, common events, transfers, and World Recipe links with search and connection inspection.
- **NPC Director** provides a visual day timeline, route/activity blocks, world-minute simulation, congestion detection, and schedule export.
- **Map Doctor** detects structural tile-data faults, invalid event positions, broken transfers, and high-confidence ground holes; approved repairs are previewed and applied in one reversible layer.
- **History & Recovery** combines named persistent snapshots, session baselines, tile/event comparisons, branches, journals, and configurable retention.
- **Packs & Catalogs** now resolve semantic-version ranges and install order, show capability/permission manifests, preview ownership, and support schema v4 atlas, quest-graph, repair, and extension contributions.
- The **Extension SDK** adds a JSON Schema, declarative contributions, explicit capability grants, runtime permission contexts, example manifests, and a safe manifest workbench.
- **Build for Release** can back up and install/update the runtime plugin, enable it in `plugins.js`, scan the project, create a playtest checklist, and export a canonical deployment report.
- Runtime APIs add atlas and event-graph analysis, intelligent map repair, visual-history checksums/diffs, NPC Director simulation, dependency resolution, permissioned extension contexts, golden-map tests, production validation, and deployment reports.

## v12 foundation

- A new original console-style shell organizes the Studio into five result-first hubs: **Create, World, Test, Share, and Settings**. The full expert editors remain one selection away.
- Complete keyboard and controller navigation with spatial focus, A/B/X/Y prompts, hub shoulder navigation, optional vibration, original synthesized feedback sounds, high contrast, larger text, reduced motion, and light/dark themes.
- **Pip**, an original map-making guide character, provides contextual help, task selection, safe previews, and a friendly three-step **Make Something** journey.
- Guided graft, whole-map transform, NPC journey, World Recipe, biome graph, and World Pack workflows perform real reversible editor writes or explicit catalog updates.
- NPC travel routes use timed waypoint interpolation, live occupancy, arrival state, route previews, schedule coordination, and World Recipe activity triggers.
- Advanced Rule Brushes add reusable circle, rectangle, square, and line presets; hardness, smooth/linear/quadratic falloff; weighted cells; filtering; and layer statistics.
- Procedural graph stage caches and locked cells speed iteration and preserve hand-authored map details during graph regeneration.
- Recipe debugger watches, debug history, condition explanation, breakpoints, and safe single-action planning/stepping are available through public runtime APIs and the Test hub.
- Project Reference Graph, benchmark history, background Job Center, activity log, project stages, Smart Tile Browser, contextual map drawers, and expanded recovery make large projects easier to navigate.
- World Packs now include NPC routes and rule brushes, integrity digests, local publisher trust metadata, subscriptions, version checking, schema v3, and an explicit distinction between integrity checking and cryptographic authorship.

## v11 foundation

- A new **World Workshop** keeps advanced systems easy to find without crowding the primary Home, Map, Events, World, Create, Packs, Test, and Ship navigation.
- A non-mutating World Simulator with a time scrubber predicts NPC activity changes, resource respawns, and scheduled recipes before the clock is committed.
- A complete NPC Life Designer for homes, jobs, relationships, tags, daily/overnight schedules, weekdays, seasons, map positions, and activity-change recipes.
- Visual Rule Painting stores non-destructive, map-aware gameplay layers and compiles painted cells into typed World Recipe conditions.
- A deterministic Biome Composer runs dependency-checked climate, biome, road, river, dungeon, WFC, scatter, rule, and extension stages inside recoverable transactions.
- Connected-map transforms repair event positions, facing, movement routes, and Transfer Player destinations. Advanced grafting copies chosen tile, shadow, region, and event layers into a reversible authoring layer.
- World Pack lifecycle ownership: capability approval, semantic upgrades/downgrades, dependency lockfiles, safe uninstall, and targeted rollback.
- A compatibility scanner for public plugin order, automatic Workshop recovery snapshots, runtime budgets, spatial zone indexes, metadata optimization, performance heatmaps, content catalogs, accessibility controls, and desktop update UI.
- Importable/exportable `.htgcatalog` libraries with payload validation, desktop file association, safe project-local storage, and a documented JSON Schema.
- A typed draggable Recipe graph adds nested logic groups and map-selection condition picking while retaining the friendly `WHEN → IF → THEN` builder.

## v10 foundation

- A redesigned task-first interface with Home, Map, Events, World, Create, Packs, Test, and Ship workspaces; Simple/Pro modes; command search; guided onboarding; help; larger targets; keyboard focus; and controller navigation.
- A visual `WHEN → IF → THEN` Recipe canvas, friendly block builder, plain-language decision explainer, debug timeline, breakpoints, recipe map overlays, and playtest hot reload through the local bridge.
- Persistent world time, calendar days, seasons, named zones, facts, settlements/regions, renewable resources, scheduled/repeating recipes, and alternate map variants.
- World Packs (`.htgworld`) with dependency and conflict checks, version metadata, recipe/world-system bundling, import/export, and JSON Schema.
- Scenario authoring plus runtime rollback tests, recipe performance profiles, trace replay, release-readiness checks, and an editor-data-free production bundle.

- Visual World Recipe authoring with triggers, nested conditions, ordered actions, templates, validation, import/export, and selection-aware dry-run simulation.
- Runtime map-enter, player-step, interval, switch, variable, tile, state, manual, and custom triggers.
- Persistent world state, enable overrides, cooldowns, run-once/max-run limits, execution logs, diagnostics, recursion protection, and no arbitrary JavaScript evaluation.
- Built-in actions for switches, variables, self switches, state, common events, tiles, regions, area fills/clears, prefabs, weather, tint, checkpoints, messages, recipe chaining, and MZ plugin commands.

- Exact RPG Maker MZ quadrant rendering for A1-A4 animated autotiles, table tiles, A5, and B-E.
- Rectangle, lasso, polygon, connected-value wand, and region selections.
- Six-layer/event clipboard with rotation, mirroring, cross-map paste, fresh event IDs, and transformed directions/routes.
- Command-specific visual event editing for text, choices, conditions, switches, variables, inventory, party, transfers, movement, animation, balloons, battles, scripts, and MZ plugin commands.
- Importable event templates and versioned visual prefab catalogs with dependencies, parameters, variants, linked instances, previews, and placement rules.
- Learned, weighted, bounded backtracking WFC; multi-layer background WFC; transitions; river networks; progression layouts; generator graphs; masks; and diagnostics.
- Project dependency audit for maps, transfers, common events, switches, variables, tilesets, and MZ plugin commands.
- Recoverable multi-map transactions, atomic desktop writes, transaction backups, and rollback/recovery UI.
- Workspace branches, merge layers, threaded cell/event reviews with replies/status/attachments, canonical JSON, and a desktop Git workspace.
- Compatibility lab with plugin-stack detection, exact renderer checks, structural audits, and exportable diagnostics.
- Recovery browser with preview/selective layer restore, snapshots, retention policy, and scheduled snapshots.
- Asset/dependency auditing, case-collision and unused-asset reports, safe reference-aware renames, and tileset-flag editing with backups.
- Recent desktop projects, registered Studio file types, optional auto-update UI, signed-installer hooks, Playwright coverage, localization, onboarding, high contrast, reduced motion, and visible keyboard focus.
- Adaptive viewport/minimap rendering and Web Worker project search/WFC for large maps.

## Production workflow

1. Open the project from **Home**, then visit **Workshop → Project Care** for compatibility and recovery.
2. Design NPC lives, painted rules, recipes, and procedural graphs in the Workshop.
3. Scrub the World Simulator and run Test Lab scenarios before committing time or generated content.
4. Preview connected-map transforms and grafts; inspect their authoring layers before Save All.
5. Install reusable content through World Packs or the Content Library; keep the generated pack lockfile.
6. Run **Ship → Run full checkup**, inspect canonical Git changes, and build the stripped production bundle.

## Extension API

Load extension scripts after `HybridTileStudio.js`. Extensions can register validators, generators, and point-producing brushes through `window.HybridTileStudio`. See `extensions/example-extension.js`.

The in-engine plugin exposes matching project transactions, branches, review comments and threads, learned rule sets and WFC diagnostics, dependency auditing, recovery/preferences, compatibility and asset histories, canonical exports, production handoffs, and extension registries on `window.HybridTileGraft`.

World Recipe extensions can register new safe condition and action handlers through `registerWorldRecipeCondition(type, handler)` and `registerWorldRecipeAction(type, handler)`.

Use `EXTENSION_CAPABILITIES.md` as the canonical capability reference; it is generated from the same source as runtime enforcement and `schemas/HybridStudioExtension.schema.json`. Use `PUBLIC_API.md` and `HybridTileGraft.d.ts` for the generated in-engine API contract.

Plugin Manager commands publish `HybridTileGraftCommandResult` records. Configure **Command Result JSON Variable**, **Command Success Switch**, **Command Failure Switch**, and **Command Failure Common Event** globally, or inspect `HybridTileGraft.lastCommandResult()` and subscribe with `HybridTileGraft.onCommandResult(listener)`.

## Test

```sh
npm install
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

The integration suite covers the runtime plugin, generated contracts, Studio DOM, exact tile addressing, persistence migration, transactions, reviews, generators, worker WFC, and the retained RPG Maker engine matrix. Playwright covers full browser workflows and keyboard focus.

## Safety

Keep source control or external backups. Review generated layers before saving. The project transaction system is designed to recover interrupted writes, but it is not a substitute for a repository or a full project backup.

## Build desktop packages

See `BUILD_DESKTOP.md`. macOS signing/notarization and Windows code signing require your own credentials.
