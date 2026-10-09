# iBrowse for Windows (planned)

> **Status: design only. Not built.** This machine has the .NET runtimes but no .NET SDK, so nothing here has been compiled or run. See [ADR-0015](../../docs/adr/0015-windows-and-ios-as-separate-products.md).

A native desktop explorer that brings iBrowse's hover, wheel and touch exploration to **every Windows application**, not only websites. A blind person moves the mouse or a finger across any window and hears what is under it.

## What it will do

| Capability | How |
|---|---|
| Describe the element under the pointer | Microsoft UI Automation (`ElementFromPoint`), in the same grammar as the extension: `Save, button, Clickable` / `Text only` |
| Stereo placement | Earcons panned by the pointer's position on screen |
| Read and scrub text | UIA Text pattern: word, line and paragraph ranges, stepped with the wheel |
| Turn on and off | A global hotkey (proposed Win+Alt+E), inert when off |
| Haptics | The same eight events and device profiles as the extension |
| Coexist with a screen reader | Companion mode: detect NVDA, JAWS or Narrator and defer speech |

## Planned structure

```
apps/windows/
  IBrowse.Core/        grammar, placement, dwell, hysteresis, event routing (no Windows APIs; unit-tested)
  IBrowse.Windows/     UI Automation adapter, global hooks, speech, tray icon
  IBrowse.Tests/       core unit tests, adapter integration tests against a fixture app
```

## Build order

1. `IBrowse.Core`: port the speech grammar and dwell/hysteresis rules, driven by shared conformance vectors.
2. UI Automation adapter: describe the element under a point; log what would be spoken.
3. Speech and earcons, with panning.
4. Global hotkey, tray icon, settings.
5. Text scrubbing through the Text pattern.
6. Haptic drivers (HID).
7. Real testing with NVDA, JAWS and Narrator. **This step decides whether it ships.**

## To start building

Install a .NET SDK (for example `winget install Microsoft.DotNet.SDK.10`), then `dotnet new sln` in this folder. Nothing is installed on your behalf.

## Risks

- Hooking the mouse globally can conflict with screen readers' own mouse tracking.
- Many apps expose poor UI Automation trees (games, custom-drawn UIs). The app must say "unknown element" honestly, never guess.
- Code signing and SmartScreen reputation affect distribution.
