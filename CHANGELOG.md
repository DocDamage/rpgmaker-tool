# Changelog

## 18.1.0 — 2026-07-18

### Fixed

- Apply/Revert controls now refresh immediately after every map mutation, including paint, erase, fill, rectangle, paste, undo/redo, generation, recovery, and merge.
- Settings, Release, and Test no longer inherit World’s three-column grid; Create exposes usable Tools and Inspector drawers at narrow desktop widths.
- Flood fill no longer silently truncates or overruns its queue on large connected regions. A configured operation cap now returns an explicit error.
- The Home journey now displays all six milestones consistently, and mode cards no longer compress their title and explanation into one line.

### Changed

- Replaced full-map undo snapshots with per-operation tile deltas and a single transaction per pointer gesture.
- Replaced map-payload `localStorage` persistence with project-first atomic recovery plus an IndexedDB browser mirror, retention controls, health reporting, and legacy migration.
- Added viewport culling, dirty-region redraw scheduling, minimap throttling, worker flood fill, and deterministic worker generation.
- Added canonical SHA-256 project/release fingerprints and asynchronous Ed25519 world-pack signature verification while preserving explicitly labeled legacy FNV support.
- Made the bundled JSON Schemas executable for imports, recovery records, release manifests, extensions, examples, and CLI checks.
- Split the authored runtime into named `src/runtime/parts` and generated the compatible single-file `HybridTileGraft.js` deliverable. Active Studio and desktop adapters are generated from `src/studio` and `src/desktop`.
- Moved v17 Studio assets out of production and into migration fixtures. Historical v9–v16 specialist workbenches remain explicit Expert-only modules.
- Added content-hashed PWA asset verification and an explicit reload-to-update flow instead of immediate `skipWaiting` activation.
- Added Open Recent, Practice Project, Pip behavior, recovery retention/storage health, and semantic tile labels/search.
- Unified extension capability declarations behind one generated contract shared by runtime enforcement, the extension JSON Schema, and SDK documentation.
- Formalized all 540 public runtime exports in a generated stability inventory and matching TypeScript declaration file.
- Added structured success/failure results for every Plugin Manager command, including optional variable, switch, common-event, and listener outputs.
- Reworked breadth-first runtime traversals to use indexed queues so large operations no longer pay repeated array-shift costs.

### Verification

- Added end-to-end DOM coverage for paint → delta recovery → undo/redo → Apply → persisted reload.
- Added 250×250 viewport-culling, 120,000-cell flood-fill, recovery failure/fallback, v17 migration, schema/example, asset-manifest, Ed25519 tamper, Electron atomic-write/security, and CLI SHA tests.
- Added an HTTP-served Playwright suite with service-worker and responsive viewport journeys. See `TEST_REPORT.md` for the execution record of this source archive.
- Added ESLint to the release gate, generated-contract drift tests, and an official-core RPG Maker MZ 1.8.0/1.10.0 matrix with real save/reset/load persistence, cleanup, frame timing, and benchmark evidence.

## 18.0.0 — 2026-07-18

- Added project-scoped Worldsmith state rehydration and canonical state persistence; v17 metadata migrates on first use.
- Added crash-recoverable map drafts, guarded map switching, stale-baseline detection, event-preserving three-way merge, and explicit conflict resolution.
- Expanded Map Studio to all MZ A1–A5/B–E tile ranges, paging/filtering, pick/select/pan, copy/paste, minimap, layer visibility, and events/regions/shadows/collision/change overlays.
- Replaced private recipe, quest, and content shapes with documented v2 canonical formats; added graph save/import/export, branching quest edges, rewards/transfers, and cutscene cues.
- Bound verification fingerprints to budgets, policy version, content hashes, and extension manifests; warning/static performance failures and incomplete checkpoints now block release.
- Added semantic-versioned `.htgrelease` manifests with exact evidence states and no false “skipped” labels.
- Added 90–175% scaling, large-text, high-contrast, color-independent status, volume, locale readiness, remappable gamepad controls, spatial focus, and canvas editing.
- Hardened Electron navigation, project-root destructive actions, webview attachment, and Git argument handling.
- Fixed repaired runtime stores being downgraded to schema 11; runtime schema is now 18.
- Added v18 format/merge/navigation regression tests and updated consolidated DOM/E2E coverage.

## 17.0.0 — 2026-07-17

