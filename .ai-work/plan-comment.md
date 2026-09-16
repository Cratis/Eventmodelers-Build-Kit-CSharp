# The exact plan

Ordered so that **every phase ends with a command that produces a signal**, and so the earliest phases already fail against today's `main` — if a phase goes green on first run without a fix, the spec is wrong, not the code.

## Harness

- **Runner:** Node's built-in `node:test` + `node:assert/strict`. Zero new production dependencies (the kit ships only `commander`), no config file, works on the pinned Node 20.
- **Layout:** Cratis BDD folder semantics, with a `.test.js` suffix so the built-in runner discovers files without a custom glob:

  ```
  Specs/
  ├── given/
  │   ├── a_temp_project.js          mkdtemp + cleanup, returns { projectDir, kitDir }
  │   ├── a_fake_board.js            node:http server: /api/config, /realtime-token,
  │   │                              /slicedata/slices, /api/agent-alive, /nodes/events
  │   ├── a_stub_executor.js         records (promptFile, cwd, invocationCount); scripted exits
  │   └── a_board_response.js        fixture builder over the slicedata shape
  ├── fixtures/
  │   ├── slices.state-change.json   commands[] + events[]
  │   ├── slices.state-view.json     readModel/projections/queries
  │   ├── slices.automation.json     processors[] non-empty
  │   ├── slices.translation.json    sliceType === "TRANSLATION"
  │   ├── slices.ambiguous.json      processors[] AND queries[] — precedence conflict
  │   └── slices.hostile.json        "slice:" prefix, mixed casing, duplicate titles,
  │                                  missing contextName, "/" and unicode in title
  ├── for_cli/ for_slice_persistence/ for_task_queue/ for_ralph_loop/
  ├── for_config_resolution/ for_slice_routing/ for_corpus_sync/ for_path_contract/
  └── for_cratis_conformance/
  ```

- `package.json`: `"test": "node --test Specs/"`, `"test:watch"`, `"check": "node scripts/sync-corpus-to-templates.mjs --check"`.
- **Every** spec runs inside `mkdtemp(os.tmpdir())` and asserts nothing outside it is touched. No spec reaches the network; the fake board binds `127.0.0.1:0` and passes its port via `BASE_URL`.

## Phase 0 — Prove the suite can fail (before writing any real spec)

Land the harness with one intentionally-failing spec and one passing spec, run `npm test`, and record both counts. Then delete the failing one. This is the non-vacuity fuse: it establishes the runner actually executes and reports, so a later "0 tests, 0 failures" cannot be mistaken for green.

**Signal:** `npm test` prints `pass 1 / fail 1`, then `pass 1 / fail 0`.

## Phase 1 — The path contract (D1, D2, D10) — *fails today*

One spec, no refactor needed, highest value first.

1. Define the contract in one module — `lib/paths.js`: `KIT_DIR_NAME`, `configPath(kitDir)`, `slicesDir(kitDir)`, `tasksPath(kitDir)`.
2. `for_path_contract/when_scanning_the_repository/and_a_kit_directory_is_referenced.test.js` walks `src/`, `scripts/`, `templates/` and asserts **every** literal matching `/\.(cratis-build-kit|build-kit-cratis-csharp)\b/` equals `KIT_DIR_NAME`, and every config-path literal equals the one produced by `configPath`. It prints the number of files scanned and **fails if that count is zero**.
3. Run it → expect **33 violations** across 6 files. Fix by unifying on `.cratis-build-kit/` (the name the installer actually uses) in `load-slice/SKILL.md`, `prompt.md`, `backend-prompt.md`, `ralph.sh`, `CLAUDE.md`, `cli.js` console output, and by pointing `connect`/`code-export.mjs` at `configPath()`.
4. Re-run → zero violations, non-zero file count.

**Signal:** the spec fails with a listed violation per file before the fix, passes with a printed scan count after.

## Phase 2 — Installer layout (R2)

`for_cli/when_installing/…` drives `src/cli.js` in-process (export the `install` action so it is callable without spawning, and inject a non-interactive prompt so credential entry does not block):

