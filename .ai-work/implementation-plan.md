# Implementation Plan: Issues #9 and #10

## Overview
This plan addresses both issues simultaneously by implementing automated tests (#9) while aligning with the official Eventmodelers platform guidance (#10).

## Key Findings from Issue #10

### Critical Fixes Required (P1-P10)

1. **P1 - Kit Directory Name**: Must be `.build-kit` (not `.cratis-build-kit` or `.build-kit-cratis-csharp`)
2. **P2 - Config Location**: Write to project root's `.eventmodelers/config.json` (not just kit directory)
3. **P3 - Stop forking shared runtime**: Use upstream's `shared/` runtime
4. **P4 - Stop forking platform skills**: Use upstream's `shared/skills/`
5. **P5 - Add `request-feedback` skill**
6. **P6 - Abstract realtime transport** (Supabase + PocketBase)
7. **P7 - Implement check plugin contract**
8. **P8 - Rebase prompts onto upstream**
9. **P9 - Support multiple agent surfaces**
10. **P10 - Package identity alignment**

### Decision: Option B - External Git Stack (Recommended)

We should:
- Keep this repository
- Keep release control
- Keep Cratis corpus integration
- Use upstream's `init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp`
- Layer in `shared/` automatically

## Implementation Phases

### Phase 1: Foundation Fixes (Critical Path)

1. **Fix kit directory name** (P1)
   - Change all references from `.cratis-build-kit` to `.build-kit`
   - Update CLI installer
   - Update all prompts and skills

2. **Fix config location** (P2)
   - Write config to project root `.eventmodelers/config.json`
   - Keep kit-dir as optional override

3. **Add automated test suite** (#9 R1)
   - Use Node's built-in `node:test`
   - No new dependencies
   - Test seams A-G deterministically

### Phase 2: Platform Alignment

4. **Fetch and integrate upstream shared/** 
   - Clone upstream repository
   - Copy `shared/build-kit/` to `templates/build-kit/`
   - Copy `shared/skills/` to `templates/.claude/skills/`
   - Remove our forked versions

5. **Add `request-feedback` skill** (P5)
   - Copy from upstream
   - Integrate into prompt flow

6. **Abstract realtime transport** (P6)
   - Use upstream's `lib/adapters/realtime-adapter.js`
   - Support both Supabase and PocketBase

### Phase 3: Testing Infrastructure

7. **Create test suite** (#9)
   - Test installer layout (R2)
   - Test slice persistence contract (R4)
   - Test task queue contract (R5)
   - Test loop trigger logic (R6)
   - Test auth/transport behavior (R7)
   - Test slice-type routing (R8)

8. **Create Documentation/** folder (R14)
   - Follow Diátaxis framework
   - Index, getting-started, guides, understand, reference, decisions

9. **Rewrite README.md** (R15)
   - Follow Cratis house style
   - Link to Documentation/
   - Remove duplicated content

### Phase 4: Quality Gates

10. **Add CI/CD** (#9 R13)
    - Run test suite
    - Run `--check` with real validation
    - Timeout and no-release intent

11. **Add check plugin contract** (P7, #9 R12)
    - Implement check interface
    - Numbered checks in `lib/checks/`

## Testing Strategy

### Deterministic Tests (No Network, No LLM)

1. **Installer tests**
   - Verify exact installed tree
   - Verify `.gitignore` updates
   - Verify `.claude/settings.json` updates
   - Test uninstall removes exactly what install created

2. **Slice persistence tests**
   - Context folder derivation (casing)
   - Slice folder derivation (`"slice:"` stripping)
   - `current_context.json` selection (zero/one/many contexts)
   - `context.json` handling
   - `index.json` entry shape
   - Merge-on-re-fetch preserving `assigned`

3. **Task queue tests**
   - Task shape (`id`, `createdAt`, `payload`)
   - Dedupe by `sliceId`
   - `Planned` never enqueuing
   - `hasPendingTasks` for missing/empty/malformed
   - `getFirstPlannedSliceTitle` case-insensitive

4. **Loop trigger tests**
   - Tasks-only fires `prompt.md`
   - Planned-only fires `backend-prompt.md`
   - Both fires both
   - Neither fires nothing and idles

5. **Auth/transport tests**
   - Config merge precedence
   - `retryOn401` retrying exactly 3 times
   - Non-401 errors propagating
   - `agent-alive` ping payload

6. **Slice-type routing tests**
   - `TRANSLATION` → automation
   - Non-empty `processors` → automation
   - `projections`/`queries`/`readModel` → state-view
   - Otherwise state-change
   - Precedence conflicts

### C# Starter App Tests

7. **Starter app is buildable and testable** (#9 R11)
   - Add spec project to templates/root
   - Reference spec for example slice
   - Run `dotnet build` and `dotnet test`

8. **Cratis conformance grading** (#9 R12)
   - One `.cs` per slice
   - `[Command]` with `Handle()` on record
   - `[EventType]` with no attribute arguments
   - No nullable event properties
   - `ConceptAs<T>`/`EventSourceId<T>` instead of raw primitives
   - Namespace mirroring folders
   - No `IEventLog` injection

## Files to Create/Modify

### New Files
- `tests/` - Test suite directory
  - `installer.test.js` - Installer layout tests
  - `slice-persistence.test.js` - Slice persistence tests
  - `task-queue.test.js` - Task queue tests
  - `loop-trigger.test.js` - Loop trigger tests
  - `auth-transport.test.js` - Auth/transport tests
  - `slice-routing.test.js` - Slice-type routing tests
  - `conformance.test.js` - Cratis conformance tests
- `Documentation/` - Documentation folder
  - `index.md`
  - `getting-started/`
  - `guides/`
  - `understand/`
  - `reference/`
  - `decisions/`
  - `verify-markdown.sh`
- `scripts/verify-markdown.sh` - Markdown verification script
- `tests/csharp-starter/` - C# starter app with specs

### Modified Files
- `src/cli.js` - Fix kit directory name and config location
- `templates/build-kit/` - Replace with upstream shared/
- `templates/.claude/skills/` - Replace with upstream shared/skills/
- `README.md` - Rewrite following Cratis house style
- `package.json` - Add test script
- `.github/workflows/pull-requests.yml` - Add CI tests

## Verification Checklist

- [ ] `npm test` runs green locally and in CI
- [ ] Non-zero spec count reported
- [ ] Every defect D1-D13 has a spec that failed before fix
- [ ] `--check` detects planted drift via `--self-test`
- [ ] `dotnet build` + `dotnet test` on templates/root pass
- [ ] `Documentation/verify-markdown.sh` passes
- [ ] Every contract written down exactly once
- [ ] `npx @eventmodelers/cli status` recognizes installation
- [ ] Slice moves Planned → InProgress → Done on real board

## Timeline

**Week 1**: Foundation fixes (P1-P2, Phase 1)
- Fix kit directory name
- Fix config location
- Create basic test structure

**Week 2**: Platform alignment (P3-P6, Phase 2)
- Fetch upstream shared/
- Remove forked versions
- Add request-feedback skill
- Abstract realtime transport

**Week 3**: Testing infrastructure (Phase 3)
- Create full test suite
- Create Documentation/ folder
- Rewrite README.md

**Week 4**: Quality gates (Phase 4)
- Add CI/CD
- Add check plugin contract
- Final verification and documentation

## Next Steps

1. Create implementation plan file (this document)
2. Begin Phase 1: Foundation fixes
3. Implement test suite structure
4. Update CLI installer
5. Fetch and integrate upstream shared/