- Consolidated the default Studio into one original Worldsmith shell; older specialist consoles are now lazy-loaded Expert workbenches instead of nine scripts and eight stylesheets at startup.
- Added genuine Beginner, Guided, and Expert workspace scope; independent high-contrast, reduced-motion, sound, scale, and controller-layout preferences; responsive stacked panels; and keyboard/controller map editing.
- Rebuilt Map Studio around a local draft with real project tiles, continuous paint, erase, fill, rectangle, selection, undo/redo, explicit change counts, discard, recovery snapshot, and one deliberate save.
- Added deterministic recipe previews that apply generated tile changes to a composed map, protected authored-cell locks, checksum invalidation, and snapshot-backed application.
- Added connected quest validation and project-local portable quest definitions.
- Rebuilt Playtest Lab with all-map structural checks, editable budgets, golden-map checksums, separate launch and human attestation, and explicit verified/failed/not-run/skipped/stale states.
- Rebuilt Release around a project fingerprint and required current evidence: structural lab, real playtest, recovery checkpoint, extension trust review, and content dependencies. Release output is a local evidence manifest, not a deployment claim.
- Added a safe content library, consolidated commands, contextual Pip guidance, original feedback tones, and on-demand specialist workbenches.
- Added runtime schema v17 and lean save serialization that removes authoring-only bulk while preserving in-memory authoring state and runtime game state.
- Hardened the Electron renderer and corrected extension language so same-process time/payload budgets are not presented as security isolation.
- Curated the visible RPG Maker Plugin Manager list from 196 entries to 26 high-value commands without removing existing registrations or public APIs.

## 16.0.0 — 2026-07-17

- Added the ten-workspace Worldsmith creator suite with a new original console-quality shell, creator journey, command palette, responsive layouts, spatial focus, controller parity, synthesized feedback, and Beginner/Guided/Expert experiences.
- Added a complete six-layer visual Map Studio with working drafts, paint/erase/fill/rectangle/selection tools, overlays, zoom, undo/redo, round-trip structural plans, Safe Mode limits, automatic recovery points, Studio snapshots, and reversible authoring-layer commits.
- Added compiled World Recipe graphs with deterministic stage order, cycle and reference validation, seeded previews, constraints, authored-cell locks, partial regeneration metadata, portable `.htggraph` files, schemas, and starter content.
- Added connected quest and cutscene projects with typed objectives, choices, dialogue, rewards, transfers, completion/failure states, unreachable-path analysis, timed multi-track cues, `.htgquest` association, schema, and starter quest.
- Added the Playtest Laboratory, all-map Studio scan, runtime production suite integration, softlock and performance budgets, headless manifests, reproducible `.htgbug` bundles, and CLI validation of Worldsmith graphs, quests, and content.
- Added versioned `.htgcontent` libraries with capture, search, filters, favorites, dependencies, checksums, project persistence, reversible installation, schema, and example collection.
- Added canonical source snapshots, path-aware three-way project merge plans, explicit extension capability policies, Safe Mode configuration, and a complete production health dashboard with gated v2 release manifests.
- Added v16 desktop/offline integration, documentation, schemas, examples, and regression coverage. Migrated runtime save data to schema v16 and expanded the matched Plugin Manager command count to 196.

## 15.0.0 — 2026-07-17

- Added the eleven-area Creator Console with original console-grade navigation, global commands, activity center, contextual guide, guided/expert modes, themes, UI scale, sound/reduced-motion settings, full keyboard/controller navigation, responsive layouts, and accessible focus states.
- Rebuilt event authoring as a no-JSON visual designer with the complete MZ catalog, direct parameter controls, plugin metadata parsing, structured movement routes, drag ordering, page conditions, validation, third-party preservation, stable drafts, and reversible application.
- Added the rendered Tileset Workshop with bank browsing, passage/special/terrain painting, semantic labels, raw asset inspection, audits, persistent working drafts, transaction backups, and recovery browsing.
- Upgraded Live Production to protocol 2 with handshake/capability negotiation, session tokens, heartbeats, state hashes, sequences, acknowledgements, bounded command/log history, diagnostics, player-journey replay, recovery commands, and explicit stale bridge cleanup.
- Added repeatable player journeys, complete production suites, golden maps, CI test manifests, a bundled read-only headless validator, project-wide search and rename planning, passability/softlock intelligence, and the Performance Center.
- Added universal recovery points, interrupted-write journals, multi-file restore manifests, cross-surface undo/redo, extension isolation/security profiles, publisher trust, bundle comparison/merge plans, compatibility profiles, release comparisons/manifests, and gated production handoff validation.
- Added v15 schemas, desktop file associations, practice content, offline cache entries, documentation, and regression coverage. Migrated runtime save data to schema v15 and expanded the matched Plugin Manager command count to 176.

## 14.0.0 — 2026-07-17

