# Hybrid Tile Studio v18 playtest checklist

- [ ] Run Worldsmith's structural lab and confirm the result is `VERIFIED`, not stale.
- [ ] Launch the real RPG Maker engine, complete the written critical path, and record the human attestation.
- [ ] Change one map tile and confirm the prior lab and playtest evidence become `STALE`.
- [ ] Capture and compare golden maps after intentional layout changes.
- [ ] Make a runtime save in-engine and confirm its actual size is under the project budget.
- [ ] Measure frame timing in a representative exported/playtest build; static map budgets are not frame-rate proof.
- [ ] Capture a recovery checkpoint for the exact release fingerprint.
- [ ] Explicitly review every loaded extension; same-process budgets are not security isolation.
- [ ] Confirm all required Release gates are current before creating the release record.
- [ ] Archive the release record with the built game; the record itself is not deployment.

- [ ] Connect Live Production and confirm the expected map, player position, watched switches, and watched variables.
- [ ] Record the primary player journey and convert it into a named regression scenario.
- [ ] Run every scenario and compare all golden-map baselines.
- [ ] Confirm the Live Production handshake reports protocol 2, a current heartbeat, and successful acknowledgements.
- [ ] Run the bundled headless project validator with the exported `.htgtestmanifest`.
- [ ] Review passage/softlock findings for disconnected areas, one-way exits, autoruns, and unreachable transfers.
- [ ] Review the Performance Center using representative large maps and real playtest behavior.
- [ ] Verify extension publisher identity, permissions, Worker probe, failure history, and quarantine state.

- [ ] Walk every changed transfer in both directions.
- [ ] Test doors and stairs from every approach.
- [ ] Simulate a complete NPC day and review congestion.
- [ ] Trigger each changed World Recipe and inspect its debugger trace.
- [ ] Save and reload after world-state changes.
- [ ] Test the production plugin order in Compatibility Lab.
- [ ] Review Map Doctor and World Atlas findings.
- [ ] Confirm World Pack dependencies and extension permissions.
- [ ] Confirm no required extension is disabled or quarantined.
- [ ] Stop Live Production before creating the release fingerprint.
- [ ] Create a final named restore point.
- [ ] Export and archive the deployment report, clean production bundle, and release fingerprint.
- [ ] Compare the final fingerprint with the previous release and archive the `.htgmanifest` with CI output.
