# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-29

### Changed
- **Shortcuts moved from `Alt+Shift` to `Ctrl+Alt` + `Alt+I` / `Alt+O` (ADR-0018).** `Alt+I` toggles Explore Mode, `Alt+O` opens Settings, and in-page shortcuts default to `Ctrl+Alt` (with an option to keep `Alt+Shift` and full remapping at `chrome://extensions/shortcuts`).
- **First-run screen reader question (ADR-0019).** Before the tour starts, iBrowse asks *"Do you use a screen reader?"* (Y for Companion mode, N for Standalone) so screen reader users never hear two voices on install.

### Added
- **Gemini Live API (WebSocket) streaming voice.** Persistent `BidiGenerateContent` WebSocket (`models/gemini-3.8-live`, 24 kHz PCM) with 140-character first-sentence fast-start, 100-phrase LRU cache, and automatic fallback (`Gemini Live WS → Gemini REST TTS → local en-IN OS voice`).
- **Anthropic Claude AI fallback.** Automatic fallback to `claude-haiku-4-5-20251001` for page purpose, summaries, image descriptions, and spoken questions whenever Gemini is unavailable.
- **Indian English (`en-IN`) across all voices & recognition.** Enforced across `chrome.tts`, Gemini TTS/Live, Chrome speech recognition, mobile PWA, and the Windows preview, with faster silence auto-stop (700 ms VAD) and expanded natural command synonyms.
- **Mobile PWA, multi-platform user guide, & server deployment.** Touch + voice PWA published on GitHub Pages (`docs/demo/`), `Dockerfile` + `scripts/serve.mjs` server portal, and `docs/USER_GUIDE.md`.
- **Phase 5b, conversation (ADR-0017).** Panel-by-panel page briefing (header, left panel, main content, right panel, footer), Ask After Rest (*"What would you like to do?"*), push-to-talk (`Ctrl+Alt+V`), on-device voice commands with spoken confirmation for risky actions, AI page questions, and Chrome + Gemini speech recognisers.
- **Presentation, demo video, and Chrome Web Store assets.** Complete listing copy, screenshots, promo tile, 13-slide deck, and recorded demo (`docs/media/`).
- **Windows desktop explorer (early preview).** .NET core library (spoken grammar, placement, dwell) with 38 tests, plus a UI Automation app with a Win+Alt+E hotkey and tray icon. Not yet tested with screen readers.
- Repository documents, issue forms, CI with end-to-end tests, and a contributor skill.
- **Phase 5, onboarding, settings, voices and AI.** A spoken first-run tour; a keyboard-only settings page with spoken changes; Companion mode for screen readers; optional Google Gemini cloud voice and AI (image description `Ctrl+Alt+D`, page summary `Ctrl+Alt+M`) behind two-step consent and an optional host permission; real speech-start latency readout.
- **Phase 4, hardware.** Haptic manager, simulator, Gamepad and WebHID drivers, JSON device profiles, pairing flow (`Ctrl+Alt+P`), conformance suite, and a public SDK (`sdk/`).
- **Phase 3, operation.** Heading and landmark jumping, form feedback with typing echo (passwords never spoken), live-region announcements, dialogs, iframes, touch with lift-to-activate.
- **Phase 2, intelligence.** Click-to-read, word scrubbing with the wheel, smart next/previous page, side mouse buttons and right-click menu.
- **Phase 1, core exploration.** Explore Mode, page briefing with "Want me to read it?", hover descriptions, earcons.
- **Phase 0, foundations.** PRD, vocabulary, ADRs, project rules, tooling.

### Known issues
- Not yet verified on real haptic hardware, VoiceOver, real touchscreens, or with blind beta testers.
- Not yet published to the Chrome Web Store.

[Unreleased]: ../../compare/v0.2.0...HEAD
[0.2.0]: ../../releases/tag/v0.2.0
