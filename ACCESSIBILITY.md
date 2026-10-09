# Accessibility statement

iBrowse is an accessibility tool, so its own accessibility is a core requirement.

## What we commit to

- **Everything works without sight.** Every feature, including installation, the tour, settings and hardware setup, can be used by keyboard and is spoken. Nothing depends on seeing the screen.
- **Audio alone is complete.** Haptics are optional.
- **No voice input is required.** (See [ADR-0008](docs/adr/0008-no-voice-input.md).)
- **It works beside a screen reader.** Companion mode hands speech to NVDA, JAWS or VoiceOver through a live region, so nothing is said twice.
- **Our pages are plain.** The settings, hardware and tour pages use native controls, labels and headings, and speak changes themselves, because iBrowse does not run on its own pages.
- **Docs are readable.** Documents use headings and tables sparingly, describe every image in text, and avoid colour-only meaning.

## Known limits

- Real-device checks are still open: NVDA and VoiceOver in Companion mode, real touchscreens, real haptic hardware, and a real Gemini key. They are listed in [docs/phases](docs/phases).
- Local browser voices cannot be panned left and right.
- Ctrl+wheel is the browser's zoom, so Alt+wheel scrolls.
- Chrome blocks extensions on some pages.

## Feedback

Tell us about any barrier through [SUPPORT.md](SUPPORT.md). We treat accessibility reports as bugs, and we welcome testers who are blind or low-vision.
