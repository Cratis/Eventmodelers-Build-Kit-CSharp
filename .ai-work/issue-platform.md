## Summary

This repository is a fork of an older, pre-consolidation snapshot of [Nebulit-GmbH/Eventmodelers-Build-Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits). Since we forked, upstream **consolidated every build kit into one npm package**, [`@eventmodelers/cli`](https://www.npmjs.com/package/@eventmodelers/cli) (v1.0.55 at the time of writing), and **`cratis-csharp` is already a first-class stack inside it**.

We are now shipping a competing installer for a stack the platform's own CLI already installs — from a snapshot that has drifted badly. Most of what makes the kit work with the platform now lives in upstream's `shared/` tree, which our fork copied *before* it was shared and has been diverging from ever since.

This issue records what upstream's contract actually is, where we violate it, and the **recipe** a build kit has to follow to work with the platform.

> Research method: `git fetch upstream` against `git@github.com:Nebulit-GmbH/Eventmodelers-Build-Kits.git`, then reading `upstream/main` directly. Every path and line count below is from that tree, not from the rendered GitHub page.

## What upstream is now

One package, one CLI, twelve stacks:

| Path | What it is |
|---|---|
| [`eventmodelers-cli/cli.js`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/cli.js) | 2,633 lines — the single installer/runner. `STACKS` registry at line 44 |
| [`eventmodelers-cli/shared/build-kit/`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/build-kit) | The runtime every stack shares: `lib/ralph.js`, `ralph-claude.js`, `ralph-ollama.js`, `ralph.sh`, `realtime-agent.js`, `code-export.mjs`, `lib/agent.sh`, `lib/ollama-agent.js`, `lib/adapters/`, `lib/util/find-slice.cjs` |
| [`eventmodelers-cli/shared/skills/`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/skills) | Platform skills every stack shares: `connect`, `load-slice`, `update-slice-status`, `learn-eventmodelers-api`, `request-feedback` |
| `eventmodelers-cli/stacks/<key>/templates/` | Per-stack content only: `.claude/skills/build-*`, `root/`, `build-kit/` |

Stacks: `node`, `supabase`, `axon`, **`cratis-csharp`**, `opencqrs`, `umadb`, `kurrent`, `react`, `supabase-react`, `modeling-kit`, `bridge`, `blank`.

Upstream's own comment on why `shared/` exists ([`cli.js:33-41`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/cli.js#L33-L41)) describes exactly the failure mode this fork is in:

> those files have no per-stack content, so they live once instead of being copy-pasted into every stack (that copy-pasting is exactly how they drifted out of sync before: a bugfix or default landing in one stack's copy but not another's).

## Where we violate the contract

| # | Finding | Evidence | Impact |
|---|---|---|---|
| **P1** | **The kit directory must be `.build-kit`.** Upstream hard-forces `kitDirName: '.build-kit'` for every built-in stack *and* for git-installed community stacks — [`resolveGitStackConfig`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/cli.js) overrides whatever a stack asks for, so `run` / `status` / `uninstall` can find it. We use `.cratis-build-kit/` in the installer and `.build-kit-cratis-csharp/` in prompts — **neither is the contract**. | `STACKS['cratis-csharp'].kitDirName === '.build-kit'` | `@eventmodelers/cli run`, `status` and `uninstall` cannot see our installation at all. This also resolves #9's D1 with an authoritative answer rather than a coin-flip between our two wrong names. |
| **P2** | **Credentials live in the project root's `.eventmodelers/config.json`.** Upstream resolves config by walking up from cwd, then layering `<kit-dir>/.eventmodelers/config.json` as a *per-kit override*. Our installer writes **only** the kit-dir copy, and never the root one. | upstream README, "Claude execution & config resolution" | The `connect` skill reads the project root and finds nothing — #9's D2, with the correct fix now known: write the root file, treat the kit-dir file as an optional override. |
| **P3** | **We forked the shared runtime.** `templates/build-kit/` should contain only `CLAUDE.md`, `lib/AGENT.md`, `lib/prompt.md`, `lib/backend-prompt.md` — that is upstream's entire `stacks/cratis-csharp/templates/build-kit/`. We additionally carry our own `ralph.js`, `ralph-claude.js`, `ralph-ollama.js`, `ralph.sh`, `realtime-agent.js`, `code-export.mjs`, `lib/agent.sh`, `lib/ollama-agent.js`, `package.json`. | our `lib/ralph.js` is **302 lines** vs shared's **604**; `diff` is **524 lines** | Half the runtime's behavior is missing, and every upstream fix lands in a file we do not consume. |
| **P4** | **We forked four platform skills.** `connect`, `load-slice`, `update-slice-status`, `learn-eventmodelers-api` are `shared/skills/` upstream; upstream's `cratis-csharp` stack ships **none** of them. Our `load-slice/SKILL.md` differs from shared by **92 lines** — the source of #9's D3 divergence. | `stacks/cratis-csharp/templates/.claude/skills/` = `_shared`, `build-automation`, `build-state-change`, `build-state-view` only | We maintain a private, stale copy of the platform's own API contract. |
| **P5** | **Missing `request-feedback`.** A platform skill we do not have at all. Upstream's `cratis-csharp` `prompt.md` uses it as the escalation path for an ambiguous slice: post the question as a board comment, set the slice `Blocked`, drop the task — instead of guessing and building the wrong thing. | present in upstream `prompt.md`, absent from ours | Our agent has no way to say "this slice is underspecified". It guesses. |
| **P6** | **Supabase is hardcoded.** Upstream abstracted the transport behind [`lib/adapters/realtime-adapter.js`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/shared/build-kit/lib/adapters/realtime-adapter.js), selecting Supabase broadcast (hosted SaaS) or PocketBase record-change events (self-hosted / on-prem) from `cfg.realtimeProvider` returned by `/api/config`. Our `lib/ralph.js` calls `createClient` from `@supabase/supabase-js` directly. | `realtimeProvider ?? 'supabase'` | **Self-hosted and on-prem Eventmodelers installations cannot use the Cratis kit.** It silently tries Supabase and never receives a slice change. |
| **P7** | **No commit-scope checks.** The `node` and `supabase` stacks ship a numbered check pipeline — `lib/check-commit-scope.cjs` plus `lib/checks/{00-blocked-paths,10-slice-scope,20-append-only-migrations,30-test-file-present,40-no-invented-fields,50-spec-coverage,60-openapi-annotation,90-tsc-build}.cjs` — run against the staged changeset of a slice commit, with a documented plugin contract in [`shared/build-kit/lib/checks/README.md`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/shared/build-kit/lib/checks/README.md). `cratis-csharp` ships none. | `run-checks` is a first-class CLI command | This is the mechanism #9's R12 proposes building from scratch. It already exists — we should implement the interface, not invent one. |
| **P8** | **Our prompts are a stale snapshot.** `prompt.md` differs from upstream's `cratis-csharp` copy by 23 lines, `backend-prompt.md` by 26 — and once the kit-dir renames are discounted, the remainder is upstream content we are missing (the `request-feedback` escalation), not Cratis improvements we added. | `diff` against `upstream/main` | We are behind on the stack upstream maintains *for us*, and not obviously ahead anywhere. |
| **P9** | **Claude-only.** Upstream installs agent surfaces for Claude, VS Code, Cursor, Windsurf, Gemini CLI, Qwen, OpenCode, Copilot, Amazon Q, Kiro, Kilocode, Augment, Antigravity and the shared `.agents/skills/` convention (Codex / Mistral Vibe / Pi / Letta). We install `.claude/` only. | `AGENT_SURFACES` in `cli.js` | Awkward for Cratis specifically: our own `.cratis/ai.json` targets six harnesses, and the kit we ship supports one. |
| **P10** | **Package identity is unclear.** Ours is `@cratis/eventmodelers-build-kit-csharp`, `"private": true`, installed via `npx github:…`. Upstream's is `@eventmodelers/cli`, published, `init --stack cratis-csharp`. Upstream's root README still lists the pre-consolidation package name `build-kit-cratis-csharp` as retired. | both `package.json` files | Two install paths for one stack, and users will find upstream's first. |

## Decision required

Three viable shapes. **This issue does not choose one** — that is a decision for the maintainers, and it should be recorded as an ADR (see #9's R14).

**Option A — upstream the stack.** Contribute `stacks/cratis-csharp/` improvements to `@eventmodelers/cli` and retire this repository to a thin pointer. Lowest maintenance, zero drift, but Cratis loses release control and cannot ship the Cratis AI corpus integration (`.cratis/ai.json`, `cratis-conventions.md` generation) that upstream has no reason to carry.

**Option B — external git stack (recommended starting point).** Upstream supports installing a stack from an arbitrary git repository:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

We keep this repository, keep release control, keep the Cratis corpus integration — and get `shared/` layered in automatically, so P3/P4/P5/P6 stop being our problem. The precedent exists: the Rust `skilj` kit ships this way and is listed in upstream's README. Cost: conforming to the layout below, and dropping our own installer.

**Option C — stay forked.** Only defensible if we commit to tracking `shared/` actively, which we have demonstrably not been doing. Every finding above is the cost of this option, already incurred.

---

# The recipe: how a build kit must be implemented

Derived from upstream's [`cli.js`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/cli.js) (`STACKS`, `resolveGitStackConfig`, `installStack`) and the ["Adding a stack"](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/README.md) section. This is the contract, whichever option we pick.

## 1. Repository layout

A stack repository — built-in or external git — **must** mirror this exactly. `installStack()` treats both identically, and refuses to install anything missing `templates/.claude` or `templates/root`.

```text
stack.json                              optional manifest (external git stacks)
templates/
├── .claude/
│   └── skills/
│       ├── build-state-change/SKILL.md     required — write slices
│       ├── build-state-view/SKILL.md       required — read slices
│       ├── build-automation/SKILL.md       required — reactors / automation
│       ├── <extra>/SKILL.md                optional — e.g. supabase's build-webhook
│       └── _shared/<stack>-conventions.md  optional — the stack's idioms
├── root/                                   spread into the project root: the starter app
└── build-kit/                              stack-specific runtime overlay ONLY
    ├── CLAUDE.md
    └── lib/
        ├── prompt.md                       the task-driven loop (status changes)
        ├── backend-prompt.md               the planned-slice loop (build a slice)
        ├── AGENT.md                        seeded learnings
        ├── check-commit-scope.cjs          optional
        └── checks/*.cjs                    optional, numbered
```

**Do not put anything in `templates/build-kit/` that is not stack-specific.** With `useShared: true`, `shared/build-kit/*` is copied in first and your `templates/build-kit/*` is overlaid on top. Shipping your own `ralph.js` opts you out of every upstream fix — which is P3.

## 2. `stack.json`

Only for external git stacks. Every field optional; `kitDirName` is **not** configurable — it is always forced to `.build-kit`.

```json
{
  "label": "Cratis (.NET/C#)",
  "kitSubdir": "build-kit",
  "useShared": true,
  "needsBoardId": true
}
```

- `kitSubdir` must be a plain relative subdirectory name. Upstream rejects `..` and absolute paths (path-traversal guard).
- `useShared: false` opts out of the entire shared runtime. Only `modeling-kit` does this, because it has no task queue at all. A backend stack always wants `true`.

## 3. The runtime contract you inherit

With `useShared: true` you get, and must not reimplement:

| Concern | Shared file |
|---|---|
| Loop, task queue, slice persistence | `lib/ralph.js` |
| Claude / Ollama executors | `ralph-claude.js`, `ralph-ollama.js`, `lib/agent.sh`, `lib/ollama-agent.js` |
| Realtime transport (Supabase **and** PocketBase) | `lib/adapters/realtime-adapter.js` |
| Standalone agent | `realtime-agent.js` |
| Code export server | `code-export.mjs` |
| Slice lookup | `lib/util/find-slice.cjs` |

And these platform skills, which you must **not** copy into your stack: `connect`, `load-slice`, `update-slice-status`, `learn-eventmodelers-api`, `request-feedback`. Upstream is explicit — fork one into your stack *only* once it genuinely needs stack-specific behavior.

## 4. On-disk contract at runtime

| Path | Owner | Contents |
|---|---|---|
| `.build-kit/` | CLI | the installed kit — the name `run`/`status`/`uninstall` look for |
| `.eventmodelers/config.json` | CLI, project root | `organizationId`, `boardId`, `token`, `baseUrl`; gitignored. Resolution walks up from cwd, then layers `<kit-dir>/.eventmodelers/config.json` as a per-kit override, then `~/.eventmodelers/config.json` as last resort |
| `.build-kit/.slices/<context>/<slice>/slice.json` | `load-slice` / `fetchAndPersistSlices` | the slice definition — **the** source of truth for the build |
| `.build-kit/tasks.json` | realtime agent | queued slice-status changes |
| `progress.txt`, `AGENT.md` | agent | progress log and accumulated learnings |

## 5. The two loops

Independent triggers — not a chain. Either can fire alone:

- **`tasks.json` non-empty** → run `lib/prompt.md`. Reacts to a *status change*: `Planned` builds, `InProgress` skips (another agent owns it), `Done`/`Blocked`/`Review` log.
- **a slice is `Planned` in `.slices/*/index.json`** → run `lib/backend-prompt.md`. Builds exactly one slice, then stops so the loop can re-enter.

Both prompts must end with a `<promise>` sentinel: `IDLE`, `NO_TASKS`, `DONE`, or `COMPLETE`.

## 6. Slice-type routing

Every stack routes identically. The `slice.json` decides:

| Condition | Skill |
|---|---|
| `sliceType === "TRANSLATION"` | `build-automation` (read `description`/`notes` for hints) |
| `processors[]` non-empty | `build-automation` |
| `projections` / `queries` / `readModel` present | `build-state-view` |
| otherwise (`commands` / `events`) | `build-state-change` |

## 7. Status protocol

Claim before building, release after. Valid values: `Created`, `Planned`, `InProgress`, `Review`, `Done`, `Blocked`, `Assigned`, `Informational`.

`Planned` → set `InProgress` immediately (**this is the concurrency guard** — upstream's `update-slice-status` rejects a transition into a status the slice is already in, so two agents cannot both claim one slice; treat that rejection as `ALREADY_IN_STATUS` and move on, never as a failure to retry) → build → verify → commit → set `Done`. On ambiguity, `request-feedback` posts the question to the board and sets `Blocked`. On a failed check, revert to `Planned` and abandon the task rather than retrying in place.

## 8. Quality gate

The stack's own build and test commands, run from the project root, zero warnings. For Cratis: `dotnet build` (which also regenerates the TypeScript proxies) then `dotnet test --filter "FullyQualifiedName~<SliceName>"`. Backend must compile **before** the slice's frontend can reference its generated proxy.

Optionally implement the check plugin contract so `@eventmodelers/cli run-checks` works — each `lib/checks/NN-name.cjs` exports `{ name, skipIfAlreadyFailing?, run(ctx) }` and returns `[{ path, reason }]`. See [`shared/build-kit/lib/checks/README.md`](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/shared/build-kit/lib/checks/README.md).

## 9. Promotion path

`init --build-kit` scaffolds a TODO-marked blank kit → fill it in against a real backend → promote by copying into `stacks/<name>/templates/`, adding the `STACKS` entry, and updating the README and `stacks` output.

---

## Proposed work

1. **Decide and record** Option A / B / C as an ADR before any code moves.
2. **Adopt `.build-kit`** as the kit directory and write `.eventmodelers/config.json` to the project root (P1, P2) — this also closes #9's D1 and D2 with the authoritative name rather than a guess.
3. **Stop forking the shared runtime and the four platform skills** (P3, P4); pick up `request-feedback` (P5).
4. **Route realtime through the adapter** so self-hosted/PocketBase boards work (P6).
5. **Implement the check plugin contract** rather than inventing a parallel grader — fold into #9's R12 (P7).
6. **Rebase our prompt content** onto upstream's current `cratis-csharp` prompts, keeping only genuine Cratis additions (P8).
7. **Reconcile packaging and the install path** with `@eventmodelers/cli` (P9, P10), and update the README accordingly — see #9's R15.

## Verification

- `npx @eventmodelers/cli status` recognizes an installation produced by this repository.
- A slice moved to `Planned` on a real board is picked up, built, and set to `Done`, against **both** a Supabase-backed and a PocketBase-backed platform instance.
- `diff` between our `templates/build-kit/` and upstream's `stacks/cratis-csharp/templates/build-kit/` is limited to deliberate Cratis-specific content, and a CI check keeps it that way.
- `npx @eventmodelers/cli run-checks` executes our checks and reports violations.

Related: #9 (automated specs) — several findings here supply the authoritative answer to defects recorded there.
