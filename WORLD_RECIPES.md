# World Recipes

World Recipes turn map and game state into declarative `WHEN → IF → THEN` automation. They are part of `HybridTileGraft.js`; no companion plugin is required.

## Quick start

1. Open a full RPG Maker MZ project in Hybrid Tile Studio.
2. Open the **World** hub for Recipes, NPC Journeys, Rule Brushes, the Biome Composer, references, and simulation.
3. In Simple mode, add friendly `WHEN`, `IF`, and `THEN` blocks. Pro mode exposes the complete JSON tree when needed.
4. Use the visual flow, map overlay, and **Explain this recipe** before saving.
5. Add repeatable scenarios in **Test**, then run the project checkup and use **Share → Build for Release**.
6. Choose **Save recipe and data file**. The Studio writes `data/HybridWorldRecipes.json`.
7. Install/enable `HybridTileGraft.js`, start a new playtest, and exercise the trigger.

In v15, a recorded player journey can include a `recipe` step and an assertion after the recipe runs. Live Production 2.0 can replay that journey in the actual playtest, while the dry runner and CLI validate the portable scenario structure without pretending to execute the RPG Maker scene loop.

The data file is optional. If it is absent, HybridTileGraft continues normally. Catalogs can also be imported, exported, registered through the API, or shipped with the project.

Tooling can use `schemas/HybridWorldRecipes.schema.json` for completion and structural validation. Runtime and Studio validation additionally check handler names, interval values, duplicate IDs, nesting depth, and recipe-call cycles.

## Catalog shape

```json
{
  "format": "HybridWorldRecipes",
  "version": 4,
  "world": {
    "clock": { "day": 1, "hour": 8, "minuteOfHour": 0, "framesPerMinute": 60,
      "daysPerSeason": 30, "seasons": ["spring", "summer", "autumn", "winter"] },
    "zones": [], "entities": [], "resources": [], "variants": [],
    "npcs": [], "npcRoutes": [], "ruleLayers": [], "ruleBrushes": [],
    "biomeGraphs": [], "biomeLocks": [], "tests": []
  },
  "recipes": [
    {
      "id": "forest-weather",
      "name": "Forest Weather",
      "enabled": true,
      "priority": 10,
      "triggers": [{ "type": "playerStep" }, { "type": "mapEnter" }],
      "conditions": { "all": [{ "type": "region", "ids": [5] }] },
      "actions": [
        { "type": "setSwitch", "id": 12, "value": true },
        { "type": "weather", "weather": "rain", "power": 5, "duration": 60 }
      ],
      "cooldownFrames": 60
    }
  ]
}
```

Recipe IDs are stable save-data keys. Use letters, numbers, `.`, `_`, `:`, and `-`; do not casually rename an ID after release.

## Triggers

| Type | Useful fields | When evaluated |
|---|---|---|
| `manual` | — | `runWorldRecipe()` or the plugin command |
| `mapEnter` | — | After `Game_Map.setup` |
| `playerStep` | — | Player enters a different map cell |
| `interval` | `everyFrames` | At the requested gameplay-frame interval |
| `switchChange` | optional `id` | A switch changes value |
| `variableChange` | optional `id` | A variable changes value |
| `tileChange` | optional `operation` | HybridTileGraft changes map content |
| `stateChange` | optional `key` | Recipe world state changes |
| `zoneEnter` / `zoneExit` | optional `zoneId` | Player crosses a named World Zone boundary |
| `interaction` | — | Player presses the action button toward a map cell/event |
| `timeChange` / `dayChange` / `seasonChange` | — | The persistent World Clock changes |
| `resourceRespawn` / `resourceDepleted` | optional `resourceId` | A renewable resource changes availability |
| `entityStateChange` | optional `entityId` | A settlement, region, faction, or landmark changes state |
| `npcActivityChange` | optional `npcId` | A scheduled NPC begins a different activity |
| `scheduled` | — | A delayed or repeating recipe becomes due |
| `packInstalled` | optional `packId` | A World Pack is installed at runtime |
| any other name | — | `triggerWorldRecipes("name")` |

Use `priority` to order recipes that share a trigger. `once`, `maxRuns`, and `cooldownFrames` prevent unwanted repetition. Automatic triggers can be disabled globally with the plugin parameter while manual API/command runs remain available.

## Conditions

Conditions can be nested with `{ "all": [...] }`, `{ "any": [...] }`, and `{ "not": {...} }`. Leaf types are:

`always`, `switch`, `variable`, `state`, `map`, `region`, `terrain`, `tile`, `position`, `direction`, `gold`, `item`, `chance`, `context`, `recipeRuns`, `time`, `season`, `day`, `fact`, `zone`, `proximity`, `lineOfSight`, `worldEntity`, `resource`, `packInstalled`, `npc`, and `ruleLayer`.

