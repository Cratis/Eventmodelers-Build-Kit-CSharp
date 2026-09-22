---
title: Install the Kit
description: Install the Eventmodelers Build Kit - C# into your project directory
tableOfContents: false
---

# Install the Kit

This tutorial shows you how to install the Eventmodelers Build Kit - C# into your project directory.

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

1. Copy the **Cratis starter app** (C# backend with Arc + Chronicle, an example slice, and the shared React frontend) into your project root
2. Create a `.build-kit/` directory with the agent loop and skills
3. Install Node.js dependencies for the loop
4. Add `.build-kit/` to your `.gitignore`
5. Create `.eventmodelers/config.json` in your project root
6. Configure the MCP server in `.build-kit/.claude/settings.json`

### Option 2: Upstream CLI with Git Stack

Use the upstream Eventmodelers CLI to install this repository as a git stack:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

This achieves the same result but uses the upstream CLI's stack management.

## During Installation

The installer prompts for your Eventmodelers credentials:

```
🔑 Enter your Eventmodelers credentials (press Enter to skip any field):

  Organization ID:
  Board ID:
  Token:
```

Get these from [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account). You can skip any
field and configure it later — see [Connect a Board](../guides/connect-a-board.md).

## After Installation

Start the agent loop:

```bash
node .build-kit/ralph-claude.js
```

Or, using a local Ollama model (run `ollama serve` first):

```bash
OLLAMA_MODEL=qwen3:8b node .build-kit/ralph-ollama.js
```

Verify the installation:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
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

Build and run the starter app:

```bash
docker-compose up -d           # Chronicle development kernel + Aspire Dashboard
dotnet build                   # backend
dotnet run                     # run the backend (http://localhost:5000)
npm install && npm run dev     # frontend dev server (http://localhost:5173)
```

## Next Steps

Now that the kit is installed:

1. [Connect your Eventmodelers board](../guides/connect-a-board.md)
2. [Mark a slice as `Planned`](https://app.eventmodelers.ai) on your board
3. [Run the kit](first-slice.md) to implement the slice

## Troubleshooting

### Installation Fails

If installation fails:

1. Check the Node.js version: `node --version` (should be 18+)
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

1. Check that `.build-kit/.claude/settings.json` exists
2. Verify the `mcpServers.eventmodelers` entry is present
3. Restart Claude Code after installation

## See Also

- [Connect a Board](../guides/connect-a-board.md)
- [Run Your First Slice](first-slice.md)
- [CLI Commands](../reference/cli-commands.md)
