---
title: Kit Directory Name
description: Decision to use .build-kit as the kit directory name
status: Accepted
date: 2025-01-15
deciders: Cratis Team
approved: 2025-01-15
---

# Kit Directory Name

## Context and Problem Statement

The kit needed a directory name for storing runtime files, prompts, and skills. Multiple names were being used inconsistently:

- `.cratis-build-kit/` — Used by the original installer
- `.build-kit-cratis-csharp/` — Used by prompts and skills
- `.build-kit/` — Used by some documentation

This inconsistency caused **13 defects** (see Issue #9 D1, D2, D10) where the installer wrote to one directory but prompts read from another.

## Decision Outcome

**The kit directory must be `.build-kit`** (not `.cratis-build-kit` or `.build-kit-cratis-csharp`).

### Rationale

1. **Platform Contract** — The official Eventmodelers platform ([Nebulit-GmbH/Eventmodelers-Build-Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits)) uses `.build-kit` as the **only** valid kit directory name. This is hardcoded in `cli.js` at line 44: `kitDirName: '.build-kit'`.

2. **CLI Recognition** — The upstream CLI's `run`, `status`, and `uninstall` commands look for `.build-kit` specifically. Using any other name makes the installation invisible to the platform CLI.

3. **Simplicity** — `.build-kit` is shorter, clearer, and follows the platform's convention without unnecessary prefixes.

4. **Consistency** — All build kits (Node, Supabase, Cratis C#, etc.) use the same directory name, making the platform predictable.

## Consequences

### Positive

- ✅ Installation is recognized by `npx @eventmodelers/cli status`
- ✅ All prompts and skills use the same directory name
- ✅ Platform CLI commands work correctly
- ✅ Documentation and code are consistent

### Negative

- ⚠️ Requires updating all references from `.cratis-build-kit` to `.build-kit`
- ⚠️ Requires updating all prompts and skills that reference the kit directory
- ⚠️ Existing installations need to be migrated (manual process)

## Status

**Accepted** — The installer has been updated to use `.build-kit`, and all prompts and skills now reference this directory name.

## References

- [Issue #9](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/issues/9) — Automated tests and defect fixes
- [Issue #10](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/issues/10) — Platform alignment
- [Platform CLI Source](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/blob/main/eventmodelers-cli/cli.js#L44) — Hardcoded `kitDirName: '.build-kit'`
