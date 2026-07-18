# Hybrid Tile Studio release readiness

This file defines what “complete” means for the source package and what still belongs to a specific RPG Maker game release.

## Source-package gates

- `npm ci` completes without audit findings.
- `npm run lint` passes the authored and generated JavaScript safety rules.
- `npm run check:generated` reports no source/generated drift.
- `npm test` passes all deterministic application suites.
- `npm run test:e2e` passes all HTTP/browser/PWA journeys.
- `npm run test:e2e:file` passes all supported local-file journeys.
- The retained source-bound 1.8.0 and 1.10.0 smoke markers pass `npm run test:rpgmaker-evidence` for the exact `HybridTileGraft.js` source under release.
- `npm run test:rpgmaker-matrix` confirms the supported engine range and installed official core versions.
- `npm run dist:dir` produces a runnable unpacked desktop application.
- Tag CI builds all documented platform targets and enforces signing on Windows and macOS.
- The source revision is committed so generated artifacts and reports have a rollback point.

Run the complete local source gate with `npm run verify:release`.

## Game-release gates

These cannot be inherited from the Studio source package. They must be completed against the exact RPG Maker MZ project fingerprint being shipped:

The official RPG Maker MZ 1.8.0 minimum-core and 1.10.0 current-core isolated compatibility smokes close the source plugin's real-engine boot/API/save-reload gate. They do not replace the following production-project checks:

- Run the critical path in RPG Maker MZ with the production plugin order and record the attestation.
- Exercise save creation, save reload, and any supported migration path.
- Review third-party plugin compatibility and representative frame timing.
- Produce platform packages with publicly trusted signing/notarization credentials.
- Set the CI `HTG_UPDATE_URL` secret, publish the matching metadata and binaries produced by `npm run dist:update`, and verify update detection/download/install from a previously shipped version.

The Studio deliberately reports these states as required, stale, skipped, or not run; it must never convert a structural or launch check into player evidence.
