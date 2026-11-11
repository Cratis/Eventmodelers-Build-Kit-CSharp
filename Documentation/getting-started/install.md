---
title: Install the Kit
description: Install the C# Eventmodelers Build Kit, protect token files, configure board access and local services, then verify the starter app before running the loop.
tableOfContents: false
---

# Install the Kit

Install the Eventmodelers Build Kit - C# in the project directory where you want the starter app and generated slices. This procedure checks the installed files, credentials, and local services before you start the Claude loop and follow your first board slice through the build.

## Prerequisites

Before installing, choose the project directory the kit should write into and make sure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Claude Code** installed with `claude` on your `PATH` for this walkthrough ([Get Claude](https://claude.ai))
- **Git** installed with your commit author identity configured, and a project repository with an initial commit on `main`
- **Eventmodelers account** with at least one board ([Sign up](https://app.eventmodelers.ai/account))

To build and run the C# starter below, also install the .NET 11 SDK and Docker with Compose v2 support (`docker compose`). The starter targets .NET 11; its Compose file supplies the Chronicle development kernel and Aspire Dashboard.

The installer does not initialize a Git repository or create `main`. In a fresh project directory, run these commands before installing:

```bash
GIT_OPTIONAL_LOCKS=0 git --no-optional-locks -c core.fsmonitor=false init -b main
GIT_OPTIONAL_LOCKS=0 git --no-optional-locks -c core.fsmonitor=false commit --allow-empty -m "Initialize project"
```

The empty initial commit establishes `main` without staging any files. For an existing repository, make sure `main` already has a commit instead of reinitializing it.

## Installation

Use a fresh project directory for the kit. The installer overwrites same-name files in the project root, including `package.json` and `Program.cs`, on **every run**. The installer keeps existing `.gitignore` rules and merges in the template's patterns. Before installing into an existing repository, commit or back up your work and check for conflicting files in the starter templates.

From your intended project root, install directly from this repository:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

The installer copies the C# starter and React frontend into your project root, copies the loop and skills into `.build-kit/`, runs `npm install` inside `.build-kit/`, and merges `.build-kit/` and `.eventmodelers/` into the root `.gitignore`. It creates the file if needed and re-appends rules when later negations could undo them. It then asks for credentials. Check its output for copy or dependency-install failures; resolve them before continuing. The application’s root Node.js dependencies are installed later in this procedure.

## During Installation

The first prompt is `Do you have platform credentials from app.eventmodelers.ai/account? (y/n):`. Choose the row that matches your starting point:

| Starting point | What to do |
|---|---|
| Fresh directory, entering new credentials | Answer **no** (`n`), then enter **Organization ID**, **Board ID**, and **Token** from [your account](https://app.eventmodelers.ai/account). Press Enter at **API base URL** to keep the hosted platform (`https://api.eventmodelers.ai`), or type another. The installer writes all four fields to both config files. |
| Fresh directory, pasting an existing account config | Answer **yes** (`y`). The installer prints the project-root config path and exits. Apply the token-file protection below, paste your account config into `.eventmodelers/config.json`, then rerun the same install command. On the rerun, answer **no** (`n`) so it reads the saved config and configures MCP. If the three credential fields are complete, it does not prompt again: it adds a missing `baseUrl`, renames an older `orgId` field to `organizationId`, and fills any field missing from the kit-local copy from the root config. |
| Existing repository | Use the same credential choices above. If a root config is already present, answer **no** (`n`) to read it; missing credentials prompt for input. Your existing ignore rules are kept, so just run the ignore check below, and complete both config files below. |

Answering yes always exits before reading the saved config or configuring MCP. When prompted for individual fields, Enter leaves an existing value unchanged or skips a missing one. You can connect later, but complete all four fields below before following this board-driven walkthrough.

### Protect the token files after each installer run

The installer already ignores `.eventmodelers/`. Before manually pasting credentials or committing installed files, confirm the protection; if the check below does not print both paths, add this line to the project-root `.gitignore`:

```gitignore
/.eventmodelers/config.json
```

The root config contains your token. The installer adds ignore rules for `.build-kit/` and `.eventmodelers/`. In a Git repository, it checks whether `.eventmodelers/config.json` is ignored. If not, it appends `.eventmodelers/` as the last rule and checks again. It warns if the file is still exposed. Reruns keep your existing rules. Outside a Git repository, this check is skipped. Run the check below once the repository exists.

From the project root, check both paths:

```bash
GIT_OPTIONAL_LOCKS=0 git --no-optional-locks -c core.fsmonitor=false check-ignore .eventmodelers/config.json .build-kit/.eventmodelers/config.json
```

The command must print both paths before you proceed. An ignore rule does not protect an already tracked file; if either path is missing from the output, resolve that before committing or launching the agent.

### Check both config files

After the final installer run, both `.eventmodelers/config.json` in the project root and `.build-kit/.eventmodelers/config.json` contain all four fields. `baseUrl` defaults to the hosted platform; set `BASE_URL` when running the installer, or answer the **API base URL** prompt, to use another. The kit-local file also holds `codeExportSecret` for the code export server:

```json
{
  "organizationId": "<your-org-id>",
  "boardId": "<your-board-id>",
  "token": "<your-token>",
  "baseUrl": "https://api.eventmodelers.ai"
}
```

The loop reads **only** `.build-kit/.eventmodelers/config.json` and requires `organizationId`, `boardId`, `token`, and `baseUrl` there for board sync. It reads `orgId` as a fallback for configs written by older versions of `/connect`. When a field is missing, the loop prints which one and runs local-only until you add it and restart.

Check that `.build-kit/.claude/settings.json` contains `mcpServers.eventmodelers` with `type: "http"` and a `url` matching your `baseUrl` followed by `/mcp`. If your account config uses a different API URL, keep it consistent in both config files and this MCP setting. Repeat the ignore check above after the final run, and keep both config copies in sync when you change boards or credentials.

## After Installation

### Check the local installation

From the project root, check what the installer created:

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp status
```

This reports local files and saved settings, not whether the server accepts your credentials. Check that the kit, skills, and both config files are present, and that the reported organization and board are the ones you intend to use. Inspect the kit-local config too: `status` reports credential values from the root file only.

### Bind local services before starting Compose

Check the project-root `docker-compose.yml` before running Compose. The template binds every published port to `127.0.0.1` and enables anonymous access to Aspire Dashboard. Keep these loopback bindings for local development:

| Service | Loopback-bound port mappings |
|---|---|
| `chronicle` | `"127.0.0.1:27017:27017"`, `"127.0.0.1:8080:8080"`, `"127.0.0.1:11111:11111"`, `"127.0.0.1:30000:30000"`, `"127.0.0.1:35000:35000"` |
| `aspire-dashboard` | `"127.0.0.1:18888:18888"`, `"127.0.0.1:4317:18889"` |

If your installed file uses different bindings, update its `ports` lists to match. Loopback binding limits access to your machine. It does not add dashboard authentication. This setup is for local development, not deployment.

### Build and run the starter

From the project root, start the development services and build the backend:

```bash
docker compose up -d
dotnet build
```

Resolve any failures before continuing. In one terminal, keep the backend running at the address used by the frontend proxy:

```bash
dotnet run --urls http://localhost:5000
```

In another terminal, also from the project root, install the frontend dependencies and start its development server:

```bash
npm install && npm run dev
```

Open `http://localhost:9000` to check the starter app before launching the agent. Keep the backend and frontend terminals running.

### Start the Claude loop

Review the installed changes before giving the agent control of the project. The launcher runs Claude with an explicit allow list: file edits are accepted inside the project only, and the agent may run only `dotnet build`/`test`/`restore`, the `git` commands for its branch policy (no push, reset or rebase), `yarn install`/`build`/`lint`/`test`, and `curl` for the board API. A command outside the list is refused, and the slice is reported as blocked. To allow more, add entries to `allowedTools` in `.build-kit/.eventmodelers/config.json` or to the comma-separated `RALPH_ALLOWED_TOOLS` environment variable (for example `Bash(npm run build:*)`); entries that bypass permission checks are refused. The build instructions tell the agent to commit changes and merge its feature branch back to `main`; use a working copy whose files and Git history you intend the agent to modify. A board that already has `Planned` slices can trigger work as soon as the loop starts.

Start one Claude loop in a separate terminal from the project root and leave its output visible:

```bash
node .build-kit/ralph-claude.js
```

Check the startup output for your organization, board, and API URL. If it says `mode: local-only (no platform sync)`, stop the loop, complete the four fields in the kit-local config, and restart it. Local file checks alone do not verify the connection; watch for platform errors and board subscription output before continuing to the first slice.

Building slices needs Claude Code: local models (Ollama) are not supported. Earlier versions shipped an Ollama launcher, but it could not read the tasks the loop writes and had no way to build a planned slice, so it was removed.

## Next Steps

With the installation checks complete and one Claude loop running, continue to [Run Your First Slice](first-slice.md) to mark a board slice `Planned` and review its implementation. For credential changes, see [Connect a Board](../guides/connect-a-board.md), then repeat the two-file configuration and ignore checks above before restarting the loop.

## Troubleshooting

### Installation Fails

If installation fails:

1. Check the Node.js version: `node --version` (should be 18+)
2. Ensure you're in a valid project directory
3. Check network connectivity
4. Try running with elevated permissions if needed

### Config Not Found

If the loop cannot find your config or starts in local-only mode:

1. Verify `.build-kit/.eventmodelers/config.json` exists and contains valid JSON
2. Check that `organizationId`, `boardId`, `token`, and `baseUrl` are all present and nonempty; a complete root config alone is not enough
3. Confirm the credentials match your intended board at [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account), then restart the loop

### MCP Server Not Configured

If MCP server configuration fails:

1. Check that `.build-kit/.claude/settings.json` exists; after pasting a root config, rerun the installer and answer **no** to the credentials question
2. Verify the `mcpServers.eventmodelers` entry is present and its URL matches your config’s `baseUrl` followed by `/mcp`
3. Reapply the token-file ignore rules and checks after any rerun, then restart Claude Code

## See Also

- [Connect a Board](../guides/connect-a-board.md)
- [Run Your First Slice](first-slice.md)
- [CLI Commands](../reference/cli-commands.md)
