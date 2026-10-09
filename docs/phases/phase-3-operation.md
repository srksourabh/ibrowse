# Phase 3 — Operation

Goal: a blind user can complete a real task: move around by headings and landmarks, fill in and submit a form, notice when the page changes, work inside iframes and shadow DOM, and use a touchscreen.

Source: PRD §5.3 (FR-3.6), §5.6, §5.7, §5.8, §5.2 (FR-2.8). Decisions: ADR-0012.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 3.0 | **Split `content.ts`** into small composition modules; `ExploreMode` gains per-handler capture | Behavior unchanged: all Phase 1 and 2 tests still pass |
| 3.1 | **Pan from the window, not the frame** — so iframes pan correctly | Hover and reader take a `panAt(x)` |
| 3.2 | **Headings and landmarks** — next/previous jump, a navigation cursor, read from the cursor | Tests |
| 3.3 | **Where am I and the status zone** — title, host, security, load state, tab position; the top edge of the viewport | Tests |
| 3.4 | **Form fields** — focus announcement with value, typing echo (never for passwords), state changes, validation messages | Tests |
| 3.5 | **Dynamic changes** — live regions, alerts, dialogs | Tests with a real `MutationObserver` in jsdom |
| 3.6 | **Touch** — explore by finger, lift-to-activate or direct tap, edge cue, virtual pointer for the wheel | Tests |
| 3.7 | **Frames** — count embedded frames in the briefing; shortcuts pressed inside a frame reach the top frame | Tests |
| 3.8 | **End-to-end** — form, headings, live region, iframe, touch tap | Playwright |

## Out of scope
Highlighting the word being read, table navigation, cross-origin iframe contents in Read All, closed shadow roots, AI wording (Phase 5), haptics (Phase 4).

## Exit checklist
- [x] Typecheck, tests, build green; coverage ≥ 80% (99.3% lines, 92.1% branches, 349 unit tests)
- [x] End-to-end (29 tests, passing five runs in a row): heading and landmark jumps, where-am-i, status zone, form focus and typing echo, password silence, checkbox change, validation message, live region, dialog, iframe hover and shortcut, touch tap and double tap
- [x] Docs updated (ADR-0012, ADR-0010 note, PRD §5.6/§5.7/§5.8/FR-3.6, `CONTEXT.md`, `CLAUDE.md` layout, README keys)
- [ ] **Manual:** a real touchscreen: explore by dragging, double-tap to activate (Playwright can only tap)
- [ ] **Manual:** type into a password field with a real voice and confirm nothing is spoken
- [ ] **Manual:** the status zone: does a 6-pixel strip at the very top of a maximised window feel reachable?

## Findings
- **A race the end-to-end tests exposed twice.** Speech queued by an event (a form validation message) was cancelled by hover, because the hover step ran a frame late and then cancelled "the old element's speech". Fixed at the cause: pointer handling is now a leading-edge throttle (ADR-0012 #5), the hover description waits its turn instead of interrupting, and a validation message is heard before the focus announcement. Passing once proved nothing; it failed in 2 of 3 runs before the cause was fixed.
- **The throttle changed touch.** The second tap of a double tap now moves hover immediately, so the activator remembers what was explored when the tap run began.
- **Autoplay is confirmed** (ADR-0010): Earcons before the first gesture are lost.
- Not built: table navigation, closed shadow roots, word highlighting, spoken confirmation of a form being submitted.
- Cross-origin iframe text is not part of Read All; the briefing mentions embedded frames so the user knows.
- The 6-pixel status strip takes the top edge of the page's own content; it may need to be adjustable in Phase 5.
