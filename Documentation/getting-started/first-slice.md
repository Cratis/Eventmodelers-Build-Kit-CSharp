---
title: Run Your First Slice
description: See a slice go from Planned to Done with the Eventmodelers Build Kit - C#
tableOfContents: false
---

# Run Your First Slice

This walkthrough shows a slice going from `Planned` on your Eventmodelers board to a tested, working Cratis vertical slice in your .NET / C# project — with no manual coding in between.

## Prerequisites

[Install the kit](install.md) and [connect it to a board](../guides/connect-a-board.md) first. The loop needs a running agent (`node .build-kit/ralph-claude.js`) and valid credentials in `.eventmodelers/config.json`.

## Look at the example slice first

Every install ships a working example under `SomeModule/SomeFeature/` — a `Registration` slice (a command and its event) and a `Listing` slice (a projection and read model). Open them before you build your own; they show every convention the kit's build skills reproduce:

- One file per slice, with the command/event/reactor together
- `@Command`/`@EventType`-style artifacts with a `handle()`-shaped method that returns the event
- The React screen and command wiring in `.tsx`/`.ts` files beside them

## Start the loop

```bash
node .build-kit/ralph-claude.js
```

The loop polls for two independent triggers — see [Understanding the Loop](../understand/the-loop.md) — and idles quietly until one fires.

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

The real-time subscription picks up the status change and saves the definition to `.build-kit/.slices/Authors/register-author/slice.json`.

## 3. The kit generates the vertical slice

Because the slice only carries `commands`/`events` (no `processors`, no `projections`/`queries`), the loop routes to the `build-state-change` skill, which generates `Authors/Registration/RegisterAuthor.cs`:

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

```bash
dotnet build Authors.Registration
dotnet test Authors.Registration.Specs
```

## 5. The kit updates the board to `Done`

Once the build and tests pass, the kit calls back to the platform and marks the slice `Done` — closing the loop without you touching an editor.

## What's next

- Try a slice with `projections`/`readModel` set — it routes to `build-state-view` instead
- Try a slice with `processors` set — it routes to `build-automation`
- If a slice gets stuck in `InProgress`, check the loop's terminal output, confirm `dotnet build` succeeds locally, then re-run the loop
