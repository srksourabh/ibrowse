# iBrowse — domain language

The shared vocabulary for code, tests, docs and spoken strings. Use these terms exactly. When a new concept appears, add it here before using it.

## People

- **User**: a blind or low-vision person browsing with iBrowse.
- **Evaluator**: a sighted person trying the product or SDK. Not the design target.
- **Hardware maker**: a third party who writes a Driver for their device.

## Modes

- **Explore Mode**: the state in which iBrowse intercepts pointer, wheel and touch input and speaks. When it is off, iBrowse is inert.
- **Standalone**: iBrowse speaks with its own voice. Default.
- **Companion**: iBrowse sends announcements to a hidden live region so the user's screen reader speaks them.

## Page understanding

- **Page Briefing**: the short spoken summary given on entering Explore Mode: title, regions, counts. Ends with a **Read Prompt**.
- **Read Prompt**: the question "Want me to read it?" and its Y/N answer window.
- **Layout Model**: the analyzer's structured view of a page: regions, media, counts, positions.
- **Region**: a meaningful area of the page (hero, navigation, sidebar, main content, footer).
- **Block**: a readable unit of text (paragraph, list, quote, table, heading).
- **Element Under Pointer**: the most meaningful element at the pointer position.
- **Affordance**: whether an element is **Interactive** (can be activated) or **Static** (text only).
- **Certainty**: how sure iBrowse is of an Affordance. **Sure** for native controls and ARIA roles. **Maybe** for plain elements that only look clickable (pointer cursor, `onclick`, focusable). Maybe is spoken as "May be clickable".
- **Dwell**: resting the pointer on an element for 150 ms, which triggers the full spoken description. Moving on before that gives only the Earcon.
- **Meaningful Target**: the control, text block or image worth announcing for the element the pointer is on. A span inside a button gives the button; inline bold text gives its paragraph.

## Speech and sound

- **Utterance**: one thing the Speech Service says.
- **Speech Service**: queues and cancels Utterances, applies fades and panning, picks a Provider.
- **Provider**: a source of voice (local OS voice, or an optional cloud voice).
- **Earcon**: a short generated sound that stands for an element or event.
- **Pan**: stereo position, from -1 (left) to 1 (right), derived from horizontal screen position.
- **Short Mode**: Earcons replace spoken words such as "Clickable".
- **Interruption**: cancelling the current Utterance because the pointer moved. Must be fast and click-free.

## Reading

- **Scrub**: moving through a Block word by word with the scroll wheel.
- **Boundary**: the start or end of a Block. Gives the Boundary Cue.
- **Boundary Cue**: the bounce Earcon and haptic. A second push passes the Boundary.
- **Continuous Read**: reading from the current word to the end of the container.
- **Spelling Mode**: speaking a word letter by letter.
- **Next Page**: the command that follows Pagination if present, otherwise scrolls one screen.
- **Pagination**: links that move between pages of the same content.

## Haptics

- **Haptic Event**: a named tactile moment, for example `enter-interactive` or `boundary`. The vocabulary is fixed in the PRD §7.3.
- **Haptic Driver**: code that turns Haptic Events into signals for one kind of device.
- **Simulator Driver**: the default Driver. Uses audio sub-bass and a visual waveform, no hardware.
- **Device Profile**: a JSON file describing what a device can do.
- **Hysteresis Band**: the ±5 px zone at an edge that prevents repeated firing.

## Quality

- **Latency Meter**: the built-in tool measuring pointer-to-sound times on the user's machine.
- **Fixed Corpus**: the saved set of real web pages used to score the analyzer and classifier.
- **Briefing Accuracy**: the share of regions and counts the analyzer got right on the Fixed Corpus.

## Briefing and reading (added in Phase 2)

- **Hero**: a large block near the top of the page whose heading comes with imagery.
- **Scope**: whether the Layout Model covers the whole page or only what is on screen. After a scroll, only the screen is briefed.
- **Read All**: reading every block of the main content, in order. Hover is muted while it runs.
- **Mute**: ignoring pointer movement so speech is not cut off.
- **Placement**: where something is on screen, in thirds, spoken as "top left" or "on the right".
- **Resume**: turning Explore Mode back on after a followed link has loaded.

## Operating a page (added in Phase 3)

- **Navigation Cursor**: the element last jumped to, hovered, focused or read. Heading and landmark jumps continue from it.
- **Jump**: moving the cursor to the next or previous heading or landmark.
- **Landmark**: a named region of the page (main, navigation, sidebar, banner, footer, search, or a labelled section or form).
- **Where Am I / Status Zone**: the spoken page status (title, host, security, loading, tab). The Status Zone is the top 6 pixels of the viewport, which read it when the pointer arrives.
- **Typing Echo**: speaking what is typed into a field, as characters or words. Never for passwords.
- **Live Announcement**: speech for a change the page itself announces: a live region, an alert, a dialog opening.
- **Lift-to-Activate**: touch style where a tap or drag explores and a double tap activates the item explored before it.
- **Virtual Pointer**: the touched spot, which the wheel acts at after a touch, standing in for a mouse the extension cannot move.
- **Embedded Frame**: an iframe, whose content may belong to another site.

## Hardware (added in Phase 4)

- **Haptic Manager**: sits in front of the driver and applies intensity, the per-event cool-down, and the rule that a failing driver is dropped with one spoken notice.
- **Haptic Switch**: connects the driver only while Explore Mode is on.
- **Cool-down**: the least time between two plays of the same Haptic Event.
- **Relay Driver**: the stand-in inside a page for a device that lives in the background worker.
- **HID Host**: the background worker's owner of the paired device. It reconnects on demand, because Chrome may restart the worker at any time.
- **Pairing**: choosing a driver and granting a device on the hardware setup page (Alt+Shift+P).
- **Conformance**: whether a driver follows the driver contract, checked by `runConformance`.
- **SDK**: the `sdk/` folder and the exports of `src/haptics/index.ts`, for hardware makers.
- **Sound only**: no haptic driver. The default.

## Words to avoid

| Don't say | Say |
|---|---|
| screen reader (for ourselves) | iBrowse, or **Standalone** / **Companion** |
| cursor (for touch) | pointer |
| TTS (in user-facing text) | voice |
| tick, click (for haptics) | Haptic Event |
| hover reading | exploring |
