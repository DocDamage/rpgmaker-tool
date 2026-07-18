# Desktop build v18.1

Requirements: Node.js 22 or later and npm. The release-root files are generated from `src/`; do not edit generated files without synchronizing them back into the source tree.

## Source and generated files

- `src/runtime/parts/` contains the authored RPG Maker runtime sections. `npm run build` assembles the compatible single-file `HybridTileGraft.js`.
- `src/studio/` contains the active v18.1 browser/desktop shell.
- `src/desktop/` contains Electron main/preload adapters.
- `HybridTileSchemasV18.js` and `asset-manifest.json` are generated from `schemas/` and the release assets.
- v17 is retained under `tests/fixtures/migrations/v17/` and is not shipped as an active application surface.

When an emergency edit is made to an active root Studio or Electron file, run `npm run sync:source` before rebuilding. Runtime plugin changes should be made directly in the appropriate `src/runtime/parts/*.js` file.

## Install, verify, and run

```sh
npm ci
npm run build
npm run check:generated
npm test
npm start
```

Run real-browser verification before packaging:

```sh
npm run setup:test
npm run test:e2e
```

## Package

```sh
npm run dist:dir
npm run dist
```

`npm run dist` builds targets for the host operating system. Use `.github/workflows/build-desktop.yml` on GitHub to build Windows, macOS, and Linux artifacts in parallel. Windows output includes NSIS, portable, and ZIP targets. macOS includes DMG and ZIP. Linux includes AppImage and tar.gz.

The packaged Electron bridge uses renderer sandboxing, context isolation, denied unexpected navigation/popups/permissions, project-root path checks, recent-project health, and atomic temporary-file replacement for project writes.

## Project-level release gate

Export a test manifest from **Worldsmith → Playtest Lab** and run:

```sh
node HybridTileStudioCLI.js validate-project /path/to/project \
  --manifest /path/to/HybridTileStudio-Tests.htgtestmanifest
```

The validator is read-only unless `--output report.json` is supplied. It checks database/map presence, map dimensions and tile-data length, tilesets, event positions and command structure, direct transfers, journeys, golden-map checksums, stale Live Production artifacts, World Recipe graph references, quest validity, content identifiers, and schema conformance.

## Signing and notarization

Unsigned local builds are suitable for testing. Shipping trusted installers requires credentials that are intentionally not included. Electron Builder reads them from environment or CI secrets:

- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`
- macOS: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

Use `npm run dist:signed` to fail the build if a signing identity is missing. Never commit certificates, private keys, or passwords. Ed25519 world-pack keys are independent of OS installer-signing credentials.

The tag workflow enforces signing on Windows and macOS through `dist:update` and refuses to upload missing artifacts. A self-signed development certificate proves that the signing pipeline works but does not establish public OS trust; public releases require a certificate whose chain is trusted on clean user machines.

## Updates

`electron-updater` is wired to the Project panel but only checks from a packaged build. Configure an Electron Builder publish provider in CI and publish each installer together with its generated `latest*.yml` metadata. Do not mix metadata and binaries from different builds. macOS update builds must be signed/notarized; Windows updates use the NSIS target.

Release CI uses `npm run dist:update`. It requires `HTG_UPDATE_URL` to be an HTTPS generic-provider base URL, generates matching update metadata without publishing, and enforces code signing on Windows/macOS. Publishing the resulting binaries, blockmaps, and `latest*.yml` files remains a separately approved deployment action.

The PWA update path is separate: a new service worker waits for explicit user acceptance, then reloads into a content-hash-verified shell.

## File types

Installers register Worldsmith `.htgmapdraft`, `.htggraph`, `.htgquest`, `.htgcontent`, and `.htgbug` files in addition to the existing Hybrid Tile Studio formats. The Studio validates associated files and enforces a 20 MiB limit before handing them to an importer.
