# Hybrid Tile Studio v18.1 — Implementation Report

Date: 2026-07-18

## Result

The requested stabilization, persistence, performance, layout, modularization, integrity, schema, testing, PWA, and first-run improvements have been implemented in the source archive. The RPG Maker deliverable remains a single generated `HybridTileGraft.js`; the active Studio identifies itself as v18.1.0.

| Requested improvement | Implementation | Primary files |
|---|---|---|
| Reliable Apply workflow | One dirty-state/action refresh path; all map mutations update Apply/Revert/count/status immediately | `src/studio/HybridTileStudioV18.js`, `tests/integration/test_hybrid_tile_studio.mjs` |
| Project-first recovery | Atomic project draft first, IndexedDB mirror/fallback, visible backend/error state, retention and legacy migration | `src/studio/HybridTileStudio.js`, `HybridTileStudioV18.js`, `HybridTileStorageV18.js`, `electron-main.js` |
| Delta undo/history | One tile-delta transaction per gesture; no ordinary full-map before/after snapshots | `HybridTileStudioV18.js`, `HybridTileStudioServicesV18.js` |
| Large-map rendering | Viewport culling, scheduled redraws, minimap throttling, worker fill/generation, explicit operation limits | `HybridTileStudioV18.js`, `HybridTileWorker.js` |
| Responsive layouts | Correct Test/Release/Settings grids; Create Tool/Inspector drawers below 1180 px; one-column collapse at 960 px | `HybridTileStudioV18.css`, `HybridTileStudioV18.js` |
| Modular source | 19 runtime parts, active Studio/Desktop source directories, deterministic build/check, v17 migration fixture | `src/manifest.json`, `src/runtime/parts/`, `scripts/build-release.js` |
| Strong identity/signatures | Canonical SHA-256 fingerprints; Ed25519 verified pack path; explicit legacy FNV compatibility | `HybridTileCryptoV18.js`, `HybridTileGraft.js`, release/world-pack schemas |
| Executable schemas | Embedded schema registry and runtime validator used for imports, examples, manifests, and tests | `HybridTileSchemaV18.js`, `HybridTileSchemasV18.js`, `schemas/` |
| Complete user journeys | DOM paint/recovery/apply journey, migration/failure, large-map, worker, Electron, CLI, and HTTP Playwright suites | `tests/integration/`, `tests/studio.spec.js`, `tests/serve.js` |
| PWA update safety | Content-hash verification, waiting-worker prompt, explicit activation/reload, no mixed-version expert load | `service-worker.js`, `HybridTilePwaV18.js`, `asset-manifest.json` |
| Product polish | Open Recent/Practice Project, six milestones, Pip options, recovery/storage health, semantic tile labels/search | `HybridTileStudioV18.js`, `HybridTileStudioV18.css`, `electron-main.js` |

## Key data-format changes

### Visual map draft v3

A map draft now stores base identity and changed tile entries instead of complete duplicate maps. The schema requires bounded integer indices and before/after values. Older draft/state payloads are migrated at load.

### Fingerprints

New fingerprints use `sha256` and canonicalization version 1. String display values use the `sha256-<digest>` form; structured release records include the algorithm, canonicalization version, and digest.

### Signed world packs

The verified install path canonicalizes the unsigned payload and verifies Ed25519 before installation. Integrity and signature outcomes are returned separately. A signed pack cannot use the old synchronous path as an implicit trust bypass.

## Build behavior

`npm run build` now:

1. concatenates named runtime parts into `HybridTileGraft.js`;
2. copies active Studio and desktop sources into the release root;
3. embeds every JSON Schema in `HybridTileSchemasV18.js`; and
4. writes `asset-manifest.json` with SHA-256 and byte size for release assets.

`npm run check:generated` compares the expected generated content without writing and exits nonzero if it is stale.

## Deliberate compatibility decisions

- Historical v9–v16 specialist workbenches remain available only through explicit Expert actions.
- v17 is removed from production loading and retained as a migration fixture.
- The runtime save schema stays at 18; Studio-only recovery records advance independently to map-draft version 3.
- FNV remains available for legacy records and map checksums where explicitly labeled, but it is no longer the default release identity or signature substitute.
- A real RPG Maker playtest and platform installer signing remain external release evidence; automated structural checks do not claim either.

See `TEST_REPORT.md` for the exact verification record and environment limitations for this archive.
