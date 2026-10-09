# iBrowse for Windows

> **Status: early preview.** The core library is built and tested (38 unit tests). The Windows app builds, starts and registers its hotkey, but has **not been tested with a real screen reader, a real blind user, or across many applications**. See [ADR-0015](../../docs/adr/0015-windows-and-ios-as-separate-products.md).

A native desktop explorer that brings iBrowse's hover exploration to **every Windows application**, not only websites. Move the mouse over any window and hear what is under it.

## What works today

| Capability | State |
|---|---|
| Describe the element under the pointer through Microsoft UI Automation | Built. Same grammar as the extension: `Save — Button, Clickable`, `Text only`, `Paragraph: first five words. Click to read.` |
| Rest-then-speak (150 ms dwell, 5 px jitter tolerance) | Built, unit-tested |
| Checkbox, edit-field and password states (passwords never spoken) | Built, unit-tested |
| Speak with the voices installed in Windows | Built |
| Global hotkey **Win+Alt+E**, tray icon with a menu | Built |
| Stay quiet when NVDA, JAWS, Narrator, ZoomText or Supernova is running (Companion) | Built, not tested against them |

## Not built yet

Stereo earcons, word scrubbing with the wheel through the UIA Text pattern, touch, "May be clickable" guesses, haptic drivers, a settings window, and an installer. These follow the extension's behaviour and are listed in the roadmap.

## Structure

```
apps/windows/
  IBrowse.Core/      grammar, placement, dwell and hysteresis. No Windows APIs. Unit-tested.
  IBrowse.Windows/   UI Automation adapter, global hotkey, tray icon, speech
  IBrowse.Tests/     xUnit tests for the core
```

## Build and run

Requires the .NET 10 SDK and Windows 10 or later.

```
cd apps/windows
dotnet test IBrowse.sln
dotnet run --project IBrowse.Windows
```

Press **Win+Alt+E** to turn Explore Mode on or off, then move the mouse. Quit from the tray icon.

## Risks

- Hooking the pointer can conflict with a screen reader's own mouse tracking.
- Many apps expose poor UI Automation trees (games, custom-drawn UIs). iBrowse says "Text only" or "Unlabeled" rather than guessing.
- Code signing and SmartScreen reputation affect distribution.
