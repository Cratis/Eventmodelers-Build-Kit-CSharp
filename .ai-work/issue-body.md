## Why

The kit has **zero automated tests**. `package.json` has no `test` script and no dev dependencies, and the only check running on a pull request is `node scripts/sync-corpus-to-templates.mjs --check` — which, as shown below, cannot fail for the reason it exists.

The kit's entire value proposition is: *a slice changes status on an Eventmodelers board → an agent implements it as a Cratis vertical slice → the board is updated to `Done`*. Nothing today verifies any link in that chain. An audit of the current `main` found **eleven** defects along that path, several of which break the kit outright for a fresh install. Every one of them is deterministic and would be caught by a spec.

## What the kit actually is (the testable seams)

```
npx …-csharp install                     [A] CLI: lays down starter app + build-kit runtime
        │
        ├── templates/root/*      → project root      (CratisApp starter, example slice, CLAUDE.md)
        └── templates/build-kit/* → .cratis-build-kit/ (runtime, prompts, .claude/skills)

node .cratis-build-kit/ralph-claude.js
        │
        ├── loadLocalConfig / fetchPlatformConfig      [B] config + credential resolution
        ├── startRealtimeAgent                         [C] Supabase board subscription
        │     ├── fetchAndPersistSlices  → .slices/    [D] board JSON → on-disk slice tree
        │     └── writeTask              → tasks.json  [E] task queue
        └── ralphLoop                                  [F] trigger logic
              ├── hasPendingTasks            → prompt.md         → executor
              └── getFirstPlannedSliceTitle   → backend-prompt.md → executor
                        │
                        └── slice-type routing → build-state-change / -view / -automation   [G]
                                    │
                                    └── generated Cratis code → dotnet build / dotnet test  [H]
```

Seams **A–G are fully deterministic** — plain file I/O, JSON transforms and HTTP. They need no LLM and no network to test. Seam **H** is non-deterministic generation, but it can be *graded* deterministically (see the plan comment).

## Evidence: what is broken today

