---
title: Connect a Board
description: Set up Eventmodelers board credentials for the Build Kit - C#
tableOfContents: false
---

# Connect a Board

The kit needs three values to talk to your Eventmodelers board: an **organization ID**, a **board ID**, and an API **token**. This guide covers getting them, where they're stored, and how to change them later.

## Get your credentials

1. Sign in at [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account)
2. Generate an API token in your workspace settings — it is a UUID and is **shown only once**, so copy it immediately
3. Note your **organization ID** (from your organization settings) and the **board ID** (from the board's URL)

## Option 1: During installation

The installer asks for credentials interactively:

```
🔑 Enter your Eventmodelers credentials (press Enter to skip any field):

  Organization ID:
  Board ID:
  Token:
```

Paste each value, or press Enter to skip and connect later.

## Option 2: With the `connect` skill

If you skipped credentials at install time, or need to change them later, use `/connect` inside Claude Code. The skill:

1. Checks for inline overrides (`board=<uuid>`, `token=<uuid>`, `org=<uuid>`, `baseUrl=<url>`) in the prompt that invoked it
2. Falls back to `.eventmodelers/config.json` for any value not overridden
3. Asks you for anything still missing, one field at a time
4. Writes the resolved config back to disk

Every other skill in the kit (`build-state-change`, `build-state-view`, `build-automation`, `load-slice`, `update-slice-status`) calls `connect` first, so you never have to wire credentials into each one individually.

## Where credentials live

The installer writes the same config to two places:

| Location | Purpose |
|---|---|
| `.eventmodelers/config.json` (project root) | The primary config, checked first |
| `.build-kit/.eventmodelers/config.json` (kit directory) | An optional override, checked second |

Resolution order is **inline parameter > project-root config > kit-directory config > ask the user**. Both files are excluded from version control automatically.

The config shape is:

```json
{
  "organizationId": "<uuid>",
  "boardId": "<uuid>",
  "token": "<uuid>",
  "baseUrl": "https://api.eventmodelers.ai"
}
```

`baseUrl` defaults to `https://api.eventmodelers.ai` and only needs to be set explicitly when pointing at a self-hosted or local instance.

## Verify the connection

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

A working connection prints the organization and board the kit is currently pointed at:

```
Connected to: https://api.eventmodelers.ai
Organization: <your-org-id>
Board:        <your-board-id>
```

## Rotate or change credentials

Run `/connect` again with an inline override to switch boards without editing files by hand:

```
/connect board=<new-board-uuid>
```

Or edit `.eventmodelers/config.json` directly and restart the loop.

## See Also

- [Install the Kit](../getting-started/install.md)
- [Run Your First Slice](../getting-started/first-slice.md)
- [CLI Commands](../reference/cli-commands.md)
