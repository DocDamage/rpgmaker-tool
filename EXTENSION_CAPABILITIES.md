# Hybrid Tile Studio extension capabilities

Generated from `src/contracts/extension-capabilities.json`. Edit the contract, not this file.

| Capability | Risk | Purpose |
|---|---|---|
| `map:read` | read | Read composed map snapshots. |
| `map:write` | write | Create reversible map changes. |
| `world:read` | read | Read World Recipe state and catalogs. |
| `world:write` | write | Change explicit world state. |
| `project:read` | read | Read project-scoped files through an approved boundary. |
| `project:write` | write | Write project-scoped files through an approved boundary. |
| `project:validate` | read | Contribute to project validation. |
| `recipes:read` | read | Read World Recipe definitions. |
| `recipes:write` | write | Create or update World Recipe definitions. |
| `pack:manage` | write | Resolve or install content packs. |
| `ui:contribute` | write | Add declared Studio tools or panels. |
| `network` | privileged | Access explicitly approved network endpoints. |
| `process` | privileged | Launch an explicitly approved child process. |
| `clipboard` | privileged | Read or write the system clipboard. |
