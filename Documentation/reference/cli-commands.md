---
title: CLI Commands
description: Reference C# Eventmodelers Build Kit installer commands for install, uninstall and status, and distinguish directory management from running the agent loop.
tableOfContents: false
---

# CLI Commands

The kit ships a small installer CLI (`src/cli.js`, invoked via `npx github:Cratis/Eventmodelers-Build-Kit-CSharp <command>`) that manages the `.build-kit/` directory in your project. It does not run the agent loop itself — that's `node .build-kit/ralph-claude.js`, started separately once the kit is installed.

| Command | Description |
|---|---|
| `install` | Install `.build-kit` into the current directory |
| `uninstall` | Remove `.build-kit` from the current directory |
| `status` | Check installation files and saved settings |

## `install`

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

1. Copies the starter app (`templates/root/`) into the project root
2. Copies the agent loop and skills (`templates/build-kit/`) into `.build-kit/`
3. Runs `npm install` inside `.build-kit/` for the loop's own dependencies
4. Adds `.build-kit/` to `.gitignore`
5. Prompts for Eventmodelers credentials and writes `.eventmodelers/config.json` at the project root, with a copy under `.build-kit/.eventmodelers/config.json`
6. Writes the `mcpServers.eventmodelers` entry into `.build-kit/.claude/settings.json`, pointing at `<baseUrl>/mcp`
7. Generates the code export server's secret and stores it as `codeExportSecret` in `.build-kit/.eventmodelers/config.json`, keeping one that already exists

See [Install the Kit](../getting-started/install.md) for the full walkthrough.

## `uninstall`

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp uninstall
```

Removes the `.build-kit/` directory. It does **not** remove the starter app files that were copied into the project root during install, or `.eventmodelers/config.json`.

## `status`

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

Reports whether the kit directory, skills, and both config files are present. When `.eventmodelers/config.json` at the project root is valid JSON, it displays the saved URL, organization, and board below. This does not test board access or inspect the values in the loop's kit-directory config:

```
.build-kit Status

Kit dir:        ✅ installed
Skills:         ✅ installed
Config (root):  ✅ present
Config (kit):   ✅ present

Connected to: https://api.eventmodelers.ai
Organization: <your-org-id>
Board:        <your-board-id>
```

If `.eventmodelers/config.json` exists but isn't valid JSON, `status` reports `⚠️  Config file is invalid JSON` instead of the configured values. For the skill's board access check and consumer-specific configuration guidance, follow [Connect a Board](../guides/connect-a-board.md).

## Running the loop

These aren't CLI subcommands — they're the scripts `install` copies into `.build-kit/`, run directly with Node:

| Script | Purpose |
|---|---|
| `node .build-kit/ralph-claude.js` | Run the loop with Claude (default) |
| `node .build-kit/ralph-claude.js /path/to/project` | Point the loop at a project directory other than the kit's parent |

For a first run, follow [Run Your First Slice](../getting-started/first-slice.md). See [Understanding the Loop](../understand/the-loop.md) for how the running loop selects work.

## Code export server

```bash
node .build-kit/code-export.mjs
```

The code export server lets the board write slice files and screen images into the project and commit them. Because those routes change your working copy, the server:

- Listens on `127.0.0.1` only (port `3001`, or `PORT`).
- Accepts browser requests only from the board's origin, `https://app.eventmodelers.ai`. Set `codeExportAllowedOrigins` in `.build-kit/.eventmodelers/config.json`, or the comma-separated `CODE_EXPORT_ALLOWED_ORIGINS` environment variable, to allow others, such as a local board.
- Requires the per-install secret on every request, as `Authorization: Bearer <secret>` or `X-Export-Secret: <secret>`. The secret is `codeExportSecret` in `.build-kit/.eventmodelers/config.json`; the server generates it on first start when the installer has not. Give it to the board's code export settings, and treat it like the board token.

Requests without the secret get `401`; requests from another origin get `403`.

## See Also

- [Install the Kit](../getting-started/install.md)
- [Connect a Board](../guides/connect-a-board.md)
- [Understanding the Loop](../understand/the-loop.md)
