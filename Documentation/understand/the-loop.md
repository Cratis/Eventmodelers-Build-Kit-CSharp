---
title: The Loop and Triggers
description: Understand the C# Eventmodelers Build Kit agent loop, its board and local triggers, slice-type routing and behavior when board credentials are absent.
tableOfContents: false
---

# The Loop and Triggers

The kit runs as a long-lived agent loop (`ralph-claude.js`, using Claude Code; local models are not supported for building) that repeatedly checks for work and idles quietly when there is none. It implements the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/build-kit).

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

1. **Check triggers.** Read `tasks.json` and scan `.slices/*/index.json` for a `planned` entry whose build attempts are not used up.
2. **If a task is pending:** run `prompt.md` — fetch the slice from the board via the `load-slice` skill, persist it under `.slices/`, and clear the task.
3. **If a slice is planned:**
   1. **Claim it.** The loop re-reads the slice from the board and skips it unless it is still `Planned`. It then sets `InProgress` together with its own claim id and, after a short pause, reads the slice back. If another loop's claim replaced it, this loop skips the slice.
   2. **Fetch the definition.** The loop fetches the slice's full definition (elements, fields and specifications) from the board's `slicedata?contextName=…&sliceId=…` endpoint into its `slice.json` — the slice list holds only id, title and status.
   3. **Run one turn.** The loop runs `backend-prompt.md` with a build request that names the slice, its context, its `slice.json` and the attempt number. The agent routes to the correct build skill, generates the code, runs `dotnet build` and `dotnet test`, commits, and ends with `<promise>DONE</promise>` or `<promise>BLOCKED: <reason></promise>`. It never sets a slice status itself.
   4. **Set the final status.** The loop sets `Done` on `DONE`, and `Blocked` with a board comment carrying the reason on `BLOCKED`. Anything else — a failed or hung turn, or no verdict — is a failed attempt: the loop sets the slice back to `Planned` and tries again after the retry delay.
4. **Idle.** If neither trigger fired, wait and check again.

## Retries, timeouts and blocked slices

| Limit | Default | Config field (`.build-kit/.eventmodelers/config.json`) | Environment variable |
|---|---|---|---|
| Attempts before a slice is set to `Blocked` | 3 | `maxBuildAttempts` | `RALPH_MAX_ATTEMPTS` |
| Turn timeout — a turn running longer is stopped and counts as a failed attempt | 60 minutes | `turnTimeoutMinutes` | `RALPH_TURN_TIMEOUT_MINUTES` |
| Delay before retrying a failed attempt | 60 seconds | `retryDelaySeconds` | `RALPH_RETRY_DELAY_SECONDS` |

Failed attempts are counted per slice in `.build-kit/build-attempts.json`, so a restart keeps counting. When a slice reaches the limit, the loop sets it to `Blocked` on the board and comments with the number of attempts and the last failure. Moving the slice back to `Planned` starts a new count. A task turn gets the same timeout and attempt limit; a task that keeps failing is dropped from `tasks.json`.

In local-only mode, the loop records the same statuses in the local `index.json` and `slice.json` instead of on the board.

## See Also

- [Run Your First Slice](../getting-started/first-slice.md) — this loop, watched end to end
- [CLI Commands](../reference/cli-commands.md)
- [Connect a Board](../guides/connect-a-board.md)
