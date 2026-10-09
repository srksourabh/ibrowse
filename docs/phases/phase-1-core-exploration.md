# Phase 1 — Core exploration

Goal: with Explore Mode on, moving the mouse over a page announces what is under it, with a directional Earcon and a click-free interruption when the pointer moves on.

Source: PRD §5.3, §5.4, §6.1. Decisions: ADR-0003, ADR-0009, ADR-0010.

## Slices (each is red, green, refactor)

| # | Slice | Done when |
|---|---|---|
| 1.1 | **Describe** — role, accessible name, state and Affordance for an element (`dom-accessibility-api`) | Tests cover buttons, links, form controls, ARIA roles, headings, images, disabled, and the "may be clickable" heuristics |
| 1.2 | **Affordance speech** — the spoken grammar from PRD §5.4, with Short Mode | Tests pin every phrase |
| 1.3 | **Hit test** — Element Under Pointer, piercing open shadow roots, skipping decorative overlays and `aria-hidden` | Tests with stubbed `elementsFromPoint` |
| 1.4 | **Hover controller** — dwell (150 ms), hysteresis (±5 px), interruption, Earcon with Pan, Latency Meter marks | Tests with fake timers and fake services |
| 1.5 | **Frame coalescer** — at most one hit test per animation frame | Test with fake `requestAnimationFrame` |
| 1.6 | **Wire it up** — content script registers handlers on Explore Mode, creates audio, reads settings | End-to-end: hovering a button on a served page speaks its description |

## Out of scope
Click to read, wheel scrubbing, touch, the page briefing, cross-origin iframes, haptics.

## Exit checklist
- [x] Typecheck, tests, build green; coverage ≥ 80% (99.7% lines, 90.2% branches)
- [x] End-to-end test: hover announces a button and a paragraph correctly, stays silent over empty space and after Explore Mode is turned off
- [ ] **Manual:** moving the pointer cuts speech off without a click or pop (needs real voices and ears)
- [ ] **Manual:** on a headed Chrome profile, check whether Earcons play before the first click or key press (ADR-0010)
- [x] Docs updated (ADR-0010, `CONTEXT.md`)

## Findings
- Clickability of plain elements is a guess; the page's own click listeners are invisible to an extension (ADR-0010).
- The Latency Meter's `earcon` and `cancel` figures measure iBrowse's own processing time, up to the moment audio is handed to the browser. They do not include audio output delay. Measuring true speech-start time needs a start event from the provider, planned for Phase 5 with the latency readout.
- Pan uses the frame's own width. Inside an iframe it is relative to the iframe, not the full window. Cross-origin frame handling is Phase 3.
- Touch input and the page briefing are not part of this phase.
