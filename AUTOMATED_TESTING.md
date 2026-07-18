# Automated testing v18.1

The v18.1 verification stack separates deterministic source/integration checks from real-browser and real-engine evidence. Passing a structural test never claims that RPG Maker rendering, timing, audio, third-party plugin behavior, or an installer was verified.

## Local verification

Requirements: Node.js 22 or later and npm.

```sh
npm ci
npm run lint
npm run build
npm run check:generated
npm test
```

`npm test` rebuilds generated release files first, verifies that the generated tree is current, and runs:

- RPG Maker runtime/plugin API, structured command-result, and save-migration tests;
- generated extension-capability, public-API inventory, TypeScript declaration, and queue-safety contracts;
- source-bound evidence from official RPG Maker MZ 1.8.0 and 1.10.0 cores;
- the v18.1 Studio DOM journey, including paint → delta recovery → undo/redo → Apply → persisted map;
- map-delta, three-way merge, schema, SHA-256, Ed25519, storage-retention, and PWA contract tests;
- v17-to-v18.1 migration plus project-first/browser-fallback and dual-failure recovery tests;
- Electron navigation/permission hardening, recent-project health, and atomic write tests;
- complete worker flood fill, deterministic generation, and large-region limits; and
- CLI self-tests, canonical SHA-256 reports, project validation, and non-destructive behavior.

The Studio integration suite also creates a populated 250×250 map and asserts viewport culling rather than full-map drawing. The worker suite fills a 120,000-cell connected region and verifies that an intentionally small cap produces a visible failure.

## Real-browser verification

Install the Playwright browser once, then run the HTTP-served suite:

```sh
npm run setup:test
npm run test:e2e
```

`tests/serve.js` starts a local static server automatically. The suite verifies the actual browser canvas workflow, responsive widths at 1600, 1366, 1180, 1024, and 960 pixels, semantic tile search, keyboard/accessibility controls, IndexedDB recovery, and service-worker activation/cache contents.

A cross-platform file-URL fallback is available for environments that cannot bind localhost:

```sh
npm run test:e2e:file
```

File mode intentionally skips service-worker assertions because browsers do not register service workers for `file:` origins. It is not a substitute for the HTTP PWA test.

Run every local source and browser gate together with:

```sh
npm run verify
```

`npm run verify:release` adds an unpacked desktop package build after those gates pass.

## Headless project CLI

```sh
node HybridTileStudioCLI.js validate-project PROJECT \
  --manifest HybridTileStudio-Tests.htgtestmanifest
```

Options:

- `--json` prints the machine-readable report.
- `--output report.json` writes a JSON report in addition to stdout.
- `--self-test` verifies canonical SHA-256 and the bundled validator.

The CLI is read-only by default. It checks core database files, MapInfos/map correspondence, dimensions, six-layer data length, tileset references, event bounds, event-command terminators and basic branch structure, direct transfer IDs, journey structure, golden checksums, stale Live bridge artifacts, World Recipe graphs, quests, content libraries, and their executable schemas. Errors exit 1; invocation/setup errors exit 2.

## Real-engine evidence

The repository includes a repeatable test-only plugin at `tests/fixtures/rpgmaker/HybridTileGraftSmokeProbe.js`. To refresh the evidence:

1. Create an isolated RPG Maker MZ project for each entry in `tests/fixtures/rpgmaker/engine-matrix.json`.
2. Copy `HybridTileGraft.js` and the probe into the project's `js/plugins` folder.
3. Enable `HybridTileGraft` first and `HybridTileGraftSmokeProbe` immediately after it.
4. Start a new playtest and wait for the map. The probe edits a region, saves through `DataManager.saveGame`, resets its runtime state, reloads through `DataManager.loadGame`, checks the restored patch and world state, measures 30 animation frames, runs the world benchmark, and removes its temporary save.
5. Require the green PASS banner and `real-engine-smoke.json`, then retain the marker and source-bound attestation under that engine's versioned `tests/evidence/rpgmaker` directory.

`npm run test:rpgmaker-evidence` verifies probe syntax, save/reload persistence, temporary-save cleanup, frame timing, benchmark output, marker contents, and hashes for the exact plugin and probe that were tested. `npm run test:rpgmaker-matrix` verifies the configured range and the installed official cores when they are available. Either evidence gate deliberately fails when its source or engine contract is stale.

The retained matrix covers the official bundled 1.8.0 corescript and the official Steam 1.10.0 new-project core. A production release still requires a playtest with the actual production plugin order and content. A Playtest Lab launch is not automatically recorded as a pass. Human-attested path evidence, checkpoints, migration results, and release gates are fingerprint-bound and become stale whenever the canonical project state changes.

## CI example

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
- run: npm run lint
- run: npm run build
- run: npm run check:generated
- run: npm test
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```

Archive the CLI report, test output, release manifest, fingerprint, asset manifest, and deployed build from the same source revision.