- Added an original Live Production Console with nine focused workspaces, Guided/Expert modes, responsive controller-first navigation, command search, activity notifications, contextual guidance, and a clearer project journey.
- Added a project-local playtest bridge for launch/attach, watched switch and variable state, transfers, runtime snapshots, World Recipe hot reload, pause/resume intent, and command acknowledgement.
- Added runtime playtest recording, portable `.htgrecording` files, generated `.htgscenario` regression tests, scenario execution records, and Studio golden-map capture/comparison.
- Added a full MZ event-command catalog and structural validator, page/command tree editing, reversible event application, and opaque preservation of unfamiliar plugin commands.
- Added backed-up Tilesets.json flag editing, semantic tile profiles, semantic reachability/landmark analysis, visual heatmaps, and reversible tile remapping.
- Added unified content search/collections, extension execution budgets and quarantine, portable review bundles, release fingerprints, clean production bundles, and multi-platform build manifests.
- Added schemas, examples, desktop/PWA associations and caching, expanded tests, and save-data migration to schema v14 while preserving prior projects and saves.

## 13.0.0 — 2026-07-17

- Added Worldstudio, an original full-screen visual authoring suite with a direct-edit RPG Maker map canvas, minimap, collision/region/event overlays, shape tools, and reversible stroke commits.
- Added project-wide World Atlas and Logic & Quest Graph workspaces for map transfers, event pages, state readers/writers, common events, and World Recipe connections.
- Added NPC Director timelines and traffic simulation, Map Doctor preview-first repairs, named/session history comparisons, pack dependency planning, and a permissioned extension workbench.
- Added one-click backed-up runtime plugin installation, release validation, deployment reports, golden-map checks, a playtest checklist, and a v13 Extension SDK/schema/example.
- Added runtime atlas, quest graph, intelligent repair, visual history/diff, semantic dependency, pack repository, extension permission, NPC simulation, validation, and deployment APIs.
- Migrated save data to schema v13 while retaining prior project and save compatibility.

## 12.0.0 — 2026-07-17

- Rebuilt the default Studio experience as a five-hub console-style product shell with original inline icons, large result cards, clear project stages, responsive layouts, contextual map drawers, Quick Tools, Activity, and a persistent A/B/X/Y action strip.
- Added complete spatial keyboard/controller navigation, shoulder-button hub switching, optional haptics, original synthesized UI sounds, Cloud/Midnight themes, high contrast, larger text, reduced motion, and color-independent status cues.
- Added Pip, an original illustrated guide character, with contextual help and a guided Make Something journey for grafts, transforms, NPC routes, World Recipes, biome graphs, and World Packs.
- Added persistent NPC routes, timed waypoint interpolation, occupancy, journey previews, loop/arrival behavior, schedule coordination, and diagnostics.
- Added reusable advanced rule brushes with multiple shapes, hardness/falloff, weighted cells, filters, statistics, and schema/pack support.
- Added procedural stage caching, authored-cell locks and restoration, cache diagnostics, and graph-aware project references.
- Added debugger watches, persistent debug history, explain tracing, safe single-action planning/stepping, and a new Recipe Debugger screen.
- Added deterministic pack integrity digests, local publisher trust metadata, catalog subscriptions/update checks, reference graphs, benchmarks, job history, and expanded v12 diagnostics.
- Updated World Pack schema to v3 and World Recipe catalog examples to v4; added routes, brushes, locks, new capabilities, documentation, regression tests, desktop packaging, and PWA caching.
- Migrated save data to schema v12 while keeping v11 projects and the existing 128 RPG Maker Plugin Manager commands compatible.

## 11.0.0 — 2026-07-17

- Added the World Workshop: a guided overview plus World Simulator, NPC Life Designer, Rule Painting, Biome Composer, Map Operations, Project Care, and Content Library.
- Added persistent NPC lives with homes, jobs, relationships, daily/overnight/weekday/season schedules, activity queries, automatic activity updates, triggers, conditions, actions, and non-mutating timeline simulation.
- Added spatially indexed visual rule layers, painted-cell queries, recipe compilation, runtime conditions/actions, and project schema support.
- Added validated deterministic biome graphs with dependency ordering, transaction rollback, runtime/Studio execution, partial-selection regeneration, and extension stages.
- Added connected-map batch transforms with event/direction/move-route/transfer repair and advanced six-layer/event grafting in reversible Studio authoring layers.
- Replaced basic World Pack removal with owned-content baselines, capability approval, dependency lockfiles, semantic upgrade/downgrade checks, safe uninstall, history, and targeted rollback.
- Added automatic recovery snapshots, runtime execution budgets, chunked recipe pumping, zone spatial indexing, performance heatmaps, metadata optimization, content catalogs, and compatibility reports for public plugin order.
- Added a typed draggable Recipe graph, nested logical grouping, map-selection target picking, accessibility/large-target settings, validated `.htgcatalog` import/export and file association, and desktop update controls.
- Migrated save data to schema v11, expanded the plugin to 128 matched commands, and added v11 schemas, examples, docs, and regression coverage.

## 10.0.0 — 2026-07-17