Comparison operators include `==`, `===`, `!=`, `!==`, `>`, `>=`, `<`, `<=`, `includes`, `in`, and `notIn`.

Values can refer to runtime data without JavaScript:

```json
{ "context": "x" }
{ "variable": 8 }
{ "switch": 12 }
{ "state": "bridge.repaired", "scope": "map", "defaultValue": false }
```

## Actions

Built-in action types:

- Game state: `setSwitch`, `setVariable`, `setSelfSwitch`, `setState`, `commonEvent`.
- Maps: `setTile`, `fillTiles`, `setRegion`, `clearArea`, `graftPrefab`, `checkpoint`.
- Presentation: `weather`, `tint`, `message`, `log`.
- Flow/integration: `enableRecipe`, `runRecipe`, `pluginCommand`, `emit`.
- World simulation: `schedule`, `cancelSchedule`, `setClock`, `addFact`, `removeFact`, `defineZone`, `updateEntity`, `harvestResource`, and `applyVariant`.
- NPC/procedural rules: `updateNpc`, `paintWorldRule`, and `runBiomeGraph`.
- Events: `spawnEvent`, `moveEvent`, and `deleteEvent`.

Actions execute in order. `errorPolicy` is `stop` by default or `continue` when later actions should still be attempted. Recipe-call depth and condition nesting are capped at 12, and catalog validation rejects direct/indirect recipe-call cycles.

## Persistent world state

`setState` and the API store JSON-safe values in the HybridTileGraft save data. State can be global, per-map, or per-recipe:

```js
HybridTileGraft.setWorldState("bridge.repaired", true);
HybridTileGraft.setWorldState("resource.depleted", true, { scope: "map" });
HybridTileGraft.getWorldState("bridge.repaired", { defaultValue: false });
```

## Runtime API

```js
await HybridTileGraft.runWorldRecipe("repair-bridge", { x: 10, y: 8 });
await HybridTileGraft.triggerWorldRecipes("festivalStarted", { faction: "town" });
await HybridTileGraft.runWorldRecipe("repair-bridge", {}, { dryRun: true });

HybridTileGraft.listWorldRecipes();
HybridTileGraft.validateWorldRecipeCatalog(catalog);
HybridTileGraft.worldRecipeDiagnostics();
HybridTileGraft.setWorldRecipeEnabled("repair-bridge", false);
HybridTileGraft.resetWorldRecipeState("repair-bridge");

HybridTileGraft.setWorldClock({ day: 3, hour: 18 });
HybridTileGraft.defineWorldZone({ id: "town.square", mapIds: [1], rect: { x: 8, y: 6, width: 10, height: 8 } });
HybridTileGraft.defineWorldResource({ id: "forest.herbs", quantity: 3, capacity: 3, respawnMinutes: 1440 });
HybridTileGraft.scheduleWorldRecipe("festival-start", { minutes: 60 });

HybridTileGraft.defineWorldNpc({ id: "ada", name: "Ada", schedule: [
  { id: "ada-work", activity: "Working", start: 480, end: 1020, mapId: 1, x: 8, y: 6 }
] });
HybridTileGraft.simulateWorldTimeline({ minutes: 1440, stepMinutes: 60 });
HybridTileGraft.defineWorldRuleLayer({ id: "encounters", mapId: 1, kind: "encounter", cells: {} });
HybridTileGraft.paintWorldRules("encounters", { x: 4, y: 4, width: 6, height: 5 }, "forest");

await HybridTileGraft.explainWorldRecipe("repair-bridge", { mapId: 1, x: 10, y: 8 });
await HybridTileGraft.runWorldRecipeTestSuite();
```

## World Director data

The optional `world` object in `HybridWorldRecipes.json` is edited in the Studio's **World Systems** area and loaded with the recipe catalog:

- `clock`: persistent minute, day, season order, rate, and season length.
- `zones`: rectangular, polygon, or region-based named areas.
- `entities`: settlements, regions, factions, and landmarks with a persistent `state`, tags, and properties.
- `resources`: quantity, capacity, and World Clock respawn delay.
- `variants`: alternate map forms routed to a recipe or change set.
- `npcs`: persistent people with homes, jobs, relationships, schedules, positions, activities, and state.
- `ruleLayers`: sparse painted cells carrying encounter, spawn, traffic, biome, or custom gameplay values.
- `biomeGraphs`: dependency-checked deterministic climate, road, river, dungeon, WFC, scatter, and rule stages.
- `runtimeBudget`: frame time, recipe queue, simulation batch, and spatial index settings.
- `tests`: rollback-safe scenarios with initial values and assertions.

## Live playtest bridge

v14 adds the Live Production bridge used by the new console. It exchanges bounded JSON through `data/HybridTileLiveCommands.json` and `data/HybridTileLiveState.json`, and writes the most recently completed recording to `data/HybridTileLastRecording.json`. Use `startLiveProductionSession`, `liveProductionState`, `pumpLiveProductionSession`, and `stopLiveProductionSession` when integrating custom playtest tooling. The older `.hybrid` catalog hot-reload bridge below remains supported.

