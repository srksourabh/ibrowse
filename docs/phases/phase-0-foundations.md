# Phase 0 — Foundations

Goal: a buildable, tested extension skeleton with the audio core, so every later phase has solid ground.

Source: PRD §6, §9, §11. Decisions: ADR-0002, ADR-0003, ADR-0006.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 0.1 | **Project scaffold** — WXT, strict TypeScript, Vitest, Playwright config, scripts, `.gitignore` | `npm run typecheck`, `npm test`, `npm run build` all pass on an empty skeleton |
| 0.2 | **Manifest and permissions** — MV3, `<all_urls>`, `storage`, `tts`, `contextMenus`, `scripting`, `activeTab`, hotkey command | Built manifest passes a test that checks the exact permission set |
| 0.3 | **Explore Mode toggle** — hotkey toggles state in the background; content script reports it; inert when off | Test proves no listeners are active when off |
| 0.4 | **Speech Service** — queue, `speak`, `cancel`, `Provider` interface, local provider over `chrome.tts` | Tests: interruption cancels the active Utterance; ordering; provider swap |
| 0.5 | **Earcon engine** — Web Audio buffers, named Earcons, Pan | Tests with a fake audio context: right buffer, right Pan |
| 0.6 | **Latency Meter** — marks pointer-event time and sound-start time, reports percentiles | Tests: percentile math; marks pair correctly |
| 0.7 | **Settings store** — typed settings in `chrome.storage.local`, defaults, validation | Tests: defaults, invalid values rejected, no keys logged |
| 0.8 | **CI** — GitHub Actions: typecheck, test with coverage, build | Workflow file present; same commands pass locally |

## Out of scope for Phase 0
Page analyzer, hover hit testing, haptic drivers, options UI, onboarding.

## Exit checklist
- [x] Typecheck, tests and build green
- [x] Coverage ≥ 80% on `src/` (100% lines, 93.6% branches)
- [x] Extension loads in Chromium under Playwright; a toggle message reaches the content script
- [ ] **Manual:** load `.output/chrome-mv3` unpacked in Chrome, press Alt+Shift+E, hear "Explore mode on" (a hotkey and real voice cannot be automated)
- [x] Spoken strings reviewed ("Explore mode on", "Explore mode off", inaccessible-page notice)
- [x] Docs updated (ADR-0009 added; PRD FR-3.4, §5.6 and §8 corrected)

## Findings
- Local `chrome.tts` voices cannot be panned, only Earcons can (ADR-0009).
- Only one global shortcut is allowed in practice; the rest live in the content script (ADR-0009).
- Earcons, the Latency Meter and the settings store exist and are tested, but nothing calls them yet. Phase 1 wires them to pointer events.
- CI runs typecheck, tests and build. Playwright e2e is not in CI yet: it needs a browser install step and headless extension support on the runner.