- `and_the_project_is_empty` — assert the full expected tree as a sorted path list compared to a golden array; assert `templates/root/*` at project root and `templates/build-kit/*` in the kit dir, not nested one level deeper.
- `and_node_modules_exist_in_templates` — plant `templates/build-kit/node_modules/x` and `templates/root/obj/y`, assert neither is copied.
- `and_a_gitignore_already_exists` / `and_install_runs_twice` — kit entry present exactly once, existing entries preserved.
- `and_claude_settings_already_has_servers` — the `eventmodelers` MCP entry is added, unrelated `mcpServers` keys and top-level keys survive.
- `when_uninstalling/…` — removes exactly the paths install created; a user file placed inside the kit dir is reported, not silently destroyed.
- `when_checking_status/…` — installed, not-installed, and invalid-JSON config all report correctly and exit with the right code.

**Signal:** `node --test Specs/for_cli/` green, with the golden tree diffed on failure.

## Phase 3 — Extract the loop internals (enables R4–R7)

`lib/ralph.js` currently exports only four symbols; the logic under test is module-private. Refactor — **no behavior change**:

```js
export { fetchAndPersistSlices, writeTask, hasPendingTasks,
         getFirstPlannedSliceTitle, ralphLoop, loadLocalConfig,
         fetchPlatformConfig, retryOn401, startRealtimeAgent, startRalph };
```

and give `startRealtimeAgent` an injectable channel factory (`{ createChannel = defaultSupabaseChannel } = {}`) so the Supabase client is replaceable by a fake that emits `slice:changed` / `Exit` on demand.

**Signal:** `node -e "import('./templates/build-kit/lib/ralph.js').then(m => console.log(Object.keys(m).length))"` prints 10; `node .cratis-build-kit/ralph-claude.js` still starts against the fake board.

## Phase 4 — Slice persistence, one contract (D3, R4) — *fails today*

1. Write `Specs/for_slice_persistence/` against `fixtures/slices.hostile.json` asserting the **intended** contract: context casing, `"slice:"` stripping, `context.json`, the full-object `definition`, merge preserving `assigned`, `current_context.json` selection for zero / one / many planned contexts, duplicate-title disambiguation, and path-hostile titles never escaping `.slices/`.
2. Run → `fetchAndPersistSlices` fails ~7 of them.
3. Reconcile: make `fetchAndPersistSlices` the single implementation, and rewrite `load-slice/SKILL.md` Step 3 to *describe* it rather than restate it. Add a spec asserting the skill document's stated field names appear in the implementation.
4. Re-run → green.

**Signal:** named failures per rule before, green after; the skill doc and the code no longer disagree on any field name.

## Phase 5 — Task queue and loop triggers (R5, R6)

- `for_task_queue/` — task shape; dedupe replacing an earlier task for the same `sliceId` (assert length stays 1 and `createdAt` advances); `Planned` never enqueued; `hasPendingTasks` false for missing / `[]` / `{`-corrupt / non-array; `getFirstPlannedSliceTitle` case-insensitive, skips unparseable `index.json`, returns `null` when none.
- `for_ralph_loop/` — run `ralphLoop` with the stub executor and an abort after N cycles:

  | Given | Then |
  |---|---|
  | tasks only | executor called once with `prompt.md`, cwd = projectDir |
  | planned only | executor called once with `backend-prompt.md` |
  | both | both prompts, task branch first |
  | neither | executor never called; loop idles |
  | no credentials + tasks | task branch skipped |
  | no credentials + planned | planned branch still runs |
  | executor throws once | retried, loop survives (inject the 60s delay so it is instant) |

**Signal:** the table above as seven named specs, all green, with the retry spec proving the loop does not exit.

## Phase 6 — Config, auth, transport (R7)

Against `a_fake_board`:

- precedence: `/api/config` overrides local; `BASE_URL` env overrides both; missing config file → local-only mode, no throw.
- `retryOn401` — 401 three times then `process.exit(1)` (inject the exit hook); 401 twice then 200 → resolves; 500 → propagates immediately without retry (assert request count is 1).
- `agent-alive` ping — asserted method, `Authorization: Bearer <realtimeToken>`, and body `{ token }`.
- fake channel emits `Exit` → shutdown hook called; emits `slice:changed` with `InProgress` → slices re-fetched **and** a task written; with `Planned` → slices re-fetched and **no** task written.

