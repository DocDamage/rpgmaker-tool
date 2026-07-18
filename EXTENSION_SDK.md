# Hybrid Tile Studio Extension SDK v18

Hybrid Tile Studio extensions add brushes, generators, validators, World Recipe nodes, or Studio panels through a manifest with explicit permissions. Start with `extensions/example-v16-extension.json` and validate it against `schemas/HybridStudioExtension.schema.json`.

Worldsmith keeps a creator-visible `capabilityPolicy`: enabled/reviewed state, granted capabilities, requested isolation, execution-time budget, and serialized-payload budget. Capabilities such as `project:write`, `network`, `process`, and `clipboard` should be granted only after inspecting the extension's implementation and purpose.

## Permissions

`EXTENSION_CAPABILITIES.md` is generated from the canonical capability registry and is authoritative for manifest validation, runtime permission grants, Worldsmith capability policies, and JSON Schema values. The summary below describes the most common extension-context operations.

- `map:read` reads composed map snapshots.
- `map:write` creates reversible map changes.
- `world:read` reads World Recipe state and catalogs.
- `world:write` changes explicit world data.
- `project:validate` contributes to project validation.
- `pack:manage` resolves or installs content packs.
- `ui:contribute` adds declared Studio tools or panels.

Request only the capabilities the extension uses. Installing a manifest does not silently grant permissions. The runtime `createExtensionContext(id)` exposes only approved operations and throws when a missing capability is requested.

## Runtime registration

Use `HybridTileGraft.installExtensionManifest(manifest, options)` and then explicitly call `setExtensionPermissions`. Existing callback registration APIs remain available for trusted project code: `registerStudioExtension`, `registerExtensionBrush`, `registerExtensionGenerator`, and `registerExtensionValidator`.

The legacy `configureExtensionSandbox(id, options)` and `runSandboxedExtensionContribution(id, type, name, input)` names remain for compatibility. Their reported isolation is `same-process-budget` and `securityBoundary` is `false`: they enforce serialized-input and elapsed-time budgets, record failures, and quarantine after repeated failures, but they do not isolate JavaScript. `runBudgetedExtensionContribution` is the clearer alias. Only an actual Worker or separate process is an isolation boundary; trusted same-process code still requires review.

## Studio registration

Trusted scripts loaded after `HybridTileStudio.js` can use `registerExtension`, `registerBrush`, `registerGenerator`, and `registerValidator`. Declarative manifests can be validated and stored without executing arbitrary code. The v15 Extension Security Center probes manifest contributions in an isolated Web Worker, records failures, keeps publisher trust local, and creates a timestamped backup before replacing a project manifest.

## Safety contract

Map writes should become reversible authoring layers. File replacements must create a backup. Extension interfaces must not use `eval`, `Function`, remote script injection, or hidden network calls.
