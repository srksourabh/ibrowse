# ADR-0015: A Windows desktop explorer and an iOS app, as separate products

Status: accepted (design only; neither is built)

## Context
[ADR-0001](0001-chrome-extension-not-native.md) chose a Chrome extension over a native app, because the extension reaches the web with the least friction. The user has now asked for a Windows app and an iOS app as well. The original product idea (PRD v1) was a native explorer: the same hover, wheel and touch exploration across **every** Windows application, not only websites.

## Decisions

### 1. The extension stays the flagship; ADR-0001 is not reversed
The web is where most blind users' time goes and where the extension has full DOM access. The Windows and iOS apps are **additional products in the same repository**. They share the spoken grammar and the haptic event vocabulary, not code.

### 2. Windows: a native desktop explorer
It brings iBrowse's exploration to any Windows application through **Microsoft UI Automation**: the element under the pointer is described aloud in the same grammar (`[Label], [Role], Clickable` / `Text only`), with earcons and stereo placement, word scrubbing through the UIA Text pattern, a global hotkey to turn it on and off, and the same haptic events.

- **Language: C# on .NET** with the managed `UIAutomationClient` wrappers. UI Automation, Win32 hooks (low-level mouse and keyboard) and WinRT speech are first-class there, and the SDK is a single install. C++ or Rust would add build tooling and a thin wrapper layer for no benefit at this stage.
- **Speech:** Windows' own voices (`System.Speech` or WinRT `SpeechSynthesizer`), with the same Companion idea: do not double-speak when a screen reader is running.
- **It must coexist with NVDA and JAWS**, never fight them for focus or speech. This is the hardest part and needs real testing with them.
- **Tests:** a platform-independent core library (grammar, placement, dwell, hysteresis, event routing) with unit tests, and a thin UI Automation adapter checked by integration tests against a fixture app.

### 3. iOS: plan only
iOS already has VoiceOver, whose touch exploration is the model iBrowse's touch mode borrows from. A third-party iOS app cannot read other apps, so the useful scope is narrower: a **web browser view** (WKWebView) with iBrowse exploration, haptics through Core Haptics, and AVSpeech. This machine has no Mac or Xcode, so nothing can be compiled or run here; this repository records the plan and does not claim a build.

### 4. Shared contract
The grammar and the eight haptic events are the contract. Each product re-implements them and runs the same **conformance vectors** (spoken text for given elements, event timing). Vectors live in `contract/` once the Windows core needs them.

## Consequences
- The repo becomes a small monorepo: extension at the root, `apps/windows`, `apps/ios`.
- The PRD gains a "Platforms" section. Privacy rules (opt-in cloud, no key in logs) apply to every product.
- Building the Windows app needs a .NET SDK. At the time of writing this machine has only the .NET runtimes (8 and 10), so the app cannot be compiled until an SDK is installed.
- Neither product is released or tested with real users. Both are marked **planned** in the README.
