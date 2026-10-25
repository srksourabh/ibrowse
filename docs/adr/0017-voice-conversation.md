# ADR-0017: Voice conversation: iBrowse asks, listens and acts

Status: accepted. Supersedes [ADR-0008](0008-no-voice-input.md). Not built yet; see `docs/phases/phase-5b-conversation.md`.

## Context
The product goal (stated by the user, 2026-10-25) is a fully interactive browser for blind people:
- On opening a page, iBrowse says what is in the header, the left panel, the centre and the right panel.
- Hovering names the image, button or text, then asks what the user wants to do.
- The user can answer by voice: talk to click, "scroll up", "go back". They can also ask questions and get answers.

ADR-0008 ruled out voice input because Chrome's recogniser sends audio to Google, needs the microphone, and hears the extension's own speech. Each of those now has an answer below.

## Decisions

### 1. Two recognisers behind one `SpeechRecognizer` interface; the user chooses
- **Chrome's own, the default.** iBrowse uses on-device recognition (`processLocally`, Chrome 139+) whenever `SpeechRecognition.available()` says it can. Otherwise it uses Google's service. Turning voice on says aloud which one is in use.
- **Gemini, optional.** It uses the same key and consent flow as cloud voice (ADR-0014): recorded audio is sent for transcription.
- The interface mirrors `SpeechProvider`. As with the `HapticDriver` and `SpeechProvider` interfaces, a second implementation is planned, so the abstraction is justified.

### 2. Recognition runs in an offscreen document
The service worker has no `SpeechRecognition`. A content script would ask for the microphone on every site, and could hear the page.
- An offscreen document is created with reason `USER_MEDIA` only while Explore Mode is on and voice is on. It is closed when either turns off.
- It sends transcripts to the worker, which passes them to the tab's top frame.
- An offscreen document cannot show a permission prompt. The microphone is therefore granted once on a visible extension page, in the setup flow, by keyboard and voice. Manifest: `offscreen` permission.

### 3. When iBrowse listens
- **After it asks.** Once a question has finished being spoken ("Sign in, button. What would you like to do?"), iBrowse listens for up to 5 seconds. It never listens while it is speaking, so it cannot hear itself.
- **While a key is held** (push to talk), at any time during Explore Mode.
- Never otherwise. A short earcon marks the start and end of listening.
- Nothing is recorded or kept beyond the transcript of one request.

### 4. Commands are understood on the device; open questions go to AI
- **A local command grammar** handles click or press, scroll up and down, read this or read the page, next and previous page, go back, the panel commands ("what is on the left", "go to the main content"), find X, stop, repeat and help. It is fast, free and works offline with the on-device recogniser.
- **Anything else is a question.** It goes to Gemini with the readable page text, under the existing AI consent and untrusted-text rules (PRD §8), only if AI is on. Without AI, iBrowse says it did not understand and lists a few commands.

### 5. The briefing is organised by panels
Header, left panel, main content, right panel, then footer, each with what it holds ("Header: logo, search box, 6 links. Left panel: menu with 12 links…"). The existing layout model is extended rather than replaced.

### 6. Privacy and the hard rules still hold
- Nothing listens unless Explore Mode is on (ADR-0003).
- Audio and transcripts are never logged.
- A transcript is untrusted user text: it is matched against commands or sent as a question, and never run.
- Turning voice on says what is sent, and where.

## Consequences
- New permission: `offscreen`. The microphone is granted per extension, not per site.
- On-device recognition may be unavailable on some Chrome builds and languages; then the user hears that Google's service is in use, or can switch voice off.
- Adds a phase before the closed beta (Phase 5b).
- Voice input must be tested with real microphones, accents and background noise. The end-to-end suite can only feed transcripts in.
