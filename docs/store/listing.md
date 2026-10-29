# Chrome Web Store listing

The text and answers to paste into the Chrome Web Store developer dashboard
(https://chrome.google.com/webstore/devconsole, account srksourabh@gmail.com). The images are in this
folder, made by `npm run build && npm run store-assets`. The package is made by `npx wxt zip`
(`.output/ibrowse-<version>-chrome.zip`).

## Store listing tab

- **Name:** iBrowse
- **Summary** (132 characters at most): Explore any website by sound. Hover, touch or speak to hear what is on a page and act on it. Made for blind users.
- **Category:** Accessibility
- **Language:** English

**Description:**

> iBrowse lets blind and low-vision people explore and use any website by moving a mouse or a finger over it and hearing what is there.
>
> Turn on Explore Mode (Alt+Shift+E, or the toolbar button) and iBrowse tells you what the page holds, panel by panel: the header, the left panel, the main content, the right panel and the footer.
>
> Move the pointer and iBrowse says what is under it: a heading, a link, a button, an image, a form field. Rest on something and it asks what you would like to do.
>
> Talk to it. Hold Alt+Shift+V, or answer when it asks, and say what you want: "click", "click add to basket", "scroll down", "scroll up", "what is on the left?", "read this", "go back". Anything that is not a command is a question, answered from the page if you turn on AI.
>
> Also:
> - Reads text word by word, follows pages and live updates, and says when forms change or are sent.
> - Works with screen readers: in Companion mode NVDA speaks for iBrowse, so you hear one voice.
> - Supports haptic devices through an open profile format.
>
> Private by default. iBrowse runs on your computer, has no servers, accounts or analytics, and does nothing while Explore Mode is off. Optional Google Gemini features (natural voice, AI summaries and answers, image descriptions, Gemini speech recognition) use your own key and send data only after you turn them on and are told what is sent.
>
> Free and open source: https://github.com/srksourabh/ibrowse

- **Icon:** `public/icon/128.png`
- **Screenshots** (1280×800): `screenshot-1-tour.png`, `screenshot-2-settings.png`, `screenshot-3-hardware.png`
- **Small promo tile** (440×280): `promo-small-440x280.png`
- **Homepage URL:** https://github.com/srksourabh/ibrowse
- **Support URL:** https://github.com/srksourabh/ibrowse/issues

## Privacy practices tab

**Single purpose:** iBrowse makes web pages usable without sight: it describes the page and what is under the pointer in speech, and lets the user act on the page by pointer, keyboard and voice.

**Permission justifications:**

| Permission | Justification |
|---|---|
| Host permission `<all_urls>` (content script on all sites and frames) | The user explores whatever site they are on. iBrowse has to read the page they choose, in every frame, to describe it and to press, scroll or fill it for them. It does nothing on a page until the user turns Explore Mode on. |
| `storage` | Keeps the user's settings, and their own Gemini key if they add one, on their device. |
| `tts` | Speaks descriptions, briefings and answers with the computer's own voices. Speech is the extension's main output. |
| `contextMenus` | Adds "Next page" and "Previous page" to the right-click menu, for pages split into several pages. |
| `offscreen` | Voice commands: speech recognition needs a document with microphone access, which a service worker cannot have. The offscreen document is open only while voice commands are in use. |
| Optional host `https://generativelanguage.googleapis.com/*` | Requested only when the user turns on a Google Gemini feature, and used only for it, with the user's own key. |

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage.** Tick these, because they can leave the device when the user turns on a Gemini feature:

- **Website content:** page text, and the one image the user asks about, are sent to Google Gemini only for AI features the user turned on.
- **Personal communications** (or the closest audio category the form offers): when the user chooses Gemini for voice commands, a recording of what they say while iBrowse is listening is sent to Google Gemini to be turned into text. Nothing is kept.

Leave the rest unticked. iBrowse does not collect personally identifiable information, health, financial or authentication data, location, web history or user activity. The Gemini key is stored on the device and sent only to Google, as the user's own credential.

Certify all three: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy URL:** https://github.com/srksourabh/ibrowse/blob/main/PRIVACY.md

## Distribution tab

- **Visibility:** Unlisted for the closed beta (only people with the link can install). Public at release.
- **Regions:** all.

## Upload steps

1. `npm run build && npx wxt zip`
2. Dashboard → **New item** → upload `.output/ibrowse-0.2.0-chrome.zip`.
3. Fill the three tabs above, then **Submit for review**. Broad host access means an in-depth review, which can take several days.
4. When it is approved, record the extension ID: the desktop installers (ADR-0016) need it.
