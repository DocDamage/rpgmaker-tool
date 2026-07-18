# Creator Console v15

Creator Console is Hybrid Tile Studio’s result-first production surface. It does not replace the earlier expert workbenches; it organizes the full project loop and links back to them when a specialized canvas is useful.

## Areas

| Area | Purpose |
|---|---|
| Home | Recommended next step, milestones, safety, project pulse, themes and comfort settings |
| Events | Full-catalog visual MZ event/page/command design, plugin metadata and movement routes |
| Tilesets | Rendered bank inspection, native flags, semantics, raw sheets, audits and backed-up save |
| Live | Protocol 2 playtest handshake, watched state, commands, logs, recording and diagnostics |
| Tests | Player journeys, setup/assertions, golden maps, suite history and CI manifest export |
| Search | Maps/events/commands/content, bookmarks and preview-first reference rename |
| Intelligence | Native passage graph, semantics, landmarks, disconnected areas, autorun and softlock findings |
| Performance | Map/event/command/save complexity, representative benchmarks and recommendations |
| Extensions | Manifest permissions, Worker probe, budgets, publisher trust, failures and quarantine |
| Team | Visual branches, reviews, canonical Git diff, bundle comparison and merge-plan export |
| Ship | Recovery, gates, cleanup, fingerprints, comparison, desktop targets and CI manifests |

## Controls

- Mouse/touch: all controls use visible labels and large targets.
- Keyboard: `Ctrl/Cmd+K` or `X` opens Commands, `Y` or `?` opens the guide, arrow keys move spatially, `Page Up/Down` changes areas, and `Escape` closes the current sheet or console.
- Controller: A selects, B goes back, X opens Commands, Y opens the guide, D-pad navigates, and LB/RB changes areas.
- Undo/redo: the top bar covers v15 map and file transactions completed in the current console session. Persistent snapshots and project recovery remain available for older work.

Cloud, Midnight, and Berry themes share the same semantic colors and visible focus. UI scale, optional feedback tones, and reduced motion are stored in Studio metadata. Guided mode emphasizes the production path; Expert mode keeps the same data model and exposes denser controls where available.

## Write and recovery contract

- Event edits remain a draft while the user moves between console areas. **Apply Reversibly** writes one authoring-layer event change and records session history.
- Tileset paint remains an in-memory working copy until **Save with Backup**. The explicit save creates a project-local recovery copy and an interrupted-write journal before replacing `data/Tilesets.json`.
- Semantic profiles and extension policies use the same transaction wrapper.
- Universal restore points copy selected RPG Maker data, all maps, recipes and Studio metadata under `.hybrid/recovery/` with a manifest. Restore requires a second confirming press.
- Live bridge cleanup is armed on its first press and removes only the three known bridge files on confirmation.

Keep external backups or source control. Project-local recovery protects normal authoring mistakes and interrupted writes; it is not a substitute for an off-device backup.

## Original product identity

The console uses an original Hybrid Tile Studio interface, guide character, icons, themes and wording. It aims for the clarity and finish of a first-party creative tool without copying Nintendo, VisuStella, Ritter, Tyruswoo, or another company’s protected branding or assets.
