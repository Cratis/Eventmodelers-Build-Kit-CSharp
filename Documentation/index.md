---
title: Eventmodelers Build Kit - CSharp
description: Real-time Claude agent that connects to the Eventmodelers Platform and implements board slices as Cratis (Arc + Chronicle) vertical slices in a .NET / C# project
tableOfContents: false
---

# Eventmodelers Build Kit - CSharp

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

- **[Getting Started](getting-started/)** — Install the kit and run your first slice from Planned to Done
- **[Connect a Board](guides/connect-a-board.md)** — Set up your Eventmodelers board credentials
- **[Run Without Credentials](guides/run-without-credentials.md)** — Run the kit in local/offline mode
- **[Target Another Project](guides/target-another-project.md)** — Point the kit to an existing C# project
- **[Recover a Stuck Slice](guides/recover-stuck-slice.md)** — Fix slices that are stuck in `InProgress` or `Blocked`

## How It Works

The kit implements the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits):

1. **Real-time board subscription** — The kit subscribes to your board's slice status changes via Supabase or PocketBase
2. **Status-based triggers** — Two independent loops:
   - `tasks.json` non-empty → run `prompt.md` (reacts to status changes)
   - Slice is `Planned` in `.slices/*/index.json` → run `backend-prompt.md` (builds one slice)
3. **Slice-type routing** — Automatically routes to the correct build skill:
   - `TRANSLATION` or `processors[]` → `build-automation` (reactors/automation)
   - `projections`/`queries`/`readModel` → `build-state-view` (read models)
   - Otherwise (`commands`/`events`) → `build-state-change` (commands/events)
4. **Cratis conformance** — Generated slices follow Cratis best practices:
   - One `.cs` per slice with `[Command]` and `[EventType]`
   - `ConceptAs<T>`/`EventSourceId<T>` instead of raw primitives
   - No nullable event properties, no `IEventLog` injection
   - Namespace mirrors folder structure

## Place in the Cratis Ecosystem

This kit sits between the [Eventmodelers Platform](https://app.eventmodelers.ai) and [Cratis](https://cratis.dev):

- **Upstream**: [Eventmodelers Build Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits) — The platform that manages board slices
- **This Repository**: [Eventmodelers-Build-Kit-CSharp](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp) — The C# implementation
- **Downstream**: [Cratis Chronicle](https://github.com/Cratis/Chronicle) + [Cratis Arc](https://github.com/Cratis/Arc) — The framework that generates the vertical slices

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
4. Watch the kit automatically implement it as a Cratis vertical slice

## See Also

- [Understanding the Loop](understand/the-loop.md) — How the two triggers work independently
- [Slice-Type Routing](reference/slice-type-routing.md) — How the kit routes to the correct build skill
- [Cratis Conventions](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/tree/main/templates/.claude/skills/_shared/cratis-conventions.md) — The conventions the kit enforces
- [Platform API](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/skills) — The platform skills the kit uses