| # | Defect | Impact |
|---|---|---|
| **D1** | `src/cli.js` installs the runtime into **`.cratis-build-kit/`**, but every prompt, skill and doc instructs the agent to read **`.build-kit-cratis-csharp/`** (13 refs in `load-slice/SKILL.md`, 5 in `prompt.md`, 4 in `backend-prompt.md`, 4 in `ralph.sh`, 2 in `CLAUDE.md`, 5 in `cli.js`'s own console output). | **Kit-breaking.** The agent looks for `tasks.json` and `.slices/` in a directory that does not exist. |
| **D2** | The `connect` skill reads `.eventmodelers/config.json` relative to cwd, and the executor runs with cwd = *project root*. The installer writes it to `.cratis-build-kit/.eventmodelers/config.json`. | **Kit-breaking.** Credentials are never found; every board call fails. |
| **D3** | Two divergent implementations of the *same* slice-persistence contract: `lib/ralph.js#fetchAndPersistSlices` vs `load-slice/SKILL.md`. They disagree on: source field (`slice.contextName` vs `slice.context`), context casing (slugified-lowercase vs preserve original), index fields (`contextSlug`+`contextName` vs `context`), `definition` payload (3-field subset vs full object), `"slice:"` title-prefix stripping (skill only), `context.json` (skill only), and index merge semantics (JS overwrites and drops `assigned`; the skill merges and preserves it). | Whichever ran last wins. The agent reads a tree whose shape depends on the code path. |
| **D4** | `scripts/sync-corpus-to-templates.mjs` reads `.cratis/ai/manifest.json`; the real file is `.cratis/ai.manifest.json`. Verified: `node scripts/sync-corpus-to-templates.mjs --check` → **exit 1**. | The only PR gate is **red on `main` right now**, and the release workflow's `corpus` job fails at the sync step. |
| **D5** | `--check` mode **mutates the working tree first**, then prints `✓ No changes detected` unconditionally and returns success. It never compares anything. | A guard that cannot fail. Once D4 is fixed the gate goes green while checking nothing — see `guards-and-fuses.md` and `exit-codes-and-wrappers.md`. |
| **D6** | `generateCratisConventions()` overwrites the hand-written 251-line `templates/.claude/skills/_shared/cratis-conventions.md` with a generated stub. The manifest's real keys are `SourceRevision` / `Files` / `Integrations`, so `profiles`/`harnesses`/`languages` render empty and the revision renders `unknown`; the body is a naive concatenation of corpus `SKILL.md` files. | Fixing D4 naively **destroys** the distilled conventions doc all three build skills depend on. |
| **D7** | `templates/root/.cratis/ai.json` does not exist, though the sync script is meant to create it and `publish.yml` watches that path. | Installed projects ship with no Cratis AI configuration. |
| **D8** | `.cratis/ai.json` requested a non-existent profile (`cratis/application/arc-chronicle`) and a bogus language (`react`) → only **5 skills / 30 rules** installed, vs **40 skills / 42 rules** in `Direct` and `Studio`. Every `cratis-arc-*`, `cratis-chronicle-*` and `cratis-application-*-specifications` skill was missing. | The build skills generating Chronicle/Arc code had no access to the Chronicle/Arc guidance. **Fixed** in the accompanying change; needs a spec so it cannot regress. |
| **D9** | `templates/root` ships **zero specs** and no test project (`CratisApp.csproj` is `Microsoft.NET.Sdk.Web` with no xUnit/`Cratis.Specifications` reference, and the `.sln` has no spec project). Both prompts demand *"every specification in the JSON has an executable equivalent in code"* and run `dotnet test --filter …`. | The agent is told to write specs with no reference pattern, into a solution where `dotnet test` can never run. |
| **D10** | `code-export.mjs` reads config from `join(ROOT, 'config.json')` — a third config location, disagreeing with both D2 paths. | Code-export server never finds board config. |
| **D11** | `ralph.sh` and `lib/ralph.js` are independent reimplementations of the same loop and have drifted (idle sleep 3s vs 10s; different planned-slice detection — `grep` over `index.json` vs parsed `status` field; `ralph.sh` has no `onPlannedSlice` credential parity). | Two loops, two behaviors, one documented contract. |
| **D12** | Every install command and the CI badge in `README.md` point at `Cratis/Eventmodelers-Build-Kit`; this repository is `Cratis/Eventmodelers-Build-Kit-CSharp`. They resolve today only through GitHub's rename redirect, which stops working the moment that name is reused for a hub repo. Separately, `package.json` is `"private": true`, so there is no npm install path — but the README never says installation is from git. | The documented entry point depends on a redirect, and the only install instruction users have is unexplained. |
| **D13** | There is **no `Documentation/` folder**. Every comparable Cratis repository has one — `cli` ships product documentation (`toc.yml`, Diátaxis-typed pages, `verify-markdown.sh`); `AI` ships repository documentation plus `decisions/`. Here, everything a user or contributor needs is spread across a 200-line `README.md`, `prompt.md`, `backend-prompt.md`, `AGENT.md`, `cratis-conventions.md` and six `SKILL.md` files, with no index and no verification. | There is nowhere to write the contract down, which is precisely how D1, D3, D8 and D11 drifted unnoticed. Documentation duplicated across seven prose files cannot be kept true by review. |

## Requirements

### R1 — Deterministic spec suite, no network, no LLM
A spec suite runnable as `npm test` covering seams **A–G**, using only the Node built-in test runner (`node:test` + `node:assert`) so the kit gains no new production dependency. Every spec runs against a temp directory; none touches the developer's real project or the network.

### R2 — Installer layout contract (seam A)
Specs must assert the **exact** installed tree for a fresh install and for a re-install over an existing project: `templates/root/*` lands at the project root, `templates/build-kit/*` lands in the kit directory, `node_modules`/`obj`/`bin`/`wwwroot`/`.vs` are never copied, `.gitignore` gains the kit entry exactly once, and `.claude/settings.json` receives the `eventmodelers` MCP server without clobbering pre-existing keys. `uninstall` must remove exactly what `install` created; `status` must report accurately for installed, not-installed, and corrupt-config cases.

### R3 — One kit-directory name, enforced (D1, D2, D10)
A single spec must assert that the directory name and the config path the installer writes are the *same strings* every prompt, skill, doc and script instructs the agent to read. It must **fail today** and pass only when the names are unified. No separate config locations.

### R4 — One slice-persistence contract (D3)
`fetchAndPersistSlices` and `load-slice/SKILL.md` must describe one contract, specified once. Specs must pin, from a fixture board response: context folder derivation (incl. casing), slice folder derivation (incl. `"slice:"` stripping), `current_context.json` selection when zero / one / many contexts have `Planned` work, `context.json`, the `index.json` entry shape and `definition` payload, merge-on-re-fetch preserving `assigned`, and correct handling of missing `contextName`, duplicate titles, and titles containing path-hostile characters.

### R5 — Task queue contract (seam E, F)
Specs for: task shape (`id`, `createdAt`, `payload`); **dedupe by `sliceId`** replacing an earlier task for the same slice; `Planned` never enqueuing a task (handled by `onPlannedSlice`); `hasPendingTasks` returning false for missing / empty / malformed `tasks.json`; `getFirstPlannedSliceTitle` being case-insensitive, skipping unparseable `index.json`, and returning `null` when nothing is planned.

### R6 — Loop trigger logic (seam F)
`ralphLoop` must be exercised with a stub executor: tasks-only fires `prompt.md`; planned-only fires `backend-prompt.md`; both fire both; neither fires nothing and idles. Uncredentialed mode must skip the task branch and still run the planned branch. Executor failure must retry rather than exit the loop. This requires exporting the loop internals from `lib/ralph.js` for injection — that refactor is in scope.

### R7 — Auth and transport behavior (seam B, C)
Specs against a local fake Eventmodelers HTTP server for: config merge precedence (`/api/config` over local, `BASE_URL` env over both); `retryOn401` retrying exactly 3 times then exiting non-zero; non-401 errors propagating without retry; `agent-alive` ping payload and headers; realtime-token refresh; and the `Exit` broadcast shutting the agent down. The Supabase channel must be injectable so this needs no live Supabase.

### R8 — Slice-type routing has one source of truth (seam G)
The routing rule (`TRANSLATION` → automation; non-empty `processors` → automation; `projections`/`queries`/`readModel` → state-view; else state-change) is currently restated in three prose documents that already disagree in ordering. It must be expressed once as data, asserted by a spec table covering each type, precedence conflicts (e.g. both `processors` and `queries` present), and the empty/absent-field cases — and the prose must be generated from or checked against that single source.

### R9 — Corpus sync and a real `--check` (D4, D5, D6, D7)
`sync-corpus-to-templates.mjs` must read the manifest that exists, must not destroy the hand-written `cratis-conventions.md`, and must produce `templates/root/.cratis/ai.json`. `--check` must **compare without mutating** and exit `2` when it cannot run, `1` when out of sync, `0` when in sync — and must print the number of artifacts compared. It must ship a `--self-test` that plants a known drift and fails if it is not detected.

### R10 — `ai.json` pinned to the Cratis standard (D8)
A spec must assert `.cratis/ai.json` carries the organization-standard harnesses, profiles and languages (matching `Direct` / `Studio`), so a bogus profile name silently shrinking the installed corpus cannot happen again.

### R11 — Starter app is buildable and testable (D9)
`templates/root` must gain a spec project wired into the solution, with at least one reference spec for the shipped example slice in the `Cratis.Specifications` BDD layout. CI must run `dotnet build` (zero warnings) and `dotnet test` against the starter so the commands the prompts tell the agent to run actually work.

### R12 — Cratis conformance grading (seam H)
A deterministic checker that grades *generated* slice code against the non-negotiables — one `.cs` per slice, `[Command]` with `Handle()` on the record and no separate handler class, `[EventType]` with no attribute arguments and past-tense naming, no nullable event properties, `ConceptAs<T>`/`EventSourceId<T>` instead of raw primitives, namespace mirroring folders, no `IEventLog` injection. Usable both as a spec over fixtures and as the grader for agent end-to-end runs.

### R13 — CI wiring
`pull-requests.yml` must run the spec suite and a real `--check`, with `timeout-minutes` set and a `no-release` intent for test-only changes. A green run must print the number of specs executed — a suite that silently matched zero files must fail.

### R14 — A `Documentation/` folder (D13)

The kit must gain a `Documentation/` folder following the house pattern, with **one Diátaxis type per page** and an index that makes the set navigable. It carries both audiences the kit has — the developer *installing* it and the contributor *changing* it:

```text
Documentation/
├── index.md                     what the kit is; where to start
├── toc.yml
├── getting-started/             Tutorial — board slice → running Cratis slice, end to end
├── guides/                      How-to — connect a board, run without credentials,
│                                run against Ollama, target another project directory,
│                                recover a stuck slice, add a build skill
├── understand/                  Explanation — the loop and its two independent triggers,
│                                slice-type routing, why backend precedes frontend,
│                                what the agent is and is not allowed to decide
├── reference/                   Reference — installed layout, config schema,
│                                `.slices/` tree contract, `tasks.json` schema,
│                                slice statuses, CLI commands, board API surface
└── decisions/                   ADRs, in the `AI` repository's format
```

Specific requirements:

- **The `.slices/` tree, `tasks.json` and the config schema are documented exactly once**, in `reference/`, and `load-slice/SKILL.md` and `lib/ralph.js` both point at that page instead of restating it (this is what R4 reconciles).
- **Slice-type routing gets one page**, generated from or checked against the single source of truth in R8.
- **The installed layout page names the real kit directory** and is asserted by the R3 path-contract spec, so the docs cannot drift from the installer.
- A `Documentation/verify-markdown.sh` modelled on the CLI's — `markdownlint-cli2` plus `linkinator` — run in CI, reporting both results and failing if either fails.
- Decision records for the choices this issue forces: the kit directory name, one persistence implementation, generated-vs-authored `cratis-conventions.md`, and how agent output is graded (R12).
- The build kit is **not** currently registered as a product in the aggregated documentation site's `PRODUCTS` list, so these pages are repository-local for now. Whether to publish them on cratis.io is a separate decision — worth an explicit ADR rather than an assumption either way.

### R15 — A README in the Cratis house style (D12)

Rewrite `README.md` to match the shape used by [`Cratis/cli`](https://github.com/Cratis/cli) — the reference for a user-facing Cratis tool:

- **Centered hero block**: logo linking to the product page, one-line bold description, badge row (release, license, Discord, CI), and a short caption.
- **`## Start here`** — four or five links: install, the tutorial in `Documentation/`, the board setup guide, releases.
- **`## Place in the Cratis ecosystem`** — how the kit relates to [Chronicle](https://github.com/Cratis/Chronicle), [Arc](https://github.com/Cratis/Arc), [Cratis AI](https://github.com/Cratis/AI) and the [Eventmodelers platform](https://app.eventmodelers.ai), plus the sibling Kotlin/Java kits and the upstream Nebulit origin.
- **A narrative problem section** in place of the current flat feature list — the CLI README's *"When the read model is wrong"* is the model. Here that is the gap between a board where the model is *designed* and a repository where it has to be *built*, and what it costs to cross that gap by hand.
- **Real output**, not description: an actual `ralph-claude.js` transcript showing a slice going `Planned → InProgress → Done`, and the generated slice `.cs` file beside the `slice.json` it came from.
- **Correct install instructions** — the real repository name, with the git-install path explained (the package is `private`), and the `npx` form verified to work rather than relying on a rename redirect.
- **Links into `Documentation/` instead of duplicating it.** The README should get shorter in the sections R14 now owns, not longer.

**Every claim about how it works must link to the source that defines it.** The README's "How it works" section currently *asserts* behavior with nothing behind it — which is how it came to describe a kit directory the installer does not create. A reader who wants to know what actually happens must be one click from the file that decides it:

| Claim in the README | Links to |
|---|---|
| the loop and its two triggers | `templates/build-kit/lib/ralph.js` (the `ralphLoop` function), and `Documentation/understand/the-loop.md` |
| board slices are persisted to `.slices/` | the `reference/slices-tree.md` contract page, and `fetchAndPersistSlices` |
| a status change queues a task | `reference/tasks-json.md`, and `writeTask` |
| slice-type routing | `lib/slice-type.js` (R8) and `understand/slice-type-routing.md` |
| what the agent is instructed to do | `templates/build-kit/lib/prompt.md` and `lib/backend-prompt.md` — these *are* the behavior, and most readers never learn they exist |
| what "the Cratis way" means | `templates/.claude/skills/_shared/cratis-conventions.md`, the three `build-*` skills, and [Cratis AI](https://github.com/Cratis/AI) |
| board API calls and slice statuses | the `connect` / `load-slice` / `update-slice-status` skills, and the platform's API documentation |
| the platform contract the kit implements | the upstream [Eventmodelers Build Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits) repository and [`@eventmodelers/cli`](https://www.npmjs.com/package/@eventmodelers/cli) — see #10 |

Prefer a **permalink to the defining file or function** over a prose restatement. Where the source is upstream rather than here, say so and link there — a reader should never have to guess whether a behavior is ours or the platform's. R16's link spec covers these, so a link to a file that has moved fails CI.

### R16 — Documentation is held true by specs

Documentation drift is what produced half the defects above, so the docs get the same treatment as the code:

- The R3 path-contract scan covers `README.md` and `Documentation/**` — a documented path that does not exist fails CI.
- A spec extracts every fenced `bash` command from `README.md` and `Documentation/**` and asserts each references a real script, a real CLI subcommand, or a real file. It prints the number of commands checked and **fails on zero**.
- A spec asserts every repository URL in `README.md` resolves to this repository without relying on a redirect.
- **A spec asserts every source link in the README's "How it works" table resolves to a file that exists** — relative links checked on disk, upstream links checked for reachability (skipped with an explicit `skipped:` line when offline, never a silent pass). Renaming `lib/ralph.js` must break the README build, not silently orphan the explanation.
- `verify-markdown.sh` runs in `pull-requests.yml` alongside the spec suite.

## Out of scope

- Asserting specific LLM output text, or making agent runs a required PR gate.
- Live Eventmodelers platform or Supabase connectivity in the default suite.
- Rewriting the build skills' prose beyond what R3 / R8 / R14 require.
- Registering the kit as a product on the aggregated cratis.io documentation site — R14 calls for an ADR on that, not the work itself.

## Definition of done

- `npm test` runs green locally and in CI and reports a non-zero spec count.
- Every defect D1–D13 has a spec or a check that **failed before** its fix and passes after.
- `--check` provably detects planted drift via `--self-test`.
- `dotnet build` + `dotnet test` on `templates/root` pass in CI.
- `Documentation/verify-markdown.sh` passes with zero lint errors and zero broken links.
- Every contract named in R4, R5, R8 and R14 is written down in exactly one place, and a spec fails if a second copy drifts from it.