1. In a playtest event or script, start the plugin bridge on the project `.hybrid` folder:

   ```js
   HybridTileGraft.startWorkspaceBridge(".hybrid");
   ```

2. In the Studio choose **Test → Send to playtest**.
3. The runtime polls `HybridTileGraft.incoming.json`, validates the catalog, and reloads recipes and world-system definitions without restarting the game.

The bridge is local and optional. Normal releases do not require it.

Live Production also exposes `startPlaytestRecording`, `recordPlaytestAction`, `stopPlaytestRecording`, `createScenarioFromRecording`, and `runRecordedScenario`. Recordings and generated scenarios use the portable schemas in `schemas/HybridPlaytestRecording.schema.json` and `schemas/HybridPlaytestScenario.schema.json`.

## World Packs

World Packs use the `HybridWorldPack` format and `.htgworld` extension. A pack can include recipes, prefabs, event templates, zones, entities, resources, variants, NPC lives, NPC travel routes, rule layers, rule-brush presets, biome graphs, tests, state defaults, capabilities, dependencies, integrity metadata, and version metadata.

Use **Worldstudio → Packs** or the expert World Pack manager. Runtime APIs include `validateWorldPack`, `previewWorldPackInstall`, `installWorldPack`, `uninstallWorldPack`, `rollbackWorldPack`, `listWorldPackHistory`, `worldPackLockfile`, and `exportWorldPack`. v12 added deterministic integrity metadata, local publisher trust, and catalog subscriptions. v13 adds semantic range resolution, ordered dependency plans, pack repositories, explicit permission manifests, and schema v4 atlas/quest/repair/extension contributions. Integrity digests detect changed content; they are not a claim of cryptographic authorship unless an external signing system supplies and verifies a real signature. Installation records content ownership and a baseline so uninstall restores pre-pack values without removing unrelated project changes. See `schemas/HybridWorldPack.schema.json`.

## World Workshop systems

- **Simulator** predicts clock, NPC, resource, and scheduled-recipe changes without mutating the project.
- **NPC Lives** authors daily, overnight, weekday, and seasonal routines plus homes, jobs, and relationships.
- **Rule Paint** attaches sparse gameplay values to selected map cells and compiles them into recipes.
- **Biome Composer** validates dependency graphs and runs them transactionally with deterministic seeds.
- **Map Operations** previews connected-map transformations, repairs direct transfers, and performs exact six-layer/event grafts.
- **Project Care** manages compatibility reports, recovery snapshots, pack lifecycle, performance budgets, accessibility, and updates.
- **Content Library** searches installable local catalogs and exports private project catalogs.

Content catalogs use the `HybridContentCatalog` format and `.htgcatalog` extension. Each searchable item embeds an installable World Pack, biome graph, rule layer, or prefab pack. Imports are size-limited and validate stable IDs, unique item IDs, supported types, and required payloads before writing `.hybrid/HybridContentCatalog.json`. See `schemas/HybridContentCatalog.schema.json` and `examples/StarterContentCatalog.htgcatalog`.

## Debugging, testing, and performance

- `explainWorldRecipe` returns a nested decision tree with the result of every condition.
- Breakpoints pause a recipe before its conditions/actions; use `resumeWorldRecipe` to continue.
- Recipe logs keep serializable trigger context and can be replayed with `replayWorldRecipeLog`.
- `worldRecipePerformance` reports run counts, failures, last/average/max duration.
- `runWorldRecipeScenario` snapshots switches, variables, plugin state, and the active map, evaluates assertions, and restores the snapshot unless `commit:true` is explicitly requested.
- `runWorldRecipeTestSuite` runs stored or supplied scenarios sequentially and returns a pass/fail report.

Extension plugins can add allow-listed declarative capabilities:

```js
HybridTileGraft.registerWorldRecipeCondition("reputation", ({ condition }) => {
  return MyReputation.value(condition.faction) >= condition.minimum;
});

HybridTileGraft.registerWorldRecipeAction("awardReputation", ({ action }) => {
  MyReputation.add(action.faction, action.amount);
});
```

For catalogs authored before the extension is running, prefer namespaced types such as `MyGame.reputation` and `MyGame.awardReputation`. Studio/runtime validation accepts namespaced extension types with a warning; execution still fails safely unless the matching handler is registered.

## Testing and safety

- Simulation never modifies map or project data.
- Switches, variables, inventory, terrain flags, and third-party state may only be known during playtest; Studio reports them as runtime-dependent.
- Start with recipes disabled when they make large map changes, validate, dry-run, then enable them.
- Prefer `once`, cooldowns, or state guards for actions that persist tile changes.
- Keep the project in source control and test new games plus migrated saves.
