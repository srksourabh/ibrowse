# Phase 5b — Conversation

Goal: opening a page, the user hears what is in the header, the left panel, the main content and the right panel. Resting on something, they hear what it is and are asked what to do, and can answer by voice: press it, read it, scroll, go back, or ask a question about the page.

Source: PRD §5.11. Decisions: ADR-0017 (supersedes ADR-0008), ADR-0014 (AI consent), ADR-0003.

## Decisions taken while planning (can be revisited)
- Voice input is **off by default**. The setup flow and the settings page turn it on, grant the microphone once, and say which recogniser is in use.
- "What would you like to do?" is asked only when the pointer **rests a further 1 second** after the description, and only while voice is on. Sweeping across a page stays quick.
- Push to talk: **hold Alt+Shift+V** (V for voice). Alt+Space is taken by Windows' window menu. To be confirmed in slice 5b.10 with a real keyboard and NVDA.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 5b.1 | **Panel model**: assign the page's landmarks and regions to header, left panel, main, right panel and footer, by role and by geometry; count what each holds | Tests with fake geometry: landmark pages, div-only pages, one-column pages |
| 5b.2 | **Panel briefing**: the opening briefing walks the panels in order; detailed form on request | Tests pin the wording; the old briefing tests updated |
| 5b.3 | **Command grammar**: a transcript becomes a `VoiceCommand` or a question ("click", "press it", "scroll up", "go back", "read the page", "what's on the left", "find search") | Tests: many phrasings per command, filler words, unknown input is a question |
| 5b.4 | **Command runner**: carries out a command on the element under the pointer or the navigation cursor, and says what happened | Tests with fakes |
| 5b.5 | **Ask after rest**: the follow-up question, the listening window after it ends, cancelled by moving | Tests with fake timers |
| 5b.6 | **`SpeechRecognizer` and the listening controller**: never listens while speaking; earcons at start and end; 5 s window; one request at a time | Tests with a fake recogniser |
| 5b.7 | **Chrome recogniser in an offscreen document**: on-device when available, otherwise Google's service; created only while Explore Mode and voice are on | Unit tests for the choice; end-to-end with transcripts fed in |
| 5b.8 | **Voice setup**: setting `voiceInput` (off, chrome, gemini); microphone granted on a visible page; spoken consent | End-to-end, keyboard only |
| 5b.9 | **Questions to AI**: page text as untrusted data, answer spoken; refusal without AI | Tests with a fake client |
| 5b.10 | **Push to talk**: hold Alt+Shift+V | Tests, then end-to-end |
| 5b.11 | **Gemini recogniser**: record one request, transcribe through the worker | Tests with a fake `fetch` |
| 5b.12 | **End-to-end**: panel briefing, ask after rest, "click" presses, "scroll down" scrolls, a question with and without AI | Five runs in a row |

## Findings
- The whole listening route was checked in Playwright's Chromium: page, then worker, then the offscreen document, then `webkitSpeechRecognition`. It answered "silence" when its window ran out. Real speech cannot be fed in headless; the end-to-end tests deliver transcripts as the recogniser does.
- Push to talk works in the top frame only. Pressed while focus is inside an iframe, the key is swallowed and nothing listens. To be revisited if testers hit it.

## Out of scope
Continuous listening and a wake word (ADR-0017 #3), dictating into form fields, languages other than the browser's own.

## Exit checklist
- [ ] Typecheck, tests, build green; coverage ≥ 80%
- [ ] End-to-end suite five runs in a row
- [ ] Docs updated (PRD §5.11, `CONTEXT.md` terms, README keys)
- [ ] **Manual:** a real microphone with Chrome's recogniser, on-device and online; accents; a noisy room
- [ ] **Manual:** NVDA running: iBrowse does not hear NVDA, and push to talk does not clash with NVDA keys
- [ ] **Manual:** Gemini recogniser with a real key
