# Chrome Web Store Listing — iBrowse v0.2.0

Use this sheet to fill out the **Store Listing** and **Privacy Practices** tabs on `https://chrome.google.com/webstore/devconsole`.

---

## 1. Package to Upload
- **Zip file:** `.output/ibrowse-0.2.0-chrome.zip` (built with `npm run build && npx wxt zip` — zero embedded API keys)

## 2. Store Listing
- **Name:** `iBrowse`
- **Short Summary (max 132 chars):**
  `Explore and operate any website by touch, mouse, keyboard, and voice. Built for blind and low-vision users.`
- **Category:** `Accessibility`
- **Language:** `English`
- **Homepage URL:** `https://github.com/srksourabh/ibrowse`
- **Support URL:** `https://github.com/srksourabh/ibrowse/issues`

### Detailed Description
```text
iBrowse lets blind and low-vision people explore and operate any website using mouse, touch, keyboard, and voice — with stereo spatial audio, subtle Indian English speech, and optional haptic feedback.

KEY FEATURES
• Instant Page Briefing — Press Alt+I on any page to hear its title, layout panels, and counts, then press Y to read it aloud.
• Spatial Hover & Touch Exploring — Move your pointer or drag your finger to hear buttons, links, headings, forms, and images with stereo panning and distinct earcons. Double-tap anywhere to activate.
• Word-by-Word Scrubbing — Roll the scroll wheel over any paragraph to step word by word (Shift+wheel spells the word).
• Works Alone or With Your Screen Reader — Standalone mode uses iBrowse's own voice; Companion mode sends announcements to NVDA, JAWS, or VoiceOver so two voices never talk over each other.
• Keyboard & Voice Commands — Jump by heading or landmark, ask "where am I?", or hold Ctrl+Alt+V to speak commands like "click sign in", "scroll down", or "read".
• Optional Google Gemini Live Voice & AI — Bring your own Google API key in Settings to unlock natural Indian English cloud speech, image descriptions, and page summaries.
• Optional Haptics — Works with sound only, a built-in sound simulator, game controllers, or paired WebHID haptic devices.

PRIVACY FIRST
• Inactive until you turn Explore Mode on.
• No accounts, no servers, no analytics, no tracking.
• Nothing leaves your device unless you explicitly turn on Cloud Voice, AI, or Voice Commands and grant permission.
```

### Graphics to Upload (in `docs/store/`)
- **Store icon (`128×128`):** `public/icon/128.png`
- **Screenshots (`1280×800`):**
  1. `docs/store/screenshot-1-tour.png` — First-run spoken setup & tour
  2. `docs/store/screenshot-2-settings.png` — Plain-English, keyboard-accessible Settings page
  3. `docs/store/screenshot-3-hardware.png` — Haptic hardware setup page
- **Small promo tile (`440×280`):** `docs/store/promo-small-440x280.png`

---

## 3. Privacy Practices Tab

### Single Purpose Description
`Let blind and low-vision users explore and operate any web page using mouse, touch, keyboard, audio, and optional voice commands.`

### Permission Justifications
- **`tts`:** Speaks element descriptions, page briefings, typing echo, and settings aloud in Standalone mode.
- **`storage`:** Saves user preferences locally on the device (speech rate, shortcuts, screen reader mode, etc.).
- **`contextMenus`:** Adds "iBrowse: Next page" and "iBrowse: Previous page" items to the browser context menu for easier page navigation.
- **`offscreen`:** Runs speech recognition inside an offscreen document when the user enables optional push-to-talk voice commands (Manifest V3 requires an offscreen document for audio capture).
- **`host_permissions` (`<all_urls>`):** Required so Explore Mode can inspect and speak elements on whichever website the user chooses to browse. Nothing is intercepted or read when Explore Mode is off.
- **`optional_host_permissions` (`https://generativelanguage.googleapis.com/*`):** Requested only if the user explicitly opts into optional Cloud Voice or AI summaries with their own Google API key.

### Remote Code
- **Are you using remote code?** `No, I am not using remote code.` (All JavaScript is bundled inside the extension package.)

### Data Usage & Privacy Policy
- **Privacy Policy URL:** `https://github.com/srksourabh/ibrowse/blob/main/PRIVACY.md`
- **Data collection:** None collected by the developer. Certify all 3 disclosures (no selling data, no unrelated use, no creditworthiness/lending use).
