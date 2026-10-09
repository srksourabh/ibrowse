# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Windows desktop explorer (early preview).** .NET core library (spoken grammar, placement, dwell) with 38 tests, plus a UI Automation app with a Win+Alt+E hotkey and tray icon. Not yet tested with screen readers.
- Repository documents, issue forms, CI with end-to-end tests, and a contributor skill.
- **Phase 5, onboarding, settings, voices and AI.** A ten-step spoken first-run tour; a keyboard-only settings page with spoken changes; Companion mode for screen readers; optional Google Gemini cloud voice and AI (image description Alt+Shift+D, page summary Alt+Shift+M) behind two-step consent and an optional host permission; real speech-start latency readout.
- **Phase 4, hardware.** Haptic manager, simulator, Gamepad and WebHID drivers, JSON device profiles, pairing flow (Alt+Shift+P), conformance suite, and a public SDK (`sdk/`).
- **Phase 3, operation.** Heading and landmark jumping, form feedback with typing echo (passwords never spoken), live-region announcements, dialogs, iframes, touch with lift-to-activate.
- **Phase 2, intelligence.** Click-to-read, word scrubbing with the wheel, smart next/previous page, side mouse buttons and right-click menu.
- **Phase 1, core exploration.** Explore Mode (Alt+Shift+E), page briefing with "Want me to read it?", hover descriptions, earcons.
- **Phase 0, foundations.** PRD, vocabulary, ADRs, project rules, tooling.

### Known issues
- Not yet verified on real hardware, with a real Gemini key, or with NVDA/VoiceOver.
- No release has been published to the Chrome Web Store.

[Unreleased]: ../../compare/HEAD
