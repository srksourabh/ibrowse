# ADR-0011: Decisions made while building reading, briefing and Next Page

Status: accepted

## Context
Phase 2 turned several PRD sentences into code. Some of them did not survive contact with the browser, and some left a choice open.

## Decisions

### 1. Alt + wheel scrolls the page; Ctrl + wheel is left alone
The PRD and ADR-0003 said Ctrl + wheel scrolls the page. In Chrome, Ctrl + wheel zooms. Taking it over would break zoom for low-vision users and surprise everyone else. In Explore Mode the wheel is taken only over readable text, Alt + wheel scrolls the page, and Ctrl + wheel is untouched.

### 2. The wheel is taken only over text
Over a button, a form control, a margin or empty space the wheel scrolls the page as normal. Over a link inside a paragraph it scrubs the paragraph, so a link in the middle of a sentence does not break reading.

### 3. Reading the whole page mutes hover
While the page is read aloud (Read Prompt answered Y, or Alt+Shift+R with no word selected) pointer movement is ignored, so a nudge of the hand does not cancel a long reading. Esc stops it. Reading one clicked paragraph is not muted: moving to another element still interrupts, which is what the user expects.

### 4. Next Page follows pagination first
As decided: if the page has a next link, it is followed, and otherwise one screen is scrolled. A "next" link is found by `rel="next"` or a link whose whole label is "Next", "Older", or an arrow. Text that merely contains the word ("Next steps for your garden") is ignored. Only http and https links are followed.

The known cost: on a long article with a "Next" link at the foot, the command jumps pages without scrolling first. Scrolling with Alt + wheel announces "End of page. Next page is available." as a cue.

### 5. Explore Mode resumes after a followed link
The content script tells the background worker before it follows a link. When the tab finishes loading, the worker (which survives the page change) sends "resume". A note older than 15 seconds is ignored, so a single-page-app link that never reloads cannot cause a surprise activation later. The note is kept in `chrome.storage.session`, because the worker may be restarted between the two events.

### 6. The context menu has Next page and Previous page
Right-clicking shows "iBrowse: Next page" and "iBrowse: Previous page". It always targets the top frame.

### 7. The briefing is rule-based
The page kind, hero and counts come from the DOM and geometry, with fixed wording. A hero is a large block near the top, at least 25% of the screen high and 60% wide, whose heading has an image, video or background image. Optional AI wording is Phase 5 (ADR-0004).

### 8. Mouse side buttons are handled on mouseup
Buttons 3 and 4 trigger Previous and Next, and the event is cancelled so the browser does not also move through history. This could not be tested headless and is on the manual checklist.

## Consequences
- PRD FR-5.2, FR-5.6 and the decision table are corrected (Alt + wheel).
- Alt+Shift+Left, Right, B and R are handled in Explore Mode only. Only Alt+Shift+E is a browser-level command (ADR-0009).
- Highlighting the word being spoken (PRD FR-4.3) is not built: `chrome.tts` word events would be needed through the message hop. Revisit with Phase 5.
