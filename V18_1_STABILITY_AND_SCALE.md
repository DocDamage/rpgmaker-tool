# Hybrid Tile Studio v18.1 — Stability and Scale

This release converts the v18 product surface from broad feature completeness into a safer, measurable editing foundation. It preserves RPG Maker MZ compatibility and the one-file plugin distribution while changing how the Studio stores, redraws, validates, and verifies authoring state.

## Authoritative map state

The active map keeps an immutable base and a mutable draft. A `dirtyTiles` set records exactly which tile positions differ. Apply labels, disabled states, Revert, recovery status, release gates, and dirty counts derive from that set through the same update path. This prevents a painted draft from showing “Apply 0 changes.”

Every gesture is one transaction containing only changed indices and before/after tile values. Undo and redo replay those deltas. Ordinary history no longer retains 40 complete map copies. Recovery uses the same compact tile list, making history, persistence, merge, and conflict reporting agree on the operation model.

## Recovery hierarchy

1. In a connected desktop project, write the draft atomically to `.hybrid/worldsmith/` using a temporary file and rename.
2. Mirror the successful record to IndexedDB so a browser or renderer restart can recover it.
3. In a browser-only loose-map session, store the draft directly in IndexedDB.
4. Keep `localStorage` for preferences and one-time migration only.

Recovery status records the attempted backend and any error. If the project write fails, the browser fallback is visible. If both fail, the status is `failed`; the UI does not claim the draft is protected. Configurable retention prunes old snapshots, branches, and review comments without deleting the current draft.

## Large-map behavior

The canvas renderer intersects the map with the visible viewport before drawing tiles. Pointer mutations are coalesced through `requestAnimationFrame`, overlays are invalidated by changed regions, and the minimap refreshes at a lower cadence. The test suite exercises a populated 250×250 map and enforces a bounded visible draw count.

Flood fill and deterministic recipe stages run in `HybridTileWorker.js`. Fill marks a cell when queued so each cell enters the queue once, supports connected regions above 100,000 cells, and reports an explicit limit error when a caller configures a smaller cap. It never silently returns a partial fill.

## Responsive workspace model

World retains navigator/main/inspector columns. Test, Release, and Settings use their own two-column layouts. Create uses Tool/main/Inspector columns above 1180 px and turns Tool and Inspector into dismissible drawers at narrower desktop widths. At 960 px, secondary two-column workspaces collapse to one column.

Browser journeys cover 1600, 1366, 1180, 1024, and 960-pixel widths. Interface scaling, large text, high contrast, reduced motion, visible focus, Pip behavior, and semantic tile filtering remain available.

## Integrity model

Project and release identities use canonical JSON plus SHA-256 with an explicit canonicalization version. Release schemas accept structured SHA-256 identity objects and explicitly identified legacy FNV values for compatibility.

World packs can include an Ed25519 signature and public key. Verification runs asynchronously through WebCrypto over the canonical unsigned payload; tampering invalidates the signature. The synchronous install API rejects a signed pack that has not passed verification.

The JSON Schema files are executable through `HybridTileSchemaV18.js` in the Studio and CLI. Generated `HybridTileSchemasV18.js` embeds the same documents for desktop, offline, and `file:` use. The build verifies every bundled structured example and emits SHA-256/byte metadata for release assets.

## Update model

The service worker downloads `asset-manifest.json`, verifies core response size and SHA-256 before caching, and does not call `skipWaiting` during installation. A new shell remains waiting until the user accepts a reload. Expert legacy workbenches are not loaded while an update is waiting, avoiding mixed-version lazy modules.

## Source model

The distributed plugin remains `HybridTileGraft.js`. Its authored source is now divided into named runtime parts and assembled deterministically by `scripts/build-release.js`. Active Studio and Electron sources are copied from `src/studio` and `src/desktop`; schemas and the asset manifest are generated. `npm run check:generated` fails when a release-root artifact does not match its source.

## Compatibility

- RPG Maker save schema remains 18 and uses the lean runtime profile.
- Existing public runtime APIs and Plugin Manager command registrations remain available.
- v17 Studio state is a migration input, not a production surface.
- Version-1 graph, quest, and content payloads remain importable and normalize to version 2.
- Legacy FNV identities remain readable only when their algorithm is explicit. New release evidence is SHA-256.
