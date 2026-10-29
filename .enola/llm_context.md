# Architecture Snapshot

## Repository Map

| Module | Language | Symbols | Exported |
|--------|----------|---------|----------|
| `.` | typescript | 3 | 3 |
| `.output\chrome-mv3\chunks` | typescript | 2 | 1 |
| `.wxt\types` | typescript | 2 | 0 |
| `apps/windows/IBrowse.Core` | csharp | 62 | 53 |
| `apps/windows/IBrowse.Tests` | csharp | 0 | 0 |
| `apps/windows/IBrowse.Windows` | csharp | 24 | 13 |
| `demo` | typescript | 18 | 0 |
| `docs\presentation` | typescript | 9 | 0 |
| `e2e` | typescript | 7 | 4 |
| `e2e\live` | typescript | 3 | 2 |
| `e2e\media` | typescript | 3 | 2 |
| `entrypoints` | typescript | 2 | 2 |
| `entrypoints\offscreen` | typescript | 18 | 3 |
| `entrypoints\onboarding` | typescript | 5 | 0 |
| `entrypoints\options` | typescript | 16 | 0 |
| `entrypoints\pair` | typescript | 6 | 0 |
| `sdk\examples` | typescript | 11 | 9 |
| `src` | typescript | 24 | 19 |
| `src\ai` | typescript | 60 | 29 |
| `src\audio` | typescript | 66 | 47 |
| `src\background` | typescript | 40 | 7 |
| `src\briefing` | typescript | 102 | 40 |
| `src\cloud` | typescript | 67 | 41 |
| `src\forms` | typescript | 21 | 11 |
| `src\haptics` | typescript | 135 | 93 |
| `src\hover` | typescript | 52 | 25 |
| `src\live` | typescript | 14 | 5 |
| `src\navigation` | typescript | 33 | 18 |
| `src\onboarding` | typescript | 30 | 25 |
| `src\pages` | typescript | 4 | 3 |
| `src\reading` | typescript | 32 | 26 |
| `src\session` | typescript | 57 | 21 |
| `src\settings` | typescript | 31 | 21 |
| `src\shared` | typescript | 25 | 20 |
| `src\status` | typescript | 6 | 6 |
| `src\touch` | typescript | 22 | 14 |
| `src\voice` | typescript | 110 | 59 |

## Extraction Quality

- Files parsed: **5** / 2232 seen (96 file(s) + 9 directory tree(s) skipped by ignore globs)
- Parse errors: 0
- Cross-repo analysis: not run (single-repo snapshot — append client/backend repos to enable unused-routes and coverage)

## Architecture Pattern

_No specific architecture pattern detected._

## Entry Points

- **handler**: `src\background.handleListen` (src\background\voice-host.ts)
- **handler**: `src\session.createHandlers` (src\session\handlers.ts)
- **main**: `entrypoints\onboarding.main` (entrypoints\onboarding\main.ts)
- **main**: `entrypoints\options.main` (entrypoints\options\main.ts)
- **main**: `entrypoints\pair.main` (entrypoints\pair\main.ts)

## Dependency Rules

- `.` -> `apps/windows/IBrowse.Core`
- `.` -> `apps/windows/IBrowse.Windows`

## Critical Modules

| Module | Fan-In | Fan-Out | Criticality |
|--------|--------|---------|-------------|
| `.` | 0 | 4 | low |
| `apps/windows/IBrowse.Core` | 3 | 0 | low |
| `apps/windows/IBrowse.Windows` | 1 | 0 | low |

## How to Add a Feature

General guidance:

1. Identify the appropriate module/package for the feature
2. Follow existing patterns in the codebase
3. Keep dependencies flowing in one direction
4. Add appropriate exports for cross-module usage
5. Wire the feature in the entry point

---

*Generated at 2026-10-29T07:59:17Z in 2.3761139s. 1747 facts, 29 insights.*
