# RPG Maker MZ engine compatibility

Supported range: **>=1.8.0 <=1.10.0**. This file is generated from `tests/fixtures/rpgmaker/engine-matrix.json`.

| Engine | Role | Source | Retained evidence |
|---|---|---|---|
| 1.8.0 | minimum-supported | Official RPG Maker MZ bundled corescript v1.8.0 | `tests/evidence/rpgmaker/1.8.0/real-engine-smoke.json` |
| 1.10.0 | current-stable | Official Steam RPG Maker MZ new-project corescript | `tests/evidence/rpgmaker/1.10.0/real-engine-smoke.json` |

Each marker must come from the official editor or an official bundled corescript, use the exact generated `HybridTileGraft.js` and smoke probe, complete a real save/reset/load cycle, record save size and frame timing, and clean its temporary save. Run `npm run test:rpgmaker-evidence` to reject stale evidence.
