# Archived Worldsmith v17 product contract

This document records the historical v17 product contract for migration and compatibility review. The current v18.1 application follows the creator-first contract in `V18_FIRST_PARTY_RELEASE.md`.

The v17 goal was immediate readability, a playful original identity, forgiving iteration, excellent controller flow, and an unusually honest definition of success.

## Everyday loop

1. **Make** in a local experiment.
2. **Preview** the exact result and change count.
3. **Apply safely** after a recovery snapshot.
4. **Test** the complete connected project.
5. **Verify** the real player path for the current fingerprint.
6. **Release** a reproducible evidence record.

In the historical v17 release, the default application loaded `HybridTileStudio.js` and `HybridTileStudioV17.js`. In v18.1, v17 code is retained only under `tests/fixtures/migrations/v17/`; it is not part of the production shell. V9–V16 remain compatible specialist modules and load only from Expert mode.

## Evidence vocabulary

- `VERIFIED`: the check ran successfully against the current project fingerprint.
- `FAILED`: the check ran and found a blocking problem.
- `NOT RUN`: no evidence exists.
- `SKIPPED`: deliberately omitted and recorded as such.
- `STALE`: evidence exists, but the project or its verification policy changed afterward.

Launching the game is never equivalent to completing a player journey. Static scans never claim observed frame rate or save size. A Worldsmith release record never claims that a platform build was created, signed, uploaded, approved, or distributed.

## Safety and trust

- Map and generated changes stay local until an explicit Apply action.
- Apply captures the previous map and then performs one save.
- Release gates bind to checksums of maps, creator systems, reusable content, and extension policy.
- Runtime save files omit Studio-only drafts, reports, recovery archives, review history, and UI preferences.
- Extension callback time/payload limits are reliability budgets in the same JavaScript process. They are not a security boundary.
- The Electron renderer uses context isolation, sandboxing, denied permissions/popups/external navigation, and a restrictive content security policy.

## Compatibility

All 196 historical `PluginManager.registerCommand` registrations and public runtime APIs remain present for event compatibility. The editor-facing Plugin Manager annotation is curated to 26 common commands; uncommon operations belong in scripts, World Recipes, or the Expert workbenches.