**Signal:** fake-server request log asserted per spec; zero real network calls (assert by running the suite with `NODE_OPTIONS=--no-network`-equivalent guard: a stubbed global `fetch` that throws on any non-loopback host).

## Phase 7 — Routing, one source of truth (R8)

1. `lib/slice-type.js` exporting `resolveSliceType(slice)` returning `state-change | state-view | automation | translation`, with the precedence fixed explicitly (`TRANSLATION` → `processors` → `projections|queries|readModel` → default).
2. `for_slice_routing/` — a spec table over all five fixtures plus the ambiguous one, plus empty-array vs absent-field cases.
3. Replace the three prose restatements in `prompt.md`, `backend-prompt.md` and `AGENT.md` with a generated block, and add a spec asserting the generated block matches `resolveSliceType`'s table — so prose drift fails CI.

**Signal:** routing table green; the prose-drift spec fails if any of the three docs is edited by hand.

## Phase 8 — Corpus sync and a `--check` that can fail (D4, D5, D6, D7, R9) — *fails today*

1. Fix the manifest path to `.cratis/ai.manifest.json` and derive revision from `SourceRevision`.
2. **Stop generating** `cratis-conventions.md` over the hand-written file. Either treat it as authored content and only verify it stays in sync with the corpus, or generate to a distinct path and leave the authored file alone. A spec asserts the 251-line authored doc still contains its section headings after a sync run.
3. Emit `templates/root/.cratis/ai.json` from `.cratis/ai.json`.
4. Rewrite `--check`: compute into a temp dir, **compare**, mutate nothing. Exit `2` cannot-run, `1` out-of-sync, `0` in-sync; on `0`, print `checked N artifacts`.
5. Add `--self-test`: copy the tree to temp, plant a drift in each synced artifact, assert `--check` returns `1` for every one, and `0` for the untouched copy. Fail if any planted drift goes undetected.
6. `for_corpus_sync/` also asserts `--check` leaves `git status --porcelain` empty.

**Signal:**
```
node scripts/sync-corpus-to-templates.mjs --check ; echo $?     # 0, "checked N artifacts"
node scripts/sync-corpus-to-templates.mjs --self-test ; echo $?  # 0, "N/N planted drifts detected"
git status --porcelain                                           # empty
```

## Phase 9 — `ai.json` pinned (D8, R10)

`for_corpus_sync/when_reading_ai_json/…` asserts harnesses, profiles and languages equal the organization standard, and that no profile name is absent from the corpus manifest's known set. (The file was corrected to match `Direct`/`Studio` alongside this issue; this spec is what stops it drifting back.)

**Signal:** spec green; deliberately reinserting `cratis/application/arc-chronicle` turns it red.

## Phase 10 — Starter app builds and tests (D9, R11)

1. Add `templates/root/CratisApp.Specs/CratisApp.Specs.csproj` (xUnit + `Cratis.Specifications` + `Cratis.Arc.Testing`), referenced from `CratisApp.sln`.
2. Add one reference spec for the shipped example slice in proper BDD layout — `SomeModule/SomeFeature/Registration/when_registering/and_the_name_is_valid.cs` using `CommandScenario<Register>` — so the agent has a pattern to copy and `dotnet test --filter` has something to match.
3. CI job: copy `templates/root` to a temp dir, `dotnet build -c Debug` (zero warnings — the csproj already sets `TreatWarningsAsErrors`), then `dotnet test`.

**Signal:** `dotnet build` zero warnings/errors; `dotnet test --filter "FullyQualifiedName~Registration"` runs **and reports ≥ 1 test** (a filter matching zero tests fails the job).

## Phase 11 — Conformance grader (R12)

`lib/conformance.js` — a Roslyn-free source scanner returning structured violations:

| Rule | Detection |
|---|---|
| one `.cs` per slice folder | count `*.cs` in the slice dir |
| `Handle()` on the record | `[Command]` record body contains `Handle(`; no `ICommandHandler` / `*Handler` class in the slice |
| `[EventType]` no arguments | `[EventType(` never appears |
| events past tense | event record names against an irregular-verb list + `ed$`/`en$` |
| no nullable event properties | no `?` on a property type inside an `[EventType]` record |
| no raw primitives | `Guid`/`string`/`int` not used as command/event property types |
| namespace mirrors folders | namespace equals `<RootNamespace>` + path, minus `Features` |
| no `IEventLog` in `Handle()` | parameter-type scan |

