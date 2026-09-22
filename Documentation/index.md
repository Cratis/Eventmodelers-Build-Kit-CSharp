---
title: Eventmodelers Build Kit - C#
description: Real-time Claude agent that connects to the Eventmodelers Platform and implements board slices as Cratis (Arc + Chronicle) vertical slices in a .NET / C# project
tableOfContents: false
---

# Eventmodelers Build Kit - C#

Real-time Claude agent that connects to the Eventmodelers Platform and implements board slices as Cratis (Arc + Chronicle) vertical slices in a .NET / C# project.

## What This Kit Does

When a slice is marked `Planned` on your Eventmodelers board, this kit automatically:

1. **Connects** to the Eventmodelers Platform in real-time
2. **Fetches** the slice definition and board context
3. **Generates** a complete Cratis vertical slice (commands, events, projections, read models, React components)
4. **Builds** the slice with `dotnet build` and runs tests with `dotnet test`
5. **Updates** the board status to `Done` when complete

The entire process happens automatically, with your Claude agent implementing the slice according to Cratis best practices.

## Where to Start

- **[Install the Kit](getting-started/install.md)** — Get up and running in five minutes
- **[Run Your First Slice](getting-started/first-slice.md)** — Watch a slice go from `Planned` to `Done`
- **[Connect a Board](guides/connect-a-board.md)** — Wire the kit up to your Eventmodelers board

## How It Works

The kit implements the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits):

1. **Real-time board subscription** — The kit subscribes to your board's slice status changes
2. **Status-based triggers** — Two independent loops:
   - `tasks.json` non-empty → run `prompt.md` (reacts to status changes)
   - Slice is `Planned` in `.slices/*/index.json` → run `backend-prompt.md` (builds one slice)
3. **Slice-type routing** — Automatically routes to the correct build skill:
   - `TRANSLATION` or `processors[]` → `build-automation` (reactors/automation)
   - `projections`/`queries`/`readModel` → `build-state-view` (read models)
   - Otherwise (`commands`/`events`) → `build-state-change` (commands/events)
4. **Cratis conformance** — Generated slices follow Cratis best practices:
   - One `.cs` file per slice — every backend artifact (command, event, reactor) lives together
   - `[Command]` records carry a `Handle()` method — no separate handler class
   - `[EventType]` records use past-tense, self-describing names and take no attribute arguments
   - No nullable event properties — model an optional fact as a separate event instead
   - `ConceptAs<T>` / `EventSourceId<T>` replace raw primitives for identities and values
   - Namespace mirrors the folder structure

See [Understanding the Loop](understand/the-loop.md) for the full mechanics.

## Place in the Cratis Ecosystem

This kit sits between the [Eventmodelers Platform](https://app.eventmodelers.ai) and [Cratis](https://cratis.dev):

- **Upstream**: [Eventmodelers Build Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits) — The platform that manages board slices
- **This Repository**: [Eventmodelers-Build-Kit-CSharp](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp) — The C# implementation
- **Downstream**: [Cratis Chronicle](https://github.com/Cratis/Chronicle) + [Cratis Arc](https://github.com/Cratis/Arc) — The framework the generated slices build on

See the sibling kits for other language implementations: [Kotlin](https://github.com/Cratis/Eventmodelers-Build-Kit-Kotlin) and [Java](https://github.com/Cratis/Eventmodelers-Build-Kit-Java).

## Installation

Install from git (this package is private, so use the git install path):

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

Or use the upstream CLI with this repository as a git stack:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

After installation, run:

```bash
node .build-kit/ralph-claude.js
```

## Next Steps

1. [Install the kit](getting-started/install.md)
2. [Connect your Eventmodelers board](guides/connect-a-board.md)
3. [Mark a slice as `Planned`](https://app.eventmodelers.ai) on your board
4. Watch the kit automatically implement it as a Cratis vertical slice — see [Run Your First Slice](getting-started/first-slice.md)

## See Also

- [Understanding the Loop](understand/the-loop.md) — How the two triggers work independently
- [CLI Commands](reference/cli-commands.md) — `install`, `uninstall`, and `status`
- [Cratis Conventions](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/tree/main/templates/.claude/skills/_shared/cratis-conventions.md) — The conventions the kit enforces, generated from the Cratis AI corpus
- [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits) — The platform skills the kit uses
