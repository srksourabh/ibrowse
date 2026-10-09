# Phase 5 — Onboarding, settings, voices and AI

Goal: a blind person can install iBrowse, learn it by ear, change every setting without sight, use it beside a screen reader, and optionally turn on better voices and AI descriptions.

Source: PRD §5.2 (FR-2.7), §5.9, §5.10, §6, §8. Decisions: ADR-0004, ADR-0007, ADR-0008 (still holds: no voice input), ADR-0014.

**Provider: Gemini, for voice output and for AI descriptions and summaries, with one key.** (Your decision. OpenAI was chosen first and then replaced.) The provider sits behind an interface, so another can be added later.

## Gemini facts used (checked against the current API reference, October 2026)
- Voice: `POST https://generativelanguage.googleapis.com/v1beta/interactions`, header `x-goog-api-key`. Text to speech is generally available as `gemini-3.8-flash-lite-tts` (fast and cheap, the default, suited to read-aloud) and `gemini-3.8-flash-tts` (richer). A voice is named in `generation_config.speech_config` (for example `Kore`). The response carries base64 audio.
- AI: the same endpoint, with `input` items of type `text` and `image` (inline base64), and `generation_config.max_output_tokens`. The default model is `gemini-3.8-flash`, and it is a setting.
- Checking a key: `GET /v1beta/models`, which costs nothing.
- Errors arrive as `{"error": {"code", "message"}}` with HTTP 400, 401, 403 or 429.
- **Risk:** this API has had breaking changes (May 2026, and new voice endpoints in September). It is isolated in one adapter with defensive parsing. It cannot be tested against the real service without a key, so that is on the manual checklist.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 5.1 | **Richer utterances** — pitch, volume, voice, pan, "reading" kind, and a start callback | Local provider forwards them; tests |
| 5.2 | **Settings and their description** — new settings, and one table that drives the options page, the spoken confirmations and the tests | Tests |
| 5.3 | **Companion mode** — speech through a hidden live region for a screen reader; routing between voices | Tests; the announcer must not hear its own region |
| 5.4 | **Gemini client** — voice, key check, generate; errors turned into spoken sentences | Tests with a fake `fetch` |
| 5.5 | **Cloud voice** — audio requested by the worker, played and panned in the page, falling back to the local voice | Tests |
| 5.6 | **AI assistant** — page purpose, page summary, image description, with untrusted-text handling | Tests |
| 5.7 | **Latency readout** — real speech-start timing, and a spoken report | Tests |
| 5.8 | **Onboarding tour** — a first-run spoken tutorial, replayable | Tests, then end-to-end |
| 5.9 | **Options page** — every setting by keyboard, every change spoken | End-to-end |
| 5.10 | **Wiring and permissions** — hotkey Alt+Shift+S, optional Gemini host permission, install hook | End-to-end |

## Privacy rules for this phase
- Nothing leaves the device unless the user turned a cloud feature on, gave a key, and granted the browser permission for `generativelanguage.googleapis.com`.
- Turning one on speaks what will be sent, and the browser then asks for permission.
- The key is kept in extension storage, used only by the background worker, never imported by code that runs in web pages (a test enforces this), and never logged.
- Page text is untrusted. It is sent only inside delimiters, with instructions to treat it as data; the answer is spoken, never run.
- Only text from readable blocks is sent: never form values, never passwords.
- Images are fetched by the worker and sent as data, so no image address is shared beyond the page itself.

## Out of scope
Voice input and speech recognition (ADR-0008 stands; Gemini's transcription model is not used), other providers, per-site settings, syncing settings between devices.

## Exit checklist
- [x] Typecheck and build green; 770 unit tests pass
- [x] End-to-end (68 tests): the first-run tour by keyboard, every setting changed by keyboard and spoken, a bad value refused, the consent flow cancelled (never granted), a key saved and never spoken, Companion mode writing to a live region with no spoken duplicate, AI refusing without a key, cloud voice falling back to the local voice, and the delay readout including real speech-start timing
- [x] Docs updated (ADR-0014, PRD §5.10, §6, §8)
- [ ] Coverage figure for this phase not yet re-measured
- [ ] **Manual:** with a real Gemini key: cloud voice, image description, summary (never run against the real service)
- [ ] **Manual:** the browser's own permission prompt when Allow is pressed (it cannot be driven headless)
- [ ] **Manual:** with NVDA or VoiceOver: Companion mode is spoken once, by the screen reader

## Findings
- **Gemini replaced OpenAI** mid-phase, at the user's request. The provider interface made that cheap.
- **A real gap found by the end-to-end tests:** reading aloud was never marked as "reading", so the cloud voice would never have been used. Fixed test-first.
- **A real weakness found the same way:** the cloud voice gave up at once if audio was still waking after the first key press, so the first reading never used it. It now waits briefly (800 ms; 300 ms lost the race on a slow machine).
- **A mistake in my own tests:** saving one setting stores the whole merged object, so "not saved" must be tested as "not turned on", not "absent".
- **Loading the extension is a fresh install**, so every end-to-end launch opens the tour. The harness now waits for it, clears it, and keeps it for the one test that uses it.
- Not built: voice input (ADR-0008), other providers, per-site settings.
