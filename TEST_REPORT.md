# Hybrid Tile Studio v18.1 — Test Report

Date: 2026-07-18

This report records verification against the current source tree. Source-package checks are kept separate from evidence that can only come from a specific RPG Maker MZ game, trusted release identity, or deployed update feed.

## Verification matrix

| Command / suite | Status | Result |
|---|---|---|
| `npm ci` | PASS | 354 packages audited; zero reported vulnerabilities. |
| `npm run lint` | PASS | ESLint passed the generated plugin plus authored Studio, desktop, scripts, tests, and entrypoints. |
| `npm run build` | PASS | Generated the single-file plugin, capability/schema contract, public API manifest/declarations, engine matrix docs, active Studio/Desktop files, schema registry, and SHA-256 asset manifest. |
| `npm run check:generated` | PASS | No source/generated drift. |
| `npm test` | PASS | All eleven deterministic/application/engine-evidence suites passed. |
| `npm run test:e2e` | PASS | All three HTTP real-browser journeys passed, including IndexedDB recovery and the service-worker cache contract. |
| `npm run test:e2e:file` | PASS | All three local-file journeys passed with the supported service-worker exception. |
| `npm run verify` | PASS | The consolidated lint, deterministic, HTTP-browser, and local-file-browser gate completed in 63.5 seconds. |
| `npm run dist:dir` | PASS | Electron Builder produced the Windows x64 unpacked application; the ASAR/resources contain all generated capability, API, declaration, and engine-compatibility artifacts. |
| `npm run dist:signed` / `npm run dist:update` | NOT RERUN | These distribution-identity/provider gates are unchanged and still require the release owner's scoped credentials and deployed update provider. |
| Official RPG Maker MZ 1.8.0 isolated-engine smoke | PASS | The official bundled minimum core completed boot, 196-command/API checks, real save/reset/load persistence, temporary-save cleanup, 30-frame timing, and the world benchmark. |
| Official RPG Maker MZ 1.10.0 isolated-engine smoke | PASS | The official current new-project core completed the same source-bound probe and checks. |

## Application coverage

The passing suites cover:

1. Runtime/plugin API compatibility, structured Plugin Manager command results, schema-18 save behavior, operations, and world-pack integrity.
2. Canonical extension-capability parity, all 540 classified public exports, TypeScript declaration parity, generated-source drift, queue safety, and static analysis.
3. Source-bound RPG Maker MZ 1.8.0/1.10.0 evidence, including real save/reset/load persistence, cleanup, timing, benchmark, probe syntax, core version, and retained-marker integrity.
4. Studio paint → immediate Apply state → version-3 delta recovery → undo/redo → persisted map → cleared recovery.
5. Portable formats, map deltas, three-way merges, conflicts, and spatial services.
6. Canonical SHA-256, IndexedDB storage and retention, executable schemas, Ed25519 verification, PWA integrity, and bundled structured examples.
7. v17 migration, project-first recovery, browser-only success, browser fallback after a failed project write, and dual-backend failure reporting.
8. Electron renderer isolation, denied navigation/popups/permissions, project path constraints, atomic writes, and recent-project health.
9. Worker WFC, deterministic generation, complete 120,000-cell flood fill, and explicit operation limits.
10. CLI self-test, read-only project validation, canonical report identity, output behavior, and failure codes.

The browser journeys additionally cover the visible semantic tile label, native accessibility settings, Beginner-mode lifecycle, responsive widths at 1600/1366/1180/1024/960 pixels, command focus, practice-project loading over HTTP and `file:`, IndexedDB recovery, and versioned service-worker cache contents.

## Windows packaging and signing

The current source produced `dist/win-unpacked/Hybrid Tile Studio.exe`. Its packaged resources include `EXTENSION_CAPABILITIES.md`, `PUBLIC_API.md`, `HybridTileGraft.api.json`, `ENGINE_COMPATIBILITY.md`, and `HybridTileGraft.d.ts`. Publicly trusted Windows signing and macOS signing/notarization still require the release owner's credentials and were not claimed by this verification run.

## External game-release evidence

On 2026-07-18, commit `7841b9b497985211d87d88d49b030b57cf950eb7` and the exact `HybridTileGraft.js` source with SHA-256 `6315FB9BBDE298308CDFF1A6E60510641EE674E46817C53E45454211B368516C` passed isolated playtests against the official bundled RPG Maker MZ 1.8.0 core and official Steam 1.10.0 new-project core. Both runs displayed the green PASS banner, restored the test region and world state after `DataManager.saveGame` → reset → `DataManager.loadGame`, removed save slot 20, measured 30 animation frames, and completed the world benchmark.

The 1.8.0 marker recorded a 4,413-byte save and 16.783 ms p95 frame interval; the 1.10.0 marker recorded a 4,449-byte save and 16.845 ms p95 frame interval. Their retained marker SHA-256 values are `70641E28D175F5DDBC4E4DCD836D16CE1211810B876920AF3FAECEE593195B18` and `312E842C82A00E13DF681A3B16A6BBB07A1BB7CBA247465B76A17534A9760C2D`. `npm test` rejects the evidence if the plugin, probe, marker, attestation, or configured engine contract becomes stale.

This isolated compatibility smoke does not claim these production-game gates:

- a critical-path playtest with the final production project, content, and plugin order;
- migration from an actual pre-v18 production save;
- production third-party plugin compatibility and representative full-game runtime performance;
- a Windows/macOS identity trusted on clean user machines and macOS notarization;
- update detection, download, and installation against a deployed provider containing matching metadata and binaries; or
- platform store approval.

Those gates must be completed against the exact release fingerprint described in `RELEASE_READINESS.md` and `PLAYTEST_CHECKLIST.md`.
