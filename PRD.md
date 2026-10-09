# Product Requirements Document (PRD)
## iBrowse — Intelligent Spatial Browsing Extension for Blind Users

**Version:** 2.0
**Status:** Ready for review (supersedes v1.0, the native Windows system)
**Platform:** Chrome extension (Manifest V3); also runs in Edge and Brave
**License:** MIT, open source, with an open hardware driver SDK

---

## 1. Vision

Blind users browse today almost entirely through linear keyboard navigation. That works for structured tasks but gives no sense of how a page is laid out. iBrowse is a Chrome extension that gives them a spatial and intelligent way to browse any website:

1. **Understand.** When explore mode starts, the extension analyzes the page and briefs the user in plain speech: what is on it, where, and how much.
2. **Explore.** The user glides a mouse or finger over the page and hears what is under it, with stereo panning matching horizontal position.
3. **Read.** The user chooses what to read, from a whole block down to word-by-word with the scroll wheel.
4. **Act.** The user can click, fill forms and move on to the next page without sight.

Any hardware with haptics can plug in later through an open driver interface. Audio alone is a complete experience.

### 1.1 What changed from v1.0
| Removed | Why |
|---|---|
| Native C++/Rust daemon, Windows UIA, WASAPI | An extension cannot see outside the browser |
| Taskbar and system-tray monitor (old §4.4) | Replaced by a browser status zone (§5.8) |
| 12 ms hardware haptic target | Not measurable without hardware; moved to the native roadmap |
| Enterprise installer | Distribution is the Chrome Web Store |

The existing browser simulator is kept as a hosted demo site and haptic visualizer (§12). It is no longer the product.

---

## 2. Personas

| Persona | Needs | iBrowse delivers |
|---|---|---|
| **Alex**, blind professional using NVDA or JAWS daily | Understand 2D dashboards, tables and page arrangements | Spatial hover, a layout briefing, panned audio |
| **Sam**, recently blind, overwhelmed by shortcuts | A direct, physical way to explore with few commands to learn | Hover, touch, click to read, a small command set |
| **Jordan**, student reading long papers | Precise word-level inspection | Wheel word scrubbing, spelling mode, continuous read |
| **Evaluator or hardware partner** (sighted) | Try the product and the driver SDK in minutes | Demo site, simulator driver, SDK docs |

---

## 3. Scope

### 3.1 In v1
- Explore mode with hotkey toggle and an "always start in explore mode" setting
- Automatic **page briefing** and read prompts (§5.1, §5.2)
- Hover reading for mouse and touch, with clickable vs text-only affordances
- Word-by-word wheel scrubbing and continuous read
- **Smart next page** (§5.5)
- Keyboard command set, form filling, iframe and shadow-DOM handling
- Dynamic-page change announcements
- Browser status zone
- Spoken first-run onboarding
- Haptic driver interface with Gamepad and WebHID drivers and a published SDK
- Local speech by default, with optional cloud voices and AI enrichment (bring your own key)
- Built-in latency meter

### 3.2 Out of scope
- Anything outside the browser (desktop apps, OS taskbar)
- Voice input and speech recognition (decision: click, keys and gestures only)
- Pages the extension cannot access, which it must announce clearly: `chrome://` pages, the Chrome Web Store, and the built-in PDF viewer
- Canvas-only content with no DOM (announced as "unreadable graphic")
- Web Serial and Web Bluetooth drivers (later, through the same interface)
- Firefox and Safari

---

## 4. Principles

1. **Silent by default, helpful on demand.** Nothing is intercepted until explore mode is on.
2. **Never trap the user.** Every spoken prompt is interruptible with any key, click or mouse move. Esc always stops speech.
3. **One voice.** The extension must never talk over a screen reader (§5.9).
4. **Audio is complete.** Haptics enhance the experience but are never required.
5. **Private by default.** Local processing is the default. Anything that sends page content out is opt-in and announced aloud.
6. **Everything works without sight, including setup.**

