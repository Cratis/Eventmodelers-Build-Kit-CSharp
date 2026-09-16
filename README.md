# Cratis Eventmodelers Build Kit — C#

Eventmodelers build kit for Cratis — turns Eventmodelers board slices into Cratis (Arc + Chronicle) vertical slices in a .NET / C# project. Connect your board to an autonomous coding agent that picks up slice status changes, implements the slice the Cratis way (Cratis Arc + Chronicle), runs `dotnet build` / `dotnet test`, and marks the work done — all without manual intervention.

Built on [cratis.io](https://www.cratis.io). The kit is open-source (MIT) and is part of the Cratis ecosystem. The build-kit concept and realtime agent loop originate from [Nebulit-GmbH/Eventmodelers-Build-Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits).

[![Publish](https://github.com/Cratis/Eventmodelers-Build-Kit/actions/workflows/publish.yml/badge.svg)](https://github.com/Cratis/Eventmodelers-Build-Kit/actions/workflows/publish.yml)

---

## What you get

- A ready-to-run **Cratis starter app** (Cratis Arc + Chronicle + MongoDB + React/PrimeReact) dropped
  into your project root, including an example vertical slice to learn from and a `CLAUDE.md` of
  conventions.
- The **ralph loop** — an autonomous agent that reacts to `slice:changed` events and implements slices.
- **Build skills** that encode the Cratis way:
  - `/build-state-change` — write slices → `[Command]` + `Handle()` + `[EventType]`
  - `/build-state-view` — read slices → `[ReadModel]` + projection/reducer + queries
  - `/build-automation` — automation / translation → `IReactor` + `ICommandPipeline`
- **Platform skills** (`/connect`, `/load-slice`, `/update-slice-status`, `/learn-eventmodelers-api`).

---

## How it works

```
Board (Eventmodelers)
  │  slice status → "Planned"
  ▼
Realtime Agent  ──────────────────► tasks.json
  │  listens on a board channel          │
  ▼                                      ▼
ralph loop ◄────────────────────── Phase 1: load slice  (/connect + /load-slice → .slices/)
  │
  ▼
Phase 2: build slice
  → set status "InProgress" on the board
  → route by slice type to /build-state-change | /build-state-view | /build-automation
  → implement ONE .cs slice file the Cratis way
  → dotnet build (also regenerates TypeScript proxies)  +  dotnet test  (slice only)
  → implement the React component(s) if UI-triggered, register in the composition page
  → commit, merge to main
  → set status "Done" on the board
```

---

## Prerequisites

- .NET SDK 9.0+ and Docker (for Chronicle + MongoDB via `docker-compose`).
- Node.js 18+ (the realtime agent and the starter frontend are Node/Vite).
- An Eventmodelers board (org ID, board ID, API token) — optional; the kit also works locally without a
  board (it just skips board sync).

---

## Start here

- [Install the kit](#install) — get the Cratis starter app and agent loop
- [What the kit owns](#what-the-kit-owns) — capabilities and boundaries
- [Usage](#usage) — how to run the agent loop
- [Cratis AI corpus](#cratis-ai-corpus) — generated conventions and skills
- [License](#license) — MIT
- [Sibling kits](#sibling-kits) — Kotlin and Java variants

## What the kit owns

| Boundary | Kit provides |
| --- | --- |
| Installation | Cratis starter app with Arc + Chronicle, MongoDB, React frontend, and example slice |
| Agent loop | ralph — autonomous Claude agent that reacts to slice:changed events |
| Build skills | `/build-state-change`, `/build-state-view`, `/build-automation` for implementing slices |
| Platform skills | `/connect`, `/load-slice`, `/update-slice-status`, `/learn-eventmodelers-api` for board integration |
| Generated conventions | `cratis-conventions.md` derived from the Cratis AI corpus |
| MCP server | Eventmodelers platform integration configured in `.claude/settings.json` |

## Install

Run the installer in your project directory:

```bash
npx github:Cratis/Eventmodelers-Build-Kit install
```

It will:

- Copy the **Cratis starter app** into your project root (`CratisApp.csproj`, `Program.cs`,
  `docker-compose.yml`, the `.frontend/` shell, an example `SomeModule/SomeFeature/` slice, `CLAUDE.md`).
- Install the loop machinery and skills into `.cratis-build-kit/` (gitignored automatically).
- Prompt for board credentials (org ID, board ID, token) → `.cratis-build-kit/.eventmodelers/config.json`.
- Configure the Eventmodelers MCP server in `.cratis-build-kit/.claude/settings.json`.

| Path | Purpose |
|------|---------|
| `.cratis-build-kit/.claude/skills/build-state-change` | Write-slice skill (Cratis commands/events) |
| `.cratis-build-kit/.claude/skills/build-state-view` | Read-slice skill (read models/projections) |
| `.cratis-build-kit/.claude/skills/build-automation` | Automation/translation skill (reactors) |
| `.cratis-build-kit/.claude/skills/_shared/cratis-conventions.md` | The distilled Cratis conventions |
| `.cratis-build-kit/.claude/skills/{connect,load-slice,update-slice-status,learn-eventmodelers-api}` | Platform skills |
| `.cratis-build-kit/ralph-claude.js` / `ralph.sh` | The agent loop |
| `.cratis-build-kit/lib/prompt.md` / `backend-prompt.md` | Agent instructions |
| `.cratis-build-kit/lib/AGENT.md` | Accumulated learnings across iterations |

---

## Usage

```bash
docker-compose up -d        # Chronicle + MongoDB + Aspire dashboard
dotnet build                # backend + TypeScript proxy generation
npm install                 # frontend deps
```

Start the agent loop:

```bash
# Claude (default)
node .cratis-build-kit/ralph-claude.js

# Local Ollama model (run `ollama serve` first)
OLLAMA_MODEL=qwen3:8b node .cratis-build-kit/ralph-ollama.js

# Target a custom project directory
node .cratis-build-kit/ralph-claude.js /path/to/project
```

Optionally start the realtime agent for automatic board notifications:

```bash
cd .cratis-build-kit && npm install && node realtime-agent.js
```

---

## Slice-type routing

The loop reads `slice.json` and routes by type:

| slice.json signal | Cratis slice type | Skill | Produces |
|---|---|---|---|
| has `commands[]` / `events[]` | State Change | `/build-state-change` | `[Command]` + `Handle()` + `[EventType]` |
| has `readModel` / `projections` / `queries` | State View | `/build-state-view` | `[ReadModel]` + projection/reducer + static queries |
| non-empty `processors[]` | Automation | `/build-automation` | `IReactor` |
| `sliceType === "TRANSLATION"` | Translation | `/build-automation` | `IReactor` → `ICommandPipeline.Execute(command)` |

---

## The Cratis way (what the skills enforce)

- ALL backend artifacts for a slice in ONE `.cs` file under `<Module>/<Feature>/<Slice>/`.
- `[Command]` records with `Handle()` on the record — never separate handler classes.
- `[EventType]` with NO arguments; past-tense, never-nullable events.
- `ConceptAs<T>` for every identity/value — no raw `Guid` / `string` in the domain.
- `[ReadModel]` records with `public static` query methods; observable queries return `ISubject<T>`.
- Reactors implement `IReactor`; new writes go through `ICommandPipeline`, never `IEventLog`.
- `dotnet build` generates the TypeScript proxies — Backend → build → Specs → Frontend → Composition.

Full detail: `.cratis-build-kit/.claude/skills/_shared/cratis-conventions.md`.

---

## CLI commands

```bash
npx github:Cratis/Eventmodelers-Build-Kit install    # install and configure
npx github:Cratis/Eventmodelers-Build-Kit status     # check what is installed
npx github:Cratis/Eventmodelers-Build-Kit uninstall  # remove installed files
```

---

## Slice statuses

| Status | Meaning |
|--------|---------|
| `Created` | Slice exists on the board, not yet planned |
| `Planned` | Queued for the agent — triggers a build |
| `InProgress` | Agent is currently implementing |
| `Review` | Implementation complete, awaiting review |
| `Done` | Fully implemented and merged |
| `Blocked` | Waiting on an external dependency |

---

## Cratis AI corpus

The `.cratis/ai/` directory and `templates/.claude/skills/_shared/` are generated by `cratis ai update`
and `scripts/sync-corpus-to-templates.mjs`. They are refreshed on every release and must not be
hand-edited. The generated `cratis-conventions.md` is derived from the Cratis AI corpus selected by
the profiles in `.cratis/ai.json`.

## License

MIT

## Sibling kits

- [Eventmodelers Build Kit — Kotlin](https://github.com/Cratis/Eventmodelers-Build-Kit-Kotlin) — Kotlin variant
- [Eventmodelers Build Kit — Java](https://github.com/Cratis/Eventmodelers-Build-Kit-Java) — Java variant
