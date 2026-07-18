# Worldsmith v16

Worldsmith is Hybrid Tile Studio's complete creator workspace. It presents project-scale RPG Maker MZ production as ten understandable destinations while retaining the older expert workbenches underneath.

## Workspaces

### Dashboard

Shows the connected project, creator-journey progress, recent test status, content count, health score, and a recommended path from map creation to release.

### Map Studio

Map Studio loads the active `MapXXX.json` through Hybrid Tile Studio's project model and edits a working copy. It supports six RPG Maker layers, paint, erase, flood fill, rectangles, variable brush sizes, region and event overlays, map switching, zoom, selection handoff, undo, redo, and structural comparison.

**Apply reversibly** performs three operations:

1. validates the proposed map shape and event bounds;
2. creates a named pre-commit snapshot;
3. writes the differences to a new Studio authoring layer.

The map is not written to disk until the normal Studio Save or Save All command is used.

### World Recipes

The visual graph compiler validates unique stage ids, missing connections, and cycles. Stages can model terrain, biomes, coasts, rivers, roads, settlements, dungeons, interiors, decoration, and validation. Seeds, placement constraints, and locked cells are part of the portable graph. Saved graphs live at `.hybrid/worldsmith/recipe-graphs.json`.

The runtime API exposes `compileWorldRecipeGraph`, `lockWorldRecipeGraphCells`, and `regenerateWorldRecipeGraph`. Regeneration is a preview unless `apply: true` is supplied by an authorized workflow.

### Quests & Cutscenes

Quest projects contain typed story nodes, conditional paths, choices, rewards, transfers, completion/failure states, and timeline cues. Validation reports broken edges and unreachable nodes. Cutscene cues have a time, duration, track, type, target, and structured payload. Saved projects live at `.hybrid/worldsmith/quests.json`.

### Playtest Laboratory

The Lab can launch a packaged game, scan every connected map, check event command structure and autorun risks, enforce project budgets, create a CI manifest, and export reproducible `.htgbug` reports. Engine-side `runPlaytestLab` combines production journeys, golden-map checks, passage/softlock analysis, and performance budgets.

### Experience

Beginner, Guided, and Expert modes change information density and coaching—not capability. High contrast, large text, reduced motion, interface sound, and controller navigation are independent preferences.

### Content Library

Capture the active map as a versioned, checksummed content item. Library entries support types, tags, dependencies, favorites, payloads, and safe installation through reversible map layers. Project content is stored in `.hybrid/worldsmith/content-library.json`; portable collections use `.htgcontent`.

### Team & Git

Source snapshots use canonical project data so transient UI state does not pollute comparisons. Three-way merge automatically resolves one-sided changes and records every true conflict by path. Desktop Git access remains explicit and restricted to the selected project.

### Extension Control Center

Each extension policy declares capabilities, isolation, time budget, payload budget, enabled state, and review status. Sensitive capabilities such as project writes, network, process, and clipboard access are never silently granted. Policies are stored alongside project extension manifests.

### Production Dashboard

The production scan checks every connected map, tile data, event density, direct transfers, tests, checkpoints, content, and extension-policy review. A release manifest is enabled only after the current scan is ready. Manifest creation records targets, channel, version, notes, health report, and fingerprint; it does not deploy the game automatically.

## Runtime Safe Mode

Runtime Safe Mode is enabled by default. It can require a universal recovery point before a visual map commit and enforce a maximum write count. Use `safeModeV16()` to inspect the policy or pass changes to update it.

## Portable formats

- `.htgmapdraft` — visual map working copy
- `.htggraph` — World Recipe graph
- `.htgquest` — quest and cutscene project
- `.htgcontent` — reusable content collection
- `.htgbug` — reproducible playtest report

Schemas and validated examples for these formats are included in `schemas/` and `examples/`.

## Product identity

Worldsmith is an original independent interface. It pursues friendly console-quality interaction, strong feedback, legibility, safety, and controller parity without copying Nintendo branding, trade dress, sounds, characters, or visual assets.