---

## 5. Functional requirements

### 5.1 Explore mode and activation
- **FR-1.1** A hotkey toggles explore mode (default Alt+Shift+E, remappable at `chrome://extensions/shortcuts`).
- **FR-1.2** The setting "Always start in explore mode" enables it on every page load.
- **FR-1.3** Entering explore mode speaks "Explore mode on", then the page briefing (§5.2). Leaving speaks "Explore mode off".
- **FR-1.4** When explore mode is off, no wheel, touch or key events are intercepted.
- **FR-1.5** On pages the extension cannot access, the toolbar button and hotkey announce why.

### 5.2 Intelligent page briefing
- **FR-2.1** On entry, the extension analyzes the page **locally** and speaks a short summary in one or two sentences, then asks "Want me to read it?".
- **FR-2.2** The briefing covers: page title and type, major regions and their positions, notable media with position, and counts of paragraphs, headings, links, forms and inputs.
  - Example: *"Article page. Picture on the left, hero section at the top, 34 paragraphs, 12 links, search box top right. Want me to read it?"*
- **FR-2.3** Analysis combines DOM structure, ARIA landmarks and roles, element geometry (position and size), and heuristics for hero sections (large top block with heading and image), navigation, sidebars and footers.
- **FR-2.4** Answering the prompt: **Y or Enter** reads from the main content; **N or Esc** or any mouse move dismisses it. An unanswered prompt times out silently after 6 seconds.
- **FR-2.5** A hotkey (default Alt+Shift+B) repeats the briefing in detail: every region in layout order with position.
- **FR-2.6** The briefing must start speaking within 1 second on pages up to 5,000 DOM nodes. Analysis runs off the main thread where possible and must not freeze the page.
- **FR-2.7** **Optional AI enrichment** (§8): when the user has set up a cloud provider key, the briefing adds a one-line purpose ("This looks like a news article about…"), captions for images without useful alt text, and on-demand summaries. Without a key, the extension uses alt text and nearby captions, and says "image, no description" otherwise.
- **FR-2.8** On dynamic changes (new content, route changes, dialogs, live regions), the extension announces them briefly, for example "Dialog opened: Sign in" or "12 new results".

### 5.3 Spatial hover exploration
- **FR-3.1** Pointer position is resolved to the topmost meaningful element (`elementsFromPoint`, piercing open shadow roots and same-origin iframes).
- **FR-3.2** Moving to a new element cancels the current speech within 20 ms, with a short fade to avoid clicks.
- **FR-3.3** Resting on an element for 150 ms announces it. Short mode replaces words with earcons.
- **FR-3.4** Earcons (and cloud voices) are panned left to right by the element's horizontal position. Local voices cannot be panned in a browser, so each element's Earcon carries the directional cue and the local voice stays centered (ADR-0009).
- **FR-3.5** The extension keeps a hysteresis band of ±5 px at element edges to avoid chatter.
- **FR-3.6** The content script runs in every frame, so hover, the wheel and click-to-read work inside iframes, including ones from other sites. Pan is measured against the whole window, not the frame. A shortcut pressed while focus is inside a frame is carried out by the top frame. The briefing counts embedded frames, because Read All reads only the top document. Only the top frame announces "Explore mode on".

### 5.4 Affordance announcements
Every element is classified as **interactive** or **static**, using role and name from `dom-accessibility-api`, ARIA states, native control types, and heuristics (`cursor:pointer`, click listeners, `tabindex`).

| Case | Spoken form |
|---|---|
| Interactive | `[Label] — [Role], Clickable` |
| Static text block | `[Label or first words] — Text only` |
| Paragraph (hover prompt) | *"Paragraph: The quick brown fox jumps. Click to read."* (first five words; Short Mode drops "Click to read") |
| Heading | `[Text] — Heading level N, Text only` |
| Image | `[Alt or AI caption] — Image` |
| Disabled | `[Label] — [Role], Disabled` |

