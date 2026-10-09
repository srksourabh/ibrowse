# ADR-0009: Platform limits that change the PRD

Status: accepted

## Context
Scaffolding Phase 0 showed three places where the PRD assumed more than the browser allows.

## Decisions

### 1. Local voices cannot be panned
`chrome.tts` plays through the browser's own output and gives no audio stream, so it cannot be routed through Web Audio. Stereo panning (PRD FR-3.4) therefore applies to **Earcons** and to **cloud voices** (which return audio we can pan). Local voice speech is centered.

The Earcon that plays just before each Utterance carries the spatial cue, so the user still hears where an element is.

### 2. Only one global keyboard shortcut
Browsers allow at most four suggested shortcuts per extension, and users can clear them. Only `toggle-explore` (Alt+Shift+E) is a global command. All other shortcuts in PRD §5.6 are handled by the content script while Explore Mode is on, where we control the key handling and can avoid page conflicts.

### 3. Speech runs in the background worker
`chrome.tts` is not available to content scripts. The content script's `SpeechService` talks to a `MessageSpeechProvider`, which asks the background worker's `ChromeTtsProvider` to speak. The extra message hop is inside the 150 ms speech-start budget and is tracked by the Latency Meter.

### 4. Every frame toggles, one frame speaks
The content script runs in all frames. A toggle message reaches every frame, so only the top frame announces the change; otherwise a page with iframes would repeat it.

## Consequences
- PRD FR-3.4 and §5.6 are corrected.
- Phase 1 must put the directional cue in the Earcon, not the voice.
- If a cloud provider is added later, it should return audio so it can be panned.
