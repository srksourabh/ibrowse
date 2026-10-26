<div align="center">

<img src="docs/media/slides/slide-01.png" alt="iBrowse: hear any website. Explore it by mouse, touch, keyboard and voice, built for blind and low-vision people." width="860">

<h3>Hear any website. Explore it by mouse, touch, keyboard and voice.</h3>

[![CI](https://github.com/srksourabh/ibrowse/actions/workflows/ci.yml/badge.svg)](https://github.com/srksourabh/ibrowse/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-a855f7)
![Chrome Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-1094%20unit%20%C2%B7%2099%20e2e-22c55e)
![Works with NVDA](https://img.shields.io/badge/works%20with-NVDA-f97316)
![Status](https://img.shields.io/badge/status-closed%20beta%20next-db2777)

**[▶ Watch the demo](docs/media/ibrowse-demo.mp4)** · **[See the presentation](https://srksourabh.github.io/ibrowse/presentation/)** ([PDF](docs/presentation/iBrowse-presentation.pdf)) · **[Every feature](docs/FEATURES.md)** · **[Install](#install)**

</div>

<br>

<sup><b>🟣 WHAT IT IS</b></sup>

## A map of any website, spoken

iBrowse is a Chrome extension for blind and low-vision people. Turn on **Explore Mode** and it tells you what the page holds, panel by panel: the header, the left panel, the main content, the right panel and the footer. Move a mouse or a finger and hear what is under it. Rest on something and it asks **"What would you like to do?"**. Answer out loud, or hold **Alt+Shift+V** and say "click add to basket", "scroll down" or "what is on the left?".

It works on the websites you already use, with no changes to them, and it runs on your computer.

<sup><b>🩷 SEE IT · AND HEAR IT</b></sup>

## The demo

<div align="center">

<a href="docs/media/ibrowse-demo.mp4"><img src="docs/media/ibrowse-demo.gif" alt="Demo: iBrowse briefs a shop page panel by panel, names a link, an image and a paragraph under the pointer, reads the paragraph, asks what to do on the Add to basket button, presses it when the user says Click, asks for a yes before Buy now, then scrolls and describes the left panel on spoken commands. Captions show what iBrowse and the user say." width="860"></a>

<sub>The GIF is silent. <a href="docs/media/ibrowse-demo.mp4">The MP4 has both voices</a>, and <a href="https://srksourabh.github.io/ibrowse/presentation/#slide-8">the presentation plays it with captions</a>. In the recording, the user's voice commands are simulated and both voices are synthesised.</sub>

</div>

<sup><b>🟠 HOW IT WORKS</b></sup>

## Turn it on, listen, explore, talk, act

<img src="docs/media/slides/slide-03.png" alt="Five steps: press Alt+Shift+E to turn on, hear the briefing panel by panel, explore by hover, touch and wheel, talk by holding Alt+Shift+V, and iBrowse acts: click, scroll, read." width="100%">

| | |
|---|---|
| <img src="docs/media/slides/slide-04.png" alt="Page briefing: a page split into header, left, main, right and footer, with the spoken summary." width="420"> | <img src="docs/media/slides/slide-07.png" alt="Voice conversation: things you can say, and a confirmation: You say Click buy now. iBrowse says Buy now. Say yes to press it, or no. You say Yes." width="420"> |
| **Page briefing.** Landmarks or the layout itself become a spoken map. | **Voice.** Say a command, or ask a question. Risky presses wait for a spoken yes. |

<sup><b>🟢 WHAT YOU CAN DO</b></sup>

## Features

| | |
|---|---|
| 🗺️ **Page briefing** | Header, left panel, main content, right panel and footer, then "Want me to read it?" |
| 🖱️ **Explore by pointer** | "Add to basket — Button, Clickable." Speech stops the moment you move on. Earcons are panned left or right to where things are. |
| 🎤 **Talk to it** | Hold Alt+Shift+V, or answer when it asks. "Click", "click sign in", "scroll down", "what is on the left?", "find the search box", "go back". |
| 🛡️ **Safe by voice** | Paying, sending, deleting or agreeing waits for a spoken yes. It never guesses what to press. |
| 📖 **Reading** | Click a paragraph to hear it. The wheel steps word by word, and Shift + wheel spells a word. |
| 🧭 **Moving around** | Jump by heading or landmark. A smart next page follows "Next" links or scrolls. |
| 📝 **Forms and live changes** | Fields, typing echo, errors, dialogs and live updates are spoken. Passwords are never spoken. |
| ☝️ **Touch** | Drag to explore, double-tap to activate, edge tones at the sides of the screen. |
| 🗣️ **Screen reader friendly** | In Companion mode NVDA speaks for iBrowse, so you hear one voice. Checked with real NVDA. |
| 🎮 **Haptics** | A rumbling game controller, or a USB haptic device described in JSON, through an open [SDK](sdk/README.md). |
| ✨ **Optional AI** | With your own Google Gemini key: a natural voice, page summaries, image descriptions and answers to spoken questions. |
| 🔒 **Private by default** | No servers, no accounts, no analytics. Nothing is sent unless you turn a feature on and are told what is sent. |

The complete list is in **[docs/FEATURES.md](docs/FEATURES.md)**.

<sup><b>🔵 WHO IT IS FOR</b></sup>

## Who it is for

| You are… | iBrowse gives you… |
|---|---|
| **Blind, using a screen reader** | A spatial way to explore layout (where things are), beside your screen reader through Companion mode. |
| **Blind, with no screen reader** | A complete standalone voice. Install, tour, settings and hardware setup all speak. |
| **Low vision** | Audio descriptions of what is under the pointer, plus a briefing of the whole page. |
| **A haptic or accessibility hardware maker** | An open [SDK](sdk/README.md): describe a device in JSON, or contribute a driver. |
| **An accessibility researcher or teacher** | An open, tested reference for hover, touch, voice and haptic page exploration. |
| **A developer** | A well-documented MV3 codebase with decisions recorded as ADRs. |

It is **not** a replacement for a full screen reader, and is not a medical or safety device. See the [usage policy](USAGE_POLICY.md).

<sup><b>🟣 GET STARTED</b></sup>

## Install

iBrowse is heading to the Chrome Web Store. Until then:

```
git clone https://github.com/srksourabh/ibrowse.git
cd ibrowse
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `.output/chrome-mv3`. A spoken tour opens on install.

## Quick start

1. Press **Alt+Shift+E** on a page, or click the iBrowse toolbar button, to turn on Explore Mode.
2. Listen to the briefing: the header, left panel, main content, right panel and footer, and what each holds. Press **Y** to have it read, or **N** to skip.
3. Move the mouse, or drag a finger, to hear what is under it. Click a paragraph to read it.
4. Press **Alt+Shift+S** for settings and **Alt+Shift+P** for hardware.
5. Optional: turn on **Voice commands** in settings. Then hold **Alt+Shift+V** and speak, or answer when iBrowse asks "What would you like to do?" after you rest the pointer on something.

<details>
<summary><b>Keyboard and mouse</b></summary>

| Do this | Keys |
|---|---|
| Turn Explore Mode on or off | Alt+Shift+E, or the toolbar button (it shows ON while active) |
| Answer the read question | Y or Enter / N or Esc |
| Read the clicked paragraph | Click it |
| Step through words | Scroll wheel over text (Shift+wheel spells the word) |
| Scroll the page | Alt+wheel |
| Next / previous page | Alt+Shift+Right / Left, side mouse buttons, or right-click menu |
| Next / previous heading | Alt+Shift+Down / Up |
| Next / previous landmark | Alt+Shift+PageDown / PageUp |
| Where am I (title, site, security, tab) | Alt+Shift+W, or move the pointer to the very top edge |
| Detailed briefing / read from here | Alt+Shift+B / Alt+Shift+R |
| Describe the image under the pointer | Alt+Shift+D (needs Gemini) |
| Summarise the page | Alt+Shift+M (needs Gemini) |
| Settings | Alt+Shift+S |
| Hardware setup | Alt+Shift+P |
| Stop speaking | Esc |
| Touch: explore / activate | Drag or tap / double-tap anywhere |
| Talk (voice commands on) | Hold Alt+Shift+V, speak, let go |

Change the browser-level shortcuts at `chrome://extensions/shortcuts`.

</details>

<details>
<summary><b>Voice commands</b></summary>

With voice commands on, say any of these while holding Alt+Shift+V, or as the answer when iBrowse asks what to do:

| Say | It does |
|---|---|
| "click", "press it" | Presses what the pointer is on (reads it, if it is text) |
| "click sign in" | Presses the control with that name |
| "scroll down", "scroll up", "go to the top" | Scrolls, then says what is on screen |
| "read this", "read the page" | Reads aloud |
| "next page", "go back" | Moves between pages; Explore Mode stays on |
| "what is on the left", "go to the main content" | Describes or moves to a panel |
| "find the search box", "where is the login" | Moves to it and says what it is |
| "stop", "repeat", "where am I", "help" | Just that |
| Anything else | A question about the page, answered by AI if it is on |

Chrome turns speech into text on your computer when it can, and otherwise sends it to Google for that. iBrowse listens only while you hold the key, or for five seconds after it asks you something.

</details>

<details>
<summary><b>Screenshots of the settings, hardware setup and tour</b></summary>

Every page of iBrowse works by keyboard and is spoken aloud. These are the pages you can see.

| Settings | Hardware setup | First-run tour |
|---|---|---|
| ![The iBrowse settings page: a heading, instructions to use Tab, and a Speech section with rate, pitch, volume and voice fields, each with a one-sentence help line.](docs/images/settings.png) | ![The hardware setup page, where a person chooses a sound simulator, a game controller, or a USB haptic device.](docs/images/hardware-setup.png) | ![The first-run tour page, which opens on install and speaks each step.](docs/images/first-run-tour.png) |

</details>

<sup><b>🩵 PRIVATE BY DEFAULT</b></sup>

## Privacy in one paragraph

Everything runs on your device. Nothing is sent anywhere unless you turn on a Google Gemini feature, enter your own key, and allow the browser permission. Form values and passwords are never collected, and your key is kept where web pages cannot reach it. Full details: [PRIVACY.md](PRIVACY.md).

<sup><b>🟠 UNDER THE HOOD</b></sup>

## How it is built

```mermaid
flowchart LR
  subgraph Page["Every web page (content script, all frames)"]
    B[Briefing and panels] --- H[Hover, touch, reading]
    H --- F[Forms and live changes]
    F --- V[Voice commands]
  end
  subgraph Worker["Background worker"]
    T[Computer's voices] --- S[Settings, toolbar, keys]
    S --- K[(Gemini key vault)]
    K --- D[Haptic devices]
  end
  O["Speech recognition<br/>(hidden page, only while listening)"]
  G["Google Gemini<br/>(optional, your own key)"]
  Page <--> Worker
  Worker <--> O
  Worker -.-> G
```

| Path | What it holds |
|---|---|
| `entrypoints/`, `src/` | The Chrome extension (TypeScript, WXT) |
| `tests/`, `e2e/` | Unit tests (Vitest) and end-to-end tests (Playwright, real Chromium); `e2e/live/` holds checks with real speech, a real microphone and NVDA |
| `sdk/` | Haptics SDK: JSON schema, examples |
| `docs/presentation/` | The presentation (HTML and PDF) |
| `docs/adr/` | Architecture decisions and their reasons |
| `docs/phases/` | Plan and exit checklist for each phase |
| `docs/store/` | The Chrome Web Store listing |
| `apps/windows/` | iBrowse for Windows (.NET): **early preview**, core tested, not yet used with a screen reader |
| `apps/ios/` | iBrowse for iOS: **plan only**, not built |
| `.claude/skills/ibrowse-contributor/` | A skill that teaches an AI agent to work on this repo |
| `demo/` | The original browser simulator (not the product) |

<sup><b>🟢 QUALITY</b></sup>

## Tested like it matters

<img src="docs/media/slides/slide-12.png" alt="Quality: 1,094 unit tests with about 98% of lines covered; 99 end-to-end tests run five times in a row; 398 of 444 official W3C accessible-name tests matched; a real voice and real NVDA checked." width="100%">

## Develop

Requires Node 20 or newer.

```
npm install
npm run dev           # opens Chrome with the extension loaded
npm run typecheck
npm test              # unit tests with coverage
npm run build         # output in .output/chrome-mv3
npm run test:e2e      # end-to-end, needs a build first
npm run screenshots   # refresh docs/images
npm run store-assets  # refresh the Web Store images
npm run icons         # render public/icon from scripts/icon.svg
```

The demo video and the presentation images are made from the real extension: see `e2e/media/demo-video.spec.ts`, `scripts/media/make-demo.mjs` and `scripts/media/export-deck.mjs`.

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundations | Done |
| 1 | Core exploration | Done |
| 2 | Intelligence | Done |
| 3 | Operation | Done |
| 4 | Hardware | Done |
| 5 | Onboarding, settings, voices, AI | Done |
| 5b | Conversation: panel briefing, voice commands, questions | Done, checked with a real microphone, real speech and NVDA |
| 6 | Closed beta | Next |
| 7 | Public release on the Chrome Web Store | After the beta |

Still to try with blind testers: accents, a noisy room, real haptic devices, VoiceOver and a real touchscreen. Details are in [docs/phases](docs/phases).

## Documents

| File | What it holds |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Everything iBrowse can do, in one list |
| [Presentation](https://srksourabh.github.io/ibrowse/presentation/) ([PDF](docs/presentation/iBrowse-presentation.pdf)) | How iBrowse works, in 13 slides |
| [PRD.md](PRD.md) | Requirements, scope, milestones |
| [CONTEXT.md](CONTEXT.md) | Shared vocabulary used in code, tests and speech |
| [CLAUDE.md](CLAUDE.md) | Working rules for AI agents and contributors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to help |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities |
| [PRIVACY.md](PRIVACY.md) | What is stored and sent |
| [USAGE_POLICY.md](USAGE_POLICY.md) | Acceptable use and honest limits |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | Our accessibility commitments |
| [SUPPORT.md](SUPPORT.md) | Where to get help |
| [CHANGELOG.md](CHANGELOG.md) | What changed |

## Roadmap

Closed beta with blind testers, then a Chrome Web Store release and a published SDK. The Windows desktop explorer ([early preview](apps/windows/README.md)) grows toward parity with the extension, and desktop installers will add the extension with an On/Off switch. An iOS browser ([plan only](apps/ios/README.md)) needs a Mac to build.

<div align="center">

<br>

**Built for people who explore the web by ear.** Contributions, testing and feedback are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

[MIT](LICENSE) · Copyright (c) 2026 iBrowse contributors

</div>