- **FR-4.1** On hover over a readable block (paragraph, list, quote, table, article body), the extension says what it is and offers to read it: *"Paragraph: The quick brown fox jumps. Click to read."* v1 offers this for paragraphs; other text blocks are announced as "Text only" and can still be clicked or scrubbed.
- **FR-4.2** **Click on a non-interactive block reads it.** Click on an interactive control activates it. Touch follows the same rule through the activation style in §5.7.
- **FR-4.3** Reading a block speaks it as a unit, interruptible, with the word under speech highlighted visually for sighted helpers.
- **FR-4.4** The false-interactivity target is in §10.

### 5.5 Reading and next page
- **FR-5.1 Wheel scrubbing.** Over a text block in explore mode, the wheel moves word by word (down = next, up = previous). Each word is spoken on each notch.
- **FR-5.2 Boundaries.** At the end of a block the wheel stops and gives the boundary cue (bounce earcon and haptic). A second push continues into the next block. **Alt + wheel** scrolls the page. Ctrl + wheel is the browser's zoom and is left alone (ADR-0011).
- **FR-5.3 Spelling mode.** Pausing on a word for 800 ms or Shift + wheel spells it letter by letter.
- **FR-5.4 Continuous read** reads from the current word to the end of the container (default Alt+Shift+R).
- **FR-5.5 Smart next page.** The "next page" command does one of two things and says which:
  1. If the page has pagination (a link with `rel="next"`, a "Next" or "›" control, or numbered pages), it follows it and gives a new briefing.
  2. Otherwise it scrolls one screen down and briefs only the newly visible content.
- **FR-5.6** "Next page" is available through: the context menu (right-click, "Next page"), a mouse side button, and Alt+Shift+Right. Scrolling with Alt + wheel announces "End of page" on arrival, and adds "Next page is available" when the page has a pagination link.
- **FR-5.6a** After a followed pagination link loads, Explore Mode turns itself back on and briefs the new page.
- **FR-5.6b** While the whole page is being read (the Read Prompt answered Y, or Alt+Shift+R with no word selected), pointer movement is ignored so the reading is not cut off. Esc stops it.
- **FR-5.7** A matching "Previous page" command exists.
- **FR-5.8** On infinite-scroll pages, scroll-based next page announces "Loaded N more items" once content appears.

### 5.6 Keyboard commands
Browsers allow only four suggested shortcuts per extension (ADR-0009), so **only the Explore Mode toggle is a browser-level command** (remappable at `chrome://extensions/shortcuts`). The rest are handled by the extension while Explore Mode is on, and are remappable in settings. Defaults:

| Action | Keys |
|---|---|
| Toggle explore mode | Alt+Shift+E |
| Repeat / detailed briefing | Alt+Shift+B |
| Where am I (title, host, security, load state, tab) | Alt+Shift+W |
| Read from here (the current word, else the navigation cursor, else the top) | Alt+Shift+R |
| Next / previous heading | Alt+Shift+Down / Up |
| Next / previous landmark | Alt+Shift+PageDown / PageUp |
| Next / previous page | Alt+Shift+Right / Left |
| Stop speech | Esc |
| Open settings (Phase 5) | Alt+Shift+S |

Heading jumps are on Alt+Shift+arrows, not the plain `Shift+H` first proposed, because a plain letter key would fire while typing in a form or using a site's own shortcuts (ADR-0012). The **navigation cursor** is the element last jumped to, hovered, focused or read, so a jump always continues from where the user is.

