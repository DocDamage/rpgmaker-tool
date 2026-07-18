# Release engineering

Worldsmith v16 adds a whole-project Production Dashboard before this pipeline. Its score combines map integrity, direct transfers, project budgets, the latest Playtest Laboratory run, source checkpoints, and extension-policy review. A v2 `.htgmanifest` is generated only after the current health scan is release-ready; it records the selected channel, version, targets, notes, health report, and project fingerprint.

The v15 Ship workspace turns a validated Hybrid Tile Studio project into auditable handoff artifacts. It does not replace RPG Maker deployment, code signing, platform notarization, or an external backup.

## Release gates

Run the full check after stopping Live Production. Ship combines project/map validation, World Atlas and logic checks, Map Doctor findings, scenario results, golden-map comparisons, extension sandbox/quarantine state, pack locks, and runtime compatibility. Errors block readiness; warnings remain visible for review.

## Artifacts

- `.htgfingerprint` identifies canonical workspace, recipes, extensions, and pack lock state with deterministic FNV-1a digests. It detects changed inputs; it is not a cryptographic signature.
- `.htgrelease` is a clean production bundle with editor-only histories, recordings, active sessions, benchmark records, collaboration data, and validation runs stripped from its world-director payload.
- `.htgreview` contains portable review threads, comments, branch context, selected maps, atlas/quest summaries, pack lock, and optional notes.
- The deployment report records checks and findings for human review.
- The desktop build manifest lists Windows, macOS, and Linux targets and their signing requirements.
- `.htgmanifest` records release channel, targets, signing expectations, update metadata, exclusions, source revision, and checksums without embedding credentials.
- `.htgmerge` records a review-bundle comparison and manual/selective merge decisions. It never applies project mutations by itself.
- `.htgtestmanifest` carries repeatable player journeys and golden-map identities for the bundled CLI validator.

## Recommended sequence

1. Commit or externally back up the project.
2. Run all recorded scenarios and compare golden maps.
3. Review Map Intelligence, Map Doctor, Atlas, extension permissions, and quarantine state.
4. Stop Live Production and create a final named recovery snapshot.
5. Run `node HybridTileStudioCLI.js validate-project PROJECT --manifest HybridTileStudio-Tests.htgtestmanifest` in CI and resolve errors.
6. Run Ship validation and resolve all errors.
7. Create and compare the final fingerprint; export the report, clean bundle, and release manifest together.
8. Deploy the RPG Maker project and build platform packages using `BUILD_DESKTOP.md`.
9. Archive the source revision, pack lock, artifacts, manifest, CLI report, and checksums used for the release.

Re-create the fingerprint after any project, recipe, pack, extension, or relevant workspace change. Signing/notarization secrets are never included in this package.
