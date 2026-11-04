---
title: Install the Kit
description: Install the Eventmodelers Build Kit - C# into your project directory
tableOfContents: false
---

# Install the Kit

Install the Eventmodelers Build Kit - C# in the project directory where you want the starter app and generated slices. You will check the installed files and settings before starting the loop, then follow one slice through the build.

## Prerequisites

Before installing, choose the project directory the kit should write into and make sure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Claude Code** or another Claude-compatible agent ([Get Claude](https://claude.ai))
- **Eventmodelers account** with at least one board ([Sign up](https://app.eventmodelers.ai/account))

To build and run the C# starter below, also install the .NET 10 SDK and Docker with Compose support. The starter targets .NET 10; its Compose file supplies the Chronicle development kernel and Aspire Dashboard.

## Installation

### Option 1: Direct Git Install (Recommended)

From your intended project root, install directly from this repository:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

The installer performs these setup steps; check its output for copy or dependency-install failures before continuing:

1. Copy the **Cratis starter app** (C# backend with Arc + Chronicle, an example slice, and the shared React frontend) into your project root
2. Create a `.build-kit/` directory with the agent loop and skills
3. Install Node.js dependencies for the loop
4. Add `.build-kit/` to your `.gitignore`
5. Create `.eventmodelers/config.json` in your project root
6. Configure the MCP server in `.build-kit/.claude/settings.json`

### Option 2: Upstream CLI with Git Stack

If you already use the upstream Eventmodelers CLI to manage stacks, use this alternative instead of running both installation commands:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

This selects the C# repository through the upstream CLI's stack management. The checks and first-slice walkthrough below concern the installed C# kit, not the sibling language kits.

## During Installation

The installer first asks whether you already have platform credentials. If you answer yes, it prints the project-root config path and exits so you can paste the config there and re-run the installer. Otherwise, when required values are missing, it prompts for them:

```
🔑 Enter your Eventmodelers credentials (press Enter to skip any field):

  Organization ID:
  Board ID:
  Token:
```

Get these from [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account). You can skip any
field and configure it later — see [Connect a Board](../guides/connect-a-board.md).

## After Installation

From the project root, check what the installer created before starting a long-running process:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

This command reports local files and saved settings, not whether the server accepts your credentials. With the installation and configuration present, its output has this shape:

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

If credentials were skipped or the saved board is not the one you intend to use, finish [Connect a Board](../guides/connect-a-board.md) before starting the board-driven walkthrough. The loop reads `.build-kit/.eventmodelers/config.json`; board sync requires `organizationId`, `boardId`, `token`, and `baseUrl` there. Check that copy as well as the project-root file.

Build and run the starter app from the project root. Run the Compose and build commands first. Keep the backend running in one terminal and run the frontend command in another; the foreground backend process does not return you to a prompt for the next line:

```bash
docker-compose up -d           # Chronicle development kernel + Aspire Dashboard
dotnet build                   # backend
dotnet run                     # run the backend (http://localhost:5000)
npm install && npm run dev     # frontend dev server (http://localhost:5173)
```

When you are ready to let the agent work in this project, start the Claude loop in a separate terminal and leave its output visible. The launcher uses `--dangerously-skip-permissions`, and the build instructions tell the agent to commit changes and merge its feature branch back to `main`; use a working copy whose files and Git history you intend the agent to modify:

```bash
node .build-kit/ralph-claude.js
```

The local Ollama launcher is an optional alternative, not an additional process to run alongside Claude. Start `ollama serve` first. This walkthrough follows the Claude launcher; do not assume the two launchers provide identical trigger behavior:

```bash
OLLAMA_MODEL=qwen3:8b node .build-kit/ralph-ollama.js
```

## Next Steps

With the local files checked, continue through these steps in order. If the loop is already running, leave it running for the first-slice walkthrough:

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