### 5.7 Touch and dual input
- **FR-7.1** Touch exploration is supported through pointer events, with `touch-action: none` on the page while Explore Mode is on so a dragging finger does not scroll it. The page's own setting is restored when Explore Mode turns off. Touch scrolling is therefore off in Explore Mode; use Next Page or Alt + wheel.
- **FR-7.2** Activation style is selectable; default is **lift-to-activate**: a single tap or drag explores, and a double tap anywhere activates the item explored before the double tap began. The alternative is direct tap, where a tap activates what is under the finger. A tap does not also produce the browser's own click.
- **FR-7.3** **Touch-to-locate, mouse-to-scrub.** A browser extension cannot move the real mouse pointer. Instead, after a touch the wheel acts at the touched spot until the mouse is moved again.
- **FR-7.4** Reaching the edge of the screen with a finger plays an edge tone, panned to that side.

### 5.8 Forms and browser status
- **FR-8.1 Form filling.** Entering a field focuses it and speaks its label, type, current value and whether it is required ("Email — Edit text, empty, required"). Typing is echoed by character or word, or not at all (setting `typingEcho`, default characters). Deletions are announced. Checkboxes, radios, selects and sliders announce their new state ("Subscribe: checked", "Day: Tuesday"). Validation errors are read as the browser reports them ("Email: Please enter an email address"), before the announcement of the field that gets focus.
- **FR-8.1a Passwords.** What is typed into a password field is never spoken, in any mode. Each keystroke gives a tick. Hovering or focusing a password field says only whether it is empty or filled.
- **FR-8.2 Browser status zone.** The top 6 pixels of the viewport, and the Alt+Shift+W command, read the page title, host, whether the connection is secure, whether it is still loading, and which tab this is ("Tab 2 of 5"). The zone is entered once per visit and left once the pointer is 24 pixels down.
- **FR-8.2a Live changes.** While Explore Mode is on, text added to a live region (`aria-live`, `role="alert"`, `status` or `log`) is spoken, and dialogs that open are announced by name. Alerts and dialogs interrupt; other regions wait their turn. The same words are not spoken twice within 1.5 seconds, and very long text is cut at 300 characters.
- **FR-8.3** Unsupported or inaccessible content is named explicitly: "Embedded video, cannot be read", "Graphic with no text".

### 5.9 Screen reader coexistence
- **FR-9.1** Setting: **Standalone** (default) or **Companion**.
  - **Standalone:** the extension speaks through its own TTS. Onboarding tells the user to pause their screen reader's browse mode while exploring.
  - **Companion:** announcements are sent to a visually hidden ARIA live region so the screen reader speaks them with its own voice. Spatial panning and fast interruption are not available in this mode.
- **FR-9.2** The setting is changeable by keyboard and speech, with no visual UI required.

### 5.10 First run and settings
- **FR-10.1** On a fresh install a spoken tour opens by itself, once: ten short steps covering Explore Mode, exploring, reading, moving, where am I, forms, touch, settings and hardware. Enter goes on, Backspace goes back, R repeats, Escape skips. It can be heard again from settings.
- **FR-10.2** Settings open with **Alt+Shift+S**, on a page built from real headings, labels and controls. Every setting is described once, in a table that also drives the validators and the spoken text. Each setting is read out (name, value, what it does) when it gets focus, and every change is spoken, so the page works with iBrowse's own voice alone. Hotkeys are changed in the browser's shortcut page, which the settings page opens.
- **FR-10.3 Delay readout.** With "Measure delays" on, the settings page can read out how long sounds, speech start and stopping speech take, against their targets.

---

## 6. Audio and speech

- **FR-6.1** Default voices come from `chrome.tts` (OS voices) and are fully local.
- **FR-6.2** Earcons are generated with Web Audio for low latency: button, link, text, edge, boundary, error.
- **FR-6.3** A `SpeechProvider` interface allows additional voices. v1 ships three: the local voice, a hidden live region for a screen reader (Companion mode), and **one** optional cloud provider, **Google Gemini** (ADR-0014). Which one speaks is decided for each utterance, from the settings.
- **FR-6.4 Cloud voice and AI** use the user's own Google key, kept in extension storage and used only by the background worker. Turning either on speaks what will be sent, then waits for a separate, deliberate "Allow and turn on" before the browser asks for permission to contact Google. Removing the key removes it from storage. A cloud voice speaks **reading aloud only** by default (read-all, click-to-read, read-from-here, AI answers); quick feedback stays on the local voice, which starts at once. If the cloud voice fails for any reason, the rest is spoken by the local voice, and the problem is spoken once.
- **FR-6.5 Voice settings:** speech rate, pitch, volume and a local voice by name apply to every local utterance.
- **FR-6.6 Speech start is measured** from the moment iBrowse decides to speak to the moment the sound begins, and read out on request (§5.10).
- **FR-6.5 Speech modes:** Explore (summarized, interruptible), Reading (sequential, uninterrupted unless direction changes or the pointer leaves), Continuous read.

