# Compatibility profiles v15

Compatibility profiles document public integration assumptions without copying or depending on proprietary plugin internals. They detect installed plugin names and check public globals, method types, or plugin order.

## Profile shape

```json
{
  "format": "HybridCompatibilityProfile",
  "version": 1,
  "id": "movement-public-api",
  "name": "Movement public API",
  "plugins": ["Movement"],
  "signatures": ["Game_CharacterBase.prototype.canPass"],
  "guidance": "Test diagonal passage and transfer arrival with the production stack.",
  "severity": "warning"
}
```

Runtime profiles registered through `registerCompatibilityProfileV15` use a `pluginNames` array and `checks`:

- `{ "type": "global", "path": "Imported.VisuMZ_1_EventsMoveCore" }`
- `{ "type": "method", "path": "Game_CharacterBase.prototype.canPass", "expected": "function" }`
- `{ "type": "pluginOrder", "before": "Foundation", "after": "HybridTileGraft" }`

`runCompatibilityProfilesV15()` returns detection, actual values and pass/fail results. A profile that is not detected is skipped rather than treated as failure. Suppressions are explicit metadata and should include a project reason in accompanying review notes.

## Built-in guidance

The Studio includes broad public-profile guidance for foundational engine suites, movement/collision, lighting, and minimap plugins. These checks are deliberately conservative:

- place HybridTileGraft according to the third-party plugin’s documented public order requirements;
- verify native and diagonal passage, transfer arrival, vehicle and follower movement;
- verify tilemap/minimap/light caches after runtime tile changes and map reload;
- record the actual production plugin list and repeat representative journeys after upgrades.

Passing a compatibility profile is evidence that declared public assumptions exist. It is not certification by the third-party author and cannot guarantee behavior inside undocumented/private hooks.

## Release use

Run profiles after plugin updates and before the final fingerprint. Store portable `.htgcompat` files with the project, review failures in **Performance** or **Extensions**, and include the compatibility report in the production handoff. The release gate blocks declared failing runtime checks; human test guidance remains a checklist item.
