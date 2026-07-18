# Hybrid Tile Studio v16 feature matrix

HybridTileGraft is an independent implementation inspired by the workflows named by the user. It does not reproduce proprietary source code or guarantee command-name compatibility with commercial plugins.

| Workflow | Runtime plugin | Desktop/PWA Studio |
|---|---:|---:|
| Exact and reconnecting tile grafts | Yes | Yes |
| RPG Maker MZ tile codes and exact IDs | Yes | Yes |
| A1–A4 animated/table autotile rendering | Runtime engine | Exact Studio renderer |
| Whole-map resize/crop/rotate/mirror | Yes | Clipboard/selection transforms |
| Remote/unloaded map editing | Yes | Multi-map project tabs |
| Six tile/shadow/region layers plus events | Yes | Yes |
| Non-destructive authoring layers and masks | Yes | Yes |
| Visual event/page/command editing | Runtime event tools | Full visual workbench |
| Event templates and reference scans | Yes | Yes |
| Versioned prefabs, variants, dependencies, linked instances | Yes | Yes |
| Biome/dungeon/road/river/graph generation | Yes | Yes |
| Learned backtracking WFC | Yes | Multi-layer Web Worker WFC |
| Transactions, checkpoints, recovery, retained backups | Yes | Yes |
| Branches, three-way merge, review records | Yes | Threaded reviews and attachments |
| Compatibility adapters/lab | Yes | Yes |
| Project dependency and asset audits | Dependency audit | Dependency and asset manager |
| Canonical exports and source-control workflow | Export API | Desktop Git workspace |
| Extension brushes/generators/validators | Yes | Yes |
| World Recipes, persistent state, automatic triggers | Full runtime engine | Visual editor, templates, validation, simulation |
| Time, days, seasons, zones, facts, places, resources | Persistent simulation | Friendly World Systems editor |
| Recipe schedules, chains, delays, variants | Yes | Visual block authoring |
| Decision traces, breakpoints, replay, profiling | Runtime APIs | Explain view and timeline |
| Scenario tests with state rollback | Headless runtime suite | Test Lab authoring |
| Reusable World Packs and dependency checks | Import/export/install APIs | Pack manager and `.htgworld` association |
| Live recipe reload during playtest | Local file bridge | One-click send to playtest |
| Release readiness and stripped bundle | Health/profile APIs | Ship workspace |
| Task-first Simple/Pro interface | Runtime editor preferences | Home hub, command palette, controller navigation |
| Non-mutating world timeline simulation | Clock/NPC/resource/schedule APIs | Interactive time scrubber and trace export |
| NPC homes, jobs, relationships, and schedules | Persistent NPC life engine | Visual NPC Life Designer |
| Painted gameplay/encounter/spawn/biome rules | Spatial rule-layer queries and recipe conditions | Visual Rule Painting and recipe compilation |
| Deterministic procedural dependency graphs | Transactional graph runner | Biome Composer and selected-area regeneration |
| Connected-map batch transforms and transfer repair | Batch transform APIs | Group preview and reversible authoring layers |
| Pack upgrades, lockfile, uninstall, rollback | Owned-content lifecycle APIs | World Pack lifecycle manager |
| Runtime budgets, spatial indexes, heatmaps | Full diagnostics/optimization APIs | Performance Center |
| Searchable reusable content catalogs | Catalog registration/install APIs | Built-in and project Content Library |
| Accessibility/localization/onboarding | Stored preferences | Full UI controls |
| Installers, file associations, update client | Not applicable | Electron desktop |
| Five-hub console-style navigation | Runtime editor preferences | Create, World, Test, Share, Settings |
| Full controller parity and spatial focus | Stored gamepad preferences | A/B/X/Y, D-pad, shoulder hub navigation, optional vibration |
| Guided creation journeys | Matching runtime APIs | Graft, transform, NPC route, recipe, biome, and pack wizards |
| Timed NPC travel and occupancy | Route interpolation and arrival triggers | Journey builder and route overview |
| Gradient/shape rule brushes | Weighted cells, filters, statistics | Preset builder and visual Rule Canvas handoff |
| Procedural stage cache and authored-cell locks | Persistent cache/lock APIs | Cached graph metadata and protected-cell workflow |
| Recipe watches and single-action stepping | Persistent debugger history | Step-by-step Recipe Debugger |
| World project reference graph | Dependency graph API | Visual reference overview |
| Pack integrity and publisher trust | Digest verification and local trust store | Publisher and Integrity center |
| Catalog subscriptions and version checks | Subscription/update APIs | Catalog Subscription center |
| Benchmarks and background job history | Runtime benchmark history | Benchmark Lab and Job Center |
| Direct visual map canvas | Runtime patch/layer APIs | Tile/shadow/region/event canvas with paint, erase, fill, line, rectangle, pick, selection, zoom, minimap, and comparison |
| Multi-map World Atlas | Transfer graph and cycle analysis APIs | Connected draggable-style atlas view, broken/disconnected transfer findings, direct map navigation, and export |
| Event and quest dependency graph | Project event/state graph API | Searchable event/page/switch/variable/common-event/recipe connection inspector |
| Intelligent map repair | Structural analysis and confidence-gated repair API | Map Doctor findings, explicit repair preview, selected safe fixes, and reversible application |
| Advanced NPC direction | Full-day route/occupancy simulation API | Timeline authoring, activity blocks, traffic conflicts, and schedule export |
| Visual history and diff | Checksummed snapshots and cell/event diff API | Named restore points, session baselines, branches, recovery policy, and journal access |
| Semantic pack dependency planning | Range resolver, repositories, capabilities, and permissions | Install-order preview, ownership safety, versions, and Pack schema v4 |
| Permissioned extension SDK | Validated manifests and capability-gated contexts | Manifest workbench, schema, examples, SDK guide, and declarative contributions |
| Golden-map and production validation | Golden checksum, atlas/logic/map validation, deployment reports | Release Center, backed-up plugin install/update, playtest checklist, and canonical report export |
| Worldstudio product experience | Stored preferences and controller settings | Nine focused views, Beginner/Expert modes, creator journey, command palette, contextual Pip help, responsive UI |
| Live playtest production bridge | Watched state, commands, acknowledgements, session history | Launch/attach, state monitor, recipe reload, transfer/state controls, snapshots, pause/resume intent |
| Playtest recording and regression scenarios | Runtime action recorder and deterministic scenario runner | Recording import/export, scenario generation, assertions, run history, golden-map baselines |
| Complete MZ event command round-trip | Standard-code structural validator; unknown codes preserved | Visual command tree, page settings, JSON parameters, reorder/duplicate/delete, reversible apply |
| Semantic tiles and map understanding | Persistent tileset profiles and reachability reports | Semantic label editor, landmark/features report, heatmap, Map Doctor handoff |
| Production tileset workflow | Runtime semantic queries | Asset scan, passage/terrain flags, timestamped backup, safe save, reversible tile remap |
| Sandboxed extension contributions | Time/payload budgets, failure history, quarantine | Manifest security center and isolated Worker probe |
| Unified content collections | Recipes, prefabs, graphs, packs, brushes, templates, catalogs | Search, filters, favorites, collections, pack handoff |
| Portable collaboration reviews | Review/branch/atlas/quest/lock bundle API | `.htgreview` exchange, visual branches, review threads, Git status |
| Reproducible release engineering | Clean bundle and stable release fingerprint APIs | `.htgrelease`, `.htgfingerprint`, golden/security/live gates, desktop build manifests |
| Eleven-area Creator Console | Production services and stored preferences | Home, Events, Tilesets, Live, Tests, Search, Intelligence, Performance, Extensions, Team, Ship |
| No-JSON full-catalog event design | Command validator and opaque command preservation | Direct controls, structured routes, plugin metadata, drag tree, page settings, reversible apply |
| Visual native tileset workshop | Semantic/passage query APIs | Rendered banks, flag painting, semantics, raw sheets, transaction backup and restore |
| Live Production protocol 2 | Handshake, heartbeat, sequences, state hash, acknowledgement, diagnostics | Launch/attach, logs, watched state, recovery, recording and safe cleanup |
| Automated player journeys | Deterministic dry/execute runner and production suite | Scenario editor, recorder import, assertions, golden maps, CI manifest |
| Headless project validation | Bundled read-only Node CLI | CI-compatible structural, event, transfer, scenario and golden-map validation |
| Universal recovery points | Runtime world recovery snapshots | Multi-file Studio restore manifests, crash journal, two-step restore, universal undo/redo |
| Project reference navigation | Canonical workspace search and rename plans | Cross-map/content search, bookmarks, exact preview-first reversible rename |
| Passage-aware softlock detection | Native flag/semantic graph and runtime reports | Reachability map, landmarks, one-way/disconnected/autorun explanations |
| Extension isolation and publisher trust | Security profiles, quarantine and verification APIs | Worker probe, time/payload/path/network budgets, failure history, local trust |
| Compatibility profiles | Public global/method/order checks | Built-in plus portable `.htgcompat` profiles and visible guidance |
| Collaboration comparisons and merge plans | Portable bundle diff/plan APIs | Review bundle comparison, canonical Git diff, non-applying selective plan |
| Release pipeline v15 | Fingerprint comparison, manifests, production handoff gate | Platform/signing/update manifest, clean bundle, CI template, release explanation |
| Ten-workspace Worldsmith suite | Durable v16 data models and Safe Mode | Dashboard, Map Studio, Recipes, Quests, Playtest, Experience, Library, Team, Extensions, Production |
| Visual map working drafts | Draft/paint/fill/rectangle/undo/commit APIs | Six layers, overlays, zoom, undo/redo, round-trip preview, snapshots, reversible apply |
| Compiled generation graphs | Stage compiler, locks, deterministic regeneration metadata | Node stages, connections, constraints, seeds, locks, compile preview, project persistence |
| Quest and cutscene projects | Reachability validation and timed cue models | Objective/choice/dialogue/reward/transfer graph and multi-track timeline |
| Worldsmith Playtest Laboratory | Journey suite, softlock checks, performance budgets, bug bundle | Real-game launch, all-map scan, CI manifest, golden/fuzz/save/budget workflows |
| Versioned creator content | Content registration and search APIs | Capture, tags, favorites, dependencies, checksums, export, reversible install |
| Canonical source snapshots and three-way merge | Canonical snapshot and path-conflict APIs | Checkpoints, branches, review bundles, Git status, merge explanation |
| Extension capability policies | Capability allowlist, isolation and resource budgets | Explicit per-extension permission review and project policy files |
| Production health dashboard | System/performance/test/compatibility/security aggregation | Whole-project score, release gates, targets, notes, reproducible manifest |

## Deliberate boundaries

- Commercial plugin code, assets, encryption, and proprietary command names are not included.
- RPG Maker database files are only changed after an explicit save/write action. Risky asset and tileset-flag writes create backups.
- Code signing, notarization, and update hosting require the distributor's own credentials and release infrastructure.
- Third-party movement, lighting, minimap, or tilemap plugins can alter runtime behavior. Run the Compatibility Lab and test the actual game stack before release.
- Studio simulations do not pretend to know playtest-only switch, variable, inventory, terrain-flag, or third-party state; these are clearly reported as runtime-dependent.
