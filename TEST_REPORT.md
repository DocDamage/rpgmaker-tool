# Hybrid Tile Studio v18.1 — Test Report

Date: 2026-07-18

This report records verification against the current source tree. Source-package checks are kept separate from evidence that can only come from a specific RPG Maker MZ game, trusted release identity, or deployed update feed.

## Verification matrix

| Command / suite | Status | Result |
|---|---|---|
| `npm ci` | PASS | 300 packages audited; zero reported vulnerabilities. |
| `npm run build` | PASS | Generated the single-file plugin, active Studio/Desktop files, schema registry, and SHA-256 asset manifest. |
| `npm run check:generated` | PASS | No source/generated drift. |
| `npm test` | PASS | All eight deterministic/application suites passed. |
| `npm run test:e2e` | PASS | All three HTTP real-browser journeys passed, including IndexedDB recovery and the service-worker cache contract. |
| `npm run test:e2e:file` | PASS | All three local-file journeys passed with the supported service-worker exception. |
| `npm run dist:dir` | PASS | Electron Builder produced the Windows x64 unpacked application. |
| `npm run dist:signed -- --win ...certificateSha1=...` | PASS | NSIS, portable, and ZIP targets built; all Windows executables contain the selected Authenticode signature and a DigiCert timestamp. |
| `npm run dist:update` without `HTG_UPDATE_URL` | EXPECTED BLOCK | The release builder refuses to create updater artifacts without an explicit HTTPS provider. URL validation and signing policy tests pass. |
| `npm run dist:update` with a non-routable HTTPS test feed | PASS | The signed Windows build generated matching `latest.yml` and embedded `app-update.yml` metadata without publishing. |
| `npm run verify:release` | PASS | The consolidated deterministic, browser, generated-source, and unpacked-package gate completed successfully. |
| Official RPG Maker MZ isolated-engine smoke | PASS | RPG Maker MZ 1.10.0 / NW.js 0.48.4 started Map001 with HybridTileGraft 18.1.0, registered all 196 commands, read the player tile, and returned healthy store/diagnostic/system reports. |

## Application coverage

The passing suites cover:

1. Runtime/plugin API compatibility, schema-18 save behavior, operations, and world-pack integrity.
2. Source-bound RPG Maker MZ real-engine evidence, including probe syntax and retained-marker integrity.
3. Studio paint → immediate Apply state → version-3 delta recovery → undo/redo → persisted map → cleared recovery.
4. Portable formats, map deltas, three-way merges, conflicts, and spatial services.
5. Canonical SHA-256, IndexedDB storage and retention, executable schemas, Ed25519 verification, PWA integrity, and bundled structured examples.
6. v17 migration, project-first recovery, browser-only success, browser fallback after a failed project write, and dual-backend failure reporting.
7. Electron renderer isolation, denied navigation/popups/permissions, project path constraints, atomic writes, and recent-project health.
8. Worker WFC, deterministic generation, complete 120,000-cell flood fill, and explicit operation limits.
9. CLI self-test, read-only project validation, canonical report identity, output behavior, and failure codes.

The browser journeys additionally cover the visible semantic tile label, native accessibility settings, Beginner-mode lifecycle, responsive widths at 1600/1366/1180/1024/960 pixels, command focus, practice-project loading over HTTP and `file:`, IndexedDB recovery, and versioned service-worker cache contents.

## Windows packaging and signing

The current machine produced:

- `Hybrid Tile Studio Setup 18.1.0.exe`
- `Hybrid Tile Studio 18.1.0.exe`
- `Hybrid Tile Studio-18.1.0-win.zip`
- `Hybrid Tile Studio Setup 18.1.0.exe.blockmap`

The executables are signed and timestamped, but the available certificate is self-signed. Windows therefore reports that its root is not publicly trusted. This proves the local signing pipeline and does not qualify the artifacts as publicly trusted distribution builds.

## External game-release evidence

On 2026-07-18, the exact `HybridTileGraft.js` source with SHA-256 `A8EEBCA67A44F19460C91B38E126C6890D9EBEE63172D5D1D93ACF601613C247` passed an isolated playtest in the official Steam build of RPG Maker MZ 1.10.0. The engine showed the green PASS banner and wrote the retained marker with SHA-256 `CEB268132CFD845E6787D1C525E1598F39203585C2F8377ABDA3C7179F76C9C1`. `npm test` rejects this evidence as stale if the plugin, probe, or marker changes.

This isolated compatibility smoke does not claim these production-game gates:

- a critical-path playtest with the final production project, content, and plugin order;
- real save/reload and supported migration behavior;
- production third-party plugin compatibility and representative runtime performance;
- a Windows/macOS identity trusted on clean user machines and macOS notarization;
- update detection, download, and installation against a deployed provider containing matching metadata and binaries; or
- platform store approval.

Those gates must be completed against the exact release fingerprint described in `RELEASE_READINESS.md` and `PLAYTEST_CHECKLIST.md`.