- Rebuilt the Studio around friendly Home, Map, Events, World, Create, Packs, Test, and Ship workspaces with a bright first-party product shell, large targets, Simple/Pro disclosure, command search, guided onboarding, help, responsive layouts, keyboard focus, reduced motion, and controller navigation.
- Added a visual `WHEN → IF → THEN` flow, friendly condition/action builders, plain-language explanations, map overlays, debug timeline, breakpoints, replay, profiling, and playtest catalog hot reload.
- Added a persistent World Director runtime: time, days, seasons, zones, enter/exit and interaction triggers, facts, settlements/regions, renewable resources, schedules, repeating recipes, and alternate map variants.
- Added time, season, day, fact, zone, proximity, line-of-sight, entity, resource, and installed-pack conditions plus scheduling, clock, fact, entity, resource, spawned-event, and map-variant actions.
- Added World Packs with dependencies, version checks, conflict previews, `.htgworld` desktop association, import/export/install APIs, and a dedicated schema.
- Added rollback-safe scenario tests, suite execution, release-readiness checks, production stripping, richer diagnostics, and expanded regression coverage.
- Migrated save data to schema v10 and expanded the public plugin surface while keeping all World Recipe systems inside the existing HybridTileGraft plugin.

## 9.1.0 — 2026-07-17

- Added World Recipes directly to HybridTileGraft and Hybrid Tile Studio.
- Added a visual Recipes panel with trigger controls, nested condition/action builders, ordering, templates, catalog import/export, validation, and non-mutating simulation at the current selection.
- Added optional automatic loading of `data/HybridWorldRecipes.json`; a missing file is ignored safely.
- Added map-enter, player-step, interval, switch-change, variable-change, tile-change, state-change, manual, and named custom triggers.
- Added switches, variables, self switches, persistent world state, common events, tile/region edits, fills, clears, prefab grafts, weather, tint, checkpoints, recipe chaining, plugin commands, messages, logs, and change events as built-in actions.
- Added nested AND/OR/NOT conditions for maps, regions, terrain, tiles, positions, directions, switches, variables, world state, gold, items, chance, context values, and prior recipe runs.
- Added cooldowns, run-once and maximum-run limits, priority, enable overrides, recursion/re-entry protection, dry runs, diagnostics, execution history, catalog cycle detection, save migration, and workspace/handoff export.
- Added extension APIs for custom condition and action handlers plus six new Plugin Manager commands.
- Added runtime and Studio regression coverage for recipe authoring, validation, execution, persistence, custom handlers, and cycle rejection.

## 9.0.0 — 2026-07-17

- Added the production workbench: Compatibility Lab, recovery browser, Git workspace, asset manager, recent projects, update UI, accessibility, localization, onboarding, and diagnostics export.
- Expanded visual event editing with command-specific fields, page conditions, movement routes, reference scans, and importable templates.
- Added a visual prefab studio with catalog import/export, previews, versioned parameters, dependencies, variants, placement rules, and linked-instance refresh.
- Added visual generator graphs, mask constraints, multi-layer background WFC, rule analysis, and persisted diagnostics.
- Added threaded map reviews with replies, status history, attachments, export, and selection/event navigation.
- Added adaptive rendering budgets, sampled minimaps, Web Worker WFC, retained/scheduled snapshots, and selective backup restore.
- Added safe asset renames with JSON reference updates, asset/case/unused audits, tileset flag backup/editing, and canonical `.hybrid` Git data.
- Added recent desktop projects, registered file associations, optional `electron-updater` integration, NSIS installers, signing hooks, and expanded CI/testing.
- Migrated the runtime plugin save schema to v9 and added six production Plugin Manager commands and matching public APIs.
- Fixed store repair writing an outdated schema version and preserved the active map during canonical export.

## 8.0.0 — 2026-07-17

- Replaced approximate Studio autotiles and incorrect B-E addressing with the exact RPG Maker MZ tile-sheet and quadrant algorithms, including animated A1 and A2 table tiles.
- Added lasso, polygon, wand, and region selections plus six-layer/event clipboard transformations and cross-map paste.
- Added structured event page/command editing and a cross-map Transfer Player destination picker.
- Added learned weighted backtracking WFC, transition, river-network, progression-dungeon, and graph generators.
- Added project dependency/reference auditing and extension validators.
- Added recoverable multi-map save journals, retained transaction backups, rollback, and atomic Electron file replacement.
- Added workspace branches, review comments, canonical exports, and Git status integration.
- Added Web Worker search, PWA/drag-drop support, extension APIs, Electron/NW packaging, and a three-platform build workflow.
- Migrated the plugin save schema to v8 and added 11 Plugin Manager commands for transactions, branches, review, learned WFC, dependency auditing, and canonical export.

## 7.0.0

- Added the standalone Hybrid Tile Studio, authoring layers, masks, modifiers, linked prefab instances, advanced generation, visual diffs, project search, audits, and hardening.
