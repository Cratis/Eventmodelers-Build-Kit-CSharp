---
title: Install the Kit
description: Install the Eventmodelers Build Kit - CSharp into your project directory
tableOfContents: false
---

# Install the Kit

This tutorial shows you how to install the Eventmodelers Build Kit - CSharp into your project directory.

## Prerequisites

Before installing, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Claude Code** or another Claude-compatible agent ([Get Claude](https://claude.ai))
- **Eventmodelers account** with at least one board ([Sign up](https://app.eventmodelers.ai/account))

## Installation

### Option 1: Direct Git Install (Recommended)

Install directly from this repository:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

This will:

1. Create a `.build-kit/` directory in your project root
2. Copy all kit files into `.build-kit/`
3. Install Node.js dependencies
4. Add `.build-kit/` to your `.gitignore`
5. Create `.eventmodelers/config.json` in your project root
6. Configure MCP server in `.build-kit/.claude/settings.json`

### Option 2: Upstream CLI with Git Stack

Use the upstream Eventmodelers CLI to install this repository as a git stack:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

This achieves the same result but uses the upstream CLI's stack management.

## During Installation

The installer will prompt you for:

1. **Platform credentials** from [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account)
2. **Organization ID** — Your organization's unique identifier
3. **Board ID** — The board you want to connect to
4. **Token** — Your authentication token

If you don't have credentials yet, you can:

- Skip any field by pressing Enter
- Add credentials later using `/connect` in Claude Code

## After Installation

The installer completes with:

```
✅ Done!

Next steps:

  Claude (default):
       node .build-kit/ralph-claude.js

  Local Ollama model (run `ollama serve` first):
       OLLAMA_MODEL=qwen3:8b node .build-kit/ralph-ollama.js

  Pass a custom project directory as the first argument:
       node .build-kit/ralph-claude.js /path/to/project

Skills are ready in .build-kit/.claude/skills/ — use /connect to set a board ID.
```

## Verify Installation

Check the installation status:

```bash
node .build-kit/cli.js status
```

You should see:

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

## Next Steps

Now that the kit is installed:

1. [Connect your Eventmodelers board](../guides/connect-a-board.md)
2. [Mark a slice as `Planned`](https://app.eventmodelers.ai) on your board
3. [Run the kit](first-slice.md) to implement the slice

## Troubleshooting

### Installation Fails

If installation fails:

1. Check Node.js version: `node --version` (should be 18+)
2. Ensure you're in a valid project directory
3. Check network connectivity
4. Try running with elevated permissions if needed

### Config Not Found

If the kit can't find your config:

1. Verify `.eventmodelers/config.json` exists in your project root
2. Check that the JSON is valid: `cat .eventmodelers/config.json | jq .`
3. Ensure your credentials are correct: [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account)

### MCP Server Not Configured

If MCP server configuration fails:

1. Check `.build-kit/.claude/settings.json` exists
2. Verify the `mcpServers.eventmodelers` entry is present
3. Restart Claude Code after installation

## See Also

- [Connect a Board](../guides/connect-a-board.md)
- [Run Your First Slice](first-slice.md)
- [Platform API](../reference/platform-api.md)
