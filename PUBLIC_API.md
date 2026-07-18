# HybridTileGraft public API contract

The generated `HybridTileGraft.api.json` inventory contains 540 public entries: 531 stable, 9 compatibility, 0 experimental, and 0 deprecated. `HybridTileGraft.d.ts` exposes the same names to JavaScript-aware editors.

## Stability policy

Stable APIs require a major release to remove. Deprecated APIs remain for at least two minor releases and include a documented replacement when one exists.

The contract test rejects missing, duplicate, or unclassified exports. Detailed argument and return shapes continue to be documented in the plugin help and format schemas; declarations intentionally use `unknown` until an API receives a narrower reviewed signature.
