---
title: Connect a Board
description: Connect the C# Build Kit to an Eventmodelers board with organization and board IDs, an API token and base URL, then verify or rotate stored credentials.
tableOfContents: false
---

# Connect a Board

The kit needs an **organization ID**, a **board ID**, an API **token**, and an explicit **base URL** for board sync. This guide covers getting the credentials, where they're stored, and how to change them later.

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
3. Asks for missing credentials and uses `https://api.eventmodelers.ai` when `baseUrl` is missing
4. When it had to ask for missing values, writes them to `.eventmodelers/config.json` in the current working directory. If every value was already available (for example a complete config plus an inline `board=` override), it skips this step, so an inline override is not saved

The `load-slice` and `update-slice-status` skills call `connect` first, so you don't have to wire credentials into them individually. The `build-state-change`, `build-state-view` and `build-automation` skills start with convention discovery and don't call `connect` themselves.

## Where credentials live

The installer, skills, and loop read configuration differently:

| Reader | Configuration source |
|---|---|
| Installer | Reads `.eventmodelers/config.json` in the project root after you answer **no** to the existing-credentials question. If any of the three credential fields is missing, it prompts and writes both config files; otherwise, it skips both writes. |
| `/connect` skill | Uses **inline parameter > `.eventmodelers/config.json` in the current working directory > ask for missing credentials**, with the skill's default for `baseUrl`. It does not search both config locations. |
| Loop | Reads **only** `.build-kit/.eventmodelers/config.json`. A nonempty `BASE_URL` environment variable overrides that file's `baseUrl`; there is no root-config fallback or default API URL. |

The loop requires `organizationId`, `boardId`, `token`, and `baseUrl`; missing values select local-only mode instead of board sync. The installer's hosted-URL fallback configures MCP only; it does not fill in `baseUrl` in either config file.

After installation or `/connect`, follow [Complete both config files for every path](../getting-started/install.md#complete-both-config-files-for-every-path), including the copy step and MCP URL check. Use `organizationId` in both files, as shown there.

The installer keeps existing `.gitignore` rules and merges in `.build-kit/` and `.eventmodelers/`. In a Git repository, it checks that the root token file is ignored and appends `.eventmodelers/` again if needed. It warns if the file is still exposed. Follow [Protect the token files after each installer run](../getting-started/install.md#protect-the-token-files-after-each-installer-run) and confirm that the ignore check prints both paths before committing or launching the agent.

## Verify the connection

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

Run this from the project root. It checks whether the kit, skills, and both config files exist, then prints saved values from the **root config only**. For example:

```
Connected to: https://api.eventmodelers.ai
Organization: <your-org-id>
Board:        <your-board-id>
```

Despite the `Connected to:` label, `status` makes no server request and does not verify credentials or inspect the kit-local config's values. Follow [Start the Claude loop](../getting-started/install.md#start-the-claude-loop) to check board-sync startup and watch for platform errors.

## Rotate or change credentials

Use `/connect` with an inline override to change the board for the skill session:

```
/connect board=<new-board-uuid>
```

Rotating credentials or changing boards requires updating **both** `.eventmodelers/config.json` and `.build-kit/.eventmodelers/config.json`. `/connect` does not synchronize the two files. Edit both, or complete the root config and repeat the [config copy step and MCP URL check](../getting-started/install.md#complete-both-config-files-for-every-path). Repeat the [token-file ignore check](../getting-started/install.md#protect-the-token-files-after-each-installer-run), then restart the loop.

## See Also

- [Install the Kit](../getting-started/install.md)
- [Run Your First Slice](../getting-started/first-slice.md)
- [CLI Commands](../reference/cli-commands.md)
