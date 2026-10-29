# ADR-0014: Voices, cloud and AI, and the first run

Status: accepted

## Context
Phase 5 added settings, a first-run tour, a screen-reader mode, a cloud voice and AI features. The provider was chosen by the user: first OpenAI, then replaced by **Gemini** before any code was written. Voice input was ruled out again (ADR-0008 stands).

## Decisions

### 1. Gemini, behind one adapter
`GeminiClient` is the only code that talks to Google: voice from `gemini-3.8-flash-lite-tts` (fast and cheap, so suited to read-aloud), AI from `gemini-3.8-flash`, both settings. The API has changed recently, so responses are parsed defensively. **It has never been run against the real service**, because no key was available; the requests follow the current documentation and are tested against a fake `fetch`.

### 2. One voice per utterance, chosen at speak time
A routing provider picks Companion (a hidden live region), cloud, or local for each utterance from the current settings. A screen reader wins whenever Companion mode is on. The cloud voice is used only for utterances marked as reading, unless the user chose "for everything", because a network round trip would slow the quick feedback of exploring.

### 3. The cloud voice can never leave the user in silence
If sound is blocked, the key is refused, the network fails or the audio cannot be played, the rest of the text is spoken by the local voice. The problem is spoken once (a refused key until the settings change, other problems at most once a minute). It waits up to 800 ms for the browser to wake its audio after the first click or key press, because that is when most users will first ask it to read.

### 4. Consent is two steps
Turning on something that sends data first speaks what will be sent, then waits for a separate "Allow and turn on". The browser's permission request needs a fresh user gesture, and a spoken warning takes longer than a gesture lasts, so one toggle cannot do both honestly. The Google host is an optional permission, so nothing can be sent until the user grants it.

### 5. The key stays in the worker
Only the background worker and the settings page use the key. A test fails if any code that runs in a web page imports the secrets or the client. The key goes in a request header, never an address; errors carry fixed text and never any part of a response.

### 6. Page text is untrusted
It is sent only inside a fence, after stripping invisible characters and any fence marker; the instructions say to treat it as data. Answers are cleaned of markdown, bullets and links and cut at a sentence end. They are spoken, never run. Only readable blocks are collected, so form values and passwords can never be included. Images are fetched by the worker without cookies, limited to 4 MB and to PNG, JPEG, WebP and GIF.

### 7. Speech start is measured for real
The utterance can carry a start callback. The background worker reports the voice's start event back to the page, which closes a timer opened when iBrowse decided to speak. The old numbers covered only iBrowse's own processing. The target is 150 ms.

### 8. The tour opens once, on install
A fresh install opens a ten-step spoken tour and says so aloud, since a new tab may not be announced. (Changed by ADR-0019: the install is silent and the tour page first asks about a screen reader.) It is not reopened on an update. The settings page can replay it.

### 9. The settings page speaks, because iBrowse is not running in it
Content scripts do not run on the extension's own pages. A user with no screen reader would hear nothing, so the page announces each setting on focus and every change. With Companion mode it writes to a live region instead, so nothing is said twice.

## Consequences
- PRD §5.9, §5.10, §6 and §8 are updated.
- The settings table is the single source for the page, the spoken text and the tests.
- The cloud voice and the AI features still need a manual check with a real Gemini key.
- Voice input (speech to text) is not built. Gemini's transcription model is not used.