### 6.1 Latency targets (extension)
| Event | Target |
|---|---|
| Pointer move to earcon | ≤ 30 ms |
| Pointer move to speech start | ≤ 150 ms |
| Speech cancel on movement | ≤ 20 ms |
| Page briefing start | ≤ 1 s |

A built-in **latency meter** (developer option) measures these on the user's machine. The original native targets (earcon 15 ms, speech 45 ms) stay as goals for a future native build.

---

## 7. Hardware and haptics

### 7.1 Principle
Audio-only is the complete default. Real haptics are optional and attach through a driver, so any hardware maker can add support without changing the extension. Haptics are connected only while Explore Mode is on, so a page the user has not switched iBrowse on for is never touched.

### 7.2 `HapticDriver` interface
A typed contract, published in the open SDK (ADR-0013):
- `id`, `name`, `capabilities()` (the events the device can express, or all)
- `connect()` resolves to `{ok: true}` or `{ok: false, reason}`, where the reason is a sentence that is spoken to the user
- `disconnect()`
- `play(event, intensity)` with intensity from 0 to 1. It must not block, and must not throw for an unsupported event or an out-of-range intensity.
- `onDisconnect(listener)`, so the user is told aloud if the device goes away

A `HapticManager` sits in front of the driver. It applies the intensity setting (zero is off), a per-event cool-down, and the rule that a driver which fails or is unplugged is dropped with one spoken notice while sound carries on.

### 7.3 Event vocabulary and reference waveforms
| Event | Profile | Feel |
|---|---|---|
| `enter-interactive` | Dual pulse, 240 Hz, 20 + 15 ms | Button detent |
| `enter-static` | Single sine, 150 Hz, 12 ms | Soft texture |
| `word-tick` | Micro-tick, 280 Hz, 8 ms | Watch click |
| `boundary` | Damped double thud, 90 Hz, 40 ms | Rubber stop |
| `edge-cross` | Ramp 120 → 220 Hz, 30 ms | Ledge |
| `action-confirm` | 180 Hz, 35 ms | Latch |
| `error` | Triple buzz, 110 Hz, 80 ms | Buzz |
| `page-change` | Rising double pulse, 140 → 200 then 200 → 260 Hz, 25 ms each | New page loaded, or Explore Mode turned on |

Every Earcon also fires its Haptic Event, so what is heard and what is felt always agree: interactive, static, tick, boundary, edge, error and confirm map to the first seven events. Activating a control (a click, or a touch activation) plays the confirm Earcon and so the `action-confirm` event. A hysteresis band at element edges and a cool-down per event (25 ms for a word tick up to 300 ms for a page change) prevent repeated firing. A global intensity setting scales all events.