`for_cratis_conformance/` runs it over both a compliant fixture (the shipped example slice — must report **zero** violations) and a deliberately non-compliant fixture (must report **each** planted violation, asserted by rule name — the grader's own non-vacuity check).

**Signal:** compliant fixture → 0 violations; hostile fixture → every planted rule reported by name.

## Phase 12 — Optional agent end-to-end (not a PR gate)

`npm run e2e:agent` — fake board serves a fixture slice at `Planned`, the real `ralph-claude.js` runs one cycle against a scratch project, then: `dotnet build` must pass, `dotnet test` must report ≥ 1 test, the conformance grader must report zero violations, and the fake board must have received a `node:changed` setting `sliceStatus: Done`.

Manual / nightly only, with `continue-on-error` — it grades non-deterministic output with deterministic rules, so it is a quality signal, never a merge blocker.

## Phase 13 — `Documentation/` folder (R14) — *nothing exists today*

Built **after** phases 1, 4, 7 and 8, so every page documents a contract that is already pinned by a spec rather than a contract someone remembers.

1. Scaffold the tree from the issue, mirroring the CLI's shape: `index.md` + `toc.yml` at the root and per-folder `toc.yml`.
2. Write each page to **one** Diátaxis type, and enforce the split — no reference tables inside the tutorial, no teaching inside the how-to guides:

   | Page | Type | Sourced from |
   |---|---|---|
   | `getting-started/index.md` | Tutorial | a real run: install → connect → move a slice to `Planned` → watch it land → `Done` |
   | `guides/connect-a-board.md` | How-to | `connect/SKILL.md` + the installer's credential flow |
   | `guides/run-without-credentials.md` | How-to | the local-only branch in `startRalph` |
   | `guides/use-a-local-model.md` | How-to | `ralph-ollama.js` |
   | `guides/recover-a-stuck-slice.md` | How-to | `InProgress` handling + failed-build path |
   | `understand/the-loop.md` | Explanation | `lib/ralph.js` — the two independent triggers, with a Mermaid diagram |
   | `understand/slice-type-routing.md` | Explanation | generated from `lib/slice-type.js` (Phase 7) |
   | `understand/why-backend-first.md` | Explanation | proxy generation on `dotnet build` |
   | `reference/installed-layout.md` | Reference | the golden tree from Phase 2 |
   | `reference/slices-tree.md` | Reference | the Phase 4 contract — **the** definition, deleted from `load-slice/SKILL.md` |
   | `reference/tasks-json.md` | Reference | the Phase 5 schema |
   | `reference/config.md` | Reference | `lib/paths.js` + the config schema |
   | `reference/slice-statuses.md` | Reference | `update-slice-status/SKILL.md` |

3. **Delete the duplicates as each page lands.** `load-slice/SKILL.md` Step 3 becomes a link to `reference/slices-tree.md`; the routing prose in `prompt.md` / `backend-prompt.md` / `AGENT.md` becomes the generated block from Phase 7. The README loses the sections `reference/` now owns. Net prose should *shrink*.
4. Add `Documentation/verify-markdown.sh` modelled on the CLI's — `markdownlint-cli2` then `linkinator`, both always run, summary reports each, exit 1 if either failed.
5. Write the ADRs in `Documentation/decisions/` for the four choices this work forces: kit directory name, single persistence implementation, authored-vs-generated `cratis-conventions.md`, and how agent output is graded. Plus one for whether the kit becomes a cratis.io product (it is absent from the site's `PRODUCTS` list today — an explicit decision, either way).

**Signal:** `./Documentation/verify-markdown.sh` → `✓ All checks passed!`, exit 0; `grep -rc` shows each documented contract appearing in exactly one place.

## Phase 14 — README rewrite (R15)

Last, because it links into everything the earlier phases produced.

1. Hero block in the CLI's shape — centered logo linking to the product page, bold one-liner, badge row (release / license / Discord / CI), caption.
2. Record a real terminal transcript of one `Planned → Done` cycle for the hero, and place a generated slice `.cs` beside the `slice.json` it came from — the full-stack payoff shown, not asserted.
3. Replace the flat feature list with the narrative section: the gap between a board where the model is *designed* and a repository where it has to be *built*, and what crossing it by hand costs. This is the CLI README's *"When the read model is wrong"* slot.
4. `## Start here` and `## Place in the Cratis ecosystem` — Chronicle, Arc, Cratis AI, the Eventmodelers platform, the sibling Kotlin/Java kits, the Nebulit origin.
5. Fix the install path: real repository name everywhere, badge pointed at this repository's `publish.yml`, and the git-install explained (the package is `"private": true`, so there is no npm path — say so).
6. Cut every section now owned by `Documentation/reference/` down to a link.

**Signal:**
```bash
npx -y github:Cratis/Eventmodelers-Build-Kit-CSharp status   # the documented command, verbatim, works
./Documentation/verify-markdown.sh                            # exit 0
```
plus a before/after README line count showing the reference sections moved rather than duplicated.

## Phase 15 — Documentation held true by specs (R16)

- Extend the Phase 1 path-contract scan to `README.md` and `Documentation/**`.
- `for_documentation/when_scanning_commands/…` — extract every fenced `bash` command from `README.md` and `Documentation/**`, assert each names a real script, a real subcommand or a real file. Print the count; **fail on zero**.
- `for_documentation/when_scanning_links/…` — assert every `github.com/Cratis/...` URL in `README.md` resolves to this repository without a redirect (`gh api` with redirects disabled, skipped offline with an explicit `skipped:` line, never a silent pass).
- Wire `verify-markdown.sh` into `pull-requests.yml`.

**Signal:** the command spec prints `checked N commands` with N > 0; planting `npx github:Cratis/Wrong-Name` in the README turns it red.

## Phase 16 — CI wiring (R13)

`pull-requests.yml` gains, alongside the existing (now real) corpus check:

```yaml
  specs:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x' }
      - run: npm ci
      - run: npm test            # must print a non-zero pass count
      - run: node scripts/sync-corpus-to-templates.mjs --self-test
      - run: ./Documentation/verify-markdown.sh

  starter-app:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '10.0.x' }
      - run: cp -R templates/root "$RUNNER_TEMP/app"
      - run: dotnet build -c Debug "$RUNNER_TEMP/app/CratisApp.sln"
      - run: dotnet test "$RUNNER_TEMP/app/CratisApp.sln"
```

A wrapper step asserts `npm test` reported a non-zero count, so a suite that matched no files fails rather than passing silently. Test-only pull requests carry `no-release`.

## Suggested sequencing

Phases **1, 8 and 9** are one small PR each and each fixes something red on `main` today — land those first. Phase **3** (the export refactor) is a prerequisite for 4–7 and should be its own no-behavior-change PR. Phases **10–12** are the largest and can follow independently.

Phases **13–15** come after 1, 4, 7 and 8 — documentation written before those contracts are pinned would just be a fourth copy of prose that is already wrong in three places. Documentation-only pull requests carry `no-release`.

## How we will know it actually works

| Claim | Evidence |
|---|---|
| The kit's paths are coherent | Phase 1 spec, listing the files it scanned |
| A fresh install produces the right tree | Phase 2 golden-tree diff |
| A board slice lands on disk correctly | Phase 4 against the hostile fixture |
| A status change triggers the right prompt | Phase 5 trigger table |
| Auth failures behave | Phase 6 fake-server request log |
| Slice type is decided one way | Phase 7 table + prose-drift spec |
| The corpus gate can fail | Phase 8 `--self-test` planted-drift count |
| The commands the prompts issue actually run | Phase 10 `dotnet build` / `dotnet test` with a non-zero test count |
| Generated code is idiomatic Cratis | Phase 11 grader, proven non-vacuous on a hostile fixture |
| The whole chain works end to end | Phase 12, graded, non-blocking |
| Each contract is written down once | Phase 13 — duplicates deleted as pages land, prose shrinks |
| The documentation is navigable and unbroken | Phase 13 `verify-markdown.sh`, exit 0 |
| The documented commands actually run | Phase 15 command spec, with a printed non-zero count |
| The README's install path is real | Phase 14, the documented `npx` command run verbatim |
