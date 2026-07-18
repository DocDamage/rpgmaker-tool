# Live Production

Hybrid Tile Studio v16 connects its Live workspace and Worldsmith Playtest Laboratory to an RPG Maker MZ playtest through small project-local JSON files. The connection is optional, restricted to playtest by default, and does not require a network server.

## Protocol 2

The Studio first writes `startSession` and `handshake` commands with protocol version 2. The runtime returns its session ID/token, capabilities, heartbeat interval, state hash, sequence, bounded logs, and latest acknowledgement. A newer unsupported protocol is rejected instead of guessed. The connection is considered stale when heartbeats stop; reconnecting negotiates the existing session without silently changing project data.

Protocol 2 capabilities include handshake, heartbeat, state diff identity, acknowledgement, recording, journey replay, recipe reload, universal recovery, diagnostics, and stale cleanup. The files remain local authoring artifacts—not authentication or a network security boundary.

## Start from the Studio

1. Open the RPG Maker project in Hybrid Tile Studio.
2. Choose **Live**, select watched switch and variable IDs, then choose **Launch / Attach**.
3. If a known exported game executable is available, the desktop app launches it with playtest options. Otherwise start playtest from RPG Maker; the runtime discovers the pending start command.
4. Confirm the map, position, watched values, recipe count, acknowledgement, and errors shown in Live.

The bridge uses:

- `data/HybridTileLiveCommands.json` for commands from the Studio.
- `data/HybridTileLiveState.json` for the latest bounded runtime snapshot.
- `data/HybridTileLastRecording.json` for the most recently completed recording.

These are authoring artifacts. Exclude them from a clean production release or delete them after the session.

## Runtime API

`startLiveProductionSession(options)` starts a session; `negotiateLiveProduction(options)` performs the protocol handshake; `liveProductionState()` returns the current serializable snapshot; `pumpLiveProductionSession(force)` processes pending commands; and `stopLiveProductionSession(options)` closes it. Sessions retain a short audit history. Release builds reject session start unless `allowProduction: true` is intentionally supplied.

Supported command types include `startSession`, `handshake`, `ping`, `stopSession`, `setSwitch`, `setVariable`, `transfer`, `runRecipe`, `reloadRecipes`, `setWorldState`, `startRecording`, `stopRecording`, `runJourney`, `runTestSuite`, `recoveryPoint`, `diagnostics`, `snapshot`, `pause`, and `resume`. Pause/resume toggles the Live Production intent flag; it does not freeze RPG Maker's scene loop.

## Record and repeat

Start a recording before walking a representative player journey. The runtime records state changes, transfers, map entry, movement, interaction, recipe activity, and live commands. Stop the recording, import it in **Tests**, and create a deterministic scenario. Scenarios contain a setup snapshot, supported steps, and final assertions; dry runs validate the artifact without mutating state.

Keep recordings focused. A hard cap prevents unbounded history, but short named journeys produce clearer regression tests. Portable formats are defined by `schemas/HybridPlaytestRecording.schema.json`, `schemas/HybridPlaytestScenario.schema.json`, and `schemas/HybridPlaytestJourney.schema.json`.

## Safety and troubleshooting

- Back up the project and use a dedicated playtest save.
- Only one active Live Production session is supported.
- Command files larger than 1 MiB are ignored.
- A failed command is acknowledged with its error; correct the input and send a new command ID.
- Stop the session before release validation so the Ship gate can confirm no live authoring bridge remains active.
- The first **Clean stale files** press arms cleanup; the second removes only the three known bridge files. Runtime cleanup refuses to run during an active session unless `force` is explicit.
