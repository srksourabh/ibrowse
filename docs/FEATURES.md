# What iBrowse can do

iBrowse is a Chrome extension (Manifest V3) that lets blind and low-vision people explore and use any website by mouse, touch, keyboard and voice, and hear what is there. This is the complete list of what the current version (0.2.0) does. Requirements and their reasons are in [PRD.md](../PRD.md); decisions are in [docs/adr](adr/).

## 1. Turning it on and off

- **Explore Mode** is turned on and off with **Alt+Shift+E** or the **toolbar button**. The button shows **ON** and its title says the state for that tab.
- Turning it on says "Explore mode on" and gives the page briefing. Turning it off says "Explore mode off".
- **Nothing is intercepted while Explore Mode is off**: wheel, touch and keys behave as normal.
- Optional setting: **start in Explore Mode on every page**.
- On pages iBrowse cannot reach (Chrome's own pages, the Web Store, the PDF viewer), the button and the hotkey **say why**.
- After a "next page" link loads, Explore Mode turns itself back on and briefs the new page.

## 2. Page briefing

- When Explore Mode turns on, iBrowse looks at the page **on the computer** and says what it holds, **panel by panel**: header, left panel, main content, right panel, footer. For example: "Header: logo, search box, 3 links. Left panel, Categories: 3 links. Main content, Tomatoes: 2 paragraphs, 1 button. Right panel, Offers: 1 link. Footer: 2 links."
- Panels are found from **landmarks** (header, nav, main, aside, footer) when the page has them. Otherwise they come from the **layout**, the columns on screen, without being fooled by menu bars, and it stays quick on big pages.
- Pages without panels get a short summary: title, page type, notable media and counts of paragraphs, headings, links, forms and fields.
- Then it asks **"Want me to read it?"**. Y or Enter reads the main content; N, Escape or moving the mouse dismisses it.
- **Alt+Shift+B** gives a detailed briefing: every region in layout order, with its position.
- With AI on (section 10), the briefing adds a **one-line purpose** ("This looks like a recipe for…").

## 3. Exploring by pointer (mouse)

- Moving the pointer over the page names what is under it: heading, link, button, image, text, form field, and so on. For example: "Add to basket — Button, Clickable". Names follow the W3C accessible-name rules, checked against the official WPT test suite.
- Speech stops at once when the pointer moves to something new.
- **Earcons** (short sounds) mark what kind of thing it is, and are **panned left or right** to match where it is on screen.
- **Short announcements** setting: earcons replace most words, for experienced users.
- Works inside **iframes**, including ones from other sites, and open shadow roots.
- Content that cannot be read is named: "Embedded video, cannot be read", "Graphic with no text", "Image, no description".
- **Resting** on something names it, then asks **"What would you like to do?"** and listens briefly for an answer (needs voice commands on, section 8).

## 4. Clicking, and reading by click

- **Clicking a control** (button, link, field) uses it, and the confirm earcon plays.
- **Clicking text** (a paragraph, a list, a quote) **reads it aloud**, as one unit that can be interrupted.
- Hovering a paragraph says what it is and offers it: "Paragraph: The quick brown fox… Click to read."

## 5. Reading

- **Wheel scrubbing:** over text, the mouse wheel moves **word by word** (down for the next word, up for the previous one) and says each word.
- **Boundaries:** at the end of a block the wheel stops, with a bounce sound. Pushing again goes into the next block.
- **Spelling:** pausing on a word for a moment, or **Shift + wheel**, spells it letter by letter.
- **Read from here:** **Alt+Shift+R** reads from the current word, or the last place visited, to the end. Pointer movement does not cut the reading off; Escape stops it.
- **Alt + wheel** scrolls the page. Ctrl + wheel is left as the browser's zoom.
- Speech settings: **rate, pitch, volume and choice of voice**. By default iBrowse uses the computer's own voices, on the device.

## 6. Moving around the page and between pages

- **Next / previous heading:** Alt+Shift+Down / Up.
- **Next / previous landmark:** Alt+Shift+PageDown / PageUp.
- **Smart next / previous page:** Alt+Shift+Right / Left, the side mouse buttons, or the right-click menu. It follows the page's "Next" link when there is one; otherwise it scrolls a screen, and says which it did.
- Scrolling says "**End of page**" on arrival, and "Next page is available" when there is one.
- On **infinite-scroll** pages: "Loaded 12 more items".
- Each jump continues from where the user is: the last place jumped to, hovered, focused or read.

## 7. Forms, live changes and where am I

- **Fields** say their label, type, value and whether they are required: "Email — Edit text, empty, required".
- **Typing echo:** each character, each word, or nothing. Deletions are announced.
- **Passwords are never spoken.** Each key gives a tick, and hovering says only "empty" or "filled".
- Checkboxes, radio buttons, menus and sliders say their new state when changed. Field errors are read out.
- **Sending a form** is confirmed ("Sign in: submitted"), and is not claimed when the page stops it.
- **Live changes:** new messages, alerts and status text (live regions) are spoken. Opening dialogs are announced by name ("Dialog opened: Sign in"). Alerts interrupt; the same words are not repeated within 1.5 seconds.
- **Where am I:** **Alt+Shift+W**, or moving the pointer to the very top edge of the page, says the page title, the site, whether the connection is secure, whether it is still loading, and the tab ("Tab 2 of 5").

## 8. Voice: talking to iBrowse

Turned on in settings, with the microphone allowed once.

- **Push to talk:** hold **Alt+Shift+V**, speak, let go. A sound marks the start and end of listening.
- **Answer the question:** after "What would you like to do?", just answer. iBrowse listens for five seconds.
- iBrowse **never listens while it is speaking**, and only while Explore Mode is on.
- **Commands**, understood on the computer:

  | Say | It does |
  |---|---|
  | "click", "press it" | Presses what the pointer is on, or reads it if it is text |
  | "click sign in", "click add to basket" | Presses the control with that name. If several match, it asks which: "Which one? A, B or C." |
  | "scroll down", "scroll up", "go to the top", "go to the bottom" | Scrolls, then says what is on screen |
  | "read this", "read the page" | Reads aloud |
  | "next page", "previous page", "go back", "go forward" | Moves between pages |
  | "what is on the left", "what is in the header", "go to the main content" | Describes, or moves to, a panel |
  | "find the search box", "where is the login" | Moves there and says what it is |
  | "stop", "repeat", "where am I", "describe the page", "help" | Just that |
  | "yes", "no" | Answers iBrowse's question |

- **Asks before a press that may not be taken back:** buying, paying, sending, deleting, agreeing, signing out, or sending a form that posts to the site or takes card details. iBrowse says "…Say yes to press it, or no." It judges by the button's visible text and form as well as its label, so a page cannot disguise "Pay now" as "Continue".
- **Never guesses** what to press: a name has to match whole words.
- If nothing is heard after a held key: "**I didn't catch that.** Hold Alt+Shift+V and try again." A command said twice ("Scroll down. Scroll down.") is carried out once.
- **Questions:** anything that is not a command is a question about the page. With AI on, it is answered from the page's text. Without AI, iBrowse suggests commands.
- **Two recognisers to choose from:**
  - **Chrome's own.** It recognises speech on the computer when Chrome has that installed, and otherwise uses Google's online service.
  - **Google Gemini**, with the user's key. Silence is never sent.

  Turning voice on says which recogniser is in use and where the audio goes.

## 9. Touch

- Explore with a **finger** on a touch screen, the same way as with the mouse. While Explore Mode is on, dragging explores rather than scrolls.
- **Activation style:**
  - **double-tap anywhere** (the default) activates what was explored before the tap;
  - **direct tap** activates what is under the finger.
- After a touch, the **mouse wheel scrubs at the touched spot** until the mouse moves.
- Reaching the **edge of the screen** with a finger plays an edge tone on that side.

## 10. Optional Google Gemini features

All are off by default. Each one uses the user's **own Gemini key**. Turning one on says out loud what will be sent, and waits for a separate "Allow and turn on" before the browser asks permission to contact Google.

- **Natural cloud voice**, for reading only or for everything, with a choice of voice and model. Phrases heard often are remembered, so they are paid for once.
- **AI page purpose** in the briefing.
- **Page summary:** Alt+Shift+M.
- **Image description:** Alt+Shift+D describes the image under the pointer. Images without a description are offered for it. Images on the user's own network are never fetched or sent.
- **Spoken questions** answered from the page.
- **Gemini speech recognition** for voice commands.
- Page text is always treated as **data, never instructions** to the AI.
- The key is saved where web pages cannot reach it, is never spoken or logged, and can be **checked** ("Key accepted") and **removed** in settings.

## 11. Working with a screen reader

- **Standalone mode** (default): iBrowse speaks with its own voice.
- **Companion mode:** iBrowse hands its words to the screen reader, such as **NVDA**, so the user hears **one voice**. Checked with NVDA:
  - NVDA read the panel briefing and the hover descriptions once, and iBrowse stayed silent;
  - push to talk worked while NVDA was running.

## 12. Haptics and hardware

- **Alt+Shift+P** opens hardware setup. It is fully usable by keyboard and speaks every step.
- Devices:
  - **sound only** (the default);
  - a **sound simulator** (hear what hardware would feel, through headphones or a subwoofer);
  - any **game controller that rumbles**;
  - a **USB haptic device** described by a JSON **Device Profile**.
- Pair a device, import a profile, play a test pattern that names each effect, and set the **haptic strength**.
- Every sound has a matching haptic effect, so what is heard and what is felt agree.
- **Open SDK** for hardware makers: schema, example profile, example driver and conformance checks (`sdk/`).

## 13. First run and settings

- On first install, iBrowse first asks **"Do you use a screen reader?"**. Y chooses Companion, N chooses Standalone, and it is asked only once. Then a **spoken tour** opens. Its 11 steps cover Explore Mode, exploring, reading, moving, where am I, forms, touch, voice, settings and hardware. Enter goes on, Backspace goes back, R repeats and Escape skips. It can be heard again from settings.
- **Settings: Alt+Shift+S.** The page is made of real headings and controls. Each setting is read out (name, value and what it does) when it gets focus, and every change is spoken.
- Setting groups:
  - **Speech:** rate, pitch, volume, local voice, short announcements.
  - **Exploring:** always start in Explore Mode, touch activation, typing echo.
  - **Voice commands:** off, Chrome's recogniser, or Gemini.
  - **Screen reader:** Standalone or Companion.
  - **Haptics:** device and strength.
  - **Cloud voice and AI:** cloud voice, voice name and model, AI on or off, AI model, and the Gemini key.
  - **Developer:** measure delays.
- **Measure delays** reads out how long sounds, speech start and stopping speech take, against their targets.
- Browser-level shortcuts can be changed at `chrome://extensions/shortcuts`.

## 14. Privacy

- Runs on the computer. **No servers, no accounts, no analytics, no tracking.**
- **Nothing is sent anywhere** unless the user turns on a Gemini feature and is told what is sent; [PRIVACY.md](../PRIVACY.md) lists every case.
- **Never sent:** form values, passwords, cookies, browsing history, or anything while Explore Mode is off.
- The microphone is used only while iBrowse is listening, and **recordings are never kept**.
- Page content, keys and what the user says are **never logged**.
- The extension asks only for: access to the sites the user explores, storage, the computer's voices, the right-click menu, and a hidden page for speech recognition. Access to Google is optional, and is asked for only when a Gemini feature is turned on.

## 15. Also in the repository

- **Windows desktop explorer** (`apps/windows/`, .NET): an early preview with a tested core, not yet tried with a screen reader.
- **iOS browser** (`apps/ios/`): a plan only.
- **Legacy browser simulator** (`demo/`, `npm run demo`), published as a demo site.

## Known limits

- iBrowse cannot read Chrome's own pages (`chrome://`), the Chrome Web Store, the built-in PDF viewer, closed shadow roots, content drawn only on a canvas, or frames it cannot reach. It says so when this happens.
- Phones and tablets do not vibrate from a desktop browser; use a game controller or a paired device.
- The local voice cannot be panned left or right in a browser, so the earcons carry the direction.
- Touch scrolling is off while Explore Mode is on; use Next Page or Alt + wheel.
- Images on a company intranet page are not described, because the private-network rule refuses them.
- Not yet tried with blind testers: accents, a noisy room, and Chrome's recogniser inside the extension in Google Chrome. These are planned for the closed beta.
