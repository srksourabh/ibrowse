# Phase 2 — Intelligence

Goal: turning on Explore Mode briefs the user on the page and asks "Want me to read it?". Hovering a paragraph offers to read it, a click reads it, the wheel scrubs word by word, and Next Page moves on.

Source: PRD §5.2, §5.4, §5.5. Decisions: ADR-0011.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 2.1 | **Placement** — where something is on screen, in words ("top left", "on the left") | Tests pin every phrase |
| 2.2 | **Layout model** — title, page kind, regions (hero, navigation, sidebar, search), media, counts | Tests with fake geometry (jsdom has no layout) |
| 2.3 | **Briefing text** — the spoken summary, detailed form, viewport form | Tests pin the wording, plurals, cap and the empty page |
| 2.4 | **Read Prompt** — Y/Enter accepts, N/Esc or a pointer move dismisses, 6 s timeout | Tests with fake timers |
| 2.5 | **Readable blocks** — find, order and read text blocks; the block under the wheel | Tests |
| 2.6 | **Word scrubber** and **wheel stepper** — one word per notch, boundary then continue | Tests |
| 2.7 | **Text reader** — wheel, Alt+wheel page scroll, Shift+wheel spelling, click to read, read from here | Tests with fakes |
| 2.8 | **Briefer** — brief, read all, stop, hover muted while reading | Tests with fakes |
| 2.9 | **Pagination and Page Navigator** — find Next/Previous, scroll a screen, end-of-page messages | Tests |
| 2.10 | **Key router** — Alt+Shift+B, R, Right, Left, Esc | Tests |
| 2.11 | **Wire it up** — content script handlers, context menu, resume after navigation | End-to-end: brief, read, click, wheel, next page |

## Changes to Phase 1 behavior
- Hovering a paragraph now says "Paragraph: first words. Click to read." instead of "Text only".
- The hover controller gains `setMuted` (no interruption while the whole page is read) and `cancelDwell` (a wheel step must not be overridden by a late hover announcement).
- New Earcon: `tick`, played on each word.

## Out of scope
AI enrichment (Phase 5), forms, iframes, touch, "where am I" and heading/landmark jumps (Phase 3), highlighting the word being spoken.

## Exit checklist
- [x] Typecheck, tests, build green; coverage ≥ 80% (99.3% lines, 92.9% branches, 228 unit tests)
- [x] End-to-end (15 tests): briefing, Y reads, click reads, wheel scrubs, next page follows a link and re-briefs, end of page is reported
- [x] Docs updated (ADR-0011, PRD §5.4/§5.5/§5.6/§14, ADR-0003 note, `CONTEXT.md`)
- [ ] **Manual:** side mouse buttons trigger Next/Previous without moving browser history
- [ ] **Manual:** right-click menu shows "iBrowse: Next page" and "Previous page" and they work
- [ ] **Manual:** Alt+Shift+B (detailed briefing) and Alt+Shift+R (read from here) sound right with a real voice

## Findings
- A click within 150 ms of the pointer arriving on a paragraph would have been cut off by the hover description. Found while planning the end-to-end test; fixed test-first (`readBlock` cancels the pending dwell).
- Ctrl + wheel zooms in Chrome, so Alt + wheel scrolls the page instead (ADR-0011).
- `entrypoints/content.ts` has grown to about 230 lines, with a `main()` far over the 50-line function rule in `CLAUDE.md`. It is wiring only and every behavior it calls is unit tested, but it should be split before Phase 3 adds more handlers.
- The briefing's hero and page-kind rules are heuristics checked only on fake geometry and small test pages. They need the Fixed Corpus (Phase 6) before the 90% briefing-accuracy target means anything.
- The word being read is not highlighted on screen (PRD FR-4.3), because `chrome.tts` word events would have to travel back through the background worker.
