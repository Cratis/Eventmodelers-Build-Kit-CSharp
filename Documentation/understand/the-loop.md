---
title: The Loop and Triggers
description: How the Eventmodelers Build Kit - C# agent loop decides what to do next
tableOfContents: false
---

# The Loop and Triggers

The kit runs as a long-lived agent loop (`ralph-claude.js` / `ralph-ollama.js`) that repeatedly checks for work and idles quietly when there is none. It implements the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/build-kit).

## Two independent triggers

Each loop iteration checks two conditions. They are **not causally linked** — either can fire on its own, and both can fire in the same iteration:

| Trigger | Condition | What runs |
|---|---|---|
| **Task trigger** | `.build-kit/tasks.json` is non-empty | `lib/prompt.md` — reacts to board status changes (fetches newly `Planned` slices, logs `Done`/`Blocked` results) |
| **Build trigger** | A slice under `.build-kit/.slices/*/index.json` has status `"planned"` | `lib/backend-prompt.md` — builds exactly **one** slice, then stops so the loop can re-check for more work |

Building one slice per iteration, rather than draining the whole queue at once, keeps each build isolated: if one slice fails, it doesn't block the others from being picked up on the next pass.

## Running without board credentials

If `.build-kit/.eventmodelers/config.json` is missing, the task trigger is disabled — there's no board to sync with — but the build trigger still runs. You can drop a slice definition directly into `.build-kit/.slices/<context>/<slice>/index.json` with `"status": "planned"` and the kit will still generate, build, and test it locally. See [Connect a Board](../guides/connect-a-board.md) to enable full board sync.

## Slice-type routing

When the build trigger fires, the kit reads the slice definition and routes to one of three build skills:

| Condition | Skill | Generates |
|---|---|---|
| `sliceType === "TRANSLATION"` | `build-automation` | A reactor that adapts an external fact into a local command |
| `processors[]` is non-empty | `build-automation` | A reactor that reacts to a fact and issues a follow-up command |
| `projections` / `queries` / `readModel` present | `build-state-view` | A projection and read model |
| Otherwise (`commands` / `events` only) | `build-state-change` | A command and its event(s) |

This mirrors [event modeling](https://eventmodeling.org/)'s four slice patterns — Command, View, Automation, and Translation — applied to Cratis's Arc and Chronicle primitives.

## One iteration, end to end

1. **Check triggers.** Read `tasks.json` and scan `.slices/*/index.json` for a `planned` entry.
2. **If a task is pending:** run `prompt.md` — fetch the slice from the board via the `load-slice` skill, persist it under `.slices/`, and clear the task.
3. **If a slice is planned:** run `backend-prompt.md` — route to the correct build skill, generate the code, run `dotnet build` and `dotnet test`, then call `update-slice-status` to mark the slice `Done` (or `Blocked`, with the failure reason, if the build or tests fail).
4. **Idle.** If neither trigger fired, wait and check again.

## See Also

- [Run Your First Slice](../getting-started/first-slice.md) — this loop, watched end to end
- [CLI Commands](../reference/cli-commands.md)
- [Connect a Board](../guides/connect-a-board.md)
