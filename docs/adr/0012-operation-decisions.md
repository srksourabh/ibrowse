# ADR-0012: Decisions made while building forms, navigation, live changes, frames and touch

Status: accepted

## Context
Phase 3 added the ways a user operates a page, not just reads it. Several choices were open, and two bugs found by the end-to-end tests changed the design.

## Decisions

### 1. Heading and landmark jumps use Alt+Shift+arrows
Alt+Shift+Down and Up for headings, Alt+Shift+PageDown and PageUp for landmarks. The PRD proposed plain `Shift+H` and `Shift+L`. A plain letter would fire while the user types a capital H in a form, or collide with a site's own shortcuts.

### 2. A navigation cursor ties everything together
The cursor is the element last jumped to, hovered, focused or read. Jumps continue from it, and Alt+Shift+R reads from it. With no cursor, a forward jump goes to the first target and a backward jump to the last.

### 3. Passwords are never spoken
What is typed into a password field is never spoken, in any typing-echo mode, and the value is never put into the description of the field (only "empty" or "filled"). Each keystroke gives a tick, so the user still knows the key registered. This is deliberate even for a user alone in a room: speech may be heard through speakers, recorded or shared.

### 4. The status zone is the top 6 pixels
Hovering a page's very top edge reads the page status instead of whatever is under the pointer there. That costs a 6-pixel strip of the page's own top edge. It is entered once per visit and left once the pointer is 24 pixels down, so a shaky hand does not repeat it. Only the top frame has such an edge.

### 5. Pointer handling is a leading-edge throttle, not a per-frame coalescer
The first movement of a burst is handled at once; later ones within 16 ms are held back and only the latest delivered. The earlier design delayed everything to the next animation frame. An end-to-end test showed why that was wrong: a click or tap inside that frame queued its message (a form validation error), and the delayed hover step then cancelled it as "speech from the old element".

### 6. A hover description never interrupts
It waits its turn behind anything that began after the pointer arrived. Moving to a new element already cancels the old element's speech, so nothing stale is left to wait behind. The wheel and click-to-read also cancel a pending description.

### 7. A validation message is heard before the field that takes focus
After a failed submit the browser moves focus to the first invalid field. For 300 ms after an `invalid` event, the focus announcement waits instead of interrupting.

### 8. Double tap activates the item explored before the double tap began
The taps of a double tap land anywhere, and each moves the pointer on. The activator remembers the explored item when a run of taps begins. A tap does not also produce the browser's click (the `touchend` is cancelled), so a lift-to-activate single tap never presses a link by accident.

### 9. The wheel follows the last touch
An extension cannot move the real mouse pointer, so "the mouse snaps to the finger" (PRD FR-7.3) is a virtual pointer: after a touch, the wheel acts at the touched spot until the mouse moves again.

### 10. Touch scrolling is off in Explore Mode
`touch-action: none` is set on the page while Explore Mode is on, so a dragging finger explores instead of scrolling. The page's own value is restored afterwards. Scrolling is by Next Page or Alt + wheel.

### 11. Frames
The content script runs in every frame, so hover, wheel and click work inside iframes from any site. Shortcuts pressed while focus is in a frame are passed to the top frame through the background worker. Pan is computed from screen position, so a frame pans by where it is in the window. Read All covers only the top document; the briefing says how many embedded frames there are.

### 12. Live announcements are rate-limited and ordered
Alerts and dialogs interrupt, other live regions wait. The same text is not spoken twice within 1.5 seconds, which keeps a ticking region or a chatty widget from drowning everything else.

## Consequences
- PRD §5.6, §5.7, §5.8 and FR-3.6 are corrected.
- Typing echo is a new setting, `typingEcho`.
- `src/session` holds only wiring; it is excluded from coverage and exercised by the end-to-end suite.
- Not built: table navigation, closed shadow roots, highlighting the word being read, spoken confirmation of form submission.
