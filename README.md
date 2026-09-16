# Eventmodelers Build Kit - CSharp

[![Release](https://img.shields.io/github/v/release/Cratis/Eventmodelers-Build-Kit-CSharp)](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/1234567890123456789?label=Discord)](https://discord.gg/kt4AMpV8WV)
[![CI](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/actions/workflows/pull-requests.yml/badge.svg)](https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp/actions/workflows/pull-requests.yml)

Real-time Claude agent that connects to the Eventmodelers Platform and implements board slices as Cratis (Arc + Chronicle) vertical slices in a .NET / C# project.

## Start Here

- **[Install the Kit](Documentation/getting-started/install.md)** — Get started in 5 minutes
- **[Run Your First Slice](Documentation/getting-started/first-slice.md)** — See a slice go from Planned to Done
- **[Connect a Board](Documentation/guides/connect-a-board.md)** — Set up your Eventmodelers board credentials
- **[Documentation](Documentation/)** — Full documentation and guides

## Place in the Cratis Ecosystem

This kit bridges the gap between the [Eventmodelers Platform](https://app.eventmodelers.ai) and [Cratis](https://cratis.dev):

| Component | What It Does |
|---|---|
| **Eventmodelers Platform** | Manages board slices with statuses like `Planned`, `InProgress`, `Done` |
| **This Kit** | Automatically implements slices as Cratis vertical slices when marked `Planned` |
| **Cratis Chronicle** | Event sourcing engine that powers the generated slices |
| **Cratis Arc** | CQRS framework that provides commands, queries, and projections |

The kit follows the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits) and generates slices that follow [Cratis best practices](Documentation/reference/cratis-conventions.md).

## Problem It Solves

When you design a slice on the Eventmodelers board, you're creating a **model** — a specification of what should happen. But that model doesn't exist anywhere executable. Someone (or something) needs to:

1. Read the slice definition from the board
2. Generate the actual C# code (commands, events, projections, read models, React components)
3. Build and test the code
4. Update the board status when complete

This kit automates that entire process. When you mark a slice as `Planned` on your board, the kit:

- **Fetches** the slice definition in real-time
- **Generates** a complete Cratis vertical slice
- **Builds** it with `dotnet build`
- **Tests** it with `dotnet test`
- **Updates** the board to `Done`

All without manual intervention.

## How It Works

The kit implements the [Eventmodelers Build Kits platform contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits/tree/main/eventmodelers-cli/shared/build-kit). Here's what happens:

### Two Independent Triggers

The kit runs two separate loops that can fire independently:

1. **`tasks.json` non-empty** → Run `prompt.md` (reacts to status changes)
   - When a slice status changes to `Planned`, the kit picks it up
   - When a slice is marked `Done` or `Blocked`, the kit logs the result
   
2. **Slice is `Planned` in `.slices/*/index.json`** → Run `backend-prompt.md` (builds one slice)
   - When a slice is `Planned`, the kit builds exactly one slice
   - Then stops so the loop can re-enter and check for more work

### Slice-Type Routing

The kit automatically routes to the correct build skill based on the slice definition:

| Condition | Skill |
|---|---|
| `sliceType === "TRANSLATION"` | `build-automation` (reactors / automation) |
| `processors[]` non-empty | `build-automation` |
| `projections` / `queries` / `readModel` present | `build-state-view` |
| otherwise (`commands` / `events`) | `build-state-change` |

### Generated Code Follows Cratis Best Practices

Every generated slice follows these rules:

- **One `.cs` per slice** — All backend artifacts in a single file
- **`[Command]` with `Handle()` on the record** — No separate handler class
- **`[EventType]` with no attribute arguments** — Past-tense, self-describing names
- **No nullable event properties** — Model optional facts as separate events
- **`ConceptAs<T>`/`EventSourceId<T>` instead of raw primitives** — Type-safe domain values
- **Namespace mirrors folder structure** — Clear navigation by feature
- **No `IEventLog` injection** — Express appends through return types

See [Cratis Conventions](Documentation/reference/cratis-conventions.md) for the full list.

## Installation

Install from git (this package is private, so use the git install path):

```bash
npx github:Cratis/Eventmodelers-Build-Kit-CSharp install
```

Or use the upstream CLI with this repository as a git stack:

```bash
npx @eventmodelers/cli init --stack cratis-csharp --git https://github.com/Cratis/Eventmodelers-Build-Kit-CSharp
```

After installation, run:

```bash
node .build-kit/ralph-claude.js
```

## Example: A Slice Goes from Planned to Done

Here's what happens when you mark a slice as `Planned` on your Eventmodelers board:

### 1. Board Status Changes to `Planned`

```json
{
  "id": "slice-123",
  "title": "Register Author",
  "status": "Planned",
  "contextName": "Authors",
  "sliceType": "StateChange",
  "commands": ["RegisterAuthor"],
  "events": ["AuthorRegistered"],
  "description": "Register a new author with name and email"
}
```

### 2. Kit Fetches and Persists the Slice

The kit saves the slice to `.build-kit/.slices/Authors/register-author/slice.json`:

```json
{
  "id": "slice-123",
  "title": "Register Author",
  "status": "Planned",
  "contextName": "Authors",
  "sliceType": "StateChange",
  "commands": ["RegisterAuthor"],
  "events": ["AuthorRegistered"],
  "description": "Register a new author with name and email"
}
```

### 3. Kit Generates the Vertical Slice

The kit generates a complete Cratis vertical slice in `Authors/Registration/RegisterAuthor.cs`:

```csharp
using Cratis.Chronicle.Concepts;
using Cratis.Fundamentals;

namespace Authors.Registration;

/// <summary>
/// Represents the unique identifier of an author.
/// </summary>
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly AuthorId NotSet = new(Guid.Empty);
    public static AuthorId New() => new(Guid.NewGuid());
    public static implicit operator AuthorId(Guid value) => new(value);
}

/// <summary>
/// Represents the name of an author.
/// </summary>
public record AuthorName(string Value) : ConceptAs<string>(Value)
{
    public static implicit operator AuthorName(string value) => new(value);
}

/// <summary>
/// Command to register a new author.
/// </summary>
/// <param name="Id">The author's unique identifier.</param>
/// <param name="Name">The author's display name.</param>
[Command]
public record RegisterAuthor(AuthorId Id, AuthorName Name) : ICanProvideEventSourceId
{
    public EventSourceId GetEventSourceId() => Id;

    public AuthorRegistered Handle() => new(Id, Name);
}

/// <summary>
/// Emitted when an author is registered.
/// </summary>
/// <param name="Id">The author's unique identifier.</param>
/// <param name="Name">The author's display name.</param>
[EventType]
public record AuthorRegistered(AuthorId Id, AuthorName Name);
```

### 4. Kit Builds and Tests the Slice

```bash
dotnet build Authors.Registration
dotnet test Authors.Registration.Specs
```

### 5. Kit Updates Board to `Done`

The kit updates the slice status to `Done` on the Eventmodelers board, completing the loop.

## Skills

The kit provides these Claude skills:

| Skill | Purpose |
|---|---|
| **`build-state-change`** | Generate commands and events for State Change slices |
| **`build-state-view`** | Generate projections and read models for State View slices |
| **`build-automation`** | Generate reactors and automations for Automation slices |
| **`connect`** | Connect to the Eventmodelers Platform |
| **`load-slice`** | Load a slice from the board |
| **`update-slice-status`** | Update a slice's status on the board |

See [Skills](Documentation/reference/skills.md) for the full documentation.

## Testing

The kit includes a test project that mirrors your slice structure:

```
Tests/
└── SomeModule/
    └── SomeFeature/
        └── RegistrationTests.cs  ← tests for Registration slice
```

```bash
dotnet test                   # run all tests
dotnet test --filter "FullyQualifiedName~Registration"  # run specific slice tests
```

**Test conventions:**
- Tests live in `Tests/<Module>/<Feature>/<SliceName>Tests.cs`
- Use `SpecificationFor<T>` base class from `Cratis.Testing`
- Tests are marked with `[Fact]` attribute (xUnit)
- Follow the Arrange-Act-Assert pattern
- Use `Cratis.Chronicle.Testing` for event sourcing tests
- Maintain the same structure as your implementation slices

See [CLAUDE.md](templates/root/CLAUDE.md#testing) for the full testing documentation.

## Troubleshooting

### Kit Can't Find Config

If the kit can't find your credentials:

1. Check `.eventmodelers/config.json` exists in your project root
2. Verify the JSON is valid: `cat .eventmodelers/config.json | jq .`
3. Ensure your credentials are correct: [app.eventmodelers.ai/account](https://app.eventmodelers.ai/account)

### Slice Stuck in `InProgress`

If a slice is stuck in `InProgress`:

1. Check the kit logs for errors
2. Verify the generated code builds: `dotnet build`
3. Run tests: `dotnet test`
4. Update the slice status manually: [app.eventmodelers.ai](https://app.eventmodelers.ai)

See [Recover a Stuck Slice](Documentation/guides/recover-stuck-slice.md) for the full process.

## See Also

- **[Documentation](Documentation/)** — Full documentation and guides
- **[Platform Contract](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits)** — The Eventmodelers platform specification
- **[Cratis Documentation](https://cratis.dev)** — Cratis framework documentation
- **[Kotlin/Java Kits](https://github.com/Nebulit-GmbH/Eventmodelers-Build-Kits)** — Other language implementations

## License

MIT License — see [LICENSE](LICENSE) for details.
