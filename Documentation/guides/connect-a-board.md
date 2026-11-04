---
title: Connect a Board
description: Set up Eventmodelers board credentials for the Build Kit - C#
tableOfContents: false
---

# Connect a Board

After [installing the kit](../getting-started/install.md), configure the organization ID, board ID, and API token for the board you want to use. This guide separates saved settings you can inspect locally from an access check made by the `connect` skill.

Before saving or pasting credentials, protect the project-root config: add `.eventmodelers/config.json` to the root `.gitignore`. From the project root, check `git check-ignore -v -- .eventmodelers/config.json` for a matching ignore rule and `git ls-files -- .eventmodelers/config.json` for no tracked path. Stop if either check fails; resolve the ignore or tracking problem before saving credentials or sharing the project. Ignoring a file does not untrack it.

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
4. Saves the config after collecting missing values; skips saving when all four values are already resolved

Use `connect` for board access. The board-facing `load-slice` and `update-slice-status` skills invoke it before making board requests.

## Where credentials live

When saving prompted credentials, the installer writes the same config to two places. The consumers read them differently:

| Location | Purpose |
|---|---|
| `.eventmodelers/config.json` (project root) | Read by `status` for displayed values; read by `connect` in its working directory |
| `.build-kit/.eventmodelers/config.json` (kit directory) | Read by the agent loop, not a fallback for `connect` |

For `connect`, resolution is **inline parameter > config file > ask the user**, using `.eventmodelers/config.json` in its working directory. The loop reads the kit-directory file separately; it does not fall back to the project-root file. The installer adds `.build-kit/` to the project's ignore rules, not the root config path. Use the root-config checks above before saving credentials.

The installer and loop use `organizationId`; the example includes the explicit `baseUrl` needed for loop synchronization:

```json
{
  "organizationId": "<uuid>",
  "boardId": "<uuid>",
  "token": "<uuid>",
  "baseUrl": "https://api.eventmodelers.ai"
}
```

`connect` defaults a missing `baseUrl` to `https://api.eventmodelers.ai`. The installer's credential prompts need not save a URL. For loop sync, set `baseUrl` explicitly in the kit-directory config or supply `BASE_URL` in the loop's environment; unless all four values are present, the loop runs local-only without platform sync.

When reading a config file, `connect` looks for `organizationId`. It accepts either `organizationId` or `orgId` in pasted input, but its persistence template writes `orgId`. If all four values are already resolved, it skips persistence and verifies them directly. The installer, `status`, and loop use `organizationId`; check that field in the file for the consumer you intend to run.

## Verify the connection

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

`status` checks whether the kit, skills, and config files exist. It displays the following values from valid project-root JSON; it does not contact the board:

```
Connected to: https://api.eventmodelers.ai
Organization: <your-org-id>
Board:        <your-board-id>
```

If a config is reported missing, check the named location. Correct invalid JSON before interpreting its saved values. For a board access check, use `/connect` inside Claude Code and inspect its verification result: the skill defines a board request and a success message for a 200 response. That check uses the skill's resolved values, not automatically the loop's separate config. Follow [Run Your First Slice](../getting-started/first-slice.md) to start the loop and inspect one slice once its configuration is ready.

## Rotate or change credentials

Run `/connect` again with an inline override to change the board used by the skill:

```
/connect board=<new-board-uuid>
```

For direct edits, change the file used by the consumer you intend to run. Restart the loop after changing its kit-directory config; editing `.eventmodelers/config.json` at the project root alone does not update the loop's copy.

## See Also

- [Install the Kit](../getting-started/install.md)
- [Run Your First Slice](../getting-started/first-slice.md)
- [CLI Commands](../reference/cli-commands.md)
