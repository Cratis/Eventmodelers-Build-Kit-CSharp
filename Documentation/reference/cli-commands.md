---
title: CLI Commands
description: Command reference for the Eventmodelers Build Kit - C# installer CLI
tableOfContents: false
---

# CLI Commands

The kit ships a small installer CLI (`src/cli.js`, invoked via `npx github:Cratis/Eventmodelers-Build-Kit-CSharp <command>`) that manages the `.build-kit/` directory in your project. It does not run the agent loop itself — that's `node .build-kit/ralph-claude.js`, started separately once the kit is installed.

| Command | Description |
|---|---|
| `install` | Install `.build-kit` into the current directory |
| `uninstall` | Remove `.build-kit` from the current directory |
| `status` | Check installation and connection status |

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

Reports whether the kit directory, skills, and both config files are present, and — when `.eventmodelers/config.json` is valid — which organization and board it's connected to:

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

If `.eventmodelers/config.json` exists but isn't valid JSON, `status` reports `⚠️  Config file is invalid JSON` instead of the connection details.

## Running the loop

These aren't CLI subcommands — they're the scripts `install` copies into `.build-kit/`, run directly with Node:

| Script | Purpose |
|---|---|
| `node .build-kit/ralph-claude.js` | Run the loop with Claude (default) |
| `OLLAMA_MODEL=qwen3:8b node .build-kit/ralph-ollama.js` | Run the loop with a local Ollama model (`ollama serve` must be running) |
| `node .build-kit/ralph-claude.js /path/to/project` | Point the loop at a project directory other than the kit's parent |

See [Understanding the Loop](../understand/the-loop.md) for what happens once the loop is running.

## See Also

- [Install the Kit](../getting-started/install.md)
- [Connect a Board](../guides/connect-a-board.md)
- [Understanding the Loop](../understand/the-loop.md)
