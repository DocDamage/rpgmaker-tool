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
| `npm run verify:release` | PASS | The consolidated deterministic, browser, generated-source, and unpacked-package gate completed successfully. |

## Application coverage

The passing suites cover:

1. Runtime/plugin API compatibility, schema-18 save behavior, operations, and world-pack integrity.
2. Studio paint → immediate Apply state → version-3 delta recovery → undo/redo → persisted map → cleared recovery.
3. Portable formats, map deltas, three-way merges, conflicts, and spatial services.
4. Canonical SHA-256, IndexedDB storage and retention, executable schemas, Ed25519 verification, PWA integrity, and bundled structured examples.
5. v17 migration, project-first recovery, browser-only success, browser fallback after a failed project write, and dual-backend failure reporting.
6. Electron renderer isolation, denied navigation/popups/permissions, project path constraints, atomic writes, and recent-project health.
7. Worker WFC, deterministic generation, complete 120,000-cell flood fill, and explicit operation limits.
8. CLI self-test, read-only project validation, canonical report identity, output behavior, and failure codes.

The browser journeys additionally cover the visible semantic tile label, native accessibility settings, Beginner-mode lifecycle, responsive widths at 1600/1366/1180/1024/960 pixels, command focus, practice-project loading over HTTP and `file:`, IndexedDB recovery, and versioned service-worker cache contents.

## Windows packaging and signing

The current machine produced:

- `Hybrid Tile Studio Setup 18.1.0.exe`
- `Hybrid Tile Studio 18.1.0.exe`
- `Hybrid Tile Studio-18.1.0-win.zip`
- `Hybrid Tile Studio Setup 18.1.0.exe.blockmap`

The executables are signed and timestamped, but the available certificate is self-signed. Windows therefore reports that its root is not publicly trusted. This proves the local signing pipeline and does not qualify the artifacts as publicly trusted distribution builds.

## External game-release evidence

The source package does not claim these game-specific gates:

- a critical-path playtest in RPG Maker MZ with the final production project and plugin order;
- real save/reload and supported migration behavior;
- production third-party plugin compatibility and representative runtime performance;
- a Windows/macOS identity trusted on clean user machines and macOS notarization;
- update detection, download, and installation against a deployed provider containing matching metadata and binaries; or
- platform store approval.

Those gates must be completed against the exact release fingerprint described in `RELEASE_READINESS.md` and `PLAYTEST_CHECKLIST.md`.
