# Hybrid Tile Studio v18.1 — First-Party Release Contract

Hybrid Tile Studio follows a creator-first design principle: clear state, immediate feedback, forgiving reversal, controller and keyboard parity, and strict honesty about what has actually been verified. Its visual language, assets, workflows, and implementation are original to this package.

## Safety contract

- Worldsmith state is loaded after a project opens and stored per project under the `worldsmith-v18` namespace. Existing v17 state is imported once and receives v18.1 defaults without replacing the historical fixture.
- Map edits are represented as version-3 tile deltas against an immutable base checksum. A pointer stroke is one transaction; no complete before/after map is retained for ordinary undo or recovery.
- In desktop/project mode, the recovery record is atomically written under `.hybrid/worldsmith/` before a browser mirror is updated. Browser-only sessions use IndexedDB. `localStorage` is limited to preferences and one-time migration of older payloads.
- Every recovery write records a visible state (`saving`, `saved`, `failed`, or `applied`), backend, timestamp, and error. Project and browser failures are never reported as successful recovery.
- Apply rereads the project map and performs a three-way tile merge. Non-overlapping external changes are preserved; overlapping edits stop at a visible conflict decision. Events are always taken from the current project map.
- Apply and content installation create a named recovery snapshot before the atomic project write. Core project switching asks before abandoning unsaved core documents.
- Recovery snapshots, branches, and comments obey configurable retention. Stale records can be pruned without deleting the current recoverable draft.

## Creator surfaces

Map Studio supports MZ B, C, D, E, A5, A1, A2, A3, and A4 tile-ID ranges with 64-tile pages, exact/range/semantic filtering, paint, erase, pick, complete fill, rectangle, select, pan, copy/paste, six-layer visibility, minimap, and events, regions, shadows, collision, and changed-cell overlays. Apply, Revert, dirty counts, and recovery status derive from one authoritative dirty-tile set.

Large maps use viewport culling, animation-frame redraw batching, throttled minimap updates, and worker-backed flood fill/generation. A configured fill limit fails visibly rather than returning a partial edit.

World recipes save as `HybridWorldRecipeGraph` v2 `.htggraph` files. Stages expose generator, tiles, layer, density, count, and lock state. Templates, import/export, deterministic previews, content capture, stale-preview checks, and worker execution are included.

Quests save as `HybridQuestProject` v2 `.htgquest` files. They support branching edges, choice labels, start/dialogue/objective/choice/reward/transfer/complete/fail nodes, reward and transfer fields, cutscene cues, reachability validation, import/export, and content capture.

Content libraries save as `HybridContentLibrary` v2 `.htgcontent` files. Imports are normalized, deduplicated, schema-validated, structurally checked, and capped at 10 MB. Map installation checks dimensions and snapshots the active map first.

## Evidence, identity, and release

The current identity format is canonical SHA-256:

```json
{
  "algorithm": "sha256",
  "canonicalizationVersion": 1,
  "digest": "64 lowercase hexadecimal characters"
}
```

The fingerprint includes every connected map, canonical recipe and quest payloads, content versions and hashes, configured budgets, extension ID/version/capability/permission manifests, trust decisions, and verification-policy version. Legacy `fnv1a32` identifiers remain accepted only where the payload explicitly identifies the legacy algorithm.

Signed world packs use Ed25519 public-key verification over the canonical unsigned payload. A publisher label plus checksum is not treated as a signature. Synchronous installation refuses an unchecked signed pack; the asynchronous verified path returns signature and integrity status.

A release requires:

1. no open map draft or recipe preview;
2. a current structural scan with no errors, warning count within budget, and static map/event budgets passing;
3. a human-attested real-engine player path for the same fingerprint;
4. a current checkpoint covering every connected map;
5. explicit review of every same-process extension; and
6. resolved content dependencies.

Migration and golden-map evidence remain optional, but their states are exact: verified, failed, changed, skipped with reason, stale, baseline, or not run. Only an explicit migration skip is labeled “skipped.” Release output is a semantic-versioned `HybridReleaseManifest` v2 `.htgrelease` file. It does not claim deployment, store approval, certification, runtime frame timing, or full-game save-size verification.

## Accessibility, layout, and control

Beginner, Guided, and Expert modes remain reachable from Settings. Create uses fixed editor columns on wide screens and Tools/Inspector drawers below 1180 px. Test, Release, and Settings use purpose-built two-column layouts and collapse to one column at 960 px.

Preferences include 90–175% interface scale, large text, high contrast, color-independent status patterns, reduced motion, sound enable/volume, locale readiness, Pip behavior, and recovery retention. Controller navigation uses spatial focus, supports remapped buttons, can edit the map canvas, and provides undo/redo and workspace cycling.

## Update and compatibility contract

The service worker validates core assets against `asset-manifest.json`. A newly installed worker remains waiting until the user accepts a reload, preventing an open editor from mixing shell versions. Historical specialist modules are loaded only after an explicit Expert action and only when no update is waiting.

The runtime store migrates prior versions to schema 18. Runtime saves use the `runtime-lean-v18` profile and continue to omit authoring-only history, drafts, reports, and UI state. Version-1 graph, quest, and content examples remain accepted and normalize to v2 on export. The RPG Maker deliverable remains one generated `HybridTileGraft.js` file with the established public API and Plugin Manager command registrations.
