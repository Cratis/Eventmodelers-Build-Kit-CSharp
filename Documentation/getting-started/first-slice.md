---
title: Run Your First Slice
description: Follow a C# Eventmodelers board slice from Planned to Done, inspect generated vertical-slice files and review the agent loop's build and test output.
tableOfContents: false
---

# Run Your First Slice

Follow one slice from `Planned` on your Eventmodelers board through the generated C# files, build and test results, and the final board status. Keep the loop output visible so you can check each result rather than treating a status change as a substitute for reviewing the implementation.

## Prerequisites

[Install the kit](install.md) and [connect it to a board](../guides/connect-a-board.md) first, including the starter build tools and local installation checks. For board sync, the loop needs `organizationId`, `boardId`, `token`, and `baseUrl` in `.build-kit/.eventmodelers/config.json`. Start the loop below if it is not already running; do not start a second copy.

## Look at the example slice first

The starter includes examples under `SomeModule/SomeFeature/`: `Registration` contains a command, its event, and a reactor; `Listing` contains the read model. Open them before building your own slice so you have the installed C# shapes beside the generated files:

- One file per slice, with the command/event/reactor together
- `[Command]` and `[EventType]` artifacts, with `Handle()` on the command
- The React screen and command wiring in `.tsx`/`.ts` files beside them

## Start the loop

If the Claude loop is already running from installation, keep that terminal open and continue to the board step. Otherwise, run it from the project root in its own terminal. As described during installation, this launcher bypasses Claude permission prompts and its build instructions include Git commits and a merge back to `main`.

```bash
node .build-kit/ralph-claude.js
```

The loop checks two independent triggers — see [Understanding the Loop](../understand/the-loop.md). Before marking the slice, check its startup output: local-only mode means board sync is disabled. Check the kit-local config and its four required values if that is not the mode you intended.

## 1. Mark a slice `Planned` on your board

On [app.eventmodelers.ai](https://app.eventmodelers.ai), create or open a slice and set its status to `Planned`. For example, a "Register Author" slice might look like:

```json
{
  "id": "slice-123",
  "title": "Register Author",
  "status": "Planned",
  "contextName": "Authors",
  "sliceType": "StateChange",
  "commands": ["RegisterAuthor"],
  "events": ["AuthorRegistered"],
  "description": "Register a new author with name and email"
}
```

## 2. The kit fetches and persists the slice

Watch the terminal for the board change and persistence output. Before building, the loop claims the slice (sets it to `InProgress`) and fetches its full definition — commands, events, fields and specifications — into `slice.json`, then inspect that saved definition. For the example above, the context and title become `.build-kit/.slices/authors/registerauthor/slice.json`. Check that it describes the slice you selected before reviewing generated code.

## 3. The kit generates the vertical slice

For a definition carrying only `commands`/`events` (no `processors`, no `projections`/`queries`), the build instructions select `build-state-change`. Review the generated command and event against the saved definition and the installed C# example. The following excerpt illustrates the command/event shape; it is not a complete application:

```cs
[Command]
public record RegisterAuthor(AuthorId Id, AuthorName Name) : ICanProvideEventSourceId
{
    public EventSourceId GetEventSourceId() => Id;

    public AuthorRegistered Handle() => new(Id, Name);
}

[EventType]
public record AuthorRegistered(AuthorId Id, AuthorName Name);
```

## 4. The kit builds and tests the slice

Inspect the loop output for the build and slice-specific test results. The commands below illustrate the walkthrough’s project names; they are not projects supplied by the starter. The agent’s instructions build from the actual project root and filter tests to the slice.

```bash
dotnet build Authors.Registration
dotnet test Authors.Registration.Specs
```

## 5. The kit updates the board to `Done`

When the agent reports the slice built after the checks pass, the loop sets it to `Done`. If the build keeps failing, the loop retries it a limited number of times (3 by default) and then sets it to `Blocked` with a comment giving the last failure. Check the board status alongside the successful build and test output, then review the generated files against the slice definition. A `Done` label alone does not show you what was implemented.

## What's next

- Try a slice with `projections`/`readModel` set — it routes to `build-state-view` instead
- Try a slice with `processors` set — it routes to `build-automation`
- If a slice stays `InProgress`, the loop was most likely stopped mid-build. Check the loop's terminal output, confirm `dotnet build` succeeds locally, and set the slice back to `Planned` to retry it. See [Retries, timeouts and blocked slices](../understand/the-loop.md#retries-timeouts-and-blocked-slices).