### 7.4 Drivers in v1
Which driver is used is the setting `hapticDriver`.
- **Sound only (`none`, the default):** Earcons carry all the feedback.
- **Sound simulator (`simulator`):** plays each effect as low sound, so what hardware would feel can be heard through headphones or a subwoofer, and lets anything observe the waveform. It is opt-in, because the Earcons already make sound and a simulator on top would double every effect.
- **Game controller (`gamepad`):** the Gamepad API's dual-rumble, for any vibrating controller. Low thuds go to the heavy motor and sharp ticks to the light one. It runs in the page, because browsers expose controllers only to a focused page, only on secure (https) pages, and only after a button has been pressed.
- **Paired haptic device (`webhid`):** a USB HID device described by a JSON Device Profile. It runs in the background worker, because WebHID permission is per origin and a content script would need a separate grant for every website. The worker may be restarted by Chrome at any time, so it reconnects as needed.
- **Pairing** is done on a hardware setup page opened with **Alt+Shift+P**. It is built from real headings and buttons, is fully usable by keyboard, and speaks every result. Everything it offers: choose a driver, import a Device Profile as pasted JSON, pair a device (the browser's own chooser appears, which the page announces beforehand), and play a test pattern that names each effect aloud. With a screen reader (Companion mode) it writes to a live region instead of speaking, so nothing is said twice.

### 7.5 SDK
The `sdk/` folder and the exports of `src/haptics/index.ts`: the TypeScript driver contract, the event vocabulary and reference waveforms, the Device Profile JSON schema and validator, a conformance harness (`runConformance`) that a driver is checked with, an example profile, and an example driver that passes the harness with no hardware. Two routes: describe a device as JSON (a user can add it themselves, with no change to iBrowse), or write a driver (which Manifest V3 cannot load at run time, so it is contributed to the open-source extension). Publishing to npm happens with the public release.

---

## 8. Privacy, permissions and security

- **Local by default.** Page analysis, briefing, reading and local voices send nothing off the device.
- **Optional, opt-in features** that send data: cloud voice and AI descriptions and summaries, both through Google Gemini. Each needs the user's own key, a spoken warning, a separate "Allow", and the browser's permission for `generativelanguage.googleapis.com`, which is an **optional** host permission: until granted, nothing can be sent. No project server is involved.
- **What may be sent:** text spoken by the cloud voice; for AI, the page title, headings and the text of readable blocks, or one image fetched by the worker without cookies and sent as data. Never form values, passwords or hidden text. Page text goes inside delimiters as untrusted data, answers are cleaned of markdown and links, and they are spoken, never run.
- **The key** is used only by the background worker. A test checks that no code that runs in a web page imports it, and no error or spoken sentence can contain it.
- **Permissions:** `<all_urls>` host access, `activeTab`, `storage`, `tts`, `contextMenus`, `scripting`. The manifest test pins this exact set. WebHID and Gamepad need no manifest permission; the user grants each device through the browser's picker (details settled in Phase 4). Each permission is justified in the Web Store listing and a public privacy policy.
- **Storage:** settings and keys in `chrome.storage.local`. Keys never go into page context and never appear in logs.
- **Content safety:** page text is treated as untrusted. AI prompts must not follow instructions found in page text, and results are only spoken, never executed.
- **No analytics or telemetry** in v1. Crash and latency data stay local unless the user exports them.
- **Security review:** a security review runs before the beta and before each Web Store submission.

---

## 9. Technical architecture

### 9.1 Stack
TypeScript (strict), WXT on Vite (Manifest V3), Vitest, Playwright with the extension loaded. Options page in plain semantic HTML.

### 9.2 Components
| Component | Responsibility |
|---|---|
| **Content script (all frames)** | Hit testing, accessible name and role (`dom-accessibility-api`), page analyzer, mutation observer, wheel and touch handling |
| **Page analyzer** | Builds the layout model: regions, media, counts, hero and pagination detection |
| **Speech service** | Queue, interruption, fade, panning, provider selection |
| **Earcon engine** | Web Audio, pre-rendered buffers |
| **Haptic manager** | Driver registry and event routing |
| **Service worker** | Hotkeys, context menu, tab status, next-page navigation, key storage |
| **Options page and onboarding** | Settings, tutorial |
| **AI adapter (optional)** | Provider interface for captions and summaries |

### 9.3 Known platform limits (must be announced to the user)
`chrome://` pages, the Web Store, the built-in PDF viewer, closed shadow roots, canvas-only content, cross-origin frames without injection, and `navigator.vibrate` on desktop.

### 9.4 Quality bar
- 80%+ unit test coverage on analyzer, classifier, speech queue and drivers
- End-to-end tests on a fixed corpus of real sites in CI
- No console errors in normal operation
- Accessible name computation validated against the ARIA conformance tests

---

## 10. Success metrics

| KPI | Target | Method |
|---|---|---|
| Spatial discovery speed | 40% less time to locate a target control than keyboard-only tabbing | Timed benchmark with blind participants |
| Word comprehension | ≥ 98% accuracy in word recognition by scrubbing | Transcription test |
| False clickable reports | < 1% in v1 on the fixed corpus (stretch goal 0.1%) | Automated corpus test |
| Briefing accuracy | ≥ 90% of regions and counts correct | Labeled corpus, scored automatically |
| Task completion | ≥ 90% of testers complete login, search and checkout tasks unaided | Closed beta |
| Cognitive load | Statistically significant NASA-TLX reduction vs keyboard-only | Post-task survey |
| Latency | Meets §6.1 on a reference machine | Built-in meter |

---

## 11. Milestones

| Phase | Content |
|---|---|
| **0. Foundations** | WXT project, CI, permissions, speech service, earcons, latency meter |
| **1. Core exploration** | Hover hit testing, classification, affordance speech, spatial panning, explore toggle |
| **2. Intelligence** | Page analyzer, briefing and read prompt, click to read, wheel scrubbing, smart next page, context menu |
| **3. Operation** | Forms, keyboard commands, iframes and shadow DOM, dynamic-change announcements, browser status zone, touch |
| **4. Hardware** | `HapticDriver`, simulator, Gamepad and WebHID drivers, SDK, pairing flow |
| **5. Onboarding and settings** | Spoken first run, options page, screen reader coexistence mode, optional cloud voice and AI adapter |
| **6. Closed beta** | Blind testers recruited through an accessibility organization, fixes from findings, metric measurement |
| **7. Public release** | Security review, privacy policy, Web Store submission, SDK publication, demo site |

Each phase ends with: tests green, code review, and a walk-through by keyboard and audio only.

---

## 12. Existing simulator

`index.html`, `app.js` and `style.css` move to `/demo` and are published as a no-install demo of the experience and the haptic waveform visualizer. They also serve as a fixed test page for end-to-end tests. They are not the product.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Conflict with screen readers | Standalone and Companion modes, clear onboarding, Esc always stops speech |
| Wrong "clickable" reports | Corpus tests, conservative wording when uncertain ("May be clickable") |
| Briefing is wrong or too long | Short by default, details on demand, scored against a labeled corpus |
| Pages with heavy DOM | Off-thread analysis, caching, incremental updates |
| Cloud/AI data exposure | Opt-in, spoken warning, bring-your-own-key, no project server |
| Web Store review of `<all_urls>` | Clear justification, privacy policy, minimal optional permissions |
| Hardware makers cannot integrate | Typed SDK, example driver, test harness |
| Hijacked scrolling frustrates users | Explore mode only; wheel is taken only over text; Alt + wheel scrolls the page |

---

## 14. Resolved decisions (from the old open questions)

| Question | Decision |
|---|---|
| Hardware | Hardware-agnostic through drivers; audio-only default |
| Touch activation | Selectable; default lift-to-activate |
| Wheel at block end | Stop with boundary cue; second push continues; Alt + wheel scrolls the page |
| Page intelligence | Local analysis by default; optional AI with the user's own key |
| Prompts and navigation | Click, keys and gestures; no voice recognition |
| "Next page" | Smart: follows pagination, otherwise scrolls a screen |
| Briefing length | Short summary plus a read prompt; detail on demand |
| Screen reader | Standalone by default; Companion mode available |
| Privacy | Local by default; opt-in cloud voice and AI |
| License | Open source (MIT) |
