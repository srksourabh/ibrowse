# ADR-0010: Clickability of plain elements is a guess; Earcon audio may need a gesture

Status: accepted

## Context
Two browser limits shape Phase 1.

1. A content script runs in an isolated world. It cannot see click listeners that the page added with `addEventListener`, so a `<div>` with a JavaScript click handler looks the same as a `<div>` with none.
2. Browsers may keep a page's `AudioContext` suspended until the page has seen a click or key press. The Alt+Shift+E command is handled by the browser, not the page, so it does not count as that gesture.

## Decisions

### Clickability has two levels of certainty
- **Sure:** native controls and ARIA roles (button, link with `href`, form controls, tab, and so on). Spoken as "Clickable".
- **Maybe:** a generic element that has `cursor: pointer`, an `onclick` attribute or `tabindex` of 0 or more. Spoken as "May be clickable", and given the static Earcon, not the interactive one.

Plain elements with none of these are reported as "Text only". This will miss some clickable elements. The PRD's false-clickable metric is measured on the Fixed Corpus and relaxed to under 1% for v1.

### Earcon audio resumes on the first click or key press
The content script creates the `AudioContext` lazily, tries to resume it when Explore Mode turns on, and resumes it again on the first `pointerdown` or `keydown`. Speech is unaffected, because it goes through `chrome.tts` in the background worker.

If Earcons stay silent until the user's first click or key press, that is expected, not a bug. Phase 5 onboarding must tell the user to press any key once after turning on Explore Mode, if testing on a headed browser shows the context starts suspended.

### Confirmed in Phase 3
Running the extension in Chromium for the end-to-end tests logged "The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page." So the risk is real, not hypothetical: Earcons that play before the first click or key press are lost. Speech is unaffected. Earlier headless probing of a page's own `AudioContext` said "running", which shows that probe was not representative.

## Consequences
- Spoken wording distinguishes "Clickable" from "May be clickable".
- Open verification item: confirm in a headed Chrome profile whether the `AudioContext` starts suspended. Headless Chromium started it running, which proves nothing for real Chrome.
- A future option is to play Earcons from an offscreen document in the extension's own origin, which is not subject to the page's autoplay policy. It adds a message hop and an `offscreen` permission, so it is held back until the headed test shows it is needed.
